/* =========================================================
   PHASE 4D - ORTHO RECALL REPOSITORY BRIDGE HELPERS
   Read-only bridge. Backend tetap Spreadsheet.
   ========================================================= */

function isOrthoRecallRepositoryBridgeAvailable_() {
  return typeof OrthoRecallRepository !== 'undefined' &&
    OrthoRecallRepository &&
    typeof OrthoRecallRepository.getOrthoRecallRaw === 'function';
}

function getOrthoRecallServiceUiReadOptions_(options) {
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

function getOrthoRecallServiceUiReadBackendMode_(options) {
  const opts = getOrthoRecallServiceUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function isOrthoRecallServiceUiReadSupabaseMode_(options) {
  return getOrthoRecallServiceUiReadBackendMode_(options) === 'supabase';
}

function getOrthoRecallServiceSpreadsheetWriteReadOptions_() {
  return repoBuildUiReadOptions_({});
}

function getOrthoRecallRaw(options) {
  const opts = getOrthoRecallServiceUiReadOptions_(options);

  if (
    isOrthoRecallRepositoryBridgeAvailable_() &&
    typeof OrthoRecallRepository.getOrthoRecallRaw === 'function'
  ) {
    return OrthoRecallRepository.getOrthoRecallRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.ORTHO_RECALL || 'OrthoRecall', opts) || [];
  }

  return getRowsAsObjects('OrthoRecall') || [];
}

function normalizeOrthoRecallRow(row) {
  const obj = {};
  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });

  obj.phone = normalizeRecallPhoneDisplay(obj.phone);

  return obj;
}

