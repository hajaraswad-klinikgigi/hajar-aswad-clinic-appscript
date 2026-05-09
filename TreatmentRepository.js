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

function testTreatmentRepositoryPhase4EReadOnly() {
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
      treatments: TreatmentRepository.getTreatmentsRaw(),
      treatmentItems: TreatmentRepository.getTreatmentItemsRaw(),
      medicalRecords: TreatmentRepository.getMedicalRecordsRaw(),
      appointments: TreatmentRepository.getAppointmentsRaw(),
      patients: TreatmentRepository.getPatientsRaw(),
      serviceCatalog: TreatmentRepository.getServiceCatalogRaw(),
      billings: TreatmentRepository.getBillingsRaw(),
      billingItems: TreatmentRepository.getBillingItemsRaw(),
      orthoRecall: TreatmentRepository.getOrthoRecallRaw()
    };

    Object.keys(datasets).forEach(function(key) {
      const rows = datasets[key];

      result.counts[key] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          dataset: key,
          issue: 'DATASET_NOT_ARRAY'
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

function testTreatmentRepositoryPhase4EBuildRawContext() {
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
    const ctx = TreatmentRepository.buildRawContext({
      only: {
        treatments: true,
        treatmentItems: true,
        medicalRecords: true,
        appointments: true,
        patients: true,
        serviceCatalog: true
      }
    });

    const expectedKeys = [
      'treatments',
      'treatmentItems',
      'medicalRecords',
      'appointments',
      'patients',
      'serviceCatalog'
    ];

    expectedKeys.forEach(function(key) {
      const rows = TreatmentRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_ROWS_NOT_ARRAY'
        });
      }
    });

    const unloadedKeys = [
      'billings',
      'billingItems',
      'orthoRecall'
    ];

    unloadedKeys.forEach(function(key) {
      const rows = TreatmentRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : -1;

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

    const aliases = [
      'Treatments',
      'TreatmentItems',
      'MedicalRecords',
      'Appointments',
      'Patients',
      'ServiceCatalog'
    ];

    aliases.forEach(function(alias) {
      const rows = TreatmentRepository.getRawContextRows(ctx, alias);

      result.context_counts[alias] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          alias: alias,
          issue: 'CONTEXT_ALIAS_NOT_ARRAY'
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

function testTreatmentRepositoryPhase4EFindTreatmentSample() {
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
    const treatments = TreatmentRepository.getTreatmentsRaw();
    const firstTreatment = treatments.length ? treatments[0] : null;

    const treatmentId = firstTreatment
      ? String(firstTreatment.treatment_id || '').trim()
      : '';

    const appointmentId = firstTreatment
      ? String(firstTreatment.appointment_id || '').trim()
      : '';

    const patientId = firstTreatment
      ? String(firstTreatment.patient_id || '').trim()
      : '';

    result.sample.treatment_count = treatments.length;
    result.sample.first_treatment_id = treatmentId;
    result.sample.first_appointment_id = appointmentId;
    result.sample.first_patient_id = patientId;

    if (!treatmentId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada treatment untuk sample test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundTreatment = TreatmentRepository.findTreatmentById(treatmentId);
    const appointment = appointmentId
      ? TreatmentRepository.findAppointmentById(appointmentId)
      : null;

    const patient = patientId
      ? TreatmentRepository.findPatientById(patientId)
      : null;

    const items = TreatmentRepository.listTreatmentItemsByTreatmentId(treatmentId);
    const medicalRecord = TreatmentRepository.findMedicalRecordByTreatmentId(treatmentId);
    const billing = TreatmentRepository.findBillingByTreatmentId(treatmentId);
    const billingItems = TreatmentRepository.listBillingItemsByTreatmentId(treatmentId);
    const recallInstallRows = TreatmentRepository.listOrthoRecallByInstallTreatmentId(treatmentId);
    const recallControlRows = TreatmentRepository.listOrthoRecallByLastControlTreatmentId(treatmentId);

    result.sample.find_treatment_ok = !!foundTreatment;
    result.sample.find_appointment_ok = appointmentId ? !!appointment : true;
    result.sample.find_patient_ok = patientId ? !!patient : true;
    result.sample.treatment_item_count = items.length;
    result.sample.has_medical_record = !!medicalRecord;
    result.sample.has_billing = !!billing;
    result.sample.billing_item_count = billingItems.length;
    result.sample.recall_install_count = recallInstallRows.length;
    result.sample.recall_control_count = recallControlRows.length;

    if (!foundTreatment) {
      result.issues.push({
        treatment_id: treatmentId,
        issue: 'FIND_TREATMENT_BY_ID_FAILED'
      });
    }

    if (appointmentId && !appointment) {
      result.issues.push({
        appointment_id: appointmentId,
        issue: 'FIND_APPOINTMENT_BY_ID_FAILED'
      });
    }

    if (patientId && !patient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_BY_ID_FAILED'
      });
    }

    /*
     * MedicalRecord / Billing tidak dipaksa wajib ada untuk semua sample,
     * karena data legacy/test bisa berbeda.
     */

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

function testTreatmentRepositoryPhase4EContextFinderSample() {
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
    const ctx = TreatmentRepository.buildRawContext({
      only: {
        treatments: true,
        treatmentItems: true,
        medicalRecords: true,
        appointments: true,
        patients: true,
        serviceCatalog: true,
        billings: true,
        billingItems: true,
        orthoRecall: true
      }
    });

    const treatments = TreatmentRepository.getRawContextRows(ctx, 'treatments');
    const firstTreatment = treatments.length ? treatments[0] : null;

    const treatmentId = firstTreatment
      ? String(firstTreatment.treatment_id || '').trim()
      : '';

    const appointmentId = firstTreatment
      ? String(firstTreatment.appointment_id || '').trim()
      : '';

    const patientId = firstTreatment
      ? String(firstTreatment.patient_id || '').trim()
      : '';

    result.sample.treatment_count = treatments.length;
    result.sample.first_treatment_id = treatmentId;
    result.sample.first_appointment_id = appointmentId;
    result.sample.first_patient_id = patientId;

    if (!treatmentId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada treatment untuk context finder test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const treatment = TreatmentRepository.findTreatmentByIdFromContext(ctx, treatmentId);
    const appointment = appointmentId
      ? TreatmentRepository.findAppointmentByIdFromContext(ctx, appointmentId)
      : null;

    const patient = patientId
      ? TreatmentRepository.findPatientByIdFromContext(ctx, patientId)
      : null;

    const treatmentsByPatient = patientId
      ? TreatmentRepository.listTreatmentsByPatientIdFromContext(ctx, patientId)
      : [];

    const treatmentsByAppointment = appointmentId
      ? TreatmentRepository.listTreatmentsByAppointmentIdFromContext(ctx, appointmentId)
      : [];

    const treatmentByAppointment = appointmentId
      ? TreatmentRepository.findTreatmentByAppointmentIdFromContext(ctx, appointmentId)
      : null;

    const items = TreatmentRepository.listTreatmentItemsByTreatmentIdFromContext(ctx, treatmentId);
    const medicalRecords = TreatmentRepository.listMedicalRecordsByTreatmentIdFromContext(ctx, treatmentId);
    const medicalRecord = TreatmentRepository.findMedicalRecordByTreatmentIdFromContext(ctx, treatmentId);
    const billing = TreatmentRepository.findBillingByTreatmentIdFromContext(ctx, treatmentId);
    const billingItems = TreatmentRepository.listBillingItemsByTreatmentIdFromContext(ctx, treatmentId);
    const recallInstallRows = TreatmentRepository.listOrthoRecallByInstallTreatmentIdFromContext(ctx, treatmentId);
    const recallControlRows = TreatmentRepository.listOrthoRecallByLastControlTreatmentIdFromContext(ctx, treatmentId);

    let firstItemServiceOk = true;
    let firstItemServiceId = '';

    if (items.length) {
      firstItemServiceId = String(items[0].service_id || '').trim();

      if (firstItemServiceId) {
        firstItemServiceOk = !!TreatmentRepository.findServiceByIdFromContext(ctx, firstItemServiceId);
      }
    }

    result.sample.find_treatment_ok = !!treatment;
    result.sample.find_appointment_ok = appointmentId ? !!appointment : true;
    result.sample.find_patient_ok = patientId ? !!patient : true;
    result.sample.treatments_by_patient_count = treatmentsByPatient.length;
    result.sample.treatments_by_appointment_count = treatmentsByAppointment.length;
    result.sample.find_treatment_by_appointment_ok = appointmentId ? !!treatmentByAppointment : true;
    result.sample.treatment_item_count = items.length;
    result.sample.medical_record_count = medicalRecords.length;
    result.sample.has_medical_record = !!medicalRecord;
    result.sample.has_billing = !!billing;
    result.sample.billing_item_count = billingItems.length;
    result.sample.recall_install_count = recallInstallRows.length;
    result.sample.recall_control_count = recallControlRows.length;
    result.sample.first_item_service_id = firstItemServiceId;
    result.sample.first_item_service_ok = firstItemServiceOk;

    if (!treatment) {
      result.issues.push({
        treatment_id: treatmentId,
        issue: 'FIND_TREATMENT_FROM_CONTEXT_FAILED'
      });
    }

    if (appointmentId && !appointment) {
      result.issues.push({
        appointment_id: appointmentId,
        issue: 'FIND_APPOINTMENT_FROM_CONTEXT_FAILED'
      });
    }

    if (patientId && !patient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_FROM_CONTEXT_FAILED'
      });
    }

    if (appointmentId && !treatmentByAppointment) {
      result.issues.push({
        appointment_id: appointmentId,
        issue: 'FIND_TREATMENT_BY_APPOINTMENT_FROM_CONTEXT_FAILED'
      });
    }

    if (!firstItemServiceOk) {
      result.issues.push({
        service_id: firstItemServiceId,
        issue: 'FIND_SERVICE_FOR_FIRST_TREATMENT_ITEM_FAILED'
      });
    }

    /*
     * Billing/BillingItems/OrthoRecall tidak dipaksa wajib ada
     * karena tidak semua treatment punya billing/recall.
     * Missing parent manual artifact dari audit Tahap 1 juga tidak dijadikan blocker di sini.
     */

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

function testTreatmentRepositoryPhase6FSupabaseReadOnlyLog() {
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

function testTreatmentRepositoryPhase6FSpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6F-Treatment',
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
    addTest('testTreatmentRepositoryPhase4EReadOnly', testTreatmentRepositoryPhase4EReadOnly());
    addTest('testTreatmentRepositoryPhase4EBuildRawContext', testTreatmentRepositoryPhase4EBuildRawContext());
    addTest('testTreatmentRepositoryPhase4EFindTreatmentSample', testTreatmentRepositoryPhase4EFindTreatmentSample());
    addTest('testTreatmentRepositoryPhase4EContextFinderSample', testTreatmentRepositoryPhase4EContextFinderSample());

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

/* =========================================================
   PHASE 7E - TREATMENT CREATE MUTATION PREFLIGHT
   Read-only preflight. Aman dijalankan. Tidak menulis data.
   ========================================================= */

const TREATMENT_PHASE_7E_TEST_IDS = Object.freeze({
  TREATMENT_ID: 'TRX-7E-TEST-001',
  TREATMENT_ITEM_ID: 'TRI-7E-TEST-001',
  MEDICAL_RECORD_ID: 'MRD-7E-TEST-001',
  TREATMENT_DATE: '2027-01-03',
  CHIEF_COMPLAINT: 'Keluhan utama dummy treatment Supabase staging 7E',
  DIAGNOSIS: 'Diagnosis dummy treatment Supabase staging 7E',
  NOTES: 'Catatan klinis dummy treatment Supabase staging 7E'
});

function normalizeTreatmentPhase7EText_(value) {
  return String(value || '').trim();
}

function normalizeTreatmentPhase7EStatus_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTreatmentPhase7EYmd_(value) {
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

function boolTreatmentPhase7E_(value) {
  if (value === true) return true;
  if (value === false) return false;

  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'active';
}

function isTreatmentPhase7EDoctorRole_(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'dokter' || normalized === 'doctor';
}

function isTreatmentPhase7EActiveUser_(row) {
  return !!(
    row &&
    isTreatmentPhase7EDoctorRole_(row.role) &&
    boolTreatmentPhase7E_(row.is_active)
  );
}

function isTreatmentPhase7EActiveService_(row) {
  if (!row) return false;
  if (Object.prototype.hasOwnProperty.call(row, 'is_active')) {
    return boolTreatmentPhase7E_(row.is_active);
  }
  return true;
}

function isTreatmentPhase7ENonOrthoService_(row) {
  return !!(
    row &&
    !boolTreatmentPhase7E_(row.is_ortho_install) &&
    !boolTreatmentPhase7E_(row.is_ortho_control)
  );
}

function findTreatmentPhase7EByField_(rows, fieldName, value) {
  const normalizedField = normalizeTreatmentPhase7EText_(fieldName);
  const normalizedValue = normalizeTreatmentPhase7EText_(value).toLowerCase();

  if (!normalizedField || !normalizedValue) return null;

  return (Array.isArray(rows) ? rows : []).find(function(row) {
    return normalizeTreatmentPhase7EText_(row[normalizedField]).toLowerCase() === normalizedValue;
  }) || null;
}

function findTreatmentPhase7ESafeScheduledAppointment_(appointments, treatments) {
  const treatmentByAppointment = {};

  (Array.isArray(treatments) ? treatments : []).forEach(function(row) {
    const appointmentId = normalizeTreatmentPhase7EText_(row.appointment_id);
    if (appointmentId) treatmentByAppointment[appointmentId] = true;
  });

  return (Array.isArray(appointments) ? appointments : []).find(function(row) {
    const appointmentId = normalizeTreatmentPhase7EText_(row.appointment_id);
    const patientId = normalizeTreatmentPhase7EText_(row.patient_id);
    const patientName = normalizeTreatmentPhase7EText_(row.patient_name);
    const status = normalizeTreatmentPhase7EStatus_(row.status);

    return appointmentId &&
      patientId &&
      patientName &&
      status === 'scheduled' &&
      !treatmentByAppointment[appointmentId];
  }) || null;
}

function buildTreatmentPhase7ETreatmentPayload_(appointment, doctor, service) {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
  const qty = 1;
  const unitPrice = Number(service && service.default_price || 0);
  const subtotal = qty * unitPrice;

  return {
    treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
    appointment_id: normalizeTreatmentPhase7EText_(appointment && appointment.appointment_id),
    patient_id: normalizeTreatmentPhase7EText_(appointment && appointment.patient_id),
    patient_name: normalizeTreatmentPhase7EText_(appointment && appointment.patient_name),
    doctor_name: normalizeTreatmentPhase7EText_(doctor && doctor.full_name),
    treatment_date: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE,
    chief_complaint: TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT,
    diagnosis: TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS,
    notes: TREATMENT_PHASE_7E_TEST_IDS.NOTES,
    total_cost: subtotal,
    created_at: now,
    updated_at: now
  };
}

function buildTreatmentPhase7ETreatmentItemPayload_(service) {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
  const qty = 1;
  const unitPrice = Number(service && service.default_price || 0);
  const subtotal = qty * unitPrice;

  return {
    treatment_item_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
    treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
    service_id: normalizeTreatmentPhase7EText_(service && service.service_id),
    service_name: normalizeTreatmentPhase7EText_(service && service.service_name),
    qty: qty,
    unit_price: unitPrice,
    subtotal: subtotal,
    is_ortho_install: false,
    is_ortho_control: false,
    created_at: now,
    updated_at: now
  };
}

function buildTreatmentPhase7EMedicalRecordPayload_(appointment, doctor) {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

  return {
    record_id: TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
    patient_id: normalizeTreatmentPhase7EText_(appointment && appointment.patient_id),
    patient_name: normalizeTreatmentPhase7EText_(appointment && appointment.patient_name),
    appointment_id: normalizeTreatmentPhase7EText_(appointment && appointment.appointment_id),
    treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
    doctor_name: normalizeTreatmentPhase7EText_(doctor && doctor.full_name),
    visit_date: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE,
    chief_complaint: TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT,
    diagnosis: TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS,
    clinical_notes: TREATMENT_PHASE_7E_TEST_IDS.NOTES,
    created_at: now
  };
}

function getTreatmentPhase7ESchemaAlignment_(sampleRow, payload) {
  const sampleColumns = Object.keys(sampleRow || {}).sort();
  const payloadColumns = Object.keys(payload || {}).sort();

  return {
    column_count: sampleColumns.length,
    missing_from_supabase: payloadColumns.filter(function(key) {
      return sampleColumns.indexOf(key) === -1;
    }),
    extra_in_supabase: sampleColumns.filter(function(key) {
      return payloadColumns.indexOf(key) === -1;
    })
  };
}

function listTreatmentPhase7EMedicalRecordsByTreatmentId_(rows, treatmentId) {
  const target = normalizeTreatmentPhase7EText_(treatmentId);

  return (Array.isArray(rows) ? rows : []).filter(function(row) {
    return normalizeTreatmentPhase7EText_(row.treatment_id) === target;
  });
}

const TREATMENT_PHASE_7E_BILLING_IDS = Object.freeze({
  BILLING_ID: 'BIL-7E-TEST-001',
  BILLING_NUMBER: 'INV-20270103-7E001',
  BILLING_ITEM_ID: 'BII-7E-TEST-001'
});

function buildTreatmentPhase7EDraftBillingPayload_(treatment, treatmentItems) {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

  const sourceItems = Array.isArray(treatmentItems) ? treatmentItems : [];

  const subtotal = sourceItems.reduce(function(sum, item) {
    return sum + Number(item.subtotal || 0);
  }, 0);

  const billingDate = normalizeTreatmentPhase7EYmd_(
    (treatment && (treatment.treatment_date || treatment.date)) ||
    TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE
  ) || TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE;

  return {
    billing_id: TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID,
    billing_number: TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER,
    treatment_id: normalizeTreatmentPhase7EText_(treatment && treatment.treatment_id),
    appointment_id: normalizeTreatmentPhase7EText_(treatment && treatment.appointment_id),
    patient_id: normalizeTreatmentPhase7EText_(treatment && treatment.patient_id),
    patient_name: normalizeTreatmentPhase7EText_(treatment && treatment.patient_name),
    billing_date: billingDate,
    due_date: billingDate,
    subtotal: subtotal,
    discount_total: 0,
    grand_total: subtotal,
    paid_total: 0,
    outstanding_total: subtotal,
    payment_status: subtotal > 0 ? 'unpaid' : 'paid',
    billing_status: 'draft',
    payment_type: 'full',
    payment_terms: 'full',
    notes: 'Draft billing dummy Supabase staging 7E',
    invoice_pdf_file_id: '',
    invoice_pdf_url: '',
    invoice_sent_to: '',
    invoice_sent_at: null,
    invoice_delivery_status: '',
    invoice_pdf_signature: '',
    invoice_pdf_signature_at: null,
    created_at: now,
    updated_at: now
  };
}

function buildTreatmentPhase7EBillingItemPayload_(billing, treatmentItem) {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

  return {
    billing_item_id: TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID,
    billing_id: normalizeTreatmentPhase7EText_(billing && billing.billing_id),
    treatment_id: normalizeTreatmentPhase7EText_(treatmentItem && treatmentItem.treatment_id),
    treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem && treatmentItem.treatment_item_id),
    service_id: normalizeTreatmentPhase7EText_(treatmentItem && treatmentItem.service_id),
    service_name: normalizeTreatmentPhase7EText_(treatmentItem && treatmentItem.service_name),
    qty: Number(treatmentItem && treatmentItem.qty || 0),
    unit_price: Number(treatmentItem && treatmentItem.unit_price || 0),
    subtotal: Number(treatmentItem && treatmentItem.subtotal || 0),
    created_at: now,
    updated_at: now
  };
}

function listTreatmentPhase7EBillingItemsByBillingId_(rows, billingId) {
  const target = normalizeTreatmentPhase7EText_(billingId);

  return (Array.isArray(rows) ? rows : []).filter(function(row) {
    return normalizeTreatmentPhase7EText_(row.billing_id) === target;
  });
}

function testTreatmentPhase7EPreflightLog() {
  const result = {
    success: true,
    stage: '7E-1',
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
    selected: {
      appointment: null,
      patient: null,
      doctor: null,
      service: null
    },
    schema_alignment: {
      treatments: {},
      treatment_items: {},
      medical_records: {},
      appointment_patch: {}
    },
    payload_preview: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment_patch: null
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
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const users = TreatmentRepository.getUsersRaw(supabaseOptions);
    const services = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;
    result.counts.supabase_users = Array.isArray(users) ? users.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(services) ? services.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;

    const scheduledAppointments = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAppointments = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAppointments = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.supabase_scheduled_appointments = scheduledAppointments.length;
    result.counts.supabase_completed_appointments = completedAppointments.length;
    result.counts.supabase_cancelled_appointments = cancelledAppointments.length;

    const activeDoctors = (Array.isArray(users) ? users : []).filter(isTreatmentPhase7EActiveUser_);
    const activeNonOrthoServices = (Array.isArray(services) ? services : []).filter(function(row) {
      return isTreatmentPhase7EActiveService_(row) && isTreatmentPhase7ENonOrthoService_(row);
    });

    result.counts.supabase_active_doctors = activeDoctors.length;
    result.counts.supabase_active_non_ortho_services = activeNonOrthoServices.length;

    addCheck('SUPABASE_BASELINE_COUNTS_FOR_7E', !!(
      result.counts.supabase_treatments === 254 &&
      result.counts.supabase_treatment_items === 489 &&
      result.counts.supabase_medical_records === 254 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_patients === 285 &&
      result.counts.supabase_users === 8 &&
      result.counts.supabase_service_catalog === 100 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_BASELINE_6_255_23', !!(
      result.counts.supabase_scheduled_appointments === 6 &&
      result.counts.supabase_completed_appointments === 255 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_ACTIVE_DOCTORS_AVAILABLE_FOR_TREATMENT', result.counts.supabase_active_doctors >= 1, {
      active_doctor_count: result.counts.supabase_active_doctors
    });

    addCheck('SUPABASE_ACTIVE_NON_ORTHO_SERVICE_AVAILABLE_FOR_SAFE_7E', result.counts.supabase_active_non_ortho_services >= 1, {
      active_non_ortho_service_count: result.counts.supabase_active_non_ortho_services
    });

    const safeAppointment = findTreatmentPhase7ESafeScheduledAppointment_(appointments, treatments);
    const selectedDoctor = activeDoctors.length ? activeDoctors[0] : null;
    const selectedService = activeNonOrthoServices.length ? activeNonOrthoServices[0] : null;

    const selectedPatient = safeAppointment
      ? TreatmentRepository.findPatientById(safeAppointment.patient_id, supabaseOptions)
      : null;

    result.selected.appointment = safeAppointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(safeAppointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(safeAppointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(safeAppointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(safeAppointment.appointment_date || safeAppointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(safeAppointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(safeAppointment.status)
    } : null;

    result.selected.patient = selectedPatient ? {
      patient_id: normalizeTreatmentPhase7EText_(selectedPatient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(selectedPatient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(selectedPatient.patient_code),
      phone: normalizeTreatmentPhase7EText_(selectedPatient.phone)
    } : null;

    result.selected.doctor = selectedDoctor ? {
      user_id: normalizeTreatmentPhase7EText_(selectedDoctor.user_id),
      full_name: normalizeTreatmentPhase7EText_(selectedDoctor.full_name),
      role: normalizeTreatmentPhase7EText_(selectedDoctor.role),
      is_active: selectedDoctor.is_active
    } : null;

    result.selected.service = selectedService ? {
      service_id: normalizeTreatmentPhase7EText_(selectedService.service_id),
      service_name: normalizeTreatmentPhase7EText_(selectedService.service_name),
      default_price: Number(selectedService.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(selectedService.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(selectedService.is_ortho_control)
    } : null;

    addCheck('SAFE_SCHEDULED_APPOINTMENT_WITHOUT_TREATMENT_AVAILABLE', !!safeAppointment, {
      selected_appointment: result.selected.appointment
    });

    addCheck('SAFE_APPOINTMENT_PATIENT_EXISTS', !!selectedPatient, {
      selected_patient: result.selected.patient
    });

    addCheck('SAFE_DOCTOR_SELECTED', !!selectedDoctor, {
      selected_doctor: result.selected.doctor
    });

    addCheck('SAFE_NON_ORTHO_SERVICE_SELECTED', !!selectedService, {
      selected_service: result.selected.service
    });

    const existingTreatmentById = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingTreatmentByAppointment = safeAppointment
      ? TreatmentRepository.findTreatmentByAppointmentId(safeAppointment.appointment_id, supabaseOptions)
      : null;

    const existingTreatmentItemById = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const existingMedicalRecordById = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const existingBillingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    addCheck('TEST_TREATMENT_IDS_NOT_EXISTING_BEFORE_7E', !(
      existingTreatmentById ||
      existingTreatmentItemById ||
      existingMedicalRecordById ||
      existingBillingByTreatment
    ), {
      treatment_exists: !!existingTreatmentById,
      treatment_item_exists: !!existingTreatmentItemById,
      medical_record_exists: !!existingMedicalRecordById,
      billing_exists: !!existingBillingByTreatment
    });

    addCheck('SAFE_APPOINTMENT_HAS_NO_EXISTING_TREATMENT', !existingTreatmentByAppointment, {
      appointment_id: safeAppointment ? safeAppointment.appointment_id : '',
      existing_treatment_id: existingTreatmentByAppointment ? existingTreatmentByAppointment.treatment_id : ''
    });

    const treatmentPayload = buildTreatmentPhase7ETreatmentPayload_(safeAppointment, selectedDoctor, selectedService);
    const treatmentItemPayload = buildTreatmentPhase7ETreatmentItemPayload_(selectedService);
    const medicalRecordPayload = buildTreatmentPhase7EMedicalRecordPayload_(safeAppointment, selectedDoctor);
    const appointmentPatch = {
      status: 'completed',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    result.payload_preview.treatment = treatmentPayload;
    result.payload_preview.treatment_item = treatmentItemPayload;
    result.payload_preview.medical_record = medicalRecordPayload;
    result.payload_preview.appointment_patch = appointmentPatch;

    result.schema_alignment.treatments = getTreatmentPhase7ESchemaAlignment_(
      Array.isArray(treatments) && treatments.length ? treatments[0] : {},
      treatmentPayload
    );

    result.schema_alignment.treatment_items = getTreatmentPhase7ESchemaAlignment_(
      Array.isArray(treatmentItems) && treatmentItems.length ? treatmentItems[0] : {},
      treatmentItemPayload
    );

    result.schema_alignment.medical_records = getTreatmentPhase7ESchemaAlignment_(
      Array.isArray(medicalRecords) && medicalRecords.length ? medicalRecords[0] : {},
      medicalRecordPayload
    );

    result.schema_alignment.appointment_patch = getTreatmentPhase7ESchemaAlignment_(
      Array.isArray(appointments) && appointments.length ? appointments[0] : {},
      appointmentPatch
    );

    addCheck('TREATMENTS_SCHEMA_ALIGNED_WITH_TEST_PAYLOAD', result.schema_alignment.treatments.missing_from_supabase.length === 0, result.schema_alignment.treatments);

    addCheck('TREATMENT_ITEMS_SCHEMA_ALIGNED_WITH_TEST_PAYLOAD', result.schema_alignment.treatment_items.missing_from_supabase.length === 0, result.schema_alignment.treatment_items);

    addCheck('MEDICAL_RECORDS_SCHEMA_ALIGNED_WITH_TEST_PAYLOAD', result.schema_alignment.medical_records.missing_from_supabase.length === 0, result.schema_alignment.medical_records);

    addCheck('APPOINTMENT_PATCH_SCHEMA_ALIGNED_WITH_TEST_PAYLOAD', result.schema_alignment.appointment_patch.missing_from_supabase.length === 0, result.schema_alignment.appointment_patch);

    addCheck('TREATMENT_PAYLOAD_VALID_SHAPE', !!(
      treatmentPayload.treatment_id &&
      treatmentPayload.appointment_id &&
      treatmentPayload.patient_id &&
      treatmentPayload.patient_name &&
      treatmentPayload.doctor_name &&
      treatmentPayload.treatment_date &&
      treatmentPayload.chief_complaint &&
      treatmentPayload.diagnosis &&
      Number(treatmentPayload.total_cost || 0) > 0
    ), {
      payload: treatmentPayload
    });

    addCheck('TREATMENT_ITEM_PAYLOAD_VALID_SHAPE', !!(
      treatmentItemPayload.treatment_item_id &&
      treatmentItemPayload.treatment_id &&
      treatmentItemPayload.service_id &&
      treatmentItemPayload.service_name &&
      Number(treatmentItemPayload.qty || 0) > 0 &&
      Number(treatmentItemPayload.unit_price || 0) >= 0 &&
      Number(treatmentItemPayload.subtotal || 0) >= 0 &&
      treatmentItemPayload.is_ortho_install === false &&
      treatmentItemPayload.is_ortho_control === false
    ), {
      payload: treatmentItemPayload
    });

    addCheck('MEDICAL_RECORD_PAYLOAD_VALID_SHAPE', !!(
      medicalRecordPayload.record_id &&
      medicalRecordPayload.patient_id &&
      medicalRecordPayload.patient_name &&
      medicalRecordPayload.appointment_id &&
      medicalRecordPayload.treatment_id &&
      medicalRecordPayload.doctor_name &&
      medicalRecordPayload.visit_date &&
      medicalRecordPayload.chief_complaint &&
      medicalRecordPayload.diagnosis
    ), {
      payload: medicalRecordPayload
    });

    let treatmentInsertBlocked = false;
    let treatmentInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(REPO_TABLES.TREATMENTS, treatmentPayload, { stage: '7E' });
    } catch (errTreatmentInsert) {
      treatmentInsertBlocked = true;
      treatmentInsertMessage = errTreatmentInsert && errTreatmentInsert.message
        ? errTreatmentInsert.message
        : String(errTreatmentInsert || '');
    }

    addCheck('TREATMENT_INSERT_BLOCKED_WHEN_FLAG_FALSE', treatmentInsertBlocked, {
      message: treatmentInsertMessage
    });

    let treatmentItemInsertBlocked = false;
    let treatmentItemInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(REPO_TABLES.TREATMENT_ITEMS, treatmentItemPayload, { stage: '7E' });
    } catch (errTreatmentItemInsert) {
      treatmentItemInsertBlocked = true;
      treatmentItemInsertMessage = errTreatmentItemInsert && errTreatmentItemInsert.message
        ? errTreatmentItemInsert.message
        : String(errTreatmentItemInsert || '');
    }

    addCheck('TREATMENT_ITEM_INSERT_BLOCKED_WHEN_FLAG_FALSE', treatmentItemInsertBlocked, {
      message: treatmentItemInsertMessage
    });

    let medicalRecordInsertBlocked = false;
    let medicalRecordInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(REPO_TABLES.MEDICAL_RECORDS, medicalRecordPayload, { stage: '7E' });
    } catch (errMedicalRecordInsert) {
      medicalRecordInsertBlocked = true;
      medicalRecordInsertMessage = errMedicalRecordInsert && errMedicalRecordInsert.message
        ? errMedicalRecordInsert.message
        : String(errMedicalRecordInsert || '');
    }

    addCheck('MEDICAL_RECORD_INSERT_BLOCKED_WHEN_FLAG_FALSE', medicalRecordInsertBlocked, {
      message: medicalRecordInsertMessage
    });

    let appointmentUpdateBlocked = false;
    let appointmentUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.APPOINTMENTS,
        'appointment_id',
        safeAppointment ? safeAppointment.appointment_id : 'NO_APPOINTMENT',
        appointmentPatch,
        { stage: '7E' }
      );
    } catch (errAppointmentUpdate) {
      appointmentUpdateBlocked = true;
      appointmentUpdateMessage = errAppointmentUpdate && errAppointmentUpdate.message
        ? errAppointmentUpdate.message
        : String(errAppointmentUpdate || '');
    }

    addCheck('APPOINTMENT_COMPLETED_UPDATE_BLOCKED_WHEN_FLAG_FALSE', appointmentUpdateBlocked, {
      message: appointmentUpdateMessage
    });

    const treatmentsAfterBlocked = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfterBlocked = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfterBlocked = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfterBlocked = TreatmentRepository.getAppointmentsRaw(supabaseOptions);

    const selectedAppointmentAfterBlocked = safeAppointment
      ? TreatmentRepository.findAppointmentById(safeAppointment.appointment_id, supabaseOptions)
      : null;

    result.counts.supabase_treatments_after_blocked = Array.isArray(treatmentsAfterBlocked) ? treatmentsAfterBlocked.length : -1;
    result.counts.supabase_treatment_items_after_blocked = Array.isArray(treatmentItemsAfterBlocked) ? treatmentItemsAfterBlocked.length : -1;
    result.counts.supabase_medical_records_after_blocked = Array.isArray(medicalRecordsAfterBlocked) ? medicalRecordsAfterBlocked.length : -1;
    result.counts.supabase_appointments_after_blocked = Array.isArray(appointmentsAfterBlocked) ? appointmentsAfterBlocked.length : -1;

    addCheck('COUNTS_UNCHANGED_AFTER_BLOCKED_7E_MUTATIONS', !!(
      result.counts.supabase_treatments_after_blocked === result.counts.supabase_treatments &&
      result.counts.supabase_treatment_items_after_blocked === result.counts.supabase_treatment_items &&
      result.counts.supabase_medical_records_after_blocked === result.counts.supabase_medical_records &&
      result.counts.supabase_appointments_after_blocked === result.counts.supabase_appointments
    ), {
      before: {
        treatments: result.counts.supabase_treatments,
        treatment_items: result.counts.supabase_treatment_items,
        medical_records: result.counts.supabase_medical_records,
        appointments: result.counts.supabase_appointments
      },
      after: {
        treatments: result.counts.supabase_treatments_after_blocked,
        treatment_items: result.counts.supabase_treatment_items_after_blocked,
        medical_records: result.counts.supabase_medical_records_after_blocked,
        appointments: result.counts.supabase_appointments_after_blocked
      }
    });

    addCheck('SAFE_APPOINTMENT_STILL_SCHEDULED_AFTER_BLOCKED_UPDATE', !!(
      selectedAppointmentAfterBlocked &&
      normalizeTreatmentPhase7EStatus_(selectedAppointmentAfterBlocked.status) === 'scheduled'
    ), {
      appointment_id: safeAppointment ? safeAppointment.appointment_id : '',
      status_after_blocked_update: selectedAppointmentAfterBlocked ? selectedAppointmentAfterBlocked.status : ''
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-1',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EInsertTreatmentDefaultOffLog() {
  const result = {
    success: true,
    stage: '7E-2',
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
    counts_before: {},
    counts_after: {},
    selected: {
      appointment: null,
      patient: null,
      doctor: null,
      service: null
    },
    blocked_results: {},
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

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patientsBefore = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const usersBefore = TreatmentRepository.getUsersRaw(supabaseOptions);
    const servicesBefore = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(patientsBefore) ? patientsBefore.length : -1;
    result.counts_before.supabase_users = Array.isArray(usersBefore) ? usersBefore.length : -1;
    result.counts_before.supabase_service_catalog = Array.isArray(servicesBefore) ? servicesBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_BASELINE_COUNTS_BEFORE_DEFAULT_OFF_INSERT_TEST', !!(
      result.counts_before.supabase_treatments === 254 &&
      result.counts_before.supabase_treatment_items === 489 &&
      result.counts_before.supabase_medical_records === 254 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_patients === 285 &&
      result.counts_before.supabase_users === 8 &&
      result.counts_before.supabase_service_catalog === 100 &&
      result.counts_before.supabase_billings === 46 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_BASELINE_BEFORE_DEFAULT_OFF_INSERT_TEST', !!(
      result.counts_before.supabase_scheduled_appointments === 6 &&
      result.counts_before.supabase_completed_appointments === 255 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const activeDoctors = (Array.isArray(usersBefore) ? usersBefore : []).filter(isTreatmentPhase7EActiveUser_);
    const activeNonOrthoServices = (Array.isArray(servicesBefore) ? servicesBefore : []).filter(function(row) {
      return isTreatmentPhase7EActiveService_(row) && isTreatmentPhase7ENonOrthoService_(row);
    });

    const safeAppointment = findTreatmentPhase7ESafeScheduledAppointment_(appointmentsBefore, treatmentsBefore);
    const selectedDoctor = activeDoctors.length ? activeDoctors[0] : null;
    const selectedService = activeNonOrthoServices.length ? activeNonOrthoServices[0] : null;

    const selectedPatient = safeAppointment
      ? TreatmentRepository.findPatientById(safeAppointment.patient_id, supabaseOptions)
      : null;

    result.selected.appointment = safeAppointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(safeAppointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(safeAppointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(safeAppointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(safeAppointment.appointment_date || safeAppointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(safeAppointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(safeAppointment.status)
    } : null;

    result.selected.patient = selectedPatient ? {
      patient_id: normalizeTreatmentPhase7EText_(selectedPatient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(selectedPatient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(selectedPatient.patient_code),
      phone: normalizeTreatmentPhase7EText_(selectedPatient.phone)
    } : null;

    result.selected.doctor = selectedDoctor ? {
      user_id: normalizeTreatmentPhase7EText_(selectedDoctor.user_id),
      full_name: normalizeTreatmentPhase7EText_(selectedDoctor.full_name),
      role: normalizeTreatmentPhase7EText_(selectedDoctor.role),
      is_active: selectedDoctor.is_active
    } : null;

    result.selected.service = selectedService ? {
      service_id: normalizeTreatmentPhase7EText_(selectedService.service_id),
      service_name: normalizeTreatmentPhase7EText_(selectedService.service_name),
      default_price: Number(selectedService.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(selectedService.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(selectedService.is_ortho_control)
    } : null;

    addCheck('SAFE_SCHEDULED_APPOINTMENT_WITHOUT_TREATMENT_AVAILABLE_DEFAULT_OFF_TEST', !!safeAppointment, {
      selected_appointment: result.selected.appointment
    });

    addCheck('SAFE_APPOINTMENT_PATIENT_EXISTS_DEFAULT_OFF_TEST', !!selectedPatient, {
      selected_patient: result.selected.patient
    });

    addCheck('SAFE_DOCTOR_SELECTED_DEFAULT_OFF_TEST', !!selectedDoctor, {
      selected_doctor: result.selected.doctor
    });

    addCheck('SAFE_NON_ORTHO_SERVICE_SELECTED_DEFAULT_OFF_TEST', !!selectedService, {
      selected_service: result.selected.service
    });

    const existingTreatmentByIdBefore = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingTreatmentByAppointmentBefore = safeAppointment
      ? TreatmentRepository.findTreatmentByAppointmentId(safeAppointment.appointment_id, supabaseOptions)
      : null;

    const existingTreatmentItemByIdBefore = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const existingMedicalRecordByIdBefore = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    addCheck('TEST_7E_IDS_NOT_EXISTING_BEFORE_DEFAULT_OFF_INSERT_TEST', !(
      existingTreatmentByIdBefore ||
      existingTreatmentByAppointmentBefore ||
      existingTreatmentItemByIdBefore ||
      existingMedicalRecordByIdBefore
    ), {
      treatment_by_id_exists: !!existingTreatmentByIdBefore,
      treatment_by_appointment_exists: !!existingTreatmentByAppointmentBefore,
      treatment_item_exists: !!existingTreatmentItemByIdBefore,
      medical_record_exists: !!existingMedicalRecordByIdBefore
    });

    const treatmentPayload = buildTreatmentPhase7ETreatmentPayload_(safeAppointment, selectedDoctor, selectedService);
    const treatmentItemPayload = buildTreatmentPhase7ETreatmentItemPayload_(selectedService);
    const medicalRecordPayload = buildTreatmentPhase7EMedicalRecordPayload_(safeAppointment, selectedDoctor);
    const appointmentPatch = {
      status: 'completed',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    let treatmentInsertBlocked = false;
    let treatmentInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.TREATMENTS,
        treatmentPayload,
        {
          stage: '7E'
        }
      );
    } catch (errTreatmentInsert) {
      treatmentInsertBlocked = true;
      treatmentInsertMessage = errTreatmentInsert && errTreatmentInsert.message
        ? errTreatmentInsert.message
        : String(errTreatmentInsert || '');
    }

    result.blocked_results.treatment_insert = {
      blocked: treatmentInsertBlocked,
      message: treatmentInsertMessage
    };

    addCheck('DUMMY_TREATMENT_INSERT_BLOCKED_WHEN_FLAG_FALSE', treatmentInsertBlocked, result.blocked_results.treatment_insert);

    let treatmentItemInsertBlocked = false;
    let treatmentItemInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.TREATMENT_ITEMS,
        treatmentItemPayload,
        {
          stage: '7E'
        }
      );
    } catch (errTreatmentItemInsert) {
      treatmentItemInsertBlocked = true;
      treatmentItemInsertMessage = errTreatmentItemInsert && errTreatmentItemInsert.message
        ? errTreatmentItemInsert.message
        : String(errTreatmentItemInsert || '');
    }

    result.blocked_results.treatment_item_insert = {
      blocked: treatmentItemInsertBlocked,
      message: treatmentItemInsertMessage
    };

    addCheck('DUMMY_TREATMENT_ITEM_INSERT_BLOCKED_WHEN_FLAG_FALSE', treatmentItemInsertBlocked, result.blocked_results.treatment_item_insert);

    let medicalRecordInsertBlocked = false;
    let medicalRecordInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.MEDICAL_RECORDS,
        medicalRecordPayload,
        {
          stage: '7E'
        }
      );
    } catch (errMedicalRecordInsert) {
      medicalRecordInsertBlocked = true;
      medicalRecordInsertMessage = errMedicalRecordInsert && errMedicalRecordInsert.message
        ? errMedicalRecordInsert.message
        : String(errMedicalRecordInsert || '');
    }

    result.blocked_results.medical_record_insert = {
      blocked: medicalRecordInsertBlocked,
      message: medicalRecordInsertMessage
    };

    addCheck('DUMMY_MEDICAL_RECORD_INSERT_BLOCKED_WHEN_FLAG_FALSE', medicalRecordInsertBlocked, result.blocked_results.medical_record_insert);

    let appointmentUpdateBlocked = false;
    let appointmentUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.APPOINTMENTS,
        'appointment_id',
        safeAppointment ? safeAppointment.appointment_id : 'NO_SAFE_APPOINTMENT_7E',
        appointmentPatch,
        {
          stage: '7E'
        }
      );
    } catch (errAppointmentUpdate) {
      appointmentUpdateBlocked = true;
      appointmentUpdateMessage = errAppointmentUpdate && errAppointmentUpdate.message
        ? errAppointmentUpdate.message
        : String(errAppointmentUpdate || '');
    }

    result.blocked_results.appointment_update = {
      blocked: appointmentUpdateBlocked,
      message: appointmentUpdateMessage
    };

    addCheck('DUMMY_APPOINTMENT_COMPLETED_UPDATE_BLOCKED_WHEN_FLAG_FALSE', appointmentUpdateBlocked, result.blocked_results.appointment_update);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const selectedAppointmentAfter = safeAppointment
      ? TreatmentRepository.findAppointmentById(safeAppointment.appointment_id, supabaseOptions)
      : null;

    const existingTreatmentByIdAfter = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingTreatmentByAppointmentAfter = safeAppointment
      ? TreatmentRepository.findTreatmentByAppointmentId(safeAppointment.appointment_id, supabaseOptions)
      : null;

    const existingTreatmentItemByIdAfter = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const existingMedicalRecordByIdAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_DEFAULT_OFF_INSERT_TEST', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_COUNTS_UNCHANGED_AFTER_DEFAULT_OFF_INSERT_TEST', !!(
      result.counts_after.supabase_treatments === result.counts_before.supabase_treatments &&
      result.counts_after.supabase_treatment_items === result.counts_before.supabase_treatment_items &&
      result.counts_after.supabase_medical_records === result.counts_before.supabase_medical_records &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billings === result.counts_before.supabase_billings &&
      result.counts_after.supabase_billing_items === result.counts_before.supabase_billing_items &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_COUNTS_UNCHANGED_AFTER_DEFAULT_OFF_INSERT_TEST', !!(
      result.counts_after.supabase_scheduled_appointments === result.counts_before.supabase_scheduled_appointments &&
      result.counts_after.supabase_completed_appointments === result.counts_before.supabase_completed_appointments &&
      result.counts_after.supabase_cancelled_appointments === result.counts_before.supabase_cancelled_appointments
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      }
    });

    addCheck('SAFE_APPOINTMENT_STILL_SCHEDULED_AFTER_DEFAULT_OFF_INSERT_TEST', !!(
      selectedAppointmentAfter &&
      normalizeTreatmentPhase7EStatus_(selectedAppointmentAfter.status) === 'scheduled'
    ), {
      appointment_id: safeAppointment ? safeAppointment.appointment_id : '',
      status_after: selectedAppointmentAfter ? selectedAppointmentAfter.status : ''
    });

    addCheck('TEST_7E_IDS_STILL_NOT_INSERTED_AFTER_DEFAULT_OFF_INSERT_TEST', !(
      existingTreatmentByIdAfter ||
      existingTreatmentByAppointmentAfter ||
      existingTreatmentItemByIdAfter ||
      existingMedicalRecordByIdAfter
    ), {
      treatment_by_id_exists: !!existingTreatmentByIdAfter,
      treatment_by_appointment_exists: !!existingTreatmentByAppointmentAfter,
      treatment_item_exists: !!existingTreatmentItemByIdAfter,
      medical_record_exists: !!existingMedicalRecordByIdAfter
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-2',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EWriteFlagEnabledPreMutationLog() {
  const result = {
    success: true,
    stage: '7E-3',
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
    selected: {
      appointment: null,
      patient: null,
      doctor: null,
      service: null
    },
    guard_checks: {},
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

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const users = TreatmentRepository.getUsersRaw(supabaseOptions);
    const services = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAppointments = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAppointments = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAppointments = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;
    result.counts.supabase_users = Array.isArray(users) ? users.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(services) ? services.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;
    result.counts.supabase_scheduled_appointments = scheduledAppointments.length;
    result.counts.supabase_completed_appointments = completedAppointments.length;
    result.counts.supabase_cancelled_appointments = cancelledAppointments.length;

    addCheck('SUPABASE_BASELINE_COUNTS_STILL_CLEAN_BEFORE_REAL_7E_MUTATION', !!(
      result.counts.supabase_treatments === 254 &&
      result.counts.supabase_treatment_items === 489 &&
      result.counts.supabase_medical_records === 254 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_patients === 285 &&
      result.counts.supabase_users === 8 &&
      result.counts.supabase_service_catalog === 100 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_BASELINE_STILL_6_255_23', !!(
      result.counts.supabase_scheduled_appointments === 6 &&
      result.counts.supabase_completed_appointments === 255 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const activeDoctors = (Array.isArray(users) ? users : []).filter(isTreatmentPhase7EActiveUser_);
    const activeNonOrthoServices = (Array.isArray(services) ? services : []).filter(function(row) {
      return isTreatmentPhase7EActiveService_(row) && isTreatmentPhase7ENonOrthoService_(row);
    });

    result.counts.supabase_active_doctors = activeDoctors.length;
    result.counts.supabase_active_non_ortho_services = activeNonOrthoServices.length;

    addCheck('SUPABASE_ACTIVE_DOCTORS_AVAILABLE_BEFORE_REAL_7E_MUTATION', result.counts.supabase_active_doctors >= 1, {
      active_doctor_count: result.counts.supabase_active_doctors
    });

    addCheck('SUPABASE_ACTIVE_NON_ORTHO_SERVICES_AVAILABLE_BEFORE_REAL_7E_MUTATION', result.counts.supabase_active_non_ortho_services >= 1, {
      active_non_ortho_service_count: result.counts.supabase_active_non_ortho_services
    });

    const safeAppointment = findTreatmentPhase7ESafeScheduledAppointment_(appointments, treatments);
    const selectedDoctor = activeDoctors.length ? activeDoctors[0] : null;
    const selectedService = activeNonOrthoServices.length ? activeNonOrthoServices[0] : null;

    const selectedPatient = safeAppointment
      ? TreatmentRepository.findPatientById(safeAppointment.patient_id, supabaseOptions)
      : null;

    result.selected.appointment = safeAppointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(safeAppointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(safeAppointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(safeAppointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(safeAppointment.appointment_date || safeAppointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(safeAppointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(safeAppointment.status)
    } : null;

    result.selected.patient = selectedPatient ? {
      patient_id: normalizeTreatmentPhase7EText_(selectedPatient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(selectedPatient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(selectedPatient.patient_code),
      phone: normalizeTreatmentPhase7EText_(selectedPatient.phone)
    } : null;

    result.selected.doctor = selectedDoctor ? {
      user_id: normalizeTreatmentPhase7EText_(selectedDoctor.user_id),
      full_name: normalizeTreatmentPhase7EText_(selectedDoctor.full_name),
      role: normalizeTreatmentPhase7EText_(selectedDoctor.role),
      is_active: selectedDoctor.is_active
    } : null;

    result.selected.service = selectedService ? {
      service_id: normalizeTreatmentPhase7EText_(selectedService.service_id),
      service_name: normalizeTreatmentPhase7EText_(selectedService.service_name),
      default_price: Number(selectedService.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(selectedService.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(selectedService.is_ortho_control)
    } : null;

    addCheck('SAFE_SCHEDULED_APPOINTMENT_WITHOUT_TREATMENT_AVAILABLE_BEFORE_REAL_7E_MUTATION', !!safeAppointment, {
      selected_appointment: result.selected.appointment
    });

    addCheck('SAFE_APPOINTMENT_PATIENT_EXISTS_BEFORE_REAL_7E_MUTATION', !!selectedPatient, {
      selected_patient: result.selected.patient
    });

    addCheck('SAFE_DOCTOR_SELECTED_BEFORE_REAL_7E_MUTATION', !!selectedDoctor, {
      selected_doctor: result.selected.doctor
    });

    addCheck('SAFE_NON_ORTHO_SERVICE_SELECTED_BEFORE_REAL_7E_MUTATION', !!selectedService, {
      selected_service: result.selected.service
    });

    const existingTreatmentById = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingTreatmentByAppointment = safeAppointment
      ? TreatmentRepository.findTreatmentByAppointmentId(safeAppointment.appointment_id, supabaseOptions)
      : null;

    const existingTreatmentItemById = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const existingMedicalRecordById = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const existingBillingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    addCheck('TEST_7E_IDS_STILL_NOT_EXISTING_BEFORE_REAL_MUTATION', !(
      existingTreatmentById ||
      existingTreatmentByAppointment ||
      existingTreatmentItemById ||
      existingMedicalRecordById ||
      existingBillingByTreatment
    ), {
      treatment_by_id_exists: !!existingTreatmentById,
      treatment_by_appointment_exists: !!existingTreatmentByAppointment,
      treatment_item_exists: !!existingTreatmentItemById,
      medical_record_exists: !!existingMedicalRecordById,
      billing_exists: !!existingBillingByTreatment
    });

    const treatmentWriteCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7E',
      table_name: REPO_TABLES.TREATMENTS,
      operation: 'TEST_TREATMENT_WRITE_7E'
    });

    result.guard_checks.treatments = {
      allowed: treatmentWriteCheck.allowed,
      message: treatmentWriteCheck.message
    };

    addCheck('TREATMENT_WRITE_GUARD_ALLOWS_7E_WHEN_FLAG_TRUE', treatmentWriteCheck.allowed === true, result.guard_checks.treatments);

    const treatmentItemWriteCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7E',
      table_name: REPO_TABLES.TREATMENT_ITEMS,
      operation: 'TEST_TREATMENT_ITEM_WRITE_7E'
    });

    result.guard_checks.treatment_items = {
      allowed: treatmentItemWriteCheck.allowed,
      message: treatmentItemWriteCheck.message
    };

    addCheck('TREATMENT_ITEM_WRITE_GUARD_ALLOWS_7E_WHEN_FLAG_TRUE', treatmentItemWriteCheck.allowed === true, result.guard_checks.treatment_items);

    const medicalRecordWriteCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7E',
      table_name: REPO_TABLES.MEDICAL_RECORDS,
      operation: 'TEST_MEDICAL_RECORD_WRITE_7E'
    });

    result.guard_checks.medical_records = {
      allowed: medicalRecordWriteCheck.allowed,
      message: medicalRecordWriteCheck.message
    };

    addCheck('MEDICAL_RECORD_WRITE_GUARD_ALLOWS_7E_WHEN_FLAG_TRUE', medicalRecordWriteCheck.allowed === true, result.guard_checks.medical_records);

    const appointmentWriteCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7E',
      table_name: REPO_TABLES.APPOINTMENTS,
      operation: 'TEST_APPOINTMENT_COMPLETED_UPDATE_7E'
    });

    result.guard_checks.appointments = {
      allowed: appointmentWriteCheck.allowed,
      message: appointmentWriteCheck.message
    };

    addCheck('APPOINTMENT_UPDATE_GUARD_ALLOWS_7E_WHEN_FLAG_TRUE', appointmentWriteCheck.allowed === true, result.guard_checks.appointments);

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.TREATMENTS, {
        treatment_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7E'
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

    const selectedAppointmentAfterChecks = safeAppointment
      ? TreatmentRepository.findAppointmentById(safeAppointment.appointment_id, supabaseOptions)
      : null;

    addCheck('SAFE_APPOINTMENT_STILL_SCHEDULED_AFTER_GUARD_CHECK_ONLY', !!(
      selectedAppointmentAfterChecks &&
      normalizeTreatmentPhase7EStatus_(selectedAppointmentAfterChecks.status) === 'scheduled'
    ), {
      appointment_id: safeAppointment ? safeAppointment.appointment_id : '',
      status_after_guard_check: selectedAppointmentAfterChecks ? selectedAppointmentAfterChecks.status : ''
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-3',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EInsertMainTreatmentLog() {
  const result = {
    success: true,
    stage: '7E-4',
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
    counts_before: {},
    counts_after: {},
    selected: {
      appointment: null,
      patient: null,
      doctor: null,
      service: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patientsBefore = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const usersBefore = TreatmentRepository.getUsersRaw(supabaseOptions);
    const servicesBefore = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(patientsBefore) ? patientsBefore.length : -1;
    result.counts_before.supabase_users = Array.isArray(usersBefore) ? usersBefore.length : -1;
    result.counts_before.supabase_service_catalog = Array.isArray(servicesBefore) ? servicesBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_BASELINE_COUNTS_BEFORE_MAIN_TREATMENT_INSERT', !!(
      result.counts_before.supabase_treatments === 254 &&
      result.counts_before.supabase_treatment_items === 489 &&
      result.counts_before.supabase_medical_records === 254 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_patients === 285 &&
      result.counts_before.supabase_users === 8 &&
      result.counts_before.supabase_service_catalog === 100 &&
      result.counts_before.supabase_billings === 46 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_BASELINE_BEFORE_MAIN_TREATMENT_INSERT', !!(
      result.counts_before.supabase_scheduled_appointments === 6 &&
      result.counts_before.supabase_completed_appointments === 255 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const activeDoctors = (Array.isArray(usersBefore) ? usersBefore : []).filter(isTreatmentPhase7EActiveUser_);
    const activeNonOrthoServices = (Array.isArray(servicesBefore) ? servicesBefore : []).filter(function(row) {
      return isTreatmentPhase7EActiveService_(row) && isTreatmentPhase7ENonOrthoService_(row);
    });

    const safeAppointment = findTreatmentPhase7ESafeScheduledAppointment_(appointmentsBefore, treatmentsBefore);
    const selectedDoctor = activeDoctors.length ? activeDoctors[0] : null;
    const selectedService = activeNonOrthoServices.length ? activeNonOrthoServices[0] : null;

    const selectedPatient = safeAppointment
      ? TreatmentRepository.findPatientById(safeAppointment.patient_id, supabaseOptions)
      : null;

    result.selected.appointment = safeAppointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(safeAppointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(safeAppointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(safeAppointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(safeAppointment.appointment_date || safeAppointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(safeAppointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(safeAppointment.status)
    } : null;

    result.selected.patient = selectedPatient ? {
      patient_id: normalizeTreatmentPhase7EText_(selectedPatient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(selectedPatient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(selectedPatient.patient_code),
      phone: normalizeTreatmentPhase7EText_(selectedPatient.phone)
    } : null;

    result.selected.doctor = selectedDoctor ? {
      user_id: normalizeTreatmentPhase7EText_(selectedDoctor.user_id),
      full_name: normalizeTreatmentPhase7EText_(selectedDoctor.full_name),
      role: normalizeTreatmentPhase7EText_(selectedDoctor.role),
      is_active: selectedDoctor.is_active
    } : null;

    result.selected.service = selectedService ? {
      service_id: normalizeTreatmentPhase7EText_(selectedService.service_id),
      service_name: normalizeTreatmentPhase7EText_(selectedService.service_name),
      default_price: Number(selectedService.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(selectedService.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(selectedService.is_ortho_control)
    } : null;

    addCheck('SAFE_SCHEDULED_APPOINTMENT_AVAILABLE_FOR_MAIN_TREATMENT_INSERT', !!safeAppointment, {
      selected_appointment: result.selected.appointment
    });

    addCheck('SAFE_APPOINTMENT_PATIENT_EXISTS_FOR_MAIN_TREATMENT_INSERT', !!selectedPatient, {
      selected_patient: result.selected.patient
    });

    addCheck('SAFE_DOCTOR_SELECTED_FOR_MAIN_TREATMENT_INSERT', !!selectedDoctor, {
      selected_doctor: result.selected.doctor
    });

    addCheck('SAFE_NON_ORTHO_SERVICE_SELECTED_FOR_MAIN_TREATMENT_INSERT', !!selectedService, {
      selected_service: result.selected.service
    });

    const existingTreatmentByIdBefore = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingTreatmentByAppointmentBefore = safeAppointment
      ? TreatmentRepository.findTreatmentByAppointmentId(safeAppointment.appointment_id, supabaseOptions)
      : null;

    const existingTreatmentItemByIdBefore = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const existingMedicalRecordByIdBefore = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const existingBillingByTreatmentBefore = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    addCheck('TEST_7E_IDS_NOT_EXISTING_BEFORE_MAIN_TREATMENT_INSERT', !(
      existingTreatmentByIdBefore ||
      existingTreatmentByAppointmentBefore ||
      existingTreatmentItemByIdBefore ||
      existingMedicalRecordByIdBefore ||
      existingBillingByTreatmentBefore
    ), {
      treatment_by_id_exists: !!existingTreatmentByIdBefore,
      treatment_by_appointment_exists: !!existingTreatmentByAppointmentBefore,
      treatment_item_exists: !!existingTreatmentItemByIdBefore,
      medical_record_exists: !!existingMedicalRecordByIdBefore,
      billing_exists: !!existingBillingByTreatmentBefore
    });

    if (
      !safeAppointment ||
      !selectedPatient ||
      !selectedDoctor ||
      !selectedService ||
      existingTreatmentByIdBefore ||
      existingTreatmentByAppointmentBefore ||
      existingTreatmentItemByIdBefore ||
      existingMedicalRecordByIdBefore ||
      existingBillingByTreatmentBefore
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const treatmentPayload = buildTreatmentPhase7ETreatmentPayload_(safeAppointment, selectedDoctor, selectedService);

    addCheck('MAIN_TREATMENT_PAYLOAD_VALID_BEFORE_INSERT', !!(
      treatmentPayload.treatment_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      treatmentPayload.appointment_id === normalizeTreatmentPhase7EText_(safeAppointment.appointment_id) &&
      treatmentPayload.patient_id === normalizeTreatmentPhase7EText_(safeAppointment.patient_id) &&
      treatmentPayload.patient_name === normalizeTreatmentPhase7EText_(safeAppointment.patient_name) &&
      treatmentPayload.doctor_name === normalizeTreatmentPhase7EText_(selectedDoctor.full_name) &&
      treatmentPayload.treatment_date === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      treatmentPayload.chief_complaint &&
      treatmentPayload.diagnosis &&
      Number(treatmentPayload.total_cost || 0) === Number(selectedService.default_price || 0)
    ), {
      payload: treatmentPayload
    });

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.TREATMENTS,
      treatmentPayload,
      {
        stage: '7E'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('MAIN_TREATMENT_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const insertedTreatmentById = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const insertedTreatmentByAppointment = TreatmentRepository.findTreatmentByAppointmentId(
      safeAppointment.appointment_id,
      supabaseOptions
    );

    const treatmentItemsForInsertedTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecordByIdAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const selectedAppointmentAfter = TreatmentRepository.findAppointmentById(
      safeAppointment.appointment_id,
      supabaseOptions
    );

    const billingByTreatmentAfter = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.readback.treatment_by_id = insertedTreatmentById ? {
      treatment_id: normalizeTreatmentPhase7EText_(insertedTreatmentById.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(insertedTreatmentById.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(insertedTreatmentById.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(insertedTreatmentById.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(insertedTreatmentById.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(insertedTreatmentById.treatment_date || insertedTreatmentById.date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(insertedTreatmentById.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(insertedTreatmentById.diagnosis),
      total_cost: Number(insertedTreatmentById.total_cost || 0)
    } : null;

    result.readback.appointment_after = selectedAppointmentAfter ? {
      appointment_id: normalizeTreatmentPhase7EText_(selectedAppointmentAfter.appointment_id),
      status: normalizeTreatmentPhase7EStatus_(selectedAppointmentAfter.status)
    } : null;

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_MAIN_TREATMENT_INSERT', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_TREATMENT_COUNT_INCREASED_TO_255_AFTER_MAIN_INSERT', result.counts_after.supabase_treatments === 255, {
      before_count: result.counts_before.supabase_treatments,
      after_count: result.counts_after.supabase_treatments,
      expected_after_count: 255
    });

    addCheck('RELATED_TABLE_COUNTS_UNCHANGED_AFTER_MAIN_TREATMENT_INSERT_ONLY', !!(
      result.counts_after.supabase_treatment_items === result.counts_before.supabase_treatment_items &&
      result.counts_after.supabase_medical_records === result.counts_before.supabase_medical_records &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billings === result.counts_before.supabase_billings &&
      result.counts_after.supabase_billing_items === result.counts_before.supabase_billing_items &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_UNCHANGED_AFTER_MAIN_TREATMENT_INSERT_ONLY', !!(
      result.counts_after.supabase_scheduled_appointments === result.counts_before.supabase_scheduled_appointments &&
      result.counts_after.supabase_completed_appointments === result.counts_before.supabase_completed_appointments &&
      result.counts_after.supabase_cancelled_appointments === result.counts_before.supabase_cancelled_appointments
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      }
    });

    addCheck('MAIN_TREATMENT_READBACK_BY_ID_FOUND', !!insertedTreatmentById, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    });

    addCheck('MAIN_TREATMENT_READBACK_BY_APPOINTMENT_FOUND', !!insertedTreatmentByAppointment, {
      appointment_id: safeAppointment.appointment_id,
      treatment_id: insertedTreatmentByAppointment ? insertedTreatmentByAppointment.treatment_id : ''
    });

    addCheck('MAIN_TREATMENT_FIELDS_MATCH_AFTER_INSERT', !!(
      insertedTreatmentById &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.treatment_id) === treatmentPayload.treatment_id &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.appointment_id) === treatmentPayload.appointment_id &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.patient_id) === treatmentPayload.patient_id &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.patient_name) === treatmentPayload.patient_name &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.doctor_name) === treatmentPayload.doctor_name &&
      normalizeTreatmentPhase7EYmd_(insertedTreatmentById.treatment_date || insertedTreatmentById.date || '') === treatmentPayload.treatment_date &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.chief_complaint) === treatmentPayload.chief_complaint &&
      normalizeTreatmentPhase7EText_(insertedTreatmentById.diagnosis) === treatmentPayload.diagnosis &&
      Number(insertedTreatmentById.total_cost || 0) === Number(treatmentPayload.total_cost || 0)
    ), {
      readback: result.readback.treatment_by_id
    });

    addCheck('NO_TREATMENT_ITEMS_INSERTED_YET_FOR_MAIN_TREATMENT', Array.isArray(treatmentItemsForInsertedTreatment) && treatmentItemsForInsertedTreatment.length === 0, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      treatment_item_count: Array.isArray(treatmentItemsForInsertedTreatment) ? treatmentItemsForInsertedTreatment.length : -1
    });

    addCheck('NO_MEDICAL_RECORD_INSERTED_YET_FOR_MAIN_TREATMENT', !medicalRecordByIdAfter, {
      medical_record_id: TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      exists: !!medicalRecordByIdAfter
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_AFTER_MAIN_TREATMENT_INSERT_ONLY', !!(
      selectedAppointmentAfter &&
      normalizeTreatmentPhase7EStatus_(selectedAppointmentAfter.status) === 'scheduled'
    ), {
      appointment_after: result.readback.appointment_after
    });

    addCheck('NO_BILLING_CREATED_YET_FOR_MAIN_TREATMENT', !billingByTreatmentAfter, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      billing_exists: !!billingByTreatmentAfter
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-4',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EReadBackMainTreatmentLog() {
  const result = {
    success: true,
    stage: '7E-5',
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
    selected: {
      treatment: null,
      appointment: null,
      patient: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7E', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;
    result.counts.supabase_scheduled_appointments = scheduledRows.length;
    result.counts.supabase_completed_appointments = completedRows.length;
    result.counts.supabase_cancelled_appointments = cancelledRows.length;

    addCheck('SPREADSHEET_TREATMENT_COUNT_STILL_282_AFTER_MAIN_INSERT_VERIFY', result.counts.spreadsheet_treatments === 282, {
      actual: result.counts.spreadsheet_treatments,
      expected: 282
    });

    addCheck('SUPABASE_TREATMENT_COUNT_NOW_255', result.counts.supabase_treatments === 255, {
      actual: result.counts.supabase_treatments,
      expected: 255
    });

    addCheck('RELATED_TABLE_COUNTS_STILL_UNCHANGED_AFTER_MAIN_INSERT_VERIFY', !!(
      result.counts.supabase_treatment_items === 489 &&
      result.counts.supabase_medical_records === 254 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_STILL_UNCHANGED_AFTER_MAIN_INSERT_VERIFY', !!(
      result.counts.supabase_scheduled_appointments === 6 &&
      result.counts.supabase_completed_appointments === 255 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatmentById = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentByAppointment = TreatmentRepository.findTreatmentByAppointmentId(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const treatmentItemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecordById = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = TreatmentRepository.listMedicalRecordsByTreatmentId
      ? TreatmentRepository.listMedicalRecordsByTreatmentId(TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID, supabaseOptions)
      : [];

    const appointment = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const patient = treatmentById
      ? TreatmentRepository.findPatientById(treatmentById.patient_id, supabaseOptions)
      : null;

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.selected.treatment = treatmentById ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatmentById.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatmentById.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatmentById.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatmentById.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(treatmentById.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatmentById.treatment_date || treatmentById.date || ''),
      total_cost: Number(treatmentById.total_cost || 0)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.selected.patient = patient ? {
      patient_id: normalizeTreatmentPhase7EText_(patient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(patient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(patient.patient_code),
      phone: normalizeTreatmentPhase7EText_(patient.phone)
    } : null;

    result.readback.treatment_item_count_for_treatment = Array.isArray(treatmentItemsForTreatment)
      ? treatmentItemsForTreatment.length
      : -1;
    result.readback.medical_record_by_id_exists = !!medicalRecordById;
    result.readback.medical_record_count_for_treatment = Array.isArray(medicalRecordsForTreatment)
      ? medicalRecordsForTreatment.length
      : -1;
    result.readback.billing_by_treatment_exists = !!billingByTreatment;

    addCheck('MAIN_TREATMENT_FOUND_BY_ID_AFTER_INSERT_VERIFY', !!treatmentById, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    });

    addCheck('MAIN_TREATMENT_FOUND_BY_APPOINTMENT_AFTER_INSERT_VERIFY', !!(
      treatmentByAppointment &&
      normalizeTreatmentPhase7EText_(treatmentByAppointment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    ), {
      appointment_id: 'APT-20260430-135818056-583',
      treatment_id: treatmentByAppointment ? treatmentByAppointment.treatment_id : ''
    });

    addCheck('MAIN_TREATMENT_FIELDS_MATCH_AFTER_INSERT_VERIFY', !!(
      treatmentById &&
      normalizeTreatmentPhase7EText_(treatmentById.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatmentById.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(treatmentById.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(treatmentById.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EText_(treatmentById.doctor_name) === 'drg.Novira Zahara Banurea' &&
      normalizeTreatmentPhase7EYmd_(treatmentById.treatment_date || treatmentById.date || '') === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EText_(treatmentById.chief_complaint) === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      normalizeTreatmentPhase7EText_(treatmentById.diagnosis) === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      Number(treatmentById.total_cost || 0) === 700000
    ), {
      treatment: result.selected.treatment
    });

    addCheck('MAIN_TREATMENT_PATIENT_FOUND_AFTER_INSERT_VERIFY', !!patient, {
      patient: result.selected.patient
    });

    addCheck('NO_TREATMENT_ITEMS_YET_AFTER_MAIN_INSERT_VERIFY', Array.isArray(treatmentItemsForTreatment) && treatmentItemsForTreatment.length === 0, {
      treatment_item_count: result.readback.treatment_item_count_for_treatment
    });

    addCheck('NO_MEDICAL_RECORD_YET_AFTER_MAIN_INSERT_VERIFY', !medicalRecordById && (
      !Array.isArray(medicalRecordsForTreatment) ||
      medicalRecordsForTreatment.length === 0
    ), {
      medical_record_by_id_exists: result.readback.medical_record_by_id_exists,
      medical_record_count_for_treatment: result.readback.medical_record_count_for_treatment
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_AFTER_MAIN_INSERT_VERIFY', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('NO_BILLING_YET_AFTER_MAIN_INSERT_VERIFY', !billingByTreatment, {
      billing_by_treatment_exists: result.readback.billing_by_treatment_exists
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-5',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EInsertTreatmentItemLog() {
  const result = {
    success: true,
    stage: '7E-6',
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
    counts_before: {},
    counts_after: {},
    selected: {
      treatment: null,
      appointment: null,
      service: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const serviceCatalogBefore = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_service_catalog = Array.isArray(serviceCatalogBefore) ? serviceCatalogBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_COUNTS_BEFORE_TREATMENT_ITEM_INSERT_EXPECTED', !!(
      result.counts_before.supabase_treatments === 255 &&
      result.counts_before.supabase_treatment_items === 489 &&
      result.counts_before.supabase_medical_records === 254 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_service_catalog === 100 &&
      result.counts_before.supabase_billings === 46 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BEFORE_TREATMENT_ITEM_INSERT_EXPECTED', !!(
      result.counts_before.supabase_scheduled_appointments === 6 &&
      result.counts_before.supabase_completed_appointments === 255 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const appointment = treatment
      ? TreatmentRepository.findAppointmentById(treatment.appointment_id, supabaseOptions)
      : null;

    const service = findTreatmentPhase7EByField_(
      serviceCatalogBefore,
      'service_id',
      'SRV-015'
    ) || (Array.isArray(serviceCatalogBefore) ? serviceCatalogBefore.find(function(row) {
      return isTreatmentPhase7EActiveService_(row) && isTreatmentPhase7ENonOrthoService_(row);
    }) : null);

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.selected.service = service ? {
      service_id: normalizeTreatmentPhase7EText_(service.service_id),
      service_name: normalizeTreatmentPhase7EText_(service.service_name),
      default_price: Number(service.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(service.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(service.is_ortho_control)
    } : null;

    addCheck('MAIN_TREATMENT_EXISTS_BEFORE_TREATMENT_ITEM_INSERT', !!treatment, {
      treatment: result.selected.treatment
    });

    addCheck('TREATMENT_APPOINTMENT_STILL_SCHEDULED_BEFORE_TREATMENT_ITEM_INSERT', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('SAFE_NON_ORTHO_SERVICE_EXISTS_FOR_TREATMENT_ITEM_INSERT', !!(
      service &&
      normalizeTreatmentPhase7EText_(service.service_id) &&
      isTreatmentPhase7EActiveService_(service) &&
      isTreatmentPhase7ENonOrthoService_(service)
    ), {
      service: result.selected.service
    });

    const existingItemByIdBefore = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatmentBefore = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecordByIdBefore = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const billingByTreatmentBefore = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    addCheck('TEST_TREATMENT_ITEM_NOT_EXISTING_BEFORE_INSERT', !!(
      !existingItemByIdBefore &&
      Array.isArray(itemsForTreatmentBefore) &&
      itemsForTreatmentBefore.length === 0
    ), {
      treatment_item_by_id_exists: !!existingItemByIdBefore,
      treatment_item_count_for_treatment: Array.isArray(itemsForTreatmentBefore) ? itemsForTreatmentBefore.length : -1
    });

    addCheck('MEDICAL_RECORD_AND_BILLING_STILL_NOT_CREATED_BEFORE_TREATMENT_ITEM_INSERT', !!(
      !medicalRecordByIdBefore &&
      !billingByTreatmentBefore
    ), {
      medical_record_exists: !!medicalRecordByIdBefore,
      billing_exists: !!billingByTreatmentBefore
    });

    if (
      !treatment ||
      !appointment ||
      normalizeTreatmentPhase7EStatus_(appointment.status) !== 'scheduled' ||
      !service ||
      existingItemByIdBefore ||
      !Array.isArray(itemsForTreatmentBefore) ||
      itemsForTreatmentBefore.length !== 0 ||
      medicalRecordByIdBefore ||
      billingByTreatmentBefore
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const itemPayload = buildTreatmentPhase7ETreatmentItemPayload_(service);

    addCheck('TREATMENT_ITEM_PAYLOAD_VALID_BEFORE_INSERT', !!(
      itemPayload.treatment_item_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      itemPayload.treatment_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      itemPayload.service_id === normalizeTreatmentPhase7EText_(service.service_id) &&
      itemPayload.service_name === normalizeTreatmentPhase7EText_(service.service_name) &&
      Number(itemPayload.qty || 0) === 1 &&
      Number(itemPayload.unit_price || 0) === Number(service.default_price || 0) &&
      Number(itemPayload.subtotal || 0) === Number(service.default_price || 0) &&
      itemPayload.is_ortho_install === false &&
      itemPayload.is_ortho_control === false
    ), {
      payload: itemPayload
    });

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.TREATMENT_ITEMS,
      itemPayload,
      {
        stage: '7E'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('TREATMENT_ITEM_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const insertedItemById = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatmentAfter = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentAfter = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const appointmentAfter = TreatmentRepository.findAppointmentById(
      normalizeTreatmentPhase7EText_(appointment.appointment_id),
      supabaseOptions
    );

    const medicalRecordByIdAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const billingByTreatmentAfter = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.readback.treatment_item_by_id = insertedItemById ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(insertedItemById.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(insertedItemById.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(insertedItemById.service_id),
      service_name: normalizeTreatmentPhase7EText_(insertedItemById.service_name),
      qty: Number(insertedItemById.qty || 0),
      unit_price: Number(insertedItemById.unit_price || 0),
      subtotal: Number(insertedItemById.subtotal || 0),
      is_ortho_install: boolTreatmentPhase7E_(insertedItemById.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(insertedItemById.is_ortho_control)
    } : null;

    result.readback.treatment_item_count_for_treatment = Array.isArray(itemsForTreatmentAfter)
      ? itemsForTreatmentAfter.length
      : -1;

    result.readback.appointment_after = appointmentAfter ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointmentAfter.appointment_id),
      status: normalizeTreatmentPhase7EStatus_(appointmentAfter.status)
    } : null;

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_TREATMENT_ITEM_INSERT', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_TREATMENT_COUNT_STILL_255_AFTER_TREATMENT_ITEM_INSERT', result.counts_after.supabase_treatments === 255, {
      actual: result.counts_after.supabase_treatments,
      expected: 255
    });

    addCheck('SUPABASE_TREATMENT_ITEM_COUNT_INCREASED_TO_490', result.counts_after.supabase_treatment_items === 490, {
      before_count: result.counts_before.supabase_treatment_items,
      after_count: result.counts_after.supabase_treatment_items,
      expected_after_count: 490
    });

    addCheck('OTHER_RELATED_COUNTS_UNCHANGED_AFTER_TREATMENT_ITEM_INSERT_ONLY', !!(
      result.counts_after.supabase_medical_records === result.counts_before.supabase_medical_records &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billings === result.counts_before.supabase_billings &&
      result.counts_after.supabase_billing_items === result.counts_before.supabase_billing_items &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_UNCHANGED_AFTER_TREATMENT_ITEM_INSERT_ONLY', !!(
      result.counts_after.supabase_scheduled_appointments === result.counts_before.supabase_scheduled_appointments &&
      result.counts_after.supabase_completed_appointments === result.counts_before.supabase_completed_appointments &&
      result.counts_after.supabase_cancelled_appointments === result.counts_before.supabase_cancelled_appointments
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      }
    });

    addCheck('TREATMENT_ITEM_READBACK_BY_ID_FOUND', !!insertedItemById, {
      treatment_item_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID
    });

    addCheck('TREATMENT_ITEM_LIST_BY_TREATMENT_HAS_ONE_ITEM', Array.isArray(itemsForTreatmentAfter) && itemsForTreatmentAfter.length === 1, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      treatment_item_count: result.readback.treatment_item_count_for_treatment
    });

    addCheck('TREATMENT_ITEM_FIELDS_MATCH_AFTER_INSERT', !!(
      insertedItemById &&
      normalizeTreatmentPhase7EText_(insertedItemById.treatment_item_id) === itemPayload.treatment_item_id &&
      normalizeTreatmentPhase7EText_(insertedItemById.treatment_id) === itemPayload.treatment_id &&
      normalizeTreatmentPhase7EText_(insertedItemById.service_id) === itemPayload.service_id &&
      normalizeTreatmentPhase7EText_(insertedItemById.service_name) === itemPayload.service_name &&
      Number(insertedItemById.qty || 0) === Number(itemPayload.qty || 0) &&
      Number(insertedItemById.unit_price || 0) === Number(itemPayload.unit_price || 0) &&
      Number(insertedItemById.subtotal || 0) === Number(itemPayload.subtotal || 0) &&
      boolTreatmentPhase7E_(insertedItemById.is_ortho_install) === false &&
      boolTreatmentPhase7E_(insertedItemById.is_ortho_control) === false
    ), {
      readback: result.readback.treatment_item_by_id
    });

    addCheck('MAIN_TREATMENT_STILL_EXISTS_AFTER_TREATMENT_ITEM_INSERT', !!treatmentAfter, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    });

    addCheck('NO_MEDICAL_RECORD_YET_AFTER_TREATMENT_ITEM_INSERT', !medicalRecordByIdAfter, {
      medical_record_id: TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      exists: !!medicalRecordByIdAfter
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_AFTER_TREATMENT_ITEM_INSERT_ONLY', !!(
      appointmentAfter &&
      normalizeTreatmentPhase7EStatus_(appointmentAfter.status) === 'scheduled'
    ), {
      appointment_after: result.readback.appointment_after
    });

    addCheck('NO_BILLING_YET_AFTER_TREATMENT_ITEM_INSERT', !billingByTreatmentAfter, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      billing_exists: !!billingByTreatmentAfter
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-6',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EReadBackTreatmentItemLog() {
  const result = {
    success: true,
    stage: '7E-7',
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
    selected: {
      treatment: null,
      treatment_item: null,
      appointment: null,
      service: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7E', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const serviceCatalog = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(serviceCatalog) ? serviceCatalog.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;
    result.counts.supabase_scheduled_appointments = scheduledRows.length;
    result.counts.supabase_completed_appointments = completedRows.length;
    result.counts.supabase_cancelled_appointments = cancelledRows.length;

    addCheck('SPREADSHEET_TREATMENT_COUNT_STILL_282_AFTER_TREATMENT_ITEM_VERIFY', result.counts.spreadsheet_treatments === 282, {
      actual: result.counts.spreadsheet_treatments,
      expected: 282
    });

    addCheck('SUPABASE_COUNTS_AFTER_TREATMENT_ITEM_VERIFY', !!(
      result.counts.supabase_treatments === 255 &&
      result.counts.supabase_treatment_items === 490 &&
      result.counts.supabase_medical_records === 254 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_service_catalog === 100 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_AFTER_TREATMENT_ITEM_VERIFY', !!(
      result.counts.supabase_scheduled_appointments === 6 &&
      result.counts.supabase_completed_appointments === 255 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentByAppointment = TreatmentRepository.findTreatmentByAppointmentId(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const service = findTreatmentPhase7EByField_(
      serviceCatalog,
      'service_id',
      'SRV-015'
    );

    const appointment = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const medicalRecordById = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = TreatmentRepository.listMedicalRecordsByTreatmentId
      ? TreatmentRepository.listMedicalRecordsByTreatmentId(TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID, supabaseOptions)
      : [];

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      qty: Number(treatmentItem.qty || 0),
      unit_price: Number(treatmentItem.unit_price || 0),
      subtotal: Number(treatmentItem.subtotal || 0),
      is_ortho_install: boolTreatmentPhase7E_(treatmentItem.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(treatmentItem.is_ortho_control)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.selected.service = service ? {
      service_id: normalizeTreatmentPhase7EText_(service.service_id),
      service_name: normalizeTreatmentPhase7EText_(service.service_name),
      default_price: Number(service.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(service.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(service.is_ortho_control)
    } : null;

    result.readback.treatment_item_count_for_treatment = Array.isArray(itemsForTreatment)
      ? itemsForTreatment.length
      : -1;
    result.readback.medical_record_by_id_exists = !!medicalRecordById;
    result.readback.medical_record_count_for_treatment = Array.isArray(medicalRecordsForTreatment)
      ? medicalRecordsForTreatment.length
      : -1;
    result.readback.billing_by_treatment_exists = !!billingByTreatment;

    addCheck('MAIN_TREATMENT_STILL_FOUND_AFTER_TREATMENT_ITEM_VERIFY', !!(
      treatment &&
      normalizeTreatmentPhase7EText_(treatment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    ), {
      treatment: result.selected.treatment
    });

    addCheck('MAIN_TREATMENT_STILL_FOUND_BY_APPOINTMENT_AFTER_TREATMENT_ITEM_VERIFY', !!(
      treatmentByAppointment &&
      normalizeTreatmentPhase7EText_(treatmentByAppointment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    ), {
      appointment_id: 'APT-20260430-135818056-583',
      treatment_id: treatmentByAppointment ? treatmentByAppointment.treatment_id : ''
    });

    addCheck('TREATMENT_ITEM_FOUND_BY_ID_AFTER_INSERT_VERIFY', !!treatmentItem, {
      treatment_item_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID
    });

    addCheck('TREATMENT_ITEM_LIST_BY_TREATMENT_HAS_ONE_ITEM_AFTER_INSERT_VERIFY', !!(
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1 &&
      itemsForTreatment.some(function(row) {
        return normalizeTreatmentPhase7EText_(row.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID;
      })
    ), {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      treatment_item_count: result.readback.treatment_item_count_for_treatment,
      item_ids: Array.isArray(itemsForTreatment)
        ? itemsForTreatment.map(function(row) { return row.treatment_item_id; })
        : []
    });

    addCheck('TREATMENT_ITEM_FIELDS_MATCH_AFTER_INSERT_VERIFY', !!(
      treatmentItem &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_name) === 'Bleaching Rarb' &&
      Number(treatmentItem.qty || 0) === 1 &&
      Number(treatmentItem.unit_price || 0) === 700000 &&
      Number(treatmentItem.subtotal || 0) === 700000 &&
      boolTreatmentPhase7E_(treatmentItem.is_ortho_install) === false &&
      boolTreatmentPhase7E_(treatmentItem.is_ortho_control) === false
    ), {
      treatment_item: result.selected.treatment_item
    });

    addCheck('TREATMENT_ITEM_SERVICE_FOUND_AND_MATCHES_CATALOG', !!(
      service &&
      treatmentItem &&
      normalizeTreatmentPhase7EText_(service.service_id) === normalizeTreatmentPhase7EText_(treatmentItem.service_id) &&
      normalizeTreatmentPhase7EText_(service.service_name) === normalizeTreatmentPhase7EText_(treatmentItem.service_name) &&
      Number(service.default_price || 0) === Number(treatmentItem.unit_price || 0)
    ), {
      service: result.selected.service,
      treatment_item: result.selected.treatment_item
    });

    addCheck('TREATMENT_TOTAL_MATCHES_ITEM_SUBTOTAL_AFTER_ITEM_INSERT_VERIFY', !!(
      treatment &&
      treatmentItem &&
      Number(treatment.total_cost || 0) === Number(treatmentItem.subtotal || 0)
    ), {
      treatment_total_cost: treatment ? Number(treatment.total_cost || 0) : null,
      treatment_item_subtotal: treatmentItem ? Number(treatmentItem.subtotal || 0) : null
    });

    addCheck('NO_MEDICAL_RECORD_YET_AFTER_TREATMENT_ITEM_VERIFY', !!(
      !medicalRecordById &&
      (
        !Array.isArray(medicalRecordsForTreatment) ||
        medicalRecordsForTreatment.length === 0
      )
    ), {
      medical_record_by_id_exists: result.readback.medical_record_by_id_exists,
      medical_record_count_for_treatment: result.readback.medical_record_count_for_treatment
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_AFTER_TREATMENT_ITEM_VERIFY', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('NO_BILLING_YET_AFTER_TREATMENT_ITEM_VERIFY', !billingByTreatment, {
      billing_by_treatment_exists: result.readback.billing_by_treatment_exists
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-7',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EInsertMedicalRecordLog() {
  const result = {
    success: true,
    stage: '7E-8',
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
    counts_before: {},
    counts_after: {},
    selected: {
      treatment: null,
      treatment_item: null,
      appointment: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_COUNTS_BEFORE_MEDICAL_RECORD_INSERT_EXPECTED', !!(
      result.counts_before.supabase_treatments === 255 &&
      result.counts_before.supabase_treatment_items === 490 &&
      result.counts_before.supabase_medical_records === 254 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_billings === 46 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BEFORE_MEDICAL_RECORD_INSERT_EXPECTED', !!(
      result.counts_before.supabase_scheduled_appointments === 6 &&
      result.counts_before.supabase_completed_appointments === 255 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const appointment = treatment
      ? TreatmentRepository.findAppointmentById(treatment.appointment_id, supabaseOptions)
      : null;

    const medicalRecordBefore = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatmentBefore = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecordsBefore,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const billingByTreatmentBefore = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(treatment.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || ''),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      subtotal: Number(treatmentItem.subtotal || 0)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    addCheck('MAIN_TREATMENT_EXISTS_BEFORE_MEDICAL_RECORD_INSERT', !!treatment, {
      treatment: result.selected.treatment
    });

    addCheck('TREATMENT_ITEM_EXISTS_BEFORE_MEDICAL_RECORD_INSERT', !!(
      treatmentItem &&
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1
    ), {
      treatment_item: result.selected.treatment_item,
      item_count_for_treatment: Array.isArray(itemsForTreatment) ? itemsForTreatment.length : -1
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_BEFORE_MEDICAL_RECORD_INSERT', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('MEDICAL_RECORD_NOT_EXISTING_BEFORE_INSERT', !!(
      !medicalRecordBefore &&
      Array.isArray(medicalRecordsForTreatmentBefore) &&
      medicalRecordsForTreatmentBefore.length === 0
    ), {
      medical_record_by_id_exists: !!medicalRecordBefore,
      medical_record_count_for_treatment: Array.isArray(medicalRecordsForTreatmentBefore) ? medicalRecordsForTreatmentBefore.length : -1
    });

    addCheck('BILLING_STILL_NOT_CREATED_BEFORE_MEDICAL_RECORD_INSERT', !billingByTreatmentBefore, {
      billing_exists: !!billingByTreatmentBefore
    });

    if (
      !treatment ||
      !treatmentItem ||
      !Array.isArray(itemsForTreatment) ||
      itemsForTreatment.length !== 1 ||
      !appointment ||
      normalizeTreatmentPhase7EStatus_(appointment.status) !== 'scheduled' ||
      medicalRecordBefore ||
      !Array.isArray(medicalRecordsForTreatmentBefore) ||
      medicalRecordsForTreatmentBefore.length !== 0 ||
      billingByTreatmentBefore
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const medicalRecordPayload = buildTreatmentPhase7EMedicalRecordPayload_(appointment, {
      full_name: treatment.doctor_name
    });

    addCheck('MEDICAL_RECORD_PAYLOAD_VALID_BEFORE_INSERT', !!(
      medicalRecordPayload.record_id === TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID &&
      medicalRecordPayload.patient_id === normalizeTreatmentPhase7EText_(treatment.patient_id) &&
      medicalRecordPayload.patient_name === normalizeTreatmentPhase7EText_(treatment.patient_name) &&
      medicalRecordPayload.appointment_id === normalizeTreatmentPhase7EText_(treatment.appointment_id) &&
      medicalRecordPayload.treatment_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      medicalRecordPayload.doctor_name === normalizeTreatmentPhase7EText_(treatment.doctor_name) &&
      medicalRecordPayload.visit_date === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      medicalRecordPayload.chief_complaint === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      medicalRecordPayload.diagnosis === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      medicalRecordPayload.clinical_notes === TREATMENT_PHASE_7E_TEST_IDS.NOTES
    ), {
      payload: medicalRecordPayload
    });

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.MEDICAL_RECORDS,
      medicalRecordPayload,
      {
        stage: '7E'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('MEDICAL_RECORD_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const medicalRecordAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatmentAfter = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecordsAfter,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const treatmentAfter = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItemsForTreatmentAfter = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const appointmentAfter = TreatmentRepository.findAppointmentById(
      normalizeTreatmentPhase7EText_(treatment.appointment_id),
      supabaseOptions
    );

    const billingByTreatmentAfter = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.readback.medical_record_by_id = medicalRecordAfter ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecordAfter.record_id),
      patient_id: normalizeTreatmentPhase7EText_(medicalRecordAfter.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(medicalRecordAfter.patient_name),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecordAfter.appointment_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecordAfter.treatment_id),
      doctor_name: normalizeTreatmentPhase7EText_(medicalRecordAfter.doctor_name),
      visit_date: normalizeTreatmentPhase7EYmd_(medicalRecordAfter.visit_date || medicalRecordAfter.record_date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(medicalRecordAfter.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(medicalRecordAfter.diagnosis),
      clinical_notes: normalizeTreatmentPhase7EText_(medicalRecordAfter.clinical_notes)
    } : null;

    result.readback.medical_record_count_for_treatment = Array.isArray(medicalRecordsForTreatmentAfter)
      ? medicalRecordsForTreatmentAfter.length
      : -1;

    result.readback.appointment_after = appointmentAfter ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointmentAfter.appointment_id),
      status: normalizeTreatmentPhase7EStatus_(appointmentAfter.status)
    } : null;

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_MEDICAL_RECORD_INSERT', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_MEDICAL_RECORD_COUNT_INCREASED_TO_255', result.counts_after.supabase_medical_records === 255, {
      before_count: result.counts_before.supabase_medical_records,
      after_count: result.counts_after.supabase_medical_records,
      expected_after_count: 255
    });

    addCheck('OTHER_RELATED_COUNTS_UNCHANGED_AFTER_MEDICAL_RECORD_INSERT_ONLY', !!(
      result.counts_after.supabase_treatments === result.counts_before.supabase_treatments &&
      result.counts_after.supabase_treatment_items === result.counts_before.supabase_treatment_items &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billings === result.counts_before.supabase_billings &&
      result.counts_after.supabase_billing_items === result.counts_before.supabase_billing_items &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_UNCHANGED_AFTER_MEDICAL_RECORD_INSERT_ONLY', !!(
      result.counts_after.supabase_scheduled_appointments === result.counts_before.supabase_scheduled_appointments &&
      result.counts_after.supabase_completed_appointments === result.counts_before.supabase_completed_appointments &&
      result.counts_after.supabase_cancelled_appointments === result.counts_before.supabase_cancelled_appointments
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      }
    });

    addCheck('MEDICAL_RECORD_READBACK_BY_ID_FOUND', !!medicalRecordAfter, {
      record_id: TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID
    });

    addCheck('MEDICAL_RECORD_LIST_BY_TREATMENT_HAS_ONE_RECORD', Array.isArray(medicalRecordsForTreatmentAfter) && medicalRecordsForTreatmentAfter.length === 1, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      medical_record_count: result.readback.medical_record_count_for_treatment
    });

    addCheck('MEDICAL_RECORD_FIELDS_MATCH_AFTER_INSERT', !!(
      medicalRecordAfter &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.record_id) === medicalRecordPayload.record_id &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.patient_id) === medicalRecordPayload.patient_id &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.patient_name) === medicalRecordPayload.patient_name &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.appointment_id) === medicalRecordPayload.appointment_id &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.treatment_id) === medicalRecordPayload.treatment_id &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.doctor_name) === medicalRecordPayload.doctor_name &&
      normalizeTreatmentPhase7EYmd_(medicalRecordAfter.visit_date || medicalRecordAfter.record_date || '') === medicalRecordPayload.visit_date &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.chief_complaint) === medicalRecordPayload.chief_complaint &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.diagnosis) === medicalRecordPayload.diagnosis &&
      normalizeTreatmentPhase7EText_(medicalRecordAfter.clinical_notes) === medicalRecordPayload.clinical_notes
    ), {
      readback: result.readback.medical_record_by_id
    });

    addCheck('MAIN_TREATMENT_AND_ITEM_STILL_EXIST_AFTER_MEDICAL_RECORD_INSERT', !!(
      treatmentAfter &&
      Array.isArray(treatmentItemsForTreatmentAfter) &&
      treatmentItemsForTreatmentAfter.length === 1
    ), {
      treatment_exists: !!treatmentAfter,
      treatment_item_count: Array.isArray(treatmentItemsForTreatmentAfter) ? treatmentItemsForTreatmentAfter.length : -1
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_AFTER_MEDICAL_RECORD_INSERT_ONLY', !!(
      appointmentAfter &&
      normalizeTreatmentPhase7EStatus_(appointmentAfter.status) === 'scheduled'
    ), {
      appointment_after: result.readback.appointment_after
    });

    addCheck('NO_BILLING_YET_AFTER_MEDICAL_RECORD_INSERT', !billingByTreatmentAfter, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      billing_exists: !!billingByTreatmentAfter
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-8',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EReadBackMedicalRecordLog() {
  const result = {
    success: true,
    stage: '7E-9',
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
    selected: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7E', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;
    result.counts.supabase_scheduled_appointments = scheduledRows.length;
    result.counts.supabase_completed_appointments = completedRows.length;
    result.counts.supabase_cancelled_appointments = cancelledRows.length;

    addCheck('SPREADSHEET_TREATMENT_COUNT_STILL_282_AFTER_MEDICAL_RECORD_VERIFY', result.counts.spreadsheet_treatments === 282, {
      actual: result.counts.spreadsheet_treatments,
      expected: 282
    });

    addCheck('SUPABASE_COUNTS_AFTER_MEDICAL_RECORD_VERIFY', !!(
      result.counts.supabase_treatments === 255 &&
      result.counts.supabase_treatment_items === 490 &&
      result.counts.supabase_medical_records === 255 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_AFTER_MEDICAL_RECORD_VERIFY', !!(
      result.counts.supabase_scheduled_appointments === 6 &&
      result.counts.supabase_completed_appointments === 255 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecords,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const appointment = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(treatment.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || ''),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      qty: Number(treatmentItem.qty || 0),
      unit_price: Number(treatmentItem.unit_price || 0),
      subtotal: Number(treatmentItem.subtotal || 0),
      is_ortho_install: boolTreatmentPhase7E_(treatmentItem.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(treatmentItem.is_ortho_control)
    } : null;

    result.selected.medical_record = medicalRecord ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecord.record_id),
      patient_id: normalizeTreatmentPhase7EText_(medicalRecord.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(medicalRecord.patient_name),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecord.appointment_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecord.treatment_id),
      doctor_name: normalizeTreatmentPhase7EText_(medicalRecord.doctor_name),
      visit_date: normalizeTreatmentPhase7EYmd_(medicalRecord.visit_date || medicalRecord.record_date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(medicalRecord.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(medicalRecord.diagnosis),
      clinical_notes: normalizeTreatmentPhase7EText_(medicalRecord.clinical_notes)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.readback.treatment_item_count_for_treatment = Array.isArray(itemsForTreatment)
      ? itemsForTreatment.length
      : -1;

    result.readback.medical_record_count_for_treatment = Array.isArray(medicalRecordsForTreatment)
      ? medicalRecordsForTreatment.length
      : -1;

    result.readback.billing_by_treatment_exists = !!billingByTreatment;

    addCheck('MAIN_TREATMENT_STILL_FOUND_AFTER_MEDICAL_RECORD_VERIFY', !!(
      treatment &&
      normalizeTreatmentPhase7EText_(treatment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatment.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(treatment.patient_id) === 'PAT-20260430-135721617-083' &&
      Number(treatment.total_cost || 0) === 700000
    ), {
      treatment: result.selected.treatment
    });

    addCheck('TREATMENT_ITEM_STILL_FOUND_AFTER_MEDICAL_RECORD_VERIFY', !!(
      treatmentItem &&
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1 &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_id) === 'SRV-015' &&
      Number(treatmentItem.subtotal || 0) === 700000
    ), {
      treatment_item: result.selected.treatment_item,
      treatment_item_count_for_treatment: result.readback.treatment_item_count_for_treatment
    });

    addCheck('MEDICAL_RECORD_FOUND_BY_ID_AFTER_INSERT_VERIFY', !!medicalRecord, {
      record_id: TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID
    });

    addCheck('MEDICAL_RECORD_LIST_BY_TREATMENT_HAS_ONE_RECORD_AFTER_INSERT_VERIFY', !!(
      Array.isArray(medicalRecordsForTreatment) &&
      medicalRecordsForTreatment.length === 1 &&
      medicalRecordsForTreatment.some(function(row) {
        return normalizeTreatmentPhase7EText_(row.record_id) === TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID;
      })
    ), {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      medical_record_count_for_treatment: result.readback.medical_record_count_for_treatment,
      record_ids: Array.isArray(medicalRecordsForTreatment)
        ? medicalRecordsForTreatment.map(function(row) { return row.record_id; })
        : []
    });

    addCheck('MEDICAL_RECORD_FIELDS_MATCH_AFTER_INSERT_VERIFY', !!(
      medicalRecord &&
      normalizeTreatmentPhase7EText_(medicalRecord.record_id) === TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID &&
      normalizeTreatmentPhase7EText_(medicalRecord.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(medicalRecord.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EText_(medicalRecord.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(medicalRecord.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(medicalRecord.doctor_name) === 'drg.Novira Zahara Banurea' &&
      normalizeTreatmentPhase7EYmd_(medicalRecord.visit_date || medicalRecord.record_date || '') === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EText_(medicalRecord.chief_complaint) === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      normalizeTreatmentPhase7EText_(medicalRecord.diagnosis) === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      normalizeTreatmentPhase7EText_(medicalRecord.clinical_notes) === TREATMENT_PHASE_7E_TEST_IDS.NOTES
    ), {
      medical_record: result.selected.medical_record
    });

    addCheck('TREATMENT_TOTAL_AND_ITEM_SUBTOTAL_STILL_MATCH_AFTER_MEDICAL_RECORD_VERIFY', !!(
      treatment &&
      treatmentItem &&
      Number(treatment.total_cost || 0) === 700000 &&
      Number(treatmentItem.subtotal || 0) === 700000 &&
      Number(treatment.total_cost || 0) === Number(treatmentItem.subtotal || 0)
    ), {
      treatment_total_cost: treatment ? Number(treatment.total_cost || 0) : null,
      treatment_item_subtotal: treatmentItem ? Number(treatmentItem.subtotal || 0) : null
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_AFTER_MEDICAL_RECORD_VERIFY', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('NO_BILLING_YET_AFTER_MEDICAL_RECORD_VERIFY', !billingByTreatment, {
      billing_by_treatment_exists: result.readback.billing_by_treatment_exists
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-9',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EUpdateAppointmentCompletedLog() {
  const result = {
    success: true,
    stage: '7E-10',
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
    counts_before: {},
    counts_after: {},
    selected: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_COUNTS_BEFORE_APPOINTMENT_COMPLETED_UPDATE_EXPECTED', !!(
      result.counts_before.supabase_treatments === 255 &&
      result.counts_before.supabase_treatment_items === 490 &&
      result.counts_before.supabase_medical_records === 255 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_billings === 46 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BEFORE_COMPLETED_UPDATE_EXPECTED', !!(
      result.counts_before.supabase_scheduled_appointments === 6 &&
      result.counts_before.supabase_completed_appointments === 255 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 6,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 255,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecordsBefore,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const appointment = treatment
      ? TreatmentRepository.findAppointmentById(treatment.appointment_id, supabaseOptions)
      : null;

    const billingByTreatmentBefore = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(treatment.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || ''),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      subtotal: Number(treatmentItem.subtotal || 0)
    } : null;

    result.selected.medical_record = medicalRecord ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecord.record_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecord.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecord.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(medicalRecord.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(medicalRecord.patient_name)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    addCheck('MAIN_TREATMENT_EXISTS_BEFORE_APPOINTMENT_COMPLETED_UPDATE', !!treatment, {
      treatment: result.selected.treatment
    });

    addCheck('TREATMENT_ITEM_EXISTS_BEFORE_APPOINTMENT_COMPLETED_UPDATE', !!(
      treatmentItem &&
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1
    ), {
      treatment_item: result.selected.treatment_item,
      treatment_item_count_for_treatment: Array.isArray(itemsForTreatment) ? itemsForTreatment.length : -1
    });

    addCheck('MEDICAL_RECORD_EXISTS_BEFORE_APPOINTMENT_COMPLETED_UPDATE', !!(
      medicalRecord &&
      Array.isArray(medicalRecordsForTreatment) &&
      medicalRecordsForTreatment.length === 1
    ), {
      medical_record: result.selected.medical_record,
      medical_record_count_for_treatment: Array.isArray(medicalRecordsForTreatment) ? medicalRecordsForTreatment.length : -1
    });

    addCheck('APPOINTMENT_STILL_SCHEDULED_BEFORE_COMPLETED_UPDATE', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('BILLING_STILL_NOT_CREATED_BEFORE_APPOINTMENT_COMPLETED_UPDATE', !billingByTreatmentBefore, {
      billing_exists: !!billingByTreatmentBefore
    });

    if (
      !treatment ||
      !treatmentItem ||
      !Array.isArray(itemsForTreatment) ||
      itemsForTreatment.length !== 1 ||
      !medicalRecord ||
      !Array.isArray(medicalRecordsForTreatment) ||
      medicalRecordsForTreatment.length !== 1 ||
      !appointment ||
      normalizeTreatmentPhase7EStatus_(appointment.status) !== 'scheduled' ||
      billingByTreatmentBefore
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const appointmentPatch = {
      status: 'completed',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    const updateResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      'appointment_id',
      normalizeTreatmentPhase7EText_(appointment.appointment_id),
      appointmentPatch,
      {
        stage: '7E'
      }
    );

    result.update_result = {
      success: !!(updateResponse && updateResponse.success),
      status_code: updateResponse ? updateResponse.status_code : null,
      row_count: updateResponse ? updateResponse.row_count : null,
      target_table: updateResponse ? updateResponse.target_table : ''
    };

    addCheck('APPOINTMENT_COMPLETED_UPDATE_RESPONSE_SUCCESS', !!(updateResponse && updateResponse.success), result.update_result);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const appointmentAfter = TreatmentRepository.findAppointmentById(
      normalizeTreatmentPhase7EText_(appointment.appointment_id),
      supabaseOptions
    );

    const treatmentAfter = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItemAfter = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const medicalRecordAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const billingByTreatmentAfter = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    result.readback.appointment_after = appointmentAfter ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointmentAfter.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointmentAfter.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointmentAfter.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointmentAfter.status)
    } : null;

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_APPOINTMENT_COMPLETED_UPDATE', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('RELATED_TABLE_COUNTS_UNCHANGED_AFTER_APPOINTMENT_COMPLETED_UPDATE_ONLY', !!(
      result.counts_after.supabase_treatments === result.counts_before.supabase_treatments &&
      result.counts_after.supabase_treatment_items === result.counts_before.supabase_treatment_items &&
      result.counts_after.supabase_medical_records === result.counts_before.supabase_medical_records &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billings === result.counts_before.supabase_billings &&
      result.counts_after.supabase_billing_items === result.counts_before.supabase_billing_items &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_UPDATED_AFTER_COMPLETED_UPDATE', !!(
      result.counts_after.supabase_scheduled_appointments === 5 &&
      result.counts_after.supabase_completed_appointments === 256 &&
      result.counts_after.supabase_cancelled_appointments === 23
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      },
      expected_after: {
        scheduled: 5,
        completed: 256,
        cancelled: 23
      }
    });

    addCheck('APPOINTMENT_STATUS_COMPLETED_AFTER_UPDATE', !!(
      appointmentAfter &&
      normalizeTreatmentPhase7EStatus_(appointmentAfter.status) === 'completed'
    ), {
      appointment_after: result.readback.appointment_after
    });

    addCheck('MAIN_TREATMENT_ITEM_MEDICAL_RECORD_STILL_EXIST_AFTER_APPOINTMENT_COMPLETED_UPDATE', !!(
      treatmentAfter &&
      treatmentItemAfter &&
      medicalRecordAfter
    ), {
      treatment_exists: !!treatmentAfter,
      treatment_item_exists: !!treatmentItemAfter,
      medical_record_exists: !!medicalRecordAfter
    });

    addCheck('NO_BILLING_YET_AFTER_APPOINTMENT_COMPLETED_UPDATE', !billingByTreatmentAfter, {
      treatment_id: TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      billing_exists: !!billingByTreatmentAfter
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-10',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EReadBackCompletedBundleLog() {
  const result = {
    success: true,
    stage: '7E-11',
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
    selected: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment: null,
      patient: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7E', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const services = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(services) ? services.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;
    result.counts.supabase_scheduled_appointments = scheduledRows.length;
    result.counts.supabase_completed_appointments = completedRows.length;
    result.counts.supabase_cancelled_appointments = cancelledRows.length;

    addCheck('SPREADSHEET_TREATMENT_COUNT_STILL_282_AFTER_COMPLETED_BUNDLE_VERIFY', result.counts.spreadsheet_treatments === 282, {
      actual: result.counts.spreadsheet_treatments,
      expected: 282
    });

    addCheck('SUPABASE_COUNTS_AFTER_COMPLETED_BUNDLE_VERIFY', !!(
      result.counts.supabase_treatments === 255 &&
      result.counts.supabase_treatment_items === 490 &&
      result.counts.supabase_medical_records === 255 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_patients === 285 &&
      result.counts.supabase_service_catalog === 100 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_AFTER_COMPLETED_BUNDLE_VERIFY', !!(
      result.counts.supabase_scheduled_appointments === 5 &&
      result.counts.supabase_completed_appointments === 256 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 5,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 256,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    addCheck('APPOINTMENT_STATUS_TOTAL_MATCH_AFTER_COMPLETED_BUNDLE_VERIFY', (
      result.counts.supabase_appointments ===
      result.counts.supabase_scheduled_appointments +
      result.counts.supabase_completed_appointments +
      result.counts.supabase_cancelled_appointments
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.counts.supabase_scheduled_appointments,
      completed: result.counts.supabase_completed_appointments,
      cancelled: result.counts.supabase_cancelled_appointments
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentByAppointment = TreatmentRepository.findTreatmentByAppointmentId(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecords,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const appointment = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const patient = TreatmentRepository.findPatientById(
      'PAT-20260430-135721617-083',
      supabaseOptions
    );

    const service = findTreatmentPhase7EByField_(
      services,
      'service_id',
      'SRV-015'
    );

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const relatedBillingItems = Array.isArray(billingItems)
      ? billingItems.filter(function(row) {
          return normalizeTreatmentPhase7EText_(row.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID ||
            normalizeTreatmentPhase7EText_(row.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID;
        })
      : [];

    const relatedOrthoRecall = Array.isArray(orthoRecalls)
      ? orthoRecalls.filter(function(row) {
          return normalizeTreatmentPhase7EText_(row.install_treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID ||
            normalizeTreatmentPhase7EText_(row.last_control_treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID;
        })
      : [];

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(treatment.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(treatment.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(treatment.diagnosis),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      qty: Number(treatmentItem.qty || 0),
      unit_price: Number(treatmentItem.unit_price || 0),
      subtotal: Number(treatmentItem.subtotal || 0),
      is_ortho_install: boolTreatmentPhase7E_(treatmentItem.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(treatmentItem.is_ortho_control)
    } : null;

    result.selected.medical_record = medicalRecord ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecord.record_id),
      patient_id: normalizeTreatmentPhase7EText_(medicalRecord.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(medicalRecord.patient_name),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecord.appointment_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecord.treatment_id),
      doctor_name: normalizeTreatmentPhase7EText_(medicalRecord.doctor_name),
      visit_date: normalizeTreatmentPhase7EYmd_(medicalRecord.visit_date || medicalRecord.record_date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(medicalRecord.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(medicalRecord.diagnosis),
      clinical_notes: normalizeTreatmentPhase7EText_(medicalRecord.clinical_notes)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(appointment.appointment_date || appointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(appointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.selected.patient = patient ? {
      patient_id: normalizeTreatmentPhase7EText_(patient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(patient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(patient.patient_code),
      phone: normalizeTreatmentPhase7EText_(patient.phone)
    } : null;

    result.readback.treatment_by_appointment_id = treatmentByAppointment
      ? normalizeTreatmentPhase7EText_(treatmentByAppointment.treatment_id)
      : '';

    result.readback.treatment_item_count_for_treatment = Array.isArray(itemsForTreatment)
      ? itemsForTreatment.length
      : -1;

    result.readback.medical_record_count_for_treatment = Array.isArray(medicalRecordsForTreatment)
      ? medicalRecordsForTreatment.length
      : -1;

    result.readback.billing_by_treatment_exists = !!billingByTreatment;
    result.readback.related_billing_item_count = Array.isArray(relatedBillingItems) ? relatedBillingItems.length : -1;
    result.readback.related_ortho_recall_count = Array.isArray(relatedOrthoRecall) ? relatedOrthoRecall.length : -1;

    addCheck('COMPLETED_BUNDLE_MAIN_TREATMENT_FOUND_AND_MATCHES', !!(
      treatment &&
      normalizeTreatmentPhase7EText_(treatment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatment.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(treatment.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(treatment.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EText_(treatment.doctor_name) === 'drg.Novira Zahara Banurea' &&
      normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || '') === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EText_(treatment.chief_complaint) === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      normalizeTreatmentPhase7EText_(treatment.diagnosis) === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      Number(treatment.total_cost || 0) === 700000
    ), {
      treatment: result.selected.treatment
    });

    addCheck('COMPLETED_BUNDLE_TREATMENT_FOUND_BY_APPOINTMENT', !!(
      treatmentByAppointment &&
      normalizeTreatmentPhase7EText_(treatmentByAppointment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    ), {
      appointment_id: 'APT-20260430-135818056-583',
      treatment_id: result.readback.treatment_by_appointment_id
    });

    addCheck('COMPLETED_BUNDLE_ITEM_FOUND_AND_MATCHES', !!(
      treatmentItem &&
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1 &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_name) === 'Bleaching Rarb' &&
      Number(treatmentItem.qty || 0) === 1 &&
      Number(treatmentItem.unit_price || 0) === 700000 &&
      Number(treatmentItem.subtotal || 0) === 700000 &&
      boolTreatmentPhase7E_(treatmentItem.is_ortho_install) === false &&
      boolTreatmentPhase7E_(treatmentItem.is_ortho_control) === false
    ), {
      treatment_item: result.selected.treatment_item,
      treatment_item_count_for_treatment: result.readback.treatment_item_count_for_treatment
    });

    addCheck('COMPLETED_BUNDLE_MEDICAL_RECORD_FOUND_AND_MATCHES', !!(
      medicalRecord &&
      Array.isArray(medicalRecordsForTreatment) &&
      medicalRecordsForTreatment.length === 1 &&
      normalizeTreatmentPhase7EText_(medicalRecord.record_id) === TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID &&
      normalizeTreatmentPhase7EText_(medicalRecord.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(medicalRecord.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EText_(medicalRecord.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(medicalRecord.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(medicalRecord.doctor_name) === 'drg.Novira Zahara Banurea' &&
      normalizeTreatmentPhase7EYmd_(medicalRecord.visit_date || medicalRecord.record_date || '') === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EText_(medicalRecord.chief_complaint) === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      normalizeTreatmentPhase7EText_(medicalRecord.diagnosis) === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      normalizeTreatmentPhase7EText_(medicalRecord.clinical_notes) === TREATMENT_PHASE_7E_TEST_IDS.NOTES
    ), {
      medical_record: result.selected.medical_record,
      medical_record_count_for_treatment: result.readback.medical_record_count_for_treatment
    });

    addCheck('COMPLETED_BUNDLE_APPOINTMENT_COMPLETED', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'completed'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('COMPLETED_BUNDLE_PATIENT_FOUND_AND_MATCHES', !!(
      patient &&
      normalizeTreatmentPhase7EText_(patient.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(patient.full_name) === 'Roria Laura Elisabeth Tampubolon'
    ), {
      patient: result.selected.patient
    });

    addCheck('COMPLETED_BUNDLE_SERVICE_FOUND_AND_NON_ORTHO', !!(
      service &&
      normalizeTreatmentPhase7EText_(service.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(service.service_name) === 'Bleaching Rarb' &&
      Number(service.default_price || 0) === 700000 &&
      !boolTreatmentPhase7E_(service.is_ortho_install) &&
      !boolTreatmentPhase7E_(service.is_ortho_control)
    ), {
      service_id: service ? service.service_id : '',
      service_name: service ? service.service_name : '',
      default_price: service ? Number(service.default_price || 0) : null,
      is_ortho_install: service ? boolTreatmentPhase7E_(service.is_ortho_install) : null,
      is_ortho_control: service ? boolTreatmentPhase7E_(service.is_ortho_control) : null
    });

    addCheck('COMPLETED_BUNDLE_TOTAL_MATCHES_ITEM_SUBTOTAL', !!(
      treatment &&
      treatmentItem &&
      Number(treatment.total_cost || 0) === Number(treatmentItem.subtotal || 0) &&
      Number(treatment.total_cost || 0) === 700000
    ), {
      treatment_total_cost: treatment ? Number(treatment.total_cost || 0) : null,
      treatment_item_subtotal: treatmentItem ? Number(treatmentItem.subtotal || 0) : null
    });

    addCheck('COMPLETED_BUNDLE_NO_BILLING_YET', !!(
      !billingByTreatment &&
      Array.isArray(relatedBillingItems) &&
      relatedBillingItems.length === 0
    ), {
      billing_by_treatment_exists: result.readback.billing_by_treatment_exists,
      related_billing_item_count: result.readback.related_billing_item_count
    });

    addCheck('COMPLETED_BUNDLE_NO_ORTHO_RECALL_SYNC_EXPECTED_FOR_NON_ORTHO_SERVICE', !!(
      Array.isArray(relatedOrthoRecall) &&
      relatedOrthoRecall.length === 0
    ), {
      related_ortho_recall_count: result.readback.related_ortho_recall_count
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-11',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EInsertDraftBillingParentLog() {
  const result = {
    success: true,
    stage: '7E-12',
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
    counts_before: {},
    counts_after: {},
    selected: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment: null,
      billing: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_COUNTS_BEFORE_DRAFT_BILLING_PARENT_INSERT_EXPECTED', !!(
      result.counts_before.supabase_treatments === 255 &&
      result.counts_before.supabase_treatment_items === 490 &&
      result.counts_before.supabase_medical_records === 255 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_billings === 46 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BEFORE_DRAFT_BILLING_PARENT_INSERT_EXPECTED', !!(
      result.counts_before.supabase_scheduled_appointments === 5 &&
      result.counts_before.supabase_completed_appointments === 256 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 5,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 256,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const treatmentItemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecordsBefore,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const appointment = treatment
      ? TreatmentRepository.findAppointmentById(treatment.appointment_id, supabaseOptions)
      : null;

    const existingBillingById = findTreatmentPhase7EByField_(
      billingsBefore,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const existingBillingByNumber = findTreatmentPhase7EByField_(
      billingsBefore,
      'billing_number',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER
    );

    const existingBillingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingBillingItemsByBilling = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItemsBefore,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || ''),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      subtotal: Number(treatmentItem.subtotal || 0)
    } : null;

    result.selected.medical_record = medicalRecord ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecord.record_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecord.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecord.appointment_id)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    addCheck('COMPLETED_TREATMENT_BUNDLE_EXISTS_BEFORE_DRAFT_BILLING_PARENT_INSERT', !!(
      treatment &&
      treatmentItem &&
      Array.isArray(treatmentItemsForTreatment) &&
      treatmentItemsForTreatment.length === 1 &&
      medicalRecord &&
      Array.isArray(medicalRecordsForTreatment) &&
      medicalRecordsForTreatment.length === 1 &&
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'completed'
    ), {
      treatment: result.selected.treatment,
      treatment_item: result.selected.treatment_item,
      treatment_item_count_for_treatment: Array.isArray(treatmentItemsForTreatment) ? treatmentItemsForTreatment.length : -1,
      medical_record: result.selected.medical_record,
      medical_record_count_for_treatment: Array.isArray(medicalRecordsForTreatment) ? medicalRecordsForTreatment.length : -1,
      appointment: result.selected.appointment
    });

    addCheck('DRAFT_BILLING_NOT_EXISTING_BEFORE_PARENT_INSERT', !!(
      !existingBillingById &&
      !existingBillingByNumber &&
      !existingBillingByTreatment &&
      Array.isArray(existingBillingItemsByBilling) &&
      existingBillingItemsByBilling.length === 0
    ), {
      billing_by_id_exists: !!existingBillingById,
      billing_by_number_exists: !!existingBillingByNumber,
      billing_by_treatment_exists: !!existingBillingByTreatment,
      billing_item_count_for_billing: Array.isArray(existingBillingItemsByBilling) ? existingBillingItemsByBilling.length : -1
    });

    if (
      !treatment ||
      !treatmentItem ||
      !Array.isArray(treatmentItemsForTreatment) ||
      treatmentItemsForTreatment.length !== 1 ||
      !medicalRecord ||
      !Array.isArray(medicalRecordsForTreatment) ||
      medicalRecordsForTreatment.length !== 1 ||
      !appointment ||
      normalizeTreatmentPhase7EStatus_(appointment.status) !== 'completed' ||
      existingBillingById ||
      existingBillingByNumber ||
      existingBillingByTreatment ||
      !Array.isArray(existingBillingItemsByBilling) ||
      existingBillingItemsByBilling.length !== 0
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const billingPayload = buildTreatmentPhase7EDraftBillingPayload_(
      treatment,
      treatmentItemsForTreatment
    );

    addCheck('DRAFT_BILLING_PARENT_PAYLOAD_VALID_BEFORE_INSERT', !!(
      billingPayload.billing_id === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      billingPayload.billing_number === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER &&
      billingPayload.treatment_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      billingPayload.appointment_id === 'APT-20260430-135818056-583' &&
      billingPayload.patient_id === 'PAT-20260430-135721617-083' &&
      billingPayload.patient_name === 'Roria Laura Elisabeth Tampubolon' &&
      billingPayload.billing_date === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      billingPayload.due_date === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      Number(billingPayload.subtotal || 0) === 700000 &&
      Number(billingPayload.discount_total || 0) === 0 &&
      Number(billingPayload.grand_total || 0) === 700000 &&
      Number(billingPayload.paid_total || 0) === 0 &&
      Number(billingPayload.outstanding_total || 0) === 700000 &&
      billingPayload.payment_status === 'unpaid' &&
      billingPayload.billing_status === 'draft' &&
      billingPayload.payment_type === 'full' &&
      billingPayload.payment_terms === 'full'
    ), {
      payload: billingPayload
    });

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLINGS,
      billingPayload,
      {
        stage: '7E'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('DRAFT_BILLING_PARENT_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const billingByIdAfter = findTreatmentPhase7EByField_(
      billingsAfter,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingByNumberAfter = findTreatmentPhase7EByField_(
      billingsAfter,
      'billing_number',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER
    );

    const billingByTreatmentAfter = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const billingItemsForBillingAfter = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItemsAfter,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    result.selected.billing = billingByIdAfter ? {
      billing_id: normalizeTreatmentPhase7EText_(billingByIdAfter.billing_id),
      billing_number: normalizeTreatmentPhase7EText_(billingByIdAfter.billing_number),
      treatment_id: normalizeTreatmentPhase7EText_(billingByIdAfter.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(billingByIdAfter.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(billingByIdAfter.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(billingByIdAfter.patient_name),
      billing_date: normalizeTreatmentPhase7EYmd_(billingByIdAfter.billing_date),
      due_date: normalizeTreatmentPhase7EYmd_(billingByIdAfter.due_date),
      subtotal: Number(billingByIdAfter.subtotal || 0),
      discount_total: Number(billingByIdAfter.discount_total || 0),
      grand_total: Number(billingByIdAfter.grand_total || 0),
      paid_total: Number(billingByIdAfter.paid_total || 0),
      outstanding_total: Number(billingByIdAfter.outstanding_total || 0),
      payment_status: normalizeTreatmentPhase7EStatus_(billingByIdAfter.payment_status),
      billing_status: normalizeTreatmentPhase7EStatus_(billingByIdAfter.billing_status),
      payment_type: normalizeTreatmentPhase7EStatus_(billingByIdAfter.payment_type),
      payment_terms: normalizeTreatmentPhase7EStatus_(billingByIdAfter.payment_terms)
    } : null;

    result.readback.billing_item_count_for_billing = Array.isArray(billingItemsForBillingAfter)
      ? billingItemsForBillingAfter.length
      : -1;

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_DRAFT_BILLING_PARENT_INSERT', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_BILLING_COUNT_INCREASED_TO_47_AFTER_PARENT_INSERT', result.counts_after.supabase_billings === 47, {
      before_count: result.counts_before.supabase_billings,
      after_count: result.counts_after.supabase_billings,
      expected_after_count: 47
    });

    addCheck('OTHER_RELATED_COUNTS_UNCHANGED_AFTER_DRAFT_BILLING_PARENT_INSERT_ONLY', !!(
      result.counts_after.supabase_treatments === result.counts_before.supabase_treatments &&
      result.counts_after.supabase_treatment_items === result.counts_before.supabase_treatment_items &&
      result.counts_after.supabase_medical_records === result.counts_before.supabase_medical_records &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billing_items === result.counts_before.supabase_billing_items &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_UNCHANGED_AFTER_DRAFT_BILLING_PARENT_INSERT_ONLY', !!(
      result.counts_after.supabase_scheduled_appointments === result.counts_before.supabase_scheduled_appointments &&
      result.counts_after.supabase_completed_appointments === result.counts_before.supabase_completed_appointments &&
      result.counts_after.supabase_cancelled_appointments === result.counts_before.supabase_cancelled_appointments
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      }
    });

    addCheck('DRAFT_BILLING_FOUND_BY_ID_NUMBER_AND_TREATMENT_AFTER_PARENT_INSERT', !!(
      billingByIdAfter &&
      billingByNumberAfter &&
      billingByTreatmentAfter &&
      normalizeTreatmentPhase7EText_(billingByTreatmentAfter.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    ), {
      by_id_exists: !!billingByIdAfter,
      by_number_exists: !!billingByNumberAfter,
      by_treatment_exists: !!billingByTreatmentAfter,
      billing_id_by_treatment: billingByTreatmentAfter ? billingByTreatmentAfter.billing_id : ''
    });

    addCheck('DRAFT_BILLING_PARENT_FIELDS_MATCH_AFTER_INSERT', !!(
      billingByIdAfter &&
      normalizeTreatmentPhase7EText_(billingByIdAfter.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      normalizeTreatmentPhase7EText_(billingByIdAfter.billing_number) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER &&
      normalizeTreatmentPhase7EText_(billingByIdAfter.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(billingByIdAfter.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(billingByIdAfter.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(billingByIdAfter.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EYmd_(billingByIdAfter.billing_date) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EYmd_(billingByIdAfter.due_date) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      Number(billingByIdAfter.subtotal || 0) === 700000 &&
      Number(billingByIdAfter.discount_total || 0) === 0 &&
      Number(billingByIdAfter.grand_total || 0) === 700000 &&
      Number(billingByIdAfter.paid_total || 0) === 0 &&
      Number(billingByIdAfter.outstanding_total || 0) === 700000 &&
      normalizeTreatmentPhase7EStatus_(billingByIdAfter.payment_status) === 'unpaid' &&
      normalizeTreatmentPhase7EStatus_(billingByIdAfter.billing_status) === 'draft' &&
      normalizeTreatmentPhase7EStatus_(billingByIdAfter.payment_type) === 'full' &&
      normalizeTreatmentPhase7EStatus_(billingByIdAfter.payment_terms) === 'full'
    ), {
      billing: result.selected.billing
    });

    addCheck('NO_BILLING_ITEMS_YET_AFTER_PARENT_INSERT_ONLY', Array.isArray(billingItemsForBillingAfter) && billingItemsForBillingAfter.length === 0, {
      billing_id: TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID,
      billing_item_count: result.readback.billing_item_count_for_billing
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-12',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EInsertDraftBillingItemLog() {
  const result = {
    success: true,
    stage: '7E-13',
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
    counts_before: {},
    counts_after: {},
    selected: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment: null,
      billing: null,
      billing_item: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_COUNTS_BEFORE_DRAFT_BILLING_ITEM_INSERT_EXPECTED', !!(
      result.counts_before.supabase_treatments === 255 &&
      result.counts_before.supabase_treatment_items === 490 &&
      result.counts_before.supabase_medical_records === 255 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_billings === 47 &&
      result.counts_before.supabase_billing_items === 99 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BEFORE_DRAFT_BILLING_ITEM_INSERT_EXPECTED', !!(
      result.counts_before.supabase_scheduled_appointments === 5 &&
      result.counts_before.supabase_completed_appointments === 256 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 5,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 256,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const appointment = treatment
      ? TreatmentRepository.findAppointmentById(treatment.appointment_id, supabaseOptions)
      : null;

    const billing = findTreatmentPhase7EByField_(
      billingsBefore,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const existingBillingItemById = findTreatmentPhase7EByField_(
      billingItemsBefore,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    const billingItemsForBillingBefore = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItemsBefore,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      qty: Number(treatmentItem.qty || 0),
      unit_price: Number(treatmentItem.unit_price || 0),
      subtotal: Number(treatmentItem.subtotal || 0)
    } : null;

    result.selected.medical_record = medicalRecord ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecord.record_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecord.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecord.appointment_id)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.selected.billing = billing ? {
      billing_id: normalizeTreatmentPhase7EText_(billing.billing_id),
      billing_number: normalizeTreatmentPhase7EText_(billing.billing_number),
      treatment_id: normalizeTreatmentPhase7EText_(billing.treatment_id),
      subtotal: Number(billing.subtotal || 0),
      grand_total: Number(billing.grand_total || 0),
      outstanding_total: Number(billing.outstanding_total || 0),
      payment_status: normalizeTreatmentPhase7EStatus_(billing.payment_status),
      billing_status: normalizeTreatmentPhase7EStatus_(billing.billing_status)
    } : null;

    addCheck('COMPLETED_TREATMENT_BUNDLE_EXISTS_BEFORE_BILLING_ITEM_INSERT', !!(
      treatment &&
      treatmentItem &&
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1 &&
      medicalRecord &&
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'completed'
    ), {
      treatment: result.selected.treatment,
      treatment_item: result.selected.treatment_item,
      item_count_for_treatment: Array.isArray(itemsForTreatment) ? itemsForTreatment.length : -1,
      medical_record: result.selected.medical_record,
      appointment: result.selected.appointment
    });

    addCheck('DRAFT_BILLING_PARENT_EXISTS_BEFORE_BILLING_ITEM_INSERT', !!(
      billing &&
      billingByTreatment &&
      normalizeTreatmentPhase7EText_(billingByTreatment.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      Number(billing.subtotal || 0) === 700000 &&
      Number(billing.grand_total || 0) === 700000 &&
      Number(billing.outstanding_total || 0) === 700000 &&
      normalizeTreatmentPhase7EStatus_(billing.payment_status) === 'unpaid' &&
      normalizeTreatmentPhase7EStatus_(billing.billing_status) === 'draft'
    ), {
      billing: result.selected.billing,
      billing_id_by_treatment: billingByTreatment ? billingByTreatment.billing_id : ''
    });

    addCheck('DRAFT_BILLING_ITEM_NOT_EXISTING_BEFORE_INSERT', !!(
      !existingBillingItemById &&
      Array.isArray(billingItemsForBillingBefore) &&
      billingItemsForBillingBefore.length === 0
    ), {
      billing_item_by_id_exists: !!existingBillingItemById,
      billing_item_count_for_billing: Array.isArray(billingItemsForBillingBefore) ? billingItemsForBillingBefore.length : -1
    });

    if (
      !treatment ||
      !treatmentItem ||
      !Array.isArray(itemsForTreatment) ||
      itemsForTreatment.length !== 1 ||
      !medicalRecord ||
      !appointment ||
      normalizeTreatmentPhase7EStatus_(appointment.status) !== 'completed' ||
      !billing ||
      !billingByTreatment ||
      existingBillingItemById ||
      !Array.isArray(billingItemsForBillingBefore) ||
      billingItemsForBillingBefore.length !== 0
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const billingItemPayload = buildTreatmentPhase7EBillingItemPayload_(
      billing,
      treatmentItem
    );

    addCheck('DRAFT_BILLING_ITEM_PAYLOAD_VALID_BEFORE_INSERT', !!(
      billingItemPayload.billing_item_id === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID &&
      billingItemPayload.billing_id === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      billingItemPayload.treatment_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      billingItemPayload.treatment_item_id === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      billingItemPayload.service_id === 'SRV-015' &&
      billingItemPayload.service_name === 'Bleaching Rarb' &&
      Number(billingItemPayload.qty || 0) === 1 &&
      Number(billingItemPayload.unit_price || 0) === 700000 &&
      Number(billingItemPayload.subtotal || 0) === 700000
    ), {
      payload: billingItemPayload
    });

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLING_ITEMS,
      billingItemPayload,
      {
        stage: '7E'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('DRAFT_BILLING_ITEM_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const billingItemAfter = findTreatmentPhase7EByField_(
      billingItemsAfter,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    const billingItemsForBillingAfter = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItemsAfter,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingAfter = findTreatmentPhase7EByField_(
      billingsAfter,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    result.selected.billing_item = billingItemAfter ? {
      billing_item_id: normalizeTreatmentPhase7EText_(billingItemAfter.billing_item_id),
      billing_id: normalizeTreatmentPhase7EText_(billingItemAfter.billing_id),
      treatment_id: normalizeTreatmentPhase7EText_(billingItemAfter.treatment_id),
      treatment_item_id: normalizeTreatmentPhase7EText_(billingItemAfter.treatment_item_id),
      service_id: normalizeTreatmentPhase7EText_(billingItemAfter.service_id),
      service_name: normalizeTreatmentPhase7EText_(billingItemAfter.service_name),
      qty: Number(billingItemAfter.qty || 0),
      unit_price: Number(billingItemAfter.unit_price || 0),
      subtotal: Number(billingItemAfter.subtotal || 0)
    } : null;

    result.readback.billing_item_count_for_billing = Array.isArray(billingItemsForBillingAfter)
      ? billingItemsForBillingAfter.length
      : -1;

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_DRAFT_BILLING_ITEM_INSERT', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_BILLING_ITEM_COUNT_INCREASED_TO_100_AFTER_INSERT', result.counts_after.supabase_billing_items === 100, {
      before_count: result.counts_before.supabase_billing_items,
      after_count: result.counts_after.supabase_billing_items,
      expected_after_count: 100
    });

    addCheck('OTHER_RELATED_COUNTS_UNCHANGED_AFTER_DRAFT_BILLING_ITEM_INSERT_ONLY', !!(
      result.counts_after.supabase_treatments === result.counts_before.supabase_treatments &&
      result.counts_after.supabase_treatment_items === result.counts_before.supabase_treatment_items &&
      result.counts_after.supabase_medical_records === result.counts_before.supabase_medical_records &&
      result.counts_after.supabase_appointments === result.counts_before.supabase_appointments &&
      result.counts_after.supabase_billings === result.counts_before.supabase_billings &&
      result.counts_after.supabase_ortho_recalls === result.counts_before.supabase_ortho_recalls
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_UNCHANGED_AFTER_DRAFT_BILLING_ITEM_INSERT_ONLY', !!(
      result.counts_after.supabase_scheduled_appointments === result.counts_before.supabase_scheduled_appointments &&
      result.counts_after.supabase_completed_appointments === result.counts_before.supabase_completed_appointments &&
      result.counts_after.supabase_cancelled_appointments === result.counts_before.supabase_cancelled_appointments
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      }
    });

    addCheck('DRAFT_BILLING_ITEM_FOUND_BY_ID_AFTER_INSERT', !!billingItemAfter, {
      billing_item_id: TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    });

    addCheck('DRAFT_BILLING_ITEM_LIST_BY_BILLING_HAS_ONE_ITEM', !!(
      Array.isArray(billingItemsForBillingAfter) &&
      billingItemsForBillingAfter.length === 1 &&
      billingItemsForBillingAfter.some(function(row) {
        return normalizeTreatmentPhase7EText_(row.billing_item_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID;
      })
    ), {
      billing_id: TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID,
      billing_item_count_for_billing: result.readback.billing_item_count_for_billing
    });

    addCheck('DRAFT_BILLING_ITEM_FIELDS_MATCH_AFTER_INSERT', !!(
      billingItemAfter &&
      normalizeTreatmentPhase7EText_(billingItemAfter.billing_item_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID &&
      normalizeTreatmentPhase7EText_(billingItemAfter.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      normalizeTreatmentPhase7EText_(billingItemAfter.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(billingItemAfter.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      normalizeTreatmentPhase7EText_(billingItemAfter.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(billingItemAfter.service_name) === 'Bleaching Rarb' &&
      Number(billingItemAfter.qty || 0) === 1 &&
      Number(billingItemAfter.unit_price || 0) === 700000 &&
      Number(billingItemAfter.subtotal || 0) === 700000
    ), {
      billing_item: result.selected.billing_item
    });

    addCheck('DRAFT_BILLING_PARENT_TOTAL_MATCHES_BILLING_ITEM_SUBTOTAL', !!(
      billingAfter &&
      billingItemAfter &&
      Number(billingAfter.subtotal || 0) === Number(billingItemAfter.subtotal || 0) &&
      Number(billingAfter.grand_total || 0) === Number(billingItemAfter.subtotal || 0) &&
      Number(billingAfter.outstanding_total || 0) === Number(billingItemAfter.subtotal || 0) &&
      Number(billingAfter.subtotal || 0) === 700000
    ), {
      billing_subtotal: billingAfter ? Number(billingAfter.subtotal || 0) : null,
      billing_grand_total: billingAfter ? Number(billingAfter.grand_total || 0) : null,
      billing_outstanding_total: billingAfter ? Number(billingAfter.outstanding_total || 0) : null,
      billing_item_subtotal: billingItemAfter ? Number(billingItemAfter.subtotal || 0) : null
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-13',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EReadBackFinalTreatmentBillingBundleLog() {
  const result = {
    success: true,
    stage: '7E-14',
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
    selected: {
      treatment: null,
      treatment_item: null,
      medical_record: null,
      appointment: null,
      patient: null,
      service: null,
      billing: null,
      billing_item: null
    },
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

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7E', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const services = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(services) ? services.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;
    result.counts.supabase_scheduled_appointments = scheduledRows.length;
    result.counts.supabase_completed_appointments = completedRows.length;
    result.counts.supabase_cancelled_appointments = cancelledRows.length;

    addCheck('SPREADSHEET_TREATMENT_COUNT_STILL_282_FINAL_BUNDLE_VERIFY', result.counts.spreadsheet_treatments === 282, {
      actual: result.counts.spreadsheet_treatments,
      expected: 282
    });

    addCheck('SUPABASE_COUNTS_FINAL_TREATMENT_BILLING_BUNDLE_EXPECTED', !!(
      result.counts.supabase_treatments === 255 &&
      result.counts.supabase_treatment_items === 490 &&
      result.counts.supabase_medical_records === 255 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_patients === 285 &&
      result.counts.supabase_service_catalog === 100 &&
      result.counts.supabase_billings === 47 &&
      result.counts.supabase_billing_items === 100 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_FINAL_TREATMENT_BILLING_BUNDLE_EXPECTED', !!(
      result.counts.supabase_scheduled_appointments === 5 &&
      result.counts.supabase_completed_appointments === 256 &&
      result.counts.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts.supabase_scheduled_appointments,
      expected_scheduled: 5,
      completed: result.counts.supabase_completed_appointments,
      expected_completed: 256,
      cancelled: result.counts.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    addCheck('APPOINTMENT_STATUS_TOTAL_MATCH_FINAL_TREATMENT_BILLING_BUNDLE', (
      result.counts.supabase_appointments ===
      result.counts.supabase_scheduled_appointments +
      result.counts.supabase_completed_appointments +
      result.counts.supabase_cancelled_appointments
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.counts.supabase_scheduled_appointments,
      completed: result.counts.supabase_completed_appointments,
      cancelled: result.counts.supabase_cancelled_appointments
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentByAppointment = TreatmentRepository.findTreatmentByAppointmentId(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const itemsForTreatment = TreatmentRepository.listTreatmentItemsByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecords,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const appointment = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const patient = TreatmentRepository.findPatientById(
      'PAT-20260430-135721617-083',
      supabaseOptions
    );

    const service = findTreatmentPhase7EByField_(
      services,
      'service_id',
      'SRV-015'
    );

    const billing = findTreatmentPhase7EByField_(
      billings,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingByNumber = findTreatmentPhase7EByField_(
      billings,
      'billing_number',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER
    );

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const billingItem = findTreatmentPhase7EByField_(
      billingItems,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    const billingItemsForBilling = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItems,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const relatedOrthoRecall = Array.isArray(orthoRecalls)
      ? orthoRecalls.filter(function(row) {
          return normalizeTreatmentPhase7EText_(row.install_treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID ||
            normalizeTreatmentPhase7EText_(row.last_control_treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID;
        })
      : [];

    result.selected.treatment = treatment ? {
      treatment_id: normalizeTreatmentPhase7EText_(treatment.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(treatment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(treatment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(treatment.patient_name),
      doctor_name: normalizeTreatmentPhase7EText_(treatment.doctor_name),
      treatment_date: normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(treatment.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(treatment.diagnosis),
      total_cost: Number(treatment.total_cost || 0)
    } : null;

    result.selected.treatment_item = treatmentItem ? {
      treatment_item_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id),
      treatment_id: normalizeTreatmentPhase7EText_(treatmentItem.treatment_id),
      service_id: normalizeTreatmentPhase7EText_(treatmentItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(treatmentItem.service_name),
      qty: Number(treatmentItem.qty || 0),
      unit_price: Number(treatmentItem.unit_price || 0),
      subtotal: Number(treatmentItem.subtotal || 0),
      is_ortho_install: boolTreatmentPhase7E_(treatmentItem.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(treatmentItem.is_ortho_control)
    } : null;

    result.selected.medical_record = medicalRecord ? {
      record_id: normalizeTreatmentPhase7EText_(medicalRecord.record_id),
      patient_id: normalizeTreatmentPhase7EText_(medicalRecord.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(medicalRecord.patient_name),
      appointment_id: normalizeTreatmentPhase7EText_(medicalRecord.appointment_id),
      treatment_id: normalizeTreatmentPhase7EText_(medicalRecord.treatment_id),
      doctor_name: normalizeTreatmentPhase7EText_(medicalRecord.doctor_name),
      visit_date: normalizeTreatmentPhase7EYmd_(medicalRecord.visit_date || medicalRecord.record_date || ''),
      chief_complaint: normalizeTreatmentPhase7EText_(medicalRecord.chief_complaint),
      diagnosis: normalizeTreatmentPhase7EText_(medicalRecord.diagnosis),
      clinical_notes: normalizeTreatmentPhase7EText_(medicalRecord.clinical_notes)
    } : null;

    result.selected.appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(appointment.appointment_date || appointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(appointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    result.selected.patient = patient ? {
      patient_id: normalizeTreatmentPhase7EText_(patient.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(patient.full_name),
      patient_code: normalizeTreatmentPhase7EText_(patient.patient_code),
      phone: normalizeTreatmentPhase7EText_(patient.phone)
    } : null;

    result.selected.service = service ? {
      service_id: normalizeTreatmentPhase7EText_(service.service_id),
      service_name: normalizeTreatmentPhase7EText_(service.service_name),
      default_price: Number(service.default_price || 0),
      is_ortho_install: boolTreatmentPhase7E_(service.is_ortho_install),
      is_ortho_control: boolTreatmentPhase7E_(service.is_ortho_control)
    } : null;

    result.selected.billing = billing ? {
      billing_id: normalizeTreatmentPhase7EText_(billing.billing_id),
      billing_number: normalizeTreatmentPhase7EText_(billing.billing_number),
      treatment_id: normalizeTreatmentPhase7EText_(billing.treatment_id),
      appointment_id: normalizeTreatmentPhase7EText_(billing.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(billing.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(billing.patient_name),
      billing_date: normalizeTreatmentPhase7EYmd_(billing.billing_date),
      due_date: normalizeTreatmentPhase7EYmd_(billing.due_date),
      subtotal: Number(billing.subtotal || 0),
      discount_total: Number(billing.discount_total || 0),
      grand_total: Number(billing.grand_total || 0),
      paid_total: Number(billing.paid_total || 0),
      outstanding_total: Number(billing.outstanding_total || 0),
      payment_status: normalizeTreatmentPhase7EStatus_(billing.payment_status),
      billing_status: normalizeTreatmentPhase7EStatus_(billing.billing_status),
      payment_type: normalizeTreatmentPhase7EStatus_(billing.payment_type),
      payment_terms: normalizeTreatmentPhase7EStatus_(billing.payment_terms)
    } : null;

    result.selected.billing_item = billingItem ? {
      billing_item_id: normalizeTreatmentPhase7EText_(billingItem.billing_item_id),
      billing_id: normalizeTreatmentPhase7EText_(billingItem.billing_id),
      treatment_id: normalizeTreatmentPhase7EText_(billingItem.treatment_id),
      treatment_item_id: normalizeTreatmentPhase7EText_(billingItem.treatment_item_id),
      service_id: normalizeTreatmentPhase7EText_(billingItem.service_id),
      service_name: normalizeTreatmentPhase7EText_(billingItem.service_name),
      qty: Number(billingItem.qty || 0),
      unit_price: Number(billingItem.unit_price || 0),
      subtotal: Number(billingItem.subtotal || 0)
    } : null;

    result.readback.treatment_id_by_appointment = treatmentByAppointment
      ? normalizeTreatmentPhase7EText_(treatmentByAppointment.treatment_id)
      : '';

    result.readback.treatment_item_count_for_treatment = Array.isArray(itemsForTreatment)
      ? itemsForTreatment.length
      : -1;

    result.readback.medical_record_count_for_treatment = Array.isArray(medicalRecordsForTreatment)
      ? medicalRecordsForTreatment.length
      : -1;

    result.readback.billing_id_by_number = billingByNumber
      ? normalizeTreatmentPhase7EText_(billingByNumber.billing_id)
      : '';

    result.readback.billing_id_by_treatment = billingByTreatment
      ? normalizeTreatmentPhase7EText_(billingByTreatment.billing_id)
      : '';

    result.readback.billing_item_count_for_billing = Array.isArray(billingItemsForBilling)
      ? billingItemsForBilling.length
      : -1;

    result.readback.related_ortho_recall_count = Array.isArray(relatedOrthoRecall)
      ? relatedOrthoRecall.length
      : -1;

    addCheck('FINAL_BUNDLE_MAIN_TREATMENT_FOUND_AND_MATCHES', !!(
      treatment &&
      normalizeTreatmentPhase7EText_(treatment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatment.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(treatment.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(treatment.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EText_(treatment.doctor_name) === 'drg.Novira Zahara Banurea' &&
      normalizeTreatmentPhase7EYmd_(treatment.treatment_date || treatment.date || '') === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EText_(treatment.chief_complaint) === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      normalizeTreatmentPhase7EText_(treatment.diagnosis) === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      Number(treatment.total_cost || 0) === 700000
    ), {
      treatment: result.selected.treatment
    });

    addCheck('FINAL_BUNDLE_TREATMENT_FOUND_BY_APPOINTMENT', !!(
      treatmentByAppointment &&
      normalizeTreatmentPhase7EText_(treatmentByAppointment.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    ), {
      appointment_id: 'APT-20260430-135818056-583',
      treatment_id: result.readback.treatment_id_by_appointment
    });

    addCheck('FINAL_BUNDLE_TREATMENT_ITEM_FOUND_AND_MATCHES', !!(
      treatmentItem &&
      Array.isArray(itemsForTreatment) &&
      itemsForTreatment.length === 1 &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(treatmentItem.service_name) === 'Bleaching Rarb' &&
      Number(treatmentItem.qty || 0) === 1 &&
      Number(treatmentItem.unit_price || 0) === 700000 &&
      Number(treatmentItem.subtotal || 0) === 700000 &&
      boolTreatmentPhase7E_(treatmentItem.is_ortho_install) === false &&
      boolTreatmentPhase7E_(treatmentItem.is_ortho_control) === false
    ), {
      treatment_item: result.selected.treatment_item,
      treatment_item_count_for_treatment: result.readback.treatment_item_count_for_treatment
    });

    addCheck('FINAL_BUNDLE_MEDICAL_RECORD_FOUND_AND_MATCHES', !!(
      medicalRecord &&
      Array.isArray(medicalRecordsForTreatment) &&
      medicalRecordsForTreatment.length === 1 &&
      normalizeTreatmentPhase7EText_(medicalRecord.record_id) === TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID &&
      normalizeTreatmentPhase7EText_(medicalRecord.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(medicalRecord.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EText_(medicalRecord.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(medicalRecord.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(medicalRecord.doctor_name) === 'drg.Novira Zahara Banurea' &&
      normalizeTreatmentPhase7EYmd_(medicalRecord.visit_date || medicalRecord.record_date || '') === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EText_(medicalRecord.chief_complaint) === TREATMENT_PHASE_7E_TEST_IDS.CHIEF_COMPLAINT &&
      normalizeTreatmentPhase7EText_(medicalRecord.diagnosis) === TREATMENT_PHASE_7E_TEST_IDS.DIAGNOSIS &&
      normalizeTreatmentPhase7EText_(medicalRecord.clinical_notes) === TREATMENT_PHASE_7E_TEST_IDS.NOTES
    ), {
      medical_record: result.selected.medical_record,
      medical_record_count_for_treatment: result.readback.medical_record_count_for_treatment
    });

    addCheck('FINAL_BUNDLE_APPOINTMENT_COMPLETED_AND_MATCHES', !!(
      appointment &&
      normalizeTreatmentPhase7EText_(appointment.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(appointment.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'completed'
    ), {
      appointment: result.selected.appointment
    });

    addCheck('FINAL_BUNDLE_PATIENT_FOUND_AND_MATCHES', !!(
      patient &&
      normalizeTreatmentPhase7EText_(patient.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(patient.full_name) === 'Roria Laura Elisabeth Tampubolon'
    ), {
      patient: result.selected.patient
    });

    addCheck('FINAL_BUNDLE_SERVICE_FOUND_AND_NON_ORTHO', !!(
      service &&
      normalizeTreatmentPhase7EText_(service.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(service.service_name) === 'Bleaching Rarb' &&
      Number(service.default_price || 0) === 700000 &&
      !boolTreatmentPhase7E_(service.is_ortho_install) &&
      !boolTreatmentPhase7E_(service.is_ortho_control)
    ), {
      service: result.selected.service
    });

    addCheck('FINAL_BUNDLE_DRAFT_BILLING_PARENT_FOUND_AND_MATCHES', !!(
      billing &&
      billingByNumber &&
      billingByTreatment &&
      normalizeTreatmentPhase7EText_(billing.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      normalizeTreatmentPhase7EText_(billingByNumber.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      normalizeTreatmentPhase7EText_(billingByTreatment.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      normalizeTreatmentPhase7EText_(billing.billing_number) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER &&
      normalizeTreatmentPhase7EText_(billing.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(billing.appointment_id) === 'APT-20260430-135818056-583' &&
      normalizeTreatmentPhase7EText_(billing.patient_id) === 'PAT-20260430-135721617-083' &&
      normalizeTreatmentPhase7EText_(billing.patient_name) === 'Roria Laura Elisabeth Tampubolon' &&
      normalizeTreatmentPhase7EYmd_(billing.billing_date) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      normalizeTreatmentPhase7EYmd_(billing.due_date) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_DATE &&
      Number(billing.subtotal || 0) === 700000 &&
      Number(billing.discount_total || 0) === 0 &&
      Number(billing.grand_total || 0) === 700000 &&
      Number(billing.paid_total || 0) === 0 &&
      Number(billing.outstanding_total || 0) === 700000 &&
      normalizeTreatmentPhase7EStatus_(billing.payment_status) === 'unpaid' &&
      normalizeTreatmentPhase7EStatus_(billing.billing_status) === 'draft' &&
      normalizeTreatmentPhase7EStatus_(billing.payment_type) === 'full' &&
      normalizeTreatmentPhase7EStatus_(billing.payment_terms) === 'full'
    ), {
      billing: result.selected.billing,
      billing_id_by_number: result.readback.billing_id_by_number,
      billing_id_by_treatment: result.readback.billing_id_by_treatment
    });

    addCheck('FINAL_BUNDLE_DRAFT_BILLING_ITEM_FOUND_AND_MATCHES', !!(
      billingItem &&
      Array.isArray(billingItemsForBilling) &&
      billingItemsForBilling.length === 1 &&
      normalizeTreatmentPhase7EText_(billingItem.billing_item_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID &&
      normalizeTreatmentPhase7EText_(billingItem.billing_id) === TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID &&
      normalizeTreatmentPhase7EText_(billingItem.treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID &&
      normalizeTreatmentPhase7EText_(billingItem.treatment_item_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID &&
      normalizeTreatmentPhase7EText_(billingItem.service_id) === 'SRV-015' &&
      normalizeTreatmentPhase7EText_(billingItem.service_name) === 'Bleaching Rarb' &&
      Number(billingItem.qty || 0) === 1 &&
      Number(billingItem.unit_price || 0) === 700000 &&
      Number(billingItem.subtotal || 0) === 700000
    ), {
      billing_item: result.selected.billing_item,
      billing_item_count_for_billing: result.readback.billing_item_count_for_billing
    });

    addCheck('FINAL_BUNDLE_ALL_TOTALS_MATCH', !!(
      treatment &&
      treatmentItem &&
      billing &&
      billingItem &&
      Number(treatment.total_cost || 0) === 700000 &&
      Number(treatmentItem.subtotal || 0) === 700000 &&
      Number(billing.subtotal || 0) === 700000 &&
      Number(billing.grand_total || 0) === 700000 &&
      Number(billing.outstanding_total || 0) === 700000 &&
      Number(billing.paid_total || 0) === 0 &&
      Number(billing.discount_total || 0) === 0 &&
      Number(billingItem.subtotal || 0) === 700000 &&
      Number(treatment.total_cost || 0) === Number(treatmentItem.subtotal || 0) &&
      Number(treatment.total_cost || 0) === Number(billing.subtotal || 0) &&
      Number(billing.subtotal || 0) === Number(billingItem.subtotal || 0)
    ), {
      treatment_total_cost: treatment ? Number(treatment.total_cost || 0) : null,
      treatment_item_subtotal: treatmentItem ? Number(treatmentItem.subtotal || 0) : null,
      billing_subtotal: billing ? Number(billing.subtotal || 0) : null,
      billing_discount_total: billing ? Number(billing.discount_total || 0) : null,
      billing_grand_total: billing ? Number(billing.grand_total || 0) : null,
      billing_paid_total: billing ? Number(billing.paid_total || 0) : null,
      billing_outstanding_total: billing ? Number(billing.outstanding_total || 0) : null,
      billing_item_subtotal: billingItem ? Number(billingItem.subtotal || 0) : null
    });

    addCheck('FINAL_BUNDLE_NO_ORTHO_RECALL_SYNC_EXPECTED_FOR_NON_ORTHO_SERVICE', !!(
      Array.isArray(relatedOrthoRecall) &&
      relatedOrthoRecall.length === 0
    ), {
      related_ortho_recall_count: result.readback.related_ortho_recall_count
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-14',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7ECleanupBundleLog() {
  const result = {
    success: true,
    stage: '7E-15',
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
    counts_before: {},
    counts_after: {},
    cleanup_results: {},
    selected_before: {},
    selected_after: {},
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

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED_FOR_CLEANUP', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    addCheck('SUPABASE_COUNTS_BEFORE_7E_CLEANUP_EXPECTED', !!(
      result.counts_before.supabase_treatments === 255 &&
      result.counts_before.supabase_treatment_items === 490 &&
      result.counts_before.supabase_medical_records === 255 &&
      result.counts_before.supabase_appointments === 284 &&
      result.counts_before.supabase_billings === 47 &&
      result.counts_before.supabase_billing_items === 100 &&
      result.counts_before.supabase_ortho_recalls === 124
    ), {
      counts_before: result.counts_before
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BEFORE_7E_CLEANUP_EXPECTED', !!(
      result.counts_before.supabase_scheduled_appointments === 5 &&
      result.counts_before.supabase_completed_appointments === 256 &&
      result.counts_before.supabase_cancelled_appointments === 23
    ), {
      scheduled: result.counts_before.supabase_scheduled_appointments,
      expected_scheduled: 5,
      completed: result.counts_before.supabase_completed_appointments,
      expected_completed: 256,
      cancelled: result.counts_before.supabase_cancelled_appointments,
      expected_cancelled: 23
    });

    const treatmentBefore = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItemBefore = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const medicalRecordBefore = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const appointmentBefore = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const billingBefore = findTreatmentPhase7EByField_(
      billingsBefore,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingItemBefore = findTreatmentPhase7EByField_(
      billingItemsBefore,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    const billingItemsForBillingBefore = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItemsBefore,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    result.selected_before = {
      treatment_exists: !!treatmentBefore,
      treatment_item_exists: !!treatmentItemBefore,
      medical_record_exists: !!medicalRecordBefore,
      billing_exists: !!billingBefore,
      billing_item_exists: !!billingItemBefore,
      billing_item_count_for_billing: Array.isArray(billingItemsForBillingBefore) ? billingItemsForBillingBefore.length : -1,
      appointment: appointmentBefore ? {
        appointment_id: normalizeTreatmentPhase7EText_(appointmentBefore.appointment_id),
        status: normalizeTreatmentPhase7EStatus_(appointmentBefore.status)
      } : null
    };

    addCheck('FULL_7E_TEST_BUNDLE_EXISTS_BEFORE_CLEANUP', !!(
      treatmentBefore &&
      treatmentItemBefore &&
      medicalRecordBefore &&
      appointmentBefore &&
      normalizeTreatmentPhase7EStatus_(appointmentBefore.status) === 'completed' &&
      billingBefore &&
      billingItemBefore &&
      Array.isArray(billingItemsForBillingBefore) &&
      billingItemsForBillingBefore.length === 1
    ), result.selected_before);

    if (
      !treatmentBefore ||
      !treatmentItemBefore ||
      !medicalRecordBefore ||
      !appointmentBefore ||
      normalizeTreatmentPhase7EStatus_(appointmentBefore.status) !== 'completed' ||
      !billingBefore ||
      !billingItemBefore ||
      !Array.isArray(billingItemsForBillingBefore) ||
      billingItemsForBillingBefore.length !== 1
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const deleteBillingItemResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLING_ITEMS,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID,
      {
        stage: '7E'
      }
    );

    result.cleanup_results.delete_billing_item = {
      success: !!(deleteBillingItemResponse && deleteBillingItemResponse.success),
      status_code: deleteBillingItemResponse ? deleteBillingItemResponse.status_code : null,
      row_count: deleteBillingItemResponse ? deleteBillingItemResponse.row_count : null,
      target_table: deleteBillingItemResponse ? deleteBillingItemResponse.target_table : ''
    };

    addCheck('DELETE_7E_BILLING_ITEM_SUCCESS', !!(deleteBillingItemResponse && deleteBillingItemResponse.success), result.cleanup_results.delete_billing_item);

    const deleteBillingResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID,
      {
        stage: '7E'
      }
    );

    result.cleanup_results.delete_billing = {
      success: !!(deleteBillingResponse && deleteBillingResponse.success),
      status_code: deleteBillingResponse ? deleteBillingResponse.status_code : null,
      row_count: deleteBillingResponse ? deleteBillingResponse.row_count : null,
      target_table: deleteBillingResponse ? deleteBillingResponse.target_table : ''
    };

    addCheck('DELETE_7E_BILLING_PARENT_SUCCESS', !!(deleteBillingResponse && deleteBillingResponse.success), result.cleanup_results.delete_billing);

    const deleteMedicalRecordResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.MEDICAL_RECORDS,
      'record_id',
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      {
        stage: '7E'
      }
    );

    result.cleanup_results.delete_medical_record = {
      success: !!(deleteMedicalRecordResponse && deleteMedicalRecordResponse.success),
      status_code: deleteMedicalRecordResponse ? deleteMedicalRecordResponse.status_code : null,
      row_count: deleteMedicalRecordResponse ? deleteMedicalRecordResponse.row_count : null,
      target_table: deleteMedicalRecordResponse ? deleteMedicalRecordResponse.target_table : ''
    };

    addCheck('DELETE_7E_MEDICAL_RECORD_SUCCESS', !!(deleteMedicalRecordResponse && deleteMedicalRecordResponse.success), result.cleanup_results.delete_medical_record);

    const deleteTreatmentItemResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.TREATMENT_ITEMS,
      'treatment_item_id',
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      {
        stage: '7E'
      }
    );

    result.cleanup_results.delete_treatment_item = {
      success: !!(deleteTreatmentItemResponse && deleteTreatmentItemResponse.success),
      status_code: deleteTreatmentItemResponse ? deleteTreatmentItemResponse.status_code : null,
      row_count: deleteTreatmentItemResponse ? deleteTreatmentItemResponse.row_count : null,
      target_table: deleteTreatmentItemResponse ? deleteTreatmentItemResponse.target_table : ''
    };

    addCheck('DELETE_7E_TREATMENT_ITEM_SUCCESS', !!(deleteTreatmentItemResponse && deleteTreatmentItemResponse.success), result.cleanup_results.delete_treatment_item);

    const deleteTreatmentResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.TREATMENTS,
      'treatment_id',
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      {
        stage: '7E'
      }
    );

    result.cleanup_results.delete_treatment = {
      success: !!(deleteTreatmentResponse && deleteTreatmentResponse.success),
      status_code: deleteTreatmentResponse ? deleteTreatmentResponse.status_code : null,
      row_count: deleteTreatmentResponse ? deleteTreatmentResponse.row_count : null,
      target_table: deleteTreatmentResponse ? deleteTreatmentResponse.target_table : ''
    };

    addCheck('DELETE_7E_TREATMENT_SUCCESS', !!(deleteTreatmentResponse && deleteTreatmentResponse.success), result.cleanup_results.delete_treatment);

    const appointmentPatch = {
      status: 'scheduled',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    const restoreAppointmentResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      'appointment_id',
      'APT-20260430-135818056-583',
      appointmentPatch,
      {
        stage: '7E'
      }
    );

    result.cleanup_results.restore_appointment_scheduled = {
      success: !!(restoreAppointmentResponse && restoreAppointmentResponse.success),
      status_code: restoreAppointmentResponse ? restoreAppointmentResponse.status_code : null,
      row_count: restoreAppointmentResponse ? restoreAppointmentResponse.row_count : null,
      target_table: restoreAppointmentResponse ? restoreAppointmentResponse.target_table : ''
    };

    addCheck('RESTORE_7E_APPOINTMENT_TO_SCHEDULED_SUCCESS', !!(restoreAppointmentResponse && restoreAppointmentResponse.success), result.cleanup_results.restore_appointment_scheduled);

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const treatmentAfter = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItemAfter = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const medicalRecordAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const appointmentAfter = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const billingAfter = findTreatmentPhase7EByField_(
      billingsAfter,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingItemAfter = findTreatmentPhase7EByField_(
      billingItemsAfter,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    const billingItemsForBillingAfter = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItemsAfter,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    result.selected_after = {
      treatment_exists: !!treatmentAfter,
      treatment_item_exists: !!treatmentItemAfter,
      medical_record_exists: !!medicalRecordAfter,
      billing_exists: !!billingAfter,
      billing_item_exists: !!billingItemAfter,
      billing_item_count_for_billing: Array.isArray(billingItemsForBillingAfter) ? billingItemsForBillingAfter.length : -1,
      appointment: appointmentAfter ? {
        appointment_id: normalizeTreatmentPhase7EText_(appointmentAfter.appointment_id),
        status: normalizeTreatmentPhase7EStatus_(appointmentAfter.status)
      } : null
    };

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_7E_CLEANUP', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_COUNTS_BACK_TO_7E_BASELINE_AFTER_CLEANUP', !!(
      result.counts_after.supabase_treatments === 254 &&
      result.counts_after.supabase_treatment_items === 489 &&
      result.counts_after.supabase_medical_records === 254 &&
      result.counts_after.supabase_appointments === 284 &&
      result.counts_after.supabase_billings === 46 &&
      result.counts_after.supabase_billing_items === 99 &&
      result.counts_after.supabase_ortho_recalls === 124
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BACK_TO_7E_BASELINE_AFTER_CLEANUP', !!(
      result.counts_after.supabase_scheduled_appointments === 6 &&
      result.counts_after.supabase_completed_appointments === 255 &&
      result.counts_after.supabase_cancelled_appointments === 23
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      },
      expected_after: {
        scheduled: 6,
        completed: 255,
        cancelled: 23
      }
    });

    addCheck('ALL_7E_TEST_ROWS_REMOVED_AFTER_CLEANUP', !!(
      !treatmentAfter &&
      !treatmentItemAfter &&
      !medicalRecordAfter &&
      !billingAfter &&
      !billingItemAfter &&
      Array.isArray(billingItemsForBillingAfter) &&
      billingItemsForBillingAfter.length === 0
    ), result.selected_after);

    addCheck('7E_TEST_APPOINTMENT_RESTORED_TO_SCHEDULED_AFTER_CLEANUP', !!(
      appointmentAfter &&
      normalizeTreatmentPhase7EStatus_(appointmentAfter.status) === 'scheduled'
    ), {
      appointment_after: result.selected_after.appointment
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-15',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7ERecoveryCleanupBundleLog() {
  const result = {
    success: true,
    stage: '7E-15R',
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
    counts_before: {},
    counts_after: {},
    existing_before: {},
    cleanup_results: {},
    existing_after: {},
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

  function deleteIfExists_(key, exists, tableName, idColumn, idValue) {
    if (!exists) {
      result.cleanup_results[key] = {
        skipped: true,
        reason: 'ROW_ALREADY_MISSING',
        table: tableName,
        id_column: idColumn,
        id_value: idValue || ''
      };
      return null;
    }

    const response = dbSupabaseDeleteByIdStaging7A_(
      tableName,
      idColumn,
      idValue,
      {
        stage: '7E'
      }
    );

    result.cleanup_results[key] = {
      skipped: false,
      success: !!(response && response.success),
      status_code: response ? response.status_code : null,
      row_count: response ? response.row_count : null,
      target_table: response ? response.target_table : '',
      id_column: idColumn,
      id_value: idValue
    };

    return response;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED_FOR_RECOVERY_CLEANUP', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetTreatmentsBefore = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    let treatmentsBefore = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    let treatmentItemsBefore = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    let medicalRecordsBefore = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    let appointmentsBefore = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    let billingsBefore = TreatmentRepository.getBillingsRaw(supabaseOptions);
    let billingItemsBefore = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    let orthoRecallsBefore = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledBefore = (Array.isArray(appointmentsBefore) ? appointmentsBefore : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_before.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsBefore) ? spreadsheetTreatmentsBefore.length : -1;
    result.counts_before.supabase_treatments = Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1;
    result.counts_before.supabase_treatment_items = Array.isArray(treatmentItemsBefore) ? treatmentItemsBefore.length : -1;
    result.counts_before.supabase_medical_records = Array.isArray(medicalRecordsBefore) ? medicalRecordsBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(appointmentsBefore) ? appointmentsBefore.length : -1;
    result.counts_before.supabase_billings = Array.isArray(billingsBefore) ? billingsBefore.length : -1;
    result.counts_before.supabase_billing_items = Array.isArray(billingItemsBefore) ? billingItemsBefore.length : -1;
    result.counts_before.supabase_ortho_recalls = Array.isArray(orthoRecallsBefore) ? orthoRecallsBefore.length : -1;
    result.counts_before.supabase_scheduled_appointments = scheduledBefore.length;
    result.counts_before.supabase_completed_appointments = completedBefore.length;
    result.counts_before.supabase_cancelled_appointments = cancelledBefore.length;

    const treatmentBefore = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItemBefore = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const treatmentItemRawBefore = findTreatmentPhase7EByField_(
      treatmentItemsBefore,
      'treatment_item_id',
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID
    );

    const treatmentItemSupabaseUuid = treatmentItemRawBefore && treatmentItemRawBefore.id
      ? normalizeTreatmentPhase7EText_(treatmentItemRawBefore.id)
      : '';

    const medicalRecordBefore = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const appointmentBefore = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const billingBefore = findTreatmentPhase7EByField_(
      billingsBefore,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingItemBefore = findTreatmentPhase7EByField_(
      billingItemsBefore,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    result.existing_before = {
      treatment_exists: !!treatmentBefore,
      treatment_item_exists: !!treatmentItemBefore,
      treatment_item_supabase_uuid: treatmentItemSupabaseUuid,
      medical_record_exists: !!medicalRecordBefore,
      billing_exists: !!billingBefore,
      billing_item_exists: !!billingItemBefore,
      appointment: appointmentBefore ? {
        appointment_id: normalizeTreatmentPhase7EText_(appointmentBefore.appointment_id),
        status: normalizeTreatmentPhase7EStatus_(appointmentBefore.status)
      } : null
    };

    addCheck('RECOVERY_CLEANUP_HAS_SOMETHING_TO_CLEAN_OR_RESTORE', !!(
      treatmentBefore ||
      treatmentItemBefore ||
      medicalRecordBefore ||
      billingBefore ||
      billingItemBefore ||
      (
        appointmentBefore &&
        normalizeTreatmentPhase7EStatus_(appointmentBefore.status) !== 'scheduled'
      )
    ), result.existing_before);

    addCheck('TREATMENT_ITEM_INTERNAL_UUID_AVAILABLE_IF_ITEM_EXISTS', !!(
      !treatmentItemBefore || treatmentItemSupabaseUuid
    ), {
      treatment_item_exists: !!treatmentItemBefore,
      treatment_item_supabase_uuid: treatmentItemSupabaseUuid,
      note: 'Delete TreatmentItems wajib memakai Supabase internal id, bukan treatment_item_id legacy.'
    });

    if (treatmentItemBefore && !treatmentItemSupabaseUuid) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const deleteBillingItemResponse = deleteIfExists_(
      'delete_billing_item',
      !!billingItemBefore,
      REPO_TABLES.BILLING_ITEMS,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    addCheck('RECOVERY_DELETE_BILLING_ITEM_OK_OR_ALREADY_MISSING', !!(
      !billingItemBefore ||
      (deleteBillingItemResponse && deleteBillingItemResponse.success)
    ), result.cleanup_results.delete_billing_item);

    const deleteBillingResponse = deleteIfExists_(
      'delete_billing_parent',
      !!billingBefore,
      REPO_TABLES.BILLINGS,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    addCheck('RECOVERY_DELETE_BILLING_PARENT_OK_OR_ALREADY_MISSING', !!(
      !billingBefore ||
      (deleteBillingResponse && deleteBillingResponse.success)
    ), result.cleanup_results.delete_billing_parent);

    const deleteMedicalRecordResponse = deleteIfExists_(
      'delete_medical_record',
      !!medicalRecordBefore,
      REPO_TABLES.MEDICAL_RECORDS,
      'record_id',
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID
    );

    addCheck('RECOVERY_DELETE_MEDICAL_RECORD_OK_OR_ALREADY_MISSING', !!(
      !medicalRecordBefore ||
      (deleteMedicalRecordResponse && deleteMedicalRecordResponse.success)
    ), result.cleanup_results.delete_medical_record);

    const deleteTreatmentItemResponse = deleteIfExists_(
      'delete_treatment_item_by_supabase_uuid',
      !!treatmentItemBefore,
      REPO_TABLES.TREATMENT_ITEMS,
      'id',
      treatmentItemSupabaseUuid
    );

    addCheck('RECOVERY_DELETE_TREATMENT_ITEM_BY_SUPABASE_UUID_OK_OR_ALREADY_MISSING', !!(
      !treatmentItemBefore ||
      (deleteTreatmentItemResponse && deleteTreatmentItemResponse.success)
    ), result.cleanup_results.delete_treatment_item_by_supabase_uuid);

    const deleteTreatmentResponse = deleteIfExists_(
      'delete_treatment',
      !!treatmentBefore,
      REPO_TABLES.TREATMENTS,
      'treatment_id',
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    addCheck('RECOVERY_DELETE_TREATMENT_OK_OR_ALREADY_MISSING', !!(
      !treatmentBefore ||
      (deleteTreatmentResponse && deleteTreatmentResponse.success)
    ), result.cleanup_results.delete_treatment);

    const shouldRestoreAppointment = !!(
      appointmentBefore &&
      normalizeTreatmentPhase7EStatus_(appointmentBefore.status) !== 'scheduled'
    );

    if (shouldRestoreAppointment) {
      const restoreAppointmentResponse = dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.APPOINTMENTS,
        'appointment_id',
        'APT-20260430-135818056-583',
        {
          status: 'scheduled',
          updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
        },
        {
          stage: '7E'
        }
      );

      result.cleanup_results.restore_appointment_scheduled = {
        skipped: false,
        success: !!(restoreAppointmentResponse && restoreAppointmentResponse.success),
        status_code: restoreAppointmentResponse ? restoreAppointmentResponse.status_code : null,
        row_count: restoreAppointmentResponse ? restoreAppointmentResponse.row_count : null,
        target_table: restoreAppointmentResponse ? restoreAppointmentResponse.target_table : ''
      };

      addCheck('RECOVERY_RESTORE_APPOINTMENT_SCHEDULED_OK', !!(
        restoreAppointmentResponse && restoreAppointmentResponse.success
      ), result.cleanup_results.restore_appointment_scheduled);
    } else {
      result.cleanup_results.restore_appointment_scheduled = {
        skipped: true,
        reason: 'APPOINTMENT_ALREADY_SCHEDULED_OR_NOT_FOUND'
      };

      addCheck('RECOVERY_RESTORE_APPOINTMENT_SCHEDULED_OK', true, result.cleanup_results.restore_appointment_scheduled);
    }

    const spreadsheetTreatmentsAfter = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatmentsAfter = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItemsAfter = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecordsAfter = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointmentsAfter = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const billingsAfter = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItemsAfter = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecallsAfter = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledAfter = (Array.isArray(appointmentsAfter) ? appointmentsAfter : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts_after.spreadsheet_treatments = Array.isArray(spreadsheetTreatmentsAfter) ? spreadsheetTreatmentsAfter.length : -1;
    result.counts_after.supabase_treatments = Array.isArray(treatmentsAfter) ? treatmentsAfter.length : -1;
    result.counts_after.supabase_treatment_items = Array.isArray(treatmentItemsAfter) ? treatmentItemsAfter.length : -1;
    result.counts_after.supabase_medical_records = Array.isArray(medicalRecordsAfter) ? medicalRecordsAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(appointmentsAfter) ? appointmentsAfter.length : -1;
    result.counts_after.supabase_billings = Array.isArray(billingsAfter) ? billingsAfter.length : -1;
    result.counts_after.supabase_billing_items = Array.isArray(billingItemsAfter) ? billingItemsAfter.length : -1;
    result.counts_after.supabase_ortho_recalls = Array.isArray(orthoRecallsAfter) ? orthoRecallsAfter.length : -1;
    result.counts_after.supabase_scheduled_appointments = scheduledAfter.length;
    result.counts_after.supabase_completed_appointments = completedAfter.length;
    result.counts_after.supabase_cancelled_appointments = cancelledAfter.length;

    const treatmentAfter = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentItemAfter = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const medicalRecordAfter = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const appointmentAfter = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const billingAfter = findTreatmentPhase7EByField_(
      billingsAfter,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingItemAfter = findTreatmentPhase7EByField_(
      billingItemsAfter,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    result.existing_after = {
      treatment_exists: !!treatmentAfter,
      treatment_item_exists: !!treatmentItemAfter,
      medical_record_exists: !!medicalRecordAfter,
      billing_exists: !!billingAfter,
      billing_item_exists: !!billingItemAfter,
      appointment: appointmentAfter ? {
        appointment_id: normalizeTreatmentPhase7EText_(appointmentAfter.appointment_id),
        status: normalizeTreatmentPhase7EStatus_(appointmentAfter.status)
      } : null
    };

    addCheck('SPREADSHEET_TREATMENT_COUNT_UNCHANGED_AFTER_RECOVERY_CLEANUP', result.counts_after.spreadsheet_treatments === result.counts_before.spreadsheet_treatments, {
      before_count: result.counts_before.spreadsheet_treatments,
      after_count: result.counts_after.spreadsheet_treatments
    });

    addCheck('SUPABASE_COUNTS_BACK_TO_7E_BASELINE_AFTER_RECOVERY_CLEANUP', !!(
      result.counts_after.supabase_treatments === 254 &&
      result.counts_after.supabase_treatment_items === 489 &&
      result.counts_after.supabase_medical_records === 254 &&
      result.counts_after.supabase_appointments === 284 &&
      result.counts_after.supabase_billings === 46 &&
      result.counts_after.supabase_billing_items === 99 &&
      result.counts_after.supabase_ortho_recalls === 124
    ), {
      before: result.counts_before,
      after: result.counts_after
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BACK_TO_7E_BASELINE_AFTER_RECOVERY_CLEANUP', !!(
      result.counts_after.supabase_scheduled_appointments === 6 &&
      result.counts_after.supabase_completed_appointments === 255 &&
      result.counts_after.supabase_cancelled_appointments === 23
    ), {
      before: {
        scheduled: result.counts_before.supabase_scheduled_appointments,
        completed: result.counts_before.supabase_completed_appointments,
        cancelled: result.counts_before.supabase_cancelled_appointments
      },
      after: {
        scheduled: result.counts_after.supabase_scheduled_appointments,
        completed: result.counts_after.supabase_completed_appointments,
        cancelled: result.counts_after.supabase_cancelled_appointments
      },
      expected_after: {
        scheduled: 6,
        completed: 255,
        cancelled: 23
      }
    });

    addCheck('ALL_7E_TEST_ROWS_REMOVED_AFTER_RECOVERY_CLEANUP', !!(
      !treatmentAfter &&
      !treatmentItemAfter &&
      !medicalRecordAfter &&
      !billingAfter &&
      !billingItemAfter
    ), result.existing_after);

    addCheck('7E_TEST_APPOINTMENT_RESTORED_TO_SCHEDULED_AFTER_RECOVERY_CLEANUP', !!(
      appointmentAfter &&
      normalizeTreatmentPhase7EStatus_(appointmentAfter.status) === 'scheduled'
    ), {
      appointment_after: result.existing_after.appointment
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-15R',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testTreatmentPhase7EFinalAuditLog() {
  const result = {
    success: true,
    stage: '7E-16',
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
    appointment_status_counts: {},
    test_rows: {},
    selected_appointment: null,
    guard_checks: {},
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

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
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

    const spreadsheetTreatments = TreatmentRepository.getTreatmentsRaw(spreadsheetOptions);

    const treatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const treatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const medicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const appointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = TreatmentRepository.getPatientsRaw(supabaseOptions);
    const users = TreatmentRepository.getUsersRaw(supabaseOptions);
    const services = TreatmentRepository.getServiceCatalogRaw(supabaseOptions);
    const billings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const billingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const orthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    const scheduledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'scheduled';
    });

    const completedRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'completed';
    });

    const cancelledRows = (Array.isArray(appointments) ? appointments : []).filter(function(row) {
      return normalizeTreatmentPhase7EStatus_(row.status) === 'cancelled';
    });

    result.counts.spreadsheet_treatments = Array.isArray(spreadsheetTreatments) ? spreadsheetTreatments.length : -1;
    result.counts.supabase_treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.supabase_treatment_items = Array.isArray(treatmentItems) ? treatmentItems.length : -1;
    result.counts.supabase_medical_records = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;
    result.counts.supabase_users = Array.isArray(users) ? users.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(services) ? services.length : -1;
    result.counts.supabase_billings = Array.isArray(billings) ? billings.length : -1;
    result.counts.supabase_billing_items = Array.isArray(billingItems) ? billingItems.length : -1;
    result.counts.supabase_ortho_recalls = Array.isArray(orthoRecalls) ? orthoRecalls.length : -1;

    result.appointment_status_counts.supabase_scheduled = scheduledRows.length;
    result.appointment_status_counts.supabase_completed = completedRows.length;
    result.appointment_status_counts.supabase_cancelled = cancelledRows.length;

    addCheck('SPREADSHEET_TREATMENTS_STILL_READABLE', result.counts.spreadsheet_treatments >= 282, {
      actual: result.counts.spreadsheet_treatments,
      expected_minimum: 282,
      note: 'Spreadsheet production bisa bertambah jika admin klinik menambah treatment setelah snapshot staging.'
    });

    addCheck('SUPABASE_COUNTS_BACK_TO_7E_BASELINE_FINAL', !!(
      result.counts.supabase_treatments === 254 &&
      result.counts.supabase_treatment_items === 489 &&
      result.counts.supabase_medical_records === 254 &&
      result.counts.supabase_appointments === 284 &&
      result.counts.supabase_patients === 285 &&
      result.counts.supabase_users === 8 &&
      result.counts.supabase_service_catalog === 100 &&
      result.counts.supabase_billings === 46 &&
      result.counts.supabase_billing_items === 99 &&
      result.counts.supabase_ortho_recalls === 124
    ), {
      counts: result.counts
    });

    addCheck('APPOINTMENT_STATUS_COUNTS_BACK_TO_7E_BASELINE_FINAL', !!(
      result.appointment_status_counts.supabase_scheduled === 6 &&
      result.appointment_status_counts.supabase_completed === 255 &&
      result.appointment_status_counts.supabase_cancelled === 23
    ), {
      status_counts: result.appointment_status_counts,
      expected: {
        supabase_scheduled: 6,
        supabase_completed: 255,
        supabase_cancelled: 23
      }
    });

    addCheck('APPOINTMENT_STATUS_TOTAL_MATCH_FINAL_7E', (
      result.counts.supabase_appointments ===
      result.appointment_status_counts.supabase_scheduled +
      result.appointment_status_counts.supabase_completed +
      result.appointment_status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      status_counts: result.appointment_status_counts
    });

    const treatment = TreatmentRepository.findTreatmentById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const treatmentByAppointment = TreatmentRepository.findTreatmentByAppointmentId(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const treatmentItem = TreatmentRepository.findTreatmentItemById(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID,
      supabaseOptions
    );

    const treatmentItemRaw = findTreatmentPhase7EByField_(
      treatmentItems,
      'treatment_item_id',
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ITEM_ID
    );

    const medicalRecord = TreatmentRepository.findMedicalRecordById(
      TREATMENT_PHASE_7E_TEST_IDS.MEDICAL_RECORD_ID,
      supabaseOptions
    );

    const medicalRecordsForTreatment = listTreatmentPhase7EMedicalRecordsByTreatmentId_(
      medicalRecords,
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID
    );

    const billing = findTreatmentPhase7EByField_(
      billings,
      'billing_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const billingByNumber = findTreatmentPhase7EByField_(
      billings,
      'billing_number',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_NUMBER
    );

    const billingByTreatment = TreatmentRepository.findBillingByTreatmentId(
      TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID,
      supabaseOptions
    );

    const billingItem = findTreatmentPhase7EByField_(
      billingItems,
      'billing_item_id',
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ITEM_ID
    );

    const billingItemsForBilling = listTreatmentPhase7EBillingItemsByBillingId_(
      billingItems,
      TREATMENT_PHASE_7E_BILLING_IDS.BILLING_ID
    );

    const appointment = TreatmentRepository.findAppointmentById(
      'APT-20260430-135818056-583',
      supabaseOptions
    );

    const relatedOrthoRecall = Array.isArray(orthoRecalls)
      ? orthoRecalls.filter(function(row) {
          return normalizeTreatmentPhase7EText_(row.install_treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID ||
            normalizeTreatmentPhase7EText_(row.last_control_treatment_id) === TREATMENT_PHASE_7E_TEST_IDS.TREATMENT_ID;
        })
      : [];

    result.test_rows = {
      treatment_exists: !!treatment,
      treatment_by_appointment_exists: !!treatmentByAppointment,
      treatment_item_exists: !!treatmentItem,
      treatment_item_raw_exists: !!treatmentItemRaw,
      medical_record_exists: !!medicalRecord,
      medical_record_count_for_treatment: Array.isArray(medicalRecordsForTreatment) ? medicalRecordsForTreatment.length : -1,
      billing_exists: !!billing,
      billing_by_number_exists: !!billingByNumber,
      billing_by_treatment_exists: !!billingByTreatment,
      billing_item_exists: !!billingItem,
      billing_item_count_for_billing: Array.isArray(billingItemsForBilling) ? billingItemsForBilling.length : -1,
      related_ortho_recall_count: Array.isArray(relatedOrthoRecall) ? relatedOrthoRecall.length : -1
    };

    result.selected_appointment = appointment ? {
      appointment_id: normalizeTreatmentPhase7EText_(appointment.appointment_id),
      patient_id: normalizeTreatmentPhase7EText_(appointment.patient_id),
      patient_name: normalizeTreatmentPhase7EText_(appointment.patient_name),
      appointment_date: normalizeTreatmentPhase7EYmd_(appointment.appointment_date || appointment.date || ''),
      appointment_time: normalizeTreatmentPhase7EText_(appointment.appointment_time),
      status: normalizeTreatmentPhase7EStatus_(appointment.status)
    } : null;

    addCheck('ALL_7E_TEST_ROWS_CLEANED_UP_FINAL', !!(
      !treatment &&
      !treatmentByAppointment &&
      !treatmentItem &&
      !treatmentItemRaw &&
      !medicalRecord &&
      Array.isArray(medicalRecordsForTreatment) &&
      medicalRecordsForTreatment.length === 0 &&
      !billing &&
      !billingByNumber &&
      !billingByTreatment &&
      !billingItem &&
      Array.isArray(billingItemsForBilling) &&
      billingItemsForBilling.length === 0
    ), result.test_rows);

    addCheck('NO_ORTHO_RECALL_SIDE_EFFECT_FINAL_7E', !!(
      Array.isArray(relatedOrthoRecall) &&
      relatedOrthoRecall.length === 0
    ), {
      related_ortho_recall_count: Array.isArray(relatedOrthoRecall) ? relatedOrthoRecall.length : -1
    });

    addCheck('7E_TEST_APPOINTMENT_RESTORED_TO_SCHEDULED_FINAL', !!(
      appointment &&
      normalizeTreatmentPhase7EStatus_(appointment.status) === 'scheduled'
    ), {
      appointment: result.selected_appointment
    });

    let guardedInsertBlocked = false;
    let guardedInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.TREATMENTS,
        {
          treatment_id: 'TRX-7E-FINAL-GUARD-SHOULD-NOT-INSERT'
        },
        {
          stage: '7E'
        }
      );
    } catch (errInsert) {
      guardedInsertBlocked = true;
      guardedInsertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    result.guard_checks.explicit_supabase_insert_blocked = {
      blocked: guardedInsertBlocked,
      message: guardedInsertMessage
    };

    addCheck('EXPLICIT_SUPABASE_INSERT_BLOCKED_AFTER_FLAG_FALSE_FINAL_7E', guardedInsertBlocked, result.guard_checks.explicit_supabase_insert_blocked);

    let oldDbInsertBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(
        REPO_TABLES.TREATMENTS,
        {
          treatment_id: 'TRX-7E-FINAL-OLD-DBINSERT-SHOULD-NOT-INSERT'
        },
        {
          backend_mode: REPO_BACKEND_MODES.SUPABASE
        }
      );
    } catch (errOldInsert) {
      oldDbInsertBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    result.guard_checks.old_db_insert_supabase_blocked = {
      blocked: oldDbInsertBlocked,
      message: oldDbInsertMessage
    };

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_FINAL_7E', oldDbInsertBlocked, result.guard_checks.old_db_insert_supabase_blocked);

    let treatmentItemLegacyDeleteBlocked = false;
    let treatmentItemLegacyDeleteMessage = '';

    try {
      dbSupabaseDeleteByIdStaging7A_(
        REPO_TABLES.TREATMENT_ITEMS,
        'treatment_item_id',
        'TRI-7E-FINAL-LEGACY-DELETE-SHOULD-BLOCK',
        {
          stage: '7E'
        }
      );
    } catch (errDelete) {
      treatmentItemLegacyDeleteBlocked = true;
      treatmentItemLegacyDeleteMessage = errDelete && errDelete.message ? errDelete.message : String(errDelete || '');
    }

    result.guard_checks.treatment_item_legacy_delete_blocked = {
      blocked: treatmentItemLegacyDeleteBlocked,
      message: treatmentItemLegacyDeleteMessage
    };

    addCheck('TREATMENT_ITEM_LEGACY_DELETE_BLOCKED_FINAL_7E', treatmentItemLegacyDeleteBlocked, result.guard_checks.treatment_item_legacy_delete_blocked);

    const finalTreatments = TreatmentRepository.getTreatmentsRaw(supabaseOptions);
    const finalTreatmentItems = TreatmentRepository.getTreatmentItemsRaw(supabaseOptions);
    const finalMedicalRecords = TreatmentRepository.getMedicalRecordsRaw(supabaseOptions);
    const finalAppointments = TreatmentRepository.getAppointmentsRaw(supabaseOptions);
    const finalBillings = TreatmentRepository.getBillingsRaw(supabaseOptions);
    const finalBillingItems = TreatmentRepository.getBillingItemsRaw(supabaseOptions);
    const finalOrthoRecalls = TreatmentRepository.getOrthoRecallRaw(supabaseOptions);

    addCheck('NO_GUARD_CHECK_SIDE_EFFECT_ON_COUNTS_FINAL_7E', !!(
      Array.isArray(finalTreatments) &&
      finalTreatments.length === result.counts.supabase_treatments &&
      Array.isArray(finalTreatmentItems) &&
      finalTreatmentItems.length === result.counts.supabase_treatment_items &&
      Array.isArray(finalMedicalRecords) &&
      finalMedicalRecords.length === result.counts.supabase_medical_records &&
      Array.isArray(finalAppointments) &&
      finalAppointments.length === result.counts.supabase_appointments &&
      Array.isArray(finalBillings) &&
      finalBillings.length === result.counts.supabase_billings &&
      Array.isArray(finalBillingItems) &&
      finalBillingItems.length === result.counts.supabase_billing_items &&
      Array.isArray(finalOrthoRecalls) &&
      finalOrthoRecalls.length === result.counts.supabase_ortho_recalls
    ), {
      before_guard_counts: result.counts,
      after_guard_counts: {
        supabase_treatments: Array.isArray(finalTreatments) ? finalTreatments.length : -1,
        supabase_treatment_items: Array.isArray(finalTreatmentItems) ? finalTreatmentItems.length : -1,
        supabase_medical_records: Array.isArray(finalMedicalRecords) ? finalMedicalRecords.length : -1,
        supabase_appointments: Array.isArray(finalAppointments) ? finalAppointments.length : -1,
        supabase_billings: Array.isArray(finalBillings) ? finalBillings.length : -1,
        supabase_billing_items: Array.isArray(finalBillingItems) ? finalBillingItems.length : -1,
        supabase_ortho_recalls: Array.isArray(finalOrthoRecalls) ? finalOrthoRecalls.length : -1
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7E-16',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

