/* =========================================================
   PHASE 4F - TREATMENT REPOSITORY BRIDGE HELPERS
   Read-only bridge. Backend tetap Spreadsheet.
   ========================================================= */

function isTreatmentRepositoryBridgeAvailable_() {
  return typeof TreatmentRepository !== 'undefined' &&
    TreatmentRepository &&
    typeof TreatmentRepository.getTreatmentsRaw === 'function';
}

function getTreatmentServiceUiReadOptions_(options) {
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

function getTreatmentServiceUiReadBackendMode_(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function getTreatmentServiceSpreadsheetWriteReadOptions_() {
  return {
    backend_mode: 'spreadsheet'
  };
}

function getTreatmentsRaw(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.getTreatmentsRaw === 'function'
  ) {
    return TreatmentRepository.getTreatmentsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.TREATMENTS || 'Treatments', opts) || [];
  }

  return getRowsAsObjects('Treatments') || [];
}

function getTreatmentItemsRaw(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.getTreatmentItemsRaw === 'function'
  ) {
    return TreatmentRepository.getTreatmentItemsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.TREATMENT_ITEMS || 'TreatmentItems', opts) || [];
  }

  return getRowsAsObjects('TreatmentItems') || [];
}

function getMedicalRecordsRaw(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.getMedicalRecordsRaw === 'function'
  ) {
    return TreatmentRepository.getMedicalRecordsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.MEDICAL_RECORDS || 'MedicalRecords', opts) || [];
  }

  return getRowsAsObjects('MedicalRecords') || [];
}

function generateNextTreatmentId() {
  return generateSafeId('TRX');
}

function generateNextTreatmentItemId() {
  return generateSafeId('TRI');
}

function generateNextMedicalRecordId() {
  return generateSafeId('MRD');
}

function normalizeTreatmentRow(row) {
  const obj = {};
  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });
  return obj;
}

function getTreatmentByAppointmentId(appointmentId, options) {
  const normalizedAppointmentId = String(appointmentId || '').trim();
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (!normalizedAppointmentId) {
    return {
      success: false,
      message: 'Appointment ID tidak ditemukan'
    };
  }

  let treatment = null;
  let items = [];

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.findTreatmentByAppointmentId === 'function' &&
    typeof TreatmentRepository.listTreatmentItemsByTreatmentId === 'function'
  ) {
    treatment = TreatmentRepository.findTreatmentByAppointmentId(normalizedAppointmentId, opts);
  } else {
    treatment = getTreatmentsRaw(opts).find(function(row) {
      return String(row.appointment_id || '').trim() === normalizedAppointmentId;
    }) || null;
  }

  if (!treatment) {
    return {
      success: false,
      message: 'Treatment belum ada untuk appointment ini'
    };
  }

  const treatmentId = String(treatment.treatment_id || '').trim();

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.listTreatmentItemsByTreatmentId === 'function'
  ) {
    items = TreatmentRepository.listTreatmentItemsByTreatmentId(treatmentId, opts);
  } else {
    items = getTreatmentItemsRaw(opts).filter(function(row) {
      return String(row.treatment_id || '').trim() === treatmentId;
    });
  }

  return {
    success: true,
    data: {
      treatment: normalizeTreatmentRow(treatment),
      items: items.map(function(row) {
        return normalizeTreatmentRow(row);
      })
    }
  };
}

function getActiveDoctors(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);
  let users = [];

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.listActiveDoctors === 'function'
  ) {
    users = TreatmentRepository.listActiveDoctors(opts) || [];
  } else if (typeof dbFindAll_ === 'function') {
    users = (dbFindAll_(REPO_TABLES.USERS || 'Users', opts) || []).filter(function(row) {
      const role = String(row.role || '').trim().toLowerCase();
      const isActive = String(row.is_active || '').trim().toLowerCase() !== 'false';

      return role === 'dokter' && isActive;
    });
  } else {
    users = (getRowsAsObjects('Users') || []).filter(function(row) {
      const role = String(row.role || '').trim().toLowerCase();
      const isActive = String(row.is_active || '').trim().toLowerCase() !== 'false';

      return role === 'dokter' && isActive;
    });
  }

  const doctors = users.map(function(row) {
    return {
      user_id: String(row.user_id || '').trim(),
      username: String(row.username || '').trim(),
      full_name: String(row.full_name || '').trim()
    };
  });

  return {
    success: true,
    data: doctors
  };
}

