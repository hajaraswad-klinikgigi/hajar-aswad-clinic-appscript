/************************************************************
 * MigrationStage5N.gs
 * Tahap 5N — Migrasi treatments ke Supabase staging
 *
 * 5N-A:
 * - Inspect schema treatments Supabase
 * - Inspect source sheet Treatments
 * - Validasi row_map patients, appointments, app_users
 * - Dry-run resolve patient_uuid, appointment_uuid, doctor_user_uuid
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5N CONFIG
 ************************************************************/

var MIGRATION_STAGE_5N_NAME = '5N';
var MIGRATION_STAGE_5N_WRITE_ENABLED = false;

var MIGRATION_STAGE_5N_SOURCE_SHEET_ALIASES = [
  'Treatments',
  'Treatment',
  'treatments'
];

var MIGRATION_STAGE_5N_TARGET_TABLE = 'treatments';


/************************************************************
 * 5N PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5NInspectSchemaAndSourceLog() {
  var result = runMigrationStage5NInspectSchemaAndSource();
  migrationStage5NLogJson_('testMigrationStage5NInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5NPreflightLog() {
  var result = runMigrationStage5NPreflight();
  migrationStage5NLogJson_('testMigrationStage5NPreflight', result);
  return result;
}

function testMigrationStage5NInsertTreatmentsLog() {
  var result = runMigrationStage5NInsertTreatments();
  migrationStage5NLogJson_('testMigrationStage5NInsertTreatments', result);
  return result;
}


function testMigrationStage5NAuditTreatmentsLog() {
  var result = runMigrationStage5NAuditTreatments();
  migrationStage5NLogJson_('testMigrationStage5NAuditTreatments', result);
  return result;
}

function runMigrationStage5NInsertTreatments() {
  var startedAt = new Date();

  var result = migrationStage5NBaseResult_('insert_treatments_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5N_WRITE_ENABLED !== true) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5N_WRITE_ENABLED masih false. Jalankan preflight dulu. Jika clean, ubah menjadi true hanya untuk insert treatments staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5N sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5NPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      treatment_source_status: preflight.treatment_source_status || null,
      dry_run_status: preflight.dry_run_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5NIssue_(
        'error',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5N belum clean. Insert treatments dibatalkan.',
        {
          preflight_issues: preflight.issues
        }
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var targetEmpty = migrationStage5NCheckTargetTreatmentsEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5NBuildTreatmentDryRunPayload_();

    if (!migrationStage5NHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5NInsertRows_(
      MIGRATION_STAGE_5N_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5NIssue_(
        'error',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        '',
        '',
        '',
        'TREATMENTS_INSERT_FAILED',
        'Insert treatments ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5NBuildTreatmentRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5NInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5NIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'TREATMENT_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map treatments gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5NBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5NInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5NIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5N gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5NAuditTreatments();

    result.inserted_summary = {
      treatments: {
        target_table: MIGRATION_STAGE_5N_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5NHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'UNEXPECTED_ERROR',
      err && err.message ? err.message : String(err)
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } finally {
    lock.releaseLock();
  }
}


function runMigrationStage5NAuditTreatments() {
  var startedAt = new Date();

  var result = migrationStage5NBaseResult_('audit_treatments_read_only');
  var issues = [];

  var sourceRows = migrationStage5NReadTreatmentSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5NCountRows_(MIGRATION_STAGE_5N_TARGET_TABLE);
  var rowMapCount = migrationStage5NCountRows_(
    'migration_row_map',
    'target_table=eq.treatments'
  );
  var nullPatientUuidCount = migrationStage5NCountRows_(
    MIGRATION_STAGE_5N_TARGET_TABLE,
    'patient_uuid=is.null'
  );
  var nullAppointmentUuidCount = migrationStage5NCountRows_(
    MIGRATION_STAGE_5N_TARGET_TABLE,
    'appointment_uuid=is.null'
  );
  var nullDoctorUuidCount = migrationStage5NCountRows_(
    MIGRATION_STAGE_5N_TARGET_TABLE,
    'doctor_user_uuid=is.null'
  );

  if (!supabaseCount.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENTS_COUNT_FAILED',
      'Gagal menghitung row treatments Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map treatments.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENTS_COUNT_MISMATCH',
      'Jumlah treatments Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map treatments tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullPatientUuidCount.success && nullPatientUuidCount.count !== 0) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_NULL_PATIENT_UUID_FOUND',
      'Ada treatments dengan patient_uuid kosong.',
      {
        null_patient_uuid_count: nullPatientUuidCount.count
      }
    ));
  }

  if (nullAppointmentUuidCount.success && nullAppointmentUuidCount.count !== 0) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_NULL_APPOINTMENT_UUID_FOUND',
      'Ada treatments dengan appointment_uuid kosong.',
      {
        null_appointment_uuid_count: nullAppointmentUuidCount.count
      }
    ));
  }

  if (nullDoctorUuidCount.success && nullDoctorUuidCount.count !== 0) {
    issues.push(migrationStage5NIssue_(
      'warning',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_NULL_DOCTOR_UUID_FOUND',
      'Ada treatments dengan doctor_user_uuid kosong.',
      {
        null_doctor_user_uuid_count: nullDoctorUuidCount.count
      }
    ));
  }

  result.audit_status = {
    treatments: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_patient_uuid_count: nullPatientUuidCount.count,
      null_appointment_uuid_count: nullAppointmentUuidCount.count,
      null_doctor_user_uuid_count: nullDoctorUuidCount.count
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5NHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5NCheckTargetTreatmentsEmpty_() {
  var issues = [];

  var treatmentCount = migrationStage5NCountRows_(MIGRATION_STAGE_5N_TARGET_TABLE);
  var rowMapCount = migrationStage5NCountRows_(
    'migration_row_map',
    'target_table=eq.treatments'
  );

  var status = {
    treatments_count: treatmentCount.count,
    treatments_count_success: treatmentCount.success,
    treatment_row_map_count: rowMapCount.count,
    treatment_row_map_count_success: rowMapCount.success
  };

  if (!treatmentCount.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENTS_COUNT_FAILED',
      'Gagal menghitung table treatments.',
      treatmentCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map treatments.',
      rowMapCount
    ));
  }

  if (treatmentCount.success && treatmentCount.count !== 0) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENTS_TARGET_NOT_EMPTY',
      'Table treatments staging tidak kosong. Insert 5N awal dibatalkan untuk mencegah duplikasi.',
      {
        count: treatmentCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk treatments sudah ada. Insert 5N awal dibatalkan untuk mencegah duplikasi.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5NHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


function migrationStage5NBuildTreatmentRowMapRows_(insertedRows) {
  var now = migrationStage5NNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.treatment_id,
      target_table: MIGRATION_STAGE_5N_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5N_NAME + '; source_table=Treatments',
      created_at: now
    };
  });
}


function migrationStage5NBuildMigrationIssueRows_(issues) {
  var now = migrationStage5NNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: '',
      message: '[' + MIGRATION_STAGE_5N_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5N_NAME,
        target_table: issue.target_table || '',
        code: issue.code || '',
        details: issue.details || null
      },
      status: 'open',
      created_at: now,
      resolved_at: null
    };
  });
}


function migrationStage5NInsertRows_(tableName, rows) {
  if (!rows || rows.length === 0) {
    return {
      success: true,
      table: tableName,
      inserted_count: 0,
      rows: []
    };
  }

  var batchSize = 100;
  var insertedRows = [];
  var errors = [];

  for (var i = 0; i < rows.length; i += batchSize) {
    var chunk = rows.slice(i, i + batchSize);

    var response = migrationStage5NRequest_(
      'post',
      tableName,
      '',
      chunk,
      {
        Prefer: 'return=representation'
      }
    );

    if (!response.success) {
      errors.push({
        table: tableName,
        chunk_start: i,
        chunk_size: chunk.length,
        response: response
      });
      break;
    }

    if (Array.isArray(response.body)) {
      insertedRows = insertedRows.concat(response.body);
    }
  }

  return {
    success: errors.length === 0,
    table: tableName,
    inserted_count: insertedRows.length,
    rows: insertedRows,
    errors: errors
  };
}


/************************************************************
 * 5N-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5NInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5NBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5NInspectSupabaseTableSchema_(MIGRATION_STAGE_5N_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      MIGRATION_STAGE_5N_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENTS_SCHEMA_NOT_FOUND',
      'Schema table treatments tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5NInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var rowMaps = migrationStage5NInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;

  if (!rowMaps.success) {
    issues = issues.concat(rowMaps.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5NHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5N PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5NPreflight() {
  var startedAt = new Date();

  var result = migrationStage5NBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5NInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.row_map_status = inspect.row_map_status;

  issues = issues.concat(inspect.issues || []);

  if (inspect.success) {
    var sourceRows = migrationStage5NReadTreatmentSourceRows_();
    result.treatment_source_status = sourceRows.status;

    if (!sourceRows.success) {
      issues = issues.concat(sourceRows.issues || []);
    }

    var dryRun = migrationStage5NBuildTreatmentDryRunPayload_();
    result.dry_run_status = dryRun.status;
    result.sample_payloads = dryRun.sample_payloads;
    result.sample_issues = dryRun.sample_issues;

    issues = issues.concat(dryRun.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5NHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5N SOURCE SHEET
 ************************************************************/

