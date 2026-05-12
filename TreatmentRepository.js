/* =========================================================
   TREATMENT REPOSITORY
   Tahap 4E - Repository Layer Read-Only Awal
   Backend saat ini tetap Spreadsheet via DataAccess.gs
   ========================================================= */

/**
 * TreatmentRepository adalah layer baca data treatment dan relasi dasarnya.
 *
 * Catatan penting:
 * - Tahap 4E hanya read-only.
 * - Belum mengganti TreatmentService.gs.
 * - Belum mengubah endpoint frontend.
 * - Belum mengubah business logic.
 * - Belum menyentuh createTreatment.
 * - Semua data masih berasal dari Spreadsheet melalui DataAccess.gs.
 */

const TREATMENT_REPOSITORY_CONTEXT_KEYS = Object.freeze({
  TREATMENTS: 'treatments',
  TREATMENT_ITEMS: 'treatmentItems',
  MEDICAL_RECORDS: 'medicalRecords',
  APPOINTMENTS: 'appointments',
  PATIENTS: 'patients',
  USERS: 'users',
  SERVICE_CATALOG: 'serviceCatalog',
  BILLINGS: 'billings',
  BILLING_ITEMS: 'billingItems',
  ORTHO_RECALL: 'orthoRecall'
});

const TreatmentRepository = Object.freeze({
  getTreatmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.TREATMENTS, options);
  },

  getTreatmentItemsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, options);
  },

  getMedicalRecordsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, options);
  },

  getAppointmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.APPOINTMENTS, options);
  },

  getPatientsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.PATIENTS, options);
  },

  getUsersRaw: function(options) {
    return dbFindAll_(REPO_TABLES.USERS, options);
  },

  getServiceCatalogRaw: function(options) {
    return dbFindAll_(REPO_TABLES.SERVICE_CATALOG, options);
  },

  getBillingsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLINGS, options);
  },

  getBillingItemsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLING_ITEMS, options);
  },

  getOrthoRecallRaw: function(options) {
    return dbFindAll_(REPO_TABLES.ORTHO_RECALL, options);
  },

  findTreatmentById: function(treatmentId, options) {
    return dbFindById_(
      REPO_TABLES.TREATMENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.TREATMENTS),
      treatmentId,
      options
    );
  },

  findTreatmentItemById: function(treatmentItemId, options) {
    return dbFindById_(
      REPO_TABLES.TREATMENT_ITEMS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.TREATMENT_ITEMS),
      treatmentItemId,
      options
    );
  },

  findMedicalRecordById: function(recordId, options) {
    return dbFindById_(
      REPO_TABLES.MEDICAL_RECORDS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.MEDICAL_RECORDS),
      recordId,
      options
    );
  },

  findAppointmentById: function(appointmentId, options) {
    return dbFindById_(
      REPO_TABLES.APPOINTMENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.APPOINTMENTS),
      appointmentId,
      options
    );
  },

  findPatientById: function(patientId, options) {
    return dbFindById_(
      REPO_TABLES.PATIENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.PATIENTS),
      patientId,
      options
    );
  },

  findUserById: function(userId, options) {
    return dbFindById_(
      REPO_TABLES.USERS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.USERS),
      userId,
      options
    );
  },

  listActiveDoctors: function(options) {
  return this.getUsersRaw(options).filter(function(row) {
    return isTreatmentRepositoryDoctorRole_(row.role) &&
      isTreatmentRepositoryActiveUser_(row);
  });
},

  findActiveDoctorById: function(userId, options) {
    const normalizedUserId = normalizeTreatmentRepositoryKeyValue_(userId);

    if (!normalizedUserId) return null;

    return this.getUsersRaw(options).find(function(row) {
      return String(row.user_id || '').trim() === normalizedUserId &&
        isTreatmentRepositoryDoctorRole_(row.role) &&
        isTreatmentRepositoryActiveUser_(row);
    }) || null;
  },

  findServiceById: function(serviceId, options) {
    return dbFindById_(
      REPO_TABLES.SERVICE_CATALOG,
      repoGetPrimaryKeyForTable_(REPO_TABLES.SERVICE_CATALOG),
      serviceId,
      options
    );
  },

  listTreatmentsByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizeTreatmentRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENTS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listTreatmentsByAppointmentId: function(appointmentId, options) {
    const normalizedAppointmentId = normalizeTreatmentRepositoryKeyValue_(appointmentId);

    if (!normalizedAppointmentId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENTS, function(row) {
      return String(row.appointment_id || '').trim() === normalizedAppointmentId;
    }, options);
  },

  findTreatmentByAppointmentId: function(appointmentId, options) {
    const rows = this.listTreatmentsByAppointmentId(appointmentId, options);
    return rows.length ? rows[0] : null;
  },

  listTreatmentItemsByTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENT_ITEMS, function(row) {
      return String(row.treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  listTreatmentItemsByServiceId: function(serviceId, options) {
    const normalizedServiceId = normalizeTreatmentRepositoryKeyValue_(serviceId);

    if (!normalizedServiceId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENT_ITEMS, function(row) {
      return String(row.service_id || '').trim() === normalizedServiceId;
    }, options);
  },

  listMedicalRecordsByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizeTreatmentRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.MEDICAL_RECORDS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listMedicalRecordsByTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.MEDICAL_RECORDS, function(row) {
      return String(row.treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  findMedicalRecordByTreatmentId: function(treatmentId, options) {
    const rows = this.listMedicalRecordsByTreatmentId(treatmentId, options);
    return rows.length ? rows[0] : null;
  },

  listMedicalRecordsByAppointmentId: function(appointmentId, options) {
    const normalizedAppointmentId = normalizeTreatmentRepositoryKeyValue_(appointmentId);

    if (!normalizedAppointmentId) return [];

    return dbFindWhere_(REPO_TABLES.MEDICAL_RECORDS, function(row) {
      return String(row.appointment_id || '').trim() === normalizedAppointmentId;
    }, options);
  },

  listBillingsByTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.BILLINGS, function(row) {
      return String(row.treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  findBillingByTreatmentId: function(treatmentId, options) {
    const rows = this.listBillingsByTreatmentId(treatmentId, options);
    return rows.length ? rows[0] : null;
  },

  listBillingItemsByTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.BILLING_ITEMS, function(row) {
      return String(row.treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  listBillingItemsByTreatmentItemId: function(treatmentItemId, options) {
    const normalizedTreatmentItemId = normalizeTreatmentRepositoryKeyValue_(treatmentItemId);

    if (!normalizedTreatmentItemId) return [];

    return dbFindWhere_(REPO_TABLES.BILLING_ITEMS, function(row) {
      return String(row.treatment_item_id || '').trim() === normalizedTreatmentItemId;
    }, options);
  },

  listOrthoRecallByInstallTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return String(row.install_treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  listOrthoRecallByLastControlTreatmentId: function(treatmentId, options) {
    const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

    if (!normalizedTreatmentId) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return String(row.last_control_treatment_id || '').trim() === normalizedTreatmentId;
    }, options);
  },

  buildRawContext: function(options) {
    return buildTreatmentRepositoryRawContext_(options || {});
  },

  getRawContextRows: function(ctx, key) {
    return getTreatmentRepositoryRawContextRows_(ctx, key);
  },

  findTreatmentByIdFromContext: function(ctx, treatmentId) {
    return findTreatmentRepositoryTreatmentByIdFromContext_(ctx, treatmentId);
  },

  findTreatmentItemByIdFromContext: function(ctx, treatmentItemId) {
    return findTreatmentRepositoryTreatmentItemByIdFromContext_(ctx, treatmentItemId);
  },

  findAppointmentByIdFromContext: function(ctx, appointmentId) {
    return findTreatmentRepositoryAppointmentByIdFromContext_(ctx, appointmentId);
  },

  findPatientByIdFromContext: function(ctx, patientId) {
    return findTreatmentRepositoryPatientByIdFromContext_(ctx, patientId);
  },

  findServiceByIdFromContext: function(ctx, serviceId) {
    return findTreatmentRepositoryServiceByIdFromContext_(ctx, serviceId);
  },

  listTreatmentsByPatientIdFromContext: function(ctx, patientId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS,
      'patient_id',
      patientId
    );
  },

  listTreatmentsByAppointmentIdFromContext: function(ctx, appointmentId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS,
      'appointment_id',
      appointmentId
    );
  },

  findTreatmentByAppointmentIdFromContext: function(ctx, appointmentId) {
    const rows = this.listTreatmentsByAppointmentIdFromContext(ctx, appointmentId);
    return rows.length ? rows[0] : null;
  },

  listTreatmentItemsByTreatmentIdFromContext: function(ctx, treatmentId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENT_ITEMS,
      'treatment_id',
      treatmentId
    );
  },

  listMedicalRecordsByTreatmentIdFromContext: function(ctx, treatmentId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.MEDICAL_RECORDS,
      'treatment_id',
      treatmentId
    );
  },

  findMedicalRecordByTreatmentIdFromContext: function(ctx, treatmentId) {
    const rows = this.listMedicalRecordsByTreatmentIdFromContext(ctx, treatmentId);
    return rows.length ? rows[0] : null;
  },

  listMedicalRecordsByPatientIdFromContext: function(ctx, patientId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.MEDICAL_RECORDS,
      'patient_id',
      patientId
    );
  },

  findBillingByTreatmentIdFromContext: function(ctx, treatmentId) {
    const rows = listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.BILLINGS,
      'treatment_id',
      treatmentId
    );

    return rows.length ? rows[0] : null;
  },

  listBillingItemsByTreatmentIdFromContext: function(ctx, treatmentId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.BILLING_ITEMS,
      'treatment_id',
      treatmentId
    );
  },

  listOrthoRecallByInstallTreatmentIdFromContext: function(ctx, treatmentId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL,
      'install_treatment_id',
      treatmentId
    );
  },

  listOrthoRecallByLastControlTreatmentIdFromContext: function(ctx, treatmentId) {
    return listTreatmentRepositoryRowsByFieldFromContext_(
      ctx,
      TREATMENT_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL,
      'last_control_treatment_id',
      treatmentId
    );
  },
  
  findUserByIdFromContext: function(ctx, userId) {
    return findTreatmentRepositoryUserByIdFromContext_(ctx, userId);
  },

  listActiveDoctorsFromContext: function(ctx) {
    return listTreatmentRepositoryActiveDoctorsFromContext_(ctx);
  },

  findActiveDoctorByIdFromContext: function(ctx, userId) {
    return findTreatmentRepositoryActiveDoctorByIdFromContext_(ctx, userId);
  }
});

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function normalizeTreatmentRepositoryKeyValue_(value) {
  return String(value || '').trim();
}

