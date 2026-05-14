/* =========================================================
   PHASE 3I - APPOINTMENT REPOSITORY BRIDGE HELPERS
   Read-only bridge. Backend tetap Spreadsheet.
   ========================================================= */

function isAppointmentRepositoryBridgeAvailable_() {
  return typeof AppointmentRepository !== 'undefined' &&
    AppointmentRepository &&
    typeof AppointmentRepository.getAppointmentsRaw === 'function';
}

function getAppointmentServiceUiReadOptions_(options) {
  const opts = Object.assign({}, options || {});

  if (opts.backend_mode) {
    return opts;
  }

  if (typeof repoBuildUiReadOptions_ === 'function') {
    return repoBuildUiReadOptions_(opts);
  }

  return Object.assign({}, opts, {
    backend_mode: 'spreadsheet',
    ui_read_supabase_test_enabled: false
  });
}

function getAppointmentServiceUiReadBackendMode_(options) {
  const opts = getAppointmentServiceUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function isAppointmentServiceUiReadSupabaseMode_(options) {
  return getAppointmentServiceUiReadBackendMode_(options) === 'supabase';
}

function getAppointmentServiceSpreadsheetWriteReadOptions_() {
  return repoBuildUiReadOptions_({});
}

function getAppointmentsRaw(options) {
  const opts = getAppointmentServiceUiReadOptions_(options);

  if (
    isAppointmentRepositoryBridgeAvailable_() &&
    typeof AppointmentRepository.getAppointmentsRaw === 'function'
  ) {
    return AppointmentRepository.getAppointmentsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.APPOINTMENTS || 'Appointments', opts) || [];
  }

  return getRowsAsObjects('Appointments') || [];
}

function normalizeAppointmentForClient(row) {
  const obj = {};
  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });
  return obj;
}

function sortAppointmentsForClient(rows) {
  return (rows || []).sort(function(a, b) {
    const dateCompare = String(b.appointment_date || '').localeCompare(String(a.appointment_date || ''));
    if (dateCompare !== 0) return dateCompare;

    const timeCompare = String(b.appointment_time || '').localeCompare(String(a.appointment_time || ''));
    if (timeCompare !== 0) return timeCompare;

    return String(b.appointment_id || '').localeCompare(String(a.appointment_id || ''));
  });
}

function getAppointmentsListCacheKey(options) {
  return buildCacheKey([
    'appointmentsList',
    getAppointmentServiceUiReadBackendMode_(options)
  ]);
}

function getCachedAppointmentsList(options) {
  const cached = getCachedJson(getAppointmentsListCacheKey(options));
  return Array.isArray(cached) ? cached : null;
}

function getOpenAppointmentsByPatientCacheKey(options) {
  return buildCacheKey([
    'openAppointmentsByPatient',
    getAppointmentServiceUiReadBackendMode_(options)
  ]);
}

function getCachedOpenAppointmentsByPatientMap(options) {
  const cached = getCachedJson(getOpenAppointmentsByPatientCacheKey(options));

  if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
    return cached;
  }

  return null;
}

function buildOpenAppointmentsByPatientMapFromRows(rows) {
  const map = {};

  (rows || []).forEach(function(row) {
    const patientId = String(row.patient_id || '').trim();
    const appointmentId = String(row.appointment_id || '').trim();
    const status = String(row.status || '').trim().toLowerCase();

    if (!patientId || !appointmentId) return;
    if (status !== 'scheduled') return;

    if (!map[patientId]) {
      map[patientId] = [];
    }

    map[patientId].push(appointmentId);
  });

  return map;
}

function getOpenAppointmentsByPatientMap(options) {
  const opts = getAppointmentServiceUiReadOptions_(options);
  const cachedMap = getCachedOpenAppointmentsByPatientMap(opts);
  if (cachedMap) return cachedMap;

  let rows = [];

  const cachedList = getCachedAppointmentsList(opts);

  if (cachedList) {
    rows = cachedList;
  } else if (
    isAppointmentRepositoryBridgeAvailable_() &&
    typeof AppointmentRepository.getAppointmentsRaw === 'function'
  ) {
    rows = AppointmentRepository.getAppointmentsRaw(opts) || [];
  } else {
    rows = getAppointmentsRaw(opts);
  }

  const map = buildOpenAppointmentsByPatientMapFromRows(rows);

  putCachedJson(getOpenAppointmentsByPatientCacheKey(opts), map, 30);

  return map;
}

/**
 * Snapshot Appointments:
 * - sheet
 * - headers
 * - values
 * - rows (object per row)
 */
