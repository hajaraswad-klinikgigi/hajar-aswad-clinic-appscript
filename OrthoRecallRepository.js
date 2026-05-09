/* =========================================================
   ORTHO RECALL REPOSITORY
   Tahap 4C - Repository Layer Read-Only
   Backend saat ini tetap Spreadsheet via DataAccess.gs
   ========================================================= */

/**
 * OrthoRecallRepository adalah layer baca data OrthoRecall dan relasi dasarnya.
 *
 * Catatan penting:
 * - Tahap 4C hanya read-only.
 * - Belum mengganti OrthoRecallService.gs.
 * - Belum mengubah endpoint frontend.
 * - Belum mengubah business logic.
 * - Belum menyentuh save contact / complete / cancel / sync recall.
 * - Semua data masih berasal dari Spreadsheet melalui DataAccess.gs.
 */

const ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS = Object.freeze({
  ORTHO_RECALL: 'orthoRecall',
  PATIENTS: 'patients',
  TREATMENTS: 'treatments'
});

const OrthoRecallRepository = Object.freeze({
  getOrthoRecallRaw: function(options) {
    return dbFindAll_(REPO_TABLES.ORTHO_RECALL, options);
  },

  getPatientsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.PATIENTS, options);
  },

  getTreatmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.TREATMENTS, options);
  },

  findOrthoRecallById: function(orthoRecallId, options) {
    return dbFindById_(
      REPO_TABLES.ORTHO_RECALL,
      repoGetPrimaryKeyForTable_(REPO_TABLES.ORTHO_RECALL),
      orthoRecallId,
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

  findTreatmentById: function(treatmentId, options) {
    return dbFindById_(
      REPO_TABLES.TREATMENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.TREATMENTS),
      treatmentId,
      options
    );
  },

  listRecallByPatientId: function(patientId, options) {
    const normalizedPatientId = normalizeOrthoRecallRepositoryKeyValue_(patientId);

    if (!normalizedPatientId) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    }, options);
  },

  findActiveRecallByPatientId: function(patientId, options) {
    const rows = this.listRecallByPatientId(patientId, options);

    return rows.find(function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.program_status) === 'active';
    }) || null;
  },

  listActiveRecall: function(options) {
    return this.getOrthoRecallRaw(options).filter(function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.program_status) === 'active';
    });
  },

  listRecallByProgramStatus: function(programStatus, options) {
    const normalizedStatus = normalizeOrthoRecallRepositoryStatus_(programStatus);

    if (!normalizedStatus) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.program_status) === normalizedStatus;
    }, options);
  },

  listRecallByFollowupStatus: function(followupStatus, options) {
    const normalizedStatus = normalizeOrthoRecallRepositoryStatus_(followupStatus);

    if (!normalizedStatus) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.followup_status) === normalizedStatus;
    }, options);
  },

  listRecallDueOnDate: function(ymd, options) {
    const normalizedDate = normalizeOrthoRecallRepositoryYmd_(ymd);

    if (!normalizedDate) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      return normalizeOrthoRecallRepositoryYmd_(row.next_due_date || '') === normalizedDate;
    }, options);
  },

  listRecallDueBeforeDate: function(ymd, options) {
    const normalizedDate = normalizeOrthoRecallRepositoryYmd_(ymd);

    if (!normalizedDate) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      const dueDate = normalizeOrthoRecallRepositoryYmd_(row.next_due_date || '');

      if (!dueDate) return false;

      return dueDate < normalizedDate;
    }, options);
  },

  listRecallDueAfterDate: function(ymd, options) {
    const normalizedDate = normalizeOrthoRecallRepositoryYmd_(ymd);

    if (!normalizedDate) return [];

    return dbFindWhere_(REPO_TABLES.ORTHO_RECALL, function(row) {
      const dueDate = normalizeOrthoRecallRepositoryYmd_(row.next_due_date || '');

      if (!dueDate) return false;

      return dueDate > normalizedDate;
    }, options);
  },

  findInstallTreatmentForRecall: function(recallRow, options) {
    const row = recallRow || {};
    const treatmentId = normalizeOrthoRecallRepositoryKeyValue_(row.install_treatment_id);

    if (!treatmentId) return null;

    return this.findTreatmentById(treatmentId, options);
  },

  findLastControlTreatmentForRecall: function(recallRow, options) {
    const row = recallRow || {};
    const treatmentId = normalizeOrthoRecallRepositoryKeyValue_(row.last_control_treatment_id);

    if (!treatmentId) return null;

    return this.findTreatmentById(treatmentId, options);
  },

  buildRawContext: function(options) {
    return buildOrthoRecallRepositoryRawContext_(options || {});
  },

  getRawContextRows: function(ctx, key) {
    return getOrthoRecallRepositoryRawContextRows_(ctx, key);
  },

  findOrthoRecallByIdFromContext: function(ctx, orthoRecallId) {
    return findOrthoRecallRepositoryRecallByIdFromContext_(ctx, orthoRecallId);
  },

  findPatientByIdFromContext: function(ctx, patientId) {
    return findOrthoRecallRepositoryPatientByIdFromContext_(ctx, patientId);
  },

  findTreatmentByIdFromContext: function(ctx, treatmentId) {
    return findOrthoRecallRepositoryTreatmentByIdFromContext_(ctx, treatmentId);
  },

  listRecallByPatientIdFromContext: function(ctx, patientId) {
    return listOrthoRecallRepositoryRowsByPatientIdFromContext_(ctx, patientId);
  },

  findActiveRecallByPatientIdFromContext: function(ctx, patientId) {
    const rows = this.listRecallByPatientIdFromContext(ctx, patientId);

    return rows.find(function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.program_status) === 'active';
    }) || null;
  },

  listActiveRecallFromContext: function(ctx) {
    return getOrthoRecallRepositoryRawContextRows_(
      ctx,
      ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL
    ).filter(function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.program_status) === 'active';
    });
  },

  listRecallByProgramStatusFromContext: function(ctx, programStatus) {
    const normalizedStatus = normalizeOrthoRecallRepositoryStatus_(programStatus);

    if (!normalizedStatus) return [];

    return getOrthoRecallRepositoryRawContextRows_(
      ctx,
      ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL
    ).filter(function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.program_status) === normalizedStatus;
    });
  },

  listRecallByFollowupStatusFromContext: function(ctx, followupStatus) {
    const normalizedStatus = normalizeOrthoRecallRepositoryStatus_(followupStatus);

    if (!normalizedStatus) return [];

    return getOrthoRecallRepositoryRawContextRows_(
      ctx,
      ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL
    ).filter(function(row) {
      return normalizeOrthoRecallRepositoryStatus_(row.followup_status) === normalizedStatus;
    });
  },

  findInstallTreatmentForRecallFromContext: function(ctx, recallRow) {
    const row = recallRow || {};
    const treatmentId = normalizeOrthoRecallRepositoryKeyValue_(row.install_treatment_id);

    if (!treatmentId) return null;

    return this.findTreatmentByIdFromContext(ctx, treatmentId);
  },

  findLastControlTreatmentForRecallFromContext: function(ctx, recallRow) {
    const row = recallRow || {};
    const treatmentId = normalizeOrthoRecallRepositoryKeyValue_(row.last_control_treatment_id);

    if (!treatmentId) return null;

    return this.findTreatmentByIdFromContext(ctx, treatmentId);
  }
});

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function normalizeOrthoRecallRepositoryKeyValue_(value) {
  return String(value || '').trim();
}

function normalizeOrthoRecallRepositoryStatus_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeOrthoRecallRepositoryYmd_(value) {
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

function shouldOrthoRecallRepositoryLoadContextKey_(only, key) {
  const config = only || {};
  const keys = Object.keys(config);

  if (!keys.length) {
    return true;
  }

  return config[key] === true;
}

function buildOrthoRecallRepositoryRawContext_(options) {
  const opts = options || {};
  const only = opts.only || {};

  const ctx = {
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_(opts)
      : 'spreadsheet',

    loaded_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),

    orthoRecall: [],
    patients: [],
    treatments: []
  };

  if (shouldOrthoRecallRepositoryLoadContextKey_(only, ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL)) {
    ctx.orthoRecall = OrthoRecallRepository.getOrthoRecallRaw(opts);
  }

  if (shouldOrthoRecallRepositoryLoadContextKey_(only, ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.PATIENTS)) {
    ctx.patients = OrthoRecallRepository.getPatientsRaw(opts);
  }

  if (shouldOrthoRecallRepositoryLoadContextKey_(only, ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.TREATMENTS)) {
    ctx.treatments = OrthoRecallRepository.getTreatmentsRaw(opts);
  }

  return ctx;
}

function getOrthoRecallRepositoryRawContextRows_(ctx, key) {
  const context = ctx || {};
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) return [];

  if (Array.isArray(context[normalizedKey])) {
    return context[normalizedKey];
  }

  const aliases = {
    OrthoRecall: 'orthoRecall',
    Patients: 'patients',
    Treatments: 'treatments',

    orthoRecallRaw: 'orthoRecall',
    recalls: 'orthoRecall',
    patientsRaw: 'patients',
    treatmentsRaw: 'treatments'
  };

  const mappedKey = aliases[normalizedKey];

  if (mappedKey && Array.isArray(context[mappedKey])) {
    return context[mappedKey];
  }

  return [];
}

function findOrthoRecallRepositoryRecallByIdFromContext_(ctx, orthoRecallId) {
  const normalizedRecallId = normalizeOrthoRecallRepositoryKeyValue_(orthoRecallId);

  if (!normalizedRecallId) return null;

  return getOrthoRecallRepositoryRawContextRows_(
    ctx,
    ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL
  ).find(function(row) {
    return String(row.ortho_recall_id || '').trim() === normalizedRecallId;
  }) || null;
}

function findOrthoRecallRepositoryPatientByIdFromContext_(ctx, patientId) {
  const normalizedPatientId = normalizeOrthoRecallRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return null;

  return getOrthoRecallRepositoryRawContextRows_(
    ctx,
    ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.PATIENTS
  ).find(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  }) || null;
}

function findOrthoRecallRepositoryTreatmentByIdFromContext_(ctx, treatmentId) {
  const normalizedTreatmentId = normalizeOrthoRecallRepositoryKeyValue_(treatmentId);

  if (!normalizedTreatmentId) return null;

  return getOrthoRecallRepositoryRawContextRows_(
    ctx,
    ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.TREATMENTS
  ).find(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  }) || null;
}