function findActiveDoctorById(userId, options) {
  const normalizedUserId = String(userId || '').trim();
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (!normalizedUserId) return null;

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.findActiveDoctorById === 'function'
  ) {
    return TreatmentRepository.findActiveDoctorById(normalizedUserId, opts) || null;
  }

  const users = typeof dbFindAll_ === 'function'
    ? dbFindAll_(REPO_TABLES.USERS || 'Users', opts)
    : (getRowsAsObjects('Users') || []);

  return users.find(function(row) {
    return String(row.user_id || '').trim() === normalizedUserId &&
      String(row.role || '').trim().toLowerCase() === 'dokter' &&
      String(row.is_active || '').trim().toLowerCase() !== 'false';
  }) || null;
}

function getTreatmentServiceActiveServices_(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (
    typeof MasterDataRepository !== 'undefined' &&
    MasterDataRepository &&
    typeof MasterDataRepository.listActiveServices === 'function'
  ) {
    return {
      success: true,
      data: (MasterDataRepository.listActiveServices(opts) || []).map(function(row) {
        return Object.assign({}, row);
      })
    };
  }

  if (typeof getActiveServices === 'function') {
    return getActiveServices();
  }

  return {
    success: false,
    message: 'Master data service tidak tersedia'
  };
}

function getTreatmentServiceById_(serviceId, options) {
  const opts = getTreatmentServiceUiReadOptions_(options);
  const normalizedServiceId = String(serviceId || '').trim();

  if (!normalizedServiceId) {
    return {
      success: false,
      message: 'Service ID tidak ditemukan'
    };
  }

  if (
    typeof MasterDataRepository !== 'undefined' &&
    MasterDataRepository &&
    typeof MasterDataRepository.findServiceById === 'function'
  ) {
    const service = MasterDataRepository.findServiceById(normalizedServiceId, opts);

    if (!service) {
      return {
        success: false,
        message: 'Layanan tidak ditemukan'
      };
    }

    return {
      success: true,
      data: service
    };
  }

  if (typeof getServiceById === 'function') {
    return getServiceById(normalizedServiceId);
  }

  return {
    success: false,
    message: 'Master data service tidak tersedia'
  };
}

function isTreatmentManagerRole(actorRole) {
  const role = String(actorRole || '').trim().toLowerCase();
  return role === 'admin' || role === 'owner';
}

function rejectTreatmentAccess() {
  return {
    success: false,
    message: 'Hanya admin atau owner yang dapat menginput treatment'
  };
}

function validateTreatmentPayload(payload) {
  const errors = {};

  if (!payload.appointment_id || !String(payload.appointment_id).trim()) {
    errors.appointment_id = 'Appointment wajib dipilih';
  }

  if (!payload.patient_id || !String(payload.patient_id).trim()) {
    errors.patient_id = 'Patient ID tidak ditemukan';
  }

  if (!payload.patient_name || !String(payload.patient_name).trim()) {
    errors.patient_name = 'Nama pasien tidak ditemukan';
  }

  if (!payload.doctor_user_id || !String(payload.doctor_user_id).trim()) {
    errors.doctor_user_id = 'Dokter wajib dipilih';
  }

  if (!payload.doctor_name || !String(payload.doctor_name).trim()) {
    errors.doctor_name = 'Nama dokter wajib diisi';
  }

  if (!payload.treatment_date || !String(payload.treatment_date).trim()) {
    errors.treatment_date = 'Tanggal treatment wajib diisi';
  } else if (!isValidYmdDate(String(payload.treatment_date).trim())) {
    errors.treatment_date = 'Tanggal treatment tidak valid';
  }

  if (!payload.chief_complaint || !String(payload.chief_complaint).trim()) {
    errors.chief_complaint = 'Keluhan utama wajib diisi';
  }

  if (!payload.diagnosis || !String(payload.diagnosis).trim()) {
    errors.diagnosis = 'Diagnosis wajib diisi';
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.items = 'Minimal satu tindakan wajib dipilih';
  } else {
    const itemErrors = [];

    payload.items.forEach(function(item, index) {
      const err = {};

      if (!item.service_id || !String(item.service_id).trim()) {
        err.service_id = 'Tindakan wajib dipilih';
      }

      const qty = Number(item.qty || 0);
      if (!qty || qty <= 0) {
        err.qty = 'Qty harus lebih dari 0';
      }

      if (Object.keys(err).length > 0) {
        itemErrors[index] = err;
      }
    });

    if (itemErrors.length > 0) {
      errors.item_details = itemErrors;
    }
  }

  return errors;
}

