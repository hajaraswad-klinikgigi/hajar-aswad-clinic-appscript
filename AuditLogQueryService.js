/* =========================================================
   AUDIT LOG QUERY SERVICE — Phase 3 (P3c.1)
   Backend query endpoint untuk halaman "Aktivitas".

   Filter: date range (occurred_at), entity_type[], action[],
           actor_user_id[].
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
// filter date — sengaja ditampilkan banner di UI. Dipilih 2000 supaya
// payload tetap <~500KB untuk volume realistis multi-klinik produksi.
const AUDIT_LOG_MAX_LIST_LIMIT = 2000;

// Default window date kalau user tidak set start_date. 7 hari mencakup
// pemakaian harian normal (audit aktivitas minggu ini) dan tetap fit
// di cap meski multi-klinik volume tinggi.
const AUDIT_LOG_DEFAULT_WINDOW_DAYS = 7;

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

// Regex strict untuk date input — kalau tidak match, value di-drop dan
// fallback ke default 7 hari. Cegah PostgREST error message leak dari
// string aneh yang inject ke filter `gte.`/`lte.`.
const AUDIT_LOG_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
 * Hitung default start_date kalau user tidak set: hari ini - 7 hari,
 * dalam format 'YYYY-MM-DD'.
 *
 * @returns {string}  'YYYY-MM-DD'
 */
function computeAuditLogDefaultStartDate_() {
  const now = new Date();
  const past = new Date(now.getTime() - AUDIT_LOG_DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const pad = function(n) { return ('0' + n).slice(-2); };
  return past.getFullYear() + '-' + pad(past.getMonth() + 1) + '-' + pad(past.getDate());
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
 *     start_date?:     'YYYY-MM-DD' atau ISO datetime,
 *                      Default: 7 hari sebelum hari ini.
 *     end_date?:       'YYYY-MM-DD' atau ISO datetime,
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
 *         start_date, end_date, entity_types, actions, actor_user_ids
 *       },
 *       effective_start_date: 'YYYY-MM-DD'   // setelah default applied
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

    // Date range — auto-convert YYYY-MM-DD ke ISO with day boundary.
    // Default start_date = 7 hari lalu supaya window tidak unbounded.
    // VALIDASI strict regex YYYY-MM-DD: kalau tidak match → drop value
    // dan fallback ke default. Cegah string aneh inject ke PostgREST
    // filter `gte.`/`lte.` yang bisa leak error message ke UI.
    let startDate = String(p.start_date || '').trim();
    if (startDate && !AUDIT_LOG_DATE_REGEX.test(startDate)) {
      startDate = '';
    }
    if (!startDate) {
      startDate = computeAuditLogDefaultStartDate_();
    }
    filterPairs.push(['occurred_at', 'gte.' + startDate + 'T00:00:00Z']);

    let endDate = String(p.end_date || '').trim();
    if (endDate && !AUDIT_LOG_DATE_REGEX.test(endDate)) {
      endDate = '';
    }
    if (endDate) {
      filterPairs.push(['occurred_at', 'lte.' + endDate + 'T23:59:59Z']);
    }

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
              start_date: startDate || null,
              end_date: endDate || null,
              entity_types: [],
              actions: [],
              actor_user_ids: []
            },
            effective_start_date: startDate
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
          start_date: startDate || null,
          end_date: endDate || null,
          entity_types: effectiveEntityTypes,
          actions: cleanedActions,
          actor_user_ids: cleanedActors
        },
        effective_start_date: startDate
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

    // Verifikasi default start_date helper
    const defStart = computeAuditLogDefaultStartDate_();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(defStart)) {
      addIssue('DEFAULT_START_DATE_FORMAT_WRONG', { value: defStart });
    }

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
    result.default_window_days = AUDIT_LOG_DEFAULT_WINDOW_DAYS;
    result.default_start_date_today = defStart;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    addIssue('TEST_THREW', { message: err && err.message ? err.message : String(err) });
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}