function listOrthoRecallRepositoryRowsByPatientIdFromContext_(ctx, patientId) {
  const normalizedPatientId = normalizeOrthoRecallRepositoryKeyValue_(patientId);

  if (!normalizedPatientId) return [];

  return getOrthoRecallRepositoryRawContextRows_(
    ctx,
    ORTHO_RECALL_REPOSITORY_CONTEXT_KEYS.ORTHO_RECALL
  ).filter(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  });
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testOrthoRecallRepositoryPhase4CReadOnly() {
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
    const recalls = OrthoRecallRepository.getOrthoRecallRaw();
    const patients = OrthoRecallRepository.getPatientsRaw();
    const treatments = OrthoRecallRepository.getTreatmentsRaw();

    const activeRecall = OrthoRecallRepository.listActiveRecall();
    const completedRecall = OrthoRecallRepository.listRecallByProgramStatus('completed');
    const cancelledRecall = OrthoRecallRepository.listRecallByProgramStatus('cancelled');

    const dueRecall = OrthoRecallRepository.listRecallByFollowupStatus('due');
    const overdueRecall = OrthoRecallRepository.listRecallByFollowupStatus('overdue');
    const upcomingRecall = OrthoRecallRepository.listRecallByFollowupStatus('upcoming');

    result.counts.orthoRecall = Array.isArray(recalls) ? recalls.length : -1;
    result.counts.patients = Array.isArray(patients) ? patients.length : -1;
    result.counts.treatments = Array.isArray(treatments) ? treatments.length : -1;
    result.counts.activeRecall = Array.isArray(activeRecall) ? activeRecall.length : -1;
    result.counts.completedRecall = Array.isArray(completedRecall) ? completedRecall.length : -1;
    result.counts.cancelledRecall = Array.isArray(cancelledRecall) ? cancelledRecall.length : -1;
    result.counts.dueRecall = Array.isArray(dueRecall) ? dueRecall.length : -1;
    result.counts.overdueRecall = Array.isArray(overdueRecall) ? overdueRecall.length : -1;
    result.counts.upcomingRecall = Array.isArray(upcomingRecall) ? upcomingRecall.length : -1;

    [
      { key: 'orthoRecall', rows: recalls },
      { key: 'patients', rows: patients },
      { key: 'treatments', rows: treatments },
      { key: 'activeRecall', rows: activeRecall },
      { key: 'completedRecall', rows: completedRecall },
      { key: 'cancelledRecall', rows: cancelledRecall },
      { key: 'dueRecall', rows: dueRecall },
      { key: 'overdueRecall', rows: overdueRecall },
      { key: 'upcomingRecall', rows: upcomingRecall }
    ].forEach(function(item) {
      if (!Array.isArray(item.rows)) {
        result.issues.push({
          dataset: item.key,
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

function testOrthoRecallRepositoryPhase4CBuildRawContext() {
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
    const ctx = OrthoRecallRepository.buildRawContext({
      only: {
        orthoRecall: true,
        patients: true
      }
    });

    const expectedArrays = [
      'orthoRecall',
      'patients'
    ];

    expectedArrays.forEach(function(key) {
      const rows = OrthoRecallRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : -1;

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
      const rows = OrthoRecallRepository.getRawContextRows(ctx, key);

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
      'OrthoRecall',
      'orthoRecallRaw',
      'recalls',
      'Patients',
      'patientsRaw'
    ];

    aliases.forEach(function(alias) {
      const rows = OrthoRecallRepository.getRawContextRows(ctx, alias);

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

function testOrthoRecallRepositoryPhase4CFindRecallSample() {
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
    const recalls = OrthoRecallRepository.getOrthoRecallRaw();
    const firstRecall = recalls.length ? recalls[0] : null;

    const recallId = firstRecall
      ? String(firstRecall.ortho_recall_id || '').trim()
      : '';

    const patientId = firstRecall
      ? String(firstRecall.patient_id || '').trim()
      : '';

    const installTreatmentId = firstRecall
      ? String(firstRecall.install_treatment_id || '').trim()
      : '';

    const lastControlTreatmentId = firstRecall
      ? String(firstRecall.last_control_treatment_id || '').trim()
      : '';

    result.sample.recall_count = recalls.length;
    result.sample.first_recall_id = recallId;
    result.sample.first_patient_id = patientId;
    result.sample.install_treatment_id = installTreatmentId;
    result.sample.last_control_treatment_id = lastControlTreatmentId;

    if (!recallId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada data OrthoRecall untuk sample test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundRecall = OrthoRecallRepository.findOrthoRecallById(recallId);
    const foundPatient = patientId
      ? OrthoRecallRepository.findPatientById(patientId)
      : null;

    const recallsByPatient = patientId
      ? OrthoRecallRepository.listRecallByPatientId(patientId)
      : [];

    const activeRecall = patientId
      ? OrthoRecallRepository.findActiveRecallByPatientId(patientId)
      : null;

    const installTreatment = installTreatmentId
      ? OrthoRecallRepository.findTreatmentById(installTreatmentId)
      : null;

    const lastControlTreatment = lastControlTreatmentId
      ? OrthoRecallRepository.findTreatmentById(lastControlTreatmentId)
      : null;

    result.sample.find_recall_ok = !!foundRecall;
    result.sample.find_patient_ok = patientId ? !!foundPatient : true;
    result.sample.recall_by_patient_count = recallsByPatient.length;
    result.sample.has_active_recall = !!activeRecall;

    result.sample.install_treatment_checked = !!installTreatmentId;
    result.sample.install_treatment_found = installTreatmentId ? !!installTreatment : true;

    result.sample.last_control_treatment_checked = !!lastControlTreatmentId;
    result.sample.last_control_treatment_found = lastControlTreatmentId ? !!lastControlTreatment : true;

    if (!foundRecall) {
      result.issues.push({
        ortho_recall_id: recallId,
        issue: 'FIND_RECALL_BY_ID_FAILED'
      });
    }

    if (patientId && !foundPatient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_BY_ID_FAILED'
      });
    }

    /*
     * Catatan:
     * install_treatment_id / last_control_treatment_id bisa kosong.
     * Pada audit Tahap 1, ada missing parent manual test artifact.
     * Karena itu missing treatment tidak langsung dianggap error di repository read-only.
     */
    if (installTreatmentId && !installTreatment) {
      result.sample.install_treatment_missing_parent_note = true;
    }

    if (lastControlTreatmentId && !lastControlTreatment) {
      result.sample.last_control_treatment_missing_parent_note = true;
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

function testOrthoRecallRepositoryPhase4CContextFinderSample() {
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
    const ctx = OrthoRecallRepository.buildRawContext({
      only: {
        orthoRecall: true,
        patients: true,
        treatments: true
      }
    });

    const recalls = OrthoRecallRepository.getRawContextRows(ctx, 'orthoRecall');
    const firstRecall = recalls.length ? recalls[0] : null;

    const recallId = firstRecall
      ? String(firstRecall.ortho_recall_id || '').trim()
      : '';

    const patientId = firstRecall
      ? String(firstRecall.patient_id || '').trim()
      : '';

    result.sample.recall_count = recalls.length;
    result.sample.first_recall_id = recallId;
    result.sample.first_patient_id = patientId;

    if (!recallId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada OrthoRecall untuk context finder test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const recall = OrthoRecallRepository.findOrthoRecallByIdFromContext(ctx, recallId);
    const patient = patientId
      ? OrthoRecallRepository.findPatientByIdFromContext(ctx, patientId)
      : null;

    const recallsByPatient = patientId
      ? OrthoRecallRepository.listRecallByPatientIdFromContext(ctx, patientId)
      : [];

    const activeRecall = patientId
      ? OrthoRecallRepository.findActiveRecallByPatientIdFromContext(ctx, patientId)
      : null;

    const activeRecallRows = OrthoRecallRepository.listActiveRecallFromContext(ctx);
    const dueRows = OrthoRecallRepository.listRecallByFollowupStatusFromContext(ctx, 'due');
    const overdueRows = OrthoRecallRepository.listRecallByFollowupStatusFromContext(ctx, 'overdue');
    const upcomingRows = OrthoRecallRepository.listRecallByFollowupStatusFromContext(ctx, 'upcoming');

    const installTreatment = OrthoRecallRepository.findInstallTreatmentForRecallFromContext(ctx, firstRecall);
    const lastControlTreatment = OrthoRecallRepository.findLastControlTreatmentForRecallFromContext(ctx, firstRecall);

    result.sample.find_recall_ok = !!recall;
    result.sample.find_patient_ok = patientId ? !!patient : true;
    result.sample.recall_by_patient_count = recallsByPatient.length;
    result.sample.has_active_recall = !!activeRecall;
    result.sample.active_recall_count = activeRecallRows.length;
    result.sample.due_count = dueRows.length;
    result.sample.overdue_count = overdueRows.length;
    result.sample.upcoming_count = upcomingRows.length;

    result.sample.install_treatment_found_or_not_required =
      !String(firstRecall.install_treatment_id || '').trim() || !!installTreatment;

    result.sample.last_control_treatment_found_or_not_required =
      !String(firstRecall.last_control_treatment_id || '').trim() || !!lastControlTreatment;

    if (!recall) {
      result.issues.push({
        ortho_recall_id: recallId,
        issue: 'FIND_RECALL_FROM_CONTEXT_FAILED'
      });
    }

    if (patientId && !patient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_FROM_CONTEXT_FAILED'
      });
    }

    /*
     * Missing parent treatment tidak dijadikan blocker di 4C karena ada
     * known manual test artifact dari audit database sebelumnya.
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

function testOrthoRecallRepositoryPhase6FSupabaseReadOnlyLog() {
  const result = {
    success: true,
    stage: '6F-OrthoRecall',
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

    const recalls = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    const patients = OrthoRecallRepository.getPatientsRaw(supabaseOptions);
    const treatments = OrthoRecallRepository.getTreatmentsRaw(supabaseOptions);

    const activeRecall = OrthoRecallRepository.listActiveRecall(supabaseOptions);
    const completedRecall = OrthoRecallRepository.listRecallByProgramStatus('completed', supabaseOptions);
    const cancelledRecall = OrthoRecallRepository.listRecallByProgramStatus('cancelled', supabaseOptions);

    const dueRecall = OrthoRecallRepository.listRecallByFollowupStatus('due', supabaseOptions);
    const overdueRecall = OrthoRecallRepository.listRecallByFollowupStatus('overdue', supabaseOptions);
    const upcomingRecall = OrthoRecallRepository.listRecallByFollowupStatus('upcoming', supabaseOptions);

    addCheck('SUPABASE_ORTHO_RECALL_DATASETS_ARRAY', Array.isArray(recalls) && Array.isArray(patients) && Array.isArray(treatments), {
      ortho_recall_count: Array.isArray(recalls) ? recalls.length : -1,
      patient_count: Array.isArray(patients) ? patients.length : -1,
      treatment_count: Array.isArray(treatments) ? treatments.length : -1
    });

    addCheck('SUPABASE_ORTHO_RECALL_STATUS_ARRAYS', Array.isArray(activeRecall) && Array.isArray(completedRecall) && Array.isArray(cancelledRecall), {
      active_count: Array.isArray(activeRecall) ? activeRecall.length : -1,
      completed_count: Array.isArray(completedRecall) ? completedRecall.length : -1,
      cancelled_count: Array.isArray(cancelledRecall) ? cancelledRecall.length : -1
    });

    addCheck('SUPABASE_ORTHO_RECALL_FOLLOWUP_ARRAYS', Array.isArray(dueRecall) && Array.isArray(overdueRecall) && Array.isArray(upcomingRecall), {
      due_count: Array.isArray(dueRecall) ? dueRecall.length : -1,
      overdue_count: Array.isArray(overdueRecall) ? overdueRecall.length : -1,
      upcoming_count: Array.isArray(upcomingRecall) ? upcomingRecall.length : -1
    });

    const firstRecall = recalls.length ? recalls[0] : null;
    const firstRecallId = firstRecall ? String(firstRecall.ortho_recall_id || '').trim() : '';
    const firstPatientId = firstRecall ? String(firstRecall.patient_id || '').trim() : '';
    const firstDueDate = firstRecall ? normalizeOrthoRecallRepositoryYmd_(firstRecall.next_due_date || '') : '';

    addCheck('SUPABASE_ORTHO_RECALL_SAMPLE_AVAILABLE', !!firstRecallId, {
      recall_count: recalls.length,
      first_recall_id: firstRecallId,
      first_patient_id: firstPatientId,
      first_due_date: firstDueDate
    });

    if (firstRecallId) {
      const foundRecall = OrthoRecallRepository.findOrthoRecallById(firstRecallId, supabaseOptions);
      const foundPatient = firstPatientId
        ? OrthoRecallRepository.findPatientById(firstPatientId, supabaseOptions)
        : null;

      const recallByPatient = firstPatientId
        ? OrthoRecallRepository.listRecallByPatientId(firstPatientId, supabaseOptions)
        : [];

      const activeRecallByPatient = firstPatientId
        ? OrthoRecallRepository.findActiveRecallByPatientId(firstPatientId, supabaseOptions)
        : null;

      const installTreatment = OrthoRecallRepository.findInstallTreatmentForRecall(firstRecall, supabaseOptions);
      const lastControlTreatment = OrthoRecallRepository.findLastControlTreatmentForRecall(firstRecall, supabaseOptions);

      addCheck('SUPABASE_ORTHO_RECALL_FIND_BY_ID', !!foundRecall, {
        ortho_recall_id: firstRecallId
      });

      addCheck('SUPABASE_ORTHO_RECALL_FIND_PATIENT_BY_ID', firstPatientId ? !!foundPatient : true, {
        patient_id: firstPatientId
      });

      addCheck('SUPABASE_ORTHO_RECALL_LIST_RELATED_ROWS', true, {
        patient_id: firstPatientId,
        recall_by_patient_count: recallByPatient.length,
        has_active_recall: !!activeRecallByPatient,
        install_treatment_found_or_not_required: !String(firstRecall.install_treatment_id || '').trim() || !!installTreatment,
        last_control_treatment_found_or_not_required: !String(firstRecall.last_control_treatment_id || '').trim() || !!lastControlTreatment
      });

      if (firstDueDate) {
        const dueOnDate = OrthoRecallRepository.listRecallDueOnDate(firstDueDate, supabaseOptions);
        const dueBeforeDate = OrthoRecallRepository.listRecallDueBeforeDate(firstDueDate, supabaseOptions);
        const dueAfterDate = OrthoRecallRepository.listRecallDueAfterDate(firstDueDate, supabaseOptions);

        addCheck('SUPABASE_ORTHO_RECALL_DUE_DATE_FILTERS_ARRAY', Array.isArray(dueOnDate) && Array.isArray(dueBeforeDate) && Array.isArray(dueAfterDate), {
          due_date: firstDueDate,
          due_on_count: Array.isArray(dueOnDate) ? dueOnDate.length : -1,
          due_before_count: Array.isArray(dueBeforeDate) ? dueBeforeDate.length : -1,
          due_after_count: Array.isArray(dueAfterDate) ? dueAfterDate.length : -1
        });
      }
    }

    const ctx = OrthoRecallRepository.buildRawContext({
      backend_mode: 'supabase',
      only: {
        orthoRecall: true,
        patients: true,
        treatments: true
      }
    });

    addCheck('SUPABASE_ORTHO_RECALL_CONTEXT_BACKEND_MODE', ctx.backend_mode === 'supabase', {
      actual: ctx.backend_mode
    });

    addCheck('SUPABASE_ORTHO_RECALL_CONTEXT_ROWS_ARRAY', Array.isArray(ctx.orthoRecall) && Array.isArray(ctx.patients) && Array.isArray(ctx.treatments), {
      ortho_recall_count: Array.isArray(ctx.orthoRecall) ? ctx.orthoRecall.length : -1,
      patient_count: Array.isArray(ctx.patients) ? ctx.patients.length : -1,
      treatment_count: Array.isArray(ctx.treatments) ? ctx.treatments.length : -1
    });

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

    addCheck('SUPABASE_ORTHO_RECALL_WRITE_STILL_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6F-OrthoRecall',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallRepositoryPhase6FSpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6F-OrthoRecall',
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
    addTest('testOrthoRecallRepositoryPhase4CReadOnly', testOrthoRecallRepositoryPhase4CReadOnly());
    addTest('testOrthoRecallRepositoryPhase4CBuildRawContext', testOrthoRecallRepositoryPhase4CBuildRawContext());
    addTest('testOrthoRecallRepositoryPhase4CFindRecallSample', testOrthoRecallRepositoryPhase4CFindRecallSample());
    addTest('testOrthoRecallRepositoryPhase4CContextFinderSample', testOrthoRecallRepositoryPhase4CContextFinderSample());

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6F-OrthoRecall',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FPreflightLog() {
  const result = {
    success: true,
    stage: '7F-1-OrthoRecall-Preflight',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    baseline: {},
    status_counts: {},
    selected_target: {},
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

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function isTruthyValue(value) {
    if (value === true) return true;
    if (value === 1) return true;

    const text = String(value || '').trim().toLowerCase();
    return text === 'true' ||
      text === '1' ||
      text === 'yes' ||
      text === 'ya' ||
      text === 'aktif' ||
      text === 'active';
  }

  function buildIndexByField(rows, fieldName) {
    const index = {};

    (rows || []).forEach(function(row) {
      const key = normalizeKey(row && row[fieldName]);
      if (!key) return;
      index[key] = row;
    });

    return index;
  }

  function countByStatus(rows, fieldName) {
    const counts = {};

    (rows || []).forEach(function(row) {
      const status = normalizeStatus(row && row[fieldName]) || '(blank)';
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }

  function findSafeTarget(recalls, patientIndex, treatmentIndex) {
    const rows = Array.isArray(recalls) ? recalls : [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const recallId = normalizeKey(row.ortho_recall_id);
      const patientId = normalizeKey(row.patient_id);
      const installTreatmentId = normalizeKey(row.install_treatment_id);
      const lastControlTreatmentId = normalizeKey(row.last_control_treatment_id);
      const programStatus = normalizeStatus(row.program_status);
      const followupStatus = normalizeStatus(row.followup_status);

      if (!recallId || !patientId) continue;
      if (programStatus !== 'active') continue;
      if (followupStatus !== 'upcoming') continue;
      if (!patientIndex[patientId]) continue;

      /*
       * Hindari known manual-test artifact:
       * ada 1 OrthoRecall dengan install_treatment_id yang parent treatment-nya missing.
       * Untuk 7F target aman, pilih row yang install_treatment_id-nya ada dan ditemukan.
       */
      if (!installTreatmentId) continue;
      if (!treatmentIndex[installTreatmentId]) continue;

      if (lastControlTreatmentId && !treatmentIndex[lastControlTreatmentId]) continue;

      return row;
    }

    return null;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const recalls = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    const patients = OrthoRecallRepository.getPatientsRaw(supabaseOptions);
    const treatments = OrthoRecallRepository.getTreatmentsRaw(supabaseOptions);
    const services = dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions);

    const patientIndex = buildIndexByField(patients, 'patient_id');
    const treatmentIndex = buildIndexByField(treatments, 'treatment_id');

    const activeRecall = recalls.filter(function(row) {
      return normalizeStatus(row.program_status) === 'active';
    });

    const upcomingRecall = recalls.filter(function(row) {
      return normalizeStatus(row.followup_status) === 'upcoming';
    });

    const completedRecall = recalls.filter(function(row) {
      return normalizeStatus(row.program_status) === 'completed';
    });

    const cancelledRecall = recalls.filter(function(row) {
      return normalizeStatus(row.program_status) === 'cancelled';
    });

    const orthoInstallServices = services.filter(function(row) {
      return isTruthyValue(row.is_ortho_install);
    });

    const orthoControlServices = services.filter(function(row) {
      return isTruthyValue(row.is_ortho_control);
    });

    result.baseline = {
      ortho_recalls: recalls.length,
      active_recall: activeRecall.length,
      upcoming_recall: upcomingRecall.length,
      completed_recall: completedRecall.length,
      cancelled_recall: cancelledRecall.length,
      patients: patients.length,
      treatments: treatments.length,
      service_catalog: services.length,
      ortho_install_services: orthoInstallServices.length,
      ortho_control_services: orthoControlServices.length
    };

    result.status_counts = {
      program_status: countByStatus(recalls, 'program_status'),
      followup_status: countByStatus(recalls, 'followup_status')
    };

    addCheck('SUPABASE_DATASETS_ARRAY', Array.isArray(recalls) && Array.isArray(patients) && Array.isArray(treatments) && Array.isArray(services), {
      ortho_recalls_is_array: Array.isArray(recalls),
      patients_is_array: Array.isArray(patients),
      treatments_is_array: Array.isArray(treatments),
      service_catalog_is_array: Array.isArray(services)
    });

    addCheck('BASELINE_ORTHO_RECALL_COUNT_124', recalls.length === 124, {
      actual: recalls.length,
      expected: 124
    });

    addCheck('BASELINE_ACTIVE_UPCOMING_124_124', activeRecall.length === 124 && upcomingRecall.length === 124, {
      active_actual: activeRecall.length,
      upcoming_actual: upcomingRecall.length,
      active_expected: 124,
      upcoming_expected: 124
    });

    addCheck('BASELINE_PATIENTS_285', patients.length === 285, {
      actual: patients.length,
      expected: 285
    });

    addCheck('BASELINE_TREATMENTS_254', treatments.length === 254, {
      actual: treatments.length,
      expected: 254
    });

    addCheck('BASELINE_SERVICE_CATALOG_100', services.length === 100, {
      actual: services.length,
      expected: 100
    });

    addCheck('BASELINE_ORTHO_SERVICE_COUNTS_8_10', orthoInstallServices.length === 8 && orthoControlServices.length === 10, {
      ortho_install_actual: orthoInstallServices.length,
      ortho_control_actual: orthoControlServices.length,
      ortho_install_expected: 8,
      ortho_control_expected: 10
    });

    const missingPatientRows = recalls.filter(function(row) {
      const patientId = normalizeKey(row.patient_id);
      return patientId && !patientIndex[patientId];
    });

    const installTreatmentMissingRows = recalls.filter(function(row) {
      const treatmentId = normalizeKey(row.install_treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const lastControlTreatmentMissingRows = recalls.filter(function(row) {
      const treatmentId = normalizeKey(row.last_control_treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    addCheck('NO_ORTHO_RECALL_WITH_MISSING_PATIENT', missingPatientRows.length === 0, {
      missing_patient_count: missingPatientRows.length
    });

    addCheck('INSTALL_TREATMENT_MISSING_PARENT_EXPECTED_1', installTreatmentMissingRows.length === 1, {
      missing_install_treatment_count: installTreatmentMissingRows.length,
      expected_known_manual_artifact: 1
    });

    addCheck('NO_LAST_CONTROL_TREATMENT_MISSING_PARENT', lastControlTreatmentMissingRows.length === 0, {
      missing_last_control_treatment_count: lastControlTreatmentMissingRows.length
    });

    const target = findSafeTarget(recalls, patientIndex, treatmentIndex);

    if (target) {
      const targetPatientId = normalizeKey(target.patient_id);
      const targetInstallTreatmentId = normalizeKey(target.install_treatment_id);
      const targetLastControlTreatmentId = normalizeKey(target.last_control_treatment_id);

      result.selected_target = {
        ortho_recall_id: normalizeKey(target.ortho_recall_id),
        patient_id: targetPatientId,
        patient_name: normalizeKey(target.patient_name),
        install_treatment_id: targetInstallTreatmentId,
        last_control_treatment_id: targetLastControlTreatmentId,
        install_date: normalizeKey(target.install_date),
        last_control_date: normalizeKey(target.last_control_date),
        next_due_date: normalizeKey(target.next_due_date),
        control_count: Number(target.control_count || 0),
        program_status: normalizeStatus(target.program_status),
        followup_status: normalizeStatus(target.followup_status),
        patient_found: !!patientIndex[targetPatientId],
        install_treatment_found: !!treatmentIndex[targetInstallTreatmentId],
        last_control_treatment_found_or_empty: !targetLastControlTreatmentId || !!treatmentIndex[targetLastControlTreatmentId]
      };
    }

    addCheck('SAFE_TARGET_RECALL_SELECTED', !!target, result.selected_target);

    /*
     * Guard check default-off.
     * Ini memakai ID fake agar tetap aman sekalipun flag tidak sengaja true.
     * Expected: harus blocked karena REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED false.
     */
    let explicitUpdateBlocked = false;
    let explicitUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.ORTHO_RECALL,
        'ortho_recall_id',
        'ORC-7F-SHOULD-NOT-UPDATE',
        {
          last_contact_note: 'SHOULD NOT UPDATE - 7F PREFLIGHT',
          updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
        },
        {
          stage: '7F'
        }
      );
    } catch (errUpdate) {
      explicitUpdateBlocked = true;
      explicitUpdateMessage = errUpdate && errUpdate.message
        ? errUpdate.message
        : String(errUpdate || '');
    }

    result.guard_checks.explicit_supabase_update_default_off_blocked = explicitUpdateBlocked;
    result.guard_checks.explicit_supabase_update_message = explicitUpdateMessage;

    addCheck('EXPLICIT_ORTHO_RECALL_UPDATE_DEFAULT_OFF_BLOCKED', explicitUpdateBlocked, {
      message: explicitUpdateMessage
    });

    let oldDbUpdateSupabaseBlocked = false;
    let oldDbUpdateMessage = '';

    try {
      dbUpdateById_(
        REPO_TABLES.ORTHO_RECALL,
        'ortho_recall_id',
        'ORC-7F-SHOULD-NOT-UPDATE',
        {
          last_contact_note: 'SHOULD NOT UPDATE - OLD DB UPDATE',
          updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
        },
        {
          backend_mode: 'supabase'
        }
      );
    } catch (errOldUpdate) {
      oldDbUpdateSupabaseBlocked = true;
      oldDbUpdateMessage = errOldUpdate && errOldUpdate.message
        ? errOldUpdate.message
        : String(errOldUpdate || '');
    }

    result.guard_checks.old_db_update_supabase_blocked = oldDbUpdateSupabaseBlocked;
    result.guard_checks.old_db_update_message = oldDbUpdateMessage;

    addCheck('OLD_DB_UPDATE_SUPABASE_STILL_BLOCKED', oldDbUpdateSupabaseBlocked, {
      message: oldDbUpdateMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-1-OrthoRecall-Preflight',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'PREFLIGHT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FDefaultOffGuardLog() {
  const result = {
    success: true,
    stage: '7F-2-OrthoRecall-DefaultOffGuard',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    target: {},
    before_counts: {},
    after_counts: {},
    blocked_attempts: {},
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

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function buildCounts(recalls) {
    const rows = Array.isArray(recalls) ? recalls : [];
    return {
      ortho_recalls: rows.length,
      active: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'active';
      }).length,
      completed: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'completed';
      }).length,
      cancelled: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'cancelled';
      }).length,
      upcoming: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'upcoming';
      }).length,
      done: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'done';
      }).length
    };
  }

  function findTargetRecall(recalls) {
    const rows = Array.isArray(recalls) ? recalls : [];

    /*
     * Target yang sudah dipilih clean oleh 7F-1.
     * Tetap dicek ulang supaya test gagal aman jika data target berubah.
     */
    const preferredId = 'ORC-20260424-153834842-468';

    const preferred = rows.find(function(row) {
      return normalizeKey(row.ortho_recall_id) === preferredId;
    });

    if (preferred) return preferred;

    return rows.find(function(row) {
      return normalizeStatus(row.program_status) === 'active' &&
        normalizeStatus(row.followup_status) === 'upcoming' &&
        normalizeKey(row.ortho_recall_id) &&
        normalizeKey(row.patient_id);
    }) || null;
  }

  function attemptBlockedUpdate(name, recallId, patch) {
    const attempt = {
      blocked: false,
      message: ''
    };

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.ORTHO_RECALL,
        'ortho_recall_id',
        recallId,
        patch,
        {
          stage: '7F'
        }
      );
    } catch (err) {
      attempt.blocked = true;
      attempt.message = err && err.message ? err.message : String(err || '');
    }

    result.blocked_attempts[name] = attempt;

    addCheck(name + '_BLOCKED_WHEN_FLAG_FALSE', attempt.blocked === true, {
      message: attempt.message
    });

    return attempt;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    /*
     * Safety: jika flag ternyata true, jangan lakukan blocked-attempt.
     * Ini mencegah test default-off tidak sengaja menjadi write test.
     */
    if (result.supabase_staging_write_test_enabled !== false) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_FALSE_ABORTING_DEFAULT_OFF_GUARD_TEST',
        actual: result.supabase_staging_write_test_enabled
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const recallsBefore = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.before_counts = buildCounts(recallsBefore);

    addCheck('BASELINE_BEFORE_COUNTS_OK', result.before_counts.ortho_recalls === 124 &&
      result.before_counts.active === 124 &&
      result.before_counts.upcoming === 124 &&
      result.before_counts.completed === 0 &&
      result.before_counts.cancelled === 0, result.before_counts);

    const target = findTargetRecall(recallsBefore);
    const recallId = target ? normalizeKey(target.ortho_recall_id) : '';

    if (target) {
      result.target = {
        ortho_recall_id: recallId,
        patient_id: normalizeKey(target.patient_id),
        patient_name: normalizeKey(target.patient_name),
        install_treatment_id: normalizeKey(target.install_treatment_id),
        next_due_date: normalizeKey(target.next_due_date),
        program_status: normalizeStatus(target.program_status),
        followup_status: normalizeStatus(target.followup_status),
        last_contact_date_before: normalizeKey(target.last_contact_date),
        last_contact_note_before: normalizeKey(target.last_contact_note),
        completed_at_before: normalizeKey(target.completed_at),
        notes_before: normalizeKey(target.notes)
      };
    }

    addCheck('TARGET_RECALL_AVAILABLE', !!target && !!recallId, result.target);

    if (!target || !recallId) {
      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const today = typeof getTodayYmdServer === 'function'
      ? getTodayYmdServer()
      : now.slice(0, 10);

    attemptBlockedUpdate('LOG_CONTACT_UPDATE', recallId, {
      last_contact_date: today,
      last_contact_note: 'TEST 7F default-off guard - should not update',
      updated_at: now
    });

    attemptBlockedUpdate('COMPLETE_PROGRAM_UPDATE', recallId, {
      program_status: 'completed',
      followup_status: 'done',
      completed_at: now,
      notes: 'TEST 7F default-off complete - should not update',
      updated_at: now
    });

    attemptBlockedUpdate('CANCEL_PROGRAM_UPDATE', recallId, {
      program_status: 'cancelled',
      followup_status: 'done',
      completed_at: null,
      notes: 'TEST 7F default-off cancel - should not update',
      updated_at: now
    });

    attemptBlockedUpdate('REFRESH_STATUS_UPDATE', recallId, {
      followup_status: 'upcoming',
      updated_at: now
    });

    const recallsAfter = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.after_counts = buildCounts(recallsAfter);

    addCheck('COUNTS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    const targetAfter = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    addCheck('TARGET_STATUS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      targetAfter &&
      normalizeStatus(targetAfter.program_status) === normalizeStatus(target.program_status) &&
      normalizeStatus(targetAfter.followup_status) === normalizeStatus(target.followup_status),
      {
        before_program_status: normalizeStatus(target.program_status),
        after_program_status: targetAfter ? normalizeStatus(targetAfter.program_status) : '',
        before_followup_status: normalizeStatus(target.followup_status),
        after_followup_status: targetAfter ? normalizeStatus(targetAfter.followup_status) : ''
      }
    );

    addCheck('TARGET_CONTACT_FIELDS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      targetAfter &&
      normalizeKey(targetAfter.last_contact_date) === normalizeKey(target.last_contact_date) &&
      normalizeKey(targetAfter.last_contact_note) === normalizeKey(target.last_contact_note),
      {
        before_last_contact_date: normalizeKey(target.last_contact_date),
        after_last_contact_date: targetAfter ? normalizeKey(targetAfter.last_contact_date) : '',
        before_last_contact_note: normalizeKey(target.last_contact_note),
        after_last_contact_note: targetAfter ? normalizeKey(targetAfter.last_contact_note) : ''
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-2-OrthoRecall-DefaultOffGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'DEFAULT_OFF_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FLogContactMutationLog() {
  const result = {
    success: true,
    stage: '7F-3-OrthoRecall-LogContactMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    target: {},
    before_snapshot: {},
    mutation_readback: {},
    cleanup_readback: {},
    before_counts: {},
    after_counts: {},
    mutation_result: {},
    cleanup_result: {},
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

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function nullIfBlank(value) {
    const text = normalizeKey(value);
    return text ? text : null;
  }

  function buildCounts(recalls) {
    const rows = Array.isArray(recalls) ? recalls : [];

    return {
      ortho_recalls: rows.length,
      active: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'active';
      }).length,
      completed: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'completed';
      }).length,
      cancelled: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'cancelled';
      }).length,
      upcoming: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'upcoming';
      }).length,
      done: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'done';
      }).length
    };
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const recallId = 'ORC-20260424-153834842-468';

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    if (result.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7F-3.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const recallsBefore = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.before_counts = buildCounts(recallsBefore);

    addCheck('BASELINE_BEFORE_COUNTS_OK',
      result.before_counts.ortho_recalls === 124 &&
      result.before_counts.active === 124 &&
      result.before_counts.completed === 0 &&
      result.before_counts.cancelled === 0 &&
      result.before_counts.upcoming === 124 &&
      result.before_counts.done === 0,
      result.before_counts
    );

    const before = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    addCheck('TARGET_RECALL_FOUND_BEFORE_MUTATION', !!before, {
      ortho_recall_id: recallId
    });

    if (!before) {
      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    result.target = {
      ortho_recall_id: normalizeKey(before.ortho_recall_id),
      patient_id: normalizeKey(before.patient_id),
      patient_name: normalizeKey(before.patient_name),
      install_treatment_id: normalizeKey(before.install_treatment_id),
      next_due_date: normalizeKey(before.next_due_date),
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status)
    };

    result.before_snapshot = {
      last_contact_date: normalizeKey(before.last_contact_date),
      last_contact_note: normalizeKey(before.last_contact_note),
      updated_at: normalizeKey(before.updated_at),
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status),
      completed_at: normalizeKey(before.completed_at),
      notes: normalizeKey(before.notes)
    };

    addCheck('TARGET_STATUS_SAFE_FOR_LOG_CONTACT',
      result.before_snapshot.program_status === 'active' &&
      result.before_snapshot.followup_status === 'upcoming',
      result.before_snapshot
    );

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const today = typeof getTodayYmdServer === 'function'
      ? getTodayYmdServer()
      : now.slice(0, 10);

    const testNote = 'TEST 7F-3 log contact Supabase staging - will be reverted';

    result.mutation_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        last_contact_date: today,
        last_contact_note: testNote,
        updated_at: now
      },
      {
        stage: '7F'
      }
    );

    addCheck('LOG_CONTACT_MUTATION_PATCH_SUCCESS',
      result.mutation_result && result.mutation_result.success === true,
      {
        status_code: result.mutation_result ? result.mutation_result.status_code : null,
        row_count: result.mutation_result ? result.mutation_result.row_count : null
      }
    );

    const mutated = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.mutation_readback = mutated ? {
      last_contact_date: normalizeKey(mutated.last_contact_date),
      last_contact_note: normalizeKey(mutated.last_contact_note),
      updated_at: normalizeKey(mutated.updated_at),
      program_status: normalizeStatus(mutated.program_status),
      followup_status: normalizeStatus(mutated.followup_status)
    } : null;

    addCheck('LOG_CONTACT_READBACK_UPDATED',
      mutated &&
      normalizeKey(mutated.last_contact_date).slice(0, 10) === today &&
      normalizeKey(mutated.last_contact_note) === testNote,
      result.mutation_readback || {}
    );

    addCheck('STATUS_UNCHANGED_AFTER_LOG_CONTACT_MUTATION',
      mutated &&
      normalizeStatus(mutated.program_status) === result.before_snapshot.program_status &&
      normalizeStatus(mutated.followup_status) === result.before_snapshot.followup_status,
      {
        before_program_status: result.before_snapshot.program_status,
        after_program_status: mutated ? normalizeStatus(mutated.program_status) : '',
        before_followup_status: result.before_snapshot.followup_status,
        after_followup_status: mutated ? normalizeStatus(mutated.followup_status) : ''
      }
    );

    /*
     * Cleanup/revert.
     * Untuk kolom date/timestamp nullable, gunakan null jika awalnya kosong.
     * Jangan kirim string kosong ke date/timestamptz.
     */
    result.cleanup_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        last_contact_date: nullIfBlank(result.before_snapshot.last_contact_date),
        last_contact_note: result.before_snapshot.last_contact_note,
        updated_at: nullIfBlank(result.before_snapshot.updated_at)
      },
      {
        stage: '7F'
      }
    );

    addCheck('LOG_CONTACT_CLEANUP_PATCH_SUCCESS',
      result.cleanup_result && result.cleanup_result.success === true,
      {
        status_code: result.cleanup_result ? result.cleanup_result.status_code : null,
        row_count: result.cleanup_result ? result.cleanup_result.row_count : null
      }
    );

    const cleanup = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.cleanup_readback = cleanup ? {
      last_contact_date: normalizeKey(cleanup.last_contact_date),
      last_contact_note: normalizeKey(cleanup.last_contact_note),
      updated_at: normalizeKey(cleanup.updated_at),
      program_status: normalizeStatus(cleanup.program_status),
      followup_status: normalizeStatus(cleanup.followup_status),
      completed_at: normalizeKey(cleanup.completed_at),
      notes: normalizeKey(cleanup.notes)
    } : null;

    addCheck('LOG_CONTACT_FIELDS_REVERTED',
      cleanup &&
      normalizeKey(cleanup.last_contact_date) === result.before_snapshot.last_contact_date &&
      normalizeKey(cleanup.last_contact_note) === result.before_snapshot.last_contact_note,
      {
        before_last_contact_date: result.before_snapshot.last_contact_date,
        after_last_contact_date: cleanup ? normalizeKey(cleanup.last_contact_date) : '',
        before_last_contact_note: result.before_snapshot.last_contact_note,
        after_last_contact_note: cleanup ? normalizeKey(cleanup.last_contact_note) : ''
      }
    );

    addCheck('TARGET_STATUS_UNCHANGED_AFTER_CLEANUP',
      cleanup &&
      normalizeStatus(cleanup.program_status) === result.before_snapshot.program_status &&
      normalizeStatus(cleanup.followup_status) === result.before_snapshot.followup_status,
      {
        before_program_status: result.before_snapshot.program_status,
        after_program_status: cleanup ? normalizeStatus(cleanup.program_status) : '',
        before_followup_status: result.before_snapshot.followup_status,
        after_followup_status: cleanup ? normalizeStatus(cleanup.followup_status) : ''
      }
    );

    const recallsAfter = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.after_counts = buildCounts(recallsAfter);

    addCheck('COUNTS_UNCHANGED_AFTER_LOG_CONTACT_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-3-OrthoRecall-LogContactMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'LOG_CONTACT_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah mutation patch, jalankan audit/read-back sebelum lanjut.'
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FCompleteProgramMutationLog() {
  const result = {
    success: true,
    stage: '7F-4-OrthoRecall-CompleteProgramMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    target: {},
    before_snapshot: {},
    complete_readback: {},
    cleanup_readback: {},
    before_counts: {},
    completed_counts: {},
    after_counts: {},
    complete_result: {},
    cleanup_result: {},
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

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function nullIfBlank(value) {
    const text = normalizeKey(value);
    return text ? text : null;
  }

  function buildCounts(recalls) {
    const rows = Array.isArray(recalls) ? recalls : [];

    return {
      ortho_recalls: rows.length,
      active: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'active';
      }).length,
      completed: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'completed';
      }).length,
      cancelled: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'cancelled';
      }).length,
      upcoming: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'upcoming';
      }).length,
      done: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'done';
      }).length
    };
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const recallId = 'ORC-20260424-153834842-468';

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    if (result.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7F-4.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const recallsBefore = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.before_counts = buildCounts(recallsBefore);

    addCheck('BASELINE_BEFORE_COUNTS_OK',
      result.before_counts.ortho_recalls === 124 &&
      result.before_counts.active === 124 &&
      result.before_counts.completed === 0 &&
      result.before_counts.cancelled === 0 &&
      result.before_counts.upcoming === 124 &&
      result.before_counts.done === 0,
      result.before_counts
    );

    const before = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    addCheck('TARGET_RECALL_FOUND_BEFORE_COMPLETE', !!before, {
      ortho_recall_id: recallId
    });

    if (!before) {
      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    result.target = {
      ortho_recall_id: normalizeKey(before.ortho_recall_id),
      patient_id: normalizeKey(before.patient_id),
      patient_name: normalizeKey(before.patient_name),
      install_treatment_id: normalizeKey(before.install_treatment_id),
      next_due_date: normalizeKey(before.next_due_date),
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status)
    };

    result.before_snapshot = {
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status),
      completed_at: normalizeKey(before.completed_at),
      notes: normalizeKey(before.notes),
      updated_at: normalizeKey(before.updated_at),
      last_contact_date: normalizeKey(before.last_contact_date),
      last_contact_note: normalizeKey(before.last_contact_note)
    };

    addCheck('TARGET_STATUS_SAFE_FOR_COMPLETE',
      result.before_snapshot.program_status === 'active' &&
      result.before_snapshot.followup_status === 'upcoming',
      result.before_snapshot
    );

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const testNote = '[TEST 7F-4] Program completed via Supabase staging - will be reverted';

    result.complete_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        program_status: 'completed',
        followup_status: 'done',
        completed_at: now,
        notes: testNote,
        updated_at: now
      },
      {
        stage: '7F'
      }
    );

    addCheck('COMPLETE_PROGRAM_PATCH_SUCCESS',
      result.complete_result && result.complete_result.success === true,
      {
        status_code: result.complete_result ? result.complete_result.status_code : null,
        row_count: result.complete_result ? result.complete_result.row_count : null
      }
    );

    const completed = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.complete_readback = completed ? {
      program_status: normalizeStatus(completed.program_status),
      followup_status: normalizeStatus(completed.followup_status),
      completed_at: normalizeKey(completed.completed_at),
      notes: normalizeKey(completed.notes),
      updated_at: normalizeKey(completed.updated_at)
    } : null;

    addCheck('COMPLETE_PROGRAM_READBACK_UPDATED',
      completed &&
      normalizeStatus(completed.program_status) === 'completed' &&
      normalizeStatus(completed.followup_status) === 'done' &&
      !!normalizeKey(completed.completed_at) &&
      normalizeKey(completed.notes) === testNote,
      result.complete_readback || {}
    );

    const recallsCompleted = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.completed_counts = buildCounts(recallsCompleted);

    addCheck('COUNTS_AFTER_COMPLETE_EXPECTED',
      result.completed_counts.ortho_recalls === 124 &&
      result.completed_counts.active === 123 &&
      result.completed_counts.completed === 1 &&
      result.completed_counts.cancelled === 0 &&
      result.completed_counts.upcoming === 123 &&
      result.completed_counts.done === 1,
      result.completed_counts
    );

    /*
     * Cleanup/revert ke baseline.
     * Date/timestamp nullable pakai null jika sebelumnya kosong.
     */
    result.cleanup_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        program_status: result.before_snapshot.program_status,
        followup_status: result.before_snapshot.followup_status,
        completed_at: nullIfBlank(result.before_snapshot.completed_at),
        notes: result.before_snapshot.notes,
        updated_at: nullIfBlank(result.before_snapshot.updated_at)
      },
      {
        stage: '7F'
      }
    );

    addCheck('COMPLETE_PROGRAM_CLEANUP_PATCH_SUCCESS',
      result.cleanup_result && result.cleanup_result.success === true,
      {
        status_code: result.cleanup_result ? result.cleanup_result.status_code : null,
        row_count: result.cleanup_result ? result.cleanup_result.row_count : null
      }
    );

    const cleanup = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.cleanup_readback = cleanup ? {
      program_status: normalizeStatus(cleanup.program_status),
      followup_status: normalizeStatus(cleanup.followup_status),
      completed_at: normalizeKey(cleanup.completed_at),
      notes: normalizeKey(cleanup.notes),
      updated_at: normalizeKey(cleanup.updated_at),
      last_contact_date: normalizeKey(cleanup.last_contact_date),
      last_contact_note: normalizeKey(cleanup.last_contact_note)
    } : null;

    addCheck('COMPLETE_PROGRAM_FIELDS_REVERTED',
      cleanup &&
      normalizeStatus(cleanup.program_status) === result.before_snapshot.program_status &&
      normalizeStatus(cleanup.followup_status) === result.before_snapshot.followup_status &&
      normalizeKey(cleanup.completed_at) === result.before_snapshot.completed_at &&
      normalizeKey(cleanup.notes) === result.before_snapshot.notes,
      {
        before: result.before_snapshot,
        after: result.cleanup_readback || {}
      }
    );

    addCheck('CONTACT_FIELDS_STILL_UNCHANGED_AFTER_COMPLETE_TEST',
      cleanup &&
      normalizeKey(cleanup.last_contact_date) === result.before_snapshot.last_contact_date &&
      normalizeKey(cleanup.last_contact_note) === result.before_snapshot.last_contact_note,
      {
        before_last_contact_date: result.before_snapshot.last_contact_date,
        after_last_contact_date: cleanup ? normalizeKey(cleanup.last_contact_date) : '',
        before_last_contact_note: result.before_snapshot.last_contact_note,
        after_last_contact_note: cleanup ? normalizeKey(cleanup.last_contact_note) : ''
      }
    );

    const recallsAfter = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.after_counts = buildCounts(recallsAfter);

    addCheck('COUNTS_REVERTED_AFTER_COMPLETE_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-4-OrthoRecall-CompleteProgramMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'COMPLETE_PROGRAM_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah complete patch, jangan lanjut. Jalankan read-back/audit target recall dulu.'
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FCancelProgramMutationLog() {
  const result = {
    success: true,
    stage: '7F-5-OrthoRecall-CancelProgramMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    target: {},
    before_snapshot: {},
    cancel_readback: {},
    cleanup_readback: {},
    before_counts: {},
    cancelled_counts: {},
    after_counts: {},
    cancel_result: {},
    cleanup_result: {},
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

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function nullIfBlank(value) {
    const text = normalizeKey(value);
    return text ? text : null;
  }

  function buildCounts(recalls) {
    const rows = Array.isArray(recalls) ? recalls : [];

    return {
      ortho_recalls: rows.length,
      active: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'active';
      }).length,
      completed: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'completed';
      }).length,
      cancelled: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'cancelled';
      }).length,
      upcoming: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'upcoming';
      }).length,
      done: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'done';
      }).length
    };
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const recallId = 'ORC-20260424-153834842-468';

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    if (result.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7F-5.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const recallsBefore = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.before_counts = buildCounts(recallsBefore);

    addCheck('BASELINE_BEFORE_COUNTS_OK',
      result.before_counts.ortho_recalls === 124 &&
      result.before_counts.active === 124 &&
      result.before_counts.completed === 0 &&
      result.before_counts.cancelled === 0 &&
      result.before_counts.upcoming === 124 &&
      result.before_counts.done === 0,
      result.before_counts
    );

    const before = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    addCheck('TARGET_RECALL_FOUND_BEFORE_CANCEL', !!before, {
      ortho_recall_id: recallId
    });

    if (!before) {
      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    result.target = {
      ortho_recall_id: normalizeKey(before.ortho_recall_id),
      patient_id: normalizeKey(before.patient_id),
      patient_name: normalizeKey(before.patient_name),
      install_treatment_id: normalizeKey(before.install_treatment_id),
      next_due_date: normalizeKey(before.next_due_date),
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status)
    };

    result.before_snapshot = {
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status),
      completed_at: normalizeKey(before.completed_at),
      notes: normalizeKey(before.notes),
      updated_at: normalizeKey(before.updated_at),
      last_contact_date: normalizeKey(before.last_contact_date),
      last_contact_note: normalizeKey(before.last_contact_note)
    };

    addCheck('TARGET_STATUS_SAFE_FOR_CANCEL',
      result.before_snapshot.program_status === 'active' &&
      result.before_snapshot.followup_status === 'upcoming',
      result.before_snapshot
    );

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const testNote = '[TEST 7F-5] Program cancelled via Supabase staging - will be reverted';

    result.cancel_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        program_status: 'cancelled',
        followup_status: 'done',
        completed_at: null,
        notes: testNote,
        updated_at: now
      },
      {
        stage: '7F'
      }
    );

    addCheck('CANCEL_PROGRAM_PATCH_SUCCESS',
      result.cancel_result && result.cancel_result.success === true,
      {
        status_code: result.cancel_result ? result.cancel_result.status_code : null,
        row_count: result.cancel_result ? result.cancel_result.row_count : null
      }
    );

    const cancelled = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.cancel_readback = cancelled ? {
      program_status: normalizeStatus(cancelled.program_status),
      followup_status: normalizeStatus(cancelled.followup_status),
      completed_at: normalizeKey(cancelled.completed_at),
      notes: normalizeKey(cancelled.notes),
      updated_at: normalizeKey(cancelled.updated_at)
    } : null;

    addCheck('CANCEL_PROGRAM_READBACK_UPDATED',
      cancelled &&
      normalizeStatus(cancelled.program_status) === 'cancelled' &&
      normalizeStatus(cancelled.followup_status) === 'done' &&
      normalizeKey(cancelled.completed_at) === '' &&
      normalizeKey(cancelled.notes) === testNote,
      result.cancel_readback || {}
    );

    const recallsCancelled = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.cancelled_counts = buildCounts(recallsCancelled);

    addCheck('COUNTS_AFTER_CANCEL_EXPECTED',
      result.cancelled_counts.ortho_recalls === 124 &&
      result.cancelled_counts.active === 123 &&
      result.cancelled_counts.completed === 0 &&
      result.cancelled_counts.cancelled === 1 &&
      result.cancelled_counts.upcoming === 123 &&
      result.cancelled_counts.done === 1,
      result.cancelled_counts
    );

    /*
     * Cleanup/revert ke baseline.
     * Date/timestamp nullable pakai null jika sebelumnya kosong.
     */
    result.cleanup_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        program_status: result.before_snapshot.program_status,
        followup_status: result.before_snapshot.followup_status,
        completed_at: nullIfBlank(result.before_snapshot.completed_at),
        notes: result.before_snapshot.notes,
        updated_at: nullIfBlank(result.before_snapshot.updated_at)
      },
      {
        stage: '7F'
      }
    );

    addCheck('CANCEL_PROGRAM_CLEANUP_PATCH_SUCCESS',
      result.cleanup_result && result.cleanup_result.success === true,
      {
        status_code: result.cleanup_result ? result.cleanup_result.status_code : null,
        row_count: result.cleanup_result ? result.cleanup_result.row_count : null
      }
    );

    const cleanup = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.cleanup_readback = cleanup ? {
      program_status: normalizeStatus(cleanup.program_status),
      followup_status: normalizeStatus(cleanup.followup_status),
      completed_at: normalizeKey(cleanup.completed_at),
      notes: normalizeKey(cleanup.notes),
      updated_at: normalizeKey(cleanup.updated_at),
      last_contact_date: normalizeKey(cleanup.last_contact_date),
      last_contact_note: normalizeKey(cleanup.last_contact_note)
    } : null;

    addCheck('CANCEL_PROGRAM_FIELDS_REVERTED',
      cleanup &&
      normalizeStatus(cleanup.program_status) === result.before_snapshot.program_status &&
      normalizeStatus(cleanup.followup_status) === result.before_snapshot.followup_status &&
      normalizeKey(cleanup.completed_at) === result.before_snapshot.completed_at &&
      normalizeKey(cleanup.notes) === result.before_snapshot.notes,
      {
        before: result.before_snapshot,
        after: result.cleanup_readback || {}
      }
    );

    addCheck('CONTACT_FIELDS_STILL_UNCHANGED_AFTER_CANCEL_TEST',
      cleanup &&
      normalizeKey(cleanup.last_contact_date) === result.before_snapshot.last_contact_date &&
      normalizeKey(cleanup.last_contact_note) === result.before_snapshot.last_contact_note,
      {
        before_last_contact_date: result.before_snapshot.last_contact_date,
        after_last_contact_date: cleanup ? normalizeKey(cleanup.last_contact_date) : '',
        before_last_contact_note: result.before_snapshot.last_contact_note,
        after_last_contact_note: cleanup ? normalizeKey(cleanup.last_contact_note) : ''
      }
    );

    const recallsAfter = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.after_counts = buildCounts(recallsAfter);

    addCheck('COUNTS_REVERTED_AFTER_CANCEL_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-5-OrthoRecall-CancelProgramMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'CANCEL_PROGRAM_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah cancel patch, jangan lanjut. Jalankan read-back/audit target recall dulu.'
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FRefreshStatusMutationLog() {
  const result = {
    success: true,
    stage: '7F-6-OrthoRecall-RefreshStatusMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    target: {},
    before_snapshot: {},
    refresh_readback: {},
    cleanup_readback: {},
    before_counts: {},
    refreshed_counts: {},
    after_counts: {},
    refresh_result: {},
    cleanup_result: {},
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

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function nullIfBlank(value) {
    const text = normalizeKey(value);
    return text ? text : null;
  }

  function buildCounts(recalls) {
    const rows = Array.isArray(recalls) ? recalls : [];

    return {
      ortho_recalls: rows.length,
      active: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'active';
      }).length,
      completed: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'completed';
      }).length,
      cancelled: rows.filter(function(row) {
        return normalizeStatus(row.program_status) === 'cancelled';
      }).length,
      upcoming: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'upcoming';
      }).length,
      due: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'due';
      }).length,
      overdue: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'overdue';
      }).length,
      reached_target: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'reached_target';
      }).length,
      done: rows.filter(function(row) {
        return normalizeStatus(row.followup_status) === 'done';
      }).length
    };
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const recallId = 'ORC-20260424-153834842-468';

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    if (result.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7F-6.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const recallsBefore = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.before_counts = buildCounts(recallsBefore);

    addCheck('BASELINE_BEFORE_COUNTS_OK',
      result.before_counts.ortho_recalls === 124 &&
      result.before_counts.active === 124 &&
      result.before_counts.completed === 0 &&
      result.before_counts.cancelled === 0 &&
      result.before_counts.upcoming === 124 &&
      result.before_counts.due === 0 &&
      result.before_counts.overdue === 0 &&
      result.before_counts.done === 0,
      result.before_counts
    );

    const before = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    addCheck('TARGET_RECALL_FOUND_BEFORE_REFRESH', !!before, {
      ortho_recall_id: recallId
    });

    if (!before) {
      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    result.target = {
      ortho_recall_id: normalizeKey(before.ortho_recall_id),
      patient_id: normalizeKey(before.patient_id),
      patient_name: normalizeKey(before.patient_name),
      install_treatment_id: normalizeKey(before.install_treatment_id),
      install_date: normalizeKey(before.install_date).slice(0, 10),
      next_due_date: normalizeKey(before.next_due_date).slice(0, 10),
      target_months: Number(before.target_months || 6),
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status)
    };

    result.before_snapshot = {
      program_status: normalizeStatus(before.program_status),
      followup_status: normalizeStatus(before.followup_status),
      next_due_date: normalizeKey(before.next_due_date).slice(0, 10),
      install_date: normalizeKey(before.install_date).slice(0, 10),
      target_months: Number(before.target_months || 6),
      completed_at: normalizeKey(before.completed_at),
      notes: normalizeKey(before.notes),
      updated_at: normalizeKey(before.updated_at),
      last_contact_date: normalizeKey(before.last_contact_date),
      last_contact_note: normalizeKey(before.last_contact_note)
    };

    addCheck('TARGET_STATUS_SAFE_FOR_REFRESH',
      result.before_snapshot.program_status === 'active' &&
      result.before_snapshot.followup_status === 'upcoming' &&
      !!result.before_snapshot.next_due_date,
      result.before_snapshot
    );

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const today = typeof getTodayYmdServer === 'function'
      ? getTodayYmdServer()
      : now.slice(0, 10);

    const expectedStatus = typeof calculateOrthoFollowupStatus === 'function'
      ? calculateOrthoFollowupStatus(
          today,
          result.before_snapshot.install_date,
          result.before_snapshot.target_months,
          result.before_snapshot.program_status
        )
      : 'due';

    addCheck('EXPECTED_REFRESH_STATUS_IS_DUE', expectedStatus === 'due', {
      today: today,
      install_date: result.before_snapshot.install_date,
      target_months: result.before_snapshot.target_months,
      expected_status: expectedStatus
    });

    result.refresh_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        next_due_date: today,
        followup_status: expectedStatus,
        updated_at: now
      },
      {
        stage: '7F'
      }
    );

    addCheck('REFRESH_STATUS_PATCH_SUCCESS',
      result.refresh_result && result.refresh_result.success === true,
      {
        status_code: result.refresh_result ? result.refresh_result.status_code : null,
        row_count: result.refresh_result ? result.refresh_result.row_count : null
      }
    );

    const refreshed = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.refresh_readback = refreshed ? {
      program_status: normalizeStatus(refreshed.program_status),
      followup_status: normalizeStatus(refreshed.followup_status),
      next_due_date: normalizeKey(refreshed.next_due_date).slice(0, 10),
      updated_at: normalizeKey(refreshed.updated_at),
      completed_at: normalizeKey(refreshed.completed_at),
      notes: normalizeKey(refreshed.notes)
    } : null;

    addCheck('REFRESH_STATUS_READBACK_UPDATED',
      refreshed &&
      normalizeKey(refreshed.next_due_date).slice(0, 10) === today &&
      normalizeStatus(refreshed.followup_status) === expectedStatus &&
      normalizeStatus(refreshed.program_status) === result.before_snapshot.program_status,
      result.refresh_readback || {}
    );

    const recallsRefreshed = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.refreshed_counts = buildCounts(recallsRefreshed);

    addCheck('COUNTS_AFTER_REFRESH_EXPECTED',
      result.refreshed_counts.ortho_recalls === 124 &&
      result.refreshed_counts.active === 124 &&
      result.refreshed_counts.completed === 0 &&
      result.refreshed_counts.cancelled === 0 &&
      result.refreshed_counts.upcoming === 123 &&
      result.refreshed_counts.due === 1 &&
      result.refreshed_counts.done === 0,
      result.refreshed_counts
    );

    /*
     * Cleanup/revert ke baseline.
     */
    result.cleanup_result = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.ORTHO_RECALL,
      'ortho_recall_id',
      recallId,
      {
        next_due_date: result.before_snapshot.next_due_date,
        followup_status: result.before_snapshot.followup_status,
        completed_at: nullIfBlank(result.before_snapshot.completed_at),
        notes: result.before_snapshot.notes,
        updated_at: nullIfBlank(result.before_snapshot.updated_at)
      },
      {
        stage: '7F'
      }
    );

    addCheck('REFRESH_STATUS_CLEANUP_PATCH_SUCCESS',
      result.cleanup_result && result.cleanup_result.success === true,
      {
        status_code: result.cleanup_result ? result.cleanup_result.status_code : null,
        row_count: result.cleanup_result ? result.cleanup_result.row_count : null
      }
    );

    const cleanup = OrthoRecallRepository.findOrthoRecallById(recallId, supabaseOptions);

    result.cleanup_readback = cleanup ? {
      program_status: normalizeStatus(cleanup.program_status),
      followup_status: normalizeStatus(cleanup.followup_status),
      next_due_date: normalizeKey(cleanup.next_due_date).slice(0, 10),
      completed_at: normalizeKey(cleanup.completed_at),
      notes: normalizeKey(cleanup.notes),
      updated_at: normalizeKey(cleanup.updated_at),
      last_contact_date: normalizeKey(cleanup.last_contact_date),
      last_contact_note: normalizeKey(cleanup.last_contact_note)
    } : null;

    addCheck('REFRESH_STATUS_FIELDS_REVERTED',
      cleanup &&
      normalizeStatus(cleanup.program_status) === result.before_snapshot.program_status &&
      normalizeStatus(cleanup.followup_status) === result.before_snapshot.followup_status &&
      normalizeKey(cleanup.next_due_date).slice(0, 10) === result.before_snapshot.next_due_date &&
      normalizeKey(cleanup.completed_at) === result.before_snapshot.completed_at &&
      normalizeKey(cleanup.notes) === result.before_snapshot.notes,
      {
        before: result.before_snapshot,
        after: result.cleanup_readback || {}
      }
    );

    addCheck('CONTACT_FIELDS_STILL_UNCHANGED_AFTER_REFRESH_TEST',
      cleanup &&
      normalizeKey(cleanup.last_contact_date) === result.before_snapshot.last_contact_date &&
      normalizeKey(cleanup.last_contact_note) === result.before_snapshot.last_contact_note,
      {
        before_last_contact_date: result.before_snapshot.last_contact_date,
        after_last_contact_date: cleanup ? normalizeKey(cleanup.last_contact_date) : '',
        before_last_contact_note: result.before_snapshot.last_contact_note,
        after_last_contact_note: cleanup ? normalizeKey(cleanup.last_contact_note) : ''
      }
    );

    const recallsAfter = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    result.after_counts = buildCounts(recallsAfter);

    addCheck('COUNTS_REVERTED_AFTER_REFRESH_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-6-OrthoRecall-RefreshStatusMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'REFRESH_STATUS_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah refresh patch, jangan lanjut. Jalankan read-back/audit target recall dulu.'
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testOrthoRecallPhase7FFinalAuditLog() {
  const result = {
    success: true,
    stage: '7F-7-OrthoRecall-FinalAudit',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    baseline: {},
    status_counts: {},
    target: {},
    test_residue: {},
    relationship_checks: {},
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

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isTruthyValue(value) {
    if (value === true) return true;
    if (value === 1) return true;

    const text = String(value || '').trim().toLowerCase();
    return text === 'true' ||
      text === '1' ||
      text === 'yes' ||
      text === 'ya' ||
      text === 'aktif' ||
      text === 'active';
  }

  function buildIndexByField(rows, fieldName) {
    const index = {};

    (rows || []).forEach(function(row) {
      const key = normalizeKey(row && row[fieldName]);
      if (!key) return;
      index[key] = row;
    });

    return index;
  }

  function countByStatus(rows, fieldName) {
    const counts = {};

    (rows || []).forEach(function(row) {
      const status = normalizeStatus(row && row[fieldName]) || '(blank)';
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const targetRecallId = 'ORC-20260424-153834842-468';

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const recalls = OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions);
    const patients = OrthoRecallRepository.getPatientsRaw(supabaseOptions);
    const treatments = OrthoRecallRepository.getTreatmentsRaw(supabaseOptions);
    const services = dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions);

    const patientIndex = buildIndexByField(patients, 'patient_id');
    const treatmentIndex = buildIndexByField(treatments, 'treatment_id');

    const activeRecall = recalls.filter(function(row) {
      return normalizeStatus(row.program_status) === 'active';
    });

    const completedRecall = recalls.filter(function(row) {
      return normalizeStatus(row.program_status) === 'completed';
    });

    const cancelledRecall = recalls.filter(function(row) {
      return normalizeStatus(row.program_status) === 'cancelled';
    });

    const upcomingRecall = recalls.filter(function(row) {
      return normalizeStatus(row.followup_status) === 'upcoming';
    });

    const dueRecall = recalls.filter(function(row) {
      return normalizeStatus(row.followup_status) === 'due';
    });

    const overdueRecall = recalls.filter(function(row) {
      return normalizeStatus(row.followup_status) === 'overdue';
    });

    const reachedTargetRecall = recalls.filter(function(row) {
      return normalizeStatus(row.followup_status) === 'reached_target';
    });

    const doneRecall = recalls.filter(function(row) {
      return normalizeStatus(row.followup_status) === 'done';
    });

    const orthoInstallServices = services.filter(function(row) {
      return isTruthyValue(row.is_ortho_install);
    });

    const orthoControlServices = services.filter(function(row) {
      return isTruthyValue(row.is_ortho_control);
    });

    result.baseline = {
      ortho_recalls: recalls.length,
      active_recall: activeRecall.length,
      completed_recall: completedRecall.length,
      cancelled_recall: cancelledRecall.length,
      upcoming_recall: upcomingRecall.length,
      due_recall: dueRecall.length,
      overdue_recall: overdueRecall.length,
      reached_target_recall: reachedTargetRecall.length,
      done_recall: doneRecall.length,
      patients: patients.length,
      treatments: treatments.length,
      service_catalog: services.length,
      ortho_install_services: orthoInstallServices.length,
      ortho_control_services: orthoControlServices.length
    };

    result.status_counts = {
      program_status: countByStatus(recalls, 'program_status'),
      followup_status: countByStatus(recalls, 'followup_status')
    };

    addCheck('BASELINE_COUNTS_MATCH_EXPECTED',
      result.baseline.ortho_recalls === 124 &&
      result.baseline.active_recall === 124 &&
      result.baseline.completed_recall === 0 &&
      result.baseline.cancelled_recall === 0 &&
      result.baseline.upcoming_recall === 124 &&
      result.baseline.due_recall === 0 &&
      result.baseline.overdue_recall === 0 &&
      result.baseline.reached_target_recall === 0 &&
      result.baseline.done_recall === 0 &&
      result.baseline.patients === 285 &&
      result.baseline.treatments === 254 &&
      result.baseline.service_catalog === 100,
      result.baseline
    );

    addCheck('ORTHO_SERVICE_COUNTS_MATCH_EXPECTED',
      result.baseline.ortho_install_services === 8 &&
      result.baseline.ortho_control_services === 10,
      {
        ortho_install_services: result.baseline.ortho_install_services,
        ortho_control_services: result.baseline.ortho_control_services
      }
    );

    const missingPatientRows = recalls.filter(function(row) {
      const patientId = normalizeKey(row.patient_id);
      return patientId && !patientIndex[patientId];
    });

    const installTreatmentMissingRows = recalls.filter(function(row) {
      const treatmentId = normalizeKey(row.install_treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const lastControlTreatmentMissingRows = recalls.filter(function(row) {
      const treatmentId = normalizeKey(row.last_control_treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    result.relationship_checks = {
      missing_patient_count: missingPatientRows.length,
      missing_install_treatment_count: installTreatmentMissingRows.length,
      missing_last_control_treatment_count: lastControlTreatmentMissingRows.length
    };

    addCheck('NO_ORTHO_RECALL_WITH_MISSING_PATIENT', missingPatientRows.length === 0, result.relationship_checks);

    addCheck('INSTALL_TREATMENT_MISSING_PARENT_EXPECTED_1', installTreatmentMissingRows.length === 1, {
      missing_install_treatment_count: installTreatmentMissingRows.length,
      expected_known_manual_artifact: 1
    });

    addCheck('NO_LAST_CONTROL_TREATMENT_MISSING_PARENT', lastControlTreatmentMissingRows.length === 0, result.relationship_checks);

    const target = OrthoRecallRepository.findOrthoRecallById(targetRecallId, supabaseOptions);

    result.target = target ? {
      ortho_recall_id: normalizeKey(target.ortho_recall_id),
      patient_id: normalizeKey(target.patient_id),
      patient_name: normalizeKey(target.patient_name),
      install_treatment_id: normalizeKey(target.install_treatment_id),
      install_date: normalizeKey(target.install_date).slice(0, 10),
      last_control_treatment_id: normalizeKey(target.last_control_treatment_id),
      last_control_date: normalizeKey(target.last_control_date).slice(0, 10),
      next_due_date: normalizeKey(target.next_due_date).slice(0, 10),
      control_count: Number(target.control_count || 0),
      program_status: normalizeStatus(target.program_status),
      followup_status: normalizeStatus(target.followup_status),
      completed_at: normalizeKey(target.completed_at),
      last_contact_date: normalizeKey(target.last_contact_date),
      last_contact_note: normalizeKey(target.last_contact_note),
      notes: normalizeKey(target.notes),
      updated_at: normalizeKey(target.updated_at)
    } : null;

    addCheck('TARGET_RECALL_BACK_TO_BASELINE',
      target &&
      result.target.program_status === 'active' &&
      result.target.followup_status === 'upcoming' &&
      result.target.next_due_date === '2026-05-22' &&
      result.target.completed_at === '' &&
      result.target.last_contact_date === '' &&
      result.target.last_contact_note === '' &&
      result.target.notes === '',
      result.target || {}
    );

    const testResidueRows = recalls.filter(function(row) {
      const note = normalizeKey(row.notes);
      const contactNote = normalizeKey(row.last_contact_note);

      return note.indexOf('TEST 7F') !== -1 ||
        note.indexOf('[TEST 7F') !== -1 ||
        contactNote.indexOf('TEST 7F') !== -1 ||
        contactNote.indexOf('[TEST 7F') !== -1;
    });

    result.test_residue = {
      residue_count: testResidueRows.length,
      residue_ids: testResidueRows.slice(0, 10).map(function(row) {
        return normalizeKey(row.ortho_recall_id);
      })
    };

    addCheck('NO_TEST_7F_RESIDUE_IN_NOTES_OR_CONTACT_NOTE',
      testResidueRows.length === 0,
      result.test_residue
    );

    let explicitUpdateBlocked = false;
    let explicitUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.ORTHO_RECALL,
        'ortho_recall_id',
        'ORC-7F-FINAL-AUDIT-SHOULD-NOT-UPDATE',
        {
          last_contact_note: 'SHOULD NOT UPDATE - 7F FINAL AUDIT',
          updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
        },
        {
          stage: '7F'
        }
      );
    } catch (errUpdate) {
      explicitUpdateBlocked = true;
      explicitUpdateMessage = errUpdate && errUpdate.message ? errUpdate.message : String(errUpdate || '');
    }

    result.guard_checks.explicit_update_default_off_blocked = explicitUpdateBlocked;
    result.guard_checks.explicit_update_message = explicitUpdateMessage;

    addCheck('EXPLICIT_ORTHO_RECALL_UPDATE_DEFAULT_OFF_BLOCKED',
      explicitUpdateBlocked === true,
      {
        message: explicitUpdateMessage
      }
    );

    let oldDbUpdateSupabaseBlocked = false;
    let oldDbUpdateMessage = '';

    try {
      dbUpdateById_(
        REPO_TABLES.ORTHO_RECALL,
        'ortho_recall_id',
        'ORC-7F-FINAL-AUDIT-SHOULD-NOT-UPDATE',
        {
          last_contact_note: 'SHOULD NOT UPDATE - OLD DB UPDATE FINAL AUDIT',
          updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
        },
        {
          backend_mode: 'supabase'
        }
      );
    } catch (errOldUpdate) {
      oldDbUpdateSupabaseBlocked = true;
      oldDbUpdateMessage = errOldUpdate && errOldUpdate.message ? errOldUpdate.message : String(errOldUpdate || '');
    }

    result.guard_checks.old_db_update_supabase_blocked = oldDbUpdateSupabaseBlocked;
    result.guard_checks.old_db_update_message = oldDbUpdateMessage;

    addCheck('OLD_DB_UPDATE_SUPABASE_STILL_BLOCKED',
      oldDbUpdateSupabaseBlocked === true,
      {
        message: oldDbUpdateMessage
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7F-7-OrthoRecall-FinalAudit',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_AUDIT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}