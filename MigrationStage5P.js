/************************************************************
 * MigrationStage5P.gs
 * Tahap 5P — Migrasi medical_records dan patient_photos
 *
 * 5P-A:
 * - Inspect schema medical_records Supabase
 * - Inspect schema patient_photos Supabase
 * - Inspect source sheet MedicalRecords
 * - Inspect source sheet PatientPhotos
 * - Validasi row_map patients, appointments, treatments
 * - Cek target staging masih kosong
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5P CONFIG
 ************************************************************/

var MIGRATION_STAGE_5P_NAME = '5P';
var MIGRATION_STAGE_5P_WRITE_ENABLED = false;

var MIGRATION_STAGE_5P_TARGET_TABLES = {
  medical_records: {
    target_table: 'medical_records',
    source_sheet_aliases: [
      'MedicalRecords',
      'Medical Records',
      'Medical_Records',
      'medical_records'
    ]
  },

  patient_photos: {
    target_table: 'patient_photos',
    source_sheet_aliases: [
      'PatientPhotos',
      'Patient Photos',
      'Patient_Photos',
      'patient_photos'
    ]
  }
};


/************************************************************
 * 5P PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5PInspectSchemaAndSourceLog() {
  var result = runMigrationStage5PInspectSchemaAndSource();
  migrationStage5PLogJson_('testMigrationStage5PInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5PPreflightLog() {
  var result = runMigrationStage5PPreflight();
  migrationStage5PLogJson_('testMigrationStage5PPreflight', result);
  return result;
}

function testMigrationStage5PDryRunPayloadLog() {
  var result = runMigrationStage5PDryRunPayload();
  migrationStage5PLogJson_('testMigrationStage5PDryRunPayload', result);
  return result;
}

function testMigrationStage5PInsertMedicalRecordsAndPhotosLog() {
  var result = runMigrationStage5PInsertMedicalRecordsAndPhotos();
  migrationStage5PLogJson_('testMigrationStage5PInsertMedicalRecordsAndPhotos', result);
  return result;
}


function testMigrationStage5PAuditMedicalRecordsAndPhotosLog() {
  var result = runMigrationStage5PAuditMedicalRecordsAndPhotos();
  migrationStage5PLogJson_('testMigrationStage5PAuditMedicalRecordsAndPhotos', result);
  return result;
}


/************************************************************
 * 5P-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5PInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5PBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schemas = migrationStage5PInspectAllTargetSchemas_();
  result.supabase_schemas = schemas.schemas;
  issues = issues.concat(schemas.issues || []);

  var sources = migrationStage5PInspectAllSourceSheets_();
  result.source_sheets = sources.source_sheets;
  issues = issues.concat(sources.issues || []);

  var rowMaps = migrationStage5PInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;
  issues = issues.concat(rowMaps.issues || []);

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5PHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5P PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5PPreflight() {
  var startedAt = new Date();

  var result = migrationStage5PBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5PInspectSchemaAndSource();

  result.supabase_schemas = inspect.supabase_schemas;
  result.source_sheets = inspect.source_sheets;
  result.row_map_status = inspect.row_map_status;

  issues = issues.concat(inspect.issues || []);

  var sourceStatus = migrationStage5PReadAllSourceRowsStatus_();
  result.source_row_status = sourceStatus.status;
  issues = issues.concat(sourceStatus.issues || []);

  var targetStatus = migrationStage5PCheckTargetsEmpty_();
  result.target_table_status = targetStatus.status;
  issues = issues.concat(targetStatus.issues || []);

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5PHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5P SCHEMA INSPECT
 ************************************************************/

function migrationStage5PInspectAllTargetSchemas_() {
  var issues = [];
  var schemas = {};

  Object.keys(MIGRATION_STAGE_5P_TARGET_TABLES).forEach(function(key) {
    var targetTable = MIGRATION_STAGE_5P_TARGET_TABLES[key].target_table;
    var schema = migrationStage5PInspectSupabaseTableSchema_(targetTable);

    schemas[key] = schema.schema;

    if (!schema.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'TARGET_SCHEMA_NOT_FOUND',
        'Schema table ' + targetTable + ' tidak ditemukan di Supabase OpenAPI.',
        schema
      ));
    }
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    schemas: schemas,
    issues: issues
  };
}


