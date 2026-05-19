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
  return repoBuildUiReadOptions_({});
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
  let rules = [];

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.listActiveDoctors === 'function'
  ) {
    rules = TreatmentRepository.listActiveDoctors(opts) || [];
  } else if (typeof dbFindAll_ === 'function') {
    rules = (dbFindAll_(REPO_TABLES.DOCTOR_COMPENSATION_RULES || 'DoctorCompensationRules', opts) || [])
      .filter(function(row) {
        return String(row.is_active || '').trim().toLowerCase() !== 'false';
      });
  }

  const doctors = rules.map(function(row) {
    const name = String(row.doctor_name || '').trim();
    return {
      doctor_name: name,
      full_name: name
    };
  });

  return {
    success: true,
    data: doctors
  };
}

function findActiveDoctorByName(name, options) {
  const normalizedName = String(name || '').trim();
  const opts = getTreatmentServiceUiReadOptions_(options);

  if (!normalizedName) return null;

  if (
    isTreatmentRepositoryBridgeAvailable_() &&
    typeof TreatmentRepository.findActiveDoctorByName === 'function'
  ) {
    return TreatmentRepository.findActiveDoctorByName(normalizedName, opts) || null;
  }

  if (typeof dbFindById_ === 'function') {
    const rule = dbFindById_(
      REPO_TABLES.DOCTOR_COMPENSATION_RULES || 'DoctorCompensationRules',
      'doctor_name',
      normalizedName,
      opts
    );
    if (rule && String(rule.is_active || '').trim().toLowerCase() !== 'false') {
      return rule;
    }
  }

  return null;
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

  if (!payload.doctor_name || !String(payload.doctor_name).trim()) {
    errors.doctor_name = 'Dokter wajib dipilih';
  }

  if (!payload.treatment_date || !String(payload.treatment_date).trim()) {
    errors.treatment_date = 'Tanggal treatment wajib diisi';
  } else if (!isValidYmdDate(String(payload.treatment_date).trim())) {
    errors.treatment_date = 'Tanggal treatment tidak valid';
  } else if (String(payload.treatment_date).trim() > formatTodayYmd()) {
    errors.treatment_date = 'Tanggal treatment tidak boleh tanggal yang akan datang';
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
  const auth = requireRole(payload, ['doctor']);
  if (!auth.success) return auth;

  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CREATE_TREATMENT',
    module: 'TreatmentService',
    action: 'createTreatment',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();
  const writeReadOptions = getTreatmentServiceSpreadsheetWriteReadOptions_();

  try {
    lock.waitLock(5000);

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

    const doctor = findActiveDoctorByName(payload.doctor_name, writeReadOptions);
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

    dbInsert_('Treatments', treatment);

    var itemRows = normalizedItems.map(function(item) {
      var itemRow = Object.assign({}, item);
      delete itemRow.is_ortho_install;
      delete itemRow.is_ortho_control;
      return itemRow;
    });
    if (itemRows.length) dbBatchInsert_('TreatmentItems', itemRows);

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

    dbInsert_('MedicalRecords', medicalRecord);

    const appointmentCompletedAt = nowIso();
    dbUpdateById_('Appointments', 'appointment_id', payload.appointment_id, {
      status: 'completed',
      updated_at: appointmentCompletedAt
    });

    // Audit dilog SEKARANG (setelah core mutations confirmed) — sebelum
    // orthoSync/billing yang masih bisa fail. Treatment & appointment sudah
    // ada di DB walaupun downstream gagal.
    writeAuditLog_({
      actor: auth.user,
      entity_type: 'appointment',
      entity_id: payload.appointment_id,
      action: 'complete',
      old_value: appointment,
      new_value: Object.assign({}, appointment, { status: 'completed', updated_at: appointmentCompletedAt }),
      notes: 'Auto-completed via treatment ' + treatmentId
    });

    writeAuditLog_({
      actor: auth.user,
      entity_type: 'treatment',
      entity_id: treatmentId,
      action: 'create',
      old_value: null,
      new_value: treatment,
      notes: 'Treatment dibuat dengan ' + normalizedItems.length + ' item; medical_record ' + medicalRecord.record_id
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
      message: 'Terjadi kesalahan saat menyimpan treatment: ' + (err && err.message ? err.message : String(err || ''))
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

function normalizeTreatmentUiText_(value) {
  if (value === null || value === undefined) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );
  }

  return String(value);
}

function normalizeTreatmentUiNumber_(value) {
  const num = Number(value || 0);
  return isNaN(num) ? 0 : num;
}

function normalizeTreatmentUiBoolean_(value) {
  if (value === true) return true;
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'ya';
}

function getTreatmentInitDataForUi(payloadOrId) {
  // Frontend: payload {session_token, appointment_id}. Legacy: appointmentId string.
  let appointmentId, isPayloadMode;
  if (payloadOrId && typeof payloadOrId === 'object' && payloadOrId.session_token) {
    isPayloadMode = true;
    appointmentId = payloadOrId.appointment_id;
  } else {
    isPayloadMode = false;
    appointmentId = payloadOrId;
  }

  if (isPayloadMode) {
    const auth = requireRole(payloadOrId, ['doctor']);
    if (!auth.success) return auth;
  }

  try {
    const res = getTreatmentInitData(appointmentId);

    if (!res || !res.success) {
      return {
        success: false,
        message: (res && res.message) || 'Gagal memuat data treatment'
      };
    }

    const payload = res.data || {};
    const appointment = payload.appointment || {};
    const doctors = Array.isArray(payload.doctors) ? payload.doctors : [];
    const services = Array.isArray(payload.services) ? payload.services : [];

    return {
      success: true,
      data: {
        appointment: {
          appointment_id: normalizeTreatmentUiText_(appointment.appointment_id),
          patient_id: normalizeTreatmentUiText_(appointment.patient_id),
          patient_name: normalizeTreatmentUiText_(appointment.patient_name),
          appointment_date: normalizeTreatmentUiText_(appointment.appointment_date),
          appointment_time: normalizeTreatmentUiText_(appointment.appointment_time),
          complaint: normalizeTreatmentUiText_(appointment.complaint),
          status: normalizeTreatmentUiText_(appointment.status)
        },
        doctors: doctors.map(function(row) {
          return {
            user_id: normalizeTreatmentUiText_(row.user_id),
            username: normalizeTreatmentUiText_(row.username),
            full_name: normalizeTreatmentUiText_(row.full_name)
          };
        }),
        services: services.map(function(row) {
          return {
            service_id: normalizeTreatmentUiText_(row.service_id),
            service_name: normalizeTreatmentUiText_(row.service_name),
            default_price: normalizeTreatmentUiNumber_(row.default_price),
            is_ortho_install: normalizeTreatmentUiBoolean_(row.is_ortho_install),
            is_ortho_control: normalizeTreatmentUiBoolean_(row.is_ortho_control)
          };
        })
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat memuat data treatment untuk UI',
      error: err && err.message ? err.message : String(err)
    };
  }
}

function getTreatmentInitDataPreview(options) {
  const opts = options || {};

  // Frontend kirim payload {session_token}; legacy/test call kirim options polos.
  if (opts.session_token) {
    const auth = requireRole(opts, ['doctor']);
    if (!auth.success) return auth;
  }

  const readOpts = getTreatmentServiceUiReadOptions_(opts);
  const doctorsRes = getActiveDoctors(readOpts);
  const servicesRes = getTreatmentServiceActiveServices_(readOpts);

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

function testTreatmentServiceReadLog() {
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

//sementara
function testTreatmentFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-5-TreatmentService-FreezeGuard',
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
      default_off_validation_or_access_reached: false,
      simulated_freeze_create_blocked: false,
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
      treatments: getTreatmentsRaw({
        backend_mode: 'spreadsheet'
      }).length,
      treatment_items: getTreatmentItemsRaw({
        backend_mode: 'spreadsheet'
      }).length,
      medical_records: getMedicalRecordsRaw({
        backend_mode: 'spreadsheet'
      }).length,
      appointments: getAppointmentsRaw({
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

    const defaultOffCreate = createTreatment({
      actor_role: '',
      appointment_id: '',
      patient_id: '',
      patient_name: '',
      doctor_name: '',
      treatment_date: '',
      chief_complaint: '',
      diagnosis: '',
      notes: '',
      items: []
    });

    result.messages.default_off_create = defaultOffCreate && defaultOffCreate.message
      ? defaultOffCreate.message
      : '';

    result.checks.default_off_validation_or_access_reached = !!(
      defaultOffCreate &&
      defaultOffCreate.success === false &&
      (
        defaultOffCreate.message === 'Hanya admin atau owner yang dapat menginput treatment' ||
        defaultOffCreate.message === 'Validasi gagal' ||
        defaultOffCreate.message === 'Appointment tidak ditemukan'
      )
    );

    if (!result.checks.default_off_validation_or_access_reached) {
      addIssue('DEFAULT_OFF_CREATE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffCreate
      });
    }

    const simulatedFreezeCreate = createTreatment({
      __test_freeze_enabled: true,
      actor_role: 'owner',
      appointment_id: 'APT-0001',
      patient_id: 'PAT-0001',
      patient_name: 'SHOULD NOT WRITE',
      doctor_name: 'SHOULD NOT WRITE',
      treatment_date: '2027-01-01',
      chief_complaint: 'SHOULD NOT WRITE',
      diagnosis: 'SHOULD NOT WRITE',
      notes: 'SHOULD NOT WRITE',
      items: [
        {
          service_id: 'SRV-001',
          qty: 1
        }
      ]
    });

    result.messages.simulated_freeze_create = simulatedFreezeCreate && simulatedFreezeCreate.message
      ? simulatedFreezeCreate.message
      : '';

    result.checks.simulated_freeze_create_blocked = isFreezeMessage_(simulatedFreezeCreate);

    if (!result.checks.simulated_freeze_create_blocked) {
      addIssue('SIMULATED_FREEZE_CREATE_TREATMENT_NOT_BLOCKED', {
        response: simulatedFreezeCreate
      });
    }

    result.after_counts = getCounts_();

    result.checks.counts_unchanged =
      result.after_counts.treatments === result.before_counts.treatments &&
      result.after_counts.treatment_items === result.before_counts.treatment_items &&
      result.after_counts.medical_records === result.before_counts.medical_records &&
      result.after_counts.appointments === result.before_counts.appointments;

    if (!result.checks.counts_unchanged) {
      addIssue('COUNTS_CHANGED_DURING_TREATMENT_FREEZE_GUARD_TEST', {
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
      stage: '8B-5-TreatmentService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'TREATMENT_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}