function getAppointmentsSheetSnapshot() {
  if (repoIsSupabaseBackendMode_()) {
    const rows = dbFindAll_('Appointments', {}) || [];
    return { sheet: null, headers: [], values: [], rows: rows };
  }

  const sheet = getSheet('Appointments');
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const obj = {};
    headers.forEach(function(header, i) {
      obj[header] = values[r][i];
    });
    rows.push(obj);
  }

  return {
    sheet: sheet,
    headers: headers,
    values: values,
    rows: rows
  };
}

function findAppointmentRawByIdFromRows(rows, id) {
  return (rows || []).find(function(r) {
    return String(r.appointment_id || '') === String(id || '');
  }) || null;
}

function hasOpenAppointmentForPatientFromRows(rows, patientId, excludeAppointmentId) {
  return (rows || []).some(function(row) {
    const samePatient = String(row.patient_id || '') === String(patientId || '');
    const notExcluded = !excludeAppointmentId || String(row.appointment_id || '') !== String(excludeAppointmentId || '');
    const status = String(row.status || '').toLowerCase();
    const isOpen = status === 'scheduled';

    return samePatient && notExcluded && isOpen;
  });
}

function appendAppointmentRowFromSnapshot(snapshot, obj) {
  if (!snapshot.sheet) {
    dbInsert_('Appointments', obj);
    return;
  }

  const headers = snapshot.headers || [];
  const sheet = snapshot.sheet;

  if (!headers.length) {
    throw new Error('Header sheet Appointments tidak ditemukan');
  }

  const row = headers.map(function(header) {
    return obj[header] !== undefined ? obj[header] : '';
  });

  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, headers.length).setValues([row]);
}

function updateAppointmentRowFromSnapshot(snapshot, appointmentId, updatedObj) {
  if (!snapshot.sheet) {
    dbUpdateById_('Appointments', 'appointment_id', appointmentId, updatedObj);
    return true;
  }

  const headers = snapshot.headers || [];
  const values = snapshot.values || [];
  const sheet = snapshot.sheet;

  const idColIndex = headers.indexOf('appointment_id');
  if (idColIndex === -1) {
    throw new Error('Kolom appointment_id tidak ditemukan');
  }

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idColIndex] || '') === String(appointmentId || '')) {
      const updatedRow = headers.map(function(header, i) {
        return updatedObj[header] !== undefined ? updatedObj[header] : values[r][i];
      });

      sheet.getRange(r + 1, 1, 1, headers.length).setValues([updatedRow]);
      return true;
    }
  }

  return false;
}

/**
 * Mengembalikan SEMUA appointment.
 * Filter cancelled / non-cancelled ditangani di frontend.
 */