function normalizeRecallPhoneDisplay(value) {
  let phone = String(formatCellValue(value) || '').trim();

  if (!phone) return '';

  phone = phone.replace(/^'/, '').trim();

  phone = phone.replace(/\s+/g, '');

  if (phone.indexOf('+62') === 0) {
    return '0' + phone.slice(3);
  }

  if (phone.indexOf('62') === 0 && phone.length >= 11) {
    return '0' + phone.slice(2);
  }

  if (phone.indexOf('8') === 0) {
    return '0' + phone;
  }

  return phone;
}

function forceRecallPhoneText(value) {
  const phone = normalizeRecallPhoneDisplay(value);
  if (!phone) return '';

  if (typeof forceSheetText === 'function') {
    return forceSheetText(phone);
  }

  if (typeof repoIsSupabaseBackendMode_ === 'function' && repoIsSupabaseBackendMode_()) {
    return phone;
  }

  return "'" + phone;
}

function generateNextOrthoRecallId() {
  return generateSafeId('ORC');
}

function addDaysToYmd(ymd, days) {
  const value = String(ymd || '').trim();
  if (!isValidYmdDate(value)) return '';

  const parts = value.split('-');
  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  date.setDate(date.getDate() + Number(days || 0));

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function addMonthsToYmd(ymd, months) {
  const value = String(ymd || '').trim();
  if (!isValidYmdDate(value)) return '';

  const parts = value.split('-');
  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + Number(months || 0));

  while (date.getDate() < originalDay) {
    date.setDate(date.getDate() - 1);
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getTodayYmdServer() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function calculateOrthoFollowupStatus(nextDueDate, installDate, targetMonths, programStatus) {
  const normalizedProgramStatus = String(programStatus || '').trim().toLowerCase();

  if (normalizedProgramStatus === 'completed' || normalizedProgramStatus === 'cancelled') {
    return 'done';
  }

  const today = getTodayYmdServer();
  const dueDate = String(nextDueDate || '').trim();
  const baseInstallDate = String(installDate || '').trim();
  const target = Number(targetMonths || 6);

  const targetReachedDate = addMonthsToYmd(baseInstallDate, target);

  if (targetReachedDate && today >= targetReachedDate) {
    if (dueDate && today > dueDate) {
      return 'overdue';
    }

    if (dueDate && today === dueDate) {
      return 'due';
    }

    return 'reached_target';
  }

  if (!dueDate) return 'upcoming';
  if (today > dueDate) return 'overdue';
  if (today === dueDate) return 'due';

  return 'upcoming';
}

function getRecallPatientPhone(patientId, fallbackPhone, options) {
  const opts = getOrthoRecallServiceUiReadOptions_(options);
  const patient = typeof findPatientRawById === 'function'
    ? findPatientRawById(patientId, opts)
    : null;

  if (patient && patient.phone) {
    return normalizeRecallPhoneDisplay(patient.phone);
  }

  return normalizeRecallPhoneDisplay(fallbackPhone);
}

function findActiveOrthoRecallByPatientId(patientId, options) {
  const normalizedPatientId = String(patientId || '').trim();
  const opts = getOrthoRecallServiceUiReadOptions_(options);

  if (!normalizedPatientId) return null;

  if (
    isOrthoRecallRepositoryBridgeAvailable_() &&
    typeof OrthoRecallRepository.findActiveRecallByPatientId === 'function'
  ) {
    return OrthoRecallRepository.findActiveRecallByPatientId(normalizedPatientId, opts) || null;
  }

  return getOrthoRecallRaw(opts).find(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId &&
      String(row.program_status || '').trim().toLowerCase() === 'active';
  }) || null;
}

function findOrthoRecallById(orthoRecallId, options) {
  const normalizedRecallId = String(orthoRecallId || '').trim();
  const opts = getOrthoRecallServiceUiReadOptions_(options);

  if (!normalizedRecallId) return null;

  if (
    isOrthoRecallRepositoryBridgeAvailable_() &&
    typeof OrthoRecallRepository.findOrthoRecallById === 'function'
  ) {
    return OrthoRecallRepository.findOrthoRecallById(normalizedRecallId, opts) || null;
  }

  return getOrthoRecallRaw(opts).find(function(row) {
    return String(row.ortho_recall_id || '').trim() === normalizedRecallId;
  }) || null;
}

function getOrthoRecallRowsByPatientId(patientId, options) {
  const normalizedPatientId = String(patientId || '').trim();
  const opts = getOrthoRecallServiceUiReadOptions_(options);

  if (!normalizedPatientId) return [];

  if (
    isOrthoRecallRepositoryBridgeAvailable_() &&
    typeof OrthoRecallRepository.listRecallByPatientId === 'function'
  ) {
    return OrthoRecallRepository.listRecallByPatientId(normalizedPatientId, opts) || [];
  }

  return getOrthoRecallRaw(opts).filter(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  });
}

function getPreferredOrthoRecallRowByPatientId(patientId, options) {
  const rows = getOrthoRecallRowsByPatientId(patientId, options);
  if (!rows.length) return null;

  const sorted = sortOrthoRecallRowsForPatient(rows);
  return sorted[0] || null;
}

function buildPatientOrthoRecallSummary(row, options) {
  if (!row) {
    return {
      has_recall: false,
      has_active_program: false,
      total_records: 0,
      current: null
    };
  }

  const opts = getOrthoRecallServiceUiReadOptions_(options);

  const enrichedRow = typeof migration8E4C_enrichOrthoRecallRowForClient_ === 'function'
    ? migration8E4C_enrichOrthoRecallRowForClient_(row, opts)
    : row;

  const normalized = normalizeOrthoRecallRow(enrichedRow);
  const installDate = String(normalized.install_date || '').slice(0, 10);
  const nextDueDate = String(normalized.next_due_date || '').slice(0, 10);
  const targetMonths = Number(normalized.target_months || 6);
  const programStatus = String(normalized.program_status || '').trim().toLowerCase();

  normalized.followup_status = calculateOrthoFollowupStatus(
    nextDueDate,
    installDate,
    targetMonths,
    programStatus
  );

  return {
    has_recall: true,
    has_active_program: programStatus === 'active',
    total_records: getOrthoRecallRowsByPatientId(normalized.patient_id, opts).length,
    current: normalized
  };
}

function getPatientOrthoRecallSummary(patientId, options) {
  const normalizedPatientId = String(patientId || '').trim();
  const opts = getOrthoRecallServiceUiReadOptions_(options);

  if (!normalizedPatientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const row = getPreferredOrthoRecallRowByPatientId(normalizedPatientId, opts);

  return {
    success: true,
    data: buildPatientOrthoRecallSummary(row, opts)
  };
}

function getOrthoRecallById(orthoRecallId, options) {
  const opts = getOrthoRecallServiceUiReadOptions_(options);
  const row = findOrthoRecallById(orthoRecallId, opts);

  if (!row) {
    return {
      success: false,
      message: 'Data recall tidak ditemukan'
    };
  }

  const enrichedRow = typeof migration8E4C_enrichOrthoRecallRowForClient_ === 'function'
    ? migration8E4C_enrichOrthoRecallRowForClient_(row, opts)
    : row;

  return {
    success: true,
    data: normalizeOrthoRecallRow(enrichedRow)
  };
}

function sortOrthoRecallRowsForPatient(rows) {
  return (rows || []).slice().sort(function(a, b) {
    const aActive = String(a.program_status || '').trim().toLowerCase() === 'active' ? 1 : 0;
    const bActive = String(b.program_status || '').trim().toLowerCase() === 'active' ? 1 : 0;

    if (aActive !== bActive) {
      return bActive - aActive;
    }

    const aUpdated = String(formatCellValue(a.updated_at || '') || '');
    const bUpdated = String(formatCellValue(b.updated_at || '') || '');
    if (aUpdated !== bUpdated) {
      return bUpdated.localeCompare(aUpdated);
    }

    const aInstall = String(formatCellValue(a.install_date || '') || '').slice(0, 10);
    const bInstall = String(formatCellValue(b.install_date || '') || '').slice(0, 10);
    if (aInstall !== bInstall) {
      return bInstall.localeCompare(aInstall);
    }

    const aCreated = String(formatCellValue(a.created_at || '') || '');
    const bCreated = String(formatCellValue(b.created_at || '') || '');
    return bCreated.localeCompare(aCreated);
  });
}

function buildOrthoRecallRecordFromInstall(payload) {
  const patientId = String(payload.patient_id || '').trim();
  const patientName = String(payload.patient_name || '').trim();
  const phone = getRecallPatientPhone(
    patientId,
    payload.phone,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );
  const treatmentId = String(payload.treatment_id || '').trim();
  const installDate = String(payload.treatment_date || '').trim();
  const targetMonths = Number(payload.target_months || 6);

  const nextDueDate = addDaysToYmd(installDate, 28);

  return {
    ortho_recall_id: generateNextOrthoRecallId(),
    patient_id: patientId,
    patient_name: patientName,
    phone: forceRecallPhoneText(phone),
    install_treatment_id: treatmentId,
    install_date: installDate,
    last_control_treatment_id: '',
    last_control_date: null,
    next_due_date: nextDueDate,
    control_count: 0,
    program_status: 'active',
    followup_status: calculateOrthoFollowupStatus(nextDueDate, installDate, targetMonths, 'active'),
    target_months: targetMonths,
    completed_at: null,
    last_contact_date: null,
    last_contact_note: '',
    notes: '',
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function buildOrthoRecallRecordFromControlFallback(payload) {
  const patientId = String(payload.patient_id || '').trim();
  const patientName = String(payload.patient_name || '').trim();
  const phone = getRecallPatientPhone(
    patientId,
    payload.phone,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );
  const treatmentId = String(payload.treatment_id || '').trim();
  const controlDate = String(payload.treatment_date || '').trim();
  const targetMonths = Number(payload.target_months || 6);
  const nextDueDate = addDaysToYmd(controlDate, 28);

  return {
    ortho_recall_id: generateNextOrthoRecallId(),
    patient_id: patientId,
    patient_name: patientName,
    phone: forceRecallPhoneText(phone),
    install_treatment_id: '',
    install_date: controlDate,
    last_control_treatment_id: treatmentId,
    last_control_date: controlDate,
    next_due_date: nextDueDate,
    control_count: 1,
    program_status: 'active',
    followup_status: calculateOrthoFollowupStatus(nextDueDate, controlDate, targetMonths, 'active'),
    target_months: targetMonths,
    completed_at: null,
    last_contact_date: null,
    last_contact_note: '',
    notes: 'Auto-created from ortho control because active recall was not found.',
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function createOrthoRecallFromInstall(payload) {
  const patientId = String(payload.patient_id || '').trim();

  if (!patientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const existing = findActiveOrthoRecallByPatientId(
    patientId,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );
  if (existing) {
    return {
      success: false,
      message: 'Pasien ini sudah memiliki recall ortho aktif'
    };
  }

  const record = buildOrthoRecallRecordFromInstall(payload);
  dbInsert_('OrthoRecall', record);
  clearPatientDetailBundleCache(patientId);

  return {
    success: true,
    message: 'Ortho recall berhasil dibuat',
    data: normalizeOrthoRecallRow(record)
  };
}

function createOrthoRecallFromControlFallback(payload) {
  const patientId = String(payload.patient_id || '').trim();

  if (!patientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const existing = findActiveOrthoRecallByPatientId(
    patientId,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );
  if (existing) {
    return {
      success: false,
      message: 'Pasien ini sudah memiliki recall ortho aktif'
    };
  }

  const record = buildOrthoRecallRecordFromControlFallback(payload);
  dbInsert_('OrthoRecall', record);
  clearPatientDetailBundleCache(patientId);

  return {
    success: true,
    message: 'Recall ortho berhasil dibuat dari kontrol',
    data: normalizeOrthoRecallRow(record)
  };
}

function updateOrthoRecallFromControl(payload) {
  const patientId = String(payload.patient_id || '').trim();
  const treatmentId = String(payload.treatment_id || '').trim();
  const controlDate = String(payload.treatment_date || '').trim();

  if (!patientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const existing = findActiveOrthoRecallByPatientId(
    patientId,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );
  if (!existing) {
    return {
      success: false,
      message: 'Recall ortho aktif tidak ditemukan untuk pasien ini'
    };
  }

  const nextControlCount = Number(existing.control_count || 0) + 1;
  const nextDueDate = addDaysToYmd(controlDate, 28);
  const installDate = String(existing.install_date || '').trim();
  const targetMonths = Number(existing.target_months || 6);

  const updated = {
    last_control_treatment_id: treatmentId,
    last_control_date: controlDate,
    next_due_date: nextDueDate,
    control_count: nextControlCount,
    followup_status: calculateOrthoFollowupStatus(nextDueDate, installDate, targetMonths, 'active'),
    updated_at: nowIso()
  };

  const ok = dbUpdateById_('OrthoRecall', 'ortho_recall_id', existing.ortho_recall_id, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal mengupdate recall ortho'
    };
  }

  clearPatientDetailBundleCache(existing.patient_id);

  const merged = Object.assign({}, existing, updated);

  return {
    success: true,
    message: 'Recall ortho berhasil diupdate',
    data: normalizeOrthoRecallRow(merged)
  };
}

function upsertOrthoRecallFromControl(payload) {
  const existing = findActiveOrthoRecallByPatientId(
    payload.patient_id,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );

  if (existing) {
    return updateOrthoRecallFromControl(payload);
  }

  return createOrthoRecallFromControlFallback(payload);
}

function saveOrthoRecallContact(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'SAVE_ORTHO_RECALL_CONTACT',
    module: 'OrthoRecallService',
    action: 'saveOrthoRecallContact',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const orthoRecallId = String((payload && payload.ortho_recall_id) || '').trim();
  const note = String((payload && payload.last_contact_note) || '').trim();

  if (!orthoRecallId) {
    return {
      success: false,
      message: 'Recall ID tidak ditemukan'
    };
  }

  const existing = findOrthoRecallById(
    orthoRecallId,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );
  if (!existing) {
    return {
      success: false,
      message: 'Data recall tidak ditemukan'
    };
  }

  const updated = {
    last_contact_date: getTodayYmdServer(),
    last_contact_note: note,
    updated_at: nowIso()
  };

  const ok = dbUpdateById_('OrthoRecall', 'ortho_recall_id', orthoRecallId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal menyimpan follow up kontak'
    };
  }

  clearPatientDetailBundleCache(existing.patient_id);

  const merged = Object.assign({}, existing, updated);

  return {
    success: true,
    message: 'Follow up kontak berhasil disimpan',
    data: normalizeOrthoRecallRow(merged)
  };
}

function buildOrthoRecallProgramNote(existingNote, actionLabel, reason) {
  const oldNote = String(existingNote || '').trim();
  const cleanReason = String(reason || '').trim();
  const timestamp = nowIso();

  const newLine =
    '[' + timestamp + '] ' +
    actionLabel +
    (cleanReason ? ': ' + cleanReason : '');

  if (!oldNote) return newLine;

  return oldNote + '\n' + newLine;
}

function completeOrthoRecallProgram(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'COMPLETE_ORTHO_RECALL_PROGRAM',
    module: 'OrthoRecallService',
    action: 'completeOrthoRecallProgram',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const orthoRecallId = String((payload && payload.ortho_recall_id) || '').trim();
  const reason = String((payload && payload.reason) || '').trim();

  if (!orthoRecallId) {
    return {
      success: false,
      message: 'Recall ID tidak ditemukan'
    };
  }

  const existing = findOrthoRecallById(
    orthoRecallId,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );

  if (!existing) {
    return {
      success: false,
      message: 'Data recall tidak ditemukan'
    };
  }

  const currentStatus = String(existing.program_status || '').trim().toLowerCase();

  if (currentStatus === 'completed') {
    return {
      success: false,
      message: 'Program recall ini sudah completed'
    };
  }

  if (currentStatus === 'cancelled') {
    return {
      success: false,
      message: 'Program recall yang sudah cancelled tidak bisa di-complete'
    };
  }

  const updated = {
    program_status: 'completed',
    followup_status: 'done',
    completed_at: nowIso(),
    notes: buildOrthoRecallProgramNote(existing.notes, 'Program completed', reason),
    updated_at: nowIso()
  };

  const ok = dbUpdateById_('OrthoRecall', 'ortho_recall_id', orthoRecallId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal menyelesaikan program recall'
    };
  }

  clearPatientDetailBundleCache(existing.patient_id);

  const merged = Object.assign({}, existing, updated);

  return {
    success: true,
    message: 'Program recall berhasil diselesaikan',
    data: normalizeOrthoRecallRow(merged)
  };
}

function cancelOrthoRecallProgram(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CANCEL_ORTHO_RECALL_PROGRAM',
    module: 'OrthoRecallService',
    action: 'cancelOrthoRecallProgram',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const orthoRecallId = String((payload && payload.ortho_recall_id) || '').trim();
  const reason = String((payload && payload.reason) || '').trim();

  if (!orthoRecallId) {
    return {
      success: false,
      message: 'Recall ID tidak ditemukan'
    };
  }

  const existing = findOrthoRecallById(
    orthoRecallId,
    getOrthoRecallServiceSpreadsheetWriteReadOptions_()
  );

  if (!existing) {
    return {
      success: false,
      message: 'Data recall tidak ditemukan'
    };
  }

  const currentStatus = String(existing.program_status || '').trim().toLowerCase();

  if (currentStatus === 'cancelled') {
    return {
      success: false,
      message: 'Program recall ini sudah cancelled'
    };
  }

  if (currentStatus === 'completed') {
    return {
      success: false,
      message: 'Program recall yang sudah completed tidak bisa dibatalkan'
    };
  }

  const updated = {
    program_status: 'cancelled',
    followup_status: 'done',
    completed_at: null,
    notes: buildOrthoRecallProgramNote(existing.notes, 'Program cancelled', reason),
    updated_at: nowIso()
  };

  const ok = dbUpdateById_('OrthoRecall', 'ortho_recall_id', orthoRecallId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal membatalkan program recall'
    };
  }

  clearPatientDetailBundleCache(existing.patient_id);

  const merged = Object.assign({}, existing, updated);

  return {
    success: true,
    message: 'Program recall berhasil dibatalkan',
    data: normalizeOrthoRecallRow(merged)
  };
}

function refreshAllOrthoRecallStatuses(options) {
  /*
   * Cutover/Supabase read mode:
   * Refresh status recall adalah mutation ke Spreadsheet lama.
   * Saat UI/backend read sudah Supabase, function ini harus langsung skip
   * sebelum masuk production freeze guard, supaya test dan UI read path
   * tidak menganggap refresh sebagai mutation gagal.
   */
  if (isOrthoRecallServiceUiReadSupabaseMode_(options)) {
    return {
      success: true,
      message: 'Refresh status recall dilewati pada mode Supabase read-only',
      updated_count: 0,
      skipped: true,
      reason: 'SUPABASE_READ_MODE_SKIP_MUTATION'
    };
  }

  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'REFRESH_ORTHO_RECALL_STATUSES',
    module: 'OrthoRecallService',
    action: 'refreshAllOrthoRecallStatuses',
    __test_freeze_enabled: options && options.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message,
      updated_count: 0
    };
  }

  const writeReadOptions = getOrthoRecallServiceSpreadsheetWriteReadOptions_();
  const rows = getOrthoRecallRaw(writeReadOptions);
  let updatedCount = 0;

  rows.forEach(function(row) {
    const orthoRecallId = String(row.ortho_recall_id || '').trim();
    if (!orthoRecallId) return;

    const installDate = String(formatCellValue(row.install_date || '')).slice(0, 10);
    const nextDueDate = String(formatCellValue(row.next_due_date || '')).slice(0, 10);
    const targetMonths = Number(row.target_months || 6);
    const programStatus = String(row.program_status || '').trim().toLowerCase();

    const nextStatus = calculateOrthoFollowupStatus(
      nextDueDate,
      installDate,
      targetMonths,
      programStatus
    );

    if (String(row.followup_status || '').trim().toLowerCase() !== nextStatus) {
      dbUpdateById_('OrthoRecall', 'ortho_recall_id', orthoRecallId, {
        followup_status: nextStatus,
        updated_at: nowIso()
      });

      clearPatientDetailBundleCache(row.patient_id);

      updatedCount++;
    }
  });

  return {
    success: true,
    message: updatedCount + ' status recall diperbarui',
    updated_count: updatedCount
  };
}

function getOrthoRecallList(options) {
  const opts = getOrthoRecallServiceUiReadOptions_(options);

  if (!isOrthoRecallServiceUiReadSupabaseMode_(opts)) {
    refreshAllOrthoRecallStatuses(opts);
  }

  const rawRows = getOrthoRecallRaw(opts);

  const enrichedRows = typeof migration8E4C_enrichOrthoRecallRowsForClient_ === 'function'
    ? migration8E4C_enrichOrthoRecallRowsForClient_(rawRows, opts)
    : rawRows;

  const rows = enrichedRows
    .map(function(row) {
      return normalizeOrthoRecallRow(row);
    })
    .sort(function(a, b) {
      const dueCompare = String(a.next_due_date || '').localeCompare(String(b.next_due_date || ''));
      if (dueCompare !== 0) return dueCompare;

      return String(a.patient_name || '').localeCompare(String(b.patient_name || ''));
    });

  return {
    success: true,
    data: rows
  };
}

function syncOrthoRecallPhonesFromPatients(options) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'SYNC_ORTHO_RECALL_PHONES',
    module: 'OrthoRecallService',
    action: 'syncOrthoRecallPhonesFromPatients',
    __test_freeze_enabled: options && options.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message,
      updated_count: 0,
      skipped_count: 0
    };
  }

  const writeReadOptions = getOrthoRecallServiceSpreadsheetWriteReadOptions_();
  const rows = getOrthoRecallRaw(writeReadOptions);
  let updatedCount = 0;
  let skippedCount = 0;

  rows.forEach(function(row) {
    const recallId = String(row.ortho_recall_id || '').trim();
    const patientId = String(row.patient_id || '').trim();

    if (!recallId || !patientId) {
      skippedCount++;
      return;
    }

    const patient = findPatientRawById(patientId, writeReadOptions);

    if (!patient) {
      skippedCount++;
      return;
    }

    const correctPhone = normalizeRecallPhoneDisplay(patient.phone);

    if (!correctPhone) {
      skippedCount++;
      return;
    }

    dbUpdateById_('OrthoRecall', 'ortho_recall_id', recallId, {
      phone: forceRecallPhoneText(correctPhone),
      updated_at: nowIso()
    });

    clearPatientDetailBundleCache(patientId);
    updatedCount++;
  });

  return {
    success: true,
    message: updatedCount + ' nomor HP recall dipaksa sinkron dari Patients',
    updated_count: updatedCount,
    skipped_count: skippedCount
  };
}