function migrationStage5NInspectSourceSheet_() {
  var sheet = migrationStage5NFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5NIssue_(
          'error',
          MIGRATION_STAGE_5N_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber Treatments tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5N_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 5);

  return {
    success: migrationStage5NHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5NFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5N_SOURCE_SHEET_ALIASES);
}


function migrationStage5NReadTreatmentSourceRows_() {
  var sheet = migrationStage5NFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      rows: [],
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        non_blank_payload_row_count: 0
      },
      issues: [
        migrationStage5NIssue_(
          'error',
          MIGRATION_STAGE_5N_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber Treatments tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5NHasNoBlockingIssues_(rowsResult.issues || []),
    rows: rowsResult.rows || [],
    headers: rowsResult.headers || [],
    status: {
      source_sheet: sheet.getName(),
      spreadsheet_row_count: rowsResult.row_count_total || 0,
      non_blank_payload_row_count: rowsResult.rows ? rowsResult.rows.length : 0,
      header_count: rowsResult.headers ? rowsResult.headers.length : 0
    },
    issues: rowsResult.issues || []
  };
}


/************************************************************
 * 5N ROW MAP INSPECTION
 ************************************************************/

function migrationStage5NInspectRequiredRowMaps_() {
  var issues = [];

  var patients = migrationStage5NInspectRowMapByTarget_('patients', 285);
  var appointments = migrationStage5NInspectRowMapByTarget_('appointments', 284);
  var appUsers = migrationStage5NInspectRowMapByTarget_('app_users', 8);

  issues = issues
    .concat(patients.issues || [])
    .concat(appointments.issues || [])
    .concat(appUsers.issues || []);

  return {
    success: migrationStage5NHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      patients: patients.status,
      appointments: appointments.status,
      app_users: appUsers.status
    }
  };
}


