/* =========================================================
   AUDIT LOG QUERY SERVICE — Phase 3 (P3c.1)
   Backend query endpoint untuk halaman "Aktivitas".

   Filter: period preset (today/7days/30days), entity_type[],
           action[], actor_user_id[].
   Search aktor by nama: di FRONTEND substring match (backend
           enrich rows dengan actor_full_name + actor_username
           supaya client punya field untuk search).
   Mode: client-side pagination. Backend kirim sampai
         AUDIT_LOG_MAX_LIST_LIMIT row sekaligus, frontend
         yang slice per halaman. Konsisten dengan
         Patients/Recall/Appointments canonical.
   Visibility per role: owner/super_admin = all,
           admin_appointment = patient/appointment/treatment/ortho_recall,
           admin_finance = billing/payment/expense/etc,
           doctor = denied.
   ========================================================= */

// Audit log mulai aktif sejak P3a deploy. Dipakai banner UI supaya
// owner paham kenapa data sebelum tanggal ini kosong.
const AUDIT_LOG_ACTIVE_SINCE = '2026-05-19';

// Mapping role → allowed entity_type list.
// null = full access (tidak ada filter entity_type).
// Array = whitelist (intersect dengan filter user kalau ada).
// Empty array = explicit deny.
const AUDIT_LOG_ROLE_ALLOWED_ENTITY_TYPES = {
  owner:             null,
  super_admin:       null,
  admin_appointment: ['patient', 'appointment', 'treatment', 'ortho_recall'],
  admin_finance:     [
    'billing', 'billing_adjustment', 'payment',
    'billing_installment_plan', 'billing_invoice', 'billing_feedback',
    'expense', 'doctor_compensation_rule', 'doctor_material_deduction',
    'service_catalog', 'clinic_info'
  ],
  doctor:            []
};

// Hard cap jumlah row per query. Di atas ini user wajib persempit
// period — sengaja ditampilkan banner di UI. Dipilih 2000 supaya
// payload tetap <~500KB untuk volume realistis multi-klinik produksi.
const AUDIT_LOG_MAX_LIST_LIMIT = 2000;

// Whitelist period preset → jumlah hari ke belakang dari local midnight
// hari ini. Hanya preset ini yang diterima backend (cegah unbounded query).
// Default 'today' — konsisten dengan Dashboard/Finance (single canonical
// default untuk semua halaman dengan period preset).
const AUDIT_LOG_VALID_PERIODS = {
  today:    0,
  '7days':  7,
  '30days': 30
};
const AUDIT_LOG_DEFAULT_PERIOD = 'today';

// Whitelist `action` values yang sah. Sinkron dengan ACTIVITY_ACTION_LABELS
// di audit-log.html. Input dari user yang tidak ada di whitelist akan
// di-drop diam-diam (defensive — cegah injection error message ke
// PostgREST `in.()` syntax).
const AUDIT_LOG_VALID_ACTIONS = {
  create: true, update: true, delete: true, deactivate: true,
  activate: true, cancel: true, restore: true, complete: true,
  submit: true, replace: true, clear: true, save_contact: true,
  confirm_doctor_fee: true, generate_totp: true, reset_totp: true,
  disable_totp: true, send_totp_setup_email: true,
  generate_pdf: true, send_email: true
};

// Whitelist semua entity_type yang valid. Subset role-specific di-handle
// terpisah via AUDIT_LOG_ROLE_ALLOWED_ENTITY_TYPES. Input di luar list ini
// di-drop (defensive guard).
const AUDIT_LOG_VALID_ENTITY_TYPES = {
  patient: true, appointment: true, treatment: true, ortho_recall: true,
  billing: true, billing_adjustment: true, payment: true,
  billing_installment_plan: true, billing_invoice: true,
  billing_feedback: true, expense: true, doctor_compensation_rule: true,
  doctor_material_deduction: true, service_catalog: true,
  clinic_info: true, user: true
};

// Regex untuk user_id (alfanumerik + dash/underscore, max 64 char).
// User_id existing format: USR-xxxx, OWNER-xxxx, dll. Tolerant tapi
// mencegah karakter PostgREST seperti paren, comma, dot.
const AUDIT_LOG_USER_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Hitung daftar entity_type yang boleh dilihat user, berdasarkan
 * union semua role-nya. Owner/super_admin → null (semua boleh).
 *
 * @param {object} user  auth.user object dengan field roles[]
 * @returns {string[]|null}  null = all, [] = deny, [...] = whitelist
 */
