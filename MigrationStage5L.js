/************************************************************
 * MigrationStage5L.gs
 * Tahap 5L — Insert parent tables ke Supabase staging
 *
 * TARGET:
 * 1. Migrasi app_users
 * 2. Migrasi patients
 * 3. Migrasi service_catalog
 * 4. Isi migration_row_map
 * 5. Catat anomaly ke migration_issues bila ada
 * 6. Audit jumlah row Spreadsheet vs Supabase
 *
 * SAFETY:
 * - Hanya untuk Supabase staging
 * - Tidak mengubah frontend
 * - Tidak mengubah backend aktif Spreadsheet
 * - Tidak menyentuh CRUD aplikasi production
 ************************************************************/


/************************************************************
 * 5L SAFETY CONFIG
 ************************************************************/

var MIGRATION_STAGE_5L_WRITE_ENABLED = false;

var MIGRATION_STAGE_5L_NAME = '5L';
var MIGRATION_STAGE_5L_BATCH_SIZE = 100;

var MIGRATION_STAGE_5L_PARENT_ORDER = [
  'app_users',
  'patients',
  'service_catalog'
];

var MIGRATION_STAGE_5L_TABLE_META = {
  app_users: {
    target_table: 'app_users',
    source_table: 'Users',
    legacy_field: 'user_id',
    dry_run_legacy_field: 'legacy_user_id',
    expected_columns: [
      'id',
      'user_id',
      'username',
      'full_name',
      'password',
      'password_hash',
      'password_legacy_note',
      'role',
      'is_active',
      'created_at',
      'updated_at',
      'source_sheet',
      'source_row_number',
      'raw_snapshot'
    ]
  },

  patients: {
    target_table: 'patients',
    source_table: 'Patients',
    legacy_field: 'patient_id',
    dry_run_legacy_field: 'legacy_patient_id',
    expected_columns: [
      'id',
      'patient_id',
      'patient_code',
      'full_name',
      'gender',
      'birth_date',
      'phone',
      'address',
      'emergency_contact',
      'medical_notes',
      'is_active',
      'created_at',
      'updated_at',
      'source_sheet',
      'source_row_number',
      'raw_snapshot'
    ]
  },

  service_catalog: {
    target_table: 'service_catalog',
    source_table: 'ServiceCatalog',
    legacy_field: 'service_id',
    dry_run_legacy_field: 'legacy_service_id',
    expected_columns: [
      'id',
      'service_id',
      'service_name',
      'category',
      'default_price',
      'is_ortho_install',
      'is_ortho_control',
      'notes',
      'is_active',
      'created_at',
      'updated_at',
      'source_sheet',
      'source_row_number',
      'raw_snapshot'
    ]
  }
};

var MIGRATION_STAGE_5L_ROW_MAP_COLUMNS = [
  'id',
  'source_sheet',
  'source_row_number',
  'legacy_id',
  'target_table',
  'target_uuid',
  'mapping_status',
  'notes',
  'created_at'
];

var MIGRATION_STAGE_5L_ISSUE_COLUMNS = [
  'id',
  'issue_type',
  'severity',
  'source_sheet',
  'source_row_number',
  'legacy_id',
  'related_legacy_id',
  'message',
  'row_snapshot',
  'status',
  'created_at',
  'resolved_at'
];


/************************************************************
 * 5L PUBLIC TEST ENTRY POINTS
 ************************************************************/

function testMigrationStage5LPreflightLog() {
  var result = runMigrationStage5LPreflight();
  migrationStage5LLogJson_('testMigrationStage5LPreflight', result);
  return result;
}


function testMigrationStage5LDryRunPayloadLog() {
  var result = runMigrationStage5LDryRunPayload();
  migrationStage5LLogJson_('testMigrationStage5LDryRunPayload', result);
  return result;
}


function testMigrationStage5LInsertParentTablesLog() {
  var result = runMigrationStage5LInsertParentTables();
  migrationStage5LLogJson_('testMigrationStage5LInsertParentTables', result);
  return result;
}


