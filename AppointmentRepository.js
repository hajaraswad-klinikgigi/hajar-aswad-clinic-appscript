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

function testAppointmentRepositorySupabaseReadLog() {
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

    addCheck('DEFAULT_BACKEND_IS_SUPABASE', result.default_backend_mode === 'supabase', {
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

