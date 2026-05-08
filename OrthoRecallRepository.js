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