function testMigrationStage5LAuditParentTablesLog() {
  var result = runMigrationStage5LAuditParentTables();
  migrationStage5LLogJson_('testMigrationStage5LAuditParentTables', result);
  return result;
}


/************************************************************
 * 5L PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5LPreflight() {
  var startedAt = new Date();

  var result = migrationStage5LBaseResult_('preflight_read_only');
  var issues = [];

  var configCheck = migrationStage5LCheckConfig_();
  result.config_status = configCheck.config_status;
  issues = issues.concat(configCheck.issues);

  if (issues.length === 0) {
    var connectionCheck = migrationStage5LCheckConnection_();
    result.connection_status = connectionCheck.connection_status;
    issues = issues.concat(connectionCheck.issues);
  }

  if (issues.length === 0) {
    var columnCheck = migrationStage5LCheckExpectedColumns_();
    result.column_status = columnCheck.column_status;
    issues = issues.concat(columnCheck.issues);
  }

  if (issues.length === 0) {
    var emptyCheck = migrationStage5LCheckTargetTablesEmpty_();
    result.target_table_status = emptyCheck.target_table_status;
    issues = issues.concat(emptyCheck.issues);
  }

  var payloadCheck = runMigrationStage5LDryRunPayload();
  result.payload_status = payloadCheck.payload_status;
  issues = issues.concat(payloadCheck.issues || []);

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5LHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5L DRY-RUN PAYLOAD — NO SUPABASE WRITE
 ************************************************************/