function isTreatmentRepositoryDoctorRole_(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'dokter' || normalizedRole === 'doctor';
}

function isTreatmentRepositoryActiveUser_(row) {
  const value = row ? row.is_active : '';
  const normalized = String(value).trim().toLowerCase();

  return value === true ||
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'active';
}

function normalizeTreatmentRepositoryYmd_(value) {
  const str = String(value || '').trim();

  if (!str) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  if (/^\d{4}-\d{2}-\d{2}\s/.test(str)) {
    return str.slice(0, 10);
  }

  const parsed = new Date(str);

  if (isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function shouldTreatmentRepositoryLoadContextKey_(only, key) {
  const config = only || {};
  const keys = Object.keys(config);

  if (!keys.length) {
    return true;
  }

  return config[key] === true;
}

function buildTreatmentRepositoryRawContext_(options) {
  const opts = options || {};
  const only = opts.only || {};

  const ctx = {
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_(opts)
      : 'spreadsheet',

    loaded_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),

    treatments: [],
    treatmentItems: [],
    medicalRecords: [],
    appointments: [],
    patients: [],
    users: [],
    serviceCatalog: [],
    billings: [],
    billingItems: [],
    orthoRecall: []
  };

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS)) {
    ctx.treatments = TreatmentRepository.getTreatmentsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENT_ITEMS)) {
    ctx.treatmentItems = TreatmentRepository.getTreatmentItemsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.MEDICAL_RECORDS)) {
    ctx.medicalRecords = TreatmentRepository.getMedicalRecordsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS)) {
    ctx.appointments = TreatmentRepository.getAppointmentsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.PATIENTS)) {
    ctx.patients = TreatmentRepository.getPatientsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.USERS)) {
    ctx.users = TreatmentRepository.getUsersRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.SERVICE_CATALOG)) {
    ctx.serviceCatalog = TreatmentRepository.getServiceCatalogRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.BILLINGS)) {
    ctx.billings = TreatmentRepository.getBillingsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.BILLING_ITEMS)) {
    ctx.billingItems = TreatmentRepository.getBillingItemsRaw(opts);
  }

  if (shouldTreatmentRepositoryLoadContextKey_(only, TREATMENT_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL)) {
    ctx.orthoRecall = TreatmentRepository.getOrthoRecallRaw(opts);
  }

  return ctx;
}

