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