function runMigrationStage5LDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5LBaseResult_('dry_run_payload_only');
  var bundle = migrationStage5LBuildParentPayloadBundle_();

  result.payload_status = bundle.payload_status;
  result.sample_row_map_payloads = bundle.sample_row_map_payloads;
  result.issues = bundle.issues;
  result.issue_count = bundle.issues.length;
  result.success = migrationStage5LHasNoBlockingIssues_(bundle.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5L INSERT PARENT TABLES — WRITE TO STAGING ONLY
 ************************************************************/

function runMigrationStage5LInsertParentTables() {
  var startedAt = new Date();

  var result = migrationStage5LBaseResult_('insert_parent_tables_staging');
  var issues = [];

  if (MIGRATION_STAGE_5L_WRITE_ENABLED !== true) {
    issues.push(migrationStage5LIssue_(
      'error',
      '',
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5L_WRITE_ENABLED masih false. Jalankan preflight dulu. Jika preflight clean, ubah menjadi true hanya untuk menjalankan 5L staging insert.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5LIssue_(
      'error',
      '',
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5L sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5LPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      target_table_status: preflight.target_table_status || null,
      payload_status: preflight.payload_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5LIssue_(
        'error',
        '',
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5L belum clean. Insert dibatalkan.',
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

    var bundle = migrationStage5LBuildParentPayloadBundle_();

    if (!migrationStage5LHasNoBlockingIssues_(bundle.issues)) {
      issues = issues.concat(bundle.issues);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertedSummary = {};
    var allRowMapRows = [];

    MIGRATION_STAGE_5L_PARENT_ORDER.forEach(function(tableKey) {
      var payloadRows = bundle.payloads[tableKey] || [];
      var meta = MIGRATION_STAGE_5L_TABLE_META[tableKey];

      var rowsForSupabase = payloadRows.map(function(row) {
        return migrationStage5LPrepareMainRowForSupabase_(tableKey, row);
      });

      var insertResult = migrationStage5LInsertRows_(meta.target_table, rowsForSupabase);

      if (!insertResult.success) {
        issues.push(migrationStage5LIssue_(
          'error',
          meta.target_table,
          meta.source_table,
          '',
          '',
          'PARENT_TABLE_INSERT_FAILED',
          'Insert parent table gagal: ' + meta.target_table,
          insertResult
        ));
        return;
      }

      insertedSummary[tableKey] = {
        target_table: meta.target_table,
        inserted_count: insertResult.rows.length
      };

      var rowMapRows = migrationStage5LBuildRowMapRows_(tableKey, insertResult.rows);
      allRowMapRows = allRowMapRows.concat(rowMapRows);
    });

    if (!migrationStage5LHasNoBlockingIssues_(issues)) {
      result.inserted_summary = insertedSummary;
      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapInsertResult = migrationStage5LInsertRows_('migration_row_map', allRowMapRows);

    if (!rowMapInsertResult.success) {
      issues.push(migrationStage5LIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map gagal.',
        rowMapInsertResult
      ));
    }

    var issueRows = migrationStage5LBuildMigrationIssueRows_(bundle.issues);

    if (issueRows.length > 0) {
      var issueInsertResult = migrationStage5LInsertRows_('migration_issues', issueRows);

      if (!issueInsertResult.success) {
        issues.push(migrationStage5LIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues gagal.',
          issueInsertResult
        ));
      }
    }

    var audit = runMigrationStage5LAuditParentTables();

    result.inserted_summary = insertedSummary;
    result.row_map_inserted_count = rowMapInsertResult.rows ? rowMapInsertResult.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5LHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5LIssue_(
      'error',
      '',
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


/************************************************************
 * 5L AUDIT AFTER INSERT — READ ONLY
 ************************************************************/

function runMigrationStage5LAuditParentTables() {
  var startedAt = new Date();

  var result = migrationStage5LBaseResult_('audit_parent_tables_read_only');
  var issues = [];
  var bundle = migrationStage5LBuildParentPayloadBundle_();

  var auditStatus = {};

  MIGRATION_STAGE_5L_PARENT_ORDER.forEach(function(tableKey) {
    var meta = MIGRATION_STAGE_5L_TABLE_META[tableKey];
    var spreadsheetCount = bundle.payload_status[tableKey]
      ? bundle.payload_status[tableKey].spreadsheet_row_count
      : 0;

    var supabaseCount = migrationStage5LCountRows_(meta.target_table);
    var mapCount = migrationStage5LCountRows_(
      'migration_row_map',
      'target_table=eq.' + encodeURIComponent(meta.target_table)
    );

    auditStatus[tableKey] = {
      target_table: meta.target_table,
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: mapCount.count
    };

    if (!supabaseCount.success) {
      issues.push(migrationStage5LIssue_(
        'error',
        meta.target_table,
        meta.source_table,
        '',
        '',
        'SUPABASE_COUNT_FAILED',
        'Gagal menghitung row Supabase untuk ' + meta.target_table + '.',
        supabaseCount
      ));
    }

    if (!mapCount.success) {
      issues.push(migrationStage5LIssue_(
        'error',
        'migration_row_map',
        meta.source_table,
        '',
        '',
        'ROW_MAP_COUNT_FAILED',
        'Gagal menghitung migration_row_map untuk ' + meta.target_table + '.',
        mapCount
      ));
    }

    if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
      issues.push(migrationStage5LIssue_(
        'error',
        meta.target_table,
        meta.source_table,
        '',
        '',
        'COUNT_MISMATCH',
        'Jumlah row Spreadsheet dan Supabase tidak sama untuk ' + meta.target_table + '.',
        {
          spreadsheet_count: spreadsheetCount,
          supabase_count: supabaseCount.count
        }
      ));
    }

    if (mapCount.success && mapCount.count !== spreadsheetCount) {
      issues.push(migrationStage5LIssue_(
        'error',
        'migration_row_map',
        meta.source_table,
        '',
        '',
        'ROW_MAP_COUNT_MISMATCH',
        'Jumlah migration_row_map tidak sama untuk ' + meta.target_table + '.',
        {
          spreadsheet_count: spreadsheetCount,
          migration_row_map_count: mapCount.count
        }
      ));
    }
  });

  result.audit_status = auditStatus;
  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5LHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5L PAYLOAD BUNDLE
 ************************************************************/

function migrationStage5LBuildParentPayloadBundle_() {
  var issues = [];
  var payloads = {};
  var payloadStatus = {};
  var sampleRowMapPayloads = [];

  var appUsers = migrationBuildAppUsersPayloadDryRun5K_();
  var patients = migrationBuildPatientsPayloadDryRun5K_();
  var serviceCatalog = migrationBuildServiceCatalogPayloadDryRun5K_();

  var sourceMap = {
    app_users: appUsers,
    patients: patients,
    service_catalog: serviceCatalog
  };

  MIGRATION_STAGE_5L_PARENT_ORDER.forEach(function(tableKey) {
    var built = sourceMap[tableKey];
    var meta = MIGRATION_STAGE_5L_TABLE_META[tableKey];

    payloads[tableKey] = built.payloads || [];
    issues = issues.concat(built.issues || []);

    payloadStatus[tableKey] = {
      target_table: meta.target_table,
      source_table: meta.source_table,
      source_sheet: built.summary ? built.summary.source_sheet : null,
      spreadsheet_row_count: built.summary ? built.summary.spreadsheet_row_count : 0,
      dry_run_payload_count: built.payloads ? built.payloads.length : 0,
      blocking_issue_count: built.summary ? built.summary.blocking_issue_count : 0,
      warning_issue_count: built.summary ? built.summary.warning_issue_count : 0
    };

    var fakeRows = (built.payloads || []).slice(0, 2).map(function(row) {
      var copy = migrationStage5LClone_(row);
      copy.id = 'DRY_RUN_UUID_FROM_SUPABASE_RETURN';
      return copy;
    });

    sampleRowMapPayloads = sampleRowMapPayloads.concat(
      migrationStage5LBuildRowMapRows_(tableKey, fakeRows)
    );
  });

  return {
    payloads: payloads,
    payload_status: payloadStatus,
    sample_row_map_payloads: sampleRowMapPayloads,
    issues: issues
  };
}


/************************************************************
 * 5L PREFLIGHT HELPERS
 ************************************************************/

function migrationStage5LCheckConfig_() {
  var issues = [];
  var config = migrationStage5LGetConfig_();

  if (!config.url) {
    issues.push(migrationStage5LIssue_(
      'error',
      '',
      '',
      '',
      '',
      'SUPABASE_URL_MISSING',
      'Script Property SUPABASE_STAGING_URL belum ditemukan.'
    ));
  }

  if (!config.service_role_key) {
    issues.push(migrationStage5LIssue_(
      'error',
      '',
      '',
      '',
      '',
      'SUPABASE_SERVICE_ROLE_KEY_MISSING',
      'Script Property service_role key staging belum ditemukan.'
    ));
  }

  return {
    issues: issues,
    config_status: {
      has_url: !!config.url,
      has_service_role_key: !!config.service_role_key,
      url_preview: config.url ? config.url.substring(0, 24) + '...' : null,
      service_role_key_length: config.service_role_key ? config.service_role_key.length : 0
    }
  };
}


function migrationStage5LCheckConnection_() {
  var issues = [];

  var response = migrationStage5LRequest_(
    'get',
    'patients',
    'select=id&limit=1',
    null,
    {}
  );

  if (!response.success) {
    issues.push(migrationStage5LIssue_(
      'error',
      'patients',
      '',
      '',
      '',
      'SUPABASE_CONNECTION_FAILED',
      'Koneksi read ke Supabase staging gagal.',
      response
    ));
  }

  return {
    issues: issues,
    connection_status: {
      success: response.success,
      http_code: response.http_code,
      body_is_array: Array.isArray(response.body),
      sample_length: Array.isArray(response.body) ? response.body.length : null
    }
  };
}


function migrationStage5LCheckExpectedColumns_() {
  var issues = [];
  var status = {};

  MIGRATION_STAGE_5L_PARENT_ORDER.forEach(function(tableKey) {
    var meta = MIGRATION_STAGE_5L_TABLE_META[tableKey];
    var check = migrationStage5LCheckColumnsForTable_(
      meta.target_table,
      meta.expected_columns
    );

    status[meta.target_table] = check.status;

    if (!check.success) {
      issues.push(migrationStage5LIssue_(
        'error',
        meta.target_table,
        meta.source_table,
        '',
        '',
        'COLUMN_CHECK_FAILED',
        'Validasi kolom gagal untuk table ' + meta.target_table + '.',
        check
      ));
    }
  });

  var rowMapCheck = migrationStage5LCheckColumnsForTable_(
    'migration_row_map',
    MIGRATION_STAGE_5L_ROW_MAP_COLUMNS
  );

  status.migration_row_map = rowMapCheck.status;

  if (!rowMapCheck.success) {
    issues.push(migrationStage5LIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ROW_MAP_COLUMN_CHECK_FAILED',
      'Validasi kolom migration_row_map gagal.',
      rowMapCheck
    ));
  }

  var issueCheck = migrationStage5LCheckColumnsForTable_(
    'migration_issues',
    MIGRATION_STAGE_5L_ISSUE_COLUMNS
  );

  status.migration_issues = issueCheck.status;

  if (!issueCheck.success) {
    issues.push(migrationStage5LIssue_(
      'error',
      'migration_issues',
      '',
      '',
      '',
      'MIGRATION_ISSUES_COLUMN_CHECK_FAILED',
      'Validasi kolom migration_issues gagal.',
      issueCheck
    ));
  }

  return {
    issues: issues,
    column_status: status
  };
}


function migrationStage5LCheckColumnsForTable_(tableName, columns) {
  var selectQuery = 'select=' + columns.map(function(col) {
    return encodeURIComponent(col);
  }).join(',') + '&limit=1';

  var response = migrationStage5LRequest_(
    'get',
    tableName,
    selectQuery,
    null,
    {}
  );

  return {
    success: response.success,
    status: {
      table: tableName,
      expected_column_count: columns.length,
      http_code: response.http_code,
      success: response.success
    },
    response: response.success ? null : response
  };
}


function migrationStage5LCheckTargetTablesEmpty_() {
  var issues = [];
  var status = {};

  var tables = MIGRATION_STAGE_5L_PARENT_ORDER.map(function(key) {
    return MIGRATION_STAGE_5L_TABLE_META[key].target_table;
  }).concat([
    'migration_row_map',
    'migration_issues'
  ]);

  tables.forEach(function(tableName) {
    var countResult = migrationStage5LCountRows_(tableName);

    status[tableName] = {
      count: countResult.count,
      success: countResult.success,
      http_code: countResult.http_code
    };

    if (!countResult.success) {
      issues.push(migrationStage5LIssue_(
        'error',
        tableName,
        '',
        '',
        '',
        'COUNT_FAILED',
        'Gagal menghitung row table ' + tableName + '.',
        countResult
      ));
      return;
    }

    if (countResult.count !== 0) {
      issues.push(migrationStage5LIssue_(
        'error',
        tableName,
        '',
        '',
        '',
        'TARGET_TABLE_NOT_EMPTY',
        'Table target tidak kosong. Untuk 5L awal, table harus kosong agar tidak terjadi duplikasi.',
        {
          table: tableName,
          count: countResult.count
        }
      ));
    }
  });

  return {
    issues: issues,
    target_table_status: status
  };
}


/************************************************************
 * 5L ROW BUILDERS
 ************************************************************/

function migrationStage5LPrepareMainRowForSupabase_(tableKey, row) {
  if (tableKey === 'app_users') {
    return {
      user_id: row.legacy_user_id,
      username: row.username,
      full_name: row.full_name,
      password: null,
      password_hash: row.password_hash,
      password_legacy_note: row.password_hash
        ? 'Migrated from Spreadsheet password_hash. Plain password intentionally not migrated.'
        : null,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      raw_snapshot: migrationStage5LParseJsonSafely_(row.raw_snapshot)
    };
  }

  if (tableKey === 'patients') {
    return {
      patient_id: row.legacy_patient_id,
      patient_code: row.patient_code,
      full_name: row.full_name,
      gender: row.gender,
      birth_date: row.birth_date,
      phone: row.phone,
      address: row.address,
      emergency_contact: migrationStage5LBuildEmergencyContactText_(row),
      medical_notes: row.medical_notes,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      raw_snapshot: migrationStage5LParseJsonSafely_(row.raw_snapshot)
    };
  }

  if (tableKey === 'service_catalog') {
    return {
      service_id: row.legacy_service_id,
      service_name: row.service_name,
      category: row.category,
      default_price: row.default_price,
      is_ortho_install: row.is_ortho_install,
      is_ortho_control: row.is_ortho_control,
      notes: migrationStage5LBuildServiceNotesText_(row),
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      raw_snapshot: migrationStage5LParseJsonSafely_(row.raw_snapshot)
    };
  }

  throw new Error('Unknown tableKey for 5L prepare row: ' + tableKey);
}


function migrationStage5LBuildRowMapRows_(tableKey, insertedRows) {
  var meta = MIGRATION_STAGE_5L_TABLE_META[tableKey];
  var now = migrationStage5LNowIso_();

  return insertedRows.map(function(row) {
    var legacyId = migrationStage5LGetLegacyIdFromRow_(tableKey, row);

    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: legacyId,
      target_table: meta.target_table,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5L_NAME + '; source_table=' + meta.source_table,
      created_at: now
    };
  });
}


function migrationStage5LBuildMigrationIssueRows_(issues) {
  var now = migrationStage5LNowIso_();

  return (issues || []).map(function(issue) {
    var legacyId = '';

    if (issue.details && issue.details.legacy_id) {
      legacyId = issue.details.legacy_id;
    }

    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: legacyId,
      related_legacy_id: '',
      message: '[' + MIGRATION_STAGE_5L_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5L_NAME,
        target_table: issue.target_table || '',
        source_table: issue.source_table || '',
        code: issue.code || '',
        details: issue.details || null
      },
      status: 'open',
      created_at: now,
      resolved_at: null
    };
  });
}

/************************************************************
 * 5L SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5LGetConfig_() {
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


function migrationStage5LRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5LGetConfig_();

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
  var parsedBody = migrationStage5LParseJsonSafely_(text);
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


function migrationStage5LCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5LRequest_(
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

  var count = migrationStage5LParseCountFromContentRange_(contentRange);

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


function migrationStage5LInsertRows_(tableName, rows) {
  if (!rows || rows.length === 0) {
    return {
      success: true,
      table: tableName,
      inserted_count: 0,
      rows: []
    };
  }

  var insertedRows = [];
  var errors = [];

  for (var i = 0; i < rows.length; i += MIGRATION_STAGE_5L_BATCH_SIZE) {
    var chunk = rows.slice(i, i + MIGRATION_STAGE_5L_BATCH_SIZE);

    var response = migrationStage5LRequest_(
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
 * 5L GENERIC UTILITIES
 ************************************************************/

function migrationStage5LBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5LNowIso_(),
    stage: MIGRATION_STAGE_5L_NAME,
    mode: mode,
    safe_boundary: {
      supabase_insert: mode === 'insert_parent_tables_staging',
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


function migrationStage5LIssue_(severity, targetTable, sourceTable, sourceSheet, sourceRowNumber, code, message, details) {
  return {
    severity: severity || 'warning',
    target_table: targetTable || '',
    source_table: sourceTable || '',
    source_sheet: sourceSheet || '',
    source_row_number: sourceRowNumber || '',
    code: code || '',
    message: message || '',
    details: details || null
  };
}


function migrationStage5LHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') {
      return false;
    }
  }

  return true;
}


function migrationStage5LParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5LParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5LClone_(value) {
  return JSON.parse(JSON.stringify(value));
}


function migrationStage5LNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5LGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5LGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5LLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}

function migrationStage5LGetLegacyIdFromRow_(tableKey, row) {
  var meta = MIGRATION_STAGE_5L_TABLE_META[tableKey];

  if (!meta) return '';

  return row[meta.legacy_field] ||
    row[meta.dry_run_legacy_field] ||
    '';
}


function migrationStage5LBuildEmergencyContactText_(row) {
  var parts = [];

  if (row.guardian_name) {
    parts.push('Nama wali: ' + row.guardian_name);
  }

  if (row.guardian_relationship) {
    parts.push('Hubungan: ' + row.guardian_relationship);
  }

  if (row.guardian_phone) {
    parts.push('HP wali: ' + row.guardian_phone);
  }

  if (row.guardian_email) {
    parts.push('Email wali: ' + row.guardian_email);
  }

  return parts.length ? parts.join(' | ') : null;
}


function migrationStage5LBuildServiceNotesText_(row) {
  var parts = [];

  if (row.duration_minutes && Number(row.duration_minutes) > 0) {
    parts.push('Durasi menit: ' + row.duration_minutes);
  }

  return parts.length ? parts.join(' | ') : null;
}

/************************************************************
 * 5L SCHEMA INSPECTOR — READ ONLY
 * Tujuan:
 * - Membaca OpenAPI schema dari Supabase PostgREST
 * - Menampilkan kolom aktual table staging
 * - Tidak insert/update/delete
 ************************************************************/

function testMigrationStage5LInspectSupabaseSchemaLog() {
  var result = runMigrationStage5LInspectSupabaseSchema();
  migrationStage5LLogJson_('testMigrationStage5LInspectSupabaseSchema', result);
  return result;
}


function runMigrationStage5LInspectSupabaseSchema() {
  var startedAt = new Date();

  var result = migrationStage5LBaseResult_('inspect_supabase_schema_read_only');

  var tables = [
    'app_users',
    'patients',
    'service_catalog',
    'migration_row_map',
    'migration_issues'
  ];

  var issues = [];
  var schemaResult = migrationStage5LFetchOpenApiSchema_();

  result.openapi_status = schemaResult.status;

  if (!schemaResult.success) {
    issues.push(migrationStage5LIssue_(
      'error',
      '',
      '',
      '',
      '',
      'OPENAPI_SCHEMA_FETCH_FAILED',
      'Gagal membaca OpenAPI schema Supabase.',
      schemaResult
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var definitions = migrationStage5LExtractOpenApiDefinitions_(schemaResult.body);
  var tableSchemas = {};

  tables.forEach(function(tableName) {
    var tableDef = migrationStage5LFindOpenApiTableDefinition_(definitions, tableName);

    if (!tableDef) {
      tableSchemas[tableName] = {
        found: false,
        columns: [],
        required: []
      };

      issues.push(migrationStage5LIssue_(
        'error',
        tableName,
        '',
        '',
        '',
        'TABLE_SCHEMA_NOT_FOUND_IN_OPENAPI',
        'Schema table tidak ditemukan di OpenAPI: ' + tableName
      ));

      return;
    }

    var properties = tableDef.properties || {};
    var columns = Object.keys(properties).sort();

    tableSchemas[tableName] = {
      found: true,
      column_count: columns.length,
      columns: columns,
      required: tableDef.required || [],
      properties_preview: migrationStage5LPickPropertiesPreview_(properties)
    };
  });

  result.table_schemas = tableSchemas;
  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5LHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5LFetchOpenApiSchema_() {
  var config = migrationStage5LGetConfig_();

  if (!config.url || !config.service_role_key) {
    return {
      success: false,
      status: {
        has_url: !!config.url,
        has_service_role_key: !!config.service_role_key
      },
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
  var body = migrationStage5LParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && body,
    status: {
      http_code: httpCode,
      body_type: body && typeof body,
      has_definitions: !!(body && body.definitions),
      has_components_schemas: !!(body && body.components && body.components.schemas)
    },
    body: body
  };
}


function migrationStage5LExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) {
    return body.definitions;
  }

  if (body.components && body.components.schemas) {
    return body.components.schemas;
  }

  return {};
}


function migrationStage5LFindOpenApiTableDefinition_(definitions, tableName) {
  if (!definitions) return null;

  if (definitions[tableName]) {
    return definitions[tableName];
  }

  if (definitions['public.' + tableName]) {
    return definitions['public.' + tableName];
  }

  var keys = Object.keys(definitions);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (key.toLowerCase() === tableName.toLowerCase()) {
      return definitions[key];
    }

    if (key.toLowerCase() === ('public.' + tableName).toLowerCase()) {
      return definitions[key];
    }
  }

  return null;
}


function migrationStage5LPickPropertiesPreview_(properties) {
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