function computeAuditLogAllowedEntityTypesForUser_(user) {
  const roles = (user && Array.isArray(user.roles)) ? user.roles : [];

  if (roles.some(function(r) {
    return r === 'owner' || r === 'super_admin';
  })) {
    return null;
  }

  const allowedMap = {};
  roles.forEach(function(r) {
    const list = AUDIT_LOG_ROLE_ALLOWED_ENTITY_TYPES[r];
    if (Array.isArray(list)) {
      list.forEach(function(t) { allowedMap[t] = true; });
    }
  });
  return Object.keys(allowedMap);
}

/**
 * Hitung start datetime untuk period preset, dalam ISO string UTC.
 * Local midnight hari ini dikurangi N hari (N dari AUDIT_LOG_VALID_PERIODS).
 *
 * Konversi local→UTC penting supaya "today" benar-benar capture event
 * sejak 00:00 waktu klinik (Asia/Jakarta), bukan 00:00 UTC yang baru
 * dimulai jam 07:00 lokal.
 *
 * @param {string} period  'today' | '7days' | '30days'
 * @returns {string}  ISO datetime, mis. '2026-05-13T17:00:00.000Z'
 */
function computeAuditLogStartFromPeriod_(period) {
  const days = AUDIT_LOG_VALID_PERIODS[period];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (days > 0) {
    start.setDate(start.getDate() - days);
  }
  return start.toISOString();
}

/**
 * Endpoint utama untuk halaman "Aktivitas" (client-side pagination + search).
 *
 * Search aktor (by nama / username) dilakukan di FRONTEND substring match
 * di `_search_text` precomputed. Backend tidak handle actor_search — alasan:
 * pola canonical Patients/Recall (search instan client-side). Backend tetap
 * enrich setiap row dengan actor_full_name + actor_username supaya frontend
 * punya field untuk match.
 *
 * Payload:
 *   {
 *     session_token: string,
 *     period?:         'today' | '7days' | '30days',
 *                      Default: '7days'. Invalid value fallback ke default.
 *     entity_types?:   string[],   // multi-select
 *     actions?:        string[],   // multi-select
 *     actor_user_ids?: string[]    // multi-select (jarang dipakai; UI tidak expose)
 *   }
 *
 * Return:
 *   {
 *     success: true,
 *     data: {
 *       rows: [
 *         { ...audit_log row, actor_full_name, actor_username },
 *         ...
 *       ],   // max AUDIT_LOG_MAX_LIST_LIMIT
 *       total_returned: number,
 *       cap_limit:      number,
 *       hit_cap:        boolean,   // true → UI tampilkan banner peringatan
 *       active_since:   '2026-05-19',
 *       allowed_entity_types: null | string[],
 *       filters_applied: {
 *         period, entity_types, actions, actor_user_ids
 *       },
 *       effective_period: 'today' | '7days' | '30days'
 *     }
 *   }
 */