function getServicePrice(serviceId, options) {
  const serviceRes = getTreatmentServiceById_(serviceId, options);

  if (!serviceRes.success) {
    return serviceRes;
  }

  const service = serviceRes.data;
  return {
    success: true,
    data: {
      service_id: String(service.service_id || '').trim(),
      service_name: String(service.service_name || '').trim(),
      default_price: Number(service.default_price || 0),
      is_ortho_install: !!service.is_ortho_install,
      is_ortho_control: !!service.is_ortho_control
    }
  };
}

function getOrthoModeFromTreatmentItems(items) {
  let hasInstall = false;
  let hasControl = false;

  (items || []).forEach(function(item) {
    if (item.is_ortho_install) hasInstall = true;
    if (item.is_ortho_control) hasControl = true;
  });

  if (hasInstall && hasControl) return 'mixed';
  if (hasInstall) return 'install';
  if (hasControl) return 'control';
  return 'none';
}

function validateOrthoTreatmentBeforeSave(patientId, orthoMode, options) {
  const normalizedMode = String(orthoMode || '').trim().toLowerCase();
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (normalizedMode === 'mixed') {
    return {
      success: false,
      message: 'Treatment ortho tidak boleh mencampur layanan pasang behel dan kontrol behel dalam satu transaksi'
    };
  }

  if (normalizedMode === 'install') {
    const existingRecall = findActiveOrthoRecallByPatientId(patientId, opts);

    if (existingRecall) {
      return {
        success: false,
        message: 'Pasien ini sudah memiliki recall ortho aktif. Selesaikan program sebelumnya sebelum membuat pemasangan baru.'
      };
    }
  }

  return {
    success: true
  };
}

function buildOrthoRecallPayloadFromTreatment(treatment, patient) {
  return {
    patient_id: String(treatment.patient_id || '').trim(),
    patient_name: String(treatment.patient_name || '').trim(),
    phone: String((patient && patient.phone) || '').trim(),
    treatment_id: String(treatment.treatment_id || '').trim(),
    treatment_date: String(treatment.treatment_date || '').trim(),
    target_months: 6
  };
}

function syncOrthoRecallAfterTreatment(orthoMode, treatment, patient) {
  const normalizedMode = String(orthoMode || '').trim().toLowerCase();

  if (normalizedMode === 'none') {
    return {
      success: true,
      message: 'Tidak ada sinkronisasi recall'
    };
  }

  const payload = buildOrthoRecallPayloadFromTreatment(treatment, patient);

  if (normalizedMode === 'install') {
    return createOrthoRecallFromInstall(payload);
  }

  if (normalizedMode === 'control') {
    return upsertOrthoRecallFromControl(payload);
  }

  return {
    success: false,
    message: 'Mode ortho tidak valid'
  };
}