function migrationStage5PInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5PFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5PExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5PFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5PPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5PFetchOpenApiSchema_() {
  var config = migrationStage5PGetConfig_();

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
  var body = migrationStage5PParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5PExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5PFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5PPickPropertiesPreview_(properties) {
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
 * 5P SOURCE SHEET INSPECT
 ************************************************************/

function migrationStage5PInspectAllSourceSheets_() {
  var issues = [];
  var sourceSheets = {};

  Object.keys(MIGRATION_STAGE_5P_TARGET_TABLES).forEach(function(key) {
    var cfg = MIGRATION_STAGE_5P_TARGET_TABLES[key];
    var source = migrationStage5PInspectSourceSheet_(key, cfg);

    sourceSheets[key] = source.source_sheet;
    issues = issues.concat(source.issues || []);
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    source_sheets: sourceSheets,
    issues: issues
  };
}


function migrationStage5PInspectSourceSheet_(key, cfg) {
  var sheet = migrationStage5PFindSourceSheet_(cfg.source_sheet_aliases);

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5PIssue_(
          'error',
          cfg.target_table,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber untuk ' + cfg.target_table + ' tidak ditemukan.',
          {
            aliases: cfg.source_sheet_aliases
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 10);

  return {
    success: migrationStage5PHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      target_table: cfg.target_table,
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5PFindSourceSheet_(aliases) {
  return migrationFindSheetByAliases_5K_(aliases);
}


function migrationStage5PReadSourceRows_(key) {
  var cfg = MIGRATION_STAGE_5P_TARGET_TABLES[key];

  if (!cfg) {
    return {
      success: false,
      rows: [],
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        non_blank_payload_row_count: 0
      },
      issues: [
        migrationStage5PIssue_(
          'error',
          '',
          '',
          '',
          '',
          'UNKNOWN_SOURCE_KEY',
          'Source key tidak dikenal: ' + key
        )
      ]
    };
  }

  var sheet = migrationStage5PFindSourceSheet_(cfg.source_sheet_aliases);

  if (!sheet) {
    return {
      success: false,
      rows: [],
      status: {
        source_sheet: null,
        target_table: cfg.target_table,
        spreadsheet_row_count: 0,
        non_blank_payload_row_count: 0
      },
      issues: [
        migrationStage5PIssue_(
          'error',
          cfg.target_table,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber untuk ' + cfg.target_table + ' tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5PHasNoBlockingIssues_(rowsResult.issues || []),
    rows: rowsResult.rows || [],
    headers: rowsResult.headers || [],
    status: {
      source_sheet: sheet.getName(),
      target_table: cfg.target_table,
      spreadsheet_row_count: rowsResult.row_count_total || 0,
      non_blank_payload_row_count: rowsResult.rows ? rowsResult.rows.length : 0,
      header_count: rowsResult.headers ? rowsResult.headers.length : 0
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5PReadAllSourceRowsStatus_() {
  var issues = [];
  var status = {};

  Object.keys(MIGRATION_STAGE_5P_TARGET_TABLES).forEach(function(key) {
    var rowsResult = migrationStage5PReadSourceRows_(key);

    status[key] = rowsResult.status;
    issues = issues.concat(rowsResult.issues || []);
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5P ROW MAP INSPECTION
 ************************************************************/

function migrationStage5PInspectRequiredRowMaps_() {
  var issues = [];

  var patients = migrationStage5PInspectRowMapByTarget_('patients', 285);
  var appointments = migrationStage5PInspectRowMapByTarget_('appointments', 284);
  var treatments = migrationStage5PInspectRowMapByTarget_('treatments', 254);

  issues = issues
    .concat(patients.issues || [])
    .concat(appointments.issues || [])
    .concat(treatments.issues || []);

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      patients: patients.status,
      appointments: appointments.status,
      treatments: treatments.status
    }
  };
}


function migrationStage5PInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5PCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5PRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5PIssue_(
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
    issues.push(migrationStage5PIssue_(
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
    issues.push(migrationStage5PIssue_(
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
    success: migrationStage5PHasNoBlockingIssues_(issues),
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
 * 5P-B DRY-RUN PAYLOAD — READ ONLY
 ************************************************************/

function runMigrationStage5PDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5PBaseResult_('dry_run_payload_read_only');

  var dryRun = migrationStage5PBuildDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5PHasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5PBuildDryRunPayload_() {
  var issues = [];

  var patientMap = migrationStage5PLoadLegacyMap_('patients');
  var appointmentMap = migrationStage5PLoadLegacyMap_('appointments');
  var treatmentMap = migrationStage5PLoadLegacyMap_('treatments');
  var treatmentMeta = migrationStage5PLoadTreatmentMeta_();
  var userNameMap = migrationStage5PLoadAppUsersByName_();

  issues = issues
    .concat(patientMap.issues || [])
    .concat(appointmentMap.issues || [])
    .concat(treatmentMap.issues || [])
    .concat(treatmentMeta.issues || [])
    .concat(userNameMap.issues || []);

  var medical = migrationStage5PBuildMedicalRecordsPayload_(
    patientMap,
    appointmentMap,
    treatmentMap,
    userNameMap
  );

  var photos = migrationStage5PBuildPatientPhotosPayload_(
    patientMap,
    appointmentMap,
    treatmentMap,
    treatmentMeta
  );

  issues = issues
    .concat(medical.issues || [])
    .concat(photos.issues || []);

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    status: {
      medical_records: medical.status,
      patient_photos: photos.status,
      parent_maps: {
        patients: patientMap.count || 0,
        appointments: appointmentMap.count || 0,
        treatments: treatmentMap.count || 0,
        treatment_meta: treatmentMeta.count || 0,
        app_users_by_name: userNameMap.count || 0
      },
      blocking_issue_count: migrationStage5PCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5PCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: {
      medical_records: medical.payloads || [],
      patient_photos: photos.payloads || []
    },
    sample_payloads: {
      medical_records: (medical.payloads || []).slice(0, 5),
      patient_photos: (photos.payloads || []).slice(0, 5)
    },
    sample_issues: []
      .concat(medical.sample_issues || [])
      .concat(photos.sample_issues || [])
      .slice(0, 20),
    issues: issues
  };
}


function migrationStage5PBuildMedicalRecordsPayload_(patientMap, appointmentMap, treatmentMap, userNameMap) {
  var sourceRows = migrationStage5PReadSourceRows_('medical_records');
  var issues = [];
  var sampleIssues = [];
  var payloads = [];

  if (!sourceRows.success) {
    return {
      success: false,
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        mapped_count: 0,
        missing_parent_count: 0
      },
      payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var mappedCount = 0;
  var missingParentCount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var recordId = migrationStage5PPick_(raw, ['record_id', 'id']);
    var patientId = migrationStage5PPick_(raw, ['patient_id', 'patientId']);
    var patientName = migrationStage5PPick_(raw, ['patient_name', 'name', 'full_name']);
    var appointmentId = migrationStage5PPick_(raw, ['appointment_id', 'appointmentId']);
    var treatmentId = migrationStage5PPick_(raw, ['treatment_id', 'treatmentId']);
    var doctorName = migrationStage5PPick_(raw, ['doctor_name', 'doctor', 'dokter']);
    var visitDate = migrationStage5PPick_(raw, ['visit_date', 'date', 'tanggal']);
    var chiefComplaint = migrationStage5PPick_(raw, ['chief_complaint', 'complaint', 'keluhan']);
    var diagnosis = migrationStage5PPick_(raw, ['diagnosis', 'diagnosa']);
    var clinicalNotes = migrationStage5PPick_(raw, ['clinical_notes', 'notes', 'note', 'catatan']);
    var createdAt = migrationStage5PPick_(raw, ['created_at', 'createdAt', 'created_date']);

    var normalizedRecordId = migrationNormalizeText_5K_(recordId);
    var normalizedPatientId = migrationNormalizeText_5K_(patientId);
    var normalizedAppointmentId = migrationNormalizeNullableText_5K_(appointmentId);
    var normalizedTreatmentId = migrationNormalizeNullableText_5K_(treatmentId);
    var normalizedDoctorName = migrationNormalizeNullableText_5K_(doctorName);

    var doctorByName = normalizedDoctorName
      ? userNameMap.map[migrationStage5PNormalizeNameKey_(normalizedDoctorName)]
      : null;

    var patientUuid = normalizedPatientId ? patientMap.map[normalizedPatientId] : null;
    var appointmentUuid = normalizedAppointmentId ? appointmentMap.map[normalizedAppointmentId] : null;
    var treatmentUuid = normalizedTreatmentId ? treatmentMap.map[normalizedTreatmentId] : null;

    var payload = {
      record_id: normalizedRecordId,
      patient_id: normalizedPatientId,
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      appointment_id: normalizedAppointmentId,
      appointment_uuid: appointmentUuid,
      treatment_id: normalizedTreatmentId,
      treatment_uuid: treatmentUuid,
      doctor_name: normalizedDoctorName,
      doctor_user_id: doctorByName ? doctorByName.user_id : null,
      doctor_user_uuid: doctorByName ? doctorByName.id : null,
      visit_date: migrationNormalizeDate_5K_(visitDate),
      chief_complaint: migrationNormalizeNullableText_5K_(chiefComplaint),
      diagnosis: migrationNormalizeNullableText_5K_(diagnosis),
      clinical_notes: migrationNormalizeNullableText_5K_(clinicalNotes),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5PParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    var rowMissingParent = false;

    if (!payload.record_id) {
      var missingRecordIssue = migrationStage5PIssue_(
        'error',
        'medical_records',
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_RECORD_ID',
        'Medical record tidak memiliki record_id.',
        { raw: raw }
      );

      issues.push(missingRecordIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingRecordIssue);
    }

    if (!payload.patient_id || !payload.patient_uuid) {
      rowMissingParent = true;

      var patientIssue = migrationStage5PIssue_(
        'error',
        'medical_records',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.record_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id medical_records tidak ditemukan di migration_row_map patients.',
        { patient_id: payload.patient_id }
      );

      issues.push(patientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(patientIssue);
    }

    if (payload.appointment_id && !payload.appointment_uuid) {
      rowMissingParent = true;

      var appointmentIssue = migrationStage5PIssue_(
        'error',
        'medical_records',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.record_id,
        'APPOINTMENT_PARENT_NOT_MAPPED',
        'appointment_id medical_records tidak ditemukan di migration_row_map appointments.',
        { appointment_id: payload.appointment_id }
      );

      issues.push(appointmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(appointmentIssue);
    }

    if (payload.treatment_id && !payload.treatment_uuid) {
      rowMissingParent = true;

      var treatmentIssue = migrationStage5PIssue_(
        'error',
        'medical_records',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.record_id,
        'TREATMENT_PARENT_NOT_MAPPED',
        'treatment_id medical_records tidak ditemukan di migration_row_map treatments.',
        { treatment_id: payload.treatment_id }
      );

      issues.push(treatmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(treatmentIssue);
    }

    if (payload.doctor_name && !payload.doctor_user_uuid) {
      var doctorIssue = migrationStage5PIssue_(
        'warning',
        'medical_records',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.record_id,
        'DOCTOR_NAME_NOT_MAPPED',
        'doctor_name medical_records tidak berhasil dicocokkan ke app_users.full_name.',
        { doctor_name: payload.doctor_name }
      );

      issues.push(doctorIssue);
      if (sampleIssues.length < 10) sampleIssues.push(doctorIssue);
    }

    if (rowMissingParent) {
      missingParentCount++;
    } else {
      mappedCount++;
    }

    payloads.push(payload);
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      mapped_count: mappedCount,
      missing_parent_count: missingParentCount
    },
    payloads: payloads,
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5PBuildPatientPhotosPayload_(patientMap, appointmentMap, treatmentMap, treatmentMeta) {
  var sourceRows = migrationStage5PReadSourceRows_('patient_photos');
  var issues = [];
  var sampleIssues = [];
  var payloads = [];

  if (!sourceRows.success) {
    return {
      success: false,
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        mapped_count: 0,
        missing_parent_count: 0
      },
      payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var mappedCount = 0;
  var missingParentCount = 0;
  var derivedAppointmentCount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var photoId = migrationStage5PPick_(raw, ['photo_id', 'id']);
    var patientId = migrationStage5PPick_(raw, ['patient_id', 'patientId']);
    var patientName = migrationStage5PPick_(raw, ['patient_name', 'name', 'full_name']);
    var treatmentId = migrationStage5PPick_(raw, ['treatment_id', 'treatmentId']);
    var photoType = migrationStage5PPick_(raw, ['photo_type', 'type']);
    var fileName = migrationStage5PPick_(raw, ['file_name', 'filename', 'name']);
    var fileUrl = migrationStage5PPick_(raw, ['file_url', 'url']);
    var fileDriveId = migrationStage5PPick_(raw, ['file_drive_id', 'file_id', 'drive_id']);
    var photoNote = migrationStage5PPick_(raw, ['photo_note', 'notes', 'note']);
    var createdAt = migrationStage5PPick_(raw, ['created_at', 'createdAt', 'created_date']);
    var updatedAt = migrationStage5PPick_(raw, ['updated_at', 'updatedAt', 'updated_date']);

    var normalizedPhotoId = migrationNormalizeText_5K_(photoId);
    var normalizedPatientId = migrationNormalizeText_5K_(patientId);
    var normalizedTreatmentId = migrationNormalizeNullableText_5K_(treatmentId);

    var treatmentInfo = normalizedTreatmentId ? treatmentMeta.map[normalizedTreatmentId] : null;

    var patientUuid = normalizedPatientId ? patientMap.map[normalizedPatientId] : null;
    var treatmentUuid = normalizedTreatmentId ? treatmentMap.map[normalizedTreatmentId] : null;

    var appointmentId = treatmentInfo ? treatmentInfo.appointment_id : null;
    var appointmentUuid = treatmentInfo ? treatmentInfo.appointment_uuid : null;

    if (appointmentId || appointmentUuid) {
      derivedAppointmentCount++;
    }

    var payload = {
      photo_id: normalizedPhotoId,
      patient_id: normalizedPatientId,
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      appointment_id: appointmentId,
      appointment_uuid: appointmentUuid,
      treatment_id: normalizedTreatmentId,
      treatment_uuid: treatmentUuid,
      photo_type: migrationNormalizeNullableText_5K_(photoType),
      file_name: migrationNormalizeNullableText_5K_(fileName),
      file_url: migrationNormalizeNullableText_5K_(fileUrl),
      thumbnail_url: migrationNormalizeNullableText_5K_(fileUrl),
      file_id: migrationNormalizeNullableText_5K_(fileDriveId),
      mime_type: migrationStage5PGuessMimeTypeFromFileName_(fileName),
      file_size: null,
      notes: migrationNormalizeNullableText_5K_(photoNote),
      uploaded_at: migrationNormalizeTimestamp_5K_(createdAt),
      uploaded_by: null,
      uploaded_by_uuid: null,
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5PParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    var rowMissingParent = false;

    if (!payload.photo_id) {
      var missingPhotoIssue = migrationStage5PIssue_(
        'error',
        'patient_photos',
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_PHOTO_ID',
        'Patient photo tidak memiliki photo_id.',
        { raw: raw }
      );

      issues.push(missingPhotoIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingPhotoIssue);
    }

    if (!payload.patient_id || !payload.patient_uuid) {
      rowMissingParent = true;

      var patientIssue = migrationStage5PIssue_(
        'error',
        'patient_photos',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.photo_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id patient_photos tidak ditemukan di migration_row_map patients.',
        { patient_id: payload.patient_id }
      );

      issues.push(patientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(patientIssue);
    }

    if (payload.treatment_id && !payload.treatment_uuid) {
      rowMissingParent = true;

      var treatmentIssue = migrationStage5PIssue_(
        'error',
        'patient_photos',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.photo_id,
        'TREATMENT_PARENT_NOT_MAPPED',
        'treatment_id patient_photos tidak ditemukan di migration_row_map treatments.',
        { treatment_id: payload.treatment_id }
      );

      issues.push(treatmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(treatmentIssue);
    }

    if (rowMissingParent) {
      missingParentCount++;
    } else {
      mappedCount++;
    }

    payloads.push(payload);
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      mapped_count: mappedCount,
      missing_parent_count: missingParentCount,
      derived_appointment_from_treatment_count: derivedAppointmentCount
    },
    payloads: payloads,
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5PLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5PRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5PIssue_(
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
    success: migrationStage5PHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5PLoadTreatmentMeta_() {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5PRequest_(
      'get',
      'treatments',
      'select=id,treatment_id,patient_id,patient_uuid,appointment_id,appointment_uuid&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        'treatments',
        '',
        '',
        '',
        'LOAD_TREATMENT_META_FAILED',
        'Gagal load treatment meta.',
        response
      ));

      break;
    }

    var rows = Array.isArray(response.body) ? response.body : [];

    rows.forEach(function(row) {
      if (row.treatment_id) {
        map[row.treatment_id] = {
          id: row.id,
          treatment_id: row.treatment_id,
          patient_id: row.patient_id,
          patient_uuid: row.patient_uuid,
          appointment_id: row.appointment_id,
          appointment_uuid: row.appointment_uuid
        };
      }
    });

    if (rows.length < pageSize) {
      keepGoing = false;
    } else {
      offset += pageSize;
    }
  }

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5PLoadAppUsersByName_() {
  var issues = [];
  var map = {};

  var response = migrationStage5PRequest_(
    'get',
    'app_users',
    'select=id,user_id,full_name,role&limit=1000',
    null,
    {}
  );

  if (!response.success) {
    issues.push(migrationStage5PIssue_(
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
    var key = migrationStage5PNormalizeNameKey_(row.full_name);

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


function migrationStage5PPick_(raw, candidates) {
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


function migrationStage5PNormalizeNameKey_(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.\s+/g, '.');
}


function migrationStage5PGuessMimeTypeFromFileName_(fileName) {
  var text = migrationNormalizeText_5K_(fileName).toLowerCase();

  if (!text) return null;

  if (text.endsWith('.jpg') || text.endsWith('.jpeg')) return 'image/jpeg';
  if (text.endsWith('.png')) return 'image/png';
  if (text.endsWith('.webp')) return 'image/webp';
  if (text.endsWith('.gif')) return 'image/gif';

  return null;
}


function migrationStage5PCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

/************************************************************
 * 5P-C INSERT + AUDIT
 ************************************************************/

function runMigrationStage5PInsertMedicalRecordsAndPhotos() {
  var startedAt = new Date();

  var result = migrationStage5PBaseResult_('insert_medical_records_and_patient_photos_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5P_WRITE_ENABLED !== true) {
    issues.push(migrationStage5PIssue_(
      'error',
      '',
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5P_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert 5P staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5PIssue_(
      'error',
      '',
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5P sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5PPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      source_row_status: preflight.source_row_status || null,
      target_table_status: preflight.target_table_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        '',
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5P belum clean. Insert dibatalkan.',
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

    var targetEmpty = migrationStage5PCheckTargetsEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5PBuildDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5PHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var medicalRows = dryRun.payloads.medical_records || [];
    var photoRows = dryRun.payloads.patient_photos || [];

    var medicalInsert = migrationStage5PInsertRows_('medical_records', medicalRows);

    if (!medicalInsert.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        'medical_records',
        '',
        '',
        '',
        'MEDICAL_RECORDS_INSERT_FAILED',
        'Insert medical_records ke Supabase staging gagal.',
        medicalInsert
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var medicalRowMapRows = migrationStage5PBuildRowMapRows_(
      'medical_records',
      medicalInsert.rows || []
    );

    var medicalRowMapInsert = migrationStage5PInsertRows_(
      'migration_row_map',
      medicalRowMapRows
    );

    if (!medicalRowMapInsert.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'MEDICAL_RECORDS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map medical_records gagal.',
        medicalRowMapInsert
      ));
    }

    var photosInsert = migrationStage5PInsertRows_('patient_photos', photoRows);

    if (!photosInsert.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        'patient_photos',
        '',
        '',
        '',
        'PATIENT_PHOTOS_INSERT_FAILED',
        'Insert patient_photos ke Supabase staging gagal.',
        photosInsert
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var photoRowMapRows = migrationStage5PBuildRowMapRows_(
      'patient_photos',
      photosInsert.rows || []
    );

    var photoRowMapInsert = migrationStage5PInsertRows_(
      'migration_row_map',
      photoRowMapRows
    );

    if (!photoRowMapInsert.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'PATIENT_PHOTOS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map patient_photos gagal.',
        photoRowMapInsert
      ));
    }

    var issueRows = migrationStage5PBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5PInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5PIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5P gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5PAuditMedicalRecordsAndPhotos();

    result.inserted_summary = {
      medical_records: {
        target_table: 'medical_records',
        inserted_count: medicalInsert.rows ? medicalInsert.rows.length : 0
      },
      patient_photos: {
        target_table: 'patient_photos',
        inserted_count: photosInsert.rows ? photosInsert.rows.length : 0
      }
    };

    result.row_map_inserted_count = {
      medical_records: medicalRowMapInsert.rows ? medicalRowMapInsert.rows.length : 0,
      patient_photos: photoRowMapInsert.rows ? photoRowMapInsert.rows.length : 0
    };

    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5PHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5PIssue_(
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


function runMigrationStage5PAuditMedicalRecordsAndPhotos() {
  var startedAt = new Date();

  var result = migrationStage5PBaseResult_('audit_medical_records_and_patient_photos_read_only');
  var issues = [];

  var medicalSource = migrationStage5PReadSourceRows_('medical_records');
  var photosSource = migrationStage5PReadSourceRows_('patient_photos');

  var medicalSourceCount = medicalSource.status ? medicalSource.status.non_blank_payload_row_count : 0;
  var photosSourceCount = photosSource.status ? photosSource.status.non_blank_payload_row_count : 0;

  if (!medicalSource.success) issues = issues.concat(medicalSource.issues || []);
  if (!photosSource.success) issues = issues.concat(photosSource.issues || []);

  var medicalAudit = migrationStage5PAuditSingleTable_(
    'medical_records',
    medicalSourceCount,
    {
      patient_uuid: true,
      appointment_uuid: true,
      treatment_uuid: true,
      doctor_user_uuid: true
    }
  );

  var photoAudit = migrationStage5PAuditSingleTable_(
    'patient_photos',
    photosSourceCount,
    {
      patient_uuid: true,
      appointment_uuid: true,
      treatment_uuid: true,
      uploaded_by_uuid: false
    }
  );

  issues = issues
    .concat(medicalAudit.issues || [])
    .concat(photoAudit.issues || []);

  result.audit_status = {
    medical_records: medicalAudit.status,
    patient_photos: photoAudit.status
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5PHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5PAuditSingleTable_(targetTable, spreadsheetCount, uuidChecks) {
  var issues = [];

  var supabaseCount = migrationStage5PCountRows_(targetTable);
  var rowMapCount = migrationStage5PCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var status = {
    spreadsheet_count: spreadsheetCount,
    supabase_count: supabaseCount.count,
    migration_row_map_count: rowMapCount.count
  };

  if (!supabaseCount.success) {
    issues.push(migrationStage5PIssue_(
      'error',
      targetTable,
      '',
      '',
      '',
      'TARGET_COUNT_FAILED',
      'Gagal menghitung row ' + targetTable + '.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5PIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map untuk ' + targetTable + '.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5PIssue_(
      'error',
      targetTable,
      '',
      '',
      '',
      'TARGET_COUNT_MISMATCH',
      'Jumlah source dan Supabase tidak sama untuk ' + targetTable + '.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5PIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map tidak sama dengan source untuk ' + targetTable + '.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  Object.keys(uuidChecks || {}).forEach(function(columnName) {
    var mustBePresent = uuidChecks[columnName] === true;

    var nullCount = migrationStage5PCountRows_(
      targetTable,
      columnName + '=is.null'
    );

    status['null_' + columnName + '_count'] = nullCount.count;

    if (!nullCount.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'NULL_UUID_COUNT_FAILED',
        'Gagal menghitung null ' + columnName + ' pada ' + targetTable + '.',
        nullCount
      ));

      return;
    }

    if (mustBePresent && nullCount.count !== 0) {
      issues.push(migrationStage5PIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'NULL_REQUIRED_UUID_FOUND',
        'Ada row ' + targetTable + ' dengan ' + columnName + ' kosong.',
        {
          column: columnName,
          null_count: nullCount.count
        }
      ));
    }
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


function migrationStage5PBuildRowMapRows_(targetTable, insertedRows) {
  var now = migrationStage5PNowIso_();

  return (insertedRows || []).map(function(row) {
    var legacyId = '';

    if (targetTable === 'medical_records') {
      legacyId = row.record_id;
    } else if (targetTable === 'patient_photos') {
      legacyId = row.photo_id;
    }

    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: legacyId,
      target_table: targetTable,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5P_NAME,
      created_at: now
    };
  });
}


function migrationStage5PBuildMigrationIssueRows_(issues) {
  var now = migrationStage5PNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: '',
      message: '[' + MIGRATION_STAGE_5P_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5P_NAME,
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


function migrationStage5PInsertRows_(tableName, rows) {
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

    var response = migrationStage5PRequest_(
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
 * 5P TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5PCheckTargetsEmpty_() {
  var issues = [];
  var status = {};

  Object.keys(MIGRATION_STAGE_5P_TARGET_TABLES).forEach(function(key) {
    var targetTable = MIGRATION_STAGE_5P_TARGET_TABLES[key].target_table;

    var targetCount = migrationStage5PCountRows_(targetTable);
    var rowMapCount = migrationStage5PCountRows_(
      'migration_row_map',
      'target_table=eq.' + encodeURIComponent(targetTable)
    );

    status[key] = {
      target_table: targetTable,
      target_count: targetCount.count,
      target_count_success: targetCount.success,
      row_map_count: rowMapCount.count,
      row_map_count_success: rowMapCount.success
    };

    if (!targetCount.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'TARGET_COUNT_FAILED',
        'Gagal menghitung table ' + targetTable + '.',
        targetCount
      ));
    }

    if (!rowMapCount.success) {
      issues.push(migrationStage5PIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'TARGET_ROW_MAP_COUNT_FAILED',
        'Gagal menghitung migration_row_map untuk ' + targetTable + '.',
        rowMapCount
      ));
    }

    if (targetCount.success && targetCount.count !== 0) {
      issues.push(migrationStage5PIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'TARGET_TABLE_NOT_EMPTY',
        'Table ' + targetTable + ' staging tidak kosong. Insert awal 5P harus ditahan agar tidak duplikat.',
        {
          count: targetCount.count
        }
      ));
    }

    if (rowMapCount.success && rowMapCount.count !== 0) {
      issues.push(migrationStage5PIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'TARGET_ROW_MAP_NOT_EMPTY',
        'migration_row_map untuk ' + targetTable + ' sudah ada. Insert awal 5P harus ditahan agar tidak duplikat.',
        {
          target_table: targetTable,
          count: rowMapCount.count
        }
      ));
    }
  });

  return {
    success: migrationStage5PHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5P SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5PGetConfig_() {
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


function migrationStage5PRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5PGetConfig_();

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
  var parsedBody = migrationStage5PParseJsonSafely_(text);
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


function migrationStage5PCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5PRequest_(
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

  var count = migrationStage5PParseCountFromContentRange_(contentRange);

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
 * 5P GENERIC UTILITIES
 ************************************************************/

function migrationStage5PBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5PNowIso_(),
    stage: MIGRATION_STAGE_5P_NAME,
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


function migrationStage5PIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5PHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5PParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5PParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5PNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5PGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5PGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5PLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}