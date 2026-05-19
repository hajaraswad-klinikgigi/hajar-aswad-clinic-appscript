/* =========================================================
   AUDIT LOG SERVICE — Phase 3
   Helper backend untuk rekam jejak mutasi data penting.

   Pemakaian (di mutation endpoint):

     const auth = requireRole(payload, [...]);
     if (!auth.success) return auth;
     // ... validasi + cari row lama ...
     const oldRow = findFooById_(...);
     // ... update DB ...
     writeAuditLog_({
       actor: auth.user,
       entity_type: 'patient',
       entity_id: patientId,
       action: 'update',
       old_value: oldRow,
       new_value: newRow,
       notes: ''
     });

   Audit log gagal TIDAK boleh blocking mutation utama —
   semua error di-swallow + log ke Logger.
   ========================================================= */

const AUDIT_LOG_BACKEND_OPTIONS = { backend_mode: 'supabase' };

/**
 * Tulis 1 entry audit log ke Supabase audit_log table.
 *
 * @param {object} entry  Audit entry, struktur:
 *   {
 *     actor:       { user_id, roles[] }  (atau auth.user dari requireRole)
 *     entity_type: 'patient'|'appointment'|'treatment'|'billing'|... (TEXT)
 *     entity_id:   string                (TEXT, ID record yang disentuh)
 *     action:      'create'|'update'|'delete'|'cancel'|'restore'|...
 *     old_value:   object|null           (snapshot sebelum mutasi; null untuk create)
 *     new_value:   object|null           (snapshot sesudah mutasi; null untuk delete)
 *     notes?:      string                (opsional)
 *     clinic_id?:  string                (opsional; default getCurrentClinicId_())
 *   }
 * @returns {{success:boolean, message?:string, data?:object}}
 */
function writeAuditLog_(entry) {
  try {
    if (!entry || typeof entry !== 'object') {
      return { success: false, message: 'audit entry kosong' };
    }

    const actor = entry.actor || {};
    const userId = String(actor.user_id || actor.actor_user_id || '').trim();
    const entityType = String(entry.entity_type || '').trim();
    const entityId = String(entry.entity_id || '').trim();
    const action = String(entry.action || '').trim();

    if (!userId || !entityType || !entityId || !action) {
      return {
        success: false,
        message: 'audit entry tidak lengkap (actor.user_id, entity_type, entity_id, action wajib)'
      };
    }

    const rolesRaw = Array.isArray(actor.roles) ? actor.roles : [];
    const actorRoles = rolesRaw
      .map(function(r) { return String(r || '').trim(); })
      .filter(function(r) { return r.length > 0; });

    const clinicId = String(
      entry.clinic_id ||
      (typeof getCurrentClinicId_ === 'function' ? getCurrentClinicId_() : '')
    ).trim();

    const row = {
      occurred_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      clinic_id: clinicId,
      actor_user_id: userId,
      actor_roles: actorRoles,
      entity_type: entityType,
      entity_id: entityId,
      action: action,
      old_value: entry.old_value || null,
      new_value: entry.new_value || null,
      notes: entry.notes ? String(entry.notes).trim() : null
    };

    dbInsert_(REPO_TABLES.AUDIT_LOG, row, AUDIT_LOG_BACKEND_OPTIONS);

    return { success: true, data: row };

  } catch (err) {
    // Jangan throw — audit log gagal TIDAK boleh blocking mutation utama.
    const msg = err && err.message ? err.message : String(err || '');
    try { Logger.log('writeAuditLog_ failed: ' + msg); } catch (logErr) { /* noop */ }
    return { success: false, message: msg };
  }
}

/**
 * Utility: hitung diff antara 2 snapshot value untuk display di UI.
 * Tidak dipakai saat write — write selalu simpan full snapshot.
 * Frontend boleh panggil via endpoint khusus kalau perlu, atau
 * compute di client. Disediakan di sini supaya konsisten.
 *
 * @param {object|null} oldObj
 * @param {object|null} newObj
 * @returns {{
 *   changed: { [field]: { from, to } },
 *   added:   { [field]: value },
 *   removed: { [field]: value }
 * }}
 */
function diffAuditValues_(oldObj, newObj) {
  const result = { changed: {}, added: {}, removed: {} };
  const oldData = oldObj || {};
  const newData = newObj || {};

  const keys = {};
  Object.keys(oldData).forEach(function(k) { keys[k] = true; });
  Object.keys(newData).forEach(function(k) { keys[k] = true; });

  Object.keys(keys).forEach(function(key) {
    const oldHas = Object.prototype.hasOwnProperty.call(oldData, key);
    const newHas = Object.prototype.hasOwnProperty.call(newData, key);
    const oldVal = oldData[key];
    const newVal = newData[key];

    if (!oldHas && newHas) {
      result.added[key] = newVal;
    } else if (oldHas && !newHas) {
      result.removed[key] = oldVal;
    } else if (oldHas && newHas) {
      // Compare via JSON stringify untuk handle object/array dengan benar.
      const oldStr = JSON.stringify(oldVal);
      const newStr = JSON.stringify(newVal);
      if (oldStr !== newStr) {
        result.changed[key] = { from: oldVal, to: newVal };
      }
    }
  });

  return result;
}

/**
 * Smoke test: insert test entry, verify row tersimpan, lalu cleanup.
 * Jalankan manual dari Apps Script editor untuk verify migration 011
 * sudah jalan + helper kompatibel dengan tabel Supabase.
 */
function testAuditLogWriteRoundTrip() {
  const result = {
    success: true,
    stage: 'P3a-AuditLogService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    issues: []
  };

  function addIssue(msg, extra) {
    result.issues.push(Object.assign({ issue: msg }, extra || {}));
    result.success = false;
  }

  try {
    const writeRes = writeAuditLog_({
      actor: { user_id: 'TEST-AUDIT', roles: ['owner', 'super_admin'] },
      entity_type: 'test',
      entity_id: 'AUDIT-SMOKE-' + Date.now(),
      action: 'create',
      old_value: null,
      new_value: { sample: 'value', n: 1 },
      notes: 'P3a smoke test'
    });

    result.write_result = writeRes;

    if (!writeRes || !writeRes.success) {
      addIssue('WRITE_FAILED', { message: writeRes && writeRes.message });
      return result;
    }

    // Cleanup: hapus semua test entry yang baru ditulis
    const rows = dbFindAll_(REPO_TABLES.AUDIT_LOG, AUDIT_LOG_BACKEND_OPTIONS) || [];
    const testRows = rows.filter(function(r) {
      return String(r.actor_user_id || '').trim() === 'TEST-AUDIT';
    });

    testRows.forEach(function(r) {
      try {
        dbDeleteById_(REPO_TABLES.AUDIT_LOG, 'id', r.id, AUDIT_LOG_BACKEND_OPTIONS);
      } catch (delErr) {
        addIssue('CLEANUP_FAILED', { id: r.id, message: delErr && delErr.message });
      }
    });

    result.cleanup_count = testRows.length;
    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    addIssue('TEST_THREW', { message: err && err.message ? err.message : String(err) });
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}