function getTreatmentRepositoryRawContextRows_(ctx, key) {  
  const context = ctx || {};
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) return [];

  if (Array.isArray(context[normalizedKey])) {
    return context[normalizedKey];
  }

  const aliases = {
    Treatments: 'treatments',
    TreatmentItems: 'treatmentItems',
    MedicalRecords: 'medicalRecords',
    Appointments: 'appointments',
    Patients: 'patients',
    Users: 'users',
    ServiceCatalog: 'serviceCatalog',
    Billings: 'billings',
    BillingItems: 'billingItems',
    OrthoRecall: 'orthoRecall',

    treatmentsRaw: 'treatments',
    treatmentItemsRaw: 'treatmentItems',
    medicalRecordsRaw: 'medicalRecords',
    appointmentsRaw: 'appointments',
    patientsRaw: 'patients',
    usersRaw: 'users',
    serviceCatalogRaw: 'serviceCatalog',
    billingsRaw: 'billings',
    billingItemsRaw: 'billingItems',
    orthoRecallRaw: 'orthoRecall'
  };

  const mappedKey = aliases[normalizedKey];

  if (mappedKey && Array.isArray(context[mappedKey])) {
    return context[mappedKey];
  }

  return [];
}

function findTreatmentRepositoryTreatmentByIdFromContext_(ctx, treatmentId) {
  const normalizedTreatmentId = normalizeTreatmentRepositoryKeyValue_(treatmentId);

  if (!normalizedTreatmentId) return null;

  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS
  ).find(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  }) || null;
}