function getOrthoRecallRequiredHeaders() {
  return [
    'ortho_recall_id',
    'patient_id',
    'patient_name',
    'phone',
    'install_treatment_id',
    'install_date',
    'last_control_treatment_id',
    'last_control_date',
    'next_due_date',
    'control_count',
    'program_status',
    'followup_status',
    'target_months',
    'completed_at',
    'last_contact_date',
    'last_contact_note',
    'notes',
    'created_at',
    'updated_at'
  ];
}

function auditOrthoRecallDataHealth() {
  const sheet = getSheet('OrthoRecall');
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];
  const rows = getOrthoRecallRaw();

  const requiredHeaders = getOrthoRecallRequiredHeaders();
  const missingHeaders = requiredHeaders.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  const allowedProgramStatus = ['active', 'completed', 'cancelled'];
  const allowedFollowupStatus = ['upcoming', 'due', 'overdue', 'reached_target', 'done'];

  const issues = {
    missing_headers: missingHeaders,
    empty_required_fields: [],
    invalid_program_status: [],
    invalid_followup_status: [],
    invalid_phone_format: [],
    invalid_dates: [],
    duplicate_active_recall: [],
    inactive_not_done: [],
    completed_without_completed_at: []
  };

  const activeByPatient = {};

  rows.forEach(function(row, index) {
    const rowNumber = index + 2;

    const recallId = String(row.ortho_recall_id || '').trim();
    const patientId = String(row.patient_id || '').trim();
    const patientName = String(row.patient_name || '').trim();
    const phone = normalizeRecallPhoneDisplay(row.phone);
    const installDate = String(formatCellValue(row.install_date || '') || '').slice(0, 10);
    const nextDueDate = String(formatCellValue(row.next_due_date || '') || '').slice(0, 10);
    const lastControlDate = String(formatCellValue(row.last_control_date || '') || '').slice(0, 10);
    const completedAt = String(formatCellValue(row.completed_at || '') || '').trim();

    const programStatus = String(row.program_status || '').trim().toLowerCase();
    const followupStatus = String(row.followup_status || '').trim().toLowerCase();

    if (!recallId || !patientId || !patientName || !installDate || !programStatus || !followupStatus) {
      issues.empty_required_fields.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId,
        patient_name: patientName
      });
    }

    if (allowedProgramStatus.indexOf(programStatus) === -1) {
      issues.invalid_program_status.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId,
        program_status: programStatus
      });
    }

    if (allowedFollowupStatus.indexOf(followupStatus) === -1) {
      issues.invalid_followup_status.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId,
        followup_status: followupStatus
      });
    }

    if (phone && phone.indexOf('08') !== 0) {
      issues.invalid_phone_format.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId,
        phone: phone
      });
    }

    if (installDate && !isValidYmdDate(installDate)) {
      issues.invalid_dates.push({
        row: rowNumber,
        field: 'install_date',
        ortho_recall_id: recallId,
        value: installDate
      });
    }

    if (nextDueDate && !isValidYmdDate(nextDueDate)) {
      issues.invalid_dates.push({
        row: rowNumber,
        field: 'next_due_date',
        ortho_recall_id: recallId,
        value: nextDueDate
      });
    }

    if (lastControlDate && !isValidYmdDate(lastControlDate)) {
      issues.invalid_dates.push({
        row: rowNumber,
        field: 'last_control_date',
        ortho_recall_id: recallId,
        value: lastControlDate
      });
    }

    if (programStatus === 'active' && patientId) {
      if (!activeByPatient[patientId]) {
        activeByPatient[patientId] = [];
      }

      activeByPatient[patientId].push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_name: patientName
      });
    }

    if ((programStatus === 'completed' || programStatus === 'cancelled') && followupStatus !== 'done') {
      issues.inactive_not_done.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId,
        program_status: programStatus,
        followup_status: followupStatus
      });
    }

    if (programStatus === 'completed' && !completedAt) {
      issues.completed_without_completed_at.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId
      });
    }
  });

  Object.keys(activeByPatient).forEach(function(patientId) {
    if (activeByPatient[patientId].length > 1) {
      issues.duplicate_active_recall.push({
        patient_id: patientId,
        records: activeByPatient[patientId]
      });
    }
  });

  return {
    success: true,
    total_rows: rows.length,
    total_issues:
      issues.missing_headers.length +
      issues.empty_required_fields.length +
      issues.invalid_program_status.length +
      issues.invalid_followup_status.length +
      issues.invalid_phone_format.length +
      issues.invalid_dates.length +
      issues.duplicate_active_recall.length +
      issues.inactive_not_done.length +
      issues.completed_without_completed_at.length,
    issues: issues
  };
}