function getAuditLogList(payload) {
  try {
    const auth = requireRole(payload, ['admin_appointment', 'admin_finance']);
    if (!auth.success) return auth;

    const allowedEntityTypes = computeAuditLogAllowedEntityTypesForUser_(auth.user);
    if (Array.isArray(allowedEntityTypes) && allowedEntityTypes.length === 0) {
      return {
        success: false,
        message: 'Role Anda tidak memiliki akses ke halaman Aktivitas.'
      };
    }

    const p = payload || {};

    // Build PostgREST filter pairs (array of [key, value] tuples agar
    // mendukung dua filter pada kolom yang sama, mis. occurred_at
    // gte+lte yang tidak bisa diwakili oleh single-key object).
    const filterPairs = [];

    // Clinic scope
    const clinicId = String(
      (auth.user && auth.user.clinic_id) ||
      (typeof getCurrentClinicId_ === 'function' ? getCurrentClinicId_() : '')
    ).trim();
    if (clinicId) {
      filterPairs.push(['clinic_id', 'eq.' + clinicId]);
    }

    // Period preset — whitelist validation. Invalid/missing fallback ke
    // AUDIT_LOG_DEFAULT_PERIOD ('7days'). Backend tidak menerima custom
    // date range untuk cegah unbounded query & konsistensi UI dengan
    // Dashboard/Finance.
    let effectivePeriod = String(p.period || '').trim();
    if (!Object.prototype.hasOwnProperty.call(AUDIT_LOG_VALID_PERIODS, effectivePeriod)) {
      effectivePeriod = AUDIT_LOG_DEFAULT_PERIOD;
    }
    const startIso = computeAuditLogStartFromPeriod_(effectivePeriod);
    filterPairs.push(['occurred_at', 'gte.' + startIso]);

    // entity_type — intersect dengan allowed list (role-based visibility).
    // Whitelist validation: hanya nilai di AUDIT_LOG_VALID_ENTITY_TYPES yang
    // diterima — input aneh di-drop diam-diam supaya PostgREST tidak terima
    // string aneh di `in.()` syntax.
    const requestedEntityTypes = Array.isArray(p.entity_types)
      ? p.entity_types
      : (p.entity_type ? [p.entity_type] : []);
    const cleanedEntityTypes = requestedEntityTypes
      .map(function(t) { return String(t || '').trim(); })
      .filter(function(t) {
        return t.length > 0 && AUDIT_LOG_VALID_ENTITY_TYPES[t] === true;
      });

    let effectiveEntityTypes = cleanedEntityTypes;
    if (Array.isArray(allowedEntityTypes)) {
      if (cleanedEntityTypes.length === 0) {
        effectiveEntityTypes = allowedEntityTypes;
      } else {
        effectiveEntityTypes = cleanedEntityTypes.filter(function(t) {
          return allowedEntityTypes.indexOf(t) !== -1;
        });
      }
      if (effectiveEntityTypes.length === 0) {
        // User minta filter entity_type yang semua di luar role allowed.
        // Return empty result, BUKAN error — UI tetap render halaman kosong.
        return {
          success: true,
          data: {
            rows: [],
            total_returned: 0,
            cap_limit: AUDIT_LOG_MAX_LIST_LIMIT,
            hit_cap: false,
            active_since: AUDIT_LOG_ACTIVE_SINCE,
            allowed_entity_types: allowedEntityTypes,
            filters_applied: {
              period: effectivePeriod,
              entity_types: [],
              actions: [],
              actor_user_ids: []
            },
            effective_period: effectivePeriod
          }
        };
      }
    }

    if (effectiveEntityTypes.length > 0) {
      filterPairs.push(['entity_type', 'in.(' + effectiveEntityTypes.join(',') + ')']);
    }

    // action filter — whitelist validation (hanya value di
    // AUDIT_LOG_VALID_ACTIONS yang diterima)
    const requestedActions = Array.isArray(p.actions)
      ? p.actions
      : (p.action ? [p.action] : []);
    const cleanedActions = requestedActions
      .map(function(a) { return String(a || '').trim(); })
      .filter(function(a) {
        return a.length > 0 && AUDIT_LOG_VALID_ACTIONS[a] === true;
      });
    if (cleanedActions.length > 0) {
      filterPairs.push(['action', 'in.(' + cleanedActions.join(',') + ')']);
    }

    // actor filter (multi-select user_id, exact match).
    // Search by nama dilakukan di FRONTEND substring match. Field
    // actor_user_ids tetap supported untuk future use case (dropdown).
    // VALIDASI regex format user_id [A-Za-z0-9_-]{1,64} — cegah char
    // PostgREST aneh inject ke `in.()`.
    const requestedActors = Array.isArray(p.actor_user_ids)
      ? p.actor_user_ids
      : (p.actor_user_id ? [p.actor_user_id] : []);
    const cleanedActors = requestedActors
      .map(function(a) { return String(a || '').trim(); })
      .filter(function(a) {
        return a.length > 0 && AUDIT_LOG_USER_ID_REGEX.test(a);
      });

    if (cleanedActors.length > 0) {
      filterPairs.push(['actor_user_id', 'in.(' + cleanedActors.join(',') + ')']);
    }

    // Query via custom URL builder. supabaseSelect_ pakai single-key
    // object jadi tidak bisa untuk occurred_at gte+lte.
    // Cap +1 supaya bisa deteksi hit_cap tanpa Prefer count=exact
    // (count=exact mahal di tabel besar — full table scan).
    const queryResult = querySupabaseAuditLog_(filterPairs, {
      limit: AUDIT_LOG_MAX_LIST_LIMIT + 1,
      order: 'occurred_at.desc,id.desc'
    });

    const rawRows = queryResult.rows;
    const hitCap = rawRows.length > AUDIT_LOG_MAX_LIST_LIMIT;
    const truncated = hitCap ? rawRows.slice(0, AUDIT_LOG_MAX_LIST_LIMIT) : rawRows;

    // Enrich rows dengan actor_full_name + actor_username supaya frontend
    // bisa search substring by nama tanpa roundtrip. Bulk lookup app_users
    // untuk semua unique actor_user_id di hasil (typical <50 unique).
    const rows = enrichAuditLogRowsWithActorNames_(truncated, clinicId);

    return {
      success: true,
      data: {
        rows: rows,
        total_returned: rows.length,
        cap_limit: AUDIT_LOG_MAX_LIST_LIMIT,
        hit_cap: hitCap,
        active_since: AUDIT_LOG_ACTIVE_SINCE,
        allowed_entity_types: allowedEntityTypes,
        filters_applied: {
          period: effectivePeriod,
          entity_types: effectiveEntityTypes,
          actions: cleanedActions,
          actor_user_ids: cleanedActors
        },
        effective_period: effectivePeriod
      }
    };

  } catch (err) {
    const msg = err && err.message ? err.message : String(err || '');
    return { success: false, message: 'Gagal load audit log: ' + msg };
  }
}

