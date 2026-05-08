/************************************************************
 * MigrationStage5Q.gs
 * Tahap 5Q — Migrasi ortho_recalls ke Supabase staging
 *
 * 5Q-A:
 * - Inspect schema ortho_recalls Supabase
 * - Inspect source sheet OrthoRecall
 * - Validasi row_map patients dan treatments
 * - Cek target staging masih kosong
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5Q CONFIG
 ************************************************************/

var MIGRATION_STAGE_5Q_NAME = '5Q';
var MIGRATION_STAGE_5Q_WRITE_ENABLED = false;

var MIGRATION_STAGE_5Q_TARGET_TABLE = 'ortho_recalls';

var MIGRATION_STAGE_5Q_SOURCE_SHEET_ALIASES = [
  'OrthoRecall',
  'OrthoRecalls',
  'Ortho Recall',
  'Ortho_Recall',
  'ortho_recalls'
];


/************************************************************
 * 5Q PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5QInspectSchemaAndSourceLog() {
  var result = runMigrationStage5QInspectSchemaAndSource();
  migrationStage5QLogJson_('testMigrationStage5QInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5QPreflightLog() {
  var result = runMigrationStage5QPreflight();
  migrationStage5QLogJson_('testMigrationStage5QPreflight', result);
  return result;
}

function testMigrationStage5QDryRunPayloadLog() {
  var result = runMigrationStage5QDryRunPayload();
  migrationStage5QLogJson_('testMigrationStage5QDryRunPayload', result);
  return result;
}

function testMigrationStage5QInsertOrthoRecallsLog() {
  var result = runMigrationStage5QInsertOrthoRecalls();
  migrationStage5QLogJson_('testMigrationStage5QInsertOrthoRecalls', result);
  return result;
}


function testMigrationStage5QAuditOrthoRecallsLog() {
  var result = runMigrationStage5QAuditOrthoRecalls();
  migrationStage5QLogJson_('testMigrationStage5QAuditOrthoRecalls', result);
  return result;
}


/************************************************************
 * 5Q-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5QInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5QBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5QInspectSupabaseTableSchema_(MIGRATION_STAGE_5Q_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'ORTHO_RECALLS_SCHEMA_NOT_FOUND',
      'Schema table ortho_recalls tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5QInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var rowMaps = migrationStage5QInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;

  if (!rowMaps.success) {
    issues = issues.concat(rowMaps.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5QHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5Q PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5QPreflight() {
  var startedAt = new Date();

  var result = migrationStage5QBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5QInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.row_map_status = inspect.row_map_status;

  issues = issues.concat(inspect.issues || []);

  var sourceRows = migrationStage5QReadSourceRows_();
  result.source_row_status = sourceRows.status;

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var targetStatus = migrationStage5QCheckTargetEmpty_();
  result.target_table_status = targetStatus.status;

  if (!targetStatus.success) {
    issues = issues.concat(targetStatus.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5QHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5Q SOURCE SHEET
 ************************************************************/

function migrationStage5QInspectSourceSheet_() {
  var sheet = migrationStage5QFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5QIssue_(
          'error',
          MIGRATION_STAGE_5Q_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber OrthoRecall tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5Q_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 10);

  return {
    success: migrationStage5QHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      target_table: MIGRATION_STAGE_5Q_TARGET_TABLE,
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5QFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5Q_SOURCE_SHEET_ALIASES);
}


function migrationStage5QReadSourceRows_() {
  var sheet = migrationStage5QFindSourceSheet_();

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
        migrationStage5QIssue_(
          'error',
          MIGRATION_STAGE_5Q_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber OrthoRecall tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5QHasNoBlockingIssues_(rowsResult.issues || []),
    rows: rowsResult.rows || [],
    headers: rowsResult.headers || [],
    status: {
      source_sheet: sheet.getName(),
      target_table: MIGRATION_STAGE_5Q_TARGET_TABLE,
      spreadsheet_row_count: rowsResult.row_count_total || 0,
      non_blank_payload_row_count: rowsResult.rows ? rowsResult.rows.length : 0,
      header_count: rowsResult.headers ? rowsResult.headers.length : 0
    },
    issues: rowsResult.issues || []
  };
}


/************************************************************
 * 5Q ROW MAP INSPECTION
 ************************************************************/

function migrationStage5QInspectRequiredRowMaps_() {
  var issues = [];

  var patients = migrationStage5QInspectRowMapByTarget_('patients', 285);
  var treatments = migrationStage5QInspectRowMapByTarget_('treatments', 254);

  issues = issues
    .concat(patients.issues || [])
    .concat(treatments.issues || []);

  return {
    success: migrationStage5QHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      patients: patients.status,
      treatments: treatments.status
    }
  };
}


