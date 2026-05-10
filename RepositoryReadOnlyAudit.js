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

function testCutoverPhase8CFinalMigrationPreparationAuditLog() {
  const result = {
    success: true,
    stage: '8C-2-FinalMigration-PreparationAudit',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    spreadsheet_production_counts: {},
    supabase_staging_counts: {},
    count_delta: {},
    spreadsheet_finance_totals: {},
    supabase_finance_totals: {},
    finance_delta: {},
    reset_delete_order: [],
    reseed_insert_order: [],
    required_preconditions_before_actual_reseed: [],
    preparation_status: {
      production_has_new_data_since_staging_snapshot: false,
      reset_reseed_required_before_cutover: true,
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      ready_for_8C3_reseed_plan_scaffold: false
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

  function getRows_(tableName, options) {
    return dbFindAll_(tableName, options || {}) || [];
  }

  function getAllCounts_(options) {
    const opts = options || {};

    return {
      app_users: getRows_(REPO_TABLES.USERS, opts).length,
      patients: getRows_(REPO_TABLES.PATIENTS, opts).length,
      service_catalog: getRows_(REPO_TABLES.SERVICE_CATALOG, opts).length,
      appointments: getRows_(REPO_TABLES.APPOINTMENTS, opts).length,
      treatments: getRows_(REPO_TABLES.TREATMENTS, opts).length,
      treatment_items: getRows_(REPO_TABLES.TREATMENT_ITEMS, opts).length,
      medical_records: getRows_(REPO_TABLES.MEDICAL_RECORDS, opts).length,
      patient_photos: getRows_(REPO_TABLES.PATIENT_PHOTOS, opts).length,
      ortho_recalls: getRows_(REPO_TABLES.ORTHO_RECALL, opts).length,
      billings: getRows_(REPO_TABLES.BILLINGS, opts).length,
      billing_items: getRows_(REPO_TABLES.BILLING_ITEMS, opts).length,
      billing_adjustments: getRows_(REPO_TABLES.BILLING_ADJUSTMENTS, opts).length,
      billing_installments: getRows_(REPO_TABLES.BILLING_INSTALLMENTS, opts).length,
      payments: getRows_(REPO_TABLES.PAYMENTS, opts).length,
      billing_feedbacks: getRows_(REPO_TABLES.BILLING_FEEDBACKS, opts).length
    };
  }

  function getFinanceTotals_(options) {
    const opts = options || {};
    const billings = getRows_(REPO_TABLES.BILLINGS, opts);
    const billingItems = getRows_(REPO_TABLES.BILLING_ITEMS, opts);
    const adjustments = getRows_(REPO_TABLES.BILLING_ADJUSTMENTS, opts);
    const installments = getRows_(REPO_TABLES.BILLING_INSTALLMENTS, opts);
    const payments = getRows_(REPO_TABLES.PAYMENTS, opts);

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

  function buildDelta_(sourceCounts, targetCounts) {
    const delta = {};

    Object.keys(sourceCounts || {}).forEach(function(key) {
      delta[key] = Number(sourceCounts[key] || 0) - Number(targetCounts[key] || 0);
    });

    return delta;
  }

  function hasAnyNonZeroDelta_(delta) {
    return Object.keys(delta || {}).some(function(key) {
      return Number(delta[key] || 0) !== 0;
    });
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    result.spreadsheet_production_counts = getAllCounts_(spreadsheetOptions);
    result.supabase_staging_counts = getAllCounts_(supabaseOptions);
    result.count_delta = buildDelta_(
      result.spreadsheet_production_counts,
      result.supabase_staging_counts
    );

    result.spreadsheet_finance_totals = getFinanceTotals_(spreadsheetOptions);
    result.supabase_finance_totals = getFinanceTotals_(supabaseOptions);
    result.finance_delta = buildDelta_(
      result.spreadsheet_finance_totals,
      result.supabase_finance_totals
    );

    result.preparation_status.production_has_new_data_since_staging_snapshot =
      hasAnyNonZeroDelta_(result.count_delta) || hasAnyNonZeroDelta_(result.finance_delta);

    addCheck('SPREADSHEET_PRODUCTION_COUNTS_READABLE',
      result.spreadsheet_production_counts.patients > 0 &&
        result.spreadsheet_production_counts.appointments > 0 &&
        result.spreadsheet_production_counts.treatments > 0 &&
        result.spreadsheet_production_counts.billings > 0,
      result.spreadsheet_production_counts
    );

    addCheck('SUPABASE_STAGING_COUNTS_READABLE',
      result.supabase_staging_counts.patients > 0 &&
        result.supabase_staging_counts.appointments > 0 &&
        result.supabase_staging_counts.treatments > 0 &&
        result.supabase_staging_counts.billings > 0,
      result.supabase_staging_counts
    );

    addCheck('PRODUCTION_DIFFERS_FROM_OLD_STAGING_SNAPSHOT_EXPECTED',
      result.preparation_status.production_has_new_data_since_staging_snapshot === true,
      {
        count_delta: result.count_delta,
        finance_delta: result.finance_delta
      }
    );

    result.reset_delete_order = [
      REPO_TABLES.BILLING_FEEDBACKS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.USERS
    ];

    result.reseed_insert_order = [
      REPO_TABLES.USERS,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_FEEDBACKS
    ];

    result.required_preconditions_before_actual_reseed = [
      'Git commit terakhir sudah clean dan pushed',
      'Backup/copy Google Spreadsheet production sudah dibuat',
      'Supabase target final/staging-final sudah dipastikan benar',
      'REPO_PRODUCTION_MUTATION_FREEZE_ENABLED harus true saat final migration',
      'REPO_SUPABASE_FINAL_MIGRATION_RESEED_ENABLED harus true hanya saat final migration',
      'REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED tetap false',
      'default_backend_mode tetap spreadsheet sampai 8E',
      'Final reset/reseed hanya boleh berjalan melalui guarded helper 8C/8D',
      'Final audit 8D harus clean sebelum backend switch'
    ];

    addCheck('RESET_DELETE_ORDER_DEFINED_CHILD_TO_PARENT',
      result.reset_delete_order.length === 15 &&
        result.reset_delete_order[0] === REPO_TABLES.BILLING_FEEDBACKS &&
        result.reset_delete_order[result.reset_delete_order.length - 1] === REPO_TABLES.USERS,
      result.reset_delete_order
    );

    addCheck('RESEED_INSERT_ORDER_DEFINED_PARENT_TO_CHILD',
      result.reseed_insert_order.length === 15 &&
        result.reseed_insert_order[0] === REPO_TABLES.USERS &&
        result.reseed_insert_order[result.reseed_insert_order.length - 1] === REPO_TABLES.BILLING_FEEDBACKS,
      result.reseed_insert_order
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C2',
      result.preparation_status.destructive_operation_executed === false &&
        result.preparation_status.final_migration_executed === false &&
        result.preparation_status.cutover_executed === false,
      result.preparation_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    result.preparation_status.ready_for_8C3_reseed_plan_scaffold = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-2-FinalMigration-PreparationAudit',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_PREPARATION_AUDIT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalReseedPlanScaffoldLog() {
  const result = {
    success: true,
    stage: '8C-3-FinalReseed-PlanScaffold',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    metadata_tables: [
      'migration_issues',
      'migration_row_map'
    ],
    app_table_count: 0,
    total_supabase_table_count_for_reseed: 0,
    reset_delete_order: [],
    reseed_insert_order: [],
    app_table_manifest: [],
    expected_counts_after_reseed: {},
    current_supabase_counts_before_reseed: {},
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      reseed_plan_ready: false,
      next_step: '8C-4-FinalMigration-SchemaReadinessAudit'
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

  function countRows_(tableName, options) {
    return (dbFindAll_(tableName, options || {}) || []).length;
  }

  function hasDuplicate_(arr) {
    const seen = {};
    return (arr || []).some(function(item) {
      const key = String(item || '').trim();
      if (seen[key]) return true;
      seen[key] = true;
      return false;
    });
  }

  try {
    addCheck('FLAGS_SAFE_NO_RESEED_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const spreadsheetOptions = {
      backend_mode: 'spreadsheet'
    };

    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const appTables = [
      REPO_TABLES.USERS,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_FEEDBACKS
    ];

    result.reset_delete_order = [
      'migration_issues',
      'migration_row_map',
      REPO_TABLES.BILLING_FEEDBACKS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.USERS
    ];

    result.reseed_insert_order = [
      REPO_TABLES.USERS,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_FEEDBACKS,
      'migration_row_map',
      'migration_issues'
    ];

    result.app_table_count = appTables.length;
    result.total_supabase_table_count_for_reseed = result.reset_delete_order.length;

    result.app_table_manifest = appTables.map(function(sheetName) {
      const targetTable = repoGetTargetTableForSheet_(sheetName);
      const primaryKey = repoGetPrimaryKeyForTable_(sheetName);
      const spreadsheetCount = countRows_(sheetName, spreadsheetOptions);
      const supabaseCount = countRows_(sheetName, supabaseOptions);

      result.expected_counts_after_reseed[targetTable] = spreadsheetCount;
      result.current_supabase_counts_before_reseed[targetTable] = supabaseCount;

      return {
        sheet_name: sheetName,
        target_table: targetTable,
        primary_key: primaryKey,
        spreadsheet_source_count: spreadsheetCount,
        current_supabase_count: supabaseCount,
        expected_after_reseed_count: spreadsheetCount,
        reseed_required: spreadsheetCount !== supabaseCount,
        order: result.reseed_insert_order.indexOf(sheetName) + 1
      };
    });

    addCheck('APP_TABLE_MANIFEST_HAS_15_TABLES',
      result.app_table_manifest.length === 15,
      {
        app_table_count: result.app_table_manifest.length
      }
    );

    addCheck('TOTAL_RESEED_TABLE_PLAN_HAS_17_TABLES',
      result.total_supabase_table_count_for_reseed === 17 &&
        result.metadata_tables.length === 2,
      {
        total_supabase_table_count_for_reseed: result.total_supabase_table_count_for_reseed,
        metadata_tables: result.metadata_tables
      }
    );

    addCheck('RESET_DELETE_ORDER_CHILD_TO_PARENT_WITH_METADATA_FIRST',
      result.reset_delete_order.length === 17 &&
        result.reset_delete_order[0] === 'migration_issues' &&
        result.reset_delete_order[1] === 'migration_row_map' &&
        result.reset_delete_order[2] === REPO_TABLES.BILLING_FEEDBACKS &&
        result.reset_delete_order[result.reset_delete_order.length - 1] === REPO_TABLES.USERS,
      result.reset_delete_order
    );

    addCheck('RESEED_INSERT_ORDER_PARENT_TO_CHILD_WITH_METADATA_LAST',
      result.reseed_insert_order.length === 17 &&
        result.reseed_insert_order[0] === REPO_TABLES.USERS &&
        result.reseed_insert_order[1] === REPO_TABLES.PATIENTS &&
        result.reseed_insert_order[14] === REPO_TABLES.BILLING_FEEDBACKS &&
        result.reseed_insert_order[15] === 'migration_row_map' &&
        result.reseed_insert_order[16] === 'migration_issues',
      result.reseed_insert_order
    );

    addCheck('NO_DUPLICATE_TABLES_IN_RESET_OR_RESEED_ORDER',
      hasDuplicate_(result.reset_delete_order) === false &&
        hasDuplicate_(result.reseed_insert_order) === false,
      {
        reset_delete_order: result.reset_delete_order,
        reseed_insert_order: result.reseed_insert_order
      }
    );

    addCheck('ALL_APP_TABLES_HAVE_TARGET_TABLE_AND_PRIMARY_KEY',
      result.app_table_manifest.every(function(row) {
        return !!row.sheet_name && !!row.target_table && !!row.primary_key;
      }),
      result.app_table_manifest
    );

    addCheck('PRODUCTION_COUNTS_ARE_SOURCE_OF_TRUTH_FOR_RESEED',
      result.expected_counts_after_reseed.patients === 323 &&
        result.expected_counts_after_reseed.appointments === 336 &&
        result.expected_counts_after_reseed.treatments === 298 &&
        result.expected_counts_after_reseed.treatment_items === 566 &&
        result.expected_counts_after_reseed.medical_records === 298 &&
        result.expected_counts_after_reseed.patient_photos === 301 &&
        result.expected_counts_after_reseed.ortho_recalls === 159 &&
        result.expected_counts_after_reseed.billings === 90 &&
        result.expected_counts_after_reseed.billing_items === 176 &&
        result.expected_counts_after_reseed.payments === 86,
      result.expected_counts_after_reseed
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C3',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.reseed_plan_ready = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-3-FinalReseed-PlanScaffold',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_RESEED_PLAN_SCAFFOLD_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationSchemaReadinessLog() {
  const result = {
    success: true,
    stage: '8C-4-FinalMigration-SchemaReadinessAudit',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    app_schema_checks: {},
    metadata_schema_checks: {},
    summary: {
      app_table_count: 0,
      metadata_table_count: 0,
      checked_column_count: 0,
      missing_column_count: 0,
      inaccessible_table_count: 0
    },
    missing_columns_by_table: {},
    inaccessible_tables: [],
    required_schema_patches_confirmed: {
      patients_7c_columns: false,
      finance_7g_columns: false,
      billing_feedback_integer_nullable_safe: false,
      treatment_items_duplicate_safe_columns: false,
      metadata_tables_available: false
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      schema_ready_for_8C5_reseed_helper_scaffold: false,
      next_step: '8C-5-FinalResetReseed-HelperScaffold-DefaultOff'
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

  function trySelectColumn_(targetTable, columnName) {
    try {
      const res = supabaseStagingSelect_(
        targetTable,
        {
          select: columnName,
          limit: 1
        },
        {}
      );

      return {
        ok: !!(res && res.success),
        status_code: res && res.status_code ? res.status_code : '',
        message: res && res.message ? res.message : ''
      };

    } catch (err) {
      return {
        ok: false,
        status_code: '',
        message: err && err.message ? err.message : String(err || '')
      };
    }
  }

  function checkTableColumns_(targetTable, columns) {
    const tableResult = {
      target_table: targetTable,
      checked_columns: columns.slice(),
      missing_columns: [],
      inaccessible: false
    };

    columns.forEach(function(columnName) {
      result.summary.checked_column_count++;

      const check = trySelectColumn_(targetTable, columnName);

      if (!check.ok) {
        tableResult.missing_columns.push({
          column: columnName,
          status_code: check.status_code,
          message: check.message
        });
      }
    });

    if (tableResult.missing_columns.length > 0) {
      result.missing_columns_by_table[targetTable] = tableResult.missing_columns.map(function(row) {
        return row.column;
      });

      result.summary.missing_column_count += tableResult.missing_columns.length;
    }

    const idCheck = trySelectColumn_(targetTable, columns[0] || 'id');
    if (!idCheck.ok && tableResult.missing_columns.length === columns.length) {
      tableResult.inaccessible = true;
      result.inaccessible_tables.push(targetTable);
      result.summary.inaccessible_table_count++;
    }

    return tableResult;
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const expectedColumnsBySheet = {};

    expectedColumnsBySheet[REPO_TABLES.USERS] = [
      'id',
      'user_id',
      'email',
      'full_name',
      'role',
      'is_active',
      'created_at',
      'updated_at'
    ];

    expectedColumnsBySheet[REPO_TABLES.PATIENTS] = [
      'id',
      'patient_id',
      'patient_code',
      'full_name',
      'gender',
      'birth_date',
      'phone',
      'email',
      'address',
      'guardian_name',
      'guardian_relationship',
      'guardian_phone',
      'guardian_email',
      'allergy_notes',
      'medical_notes',
      'first_clinic_id',
      'is_active',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.SERVICE_CATALOG] = [
      'id',
      'service_id',
      'service_name',
      'category',
      'default_price',
      'is_active',
      'is_ortho_install',
      'is_ortho_control',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.APPOINTMENTS] = [
      'id',
      'appointment_id',
      'patient_id',
      'patient_uuid',
      'appointment_date',
      'appointment_time',
      'status',
      'complaint',
      'notes',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.TREATMENTS] = [
      'id',
      'treatment_id',
      'appointment_id',
      'appointment_uuid',
      'patient_id',
      'patient_uuid',
      'doctor_user_id',
      'doctor_user_uuid',
      'treatment_date',
      'chief_complaint',
      'diagnosis',
      'notes',
      'status',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.TREATMENT_ITEMS] = [
      'id',
      'treatment_item_id',
      'treatment_id',
      'treatment_uuid',
      'service_id',
      'service_uuid',
      'service_name',
      'qty',
      'unit_price',
      'subtotal',
      'legacy_duplicate_group',
      'legacy_duplicate_index',
      'legacy_duplicate_count',
      'mapping_status',
      'source_row_number',
      'source_sheet',
      'raw_snapshot',
      'created_at',
      'updated_at'
    ];

    expectedColumnsBySheet[REPO_TABLES.MEDICAL_RECORDS] = [
      'id',
      'record_id',
      'treatment_id',
      'treatment_uuid',
      'patient_id',
      'patient_uuid',
      'record_date',
      'chief_complaint',
      'diagnosis',
      'treatment_notes',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.PATIENT_PHOTOS] = [
      'id',
      'photo_id',
      'patient_id',
      'patient_uuid',
      'treatment_id',
      'treatment_uuid',
      'visit_date',
      'photo_group',
      'photo_type',
      'file_name',
      'file_url',
      'file_drive_id',
      'photo_note',
      'is_active',
      'created_at',
      'updated_at',
      'deleted_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.ORTHO_RECALL] = [
      'id',
      'ortho_recall_id',
      'patient_id',
      'patient_uuid',
      'install_treatment_id',
      'install_treatment_uuid',
      'last_control_treatment_id',
      'last_control_treatment_uuid',
      'install_date',
      'last_control_date',
      'next_due_date',
      'control_count',
      'program_status',
      'followup_status',
      'completed_at',
      'last_contact_date',
      'last_contact_note',
      'notes',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.BILLINGS] = [
      'id',
      'billing_id',
      'billing_number',
      'treatment_id',
      'treatment_uuid',
      'appointment_id',
      'appointment_uuid',
      'patient_id',
      'patient_uuid',
      'patient_name',
      'billing_date',
      'due_date',
      'subtotal',
      'discount_total',
      'grand_total',
      'paid_total',
      'outstanding_total',
      'payment_status',
      'billing_status',
      'payment_type',
      'payment_terms',
      'notes',
      'invoice_pdf_file_id',
      'invoice_pdf_url',
      'invoice_sent_to',
      'invoice_sent_at',
      'invoice_delivery_status',
      'invoice_pdf_signature',
      'invoice_pdf_signature_at',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.BILLING_ITEMS] = [
      'id',
      'billing_item_id',
      'billing_id',
      'billing_uuid',
      'treatment_id',
      'treatment_uuid',
      'treatment_item_id',
      'treatment_item_uuid',
      'service_id',
      'service_uuid',
      'service_name',
      'qty',
      'unit_price',
      'subtotal',
      'mapping_status',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.BILLING_ADJUSTMENTS] = [
      'id',
      'adjustment_id',
      'billing_id',
      'billing_uuid',
      'adjustment_type',
      'label',
      'amount',
      'reason',
      'created_by',
      'created_by_uuid',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.BILLING_INSTALLMENTS] = [
      'id',
      'installment_id',
      'billing_id',
      'billing_uuid',
      'installment_no',
      'due_date',
      'amount_due',
      'paid_amount',
      'status',
      'paid_at',
      'notes',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.PAYMENTS] = [
      'id',
      'payment_id',
      'billing_id',
      'billing_uuid',
      'payment_scope',
      'installment_id',
      'installment_uuid',
      'payment_date',
      'payment_method',
      'amount',
      'reference_no',
      'received_by',
      'received_by_uuid',
      'notes',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    expectedColumnsBySheet[REPO_TABLES.BILLING_FEEDBACKS] = [
      'id',
      'feedback_id',
      'billing_id',
      'billing_uuid',
      'patient_id',
      'patient_uuid',
      'patient_name',
      'feedback_token',
      'feedback_status',
      'rating',
      'service_quality',
      'staff_friendliness',
      'clinic_cleanliness',
      'waiting_time',
      'comment',
      'submitted_at',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ];

    Object.keys(expectedColumnsBySheet).forEach(function(sheetName) {
      const targetTable = repoGetTargetTableForSheet_(sheetName);
      const columns = expectedColumnsBySheet[sheetName];

      result.app_schema_checks[targetTable] = checkTableColumns_(targetTable, columns);
      result.summary.app_table_count++;
    });

    result.metadata_schema_checks.migration_row_map = checkTableColumns_('migration_row_map', [
      'id',
      'source_sheet',
      'source_row_number',
      'source_pk',
      'target_table',
      'target_uuid',
      'created_at'
    ]);

    result.metadata_schema_checks.migration_issues = checkTableColumns_('migration_issues', [
      'id',
      'source_sheet',
      'source_row_number',
      'source_pk',
      'issue_type',
      'severity',
      'status',
      'message',
      'details',
      'created_at'
    ]);

    result.summary.metadata_table_count = 2;

    result.required_schema_patches_confirmed.patients_7c_columns =
      (result.missing_columns_by_table.patients || []).filter(function(col) {
        return [
          'email',
          'guardian_name',
          'guardian_relationship',
          'guardian_phone',
          'guardian_email',
          'allergy_notes',
          'first_clinic_id'
        ].indexOf(col) !== -1;
      }).length === 0;

    result.required_schema_patches_confirmed.finance_7g_columns =
      (result.missing_columns_by_table.billing_adjustments || []).indexOf('label') === -1 &&
      (result.missing_columns_by_table.billing_installments || []).indexOf('amount_due') === -1 &&
      (result.missing_columns_by_table.billing_installments || []).indexOf('status') === -1 &&
      (result.missing_columns_by_table.billing_installments || []).indexOf('paid_at') === -1 &&
      (result.missing_columns_by_table.payments || []).indexOf('payment_scope') === -1;

    result.required_schema_patches_confirmed.billing_feedback_integer_nullable_safe =
      (result.missing_columns_by_table.billing_feedbacks || []).indexOf('rating') === -1 &&
      (result.missing_columns_by_table.billing_feedbacks || []).indexOf('service_quality') === -1 &&
      (result.missing_columns_by_table.billing_feedbacks || []).indexOf('staff_friendliness') === -1 &&
      (result.missing_columns_by_table.billing_feedbacks || []).indexOf('clinic_cleanliness') === -1 &&
      (result.missing_columns_by_table.billing_feedbacks || []).indexOf('waiting_time') === -1;

    result.required_schema_patches_confirmed.treatment_items_duplicate_safe_columns =
      (result.missing_columns_by_table.treatment_items || []).indexOf('legacy_duplicate_group') === -1 &&
      (result.missing_columns_by_table.treatment_items || []).indexOf('legacy_duplicate_index') === -1 &&
      (result.missing_columns_by_table.treatment_items || []).indexOf('legacy_duplicate_count') === -1 &&
      (result.missing_columns_by_table.treatment_items || []).indexOf('mapping_status') === -1 &&
      (result.missing_columns_by_table.treatment_items || []).indexOf('source_row_number') === -1 &&
      (result.missing_columns_by_table.treatment_items || []).indexOf('source_sheet') === -1;

    result.required_schema_patches_confirmed.metadata_tables_available =
      result.metadata_schema_checks.migration_row_map.missing_columns.length === 0 &&
      result.metadata_schema_checks.migration_issues.missing_columns.length === 0;

    addCheck('ALL_APP_TABLES_SCHEMA_READABLE',
      result.summary.app_table_count === 15 &&
        result.summary.inaccessible_table_count === 0,
      {
        app_table_count: result.summary.app_table_count,
        inaccessible_tables: result.inaccessible_tables
      }
    );

    addCheck('NO_REQUIRED_COLUMNS_MISSING',
      result.summary.missing_column_count === 0,
      {
        missing_column_count: result.summary.missing_column_count,
        missing_columns_by_table: result.missing_columns_by_table
      }
    );

    addCheck('PATIENTS_7C_SCHEMA_PATCHES_PRESENT',
      result.required_schema_patches_confirmed.patients_7c_columns === true,
      result.missing_columns_by_table.patients || []
    );

    addCheck('FINANCE_7G_SCHEMA_PATCHES_PRESENT',
      result.required_schema_patches_confirmed.finance_7g_columns === true,
      result.required_schema_patches_confirmed
    );

    addCheck('BILLING_FEEDBACK_COLUMNS_PRESENT_FOR_SAFE_NULL_PAYLOAD',
      result.required_schema_patches_confirmed.billing_feedback_integer_nullable_safe === true,
      result.missing_columns_by_table.billing_feedbacks || []
    );

    addCheck('TREATMENT_ITEMS_DUPLICATE_SAFE_COLUMNS_PRESENT',
      result.required_schema_patches_confirmed.treatment_items_duplicate_safe_columns === true,
      result.missing_columns_by_table.treatment_items || []
    );

    addCheck('MIGRATION_METADATA_TABLES_AVAILABLE',
      result.required_schema_patches_confirmed.metadata_tables_available === true,
      result.metadata_schema_checks
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C4',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.schema_ready_for_8C5_reseed_helper_scaffold = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-4-FinalMigration-SchemaReadinessAudit',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_SCHEMA_READINESS_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationSchemaReadinessCompactLog() {
  const result = {
    success: true,
    stage: '8C-4A-FinalMigration-SchemaReadiness-Compact',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    missing_columns_by_table: {},
    summary: {
      checked_table_count: 0,
      checked_column_count: 0,
      missing_column_count: 0,
      failed_table_count: 0
    },
    schema_ready_for_8C5: false,
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

  function checkColumn_(targetTable, columnName) {
    result.summary.checked_column_count++;

    try {
      const res = supabaseStagingSelect_(
        targetTable,
        {
          select: columnName,
          limit: 1
        },
        {}
      );

      return !!(res && res.success);

    } catch (err) {
      return false;
    }
  }

  function checkTable_(targetTable, columns) {
    result.summary.checked_table_count++;

    const missing = [];

    columns.forEach(function(columnName) {
      if (!checkColumn_(targetTable, columnName)) {
        missing.push(columnName);
      }
    });

    if (missing.length) {
      result.missing_columns_by_table[targetTable] = missing;
      result.summary.missing_column_count += missing.length;
      result.summary.failed_table_count++;
    }
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    checkTable_('app_users', [
      'id',
      'user_id',
      'email',
      'full_name',
      'role',
      'is_active',
      'created_at',
      'updated_at'
    ]);

    checkTable_('patients', [
      'id',
      'patient_id',
      'patient_code',
      'full_name',
      'email',
      'guardian_name',
      'guardian_relationship',
      'guardian_phone',
      'guardian_email',
      'allergy_notes',
      'first_clinic_id',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ]);

    checkTable_('treatments', [
      'id',
      'treatment_id',
      'appointment_id',
      'appointment_uuid',
      'patient_id',
      'patient_uuid',
      'doctor_user_id',
      'doctor_user_uuid',
      'treatment_date',
      'chief_complaint',
      'diagnosis',
      'notes',
      'status',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ]);

    checkTable_('treatment_items', [
      'id',
      'treatment_item_id',
      'treatment_id',
      'treatment_uuid',
      'service_id',
      'service_uuid',
      'legacy_duplicate_group',
      'legacy_duplicate_index',
      'legacy_duplicate_count',
      'mapping_status',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ]);

    checkTable_('medical_records', [
      'id',
      'record_id',
      'treatment_id',
      'treatment_uuid',
      'patient_id',
      'patient_uuid',
      'record_date',
      'chief_complaint',
      'diagnosis',
      'treatment_notes',
      'created_at',
      'updated_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ]);

    checkTable_('patient_photos', [
      'id',
      'photo_id',
      'patient_id',
      'patient_uuid',
      'treatment_id',
      'treatment_uuid',
      'visit_date',
      'photo_group',
      'photo_type',
      'file_name',
      'file_url',
      'file_drive_id',
      'photo_note',
      'is_active',
      'created_at',
      'updated_at',
      'deleted_at',
      'source_row_number',
      'source_sheet',
      'raw_snapshot'
    ]);

    checkTable_('billing_adjustments', [
      'id',
      'adjustment_id',
      'billing_id',
      'billing_uuid',
      'adjustment_type',
      'label',
      'amount',
      'reason',
      'created_by',
      'created_by_uuid'
    ]);

    checkTable_('billing_installments', [
      'id',
      'installment_id',
      'billing_id',
      'billing_uuid',
      'installment_no',
      'due_date',
      'amount_due',
      'paid_amount',
      'status',
      'paid_at'
    ]);

    checkTable_('payments', [
      'id',
      'payment_id',
      'billing_id',
      'billing_uuid',
      'payment_scope',
      'installment_id',
      'installment_uuid',
      'payment_date',
      'payment_method',
      'amount',
      'reference_no',
      'received_by',
      'received_by_uuid'
    ]);

    checkTable_('billing_feedbacks', [
      'id',
      'feedback_id',
      'billing_id',
      'billing_uuid',
      'patient_id',
      'patient_uuid',
      'feedback_token',
      'feedback_status',
      'rating',
      'service_quality',
      'staff_friendliness',
      'clinic_cleanliness',
      'waiting_time',
      'submitted_at'
    ]);

    checkTable_('migration_row_map', [
      'id',
      'source_sheet',
      'source_row_number',
      'source_pk',
      'target_table',
      'target_uuid',
      'created_at'
    ]);

    checkTable_('migration_issues', [
      'id',
      'source_sheet',
      'source_row_number',
      'source_pk',
      'issue_type',
      'severity',
      'status',
      'message',
      'details',
      'created_at'
    ]);

    addCheck('NO_REQUIRED_COLUMNS_MISSING_FOR_FINAL_RESEED',
      result.summary.missing_column_count === 0,
      {
        summary: result.summary,
        missing_columns_by_table: result.missing_columns_by_table
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.schema_ready_for_8C5 = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-4A-FinalMigration-SchemaReadiness-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_SCHEMA_READINESS_COMPACT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function cutoverAssertFinalMigrationOperationAllowed8C_(operationName, tableName, options) {
  const opts = Object.assign({}, options || {});

  repoAssertSupabaseFinalMigrationAllowed_({
    operation: operationName || 'FINAL_MIGRATION_OPERATION_8C',
    backend_mode: REPO_BACKEND_MODES.SUPABASE,
    intent: repoGetSupabaseFinalMigrationIntent_(),
    stage: opts.stage || '8C',
    table_name: tableName
  });

  return true;
}

function cutoverNormalizeFinalMigrationTable8C_(tableName) {
  const raw = String(tableName || '').trim();

  if (raw === 'migration_row_map' || raw === 'migration_issues') {
    return {
      sheet_name: '',
      target_table: raw,
      primary_key: 'id',
      is_metadata_table: true
    };
  }

  const sheetName = repoNormalizeTableName_(raw);

  return {
    sheet_name: sheetName,
    target_table: repoGetTargetTableForSheet_(sheetName),
    primary_key: repoGetPrimaryKeyForTable_(sheetName),
    is_metadata_table: false
  };
}

function cutoverFinalReseedDeleteAllRows8C_(tableName, options) {
  const tableInfo = cutoverNormalizeFinalMigrationTable8C_(tableName);

  cutoverAssertFinalMigrationOperationAllowed8C_(
    'FINAL_RESEED_DELETE_ALL_ROWS_8C',
    tableInfo.is_metadata_table ? REPO_TABLES.PATIENTS : tableInfo.sheet_name,
    options
  );

  /*
   * SAFETY:
   * Belum implement delete destructive di 8C-5.
   * Implementasi DELETE/TRUNCATE baru boleh dibuat pada sub-step terpisah
   * setelah backup + freeze + final migration flag benar-benar aktif.
   */
  throw new Error('FINAL_RESEED_DELETE_ALL_ROWS_8C belum diimplementasikan. Scaffold only.');
}

function cutoverFinalReseedInsertRows8C_(tableName, rows, options) {
  const tableInfo = cutoverNormalizeFinalMigrationTable8C_(tableName);

  cutoverAssertFinalMigrationOperationAllowed8C_(
    'FINAL_RESEED_INSERT_ROWS_8C',
    tableInfo.is_metadata_table ? REPO_TABLES.PATIENTS : tableInfo.sheet_name,
    options
  );

  /*
   * SAFETY:
   * Belum implement insert reseed di 8C-5.
   * Mapping payload per table baru dibuat bertahap setelah scaffold default-off clean.
   */
  throw new Error('FINAL_RESEED_INSERT_ROWS_8C belum diimplementasikan. Scaffold only.');
}

function cutoverBuildFinalReseedOrder8C_() {
  return {
    reset_delete_order: [
      'migration_issues',
      'migration_row_map',
      REPO_TABLES.BILLING_FEEDBACKS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.USERS
    ],
    reseed_insert_order: [
      REPO_TABLES.USERS,
      REPO_TABLES.PATIENTS,
      REPO_TABLES.SERVICE_CATALOG,
      REPO_TABLES.APPOINTMENTS,
      REPO_TABLES.TREATMENTS,
      REPO_TABLES.TREATMENT_ITEMS,
      REPO_TABLES.MEDICAL_RECORDS,
      REPO_TABLES.PATIENT_PHOTOS,
      REPO_TABLES.ORTHO_RECALL,
      REPO_TABLES.BILLINGS,
      REPO_TABLES.BILLING_ITEMS,
      REPO_TABLES.BILLING_ADJUSTMENTS,
      REPO_TABLES.BILLING_INSTALLMENTS,
      REPO_TABLES.PAYMENTS,
      REPO_TABLES.BILLING_FEEDBACKS,
      'migration_row_map',
      'migration_issues'
    ]
  };
}

function testCutoverPhase8CFinalResetReseedHelperScaffoldDefaultOffLog() {
  const result = {
    success: true,
    stage: '8C-5-FinalResetReseed-HelperScaffold-DefaultOff',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    helper_availability: {},
    before_counts: {},
    after_counts: {},
    reseed_order: {},
    blocked_summary: {
      expected_blocked: 0,
      blocked_count: 0,
      failed_to_block: []
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      helper_scaffold_ready_for_8C6_mapping_plan: false,
      next_step: '8C-6-FinalMigration-TablePayloadMappingPlan'
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

  function getSupabaseCounts_() {
    const options = {
      backend_mode: 'supabase'
    };

    return {
      app_users: (dbFindAll_(REPO_TABLES.USERS, options) || []).length,
      patients: (dbFindAll_(REPO_TABLES.PATIENTS, options) || []).length,
      service_catalog: (dbFindAll_(REPO_TABLES.SERVICE_CATALOG, options) || []).length,
      appointments: (dbFindAll_(REPO_TABLES.APPOINTMENTS, options) || []).length,
      treatments: (dbFindAll_(REPO_TABLES.TREATMENTS, options) || []).length,
      treatment_items: (dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, options) || []).length,
      medical_records: (dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, options) || []).length,
      patient_photos: (dbFindAll_(REPO_TABLES.PATIENT_PHOTOS, options) || []).length,
      ortho_recalls: (dbFindAll_(REPO_TABLES.ORTHO_RECALL, options) || []).length,
      billings: (dbFindAll_(REPO_TABLES.BILLINGS, options) || []).length,
      billing_items: (dbFindAll_(REPO_TABLES.BILLING_ITEMS, options) || []).length,
      billing_adjustments: (dbFindAll_(REPO_TABLES.BILLING_ADJUSTMENTS, options) || []).length,
      billing_installments: (dbFindAll_(REPO_TABLES.BILLING_INSTALLMENTS, options) || []).length,
      payments: (dbFindAll_(REPO_TABLES.PAYMENTS, options) || []).length,
      billing_feedbacks: (dbFindAll_(REPO_TABLES.BILLING_FEEDBACKS, options) || []).length
    };
  }

  function attemptShouldBlock_(name, fn) {
    result.blocked_summary.expected_blocked++;

    try {
      fn();

      result.blocked_summary.failed_to_block.push({
        name: name,
        issue: 'OPERATION_NOT_BLOCKED'
      });

    } catch (err) {
      const message = err && err.message ? err.message : String(err || '');

      if (
        message.indexOf('REPO_SUPABASE_FINAL_MIGRATION_RESEED_ENABLED masih false') !== -1 ||
        message.indexOf('REPO_PRODUCTION_MUTATION_FREEZE_ENABLED harus true') !== -1
      ) {
        result.blocked_summary.blocked_count++;
        return;
      }

      result.blocked_summary.failed_to_block.push({
        name: name,
        message: message
      });
    }
  }

  try {
    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    result.helper_availability = {
      cutoverAssertFinalMigrationOperationAllowed8C_: typeof cutoverAssertFinalMigrationOperationAllowed8C_ === 'function',
      cutoverNormalizeFinalMigrationTable8C_: typeof cutoverNormalizeFinalMigrationTable8C_ === 'function',
      cutoverFinalReseedDeleteAllRows8C_: typeof cutoverFinalReseedDeleteAllRows8C_ === 'function',
      cutoverFinalReseedInsertRows8C_: typeof cutoverFinalReseedInsertRows8C_ === 'function',
      cutoverBuildFinalReseedOrder8C_: typeof cutoverBuildFinalReseedOrder8C_ === 'function'
    };

    addCheck('FINAL_RESEED_HELPERS_AVAILABLE',
      result.helper_availability.cutoverAssertFinalMigrationOperationAllowed8C_ === true &&
        result.helper_availability.cutoverNormalizeFinalMigrationTable8C_ === true &&
        result.helper_availability.cutoverFinalReseedDeleteAllRows8C_ === true &&
        result.helper_availability.cutoverFinalReseedInsertRows8C_ === true &&
        result.helper_availability.cutoverBuildFinalReseedOrder8C_ === true,
      result.helper_availability
    );

    result.before_counts = getSupabaseCounts_();

    result.reseed_order = cutoverBuildFinalReseedOrder8C_();

    addCheck('RESEED_ORDER_HAS_17_DELETE_AND_17_INSERT_STEPS',
      result.reseed_order.reset_delete_order.length === 17 &&
        result.reseed_order.reseed_insert_order.length === 17,
      result.reseed_order
    );

    addCheck('RESEED_DELETE_ORDER_STARTS_METADATA_AND_ENDS_USERS',
      result.reseed_order.reset_delete_order[0] === 'migration_issues' &&
        result.reseed_order.reset_delete_order[1] === 'migration_row_map' &&
        result.reseed_order.reset_delete_order[result.reseed_order.reset_delete_order.length - 1] === REPO_TABLES.USERS,
      result.reseed_order.reset_delete_order
    );

    addCheck('RESEED_INSERT_ORDER_STARTS_USERS_AND_ENDS_METADATA',
      result.reseed_order.reseed_insert_order[0] === REPO_TABLES.USERS &&
        result.reseed_order.reseed_insert_order[1] === REPO_TABLES.PATIENTS &&
        result.reseed_order.reseed_insert_order[15] === 'migration_row_map' &&
        result.reseed_order.reseed_insert_order[16] === 'migration_issues',
      result.reseed_order.reseed_insert_order
    );

    const patientInfo = cutoverNormalizeFinalMigrationTable8C_(REPO_TABLES.PATIENTS);
    const metadataInfo = cutoverNormalizeFinalMigrationTable8C_('migration_row_map');

    addCheck('TABLE_NORMALIZER_SUPPORTS_APP_AND_METADATA_TABLES',
      patientInfo.sheet_name === REPO_TABLES.PATIENTS &&
        patientInfo.target_table === 'patients' &&
        patientInfo.primary_key === 'patient_id' &&
        patientInfo.is_metadata_table === false &&
        metadataInfo.target_table === 'migration_row_map' &&
        metadataInfo.is_metadata_table === true,
      {
        patientInfo: patientInfo,
        metadataInfo: metadataInfo
      }
    );

    attemptShouldBlock_('delete_patients_default_off', function() {
      return cutoverFinalReseedDeleteAllRows8C_(REPO_TABLES.PATIENTS, {
        stage: '8C'
      });
    });

    attemptShouldBlock_('insert_patients_default_off', function() {
      return cutoverFinalReseedInsertRows8C_(
        REPO_TABLES.PATIENTS,
        [
          {
            patient_id: 'PAT-8C-SHOULD-NOT-INSERT'
          }
        ],
        {
          stage: '8C'
        }
      );
    });

    attemptShouldBlock_('delete_metadata_default_off', function() {
      return cutoverFinalReseedDeleteAllRows8C_('migration_row_map', {
        stage: '8C'
      });
    });

    attemptShouldBlock_('insert_metadata_default_off', function() {
      return cutoverFinalReseedInsertRows8C_(
        'migration_row_map',
        [
          {
            source_sheet: 'Patients',
            source_row_number: 999999,
            source_pk: 'PAT-8C-SHOULD-NOT-INSERT'
          }
        ],
        {
          stage: '8C'
        }
      );
    });

    addCheck('FINAL_RESEED_HELPERS_DEFAULT_OFF_BLOCKED',
      result.blocked_summary.expected_blocked === 4 &&
        result.blocked_summary.blocked_count === 4 &&
        result.blocked_summary.failed_to_block.length === 0,
      result.blocked_summary
    );

    result.after_counts = getSupabaseCounts_();

    addCheck('SUPABASE_COUNTS_UNCHANGED_AFTER_DEFAULT_OFF_HELPER_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C5',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.helper_scaffold_ready_for_8C6_mapping_plan = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-5-FinalResetReseed-HelperScaffold-DefaultOff',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_RESET_RESEED_HELPER_SCAFFOLD_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function cutoverBuildFinalMigrationPayloadPlan8C_() {
  return [
    {
      sheet_name: REPO_TABLES.USERS,
      target_table: 'app_users',
      primary_key: 'user_id',
      row_map_required: true,
      uuid_resolution_required: false,
      dependency_tables: [],
      payload_fields: [
        'user_id', 'email', 'full_name', 'role', 'is_active', 'created_at', 'updated_at',
        'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.PATIENTS,
      target_table: 'patients',
      primary_key: 'patient_id',
      row_map_required: true,
      uuid_resolution_required: false,
      dependency_tables: [],
      payload_fields: [
        'patient_id', 'patient_code', 'full_name', 'gender', 'birth_date', 'phone', 'email',
        'address', 'guardian_name', 'guardian_relationship', 'guardian_phone', 'guardian_email',
        'allergy_notes', 'medical_notes', 'first_clinic_id', 'is_active',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.SERVICE_CATALOG,
      target_table: 'service_catalog',
      primary_key: 'service_id',
      row_map_required: true,
      uuid_resolution_required: false,
      dependency_tables: [],
      payload_fields: [
        'service_id', 'service_name', 'category', 'default_price',
        'is_active', 'is_ortho_install', 'is_ortho_control',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.APPOINTMENTS,
      target_table: 'appointments',
      primary_key: 'appointment_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.PATIENTS],
      payload_fields: [
        'appointment_id', 'patient_id', 'patient_uuid',
        'appointment_date', 'appointment_time', 'status', 'complaint', 'notes',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.TREATMENTS,
      target_table: 'treatments',
      primary_key: 'treatment_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.PATIENTS, REPO_TABLES.APPOINTMENTS, REPO_TABLES.USERS],
      payload_fields: [
        'treatment_id', 'appointment_id', 'appointment_uuid', 'patient_id', 'patient_uuid',
        'doctor_user_id', 'doctor_user_uuid', 'treatment_date', 'chief_complaint',
        'diagnosis', 'notes', 'status',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.TREATMENT_ITEMS,
      target_table: 'treatment_items',
      primary_key: 'treatment_item_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.TREATMENTS, REPO_TABLES.SERVICE_CATALOG],
      duplicate_safe: true,
      payload_fields: [
        'treatment_item_id', 'treatment_id', 'treatment_uuid',
        'service_id', 'service_uuid', 'service_name',
        'qty', 'unit_price', 'subtotal',
        'legacy_duplicate_group', 'legacy_duplicate_index', 'legacy_duplicate_count', 'mapping_status',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.MEDICAL_RECORDS,
      target_table: 'medical_records',
      primary_key: 'record_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.PATIENTS, REPO_TABLES.TREATMENTS],
      payload_fields: [
        'record_id', 'treatment_id', 'treatment_uuid', 'patient_id', 'patient_uuid',
        'record_date', 'chief_complaint', 'diagnosis', 'treatment_notes',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.PATIENT_PHOTOS,
      target_table: 'patient_photos',
      primary_key: 'photo_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.PATIENTS, REPO_TABLES.TREATMENTS, REPO_TABLES.USERS],
      payload_fields: [
        'photo_id', 'patient_id', 'patient_uuid', 'treatment_id', 'treatment_uuid',
        'visit_date', 'photo_group', 'photo_type', 'file_name', 'file_url', 'file_drive_id',
        'photo_note', 'uploaded_by', 'uploaded_by_uuid', 'is_active', 'deleted_at',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.ORTHO_RECALL,
      target_table: 'ortho_recalls',
      primary_key: 'ortho_recall_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.PATIENTS, REPO_TABLES.TREATMENTS],
      known_nullable_parent_artifacts_allowed: ['install_treatment_uuid'],
      payload_fields: [
        'ortho_recall_id', 'patient_id', 'patient_uuid',
        'install_treatment_id', 'install_treatment_uuid',
        'last_control_treatment_id', 'last_control_treatment_uuid',
        'install_date', 'last_control_date', 'next_due_date', 'control_count',
        'program_status', 'followup_status', 'completed_at',
        'last_contact_date', 'last_contact_note', 'notes',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.BILLINGS,
      target_table: 'billings',
      primary_key: 'billing_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.PATIENTS, REPO_TABLES.APPOINTMENTS, REPO_TABLES.TREATMENTS],
      known_nullable_parent_artifacts_allowed: ['treatment_uuid'],
      payload_fields: [
        'billing_id', 'billing_number', 'treatment_id', 'treatment_uuid',
        'appointment_id', 'appointment_uuid', 'patient_id', 'patient_uuid', 'patient_name',
        'billing_date', 'due_date', 'subtotal', 'discount_total', 'grand_total',
        'paid_total', 'outstanding_total', 'payment_status', 'billing_status',
        'payment_type', 'payment_terms', 'notes',
        'invoice_pdf_file_id', 'invoice_pdf_url', 'invoice_sent_to', 'invoice_sent_at',
        'invoice_delivery_status', 'invoice_pdf_signature', 'invoice_pdf_signature_at',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.BILLING_ITEMS,
      target_table: 'billing_items',
      primary_key: 'billing_item_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.BILLINGS, REPO_TABLES.TREATMENTS, REPO_TABLES.TREATMENT_ITEMS, REPO_TABLES.SERVICE_CATALOG],
      known_nullable_parent_artifacts_allowed: ['treatment_uuid', 'treatment_item_uuid'],
      payload_fields: [
        'billing_item_id', 'billing_id', 'billing_uuid',
        'treatment_id', 'treatment_uuid',
        'treatment_item_id', 'treatment_item_uuid',
        'service_id', 'service_uuid', 'service_name',
        'qty', 'unit_price', 'subtotal', 'mapping_status',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.BILLING_ADJUSTMENTS,
      target_table: 'billing_adjustments',
      primary_key: 'adjustment_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.BILLINGS, REPO_TABLES.USERS],
      payload_fields: [
        'adjustment_id', 'billing_id', 'billing_uuid', 'adjustment_type', 'label',
        'amount', 'reason', 'created_by', 'created_by_uuid',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.BILLING_INSTALLMENTS,
      target_table: 'billing_installments',
      primary_key: 'installment_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.BILLINGS],
      payload_fields: [
        'installment_id', 'billing_id', 'billing_uuid', 'installment_no',
        'due_date', 'amount_due', 'paid_amount', 'status', 'paid_at', 'notes',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.PAYMENTS,
      target_table: 'payments',
      primary_key: 'payment_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.BILLINGS, REPO_TABLES.BILLING_INSTALLMENTS, REPO_TABLES.USERS],
      payload_fields: [
        'payment_id', 'billing_id', 'billing_uuid', 'payment_scope',
        'installment_id', 'installment_uuid', 'payment_date', 'payment_method',
        'amount', 'reference_no', 'received_by', 'received_by_uuid', 'notes',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    },
    {
      sheet_name: REPO_TABLES.BILLING_FEEDBACKS,
      target_table: 'billing_feedbacks',
      primary_key: 'feedback_id',
      row_map_required: true,
      uuid_resolution_required: true,
      dependency_tables: [REPO_TABLES.BILLINGS, REPO_TABLES.PATIENTS],
      payload_fields: [
        'feedback_id', 'billing_id', 'billing_uuid', 'patient_id', 'patient_uuid',
        'patient_name', 'feedback_token', 'feedback_status',
        'rating', 'service_quality', 'staff_friendliness', 'clinic_cleanliness',
        'waiting_time', 'comment', 'submitted_at',
        'created_at', 'updated_at', 'source_row_number', 'source_sheet', 'raw_snapshot'
      ]
    }
  ];
}

function testCutoverPhase8CFinalMigrationTablePayloadMappingPlanLog() {
  const result = {
    success: true,
    stage: '8C-6-FinalMigration-TablePayloadMappingPlan',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    summary: {
      table_count: 0,
      row_map_required_count: 0,
      uuid_resolution_required_count: 0,
      duplicate_safe_table_count: 0,
      total_payload_field_count: 0,
      source_total_rows: 0
    },
    compact_table_plan: [],
    dependency_summary: {},
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      payload_mapping_plan_ready_for_8C7: false,
      next_step: '8C-7-FinalMigration-PayloadBuilder-Scaffold'
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

  function hasDuplicate_(arr) {
    const seen = {};
    return (arr || []).some(function(item) {
      const key = String(item || '').trim();
      if (seen[key]) return true;
      seen[key] = true;
      return false;
    });
  }

  function getSpreadsheetCount_(sheetName) {
    return (dbFindAll_(sheetName, { backend_mode: 'spreadsheet' }) || []).length;
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const plan = cutoverBuildFinalMigrationPayloadPlan8C_();

    result.summary.table_count = plan.length;

    plan.forEach(function(tablePlan, index) {
      const sourceCount = getSpreadsheetCount_(tablePlan.sheet_name);

      if (tablePlan.row_map_required) result.summary.row_map_required_count++;
      if (tablePlan.uuid_resolution_required) result.summary.uuid_resolution_required_count++;
      if (tablePlan.duplicate_safe === true) result.summary.duplicate_safe_table_count++;

      result.summary.total_payload_field_count += (tablePlan.payload_fields || []).length;
      result.summary.source_total_rows += sourceCount;

      result.compact_table_plan.push({
        order: index + 1,
        sheet_name: tablePlan.sheet_name,
        target_table: tablePlan.target_table,
        primary_key: tablePlan.primary_key,
        source_count: sourceCount,
        payload_field_count: (tablePlan.payload_fields || []).length,
        dependency_count: (tablePlan.dependency_tables || []).length,
        row_map_required: tablePlan.row_map_required === true,
        uuid_resolution_required: tablePlan.uuid_resolution_required === true,
        duplicate_safe: tablePlan.duplicate_safe === true
      });

      result.dependency_summary[tablePlan.sheet_name] = tablePlan.dependency_tables || [];
    });

    addCheck('PAYLOAD_PLAN_HAS_15_APP_TABLES',
      result.summary.table_count === 15,
      result.summary
    );

    addCheck('ALL_TABLES_HAVE_TARGET_PRIMARY_AND_FIELDS',
      plan.every(function(row) {
        return !!row.sheet_name &&
          !!row.target_table &&
          !!row.primary_key &&
          Array.isArray(row.payload_fields) &&
          row.payload_fields.length > 0;
      }),
      result.compact_table_plan
    );

    addCheck('NO_DUPLICATE_PAYLOAD_FIELDS_PER_TABLE',
      plan.every(function(row) {
        return hasDuplicate_(row.payload_fields) === false;
      }),
      result.compact_table_plan
    );

    addCheck('ALL_TABLES_REQUIRE_ROW_MAP_FOR_FINAL_AUDIT',
      result.summary.row_map_required_count === 15,
      result.summary
    );

    addCheck('UUID_RESOLUTION_TABLE_COUNT_EXPECTED',
      result.summary.uuid_resolution_required_count === 12,
      result.summary
    );

    addCheck('TREATMENT_ITEMS_MARKED_DUPLICATE_SAFE',
      plan.some(function(row) {
        return row.sheet_name === REPO_TABLES.TREATMENT_ITEMS &&
          row.duplicate_safe === true &&
          row.payload_fields.indexOf('legacy_duplicate_group') !== -1 &&
          row.payload_fields.indexOf('mapping_status') !== -1 &&
          row.payload_fields.indexOf('source_row_number') !== -1;
      }),
      result.compact_table_plan
    );

    addCheck('PRODUCTION_SOURCE_COUNTS_MATCH_8C_EXPECTED',
      result.compact_table_plan.some(function(row) {
        return row.sheet_name === REPO_TABLES.PATIENTS && row.source_count === 323;
      }) &&
        result.compact_table_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.APPOINTMENTS && row.source_count === 336;
        }) &&
        result.compact_table_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.TREATMENTS && row.source_count === 298;
        }) &&
        result.compact_table_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.TREATMENT_ITEMS && row.source_count === 566;
        }) &&
        result.compact_table_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.BILLINGS && row.source_count === 90;
        }) &&
        result.compact_table_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.PAYMENTS && row.source_count === 86;
        }),
      result.compact_table_plan
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C6',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.payload_mapping_plan_ready_for_8C7 = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-6-FinalMigration-TablePayloadMappingPlan',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_TABLE_PAYLOAD_MAPPING_PLAN_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function cutoverGetPayloadPlanForSheet8C_(sheetName) {
  const normalizedSheetName = repoNormalizeTableName_(sheetName);
  const plan = cutoverBuildFinalMigrationPayloadPlan8C_();

  const found = plan.find(function(row) {
    return row.sheet_name === normalizedSheetName;
  });

  if (!found) {
    throw new Error('Payload plan tidak ditemukan untuk sheet: ' + normalizedSheetName);
  }

  return found;
}

function cutoverIsBlankValue8C_(value) {
  return value === null ||
    value === undefined ||
    String(value).trim() === '';
}

function cutoverNormalizeText8C_(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function cutoverNormalizeNullableText8C_(value) {
  if (cutoverIsBlankValue8C_(value)) return null;
  return String(value);
}

function cutoverNormalizeNumber8C_(value) {
  if (cutoverIsBlankValue8C_(value)) return null;

  if (typeof financeToAmount_ === 'function') {
    const amount = financeToAmount_(value);
    return isFinite(Number(amount)) ? Number(amount) : null;
  }

  const cleaned = String(value).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;

  const num = Number(cleaned);
  return isFinite(num) ? num : null;
}

function cutoverNormalizeBoolean8C_(value) {
  if (value === true || value === false) return value;
  if (cutoverIsBlankValue8C_(value)) return null;

  const raw = String(value).trim().toLowerCase();

  if (['true', 'yes', 'ya', 'aktif', 'active', '1'].indexOf(raw) !== -1) return true;
  if (['false', 'no', 'tidak', 'nonaktif', 'inactive', '0'].indexOf(raw) !== -1) return false;

  return null;
}

function cutoverNormalizeDateOrTimestamp8C_(value) {
  if (cutoverIsBlankValue8C_(value)) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  return String(value).trim();
}

function cutoverIsUuidLikeField8C_(fieldName) {
  return /_uuid$/.test(String(fieldName || ''));
}

function cutoverIsNumericField8C_(fieldName) {
  return [
    'default_price',
    'qty',
    'unit_price',
    'subtotal',
    'discount_total',
    'grand_total',
    'paid_total',
    'outstanding_total',
    'amount',
    'amount_due',
    'paid_amount',
    'installment_no',
    'control_count',
    'rating',
    'legacy_duplicate_index',
    'legacy_duplicate_count',
    'source_row_number'
  ].indexOf(String(fieldName || '')) !== -1;
}

function cutoverIsBooleanField8C_(fieldName) {
  return [
    'is_active',
    'is_ortho_install',
    'is_ortho_control'
  ].indexOf(String(fieldName || '')) !== -1;
}

function cutoverIsDateOrTimestampField8C_(fieldName) {
  return [
    'birth_date',
    'appointment_date',
    'treatment_date',
    'record_date',
    'visit_date',
    'billing_date',
    'due_date',
    'payment_date',
    'install_date',
    'last_control_date',
    'next_due_date',
    'last_contact_date',
    'completed_at',
    'paid_at',
    'submitted_at',
    'deleted_at',
    'invoice_sent_at',
    'invoice_pdf_signature_at',
    'created_at',
    'updated_at'
  ].indexOf(String(fieldName || '')) !== -1;
}

function cutoverNormalizePayloadFieldValue8C_(fieldName, value) {
  if (fieldName === 'raw_snapshot') return value || {};

  if (cutoverIsUuidLikeField8C_(fieldName)) {
    return cutoverNormalizeNullableText8C_(value);
  }

  if (cutoverIsNumericField8C_(fieldName)) {
    return cutoverNormalizeNumber8C_(value);
  }

  if (cutoverIsBooleanField8C_(fieldName)) {
    return cutoverNormalizeBoolean8C_(value);
  }

  if (cutoverIsDateOrTimestampField8C_(fieldName)) {
    return cutoverNormalizeDateOrTimestamp8C_(value);
  }

  return cutoverNormalizeText8C_(value);
}

function cutoverGetDirectSourceValue8C_(sourceRow, fieldName) {
  if (!sourceRow) return '';

  if (Object.prototype.hasOwnProperty.call(sourceRow, fieldName)) {
    return sourceRow[fieldName];
  }

  return '';
}

function cutoverResolveUuidField8C_(fieldName, sourceRow, uuidMaps) {
  const maps = uuidMaps || {};

  function getFromMap(mapName, sourceKey) {
    const map = maps[mapName] || {};
    const key = String(sourceKey || '').trim();

    if (!key) return null;

    return map[key] || null;
  }

  if (fieldName === 'patient_uuid') {
    return getFromMap(REPO_TABLES.PATIENTS, sourceRow.patient_id);
  }

  if (fieldName === 'appointment_uuid') {
    return getFromMap(REPO_TABLES.APPOINTMENTS, sourceRow.appointment_id);
  }

  if (fieldName === 'treatment_uuid') {
    return getFromMap(REPO_TABLES.TREATMENTS, sourceRow.treatment_id);
  }

  if (fieldName === 'install_treatment_uuid') {
    return getFromMap(REPO_TABLES.TREATMENTS, sourceRow.install_treatment_id);
  }

  if (fieldName === 'last_control_treatment_uuid') {
    return getFromMap(REPO_TABLES.TREATMENTS, sourceRow.last_control_treatment_id);
  }

  if (fieldName === 'doctor_user_uuid') {
    return getFromMap(REPO_TABLES.USERS, sourceRow.doctor_user_id);
  }

  if (fieldName === 'uploaded_by_uuid') {
    return getFromMap(REPO_TABLES.USERS, sourceRow.uploaded_by);
  }

  if (fieldName === 'created_by_uuid') {
    return getFromMap(REPO_TABLES.USERS, sourceRow.created_by);
  }

  if (fieldName === 'received_by_uuid') {
    return getFromMap(REPO_TABLES.USERS, sourceRow.received_by);
  }

  if (fieldName === 'service_uuid') {
    return getFromMap(REPO_TABLES.SERVICE_CATALOG, sourceRow.service_id);
  }

  if (fieldName === 'billing_uuid') {
    return getFromMap(REPO_TABLES.BILLINGS, sourceRow.billing_id);
  }

  if (fieldName === 'treatment_item_uuid') {
    return getFromMap(REPO_TABLES.TREATMENT_ITEMS, sourceRow.treatment_item_id);
  }

  if (fieldName === 'installment_uuid') {
    return getFromMap(REPO_TABLES.BILLING_INSTALLMENTS, sourceRow.installment_id);
  }

  return null;
}

function cutoverBuildFinalMigrationPayload8C_(sheetName, sourceRow, sourceRowNumber, uuidMaps) {
  const tablePlan = cutoverGetPayloadPlanForSheet8C_(sheetName);
  const row = sourceRow || {};
  const payload = {};

  tablePlan.payload_fields.forEach(function(fieldName) {
    let value;

    if (fieldName === 'source_row_number') {
      value = sourceRowNumber || null;

    } else if (fieldName === 'source_sheet') {
      value = tablePlan.sheet_name;

    } else if (fieldName === 'raw_snapshot') {
      value = row;

    } else if (cutoverIsUuidLikeField8C_(fieldName)) {
      value = cutoverResolveUuidField8C_(fieldName, row, uuidMaps || {});

    } else if (fieldName === 'mapping_status') {
      value = cutoverGetDirectSourceValue8C_(row, fieldName) || 'mapped_pending_uuid_resolution';

    } else if (fieldName === 'status' && tablePlan.sheet_name === REPO_TABLES.TREATMENTS) {
      value = cutoverGetDirectSourceValue8C_(row, fieldName) || 'completed';

    } else if (fieldName === 'record_date') {
      value = cutoverGetDirectSourceValue8C_(row, 'record_date') ||
        cutoverGetDirectSourceValue8C_(row, 'treatment_date');

    } else if (fieldName === 'treatment_notes') {
      value = cutoverGetDirectSourceValue8C_(row, 'treatment_notes') ||
        cutoverGetDirectSourceValue8C_(row, 'notes');

    } else if (fieldName === 'visit_date') {
      value = cutoverGetDirectSourceValue8C_(row, 'visit_date') ||
        cutoverGetDirectSourceValue8C_(row, 'created_at');

    } else if (fieldName === 'photo_group') {
      value = cutoverGetDirectSourceValue8C_(row, 'photo_group') ||
        cutoverGetDirectSourceValue8C_(row, 'photo_type');

    } else if (fieldName === 'file_drive_id') {
      value = cutoverGetDirectSourceValue8C_(row, 'file_drive_id') ||
        cutoverGetDirectSourceValue8C_(row, 'drive_file_id');

    } else if (fieldName === 'photo_note') {
      value = cutoverGetDirectSourceValue8C_(row, 'photo_note') ||
        cutoverGetDirectSourceValue8C_(row, 'notes');

    } else {
      value = cutoverGetDirectSourceValue8C_(row, fieldName);
    }

    payload[fieldName] = cutoverNormalizePayloadFieldValue8C_(fieldName, value);
  });

  return {
    sheet_name: tablePlan.sheet_name,
    target_table: tablePlan.target_table,
    primary_key: tablePlan.primary_key,
    source_pk: String(row[tablePlan.primary_key] || '').trim(),
    source_row_number: sourceRowNumber || null,
    payload: payload
  };
}

function testCutoverPhase8CFinalMigrationPayloadBuilderScaffoldLog() {
  const result = {
    success: true,
    stage: '8C-7-FinalMigration-PayloadBuilder-Scaffold',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    summary: {
      table_count: 0,
      non_empty_table_count: 0,
      empty_table_count: 0,
      sample_payload_built_count: 0,
      dangerous_empty_string_count: 0,
      missing_source_pk_count: 0
    },
    sample_payload_summary: [],
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      payload_builder_ready_for_8C8: false,
      next_step: '8C-8-FinalMigration-UUIDResolutionPlan'
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

  function findDangerousEmptyStringFields_(payload) {
    const dangerous = [];

    Object.keys(payload || {}).forEach(function(fieldName) {
      const value = payload[fieldName];

      if (
        value === '' &&
        (
          cutoverIsUuidLikeField8C_(fieldName) ||
          cutoverIsNumericField8C_(fieldName) ||
          cutoverIsBooleanField8C_(fieldName) ||
          cutoverIsDateOrTimestampField8C_(fieldName)
        )
      ) {
        dangerous.push(fieldName);
      }
    });

    return dangerous;
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const plan = cutoverBuildFinalMigrationPayloadPlan8C_();

    result.summary.table_count = plan.length;

    plan.forEach(function(tablePlan) {
      const rows = dbFindAll_(tablePlan.sheet_name, {
        backend_mode: 'spreadsheet'
      }) || [];

      if (!rows.length) {
        result.summary.empty_table_count++;

        result.sample_payload_summary.push({
          sheet_name: tablePlan.sheet_name,
          target_table: tablePlan.target_table,
          source_count: 0,
          sample_built: false,
          reason: 'empty source table'
        });

        return;
      }

      result.summary.non_empty_table_count++;

      const sampleRow = rows[0];
      const sampleSourceRowNumber = 2;

      const built = cutoverBuildFinalMigrationPayload8C_(
        tablePlan.sheet_name,
        sampleRow,
        sampleSourceRowNumber,
        {}
      );

      const dangerousEmptyFields = findDangerousEmptyStringFields_(built.payload);

      if (dangerousEmptyFields.length) {
        result.summary.dangerous_empty_string_count += dangerousEmptyFields.length;
      }

      if (!built.source_pk) {
        result.summary.missing_source_pk_count++;
      }

      result.summary.sample_payload_built_count++;

      result.sample_payload_summary.push({
        sheet_name: built.sheet_name,
        target_table: built.target_table,
        primary_key: built.primary_key,
        source_count: rows.length,
        source_pk_present: !!built.source_pk,
        source_row_number: built.source_row_number,
        payload_field_count: Object.keys(built.payload || {}).length,
        raw_snapshot_present: !!built.payload.raw_snapshot,
        source_sheet: built.payload.source_sheet,
        dangerous_empty_string_fields: dangerousEmptyFields
      });
    });

    addCheck('PAYLOAD_BUILDER_PLAN_HAS_15_TABLES',
      result.summary.table_count === 15,
      result.summary
    );

    addCheck('SAMPLE_PAYLOADS_BUILT_FOR_NON_EMPTY_TABLES',
      result.summary.sample_payload_built_count === result.summary.non_empty_table_count &&
        result.summary.sample_payload_built_count >= 10,
      result.summary
    );

    addCheck('NO_DANGEROUS_EMPTY_STRINGS_IN_SAMPLE_PAYLOADS',
      result.summary.dangerous_empty_string_count === 0,
      result.sample_payload_summary
    );

    addCheck('SOURCE_PK_PRESENT_FOR_SAMPLE_PAYLOADS',
      result.summary.missing_source_pk_count === 0,
      result.sample_payload_summary
    );

    addCheck('SOURCE_METADATA_PRESENT_IN_SAMPLE_PAYLOADS',
      result.sample_payload_summary
        .filter(function(row) {
          return row.sample_built !== false;
        })
        .every(function(row) {
          return row.source_row_number === 2 &&
            row.source_sheet === row.sheet_name &&
            row.raw_snapshot_present === true;
        }),
      result.sample_payload_summary
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C7',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.payload_builder_ready_for_8C8 = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-7-FinalMigration-PayloadBuilder-Scaffold',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_PAYLOAD_BUILDER_SCAFFOLD_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationUuidResolutionPlanLog() {
  const result = {
    success: true,
    stage: '8C-8-FinalMigration-UUIDResolutionPlan',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    source_counts: {},
    uuid_resolution_plan: {},
    relationship_audit: {},
    treatment_item_duplicate_plan: {},
    known_nullable_artifacts: {},
    summary: {
      uuid_resolution_table_count: 0,
      relationship_check_count: 0,
      missing_required_parent_count: 0,
      known_nullable_parent_count: 0,
      duplicate_legacy_treatment_item_group_count: 0,
      duplicate_legacy_treatment_item_row_count: 0
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      uuid_resolution_plan_ready_for_8C9: false,
      next_step: '8C-9-FinalMigration-MigrationRowMapPlan'
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

  function normalizeKey_(value) {
    return String(value || '').trim();
  }

  function getRows_(sheetName) {
    return dbFindAll_(sheetName, { backend_mode: 'spreadsheet' }) || [];
  }

  function buildIndex_(rows, keyField) {
    const index = {};

    (rows || []).forEach(function(row) {
      const key = normalizeKey_(row && row[keyField]);
      if (!key) return;
      index[key] = row;
    });

    return index;
  }

  function countMissingParent_(rows, childField, parentIndex) {
    let missing = 0;

    (rows || []).forEach(function(row) {
      const childKey = normalizeKey_(row && row[childField]);
      if (!childKey) return;
      if (!parentIndex[childKey]) missing++;
    });

    return missing;
  }

  function countPresentRefs_(rows, childField) {
    return (rows || []).filter(function(row) {
      return !!normalizeKey_(row && row[childField]);
    }).length;
  }

  function addRelationshipCheck_(name, childRows, childField, parentSheet, parentIndex, nullableAllowed) {
    const presentRefCount = countPresentRefs_(childRows, childField);
    const missingCount = countMissingParent_(childRows, childField, parentIndex);

    result.relationship_audit[name] = {
      child_field: childField,
      parent_sheet: parentSheet,
      present_ref_count: presentRefCount,
      missing_parent_count: missingCount,
      nullable_allowed: nullableAllowed === true
    };

    result.summary.relationship_check_count++;

    if (missingCount > 0 && nullableAllowed === true) {
      result.summary.known_nullable_parent_count += missingCount;
    }

    if (missingCount > 0 && nullableAllowed !== true) {
      result.summary.missing_required_parent_count += missingCount;
    }
  }

  function buildDuplicatePlanForTreatmentItems_(rows) {
    const groups = {};

    (rows || []).forEach(function(row) {
      const legacyId = normalizeKey_(row && row.treatment_item_id);
      if (!legacyId) return;

      if (!groups[legacyId]) groups[legacyId] = [];
      groups[legacyId].push(row);
    });

    const duplicateGroups = Object.keys(groups).filter(function(key) {
      return groups[key].length > 1;
    });

    let duplicateRows = 0;
    duplicateGroups.forEach(function(key) {
      duplicateRows += groups[key].length;
    });

    return {
      duplicate_group_count: duplicateGroups.length,
      duplicate_row_count: duplicateRows,
      duplicate_sample_ids: duplicateGroups.slice(0, 10),
      duplicate_safe_strategy: 'Resolve treatment_item_uuid using source_sheet + source_row_number / migration_row_map target_uuid, not legacy treatment_item_id alone.'
    };
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const users = getRows_(REPO_TABLES.USERS);
    const patients = getRows_(REPO_TABLES.PATIENTS);
    const serviceCatalog = getRows_(REPO_TABLES.SERVICE_CATALOG);
    const appointments = getRows_(REPO_TABLES.APPOINTMENTS);
    const treatments = getRows_(REPO_TABLES.TREATMENTS);
    const treatmentItems = getRows_(REPO_TABLES.TREATMENT_ITEMS);
    const medicalRecords = getRows_(REPO_TABLES.MEDICAL_RECORDS);
    const patientPhotos = getRows_(REPO_TABLES.PATIENT_PHOTOS);
    const orthoRecalls = getRows_(REPO_TABLES.ORTHO_RECALL);
    const billings = getRows_(REPO_TABLES.BILLINGS);
    const billingItems = getRows_(REPO_TABLES.BILLING_ITEMS);
    const billingAdjustments = getRows_(REPO_TABLES.BILLING_ADJUSTMENTS);
    const billingInstallments = getRows_(REPO_TABLES.BILLING_INSTALLMENTS);
    const payments = getRows_(REPO_TABLES.PAYMENTS);
    const billingFeedbacks = getRows_(REPO_TABLES.BILLING_FEEDBACKS);

    result.source_counts = {
      users: users.length,
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

    const userIndex = buildIndex_(users, 'user_id');
    const patientIndex = buildIndex_(patients, 'patient_id');
    const serviceIndex = buildIndex_(serviceCatalog, 'service_id');
    const appointmentIndex = buildIndex_(appointments, 'appointment_id');
    const treatmentIndex = buildIndex_(treatments, 'treatment_id');
    const treatmentItemIndex = buildIndex_(treatmentItems, 'treatment_item_id');
    const billingIndex = buildIndex_(billings, 'billing_id');
    const installmentIndex = buildIndex_(billingInstallments, 'installment_id');

    result.uuid_resolution_plan = {
      Appointments: {
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id'
      },
      Treatments: {
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id',
        appointment_uuid: 'appointment_id -> Appointments.appointment_id -> appointments.id',
        doctor_user_uuid: 'doctor_user_id -> Users.user_id -> app_users.id'
      },
      TreatmentItems: {
        treatment_uuid: 'treatment_id -> Treatments.treatment_id -> treatments.id',
        service_uuid: 'service_id -> ServiceCatalog.service_id -> service_catalog.id'
      },
      MedicalRecords: {
        treatment_uuid: 'treatment_id -> Treatments.treatment_id -> treatments.id',
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id'
      },
      PatientPhotos: {
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id',
        treatment_uuid: 'treatment_id -> Treatments.treatment_id -> treatments.id',
        uploaded_by_uuid: 'uploaded_by -> Users.user_id -> app_users.id'
      },
      OrthoRecall: {
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id',
        install_treatment_uuid: 'install_treatment_id -> Treatments.treatment_id -> treatments.id',
        last_control_treatment_uuid: 'last_control_treatment_id -> Treatments.treatment_id -> treatments.id'
      },
      Billings: {
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id',
        appointment_uuid: 'appointment_id -> Appointments.appointment_id -> appointments.id',
        treatment_uuid: 'treatment_id -> Treatments.treatment_id -> treatments.id'
      },
      BillingItems: {
        billing_uuid: 'billing_id -> Billings.billing_id -> billings.id',
        treatment_uuid: 'treatment_id -> Treatments.treatment_id -> treatments.id',
        treatment_item_uuid: 'source_row_number -> migration_row_map for TreatmentItems -> treatment_items.id',
        service_uuid: 'service_id -> ServiceCatalog.service_id -> service_catalog.id'
      },
      BillingAdjustments: {
        billing_uuid: 'billing_id -> Billings.billing_id -> billings.id',
        created_by_uuid: 'created_by -> Users.user_id -> app_users.id'
      },
      BillingInstallments: {
        billing_uuid: 'billing_id -> Billings.billing_id -> billings.id'
      },
      Payments: {
        billing_uuid: 'billing_id -> Billings.billing_id -> billings.id',
        installment_uuid: 'installment_id -> BillingInstallments.installment_id -> billing_installments.id',
        received_by_uuid: 'received_by -> Users.user_id -> app_users.id'
      },
      BillingFeedbacks: {
        billing_uuid: 'billing_id -> Billings.billing_id -> billings.id',
        patient_uuid: 'patient_id -> Patients.patient_id -> patients.id'
      }
    };

    result.summary.uuid_resolution_table_count = Object.keys(result.uuid_resolution_plan).length;

    addRelationshipCheck_('appointments_patient_parent', appointments, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);

    addRelationshipCheck_('treatments_patient_parent', treatments, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);
    addRelationshipCheck_('treatments_appointment_parent', treatments, 'appointment_id', REPO_TABLES.APPOINTMENTS, appointmentIndex, false);
    addRelationshipCheck_('treatments_doctor_user_parent', treatments, 'doctor_user_id', REPO_TABLES.USERS, userIndex, false);

    addRelationshipCheck_('treatment_items_treatment_parent', treatmentItems, 'treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, false);
    addRelationshipCheck_('treatment_items_service_parent', treatmentItems, 'service_id', REPO_TABLES.SERVICE_CATALOG, serviceIndex, false);

    addRelationshipCheck_('medical_records_patient_parent', medicalRecords, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);
    addRelationshipCheck_('medical_records_treatment_parent', medicalRecords, 'treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, false);

    addRelationshipCheck_('patient_photos_patient_parent', patientPhotos, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);
    addRelationshipCheck_('patient_photos_treatment_parent', patientPhotos, 'treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, true);
    addRelationshipCheck_('patient_photos_uploaded_by_parent', patientPhotos, 'uploaded_by', REPO_TABLES.USERS, userIndex, true);

    addRelationshipCheck_('ortho_recall_patient_parent', orthoRecalls, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);
    addRelationshipCheck_('ortho_recall_install_treatment_parent', orthoRecalls, 'install_treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, true);
    addRelationshipCheck_('ortho_recall_last_control_treatment_parent', orthoRecalls, 'last_control_treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, true);

    addRelationshipCheck_('billings_patient_parent', billings, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);
    addRelationshipCheck_('billings_appointment_parent', billings, 'appointment_id', REPO_TABLES.APPOINTMENTS, appointmentIndex, false);
    addRelationshipCheck_('billings_treatment_parent', billings, 'treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, true);

    addRelationshipCheck_('billing_items_billing_parent', billingItems, 'billing_id', REPO_TABLES.BILLINGS, billingIndex, false);
    addRelationshipCheck_('billing_items_treatment_parent', billingItems, 'treatment_id', REPO_TABLES.TREATMENTS, treatmentIndex, true);
    addRelationshipCheck_('billing_items_treatment_item_parent_legacy_index_only', billingItems, 'treatment_item_id', REPO_TABLES.TREATMENT_ITEMS, treatmentItemIndex, true);
    addRelationshipCheck_('billing_items_service_parent', billingItems, 'service_id', REPO_TABLES.SERVICE_CATALOG, serviceIndex, false);

    addRelationshipCheck_('billing_adjustments_billing_parent', billingAdjustments, 'billing_id', REPO_TABLES.BILLINGS, billingIndex, false);
    addRelationshipCheck_('billing_adjustments_created_by_parent', billingAdjustments, 'created_by', REPO_TABLES.USERS, userIndex, true);

    addRelationshipCheck_('billing_installments_billing_parent', billingInstallments, 'billing_id', REPO_TABLES.BILLINGS, billingIndex, false);

    addRelationshipCheck_('payments_billing_parent', payments, 'billing_id', REPO_TABLES.BILLINGS, billingIndex, false);
    addRelationshipCheck_('payments_installment_parent', payments, 'installment_id', REPO_TABLES.BILLING_INSTALLMENTS, installmentIndex, true);
    addRelationshipCheck_('payments_received_by_parent', payments, 'received_by', REPO_TABLES.USERS, userIndex, true);

    addRelationshipCheck_('billing_feedbacks_billing_parent', billingFeedbacks, 'billing_id', REPO_TABLES.BILLINGS, billingIndex, false);
    addRelationshipCheck_('billing_feedbacks_patient_parent', billingFeedbacks, 'patient_id', REPO_TABLES.PATIENTS, patientIndex, false);

    result.treatment_item_duplicate_plan = buildDuplicatePlanForTreatmentItems_(treatmentItems);

    result.summary.duplicate_legacy_treatment_item_group_count =
      result.treatment_item_duplicate_plan.duplicate_group_count;
    result.summary.duplicate_legacy_treatment_item_row_count =
      result.treatment_item_duplicate_plan.duplicate_row_count;

    result.known_nullable_artifacts = {
      ortho_recall_install_treatment_missing_parent_count:
        result.relationship_audit.ortho_recall_install_treatment_parent.missing_parent_count,
      billings_treatment_missing_parent_count:
        result.relationship_audit.billings_treatment_parent.missing_parent_count,
      billing_items_treatment_missing_parent_count:
        result.relationship_audit.billing_items_treatment_parent.missing_parent_count,
      billing_items_treatment_item_missing_parent_legacy_index_count:
        result.relationship_audit.billing_items_treatment_item_parent_legacy_index_only.missing_parent_count,
      patient_photos_uploaded_by_missing_parent_count:
        result.relationship_audit.patient_photos_uploaded_by_parent.missing_parent_count
    };

    addCheck('UUID_RESOLUTION_PLAN_HAS_12_TABLES',
      result.summary.uuid_resolution_table_count === 12,
      result.uuid_resolution_plan
    );

    addCheck('NO_MISSING_REQUIRED_PARENT_RELATIONSHIPS',
      result.summary.missing_required_parent_count === 0,
      {
        missing_required_parent_count: result.summary.missing_required_parent_count,
        relationship_audit: result.relationship_audit
      }
    );

    addCheck('TREATMENT_ITEM_DUPLICATE_PLAN_READY',
      result.treatment_item_duplicate_plan.duplicate_safe_strategy.indexOf('source_sheet + source_row_number') !== -1 ||
        result.treatment_item_duplicate_plan.duplicate_safe_strategy.indexOf('source_row_number') !== -1,
      result.treatment_item_duplicate_plan
    );

    addCheck('PRODUCTION_SOURCE_COUNTS_MATCH_8C_EXPECTED',
      result.source_counts.patients === 323 &&
        result.source_counts.appointments === 336 &&
        result.source_counts.treatments === 298 &&
        result.source_counts.treatment_items === 566 &&
        result.source_counts.billings === 90 &&
        result.source_counts.billing_items === 176 &&
        result.source_counts.payments === 86,
      result.source_counts
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C8',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.uuid_resolution_plan_ready_for_8C9 = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-8-FinalMigration-UUIDResolutionPlan',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_UUID_RESOLUTION_PLAN_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationRowMapPlanCompactLog() {
  const result = {
    success: true,
    stage: '8C-9-FinalMigration-RowMapPlan-Compact',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    row_map_plan: [],
    summary: {
      mapped_table_count: 0,
      expected_row_map_total: 0,
      duplicate_safe_table_count: 0,
      source_row_key_required_count: 0
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      row_map_plan_ready_for_8C10: false,
      next_step: '8C-10-FinalMigration-IssueClassificationPlan'
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

  function getSpreadsheetCount_(sheetName) {
    return (dbFindAll_(sheetName, { backend_mode: 'spreadsheet' }) || []).length;
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const payloadPlan = cutoverBuildFinalMigrationPayloadPlan8C_();

    payloadPlan.forEach(function(tablePlan) {
      const sourceCount = getSpreadsheetCount_(tablePlan.sheet_name);

      const rowMapEntry = {
        sheet_name: tablePlan.sheet_name,
        target_table: tablePlan.target_table,
        primary_key: tablePlan.primary_key,
        source_count: sourceCount,
        expected_row_map_count: sourceCount,
        row_map_key: 'source_sheet + source_row_number',
        source_pk_column: tablePlan.primary_key,
        target_uuid_column: 'id',
        duplicate_safe: tablePlan.duplicate_safe === true,
        required_for_uuid_resolution: tablePlan.uuid_resolution_required === true
      };

      result.row_map_plan.push(rowMapEntry);

      result.summary.expected_row_map_total += sourceCount;
      result.summary.source_row_key_required_count++;

      if (rowMapEntry.duplicate_safe) {
        result.summary.duplicate_safe_table_count++;
      }
    });

    result.summary.mapped_table_count = result.row_map_plan.length;

    addCheck('ROW_MAP_PLAN_HAS_15_APP_TABLES',
      result.summary.mapped_table_count === 15,
      result.summary
    );

    addCheck('EXPECTED_ROW_MAP_TOTAL_MATCHES_PRODUCTION_SOURCE_ROWS',
      result.summary.expected_row_map_total === 2744,
      result.summary
    );

    addCheck('ALL_TABLES_USE_SOURCE_SHEET_AND_SOURCE_ROW_NUMBER_KEY',
      result.summary.source_row_key_required_count === 15 &&
        result.row_map_plan.every(function(row) {
          return row.row_map_key === 'source_sheet + source_row_number';
        }),
      result.row_map_plan
    );

    addCheck('TREATMENT_ITEMS_ROW_MAP_IS_DUPLICATE_SAFE',
      result.row_map_plan.some(function(row) {
        return row.sheet_name === REPO_TABLES.TREATMENT_ITEMS &&
          row.target_table === 'treatment_items' &&
          row.duplicate_safe === true &&
          row.row_map_key === 'source_sheet + source_row_number';
      }),
      result.row_map_plan
    );

    addCheck('ROW_MAP_SOURCE_COUNTS_MATCH_8C_PRODUCTION_BASELINE',
      result.row_map_plan.some(function(row) {
        return row.sheet_name === REPO_TABLES.PATIENTS && row.source_count === 323;
      }) &&
        result.row_map_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.APPOINTMENTS && row.source_count === 336;
        }) &&
        result.row_map_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.TREATMENTS && row.source_count === 298;
        }) &&
        result.row_map_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.TREATMENT_ITEMS && row.source_count === 566;
        }) &&
        result.row_map_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.BILLINGS && row.source_count === 90;
        }) &&
        result.row_map_plan.some(function(row) {
          return row.sheet_name === REPO_TABLES.PAYMENTS && row.source_count === 86;
        }),
      result.row_map_plan
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C9',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.row_map_plan_ready_for_8C10 = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-9-FinalMigration-RowMapPlan-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_ROW_MAP_PLAN_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationIssueClassificationPlanCompactLog() {
  const result = {
    success: true,
    stage: '8C-10-FinalMigration-IssueClassificationPlan-Compact',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    source_counts: {},
    relationship_summary: {},
    issue_classification_plan: [],
    summary: {
      planned_issue_type_count: 0,
      expected_migration_issue_count: 0,
      expected_warning_count: 0,
      expected_error_count: 0,
      unexpected_required_parent_missing_count: 0
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      issue_classification_plan_ready_for_8C11: false,
      next_step: '8C-11-FinalMigration-DryRunSummary'
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

  function normalizeKey_(value) {
    return String(value || '').trim();
  }

  function getRows_(sheetName) {
    return dbFindAll_(sheetName, { backend_mode: 'spreadsheet' }) || [];
  }

  function buildIndex_(rows, keyField) {
    const index = {};

    (rows || []).forEach(function(row) {
      const key = normalizeKey_(row && row[keyField]);
      if (!key) return;
      index[key] = row;
    });

    return index;
  }

  function findMissingParentRows_(rows, childField, parentIndex) {
    return (rows || []).filter(function(row) {
      const childKey = normalizeKey_(row && row[childField]);
      if (!childKey) return false;
      return !parentIndex[childKey];
    });
  }

  function addPlannedIssue_(params) {
    const rows = params.rows || [];

    result.issue_classification_plan.push({
      source_sheet: params.source_sheet,
      issue_type: params.issue_type,
      severity: params.severity || 'warning',
      status: params.status || 'open',
      parent_field: params.parent_field,
      expected_count: rows.length,
      source_pk_samples: rows.slice(0, 10).map(function(row) {
        return normalizeKey_(row && row[params.primary_key]);
      }),
      classification: params.classification,
      handling: params.handling
    });

    result.summary.expected_migration_issue_count += rows.length;

    if ((params.severity || 'warning') === 'warning') {
      result.summary.expected_warning_count += rows.length;
    }

    if ((params.severity || 'warning') === 'error') {
      result.summary.expected_error_count += rows.length;
    }
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    const patients = getRows_(REPO_TABLES.PATIENTS);
    const appointments = getRows_(REPO_TABLES.APPOINTMENTS);
    const treatments = getRows_(REPO_TABLES.TREATMENTS);
    const treatmentItems = getRows_(REPO_TABLES.TREATMENT_ITEMS);
    const serviceCatalog = getRows_(REPO_TABLES.SERVICE_CATALOG);
    const orthoRecalls = getRows_(REPO_TABLES.ORTHO_RECALL);
    const billings = getRows_(REPO_TABLES.BILLINGS);
    const billingItems = getRows_(REPO_TABLES.BILLING_ITEMS);
    const billingAdjustments = getRows_(REPO_TABLES.BILLING_ADJUSTMENTS);
    const payments = getRows_(REPO_TABLES.PAYMENTS);
    const billingFeedbacks = getRows_(REPO_TABLES.BILLING_FEEDBACKS);

    result.source_counts = {
      patients: patients.length,
      appointments: appointments.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      service_catalog: serviceCatalog.length,
      ortho_recalls: orthoRecalls.length,
      billings: billings.length,
      billing_items: billingItems.length,
      billing_adjustments: billingAdjustments.length,
      payments: payments.length,
      billing_feedbacks: billingFeedbacks.length
    };

    const patientIndex = buildIndex_(patients, 'patient_id');
    const appointmentIndex = buildIndex_(appointments, 'appointment_id');
    const treatmentIndex = buildIndex_(treatments, 'treatment_id');
    const treatmentItemIndex = buildIndex_(treatmentItems, 'treatment_item_id');
    const serviceIndex = buildIndex_(serviceCatalog, 'service_id');
    const billingIndex = buildIndex_(billings, 'billing_id');

    const orthoMissingPatient = findMissingParentRows_(orthoRecalls, 'patient_id', patientIndex);
    const orthoMissingInstallTreatment = findMissingParentRows_(orthoRecalls, 'install_treatment_id', treatmentIndex);
    const orthoMissingLastControlTreatment = findMissingParentRows_(orthoRecalls, 'last_control_treatment_id', treatmentIndex);

    const billingsMissingPatient = findMissingParentRows_(billings, 'patient_id', patientIndex);
    const billingsMissingAppointment = findMissingParentRows_(billings, 'appointment_id', appointmentIndex);
    const billingsMissingTreatment = findMissingParentRows_(billings, 'treatment_id', treatmentIndex);

    const billingItemsMissingBilling = findMissingParentRows_(billingItems, 'billing_id', billingIndex);
    const billingItemsMissingTreatment = findMissingParentRows_(billingItems, 'treatment_id', treatmentIndex);
    const billingItemsMissingTreatmentItem = findMissingParentRows_(billingItems, 'treatment_item_id', treatmentItemIndex);
    const billingItemsMissingService = findMissingParentRows_(billingItems, 'service_id', serviceIndex);

    const adjustmentsMissingBilling = findMissingParentRows_(billingAdjustments, 'billing_id', billingIndex);
    const paymentsMissingBilling = findMissingParentRows_(payments, 'billing_id', billingIndex);
    const feedbacksMissingBilling = findMissingParentRows_(billingFeedbacks, 'billing_id', billingIndex);

    result.relationship_summary = {
      ortho_missing_patient: orthoMissingPatient.length,
      ortho_missing_install_treatment: orthoMissingInstallTreatment.length,
      ortho_missing_last_control_treatment: orthoMissingLastControlTreatment.length,
      billings_missing_patient: billingsMissingPatient.length,
      billings_missing_appointment: billingsMissingAppointment.length,
      billings_missing_treatment: billingsMissingTreatment.length,
      billing_items_missing_billing: billingItemsMissingBilling.length,
      billing_items_missing_treatment: billingItemsMissingTreatment.length,
      billing_items_missing_treatment_item: billingItemsMissingTreatmentItem.length,
      billing_items_missing_service: billingItemsMissingService.length,
      adjustments_missing_billing: adjustmentsMissingBilling.length,
      payments_missing_billing: paymentsMissingBilling.length,
      feedbacks_missing_billing: feedbacksMissingBilling.length
    };

    addPlannedIssue_({
      source_sheet: REPO_TABLES.ORTHO_RECALL,
      primary_key: 'ortho_recall_id',
      issue_type: 'INSTALL_TREATMENT_PARENT_NOT_MAPPED',
      severity: 'warning',
      status: 'open',
      parent_field: 'install_treatment_id',
      rows: orthoMissingInstallTreatment,
      classification: 'known_manual_test_artifact',
      handling: 'Set install_treatment_uuid null and write migration_issues warning.'
    });

    addPlannedIssue_({
      source_sheet: REPO_TABLES.BILLINGS,
      primary_key: 'billing_id',
      issue_type: 'TREATMENT_PARENT_NOT_MAPPED',
      severity: 'warning',
      status: 'open',
      parent_field: 'treatment_id',
      rows: billingsMissingTreatment,
      classification: 'known_manual_test_artifact',
      handling: 'Set treatment_uuid null and write migration_issues warning.'
    });

    addPlannedIssue_({
      source_sheet: REPO_TABLES.BILLING_ITEMS,
      primary_key: 'billing_item_id',
      issue_type: 'TREATMENT_PARENT_NOT_MAPPED',
      severity: 'warning',
      status: 'open',
      parent_field: 'treatment_id',
      rows: billingItemsMissingTreatment,
      classification: 'known_manual_test_artifact',
      handling: 'Set treatment_uuid null and write migration_issues warning.'
    });

    addPlannedIssue_({
      source_sheet: REPO_TABLES.BILLING_ITEMS,
      primary_key: 'billing_item_id',
      issue_type: 'TREATMENT_ITEM_NOT_MAPPED',
      severity: 'warning',
      status: 'open',
      parent_field: 'treatment_item_id',
      rows: billingItemsMissingTreatmentItem,
      classification: 'known_manual_test_artifact_or_legacy_duplicate_mapping_gap',
      handling: 'Set treatment_item_uuid null only for affected known artifact; all normal rows use source_row_number mapping.'
    });

    result.summary.planned_issue_type_count = result.issue_classification_plan.length;

    result.summary.unexpected_required_parent_missing_count =
      orthoMissingPatient.length +
      orthoMissingLastControlTreatment.length +
      billingsMissingPatient.length +
      billingsMissingAppointment.length +
      billingItemsMissingBilling.length +
      billingItemsMissingService.length +
      adjustmentsMissingBilling.length +
      paymentsMissingBilling.length +
      feedbacksMissingBilling.length;

    addCheck('PRODUCTION_SOURCE_COUNTS_MATCH_8C_EXPECTED',
      result.source_counts.patients === 323 &&
        result.source_counts.appointments === 336 &&
        result.source_counts.treatments === 298 &&
        result.source_counts.treatment_items === 566 &&
        result.source_counts.ortho_recalls === 159 &&
        result.source_counts.billings === 90 &&
        result.source_counts.billing_items === 176 &&
        result.source_counts.payments === 86,
      result.source_counts
    );

    addCheck('KNOWN_ARTIFACT_COUNTS_MATCH_EXPECTED',
      result.relationship_summary.ortho_missing_install_treatment === 1 &&
        result.relationship_summary.billings_missing_treatment === 1 &&
        result.relationship_summary.billing_items_missing_treatment === 1 &&
        result.relationship_summary.billing_items_missing_treatment_item === 1,
      result.relationship_summary
    );

    addCheck('NO_UNEXPECTED_REQUIRED_PARENT_MISSING',
      result.summary.unexpected_required_parent_missing_count === 0,
      {
        unexpected_required_parent_missing_count: result.summary.unexpected_required_parent_missing_count,
        relationship_summary: result.relationship_summary
      }
    );

    addCheck('EXPECTED_MIGRATION_ISSUES_ARE_4_WARNINGS_0_ERRORS',
      result.summary.planned_issue_type_count === 4 &&
        result.summary.expected_migration_issue_count === 4 &&
        result.summary.expected_warning_count === 4 &&
        result.summary.expected_error_count === 0,
      result.summary
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C10',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.issue_classification_plan_ready_for_8C11 = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-10-FinalMigration-IssueClassificationPlan-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_ISSUE_CLASSIFICATION_PLAN_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationDryRunSummaryCompactLog() {
  const result = {
    success: true,
    stage: '8C-11-FinalMigration-DryRunSummary-Compact',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    expected_final_counts: {},
    current_supabase_counts: {},
    expected_finance_totals: {},
    expected_final_metadata: {
      migration_row_map_count: 0,
      migration_issues_count: 4,
      migration_issues_warning_count: 4,
      migration_issues_error_count: 0
    },
    final_migration_plan: {
      reset_table_count: 17,
      reseed_app_table_count: 15,
      metadata_table_count: 2,
      source_total_rows: 0,
      known_artifact_count: 4,
      requires_freeze_before_execution: true,
      requires_backup_before_execution: true,
      requires_final_guard_enabled_before_execution: true
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      dry_run_ready_for_8C12_final_pre_execution_checklist: false,
      next_step: '8C-12-FinalMigration-PreExecutionChecklist'
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

  function getRows_(sheetName, backendMode) {
    return dbFindAll_(sheetName, { backend_mode: backendMode }) || [];
  }

  function getCounts_(backendMode) {
    return {
      app_users: getRows_(REPO_TABLES.USERS, backendMode).length,
      patients: getRows_(REPO_TABLES.PATIENTS, backendMode).length,
      service_catalog: getRows_(REPO_TABLES.SERVICE_CATALOG, backendMode).length,
      appointments: getRows_(REPO_TABLES.APPOINTMENTS, backendMode).length,
      treatments: getRows_(REPO_TABLES.TREATMENTS, backendMode).length,
      treatment_items: getRows_(REPO_TABLES.TREATMENT_ITEMS, backendMode).length,
      medical_records: getRows_(REPO_TABLES.MEDICAL_RECORDS, backendMode).length,
      patient_photos: getRows_(REPO_TABLES.PATIENT_PHOTOS, backendMode).length,
      ortho_recalls: getRows_(REPO_TABLES.ORTHO_RECALL, backendMode).length,
      billings: getRows_(REPO_TABLES.BILLINGS, backendMode).length,
      billing_items: getRows_(REPO_TABLES.BILLING_ITEMS, backendMode).length,
      billing_adjustments: getRows_(REPO_TABLES.BILLING_ADJUSTMENTS, backendMode).length,
      billing_installments: getRows_(REPO_TABLES.BILLING_INSTALLMENTS, backendMode).length,
      payments: getRows_(REPO_TABLES.PAYMENTS, backendMode).length,
      billing_feedbacks: getRows_(REPO_TABLES.BILLING_FEEDBACKS, backendMode).length
    };
  }

  function getFinanceTotals_(backendMode) {
    const billings = getRows_(REPO_TABLES.BILLINGS, backendMode);
    const billingItems = getRows_(REPO_TABLES.BILLING_ITEMS, backendMode);
    const adjustments = getRows_(REPO_TABLES.BILLING_ADJUSTMENTS, backendMode);
    const installments = getRows_(REPO_TABLES.BILLING_INSTALLMENTS, backendMode);
    const payments = getRows_(REPO_TABLES.PAYMENTS, backendMode);

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

  function sumCounts_(counts) {
    return Object.keys(counts || {}).reduce(function(sum, key) {
      return sum + Number(counts[key] || 0);
    }, 0);
  }

  try {
    addCheck('FLAGS_SAFE_NO_FINAL_MIGRATION_YET',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    result.expected_final_counts = getCounts_('spreadsheet');
    result.current_supabase_counts = getCounts_('supabase');
    result.expected_finance_totals = getFinanceTotals_('spreadsheet');

    result.expected_final_metadata.migration_row_map_count = sumCounts_(result.expected_final_counts);
    result.final_migration_plan.source_total_rows = result.expected_final_metadata.migration_row_map_count;

    addCheck('EXPECTED_FINAL_COUNTS_MATCH_PRODUCTION_BASELINE',
      result.expected_final_counts.app_users === 8 &&
        result.expected_final_counts.patients === 323 &&
        result.expected_final_counts.service_catalog === 100 &&
        result.expected_final_counts.appointments === 336 &&
        result.expected_final_counts.treatments === 298 &&
        result.expected_final_counts.treatment_items === 566 &&
        result.expected_final_counts.medical_records === 298 &&
        result.expected_final_counts.patient_photos === 301 &&
        result.expected_final_counts.ortho_recalls === 159 &&
        result.expected_final_counts.billings === 90 &&
        result.expected_final_counts.billing_items === 176 &&
        result.expected_final_counts.billing_adjustments === 3 &&
        result.expected_final_counts.billing_installments === 0 &&
        result.expected_final_counts.payments === 86 &&
        result.expected_final_counts.billing_feedbacks === 0,
      result.expected_final_counts
    );

    addCheck('CURRENT_SUPABASE_STILL_OLD_STAGING_SNAPSHOT_EXPECTED',
      result.current_supabase_counts.patients === 285 &&
        result.current_supabase_counts.appointments === 284 &&
        result.current_supabase_counts.treatments === 254 &&
        result.current_supabase_counts.treatment_items === 489 &&
        result.current_supabase_counts.billings === 46 &&
        result.current_supabase_counts.payments === 44,
      result.current_supabase_counts
    );

    addCheck('EXPECTED_FINANCE_TOTALS_MATCH_PRODUCTION_BASELINE',
      result.expected_finance_totals.billings_subtotal === 27741500 &&
        result.expected_finance_totals.billings_discount_total === 475000 &&
        result.expected_finance_totals.billings_grand_total === 27266500 &&
        result.expected_finance_totals.billings_paid_total === 27265000 &&
        result.expected_finance_totals.billings_outstanding_total === 1500 &&
        result.expected_finance_totals.billing_items_subtotal === 27741500 &&
        result.expected_finance_totals.billing_adjustments_amount === 475000 &&
        result.expected_finance_totals.payments_amount === 27265000,
      result.expected_finance_totals
    );

    addCheck('EXPECTED_METADATA_COUNTS_MATCH_FINAL_PLAN',
      result.expected_final_metadata.migration_row_map_count === 2744 &&
        result.expected_final_metadata.migration_issues_count === 4 &&
        result.expected_final_metadata.migration_issues_warning_count === 4 &&
        result.expected_final_metadata.migration_issues_error_count === 0,
      result.expected_final_metadata
    );

    addCheck('FINAL_MIGRATION_PLAN_REQUIRES_SAFETY_PRECONDITIONS',
      result.final_migration_plan.reset_table_count === 17 &&
        result.final_migration_plan.reseed_app_table_count === 15 &&
        result.final_migration_plan.metadata_table_count === 2 &&
        result.final_migration_plan.requires_freeze_before_execution === true &&
        result.final_migration_plan.requires_backup_before_execution === true &&
        result.final_migration_plan.requires_final_guard_enabled_before_execution === true,
      result.final_migration_plan
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C11',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;
    result.plan_status.dry_run_ready_for_8C12_final_pre_execution_checklist = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-11-FinalMigration-DryRunSummary-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_DRY_RUN_SUMMARY_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testCutoverPhase8CFinalMigrationPreExecutionChecklistCompactLog() {
  const result = {
    success: true,
    stage: '8C-12-FinalMigration-PreExecutionChecklist-Compact',
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
        : null,
      supabase_final_migration_reseed_enabled: typeof repoIsSupabaseFinalMigrationReseedEnabled_ === 'function'
        ? repoIsSupabaseFinalMigrationReseedEnabled_()
        : null
    },
    expected_final_counts: {},
    expected_finance_totals: {},
    expected_metadata: {
      migration_row_map_count: 2744,
      migration_issues_count: 4,
      migration_issues_warning_count: 4,
      migration_issues_error_count: 0
    },
    manual_preconditions_required: [
      'Git push terakhir sudah selesai dan repo clean',
      'Backup/copy Google Spreadsheet production sudah dibuat',
      'Supabase target final/staging-final sudah dipastikan benar',
      'Freeze production mutation diaktifkan hanya saat final migration window',
      'REPO_SUPABASE_FINAL_MIGRATION_RESEED_ENABLED diaktifkan hanya saat eksekusi final reseed',
      'REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED tetap false',
      'default_backend_mode tetap spreadsheet sampai fase switch backend',
      'Final reseed harus diikuti audit 8D sebelum cutover'
    ],
    execution_readiness: {
      ready_to_execute_now: false,
      ready_to_prepare_execution_phase: false,
      reason: '',
      next_phase: '8D-FinalDataMigration-Execution-And-Audit'
    },
    plan_status: {
      destructive_operation_executed: false,
      final_migration_executed: false,
      cutover_executed: false,
      phase_8C_preparation_complete: false
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

  function getRows_(sheetName) {
    return dbFindAll_(sheetName, { backend_mode: 'spreadsheet' }) || [];
  }

  function getExpectedCounts_() {
    return {
      app_users: getRows_(REPO_TABLES.USERS).length,
      patients: getRows_(REPO_TABLES.PATIENTS).length,
      service_catalog: getRows_(REPO_TABLES.SERVICE_CATALOG).length,
      appointments: getRows_(REPO_TABLES.APPOINTMENTS).length,
      treatments: getRows_(REPO_TABLES.TREATMENTS).length,
      treatment_items: getRows_(REPO_TABLES.TREATMENT_ITEMS).length,
      medical_records: getRows_(REPO_TABLES.MEDICAL_RECORDS).length,
      patient_photos: getRows_(REPO_TABLES.PATIENT_PHOTOS).length,
      ortho_recalls: getRows_(REPO_TABLES.ORTHO_RECALL).length,
      billings: getRows_(REPO_TABLES.BILLINGS).length,
      billing_items: getRows_(REPO_TABLES.BILLING_ITEMS).length,
      billing_adjustments: getRows_(REPO_TABLES.BILLING_ADJUSTMENTS).length,
      billing_installments: getRows_(REPO_TABLES.BILLING_INSTALLMENTS).length,
      payments: getRows_(REPO_TABLES.PAYMENTS).length,
      billing_feedbacks: getRows_(REPO_TABLES.BILLING_FEEDBACKS).length
    };
  }

  function getExpectedFinanceTotals_() {
    const billings = getRows_(REPO_TABLES.BILLINGS);
    const billingItems = getRows_(REPO_TABLES.BILLING_ITEMS);
    const adjustments = getRows_(REPO_TABLES.BILLING_ADJUSTMENTS);
    const installments = getRows_(REPO_TABLES.BILLING_INSTALLMENTS);
    const payments = getRows_(REPO_TABLES.PAYMENTS);

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

  function sumCounts_(counts) {
    return Object.keys(counts || {}).reduce(function(sum, key) {
      return sum + Number(counts[key] || 0);
    }, 0);
  }

  try {
    result.expected_final_counts = getExpectedCounts_();
    result.expected_finance_totals = getExpectedFinanceTotals_();

    result.expected_metadata.migration_row_map_count = sumCounts_(result.expected_final_counts);

    addCheck('FLAGS_SAFE_FOR_PRE_EXECUTION_REVIEW',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false &&
        result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    addCheck('EXPECTED_FINAL_COUNTS_STILL_MATCH_8C_BASELINE',
      result.expected_final_counts.app_users === 8 &&
        result.expected_final_counts.patients === 323 &&
        result.expected_final_counts.service_catalog === 100 &&
        result.expected_final_counts.appointments === 336 &&
        result.expected_final_counts.treatments === 298 &&
        result.expected_final_counts.treatment_items === 566 &&
        result.expected_final_counts.medical_records === 298 &&
        result.expected_final_counts.patient_photos === 301 &&
        result.expected_final_counts.ortho_recalls === 159 &&
        result.expected_final_counts.billings === 90 &&
        result.expected_final_counts.billing_items === 176 &&
        result.expected_final_counts.billing_adjustments === 3 &&
        result.expected_final_counts.billing_installments === 0 &&
        result.expected_final_counts.payments === 86 &&
        result.expected_final_counts.billing_feedbacks === 0,
      result.expected_final_counts
    );

    addCheck('EXPECTED_FINANCE_TOTALS_STILL_MATCH_8C_BASELINE',
      result.expected_finance_totals.billings_subtotal === 27741500 &&
        result.expected_finance_totals.billings_discount_total === 475000 &&
        result.expected_finance_totals.billings_grand_total === 27266500 &&
        result.expected_finance_totals.billings_paid_total === 27265000 &&
        result.expected_finance_totals.billings_outstanding_total === 1500 &&
        result.expected_finance_totals.billing_items_subtotal === 27741500 &&
        result.expected_finance_totals.billing_adjustments_amount === 475000 &&
        result.expected_finance_totals.payments_amount === 27265000,
      result.expected_finance_totals
    );

    addCheck('EXPECTED_METADATA_STILL_MATCH_8C_DRY_RUN',
      result.expected_metadata.migration_row_map_count === 2744 &&
        result.expected_metadata.migration_issues_count === 4 &&
        result.expected_metadata.migration_issues_warning_count === 4 &&
        result.expected_metadata.migration_issues_error_count === 0,
      result.expected_metadata
    );

    addCheck('EXECUTION_NOT_ALLOWED_WHILE_FLAGS_FALSE',
      result.flags.production_mutation_freeze_enabled === false &&
        result.flags.supabase_final_migration_reseed_enabled === false,
      result.flags
    );

    addCheck('NO_DESTRUCTIVE_OR_FINAL_MIGRATION_EXECUTED_IN_8C12',
      result.plan_status.destructive_operation_executed === false &&
        result.plan_status.final_migration_executed === false &&
        result.plan_status.cutover_executed === false,
      result.plan_status
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    result.execution_readiness.ready_to_execute_now = false;
    result.execution_readiness.ready_to_prepare_execution_phase = result.success === true;
    result.execution_readiness.reason = result.success
      ? '8C preparation clean. Actual final migration/reseed tetap belum boleh dieksekusi sampai backup manual dibuat, freeze production diaktifkan, dan final migration guard diaktifkan khusus execution window.'
      : '8C preparation belum clean. Jangan lanjut execution phase.';

    result.plan_status.phase_8C_preparation_complete = result.success === true;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8C-12-FinalMigration-PreExecutionChecklist-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINAL_MIGRATION_PRE_EXECUTION_CHECKLIST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}