function auditOrthoRecallRawPhoneStorage() {
  const rows = getOrthoRecallRaw();

  const issues = [];

  rows.forEach(function(row, index) {
    const rowNumber = index + 2;
    const recallId = String(row.ortho_recall_id || '').trim();
    const patientId = String(row.patient_id || '').trim();

    let rawPhone = String(formatCellValue(row.phone) || '').trim();

    const cleanedRawPhone = rawPhone.replace(/^'/, '').trim();

    if (cleanedRawPhone && cleanedRawPhone.indexOf('08') !== 0) {
      issues.push({
        row: rowNumber,
        ortho_recall_id: recallId,
        patient_id: patientId,
        raw_phone: rawPhone,
        expected_display: normalizeRecallPhoneDisplay(rawPhone)
      });
    }
  });

  return {
    success: true,
    total_rows: rows.length,
    total_raw_phone_issues: issues.length,
    issues: issues
  };
}

function hardenOrthoRecallTextColumns() {
  const sheet = getSheet('OrthoRecall');
  const lastColumn = sheet.getLastColumn();
  const maxRows = sheet.getMaxRows();

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const textColumns = [
    'ortho_recall_id',
    'patient_id',
    'patient_name',
    'phone',
    'install_treatment_id',
    'last_control_treatment_id',
    'program_status',
    'followup_status',
    'last_contact_note',
    'notes'
  ];

  textColumns.forEach(function(headerName) {
    const colIndex = headers.indexOf(headerName) + 1;

    if (colIndex > 0) {
      sheet.getRange(1, colIndex, maxRows, 1).setNumberFormat('@');
    }
  });

  return {
    success: true,
    message: 'Format kolom teks OrthoRecall berhasil dikunci',
    columns: textColumns
  };
}

/* =========================================================
   PHASE 4D MANUAL TESTS
   OrthoRecallService read-only -> OrthoRecallRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testOrthoRecallServiceReadLog() {
  const result = {
    success: true,
    stage: '6G-OrthoRecallService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getOrthoRecallServiceUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    probe: {}
  };

  try {
    const opts = getOrthoRecallServiceUiReadOptions_();

    const raw = getOrthoRecallRaw(opts);
    const listRes = getOrthoRecallList(opts);

    result.probe.recall_count = Array.isArray(raw) ? raw.length : -1;
    result.probe.list_success = !!(listRes && listRes.success);
    result.probe.list_count = listRes && Array.isArray(listRes.data) ? listRes.data.length : -1;

    if (!Array.isArray(raw)) {
      result.issues.push({ issue: 'ORTHO_RECALL_RAW_NOT_ARRAY' });
    }

    if (!listRes || !listRes.success || !Array.isArray(listRes.data)) {
      result.issues.push({ issue: 'ORTHO_RECALL_LIST_FAILED' });
    }

    const firstRecall = raw.length ? raw[0] : null;
    const recallId = firstRecall ? String(firstRecall.ortho_recall_id || '').trim() : '';
    const patientId = firstRecall ? String(firstRecall.patient_id || '').trim() : '';

    result.probe.first_recall_id = recallId;
    result.probe.first_patient_id = patientId;

    if (!recallId) {
      result.issues.push({ issue: 'NO_RECALL_SAMPLE_AVAILABLE' });
    }

    if (recallId) {
      const found = findOrthoRecallById(recallId, opts);
      const detail = getOrthoRecallById(recallId, opts);

      result.probe.find_success = !!found;
      result.probe.detail_success = !!(detail && detail.success);

      if (!found) {
        result.issues.push({
          ortho_recall_id: recallId,
          issue: 'FIND_RECALL_FAILED'
        });
      }

      if (!detail || !detail.success) {
        result.issues.push({
          ortho_recall_id: recallId,
          issue: 'GET_RECALL_BY_ID_FAILED'
        });
      }
    }

    if (patientId) {
      const rowsByPatient = getOrthoRecallRowsByPatientId(patientId, opts);
      const active = findActiveOrthoRecallByPatientId(patientId, opts);
      const summary = getPatientOrthoRecallSummary(patientId, opts);

      result.probe.recall_by_patient_count = Array.isArray(rowsByPatient) ? rowsByPatient.length : -1;
      result.probe.has_active_recall = !!active;
      result.probe.summary_success = !!(summary && summary.success);

      if (!Array.isArray(rowsByPatient)) {
        result.issues.push({
          patient_id: patientId,
          issue: 'RECALL_BY_PATIENT_NOT_ARRAY'
        });
      }

      if (!summary || !summary.success) {
        result.issues.push({
          patient_id: patientId,
          issue: 'PATIENT_RECALL_SUMMARY_FAILED'
        });
      }
    }

    const refreshProbe = refreshAllOrthoRecallStatuses(opts);

    result.probe.refresh_skipped_in_supabase = !!(
      refreshProbe &&
      refreshProbe.skipped === true
    );

    if (isOrthoRecallServiceUiReadSupabaseMode_(opts) && !result.probe.refresh_skipped_in_supabase) {
      result.issues.push({
        issue: 'REFRESH_NOT_SKIPPED_IN_SUPABASE_READ_MODE'
      });
    }

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.ORTHO_RECALL, {
        ortho_recall_id: 'TEST-SHOULD-NOT-INSERT'
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
      stage: '6G-OrthoRecallService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-6-OrthoRecallService-FreezeGuard',
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
      default_off_save_contact_normal_flow_reached: false,
      default_off_complete_normal_flow_reached: false,
      default_off_cancel_normal_flow_reached: false,
      simulated_freeze_save_contact_blocked: false,
      simulated_freeze_complete_blocked: false,
      simulated_freeze_cancel_blocked: false,
      simulated_freeze_refresh_blocked: false,
      simulated_freeze_sync_phones_blocked: false,
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

  function getCounts_() {
    return {
      ortho_recalls: getOrthoRecallRaw({
        backend_mode: 'spreadsheet'
      }).length
    };
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );
  }

  try {
    result.before_counts = getCounts_();

    if (
      result.flags.default_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_supabase_test_enabled !== false ||
      result.flags.supabase_staging_write_test_enabled !== false ||
      result.flags.production_mutation_freeze_enabled !== false
    ) {
      addIssue('FLAGS_NOT_SAFE_DEFAULT_OFF', result.flags);
    }

    const defaultOffSaveContact = saveOrthoRecallContact({
      ortho_recall_id: '',
      last_contact_note: ''
    });

    result.messages.default_off_save_contact = defaultOffSaveContact && defaultOffSaveContact.message
      ? defaultOffSaveContact.message
      : '';

    result.checks.default_off_save_contact_normal_flow_reached = !!(
      defaultOffSaveContact &&
      defaultOffSaveContact.success === false &&
      (
        defaultOffSaveContact.message === 'Recall ID tidak ditemukan' ||
        defaultOffSaveContact.message === 'Data recall tidak ditemukan'
      )
    );

    if (!result.checks.default_off_save_contact_normal_flow_reached) {
      addIssue('DEFAULT_OFF_SAVE_CONTACT_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffSaveContact
      });
    }

    const defaultOffComplete = completeOrthoRecallProgram({
      ortho_recall_id: '',
      reason: ''
    });

    result.messages.default_off_complete = defaultOffComplete && defaultOffComplete.message
      ? defaultOffComplete.message
      : '';

    result.checks.default_off_complete_normal_flow_reached = !!(
      defaultOffComplete &&
      defaultOffComplete.success === false &&
      (
        defaultOffComplete.message === 'Recall ID tidak ditemukan' ||
        defaultOffComplete.message === 'Data recall tidak ditemukan'
      )
    );

    if (!result.checks.default_off_complete_normal_flow_reached) {
      addIssue('DEFAULT_OFF_COMPLETE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffComplete
      });
    }

    const defaultOffCancel = cancelOrthoRecallProgram({
      ortho_recall_id: '',
      reason: ''
    });

    result.messages.default_off_cancel = defaultOffCancel && defaultOffCancel.message
      ? defaultOffCancel.message
      : '';

    result.checks.default_off_cancel_normal_flow_reached = !!(
      defaultOffCancel &&
      defaultOffCancel.success === false &&
      (
        defaultOffCancel.message === 'Recall ID tidak ditemukan' ||
        defaultOffCancel.message === 'Data recall tidak ditemukan'
      )
    );

    if (!result.checks.default_off_cancel_normal_flow_reached) {
      addIssue('DEFAULT_OFF_CANCEL_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffCancel
      });
    }

    const simulatedFreezeSaveContact = saveOrthoRecallContact({
      __test_freeze_enabled: true,
      ortho_recall_id: 'ORC-20260424-153834842-468',
      last_contact_note: 'SHOULD NOT WRITE'
    });

    result.messages.simulated_freeze_save_contact = simulatedFreezeSaveContact && simulatedFreezeSaveContact.message
      ? simulatedFreezeSaveContact.message
      : '';

    result.checks.simulated_freeze_save_contact_blocked = isFreezeMessage_(simulatedFreezeSaveContact);

    if (!result.checks.simulated_freeze_save_contact_blocked) {
      addIssue('SIMULATED_FREEZE_SAVE_CONTACT_NOT_BLOCKED', {
        response: simulatedFreezeSaveContact
      });
    }

    const simulatedFreezeComplete = completeOrthoRecallProgram({
      __test_freeze_enabled: true,
      ortho_recall_id: 'ORC-20260424-153834842-468',
      reason: 'SHOULD NOT WRITE'
    });

    result.messages.simulated_freeze_complete = simulatedFreezeComplete && simulatedFreezeComplete.message
      ? simulatedFreezeComplete.message
      : '';

    result.checks.simulated_freeze_complete_blocked = isFreezeMessage_(simulatedFreezeComplete);

    if (!result.checks.simulated_freeze_complete_blocked) {
      addIssue('SIMULATED_FREEZE_COMPLETE_NOT_BLOCKED', {
        response: simulatedFreezeComplete
      });
    }

    const simulatedFreezeCancel = cancelOrthoRecallProgram({
      __test_freeze_enabled: true,
      ortho_recall_id: 'ORC-20260424-153834842-468',
      reason: 'SHOULD NOT WRITE'
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

    const simulatedFreezeRefresh = refreshAllOrthoRecallStatuses({
      __test_freeze_enabled: true
    });

    result.messages.simulated_freeze_refresh = simulatedFreezeRefresh && simulatedFreezeRefresh.message
      ? simulatedFreezeRefresh.message
      : '';

    result.checks.simulated_freeze_refresh_blocked = isFreezeMessage_(simulatedFreezeRefresh);

    if (!result.checks.simulated_freeze_refresh_blocked) {
      addIssue('SIMULATED_FREEZE_REFRESH_NOT_BLOCKED', {
        response: simulatedFreezeRefresh
      });
    }

    const simulatedFreezeSyncPhones = syncOrthoRecallPhonesFromPatients({
      __test_freeze_enabled: true
    });

    result.messages.simulated_freeze_sync_phones = simulatedFreezeSyncPhones && simulatedFreezeSyncPhones.message
      ? simulatedFreezeSyncPhones.message
      : '';

    result.checks.simulated_freeze_sync_phones_blocked = isFreezeMessage_(simulatedFreezeSyncPhones);

    if (!result.checks.simulated_freeze_sync_phones_blocked) {
      addIssue('SIMULATED_FREEZE_SYNC_PHONES_NOT_BLOCKED', {
        response: simulatedFreezeSyncPhones
      });
    }

    result.after_counts = getCounts_();

    result.checks.counts_unchanged =
      result.after_counts.ortho_recalls === result.before_counts.ortho_recalls;

    if (!result.checks.counts_unchanged) {
      addIssue('ORTHO_RECALL_COUNT_CHANGED_DURING_FREEZE_GUARD_TEST', {
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
      stage: '8B-6-OrthoRecallService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'ORTHO_RECALL_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}