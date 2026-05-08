/* =========================================================
   APPOINTMENT REPOSITORY
   Tahap 3H - Repository Layer Read-Only Awal
   Backend saat ini tetap Spreadsheet via DataAccess.gs
   ========================================================= */

/**
 * AppointmentRepository adalah layer baca data appointment dan relasi dasarnya.
 *
 * Catatan penting:
 * - Tahap 3H hanya read-only.
 * - Belum mengganti AppointmentService.gs.
 * - Belum mengubah endpoint frontend.
 * - Belum mengubah business logic.
 * - Semua data masih berasal dari Spreadsheet melalui DataAccess.gs.
 */

const APPOINTMENT_REPOSITORY_CONTEXT_KEYS = Object.freeze({
  APPOINTMENTS: 'appointments',
  PATIENTS: 'patients',
  TREATMENTS: 'treatments'
});

const AppointmentRepository = Object.freeze({
  getAppointmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.APPOINTMENTS, options);
  },

  getPatientsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.PATIENTS, options);
  },

  getTreatmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.TREATMENTS, options);
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

  listAppointmentsByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizeAppointmentRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.APPOINTMENTS, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  listOpenAppointmentsByPatientId: function(patientId, excludeAppointmentId, options) {
    const normalizedPatientId = normalizeAppointmentRepositoryKeyValue_(patientId);
    const normalizedExcludeId = normalizeAppointmentRepositoryKeyValue_(excludeAppointmentId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.APPOINTMENTS, function(row) {
      const rowPatientId = String(row.patient_id || '').trim();
      const rowAppointmentId = String(row.appointment_id || '').trim();
      const status = normalizeAppointmentRepositoryStatus_(row.status);

      if (rowPatientId !== normalizedPatientId) return false;
      if (normalizedExcludeId && rowAppointmentId === normalizedExcludeId) return false;

      return isAppointmentRepositoryOpenStatus_(status);
    }, options);
  },

  hasOpenAppointmentForPatient: function(patientId, excludeAppointmentId, options) {
    return this.listOpenAppointmentsByPatientId(patientId, excludeAppointmentId, options).length > 0;
  },

  listAppointmentsByStatus: function(status, options) {
    const normalizedStatus = normalizeAppointmentRepositoryStatus_(status);

    if (!normalizedStatus) return [];

    return dbFindWhere_(REPO_TABLES.APPOINTMENTS, function(row) {
      return normalizeAppointmentRepositoryStatus_(row.status) === normalizedStatus;
    }, options);
  },

  listAppointmentsByDate: function(appointmentDate, options) {
    const normalizedDate = normalizeAppointmentRepositoryYmd_(appointmentDate);

    if (!normalizedDate) return [];

    return dbFindWhere_(REPO_TABLES.APPOINTMENTS, function(row) {
      return normalizeAppointmentRepositoryYmd_(row.appointment_date || row.date || '') === normalizedDate;
    }, options);
  },

  listAppointmentsByDateRange: function(startYmd, endYmd, options) {
    const start = normalizeAppointmentRepositoryYmd_(startYmd);
    const end = normalizeAppointmentRepositoryYmd_(endYmd);

    if (!start && !end) return [];

    return dbFindWhere_(REPO_TABLES.APPOINTMENTS, function(row) {
      const date = normalizeAppointmentRepositoryYmd_(row.appointment_date || row.date || '');

      if (!date) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;

      return true;
    }, options);
  },

  listTreatmentsByAppointmentId: function(appointmentId, options) {
    const normalizedAppointmentId = normalizeAppointmentRepositoryKeyValue_(appointmentId);

    if (!normalizedAppointmentId) return [];

    return dbFindWhere_(REPO_TABLES.TREATMENTS, function(row) {
      return String(row.appointment_id || '').trim() === normalizedAppointmentId;
    }, options);
  },

  findTreatmentByAppointmentId: function(appointmentId, options) {
    const rows = this.listTreatmentsByAppointmentId(appointmentId, options);
    return rows.length ? rows[0] : null;
  },

  buildRawContext: function(options) {
    return buildAppointmentRepositoryRawContext_(options || {});
  },

  getRawContextRows: function(ctx, key) {
    return getAppointmentRepositoryRawContextRows_(ctx, key);
  },

  findAppointmentByIdFromContext: function(ctx, appointmentId) {
    return findAppointmentRepositoryAppointmentByIdFromContext_(ctx, appointmentId);
  },

  findPatientByIdFromContext: function(ctx, patientId) {
    return findAppointmentRepositoryPatientByIdFromContext_(ctx, patientId);
  },

  listAppointmentsByPatientIdFromContext: function(ctx, patientId) {
    return listAppointmentRepositoryAppointmentsByPatientIdFromContext_(ctx, patientId);
  },

  listOpenAppointmentsByPatientIdFromContext: function(ctx, patientId, excludeAppointmentId) {
    return listAppointmentRepositoryOpenAppointmentsByPatientIdFromContext_(
      ctx,
      patientId,
      excludeAppointmentId
    );
  },

  hasOpenAppointmentForPatientFromContext: function(ctx, patientId, excludeAppointmentId) {
    return this.listOpenAppointmentsByPatientIdFromContext(
      ctx,
      patientId,
      excludeAppointmentId
    ).length > 0;
  },

  listTreatmentsByAppointmentIdFromContext: function(ctx, appointmentId) {
    return listAppointmentRepositoryTreatmentsByAppointmentIdFromContext_(ctx, appointmentId);
  },

  findTreatmentByAppointmentIdFromContext: function(ctx, appointmentId) {
    const rows = this.listTreatmentsByAppointmentIdFromContext(ctx, appointmentId);
    return rows.length ? rows[0] : null;
  }
});

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function normalizeAppointmentRepositoryKeyValue_(value) {
  return String(value || '').trim();
}

function normalizeAppointmentRepositoryStatus_(value) {
  return String(value || '').trim().toLowerCase();
}

function isAppointmentRepositoryOpenStatus_(status) {
  const normalizedStatus = normalizeAppointmentRepositoryStatus_(status);

  return normalizedStatus === 'scheduled';
}

function normalizeAppointmentRepositoryYmd_(value) {
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

function shouldAppointmentRepositoryLoadContextKey_(only, key) {
  const config = only || {};
  const keys = Object.keys(config);

  if (!keys.length) {
    return true;
  }

  return config[key] === true;
}

function buildAppointmentRepositoryRawContext_(options) {
  const opts = options || {};
  const only = opts.only || {};

  const ctx = {
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_(opts)
      : 'spreadsheet',

    loaded_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),

    appointments: [],
    patients: [],
    treatments: []
  };

  if (shouldAppointmentRepositoryLoadContextKey_(only, APPOINTMENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS)) {
    ctx.appointments = AppointmentRepository.getAppointmentsRaw(opts);
  }

  if (shouldAppointmentRepositoryLoadContextKey_(only, APPOINTMENT_REPOSITORY_CONTEXT_KEYS.PATIENTS)) {
    ctx.patients = AppointmentRepository.getPatientsRaw(opts);
  }

  if (shouldAppointmentRepositoryLoadContextKey_(only, APPOINTMENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS)) {
    ctx.treatments = AppointmentRepository.getTreatmentsRaw(opts);
  }

  return ctx;
}

function getAppointmentRepositoryRawContextRows_(ctx, key) {
  const context = ctx || {};
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) return [];

  if (Array.isArray(context[normalizedKey])) {
    return context[normalizedKey];
  }

  const aliases = {
    Appointments: 'appointments',
    Patients: 'patients',
    Treatments: 'treatments',

    appointmentsRaw: 'appointments',
    patientsRaw: 'patients',
    treatmentsRaw: 'treatments'
  };

  const mappedKey = aliases[normalizedKey];

  if (mappedKey && Array.isArray(context[mappedKey])) {
    return context[mappedKey];
  }

  return [];
}

function findAppointmentRepositoryAppointmentByIdFromContext_(ctx, appointmentId) {
  const normalizedAppointmentId = normalizeAppointmentRepositoryKeyValue_(appointmentId);

  if (!normalizedAppointmentId) return null;

  return getAppointmentRepositoryRawContextRows_(
    ctx,
    APPOINTMENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS
  ).find(function(row) {
    return String(row.appointment_id || '').trim() === normalizedAppointmentId;
  }) || null;
}

function findAppointmentRepositoryPatientByIdFromContext_(ctx, patientId) {
  const normalizedPatientId = normalizeAppointmentRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return null;

  return getAppointmentRepositoryRawContextRows_(
    ctx,
    APPOINTMENT_REPOSITORY_CONTEXT_KEYS.PATIENTS
  ).find(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  }) || null;
}

function listAppointmentRepositoryAppointmentsByPatientIdFromContext_(ctx, patientId) {
  const normalizedPatientId = normalizeAppointmentRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return [];

  return getAppointmentRepositoryRawContextRows_(
    ctx,
    APPOINTMENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS
  ).filter(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  });
}

function listAppointmentRepositoryOpenAppointmentsByPatientIdFromContext_(ctx, patientId, excludeAppointmentId) {
  const normalizedPatientId = normalizeAppointmentRepositoryKeyValue_(patientId);
  const normalizedExcludeId = normalizeAppointmentRepositoryKeyValue_(excludeAppointmentId);

  if (!normalizedPatientId) return [];

  return getAppointmentRepositoryRawContextRows_(
    ctx,
    APPOINTMENT_REPOSITORY_CONTEXT_KEYS.APPOINTMENTS
  ).filter(function(row) {
    const rowPatientId = String(row.patient_id || '').trim();
    const rowAppointmentId = String(row.appointment_id || '').trim();
    const status = normalizeAppointmentRepositoryStatus_(row.status);

    if (rowPatientId !== normalizedPatientId) return false;
    if (normalizedExcludeId && rowAppointmentId === normalizedExcludeId) return false;

    return isAppointmentRepositoryOpenStatus_(status);
  });
}