function getAppointments(options) {
  const opts = getAppointmentServiceUiReadOptions_(options);
  const isSupabaseReadMode = isAppointmentServiceUiReadSupabaseMode_(opts);

  const cacheKey = getAppointmentsListCacheKey(opts);

  if (!isSupabaseReadMode) {
    const cached = getCachedJson(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const rows = getAppointmentsRaw(opts);

  const normalized = rows.map(function(row) {
    return normalizeAppointmentForClient(row);
  });

  const result = sortAppointmentsForClient(normalized);

  // Supabase staging read mode tidak perlu cache list besar,
  // karena CacheService bisa error: Argument too large: value.
  if (!isSupabaseReadMode) {
    putCachedJson(cacheKey, result, 30);
  }

  return result;
}

function clearAppointmentsListCache() {
  const cache = getAppCache();

  [
    buildCacheKey(['appointmentsList']),
    buildCacheKey(['openAppointmentsByPatient']),

    buildCacheKey(['appointmentsList', 'spreadsheet']),
    buildCacheKey(['openAppointmentsByPatient', 'spreadsheet']),

    buildCacheKey(['appointmentsList', 'supabase']),
    buildCacheKey(['openAppointmentsByPatient', 'supabase'])
  ].forEach(function(key) {
    cache.remove(key);
  });
}

function findAppointmentRawById(id, options) {
  const normalizedAppointmentId = String(id || '').trim();
  const opts = getAppointmentServiceUiReadOptions_(options);

  if (!normalizedAppointmentId) return null;

  const cachedList = getCachedAppointmentsList(opts);

  if (cachedList) {
    return findAppointmentRawByIdFromRows(cachedList, normalizedAppointmentId);
  }

  if (
    isAppointmentRepositoryBridgeAvailable_() &&
    typeof AppointmentRepository.findAppointmentById === 'function'
  ) {
    return AppointmentRepository.findAppointmentById(normalizedAppointmentId, opts) || null;
  }

  const rows = getAppointmentsRaw(opts);
  return findAppointmentRawByIdFromRows(rows, normalizedAppointmentId);
}

function generateNextAppointmentId() {
  return generateSafeId('APT');
}

function validateAppointmentData(data) {
  const errors = {};

  if (!data.patient_id || !String(data.patient_id).trim()) {
    errors.patient_id = 'Pasien wajib dipilih';
  }

  if (!data.appointment_date || !String(data.appointment_date).trim()) {
    errors.appointment_date = 'Tanggal appointment wajib diisi';
  } else {
    const normalizedDate = String(data.appointment_date).trim();

    if (!isValidYmdDate(normalizedDate)) {
      errors.appointment_date = 'Tanggal appointment tidak valid';
    } else {
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      if (normalizedDate < today) {
        errors.appointment_date = 'Tanggal appointment tidak boleh sebelum hari ini';
      }
    }
  }

  if (!data.appointment_time || !String(data.appointment_time).trim()) {
    errors.appointment_time = 'Jam appointment wajib diisi';
  }

  if (!data.complaint || !String(data.complaint).trim()) {
    errors.complaint = 'Keluhan wajib diisi';
  }

  if (!data.status || !String(data.status).trim()) {
    errors.status = 'Status wajib dipilih';
  } else {
    const allowedStatuses = ['scheduled', 'cancelled'];
    const normalizedStatus = String(data.status).trim().toLowerCase();

    if (allowedStatuses.indexOf(normalizedStatus) === -1) {
      errors.status = 'Status appointment tidak valid';
    }
  }

  return errors;
}

function getAppointmentById(appointmentId, options) {
  const opts = getAppointmentServiceUiReadOptions_(options);
  const row = findAppointmentRawById(appointmentId, opts);

  if (!row) {
    return {
      success: false,
      message: 'Data appointment tidak ditemukan'
    };
  }

  return {
    success: true,
    data: normalizeAppointmentForClient(row)
  };
}

function hasOpenAppointmentForPatient(patientId, excludeAppointmentId, options) {
  const normalizedPatientId = String(patientId || '').trim();
  const normalizedExcludeId = String(excludeAppointmentId || '').trim();
  const opts = getAppointmentServiceUiReadOptions_(options);

  if (!normalizedPatientId) return false;

  if (
    isAppointmentRepositoryBridgeAvailable_() &&
    typeof AppointmentRepository.hasOpenAppointmentForPatient === 'function'
  ) {
    return AppointmentRepository.hasOpenAppointmentForPatient(
      normalizedPatientId,
      normalizedExcludeId,
      opts
    );
  }

  const map = getOpenAppointmentsByPatientMap(opts);
  const openAppointmentIds = Array.isArray(map[normalizedPatientId])
    ? map[normalizedPatientId]
    : [];

  if (!openAppointmentIds.length) return false;

  if (!normalizedExcludeId) {
    return true;
  }

  return openAppointmentIds.some(function(appointmentId) {
    return String(appointmentId || '').trim() !== normalizedExcludeId;
  });
}

function checkPatientOpenAppointment(patientId, excludeAppointmentId, options) {
  if (!patientId) {
    return {
      success: false,
      hasOpenAppointment: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const hasOpen = hasOpenAppointmentForPatient(patientId, excludeAppointmentId, options);

  return {
    success: true,
    hasOpenAppointment: hasOpen,
    message: hasOpen
      ? 'Pasien ini masih memiliki appointment aktif.'
      : 'Pasien ini belum memiliki appointment aktif.'
  };
}

function createAppointment(data) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CREATE_APPOINTMENT',
    module: 'AppointmentService',
    action: 'createAppointment',
    __test_freeze_enabled: data && data.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    const errors = validateAppointmentData(data);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    const patient = findPatientRawById(
      data.patient_id,
      getAppointmentServiceSpreadsheetWriteReadOptions_()
    );

    if (!patient) {
      return {
        success: false,
        message: 'Data pasien tidak ditemukan'
      };
    }

    const snapshot = getAppointmentsSheetSnapshot();

    if (hasOpenAppointmentForPatientFromRows(snapshot.rows, data.patient_id)) {
      return {
        success: false,
        message: 'Pasien ini masih memiliki appointment aktif. Selesaikan dulu appointment sebelumnya.'
      };
    }

    const normalizedStatus = String(data.status || '').trim().toLowerCase();

    if (['scheduled', 'cancelled'].indexOf(normalizedStatus) === -1) {
      return {
        success: false,
        message: 'Status appointment tidak valid. Status completed hanya melalui Treatment.'
      };
    }

    const appointment = {
      appointment_id: generateNextAppointmentId(),
      patient_id: patient.patient_id,
      patient_name: patient.full_name,
      appointment_date: String(data.appointment_date || '').trim(),
      appointment_time: String(data.appointment_time || '').trim(),
      complaint: String(data.complaint || '').trim(),
      status: normalizedStatus,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    appendAppointmentRowFromSnapshot(snapshot, appointment);

    clearAppointmentsListCache();

    return {
      success: true,
      message: 'Appointment berhasil ditambahkan',
      data: normalizeAppointmentForClient(appointment)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat membuat appointment: ' + (err && err.message ? err.message : String(err || ''))
    };
  } finally {
    lock.releaseLock();
  }
}

function updateAppointment(data) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'UPDATE_APPOINTMENT',
    module: 'AppointmentService',
    action: 'updateAppointment',
    __test_freeze_enabled: data && data.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    if (!data.appointment_id) {
      return {
        success: false,
        message: 'Appointment ID tidak ditemukan'
      };
    }

    const errors = validateAppointmentData(data);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    const snapshot = getAppointmentsSheetSnapshot();
    const existing = findAppointmentRawByIdFromRows(snapshot.rows, data.appointment_id);

    if (!existing) {
      return {
        success: false,
        message: 'Data appointment tidak ditemukan'
      };
    }

    if (String(existing.status || '').toLowerCase() === 'completed') {
      return {
        success: false,
        message: 'Appointment yang sudah completed tidak bisa diedit'
      };
    }

    const patient = findPatientRawById(
      data.patient_id,
      getAppointmentServiceSpreadsheetWriteReadOptions_()
    );

    if (!patient) {
      return {
        success: false,
        message: 'Data pasien tidak ditemukan'
      };
    }

    if (hasOpenAppointmentForPatientFromRows(snapshot.rows, data.patient_id, data.appointment_id)) {
      return {
        success: false,
        message: 'Pasien ini masih memiliki appointment aktif. Selesaikan dulu appointment sebelumnya.'
      };
    }

    const nextStatus = String(data.status || '').trim().toLowerCase();
    const allowedStatuses = ['scheduled', 'cancelled'];

    if (allowedStatuses.indexOf(nextStatus) === -1) {
      return {
        success: false,
        message: 'Status appointment tidak valid. Appointment hanya boleh scheduled atau cancelled. Status completed hanya melalui Treatment.'
      };
    }

    const updated = {
      appointment_id: existing.appointment_id,
      patient_id: patient.patient_id,
      patient_name: patient.full_name,
      appointment_date: String(data.appointment_date || '').trim(),
      appointment_time: String(data.appointment_time || '').trim(),
      complaint: String(data.complaint || '').trim(),
      status: nextStatus,
      created_at: formatCellValue(existing.created_at || ''),
      updated_at: nowIso()
    };

    const ok = updateAppointmentRowFromSnapshot(snapshot, data.appointment_id, updated);

    if (!ok) {
      return {
        success: false,
        message: 'Gagal memperbarui data appointment'
      };
    }

    clearAppointmentsListCache();

    return {
      success: true,
      message: 'Data appointment berhasil diperbarui',
      data: normalizeAppointmentForClient(updated)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat memperbarui appointment: ' + (err && err.message ? err.message : String(err || ''))
    };
  } finally {
    lock.releaseLock();
  }
}

function cancelAppointment(id, options) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CANCEL_APPOINTMENT',
    module: 'AppointmentService',
    action: 'cancelAppointment',
    __test_freeze_enabled: options && options.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    const snapshot = getAppointmentsSheetSnapshot();
    const existing = findAppointmentRawByIdFromRows(snapshot.rows, id);

    if (!existing) {
      return {
        success: false,
        message: 'Data appointment tidak ditemukan'
      };
    }

    const currentStatus = String(existing.status || '').toLowerCase();

    if (currentStatus === 'cancelled') {
      return {
        success: false,
        message: 'Appointment sudah berstatus cancelled'
      };
    }

    if (currentStatus === 'completed') {
      return {
        success: false,
        message: 'Appointment completed tidak bisa dibatalkan'
      };
    }

    const ok = updateAppointmentRowFromSnapshot(snapshot, id, {
      status: 'cancelled',
      updated_at: nowIso()
    });

    if (!ok) {
      return {
        success: false,
        message: 'Gagal membatalkan appointment'
      };
    }

    clearAppointmentsListCache();

    return {
      success: true,
      message: 'Appointment berhasil dibatalkan'
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat membatalkan appointment: ' + (err && err.message ? err.message : String(err || ''))
    };
  } finally {
    lock.releaseLock();
  }
}