function createTreatment(payload) {
  const lock = LockService.getScriptLock();
  const writeReadOptions = getTreatmentServiceSpreadsheetWriteReadOptions_();

  try {
    lock.waitLock(5000);

    if (!isTreatmentManagerRole(payload.actor_role)) {
      return rejectTreatmentAccess();
    }

    const errors = validateTreatmentPayload(payload);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    const appointment = findAppointmentRawById(payload.appointment_id, writeReadOptions);
    if (!appointment) {
      return {
        success: false,
        message: 'Appointment tidak ditemukan'
      };
    }

    if (String(appointment.patient_id || '').trim() !== String(payload.patient_id || '').trim()) {
      return {
        success: false,
        message: 'Patient pada treatment tidak sesuai dengan appointment'
      };
    }

    const doctor = findActiveDoctorById(payload.doctor_user_id, writeReadOptions);
    if (!doctor) {
      return {
        success: false,
        message: 'Dokter tidak valid atau tidak aktif'
      };
    }

    const appointmentStatus = String(appointment.status || '').trim().toLowerCase();
    if (appointmentStatus !== 'scheduled') {
      return {
        success: false,
        message: 'Treatment hanya bisa dibuat dari appointment berstatus scheduled'
      };
    }

    const existingTreatment = getTreatmentsRaw(writeReadOptions).find(function(row) {
      return String(row.appointment_id || '') === String(payload.appointment_id || '');
    });

    if (existingTreatment) {
      return {
        success: false,
        message: 'Treatment untuk appointment ini sudah ada'
      };
    }

    const patient = findPatientRawById(payload.patient_id, writeReadOptions);
    if (!patient) {
      return {
        success: false,
        message: 'Data pasien tidak ditemukan'
      };
    }

    const treatmentId = generateNextTreatmentId();

    const normalizedItems = [];
    const itemErrors = [];

    for (var i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];
      const serviceId = String(item.service_id || '').trim();
      const qty = Number(item.qty || 0);

      const serviceRes = getServicePrice(serviceId, writeReadOptions);
      if (!serviceRes.success) {
        itemErrors[i] = { service_id: serviceRes.message || 'Layanan tidak ditemukan' };
        continue;
      }

      const service = serviceRes.data;
      const unitPrice = Number(service.default_price || 0);
      const subtotal = qty * unitPrice;

      normalizedItems.push({
        treatment_item_id: generateNextTreatmentItemId(),
        treatment_id: treatmentId,
        service_id: service.service_id,
        service_name: service.service_name,
        qty: qty,
        unit_price: unitPrice,
        subtotal: subtotal,
        is_ortho_install: !!service.is_ortho_install,
        is_ortho_control: !!service.is_ortho_control,
        created_at: nowIso(),
        updated_at: nowIso()
      });
    }

    if (itemErrors.length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: {
          item_details: itemErrors
        }
      };
    }

    const orthoMode = getOrthoModeFromTreatmentItems(normalizedItems);
    const orthoValidation = validateOrthoTreatmentBeforeSave(
      payload.patient_id,
      orthoMode,
      writeReadOptions
    );

    if (!orthoValidation.success) {
      return {
        success: false,
        message: orthoValidation.message || 'Validasi ortho gagal'
      };
    }

    const totalCost = normalizedItems.reduce(function(sum, item) {
      return sum + Number(item.subtotal || 0);
    }, 0);

    const treatment = {
      treatment_id: treatmentId,
      appointment_id: String(payload.appointment_id || '').trim(),
      patient_id: String(payload.patient_id || '').trim(),
      patient_name: String(payload.patient_name || '').trim(),
      doctor_name: String(payload.doctor_name || '').trim(),
      treatment_date: String(payload.treatment_date || '').trim(),
      chief_complaint: String(payload.chief_complaint || '').trim(),
      diagnosis: String(payload.diagnosis || '').trim(),
      notes: String(payload.notes || '').trim(),
      total_cost: totalCost,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    appendObject('Treatments', treatment);

    normalizedItems.forEach(function(item) {
      appendObject('TreatmentItems', item);
    });

    const medicalRecord = {
      record_id: generateNextMedicalRecordId(),
      patient_id: String(payload.patient_id || '').trim(),
      patient_name: String(payload.patient_name || '').trim(),
      appointment_id: String(payload.appointment_id || '').trim(),
      treatment_id: treatmentId,
      doctor_name: String(payload.doctor_name || '').trim(),
      visit_date: String(payload.treatment_date || '').trim(),
      chief_complaint: String(payload.chief_complaint || '').trim(),
      diagnosis: String(payload.diagnosis || '').trim(),
      clinical_notes: String(payload.notes || '').trim(),
      created_at: nowIso()
    };

    appendObject('MedicalRecords', medicalRecord);

    updateObjectById('Appointments', 'appointment_id', payload.appointment_id, {
      status: 'completed',
      updated_at: nowIso()
    });

    if (orthoMode !== 'none') {
      const orthoSyncRes = syncOrthoRecallAfterTreatment(orthoMode, treatment, patient);

      if (!orthoSyncRes.success) {
        return {
          success: false,
          message: orthoSyncRes.message || 'Treatment tersimpan, tetapi sinkronisasi recall ortho gagal'
        };
      }
    }

    const billingRes = createDraftBillingFromTreatment(treatment, normalizedItems, {
      use_lock: false,
      internal_call: true
    });

    if (!billingRes || !billingRes.success) {
      return {
        success: false,
        message: (billingRes && billingRes.message) || 'Treatment tersimpan, tetapi draft billing gagal dibuat'
      };
    }

    clearAppointmentsListCache();
    clearPatientDetailBundleCache(payload.patient_id);

    return {
      success: true,
      message: 'Treatment berhasil disimpan dan draft billing berhasil dibuat',
      data: {
        treatment: normalizeTreatmentRow(treatment),
        items: normalizedItems.map(function(item) {
          return normalizeTreatmentRow(item);
        }),
        medical_record: normalizeTreatmentRow(medicalRecord),
        ortho_mode: orthoMode,
        billing: billingRes.data ? billingRes.data.billing : null
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menyimpan treatment'
    };
  } finally {
    lock.releaseLock();
  }
}

