/* =========================================================
   PATIENT REPOSITORY
   Tahap 3F - Repository Layer Read-Only Awal
   Backend saat ini tetap Spreadsheet via DataAccess.gs
   ========================================================= */

/**
 * PatientRepository adalah layer baca data pasien dan relasi pasien.
 *
 * Catatan penting:
 * - Tahap 3F hanya read-only.
 * - Belum mengganti PatientService.gs.
 * - Belum mengubah endpoint frontend.
 * - Belum mengubah business logic.
 * - Semua data masih berasal dari Spreadsheet melalui DataAccess.gs.
 */

const PATIENT_REPOSITORY_CONTEXT_KEYS = Object.freeze({
  PATIENTS: 'patients',
  APPOINTMENTS: 'appointments',
  TREATMENTS: 'treatments',
  TREATMENT_ITEMS: 'treatmentItems',
  MEDICAL_RECORDS: 'medicalRecords',
  PATIENT_PHOTOS: 'patientPhotos',
  ORTHO_RECALL: 'orthoRecall'
});

const PatientRepository = Object.freeze({
  getPatientsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.PATIENTS, options);
  },

  getAppointmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.APPOINTMENTS, options);
  },

  getTreatmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.TREATMENTS, options);
  },

  getTreatmentItemsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, options);
  },

  getMedicalRecordsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, options);
  },

  getPatientPhotosRaw: function(options) {
    return dbFindAll_(REPO_TABLES.PATIENT_PHOTOS, options);
  },

  getOrthoRecallRaw: function(options) {
    return dbFindAll_(REPO_TABLES.ORTHO_RECALL, options);
  },

  findPatientById: function(patientId, options) {
    return dbFindById_(
      REPO_TABLES.PATIENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.PATIENTS),
      patientId,
      options
    );
  },

  listActivePatients: function(options) {
    return this.getPatientsRaw(options).filter(function(row) {
      return isPatientRepositoryActive_(row.is_active);
    });
  },

  listInactivePatients: function(options) {
    return this.getPatientsRaw(options).filter(function(row) {
      return !isPatientRepositoryActive_(row.is_active);
    });
  },

  listAppointmentsByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.APPOINTMENTS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listTreatmentsByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENTS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listTreatmentItemsByTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizePatientRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENT_ITEMS, function(row) {
      return String(row.treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  listMedicalRecordsByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.MEDICAL_RECORDS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listPatientPhotosByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.PATIENT_PHOTOS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listOrthoRecallByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  findActiveOrthoRecallByPatientId: function(patientId, options) {
    const rows = this.listOrthoRecallByPatientId(patientId, options);

    return rows.find(function(row) {
      return String(row.program_status || '').trim().toLowerCase() === 'active';
    }) || null;
  },

  buildRawContext: function(options) {
    return buildPatientRepositoryRawContext_(options || {});
  },

  getRawContextRows: function(ctx, key) {
    return getPatientRepositoryRawContextRows_(ctx, key);
  },

  findPatientByIdFromContext: function(ctx, patientId) {
    return findPatientRepositoryPatientByIdFromContext_(ctx, patientId);
  },

  listAppointmentsByPatientIdFromContext: function(ctx, patientId) {
    return listPatientRepositoryRowsByPatientIdFromContext_(
      ctx,
      PATIENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS,
      patientId
    );
  },

  listTreatmentsByPatientIdFromContext: function(ctx, patientId) {
    return listPatientRepositoryRowsByPatientIdFromContext_(
      ctx,
      PATIENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS,
      patientId
    );
  },

  listMedicalRecordsByPatientIdFromContext: function(ctx, patientId) {
    return listPatientRepositoryRowsByPatientIdFromContext_(
      ctx,
      PATIENT_REPOSITORY_CONTEXT_KEYS.MEDICAL_RECORDS,
      patientId
    );
  },

  listPatientPhotosByPatientIdFromContext: function(ctx, patientId) {
    return listPatientRepositoryRowsByPatientIdFromContext_(
      ctx,
      PATIENT_REPOSITORY_CONTEXT_KEYS.PATIENT_PHOTOS,
      patientId
    );
  },

  listOrthoRecallByPatientIdFromContext: function(ctx, patientId) {
    return listPatientRepositoryRowsByPatientIdFromContext_(
      ctx,
      PATIENT_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL,
      patientId
    );
  },

  listTreatmentItemsByTreatmentIdFromContext: function(ctx, treatmentId) {
    return listPatientRepositoryTreatmentItemsByTreatmentIdFromContext_(ctx, treatmentId);
  }
});

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function normalizePatientRepositoryKeyValue_(value) {
  return String(value || '').trim();
}

function isPatientRepositoryActive_(value) {
  if (value === false) return false;
  if (value === true) return true;
  if (value === '' || value === null || value === undefined) return true;

  return String(value).trim().toLowerCase() !== 'false';
}

function shouldPatientRepositoryLoadContextKey_(only, key) {
  const config = only || {};
  const keys = Object.keys(config);

  if (!keys.length) {
    return true;
  }

  return config[key] === true;
}

function buildPatientRepositoryRawContext_(options) {
  const opts = options || {};
  const only = opts.only || {};

  const ctx = {
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_(opts)
      : 'spreadsheet',

    loaded_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),

    patients: [],
    appointments: [],
    treatments: [],
    treatmentItems: [],
    medicalRecords: [],
    patientPhotos: [],
    orthoRecall: []
  };

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.PATIENTS)) {
    ctx.patients = PatientRepository.getPatientsRaw(opts);
  }

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS)) {
    ctx.appointments = PatientRepository.getAppointmentsRaw(opts);
  }

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS)) {
    ctx.treatments = PatientRepository.getTreatmentsRaw(opts);
  }

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.TREATMENT_ITEMS)) {
    ctx.treatmentItems = PatientRepository.getTreatmentItemsRaw(opts);
  }

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.MEDICAL_RECORDS)) {
    ctx.medicalRecords = PatientRepository.getMedicalRecordsRaw(opts);
  }

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.PATIENT_PHOTOS)) {
    ctx.patientPhotos = PatientRepository.getPatientPhotosRaw(opts);
  }

  if (shouldPatientRepositoryLoadContextKey_(only, PATIENT_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL)) {
    ctx.orthoRecall = PatientRepository.getOrthoRecallRaw(opts);
  }

  return ctx;
}

function getPatientRepositoryRawContextRows_(ctx, key) {
  const context = ctx || {};
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) return [];

  if (Array.isArray(context[normalizedKey])) {
    return context[normalizedKey];
  }

  const aliases = {
    Patients: 'patients',
    Appointments: 'appointments',
    Treatments: 'treatments',
    TreatmentItems: 'treatmentItems',
    MedicalRecords: 'medicalRecords',
    PatientPhotos: 'patientPhotos',
    OrthoRecall: 'orthoRecall',

    patientsRaw: 'patients',
    appointmentsRaw: 'appointments',
    treatmentsRaw: 'treatments',
    treatmentItemsRaw: 'treatmentItems',
    medicalRecordsRaw: 'medicalRecords',
    patientPhotosRaw: 'patientPhotos',
    orthoRecallRaw: 'orthoRecall'
  };

  const mappedKey = aliases[normalizedKey];

  if (mappedKey && Array.isArray(context[mappedKey])) {
    return context[mappedKey];
  }

  return [];
}

function findPatientRepositoryPatientByIdFromContext_(ctx, patientId) {
  const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return null;

  return getPatientRepositoryRawContextRows_(
    ctx,
    PATIENT_REPOSITORY_CONTEXT_KEYS.PATIENTS
  ).find(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  }) || null;
}

function listPatientRepositoryRowsByPatientIdFromContext_(ctx, contextKey, patientId) {
  const normalizedPatientId = normalizePatientRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return [];

  return getPatientRepositoryRawContextRows_(ctx, contextKey).filter(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  });
}

