/* =========================================================
   REPOSITORY READ-ONLY AUDIT
   Tahap 4G - Final Audit Repository Read-Only Lanjutan
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testRepositoryReadOnlyPhase4GFinalAudit() {
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
    repository_audit: {},
    service_bridge_audit: {},
    table_audit: {},
    notes: []
  };

  try {
    if (result.backend_mode !== 'spreadsheet') {
      result.issues.push({
        backend_mode: result.backend_mode,
        issue: 'BACKEND_MODE_NOT_SPREADSHEET'
      });
    }

    const tables = typeof dbInspectAllTables_ === 'function'
      ? dbInspectAllTables_()
      : [];

    result.table_audit.table_count = Array.isArray(tables) ? tables.length : -1;

    if (!Array.isArray(tables) || tables.length !== 15) {
      result.issues.push({
        table_count: result.table_audit.table_count,
        issue: 'EXPECTED_15_TABLES'
      });
    }

    result.table_audit.tables = (Array.isArray(tables) ? tables : []).map(function(table) {
      return {
        sheet_name: table.sheet_name,
        target_table: table.target_table,
        primary_key: table.primary_key,
        data_row_count: table.data_row_count,
        primary_key_exists_in_header: table.primary_key_exists_in_header
      };
    });

    (Array.isArray(tables) ? tables : []).forEach(function(table) {
      if (!table.sheet_exists) {
        result.issues.push({
          sheet_name: table.sheet_name,
          issue: 'SHEET_NOT_FOUND'
        });
      }

      if (!table.primary_key_exists_in_header) {
        result.issues.push({
          sheet_name: table.sheet_name,
          primary_key: table.primary_key,
          issue: 'PRIMARY_KEY_HEADER_NOT_FOUND'
        });
      }
    });

    auditRepositoryReadOnlyShapePhase4G_(
      result,
      'FinanceRepository',
      typeof FinanceRepository !== 'undefined' ? FinanceRepository : null,
      [
        'getBillingsRaw',
        'getBillingItemsRaw',
        'getBillingAdjustmentsRaw',
        'getBillingInstallmentsRaw',
        'getPaymentsRaw',
        'getBillingFeedbacksRaw',
        'findBillingById',
        'buildRawContext',
        'getRawContextRows'
      ]
    );

    auditRepositoryReadOnlyShapePhase4G_(
      result,
      'PatientRepository',
      typeof PatientRepository !== 'undefined' ? PatientRepository : null,
      [
        'getPatientsRaw',
        'getAppointmentsRaw',
        'getTreatmentsRaw',
        'getTreatmentItemsRaw',
        'getMedicalRecordsRaw',
        'getPatientPhotosRaw',
        'getOrthoRecallRaw',
        'findPatientById',
        'buildRawContext',
        'getRawContextRows'
      ]
    );

    auditRepositoryReadOnlyShapePhase4G_(
      result,
      'AppointmentRepository',
      typeof AppointmentRepository !== 'undefined' ? AppointmentRepository : null,
      [
        'getAppointmentsRaw',
        'getPatientsRaw',
        'getTreatmentsRaw',
        'findAppointmentById',
        'findPatientById',
        'listOpenAppointmentsByPatientId',
        'hasOpenAppointmentForPatient',
        'buildRawContext',
        'getRawContextRows'
      ]
    );

    auditRepositoryReadOnlyShapePhase4G_(
      result,
      'MasterDataRepository',
      typeof MasterDataRepository !== 'undefined' ? MasterDataRepository : null,
      [
        'getServiceCatalogRaw',
        'findServiceById',
        'listActiveServices',
        'listActiveOrthoInstallServices',
        'listActiveOrthoControlServices',
        'getServicePriceData',
        'getServiceOrthoFlagsData',
        'buildRawContext',
        'getRawContextRows'
      ]
    );

    auditRepositoryReadOnlyShapePhase4G_(
      result,
      'OrthoRecallRepository',
      typeof OrthoRecallRepository !== 'undefined' ? OrthoRecallRepository : null,
      [
        'getOrthoRecallRaw',
        'getPatientsRaw',
        'getTreatmentsRaw',
        'findOrthoRecallById',
        'findActiveRecallByPatientId',
        'listRecallByPatientId',
        'listActiveRecall',
        'buildRawContext',
        'getRawContextRows'
      ]
    );

    auditRepositoryReadOnlyShapePhase4G_(
      result,
      'TreatmentRepository',
      typeof TreatmentRepository !== 'undefined' ? TreatmentRepository : null,
      [
        'getTreatmentsRaw',
        'getTreatmentItemsRaw',
        'getMedicalRecordsRaw',
        'getAppointmentsRaw',
        'getPatientsRaw',
        'getUsersRaw',
        'getServiceCatalogRaw',
        'findTreatmentById',
        'findTreatmentByAppointmentId',
        'listTreatmentItemsByTreatmentId',
        'listActiveDoctors',
        'findActiveDoctorById',
        'buildRawContext',
        'getRawContextRows'
      ]
    );

    auditServiceBridgeFunctionsPhase4G_(result);

    result.notes.push('Audit ini hanya membaca data dan memeriksa shape repository/service bridge.');
    result.notes.push('Data row count boleh berubah karena aplikasi sudah digunakan.');
    result.notes.push('Finance endpoint yang membutuhkan session_token tidak dites sebagai mutasi.');

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

function auditRepositoryReadOnlyShapePhase4G_(result, repoName, repo, requiredMethods) {
  result.repository_audit[repoName] = {
    exists: !!repo,
    required_methods: {},
    forbidden_write_like_methods: []
  };

  if (!repo) {
    result.issues.push({
      repository: repoName,
      issue: 'REPOSITORY_NOT_FOUND'
    });
    return;
  }

  requiredMethods.forEach(function(methodName) {
    const exists = typeof repo[methodName] === 'function';

    result.repository_audit[repoName].required_methods[methodName] = exists ? 'OK' : 'MISSING';

    if (!exists) {
      result.issues.push({
        repository: repoName,
        method: methodName,
        issue: 'REPOSITORY_METHOD_MISSING'
      });
    }
  });

  const forbiddenWriteLikeMethods = Object.keys(repo).filter(function(key) {
    return /^(create|insert|append|update|delete|remove|clear|save|record|submit)/i.test(key);
  });

  result.repository_audit[repoName].forbidden_write_like_methods = forbiddenWriteLikeMethods;

  if (forbiddenWriteLikeMethods.length) {
    result.issues.push({
      repository: repoName,
      methods: forbiddenWriteLikeMethods,
      issue: 'REPOSITORY_SHOULD_STAY_READ_ONLY_IN_PHASE_4G'
    });
  }
}

function auditServiceBridgeFunctionsPhase4G_(result) {
  const bridgeGroups = {
    finance: [
      'getBillingsRaw',
      'getBillingItemsRaw',
      'getBillingAdjustmentsRaw',
      'getPaymentsRaw',
      'getBillingInstallmentsRaw',
      'getBillingFeedbacksRaw',
      'buildFinanceRawContext_',
      'findBillingRawByIdFromContext_'
    ],
    patient: [
      'getPatientsRaw',
      'findPatientRawById',
      'getMedicalRecordsByPatientId',
      'getTreatmentsByPatientId',
      'getPatientDetailPrimary',
      'getPatientDetailSecondary',
      'getPatientDetailBundle'
    ],
    appointment: [
      'getAppointmentsRaw',
      'findAppointmentRawById',
      'hasOpenAppointmentForPatient',
      'checkPatientOpenAppointment',
      'searchPatientsForAppointment',
      'getAppointmentById'
    ],
    masterData: [
      'getServiceCatalogRaw',
      'getActiveServices',
      'getActiveOrthoInstallServices',
      'getActiveOrthoControlServices',
      'getServiceById',
      'getServiceOrthoFlags'
    ],
    orthoRecall: [
      'getOrthoRecallRaw',
      'findOrthoRecallById',
      'findActiveOrthoRecallByPatientId',
      'getOrthoRecallRowsByPatientId',
      'getPatientOrthoRecallSummary',
      'getOrthoRecallById'
    ],
    treatment: [
      'getTreatmentsRaw',
      'getTreatmentItemsRaw',
      'getMedicalRecordsRaw',
      'getTreatmentByAppointmentId',
      'getActiveDoctors',
      'findActiveDoctorById',
      'getTreatmentInitData',
      'getTreatmentInitDataPreview'
    ]
  };

  Object.keys(bridgeGroups).forEach(function(groupName) {
    result.service_bridge_audit[groupName] = {};

    bridgeGroups[groupName].forEach(function(fnName) {
      const exists = typeof this[fnName] === 'function';

      result.service_bridge_audit[groupName][fnName] = exists ? 'OK' : 'MISSING';

      if (!exists) {
        result.issues.push({
          group: groupName,
          function_name: fnName,
          issue: 'SERVICE_BRIDGE_FUNCTION_MISSING'
        });
      }
    }, this);
  });
}

function testRepositoryReadOnlyPhase4GDataSmokeTest() {
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
    smoke: {}
  };

  try {
    const patients = typeof getPatients === 'function'
      ? getPatients(false)
      : null;

    result.smoke.patients_is_array = Array.isArray(patients);
    result.smoke.patient_count = Array.isArray(patients) ? patients.length : -1;

    if (!Array.isArray(patients)) {
      result.issues.push({
        endpoint: 'getPatients',
        issue: 'GET_PATIENTS_NOT_ARRAY'
      });
    }

    const appointments = typeof getAppointments === 'function'
      ? getAppointments()
      : null;

    result.smoke.appointments_is_array = Array.isArray(appointments);
    result.smoke.appointment_count = Array.isArray(appointments) ? appointments.length : -1;

    if (!Array.isArray(appointments)) {
      result.issues.push({
        endpoint: 'getAppointments',
        issue: 'GET_APPOINTMENTS_NOT_ARRAY'
      });
    }

    const activeServices = typeof getActiveServices === 'function'
      ? getActiveServices()
      : null;

    result.smoke.active_services_ok = !!(
      activeServices &&
      activeServices.success === true &&
      Array.isArray(activeServices.data)
    );

    result.smoke.active_service_count =
      activeServices && Array.isArray(activeServices.data)
        ? activeServices.data.length
        : -1;

    if (!result.smoke.active_services_ok) {
      result.issues.push({
        endpoint: 'getActiveServices',
        issue: 'GET_ACTIVE_SERVICES_FAILED'
      });
    }

    const treatmentPreview = typeof getTreatmentInitDataPreview === 'function'
      ? getTreatmentInitDataPreview()
      : null;

    result.smoke.treatment_preview_ok = !!(
      treatmentPreview &&
      treatmentPreview.success === true &&
      treatmentPreview.data &&
      Array.isArray(treatmentPreview.data.doctors) &&
      Array.isArray(treatmentPreview.data.services)
    );

    result.smoke.treatment_preview_doctor_count =
      treatmentPreview && treatmentPreview.data && Array.isArray(treatmentPreview.data.doctors)
        ? treatmentPreview.data.doctors.length
        : -1;

    result.smoke.treatment_preview_service_count =
      treatmentPreview && treatmentPreview.data && Array.isArray(treatmentPreview.data.services)
        ? treatmentPreview.data.services.length
        : -1;

    if (!result.smoke.treatment_preview_ok) {
      result.issues.push({
        endpoint: 'getTreatmentInitDataPreview',
        issue: 'GET_TREATMENT_INIT_DATA_PREVIEW_FAILED'
      });
    }

    const recalls = typeof getOrthoRecallRaw === 'function'
      ? getOrthoRecallRaw()
      : null;

    result.smoke.ortho_recall_is_array = Array.isArray(recalls);
    result.smoke.ortho_recall_count = Array.isArray(recalls) ? recalls.length : -1;

    if (!Array.isArray(recalls)) {
      result.issues.push({
        endpoint: 'getOrthoRecallRaw',
        issue: 'GET_ORTHO_RECALL_RAW_NOT_ARRAY'
      });
    }

    if (Array.isArray(recalls) && recalls.length) {
      const firstRecall = recalls[0] || {};
      const patientId = String(firstRecall.patient_id || '').trim();
      const recallId = String(firstRecall.ortho_recall_id || '').trim();

      if (patientId && typeof getPatientOrthoRecallSummary === 'function') {
        const summaryRes = getPatientOrthoRecallSummary(patientId);

        result.smoke.patient_ortho_summary_ok = !!(
          summaryRes &&
          summaryRes.success === true &&
          summaryRes.data
        );

        if (!result.smoke.patient_ortho_summary_ok) {
          result.issues.push({
            endpoint: 'getPatientOrthoRecallSummary',
            patient_id: patientId,
            issue: 'GET_PATIENT_ORTHO_SUMMARY_FAILED'
          });
        }
      }

      if (recallId && typeof getOrthoRecallById === 'function') {
        const recallRes = getOrthoRecallById(recallId);

        result.smoke.ortho_recall_by_id_ok = !!(
          recallRes &&
          recallRes.success === true &&
          recallRes.data &&
          String(recallRes.data.ortho_recall_id || '').trim() === recallId
        );

        if (!result.smoke.ortho_recall_by_id_ok) {
          result.issues.push({
            endpoint: 'getOrthoRecallById',
            ortho_recall_id: recallId,
            issue: 'GET_ORTHO_RECALL_BY_ID_FAILED'
          });
        }
      }
    }

    const treatments = typeof getTreatmentsRaw === 'function'
      ? getTreatmentsRaw()
      : null;

    result.smoke.treatments_is_array = Array.isArray(treatments);
    result.smoke.treatment_count = Array.isArray(treatments) ? treatments.length : -1;

    if (!Array.isArray(treatments)) {
      result.issues.push({
        endpoint: 'getTreatmentsRaw',
        issue: 'GET_TREATMENTS_RAW_NOT_ARRAY'
      });
    }

    if (Array.isArray(treatments) && treatments.length) {
      const firstTreatment = treatments[0] || {};
      const appointmentId = String(firstTreatment.appointment_id || '').trim();

      if (appointmentId && typeof getTreatmentByAppointmentId === 'function') {
        const treatmentRes = getTreatmentByAppointmentId(appointmentId);

        result.smoke.treatment_by_appointment_ok = !!(
          treatmentRes &&
          treatmentRes.success === true &&
          treatmentRes.data &&
          treatmentRes.data.treatment
        );

        if (!result.smoke.treatment_by_appointment_ok) {
          result.issues.push({
            endpoint: 'getTreatmentByAppointmentId',
            appointment_id: appointmentId,
            issue: 'GET_TREATMENT_BY_APPOINTMENT_FAILED'
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

function testRepositoryReadOnlyPhase4GRegressionPack() {
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
        name: 'testRepositoryBridgePhase3JFinalReadOnlyAudit',
        fn: typeof testRepositoryBridgePhase3JFinalReadOnlyAudit === 'function'
          ? testRepositoryBridgePhase3JFinalReadOnlyAudit
          : null
      },
      {
        name: 'testRepositoryBridgePhase3JRegressionPack',
        fn: typeof testRepositoryBridgePhase3JRegressionPack === 'function'
          ? testRepositoryBridgePhase3JRegressionPack
          : null
      },
      {
        name: 'testMasterDataServicePhase4BRegressionPack',
        fn: typeof testMasterDataServicePhase4BRegressionPack === 'function'
          ? testMasterDataServicePhase4BRegressionPack
          : null
      },
      {
        name: 'testOrthoRecallServicePhase4DRegressionPack',
        fn: typeof testOrthoRecallServicePhase4DRegressionPack === 'function'
          ? testOrthoRecallServicePhase4DRegressionPack
          : null
      },
      {
        name: 'testTreatmentServicePhase4FRegressionPack',
        fn: typeof testTreatmentServicePhase4FRegressionPack === 'function'
          ? testTreatmentServicePhase4FRegressionPack
          : null
      },
      {
        name: 'testRepositoryReadOnlyPhase4GFinalAudit',
        fn: typeof testRepositoryReadOnlyPhase4GFinalAudit === 'function'
          ? testRepositoryReadOnlyPhase4GFinalAudit
          : null
      },
      {
        name: 'testRepositoryReadOnlyPhase4GDataSmokeTest',
        fn: typeof testRepositoryReadOnlyPhase4GDataSmokeTest === 'function'
          ? testRepositoryReadOnlyPhase4GDataSmokeTest
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

function testMutationPhase7HFinalStagingPreflightLog() {
  const result = {
    success: true,
    stage: '7H-1-Final-Staging-Preflight',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    baseline_counts: {},
    finance_totals: {},
    status_counts: {},
    known_artifacts: {},
    residue_check: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
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
      const key = normalizeStatus(row && row[fieldName]) || '(blank)';
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }

  function containsTestMarker(value) {
    const text = normalizeKey(value);
    return text.indexOf('TEST 7') !== -1 ||
      text.indexOf('[TEST 7') !== -1 ||
      text.indexOf('-7A-') !== -1 ||
      text.indexOf('-7B-') !== -1 ||
      text.indexOf('-7C-') !== -1 ||
      text.indexOf('-7D-') !== -1 ||
      text.indexOf('-7E-') !== -1 ||
      text.indexOf('-7F-') !== -1 ||
      text.indexOf('-7G-') !== -1 ||
      text.indexOf('ZZ_TEST_7') !== -1 ||
      text.indexOf('TOKEN-7G') !== -1 ||
      text.indexOf('INV-7G') !== -1 ||
      text.indexOf('INV-20270103-7E001') !== -1;
  }

  function countRowsWithAnyTestMarker(rows, fields) {
    return (rows || []).filter(function(row) {
      return (fields || []).some(function(fieldName) {
        return containsTestMarker(row && row[fieldName]);
      });
    }).length;
  }

  function findByField(rows, fieldName, value) {
    const target = normalizeKey(value);

    return (rows || []).find(function(row) {
      return normalizeKey(row && row[fieldName]) === target;
    }) || null;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('ALL_FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false,
      result.flags
    );

    const appUsers = typeof TreatmentRepository !== 'undefined' && typeof TreatmentRepository.getUsersRaw === 'function'
      ? TreatmentRepository.getUsersRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.USERS, supabaseOptions);

    const patients = typeof PatientRepository !== 'undefined' && typeof PatientRepository.getPatientsRaw === 'function'
      ? PatientRepository.getPatientsRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.PATIENTS, supabaseOptions);

    const serviceCatalog = typeof MasterDataRepository !== 'undefined' && typeof MasterDataRepository.getServiceCatalogRaw === 'function'
      ? MasterDataRepository.getServiceCatalogRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions);

    const appointments = typeof AppointmentRepository !== 'undefined' && typeof AppointmentRepository.getAppointmentsRaw === 'function'
      ? AppointmentRepository.getAppointmentsRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.APPOINTMENTS, supabaseOptions);

    const treatments = typeof TreatmentRepository !== 'undefined' && typeof TreatmentRepository.getTreatmentsRaw === 'function'
      ? TreatmentRepository.getTreatmentsRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.TREATMENTS, supabaseOptions);

    const treatmentItems = typeof TreatmentRepository !== 'undefined' && typeof TreatmentRepository.getTreatmentItemsRaw === 'function'
      ? TreatmentRepository.getTreatmentItemsRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, supabaseOptions);

    const medicalRecords = typeof TreatmentRepository !== 'undefined' && typeof TreatmentRepository.getMedicalRecordsRaw === 'function'
      ? TreatmentRepository.getMedicalRecordsRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, supabaseOptions);

    const patientPhotos = typeof PatientRepository !== 'undefined' && typeof PatientRepository.getPatientPhotosRaw === 'function'
      ? PatientRepository.getPatientPhotosRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.PATIENT_PHOTOS, supabaseOptions);

    const orthoRecalls = typeof OrthoRecallRepository !== 'undefined' && typeof OrthoRecallRepository.getOrthoRecallRaw === 'function'
      ? OrthoRecallRepository.getOrthoRecallRaw(supabaseOptions)
      : dbFindAll_(REPO_TABLES.ORTHO_RECALL, supabaseOptions);

    const billings = FinanceRepository.getBillingsRaw(supabaseOptions);
    const billingItems = FinanceRepository.getBillingItemsRaw(supabaseOptions);
    const billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(supabaseOptions);
    const billingInstallments = FinanceRepository.getBillingInstallmentsRaw(supabaseOptions);
    const payments = FinanceRepository.getPaymentsRaw(supabaseOptions);
    const billingFeedbacks = FinanceRepository.getBillingFeedbacksRaw(supabaseOptions);

    result.baseline_counts = {
      app_users: appUsers.length,
      patients: patients.length,
      service_catalog: serviceCatalog.length,
      appointments: appointments.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      medical_records: medicalRecords.length,
      patient_photos: patientPhotos.length,
      ortho_recalls: orthoRecalls.length,
      billings: billings.length,
      billing_items: billingItems.length,
      billing_adjustments: billingAdjustments.length,
      billing_installments: billingInstallments.length,
      payments: payments.length,
      billing_feedbacks: billingFeedbacks.length
    };

    addCheck('BASELINE_COUNTS_ALL_MODULES_MATCH_EXPECTED',
      result.baseline_counts.app_users === 8 &&
        result.baseline_counts.patients === 285 &&
        result.baseline_counts.service_catalog === 100 &&
        result.baseline_counts.appointments === 284 &&
        result.baseline_counts.treatments === 254 &&
        result.baseline_counts.treatment_items === 489 &&
        result.baseline_counts.medical_records === 254 &&
        result.baseline_counts.patient_photos === 241 &&
        result.baseline_counts.ortho_recalls === 124 &&
        result.baseline_counts.billings === 46 &&
        result.baseline_counts.billing_items === 99 &&
        result.baseline_counts.billing_adjustments === 1 &&
        result.baseline_counts.billing_installments === 0 &&
        result.baseline_counts.payments === 44 &&
        result.baseline_counts.billing_feedbacks === 0,
      result.baseline_counts
    );

    result.finance_totals = {
      billings_subtotal: sumAmount(billings, 'subtotal'),
      billings_discount_total: sumAmount(billings, 'discount_total'),
      billings_grand_total: sumAmount(billings, 'grand_total'),
      billings_paid_total: sumAmount(billings, 'paid_total'),
      billings_outstanding_total: sumAmount(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(billingAdjustments, 'amount'),
      billing_installments_amount_due: sumAmount(billingInstallments, 'amount_due'),
      billing_installments_paid_amount: sumAmount(billingInstallments, 'paid_amount'),
      payments_amount: sumAmount(payments, 'amount')
    };

    addCheck('FINANCE_TOTALS_MATCH_EXPECTED',
      result.finance_totals.billings_subtotal === 15136500 &&
        result.finance_totals.billings_discount_total === 100000 &&
        result.finance_totals.billings_grand_total === 15036500 &&
        result.finance_totals.billings_paid_total === 15035000 &&
        result.finance_totals.billings_outstanding_total === 1500 &&
        result.finance_totals.billing_items_subtotal === 15136500 &&
        result.finance_totals.billing_adjustments_amount === 100000 &&
        result.finance_totals.billing_installments_amount_due === 0 &&
        result.finance_totals.billing_installments_paid_amount === 0 &&
        result.finance_totals.payments_amount === 15035000,
      result.finance_totals
    );

    result.status_counts = {
      appointments: countByStatus(appointments, 'status'),
      ortho_program_status: countByStatus(orthoRecalls, 'program_status'),
      ortho_followup_status: countByStatus(orthoRecalls, 'followup_status'),
      billing_status: countByStatus(billings, 'billing_status'),
      payment_status: countByStatus(billings, 'payment_status')
    };

    addCheck('STATUS_COUNTS_MATCH_EXPECTED',
      result.status_counts.appointments.scheduled === 6 &&
        result.status_counts.appointments.completed === 255 &&
        result.status_counts.appointments.cancelled === 23 &&
        result.status_counts.ortho_program_status.active === 124 &&
        result.status_counts.ortho_followup_status.upcoming === 124,
      result.status_counts
    );

    const patientIndex = buildIndexByField(patients, 'patient_id');
    const appointmentIndex = buildIndexByField(appointments, 'appointment_id');
    const treatmentIndex = buildIndexByField(treatments, 'treatment_id');
    const treatmentItemIndex = buildIndexByField(treatmentItems, 'treatment_item_id');
    const serviceIndex = buildIndexByField(serviceCatalog, 'service_id');
    const billingIndex = buildIndexByField(billings, 'billing_id');

    const orthoMissingPatient = orthoRecalls.filter(function(row) {
      const patientId = normalizeKey(row.patient_id);
      return patientId && !patientIndex[patientId];
    });

    const orthoMissingInstallTreatment = orthoRecalls.filter(function(row) {
      const treatmentId = normalizeKey(row.install_treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const orthoMissingLastControlTreatment = orthoRecalls.filter(function(row) {
      const treatmentId = normalizeKey(row.last_control_treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingsMissingPatient = billings.filter(function(row) {
      const patientId = normalizeKey(row.patient_id);
      return patientId && !patientIndex[patientId];
    });

    const billingsMissingTreatment = billings.filter(function(row) {
      const treatmentId = normalizeKey(row.treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingsMissingAppointment = billings.filter(function(row) {
      const appointmentId = normalizeKey(row.appointment_id);
      return appointmentId && !appointmentIndex[appointmentId];
    });

    const billingItemsMissingBilling = billingItems.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const billingItemsMissingTreatment = billingItems.filter(function(row) {
      const treatmentId = normalizeKey(row.treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingItemsMissingTreatmentItem = billingItems.filter(function(row) {
      const treatmentItemId = normalizeKey(row.treatment_item_id);
      return treatmentItemId && !treatmentItemIndex[treatmentItemId];
    });

    const billingItemsMissingService = billingItems.filter(function(row) {
      const serviceId = normalizeKey(row.service_id);
      return serviceId && !serviceIndex[serviceId];
    });

    const adjustmentsMissingBilling = billingAdjustments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const installmentsMissingBilling = billingInstallments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const paymentsMissingBilling = payments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const feedbacksMissingBilling = billingFeedbacks.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    result.known_artifacts = {
      ortho_recall_missing_patient_count: orthoMissingPatient.length,
      ortho_recall_install_treatment_missing_parent_count: orthoMissingInstallTreatment.length,
      ortho_recall_last_control_treatment_missing_parent_count: orthoMissingLastControlTreatment.length,
      billings_missing_patient_count: billingsMissingPatient.length,
      billings_missing_treatment_count: billingsMissingTreatment.length,
      billings_missing_appointment_count: billingsMissingAppointment.length,
      billing_items_missing_billing_count: billingItemsMissingBilling.length,
      billing_items_missing_treatment_count: billingItemsMissingTreatment.length,
      billing_items_missing_treatment_item_count: billingItemsMissingTreatmentItem.length,
      billing_items_missing_service_count: billingItemsMissingService.length,
      adjustments_missing_billing_count: adjustmentsMissingBilling.length,
      installments_missing_billing_count: installmentsMissingBilling.length,
      payments_missing_billing_count: paymentsMissingBilling.length,
      feedbacks_missing_billing_count: feedbacksMissingBilling.length
    };

    addCheck('KNOWN_MANUAL_ARTIFACTS_MATCH_EXPECTED',
      result.known_artifacts.ortho_recall_missing_patient_count === 0 &&
        result.known_artifacts.ortho_recall_install_treatment_missing_parent_count === 1 &&
        result.known_artifacts.ortho_recall_last_control_treatment_missing_parent_count === 0 &&
        result.known_artifacts.billings_missing_patient_count === 0 &&
        result.known_artifacts.billings_missing_treatment_count === 1 &&
        result.known_artifacts.billings_missing_appointment_count === 0 &&
        result.known_artifacts.billing_items_missing_billing_count === 0 &&
        result.known_artifacts.billing_items_missing_treatment_count === 1 &&
        result.known_artifacts.billing_items_missing_treatment_item_count === 1 &&
        result.known_artifacts.billing_items_missing_service_count === 0 &&
        result.known_artifacts.adjustments_missing_billing_count === 0 &&
        result.known_artifacts.installments_missing_billing_count === 0 &&
        result.known_artifacts.payments_missing_billing_count === 0 &&
        result.known_artifacts.feedbacks_missing_billing_count === 0,
      Object.assign({}, result.known_artifacts, {
        expected_known_artifacts: {
          ortho_recall_install_treatment_missing_parent_count: 1,
          billings_missing_treatment_count: 1,
          billing_items_missing_treatment_count: 1,
          billing_items_missing_treatment_item_count: 1
        }
      })
    );

    result.residue_check = {
      service_7b_exists: !!findByField(serviceCatalog, 'service_id', 'SRV-7B-TEST-001'),
      patient_7c_exists: !!findByField(patients, 'patient_id', 'PAT-7C-TEST-001'),
      appointment_7d_exists: !!findByField(appointments, 'appointment_id', 'APT-7D-TEST-001'),
      treatment_7e_exists: !!findByField(treatments, 'treatment_id', 'TRX-7E-TEST-001'),
      treatment_item_7e_exists: !!findByField(treatmentItems, 'treatment_item_id', 'TRI-7E-TEST-001'),
      medical_record_7e_exists: !!findByField(medicalRecords, 'medical_record_id', 'MRD-7E-TEST-001'),
      billing_7e_exists: !!findByField(billings, 'billing_id', 'BIL-7E-TEST-001'),
      billing_item_7e_exists: !!findByField(billingItems, 'billing_item_id', 'BII-7E-TEST-001'),
      payment_7g_exists: !!findByField(payments, 'payment_id', 'PAY-7G-TEST-001'),
      adjustment_7g_exists: !!findByField(billingAdjustments, 'adjustment_id', 'ADJ-7G-TEST-001'),
      installment_7g_1_exists: !!findByField(billingInstallments, 'installment_id', 'INS-7G-TEST-001'),
      installment_7g_2_exists: !!findByField(billingInstallments, 'installment_id', 'INS-7G-TEST-002'),
      feedback_7g_exists: !!findByField(billingFeedbacks, 'feedback_id', 'FBK-7G-TEST-001'),
      feedback_token_7g_exists: !!findByField(billingFeedbacks, 'feedback_token', 'TOKEN-7G-TEST-001'),
      draft_billing_7g_exists: !!findByField(billings, 'billing_id', 'BIL-7G-TEST-001'),
      draft_billing_item_7g_exists: !!findByField(billingItems, 'billing_item_id', 'BII-7G-TEST-001'),

      service_text_residue_count: countRowsWithAnyTestMarker(serviceCatalog, ['service_id', 'service_name', 'description']),
      patient_text_residue_count: countRowsWithAnyTestMarker(patients, ['patient_id', 'patient_code', 'full_name', 'email', 'notes', 'medical_notes', 'allergy_notes']),
      appointment_text_residue_count: countRowsWithAnyTestMarker(appointments, ['appointment_id', 'complaint', 'notes']),
      treatment_text_residue_count: countRowsWithAnyTestMarker(treatments, ['treatment_id', 'notes']),
      treatment_item_text_residue_count: countRowsWithAnyTestMarker(treatmentItems, ['treatment_item_id', 'treatment_id', 'notes']),
      medical_record_text_residue_count: countRowsWithAnyTestMarker(medicalRecords, ['medical_record_id', 'treatment_id', 'notes', 'diagnosis', 'action_taken']),
      ortho_recall_text_residue_count: countRowsWithAnyTestMarker(orthoRecalls, ['ortho_recall_id', 'notes', 'last_contact_note']),
      billing_text_residue_count: countRowsWithAnyTestMarker(billings, ['billing_id', 'billing_number', 'notes', 'invoice_pdf_file_id', 'invoice_pdf_signature']),
      billing_item_text_residue_count: countRowsWithAnyTestMarker(billingItems, ['billing_item_id', 'billing_id']),
      adjustment_text_residue_count: countRowsWithAnyTestMarker(billingAdjustments, ['adjustment_id', 'label', 'reason']),
      installment_text_residue_count: countRowsWithAnyTestMarker(billingInstallments, ['installment_id', 'notes']),
      payment_text_residue_count: countRowsWithAnyTestMarker(payments, ['payment_id', 'reference_no', 'notes']),
      feedback_text_residue_count: countRowsWithAnyTestMarker(billingFeedbacks, ['feedback_id', 'feedback_token', 'comment'])
    };

    addCheck('NO_TEST_RESIDUE_FROM_7A_TO_7G',
      Object.keys(result.residue_check).every(function(key) {
        return result.residue_check[key] === false || result.residue_check[key] === 0;
      }),
      result.residue_check
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7H-1-Final-Staging-Preflight',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_STAGING_PREFLIGHT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testMutationPhase7HCrossModuleGuardCompactLog() {
  const result = {
    success: true,
    stage: '7H-2-CrossModule-MutationGuard-Compact',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    before_counts: {},
    after_counts: {},
    before_finance_totals: {},
    after_finance_totals: {},
    blocked_summary: {
      expected_blocked: 0,
      blocked_count: 0,
      failed_to_block: []
    },
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function loadCounts(options) {
    const appUsers = dbFindAll_(REPO_TABLES.USERS, options);
    const patients = dbFindAll_(REPO_TABLES.PATIENTS, options);
    const serviceCatalog = dbFindAll_(REPO_TABLES.SERVICE_CATALOG, options);
    const appointments = dbFindAll_(REPO_TABLES.APPOINTMENTS, options);
    const treatments = dbFindAll_(REPO_TABLES.TREATMENTS, options);
    const treatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, options);
    const medicalRecords = dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, options);
    const patientPhotos = dbFindAll_(REPO_TABLES.PATIENT_PHOTOS, options);
    const orthoRecalls = dbFindAll_(REPO_TABLES.ORTHO_RECALL, options);

    const billings = FinanceRepository.getBillingsRaw(options);
    const billingItems = FinanceRepository.getBillingItemsRaw(options);
    const billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(options);
    const billingInstallments = FinanceRepository.getBillingInstallmentsRaw(options);
    const payments = FinanceRepository.getPaymentsRaw(options);
    const billingFeedbacks = FinanceRepository.getBillingFeedbacksRaw(options);

    return {
      app_users: appUsers.length,
      patients: patients.length,
      service_catalog: serviceCatalog.length,
      appointments: appointments.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      medical_records: medicalRecords.length,
      patient_photos: patientPhotos.length,
      ortho_recalls: orthoRecalls.length,
      billings: billings.length,
      billing_items: billingItems.length,
      billing_adjustments: billingAdjustments.length,
      billing_installments: billingInstallments.length,
      payments: payments.length,
      billing_feedbacks: billingFeedbacks.length
    };
  }

  function loadFinanceTotals(options) {
    const billings = FinanceRepository.getBillingsRaw(options);
    const billingItems = FinanceRepository.getBillingItemsRaw(options);
    const billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(options);
    const billingInstallments = FinanceRepository.getBillingInstallmentsRaw(options);
    const payments = FinanceRepository.getPaymentsRaw(options);

    return {
      billings_subtotal: sumAmount(billings, 'subtotal'),
      billings_discount_total: sumAmount(billings, 'discount_total'),
      billings_grand_total: sumAmount(billings, 'grand_total'),
      billings_paid_total: sumAmount(billings, 'paid_total'),
      billings_outstanding_total: sumAmount(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(billingAdjustments, 'amount'),
      billing_installments_amount_due: sumAmount(billingInstallments, 'amount_due'),
      billing_installments_paid_amount: sumAmount(billingInstallments, 'paid_amount'),
      payments_amount: sumAmount(payments, 'amount')
    };
  }

  function attemptBlocked(name, fn) {
    result.blocked_summary.expected_blocked++;

    try {
      fn();
      result.blocked_summary.failed_to_block.push(name);
      return false;
    } catch (err) {
      result.blocked_summary.blocked_count++;
      return true;
    }
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false,
      result.flags
    );

    if (result.flags.supabase_staging_write_test_enabled !== false) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_FALSE_ABORTING_CROSS_MODULE_GUARD_TEST',
        actual: result.flags.supabase_staging_write_test_enabled
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result));
      return result;
    }

    result.before_counts = loadCounts(supabaseOptions);
    result.before_finance_totals = loadFinanceTotals(supabaseOptions);

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.app_users === 8 &&
        result.before_counts.patients === 285 &&
        result.before_counts.service_catalog === 100 &&
        result.before_counts.appointments === 284 &&
        result.before_counts.treatments === 254 &&
        result.before_counts.treatment_items === 489 &&
        result.before_counts.medical_records === 254 &&
        result.before_counts.patient_photos === 241 &&
        result.before_counts.ortho_recalls === 124 &&
        result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_FINANCE_TOTALS_OK',
      result.before_finance_totals.billings_subtotal === 15136500 &&
        result.before_finance_totals.billings_discount_total === 100000 &&
        result.before_finance_totals.billings_grand_total === 15036500 &&
        result.before_finance_totals.billings_paid_total === 15035000 &&
        result.before_finance_totals.billings_outstanding_total === 1500 &&
        result.before_finance_totals.billing_items_subtotal === 15136500 &&
        result.before_finance_totals.billing_adjustments_amount === 100000 &&
        result.before_finance_totals.billing_installments_amount_due === 0 &&
        result.before_finance_totals.billing_installments_paid_amount === 0 &&
        result.before_finance_totals.payments_amount === 15035000,
      result.before_finance_totals
    );

    /*
     * MasterData / service_catalog
     */
    attemptBlocked('service_catalog_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.SERVICE_CATALOG, {
        service_id: 'SRV-7H-GUARD-SHOULD-NOT-INSERT',
        service_name: 'TEST 7H Guard Service',
        default_price: 1000,
        is_active: true,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('service_catalog_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.SERVICE_CATALOG, 'service_id', 'SRV-001', {
        service_name: 'SHOULD NOT UPDATE 7H',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('service_catalog_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.SERVICE_CATALOG, 'service_id', 'SRV-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * Patients
     */
    attemptBlocked('patient_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.PATIENTS, {
        patient_id: 'PAT-7H-GUARD-SHOULD-NOT-INSERT',
        patient_code: 'RM-7H-GUARD',
        full_name: 'TEST 7H Guard Patient',
        is_active: true,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('patient_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.PATIENTS, 'patient_id', 'PAT-0001', {
        full_name: 'SHOULD NOT UPDATE 7H',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('patient_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.PATIENTS, 'patient_id', 'PAT-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * Appointments
     */
    attemptBlocked('appointment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.APPOINTMENTS, {
        appointment_id: 'APT-7H-GUARD-SHOULD-NOT-INSERT',
        patient_id: 'PAT-0001',
        appointment_date: '2027-01-01',
        appointment_time: '09:00',
        status: 'scheduled',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('appointment_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.APPOINTMENTS, 'appointment_id', 'APT-0001', {
        status: 'cancelled',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('appointment_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.APPOINTMENTS, 'appointment_id', 'APT-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * Treatments
     */
    attemptBlocked('treatment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.TREATMENTS, {
        treatment_id: 'TRX-7H-GUARD-SHOULD-NOT-INSERT',
        appointment_id: 'APT-0001',
        patient_id: 'PAT-0001',
        treatment_date: '2027-01-01',
        status: 'completed',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('treatment_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.TREATMENTS, 'treatment_id', 'TRX-0001', {
        notes: 'SHOULD NOT UPDATE 7H',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('treatment_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.TREATMENTS, 'treatment_id', 'TRX-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * TreatmentItems
     * Update/delete intentionally use Supabase UUID key 'id' to preserve rule:
     * never mutate TreatmentItems by legacy treatment_item_id.
     */
    attemptBlocked('treatment_item_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.TREATMENT_ITEMS, {
        treatment_item_id: 'TRI-7H-GUARD-SHOULD-NOT-INSERT',
        treatment_id: 'TRX-0001',
        service_id: 'SRV-001',
        service_name: 'TEST 7H Guard Treatment Item',
        qty: 1,
        unit_price: 1000,
        subtotal: 1000,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('treatment_item_update_by_uuid_key', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.TREATMENT_ITEMS, 'id', '00000000-0000-0000-0000-000000000000', {
        notes: 'SHOULD NOT UPDATE 7H',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('treatment_item_delete_by_uuid_key', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.TREATMENT_ITEMS, 'id', '00000000-0000-0000-0000-000000000000', {
        stage: '7H'
      });
    });

    /*
     * MedicalRecords
     */
    attemptBlocked('medical_record_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.MEDICAL_RECORDS, {
        medical_record_id: 'MRD-7H-GUARD-SHOULD-NOT-INSERT',
        patient_id: 'PAT-0001',
        treatment_id: 'TRX-0001',
        record_date: '2027-01-01',
        diagnosis: 'TEST 7H Guard',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('medical_record_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.MEDICAL_RECORDS, 'medical_record_id', 'MRD-0001', {
        notes: 'SHOULD NOT UPDATE 7H',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('medical_record_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.MEDICAL_RECORDS, 'medical_record_id', 'MRD-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * PatientPhotos
     */
    attemptBlocked('patient_photo_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.PATIENT_PHOTOS, {
        photo_id: 'PHT-7H-GUARD-SHOULD-NOT-INSERT',
        patient_id: 'PAT-0001',
        file_id: 'FILE-7H-GUARD',
        file_url: 'https://example.com/7h-guard-photo.jpg',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('patient_photo_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.PATIENT_PHOTOS, 'photo_id', 'PHT-0001', {
        notes: 'SHOULD NOT UPDATE 7H',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('patient_photo_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.PATIENT_PHOTOS, 'photo_id', 'PHT-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * OrthoRecall
     */
    attemptBlocked('ortho_recall_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.ORTHO_RECALL, {
        ortho_recall_id: 'ORC-7H-GUARD-SHOULD-NOT-INSERT',
        patient_id: 'PAT-0001',
        program_status: 'active',
        followup_status: 'upcoming',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('ortho_recall_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.ORTHO_RECALL, 'ortho_recall_id', 'ORC-20260424-153834842-468', {
        followup_status: 'due',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('ortho_recall_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.ORTHO_RECALL, 'ortho_recall_id', 'ORC-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    /*
     * Finance
     */
    attemptBlocked('billing_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7H-GUARD-SHOULD-NOT-INSERT',
        billing_number: 'INV-7H-GUARD',
        patient_id: 'PAT-0001',
        billing_date: '2027-01-01',
        due_date: '2027-01-01',
        subtotal: 1000,
        discount_total: 0,
        grand_total: 1000,
        paid_total: 0,
        outstanding_total: 1000,
        payment_status: 'unpaid',
        billing_status: 'draft',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('billing_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', 'BIL-20260505-140855694-907', {
        paid_total: 1500,
        outstanding_total: 0,
        payment_status: 'paid',
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('billing_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', 'BIL-7H-GUARD-SHOULD-NOT-DELETE', {
        stage: '7H'
      });
    });

    attemptBlocked('billing_item_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_ITEMS, {
        billing_item_id: 'BII-7H-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-20260505-140855694-907',
        treatment_id: 'TRX-20260505-140852497-988',
        service_id: 'SRV-089',
        service_name: 'TEST 7H Guard Billing Item',
        qty: 1,
        unit_price: 1000,
        subtotal: 1000,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('adjustment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_ADJUSTMENTS, {
        adjustment_id: 'ADJ-7H-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-20260505-140855694-907',
        adjustment_type: 'discount',
        label: 'TEST 7H Guard',
        amount: 100,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('installment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_INSTALLMENTS, {
        installment_id: 'INS-7H-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-20260505-140855694-907',
        installment_no: 1,
        due_date: '2027-01-01',
        amount_due: 1000,
        paid_amount: 0,
        status: 'pending',
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('payment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.PAYMENTS, {
        payment_id: 'PAY-7H-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-20260505-140855694-907',
        payment_scope: 'full',
        payment_date: '2027-01-01',
        payment_method: 'cash',
        amount: 1000,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    attemptBlocked('feedback_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_FEEDBACKS, {
        feedback_id: 'FBK-7H-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-20260505-140855694-907',
        feedback_token: 'TOKEN-7H-GUARD',
        feedback_status: 'pending',
        rating: null,
        service_quality: '',
        staff_friendliness: '',
        clinic_cleanliness: '',
        waiting_time: '',
        comment: '',
        submitted_at: null,
        created_at: now,
        updated_at: now
      }, { stage: '7H' });
    });

    /*
     * Legacy db write routes to Supabase must remain blocked.
     */
    attemptBlocked('old_db_insert_supabase', function() {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'PAT-7H-OLD-DB-SHOULD-NOT-INSERT'
      }, { backend_mode: 'supabase' });
    });

    attemptBlocked('old_db_update_supabase', function() {
      dbUpdateById_(REPO_TABLES.PATIENTS, 'patient_id', 'PAT-0001', {
        full_name: 'SHOULD NOT UPDATE 7H OLD DB'
      }, { backend_mode: 'supabase' });
    });

    attemptBlocked('old_db_delete_supabase', function() {
      dbDeleteById_(REPO_TABLES.PATIENTS, 'patient_id', 'PAT-7H-OLD-DB-SHOULD-NOT-DELETE', {
        backend_mode: 'supabase'
      });
    });

    addCheck('ALL_CROSS_MODULE_WRITE_ATTEMPTS_BLOCKED',
      result.blocked_summary.blocked_count === result.blocked_summary.expected_blocked &&
        result.blocked_summary.failed_to_block.length === 0,
      result.blocked_summary
    );

    result.after_counts = loadCounts(supabaseOptions);
    result.after_finance_totals = loadFinanceTotals(supabaseOptions);

    addCheck('COUNTS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('FINANCE_TOTALS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      JSON.stringify(result.after_finance_totals) === JSON.stringify(result.before_finance_totals),
      {
        before: result.before_finance_totals,
        after: result.after_finance_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7H-2-CrossModule-MutationGuard-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'CROSS_MODULE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testMutationPhase7HFinalRegressionSummaryLog() {
  const result = {
    success: true,
    stage: '7H-3-Final-Mutation-Regression-Summary',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    phase_7_summary: {
      completed_clean: [
        '7A-write-layer-guard',
        '7B-service-catalog-mutation',
        '7C-patient-mutation',
        '7D-appointment-mutation',
        '7E-treatment-create-non-ortho',
        '7F-ortho-recall-mutation',
        '7G-finance-mutation',
        '7H-final-staging-regression'
      ],
      cutover_done: false,
      production_crud_routed_to_supabase: false,
      supabase_scope: 'staging/test only'
    },
    final_counts: {},
    final_finance_totals: {},
    final_status_counts: {},
    readiness: {
      ready_for_phase_8_cutover_plan: false,
      reason: ''
    },
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function countByStatus(rows, fieldName) {
    const counts = {};

    (rows || []).forEach(function(row) {
      const key = normalizeStatus(row && row[fieldName]) || '(blank)';
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('FLAGS_SAFE_FOR_END_OF_PHASE_7',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false,
      result.flags
    );

    const appUsers = dbFindAll_(REPO_TABLES.USERS, supabaseOptions);
    const patients = dbFindAll_(REPO_TABLES.PATIENTS, supabaseOptions);
    const serviceCatalog = dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions);
    const appointments = dbFindAll_(REPO_TABLES.APPOINTMENTS, supabaseOptions);
    const treatments = dbFindAll_(REPO_TABLES.TREATMENTS, supabaseOptions);
    const treatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, supabaseOptions);
    const medicalRecords = dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, supabaseOptions);
    const patientPhotos = dbFindAll_(REPO_TABLES.PATIENT_PHOTOS, supabaseOptions);
    const orthoRecalls = dbFindAll_(REPO_TABLES.ORTHO_RECALL, supabaseOptions);

    const billings = FinanceRepository.getBillingsRaw(supabaseOptions);
    const billingItems = FinanceRepository.getBillingItemsRaw(supabaseOptions);
    const billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(supabaseOptions);
    const billingInstallments = FinanceRepository.getBillingInstallmentsRaw(supabaseOptions);
    const payments = FinanceRepository.getPaymentsRaw(supabaseOptions);
    const billingFeedbacks = FinanceRepository.getBillingFeedbacksRaw(supabaseOptions);

    result.final_counts = {
      app_users: appUsers.length,
      patients: patients.length,
      service_catalog: serviceCatalog.length,
      appointments: appointments.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      medical_records: medicalRecords.length,
      patient_photos: patientPhotos.length,
      ortho_recalls: orthoRecalls.length,
      billings: billings.length,
      billing_items: billingItems.length,
      billing_adjustments: billingAdjustments.length,
      billing_installments: billingInstallments.length,
      payments: payments.length,
      billing_feedbacks: billingFeedbacks.length
    };

    addCheck('FINAL_COUNTS_MATCH_STAGING_BASELINE',
      result.final_counts.app_users === 8 &&
        result.final_counts.patients === 285 &&
        result.final_counts.service_catalog === 100 &&
        result.final_counts.appointments === 284 &&
        result.final_counts.treatments === 254 &&
        result.final_counts.treatment_items === 489 &&
        result.final_counts.medical_records === 254 &&
        result.final_counts.patient_photos === 241 &&
        result.final_counts.ortho_recalls === 124 &&
        result.final_counts.billings === 46 &&
        result.final_counts.billing_items === 99 &&
        result.final_counts.billing_adjustments === 1 &&
        result.final_counts.billing_installments === 0 &&
        result.final_counts.payments === 44 &&
        result.final_counts.billing_feedbacks === 0,
      result.final_counts
    );

    result.final_finance_totals = {
      billings_subtotal: sumAmount(billings, 'subtotal'),
      billings_discount_total: sumAmount(billings, 'discount_total'),
      billings_grand_total: sumAmount(billings, 'grand_total'),
      billings_paid_total: sumAmount(billings, 'paid_total'),
      billings_outstanding_total: sumAmount(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(billingAdjustments, 'amount'),
      billing_installments_amount_due: sumAmount(billingInstallments, 'amount_due'),
      billing_installments_paid_amount: sumAmount(billingInstallments, 'paid_amount'),
      payments_amount: sumAmount(payments, 'amount')
    };

    addCheck('FINAL_FINANCE_TOTALS_MATCH_BASELINE',
      result.final_finance_totals.billings_subtotal === 15136500 &&
        result.final_finance_totals.billings_discount_total === 100000 &&
        result.final_finance_totals.billings_grand_total === 15036500 &&
        result.final_finance_totals.billings_paid_total === 15035000 &&
        result.final_finance_totals.billings_outstanding_total === 1500 &&
        result.final_finance_totals.billing_items_subtotal === 15136500 &&
        result.final_finance_totals.billing_adjustments_amount === 100000 &&
        result.final_finance_totals.billing_installments_amount_due === 0 &&
        result.final_finance_totals.billing_installments_paid_amount === 0 &&
        result.final_finance_totals.payments_amount === 15035000,
      result.final_finance_totals
    );

    result.final_status_counts = {
      appointments: countByStatus(appointments, 'status'),
      ortho_program_status: countByStatus(orthoRecalls, 'program_status'),
      ortho_followup_status: countByStatus(orthoRecalls, 'followup_status'),
      billing_status: countByStatus(billings, 'billing_status'),
      payment_status: countByStatus(billings, 'payment_status')
    };

    addCheck('FINAL_STATUS_COUNTS_MATCH_BASELINE',
      result.final_status_counts.appointments.scheduled === 6 &&
        result.final_status_counts.appointments.completed === 255 &&
        result.final_status_counts.appointments.cancelled === 23 &&
        result.final_status_counts.ortho_program_status.active === 124 &&
        result.final_status_counts.ortho_followup_status.upcoming === 124 &&
        result.final_status_counts.billing_status.draft === 46 &&
        result.final_status_counts.payment_status.paid === 45 &&
        result.final_status_counts.payment_status.unpaid === 1,
      result.final_status_counts
    );

    addCheck('NO_CUTOVER_OR_PRODUCTION_CRUD_ROUTE_DONE',
      result.phase_7_summary.cutover_done === false &&
        result.phase_7_summary.production_crud_routed_to_supabase === false &&
        result.phase_7_summary.supabase_scope === 'staging/test only',
      result.phase_7_summary
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    result.readiness.ready_for_phase_8_cutover_plan = result.success === true;
    result.readiness.reason = result.success
      ? 'Fase 7 mutation regression staging clean; siap masuk Fase 8 cutover plan tanpa melakukan cutover otomatis.'
      : 'Belum siap masuk Fase 8 karena masih ada failed checks.';

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7H-3-Final-Mutation-Regression-Summary',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MUTATION_REGRESSION_SUMMARY_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      readiness: {
        ready_for_phase_8_cutover_plan: false,
        reason: 'Error saat final summary.'
      }
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8AReadinessStrategyLog() {
  const result = {
    success: true,
    stage: '8A-1-Cutover-Readiness-Strategy',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    cutover_status: {
      cutover_done: false,
      production_crud_routed_to_supabase: false,
      frontend_direct_supabase: false,
      spreadsheet_still_source_of_truth: true,
      supabase_scope: 'staging/test'
    },
    baseline_counts: {},
    finance_totals: {},
    status_counts: {},
    known_artifacts: {},
    schema_readiness: {},
    readiness: {
      ready_for_8B_freeze_mode_design: false,
      next_phase: '8B-Freeze-Mode-Maintenance-Guard',
      reason: ''
    },
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function countByStatus(rows, fieldName) {
    const counts = {};

    (rows || []).forEach(function(row) {
      const key = normalizeStatus(row && row[fieldName]) || '(blank)';
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
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

  function checkSupabaseColumnExists(tableName, columnName) {
    const targetTable = typeof repoGetTargetTableForSheet_ === 'function'
      ? repoGetTargetTableForSheet_(tableName)
      : '';

    if (!targetTable) return false;

    const response = supabaseStagingSelect_(
      targetTable,
      {
        select: columnName,
        limit: 1
      },
      {}
    );

    return !!(response && response.success);
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('FLAGS_CONFIRM_NO_CUTOVER_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false,
      result.flags
    );

    addCheck('CUTOVER_STATUS_SAFE',
      result.cutover_status.cutover_done === false &&
        result.cutover_status.production_crud_routed_to_supabase === false &&
        result.cutover_status.frontend_direct_supabase === false &&
        result.cutover_status.spreadsheet_still_source_of_truth === true &&
        result.cutover_status.supabase_scope === 'staging/test',
      result.cutover_status
    );

    const appUsers = dbFindAll_(REPO_TABLES.USERS, supabaseOptions);
    const patients = dbFindAll_(REPO_TABLES.PATIENTS, supabaseOptions);
    const serviceCatalog = dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions);
    const appointments = dbFindAll_(REPO_TABLES.APPOINTMENTS, supabaseOptions);
    const treatments = dbFindAll_(REPO_TABLES.TREATMENTS, supabaseOptions);
    const treatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, supabaseOptions);
    const medicalRecords = dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, supabaseOptions);
    const patientPhotos = dbFindAll_(REPO_TABLES.PATIENT_PHOTOS, supabaseOptions);
    const orthoRecalls = dbFindAll_(REPO_TABLES.ORTHO_RECALL, supabaseOptions);

    const billings = FinanceRepository.getBillingsRaw(supabaseOptions);
    const billingItems = FinanceRepository.getBillingItemsRaw(supabaseOptions);
    const billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(supabaseOptions);
    const billingInstallments = FinanceRepository.getBillingInstallmentsRaw(supabaseOptions);
    const payments = FinanceRepository.getPaymentsRaw(supabaseOptions);
    const billingFeedbacks = FinanceRepository.getBillingFeedbacksRaw(supabaseOptions);

    result.baseline_counts = {
      app_users: appUsers.length,
      patients: patients.length,
      service_catalog: serviceCatalog.length,
      appointments: appointments.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      medical_records: medicalRecords.length,
      patient_photos: patientPhotos.length,
      ortho_recalls: orthoRecalls.length,
      billings: billings.length,
      billing_items: billingItems.length,
      billing_adjustments: billingAdjustments.length,
      billing_installments: billingInstallments.length,
      payments: payments.length,
      billing_feedbacks: billingFeedbacks.length
    };

    addCheck('PHASE_7_FINAL_BASELINE_COUNTS_STILL_CLEAN',
      result.baseline_counts.app_users === 8 &&
        result.baseline_counts.patients === 285 &&
        result.baseline_counts.service_catalog === 100 &&
        result.baseline_counts.appointments === 284 &&
        result.baseline_counts.treatments === 254 &&
        result.baseline_counts.treatment_items === 489 &&
        result.baseline_counts.medical_records === 254 &&
        result.baseline_counts.patient_photos === 241 &&
        result.baseline_counts.ortho_recalls === 124 &&
        result.baseline_counts.billings === 46 &&
        result.baseline_counts.billing_items === 99 &&
        result.baseline_counts.billing_adjustments === 1 &&
        result.baseline_counts.billing_installments === 0 &&
        result.baseline_counts.payments === 44 &&
        result.baseline_counts.billing_feedbacks === 0,
      result.baseline_counts
    );

    result.finance_totals = {
      billings_subtotal: sumAmount(billings, 'subtotal'),
      billings_discount_total: sumAmount(billings, 'discount_total'),
      billings_grand_total: sumAmount(billings, 'grand_total'),
      billings_paid_total: sumAmount(billings, 'paid_total'),
      billings_outstanding_total: sumAmount(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(billingAdjustments, 'amount'),
      billing_installments_amount_due: sumAmount(billingInstallments, 'amount_due'),
      billing_installments_paid_amount: sumAmount(billingInstallments, 'paid_amount'),
      payments_amount: sumAmount(payments, 'amount')
    };

    addCheck('PHASE_7_FINAL_FINANCE_TOTALS_STILL_CLEAN',
      result.finance_totals.billings_subtotal === 15136500 &&
        result.finance_totals.billings_discount_total === 100000 &&
        result.finance_totals.billings_grand_total === 15036500 &&
        result.finance_totals.billings_paid_total === 15035000 &&
        result.finance_totals.billings_outstanding_total === 1500 &&
        result.finance_totals.billing_items_subtotal === 15136500 &&
        result.finance_totals.billing_adjustments_amount === 100000 &&
        result.finance_totals.billing_installments_amount_due === 0 &&
        result.finance_totals.billing_installments_paid_amount === 0 &&
        result.finance_totals.payments_amount === 15035000,
      result.finance_totals
    );

    result.status_counts = {
      appointments: countByStatus(appointments, 'status'),
      ortho_program_status: countByStatus(orthoRecalls, 'program_status'),
      ortho_followup_status: countByStatus(orthoRecalls, 'followup_status'),
      billing_status: countByStatus(billings, 'billing_status'),
      payment_status: countByStatus(billings, 'payment_status')
    };

    addCheck('PHASE_7_FINAL_STATUS_COUNTS_STILL_CLEAN',
      result.status_counts.appointments.scheduled === 6 &&
        result.status_counts.appointments.completed === 255 &&
        result.status_counts.appointments.cancelled === 23 &&
        result.status_counts.ortho_program_status.active === 124 &&
        result.status_counts.ortho_followup_status.upcoming === 124 &&
        result.status_counts.billing_status.draft === 46 &&
        result.status_counts.payment_status.paid === 45 &&
        result.status_counts.payment_status.unpaid === 1,
      result.status_counts
    );

    const patientIndex = buildIndexByField(patients, 'patient_id');
    const appointmentIndex = buildIndexByField(appointments, 'appointment_id');
    const treatmentIndex = buildIndexByField(treatments, 'treatment_id');
    const treatmentItemIndex = buildIndexByField(treatmentItems, 'treatment_item_id');
    const serviceIndex = buildIndexByField(serviceCatalog, 'service_id');
    const billingIndex = buildIndexByField(billings, 'billing_id');

    result.known_artifacts = {
      ortho_recall_missing_patient_count: orthoRecalls.filter(function(row) {
        const patientId = normalizeKey(row.patient_id);
        return patientId && !patientIndex[patientId];
      }).length,

      ortho_recall_install_treatment_missing_parent_count: orthoRecalls.filter(function(row) {
        const treatmentId = normalizeKey(row.install_treatment_id);
        return treatmentId && !treatmentIndex[treatmentId];
      }).length,

      ortho_recall_last_control_treatment_missing_parent_count: orthoRecalls.filter(function(row) {
        const treatmentId = normalizeKey(row.last_control_treatment_id);
        return treatmentId && !treatmentIndex[treatmentId];
      }).length,

      billings_missing_patient_count: billings.filter(function(row) {
        const patientId = normalizeKey(row.patient_id);
        return patientId && !patientIndex[patientId];
      }).length,

      billings_missing_treatment_count: billings.filter(function(row) {
        const treatmentId = normalizeKey(row.treatment_id);
        return treatmentId && !treatmentIndex[treatmentId];
      }).length,

      billings_missing_appointment_count: billings.filter(function(row) {
        const appointmentId = normalizeKey(row.appointment_id);
        return appointmentId && !appointmentIndex[appointmentId];
      }).length,

      billing_items_missing_billing_count: billingItems.filter(function(row) {
        const billingId = normalizeKey(row.billing_id);
        return billingId && !billingIndex[billingId];
      }).length,

      billing_items_missing_treatment_count: billingItems.filter(function(row) {
        const treatmentId = normalizeKey(row.treatment_id);
        return treatmentId && !treatmentIndex[treatmentId];
      }).length,

      billing_items_missing_treatment_item_count: billingItems.filter(function(row) {
        const treatmentItemId = normalizeKey(row.treatment_item_id);
        return treatmentItemId && !treatmentItemIndex[treatmentItemId];
      }).length,

      billing_items_missing_service_count: billingItems.filter(function(row) {
        const serviceId = normalizeKey(row.service_id);
        return serviceId && !serviceIndex[serviceId];
      }).length,

      adjustments_missing_billing_count: billingAdjustments.filter(function(row) {
        const billingId = normalizeKey(row.billing_id);
        return billingId && !billingIndex[billingId];
      }).length,

      installments_missing_billing_count: billingInstallments.filter(function(row) {
        const billingId = normalizeKey(row.billing_id);
        return billingId && !billingIndex[billingId];
      }).length,

      payments_missing_billing_count: payments.filter(function(row) {
        const billingId = normalizeKey(row.billing_id);
        return billingId && !billingIndex[billingId];
      }).length,

      feedbacks_missing_billing_count: billingFeedbacks.filter(function(row) {
        const billingId = normalizeKey(row.billing_id);
        return billingId && !billingIndex[billingId];
      }).length
    };

    addCheck('KNOWN_MANUAL_ARTIFACTS_STILL_EXPECTED',
      result.known_artifacts.ortho_recall_missing_patient_count === 0 &&
        result.known_artifacts.ortho_recall_install_treatment_missing_parent_count === 1 &&
        result.known_artifacts.ortho_recall_last_control_treatment_missing_parent_count === 0 &&
        result.known_artifacts.billings_missing_patient_count === 0 &&
        result.known_artifacts.billings_missing_treatment_count === 1 &&
        result.known_artifacts.billings_missing_appointment_count === 0 &&
        result.known_artifacts.billing_items_missing_billing_count === 0 &&
        result.known_artifacts.billing_items_missing_treatment_count === 1 &&
        result.known_artifacts.billing_items_missing_treatment_item_count === 1 &&
        result.known_artifacts.billing_items_missing_service_count === 0 &&
        result.known_artifacts.adjustments_missing_billing_count === 0 &&
        result.known_artifacts.installments_missing_billing_count === 0 &&
        result.known_artifacts.payments_missing_billing_count === 0 &&
        result.known_artifacts.feedbacks_missing_billing_count === 0,
      result.known_artifacts
    );

    const schemaExpectations = {
      Patients: [
        'email',
        'guardian_name',
        'guardian_relationship',
        'guardian_phone',
        'guardian_email',
        'allergy_notes',
        'first_clinic_id'
      ],
      BillingAdjustments: ['label'],
      BillingInstallments: ['amount_due', 'status', 'paid_at'],
      Payments: ['payment_scope'],
      BillingFeedbacks: [
        'service_quality',
        'staff_friendliness',
        'clinic_cleanliness',
        'waiting_time'
      ]
    };

    Object.keys(schemaExpectations).forEach(function(tableName) {
      result.schema_readiness[tableName] = {
        missing_columns: []
      };

      schemaExpectations[tableName].forEach(function(columnName) {
        if (!checkSupabaseColumnExists(tableName, columnName)) {
          result.schema_readiness[tableName].missing_columns.push(columnName);
        }
      });
    });

    addCheck('STAGING_SCHEMA_PATCHES_REQUIRED_FOR_CUTOVER_STILL_PRESENT',
      Object.keys(result.schema_readiness).every(function(tableName) {
        return result.schema_readiness[tableName].missing_columns.length === 0;
      }),
      result.schema_readiness
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    result.readiness.ready_for_8B_freeze_mode_design = result.success === true;
    result.readiness.reason = result.success
      ? '8A readiness clean. Aman lanjut ke 8B untuk desain freeze/maintenance guard. Belum cutover.'
      : 'Belum siap lanjut ke 8B karena masih ada failed checks.';

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8A-1-Cutover-Readiness-Strategy',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'CUTOVER_READINESS_STRATEGY_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      readiness: {
        ready_for_8B_freeze_mode_design: false,
        reason: 'Error saat 8A readiness audit.'
      }
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8BMutationEntryPointMapLog() {
  const result = {
    success: true,
    stage: '8B-2-Mutation-EntryPoint-Map',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
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
    guard_helpers: {},
    mutation_entry_points: {},
    summary: {
      group_count: 0,
      candidate_count: 0,
      found_count: 0,
      missing_count: 0,
      groups_with_found_entry_points: [],
      groups_without_found_entry_points: []
    },
    recommended_patch_order: [],
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function functionExists(functionName) {
    return typeof this[functionName] === 'function';
  }

  function mapGroup(groupName, moduleName, candidates, patchOrder) {
    const mapped = {
      module: moduleName,
      candidates: [],
      found: [],
      missing: [],
      patch_order: patchOrder || 99
    };

    (candidates || []).forEach(function(item) {
      const name = typeof item === 'string' ? item : item.name;
      const action = typeof item === 'string' ? '' : String(item.action || '');
      const risk = typeof item === 'string' ? 'mutation' : String(item.risk || 'mutation');

      const exists = functionExists(name);

      const row = {
        name: name,
        exists: exists,
        action: action,
        risk: risk
      };

      mapped.candidates.push(row);

      if (exists) {
        mapped.found.push(row);
      } else {
        mapped.missing.push(row);
      }
    });

    result.mutation_entry_points[groupName] = mapped;

    result.summary.group_count++;
    result.summary.candidate_count += mapped.candidates.length;
    result.summary.found_count += mapped.found.length;
    result.summary.missing_count += mapped.missing.length;

    if (mapped.found.length > 0) {
      result.summary.groups_with_found_entry_points.push(groupName);
    } else {
      result.summary.groups_without_found_entry_points.push(groupName);
    }

    result.recommended_patch_order.push({
      order: mapped.patch_order,
      group: groupName,
      module: moduleName,
      found_count: mapped.found.length,
      found_functions: mapped.found.map(function(row) {
        return row.name;
      })
    });
  }

  try {
    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false,
      result.flags
    );

    result.guard_helpers = {
      repoIsProductionMutationFreezeEnabled_: typeof repoIsProductionMutationFreezeEnabled_ === 'function',
      repoAssertProductionMutationAllowed_: typeof repoAssertProductionMutationAllowed_ === 'function',
      repoCheckProductionMutationAllowed_: typeof repoCheckProductionMutationAllowed_ === 'function',
      repoGetProductionMutationFreezeMessage_: typeof repoGetProductionMutationFreezeMessage_ === 'function'
    };

    addCheck('FREEZE_GUARD_HELPERS_AVAILABLE',
      result.guard_helpers.repoIsProductionMutationFreezeEnabled_ === true &&
        result.guard_helpers.repoAssertProductionMutationAllowed_ === true &&
        result.guard_helpers.repoCheckProductionMutationAllowed_ === true &&
        result.guard_helpers.repoGetProductionMutationFreezeMessage_ === true,
      result.guard_helpers
    );

    /*
     * Catatan:
     * Ini mapping kandidat entry point mutasi production.
     * Missing tidak otomatis dianggap error, karena sebagian modul bisa punya nama fungsi berbeda.
     * Fungsi yang "found" akan diprioritaskan untuk patch 8B-3 dan seterusnya.
     */

    mapGroup('patient', 'PatientService', [
      { name: 'createPatient', action: 'create patient', risk: 'insert Patients' },
      { name: 'updatePatient', action: 'update patient', risk: 'update Patients' },
      { name: 'deletePatient', action: 'delete patient', risk: 'delete Patients' },
      { name: 'togglePatientActive', action: 'toggle patient active/inactive', risk: 'update Patients' },
      { name: 'setPatientActiveStatus', action: 'set patient active status', risk: 'update Patients' }
    ], 1);

    mapGroup('appointment', 'AppointmentService', [
      { name: 'createAppointment', action: 'create appointment', risk: 'insert Appointments' },
      { name: 'updateAppointment', action: 'update appointment', risk: 'update Appointments' },
      { name: 'cancelAppointment', action: 'cancel appointment', risk: 'update Appointments status' },
      { name: 'restoreAppointment', action: 'restore appointment', risk: 'update Appointments status' },
      { name: 'deleteAppointment', action: 'delete appointment', risk: 'delete Appointments' },
      { name: 'rescheduleAppointment', action: 'reschedule appointment', risk: 'update Appointments date/time' }
    ], 2);

    mapGroup('treatment', 'TreatmentService', [
      { name: 'createTreatment', action: 'create treatment bundle', risk: 'insert Treatments/TreatmentItems/MedicalRecords and update Appointment' },
      { name: 'saveTreatment', action: 'save treatment bundle', risk: 'insert Treatments/TreatmentItems/MedicalRecords and update Appointment' },
      { name: 'startTreatment', action: 'start treatment', risk: 'insert/update treatment workflow' },
      { name: 'submitTreatment', action: 'submit treatment', risk: 'insert treatment workflow' },
      { name: 'updateTreatment', action: 'update treatment', risk: 'update Treatments' },
      { name: 'deleteTreatment', action: 'delete treatment', risk: 'delete Treatments bundle' }
    ], 3);

    mapGroup('ortho_recall', 'OrthoRecallService', [
      { name: 'logOrthoRecallContact', action: 'log recall contact', risk: 'update OrthoRecall contact fields' },
      { name: 'updateOrthoRecallContact', action: 'update recall contact', risk: 'update OrthoRecall contact fields' },
      { name: 'completeOrthoRecallProgram', action: 'complete recall program', risk: 'update OrthoRecall program_status' },
      { name: 'cancelOrthoRecallProgram', action: 'cancel recall program', risk: 'update OrthoRecall program_status' },
      { name: 'refreshAllOrthoRecallStatuses', action: 'refresh recall statuses', risk: 'batch update OrthoRecall followup_status' },
      { name: 'createOrthoRecallFromTreatment', action: 'create ortho recall from treatment', risk: 'insert OrthoRecall' }
    ], 4);

    mapGroup('finance_billing', 'FinanceBillingService', [
      { name: 'createDraftBillingForTreatment', action: 'create draft billing', risk: 'insert Billings/BillingItems' },
      { name: 'createBillingFromTreatment', action: 'create billing from treatment', risk: 'insert Billings/BillingItems' },
      { name: 'updateBilling', action: 'update billing', risk: 'update Billings' },
      { name: 'cancelBilling', action: 'cancel billing', risk: 'update Billings status' },
      { name: 'deleteBilling', action: 'delete billing', risk: 'delete Billings bundle' },
      { name: 'recalculateBillingTotals', action: 'recalculate billing totals', risk: 'update Billings totals' }
    ], 5);

    mapGroup('finance_payment', 'FinancePaymentService', [
      { name: 'recordBillingPayment', action: 'record payment', risk: 'insert Payments and update Billings totals' },
      { name: 'createBillingPayment', action: 'create payment', risk: 'insert Payments and update Billings totals' },
      { name: 'deleteBillingPayment', action: 'delete payment', risk: 'delete Payments and update Billings totals' },
      { name: 'updateBillingPayment', action: 'update payment', risk: 'update Payments and Billings totals' }
    ], 6);

    mapGroup('finance_installment', 'FinanceInstallmentService', [
      { name: 'createBillingInstallmentPlan', action: 'create installment plan', risk: 'insert BillingInstallments and update Billings terms' },
      { name: 'createInstallmentPlan', action: 'create installment plan', risk: 'insert BillingInstallments and update Billings terms' },
      { name: 'updateBillingInstallment', action: 'update installment', risk: 'update BillingInstallments' },
      { name: 'deleteBillingInstallment', action: 'delete installment', risk: 'delete BillingInstallments' },
      { name: 'syncBillingInstallments', action: 'sync installments', risk: 'batch update BillingInstallments' }
    ], 7);

    mapGroup('finance_invoice', 'FinanceInvoiceService', [
      { name: 'generateBillingInvoicePdf', action: 'generate invoice PDF', risk: 'write Drive file and update Billings invoice fields' },
      { name: 'sendBillingInvoiceEmail', action: 'send invoice email', risk: 'send email and update Billings invoice fields' },
      { name: 'refreshBillingInvoicePdf', action: 'refresh invoice PDF', risk: 'write Drive file and update Billings invoice fields' },
      { name: 'markBillingInvoiceStale', action: 'mark invoice stale', risk: 'update Billings invoice status' }
    ], 8);

    mapGroup('finance_feedback', 'FinanceFeedbackService', [
      { name: 'createBillingFeedbackToken', action: 'create feedback token', risk: 'insert/update BillingFeedbacks' },
      { name: 'ensureBillingFeedbackToken', action: 'ensure feedback token', risk: 'insert/update BillingFeedbacks' },
      { name: 'submitBillingFeedback', action: 'submit feedback', risk: 'update BillingFeedbacks' },
      { name: 'getBillingFeedbackByToken', action: 'read feedback by token', risk: 'read-only, should not need freeze guard unless it writes token' }
    ], 9);

    mapGroup('master_data', 'MasterDataService', [
      { name: 'createService', action: 'create service', risk: 'insert ServiceCatalog' },
      { name: 'updateService', action: 'update service', risk: 'update ServiceCatalog' },
      { name: 'deleteService', action: 'delete service', risk: 'delete ServiceCatalog' },
      { name: 'toggleServiceActive', action: 'toggle service active', risk: 'update ServiceCatalog' }
    ], 10);

    mapGroup('patient_photo', 'PatientPhotoService', [
      { name: 'uploadPatientPhoto', action: 'upload patient photo', risk: 'write Drive file and insert PatientPhotos' },
      { name: 'savePatientPhoto', action: 'save patient photo', risk: 'insert PatientPhotos' },
      { name: 'deletePatientPhoto', action: 'delete patient photo', risk: 'delete PatientPhotos and possibly Drive file' },
      { name: 'updatePatientPhoto', action: 'update patient photo metadata', risk: 'update PatientPhotos' }
    ], 11);

    result.recommended_patch_order.sort(function(a, b) {
      return a.order - b.order;
    });

    addCheck('AT_LEAST_ONE_MUTATION_ENTRY_POINT_FOUND',
      result.summary.found_count > 0,
      result.summary
    );

    addCheck('CORE_GROUPS_HAVE_DISCOVERED_ENTRY_POINTS',
      result.summary.groups_with_found_entry_points.indexOf('patient') !== -1 ||
        result.summary.groups_with_found_entry_points.indexOf('appointment') !== -1 ||
        result.summary.groups_with_found_entry_points.indexOf('finance_payment') !== -1 ||
        result.summary.groups_with_found_entry_points.indexOf('finance_billing') !== -1,
      result.summary
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-2-Mutation-EntryPoint-Map',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'MUTATION_ENTRY_POINT_MAP_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8BMutationEntryPointMapCompactLog() {
  const result = {
    success: true,
    stage: '8B-2-Mutation-EntryPoint-Map-Compact',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
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
    guard_helpers_ok: false,
    summary: {
      group_count: 0,
      candidate_count: 0,
      found_count: 0,
      missing_count: 0
    },
    found_by_group: {},
    patch_order: [],
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function exists(fnName) {
    return typeof this[fnName] === 'function';
  }

  function mapGroup(order, group, moduleName, candidates) {
    const found = [];
    const missing = [];

    candidates.forEach(function(fnName) {
      if (exists(fnName)) {
        found.push(fnName);
      } else {
        missing.push(fnName);
      }
    });

    result.summary.group_count++;
    result.summary.candidate_count += candidates.length;
    result.summary.found_count += found.length;
    result.summary.missing_count += missing.length;

    result.found_by_group[group] = found;

    result.patch_order.push({
      order: order,
      group: group,
      module: moduleName,
      found_count: found.length,
      functions: found
    });
  }

  try {
    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false,
      result.flags
    );

    result.guard_helpers_ok =
      typeof repoIsProductionMutationFreezeEnabled_ === 'function' &&
      typeof repoAssertProductionMutationAllowed_ === 'function' &&
      typeof repoCheckProductionMutationAllowed_ === 'function' &&
      typeof repoGetProductionMutationFreezeMessage_ === 'function';

    addCheck('FREEZE_GUARD_HELPERS_AVAILABLE', result.guard_helpers_ok === true, {
      guard_helpers_ok: result.guard_helpers_ok
    });

    mapGroup(1, 'patient', 'PatientService', [
      'createPatient',
      'updatePatient',
      'deletePatient',
      'togglePatientActive',
      'setPatientActiveStatus'
    ]);

    mapGroup(2, 'appointment', 'AppointmentService', [
      'createAppointment',
      'updateAppointment',
      'cancelAppointment',
      'restoreAppointment',
      'deleteAppointment',
      'rescheduleAppointment'
    ]);

    mapGroup(3, 'treatment', 'TreatmentService', [
      'createTreatment',
      'saveTreatment',
      'startTreatment',
      'submitTreatment',
      'updateTreatment',
      'deleteTreatment'
    ]);

    mapGroup(4, 'ortho_recall', 'OrthoRecallService', [
      'logOrthoRecallContact',
      'updateOrthoRecallContact',
      'completeOrthoRecallProgram',
      'cancelOrthoRecallProgram',
      'refreshAllOrthoRecallStatuses',
      'createOrthoRecallFromTreatment'
    ]);

    mapGroup(5, 'finance_billing', 'FinanceBillingService', [
      'createDraftBillingForTreatment',
      'createBillingFromTreatment',
      'updateBilling',
      'cancelBilling',
      'deleteBilling',
      'recalculateBillingTotals'
    ]);

    mapGroup(6, 'finance_payment', 'FinancePaymentService', [
      'recordBillingPayment',
      'createBillingPayment',
      'deleteBillingPayment',
      'updateBillingPayment'
    ]);

    mapGroup(7, 'finance_installment', 'FinanceInstallmentService', [
      'createBillingInstallmentPlan',
      'createInstallmentPlan',
      'updateBillingInstallment',
      'deleteBillingInstallment',
      'syncBillingInstallments'
    ]);

    mapGroup(8, 'finance_invoice', 'FinanceInvoiceService', [
      'generateBillingInvoicePdf',
      'sendBillingInvoiceEmail',
      'refreshBillingInvoicePdf',
      'markBillingInvoiceStale'
    ]);

    mapGroup(9, 'finance_feedback', 'FinanceFeedbackService', [
      'createBillingFeedbackToken',
      'ensureBillingFeedbackToken',
      'submitBillingFeedback'
    ]);

    mapGroup(10, 'master_data', 'MasterDataService', [
      'createService',
      'updateService',
      'deleteService',
      'toggleServiceActive'
    ]);

    mapGroup(11, 'patient_photo', 'PatientPhotoService', [
      'uploadPatientPhoto',
      'savePatientPhoto',
      'deletePatientPhoto',
      'updatePatientPhoto'
    ]);

    result.patch_order.sort(function(a, b) {
      return a.order - b.order;
    });

    addCheck('AT_LEAST_ONE_MUTATION_ENTRY_POINT_FOUND',
      result.summary.found_count > 0,
      result.summary
    );

    addCheck('CORE_ENTRY_POINTS_FOUND',
      (result.found_by_group.patient || []).length > 0 &&
        (result.found_by_group.appointment || []).length > 0 &&
        (result.found_by_group.treatment || []).length > 0 &&
        (result.found_by_group.finance_payment || []).length > 0,
      result.found_by_group
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-2-Mutation-EntryPoint-Map-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'MUTATION_ENTRY_POINT_MAP_COMPACT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8BFinalFreezeGuardRegressionLog() {
  const result = {
    success: true,
    stage: '8B-12-Final-FreezeGuard-Regression',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
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
    before_finance_totals: {},
    after_finance_totals: {},
    blocked_summary: {
      expected_blocked: 0,
      blocked_count: 0,
      failed_to_block: []
    },
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function toAmount_(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount_(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount_(rows, fieldName) {
    return roundAmount_((rows || []).reduce(function(sum, row) {
      return sum + toAmount_(row && row[fieldName]);
    }, 0));
  }

  function getCounts_() {
    return {
      patients: getPatientsRaw({ backend_mode: 'spreadsheet' }).length,
      appointments: getAppointmentsRaw({ backend_mode: 'spreadsheet' }).length,
      treatments: getTreatmentsRaw({ backend_mode: 'spreadsheet' }).length,
      treatment_items: getTreatmentItemsRaw({ backend_mode: 'spreadsheet' }).length,
      medical_records: getMedicalRecordsRaw({ backend_mode: 'spreadsheet' }).length,
      patient_photos: getPatientPhotosRaw().length,
      ortho_recalls: getOrthoRecallRaw({ backend_mode: 'spreadsheet' }).length,
      billings: getBillingsRaw().length,
      billing_items: getBillingItemsRaw().length,
      billing_adjustments: getBillingAdjustmentsRaw().length,
      billing_installments: getBillingInstallmentsRaw().length,
      payments: getPaymentsRaw().length,
      billing_feedbacks: getBillingFeedbacksRaw().length
    };
  }

  function getFinanceTotals_() {
    const billings = getBillingsRaw();
    const billingItems = getBillingItemsRaw();
    const adjustments = getBillingAdjustmentsRaw();
    const installments = getBillingInstallmentsRaw();
    const payments = getPaymentsRaw();

    return {
      billings_subtotal: sumAmount_(billings, 'subtotal'),
      billings_discount_total: sumAmount_(billings, 'discount_total'),
      billings_grand_total: sumAmount_(billings, 'grand_total'),
      billings_paid_total: sumAmount_(billings, 'paid_total'),
      billings_outstanding_total: sumAmount_(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount_(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount_(adjustments, 'amount'),
      billing_installments_amount_due: sumAmount_(installments, 'amount_due'),
      billing_installments_paid_amount: sumAmount_(installments, 'paid_amount'),
      payments_amount: sumAmount_(payments, 'amount')
    };
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );
  }

  function attemptBlocked(name, fn) {
    result.blocked_summary.expected_blocked++;

    try {
      const res = fn();

      if (isFreezeMessage_(res)) {
        result.blocked_summary.blocked_count++;
        return;
      }

      result.blocked_summary.failed_to_block.push({
        name: name,
        response: res
      });

    } catch (err) {
      result.blocked_summary.failed_to_block.push({
        name: name,
        error: err && err.message ? err.message : String(err || '')
      });
    }
  }

  try {
    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false,
      result.flags
    );

    result.before_counts = getCounts_();
    result.before_finance_totals = getFinanceTotals_();

    attemptBlocked('patient_create', function() {
      return createPatient({
        __test_freeze_enabled: true,
        full_name: 'SHOULD NOT WRITE',
        gender: 'Laki-laki',
        birth_date: '2000-01-01',
        phone: '08123456789',
        email: 'test@example.com',
        address: 'SHOULD NOT WRITE'
      });
    });

    attemptBlocked('patient_update', function() {
      return updatePatient({
        __test_freeze_enabled: true,
        patient_id: 'PAT-0001',
        full_name: 'SHOULD NOT WRITE',
        gender: 'Laki-laki',
        birth_date: '2000-01-01',
        phone: '08123456789',
        email: 'test@example.com',
        address: 'SHOULD NOT WRITE'
      });
    });

    attemptBlocked('appointment_create', function() {
      return createAppointment({
        __test_freeze_enabled: true,
        patient_id: 'PAT-0001',
        appointment_date: '2027-01-01',
        appointment_time: '09:00',
        complaint: 'SHOULD NOT WRITE',
        status: 'scheduled'
      });
    });

    attemptBlocked('appointment_update', function() {
      return updateAppointment({
        __test_freeze_enabled: true,
        appointment_id: 'APT-0001',
        patient_id: 'PAT-0001',
        appointment_date: '2027-01-01',
        appointment_time: '09:00',
        complaint: 'SHOULD NOT WRITE',
        status: 'scheduled'
      });
    });

    attemptBlocked('appointment_cancel', function() {
      return cancelAppointment('APT-0001', {
        __test_freeze_enabled: true
      });
    });

    attemptBlocked('appointment_restore', function() {
      return restoreAppointment('APT-0001', {
        __test_freeze_enabled: true
      });
    });

    attemptBlocked('treatment_create', function() {
      return createTreatment({
        __test_freeze_enabled: true,
        actor_role: 'owner',
        appointment_id: 'APT-0001',
        patient_id: 'PAT-0001',
        patient_name: 'SHOULD NOT WRITE',
        doctor_user_id: 'USR-DR01',
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
    });

    attemptBlocked('ortho_save_contact', function() {
      return saveOrthoRecallContact({
        __test_freeze_enabled: true,
        ortho_recall_id: 'ORC-20260424-153834842-468',
        last_contact_note: 'SHOULD NOT WRITE'
      });
    });

    attemptBlocked('ortho_complete', function() {
      return completeOrthoRecallProgram({
        __test_freeze_enabled: true,
        ortho_recall_id: 'ORC-20260424-153834842-468',
        reason: 'SHOULD NOT WRITE'
      });
    });

    attemptBlocked('ortho_cancel', function() {
      return cancelOrthoRecallProgram({
        __test_freeze_enabled: true,
        ortho_recall_id: 'ORC-20260424-153834842-468',
        reason: 'SHOULD NOT WRITE'
      });
    });

    attemptBlocked('ortho_refresh_status', function() {
      return refreshAllOrthoRecallStatuses({
        __test_freeze_enabled: true
      });
    });

    attemptBlocked('ortho_sync_phones', function() {
      return syncOrthoRecallPhonesFromPatients({
        __test_freeze_enabled: true
      });
    });

    attemptBlocked('finance_payment_record', function() {
      return recordBillingPayment({
        __test_freeze_enabled: true,
        billing_id: 'BIL-20260505-140855694-907',
        payment_scope: 'full',
        payment_date: '2027-01-01',
        payment_method: 'cash',
        amount: 1000,
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_payment_create_wrapper', function() {
      return createBillingPayment({
        __test_freeze_enabled: true,
        billing_id: 'BIL-20260505-140855694-907',
        payment_scope: 'full',
        payment_date: '2027-01-01',
        payment_method: 'cash',
        amount: 1000,
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_payment_save_wrapper', function() {
      return saveBillingPayment({
        __test_freeze_enabled: true,
        billing_id: 'BIL-20260505-140855694-907',
        payment_scope: 'full',
        payment_date: '2027-01-01',
        payment_method: 'cash',
        amount: 1000,
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_invoice_generate', function() {
      return generateBillingInvoicePdf({
        __test_freeze_enabled: true,
        billing_id: 'BIL-20260505-140855694-907',
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_invoice_send', function() {
      return sendBillingInvoiceEmail({
        __test_freeze_enabled: true,
        billing_id: 'BIL-20260505-140855694-907',
        email_to: 'test@example.com',
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_feedback_ensure_token', function() {
      return ensureBillingFeedbackTokenForBilling(
        'BIL-20260505-140855694-907',
        {
          use_lock: false,
          __test_freeze_enabled: true
        }
      );
    });

    attemptBlocked('finance_feedback_submit', function() {
      return submitBillingFeedback({
        __test_freeze_enabled: true,
        feedback_token: 'TOKEN-SHOULD-NOT-WRITE-8B',
        rating: 5,
        service_quality: 'very_satisfied',
        staff_friendliness: 'very_satisfied',
        clinic_cleanliness: 'very_satisfied',
        waiting_time: 'very_satisfied',
        comment: 'SHOULD NOT WRITE 8B'
      });
    });

    attemptBlocked('finance_billing_recalculate', function() {
      return recalculateBillingTotals({
        __test_freeze_enabled: true,
        billing_id: 'BIL-20260505-140855694-907',
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_billing_generate_from_treatment', function() {
      return generateBillingFromTreatment({
        __test_freeze_enabled: true,
        treatment_id: 'TRX-0001',
        actor_role: 'owner',
        actor_user_id: 'USR-OWNER'
      });
    });

    attemptBlocked('finance_billing_create_draft', function() {
      return createDraftBillingFromTreatment(
        {
          treatment_id: 'TRX-0001',
          appointment_id: 'APT-0001',
          patient_id: 'PAT-0001',
          patient_name: 'SHOULD NOT WRITE',
          treatment_date: '2027-01-01'
        },
        [
          {
            treatment_item_id: 'TRI-8B-SHOULD-NOT-WRITE',
            treatment_id: 'TRX-0001',
            service_id: 'SRV-001',
            service_name: 'SHOULD NOT WRITE',
            qty: 1,
            unit_price: 1000,
            subtotal: 1000
          }
        ],
        {
          use_lock: false,
          internal_call: true,
          __test_freeze_enabled: true
        }
      );
    });

    attemptBlocked('patient_photo_create', function() {
      return createPatientPhoto({
        __test_freeze_enabled: true,
        patient_id: 'PAT-0001',
        treatment_id: 'TRX-0001',
        photo_type: 'before',
        file_name: 'SHOULD_NOT_WRITE_8B.jpg',
        file_url: 'https://example.com/should-not-write.jpg',
        file_drive_id: 'FILE-SHOULD-NOT-WRITE-8B',
        sort_order: 1
      });
    });

    attemptBlocked('patient_photo_upload', function() {
      return createPatientPhotoUpload({
        __test_freeze_enabled: true,
        actor_role: 'owner',
        patient_id: 'PAT-0001',
        treatment_id: 'TRX-0001',
        photo_type: 'before',
        file_name: 'SHOULD_NOT_WRITE_8B.jpg',
        mime_type: 'image/jpeg',
        base64_data: 'AAA='
      });
    });

    attemptBlocked('patient_photo_delete', function() {
      return deletePatientPhoto({
        __test_freeze_enabled: true,
        actor_role: 'owner',
        photo_id: 'PHT-0001'
      });
    });

    addCheck('ALL_PATCHED_ENTRY_POINTS_BLOCKED_BY_SIMULATED_FREEZE',
      result.blocked_summary.blocked_count === result.blocked_summary.expected_blocked &&
        result.blocked_summary.failed_to_block.length === 0,
      result.blocked_summary
    );

    result.after_counts = getCounts_();
    result.after_finance_totals = getFinanceTotals_();

    addCheck('PRODUCTION_COUNTS_UNCHANGED_AFTER_FINAL_FREEZE_REGRESSION',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('PRODUCTION_FINANCE_TOTALS_UNCHANGED_AFTER_FINAL_FREEZE_REGRESSION',
      JSON.stringify(result.after_finance_totals) === JSON.stringify(result.before_finance_totals),
      {
        before: result.before_finance_totals,
        after: result.after_finance_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-12-Final-FreezeGuard-Regression',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_FREEZE_GUARD_REGRESSION_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}