function restoreAppointment(id, options) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'RESTORE_APPOINTMENT',
    module: 'AppointmentService',
    action: 'restoreAppointment',
    __test_freeze_enabled: options && options.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    const snapshot = getAppointmentsSheetSnapshot();
    const existing = findAppointmentRawByIdFromRows(snapshot.rows, id);

    if (!existing) {
      return {
        success: false,
        message: 'Data appointment tidak ditemukan'
      };
    }

    if (String(existing.status || '').toLowerCase() !== 'cancelled') {
      return {
        success: false,
        message: 'Hanya appointment cancelled yang bisa direstore'
      };
    }

    const cancelledAt = existing.updated_at;
    if (cancelledAt) {
      const cancelledMs = new Date(cancelledAt).getTime();
      if (!isNaN(cancelledMs) && (Date.now() - cancelledMs) >= 24 * 60 * 60 * 1000) {
        return {
          success: false,
          message: 'Appointment sudah tidak bisa direstore (lebih dari 24 jam sejak dibatalkan)'
        };
      }
    }

    if (hasOpenAppointmentForPatientFromRows(snapshot.rows, existing.patient_id, id)) {
      return {
        success: false,
        message: 'Pasien ini sudah punya appointment aktif lain. Restore tidak bisa dilakukan.'
      };
    }

    const ok = updateAppointmentRowFromSnapshot(snapshot, id, {
      status: 'scheduled',
      updated_at: nowIso()
    });

    if (!ok) {
      return {
        success: false,
        message: 'Gagal merestore appointment'
      };
    }

    clearAppointmentsListCache();

    return {
      success: true,
      message: 'Appointment berhasil direstore'
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat merestore appointment: ' + (err && err.message ? err.message : String(err || ''))
    };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   AUTO-CANCEL OVERDUE APPOINTMENTS
   ========================================================= */

