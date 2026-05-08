/************************************************************
 * MigrationStage5M.gs
 * Tahap 5M — Migrasi appointments ke Supabase staging
 *
 * 5M-A:
 * - Inspect schema appointments Supabase
 * - Inspect source sheet Appointments
 * - Validasi patient row map dari 5L
 * - Belum insert/update/delete
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5M CONFIG
 ************************************************************/

var MIGRATION_STAGE_5M_NAME = '5M';
var MIGRATION_STAGE_5M_WRITE_ENABLED = false;

var MIGRATION_STAGE_5M_SOURCE_SHEET_ALIASES = [
  'Appointments',
  'Appointment',
  'appointments'
];

var MIGRATION_STAGE_5M_TARGET_TABLE = 'appointments';


/************************************************************
 * 5M PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5MInspectSchemaAndSourceLog() {
  var result = runMigrationStage5MInspectSchemaAndSource();
  migrationStage5MLogJson_('testMigrationStage5MInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5MPreflightLog() {
  var result = runMigrationStage5MPreflight();
  migrationStage5MLogJson_('testMigrationStage5MPreflight', result);
  return result;
}

function testMigrationStage5MInsertAppointmentsLog() {
  var result = runMigrationStage5MInsertAppointments();
  migrationStage5MLogJson_('testMigrationStage5MInsertAppointments', result);
  return result;
}


function testMigrationStage5MAuditAppointmentsLog() {
  var result = runMigrationStage5MAuditAppointments();
  migrationStage5MLogJson_('testMigrationStage5MAuditAppointments', result);
  return result;
}


/************************************************************
 * 5M-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5MInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5MBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5MInspectSupabaseTableSchema_(MIGRATION_STAGE_5M_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'APPOINTMENTS_SCHEMA_NOT_FOUND',
      'Schema table appointments tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5MInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var patientMap = migrationStage5MInspectPatientRowMap_();
  result.patient_row_map_status = patientMap.status;

  if (!patientMap.success) {
    issues = issues.concat(patientMap.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5MHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5M PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5MPreflight() {
  var startedAt = new Date();

  var result = migrationStage5MBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5MInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.patient_row_map_status = inspect.patient_row_map_status;

  issues = issues.concat(inspect.issues || []);

  if (inspect.success) {
    var sourceRows = migrationStage5MReadAppointmentSourceRows_();
    result.appointment_source_status = sourceRows.status;

    if (!sourceRows.success) {
      issues = issues.concat(sourceRows.issues || []);
    }

    var targetEmpty = migrationStage5MCheckTargetAppointmentsEmpty_();
    result.target_table_status = targetEmpty.status;
    issues = issues.concat(targetEmpty.issues || []);

    var dryRun = migrationStage5MBuildAppointmentDryRunPayload_();
    result.dry_run_status = dryRun.status;
    result.sample_payloads = dryRun.sample_payloads;
    result.sample_issues = dryRun.sample_issues;

    issues = issues.concat(dryRun.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5MHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5M SOURCE SHEET INSPECTION
 ************************************************************/

function migrationStage5MInspectSourceSheet_() {
  var issues = [];
  var sheet = migrationStage5MFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5MIssue_(
          'error',
          MIGRATION_STAGE_5M_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber Appointments tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5M_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 5);

  return {
    success: migrationStage5MHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: issues.concat(rowsResult.issues || [])
  };
}


function migrationStage5MFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5M_SOURCE_SHEET_ALIASES);
}