function migrationStage5QInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5QCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5QRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5QIssue_(
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
    issues.push(migrationStage5QIssue_(
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
    issues.push(migrationStage5QIssue_(
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
    success: migrationStage5QHasNoBlockingIssues_(issues),
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
 * 5Q-B DRY-RUN PAYLOAD — READ ONLY
 ************************************************************/

function runMigrationStage5QDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5QBaseResult_('dry_run_payload_read_only');
  var dryRun = migrationStage5QBuildDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5QHasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5QBuildDryRunPayload_() {
  var sourceRows = migrationStage5QReadSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        mapped_count: 0,
        missing_patient_parent_count: 0,
        missing_install_treatment_parent_count: 0,
        missing_last_control_treatment_parent_count: 0,
        blocking_issue_count: 1,
        warning_issue_count: 0
      },
      payloads: [],
      sample_payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var patientMap = migrationStage5QLoadLegacyMap_('patients');
  var treatmentMap = migrationStage5QLoadLegacyMap_('treatments');

  issues = issues
    .concat(patientMap.issues || [])
    .concat(treatmentMap.issues || []);

  var payloads = [];
  var sampleIssues = [];

  var mappedCount = 0;
  var missingPatientParentCount = 0;
  var missingInstallTreatmentParentCount = 0;
  var missingLastControlTreatmentParentCount = 0;

  var programStatusCounts = {};
  var followupStatusCounts = {};

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var orthoRecallId = migrationStage5QPick_(raw, [
      'ortho_recall_id',
      'recall_id',
      'id'
    ]);

    var patientId = migrationStage5QPick_(raw, [
      'patient_id',
      'patientId'
    ]);

    var patientName = migrationStage5QPick_(raw, [
      'patient_name',
      'name',
      'full_name'
    ]);

    var phone = migrationStage5QPick_(raw, [
      'phone',
      'phone_number',
      'no_hp',
      'whatsapp',
      'wa'
    ]);

    var installTreatmentId = migrationStage5QPick_(raw, [
      'install_treatment_id',
      'installation_treatment_id'
    ]);

    var installDate = migrationStage5QPick_(raw, [
      'install_date',
      'installation_date'
    ]);

    var lastControlTreatmentId = migrationStage5QPick_(raw, [
      'last_control_treatment_id',
      'control_treatment_id'
    ]);

    var lastControlDate = migrationStage5QPick_(raw, [
      'last_control_date',
      'control_date'
    ]);

    var nextDueDate = migrationStage5QPick_(raw, [
      'next_due_date',
      'due_date'
    ]);

    var controlCount = migrationStage5QPick_(raw, [
      'control_count'
    ]);

    var programStatus = migrationStage5QPick_(raw, [
      'program_status'
    ]);

    var followupStatus = migrationStage5QPick_(raw, [
      'followup_status',
      'follow_up_status'
    ]);

    var targetMonths = migrationStage5QPick_(raw, [
      'target_months'
    ]);

    var completedAt = migrationStage5QPick_(raw, [
      'completed_at'
    ]);

    var lastContactDate = migrationStage5QPick_(raw, [
      'last_contact_date'
    ]);

    var lastContactNote = migrationStage5QPick_(raw, [
      'last_contact_note'
    ]);

    var notes = migrationStage5QPick_(raw, [
      'notes',
      'note'
    ]);

    var createdAt = migrationStage5QPick_(raw, [
      'created_at',
      'createdAt',
      'created_date'
    ]);

    var updatedAt = migrationStage5QPick_(raw, [
      'updated_at',
      'updatedAt',
      'updated_date'
    ]);

    var normalizedOrthoRecallId = migrationNormalizeText_5K_(orthoRecallId);
    var normalizedPatientId = migrationNormalizeText_5K_(patientId);
    var normalizedInstallTreatmentId = migrationNormalizeNullableText_5K_(installTreatmentId);
    var normalizedLastControlTreatmentId = migrationNormalizeNullableText_5K_(lastControlTreatmentId);

    var patientUuid = normalizedPatientId
      ? (patientMap.map[normalizedPatientId] || null)
      : null;

    var installTreatmentUuid = normalizedInstallTreatmentId
      ? (treatmentMap.map[normalizedInstallTreatmentId] || null)
      : null;

    var lastControlTreatmentUuid = normalizedLastControlTreatmentId
      ? (treatmentMap.map[normalizedLastControlTreatmentId] || null)
      : null;

    var normalizedProgramStatus = migrationNormalizeNullableText_5K_(programStatus);
    var normalizedFollowupStatus = migrationNormalizeNullableText_5K_(followupStatus);

    if (normalizedProgramStatus) {
      programStatusCounts[normalizedProgramStatus] = (programStatusCounts[normalizedProgramStatus] || 0) + 1;
    }

    if (normalizedFollowupStatus) {
      followupStatusCounts[normalizedFollowupStatus] = (followupStatusCounts[normalizedFollowupStatus] || 0) + 1;
    }

    var payload = {
      ortho_recall_id: normalizedOrthoRecallId,
      patient_id: normalizedPatientId,
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      phone: migrationNormalizePhone_5K_(phone),
      install_treatment_id: normalizedInstallTreatmentId,
      install_treatment_uuid: installTreatmentUuid,
      install_date: migrationNormalizeDate_5K_(installDate),
      last_control_treatment_id: normalizedLastControlTreatmentId,
      last_control_treatment_uuid: lastControlTreatmentUuid,
      last_control_date: migrationNormalizeDate_5K_(lastControlDate),
      next_due_date: migrationNormalizeDate_5K_(nextDueDate),
      control_count: migrationStage5QNormalizeInteger_(controlCount),
      program_status: normalizedProgramStatus,
      followup_status: normalizedFollowupStatus,
      target_months: migrationStage5QNormalizeInteger_(targetMonths),
      completed_at: migrationNormalizeTimestamp_5K_(completedAt),
      last_contact_date: migrationNormalizeDate_5K_(lastContactDate),
      last_contact_note: migrationNormalizeNullableText_5K_(lastContactNote),
      notes: migrationNormalizeNullableText_5K_(notes),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5QParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    var rowHasBlockingMissingParent = false;

    if (!payload.ortho_recall_id) {
      var missingRecallIssue = migrationStage5QIssue_(
        'error',
        MIGRATION_STAGE_5Q_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_ORTHO_RECALL_ID',
        'OrthoRecall tidak memiliki ortho_recall_id.',
        { raw: raw }
      );

      issues.push(missingRecallIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingRecallIssue);
    }

    if (!payload.patient_id || !payload.patient_uuid) {
      rowHasBlockingMissingParent = true;
      missingPatientParentCount++;

      var patientIssue = migrationStage5QIssue_(
        'error',
        MIGRATION_STAGE_5Q_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.ortho_recall_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id OrthoRecall tidak ditemukan di migration_row_map patients.',
        { patient_id: payload.patient_id }
      );

      issues.push(patientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(patientIssue);
    }

    if (payload.install_treatment_id && !payload.install_treatment_uuid) {
      missingInstallTreatmentParentCount++;

      var installIssue = migrationStage5QIssue_(
        'warning',
        MIGRATION_STAGE_5Q_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.ortho_recall_id,
        'INSTALL_TREATMENT_PARENT_NOT_MAPPED',
        'install_treatment_id tidak ditemukan di migration_row_map treatments. Legacy ID tetap dibawa, UUID akan null.',
        { install_treatment_id: payload.install_treatment_id }
      );

      issues.push(installIssue);
      if (sampleIssues.length < 10) sampleIssues.push(installIssue);
    }

    if (payload.last_control_treatment_id && !payload.last_control_treatment_uuid) {
      missingLastControlTreatmentParentCount++;

      var lastControlIssue = migrationStage5QIssue_(
        'warning',
        MIGRATION_STAGE_5Q_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.ortho_recall_id,
        'LAST_CONTROL_TREATMENT_PARENT_NOT_MAPPED',
        'last_control_treatment_id tidak ditemukan di migration_row_map treatments. Legacy ID tetap dibawa, UUID akan null.',
        { last_control_treatment_id: payload.last_control_treatment_id }
      );

      issues.push(lastControlIssue);
      if (sampleIssues.length < 10) sampleIssues.push(lastControlIssue);
    }

    if (!rowHasBlockingMissingParent) {
      mappedCount++;
    }

    payloads.push(payload);
  });

  return {
    success: migrationStage5QHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      patient_map_count: patientMap.count || 0,
      treatment_map_count: treatmentMap.count || 0,
      mapped_count: mappedCount,
      missing_patient_parent_count: missingPatientParentCount,
      missing_install_treatment_parent_count: missingInstallTreatmentParentCount,
      missing_last_control_treatment_parent_count: missingLastControlTreatmentParentCount,
      program_status_counts: programStatusCounts,
      followup_status_counts: followupStatusCounts,
      blocking_issue_count: migrationStage5QCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5QCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 10),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5QLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5QRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5QIssue_(
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
    success: migrationStage5QHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5QPick_(raw, candidates) {
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


function migrationStage5QNormalizeInteger_(value) {
  if (value === null || value === undefined || value === '') return null;

  var numberValue = Number(value);

  if (isNaN(numberValue)) return null;

  return Math.round(numberValue);
}


function migrationStage5QCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

/************************************************************
 * 5Q-C INSERT + AUDIT
 ************************************************************/

function runMigrationStage5QInsertOrthoRecalls() {
  var startedAt = new Date();

  var result = migrationStage5QBaseResult_('insert_ortho_recalls_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5Q_WRITE_ENABLED !== true) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5Q_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert ortho_recalls staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5Q sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5QPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      source_row_status: preflight.source_row_status || null,
      target_table_status: preflight.target_table_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5QIssue_(
        'error',
        MIGRATION_STAGE_5Q_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5Q belum clean. Insert ortho_recalls dibatalkan.',
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

    var targetEmpty = migrationStage5QCheckTargetEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5QBuildDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5QHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5QInsertRows_(
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5QIssue_(
        'error',
        MIGRATION_STAGE_5Q_TARGET_TABLE,
        '',
        '',
        '',
        'ORTHO_RECALLS_INSERT_FAILED',
        'Insert ortho_recalls ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5QBuildRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5QInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5QIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'ORTHO_RECALL_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map ortho_recalls gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5QBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5QInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5QIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5Q gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5QAuditOrthoRecalls();

    result.inserted_summary = {
      ortho_recalls: {
        target_table: MIGRATION_STAGE_5Q_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5QHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
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


function runMigrationStage5QAuditOrthoRecalls() {
  var startedAt = new Date();

  var result = migrationStage5QBaseResult_('audit_ortho_recalls_read_only');
  var issues = [];

  var sourceRows = migrationStage5QReadSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5QCountRows_(MIGRATION_STAGE_5Q_TARGET_TABLE);
  var rowMapCount = migrationStage5QCountRows_(
    'migration_row_map',
    'target_table=eq.ortho_recalls'
  );

  var nullPatientUuidCount = migrationStage5QCountRows_(
    MIGRATION_STAGE_5Q_TARGET_TABLE,
    'patient_uuid=is.null'
  );

  var installIdWithNullUuidCount = migrationStage5QCountRows_(
    MIGRATION_STAGE_5Q_TARGET_TABLE,
    'install_treatment_id=not.is.null&install_treatment_uuid=is.null'
  );

  var lastControlIdWithNullUuidCount = migrationStage5QCountRows_(
    MIGRATION_STAGE_5Q_TARGET_TABLE,
    'last_control_treatment_id=not.is.null&last_control_treatment_uuid=is.null'
  );

  var activeProgramCount = migrationStage5QCountRows_(
    MIGRATION_STAGE_5Q_TARGET_TABLE,
    'program_status=eq.active'
  );

  var upcomingFollowupCount = migrationStage5QCountRows_(
    MIGRATION_STAGE_5Q_TARGET_TABLE,
    'followup_status=eq.upcoming'
  );

  var migrationIssueCount = migrationStage5QCountRows_(
    'migration_issues',
    'issue_type=eq.INSTALL_TREATMENT_PARENT_NOT_MAPPED'
  );

  if (!supabaseCount.success) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'ORTHO_RECALLS_COUNT_FAILED',
      'Gagal menghitung row ortho_recalls Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5QIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ORTHO_RECALL_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map ortho_recalls.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'ORTHO_RECALLS_COUNT_MISMATCH',
      'Jumlah OrthoRecall Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5QIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'ORTHO_RECALL_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map ortho_recalls tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullPatientUuidCount.success && nullPatientUuidCount.count !== 0) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'ORTHO_RECALL_NULL_PATIENT_UUID_FOUND',
      'Ada ortho_recalls dengan patient_uuid kosong.',
      {
        null_patient_uuid_count: nullPatientUuidCount.count
      }
    ));
  }

  if (lastControlIdWithNullUuidCount.success && lastControlIdWithNullUuidCount.count !== 0) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'LAST_CONTROL_TREATMENT_UUID_MISSING',
      'Ada last_control_treatment_id yang tidak berhasil resolve ke UUID.',
      {
        last_control_id_with_null_uuid_count: lastControlIdWithNullUuidCount.count
      }
    ));
  }

  result.audit_status = {
    ortho_recalls: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_patient_uuid_count: nullPatientUuidCount.count,
      install_treatment_id_with_null_uuid_count: installIdWithNullUuidCount.count,
      last_control_treatment_id_with_null_uuid_count: lastControlIdWithNullUuidCount.count,
      program_status_active_count: activeProgramCount.count,
      followup_status_upcoming_count: upcomingFollowupCount.count,
      migration_issue_install_treatment_missing_parent_count: migrationIssueCount.count
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5QHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5QBuildRowMapRows_(insertedRows) {
  var now = migrationStage5QNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.ortho_recall_id,
      target_table: MIGRATION_STAGE_5Q_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5Q_NAME,
      created_at: now
    };
  });
}


function migrationStage5QBuildMigrationIssueRows_(issues) {
  var now = migrationStage5QNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: issue.details && issue.details.install_treatment_id
        ? issue.details.install_treatment_id
        : '',
      message: '[' + MIGRATION_STAGE_5Q_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5Q_NAME,
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

function migrationStage5QNormalizeRowsForInsert_(tableName, rows) {
  if (tableName !== MIGRATION_STAGE_5Q_TARGET_TABLE) {
    return (rows || []).map(function(row) {
      return migrationStage5QNullUndefinedValues_(row);
    });
  }

  var columns = [
    'ortho_recall_id',
    'patient_id',
    'patient_name',
    'patient_uuid',
    'phone',
    'install_treatment_id',
    'install_treatment_uuid',
    'install_date',
    'last_control_treatment_id',
    'last_control_treatment_uuid',
    'last_control_date',
    'next_due_date',
    'control_count',
    'program_status',
    'followup_status',
    'target_months',
    'completed_at',
    'last_contact_date',
    'last_contact_note',
    'notes',
    'created_at',
    'updated_at',
    'source_sheet',
    'source_row_number',
    'raw_snapshot'
  ];

  return (rows || []).map(function(row) {
    var clean = {};

    columns.forEach(function(column) {
      clean[column] = row && row[column] !== undefined ? row[column] : null;
    });

    return clean;
  });
}


function migrationStage5QNullUndefinedValues_(row) {
  var clean = {};

  Object.keys(row || {}).forEach(function(key) {
    clean[key] = row[key] === undefined ? null : row[key];
  });

  return clean;
}


function migrationStage5QInsertRows_(tableName, rows) {
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
  var normalizedRows = migrationStage5QNormalizeRowsForInsert_(tableName, rows);

  for (var i = 0; i < rows.length; i += batchSize) {
    var chunk = normalizedRows.slice(i, i + batchSize);

    var response = migrationStage5QRequest_(
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
 * 5Q TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5QCheckTargetEmpty_() {
  var issues = [];

  var targetCount = migrationStage5QCountRows_(MIGRATION_STAGE_5Q_TARGET_TABLE);
  var rowMapCount = migrationStage5QCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(MIGRATION_STAGE_5Q_TARGET_TABLE)
  );

  var status = {
    target_table: MIGRATION_STAGE_5Q_TARGET_TABLE,
    target_count: targetCount.count,
    target_count_success: targetCount.success,
    row_map_count: rowMapCount.count,
    row_map_count_success: rowMapCount.success
  };

  if (!targetCount.success) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_COUNT_FAILED',
      'Gagal menghitung table ortho_recalls.',
      targetCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5QIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map untuk ortho_recalls.',
      rowMapCount
    ));
  }

  if (targetCount.success && targetCount.count !== 0) {
    issues.push(migrationStage5QIssue_(
      'error',
      MIGRATION_STAGE_5Q_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_TABLE_NOT_EMPTY',
      'Table ortho_recalls staging tidak kosong. Insert awal 5Q harus ditahan agar tidak duplikat.',
      {
        count: targetCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5QIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk ortho_recalls sudah ada. Insert awal 5Q harus ditahan agar tidak duplikat.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5QHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5Q SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5QInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5QFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5QExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5QFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5QPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5QFetchOpenApiSchema_() {
  var config = migrationStage5QGetConfig_();

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
  var body = migrationStage5QParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5QExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5QFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5QPickPropertiesPreview_(properties) {
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
 * 5Q SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5QGetConfig_() {
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


function migrationStage5QRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5QGetConfig_();

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
  var parsedBody = migrationStage5QParseJsonSafely_(text);
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


function migrationStage5QCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5QRequest_(
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

  var count = migrationStage5QParseCountFromContentRange_(contentRange);

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
 * 5Q GENERIC UTILITIES
 ************************************************************/

function migrationStage5QBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5QNowIso_(),
    stage: MIGRATION_STAGE_5Q_NAME,
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


function migrationStage5QIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5QHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5QParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5QParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5QNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5QGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5QGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5QLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}