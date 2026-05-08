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
  return {
    backend_mode: 'spreadsheet'
  };
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

  // Pakai helper yang sudah kita punya di PatientService.gs
  if (typeof forceSheetText === 'function') {
    return forceSheetText(phone);
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

  const normalized = normalizeOrthoRecallRow(row);
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
    total_records: getOrthoRecallRowsByPatientId(normalized.patient_id, options).length,
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
  const row = findOrthoRecallById(orthoRecallId, options);

  if (!row) {
    return {
      success: false,
      message: 'Data recall tidak ditemukan'
    };
  }

  return {
    success: true,
    data: normalizeOrthoRecallRow(row)
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
    last_control_date: '',
    next_due_date: nextDueDate,
    control_count: 0,
    program_status: 'active',
    followup_status: calculateOrthoFollowupStatus(nextDueDate, installDate, targetMonths, 'active'),
    target_months: targetMonths,
    completed_at: '',
    last_contact_date: '',
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
    completed_at: '',
    last_contact_date: '',
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
  appendObject('OrthoRecall', record);
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
  appendObject('OrthoRecall', record);
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

  const ok = updateObjectById('OrthoRecall', 'ortho_recall_id', existing.ortho_recall_id, updated);

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

  const ok = updateObjectById('OrthoRecall', 'ortho_recall_id', orthoRecallId, updated);

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

  const ok = updateObjectById('OrthoRecall', 'ortho_recall_id', orthoRecallId, updated);

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
    completed_at: '',
    notes: buildOrthoRecallProgramNote(existing.notes, 'Program cancelled', reason),
    updated_at: nowIso()
  };

  const ok = updateObjectById('OrthoRecall', 'ortho_recall_id', orthoRecallId, updated);

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
  if (isOrthoRecallServiceUiReadSupabaseMode_(options)) {
    return {
      success: true,
      message: 'Refresh status recall dilewati pada mode Supabase read-only',
      updated_count: 0,
      skipped: true
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
      updateObjectById('OrthoRecall', 'ortho_recall_id', orthoRecallId, {
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

  const rows = getOrthoRecallRaw(opts)
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

function syncOrthoRecallPhonesFromPatients() {
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

    updateObjectById('OrthoRecall', 'ortho_recall_id', recallId, {
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

function testSyncOrthoRecallPhonesFromPatients() {
  Logger.log(JSON.stringify(syncOrthoRecallPhonesFromPatients()));
}

function testCreateOrthoRecallFromInstall() {
  Logger.log(JSON.stringify(createOrthoRecallFromInstall({
    patient_id: 'PAT-TEST',
    patient_name: 'Pasien Test',
    phone: '08123456789',
    treatment_id: 'TRX-TEST-INSTALL',
    treatment_date: getTodayYmdServer(),
    target_months: 6
  })));
}

function testGetOrthoRecallList() {
  Logger.log(JSON.stringify(getOrthoRecallList()));
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

function testAuditOrthoRecallDataHealth() {
  Logger.log(JSON.stringify(auditOrthoRecallDataHealth(), null, 2));
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

function testAuditOrthoRecallRawPhoneStorage() {
  Logger.log(JSON.stringify(auditOrthoRecallRawPhoneStorage(), null, 2));
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

function testHardenOrthoRecallTextColumns() {
  Logger.log(JSON.stringify(hardenOrthoRecallTextColumns(), null, 2));
}

/* =========================================================
   PHASE 4D MANUAL TESTS
   OrthoRecallService read-only -> OrthoRecallRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testOrthoRecallServicePhase4DReadOnlyBridge() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    counts: {},
    sample: {}
  };

  try {
    if (
      typeof OrthoRecallRepository === 'undefined' ||
      !OrthoRecallRepository
    ) {
      result.issues.push({
        issue: 'ORTHO_RECALL_REPOSITORY_NOT_FOUND'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperRows = getOrthoRecallRaw();
    const repoRows = OrthoRecallRepository.getOrthoRecallRaw();

    result.counts.wrapper_ortho_recall = Array.isArray(wrapperRows)
      ? wrapperRows.length
      : -1;

    result.counts.repository_ortho_recall = Array.isArray(repoRows)
      ? repoRows.length
      : -1;

    if (!Array.isArray(wrapperRows)) {
      result.issues.push({
        issue: 'WRAPPER_ORTHO_RECALL_NOT_ARRAY'
      });
    }

    if (!Array.isArray(repoRows)) {
      result.issues.push({
        issue: 'REPOSITORY_ORTHO_RECALL_NOT_ARRAY'
      });
    }

    if (result.counts.wrapper_ortho_recall !== result.counts.repository_ortho_recall) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_ortho_recall,
        repository_count: result.counts.repository_ortho_recall,
        issue: 'ORTHO_RECALL_COUNT_MISMATCH'
      });
    }

    const firstRecall = wrapperRows.length ? wrapperRows[0] : null;
    const recallId = firstRecall
      ? String(firstRecall.ortho_recall_id || '').trim()
      : '';

    const patientId = firstRecall
      ? String(firstRecall.patient_id || '').trim()
      : '';

    result.sample.first_recall_id = recallId;
    result.sample.first_patient_id = patientId;

    if (!recallId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada OrthoRecall untuk sample bridge test';

      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperRecall = findOrthoRecallById(recallId);
    const repoRecall = OrthoRecallRepository.findOrthoRecallById(recallId);

    result.sample.wrapper_find_recall_ok = !!wrapperRecall;
    result.sample.repository_find_recall_ok = !!repoRecall;

    if (!wrapperRecall || !repoRecall) {
      result.issues.push({
        ortho_recall_id: recallId,
        issue: 'FIND_RECALL_FAILED'
      });
    }

    if (patientId) {
      const wrapperRowsByPatient = getOrthoRecallRowsByPatientId(patientId);
      const repoRowsByPatient = OrthoRecallRepository.listRecallByPatientId(patientId);

      const wrapperActive = findActiveOrthoRecallByPatientId(patientId);
      const repoActive = OrthoRecallRepository.findActiveRecallByPatientId(patientId);

      result.sample.wrapper_recall_by_patient_count = wrapperRowsByPatient.length;
      result.sample.repository_recall_by_patient_count = repoRowsByPatient.length;
      result.sample.wrapper_has_active_recall = !!wrapperActive;
      result.sample.repository_has_active_recall = !!repoActive;

      if (wrapperRowsByPatient.length !== repoRowsByPatient.length) {
        result.issues.push({
          patient_id: patientId,
          wrapper_count: wrapperRowsByPatient.length,
          repository_count: repoRowsByPatient.length,
          issue: 'RECALL_BY_PATIENT_COUNT_MISMATCH'
        });
      }

      if (!!wrapperActive !== !!repoActive) {
        result.issues.push({
          patient_id: patientId,
          wrapper_has_active: !!wrapperActive,
          repository_has_active: !!repoActive,
          issue: 'ACTIVE_RECALL_MISMATCH'
        });
      }

      if (wrapperActive && repoActive) {
        const wrapperActiveId = String(wrapperActive.ortho_recall_id || '').trim();
        const repoActiveId = String(repoActive.ortho_recall_id || '').trim();

        if (wrapperActiveId !== repoActiveId) {
          result.issues.push({
            patient_id: patientId,
            wrapper_active_id: wrapperActiveId,
            repository_active_id: repoActiveId,
            issue: 'ACTIVE_RECALL_ID_MISMATCH'
          });
        }
      }
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallServicePhase4DSummarySample() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const rows = getOrthoRecallRaw();
    const firstRecall = rows.length ? rows[0] : null;

    const patientId = firstRecall
      ? String(firstRecall.patient_id || '').trim()
      : '';

    result.sample.recall_count = rows.length;
    result.sample.first_patient_id = patientId;

    if (!patientId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada patient_id pada OrthoRecall untuk summary sample test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const preferredRow = getPreferredOrthoRecallRowByPatientId(patientId);
    const summaryRes = getPatientOrthoRecallSummary(patientId);

    result.sample.preferred_row_ok = !!preferredRow;
    result.sample.summary_ok = !!(
      summaryRes &&
      summaryRes.success === true &&
      summaryRes.data
    );

    if (!result.sample.preferred_row_ok) {
      result.issues.push({
        patient_id: patientId,
        issue: 'PREFERRED_RECALL_ROW_NOT_FOUND'
      });
    }

    if (!result.sample.summary_ok) {
      result.issues.push({
        patient_id: patientId,
        issue: 'PATIENT_ORTHO_RECALL_SUMMARY_FAILED'
      });
    }

    if (summaryRes && summaryRes.data) {
      const summary = summaryRes.data || {};

      result.sample.has_recall = !!summary.has_recall;
      result.sample.has_active_program = !!summary.has_active_program;
      result.sample.total_records = Number(summary.total_records || 0);
      result.sample.has_current = !!summary.current;

      if (!summary.has_recall || !summary.current) {
        result.issues.push({
          patient_id: patientId,
          issue: 'SUMMARY_CURRENT_RECALL_MISSING'
        });
      }

      const repoRowsByPatient = OrthoRecallRepository.listRecallByPatientId(patientId);

      if (Number(summary.total_records || 0) !== repoRowsByPatient.length) {
        result.issues.push({
          patient_id: patientId,
          summary_total_records: Number(summary.total_records || 0),
          repository_count: repoRowsByPatient.length,
          issue: 'SUMMARY_TOTAL_RECORDS_MISMATCH'
        });
      }
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallServicePhase4DGetByIdSample() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const rows = getOrthoRecallRaw();
    const firstRecall = rows.length ? rows[0] : null;

    const recallId = firstRecall
      ? String(firstRecall.ortho_recall_id || '').trim()
      : '';

    result.sample.recall_count = rows.length;
    result.sample.first_recall_id = recallId;

    if (!recallId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada OrthoRecall untuk getById sample test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const res = getOrthoRecallById(recallId);

    result.sample.get_by_id_ok = !!(
      res &&
      res.success === true &&
      res.data &&
      String(res.data.ortho_recall_id || '').trim() === recallId
    );

    if (!result.sample.get_by_id_ok) {
      result.issues.push({
        ortho_recall_id: recallId,
        issue: 'GET_ORTHO_RECALL_BY_ID_FAILED'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallServicePhase4DRegressionPack() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    tests: []
  };

  try {
    const testList = [
      {
        name: 'testOrthoRecallRepositoryPhase4CReadOnly',
        fn: typeof testOrthoRecallRepositoryPhase4CReadOnly === 'function'
          ? testOrthoRecallRepositoryPhase4CReadOnly
          : null
      },
      {
        name: 'testOrthoRecallRepositoryPhase4CBuildRawContext',
        fn: typeof testOrthoRecallRepositoryPhase4CBuildRawContext === 'function'
          ? testOrthoRecallRepositoryPhase4CBuildRawContext
          : null
      },
      {
        name: 'testOrthoRecallRepositoryPhase4CFindRecallSample',
        fn: typeof testOrthoRecallRepositoryPhase4CFindRecallSample === 'function'
          ? testOrthoRecallRepositoryPhase4CFindRecallSample
          : null
      },
      {
        name: 'testOrthoRecallRepositoryPhase4CContextFinderSample',
        fn: typeof testOrthoRecallRepositoryPhase4CContextFinderSample === 'function'
          ? testOrthoRecallRepositoryPhase4CContextFinderSample
          : null
      },
      {
        name: 'testOrthoRecallServicePhase4DReadOnlyBridge',
        fn: typeof testOrthoRecallServicePhase4DReadOnlyBridge === 'function'
          ? testOrthoRecallServicePhase4DReadOnlyBridge
          : null
      },
      {
        name: 'testOrthoRecallServicePhase4DSummarySample',
        fn: typeof testOrthoRecallServicePhase4DSummarySample === 'function'
          ? testOrthoRecallServicePhase4DSummarySample
          : null
      },
      {
        name: 'testOrthoRecallServicePhase4DGetByIdSample',
        fn: typeof testOrthoRecallServicePhase4DGetByIdSample === 'function'
          ? testOrthoRecallServicePhase4DGetByIdSample
          : null
      }
    ];

    testList.forEach(function(item) {
      if (!item.fn) {
        result.tests.push({
          name: item.name,
          success: false,
          issue_count: 1,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        result.issues.push({
          test: item.name,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        return;
      }

      const testResult = item.fn();
      const success = !!(testResult && testResult.success === true);
      const issueCount = testResult && testResult.issue_count !== undefined
        ? Number(testResult.issue_count || 0)
        : (success ? 0 : 1);

      result.tests.push({
        name: item.name,
        success: success,
        issue_count: issueCount
      });

      if (!success || issueCount > 0) {
        result.issues.push({
          test: item.name,
          success: success,
          issue_count: issueCount,
          issue: 'REGRESSION_TEST_FAILED'
        });
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallServicePhase6GUiReadLog() {
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