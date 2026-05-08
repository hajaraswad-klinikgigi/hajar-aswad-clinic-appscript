/* =========================================================
   REPOSITORY BRIDGE AUDIT
   Tahap 3J - Evaluasi Final Read-Only Repository Bridge
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testRepositoryBridgePhase3JFinalReadOnlyAudit() {
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
    table_audit: {},
    bridge_audit: {}
  };

  try {
    if (result.backend_mode !== 'spreadsheet') {
      result.issues.push({
        backend_mode: result.backend_mode,
        issue: 'BACKEND_MODE_NOT_SPREADSHEET'
      });
    }

    const requiredGlobals = [
      'REPO_TABLES',
      'REPO_PRIMARY_KEYS',
      'DataAccess.gs marker',
      'FinanceRepository',
      'PatientRepository',
      'AppointmentRepository'
    ];

    result.repository_audit.required_globals = {};

    result.repository_audit.required_globals.REPO_TABLES =
      typeof REPO_TABLES !== 'undefined' ? 'OK' : 'MISSING';

    result.repository_audit.required_globals.REPO_PRIMARY_KEYS =
      typeof REPO_PRIMARY_KEYS !== 'undefined' ? 'OK' : 'MISSING';

    result.repository_audit.required_globals['DataAccess.gs marker'] =
      typeof dbFindAll_ === 'function' ? 'OK' : 'MISSING';

    result.repository_audit.required_globals.FinanceRepository =
      typeof FinanceRepository !== 'undefined' && FinanceRepository ? 'OK' : 'MISSING';

    result.repository_audit.required_globals.PatientRepository =
      typeof PatientRepository !== 'undefined' && PatientRepository ? 'OK' : 'MISSING';

    result.repository_audit.required_globals.AppointmentRepository =
      typeof AppointmentRepository !== 'undefined' && AppointmentRepository ? 'OK' : 'MISSING';

    Object.keys(result.repository_audit.required_globals).forEach(function(key) {
      if (result.repository_audit.required_globals[key] !== 'OK') {
        result.issues.push({
          target: key,
          issue: 'REQUIRED_GLOBAL_MISSING'
        });
      }
    });

    const tables = typeof dbInspectAllTables_ === 'function'
      ? dbInspectAllTables_()
      : [];

    result.table_audit.table_count = Array.isArray(tables) ? tables.length : -1;
    result.table_audit.tables = tables.map(function(table) {
      return {
        sheet_name: table.sheet_name,
        target_table: table.target_table,
        primary_key: table.primary_key,
        data_row_count: table.data_row_count,
        primary_key_exists_in_header: table.primary_key_exists_in_header
      };
    });

    if (!Array.isArray(tables) || tables.length !== 15) {
      result.issues.push({
        table_count: result.table_audit.table_count,
        issue: 'EXPECTED_15_TABLES'
      });
    }

    tables.forEach(function(table) {
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

    auditRepositoryReadOnlyShape3J_(
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

    auditRepositoryReadOnlyShape3J_(
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

    auditRepositoryReadOnlyShape3J_(
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

    result.bridge_audit.finance = {
      getBillingsRaw: typeof getBillingsRaw === 'function' ? 'OK' : 'MISSING',
      buildFinanceRawContext_: typeof buildFinanceRawContext_ === 'function' ? 'OK' : 'MISSING',
      findBillingRawByIdFromContext_: typeof findBillingRawByIdFromContext_ === 'function' ? 'OK' : 'MISSING'
    };

    result.bridge_audit.patient = {
      getPatientsRaw: typeof getPatientsRaw === 'function' ? 'OK' : 'MISSING',
      findPatientRawById: typeof findPatientRawById === 'function' ? 'OK' : 'MISSING',
      getMedicalRecordsByPatientId: typeof getMedicalRecordsByPatientId === 'function' ? 'OK' : 'MISSING',
      getTreatmentsByPatientId: typeof getTreatmentsByPatientId === 'function' ? 'OK' : 'MISSING'
    };

    result.bridge_audit.appointment = {
      getAppointmentsRaw: typeof getAppointmentsRaw === 'function' ? 'OK' : 'MISSING',
      findAppointmentRawById: typeof findAppointmentRawById === 'function' ? 'OK' : 'MISSING',
      hasOpenAppointmentForPatient: typeof hasOpenAppointmentForPatient === 'function' ? 'OK' : 'MISSING',
      checkPatientOpenAppointment: typeof checkPatientOpenAppointment === 'function' ? 'OK' : 'MISSING',
      searchPatientsForAppointment: typeof searchPatientsForAppointment === 'function' ? 'OK' : 'MISSING'
    };

    ['finance', 'patient', 'appointment'].forEach(function(area) {
      Object.keys(result.bridge_audit[area]).forEach(function(key) {
        if (result.bridge_audit[area][key] !== 'OK') {
          result.issues.push({
            area: area,
            function_name: key,
            issue: 'BRIDGE_FUNCTION_MISSING'
          });
        }
      });
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

function auditRepositoryReadOnlyShape3J_(result, repoName, repo, requiredMethods) {
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
      issue: 'REPOSITORY_SHOULD_STAY_READ_ONLY_IN_PHASE_3J'
    });
  }
}

function testRepositoryBridgePhase3JRegressionPack() {
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
        name: 'testDataAccessPhase3AReadOnly',
        fn: typeof testDataAccessPhase3AReadOnly === 'function'
          ? testDataAccessPhase3AReadOnly
          : null
      },
      {
        name: 'testDataAccessPhase3AFindSamples',
        fn: typeof testDataAccessPhase3AFindSamples === 'function'
          ? testDataAccessPhase3AFindSamples
          : null
      },
      {
        name: 'testFinanceRawDataPhase3EFinalRepositoryBridgeAudit',
        fn: typeof testFinanceRawDataPhase3EFinalRepositoryBridgeAudit === 'function'
          ? testFinanceRawDataPhase3EFinalRepositoryBridgeAudit
          : null
      },
      {
        name: 'testPatientServicePhase3GReadOnlyBridge',
        fn: typeof testPatientServicePhase3GReadOnlyBridge === 'function'
          ? testPatientServicePhase3GReadOnlyBridge
          : null
      },
      {
        name: 'testPatientServicePhase3GDetailEndpointSample',
        fn: typeof testPatientServicePhase3GDetailEndpointSample === 'function'
          ? testPatientServicePhase3GDetailEndpointSample
          : null
      },
      {
        name: 'testAppointmentServicePhase3IReadOnlyBridge',
        fn: typeof testAppointmentServicePhase3IReadOnlyBridge === 'function'
          ? testAppointmentServicePhase3IReadOnlyBridge
          : null
      },
      {
        name: 'testAppointmentServicePhase3IEndpointSample',
        fn: typeof testAppointmentServicePhase3IEndpointSample === 'function'
          ? testAppointmentServicePhase3IEndpointSample
          : null
      },
      {
        name: 'testAppointmentServicePhase3ISearchPatientsForAppointmentSample',
        fn: typeof testAppointmentServicePhase3ISearchPatientsForAppointmentSample === 'function'
          ? testAppointmentServicePhase3ISearchPatientsForAppointmentSample
          : null
      },
      {
        name: 'testRepositoryBridgePhase3JFinalReadOnlyAudit',
        fn: typeof testRepositoryBridgePhase3JFinalReadOnlyAudit === 'function'
          ? testRepositoryBridgePhase3JFinalReadOnlyAudit
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

function testRepositoryBridgePhase3JEndpointSmokeTest() {
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
    const financeSummary = typeof getFinanceSummary === 'function'
      ? getFinanceSummary({ period: 'today' })
      : null;

    const financeSummaryOk = !!(
      financeSummary &&
      financeSummary.success === true
    );

    const financeSummaryMessage = String(
      financeSummary && financeSummary.message
        ? financeSummary.message
        : ''
    ).toLowerCase();

    const financeAuthRequired = !financeSummaryOk && (
      financeSummaryMessage.indexOf('session') !== -1 ||
      financeSummaryMessage.indexOf('sesi') !== -1 ||
      financeSummaryMessage.indexOf('login') !== -1 ||
      financeSummaryMessage.indexOf('auth') !== -1 ||
      financeSummaryMessage.indexOf('akses') !== -1 ||
      financeSummaryMessage.indexOf('izin') !== -1 ||
      financeSummaryMessage.indexOf('permission') !== -1 ||
      financeSummaryMessage.indexOf('unauthorized') !== -1
    );

    result.smoke.finance_summary_ok = financeSummaryOk;
    result.smoke.finance_summary_auth_required_expected = financeAuthRequired;
    result.smoke.finance_summary_message = financeSummary && financeSummary.message
      ? String(financeSummary.message)
      : '';

    if (!financeSummaryOk && !financeAuthRequired) {
      result.issues.push({
        endpoint: 'getFinanceSummary',
        message: result.smoke.finance_summary_message,
        issue: 'FINANCE_SUMMARY_SMOKE_FAILED'
      });
    }

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

    if (Array.isArray(appointments) && appointments.length) {
      const firstAppointment = appointments[0] || {};
      const appointmentId = String(firstAppointment.appointment_id || '').trim();

      if (appointmentId && typeof getAppointmentById === 'function') {
        const detail = getAppointmentById(appointmentId);

        result.smoke.appointment_detail_ok = !!(
          detail &&
          detail.success === true &&
          detail.data &&
          String(detail.data.appointment_id || '').trim() === appointmentId
        );

        if (!result.smoke.appointment_detail_ok) {
          result.issues.push({
            endpoint: 'getAppointmentById',
            appointment_id: appointmentId,
            issue: 'GET_APPOINTMENT_BY_ID_SMOKE_FAILED'
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