/**
 * Auto-cancel semua appointment berstatus 'scheduled' yang tanggalnya
 * sudah lewat 1x24 jam (appointment_date < hari ini).
 *
 * Dipanggil dari client saat halaman Appointments dibuka.
 * Supabase mode: satu bulk PATCH — efisien.
 * Spreadsheet mode: fetch snapshot → loop → update satu per satu.
 */
function autoUpdateOverdueScheduledAppointments(options) {
  try {
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    if (dbIsSupabaseMode_(options)) {
      var targetTable = repoGetTargetTableForSheet_(
        repoNormalizeTableName_(REPO_TABLES.APPOINTMENTS)
      );
      // Satu PATCH request ke Supabase:
      // WHERE status = 'scheduled' AND appointment_date < today
      // SET status = 'cancelled', updated_at = now
      supabaseUpdate_(
        targetTable,
        { status: 'eq.scheduled', appointment_date: 'lt.' + today },
        { status: 'cancelled', updated_at: nowIso() }
      );
      clearAppointmentsListCache();
      return { success: true };
    }

    // Spreadsheet mode: filter manual lalu update satu per satu
    var snapshot = getAppointmentsSheetSnapshot();
    var overdue = (snapshot.rows || []).filter(function(row) {
      return String(row.status || '').toLowerCase() === 'scheduled'
        && String(row.appointment_date || '').trim() < today;
    });

    overdue.forEach(function(row) {
      updateAppointmentRowFromSnapshot(snapshot, row.appointment_id, {
        status: 'cancelled',
        updated_at: nowIso()
      });
    });

    if (overdue.length > 0) clearAppointmentsListCache();
    return { success: true, updated: overdue.length };

  } catch (err) {
    return {
      success: false,
      message: String(err && err.message ? err.message : err || '')
    };
  }
}