/**
 * Bulk lookup app_users untuk semua unique actor_user_id di rows, lalu
 * inject actor_full_name + actor_username ke setiap row. Dipakai supaya
 * frontend bisa search substring by nama tanpa roundtrip per ketikan.
 *
 * Strategi: 1 batched query PostgREST `user_id=in.(uid1,uid2,...)` —
 * jauh lebih murah dari N queries individual. Typical 2000 row punya
 * <50 unique user_id (admin staff klinik).
 *
 * @param {Array<object>} rows  audit_log rows
 * @param {string} clinicId     Optional. Kalau ada, scope ke clinic ini.
 * @returns {Array<object>} rows dengan actor_full_name + actor_username
 */
function enrichAuditLogRowsWithActorNames_(rows, clinicId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const uniqueIdsMap = {};
  rows.forEach(function(r) {
    const uid = String((r && r.actor_user_id) || '').trim();
    if (uid) uniqueIdsMap[uid] = true;
  });
  const uniqueIds = Object.keys(uniqueIdsMap);
  if (uniqueIds.length === 0) return rows;

  // Sanitize user_id untuk PostgREST in.() syntax — hapus karakter yang
  // bisa break parsing (paren, comma). User_id sudah generated id, jarang
  // mengandung karakter aneh, tapi safety check.
  const safeIds = uniqueIds
    .map(function(u) { return u.replace(/[(),]/g, ''); })
    .filter(function(u) { return u.length > 0; });
  if (safeIds.length === 0) return rows;

  const config = getSupabaseConfig_();
  const parts = ['select=user_id,full_name,username'];
  parts.push('user_id=in.(' + safeIds.join(',') + ')');
  parts.push('limit=' + safeIds.length);
  if (clinicId) parts.push('clinic_id=eq.' + encodeURIComponent(clinicId));

  const url = config.url + '/rest/v1/app_users?' + parts.join('&');
  let userMap = {};
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: buildSupabaseHeaders_(),
      muteHttpExceptions: true
    });
    const result = parseSupabaseResponse_(response);
    if (result.success) {
      const users = Array.isArray(result.body) ? result.body : [];
      users.forEach(function(u) {
        const uid = String((u && u.user_id) || '').trim();
        if (uid) {
          userMap[uid] = {
            full_name: String((u && u.full_name) || '').trim(),
            username: String((u && u.username) || '').trim()
          };
        }
      });
    }
    // Kalau lookup gagal (HTTP error), fallback ke empty userMap supaya
    // row tetap dikembalikan dengan nama kosong — UI handle gracefully.
  } catch (e) {
    // Defensive: jangan biarkan enrichment failure menggagalkan seluruh
    // query audit_log. Log saja & lanjut tanpa enrichment.
    Logger.log('enrichAuditLogRowsWithActorNames_ failed: ' + (e && e.message ? e.message : e));
  }

  return rows.map(function(r) {
    const uid = String((r && r.actor_user_id) || '').trim();
    const info = uid && userMap[uid] ? userMap[uid] : null;
    return Object.assign({}, r, {
      actor_full_name: info ? info.full_name : '',
      actor_username:  info ? info.username  : ''
    });
  });
}

/**
 * Custom URL builder untuk audit_log SELECT.
 * Mendukung multi-value filter pada kolom yang sama
 * (mis. occurred_at gte+lte), yang tidak bisa di-handle
 * oleh supabaseSelect_ (single-key object).
 *
 * @param {Array<[string,string]>} filterPairs
 * @param {object} options  { limit, offset, order, select }
 * @returns {{ rows: Array }}
 */