function listPatientRepositoryTreatmentItemsByTreatmentIdFromContext_(ctx, treatmentId) {
  const normalizedTreatmentId = normalizePatientRepositoryKeyValue_(treatmentId);

  if (!normalizedTreatmentId) return [];

  return getPatientRepositoryRawContextRows_(
    ctx,
    PATIENT_REPOSITORY_CONTEXT_KEYS.TREATMENT_ITEMS
  ).filter(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  });
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testPatientRepositoryPhase3FReadOnly() {
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
    counts: {}
  };

  try {
    const datasets = {
      patients: PatientRepository.getPatientsRaw(),
      appointments: PatientRepository.getAppointmentsRaw(),
      treatments: PatientRepository.getTreatmentsRaw(),
      treatmentItems: PatientRepository.getTreatmentItemsRaw(),
      medicalRecords: PatientRepository.getMedicalRecordsRaw(),
      patientPhotos: PatientRepository.getPatientPhotosRaw(),
      orthoRecall: PatientRepository.getOrthoRecallRaw()
    };

    Object.keys(datasets).forEach(function(key) {
      const rows = datasets[key];

      result.counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          dataset: key,
          issue: 'DATASET_NOT_ARRAY'
        });
      }
    });

    const activePatients = PatientRepository.listActivePatients();
    const inactivePatients = PatientRepository.listInactivePatients();

    result.counts.activePatients = Array.isArray(activePatients) ? activePatients.length : 0;
    result.counts.inactivePatients = Array.isArray(inactivePatients) ? inactivePatients.length : 0;

    if (!Array.isArray(activePatients)) {
      result.issues.push({
        dataset: 'activePatients',
        issue: 'ACTIVE_PATIENTS_NOT_ARRAY'
      });
    }

    if (!Array.isArray(inactivePatients)) {
      result.issues.push({
        dataset: 'inactivePatients',
        issue: 'INACTIVE_PATIENTS_NOT_ARRAY'
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

function testPatientRepositoryPhase3FBuildRawContext() {
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
    context_counts: {}
  };

  try {
    const ctx = PatientRepository.buildRawContext({
      only: {
        patients: true,
        treatments: true,
        treatmentItems: true,
        medicalRecords: true,
        patientPhotos: true,
        orthoRecall: true
      }
    });

    const expectedArrays = [
      'patients',
      'treatments',
      'treatmentItems',
      'medicalRecords',
      'patientPhotos',
      'orthoRecall'
    ];

    expectedArrays.forEach(function(key) {
      const rows = PatientRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_ROWS_NOT_ARRAY'
        });
      }
    });

    const unloadedKeys = [
      'appointments'
    ];

    unloadedKeys.forEach(function(key) {
      const rows = PatientRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'UNLOADED_CONTEXT_ROWS_NOT_ARRAY'
        });
      }

      if (Array.isArray(rows) && rows.length > 0) {
        result.issues.push({
          key: key,
          row_count: rows.length,
          issue: 'UNLOADED_CONTEXT_SHOULD_BE_EMPTY'
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

function testPatientRepositoryPhase3FFindPatientSample() {
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
    const patients = PatientRepository.getPatientsRaw();
    const firstPatient = patients.length ? patients[0] : null;
    const patientId = firstPatient
      ? String(firstPatient.patient_id || '').trim()
      : '';

    result.sample.patient_count = patients.length;
    result.sample.first_patient_id = patientId;

    if (!patientId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada data pasien untuk sample find test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundPatient = PatientRepository.findPatientById(patientId);
    const appointments = PatientRepository.listAppointmentsByPatientId(patientId);
    const treatments = PatientRepository.listTreatmentsByPatientId(patientId);
    const medicalRecords = PatientRepository.listMedicalRecordsByPatientId(patientId);
    const photos = PatientRepository.listPatientPhotosByPatientId(patientId);
    const recalls = PatientRepository.listOrthoRecallByPatientId(patientId);
    const activeRecall = PatientRepository.findActiveOrthoRecallByPatientId(patientId);

    let treatmentItems = [];
    const firstTreatment = treatments.length ? treatments[0] : null;
    const treatmentId = firstTreatment
      ? String(firstTreatment.treatment_id || '').trim()
      : '';

    if (treatmentId) {
      treatmentItems = PatientRepository.listTreatmentItemsByTreatmentId(treatmentId);
    }

    result.sample.find_patient_ok = !!foundPatient;
    result.sample.appointment_count = appointments.length;
    result.sample.treatment_count = treatments.length;
    result.sample.medical_record_count = medicalRecords.length;
    result.sample.photo_count = photos.length;
    result.sample.recall_count = recalls.length;
    result.sample.has_active_recall = !!activeRecall;
    result.sample.first_treatment_id = treatmentId;
    result.sample.first_treatment_item_count = treatmentItems.length;

    if (!foundPatient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_BY_ID_FAILED'
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

function testPatientRepositoryPhase3FContextFinderSample() {
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
    const ctx = PatientRepository.buildRawContext({
      only: {
        patients: true,
        appointments: true,
        treatments: true,
        treatmentItems: true,
        medicalRecords: true,
        patientPhotos: true,
        orthoRecall: true
      }
    });

    const patients = PatientRepository.getRawContextRows(ctx, 'patients');
    const firstPatient = patients.length ? patients[0] : null;
    const patientId = firstPatient
      ? String(firstPatient.patient_id || '').trim()
      : '';

    result.sample.patient_count = patients.length;
    result.sample.first_patient_id = patientId;

    if (!patientId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada pasien untuk context finder test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const patient = PatientRepository.findPatientByIdFromContext(ctx, patientId);
    const appointments = PatientRepository.listAppointmentsByPatientIdFromContext(ctx, patientId);
    const treatments = PatientRepository.listTreatmentsByPatientIdFromContext(ctx, patientId);
    const medicalRecords = PatientRepository.listMedicalRecordsByPatientIdFromContext(ctx, patientId);
    const photos = PatientRepository.listPatientPhotosByPatientIdFromContext(ctx, patientId);
    const recalls = PatientRepository.listOrthoRecallByPatientIdFromContext(ctx, patientId);

    const firstTreatment = treatments.length ? treatments[0] : null;
    const treatmentId = firstTreatment
      ? String(firstTreatment.treatment_id || '').trim()
      : '';

    const treatmentItems = treatmentId
      ? PatientRepository.listTreatmentItemsByTreatmentIdFromContext(ctx, treatmentId)
      : [];

    result.sample.find_patient_ok = !!patient;
    result.sample.appointment_count = appointments.length;
    result.sample.treatment_count = treatments.length;
    result.sample.medical_record_count = medicalRecords.length;
    result.sample.photo_count = photos.length;
    result.sample.recall_count = recalls.length;
    result.sample.first_treatment_id = treatmentId;
    result.sample.first_treatment_item_count = treatmentItems.length;

    if (!patient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_FROM_CONTEXT_FAILED'
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

function testPatientRepositoryPhase6DSupabaseReadOnlyLog() {
  const result = {
    success: true,
    stage: '6D',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    const datasets = {
      patients: PatientRepository.getPatientsRaw(supabaseOptions),
      appointments: PatientRepository.getAppointmentsRaw(supabaseOptions),
      treatments: PatientRepository.getTreatmentsRaw(supabaseOptions),
      treatmentItems: PatientRepository.getTreatmentItemsRaw(supabaseOptions),
      medicalRecords: PatientRepository.getMedicalRecordsRaw(supabaseOptions),
      patientPhotos: PatientRepository.getPatientPhotosRaw(supabaseOptions),
      orthoRecall: PatientRepository.getOrthoRecallRaw(supabaseOptions)
    };

    Object.keys(datasets).forEach(function(key) {
      addCheck('SUPABASE_PATIENT_DATASET_ARRAY_' + key, Array.isArray(datasets[key]), {
        dataset: key,
        row_count: Array.isArray(datasets[key]) ? datasets[key].length : -1
      });
    });

    const activePatients = PatientRepository.listActivePatients(supabaseOptions);
    const inactivePatients = PatientRepository.listInactivePatients(supabaseOptions);

    addCheck('SUPABASE_PATIENT_ACTIVE_INACTIVE_ARRAYS', Array.isArray(activePatients) && Array.isArray(inactivePatients), {
      active_count: Array.isArray(activePatients) ? activePatients.length : -1,
      inactive_count: Array.isArray(inactivePatients) ? inactivePatients.length : -1
    });

    const firstPatient = datasets.patients.length ? datasets.patients[0] : null;
    const firstPatientId = firstPatient ? String(firstPatient.patient_id || '').trim() : '';

    addCheck('SUPABASE_PATIENT_SAMPLE_AVAILABLE', !!firstPatientId, {
      first_patient_id: firstPatientId,
      patient_count: datasets.patients.length
    });

    if (firstPatientId) {
      const foundPatient = PatientRepository.findPatientById(firstPatientId, supabaseOptions);
      const appointments = PatientRepository.listAppointmentsByPatientId(firstPatientId, supabaseOptions);
      const treatments = PatientRepository.listTreatmentsByPatientId(firstPatientId, supabaseOptions);
      const medicalRecords = PatientRepository.listMedicalRecordsByPatientId(firstPatientId, supabaseOptions);
      const photos = PatientRepository.listPatientPhotosByPatientId(firstPatientId, supabaseOptions);
      const recalls = PatientRepository.listOrthoRecallByPatientId(firstPatientId, supabaseOptions);
      const activeRecall = PatientRepository.findActiveOrthoRecallByPatientId(firstPatientId, supabaseOptions);

      addCheck('SUPABASE_PATIENT_FIND_BY_ID', !!foundPatient, {
        patient_id: firstPatientId
      });

      addCheck('SUPABASE_PATIENT_LIST_RELATED_ROWS', true, {
        patient_id: firstPatientId,
        appointment_count: appointments.length,
        treatment_count: treatments.length,
        medical_record_count: medicalRecords.length,
        photo_count: photos.length,
        recall_count: recalls.length,
        has_active_recall: !!activeRecall
      });

      const firstTreatment = treatments.length ? treatments[0] : null;
      const firstTreatmentId = firstTreatment ? String(firstTreatment.treatment_id || '').trim() : '';

      if (firstTreatmentId) {
        const treatmentItems = PatientRepository.listTreatmentItemsByTreatmentId(firstTreatmentId, supabaseOptions);

        addCheck('SUPABASE_PATIENT_TREATMENT_ITEMS_BY_TREATMENT', Array.isArray(treatmentItems), {
          treatment_id: firstTreatmentId,
          treatment_item_count: treatmentItems.length
        });
      }
    }

    const ctx = PatientRepository.buildRawContext({
      backend_mode: 'supabase',
      only: {
        patients: true,
        appointments: true,
        treatments: true,
        treatmentItems: true,
        medicalRecords: true,
        patientPhotos: true,
        orthoRecall: true
      }
    });

    addCheck('SUPABASE_PATIENT_CONTEXT_BACKEND_MODE', ctx.backend_mode === 'supabase', {
      actual: ctx.backend_mode
    });

    addCheck('SUPABASE_PATIENT_CONTEXT_ROWS_ARRAY', Array.isArray(ctx.patients) && Array.isArray(ctx.treatments), {
      patient_count: Array.isArray(ctx.patients) ? ctx.patients.length : -1,
      treatment_count: Array.isArray(ctx.treatments) ? ctx.treatments.length : -1
    });

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    addCheck('SUPABASE_PATIENT_WRITE_STILL_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6D',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientRepositoryPhase6DSpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6D',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    tests: [],
    issue_count: 0,
    issues: []
  };

  function addTest(name, testResult) {
    const success = !!(testResult && testResult.success);

    result.tests.push({
      name: name,
      success: success,
      issue_count: testResult && typeof testResult.issue_count !== 'undefined'
        ? testResult.issue_count
        : null
    });

    if (!success) {
      result.issues.push({
        test: name,
        issue: 'REGRESSION_TEST_FAILED',
        result: testResult || null
      });
    }
  }

  try {
    addTest('testPatientRepositoryPhase3FReadOnly', testPatientRepositoryPhase3FReadOnly());
    addTest('testPatientRepositoryPhase3FBuildRawContext', testPatientRepositoryPhase3FBuildRawContext());
    addTest('testPatientRepositoryPhase3FFindPatientSample', testPatientRepositoryPhase3FFindPatientSample());
    addTest('testPatientRepositoryPhase3FContextFinderSample', testPatientRepositoryPhase3FContextFinderSample());

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6D',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   PHASE 7C - PATIENT MUTATION PREFLIGHT
   Read-only preflight. Aman dijalankan. Tidak menulis data.
   ========================================================= */

const PATIENT_PHASE_7C_TEST_PATIENT = Object.freeze({
  PATIENT_ID: 'PAT-7C-TEST-001',
  PATIENT_CODE: 'RM-7C-TEST-001',
  FULL_NAME: 'Zz Test Patient Supabase',
  FULL_NAME_UPDATED: 'Zz Test Patient Supabase Updated',
  GENDER: 'Laki-laki',
  BIRTH_DATE: '1990-01-15',
  PHONE: '+6287770007001',
  PHONE_UPDATED: '+6287770007002',
  EMAIL: 'zz.test.patient.supabase.7c@example.com',
  EMAIL_UPDATED: 'zz.test.patient.supabase.7c.updated@example.com',
  ADDRESS: 'Alamat test Supabase staging 7C',
  ADDRESS_UPDATED: 'Alamat test Supabase staging 7C updated'
});

function buildPatientPhase7CTestPatientPayload_() {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

  return {
    patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
    patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
    full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
    gender: PATIENT_PHASE_7C_TEST_PATIENT.GENDER,
    birth_date: PATIENT_PHASE_7C_TEST_PATIENT.BIRTH_DATE,
    phone: PATIENT_PHASE_7C_TEST_PATIENT.PHONE,
    email: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL,

    guardian_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_email: '',

    address: PATIENT_PHASE_7C_TEST_PATIENT.ADDRESS,
    allergy_notes: 'Tidak ada alergi - test 7C',
    medical_notes: 'Catatan medis dummy untuk test 7C',
    first_clinic_id: '',
    is_active: true,
    created_at: now,
    updated_at: now
  };
}

function findPatientPhase7CByField_(rows, fieldName, value) {
  const normalizedFieldName = String(fieldName || '').trim();
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedFieldName || !normalizedValue) return null;

  return (Array.isArray(rows) ? rows : []).find(function(row) {
    return String(row[normalizedFieldName] || '').trim().toLowerCase() === normalizedValue;
  }) || null;
}

function testPatientPhase7CPreflightLog() {
  const result = {
    success: true,
    stage: '7C-1',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_updated: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    },
    counts: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_OFF', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetPatients = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabasePatients = PatientRepository.getPatientsRaw(supabaseOptions);
    const supabaseActivePatients = PatientRepository.listActivePatients(supabaseOptions);
    const supabaseInactivePatients = PatientRepository.listInactivePatients(supabaseOptions);

    result.counts.spreadsheet_patients = Array.isArray(spreadsheetPatients) ? spreadsheetPatients.length : -1;
    result.counts.supabase_patients = Array.isArray(supabasePatients) ? supabasePatients.length : -1;
    result.counts.supabase_active_patients = Array.isArray(supabaseActivePatients) ? supabaseActivePatients.length : -1;
    result.counts.supabase_inactive_patients = Array.isArray(supabaseInactivePatients) ? supabaseInactivePatients.length : -1;

    addCheck('SUPABASE_PATIENTS_READABLE', Array.isArray(supabasePatients), {
      row_count: result.counts.supabase_patients
    });

    addCheck('SUPABASE_PATIENTS_BASELINE_COUNT_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH', result.counts.supabase_patients === result.counts.supabase_active_patients + result.counts.supabase_inactive_patients, {
      patient_count: result.counts.supabase_patients,
      active_count: result.counts.supabase_active_patients,
      inactive_count: result.counts.supabase_inactive_patients
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_BASELINE_285_0', result.counts.supabase_active_patients === 285 && result.counts.supabase_inactive_patients === 0, {
      active_count: result.counts.supabase_active_patients,
      expected_active_count: 285,
      inactive_count: result.counts.supabase_inactive_patients,
      expected_inactive_count: 0
    });

    const existingById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const existingByCode = findPatientPhase7CByField_(
      supabasePatients,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const existingByName = findPatientPhase7CByField_(
      supabasePatients,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const existingByUpdatedName = findPatientPhase7CByField_(
      supabasePatients,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const existingByPhone = findPatientPhase7CByField_(
      supabasePatients,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const existingByUpdatedPhone = findPatientPhase7CByField_(
      supabasePatients,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const existingByEmail = findPatientPhase7CByField_(
      supabasePatients,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const existingByUpdatedEmail = findPatientPhase7CByField_(
      supabasePatients,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    addCheck('TEST_PATIENT_NOT_EXISTING_BEFORE_7C', !(
      existingById ||
      existingByCode ||
      existingByName ||
      existingByUpdatedName ||
      existingByPhone ||
      existingByUpdatedPhone ||
      existingByEmail ||
      existingByUpdatedEmail
    ), {
      by_id_exists: !!existingById,
      by_code_exists: !!existingByCode,
      by_name_exists: !!existingByName,
      by_updated_name_exists: !!existingByUpdatedName,
      by_phone_exists: !!existingByPhone,
      by_updated_phone_exists: !!existingByUpdatedPhone,
      by_email_exists: !!existingByEmail,
      by_updated_email_exists: !!existingByUpdatedEmail
    });

    const payload = buildPatientPhase7CTestPatientPayload_();

    addCheck('TEST_PATIENT_PAYLOAD_VALID_SHAPE', !!(
      payload &&
      payload.patient_id === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID &&
      payload.patient_code === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE &&
      payload.full_name === PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME &&
      payload.gender === PATIENT_PHASE_7C_TEST_PATIENT.GENDER &&
      payload.birth_date === PATIENT_PHASE_7C_TEST_PATIENT.BIRTH_DATE &&
      payload.phone === PATIENT_PHASE_7C_TEST_PATIENT.PHONE &&
      payload.email === PATIENT_PHASE_7C_TEST_PATIENT.EMAIL &&
      payload.address === PATIENT_PHASE_7C_TEST_PATIENT.ADDRESS &&
      payload.is_active === true
    ), {
      payload: payload
    });

    let explicitInsertBlocked = false;
    let explicitInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.PATIENTS,
        payload,
        {
          stage: '7C'
        }
      );
    } catch (errInsert) {
      explicitInsertBlocked = true;
      explicitInsertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('PATIENT_INSERT_STILL_BLOCKED_WHEN_FLAG_FALSE', explicitInsertBlocked, {
      message: explicitInsertMessage
    });

    const supabasePatientsAfterBlockedInsert = PatientRepository.getPatientsRaw(supabaseOptions);
    const afterById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    result.counts.supabase_patients_after_blocked_insert = Array.isArray(supabasePatientsAfterBlockedInsert)
      ? supabasePatientsAfterBlockedInsert.length
      : -1;

    addCheck('SUPABASE_PATIENT_COUNT_UNCHANGED_AFTER_BLOCKED_INSERT', result.counts.supabase_patients_after_blocked_insert === result.counts.supabase_patients, {
      before_count: result.counts.supabase_patients,
      after_count: result.counts.supabase_patients_after_blocked_insert
    });

    addCheck('TEST_PATIENT_STILL_NOT_INSERTED_AFTER_BLOCKED_INSERT', !afterById, {
      patient_id_exists: !!afterById
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-1',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CInsertDummyPatientDefaultOffLog() {
  const result = {
    success: true,
    stage: '7C-2',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    },
    counts_before: {},
    counts_after: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_OFF', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const beforeRows = PatientRepository.getPatientsRaw(supabaseOptions);

    const beforeById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const beforeByCode = findPatientPhase7CByField_(
      beforeRows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const beforeByName = findPatientPhase7CByField_(
      beforeRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const beforeByPhone = findPatientPhase7CByField_(
      beforeRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const beforeByEmail = findPatientPhase7CByField_(
      beforeRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    result.counts_before.supabase_patients = Array.isArray(beforeRows) ? beforeRows.length : -1;

    addCheck('BASELINE_PATIENT_COUNT_285_BEFORE_INSERT_TEST', result.counts_before.supabase_patients === 285, {
      actual: result.counts_before.supabase_patients,
      expected: 285
    });

    addCheck('TEST_PATIENT_NOT_EXISTING_BEFORE_INSERT_TEST', !(
      beforeById ||
      beforeByCode ||
      beforeByName ||
      beforeByPhone ||
      beforeByEmail
    ), {
      by_id_exists: !!beforeById,
      by_code_exists: !!beforeByCode,
      by_name_exists: !!beforeByName,
      by_phone_exists: !!beforeByPhone,
      by_email_exists: !!beforeByEmail
    });

    const payload = buildPatientPhase7CTestPatientPayload_();

    let insertBlocked = false;
    let insertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.PATIENTS,
        payload,
        {
          stage: '7C'
        }
      );
    } catch (errInsert) {
      insertBlocked = true;
      insertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('DUMMY_PATIENT_INSERT_BLOCKED_WHEN_FLAG_FALSE', insertBlocked, {
      message: insertMessage
    });

    const afterRows = PatientRepository.getPatientsRaw(supabaseOptions);

    const afterById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const afterByCode = findPatientPhase7CByField_(
      afterRows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const afterByName = findPatientPhase7CByField_(
      afterRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const afterByPhone = findPatientPhase7CByField_(
      afterRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const afterByEmail = findPatientPhase7CByField_(
      afterRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    result.counts_after.supabase_patients = Array.isArray(afterRows) ? afterRows.length : -1;

    addCheck('PATIENT_COUNT_UNCHANGED_AFTER_BLOCKED_INSERT', result.counts_after.supabase_patients === result.counts_before.supabase_patients, {
      before_count: result.counts_before.supabase_patients,
      after_count: result.counts_after.supabase_patients
    });

    addCheck('TEST_PATIENT_STILL_NOT_INSERTED_AFTER_BLOCKED_INSERT', !(
      afterById ||
      afterByCode ||
      afterByName ||
      afterByPhone ||
      afterByEmail
    ), {
      by_id_exists: !!afterById,
      by_code_exists: !!afterByCode,
      by_name_exists: !!afterByName,
      by_phone_exists: !!afterByPhone,
      by_email_exists: !!afterByEmail
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-2',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CWriteFlagEnabledPreMutationLog() {
  const result = {
    success: true,
    stage: '7C-3',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    },
    counts: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const rows = PatientRepository.getPatientsRaw(supabaseOptions);

    const existingById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const existingByCode = findPatientPhase7CByField_(
      rows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const existingByName = findPatientPhase7CByField_(
      rows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const existingByUpdatedName = findPatientPhase7CByField_(
      rows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const existingByPhone = findPatientPhase7CByField_(
      rows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const existingByUpdatedPhone = findPatientPhase7CByField_(
      rows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const existingByEmail = findPatientPhase7CByField_(
      rows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const existingByUpdatedEmail = findPatientPhase7CByField_(
      rows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.counts.supabase_patients = Array.isArray(rows) ? rows.length : -1;

    addCheck('SUPABASE_PATIENT_COUNT_STILL_BASELINE_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('TEST_PATIENT_STILL_NOT_EXISTING_BEFORE_REAL_INSERT', !(
      existingById ||
      existingByCode ||
      existingByName ||
      existingByUpdatedName ||
      existingByPhone ||
      existingByUpdatedPhone ||
      existingByEmail ||
      existingByUpdatedEmail
    ), {
      by_id_exists: !!existingById,
      by_code_exists: !!existingByCode,
      by_name_exists: !!existingByName,
      by_updated_name_exists: !!existingByUpdatedName,
      by_phone_exists: !!existingByPhone,
      by_updated_phone_exists: !!existingByUpdatedPhone,
      by_email_exists: !!existingByEmail,
      by_updated_email_exists: !!existingByUpdatedEmail
    });

    const writeCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7C',
      table_name: REPO_TABLES.PATIENTS,
      operation: 'TEST_PATIENT_WRITE_7C'
    });

    addCheck('PATIENT_WRITE_GUARD_ALLOWS_7C_WHEN_FLAG_TRUE', writeCheck.allowed === true, {
      allowed: writeCheck.allowed,
      message: writeCheck.message
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7C'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_EVEN_WHEN_WRITE_FLAG_TRUE', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-3',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CInsertDummyPatientLog() {
  const result = {
    success: true,
    stage: '7C-4',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    },
    counts_before: {},
    counts_after: {},
    insert_result: {},
    readback: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseBefore = PatientRepository.getPatientsRaw(supabaseOptions);

    const existingByIdBefore = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const existingByCodeBefore = findPatientPhase7CByField_(
      supabaseBefore,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const existingByNameBefore = findPatientPhase7CByField_(
      supabaseBefore,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const existingByPhoneBefore = findPatientPhase7CByField_(
      supabaseBefore,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const existingByEmailBefore = findPatientPhase7CByField_(
      supabaseBefore,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    result.counts_before.spreadsheet_patients = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    addCheck('SUPABASE_PATIENT_COUNT_BASELINE_285_BEFORE_INSERT', result.counts_before.supabase_patients === 285, {
      actual: result.counts_before.supabase_patients,
      expected: 285
    });

    addCheck('TEST_PATIENT_NOT_EXISTING_BEFORE_INSERT', !(
      existingByIdBefore ||
      existingByCodeBefore ||
      existingByNameBefore ||
      existingByPhoneBefore ||
      existingByEmailBefore
    ), {
      by_id_exists: !!existingByIdBefore,
      by_code_exists: !!existingByCodeBefore,
      by_name_exists: !!existingByNameBefore,
      by_phone_exists: !!existingByPhoneBefore,
      by_email_exists: !!existingByEmailBefore
    });

    if (
      existingByIdBefore ||
      existingByCodeBefore ||
      existingByNameBefore ||
      existingByPhoneBefore ||
      existingByEmailBefore
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const payload = buildPatientPhase7CTestPatientPayload_();

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.PATIENTS,
      payload,
      {
        stage: '7C'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('DUMMY_PATIENT_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetAfter = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseAfter = PatientRepository.getPatientsRaw(supabaseOptions);

    const insertedById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const insertedByCode = findPatientPhase7CByField_(
      supabaseAfter,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const insertedByName = findPatientPhase7CByField_(
      supabaseAfter,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const insertedByPhone = findPatientPhase7CByField_(
      supabaseAfter,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const insertedByEmail = findPatientPhase7CByField_(
      supabaseAfter,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    result.counts_after.spreadsheet_patients = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_patients = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.readback.by_id = insertedById ? {
      patient_id: String(insertedById.patient_id || '').trim(),
      patient_code: String(insertedById.patient_code || '').trim(),
      full_name: String(insertedById.full_name || '').trim(),
      gender: String(insertedById.gender || '').trim(),
      birth_date: String(insertedById.birth_date || '').slice(0, 10),
      phone: String(insertedById.phone || '').trim(),
      email: String(insertedById.email || '').trim(),
      address: String(insertedById.address || '').trim(),
      is_active: insertedById.is_active
    } : null;

    addCheck('SPREADSHEET_PATIENT_COUNT_UNCHANGED_AFTER_SUPABASE_INSERT', result.counts_after.spreadsheet_patients === result.counts_before.spreadsheet_patients, {
      before_count: result.counts_before.spreadsheet_patients,
      after_count: result.counts_after.spreadsheet_patients
    });

    addCheck('SUPABASE_PATIENT_COUNT_INCREASED_TO_286_AFTER_INSERT', result.counts_after.supabase_patients === 286, {
      before_count: result.counts_before.supabase_patients,
      after_count: result.counts_after.supabase_patients,
      expected_after_count: 286
    });

    addCheck('DUMMY_PATIENT_READBACK_BY_ID_FOUND', !!insertedById, {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID
    });

    addCheck('DUMMY_PATIENT_READBACK_BY_CODE_FOUND', !!insertedByCode, {
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    });

    addCheck('DUMMY_PATIENT_READBACK_BY_NAME_FOUND', !!insertedByName, {
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    });

    addCheck('DUMMY_PATIENT_READBACK_BY_PHONE_FOUND', !!insertedByPhone, {
      phone: PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    });

    addCheck('DUMMY_PATIENT_READBACK_BY_EMAIL_FOUND', !!insertedByEmail, {
      email: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    });

    addCheck('DUMMY_PATIENT_READBACK_FIELDS_MATCH', !!(
      insertedById &&
      String(insertedById.patient_id || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID &&
      String(insertedById.patient_code || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE &&
      String(insertedById.full_name || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME &&
      String(insertedById.gender || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.GENDER &&
      String(insertedById.birth_date || '').slice(0, 10) === PATIENT_PHASE_7C_TEST_PATIENT.BIRTH_DATE &&
      String(insertedById.phone || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PHONE &&
      String(insertedById.email || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.EMAIL &&
      String(insertedById.address || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.ADDRESS &&
      boolTrue_(insertedById.is_active)
    ), {
      readback: result.readback.by_id
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-4',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CInspectSupabasePatientColumnsLog() {
  const result = {
    success: true,
    stage: '7C-4A-InspectColumns',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    sample_patient_id: '',
    column_count: 0,
    columns: [],
    expected_payload_columns: [],
    missing_from_supabase: [],
    extra_in_supabase: [],
    issue_count: 0,
    issues: []
  };

  try {
    const rows = PatientRepository.getPatientsRaw({
      backend_mode: 'supabase',
      limit: 1
    });

    if (!Array.isArray(rows) || !rows.length) {
      result.success = false;
      result.issues.push({
        issue: 'NO_SUPABASE_PATIENT_SAMPLE'
      });
      result.issue_count = result.issues.length;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const sample = rows[0] || {};
    const columns = Object.keys(sample).sort();

    const payload = buildPatientPhase7CTestPatientPayload_();
    const expectedPayloadColumns = Object.keys(payload).sort();

    result.sample_patient_id = String(sample.patient_id || '').trim();
    result.column_count = columns.length;
    result.columns = columns;
    result.expected_payload_columns = expectedPayloadColumns;

    result.missing_from_supabase = expectedPayloadColumns.filter(function(key) {
      return columns.indexOf(key) === -1;
    });

    result.extra_in_supabase = columns.filter(function(key) {
      return expectedPayloadColumns.indexOf(key) === -1;
    });

    if (result.missing_from_supabase.length) {
      result.issues.push({
        issue: 'PAYLOAD_COLUMNS_NOT_IN_SUPABASE_PATIENTS',
        columns: result.missing_from_supabase
      });
    }

    result.issue_count = result.issues.length;

    // Test ini tetap dianggap sukses sebagai diagnostik meski menemukan missing columns.
    result.success = true;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-4A-InspectColumns',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CReadBackInsertedDummyPatientLog() {
  const result = {
    success: true,
    stage: '7C-5',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_updated: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    },
    counts: {},
    readback: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const expected = buildPatientPhase7CTestPatientPayload_();

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7C', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseRows = PatientRepository.getPatientsRaw(supabaseOptions);
    const activeRows = PatientRepository.listActivePatients(supabaseOptions);
    const inactiveRows = PatientRepository.listInactivePatients(supabaseOptions);

    result.counts.spreadsheet_patients = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_patients = Array.isArray(supabaseRows) ? supabaseRows.length : -1;
    result.counts.supabase_active_patients = Array.isArray(activeRows) ? activeRows.length : -1;
    result.counts.supabase_inactive_patients = Array.isArray(inactiveRows) ? inactiveRows.length : -1;

    addCheck('SPREADSHEET_PATIENT_COUNT_STILL_UNCHANGED_311', result.counts.spreadsheet_patients === 311, {
      actual: result.counts.spreadsheet_patients,
      expected: 311
    });

    addCheck('SUPABASE_PATIENT_COUNT_NOW_286', result.counts.supabase_patients === 286, {
      actual: result.counts.supabase_patients,
      expected: 286
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH_AFTER_INSERT', result.counts.supabase_patients === result.counts.supabase_active_patients + result.counts.supabase_inactive_patients, {
      patient_count: result.counts.supabase_patients,
      active_count: result.counts.supabase_active_patients,
      inactive_count: result.counts.supabase_inactive_patients
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_AFTER_INSERT_286_0', result.counts.supabase_active_patients === 286 && result.counts.supabase_inactive_patients === 0, {
      active_count: result.counts.supabase_active_patients,
      expected_active_count: 286,
      inactive_count: result.counts.supabase_inactive_patients,
      expected_inactive_count: 0
    });

    const patientById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientByCode = findPatientPhase7CByField_(
      supabaseRows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const patientByName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientByUpdatedName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientByPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientByUpdatedPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientByEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientByUpdatedEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.readback.by_id = patientById ? {
      patient_id: String(patientById.patient_id || '').trim(),
      patient_code: String(patientById.patient_code || '').trim(),
      full_name: String(patientById.full_name || '').trim(),
      gender: String(patientById.gender || '').trim(),
      birth_date: String(patientById.birth_date || '').slice(0, 10),
      phone: String(patientById.phone || '').trim(),
      email: String(patientById.email || '').trim(),
      guardian_name: String(patientById.guardian_name || '').trim(),
      guardian_relationship: String(patientById.guardian_relationship || '').trim(),
      guardian_phone: String(patientById.guardian_phone || '').trim(),
      guardian_email: String(patientById.guardian_email || '').trim(),
      address: String(patientById.address || '').trim(),
      allergy_notes: String(patientById.allergy_notes || '').trim(),
      medical_notes: String(patientById.medical_notes || '').trim(),
      first_clinic_id: String(patientById.first_clinic_id || '').trim(),
      is_active: patientById.is_active
    } : null;

    addCheck('DUMMY_PATIENT_FOUND_BY_ID_AFTER_INSERT', !!patientById, {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID
    });

    addCheck('DUMMY_PATIENT_FOUND_BY_CODE_AFTER_INSERT', !!patientByCode, {
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    });

    addCheck('DUMMY_PATIENT_FOUND_BY_NAME_AFTER_INSERT', !!patientByName, {
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    });

    addCheck('DUMMY_PATIENT_UPDATED_NAME_NOT_YET_EXISTING', !patientByUpdatedName, {
      full_name_updated: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      exists: !!patientByUpdatedName
    });

    addCheck('DUMMY_PATIENT_FOUND_BY_PHONE_AFTER_INSERT', !!patientByPhone, {
      phone: PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    });

    addCheck('DUMMY_PATIENT_UPDATED_PHONE_NOT_YET_EXISTING', !patientByUpdatedPhone, {
      phone_updated: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      exists: !!patientByUpdatedPhone
    });

    addCheck('DUMMY_PATIENT_FOUND_BY_EMAIL_AFTER_INSERT', !!patientByEmail, {
      email: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    });

    addCheck('DUMMY_PATIENT_UPDATED_EMAIL_NOT_YET_EXISTING', !patientByUpdatedEmail, {
      email_updated: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED,
      exists: !!patientByUpdatedEmail
    });

    addCheck('DUMMY_PATIENT_FIELDS_MATCH_AFTER_INSERT', !!(
      patientById &&
      String(patientById.patient_id || '').trim() === expected.patient_id &&
      String(patientById.patient_code || '').trim() === expected.patient_code &&
      String(patientById.full_name || '').trim() === expected.full_name &&
      String(patientById.gender || '').trim() === expected.gender &&
      String(patientById.birth_date || '').slice(0, 10) === expected.birth_date &&
      String(patientById.phone || '').trim() === expected.phone &&
      String(patientById.email || '').trim() === expected.email &&
      String(patientById.guardian_name || '').trim() === expected.guardian_name &&
      String(patientById.guardian_relationship || '').trim() === expected.guardian_relationship &&
      String(patientById.guardian_phone || '').trim() === expected.guardian_phone &&
      String(patientById.guardian_email || '').trim() === expected.guardian_email &&
      String(patientById.address || '').trim() === expected.address &&
      String(patientById.allergy_notes || '').trim() === expected.allergy_notes &&
      String(patientById.medical_notes || '').trim() === expected.medical_notes &&
      String(patientById.first_clinic_id || '').trim() === expected.first_clinic_id &&
      boolTrue_(patientById.is_active)
    ), {
      readback: result.readback.by_id
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-5',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CUpdateDummyPatientLog() {
  const result = {
    success: true,
    stage: '7C-6',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      full_name_before: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_after: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      phone_before: PATIENT_PHASE_7C_TEST_PATIENT.PHONE,
      phone_after: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      email_before: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL,
      email_after: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    },
    counts_before: {},
    counts_after: {},
    update_result: {},
    readback: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7C', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseBefore = PatientRepository.getPatientsRaw(supabaseOptions);

    const patientBeforeById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientBeforeByName = findPatientPhase7CByField_(
      supabaseBefore,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientBeforeByUpdatedName = findPatientPhase7CByField_(
      supabaseBefore,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientBeforeByPhone = findPatientPhase7CByField_(
      supabaseBefore,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientBeforeByUpdatedPhone = findPatientPhase7CByField_(
      supabaseBefore,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientBeforeByEmail = findPatientPhase7CByField_(
      supabaseBefore,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientBeforeByUpdatedEmail = findPatientPhase7CByField_(
      supabaseBefore,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.counts_before.spreadsheet_patients = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    addCheck('SPREADSHEET_PATIENT_COUNT_STILL_311_BEFORE_UPDATE', result.counts_before.spreadsheet_patients === 311, {
      actual: result.counts_before.spreadsheet_patients,
      expected: 311
    });

    addCheck('SUPABASE_PATIENT_COUNT_STILL_286_BEFORE_UPDATE', result.counts_before.supabase_patients === 286, {
      actual: result.counts_before.supabase_patients,
      expected: 286
    });

    addCheck('DUMMY_PATIENT_EXISTS_BEFORE_UPDATE', !!(
      patientBeforeById &&
      patientBeforeByName &&
      patientBeforeByPhone &&
      patientBeforeByEmail &&
      !patientBeforeByUpdatedName &&
      !patientBeforeByUpdatedPhone &&
      !patientBeforeByUpdatedEmail
    ), {
      by_id_exists: !!patientBeforeById,
      by_old_name_exists: !!patientBeforeByName,
      by_updated_name_exists: !!patientBeforeByUpdatedName,
      by_old_phone_exists: !!patientBeforeByPhone,
      by_updated_phone_exists: !!patientBeforeByUpdatedPhone,
      by_old_email_exists: !!patientBeforeByEmail,
      by_updated_email_exists: !!patientBeforeByUpdatedEmail
    });

    if (
      !patientBeforeById ||
      !patientBeforeByName ||
      !patientBeforeByPhone ||
      !patientBeforeByEmail ||
      patientBeforeByUpdatedName ||
      patientBeforeByUpdatedPhone ||
      patientBeforeByUpdatedEmail
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const patch = {
      full_name: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      phone: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      email: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED,
      guardian_name: 'Wali Test 7C',
      guardian_relationship: 'Saudara',
      guardian_phone: '+6287770007998',
      guardian_email: 'wali.test.patient.supabase.7c@example.com',
      address: PATIENT_PHASE_7C_TEST_PATIENT.ADDRESS_UPDATED,
      allergy_notes: 'Catatan alergi updated - test 7C',
      medical_notes: 'Catatan medis updated - test 7C',
      first_clinic_id: 'CLINIC-7C-TEST',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    const updateResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.PATIENTS,
      'patient_id',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patch,
      {
        stage: '7C'
      }
    );

    result.update_result = {
      success: !!(updateResponse && updateResponse.success),
      status_code: updateResponse ? updateResponse.status_code : null,
      row_count: updateResponse ? updateResponse.row_count : null,
      target_table: updateResponse ? updateResponse.target_table : ''
    };

    addCheck('DUMMY_PATIENT_UPDATE_RESPONSE_SUCCESS', !!(updateResponse && updateResponse.success), result.update_result);

    const spreadsheetAfter = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseAfter = PatientRepository.getPatientsRaw(supabaseOptions);

    const patientAfterById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientAfterByOldName = findPatientPhase7CByField_(
      supabaseAfter,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientAfterByUpdatedName = findPatientPhase7CByField_(
      supabaseAfter,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientAfterByOldPhone = findPatientPhase7CByField_(
      supabaseAfter,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientAfterByUpdatedPhone = findPatientPhase7CByField_(
      supabaseAfter,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientAfterByOldEmail = findPatientPhase7CByField_(
      supabaseAfter,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientAfterByUpdatedEmail = findPatientPhase7CByField_(
      supabaseAfter,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.counts_after.spreadsheet_patients = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_patients = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.readback.by_id = patientAfterById ? {
      patient_id: String(patientAfterById.patient_id || '').trim(),
      patient_code: String(patientAfterById.patient_code || '').trim(),
      full_name: String(patientAfterById.full_name || '').trim(),
      gender: String(patientAfterById.gender || '').trim(),
      birth_date: String(patientAfterById.birth_date || '').slice(0, 10),
      phone: String(patientAfterById.phone || '').trim(),
      email: String(patientAfterById.email || '').trim(),
      guardian_name: String(patientAfterById.guardian_name || '').trim(),
      guardian_relationship: String(patientAfterById.guardian_relationship || '').trim(),
      guardian_phone: String(patientAfterById.guardian_phone || '').trim(),
      guardian_email: String(patientAfterById.guardian_email || '').trim(),
      address: String(patientAfterById.address || '').trim(),
      allergy_notes: String(patientAfterById.allergy_notes || '').trim(),
      medical_notes: String(patientAfterById.medical_notes || '').trim(),
      first_clinic_id: String(patientAfterById.first_clinic_id || '').trim(),
      is_active: patientAfterById.is_active
    } : null;

    addCheck('SPREADSHEET_PATIENT_COUNT_UNCHANGED_AFTER_SUPABASE_UPDATE', result.counts_after.spreadsheet_patients === result.counts_before.spreadsheet_patients, {
      before_count: result.counts_before.spreadsheet_patients,
      after_count: result.counts_after.spreadsheet_patients
    });

    addCheck('SUPABASE_PATIENT_COUNT_UNCHANGED_286_AFTER_UPDATE', result.counts_after.supabase_patients === result.counts_before.supabase_patients, {
      before_count: result.counts_before.supabase_patients,
      after_count: result.counts_after.supabase_patients
    });

    addCheck('DUMMY_PATIENT_FOUND_BY_ID_AFTER_UPDATE', !!patientAfterById, {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID
    });

    addCheck('DUMMY_PATIENT_OLD_NAME_PHONE_EMAIL_NOT_FOUND_AFTER_UPDATE', !(
      patientAfterByOldName ||
      patientAfterByOldPhone ||
      patientAfterByOldEmail
    ), {
      old_name_exists: !!patientAfterByOldName,
      old_phone_exists: !!patientAfterByOldPhone,
      old_email_exists: !!patientAfterByOldEmail
    });

    addCheck('DUMMY_PATIENT_UPDATED_NAME_PHONE_EMAIL_FOUND_AFTER_UPDATE', !!(
      patientAfterByUpdatedName &&
      patientAfterByUpdatedPhone &&
      patientAfterByUpdatedEmail
    ), {
      updated_name_exists: !!patientAfterByUpdatedName,
      updated_phone_exists: !!patientAfterByUpdatedPhone,
      updated_email_exists: !!patientAfterByUpdatedEmail
    });

    addCheck('DUMMY_PATIENT_FIELDS_MATCH_AFTER_UPDATE', !!(
      patientAfterById &&
      String(patientAfterById.patient_id || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID &&
      String(patientAfterById.patient_code || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE &&
      String(patientAfterById.full_name || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED &&
      String(patientAfterById.gender || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.GENDER &&
      String(patientAfterById.birth_date || '').slice(0, 10) === PATIENT_PHASE_7C_TEST_PATIENT.BIRTH_DATE &&
      String(patientAfterById.phone || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED &&
      String(patientAfterById.email || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED &&
      String(patientAfterById.guardian_name || '').trim() === patch.guardian_name &&
      String(patientAfterById.guardian_relationship || '').trim() === patch.guardian_relationship &&
      String(patientAfterById.guardian_phone || '').trim() === patch.guardian_phone &&
      String(patientAfterById.guardian_email || '').trim() === patch.guardian_email &&
      String(patientAfterById.address || '').trim() === patch.address &&
      String(patientAfterById.allergy_notes || '').trim() === patch.allergy_notes &&
      String(patientAfterById.medical_notes || '').trim() === patch.medical_notes &&
      String(patientAfterById.first_clinic_id || '').trim() === patch.first_clinic_id &&
      boolTrue_(patientAfterById.is_active)
    ), {
      readback: result.readback.by_id
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-6',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CReadBackUpdatedDummyPatientLog() {
  const result = {
    success: true,
    stage: '7C-7',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name_before: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_after: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      phone_before: PATIENT_PHASE_7C_TEST_PATIENT.PHONE,
      phone_after: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      email_before: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL,
      email_after: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    },
    counts: {},
    readback: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7C', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseRows = PatientRepository.getPatientsRaw(supabaseOptions);
    const activeRows = PatientRepository.listActivePatients(supabaseOptions);
    const inactiveRows = PatientRepository.listInactivePatients(supabaseOptions);

    result.counts.spreadsheet_patients = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_patients = Array.isArray(supabaseRows) ? supabaseRows.length : -1;
    result.counts.supabase_active_patients = Array.isArray(activeRows) ? activeRows.length : -1;
    result.counts.supabase_inactive_patients = Array.isArray(inactiveRows) ? inactiveRows.length : -1;

    addCheck('SPREADSHEET_PATIENT_COUNT_STILL_311_AFTER_UPDATE_VERIFY', result.counts.spreadsheet_patients === 311, {
      actual: result.counts.spreadsheet_patients,
      expected: 311
    });

    addCheck('SUPABASE_PATIENT_COUNT_STILL_286_AFTER_UPDATE_VERIFY', result.counts.supabase_patients === 286, {
      actual: result.counts.supabase_patients,
      expected: 286
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH_AFTER_UPDATE_VERIFY', result.counts.supabase_patients === result.counts.supabase_active_patients + result.counts.supabase_inactive_patients, {
      patient_count: result.counts.supabase_patients,
      active_count: result.counts.supabase_active_patients,
      inactive_count: result.counts.supabase_inactive_patients
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_AFTER_UPDATE_286_0', result.counts.supabase_active_patients === 286 && result.counts.supabase_inactive_patients === 0, {
      active_count: result.counts.supabase_active_patients,
      expected_active_count: 286,
      inactive_count: result.counts.supabase_inactive_patients,
      expected_inactive_count: 0
    });

    const patientById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientByCode = findPatientPhase7CByField_(
      supabaseRows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const patientByOldName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientByUpdatedName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientByOldPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientByUpdatedPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientByOldEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientByUpdatedEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.readback.by_id = patientById ? {
      patient_id: String(patientById.patient_id || '').trim(),
      patient_code: String(patientById.patient_code || '').trim(),
      full_name: String(patientById.full_name || '').trim(),
      gender: String(patientById.gender || '').trim(),
      birth_date: String(patientById.birth_date || '').slice(0, 10),
      phone: String(patientById.phone || '').trim(),
      email: String(patientById.email || '').trim(),
      guardian_name: String(patientById.guardian_name || '').trim(),
      guardian_relationship: String(patientById.guardian_relationship || '').trim(),
      guardian_phone: String(patientById.guardian_phone || '').trim(),
      guardian_email: String(patientById.guardian_email || '').trim(),
      address: String(patientById.address || '').trim(),
      allergy_notes: String(patientById.allergy_notes || '').trim(),
      medical_notes: String(patientById.medical_notes || '').trim(),
      first_clinic_id: String(patientById.first_clinic_id || '').trim(),
      is_active: patientById.is_active
    } : null;

    addCheck('DUMMY_PATIENT_FOUND_BY_ID_AFTER_UPDATE_VERIFY', !!patientById, {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID
    });

    addCheck('DUMMY_PATIENT_FOUND_BY_CODE_AFTER_UPDATE_VERIFY', !!patientByCode, {
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    });

    addCheck('DUMMY_PATIENT_OLD_NAME_PHONE_EMAIL_NOT_FOUND_AFTER_UPDATE_VERIFY', !(
      patientByOldName ||
      patientByOldPhone ||
      patientByOldEmail
    ), {
      old_name_exists: !!patientByOldName,
      old_phone_exists: !!patientByOldPhone,
      old_email_exists: !!patientByOldEmail
    });

    addCheck('DUMMY_PATIENT_UPDATED_NAME_PHONE_EMAIL_FOUND_AFTER_UPDATE_VERIFY', !!(
      patientByUpdatedName &&
      patientByUpdatedPhone &&
      patientByUpdatedEmail
    ), {
      updated_name_exists: !!patientByUpdatedName,
      updated_phone_exists: !!patientByUpdatedPhone,
      updated_email_exists: !!patientByUpdatedEmail
    });

    addCheck('DUMMY_PATIENT_FIELDS_MATCH_AFTER_UPDATE_VERIFY', !!(
      patientById &&
      String(patientById.patient_id || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID &&
      String(patientById.patient_code || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE &&
      String(patientById.full_name || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED &&
      String(patientById.gender || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.GENDER &&
      String(patientById.birth_date || '').slice(0, 10) === PATIENT_PHASE_7C_TEST_PATIENT.BIRTH_DATE &&
      String(patientById.phone || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED &&
      String(patientById.email || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED &&
      String(patientById.guardian_name || '').trim() === 'Wali Test 7C' &&
      String(patientById.guardian_relationship || '').trim() === 'Saudara' &&
      String(patientById.guardian_phone || '').trim() === '+6287770007998' &&
      String(patientById.guardian_email || '').trim() === 'wali.test.patient.supabase.7c@example.com' &&
      String(patientById.address || '').trim() === PATIENT_PHASE_7C_TEST_PATIENT.ADDRESS_UPDATED &&
      String(patientById.allergy_notes || '').trim() === 'Catatan alergi updated - test 7C' &&
      String(patientById.medical_notes || '').trim() === 'Catatan medis updated - test 7C' &&
      String(patientById.first_clinic_id || '').trim() === 'CLINIC-7C-TEST' &&
      boolTrue_(patientById.is_active)
    ), {
      readback: result.readback.by_id
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-7',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CDeleteDummyPatientLog() {
  const result = {
    success: true,
    stage: '7C-8',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name_before: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_after: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      phone_before: PATIENT_PHASE_7C_TEST_PATIENT.PHONE,
      phone_after: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      email_before: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL,
      email_after: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    },
    counts_before: {},
    counts_after: {},
    delete_result: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7C', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseBefore = PatientRepository.getPatientsRaw(supabaseOptions);

    const patientBeforeById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientBeforeByCode = findPatientPhase7CByField_(
      supabaseBefore,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const patientBeforeByOldName = findPatientPhase7CByField_(
      supabaseBefore,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientBeforeByUpdatedName = findPatientPhase7CByField_(
      supabaseBefore,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientBeforeByOldPhone = findPatientPhase7CByField_(
      supabaseBefore,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientBeforeByUpdatedPhone = findPatientPhase7CByField_(
      supabaseBefore,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientBeforeByOldEmail = findPatientPhase7CByField_(
      supabaseBefore,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientBeforeByUpdatedEmail = findPatientPhase7CByField_(
      supabaseBefore,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.counts_before.spreadsheet_patients = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    addCheck('SPREADSHEET_PATIENT_COUNT_STILL_311_BEFORE_DELETE', result.counts_before.spreadsheet_patients === 311, {
      actual: result.counts_before.spreadsheet_patients,
      expected: 311
    });

    addCheck('SUPABASE_PATIENT_COUNT_STILL_286_BEFORE_DELETE', result.counts_before.supabase_patients === 286, {
      actual: result.counts_before.supabase_patients,
      expected: 286
    });

    addCheck('DUMMY_PATIENT_EXISTS_BEFORE_DELETE', !!(
      patientBeforeById &&
      patientBeforeByCode &&
      !patientBeforeByOldName &&
      patientBeforeByUpdatedName &&
      !patientBeforeByOldPhone &&
      patientBeforeByUpdatedPhone &&
      !patientBeforeByOldEmail &&
      patientBeforeByUpdatedEmail
    ), {
      by_id_exists: !!patientBeforeById,
      by_code_exists: !!patientBeforeByCode,
      by_old_name_exists: !!patientBeforeByOldName,
      by_updated_name_exists: !!patientBeforeByUpdatedName,
      by_old_phone_exists: !!patientBeforeByOldPhone,
      by_updated_phone_exists: !!patientBeforeByUpdatedPhone,
      by_old_email_exists: !!patientBeforeByOldEmail,
      by_updated_email_exists: !!patientBeforeByUpdatedEmail
    });

    if (
      !patientBeforeById ||
      !patientBeforeByCode ||
      patientBeforeByOldName ||
      !patientBeforeByUpdatedName ||
      patientBeforeByOldPhone ||
      !patientBeforeByUpdatedPhone ||
      patientBeforeByOldEmail ||
      !patientBeforeByUpdatedEmail
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const deleteResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.PATIENTS,
      'patient_id',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      {
        stage: '7C'
      }
    );

    result.delete_result = {
      success: !!(deleteResponse && deleteResponse.success),
      status_code: deleteResponse ? deleteResponse.status_code : null,
      row_count: deleteResponse ? deleteResponse.row_count : null,
      target_table: deleteResponse ? deleteResponse.target_table : ''
    };

    addCheck('DUMMY_PATIENT_DELETE_RESPONSE_SUCCESS', !!(deleteResponse && deleteResponse.success), result.delete_result);

    const spreadsheetAfter = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseAfter = PatientRepository.getPatientsRaw(supabaseOptions);

    const patientAfterById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientAfterByCode = findPatientPhase7CByField_(
      supabaseAfter,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const patientAfterByOldName = findPatientPhase7CByField_(
      supabaseAfter,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientAfterByUpdatedName = findPatientPhase7CByField_(
      supabaseAfter,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientAfterByOldPhone = findPatientPhase7CByField_(
      supabaseAfter,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientAfterByUpdatedPhone = findPatientPhase7CByField_(
      supabaseAfter,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientAfterByOldEmail = findPatientPhase7CByField_(
      supabaseAfter,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientAfterByUpdatedEmail = findPatientPhase7CByField_(
      supabaseAfter,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    result.counts_after.spreadsheet_patients = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_patients = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    addCheck('SPREADSHEET_PATIENT_COUNT_UNCHANGED_AFTER_SUPABASE_DELETE', result.counts_after.spreadsheet_patients === result.counts_before.spreadsheet_patients, {
      before_count: result.counts_before.spreadsheet_patients,
      after_count: result.counts_after.spreadsheet_patients
    });

    addCheck('SUPABASE_PATIENT_COUNT_BACK_TO_285_AFTER_DELETE', result.counts_after.supabase_patients === 285, {
      before_count: result.counts_before.supabase_patients,
      after_count: result.counts_after.supabase_patients,
      expected_after_count: 285
    });

    addCheck('DUMMY_PATIENT_NOT_FOUND_AFTER_DELETE', !(
      patientAfterById ||
      patientAfterByCode ||
      patientAfterByOldName ||
      patientAfterByUpdatedName ||
      patientAfterByOldPhone ||
      patientAfterByUpdatedPhone ||
      patientAfterByOldEmail ||
      patientAfterByUpdatedEmail
    ), {
      by_id_exists: !!patientAfterById,
      by_code_exists: !!patientAfterByCode,
      by_old_name_exists: !!patientAfterByOldName,
      by_updated_name_exists: !!patientAfterByUpdatedName,
      by_old_phone_exists: !!patientAfterByOldPhone,
      by_updated_phone_exists: !!patientAfterByUpdatedPhone,
      by_old_email_exists: !!patientAfterByOldEmail,
      by_updated_email_exists: !!patientAfterByUpdatedEmail
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-8',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CConfirmCleanupLog() {
  const result = {
    success: true,
    stage: '7C-9',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    counts: {},
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name_before: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_after: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      phone_before: PATIENT_PHASE_7C_TEST_PATIENT.PHONE,
      phone_after: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      email_before: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL,
      email_after: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    },
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_CLEANUP_CHECK', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseRows = PatientRepository.getPatientsRaw(supabaseOptions);
    const activeRows = PatientRepository.listActivePatients(supabaseOptions);
    const inactiveRows = PatientRepository.listInactivePatients(supabaseOptions);

    result.counts.spreadsheet_patients = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_patients = Array.isArray(supabaseRows) ? supabaseRows.length : -1;
    result.counts.supabase_active_patients = Array.isArray(activeRows) ? activeRows.length : -1;
    result.counts.supabase_inactive_patients = Array.isArray(inactiveRows) ? inactiveRows.length : -1;

    addCheck('SPREADSHEET_PATIENT_COUNT_STILL_311_AFTER_CLEANUP', result.counts.spreadsheet_patients === 311, {
      actual: result.counts.spreadsheet_patients,
      expected: 311
    });

    addCheck('SUPABASE_PATIENT_COUNT_BACK_TO_BASELINE_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_BACK_TO_BASELINE_285_0', result.counts.supabase_active_patients === 285 && result.counts.supabase_inactive_patients === 0, {
      active_count: result.counts.supabase_active_patients,
      expected_active_count: 285,
      inactive_count: result.counts.supabase_inactive_patients,
      expected_inactive_count: 0
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH_AFTER_CLEANUP', result.counts.supabase_patients === result.counts.supabase_active_patients + result.counts.supabase_inactive_patients, {
      patient_count: result.counts.supabase_patients,
      active_count: result.counts.supabase_active_patients,
      inactive_count: result.counts.supabase_inactive_patients
    });

    const patientById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientByCode = findPatientPhase7CByField_(
      supabaseRows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const patientByOldName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientByUpdatedName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientByOldPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientByUpdatedPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientByOldEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientByUpdatedEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    addCheck('DUMMY_PATIENT_FULLY_CLEANED_UP_BY_ID_CODE_NAME_PHONE_EMAIL', !(
      patientById ||
      patientByCode ||
      patientByOldName ||
      patientByUpdatedName ||
      patientByOldPhone ||
      patientByUpdatedPhone ||
      patientByOldEmail ||
      patientByUpdatedEmail
    ), {
      by_id_exists: !!patientById,
      by_code_exists: !!patientByCode,
      by_old_name_exists: !!patientByOldName,
      by_updated_name_exists: !!patientByUpdatedName,
      by_old_phone_exists: !!patientByOldPhone,
      by_updated_phone_exists: !!patientByUpdatedPhone,
      by_old_email_exists: !!patientByOldEmail,
      by_updated_email_exists: !!patientByUpdatedEmail
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7C-CLEANUP'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_AFTER_7C_MUTATION', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-9',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientPhase7CFinalAuditLog() {
  const result = {
    success: true,
    stage: '7C-11',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
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
    counts: {},
    schema_alignment: {
      column_count: 0,
      missing_from_supabase: [],
      extra_in_supabase: []
    },
    test_patient: {
      patient_id: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      patient_code: PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE,
      full_name_before: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME,
      full_name_after: PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED,
      phone_before: PATIENT_PHASE_7C_TEST_PATIENT.PHONE,
      phone_after: PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED,
      email_before: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL,
      email_after: PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    },
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_BACK_TO_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = PatientRepository.getPatientsRaw(spreadsheetOptions);
    const supabaseRows = PatientRepository.getPatientsRaw(supabaseOptions);
    const activeRows = PatientRepository.listActivePatients(supabaseOptions);
    const inactiveRows = PatientRepository.listInactivePatients(supabaseOptions);

    result.counts.spreadsheet_patients = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_patients = Array.isArray(supabaseRows) ? supabaseRows.length : -1;
    result.counts.supabase_active_patients = Array.isArray(activeRows) ? activeRows.length : -1;
    result.counts.supabase_inactive_patients = Array.isArray(inactiveRows) ? inactiveRows.length : -1;

    addCheck('SPREADSHEET_PATIENTS_STILL_READABLE', Array.isArray(spreadsheetRows) && result.counts.spreadsheet_patients >= 311, {
      actual: result.counts.spreadsheet_patients,
      expected_minimum: 311,
      note: 'Spreadsheet production bisa bertambah jika admin klinik menambah pasien setelah snapshot staging.'
    });

    addCheck('SUPABASE_PATIENTS_BACK_TO_BASELINE_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_FINAL_BASELINE_285_0', result.counts.supabase_active_patients === 285 && result.counts.supabase_inactive_patients === 0, {
      active_count: result.counts.supabase_active_patients,
      expected_active_count: 285,
      inactive_count: result.counts.supabase_inactive_patients,
      expected_inactive_count: 0
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_FINAL_COUNT_MATCH', result.counts.supabase_patients === result.counts.supabase_active_patients + result.counts.supabase_inactive_patients, {
      patient_count: result.counts.supabase_patients,
      active_count: result.counts.supabase_active_patients,
      inactive_count: result.counts.supabase_inactive_patients
    });

    if (Array.isArray(supabaseRows) && supabaseRows.length) {
      const sampleColumns = Object.keys(supabaseRows[0] || {}).sort();
      const payloadColumns = Object.keys(buildPatientPhase7CTestPatientPayload_()).sort();

      result.schema_alignment.column_count = sampleColumns.length;
      result.schema_alignment.missing_from_supabase = payloadColumns.filter(function(key) {
        return sampleColumns.indexOf(key) === -1;
      });
      result.schema_alignment.extra_in_supabase = sampleColumns.filter(function(key) {
        return payloadColumns.indexOf(key) === -1;
      });
    }

    addCheck('PATIENT_SUPABASE_SCHEMA_ALIGNED_WITH_APP_PAYLOAD', result.schema_alignment.missing_from_supabase.length === 0, {
      missing_from_supabase: result.schema_alignment.missing_from_supabase,
      extra_in_supabase: result.schema_alignment.extra_in_supabase
    });

    const patientById = PatientRepository.findPatientById(
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_ID,
      supabaseOptions
    );

    const patientByCode = findPatientPhase7CByField_(
      supabaseRows,
      'patient_code',
      PATIENT_PHASE_7C_TEST_PATIENT.PATIENT_CODE
    );

    const patientByOldName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME
    );

    const patientByUpdatedName = findPatientPhase7CByField_(
      supabaseRows,
      'full_name',
      PATIENT_PHASE_7C_TEST_PATIENT.FULL_NAME_UPDATED
    );

    const patientByOldPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE
    );

    const patientByUpdatedPhone = findPatientPhase7CByField_(
      supabaseRows,
      'phone',
      PATIENT_PHASE_7C_TEST_PATIENT.PHONE_UPDATED
    );

    const patientByOldEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL
    );

    const patientByUpdatedEmail = findPatientPhase7CByField_(
      supabaseRows,
      'email',
      PATIENT_PHASE_7C_TEST_PATIENT.EMAIL_UPDATED
    );

    addCheck('DUMMY_PATIENT_FULLY_CLEANED_UP_FINAL', !(
      patientById ||
      patientByCode ||
      patientByOldName ||
      patientByUpdatedName ||
      patientByOldPhone ||
      patientByUpdatedPhone ||
      patientByOldEmail ||
      patientByUpdatedEmail
    ), {
      by_id_exists: !!patientById,
      by_code_exists: !!patientByCode,
      by_old_name_exists: !!patientByOldName,
      by_updated_name_exists: !!patientByUpdatedName,
      by_old_phone_exists: !!patientByOldPhone,
      by_updated_phone_exists: !!patientByUpdatedPhone,
      by_old_email_exists: !!patientByOldEmail,
      by_updated_email_exists: !!patientByUpdatedEmail
    });

    const guardCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7C',
      table_name: REPO_TABLES.PATIENTS,
      operation: 'FINAL_7C_WRITE_GUARD_CHECK'
    });

    addCheck('WRITE_GUARD_BLOCKS_AFTER_FLAG_FALSE_FINAL', guardCheck.allowed === false, {
      allowed: guardCheck.allowed,
      message: guardCheck.message
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-7C-FINAL-OLD-DBINSERT-SHOULD-NOT-INSERT'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_FINAL', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7C-11',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}