function listAppointmentRepositoryTreatmentsByAppointmentIdFromContext_(ctx, appointmentId) {
  const normalizedAppointmentId = normalizeAppointmentRepositoryKeyValue_(appointmentId);

  if (!normalizedAppointmentId) return [];

  return getAppointmentRepositoryRawContextRows_(
    ctx,
    APPOINTMENT_REPOSITORY_CONTEXT_KEYS.TREATMENTS
  ).filter(function(row) {
    return String(row.appointment_id || '').trim() === normalizedAppointmentId;
  });
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testAppointmentRepositoryPhase3HReadOnly() {
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
      appointments: AppointmentRepository.getAppointmentsRaw(),
      patients: AppointmentRepository.getPatientsRaw(),
      treatments: AppointmentRepository.getTreatmentsRaw()
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

    const scheduledAppointments = AppointmentRepository.listAppointmentsByStatus('scheduled');
    const completedAppointments = AppointmentRepository.listAppointmentsByStatus('completed');
    const cancelledAppointments = AppointmentRepository.listAppointmentsByStatus('cancelled');

    result.counts.scheduledAppointments = Array.isArray(scheduledAppointments) ? scheduledAppointments.length : 0;
    result.counts.completedAppointments = Array.isArray(completedAppointments) ? completedAppointments.length : 0;
    result.counts.cancelledAppointments = Array.isArray(cancelledAppointments) ? cancelledAppointments.length : 0;

    if (!Array.isArray(scheduledAppointments)) {
      result.issues.push({
        dataset: 'scheduledAppointments',
        issue: 'SCHEDULED_APPOINTMENTS_NOT_ARRAY'
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

function testAppointmentRepositoryPhase3HBuildRawContext() {
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
    const ctx = AppointmentRepository.buildRawContext({
      only: {
        appointments: true,
        patients: true
      }
    });

    const expectedArrays = [
      'appointments',
      'patients'
    ];

    expectedArrays.forEach(function(key) {
      const rows = AppointmentRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_ROWS_NOT_ARRAY'
        });
      }
    });

    const unloadedKeys = [
      'treatments'
    ];

    unloadedKeys.forEach(function(key) {
      const rows = AppointmentRepository.getRawContextRows(ctx, key);

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

function testAppointmentRepositoryPhase3HFindAppointmentSample() {
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
    const appointments = AppointmentRepository.getAppointmentsRaw();
    const firstAppointment = appointments.length ? appointments[0] : null;
    const appointmentId = firstAppointment
      ? String(firstAppointment.appointment_id || '').trim()
      : '';

    const patientId = firstAppointment
      ? String(firstAppointment.patient_id || '').trim()
      : '';

    result.sample.appointment_count = appointments.length;
    result.sample.first_appointment_id = appointmentId;
    result.sample.first_patient_id = patientId;

    if (!appointmentId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada data appointment untuk sample find test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundAppointment = AppointmentRepository.findAppointmentById(appointmentId);
    const foundPatient = patientId
      ? AppointmentRepository.findPatientById(patientId)
      : null;

    const patientAppointments = patientId
      ? AppointmentRepository.listAppointmentsByPatientId(patientId)
      : [];

    const openAppointments = patientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(patientId, '')
      : [];

    const hasOpenAppointment = patientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(patientId, '')
      : false;

    const treatments = AppointmentRepository.listTreatmentsByAppointmentId(appointmentId);
    const treatment = AppointmentRepository.findTreatmentByAppointmentId(appointmentId);

    result.sample.find_appointment_ok = !!foundAppointment;
    result.sample.find_patient_ok = patientId ? !!foundPatient : true;
    result.sample.patient_appointment_count = patientAppointments.length;
    result.sample.open_appointment_count = openAppointments.length;
    result.sample.has_open_appointment = !!hasOpenAppointment;
    result.sample.treatment_count = treatments.length;
    result.sample.find_treatment_ok = !!treatment || treatments.length === 0;

    if (!foundAppointment) {
      result.issues.push({
        appointment_id: appointmentId,
        issue: 'FIND_APPOINTMENT_BY_ID_FAILED'
      });
    }

    if (patientId && !foundPatient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_BY_ID_FAILED'
      });
    }

    if (treatments.length && !treatment) {
      result.issues.push({
        appointment_id: appointmentId,
        issue: 'FIND_TREATMENT_BY_APPOINTMENT_FAILED'
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

function testAppointmentRepositoryPhase3HContextFinderSample() {
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
    const ctx = AppointmentRepository.buildRawContext({
      only: {
        appointments: true,
        patients: true,
        treatments: true
      }
    });

    const appointments = AppointmentRepository.getRawContextRows(ctx, 'appointments');
    const firstAppointment = appointments.length ? appointments[0] : null;

    const appointmentId = firstAppointment
      ? String(firstAppointment.appointment_id || '').trim()
      : '';

    const patientId = firstAppointment
      ? String(firstAppointment.patient_id || '').trim()
      : '';

    result.sample.appointment_count = appointments.length;
    result.sample.first_appointment_id = appointmentId;
    result.sample.first_patient_id = patientId;

    if (!appointmentId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada appointment untuk context finder test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const appointment = AppointmentRepository.findAppointmentByIdFromContext(ctx, appointmentId);
    const patient = patientId
      ? AppointmentRepository.findPatientByIdFromContext(ctx, patientId)
      : null;

    const patientAppointments = patientId
      ? AppointmentRepository.listAppointmentsByPatientIdFromContext(ctx, patientId)
      : [];

    const openAppointments = patientId
      ? AppointmentRepository.listOpenAppointmentsByPatientIdFromContext(ctx, patientId, '')
      : [];

    const hasOpenAppointment = patientId
      ? AppointmentRepository.hasOpenAppointmentForPatientFromContext(ctx, patientId, '')
      : false;

    const treatments = AppointmentRepository.listTreatmentsByAppointmentIdFromContext(ctx, appointmentId);
    const treatment = AppointmentRepository.findTreatmentByAppointmentIdFromContext(ctx, appointmentId);

    result.sample.find_appointment_ok = !!appointment;
    result.sample.find_patient_ok = patientId ? !!patient : true;
    result.sample.patient_appointment_count = patientAppointments.length;
    result.sample.open_appointment_count = openAppointments.length;
    result.sample.has_open_appointment = !!hasOpenAppointment;
    result.sample.treatment_count = treatments.length;
    result.sample.find_treatment_ok = !!treatment || treatments.length === 0;

    if (!appointment) {
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

    if (treatments.length && !treatment) {
      result.issues.push({
        appointment_id: appointmentId,
        issue: 'FIND_TREATMENT_FROM_CONTEXT_FAILED'
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

function testAppointmentRepositoryPhase6ESupabaseReadOnlyLog() {
  const result = {
    success: true,
    stage: '6E',
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
      appointments: AppointmentRepository.getAppointmentsRaw(supabaseOptions),
      patients: AppointmentRepository.getPatientsRaw(supabaseOptions),
      treatments: AppointmentRepository.getTreatmentsRaw(supabaseOptions)
    };

    Object.keys(datasets).forEach(function(key) {
      addCheck('SUPABASE_APPOINTMENT_DATASET_ARRAY_' + key, Array.isArray(datasets[key]), {
        dataset: key,
        row_count: Array.isArray(datasets[key]) ? datasets[key].length : -1
      });
    });

    const scheduledAppointments = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAppointments = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAppointments = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    addCheck('SUPABASE_APPOINTMENT_STATUS_LISTS_ARRAY', Array.isArray(scheduledAppointments) && Array.isArray(completedAppointments) && Array.isArray(cancelledAppointments), {
      scheduled_count: Array.isArray(scheduledAppointments) ? scheduledAppointments.length : -1,
      completed_count: Array.isArray(completedAppointments) ? completedAppointments.length : -1,
      cancelled_count: Array.isArray(cancelledAppointments) ? cancelledAppointments.length : -1
    });

    const firstAppointment = datasets.appointments.length ? datasets.appointments[0] : null;
    const firstAppointmentId = firstAppointment ? String(firstAppointment.appointment_id || '').trim() : '';
    const firstPatientId = firstAppointment ? String(firstAppointment.patient_id || '').trim() : '';
    const firstDate = firstAppointment
      ? normalizeAppointmentRepositoryYmd_(firstAppointment.appointment_date || firstAppointment.date || '')
      : '';

    addCheck('SUPABASE_APPOINTMENT_SAMPLE_AVAILABLE', !!firstAppointmentId, {
      first_appointment_id: firstAppointmentId,
      first_patient_id: firstPatientId,
      appointment_count: datasets.appointments.length
    });

    if (firstAppointmentId) {
      const foundAppointment = AppointmentRepository.findAppointmentById(firstAppointmentId, supabaseOptions);
      const foundPatient = firstPatientId
        ? AppointmentRepository.findPatientById(firstPatientId, supabaseOptions)
        : null;

      const patientAppointments = firstPatientId
        ? AppointmentRepository.listAppointmentsByPatientId(firstPatientId, supabaseOptions)
        : [];

      const openAppointments = firstPatientId
        ? AppointmentRepository.listOpenAppointmentsByPatientId(firstPatientId, '', supabaseOptions)
        : [];

      const hasOpenAppointment = firstPatientId
        ? AppointmentRepository.hasOpenAppointmentForPatient(firstPatientId, '', supabaseOptions)
        : false;

      const treatments = AppointmentRepository.listTreatmentsByAppointmentId(firstAppointmentId, supabaseOptions);
      const treatment = AppointmentRepository.findTreatmentByAppointmentId(firstAppointmentId, supabaseOptions);

      addCheck('SUPABASE_APPOINTMENT_FIND_BY_ID', !!foundAppointment, {
        appointment_id: firstAppointmentId
      });

      addCheck('SUPABASE_APPOINTMENT_FIND_PATIENT_BY_ID', firstPatientId ? !!foundPatient : true, {
        patient_id: firstPatientId
      });

      addCheck('SUPABASE_APPOINTMENT_LIST_RELATED_ROWS', true, {
        appointment_id: firstAppointmentId,
        patient_id: firstPatientId,
        patient_appointment_count: patientAppointments.length,
        open_appointment_count: openAppointments.length,
        has_open_appointment: !!hasOpenAppointment,
        treatment_count: treatments.length,
        find_treatment_ok: !!treatment || treatments.length === 0
      });

      if (firstDate) {
        const sameDateAppointments = AppointmentRepository.listAppointmentsByDate(firstDate, supabaseOptions);
        const rangeAppointments = AppointmentRepository.listAppointmentsByDateRange(firstDate, firstDate, supabaseOptions);

        addCheck('SUPABASE_APPOINTMENT_DATE_FILTERS_ARRAY', Array.isArray(sameDateAppointments) && Array.isArray(rangeAppointments), {
          date: firstDate,
          same_date_count: Array.isArray(sameDateAppointments) ? sameDateAppointments.length : -1,
          range_count: Array.isArray(rangeAppointments) ? rangeAppointments.length : -1
        });
      }
    }

    const ctx = AppointmentRepository.buildRawContext({
      backend_mode: 'supabase',
      only: {
        appointments: true,
        patients: true,
        treatments: true
      }
    });

    addCheck('SUPABASE_APPOINTMENT_CONTEXT_BACKEND_MODE', ctx.backend_mode === 'supabase', {
      actual: ctx.backend_mode
    });

    addCheck('SUPABASE_APPOINTMENT_CONTEXT_ROWS_ARRAY', Array.isArray(ctx.appointments) && Array.isArray(ctx.patients), {
      appointment_count: Array.isArray(ctx.appointments) ? ctx.appointments.length : -1,
      patient_count: Array.isArray(ctx.patients) ? ctx.patients.length : -1
    });

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

    addCheck('SUPABASE_APPOINTMENT_WRITE_STILL_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6E',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentRepositoryPhase6ESpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6E',
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
    addTest('testAppointmentRepositoryPhase3HReadOnly', testAppointmentRepositoryPhase3HReadOnly());
    addTest('testAppointmentRepositoryPhase3HBuildRawContext', testAppointmentRepositoryPhase3HBuildRawContext());
    addTest('testAppointmentRepositoryPhase3HFindAppointmentSample', testAppointmentRepositoryPhase3HFindAppointmentSample());
    addTest('testAppointmentRepositoryPhase3HContextFinderSample', testAppointmentRepositoryPhase3HContextFinderSample());

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6E',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   PHASE 7D - APPOINTMENT MUTATION PREFLIGHT
   Read-only preflight. Aman dijalankan. Tidak menulis data.
   ========================================================= */

const APPOINTMENT_PHASE_7D_TEST_APPOINTMENT = Object.freeze({
  APPOINTMENT_ID: 'APT-7D-TEST-001',
  APPOINTMENT_DATE: '2026-12-31',
  APPOINTMENT_DATE_UPDATED: '2027-01-02',
  APPOINTMENT_TIME: '09:30',
  APPOINTMENT_TIME_UPDATED: '10:45',
  COMPLAINT: 'Keluhan dummy appointment Supabase staging 7D',
  COMPLAINT_UPDATED: 'Keluhan dummy appointment Supabase staging 7D updated'
});

function normalizeAppointmentPhase7DStatus_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAppointmentPhase7DText_(value) {
  return String(value || '').trim();
}

function findAppointmentPhase7DByField_(rows, fieldName, value) {
  const normalizedFieldName = normalizeAppointmentPhase7DText_(fieldName);
  const normalizedValue = normalizeAppointmentPhase7DText_(value).toLowerCase();

  if (!normalizedFieldName || !normalizedValue) return null;

  return (Array.isArray(rows) ? rows : []).find(function(row) {
    return normalizeAppointmentPhase7DText_(row[normalizedFieldName]).toLowerCase() === normalizedValue;
  }) || null;
}

function buildAppointmentPhase7DOpenAppointmentMap_(appointments) {
  const map = {};

  (Array.isArray(appointments) ? appointments : []).forEach(function(row) {
    const patientId = normalizeAppointmentPhase7DText_(row.patient_id);
    const appointmentId = normalizeAppointmentPhase7DText_(row.appointment_id);
    const status = normalizeAppointmentPhase7DStatus_(row.status);

    if (!patientId || !appointmentId) return;
    if (status !== 'scheduled') return;

    if (!map[patientId]) {
      map[patientId] = [];
    }

    map[patientId].push(appointmentId);
  });

  return map;
}

function findAppointmentPhase7DSafePatient_(patients, appointments) {
  const openMap = buildAppointmentPhase7DOpenAppointmentMap_(appointments);

  return (Array.isArray(patients) ? patients : []).find(function(patient) {
    const patientId = normalizeAppointmentPhase7DText_(patient.patient_id);
    const fullName = normalizeAppointmentPhase7DText_(patient.full_name);
    const isActive = isPatientActiveValue(patient.is_active);

    if (!patientId || !fullName) return false;
    if (!isActive) return false;

    return !openMap[patientId] || !openMap[patientId].length;
  }) || null;
}

function buildAppointmentPhase7DTestAppointmentPayload_(patient) {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
  const selectedPatient = patient || {};

  return {
    appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
    patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
    patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
    appointment_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
    appointment_time: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME,
    complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT,
    status: 'scheduled',
    created_at: now,
    updated_at: now
  };
}

function testAppointmentPhase7DPreflightLog() {
  const result = {
    success: true,
    stage: '7D-1',
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
    test_appointment: {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      appointment_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      appointment_date_updated: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      appointment_time: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME,
      appointment_time_updated: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME_UPDATED
    },
    selected_patient: {},
    counts: {},
    status_counts: {},
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

    const spreadsheetAppointments = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAppointments = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const supabasePatients = AppointmentRepository.getPatientsRaw(supabaseOptions);
    const supabaseTreatments = AppointmentRepository.getTreatmentsRaw(supabaseOptions);

    const scheduledAppointments = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAppointments = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAppointments = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetAppointments) ? spreadsheetAppointments.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseAppointments) ? supabaseAppointments.length : -1;
    result.counts.supabase_patients = Array.isArray(supabasePatients) ? supabasePatients.length : -1;
    result.counts.supabase_treatments = Array.isArray(supabaseTreatments) ? supabaseTreatments.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledAppointments) ? scheduledAppointments.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedAppointments) ? completedAppointments.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledAppointments) ? cancelledAppointments.length : -1;

    addCheck('SUPABASE_APPOINTMENTS_READABLE', Array.isArray(supabaseAppointments), {
      row_count: result.counts.supabase_appointments
    });

    addCheck('SUPABASE_APPOINTMENTS_BASELINE_COUNT_284', result.counts.supabase_appointments === 284, {
      actual: result.counts.supabase_appointments,
      expected: 284
    });

    addCheck('SUPABASE_PATIENTS_BASELINE_COUNT_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('SUPABASE_TREATMENTS_BASELINE_COUNT_254', result.counts.supabase_treatments === 254, {
      actual: result.counts.supabase_treatments,
      expected: 254
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_COUNTS_BASELINE', (
      result.status_counts.supabase_scheduled === 6 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_TOTAL_MATCH', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const existingById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const existingByComplaint = findAppointmentPhase7DByField_(
      supabaseAppointments,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const existingByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseAppointments,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    addCheck('TEST_APPOINTMENT_NOT_EXISTING_BEFORE_7D', !(
      existingById ||
      existingByComplaint ||
      existingByUpdatedComplaint
    ), {
      by_id_exists: !!existingById,
      by_complaint_exists: !!existingByComplaint,
      by_updated_complaint_exists: !!existingByUpdatedComplaint
    });

    const safePatient = findAppointmentPhase7DSafePatient_(supabasePatients, supabaseAppointments);

    result.selected_patient = safePatient ? {
      patient_id: normalizeAppointmentPhase7DText_(safePatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(safePatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(safePatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(safePatient.phone)
    } : null;

    addCheck('SAFE_PATIENT_WITHOUT_OPEN_APPOINTMENT_AVAILABLE', !!safePatient, {
      selected_patient: result.selected_patient
    });

    if (safePatient) {
      const openForSafePatient = AppointmentRepository.listOpenAppointmentsByPatientId(
        safePatient.patient_id,
        '',
        supabaseOptions
      );

      addCheck('SAFE_PATIENT_HAS_NO_OPEN_APPOINTMENT', Array.isArray(openForSafePatient) && openForSafePatient.length === 0, {
        patient_id: safePatient.patient_id,
        open_appointment_count: Array.isArray(openForSafePatient) ? openForSafePatient.length : -1
      });
    }

    const payload = buildAppointmentPhase7DTestAppointmentPayload_(safePatient);

    addCheck('TEST_APPOINTMENT_PAYLOAD_VALID_SHAPE', !!(
      payload &&
      payload.appointment_id === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      payload.patient_id &&
      payload.patient_name &&
      payload.appointment_date === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE &&
      payload.appointment_time === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME &&
      payload.complaint === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT &&
      payload.status === 'scheduled' &&
      payload.created_at &&
      payload.updated_at
    ), {
      payload: payload
    });

    let explicitInsertBlocked = false;
    let explicitInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.APPOINTMENTS,
        payload,
        {
          stage: '7D'
        }
      );
    } catch (errInsert) {
      explicitInsertBlocked = true;
      explicitInsertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('APPOINTMENT_INSERT_STILL_BLOCKED_WHEN_FLAG_FALSE', explicitInsertBlocked, {
      message: explicitInsertMessage
    });

    const supabaseAppointmentsAfterBlockedInsert = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const afterById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    result.counts.supabase_appointments_after_blocked_insert = Array.isArray(supabaseAppointmentsAfterBlockedInsert)
      ? supabaseAppointmentsAfterBlockedInsert.length
      : -1;

    addCheck('SUPABASE_APPOINTMENT_COUNT_UNCHANGED_AFTER_BLOCKED_INSERT', result.counts.supabase_appointments_after_blocked_insert === result.counts.supabase_appointments, {
      before_count: result.counts.supabase_appointments,
      after_count: result.counts.supabase_appointments_after_blocked_insert
    });

    addCheck('TEST_APPOINTMENT_STILL_NOT_INSERTED_AFTER_BLOCKED_INSERT', !afterById, {
      appointment_id_exists: !!afterById
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-1',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DInsertDummyAppointmentDefaultOffLog() {
  const result = {
    success: true,
    stage: '7D-2',
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
    test_appointment: {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      appointment_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      appointment_time: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME,
      complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    },
    selected_patient: {},
    counts_before: {},
    counts_after: {},
    status_counts_before: {},
    status_counts_after: {},
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

    const spreadsheetBefore = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseBefore = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = AppointmentRepository.getPatientsRaw(supabaseOptions);

    const scheduledBefore = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedBefore = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledBefore = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_before.spreadsheet_appointments = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(patients) ? patients.length : -1;

    result.status_counts_before.supabase_scheduled = Array.isArray(scheduledBefore) ? scheduledBefore.length : -1;
    result.status_counts_before.supabase_completed = Array.isArray(completedBefore) ? completedBefore.length : -1;
    result.status_counts_before.supabase_cancelled = Array.isArray(cancelledBefore) ? cancelledBefore.length : -1;

    addCheck('SUPABASE_APPOINTMENT_COUNT_BASELINE_284_BEFORE_INSERT_TEST', result.counts_before.supabase_appointments === 284, {
      actual: result.counts_before.supabase_appointments,
      expected: 284
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_COUNTS_BASELINE_BEFORE_INSERT_TEST', (
      result.status_counts_before.supabase_scheduled === 6 &&
      result.status_counts_before.supabase_completed === 255 &&
      result.status_counts_before.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts_before.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts_before.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts_before.supabase_cancelled,
      expected_cancelled: 23
    });

    const existingByIdBefore = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const existingByComplaintBefore = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const existingByUpdatedComplaintBefore = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    addCheck('TEST_APPOINTMENT_NOT_EXISTING_BEFORE_INSERT_TEST', !(
      existingByIdBefore ||
      existingByComplaintBefore ||
      existingByUpdatedComplaintBefore
    ), {
      by_id_exists: !!existingByIdBefore,
      by_complaint_exists: !!existingByComplaintBefore,
      by_updated_complaint_exists: !!existingByUpdatedComplaintBefore
    });

    const safePatient = findAppointmentPhase7DSafePatient_(patients, supabaseBefore);

    result.selected_patient = safePatient ? {
      patient_id: normalizeAppointmentPhase7DText_(safePatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(safePatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(safePatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(safePatient.phone)
    } : null;

    addCheck('SAFE_PATIENT_WITHOUT_OPEN_APPOINTMENT_AVAILABLE', !!safePatient, {
      selected_patient: result.selected_patient
    });

    if (safePatient) {
      const openForSafePatient = AppointmentRepository.listOpenAppointmentsByPatientId(
        safePatient.patient_id,
        '',
        supabaseOptions
      );

      addCheck('SAFE_PATIENT_HAS_NO_OPEN_APPOINTMENT_BEFORE_BLOCKED_INSERT', Array.isArray(openForSafePatient) && openForSafePatient.length === 0, {
        patient_id: safePatient.patient_id,
        open_appointment_count: Array.isArray(openForSafePatient) ? openForSafePatient.length : -1
      });
    }

    const payload = buildAppointmentPhase7DTestAppointmentPayload_(safePatient);

    let insertBlocked = false;
    let insertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.APPOINTMENTS,
        payload,
        {
          stage: '7D'
        }
      );
    } catch (errInsert) {
      insertBlocked = true;
      insertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('DUMMY_APPOINTMENT_INSERT_BLOCKED_WHEN_FLAG_FALSE', insertBlocked, {
      message: insertMessage
    });

    const spreadsheetAfter = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAfter = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledAfter = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAfter = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAfter = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_after.spreadsheet_appointments = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.status_counts_after.supabase_scheduled = Array.isArray(scheduledAfter) ? scheduledAfter.length : -1;
    result.status_counts_after.supabase_completed = Array.isArray(completedAfter) ? completedAfter.length : -1;
    result.status_counts_after.supabase_cancelled = Array.isArray(cancelledAfter) ? cancelledAfter.length : -1;

    const existingByIdAfter = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const existingByComplaintAfter = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const existingByUpdatedComplaintAfter = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_UNCHANGED_AFTER_BLOCKED_INSERT', result.counts_after.spreadsheet_appointments === result.counts_before.spreadsheet_appointments, {
      before_count: result.counts_before.spreadsheet_appointments,
      after_count: result.counts_after.spreadsheet_appointments
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_UNCHANGED_AFTER_BLOCKED_INSERT', result.counts_after.supabase_appointments === result.counts_before.supabase_appointments, {
      before_count: result.counts_before.supabase_appointments,
      after_count: result.counts_after.supabase_appointments
    });

    addCheck('SUPABASE_STATUS_COUNTS_UNCHANGED_AFTER_BLOCKED_INSERT', (
      result.status_counts_after.supabase_scheduled === result.status_counts_before.supabase_scheduled &&
      result.status_counts_after.supabase_completed === result.status_counts_before.supabase_completed &&
      result.status_counts_after.supabase_cancelled === result.status_counts_before.supabase_cancelled
    ), {
      before: result.status_counts_before,
      after: result.status_counts_after
    });

    addCheck('TEST_APPOINTMENT_STILL_NOT_INSERTED_AFTER_BLOCKED_INSERT', !(
      existingByIdAfter ||
      existingByComplaintAfter ||
      existingByUpdatedComplaintAfter
    ), {
      by_id_exists: !!existingByIdAfter,
      by_complaint_exists: !!existingByComplaintAfter,
      by_updated_complaint_exists: !!existingByUpdatedComplaintAfter
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-2',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DWriteFlagEnabledPreMutationLog() {
  const result = {
    success: true,
    stage: '7D-3',
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
    test_appointment: {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      appointment_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      appointment_time: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME,
      complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    },
    selected_patient: {},
    counts: {},
    status_counts: {},
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

    const appointments = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = AppointmentRepository.getPatientsRaw(supabaseOptions);

    const scheduledAppointments = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAppointments = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAppointments = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.supabase_appointments = Array.isArray(appointments) ? appointments.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledAppointments) ? scheduledAppointments.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedAppointments) ? completedAppointments.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledAppointments) ? cancelledAppointments.length : -1;

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_BASELINE_284', result.counts.supabase_appointments === 284, {
      actual: result.counts.supabase_appointments,
      expected: 284
    });

    addCheck('SUPABASE_PATIENT_COUNT_STILL_BASELINE_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_COUNTS_STILL_BASELINE', (
      result.status_counts.supabase_scheduled === 6 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    const existingById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const existingByComplaint = findAppointmentPhase7DByField_(
      appointments,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const existingByUpdatedComplaint = findAppointmentPhase7DByField_(
      appointments,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    addCheck('TEST_APPOINTMENT_STILL_NOT_EXISTING_BEFORE_REAL_INSERT', !(
      existingById ||
      existingByComplaint ||
      existingByUpdatedComplaint
    ), {
      by_id_exists: !!existingById,
      by_complaint_exists: !!existingByComplaint,
      by_updated_complaint_exists: !!existingByUpdatedComplaint
    });

    const safePatient = findAppointmentPhase7DSafePatient_(patients, appointments);

    result.selected_patient = safePatient ? {
      patient_id: normalizeAppointmentPhase7DText_(safePatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(safePatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(safePatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(safePatient.phone)
    } : null;

    addCheck('SAFE_PATIENT_WITHOUT_OPEN_APPOINTMENT_AVAILABLE', !!safePatient, {
      selected_patient: result.selected_patient
    });

    if (safePatient) {
      const openForSafePatient = AppointmentRepository.listOpenAppointmentsByPatientId(
        safePatient.patient_id,
        '',
        supabaseOptions
      );

      addCheck('SAFE_PATIENT_HAS_NO_OPEN_APPOINTMENT_BEFORE_REAL_INSERT', Array.isArray(openForSafePatient) && openForSafePatient.length === 0, {
        patient_id: safePatient.patient_id,
        open_appointment_count: Array.isArray(openForSafePatient) ? openForSafePatient.length : -1
      });
    }

    const writeCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7D',
      table_name: REPO_TABLES.APPOINTMENTS,
      operation: 'TEST_APPOINTMENT_WRITE_7D'
    });

    addCheck('APPOINTMENT_WRITE_GUARD_ALLOWS_7D_WHEN_FLAG_TRUE', writeCheck.allowed === true, {
      allowed: writeCheck.allowed,
      message: writeCheck.message
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.APPOINTMENTS, {
        appointment_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7D'
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
      stage: '7D-3',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DInsertDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-4',
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
    selected_patient: {},
    counts_before: {},
    counts_after: {},
    status_counts_before: {},
    status_counts_after: {},
    insert_result: {},
    readback: {},
    schema_alignment: {
      missing_from_supabase: [],
      extra_in_supabase: []
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseBefore = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = AppointmentRepository.getPatientsRaw(supabaseOptions);

    const scheduledBefore = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedBefore = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledBefore = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_before.spreadsheet_appointments = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;
    result.counts_before.supabase_patients = Array.isArray(patients) ? patients.length : -1;

    result.status_counts_before.supabase_scheduled = Array.isArray(scheduledBefore) ? scheduledBefore.length : -1;
    result.status_counts_before.supabase_completed = Array.isArray(completedBefore) ? completedBefore.length : -1;
    result.status_counts_before.supabase_cancelled = Array.isArray(cancelledBefore) ? cancelledBefore.length : -1;

    addCheck('SUPABASE_APPOINTMENT_COUNT_BASELINE_284_BEFORE_INSERT', result.counts_before.supabase_appointments === 284, {
      actual: result.counts_before.supabase_appointments,
      expected: 284
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_COUNTS_BASELINE_BEFORE_INSERT', (
      result.status_counts_before.supabase_scheduled === 6 &&
      result.status_counts_before.supabase_completed === 255 &&
      result.status_counts_before.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts_before.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts_before.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts_before.supabase_cancelled,
      expected_cancelled: 23
    });

    const existingByIdBefore = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const existingByComplaintBefore = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const existingByUpdatedComplaintBefore = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    addCheck('TEST_APPOINTMENT_NOT_EXISTING_BEFORE_INSERT', !(
      existingByIdBefore ||
      existingByComplaintBefore ||
      existingByUpdatedComplaintBefore
    ), {
      by_id_exists: !!existingByIdBefore,
      by_complaint_exists: !!existingByComplaintBefore,
      by_updated_complaint_exists: !!existingByUpdatedComplaintBefore
    });

    if (existingByIdBefore || existingByComplaintBefore || existingByUpdatedComplaintBefore) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const safePatient = findAppointmentPhase7DSafePatient_(patients, supabaseBefore);

    result.selected_patient = safePatient ? {
      patient_id: normalizeAppointmentPhase7DText_(safePatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(safePatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(safePatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(safePatient.phone)
    } : null;

    addCheck('SAFE_PATIENT_WITHOUT_OPEN_APPOINTMENT_AVAILABLE', !!safePatient, {
      selected_patient: result.selected_patient
    });

    if (safePatient) {
      const openForSafePatient = AppointmentRepository.listOpenAppointmentsByPatientId(
        safePatient.patient_id,
        '',
        supabaseOptions
      );

      addCheck('SAFE_PATIENT_HAS_NO_OPEN_APPOINTMENT_BEFORE_INSERT', Array.isArray(openForSafePatient) && openForSafePatient.length === 0, {
        patient_id: safePatient.patient_id,
        open_appointment_count: Array.isArray(openForSafePatient) ? openForSafePatient.length : -1
      });
    }

    const payload = buildAppointmentPhase7DTestAppointmentPayload_(safePatient);

    if (Array.isArray(supabaseBefore) && supabaseBefore.length) {
      const sampleColumns = Object.keys(supabaseBefore[0] || {}).sort();
      const payloadColumns = Object.keys(payload || {}).sort();

      result.schema_alignment.missing_from_supabase = payloadColumns.filter(function(key) {
        return sampleColumns.indexOf(key) === -1;
      });

      result.schema_alignment.extra_in_supabase = sampleColumns.filter(function(key) {
        return payloadColumns.indexOf(key) === -1;
      });
    }

    addCheck('APPOINTMENT_SUPABASE_SCHEMA_ALIGNED_WITH_APP_PAYLOAD', result.schema_alignment.missing_from_supabase.length === 0, {
      missing_from_supabase: result.schema_alignment.missing_from_supabase,
      extra_in_supabase: result.schema_alignment.extra_in_supabase
    });

    if (result.schema_alignment.missing_from_supabase.length) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    addCheck('TEST_APPOINTMENT_PAYLOAD_VALID_SHAPE', !!(
      payload &&
      payload.appointment_id === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      payload.patient_id &&
      payload.patient_name &&
      payload.appointment_date === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE &&
      payload.appointment_time === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME &&
      payload.complaint === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT &&
      payload.status === 'scheduled' &&
      payload.created_at &&
      payload.updated_at
    ), {
      payload: payload
    });

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      payload,
      {
        stage: '7D'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('DUMMY_APPOINTMENT_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetAfter = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAfter = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledAfter = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAfter = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAfter = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    const insertedById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const insertedByComplaint = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const openForSafePatientAfter = safePatient
      ? AppointmentRepository.listOpenAppointmentsByPatientId(safePatient.patient_id, '', supabaseOptions)
      : [];

    result.counts_after.spreadsheet_appointments = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.status_counts_after.supabase_scheduled = Array.isArray(scheduledAfter) ? scheduledAfter.length : -1;
    result.status_counts_after.supabase_completed = Array.isArray(completedAfter) ? completedAfter.length : -1;
    result.status_counts_after.supabase_cancelled = Array.isArray(cancelledAfter) ? cancelledAfter.length : -1;

    result.readback.by_id = insertedById ? {
      appointment_id: normalizeAppointmentPhase7DText_(insertedById.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(insertedById.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(insertedById.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(insertedById.appointment_date || insertedById.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(insertedById.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(insertedById.complaint),
      status: normalizeAppointmentPhase7DStatus_(insertedById.status)
    } : null;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_UNCHANGED_AFTER_SUPABASE_INSERT', result.counts_after.spreadsheet_appointments === result.counts_before.spreadsheet_appointments, {
      before_count: result.counts_before.spreadsheet_appointments,
      after_count: result.counts_after.spreadsheet_appointments
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_INCREASED_TO_285_AFTER_INSERT', result.counts_after.supabase_appointments === 285, {
      before_count: result.counts_before.supabase_appointments,
      after_count: result.counts_after.supabase_appointments,
      expected_after_count: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_AFTER_INSERT_EXPECTED', (
      result.status_counts_after.supabase_scheduled === 7 &&
      result.status_counts_after.supabase_completed === 255 &&
      result.status_counts_after.supabase_cancelled === 23
    ), {
      before: result.status_counts_before,
      after: result.status_counts_after,
      expected_scheduled_after: 7,
      expected_completed_after: 255,
      expected_cancelled_after: 23
    });

    addCheck('DUMMY_APPOINTMENT_READBACK_BY_ID_FOUND', !!insertedById, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_READBACK_BY_COMPLAINT_FOUND', !!insertedByComplaint, {
      complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    });

    addCheck('DUMMY_APPOINTMENT_READBACK_FIELDS_MATCH', !!(
      insertedById &&
      normalizeAppointmentPhase7DText_(insertedById.appointment_id) === payload.appointment_id &&
      normalizeAppointmentPhase7DText_(insertedById.patient_id) === payload.patient_id &&
      normalizeAppointmentPhase7DText_(insertedById.patient_name) === payload.patient_name &&
      normalizeAppointmentRepositoryYmd_(insertedById.appointment_date || insertedById.date || '') === payload.appointment_date &&
      normalizeAppointmentPhase7DText_(insertedById.appointment_time) === payload.appointment_time &&
      normalizeAppointmentPhase7DText_(insertedById.complaint) === payload.complaint &&
      normalizeAppointmentPhase7DStatus_(insertedById.status) === 'scheduled'
    ), {
      readback: result.readback.by_id
    });

    addCheck('SAFE_PATIENT_NOW_HAS_ONE_OPEN_APPOINTMENT_AFTER_INSERT', Array.isArray(openForSafePatientAfter) && openForSafePatientAfter.length === 1, {
      patient_id: safePatient ? safePatient.patient_id : '',
      open_appointment_count: Array.isArray(openForSafePatientAfter) ? openForSafePatientAfter.length : -1,
      open_appointment_ids: Array.isArray(openForSafePatientAfter)
        ? openForSafePatientAfter.map(function(row) { return row.appointment_id; })
        : []
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-4',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DReadBackInsertedDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-5',
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
    status_counts: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseRows = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const patients = AppointmentRepository.getPatientsRaw(supabaseOptions);

    const scheduledRows = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedRows = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseRows) ? supabaseRows.length : -1;
    result.counts.supabase_patients = Array.isArray(patients) ? patients.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledRows) ? scheduledRows.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedRows) ? completedRows.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledRows) ? cancelledRows.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_AFTER_INSERT', result.counts.spreadsheet_appointments === 322, {
      actual: result.counts.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_NOW_285', result.counts.supabase_appointments === 285, {
      actual: result.counts.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_COUNTS_AFTER_INSERT_VERIFY', (
      result.status_counts.supabase_scheduled === 7 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 7,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_APPOINTMENT_STATUS_TOTAL_MATCH_AFTER_INSERT', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const appointmentById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const appointmentByDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const appointmentByDateRangeRows = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const selectedPatientId = appointmentById
      ? normalizeAppointmentPhase7DText_(appointmentById.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openForSelectedPatient = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenForSelectedPatient = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    const treatmentsForAppointment = AppointmentRepository.listTreatmentsByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const treatmentForAppointment = AppointmentRepository.findTreatmentByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    result.readback.by_id = appointmentById ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentById.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentById.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentById.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentById.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentById.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentById.status)
    } : null;

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_INSERT', !!appointmentById, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_COMPLAINT_AFTER_INSERT', !!appointmentByComplaint, {
      complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_COMPLAINT_NOT_YET_EXISTING', !appointmentByUpdatedComplaint, {
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      exists: !!appointmentByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_DATE_FILTERS_INCLUDE_INSERTED_ROW', !!(
      Array.isArray(appointmentByDateRows) &&
      Array.isArray(appointmentByDateRangeRows) &&
      appointmentByDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      appointmentByDateRangeRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      date_count: Array.isArray(appointmentByDateRows) ? appointmentByDateRows.length : -1,
      date_range_count: Array.isArray(appointmentByDateRangeRows) ? appointmentByDateRangeRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_FOUND_AFTER_INSERT', !!selectedPatient, {
      selected_patient: result.selected_patient
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_APPOINTMENT_AFTER_INSERT', !!(
      Array.isArray(openForSelectedPatient) &&
      openForSelectedPatient.length === 1 &&
      hasOpenForSelectedPatient === true &&
      openForSelectedPatient.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenForSelectedPatient,
      open_appointment_count: Array.isArray(openForSelectedPatient) ? openForSelectedPatient.length : -1,
      open_appointment_ids: Array.isArray(openForSelectedPatient)
        ? openForSelectedPatient.map(function(row) { return row.appointment_id; })
        : []
    });

    addCheck('DUMMY_APPOINTMENT_HAS_NO_TREATMENT_AFTER_INSERT', Array.isArray(treatmentsForAppointment) && treatmentsForAppointment.length === 0 && !treatmentForAppointment, {
      treatment_count: Array.isArray(treatmentsForAppointment) ? treatmentsForAppointment.length : -1,
      find_treatment_exists: !!treatmentForAppointment
    });

    addCheck('DUMMY_APPOINTMENT_FIELDS_MATCH_AFTER_INSERT_VERIFY', !!(
      appointmentById &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_id) === selectedPatientId &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_name) === normalizeAppointmentPhase7DText_(selectedPatient && selectedPatient.full_name) &&
      normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || '') === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_time) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME &&
      normalizeAppointmentPhase7DText_(appointmentById.complaint) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT &&
      normalizeAppointmentPhase7DStatus_(appointmentById.status) === 'scheduled'
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
      stage: '7D-5',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DUpdateDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-6',
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
    status_counts_before: {},
    status_counts_after: {},
    update_result: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseBefore = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledBefore = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedBefore = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledBefore = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_before.spreadsheet_appointments = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    result.status_counts_before.supabase_scheduled = Array.isArray(scheduledBefore) ? scheduledBefore.length : -1;
    result.status_counts_before.supabase_completed = Array.isArray(completedBefore) ? completedBefore.length : -1;
    result.status_counts_before.supabase_cancelled = Array.isArray(cancelledBefore) ? cancelledBefore.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_BEFORE_UPDATE', result.counts_before.spreadsheet_appointments === 322, {
      actual: result.counts_before.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_BEFORE_UPDATE', result.counts_before.supabase_appointments === 285, {
      actual: result.counts_before.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_BEFORE_UPDATE_EXPECTED', (
      result.status_counts_before.supabase_scheduled === 7 &&
      result.status_counts_before.supabase_completed === 255 &&
      result.status_counts_before.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts_before.supabase_scheduled,
      expected_scheduled: 7,
      completed: result.status_counts_before.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts_before.supabase_cancelled,
      expected_cancelled: 23
    });

    const appointmentBeforeById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentBeforeByComplaint = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentBeforeByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const oldDateRowsBefore = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const updatedDateRowsBefore = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const selectedPatientId = appointmentBeforeById
      ? normalizeAppointmentPhase7DText_(appointmentBeforeById.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openForSelectedPatientBefore = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    addCheck('DUMMY_APPOINTMENT_EXISTS_BEFORE_UPDATE', !!(
      appointmentBeforeById &&
      appointmentBeforeByComplaint &&
      !appointmentBeforeByUpdatedComplaint &&
      normalizeAppointmentPhase7DStatus_(appointmentBeforeById.status) === 'scheduled'
    ), {
      by_id_exists: !!appointmentBeforeById,
      by_old_complaint_exists: !!appointmentBeforeByComplaint,
      by_updated_complaint_exists: !!appointmentBeforeByUpdatedComplaint,
      status: appointmentBeforeById ? appointmentBeforeById.status : ''
    });

    addCheck('DUMMY_APPOINTMENT_OLD_DATE_FILTER_HAS_ROW_BEFORE_UPDATE', Array.isArray(oldDateRowsBefore) && oldDateRowsBefore.some(function(row) {
      return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
    }), {
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      old_date_count: Array.isArray(oldDateRowsBefore) ? oldDateRowsBefore.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_FILTER_NOT_YET_HAS_ROW', !(
      Array.isArray(updatedDateRowsBefore) &&
      updatedDateRowsBefore.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count: Array.isArray(updatedDateRowsBefore) ? updatedDateRowsBefore.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_BEFORE_UPDATE', Array.isArray(openForSelectedPatientBefore) && openForSelectedPatientBefore.length === 1, {
      patient_id: selectedPatientId,
      open_appointment_count: Array.isArray(openForSelectedPatientBefore) ? openForSelectedPatientBefore.length : -1,
      open_appointment_ids: Array.isArray(openForSelectedPatientBefore)
        ? openForSelectedPatientBefore.map(function(row) { return row.appointment_id; })
        : []
    });

    if (!appointmentBeforeById || !appointmentBeforeByComplaint || appointmentBeforeByUpdatedComplaint) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const patch = {
      appointment_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      appointment_time: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME_UPDATED,
      complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      status: 'scheduled',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    const updateResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      'appointment_id',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      patch,
      {
        stage: '7D'
      }
    );

    result.update_result = {
      success: !!(updateResponse && updateResponse.success),
      status_code: updateResponse ? updateResponse.status_code : null,
      row_count: updateResponse ? updateResponse.row_count : null,
      target_table: updateResponse ? updateResponse.target_table : ''
    };

    addCheck('DUMMY_APPOINTMENT_UPDATE_RESPONSE_SUCCESS', !!(updateResponse && updateResponse.success), result.update_result);

    const spreadsheetAfter = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAfter = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledAfter = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAfter = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAfter = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_after.spreadsheet_appointments = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.status_counts_after.supabase_scheduled = Array.isArray(scheduledAfter) ? scheduledAfter.length : -1;
    result.status_counts_after.supabase_completed = Array.isArray(completedAfter) ? completedAfter.length : -1;
    result.status_counts_after.supabase_cancelled = Array.isArray(cancelledAfter) ? cancelledAfter.length : -1;

    const appointmentAfterById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentAfterByOldComplaint = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentAfterByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const oldDateRowsAfter = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const updatedDateRowsAfter = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const openForSelectedPatientAfter = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    result.readback.by_id = appointmentAfterById ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentAfterById.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentAfterById.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentAfterById.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentAfterById.appointment_date || appointmentAfterById.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentAfterById.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentAfterById.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentAfterById.status)
    } : null;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_UNCHANGED_AFTER_SUPABASE_UPDATE', result.counts_after.spreadsheet_appointments === result.counts_before.spreadsheet_appointments, {
      before_count: result.counts_before.spreadsheet_appointments,
      after_count: result.counts_after.spreadsheet_appointments
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_UNCHANGED_285_AFTER_UPDATE', result.counts_after.supabase_appointments === result.counts_before.supabase_appointments, {
      before_count: result.counts_before.supabase_appointments,
      after_count: result.counts_after.supabase_appointments
    });

    addCheck('SUPABASE_STATUS_COUNTS_UNCHANGED_AFTER_UPDATE', (
      result.status_counts_after.supabase_scheduled === result.status_counts_before.supabase_scheduled &&
      result.status_counts_after.supabase_completed === result.status_counts_before.supabase_completed &&
      result.status_counts_after.supabase_cancelled === result.status_counts_before.supabase_cancelled
    ), {
      before: result.status_counts_before,
      after: result.status_counts_after
    });

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_UPDATE', !!appointmentAfterById, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_OLD_COMPLAINT_NOT_FOUND_AFTER_UPDATE', !appointmentAfterByOldComplaint, {
      old_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT,
      exists: !!appointmentAfterByOldComplaint
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_COMPLAINT_FOUND_AFTER_UPDATE', !!appointmentAfterByUpdatedComplaint, {
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      exists: !!appointmentAfterByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_MOVED_FROM_OLD_DATE_TO_UPDATED_DATE', !!(
      Array.isArray(oldDateRowsAfter) &&
      Array.isArray(updatedDateRowsAfter) &&
      !oldDateRowsAfter.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      updatedDateRowsAfter.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      old_date_count_after: Array.isArray(oldDateRowsAfter) ? oldDateRowsAfter.length : -1,
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count_after: Array.isArray(updatedDateRowsAfter) ? updatedDateRowsAfter.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_STILL_HAS_ONE_OPEN_AFTER_UPDATE', Array.isArray(openForSelectedPatientAfter) && openForSelectedPatientAfter.length === 1, {
      patient_id: selectedPatientId,
      open_appointment_count: Array.isArray(openForSelectedPatientAfter) ? openForSelectedPatientAfter.length : -1,
      open_appointment_ids: Array.isArray(openForSelectedPatientAfter)
        ? openForSelectedPatientAfter.map(function(row) { return row.appointment_id; })
        : []
    });

    addCheck('DUMMY_APPOINTMENT_FIELDS_MATCH_AFTER_UPDATE', !!(
      appointmentAfterById &&
      normalizeAppointmentPhase7DText_(appointmentAfterById.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      normalizeAppointmentPhase7DText_(appointmentAfterById.patient_id) === selectedPatientId &&
      normalizeAppointmentPhase7DText_(appointmentAfterById.patient_name) === normalizeAppointmentPhase7DText_(selectedPatient && selectedPatient.full_name) &&
      normalizeAppointmentRepositoryYmd_(appointmentAfterById.appointment_date || appointmentAfterById.date || '') === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentAfterById.appointment_time) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentAfterById.complaint) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED &&
      normalizeAppointmentPhase7DStatus_(appointmentAfterById.status) === 'scheduled'
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
      stage: '7D-6',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DReadBackUpdatedDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-7',
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
    status_counts: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseRows = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledRows = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedRows = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseRows) ? supabaseRows.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledRows) ? scheduledRows.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedRows) ? completedRows.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledRows) ? cancelledRows.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_AFTER_UPDATE_VERIFY', result.counts.spreadsheet_appointments === 322, {
      actual: result.counts.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_AFTER_UPDATE_VERIFY', result.counts.supabase_appointments === 285, {
      actual: result.counts.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_AFTER_UPDATE_VERIFY', (
      result.status_counts.supabase_scheduled === 7 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 7,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_STATUS_TOTAL_MATCH_AFTER_UPDATE_VERIFY', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const appointmentById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByOldComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const oldDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const updatedDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const updatedDateRangeRows = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const selectedPatientId = appointmentById
      ? normalizeAppointmentPhase7DText_(appointmentById.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openForSelectedPatient = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenForSelectedPatient = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    const treatmentsForAppointment = AppointmentRepository.listTreatmentsByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const treatmentForAppointment = AppointmentRepository.findTreatmentByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    result.readback.by_id = appointmentById ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentById.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentById.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentById.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentById.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentById.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentById.status)
    } : null;

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_UPDATE_VERIFY', !!appointmentById, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_OLD_COMPLAINT_NOT_FOUND_AFTER_UPDATE_VERIFY', !appointmentByOldComplaint, {
      old_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT,
      exists: !!appointmentByOldComplaint
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_COMPLAINT_FOUND_AFTER_UPDATE_VERIFY', !!appointmentByUpdatedComplaint, {
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      exists: !!appointmentByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_OLD_DATE_FILTER_NO_LONGER_HAS_ROW', !(
      Array.isArray(oldDateRows) &&
      oldDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      old_date_count: Array.isArray(oldDateRows) ? oldDateRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_FILTER_HAS_ROW', !!(
      Array.isArray(updatedDateRows) &&
      updatedDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count: Array.isArray(updatedDateRows) ? updatedDateRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_RANGE_FILTER_HAS_ROW', !!(
      Array.isArray(updatedDateRangeRows) &&
      updatedDateRangeRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_range_count: Array.isArray(updatedDateRangeRows) ? updatedDateRangeRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_FOUND_AFTER_UPDATE_VERIFY', !!selectedPatient, {
      selected_patient: result.selected_patient
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_AFTER_UPDATE_VERIFY', !!(
      Array.isArray(openForSelectedPatient) &&
      openForSelectedPatient.length === 1 &&
      hasOpenForSelectedPatient === true &&
      openForSelectedPatient.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenForSelectedPatient,
      open_appointment_count: Array.isArray(openForSelectedPatient) ? openForSelectedPatient.length : -1,
      open_appointment_ids: Array.isArray(openForSelectedPatient)
        ? openForSelectedPatient.map(function(row) { return row.appointment_id; })
        : []
    });

    addCheck('DUMMY_APPOINTMENT_STILL_HAS_NO_TREATMENT_AFTER_UPDATE', Array.isArray(treatmentsForAppointment) && treatmentsForAppointment.length === 0 && !treatmentForAppointment, {
      treatment_count: Array.isArray(treatmentsForAppointment) ? treatmentsForAppointment.length : -1,
      find_treatment_exists: !!treatmentForAppointment
    });

    addCheck('DUMMY_APPOINTMENT_FIELDS_MATCH_AFTER_UPDATE_VERIFY', !!(
      appointmentById &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_id) === selectedPatientId &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_name) === normalizeAppointmentPhase7DText_(selectedPatient && selectedPatient.full_name) &&
      normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || '') === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_time) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentById.complaint) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED &&
      normalizeAppointmentPhase7DStatus_(appointmentById.status) === 'scheduled'
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
      stage: '7D-7',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DCancelDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-8',
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
    status_counts_before: {},
    status_counts_after: {},
    cancel_result: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseBefore = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledBefore = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedBefore = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledBefore = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_before.spreadsheet_appointments = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    result.status_counts_before.supabase_scheduled = Array.isArray(scheduledBefore) ? scheduledBefore.length : -1;
    result.status_counts_before.supabase_completed = Array.isArray(completedBefore) ? completedBefore.length : -1;
    result.status_counts_before.supabase_cancelled = Array.isArray(cancelledBefore) ? cancelledBefore.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_BEFORE_CANCEL', result.counts_before.spreadsheet_appointments === 322, {
      actual: result.counts_before.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_BEFORE_CANCEL', result.counts_before.supabase_appointments === 285, {
      actual: result.counts_before.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_BEFORE_CANCEL_EXPECTED', (
      result.status_counts_before.supabase_scheduled === 7 &&
      result.status_counts_before.supabase_completed === 255 &&
      result.status_counts_before.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts_before.supabase_scheduled,
      expected_scheduled: 7,
      completed: result.status_counts_before.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts_before.supabase_cancelled,
      expected_cancelled: 23
    });

    const appointmentBefore = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const selectedPatientId = appointmentBefore
      ? normalizeAppointmentPhase7DText_(appointmentBefore.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openBefore = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    addCheck('DUMMY_APPOINTMENT_EXISTS_SCHEDULED_BEFORE_CANCEL', !!(
      appointmentBefore &&
      normalizeAppointmentPhase7DStatus_(appointmentBefore.status) === 'scheduled'
    ), {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      exists: !!appointmentBefore,
      status: appointmentBefore ? appointmentBefore.status : ''
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_BEFORE_CANCEL', !!(
      Array.isArray(openBefore) &&
      openBefore.length === 1 &&
      openBefore.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      patient_id: selectedPatientId,
      open_appointment_count: Array.isArray(openBefore) ? openBefore.length : -1,
      open_appointment_ids: Array.isArray(openBefore)
        ? openBefore.map(function(row) { return row.appointment_id; })
        : []
    });

    if (!appointmentBefore || normalizeAppointmentPhase7DStatus_(appointmentBefore.status) !== 'scheduled') {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const patch = {
      status: 'cancelled',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    const cancelResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      'appointment_id',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      patch,
      {
        stage: '7D'
      }
    );

    result.cancel_result = {
      success: !!(cancelResponse && cancelResponse.success),
      status_code: cancelResponse ? cancelResponse.status_code : null,
      row_count: cancelResponse ? cancelResponse.row_count : null,
      target_table: cancelResponse ? cancelResponse.target_table : ''
    };

    addCheck('DUMMY_APPOINTMENT_CANCEL_RESPONSE_SUCCESS', !!(cancelResponse && cancelResponse.success), result.cancel_result);

    const spreadsheetAfter = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAfter = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledAfter = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAfter = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAfter = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_after.spreadsheet_appointments = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.status_counts_after.supabase_scheduled = Array.isArray(scheduledAfter) ? scheduledAfter.length : -1;
    result.status_counts_after.supabase_completed = Array.isArray(completedAfter) ? completedAfter.length : -1;
    result.status_counts_after.supabase_cancelled = Array.isArray(cancelledAfter) ? cancelledAfter.length : -1;

    const appointmentAfter = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const openAfter = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenAfter = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    result.readback.by_id = appointmentAfter ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentAfter.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentAfter.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentAfter.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentAfter.appointment_date || appointmentAfter.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentAfter.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentAfter.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentAfter.status)
    } : null;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_UNCHANGED_AFTER_SUPABASE_CANCEL', result.counts_after.spreadsheet_appointments === result.counts_before.spreadsheet_appointments, {
      before_count: result.counts_before.spreadsheet_appointments,
      after_count: result.counts_after.spreadsheet_appointments
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_UNCHANGED_285_AFTER_CANCEL', result.counts_after.supabase_appointments === result.counts_before.supabase_appointments, {
      before_count: result.counts_before.supabase_appointments,
      after_count: result.counts_after.supabase_appointments
    });

    addCheck('SUPABASE_STATUS_COUNTS_AFTER_CANCEL_EXPECTED', (
      result.status_counts_after.supabase_scheduled === 6 &&
      result.status_counts_after.supabase_completed === 255 &&
      result.status_counts_after.supabase_cancelled === 24
    ), {
      before: result.status_counts_before,
      after: result.status_counts_after,
      expected_scheduled_after: 6,
      expected_completed_after: 255,
      expected_cancelled_after: 24
    });

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_CANCEL', !!appointmentAfter, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_STATUS_CANCELLED_AFTER_CANCEL', !!(
      appointmentAfter &&
      normalizeAppointmentPhase7DStatus_(appointmentAfter.status) === 'cancelled'
    ), {
      readback: result.readback.by_id
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_NO_OPEN_AFTER_CANCEL', !!(
      Array.isArray(openAfter) &&
      openAfter.length === 0 &&
      hasOpenAfter === false
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenAfter,
      open_appointment_count: Array.isArray(openAfter) ? openAfter.length : -1
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-8',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DReadBackCancelledDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-9',
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
    status_counts: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseRows = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledRows = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedRows = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseRows) ? supabaseRows.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledRows) ? scheduledRows.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedRows) ? completedRows.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledRows) ? cancelledRows.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_AFTER_CANCEL_VERIFY', result.counts.spreadsheet_appointments === 322, {
      actual: result.counts.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_AFTER_CANCEL_VERIFY', result.counts.supabase_appointments === 285, {
      actual: result.counts.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_AFTER_CANCEL_VERIFY', (
      result.status_counts.supabase_scheduled === 6 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 24
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 24
    });

    addCheck('SUPABASE_STATUS_TOTAL_MATCH_AFTER_CANCEL_VERIFY', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const appointmentById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const cancelledByStatusRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    const cancelledStatusContainsDummy = Array.isArray(cancelledByStatusRows) && cancelledByStatusRows.some(function(row) {
      return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
    });

    const updatedDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const updatedDateRangeRows = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const selectedPatientId = appointmentById
      ? normalizeAppointmentPhase7DText_(appointmentById.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openForSelectedPatient = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenForSelectedPatient = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    const treatmentsForAppointment = AppointmentRepository.listTreatmentsByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const treatmentForAppointment = AppointmentRepository.findTreatmentByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    result.readback.by_id = appointmentById ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentById.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentById.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentById.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentById.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentById.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentById.status)
    } : null;

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_CANCEL_VERIFY', !!appointmentById, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_UPDATED_COMPLAINT_AFTER_CANCEL_VERIFY', !!appointmentByUpdatedComplaint, {
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      exists: !!appointmentByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_STATUS_CANCELLED_AFTER_CANCEL_VERIFY', !!(
      appointmentById &&
      normalizeAppointmentPhase7DStatus_(appointmentById.status) === 'cancelled'
    ), {
      readback: result.readback.by_id
    });

    addCheck('DUMMY_APPOINTMENT_INCLUDED_IN_CANCELLED_STATUS_LIST', cancelledStatusContainsDummy, {
      cancelled_count: Array.isArray(cancelledByStatusRows) ? cancelledByStatusRows.length : -1,
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_FILTER_STILL_HAS_CANCELLED_ROW', !!(
      Array.isArray(updatedDateRows) &&
      updatedDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count: Array.isArray(updatedDateRows) ? updatedDateRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_RANGE_FILTER_STILL_HAS_CANCELLED_ROW', !!(
      Array.isArray(updatedDateRangeRows) &&
      updatedDateRangeRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_range_count: Array.isArray(updatedDateRangeRows) ? updatedDateRangeRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_FOUND_AFTER_CANCEL_VERIFY', !!selectedPatient, {
      selected_patient: result.selected_patient
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_NO_OPEN_AFTER_CANCEL_VERIFY', !!(
      Array.isArray(openForSelectedPatient) &&
      openForSelectedPatient.length === 0 &&
      hasOpenForSelectedPatient === false
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenForSelectedPatient,
      open_appointment_count: Array.isArray(openForSelectedPatient) ? openForSelectedPatient.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_STILL_HAS_NO_TREATMENT_AFTER_CANCEL', Array.isArray(treatmentsForAppointment) && treatmentsForAppointment.length === 0 && !treatmentForAppointment, {
      treatment_count: Array.isArray(treatmentsForAppointment) ? treatmentsForAppointment.length : -1,
      find_treatment_exists: !!treatmentForAppointment
    });

    addCheck('DUMMY_APPOINTMENT_FIELDS_MATCH_AFTER_CANCEL_VERIFY', !!(
      appointmentById &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_id) === selectedPatientId &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_name) === normalizeAppointmentPhase7DText_(selectedPatient && selectedPatient.full_name) &&
      normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || '') === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_time) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentById.complaint) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED &&
      normalizeAppointmentPhase7DStatus_(appointmentById.status) === 'cancelled'
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
      stage: '7D-9',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DRestoreDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-10',
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
    status_counts_before: {},
    status_counts_after: {},
    restore_result: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseBefore = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledBefore = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedBefore = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledBefore = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_before.spreadsheet_appointments = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    result.status_counts_before.supabase_scheduled = Array.isArray(scheduledBefore) ? scheduledBefore.length : -1;
    result.status_counts_before.supabase_completed = Array.isArray(completedBefore) ? completedBefore.length : -1;
    result.status_counts_before.supabase_cancelled = Array.isArray(cancelledBefore) ? cancelledBefore.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_BEFORE_RESTORE', result.counts_before.spreadsheet_appointments === 322, {
      actual: result.counts_before.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_BEFORE_RESTORE', result.counts_before.supabase_appointments === 285, {
      actual: result.counts_before.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_BEFORE_RESTORE_EXPECTED', (
      result.status_counts_before.supabase_scheduled === 6 &&
      result.status_counts_before.supabase_completed === 255 &&
      result.status_counts_before.supabase_cancelled === 24
    ), {
      scheduled: result.status_counts_before.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts_before.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts_before.supabase_cancelled,
      expected_cancelled: 24
    });

    const appointmentBefore = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const selectedPatientId = appointmentBefore
      ? normalizeAppointmentPhase7DText_(appointmentBefore.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openBefore = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenBefore = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    addCheck('DUMMY_APPOINTMENT_EXISTS_CANCELLED_BEFORE_RESTORE', !!(
      appointmentBefore &&
      normalizeAppointmentPhase7DStatus_(appointmentBefore.status) === 'cancelled'
    ), {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      exists: !!appointmentBefore,
      status: appointmentBefore ? appointmentBefore.status : ''
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_NO_OPEN_BEFORE_RESTORE', !!(
      Array.isArray(openBefore) &&
      openBefore.length === 0 &&
      hasOpenBefore === false
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenBefore,
      open_appointment_count: Array.isArray(openBefore) ? openBefore.length : -1
    });

    if (!appointmentBefore || normalizeAppointmentPhase7DStatus_(appointmentBefore.status) !== 'cancelled') {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const patch = {
      status: 'scheduled',
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
    };

    const restoreResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      'appointment_id',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      patch,
      {
        stage: '7D'
      }
    );

    result.restore_result = {
      success: !!(restoreResponse && restoreResponse.success),
      status_code: restoreResponse ? restoreResponse.status_code : null,
      row_count: restoreResponse ? restoreResponse.row_count : null,
      target_table: restoreResponse ? restoreResponse.target_table : ''
    };

    addCheck('DUMMY_APPOINTMENT_RESTORE_RESPONSE_SUCCESS', !!(restoreResponse && restoreResponse.success), result.restore_result);

    const spreadsheetAfter = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAfter = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledAfter = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAfter = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAfter = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_after.spreadsheet_appointments = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.status_counts_after.supabase_scheduled = Array.isArray(scheduledAfter) ? scheduledAfter.length : -1;
    result.status_counts_after.supabase_completed = Array.isArray(completedAfter) ? completedAfter.length : -1;
    result.status_counts_after.supabase_cancelled = Array.isArray(cancelledAfter) ? cancelledAfter.length : -1;

    const appointmentAfter = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const openAfter = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenAfter = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    result.readback.by_id = appointmentAfter ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentAfter.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentAfter.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentAfter.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentAfter.appointment_date || appointmentAfter.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentAfter.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentAfter.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentAfter.status)
    } : null;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_UNCHANGED_AFTER_SUPABASE_RESTORE', result.counts_after.spreadsheet_appointments === result.counts_before.spreadsheet_appointments, {
      before_count: result.counts_before.spreadsheet_appointments,
      after_count: result.counts_after.spreadsheet_appointments
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_UNCHANGED_285_AFTER_RESTORE', result.counts_after.supabase_appointments === result.counts_before.supabase_appointments, {
      before_count: result.counts_before.supabase_appointments,
      after_count: result.counts_after.supabase_appointments
    });

    addCheck('SUPABASE_STATUS_COUNTS_AFTER_RESTORE_EXPECTED', (
      result.status_counts_after.supabase_scheduled === 7 &&
      result.status_counts_after.supabase_completed === 255 &&
      result.status_counts_after.supabase_cancelled === 23
    ), {
      before: result.status_counts_before,
      after: result.status_counts_after,
      expected_scheduled_after: 7,
      expected_completed_after: 255,
      expected_cancelled_after: 23
    });

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_RESTORE', !!appointmentAfter, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_STATUS_SCHEDULED_AFTER_RESTORE', !!(
      appointmentAfter &&
      normalizeAppointmentPhase7DStatus_(appointmentAfter.status) === 'scheduled'
    ), {
      readback: result.readback.by_id
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_AFTER_RESTORE', !!(
      Array.isArray(openAfter) &&
      openAfter.length === 1 &&
      hasOpenAfter === true &&
      openAfter.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenAfter,
      open_appointment_count: Array.isArray(openAfter) ? openAfter.length : -1,
      open_appointment_ids: Array.isArray(openAfter)
        ? openAfter.map(function(row) { return row.appointment_id; })
        : []
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-10',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DReadBackRestoredDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-11',
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
    status_counts: {},
    readback: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetRows = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseRows = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledRows = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedRows = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseRows) ? supabaseRows.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledRows) ? scheduledRows.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedRows) ? completedRows.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledRows) ? cancelledRows.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_AFTER_RESTORE_VERIFY', result.counts.spreadsheet_appointments === 322, {
      actual: result.counts.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_AFTER_RESTORE_VERIFY', result.counts.supabase_appointments === 285, {
      actual: result.counts.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_AFTER_RESTORE_VERIFY', (
      result.status_counts.supabase_scheduled === 7 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 7,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_STATUS_TOTAL_MATCH_AFTER_RESTORE_VERIFY', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const appointmentById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const scheduledContainsDummy = Array.isArray(scheduledRows) && scheduledRows.some(function(row) {
      return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
    });

    const cancelledContainsDummy = Array.isArray(cancelledRows) && cancelledRows.some(function(row) {
      return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
    });

    const updatedDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const updatedDateRangeRows = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const selectedPatientId = appointmentById
      ? normalizeAppointmentPhase7DText_(appointmentById.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openForSelectedPatient = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenForSelectedPatient = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    const treatmentsForAppointment = AppointmentRepository.listTreatmentsByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const treatmentForAppointment = AppointmentRepository.findTreatmentByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    result.readback.by_id = appointmentById ? {
      appointment_id: normalizeAppointmentPhase7DText_(appointmentById.appointment_id),
      patient_id: normalizeAppointmentPhase7DText_(appointmentById.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(appointmentById.patient_name),
      appointment_date: normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || ''),
      appointment_time: normalizeAppointmentPhase7DText_(appointmentById.appointment_time),
      complaint: normalizeAppointmentPhase7DText_(appointmentById.complaint),
      status: normalizeAppointmentPhase7DStatus_(appointmentById.status)
    } : null;

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_ID_AFTER_RESTORE_VERIFY', !!appointmentById, {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_FOUND_BY_UPDATED_COMPLAINT_AFTER_RESTORE_VERIFY', !!appointmentByUpdatedComplaint, {
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      exists: !!appointmentByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_STATUS_SCHEDULED_AFTER_RESTORE_VERIFY', !!(
      appointmentById &&
      normalizeAppointmentPhase7DStatus_(appointmentById.status) === 'scheduled'
    ), {
      readback: result.readback.by_id
    });

    addCheck('DUMMY_APPOINTMENT_INCLUDED_IN_SCHEDULED_STATUS_LIST', scheduledContainsDummy, {
      scheduled_count: Array.isArray(scheduledRows) ? scheduledRows.length : -1,
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_NOT_INCLUDED_IN_CANCELLED_STATUS_LIST_AFTER_RESTORE', !cancelledContainsDummy, {
      cancelled_count: Array.isArray(cancelledRows) ? cancelledRows.length : -1,
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_FILTER_HAS_RESTORED_ROW', !!(
      Array.isArray(updatedDateRows) &&
      updatedDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count: Array.isArray(updatedDateRows) ? updatedDateRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_DATE_RANGE_FILTER_HAS_RESTORED_ROW', !!(
      Array.isArray(updatedDateRangeRows) &&
      updatedDateRangeRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_range_count: Array.isArray(updatedDateRangeRows) ? updatedDateRangeRows.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_FOUND_AFTER_RESTORE_VERIFY', !!selectedPatient, {
      selected_patient: result.selected_patient
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_AFTER_RESTORE_VERIFY', !!(
      Array.isArray(openForSelectedPatient) &&
      openForSelectedPatient.length === 1 &&
      hasOpenForSelectedPatient === true &&
      openForSelectedPatient.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenForSelectedPatient,
      open_appointment_count: Array.isArray(openForSelectedPatient) ? openForSelectedPatient.length : -1,
      open_appointment_ids: Array.isArray(openForSelectedPatient)
        ? openForSelectedPatient.map(function(row) { return row.appointment_id; })
        : []
    });

    addCheck('DUMMY_APPOINTMENT_STILL_HAS_NO_TREATMENT_AFTER_RESTORE', Array.isArray(treatmentsForAppointment) && treatmentsForAppointment.length === 0 && !treatmentForAppointment, {
      treatment_count: Array.isArray(treatmentsForAppointment) ? treatmentsForAppointment.length : -1,
      find_treatment_exists: !!treatmentForAppointment
    });

    addCheck('DUMMY_APPOINTMENT_FIELDS_MATCH_AFTER_RESTORE_VERIFY', !!(
      appointmentById &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_id) === selectedPatientId &&
      normalizeAppointmentPhase7DText_(appointmentById.patient_name) === normalizeAppointmentPhase7DText_(selectedPatient && selectedPatient.full_name) &&
      normalizeAppointmentRepositoryYmd_(appointmentById.appointment_date || appointmentById.date || '') === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentById.appointment_time) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_TIME_UPDATED &&
      normalizeAppointmentPhase7DText_(appointmentById.complaint) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED &&
      normalizeAppointmentPhase7DStatus_(appointmentById.status) === 'scheduled'
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
      stage: '7D-11',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DDeleteDummyAppointmentLog() {
  const result = {
    success: true,
    stage: '7D-12',
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
    status_counts_before: {},
    status_counts_after: {},
    delete_result: {},
    selected_patient: {},
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

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7D', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseBefore = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledBefore = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedBefore = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledBefore = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_before.spreadsheet_appointments = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_appointments = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    result.status_counts_before.supabase_scheduled = Array.isArray(scheduledBefore) ? scheduledBefore.length : -1;
    result.status_counts_before.supabase_completed = Array.isArray(completedBefore) ? completedBefore.length : -1;
    result.status_counts_before.supabase_cancelled = Array.isArray(cancelledBefore) ? cancelledBefore.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_BEFORE_DELETE', result.counts_before.spreadsheet_appointments === 322, {
      actual: result.counts_before.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_STILL_285_BEFORE_DELETE', result.counts_before.supabase_appointments === 285, {
      actual: result.counts_before.supabase_appointments,
      expected: 285
    });

    addCheck('SUPABASE_STATUS_COUNTS_BEFORE_DELETE_EXPECTED', (
      result.status_counts_before.supabase_scheduled === 7 &&
      result.status_counts_before.supabase_completed === 255 &&
      result.status_counts_before.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts_before.supabase_scheduled,
      expected_scheduled: 7,
      completed: result.status_counts_before.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts_before.supabase_cancelled,
      expected_cancelled: 23
    });

    const appointmentBefore = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByUpdatedComplaintBefore = findAppointmentPhase7DByField_(
      supabaseBefore,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const selectedPatientId = appointmentBefore
      ? normalizeAppointmentPhase7DText_(appointmentBefore.patient_id)
      : '';

    const selectedPatient = selectedPatientId
      ? AppointmentRepository.findPatientById(selectedPatientId, supabaseOptions)
      : null;

    result.selected_patient = selectedPatient ? {
      patient_id: normalizeAppointmentPhase7DText_(selectedPatient.patient_id),
      patient_name: normalizeAppointmentPhase7DText_(selectedPatient.full_name),
      patient_code: normalizeAppointmentPhase7DText_(selectedPatient.patient_code),
      phone: normalizeAppointmentPhase7DText_(selectedPatient.phone)
    } : null;

    const openBefore = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const treatmentsBefore = AppointmentRepository.listTreatmentsByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const treatmentBefore = AppointmentRepository.findTreatmentByAppointmentId(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    addCheck('DUMMY_APPOINTMENT_EXISTS_SCHEDULED_BEFORE_DELETE', !!(
      appointmentBefore &&
      normalizeAppointmentPhase7DStatus_(appointmentBefore.status) === 'scheduled'
    ), {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      exists: !!appointmentBefore,
      status: appointmentBefore ? appointmentBefore.status : ''
    });

    addCheck('DUMMY_APPOINTMENT_UPDATED_COMPLAINT_EXISTS_BEFORE_DELETE', !!appointmentByUpdatedComplaintBefore, {
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED,
      exists: !!appointmentByUpdatedComplaintBefore
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_ONE_OPEN_BEFORE_DELETE', !!(
      Array.isArray(openBefore) &&
      openBefore.length === 1 &&
      openBefore.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      patient_id: selectedPatientId,
      open_appointment_count: Array.isArray(openBefore) ? openBefore.length : -1,
      open_appointment_ids: Array.isArray(openBefore)
        ? openBefore.map(function(row) { return row.appointment_id; })
        : []
    });

    addCheck('DUMMY_APPOINTMENT_HAS_NO_TREATMENT_BEFORE_DELETE', Array.isArray(treatmentsBefore) && treatmentsBefore.length === 0 && !treatmentBefore, {
      treatment_count: Array.isArray(treatmentsBefore) ? treatmentsBefore.length : -1,
      find_treatment_exists: !!treatmentBefore
    });

    if (
      !appointmentBefore ||
      normalizeAppointmentPhase7DStatus_(appointmentBefore.status) !== 'scheduled' ||
      !appointmentByUpdatedComplaintBefore ||
      !Array.isArray(treatmentsBefore) ||
      treatmentsBefore.length > 0 ||
      treatmentBefore
    ) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const deleteResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.APPOINTMENTS,
      'appointment_id',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      {
        stage: '7D'
      }
    );

    result.delete_result = {
      success: !!(deleteResponse && deleteResponse.success),
      status_code: deleteResponse ? deleteResponse.status_code : null,
      row_count: deleteResponse ? deleteResponse.row_count : null,
      target_table: deleteResponse ? deleteResponse.target_table : ''
    };

    addCheck('DUMMY_APPOINTMENT_DELETE_RESPONSE_SUCCESS', !!(deleteResponse && deleteResponse.success), result.delete_result);

    const spreadsheetAfter = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseAfter = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledAfter = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedAfter = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledAfter = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts_after.spreadsheet_appointments = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_appointments = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.status_counts_after.supabase_scheduled = Array.isArray(scheduledAfter) ? scheduledAfter.length : -1;
    result.status_counts_after.supabase_completed = Array.isArray(completedAfter) ? completedAfter.length : -1;
    result.status_counts_after.supabase_cancelled = Array.isArray(cancelledAfter) ? cancelledAfter.length : -1;

    const appointmentAfter = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByOldComplaintAfter = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentByUpdatedComplaintAfter = findAppointmentPhase7DByField_(
      supabaseAfter,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const oldDateRowsAfter = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const updatedDateRowsAfter = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const updatedDateRangeRowsAfter = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const openAfter = selectedPatientId
      ? AppointmentRepository.listOpenAppointmentsByPatientId(selectedPatientId, '', supabaseOptions)
      : [];

    const hasOpenAfter = selectedPatientId
      ? AppointmentRepository.hasOpenAppointmentForPatient(selectedPatientId, '', supabaseOptions)
      : false;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_UNCHANGED_AFTER_SUPABASE_DELETE', result.counts_after.spreadsheet_appointments === result.counts_before.spreadsheet_appointments, {
      before_count: result.counts_before.spreadsheet_appointments,
      after_count: result.counts_after.spreadsheet_appointments
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_BACK_TO_284_AFTER_DELETE', result.counts_after.supabase_appointments === 284, {
      before_count: result.counts_before.supabase_appointments,
      after_count: result.counts_after.supabase_appointments,
      expected_after_count: 284
    });

    addCheck('SUPABASE_STATUS_COUNTS_BACK_TO_BASELINE_AFTER_DELETE', (
      result.status_counts_after.supabase_scheduled === 6 &&
      result.status_counts_after.supabase_completed === 255 &&
      result.status_counts_after.supabase_cancelled === 23
    ), {
      before: result.status_counts_before,
      after: result.status_counts_after,
      expected_scheduled_after: 6,
      expected_completed_after: 255,
      expected_cancelled_after: 23
    });

    addCheck('DUMMY_APPOINTMENT_NOT_FOUND_AFTER_DELETE', !(
      appointmentAfter ||
      appointmentByOldComplaintAfter ||
      appointmentByUpdatedComplaintAfter
    ), {
      by_id_exists: !!appointmentAfter,
      by_old_complaint_exists: !!appointmentByOldComplaintAfter,
      by_updated_complaint_exists: !!appointmentByUpdatedComplaintAfter
    });

    addCheck('DUMMY_APPOINTMENT_DATE_FILTERS_CLEAN_AFTER_DELETE', !!(
      Array.isArray(oldDateRowsAfter) &&
      Array.isArray(updatedDateRowsAfter) &&
      Array.isArray(updatedDateRangeRowsAfter) &&
      !oldDateRowsAfter.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      !updatedDateRowsAfter.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      !updatedDateRangeRowsAfter.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      old_date_count_after: Array.isArray(oldDateRowsAfter) ? oldDateRowsAfter.length : -1,
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count_after: Array.isArray(updatedDateRowsAfter) ? updatedDateRowsAfter.length : -1,
      updated_date_range_count_after: Array.isArray(updatedDateRangeRowsAfter) ? updatedDateRangeRowsAfter.length : -1
    });

    addCheck('DUMMY_APPOINTMENT_PATIENT_HAS_NO_OPEN_AFTER_DELETE', !!(
      Array.isArray(openAfter) &&
      openAfter.length === 0 &&
      hasOpenAfter === false
    ), {
      patient_id: selectedPatientId,
      has_open_appointment: !!hasOpenAfter,
      open_appointment_count: Array.isArray(openAfter) ? openAfter.length : -1
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-12',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DConfirmCleanupLog() {
  const result = {
    success: true,
    stage: '7D-13',
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
    status_counts: {},
    selected_patient_check: {
      patient_id: 'PAT-0001'
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

    const spreadsheetRows = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseRows = AppointmentRepository.getAppointmentsRaw(supabaseOptions);

    const scheduledRows = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedRows = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseRows) ? supabaseRows.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledRows) ? scheduledRows.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedRows) ? completedRows.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledRows) ? cancelledRows.length : -1;

    addCheck('SPREADSHEET_APPOINTMENT_COUNT_STILL_322_AFTER_CLEANUP', result.counts.spreadsheet_appointments === 322, {
      actual: result.counts.spreadsheet_appointments,
      expected: 322
    });

    addCheck('SUPABASE_APPOINTMENT_COUNT_BACK_TO_BASELINE_284', result.counts.supabase_appointments === 284, {
      actual: result.counts.supabase_appointments,
      expected: 284
    });

    addCheck('SUPABASE_STATUS_COUNTS_BACK_TO_BASELINE_6_255_23', (
      result.status_counts.supabase_scheduled === 6 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_STATUS_TOTAL_MATCH_AFTER_CLEANUP', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const appointmentById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByOldComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const oldDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const updatedDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const updatedDateRangeRows = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    addCheck('DUMMY_APPOINTMENT_FULLY_CLEANED_UP_BY_ID_AND_COMPLAINT', !(
      appointmentById ||
      appointmentByOldComplaint ||
      appointmentByUpdatedComplaint
    ), {
      by_id_exists: !!appointmentById,
      by_old_complaint_exists: !!appointmentByOldComplaint,
      by_updated_complaint_exists: !!appointmentByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_DATE_FILTERS_FULLY_CLEANED_UP', !!(
      Array.isArray(oldDateRows) &&
      Array.isArray(updatedDateRows) &&
      Array.isArray(updatedDateRangeRows) &&
      !oldDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      !updatedDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      !updatedDateRangeRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      old_date_count: Array.isArray(oldDateRows) ? oldDateRows.length : -1,
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count: Array.isArray(updatedDateRows) ? updatedDateRows.length : -1,
      updated_date_range_count: Array.isArray(updatedDateRangeRows) ? updatedDateRangeRows.length : -1
    });

    const testPatientId = result.selected_patient_check.patient_id;

    const patient = AppointmentRepository.findPatientById(testPatientId, supabaseOptions);
    const openForPatient = AppointmentRepository.listOpenAppointmentsByPatientId(testPatientId, '', supabaseOptions);
    const hasOpenForPatient = AppointmentRepository.hasOpenAppointmentForPatient(testPatientId, '', supabaseOptions);

    result.selected_patient_check.patient_found = !!patient;
    result.selected_patient_check.patient_name = patient
      ? normalizeAppointmentPhase7DText_(patient.full_name)
      : '';
    result.selected_patient_check.open_appointment_count = Array.isArray(openForPatient) ? openForPatient.length : -1;
    result.selected_patient_check.has_open_appointment = !!hasOpenForPatient;

    addCheck('TEST_PATIENT_HAS_NO_OPEN_APPOINTMENT_AFTER_CLEANUP', !!(
      patient &&
      Array.isArray(openForPatient) &&
      openForPatient.length === 0 &&
      hasOpenForPatient === false
    ), result.selected_patient_check);

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.APPOINTMENTS, {
        appointment_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7D-CLEANUP'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_AFTER_7D_MUTATION', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7D-13',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testAppointmentPhase7DFinalAuditLog() {
  const result = {
    success: true,
    stage: '7D-15',
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
    status_counts: {},
    schema_alignment: {
      column_count: 0,
      missing_from_supabase: [],
      extra_in_supabase: []
    },
    test_appointment: {
      appointment_id: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      old_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT,
      updated_complaint: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    },
    selected_patient_check: {
      patient_id: 'PAT-0001'
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

    const spreadsheetRows = AppointmentRepository.getAppointmentsRaw(spreadsheetOptions);
    const supabaseRows = AppointmentRepository.getAppointmentsRaw(supabaseOptions);
    const supabasePatients = AppointmentRepository.getPatientsRaw(supabaseOptions);
    const supabaseTreatments = AppointmentRepository.getTreatmentsRaw(supabaseOptions);

    const scheduledRows = AppointmentRepository.listAppointmentsByStatus('scheduled', supabaseOptions);
    const completedRows = AppointmentRepository.listAppointmentsByStatus('completed', supabaseOptions);
    const cancelledRows = AppointmentRepository.listAppointmentsByStatus('cancelled', supabaseOptions);

    result.counts.spreadsheet_appointments = Array.isArray(spreadsheetRows) ? spreadsheetRows.length : -1;
    result.counts.supabase_appointments = Array.isArray(supabaseRows) ? supabaseRows.length : -1;
    result.counts.supabase_patients = Array.isArray(supabasePatients) ? supabasePatients.length : -1;
    result.counts.supabase_treatments = Array.isArray(supabaseTreatments) ? supabaseTreatments.length : -1;

    result.status_counts.supabase_scheduled = Array.isArray(scheduledRows) ? scheduledRows.length : -1;
    result.status_counts.supabase_completed = Array.isArray(completedRows) ? completedRows.length : -1;
    result.status_counts.supabase_cancelled = Array.isArray(cancelledRows) ? cancelledRows.length : -1;

    addCheck('SPREADSHEET_APPOINTMENTS_STILL_READABLE', Array.isArray(spreadsheetRows) && result.counts.spreadsheet_appointments >= 322, {
      actual: result.counts.spreadsheet_appointments,
      expected_minimum: 322,
      note: 'Spreadsheet production bisa bertambah jika admin klinik menambah appointment setelah snapshot staging.'
    });

    addCheck('SUPABASE_APPOINTMENTS_BACK_TO_BASELINE_284', result.counts.supabase_appointments === 284, {
      actual: result.counts.supabase_appointments,
      expected: 284
    });

    addCheck('SUPABASE_PATIENTS_STILL_BASELINE_285', result.counts.supabase_patients === 285, {
      actual: result.counts.supabase_patients,
      expected: 285
    });

    addCheck('SUPABASE_TREATMENTS_STILL_BASELINE_254', result.counts.supabase_treatments === 254, {
      actual: result.counts.supabase_treatments,
      expected: 254
    });

    addCheck('SUPABASE_STATUS_COUNTS_FINAL_BASELINE_6_255_23', (
      result.status_counts.supabase_scheduled === 6 &&
      result.status_counts.supabase_completed === 255 &&
      result.status_counts.supabase_cancelled === 23
    ), {
      scheduled: result.status_counts.supabase_scheduled,
      expected_scheduled: 6,
      completed: result.status_counts.supabase_completed,
      expected_completed: 255,
      cancelled: result.status_counts.supabase_cancelled,
      expected_cancelled: 23
    });

    addCheck('SUPABASE_STATUS_TOTAL_MATCH_FINAL', (
      result.counts.supabase_appointments ===
      result.status_counts.supabase_scheduled +
      result.status_counts.supabase_completed +
      result.status_counts.supabase_cancelled
    ), {
      appointment_count: result.counts.supabase_appointments,
      scheduled: result.status_counts.supabase_scheduled,
      completed: result.status_counts.supabase_completed,
      cancelled: result.status_counts.supabase_cancelled
    });

    const schemaPatient = AppointmentRepository.findPatientById('PAT-0001', supabaseOptions) ||
      (Array.isArray(supabasePatients) && supabasePatients.length ? supabasePatients[0] : null);

    const payload = buildAppointmentPhase7DTestAppointmentPayload_(schemaPatient);

    if (Array.isArray(supabaseRows) && supabaseRows.length) {
      const sampleColumns = Object.keys(supabaseRows[0] || {}).sort();
      const payloadColumns = Object.keys(payload || {}).sort();

      result.schema_alignment.column_count = sampleColumns.length;
      result.schema_alignment.missing_from_supabase = payloadColumns.filter(function(key) {
        return sampleColumns.indexOf(key) === -1;
      });

      result.schema_alignment.extra_in_supabase = sampleColumns.filter(function(key) {
        return payloadColumns.indexOf(key) === -1;
      });
    }

    addCheck('APPOINTMENT_SUPABASE_SCHEMA_ALIGNED_WITH_APP_PAYLOAD_FINAL', result.schema_alignment.missing_from_supabase.length === 0, {
      missing_from_supabase: result.schema_alignment.missing_from_supabase,
      extra_in_supabase: result.schema_alignment.extra_in_supabase
    });

    const appointmentById = AppointmentRepository.findAppointmentById(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID,
      supabaseOptions
    );

    const appointmentByOldComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT
    );

    const appointmentByUpdatedComplaint = findAppointmentPhase7DByField_(
      supabaseRows,
      'complaint',
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.COMPLAINT_UPDATED
    );

    const oldDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      supabaseOptions
    );

    const updatedDateRows = AppointmentRepository.listAppointmentsByDate(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    const updatedDateRangeRows = AppointmentRepository.listAppointmentsByDateRange(
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      supabaseOptions
    );

    addCheck('DUMMY_APPOINTMENT_FULLY_CLEANED_UP_FINAL', !(
      appointmentById ||
      appointmentByOldComplaint ||
      appointmentByUpdatedComplaint
    ), {
      by_id_exists: !!appointmentById,
      by_old_complaint_exists: !!appointmentByOldComplaint,
      by_updated_complaint_exists: !!appointmentByUpdatedComplaint
    });

    addCheck('DUMMY_APPOINTMENT_DATE_FILTERS_CLEAN_FINAL', !!(
      Array.isArray(oldDateRows) &&
      Array.isArray(updatedDateRows) &&
      Array.isArray(updatedDateRangeRows) &&
      !oldDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      !updatedDateRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      }) &&
      !updatedDateRangeRows.some(function(row) {
        return normalizeAppointmentPhase7DText_(row.appointment_id) === APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_ID;
      })
    ), {
      old_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE,
      old_date_count: Array.isArray(oldDateRows) ? oldDateRows.length : -1,
      updated_date: APPOINTMENT_PHASE_7D_TEST_APPOINTMENT.APPOINTMENT_DATE_UPDATED,
      updated_date_count: Array.isArray(updatedDateRows) ? updatedDateRows.length : -1,
      updated_date_range_count: Array.isArray(updatedDateRangeRows) ? updatedDateRangeRows.length : -1
    });

    const testPatientId = result.selected_patient_check.patient_id;
    const testPatient = AppointmentRepository.findPatientById(testPatientId, supabaseOptions);
    const openForTestPatient = AppointmentRepository.listOpenAppointmentsByPatientId(testPatientId, '', supabaseOptions);
    const hasOpenForTestPatient = AppointmentRepository.hasOpenAppointmentForPatient(testPatientId, '', supabaseOptions);

    result.selected_patient_check.patient_found = !!testPatient;
    result.selected_patient_check.patient_name = testPatient
      ? normalizeAppointmentPhase7DText_(testPatient.full_name)
      : '';
    result.selected_patient_check.open_appointment_count = Array.isArray(openForTestPatient) ? openForTestPatient.length : -1;
    result.selected_patient_check.has_open_appointment = !!hasOpenForTestPatient;

    addCheck('TEST_PATIENT_HAS_NO_OPEN_APPOINTMENT_FINAL', !!(
      testPatient &&
      Array.isArray(openForTestPatient) &&
      openForTestPatient.length === 0 &&
      hasOpenForTestPatient === false
    ), result.selected_patient_check);

    const guardCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7D',
      table_name: REPO_TABLES.APPOINTMENTS,
      operation: 'FINAL_7D_WRITE_GUARD_CHECK'
    });

    addCheck('WRITE_GUARD_BLOCKS_AFTER_FLAG_FALSE_FINAL', guardCheck.allowed === false, {
      allowed: guardCheck.allowed,
      message: guardCheck.message
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.APPOINTMENTS, {
        appointment_id: 'TEST-7D-FINAL-OLD-DBINSERT-SHOULD-NOT-INSERT'
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
      stage: '7D-15',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}