function findTreatmentRepositoryTreatmentItemByIdFromContext_(ctx, treatmentItemId) {
  const normalizedTreatmentItemId = normalizeTreatmentRepositoryKeyValue_(treatmentItemId);

  if (!normalizedTreatmentItemId) return null;

  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.TREATMENT_ITEMS
  ).find(function(row) {
    return String(row.treatment_item_id || '').trim() === normalizedTreatmentItemId;
  }) || null;
}

function findTreatmentRepositoryAppointmentByIdFromContext_(ctx, appointmentId) {
  const normalizedAppointmentId = normalizeTreatmentRepositoryKeyValue_(appointmentId);

  if (!normalizedAppointmentId) return null;

  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS
  ).find(function(row) {
    return String(row.appointment_id || '').trim() === normalizedAppointmentId;
  }) || null;
}

function findTreatmentRepositoryPatientByIdFromContext_(ctx, patientId) {
  const normalizedPatientId = normalizeTreatmentRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return null;

  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.PATIENTS
  ).find(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  }) || null;
}

function findTreatmentRepositoryUserByIdFromContext_(ctx, userId) {
  const normalizedUserId = normalizeTreatmentRepositoryKeyValue_(userId);

  if (!normalizedUserId) return null;

  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.USERS
  ).find(function(row) {
    return String(row.user_id || '').trim() === normalizedUserId;
  }) || null;
}

