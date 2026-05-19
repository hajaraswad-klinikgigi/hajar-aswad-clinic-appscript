/* =========================================================
   AUDIT LOG QUERY SERVICE — Phase 3 (P3c.1)
   Backend query endpoint untuk halaman "Aktivitas".

   Filter: date range (occurred_at), entity_type[], action[],
           actor_user_id[].
   Pagination: page_number + page_size (default 50, max 200).
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

const AUDIT_LOG_DEFAULT_PAGE_SIZE = 50;
const AUDIT_LOG_MAX_PAGE_SIZE = 200;

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
 * Endpoint utama untuk halaman "Aktivitas".
 *
 * Payload:
 *   {
 *     session_token: string,
 *     start_date?:     'YYYY-MM-DD' atau ISO datetime,
 *     end_date?:       'YYYY-MM-DD' atau ISO datetime,
 *     entity_types?:   string[],   // multi-select
 *     actions?:        string[],   // multi-select
 *     actor_user_ids?: string[],   // multi-select
 *     page_number?:    number (default 1),
 *     page_size?:      number (default 50, max 200)
 *   }
 *
 * Return:
 *   {
 *     success: true,
 *     data: {
 *       rows: [...audit_log rows],
 *       page_number, page_size, has_next, has_prev,
 *       active_since: '2026-05-19',
 *       allowed_entity_types: null | string[],
 *       filters_applied: { ... }
 *     }
 *   }
 */
function getAuditLogPage(payload) {
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

    // Pagination
    const requestedPageSize = parseInt(p.page_size, 10);
    const pageSize = Math.min(
      Math.max(isNaN(requestedPageSize) ? AUDIT_LOG_DEFAULT_PAGE_SIZE : requestedPageSize, 1),
      AUDIT_LOG_MAX_PAGE_SIZE
    );
    const requestedPageNumber = parseInt(p.page_number, 10);
    const pageNumber = Math.max(isNaN(requestedPageNumber) ? 1 : requestedPageNumber, 1);
    const offset = (pageNumber - 1) * pageSize;

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

    // Date range — auto-convert YYYY-MM-DD ke ISO with day boundary
    const startDate = String(p.start_date || '').trim();
    if (startDate) {
      const startIso = startDate.length === 10 ? (startDate + 'T00:00:00Z') : startDate;
      filterPairs.push(['occurred_at', 'gte.' + startIso]);
    }
    const endDate = String(p.end_date || '').trim();
    if (endDate) {
      const endIso = endDate.length === 10 ? (endDate + 'T23:59:59Z') : endDate;
      filterPairs.push(['occurred_at', 'lte.' + endIso]);
    }

    // entity_type — intersect dengan allowed list (role-based visibility)
    const requestedEntityTypes = Array.isArray(p.entity_types)
      ? p.entity_types
      : (p.entity_type ? [p.entity_type] : []);
    const cleanedEntityTypes = requestedEntityTypes
      .map(function(t) { return String(t || '').trim(); })
      .filter(function(t) { return t.length > 0; });

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
            page_number: pageNumber,
            page_size: pageSize,
            has_next: false,
            has_prev: pageNumber > 1,
            active_since: AUDIT_LOG_ACTIVE_SINCE,
            allowed_entity_types: allowedEntityTypes,
            filters_applied: {
              start_date: startDate || null,
              end_date: endDate || null,
              entity_types: [],
              actions: [],
              actor_user_ids: []
            }
          }
        };
      }
    }

    if (effectiveEntityTypes.length > 0) {
      filterPairs.push(['entity_type', 'in.(' + effectiveEntityTypes.join(',') + ')']);
    }

    // action filter
    const requestedActions = Array.isArray(p.actions)
      ? p.actions
      : (p.action ? [p.action] : []);
    const cleanedActions = requestedActions
      .map(function(a) { return String(a || '').trim(); })
      .filter(function(a) { return a.length > 0; });
    if (cleanedActions.length > 0) {
      filterPairs.push(['action', 'in.(' + cleanedActions.join(',') + ')']);
    }

    // actor filter (multi-select user_id)
    const requestedActors = Array.isArray(p.actor_user_ids)
      ? p.actor_user_ids
      : (p.actor_user_id ? [p.actor_user_id] : []);
    const cleanedActors = requestedActors
      .map(function(a) { return String(a || '').trim(); })
      .filter(function(a) { return a.length > 0; });
    if (cleanedActors.length > 0) {
      filterPairs.push(['actor_user_id', 'in.(' + cleanedActors.join(',') + ')']);
    }

    // Query via custom URL builder. supabaseSelect_ pakai single-key
    // object jadi tidak bisa untuk occurred_at gte+lte.
    const rows = querySupabaseAuditLog_(filterPairs, {
      limit: pageSize + 1, // +1 untuk has_next detection
      offset: offset,
      order: 'occurred_at.desc,id.desc'
    });

    const hasNext = rows.length > pageSize;
    const sliced = hasNext ? rows.slice(0, pageSize) : rows;

    return {
      success: true,
      data: {
        rows: sliced,
        page_number: pageNumber,
        page_size: pageSize,
        has_next: hasNext,
        has_prev: pageNumber > 1,
        active_since: AUDIT_LOG_ACTIVE_SINCE,
        allowed_entity_types: allowedEntityTypes,
        filters_applied: {
          start_date: startDate || null,
          end_date: endDate || null,
          entity_types: effectiveEntityTypes,
          actions: cleanedActions,
          actor_user_ids: cleanedActors
        }
      }
    };

  } catch (err) {
    const msg = err && err.message ? err.message : String(err || '');
    return { success: false, message: 'Gagal load audit log: ' + msg };
  }
}

/**
 * Custom URL builder untuk audit_log SELECT.
 * Mendukung multi-value filter pada kolom yang sama
 * (mis. occurred_at gte+lte), yang tidak bisa di-handle
 * oleh supabaseSelect_ (single-key object).
 *
 * @param {Array<[string,string]>} filterPairs
 * @param {object} options  { limit, offset, order, select }
 * @returns {Array} rows
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
  return Array.isArray(result.body) ? result.body : [];
}

/* =========================================================
   SMOKE TEST — manual dari Apps Script editor
   ========================================================= */

function testAuditLogQueryPage() {
  const result = {
    success: true,
    stage: 'P3c.1-AuditLogQueryService',
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

    // Direct query tanpa requireRole (akses Supabase langsung)
    const rows = querySupabaseAuditLog_([], { limit: 10, order: 'occurred_at.desc,id.desc' });
    result.row_count = rows.length;
    result.sample_first_row = rows.length > 0 ? {
      id: rows[0].id,
      entity_type: rows[0].entity_type,
      action: rows[0].action,
      actor_user_id: rows[0].actor_user_id
    } : null;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    addIssue('TEST_THREW', { message: err && err.message ? err.message : String(err) });
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}