function getTreatmentInitData(appointmentId, options) {
  const opts = getTreatmentServiceUiReadOptions_(options);

  const appointmentRes = getAppointmentById(appointmentId, opts);
  if (!appointmentRes || !appointmentRes.success) {
    return {
      success: false,
      message: (appointmentRes && appointmentRes.message) || 'Gagal mengambil data appointment'
    };
  }

  const appointment = appointmentRes.data;
  const status = String(appointment.status || '').trim().toLowerCase();

  if (status !== 'scheduled') {
    return {
      success: false,
      message: 'Treatment hanya bisa dibuat dari appointment berstatus scheduled'
    };
  }

  const doctorsRes = getActiveDoctors(opts);
  if (!doctorsRes || !doctorsRes.success) {
    return {
      success: false,
      message: (doctorsRes && doctorsRes.message) || 'Gagal mengambil data dokter'
    };
  }

  const servicesRes = getTreatmentServiceActiveServices_(opts);
  if (!servicesRes || !servicesRes.success) {
    return {
      success: false,
      message: (servicesRes && servicesRes.message) || 'Gagal mengambil data layanan'
    };
  }

  return {
    success: true,
    data: {
      appointment: appointment,
      doctors: doctorsRes.data || [],
      services: servicesRes.data || []
    }
  };
}

function getTreatmentInitDataPreview(options) {
  const opts = getTreatmentServiceUiReadOptions_(options);
  const doctorsRes = getActiveDoctors(opts);
  const servicesRes = getTreatmentServiceActiveServices_(opts);

  return {
    success: true,
    data: {
      doctors: (doctorsRes && doctorsRes.success) ? doctorsRes.data : [],
      services: (servicesRes && servicesRes.success) ? servicesRes.data : []
    }
  };
}