function migrationStage5MReadAppointmentSourceRows_() {
  var sheet = migrationStage5MFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      rows: [],
      status: {
        source_sheet: null,
        row_count: 0
      },
      issues: [
        migrationStage5MIssue_(
          'error',
          MIGRATION_STAGE_5M_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber Appointments tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5MHasNoBlockingIssues_(rowsResult.issues || []),
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
 * 5M PATIENT ROW MAP INSPECTION
 ************************************************************/

function migrationStage5MInspectPatientRowMap_() {
  var issues = [];

  var countResult = migrationStage5MCountRows_(
    'migration_row_map',
    'target_table=eq.patients'
  );

  var sampleResult = migrationStage5MRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.patients&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'PATIENT_ROW_MAP_COUNT_FAILED',
      'Gagal membaca jumlah migration_row_map untuk patients.',
      countResult
    ));
  }

  if (!sampleResult.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'PATIENT_ROW_MAP_SAMPLE_FAILED',
      'Gagal membaca sample migration_row_map patients.',
      sampleResult
    ));
  }

  if (countResult.success && countResult.count <= 0) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'PATIENT_ROW_MAP_EMPTY',
      'migration_row_map untuk patients masih kosong. Tahap 5L harus selesai dulu.'
    ));
  }

  return {
    success: migrationStage5MHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      expected_from_5L: 285,
      count: countResult.count,
      count_success: countResult.success,
      sample_success: sampleResult.success,
      sample_rows: Array.isArray(sampleResult.body) ? sampleResult.body : []
    }
  };
}


/************************************************************
 * 5M DRY-RUN APPOINTMENT PAYLOAD
 * Catatan:
 * - Ini belum final insert.
 * - Tujuannya mendeteksi header dan resolve patient_uuid.
 ************************************************************/