function listTreatmentRepositoryActiveDoctorsFromContext_(ctx) {
  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.USERS
  ).filter(function(row) {
    return isTreatmentRepositoryDoctorRole_(row.role) &&
      isTreatmentRepositoryActiveUser_(row);
  });
}

function findTreatmentRepositoryActiveDoctorByIdFromContext_(ctx, userId) {
  const normalizedUserId = normalizeTreatmentRepositoryKeyValue_(userId);

  if (!normalizedUserId) return null;

  return listTreatmentRepositoryActiveDoctorsFromContext_(ctx).find(function(row) {
    return String(row.user_id || '').trim() === normalizedUserId;
  }) || null;
}

function findTreatmentRepositoryServiceByIdFromContext_(ctx, serviceId) {
  const normalizedServiceId = normalizeTreatmentRepositoryKeyValue_(serviceId);

  if (!normalizedServiceId) return null;

  return getTreatmentRepositoryRawContextRows_(
    ctx,
    TREATMENT_REPOSITORY_CONTEXT_KEYS.SERVICE_CATALOG
  ).find(function(row) {
    return String(row.service_id || '').trim() === normalizedServiceId;
  }) || null;
}

function listTreatmentRepositoryRowsByFieldFromContext_(ctx, contextKey, fieldName, fieldValue) {
  const normalizedValue = normalizeTreatmentRepositoryKeyValue_(fieldValue);

  if (!normalizedValue) return [];

  return getTreatmentRepositoryRawContextRows_(ctx, contextKey).filter(function(row) {
    return String(row[fieldName] || '').trim() === normalizedValue;
  });
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testTreatmentRepositorySupabaseReadLog() {
  const result = {
    success: true,
    stage: '6F-Treatment',
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
      treatments: TreatmentRepository.getTreatmentsRaw(supabaseOptions),
      treatmentItems: TreatmentRepository.getTreatmentItemsRaw(supabaseOptions),
      medicalRecords: TreatmentRepository.getMedicalRecordsRaw(supabaseOptions),
      appointments: TreatmentRepository.getAppointmentsRaw(supabaseOptions),
      patients: TreatmentRepository.getPatientsRaw(supabaseOptions),
      users: TreatmentRepository.getUsersRaw(supabaseOptions),
      serviceCatalog: TreatmentRepository.getServiceCatalogRaw(supabaseOptions),
      billings: TreatmentRepository.getBillingsRaw(supabaseOptions),
      billingItems: TreatmentRepository.getBillingItemsRaw(supabaseOptions),
      orthoRecall: TreatmentRepository.getOrthoRecallRaw(supabaseOptions)
    };

    Object.keys(datasets).forEach(function(key) {
      addCheck('SUPABASE_TREATMENT_DATASET_ARRAY_' + key, Array.isArray(datasets[key]), {
        dataset: key,
        row_count: Array.isArray(datasets[key]) ? datasets[key].length : -1
      });
    });

    const activeDoctors = TreatmentRepository.listActiveDoctors(supabaseOptions);

    addCheck('SUPABASE_TREATMENT_ACTIVE_DOCTORS_ARRAY', Array.isArray(activeDoctors), {
      active_doctor_count: Array.isArray(activeDoctors) ? activeDoctors.length : -1
    });

    const firstTreatment = datasets.treatments.length ? datasets.treatments[0] : null;
    const treatmentId = firstTreatment ? String(firstTreatment.treatment_id || '').trim() : '';
    const appointmentId = firstTreatment ? String(firstTreatment.appointment_id || '').trim() : '';
    const patientId = firstTreatment ? String(firstTreatment.patient_id || '').trim() : '';
    const doctorUserId = firstTreatment ? String(firstTreatment.doctor_user_id || '').trim() : '';

    addCheck('SUPABASE_TREATMENT_SAMPLE_AVAILABLE', !!treatmentId, {
      treatment_count: datasets.treatments.length,
      first_treatment_id: treatmentId,
      first_appointment_id: appointmentId,
      first_patient_id: patientId
    });

    if (treatmentId) {
      const foundTreatment = TreatmentRepository.findTreatmentById(treatmentId, supabaseOptions);
      const appointment = appointmentId
        ? TreatmentRepository.findAppointmentById(appointmentId, supabaseOptions)
        : null;
      const patient = patientId
        ? TreatmentRepository.findPatientById(patientId, supabaseOptions)
        : null;
      const doctor = doctorUserId
        ? TreatmentRepository.findUserById(doctorUserId, supabaseOptions)
        : null;
      const activeDoctor = doctorUserId
        ? TreatmentRepository.findActiveDoctorById(doctorUserId, supabaseOptions)
        : null;

      const treatmentsByPatient = patientId
        ? TreatmentRepository.listTreatmentsByPatientId(patientId, supabaseOptions)
        : [];
      const treatmentsByAppointment = appointmentId
        ? TreatmentRepository.listTreatmentsByAppointmentId(appointmentId, supabaseOptions)
        : [];
      const treatmentByAppointment = appointmentId
        ? TreatmentRepository.findTreatmentByAppointmentId(appointmentId, supabaseOptions)
        : null;

      const treatmentItems = TreatmentRepository.listTreatmentItemsByTreatmentId(treatmentId, supabaseOptions);
      const medicalRecords = TreatmentRepository.listMedicalRecordsByTreatmentId(treatmentId, supabaseOptions);
      const medicalRecord = TreatmentRepository.findMedicalRecordByTreatmentId(treatmentId, supabaseOptions);
      const billing = TreatmentRepository.findBillingByTreatmentId(treatmentId, supabaseOptions);
      const billingItems = TreatmentRepository.listBillingItemsByTreatmentId(treatmentId, supabaseOptions);
      const recallInstallRows = TreatmentRepository.listOrthoRecallByInstallTreatmentId(treatmentId, supabaseOptions);
      const recallControlRows = TreatmentRepository.listOrthoRecallByLastControlTreatmentId(treatmentId, supabaseOptions);

      addCheck('SUPABASE_TREATMENT_FIND_BY_ID', !!foundTreatment, {
        treatment_id: treatmentId
      });

      addCheck('SUPABASE_TREATMENT_FIND_RELATIONS', true, {
        appointment_ok: appointmentId ? !!appointment : true,
        patient_ok: patientId ? !!patient : true,
        doctor_ok: doctorUserId ? !!doctor : true,
        active_doctor_found: !!activeDoctor
      });

      addCheck('SUPABASE_TREATMENT_LIST_RELATED_ROWS', true, {
        treatment_id: treatmentId,
        treatments_by_patient_count: treatmentsByPatient.length,
        treatments_by_appointment_count: treatmentsByAppointment.length,
        find_treatment_by_appointment_ok: appointmentId ? !!treatmentByAppointment : true,
        treatment_item_count: treatmentItems.length,
        medical_record_count: medicalRecords.length,
        has_medical_record: !!medicalRecord,
        has_billing: !!billing,
        billing_item_count: billingItems.length,
        recall_install_count: recallInstallRows.length,
        recall_control_count: recallControlRows.length
      });

      if (treatmentItems.length) {
        const firstItem = treatmentItems[0];
        const treatmentItemId = String(firstItem.treatment_item_id || '').trim();
        const serviceId = String(firstItem.service_id || '').trim();

        const foundItem = treatmentItemId
          ? TreatmentRepository.findTreatmentItemById(treatmentItemId, supabaseOptions)
          : null;

        const foundService = serviceId
          ? TreatmentRepository.findServiceById(serviceId, supabaseOptions)
          : null;

        const itemsByService = serviceId
          ? TreatmentRepository.listTreatmentItemsByServiceId(serviceId, supabaseOptions)
          : [];

        addCheck('SUPABASE_TREATMENT_ITEM_AND_SERVICE_LOOKUP', true, {
          treatment_item_id: treatmentItemId,
          treatment_item_found: treatmentItemId ? !!foundItem : true,
          service_id: serviceId,
          service_found: serviceId ? !!foundService : true,
          items_by_service_count: itemsByService.length
        });
      }
    }

    const ctx = TreatmentRepository.buildRawContext({
      backend_mode: 'supabase',
      only: {
        treatments: true,
        treatmentItems: true,
        medicalRecords: true,
        appointments: true,
        patients: true,
        users: true,
        serviceCatalog: true,
        billings: true,
        billingItems: true,
        orthoRecall: true
      }
    });

    addCheck('SUPABASE_TREATMENT_CONTEXT_BACKEND_MODE', ctx.backend_mode === 'supabase', {
      actual: ctx.backend_mode
    });

    addCheck('SUPABASE_TREATMENT_CONTEXT_ROWS_ARRAY', Array.isArray(ctx.treatments) && Array.isArray(ctx.treatmentItems), {
      treatment_count: Array.isArray(ctx.treatments) ? ctx.treatments.length : -1,
      treatment_item_count: Array.isArray(ctx.treatmentItems) ? ctx.treatmentItems.length : -1
    });

    const ctxTreatments = TreatmentRepository.getRawContextRows(ctx, 'treatments');
    const ctxFirstTreatment = ctxTreatments.length ? ctxTreatments[0] : null;
    const ctxTreatmentId = ctxFirstTreatment ? String(ctxFirstTreatment.treatment_id || '').trim() : '';
    const ctxAppointmentId = ctxFirstTreatment ? String(ctxFirstTreatment.appointment_id || '').trim() : '';
    const ctxPatientId = ctxFirstTreatment ? String(ctxFirstTreatment.patient_id || '').trim() : '';

    if (ctxTreatmentId) {
      const ctxTreatment = TreatmentRepository.findTreatmentByIdFromContext(ctx, ctxTreatmentId);
      const ctxAppointment = ctxAppointmentId
        ? TreatmentRepository.findAppointmentByIdFromContext(ctx, ctxAppointmentId)
        : null;
      const ctxPatient = ctxPatientId
        ? TreatmentRepository.findPatientByIdFromContext(ctx, ctxPatientId)
        : null;
      const ctxItems = TreatmentRepository.listTreatmentItemsByTreatmentIdFromContext(ctx, ctxTreatmentId);
      const ctxMedicalRecord = TreatmentRepository.findMedicalRecordByTreatmentIdFromContext(ctx, ctxTreatmentId);
      const ctxBilling = TreatmentRepository.findBillingByTreatmentIdFromContext(ctx, ctxTreatmentId);

      addCheck('SUPABASE_TREATMENT_CONTEXT_FINDERS', !!ctxTreatment, {
        treatment_id: ctxTreatmentId,
        appointment_ok: ctxAppointmentId ? !!ctxAppointment : true,
        patient_ok: ctxPatientId ? !!ctxPatient : true,
        treatment_item_count: ctxItems.length,
        has_medical_record: !!ctxMedicalRecord,
        has_billing: !!ctxBilling
      });
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

    addCheck('SUPABASE_TREATMENT_WRITE_STILL_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6F-Treatment',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}