/* =========================================================
   PHASE 4F MANUAL TESTS
   TreatmentService read-only -> TreatmentRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testTreatmentServicePhase4FReadOnlyBridge() {
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
      typeof TreatmentRepository === 'undefined' ||
      !TreatmentRepository
    ) {
      result.issues.push({
        issue: 'TREATMENT_REPOSITORY_NOT_FOUND'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperTreatments = getTreatmentsRaw();
    const repoTreatments = TreatmentRepository.getTreatmentsRaw();

    const wrapperItems = getTreatmentItemsRaw();
    const repoItems = TreatmentRepository.getTreatmentItemsRaw();

    const wrapperMedicalRecords = getMedicalRecordsRaw();
    const repoMedicalRecords = TreatmentRepository.getMedicalRecordsRaw();

    result.counts.wrapper_treatments = Array.isArray(wrapperTreatments) ? wrapperTreatments.length : -1;
    result.counts.repository_treatments = Array.isArray(repoTreatments) ? repoTreatments.length : -1;

    result.counts.wrapper_treatment_items = Array.isArray(wrapperItems) ? wrapperItems.length : -1;
    result.counts.repository_treatment_items = Array.isArray(repoItems) ? repoItems.length : -1;

    result.counts.wrapper_medical_records = Array.isArray(wrapperMedicalRecords) ? wrapperMedicalRecords.length : -1;
    result.counts.repository_medical_records = Array.isArray(repoMedicalRecords) ? repoMedicalRecords.length : -1;

    if (!Array.isArray(wrapperTreatments)) {
      result.issues.push({ issue: 'WRAPPER_TREATMENTS_NOT_ARRAY' });
    }

    if (!Array.isArray(repoTreatments)) {
      result.issues.push({ issue: 'REPOSITORY_TREATMENTS_NOT_ARRAY' });
    }

    if (result.counts.wrapper_treatments !== result.counts.repository_treatments) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_treatments,
        repository_count: result.counts.repository_treatments,
        issue: 'TREATMENT_COUNT_MISMATCH'
      });
    }

    if (result.counts.wrapper_treatment_items !== result.counts.repository_treatment_items) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_treatment_items,
        repository_count: result.counts.repository_treatment_items,
        issue: 'TREATMENT_ITEM_COUNT_MISMATCH'
      });
    }

    if (result.counts.wrapper_medical_records !== result.counts.repository_medical_records) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_medical_records,
        repository_count: result.counts.repository_medical_records,
        issue: 'MEDICAL_RECORD_COUNT_MISMATCH'
      });
    }

    const doctorsRes = getActiveDoctors();
    const repoDoctors = TreatmentRepository.listActiveDoctors();

    result.counts.wrapper_active_doctors =
      doctorsRes && Array.isArray(doctorsRes.data) ? doctorsRes.data.length : -1;

    result.counts.repository_active_doctors =
      Array.isArray(repoDoctors) ? repoDoctors.length : -1;

    if (!doctorsRes || doctorsRes.success !== true || !Array.isArray(doctorsRes.data)) {
      result.issues.push({
        endpoint: 'getActiveDoctors',
        issue: 'GET_ACTIVE_DOCTORS_FAILED'
      });
    }

    if (result.counts.wrapper_active_doctors !== result.counts.repository_active_doctors) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_active_doctors,
        repository_count: result.counts.repository_active_doctors,
        issue: 'ACTIVE_DOCTOR_COUNT_MISMATCH'
      });
    }

    const firstDoctor = doctorsRes && Array.isArray(doctorsRes.data) && doctorsRes.data.length
      ? doctorsRes.data[0]
      : null;

    const doctorId = firstDoctor ? String(firstDoctor.user_id || '').trim() : '';

    result.sample.first_doctor_id = doctorId;

    if (doctorId) {
      const wrapperDoctor = findActiveDoctorById(doctorId);
      const repoDoctor = TreatmentRepository.findActiveDoctorById(doctorId);

      result.sample.wrapper_find_doctor_ok = !!wrapperDoctor;
      result.sample.repository_find_doctor_ok = !!repoDoctor;

      if (!wrapperDoctor || !repoDoctor) {
        result.issues.push({
          user_id: doctorId,
          issue: 'FIND_ACTIVE_DOCTOR_FAILED'
        });
      }
    }

    const firstTreatment = wrapperTreatments.length ? wrapperTreatments[0] : null;
    const treatmentId = firstTreatment
      ? String(firstTreatment.treatment_id || '').trim()
      : '';

    const appointmentId = firstTreatment
      ? String(firstTreatment.appointment_id || '').trim()
      : '';

    result.sample.first_treatment_id = treatmentId;
    result.sample.first_appointment_id = appointmentId;

    if (appointmentId) {
      const wrapperTreatmentRes = getTreatmentByAppointmentId(appointmentId);
      const repoTreatment = TreatmentRepository.findTreatmentByAppointmentId(appointmentId);

      result.sample.wrapper_get_treatment_by_appointment_ok = !!(
        wrapperTreatmentRes &&
        wrapperTreatmentRes.success === true &&
        wrapperTreatmentRes.data &&
        wrapperTreatmentRes.data.treatment
      );

      result.sample.repository_find_treatment_by_appointment_ok = !!repoTreatment;

      if (
        !result.sample.wrapper_get_treatment_by_appointment_ok ||
        !result.sample.repository_find_treatment_by_appointment_ok
      ) {
        result.issues.push({
          appointment_id: appointmentId,
          issue: 'GET_TREATMENT_BY_APPOINTMENT_FAILED'
        });
      }

      if (wrapperTreatmentRes && wrapperTreatmentRes.success && wrapperTreatmentRes.data) {
        const wrapperItemCount = Array.isArray(wrapperTreatmentRes.data.items)
          ? wrapperTreatmentRes.data.items.length
          : -1;

        const repoItemCount = repoTreatment && repoTreatment.treatment_id
          ? TreatmentRepository.listTreatmentItemsByTreatmentId(repoTreatment.treatment_id).length
          : -1;

        result.sample.wrapper_treatment_item_count = wrapperItemCount;
        result.sample.repository_treatment_item_count = repoItemCount;

        if (wrapperItemCount !== repoItemCount) {
          result.issues.push({
            appointment_id: appointmentId,
            wrapper_count: wrapperItemCount,
            repository_count: repoItemCount,
            issue: 'TREATMENT_BY_APPOINTMENT_ITEM_COUNT_MISMATCH'
          });
        }
      }
    } else {
      result.sample.skipped_treatment_by_appointment = true;
      result.sample.reason = 'Belum ada appointment_id pada sample treatment';
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

function testTreatmentServicePhase4FInitDataPreview() {
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
    const preview = getTreatmentInitDataPreview();

    result.sample.preview_ok = !!(
      preview &&
      preview.success === true &&
      preview.data &&
      Array.isArray(preview.data.doctors) &&
      Array.isArray(preview.data.services)
    );

    result.sample.doctor_count =
      preview && preview.data && Array.isArray(preview.data.doctors)
        ? preview.data.doctors.length
        : -1;

    result.sample.service_count =
      preview && preview.data && Array.isArray(preview.data.services)
        ? preview.data.services.length
        : -1;

    if (!result.sample.preview_ok) {
      result.issues.push({
        endpoint: 'getTreatmentInitDataPreview',
        issue: 'TREATMENT_INIT_DATA_PREVIEW_FAILED'
      });
    }

    if (typeof getServicePrice === 'function') {
      const services = preview && preview.data && Array.isArray(preview.data.services)
        ? preview.data.services
        : [];

      const firstService = services.length ? services[0] : null;
      const serviceId = firstService ? String(firstService.service_id || '').trim() : '';

      result.sample.first_service_id = serviceId;

      if (serviceId) {
        const priceRes = getServicePrice(serviceId);

        result.sample.service_price_ok = !!(
          priceRes &&
          priceRes.success === true &&
          priceRes.data &&
          String(priceRes.data.service_id || '').trim() === serviceId
        );

        if (!result.sample.service_price_ok) {
          result.issues.push({
            endpoint: 'getServicePrice',
            service_id: serviceId,
            issue: 'GET_SERVICE_PRICE_FAILED'
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

function testTreatmentServicePhase4FInitDataSample() {
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
    const appointments = typeof getAppointmentsRaw === 'function'
      ? getAppointmentsRaw()
      : [];

    const scheduled = appointments.find(function(row) {
      return String(row.status || '').trim().toLowerCase() === 'scheduled';
    }) || null;

    const appointmentId = scheduled
      ? String(scheduled.appointment_id || '').trim()
      : '';

    result.sample.appointment_count = Array.isArray(appointments) ? appointments.length : -1;
    result.sample.scheduled_appointment_id = appointmentId;

    if (!appointmentId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada appointment scheduled untuk getTreatmentInitData sample test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const initRes = getTreatmentInitData(appointmentId);

    result.sample.init_data_ok = !!(
      initRes &&
      initRes.success === true &&
      initRes.data &&
      initRes.data.appointment &&
      Array.isArray(initRes.data.doctors) &&
      Array.isArray(initRes.data.services)
    );

    result.sample.doctor_count =
      initRes && initRes.data && Array.isArray(initRes.data.doctors)
        ? initRes.data.doctors.length
        : -1;

    result.sample.service_count =
      initRes && initRes.data && Array.isArray(initRes.data.services)
        ? initRes.data.services.length
        : -1;

    if (!result.sample.init_data_ok) {
      result.issues.push({
        endpoint: 'getTreatmentInitData',
        appointment_id: appointmentId,
        message: initRes && initRes.message ? initRes.message : '',
        issue: 'GET_TREATMENT_INIT_DATA_FAILED'
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

function testTreatmentServicePhase4FRegressionPack() {
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
        name: 'testTreatmentRepositoryPhase4EReadOnly',
        fn: typeof testTreatmentRepositoryPhase4EReadOnly === 'function'
          ? testTreatmentRepositoryPhase4EReadOnly
          : null
      },
      {
        name: 'testTreatmentRepositoryPhase4EBuildRawContext',
        fn: typeof testTreatmentRepositoryPhase4EBuildRawContext === 'function'
          ? testTreatmentRepositoryPhase4EBuildRawContext
          : null
      },
      {
        name: 'testTreatmentRepositoryPhase4EFindTreatmentSample',
        fn: typeof testTreatmentRepositoryPhase4EFindTreatmentSample === 'function'
          ? testTreatmentRepositoryPhase4EFindTreatmentSample
          : null
      },
      {
        name: 'testTreatmentRepositoryPhase4EContextFinderSample',
        fn: typeof testTreatmentRepositoryPhase4EContextFinderSample === 'function'
          ? testTreatmentRepositoryPhase4EContextFinderSample
          : null
      },
      {
        name: 'testTreatmentServicePhase4FReadOnlyBridge',
        fn: typeof testTreatmentServicePhase4FReadOnlyBridge === 'function'
          ? testTreatmentServicePhase4FReadOnlyBridge
          : null
      },
      {
        name: 'testTreatmentServicePhase4FInitDataPreview',
        fn: typeof testTreatmentServicePhase4FInitDataPreview === 'function'
          ? testTreatmentServicePhase4FInitDataPreview
          : null
      },
      {
        name: 'testTreatmentServicePhase4FInitDataSample',
        fn: typeof testTreatmentServicePhase4FInitDataSample === 'function'
          ? testTreatmentServicePhase4FInitDataSample
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

function testTreatmentServicePhase6GUiReadLog() {
  const result = {
    success: true,
    stage: '6G-TreatmentService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getTreatmentServiceUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    probe: {}
  };

  try {
    const opts = getTreatmentServiceUiReadOptions_();

    const treatments = getTreatmentsRaw(opts);
    const treatmentItems = getTreatmentItemsRaw(opts);
    const medicalRecords = getMedicalRecordsRaw(opts);

    result.probe.treatment_count = Array.isArray(treatments) ? treatments.length : -1;
    result.probe.treatment_item_count = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.probe.medical_record_count = Array.isArray(medicalRecords) ? medicalRecords.length : -1;

    if (!Array.isArray(treatments)) result.issues.push({ issue: 'TREATMENTS_NOT_ARRAY' });
    if (!Array.isArray(treatmentItems)) result.issues.push({ issue: 'TREATMENT_ITEMS_NOT_ARRAY' });
    if (!Array.isArray(medicalRecords)) result.issues.push({ issue: 'MEDICAL_RECORDS_NOT_ARRAY' });

    const doctorsRes = getActiveDoctors(opts);
    const servicesRes = getTreatmentServiceActiveServices_(opts);
    const preview = getTreatmentInitDataPreview(opts);

    result.probe.doctor_count = doctorsRes && Array.isArray(doctorsRes.data) ? doctorsRes.data.length : -1;
    result.probe.service_count = servicesRes && Array.isArray(servicesRes.data) ? servicesRes.data.length : -1;
    result.probe.preview_success = !!(preview && preview.success);
    result.probe.preview_doctor_count = preview && preview.data && Array.isArray(preview.data.doctors)
      ? preview.data.doctors.length
      : -1;
    result.probe.preview_service_count = preview && preview.data && Array.isArray(preview.data.services)
      ? preview.data.services.length
      : -1;

    if (!doctorsRes || !doctorsRes.success || !Array.isArray(doctorsRes.data)) {
      result.issues.push({ issue: 'GET_ACTIVE_DOCTORS_FAILED' });
    }

    if (!servicesRes || !servicesRes.success || !Array.isArray(servicesRes.data)) {
      result.issues.push({ issue: 'GET_ACTIVE_SERVICES_FAILED' });
    }

    if (!preview || !preview.success) {
      result.issues.push({ issue: 'GET_TREATMENT_INIT_DATA_PREVIEW_FAILED' });
    }

    const appointments = typeof getAppointmentsRaw === 'function'
      ? getAppointmentsRaw(opts)
      : [];

    const scheduled = appointments.find(function(row) {
      return String(row.status || '').trim().toLowerCase() === 'scheduled';
    }) || null;

    const appointmentId = scheduled ? String(scheduled.appointment_id || '').trim() : '';

    result.probe.scheduled_appointment_id = appointmentId;
    result.probe.appointment_count = Array.isArray(appointments) ? appointments.length : -1;

    if (appointmentId) {
      const initRes = getTreatmentInitData(appointmentId, opts);

      result.probe.init_data_success = !!(initRes && initRes.success);
      result.probe.init_doctor_count = initRes && initRes.data && Array.isArray(initRes.data.doctors)
        ? initRes.data.doctors.length
        : -1;
      result.probe.init_service_count = initRes && initRes.data && Array.isArray(initRes.data.services)
        ? initRes.data.services.length
        : -1;

      if (!initRes || !initRes.success) {
        result.issues.push({
          appointment_id: appointmentId,
          issue: 'GET_TREATMENT_INIT_DATA_FAILED',
          message: initRes && initRes.message ? initRes.message : ''
        });
      }
    } else {
      result.probe.init_data_skipped = true;
      result.probe.init_data_skip_reason = 'Tidak ada appointment scheduled pada dataset UI read';
    }

    if (treatments.length) {
      const firstTreatment = treatments[0];
      const treatmentId = String(firstTreatment.treatment_id || '').trim();
      const appointmentIdFromTreatment = String(firstTreatment.appointment_id || '').trim();

      result.probe.first_treatment_id = treatmentId;
      result.probe.first_treatment_appointment_id = appointmentIdFromTreatment;

      if (appointmentIdFromTreatment) {
        const byAppointment = getTreatmentByAppointmentId(appointmentIdFromTreatment, opts);

        result.probe.by_appointment_success = !!(byAppointment && byAppointment.success);
        result.probe.by_appointment_item_count = byAppointment && byAppointment.data && Array.isArray(byAppointment.data.items)
          ? byAppointment.data.items.length
          : -1;

        if (!byAppointment || !byAppointment.success) {
          result.issues.push({
            appointment_id: appointmentIdFromTreatment,
            issue: 'GET_TREATMENT_BY_APPOINTMENT_FAILED'
          });
        }
      }
    }

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.TREATMENTS, {
        treatment_id: 'TEST-SHOULD-NOT-INSERT'
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
      stage: '6G-TreatmentService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}