function querySupabaseAuditLog_(filterPairs, options) {
  const config = getSupabaseConfig_();
  const opts = options || {};
  const parts = [];

  parts.push('select=' + encodeURIComponent(opts.select || '*'));
  if (opts.order) parts.push('order=' + encodeURIComponent(opts.order));
  if (opts.limit || opts.limit === 0) parts.push('limit=' + encodeURIComponent(String(opts.limit)));
  if (opts.offset) parts.push('offset=' + encodeURIComponent(String(opts.offset)));

  (filterPairs || []).forEach(function(pair) {
    if (!pair || pair.length < 2) return;
    parts.push(encodeURIComponent(pair[0]) + '=' + encodeURIComponent(pair[1]));
  });

  const url = config.url + '/rest/v1/audit_log?' + parts.join('&');
  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: buildSupabaseHeaders_(),
    muteHttpExceptions: true
  });
  const result = parseSupabaseResponse_(response);
  if (!result.success) {
    throw new Error('Audit log SELECT failed: HTTP ' + result.status_code + ' - ' + JSON.stringify(result.body));
  }
  const rows = Array.isArray(result.body) ? result.body : [];
  return { rows: rows };
}

/* =========================================================
   SMOKE TEST — manual dari Apps Script editor
   ========================================================= */

function testAuditLogQueryList() {
  const result = {
    success: true,
    stage: 'P3c.1-AuditLogQueryService-list',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    issues: []
  };

  function addIssue(msg, extra) {
    result.issues.push(Object.assign({ issue: msg }, extra || {}));
    result.success = false;
  }

  try {
    // Smoke test: query 10 row paling baru, no filter.
    // Pakai pseudo-auth dengan role owner untuk skip session check.
    // PERHATIAN: ini bypass session_token, hanya untuk smoke test internal.
    const owner = {
      user_id: 'TEST-AUDIT-QUERY',
      roles: ['owner', 'super_admin'],
      clinic_id: typeof getCurrentClinicId_ === 'function' ? getCurrentClinicId_() : 'KLINIK-1'
    };
    const allowed = computeAuditLogAllowedEntityTypesForUser_(owner);
    if (allowed !== null) {
      addIssue('OWNER_NOT_FULL_ACCESS', { allowed: allowed });
    }

    const adminAppt = {
      user_id: 'TEST-ADMIN-APPT',
      roles: ['admin_appointment'],
      clinic_id: 'KLINIK-1'
    };
    const adminApptAllowed = computeAuditLogAllowedEntityTypesForUser_(adminAppt);
    if (!Array.isArray(adminApptAllowed) ||
        adminApptAllowed.indexOf('patient') === -1 ||
        adminApptAllowed.indexOf('billing') !== -1) {
      addIssue('ADMIN_APPT_SCOPE_WRONG', { allowed: adminApptAllowed });
    }

    const doctor = {
      user_id: 'TEST-DOCTOR',
      roles: ['doctor'],
      clinic_id: 'KLINIK-1'
    };
    const doctorAllowed = computeAuditLogAllowedEntityTypesForUser_(doctor);
    if (!Array.isArray(doctorAllowed) || doctorAllowed.length !== 0) {
      addIssue('DOCTOR_NOT_DENIED', { allowed: doctorAllowed });
    }

    // Verifikasi period preset helper
    if (!Object.prototype.hasOwnProperty.call(AUDIT_LOG_VALID_PERIODS, AUDIT_LOG_DEFAULT_PERIOD)) {
      addIssue('DEFAULT_PERIOD_NOT_IN_WHITELIST', { value: AUDIT_LOG_DEFAULT_PERIOD });
    }
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    Object.keys(AUDIT_LOG_VALID_PERIODS).forEach(function(period) {
      const iso = computeAuditLogStartFromPeriod_(period);
      if (!isoRegex.test(iso)) {
        addIssue('PERIOD_ISO_FORMAT_WRONG', { period: period, value: iso });
      }
    });

    // Direct query tanpa requireRole (akses Supabase langsung)
    const q = querySupabaseAuditLog_([], { limit: 10, order: 'occurred_at.desc,id.desc' });
    result.row_count = q.rows.length;
    result.sample_first_row = q.rows.length > 0 ? {
      id: q.rows[0].id,
      entity_type: q.rows[0].entity_type,
      action: q.rows[0].action,
      actor_user_id: q.rows[0].actor_user_id
    } : null;
    result.cap_limit = AUDIT_LOG_MAX_LIST_LIMIT;
    result.default_period = AUDIT_LOG_DEFAULT_PERIOD;
    result.valid_periods = Object.keys(AUDIT_LOG_VALID_PERIODS);
    result.start_iso_default = computeAuditLogStartFromPeriod_(AUDIT_LOG_DEFAULT_PERIOD);

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    addIssue('TEST_THREW', { message: err && err.message ? err.message : String(err) });
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}
