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