function migrationStage5NInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5NCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5NRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ROW_MAP_COUNT_FAILED',
      'Gagal membaca jumlah migration_row_map untuk ' + targetTable + '.',
      countResult
    ));
  }

  if (!sampleResult.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ROW_MAP_SAMPLE_FAILED',
      'Gagal membaca sample migration_row_map untuk ' + targetTable + '.',
      sampleResult
    ));
  }

  if (countResult.success && expectedCount !== null && countResult.count !== expectedCount) {
    issues.push(migrationStage5NIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ROW_MAP_COUNT_UNEXPECTED',
      'Jumlah migration_row_map untuk ' + targetTable + ' tidak sesuai expected.',
      {
        expected_count: expectedCount,
        actual_count: countResult.count
      }
    ));
  }

  return {
    success: migrationStage5NHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      target_table: targetTable,
      expected_count: expectedCount,
      count: countResult.count,
      count_success: countResult.success,
      sample_success: sampleResult.success,
      sample_rows: Array.isArray(sampleResult.body) ? sampleResult.body : []
    }
  };
}


/************************************************************
 * 5N DRY-RUN PAYLOAD
 ************************************************************/

function migrationStage5NBuildTreatmentDryRunPayload_() {
  var sourceRows = migrationStage5NReadTreatmentSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        blocking_issue_count: 1,
        warning_issue_count: 0
      },
      payloads: [],
      sample_payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var patientMap = migrationStage5NLoadLegacyMap_('patients');
  var appointmentMap = migrationStage5NLoadLegacyMap_('appointments');
  var userMap = migrationStage5NLoadLegacyMap_('app_users');
  var userNameMap = migrationStage5NLoadAppUsersByName_();

  issues = issues
    .concat(patientMap.issues || [])
    .concat(appointmentMap.issues || [])
    .concat(userMap.issues || [])
    .concat(userNameMap.issues || []);

  var payloads = [];
  var sampleIssues = [];

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var treatmentId = migrationStage5NPick_(raw, [
      'treatment_id',
      'id',
      'treatmentId'
    ]);

    var patientId = migrationStage5NPick_(raw, [
      'patient_id',
      'patientId',
      'legacy_patient_id'
    ]);

    var patientName = migrationStage5NPick_(raw, [
      'patient_name',
      'full_name',
      'nama_pasien',
      'name'
    ]);

    var appointmentId = migrationStage5NPick_(raw, [
      'appointment_id',
      'appointmentId',
      'legacy_appointment_id'
    ]);

    var doctorUserId = migrationStage5NPick_(raw, [
      'doctor_user_id',
      'doctor_id',
      'doctorId',
      'user_id',
      'dentist_id',
      'dokter_id'
    ]);

    var doctorName = migrationStage5NPick_(raw, [
      'doctor_name',
      'dentist_name',
      'dokter',
      'dokter_name'
    ]);

    var treatmentDate = migrationStage5NPick_(raw, [
      'treatment_date',
      'date',
      'tanggal',
      'created_at'
    ]);

    var chiefComplaint = migrationStage5NPick_(raw, [
      'chief_complaint',
      'complaint',
      'keluhan'
    ]);

    var diagnosis = migrationStage5NPick_(raw, [
      'diagnosis',
      'diagnosa'
    ]);

    var notes = migrationStage5NPick_(raw, [
      'notes',
      'note',
      'catatan'
    ]);

    var totalCost = migrationStage5NPick_(raw, [
      'total_cost',
      'cost',
      'price',
      'subtotal',
      'biaya'
    ]);

    var createdAt = migrationStage5NPick_(raw, [
      'created_at',
      'createdAt',
      'created_date'
    ]);

    var updatedAt = migrationStage5NPick_(raw, [
      'updated_at',
      'updatedAt',
      'updated_date'
    ]);

    var normalizedPatientId = migrationNormalizeText_5K_(patientId);
    var normalizedAppointmentId = migrationNormalizeNullableText_5K_(appointmentId);
    var normalizedDoctorName = migrationNormalizeNullableText_5K_(doctorName);
    var normalizedDoctorUserId = migrationNormalizeNullableText_5K_(doctorUserId);

    var doctorByName = normalizedDoctorName
      ? userNameMap.map[migrationStage5NNormalizeNameKey_(normalizedDoctorName)]
      : null;

    if (!normalizedDoctorUserId && doctorByName && doctorByName.user_id) {
      normalizedDoctorUserId = doctorByName.user_id;
    }

    var patientUuid = normalizedPatientId ? patientMap.map[normalizedPatientId] : null;
    var appointmentUuid = normalizedAppointmentId ? appointmentMap.map[normalizedAppointmentId] : null;
    var doctorUserUuid = normalizedDoctorUserId ? userMap.map[normalizedDoctorUserId] : null;

    if (!doctorUserUuid && doctorByName && doctorByName.id) {
      doctorUserUuid = doctorByName.id;
    }

    var payload = {
      treatment_id: migrationNormalizeText_5K_(treatmentId),
      appointment_id: normalizedAppointmentId,
      appointment_uuid: appointmentUuid,
      patient_id: normalizedPatientId,
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      doctor_user_id: normalizedDoctorUserId,
      doctor_user_uuid: doctorUserUuid,
      doctor_name: normalizedDoctorName,
      treatment_date: migrationNormalizeDate_5K_(treatmentDate),
      chief_complaint: migrationNormalizeNullableText_5K_(chiefComplaint),
      diagnosis: migrationNormalizeNullableText_5K_(diagnosis),
      notes: migrationNormalizeNullableText_5K_(notes),
      total_cost: migrationNormalizeNumber_5K_(totalCost),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5NParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.treatment_id) {
      var missingTreatmentIssue = migrationStage5NIssue_(
        'error',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_TREATMENT_ID',
        'Treatment tidak memiliki treatment_id.',
        { raw: raw }
      );

      issues.push(missingTreatmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingTreatmentIssue);
    }

    if (!payload.patient_id) {
      var missingPatientIssue = migrationStage5NIssue_(
        'error',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_id,
        'MISSING_PATIENT_ID',
        'Treatment tidak memiliki patient_id.'
      );

      issues.push(missingPatientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingPatientIssue);
    } else if (!payload.patient_uuid) {
      var missingPatientMapIssue = migrationStage5NIssue_(
        'error',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id pada treatment tidak ditemukan di migration_row_map patients.',
        { patient_id: payload.patient_id }
      );

      issues.push(missingPatientMapIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingPatientMapIssue);
    }

    if (payload.appointment_id && !payload.appointment_uuid) {
      var missingAppointmentMapIssue = migrationStage5NIssue_(
        'error',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_id,
        'APPOINTMENT_PARENT_NOT_MAPPED',
        'appointment_id pada treatment tidak ditemukan di migration_row_map appointments.',
        { appointment_id: payload.appointment_id }
      );

      issues.push(missingAppointmentMapIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingAppointmentMapIssue);
    }

    if (payload.doctor_name && !payload.doctor_user_uuid) {
      var missingDoctorMapIssue = migrationStage5NIssue_(
        'warning',
        MIGRATION_STAGE_5N_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_id,
        'DOCTOR_NAME_NOT_MAPPED',
        'doctor_name tidak berhasil dicocokkan ke app_users.full_name. doctor_user_uuid akan null.',
        { doctor_name: payload.doctor_name }
      );

      issues.push(missingDoctorMapIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingDoctorMapIssue);
    }

    payloads.push(payload);
  });

  return {
    success: migrationStage5NHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      patient_map_count: patientMap.count || 0,
      appointment_map_count: appointmentMap.count || 0,
      user_map_count: userMap.count || 0,
      user_name_map_count: userNameMap.count || 0,
      blocking_issue_count: migrationStage5NCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5NCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 5),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5NLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5NRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5NIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'LOAD_ROW_MAP_FAILED',
        'Gagal load migration_row_map untuk ' + targetTable + '.',
        response
      ));

      break;
    }

    var rows = Array.isArray(response.body) ? response.body : [];

    rows.forEach(function(row) {
      if (row.legacy_id && row.target_uuid && row.mapping_status === 'mapped') {
        map[row.legacy_id] = row.target_uuid;
      }
    });

    if (rows.length < pageSize) {
      keepGoing = false;
    } else {
      offset += pageSize;
    }
  }

  return {
    success: migrationStage5NHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


/************************************************************
 * 5N SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5NInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5NFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5NExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5NFindOpenApiTableDefinition_(definitions, tableName);

  if (!tableDef) {
    return {
      success: false,
      schema: {
        table: tableName,
        found: false,
        columns: []
      },
      response: schemaResult
    };
  }

  var properties = tableDef.properties || {};
  var columns = Object.keys(properties).sort();

  return {
    success: true,
    schema: {
      table: tableName,
      found: true,
      column_count: columns.length,
      columns: columns,
      required: tableDef.required || [],
      properties_preview: migrationStage5NPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5NFetchOpenApiSchema_() {
  var config = migrationStage5NGetConfig_();

  if (!config.url || !config.service_role_key) {
    return {
      success: false,
      body: null,
      message: 'Supabase config belum lengkap.'
    };
  }

  var baseUrl = config.url.replace(/\/+$/, '');
  var url = baseUrl + '/rest/v1/';

  var headers = {
    apikey: config.service_role_key,
    Authorization: 'Bearer ' + config.service_role_key,
    Accept: 'application/openapi+json'
  };

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: headers
  });

  var httpCode = response.getResponseCode();
  var text = response.getContentText();
  var body = migrationStage5NParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5NExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5NFindOpenApiTableDefinition_(definitions, tableName) {
  if (!definitions) return null;

  if (definitions[tableName]) return definitions[tableName];
  if (definitions['public.' + tableName]) return definitions['public.' + tableName];

  var keys = Object.keys(definitions);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (key.toLowerCase() === tableName.toLowerCase()) return definitions[key];
    if (key.toLowerCase() === ('public.' + tableName).toLowerCase()) return definitions[key];
  }

  return null;
}


function migrationStage5NPickPropertiesPreview_(properties) {
  var preview = {};
  var keys = Object.keys(properties || {}).sort();

  keys.forEach(function(key) {
    var prop = properties[key] || {};

    preview[key] = {
      type: prop.type || null,
      format: prop.format || null,
      description: prop.description || null
    };
  });

  return preview;
}


/************************************************************
 * 5N SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5NGetConfig_() {
  var props = PropertiesService.getScriptProperties();

  var url = props.getProperty('SUPABASE_STAGING_URL');

  var serviceRoleKey =
    props.getProperty('SUPABASE_STAGING_SERVICE_ROLE_KEY') ||
    props.getProperty('SUPABASE_STAGING_SERVICE_ROLE_JWT') ||
    props.getProperty('SUPABASE_SERVICE_ROLE_KEY') ||
    props.getProperty('SUPABASE_SERVICE_ROLE_JWT');

  return {
    url: url,
    service_role_key: serviceRoleKey
  };
}


function migrationStage5NRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5NGetConfig_();

  if (!config.url || !config.service_role_key) {
    return {
      success: false,
      http_code: 0,
      table: tableName,
      message: 'Supabase config belum lengkap.'
    };
  }

  var baseUrl = config.url.replace(/\/+$/, '');
  var url = baseUrl + '/rest/v1/' + encodeURIComponent(tableName);

  if (queryString) {
    url += '?' + queryString;
  }

  var headers = {
    apikey: config.service_role_key,
    Authorization: 'Bearer ' + config.service_role_key,
    'Content-Type': 'application/json'
  };

  extraHeaders = extraHeaders || {};

  Object.keys(extraHeaders).forEach(function(key) {
    headers[key] = extraHeaders[key];
  });

  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: headers
  };

  if (body !== null && body !== undefined) {
    options.payload = JSON.stringify(body);
  }

  var response = UrlFetchApp.fetch(url, options);
  var httpCode = response.getResponseCode();
  var text = response.getContentText();
  var parsedBody = migrationStage5NParseJsonSafely_(text);
  var allHeaders = response.getAllHeaders();

  return {
    success: httpCode >= 200 && httpCode < 300,
    http_code: httpCode,
    table: tableName,
    body: parsedBody,
    text: text,
    headers: allHeaders
  };
}


function migrationStage5NCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5NRequest_(
    'get',
    tableName,
    query,
    null,
    {
      Prefer: 'count=exact',
      Range: '0-0'
    }
  );

  if (!response.success) {
    return {
      success: false,
      table: tableName,
      count: null,
      http_code: response.http_code,
      response: response
    };
  }

  var headers = response.headers || {};
  var contentRange =
    headers['Content-Range'] ||
    headers['content-range'] ||
    headers['Content-range'] ||
    '';

  var count = migrationStage5NParseCountFromContentRange_(contentRange);

  if (count === null && Array.isArray(response.body)) {
    count = response.body.length;
  }

  return {
    success: true,
    table: tableName,
    count: count,
    http_code: response.http_code,
    content_range: contentRange
  };
}


/************************************************************
 * 5N GENERIC UTILITIES
 ************************************************************/

function migrationStage5NBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5NNowIso_(),
    stage: MIGRATION_STAGE_5N_NAME,
    mode: mode,
    safe_boundary: {
      supabase_insert: false,
      supabase_update: false,
      supabase_delete: false,
      spreadsheet_update: false,
      frontend_change: false,
      backend_active_changed: false
    },
    issue_count: 0,
    issues: []
  };
}