/* =========================================================
   PHASE 3I MANUAL TESTS
   AppointmentService read-only -> AppointmentRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testAppointmentServiceReadLog() {
  const result = {
    success: true,
    stage: '6G-AppointmentService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getAppointmentServiceUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    probe: {}
  };

  try {
    const opts = getAppointmentServiceUiReadOptions_();

    clearAppointmentsListCache();

    const raw = getAppointmentsRaw(opts);
    const list = getAppointments(opts);

    result.probe.appointment_count = Array.isArray(raw) ? raw.length : -1;
    result.probe.list_count = Array.isArray(list) ? list.length : -1;

    if (!Array.isArray(raw)) {
      result.issues.push({ issue: 'APPOINTMENTS_RAW_NOT_ARRAY' });
    }

    if (!Array.isArray(list)) {
      result.issues.push({ issue: 'APPOINTMENTS_LIST_NOT_ARRAY' });
    }

    const firstAppointment = raw.length ? raw[0] : null;
    const appointmentId = firstAppointment ? String(firstAppointment.appointment_id || '').trim() : '';
    const patientId = firstAppointment ? String(firstAppointment.patient_id || '').trim() : '';

    result.probe.first_appointment_id = appointmentId;
    result.probe.first_patient_id = patientId;

    if (!appointmentId) {
      result.issues.push({ issue: 'NO_APPOINTMENT_SAMPLE_AVAILABLE' });
    }

    if (appointmentId) {
      const found = findAppointmentRawById(appointmentId, opts);
      const detail = getAppointmentById(appointmentId, opts);

      result.probe.find_success = !!found;
      result.probe.detail_success = !!(detail && detail.success);

      if (!found) {
        result.issues.push({
          appointment_id: appointmentId,
          issue: 'FIND_APPOINTMENT_FAILED'
        });
      }

      if (!detail || !detail.success) {
        result.issues.push({
          appointment_id: appointmentId,
          issue: 'GET_APPOINTMENT_BY_ID_FAILED'
        });
      }
    }

    if (patientId) {
      const hasOpen = hasOpenAppointmentForPatient(patientId, '', opts);
      const checkRes = checkPatientOpenAppointment(patientId, '', opts);

      result.probe.has_open_appointment = !!hasOpen;
      result.probe.check_open_success = !!(
        checkRes &&
        checkRes.success === true &&
        Object.prototype.hasOwnProperty.call(checkRes, 'hasOpenAppointment')
      );

      if (!result.probe.check_open_success) {
        result.issues.push({
          patient_id: patientId,
          issue: 'CHECK_PATIENT_OPEN_APPOINTMENT_FAILED'
        });
      }
    }

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.APPOINTMENTS, {
        appointment_id: 'TEST-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    if (!supabaseWriteBlocked) {
      result.issues.push({
        issue: 'SUPABASE_WRITE_NOT_BLOCKED'
      });
    }

    result.supabase_write_guard = {
      blocked: supabaseWriteBlocked,
      message: supabaseWriteMessage
    };

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6G-AppointmentService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentServiceWriteLog() {
  const result = {
    success: true,
    stage: '6G-AppointmentService-Write',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    issue_count: 0,
    issues: [],
    steps: {}
  };

  let createdAppointmentId = null;

  try {
    const patients = typeof getPatientsRaw === 'function' ? getPatientsRaw() : [];
    const testPatient = patients.length ? patients[0] : null;

    if (!testPatient || !testPatient.patient_id) {
      result.issues.push({ issue: 'NO_PATIENT_AVAILABLE_FOR_WRITE_TEST' });
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const testPatientId = String(testPatient.patient_id).trim();
    result.steps.test_patient_id = testPatientId;

    // Step 1: Create
    const createRes = createAppointment({
      patient_id: testPatientId,
      appointment_date: '2099-12-31',
      appointment_time: '09:00',
      complaint: 'TEST WRITE PHASE 6 - HAPUS JIKA MUNCUL',
      status: 'scheduled'
    });

    result.steps.create = {
      success: !!(createRes && createRes.success),
      message: createRes && createRes.message ? createRes.message : ''
    };

    if (!createRes || !createRes.success) {
      result.issues.push({ issue: 'CREATE_APPOINTMENT_FAILED', message: result.steps.create.message });
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    createdAppointmentId = createRes.data && createRes.data.appointment_id
      ? String(createRes.data.appointment_id).trim()
      : '';

    result.steps.created_appointment_id = createdAppointmentId;

    if (!createdAppointmentId) {
      result.issues.push({ issue: 'CREATED_APPOINTMENT_ID_MISSING' });
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    // Step 2: Read back
    const readBack = getAppointmentById(createdAppointmentId);
    result.steps.read_back = {
      success: !!(readBack && readBack.success && readBack.data),
      status: readBack && readBack.data ? readBack.data.status : ''
    };

    if (!result.steps.read_back.success) {
      result.issues.push({ issue: 'READ_BACK_AFTER_CREATE_FAILED' });
    }

    // Step 3: Cancel
    const cancelRes = cancelAppointment(createdAppointmentId);
    result.steps.cancel = {
      success: !!(cancelRes && cancelRes.success),
      message: cancelRes && cancelRes.message ? cancelRes.message : ''
    };

    if (!cancelRes || !cancelRes.success) {
      result.issues.push({ issue: 'CANCEL_APPOINTMENT_FAILED', message: result.steps.cancel.message });
    }

    // Step 4: Verify cancelled
    const afterCancel = getAppointmentById(createdAppointmentId);
    result.steps.verify_cancelled = {
      status: afterCancel && afterCancel.data ? afterCancel.data.status : '',
      ok: !!(afterCancel && afterCancel.data && afterCancel.data.status === 'cancelled')
    };

    if (!result.steps.verify_cancelled.ok) {
      result.issues.push({ issue: 'STATUS_NOT_CANCELLED_AFTER_CANCEL' });
    }

    // Step 5: Restore
    const restoreRes = restoreAppointment(createdAppointmentId);
    result.steps.restore = {
      success: !!(restoreRes && restoreRes.success),
      message: restoreRes && restoreRes.message ? restoreRes.message : ''
    };

    if (!restoreRes || !restoreRes.success) {
      result.issues.push({ issue: 'RESTORE_APPOINTMENT_FAILED', message: result.steps.restore.message });
    }

    // Step 6: Verify restored
    const afterRestore = getAppointmentById(createdAppointmentId);
    result.steps.verify_restored = {
      status: afterRestore && afterRestore.data ? afterRestore.data.status : '',
      ok: !!(afterRestore && afterRestore.data && afterRestore.data.status === 'scheduled')
    };

    if (!result.steps.verify_restored.ok) {
      result.issues.push({ issue: 'STATUS_NOT_SCHEDULED_AFTER_RESTORE' });
    }

    // Cleanup: cancel test appointment supaya tidak mengganggu
    cancelAppointment(createdAppointmentId);
    result.steps.cleanup = 'cancelled (test appointment dibersihkan)';

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    if (createdAppointmentId) {
      try { cancelAppointment(createdAppointmentId); } catch (e) {}
    }

    const errorResult = {
      success: false,
      stage: '6G-AppointmentService-Write',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-4-AppointmentService-FreezeGuard',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
        ? repoGetUiReadBackendMode_()
        : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null,
      production_mutation_freeze_enabled: typeof repoIsProductionMutationFreezeEnabled_ === 'function'
        ? repoIsProductionMutationFreezeEnabled_()
        : null
    },
    before_counts: {},
    after_counts: {},
    checks: {
      default_off_create_validation_reached: false,
      default_off_update_validation_reached: false,
      default_off_cancel_normal_flow_reached: false,
      default_off_restore_normal_flow_reached: false,
      simulated_freeze_create_blocked: false,
      simulated_freeze_update_blocked: false,
      simulated_freeze_cancel_blocked: false,
      simulated_freeze_restore_blocked: false,
      counts_unchanged: false
    },
    messages: {},
    issue_count: 0,
    issues: []
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({
      issue: issue
    }, details || {}));
  }

  function getAppointmentCount_() {
    return getAppointmentsRaw({
      backend_mode: 'spreadsheet'
    }).length;
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );
  }

  try {
    result.before_counts.appointments = getAppointmentCount_();

    if (
      result.flags.default_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_supabase_test_enabled !== false ||
      result.flags.supabase_staging_write_test_enabled !== false ||
      result.flags.production_mutation_freeze_enabled !== false
    ) {
      addIssue('FLAGS_NOT_SAFE_DEFAULT_OFF', result.flags);
    }

    const defaultOffCreate = createAppointment({
      patient_id: '',
      appointment_date: '',
      appointment_time: '',
      complaint: '',
      status: ''
    });

    result.messages.default_off_create = defaultOffCreate && defaultOffCreate.message
      ? defaultOffCreate.message
      : '';

    result.checks.default_off_create_validation_reached = !!(
      defaultOffCreate &&
      defaultOffCreate.success === false &&
      defaultOffCreate.message === 'Validasi gagal'
    );

    if (!result.checks.default_off_create_validation_reached) {
      addIssue('DEFAULT_OFF_CREATE_DID_NOT_REACH_VALIDATION', {
        response: defaultOffCreate
      });
    }

    const defaultOffUpdate = updateAppointment({
      appointment_id: '',
      patient_id: '',
      appointment_date: '',
      appointment_time: '',
      complaint: '',
      status: ''
    });

    result.messages.default_off_update = defaultOffUpdate && defaultOffUpdate.message
      ? defaultOffUpdate.message
      : '';

    result.checks.default_off_update_validation_reached = !!(
      defaultOffUpdate &&
      defaultOffUpdate.success === false &&
      (
        defaultOffUpdate.message === 'Appointment ID tidak ditemukan' ||
        defaultOffUpdate.message === 'Validasi gagal' ||
        defaultOffUpdate.message === 'Data appointment tidak ditemukan'
      )
    );

    if (!result.checks.default_off_update_validation_reached) {
      addIssue('DEFAULT_OFF_UPDATE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffUpdate
      });
    }

    const defaultOffCancel = cancelAppointment('APT-8B-NOT-FOUND');

    result.messages.default_off_cancel = defaultOffCancel && defaultOffCancel.message
      ? defaultOffCancel.message
      : '';

    result.checks.default_off_cancel_normal_flow_reached = !!(
      defaultOffCancel &&
      defaultOffCancel.success === false &&
      defaultOffCancel.message === 'Data appointment tidak ditemukan'
    );

    if (!result.checks.default_off_cancel_normal_flow_reached) {
      addIssue('DEFAULT_OFF_CANCEL_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffCancel
      });
    }

    const defaultOffRestore = restoreAppointment('APT-8B-NOT-FOUND');

    result.messages.default_off_restore = defaultOffRestore && defaultOffRestore.message
      ? defaultOffRestore.message
      : '';

    result.checks.default_off_restore_normal_flow_reached = !!(
      defaultOffRestore &&
      defaultOffRestore.success === false &&
      defaultOffRestore.message === 'Data appointment tidak ditemukan'
    );

    if (!result.checks.default_off_restore_normal_flow_reached) {
      addIssue('DEFAULT_OFF_RESTORE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffRestore
      });
    }

    const simulatedFreezeCreate = createAppointment({
      __test_freeze_enabled: true,
      patient_id: '',
      appointment_date: '',
      appointment_time: '',
      complaint: '',
      status: ''
    });

    result.messages.simulated_freeze_create = simulatedFreezeCreate && simulatedFreezeCreate.message
      ? simulatedFreezeCreate.message
      : '';

    result.checks.simulated_freeze_create_blocked = isFreezeMessage_(simulatedFreezeCreate);

    if (!result.checks.simulated_freeze_create_blocked) {
      addIssue('SIMULATED_FREEZE_CREATE_NOT_BLOCKED', {
        response: simulatedFreezeCreate
      });
    }

    const simulatedFreezeUpdate = updateAppointment({
      __test_freeze_enabled: true,
      appointment_id: 'APT-0001',
      patient_id: 'PAT-0001',
      appointment_date: '2027-01-01',
      appointment_time: '09:00',
      complaint: 'SHOULD NOT UPDATE',
      status: 'scheduled'
    });

    result.messages.simulated_freeze_update = simulatedFreezeUpdate && simulatedFreezeUpdate.message
      ? simulatedFreezeUpdate.message
      : '';

    result.checks.simulated_freeze_update_blocked = isFreezeMessage_(simulatedFreezeUpdate);

    if (!result.checks.simulated_freeze_update_blocked) {
      addIssue('SIMULATED_FREEZE_UPDATE_NOT_BLOCKED', {
        response: simulatedFreezeUpdate
      });
    }

    const simulatedFreezeCancel = cancelAppointment('APT-0001', {
      __test_freeze_enabled: true
    });

    result.messages.simulated_freeze_cancel = simulatedFreezeCancel && simulatedFreezeCancel.message
      ? simulatedFreezeCancel.message
      : '';

    result.checks.simulated_freeze_cancel_blocked = isFreezeMessage_(simulatedFreezeCancel);

    if (!result.checks.simulated_freeze_cancel_blocked) {
      addIssue('SIMULATED_FREEZE_CANCEL_NOT_BLOCKED', {
        response: simulatedFreezeCancel
      });
    }

    const simulatedFreezeRestore = restoreAppointment('APT-0001', {
      __test_freeze_enabled: true
    });

    result.messages.simulated_freeze_restore = simulatedFreezeRestore && simulatedFreezeRestore.message
      ? simulatedFreezeRestore.message
      : '';

    result.checks.simulated_freeze_restore_blocked = isFreezeMessage_(simulatedFreezeRestore);

    if (!result.checks.simulated_freeze_restore_blocked) {
      addIssue('SIMULATED_FREEZE_RESTORE_NOT_BLOCKED', {
        response: simulatedFreezeRestore
      });
    }

    result.after_counts.appointments = getAppointmentCount_();

    result.checks.counts_unchanged = result.after_counts.appointments === result.before_counts.appointments;

    if (!result.checks.counts_unchanged) {
      addIssue('APPOINTMENT_COUNT_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_counts,
        after: result.after_counts
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-4-AppointmentService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'APPOINTMENT_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}