function migrationStage5MBuildAppointmentDryRunPayload_() {
  var sourceRows = migrationStage5MReadAppointmentSourceRows_();
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

  var patientMap = migrationStage5MLoadPatientLegacyMap_();

  if (!patientMap.success) {
    issues = issues.concat(patientMap.issues || []);
  }

  var payloads = [];
  var sampleIssues = [];

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var appointmentId = migrationStage5MPick_(raw, [
      'appointment_id',
      'id',
      'appointmentId'
    ]);

    var patientId = migrationStage5MPick_(raw, [
      'patient_id',
      'patientId',
      'legacy_patient_id'
    ]);

    var patientName = migrationStage5MPick_(raw, [
      'patient_name',
      'full_name',
      'nama_pasien',
      'name'
    ]);

    var appointmentDate = migrationStage5MPick_(raw, [
      'appointment_date',
      'date',
      'tanggal'
    ]);

    var appointmentTime = migrationStage5MPick_(raw, [
      'appointment_time',
      'time',
      'jam'
    ]);

    var complaint = migrationStage5MPick_(raw, [
      'complaint',
      'keluhan'
    ]);

    var status = migrationStage5MPick_(raw, [
      'status',
      'appointment_status'
    ]);

    var notes = migrationStage5MPick_(raw, [
      'notes',
      'note',
      'catatan'
    ]);

    var createdAt = migrationStage5MPick_(raw, [
      'created_at',
      'createdAt',
      'created_date'
    ]);

    var updatedAt = migrationStage5MPick_(raw, [
      'updated_at',
      'updatedAt',
      'updated_date'
    ]);

    var patientUuid = patientId ? patientMap.map[migrationNormalizeText_5K_(patientId)] : null;

    var payload = {
      appointment_id: migrationNormalizeText_5K_(appointmentId),
      patient_id: migrationNormalizeText_5K_(patientId),
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      appointment_date: migrationNormalizeDate_5K_(appointmentDate),
      appointment_time: migrationStage5MNormalizeTimeText_(appointmentTime),
      complaint: migrationNormalizeNullableText_5K_(complaint),
      status: migrationNormalizeNullableText_5K_(status),
      notes: migrationNormalizeNullableText_5K_(notes),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5MParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.appointment_id) {
      var missingAppointmentIssue = migrationStage5MIssue_(
        'error',
        MIGRATION_STAGE_5M_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_APPOINTMENT_ID',
        'Appointment tidak memiliki appointment_id.',
        {
          raw: raw
        }
      );

      issues.push(missingAppointmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingAppointmentIssue);
    }

    if (!payload.patient_id) {
      var missingPatientIssue = migrationStage5MIssue_(
        'error',
        MIGRATION_STAGE_5M_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.appointment_id,
        'MISSING_PATIENT_ID',
        'Appointment tidak memiliki patient_id.'
      );

      issues.push(missingPatientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingPatientIssue);
    } else if (!payload.patient_uuid) {
      var missingMapIssue = migrationStage5MIssue_(
        'error',
        MIGRATION_STAGE_5M_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.appointment_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id pada appointment tidak ditemukan di migration_row_map patients.',
        {
          patient_id: payload.patient_id
        }
      );

      issues.push(missingMapIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingMapIssue);
    }

    if (!payload.appointment_date) {
      var missingDateIssue = migrationStage5MIssue_(
        'warning',
        MIGRATION_STAGE_5M_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.appointment_id,
        'APPOINTMENT_DATE_EMPTY',
        'appointment_date kosong.'
      );

      issues.push(missingDateIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingDateIssue);
    }

    payloads.push(payload);
  });

  return {
    success: migrationStage5MHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      patient_map_count: patientMap.count || 0,
      blocking_issue_count: migrationStage5MCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5MCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 5),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5MLoadPatientLegacyMap_() {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5MRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.patients&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5MIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'LOAD_PATIENT_ROW_MAP_FAILED',
        'Gagal load migration_row_map patients.',
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
    success: migrationStage5MHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


/************************************************************
 * 5M SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5MInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5MFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5MExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5MFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5MPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5MFetchOpenApiSchema_() {
  var config = migrationStage5MGetConfig_();

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
  var body = migrationStage5MParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5MExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) {
    return body.definitions;
  }

  if (body.components && body.components.schemas) {
    return body.components.schemas;
  }

  return {};
}


function migrationStage5MFindOpenApiTableDefinition_(definitions, tableName) {
  if (!definitions) return null;

  if (definitions[tableName]) return definitions[tableName];
  if (definitions['public.' + tableName]) return definitions['public.' + tableName];

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


function migrationStage5MPickPropertiesPreview_(properties) {
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
 * 5M SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5MGetConfig_() {
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


function migrationStage5MRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5MGetConfig_();

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
  var parsedBody = migrationStage5MParseJsonSafely_(text);
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


function migrationStage5MCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5MRequest_(
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

  var count = migrationStage5MParseCountFromContentRange_(contentRange);

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

function runMigrationStage5MInsertAppointments() {
  var startedAt = new Date();

  var result = migrationStage5MBaseResult_('insert_appointments_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5M_WRITE_ENABLED !== true) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5M_WRITE_ENABLED masih false. Jalankan preflight dulu. Jika clean, ubah menjadi true hanya untuk insert appointments staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5M sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5MPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      appointment_source_status: preflight.appointment_source_status || null,
      target_table_status: preflight.target_table_status || null,
      dry_run_status: preflight.dry_run_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5MIssue_(
        'error',
        MIGRATION_STAGE_5M_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5M belum clean. Insert appointments dibatalkan.',
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

    var dryRun = migrationStage5MBuildAppointmentDryRunPayload_();

    if (!migrationStage5MHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5MInsertRows_(
      MIGRATION_STAGE_5M_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5MIssue_(
        'error',
        MIGRATION_STAGE_5M_TARGET_TABLE,
        '',
        '',
        '',
        'APPOINTMENTS_INSERT_FAILED',
        'Insert appointments ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5MBuildAppointmentRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5MInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5MIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'APPOINTMENT_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map appointments gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5MBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5MInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5MIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5M gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5MAuditAppointments();

    result.inserted_summary = {
      appointments: {
        target_table: MIGRATION_STAGE_5M_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5MHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
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


function runMigrationStage5MAuditAppointments() {
  var startedAt = new Date();

  var result = migrationStage5MBaseResult_('audit_appointments_read_only');
  var issues = [];

  var sourceRows = migrationStage5MReadAppointmentSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5MCountRows_(MIGRATION_STAGE_5M_TARGET_TABLE);
  var rowMapCount = migrationStage5MCountRows_(
    'migration_row_map',
    'target_table=eq.appointments'
  );
  var nullPatientUuidCount = migrationStage5MCountRows_(
    MIGRATION_STAGE_5M_TARGET_TABLE,
    'patient_uuid=is.null'
  );

  if (!supabaseCount.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'APPOINTMENTS_COUNT_FAILED',
      'Gagal menghitung row appointments Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'APPOINTMENT_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map appointments.',
      rowMapCount
    ));
  }

  if (!nullPatientUuidCount.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'NULL_PATIENT_UUID_COUNT_FAILED',
      'Gagal menghitung appointment dengan patient_uuid kosong.',
      nullPatientUuidCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'APPOINTMENTS_COUNT_MISMATCH',
      'Jumlah appointments Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'APPOINTMENT_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map appointments tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullPatientUuidCount.success && nullPatientUuidCount.count !== 0) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'APPOINTMENT_NULL_PATIENT_UUID_FOUND',
      'Ada appointments dengan patient_uuid kosong.',
      {
        null_patient_uuid_count: nullPatientUuidCount.count
      }
    ));
  }

  result.audit_status = {
    appointments: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_patient_uuid_count: nullPatientUuidCount.count
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5MHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5MCheckTargetAppointmentsEmpty_() {
  var issues = [];

  var appointmentCount = migrationStage5MCountRows_(MIGRATION_STAGE_5M_TARGET_TABLE);
  var rowMapCount = migrationStage5MCountRows_(
    'migration_row_map',
    'target_table=eq.appointments'
  );

  var status = {
    appointments_count: appointmentCount.count,
    appointments_count_success: appointmentCount.success,
    appointment_row_map_count: rowMapCount.count,
    appointment_row_map_count_success: rowMapCount.success
  };

  if (!appointmentCount.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'APPOINTMENTS_COUNT_FAILED',
      'Gagal menghitung table appointments.',
      appointmentCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'APPOINTMENT_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map appointments.',
      rowMapCount
    ));
  }

  if (appointmentCount.success && appointmentCount.count !== 0) {
    issues.push(migrationStage5MIssue_(
      'error',
      MIGRATION_STAGE_5M_TARGET_TABLE,
      '',
      '',
      '',
      'APPOINTMENTS_TARGET_NOT_EMPTY',
      'Table appointments staging tidak kosong. Insert 5M awal dibatalkan untuk mencegah duplikasi.',
      {
        count: appointmentCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5MIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'APPOINTMENT_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk appointments sudah ada. Insert 5M awal dibatalkan untuk mencegah duplikasi.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5MHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


function migrationStage5MBuildAppointmentRowMapRows_(insertedRows) {
  var now = migrationStage5MNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.appointment_id,
      target_table: MIGRATION_STAGE_5M_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5M_NAME + '; source_table=Appointments',
      created_at: now
    };
  });
}


function migrationStage5MBuildMigrationIssueRows_(issues) {
  var now = migrationStage5MNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: '',
      message: '[' + MIGRATION_STAGE_5M_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5M_NAME,
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


function migrationStage5MInsertRows_(tableName, rows) {
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

    var response = migrationStage5MRequest_(
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
 * 5M GENERIC UTILITIES
 ************************************************************/

function migrationStage5MBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5MNowIso_(),
    stage: MIGRATION_STAGE_5M_NAME,
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


function migrationStage5MIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5MHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') {
      return false;
    }
  }

  return true;
}


function migrationStage5MCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}


function migrationStage5MPick_(raw, candidates) {
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


function migrationStage5MParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5MParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5MNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5MGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5MGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5MLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}

function migrationStage5MNormalizeTimeText_(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, migrationStage5MGetTimezone_(), 'HH:mm');
  }

  var text = String(value).trim();

  if (!text) return null;

  var parsed = new Date(text);

  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, migrationStage5MGetTimezone_(), 'HH:mm');
  }

  var match = text.match(/^(\d{1,2})[:.](\d{1,2})/);

  if (match) {
    var hour = String(match[1]).padStart(2, '0');
    var minute = String(match[2]).padStart(2, '0');
    return hour + ':' + minute;
  }

  return text;
}