function migrationStage5NIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
  return {
    severity: severity || 'warning',
    target_table: targetTable || '',
    source_sheet: sourceSheet || '',
    source_row_number: sourceRowNumber || '',
    legacy_id: legacyId || '',
    code: code || '',
    message: message || '',
    details: details || null
  };
}


function migrationStage5NHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5NCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}


function migrationStage5NPick_(raw, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var key = migrationNormalizeHeaderKey_5K_(candidates[i]);

    if (raw.hasOwnProperty(key)) {
      var value = raw[key];

      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }
  }

  return null;
}


function migrationStage5NParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5NParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5NNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5NGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5NGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5NLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}

function migrationStage5NLoadAppUsersByName_() {
  var issues = [];
  var map = {};

  var response = migrationStage5NRequest_(
    'get',
    'app_users',
    'select=id,user_id,full_name,role&limit=1000',
    null,
    {}
  );

  if (!response.success) {
    issues.push(migrationStage5NIssue_(
      'error',
      'app_users',
      '',
      '',
      '',
      'LOAD_APP_USERS_BY_NAME_FAILED',
      'Gagal membaca app_users untuk resolve doctor_name.',
      response
    ));

    return {
      success: false,
      issues: issues,
      map: map,
      count: 0
    };
  }

  var rows = Array.isArray(response.body) ? response.body : [];

  rows.forEach(function(row) {
    var key = migrationStage5NNormalizeNameKey_(row.full_name);

    if (key) {
      map[key] = {
        id: row.id,
        user_id: row.user_id,
        full_name: row.full_name,
        role: row.role
      };
    }
  });

  return {
    success: true,
    issues: [],
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5NNormalizeNameKey_(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.\s+/g, '.');
}