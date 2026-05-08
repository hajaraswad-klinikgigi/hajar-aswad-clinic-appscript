/************************************************************
 * MigrationStage5U.gs
 * Tahap 5U — Migrasi billing_feedbacks
 *
 * 5U-A:
 * - Inspect schema billing_feedbacks Supabase
 * - Inspect source sheet BillingFeedbacks
 * - Validasi row_map billings dan patients
 * - Cek duplicate feedback_id / feedback_token
 * - Cek target staging masih kosong
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5U CONFIG
 ************************************************************/

var MIGRATION_STAGE_5U_NAME = '5U';
var MIGRATION_STAGE_5U_WRITE_ENABLED = false;

var MIGRATION_STAGE_5U_TARGET_TABLE = 'billing_feedbacks';

var MIGRATION_STAGE_5U_SOURCE_SHEET_ALIASES = [
  'BillingFeedbacks',
  'Billing Feedbacks',
  'Billing_Feedbacks',
  'billing_feedbacks'
];


/************************************************************
 * 5U PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5UInspectSchemaAndSourceLog() {
  var result = runMigrationStage5UInspectSchemaAndSource();
  migrationStage5ULogJson_('testMigrationStage5UInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5UPreflightLog() {
  var result = runMigrationStage5UPreflight();
  migrationStage5ULogJson_('testMigrationStage5UPreflight', result);
  return result;
}

function testMigrationStage5UDryRunPayloadLog() {
  var result = runMigrationStage5UDryRunPayload();
  migrationStage5ULogJson_('testMigrationStage5UDryRunPayload', result);
  return result;
}

function testMigrationStage5UInsertBillingFeedbacksLog() {
  var result = runMigrationStage5UInsertBillingFeedbacks();
  migrationStage5ULogJson_('testMigrationStage5UInsertBillingFeedbacks', result);
  return result;
}


function testMigrationStage5UAuditBillingFeedbacksLog() {
  var result = runMigrationStage5UAuditBillingFeedbacks();
  migrationStage5ULogJson_('testMigrationStage5UAuditBillingFeedbacks', result);
  return result;
}


/************************************************************
 * 5U-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5UInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5UBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5UInspectSupabaseTableSchema_(MIGRATION_STAGE_5U_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_FEEDBACKS_SCHEMA_NOT_FOUND',
      'Schema table billing_feedbacks tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5UInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var rowMaps = migrationStage5UInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;

  if (!rowMaps.success) {
    issues = issues.concat(rowMaps.issues || []);
  }

  var duplicateInspect = migrationStage5UInspectSourceDuplicateKeys_();
  result.source_duplicate_status = duplicateInspect.status;

  if (!duplicateInspect.success) {
    issues = issues.concat(duplicateInspect.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5UHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5U PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5UPreflight() {
  var startedAt = new Date();

  var result = migrationStage5UBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5UInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.row_map_status = inspect.row_map_status;
  result.source_duplicate_status = inspect.source_duplicate_status;

  issues = issues.concat(inspect.issues || []);

  var sourceRows = migrationStage5UReadSourceRows_();
  result.source_row_status = sourceRows.status;

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var targetStatus = migrationStage5UCheckTargetEmpty_();
  result.target_table_status = targetStatus.status;

  if (!targetStatus.success) {
    issues = issues.concat(targetStatus.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5UHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5U SOURCE SHEET
 ************************************************************/

function migrationStage5UInspectSourceSheet_() {
  var sheet = migrationStage5UFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5UIssue_(
          'error',
          MIGRATION_STAGE_5U_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber BillingFeedbacks tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5U_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 10);

  return {
    success: migrationStage5UHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      target_table: MIGRATION_STAGE_5U_TARGET_TABLE,
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5UFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5U_SOURCE_SHEET_ALIASES);
}


function migrationStage5UReadSourceRows_() {
  var sheet = migrationStage5UFindSourceSheet_();

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
        migrationStage5UIssue_(
          'error',
          MIGRATION_STAGE_5U_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber BillingFeedbacks tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5UHasNoBlockingIssues_(rowsResult.issues || []),
    rows: rowsResult.rows || [],
    headers: rowsResult.headers || [],
    status: {
      source_sheet: sheet.getName(),
      target_table: MIGRATION_STAGE_5U_TARGET_TABLE,
      spreadsheet_row_count: rowsResult.row_count_total || 0,
      non_blank_payload_row_count: rowsResult.rows ? rowsResult.rows.length : 0,
      header_count: rowsResult.headers ? rowsResult.headers.length : 0
    },
    issues: rowsResult.issues || []
  };
}


/************************************************************
 * 5U ROW MAP INSPECTION
 ************************************************************/

function migrationStage5UInspectRequiredRowMaps_() {
  var issues = [];

  var billings = migrationStage5UInspectRowMapByTarget_('billings', 46);
  var patients = migrationStage5UInspectRowMapByTarget_('patients', 285);

  issues = issues
    .concat(billings.issues || [])
    .concat(patients.issues || []);

  return {
    success: migrationStage5UHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      billings: billings.status,
      patients: patients.status
    }
  };
}


function migrationStage5UInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5UCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5URequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5UIssue_(
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
    issues.push(migrationStage5UIssue_(
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
    issues.push(migrationStage5UIssue_(
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
    success: migrationStage5UHasNoBlockingIssues_(issues),
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
 * 5U SOURCE DUPLICATE INSPECTION — READ ONLY
 ************************************************************/

function migrationStage5UInspectSourceDuplicateKeys_() {
  var sourceRows = migrationStage5UReadSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      issues: sourceRows.issues || [],
      status: {
        source_sheet: null,
        total_rows: 0,
        unique_feedback_id_count: 0,
        duplicate_feedback_id_group_count: 0,
        duplicate_feedback_id_row_count: 0,
        unique_feedback_token_count: 0,
        duplicate_feedback_token_group_count: 0,
        duplicate_feedback_token_row_count: 0,
        missing_feedback_id_count: 0,
        missing_feedback_token_count: 0,
        missing_billing_id_count: 0,
        missing_patient_id_count: 0,
        duplicate_feedback_id_sample: [],
        duplicate_feedback_token_sample: []
      }
    };
  }

  var feedbackIdGroups = {};
  var feedbackTokenGroups = {};

  var missingFeedbackIdCount = 0;
  var missingFeedbackTokenCount = 0;
  var missingBillingIdCount = 0;
  var missingPatientIdCount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var feedbackId = migrationStage5UPick_(raw, [
      'feedback_id',
      'billing_feedback_id',
      'id'
    ]);

    var feedbackToken = migrationStage5UPick_(raw, [
      'feedback_token',
      'token'
    ]);

    var billingId = migrationStage5UPick_(raw, [
      'billing_id',
      'billingId'
    ]);

    var patientId = migrationStage5UPick_(raw, [
      'patient_id',
      'patientId'
    ]);

    var normalizedFeedbackId = migrationNormalizeText_5K_(feedbackId);
    var normalizedFeedbackToken = migrationNormalizeText_5K_(feedbackToken);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedPatientId = migrationNormalizeText_5K_(patientId);

    if (!normalizedFeedbackId) missingFeedbackIdCount++;
    if (!normalizedFeedbackToken) missingFeedbackTokenCount++;
    if (!normalizedBillingId) missingBillingIdCount++;
    if (!normalizedPatientId) missingPatientIdCount++;

    if (normalizedFeedbackId) {
      if (!feedbackIdGroups[normalizedFeedbackId]) {
        feedbackIdGroups[normalizedFeedbackId] = [];
      }

      feedbackIdGroups[normalizedFeedbackId].push({
        source_sheet: rowObj.source_sheet,
        source_row_number: rowObj.source_row_number,
        feedback_id: normalizedFeedbackId,
        billing_id: normalizedBillingId || null,
        patient_id: normalizedPatientId || null
      });
    }

    if (normalizedFeedbackToken) {
      if (!feedbackTokenGroups[normalizedFeedbackToken]) {
        feedbackTokenGroups[normalizedFeedbackToken] = [];
      }

      feedbackTokenGroups[normalizedFeedbackToken].push({
        source_sheet: rowObj.source_sheet,
        source_row_number: rowObj.source_row_number,
        feedback_token: normalizedFeedbackToken,
        feedback_id: normalizedFeedbackId || null,
        billing_id: normalizedBillingId || null,
        patient_id: normalizedPatientId || null
      });
    }
  });

  var duplicateFeedbackId = migrationStage5UBuildDuplicateGroupSummary_(feedbackIdGroups, 'feedback_id');
  var duplicateFeedbackToken = migrationStage5UBuildDuplicateGroupSummary_(feedbackTokenGroups, 'feedback_token');

  if (duplicateFeedbackToken.group_count > 0) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'DUPLICATE_FEEDBACK_TOKEN_FOUND',
      'Ada feedback_token duplicate di source BillingFeedbacks. Token harus unique sebelum migrasi.',
      duplicateFeedbackToken
    ));
  }

  return {
    success: migrationStage5UHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      source_sheet: sourceRows.status.source_sheet,
      total_rows: sourceRows.status.non_blank_payload_row_count,
      unique_feedback_id_count: Object.keys(feedbackIdGroups).length,
      duplicate_feedback_id_group_count: duplicateFeedbackId.group_count,
      duplicate_feedback_id_row_count: duplicateFeedbackId.row_count,
      unique_feedback_token_count: Object.keys(feedbackTokenGroups).length,
      duplicate_feedback_token_group_count: duplicateFeedbackToken.group_count,
      duplicate_feedback_token_row_count: duplicateFeedbackToken.row_count,
      missing_feedback_id_count: missingFeedbackIdCount,
      missing_feedback_token_count: missingFeedbackTokenCount,
      missing_billing_id_count: missingBillingIdCount,
      missing_patient_id_count: missingPatientIdCount,
      duplicate_feedback_id_sample: duplicateFeedbackId.sample,
      duplicate_feedback_token_sample: duplicateFeedbackToken.sample
    }
  };
}


function migrationStage5UBuildDuplicateGroupSummary_(groups, idKey) {
  var duplicateGroups = [];
  var duplicateRowCount = 0;

  Object.keys(groups || {}).sort().forEach(function(key) {
    var rows = groups[key];

    if (rows.length > 1) {
      var item = {
        duplicate_count: rows.length,
        rows: rows
      };

      item[idKey] = key;

      duplicateGroups.push(item);
      duplicateRowCount += rows.length;
    }
  });

  return {
    group_count: duplicateGroups.length,
    row_count: duplicateRowCount,
    sample: duplicateGroups.slice(0, 20)
  };
}

/************************************************************
 * 5U-B DRY-RUN PAYLOAD — READ ONLY
 ************************************************************/

function runMigrationStage5UDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5UBaseResult_('dry_run_payload_read_only');
  var dryRun = migrationStage5UBuildDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5UHasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5UBuildDryRunPayload_() {
  var sourceRows = migrationStage5UReadSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        mapped_count: 0,
        missing_billing_parent_count: 0,
        missing_patient_parent_count: 0,
        duplicate_feedback_token_count: 0,
        pending_count: 0,
        submitted_count: 0,
        blocking_issue_count: 1,
        warning_issue_count: 0
      },
      payloads: [],
      sample_payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var billingMap = migrationStage5ULoadLegacyMap_('billings');
  var patientMap = migrationStage5ULoadLegacyMap_('patients');

  issues = issues
    .concat(billingMap.issues || [])
    .concat(patientMap.issues || []);

  var payloads = [];
  var sampleIssues = [];

  var mappedCount = 0;
  var missingBillingParentCount = 0;
  var missingPatientParentCount = 0;

  var feedbackStatusCounts = {};
  var tokenGroups = {};

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var feedbackId = migrationStage5UPick_(raw, [
      'feedback_id',
      'billing_feedback_id',
      'id'
    ]);

    var billingId = migrationStage5UPick_(raw, [
      'billing_id',
      'billingId'
    ]);

    var feedbackToken = migrationStage5UPick_(raw, [
      'feedback_token',
      'token'
    ]);

    var feedbackStatus = migrationStage5UPick_(raw, [
      'feedback_status',
      'status'
    ]);

    var rating = migrationStage5UPick_(raw, ['rating']);
    var serviceQuality = migrationStage5UPick_(raw, ['service_quality']);
    var staffFriendliness = migrationStage5UPick_(raw, ['staff_friendliness']);
    var clinicCleanliness = migrationStage5UPick_(raw, ['clinic_cleanliness']);
    var waitingTime = migrationStage5UPick_(raw, ['waiting_time']);
    var comment = migrationStage5UPick_(raw, ['comment', 'comments']);
    var submittedAt = migrationStage5UPick_(raw, ['submitted_at']);

    var patientId = migrationStage5UPick_(raw, [
      'patient_id',
      'patientId'
    ]);

    var patientName = migrationStage5UPick_(raw, [
      'patient_name',
      'name',
      'full_name'
    ]);

    var createdAt = migrationStage5UPick_(raw, [
      'created_at',
      'createdAt'
    ]);

    var updatedAt = migrationStage5UPick_(raw, [
      'updated_at',
      'updatedAt'
    ]);

    var normalizedFeedbackId = migrationNormalizeText_5K_(feedbackId);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedFeedbackToken = migrationNormalizeText_5K_(feedbackToken);
    var normalizedFeedbackStatus = migrationNormalizeNullableText_5K_(feedbackStatus);
    var normalizedPatientId = migrationNormalizeText_5K_(patientId);

    var billingUuid = normalizedBillingId
      ? (billingMap.map[normalizedBillingId] || null)
      : null;

    var patientUuid = normalizedPatientId
      ? (patientMap.map[normalizedPatientId] || null)
      : null;

    var payload = {
      feedback_id: normalizedFeedbackId,
      billing_id: normalizedBillingId,
      billing_uuid: billingUuid,
      feedback_token: normalizedFeedbackToken,
      feedback_status: normalizedFeedbackStatus,
      rating: migrationStage5UNormalizeInteger_(rating),
      service_quality: migrationStage5UNormalizeInteger_(serviceQuality),
      staff_friendliness: migrationStage5UNormalizeInteger_(staffFriendliness),
      clinic_cleanliness: migrationStage5UNormalizeInteger_(clinicCleanliness),
      waiting_time: migrationStage5UNormalizeInteger_(waitingTime),
      comment: migrationNormalizeNullableText_5K_(comment),
      submitted_at: migrationNormalizeTimestamp_5K_(submittedAt),
      patient_id: normalizedPatientId,
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5UParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    var rowHasMissingParent = false;

    if (!payload.feedback_id) {
      var feedbackIdIssue = migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_FEEDBACK_ID',
        'BillingFeedbacks tidak memiliki feedback_id.',
        { raw: raw }
      );

      issues.push(feedbackIdIssue);
      if (sampleIssues.length < 10) sampleIssues.push(feedbackIdIssue);
    }

    if (!payload.feedback_token) {
      var tokenIssue = migrationStage5UIssue_(
        'warning',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.feedback_id,
        'MISSING_FEEDBACK_TOKEN',
        'BillingFeedbacks tidak memiliki feedback_token.',
        { feedback_id: payload.feedback_id }
      );

      issues.push(tokenIssue);
      if (sampleIssues.length < 10) sampleIssues.push(tokenIssue);
    }

    if (payload.feedback_token) {
      if (!tokenGroups[payload.feedback_token]) {
        tokenGroups[payload.feedback_token] = [];
      }

      tokenGroups[payload.feedback_token].push({
        source_sheet: rowObj.source_sheet,
        source_row_number: rowObj.source_row_number,
        feedback_id: payload.feedback_id,
        feedback_token: payload.feedback_token
      });
    }

    if (!payload.billing_id || !payload.billing_uuid) {
      rowHasMissingParent = true;
      missingBillingParentCount++;

      var billingIssue = migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.feedback_id,
        'BILLING_PARENT_NOT_MAPPED',
        'billing_id BillingFeedbacks tidak ditemukan di migration_row_map billings.',
        { billing_id: payload.billing_id }
      );

      issues.push(billingIssue);
      if (sampleIssues.length < 10) sampleIssues.push(billingIssue);
    }

    if (payload.patient_id && !payload.patient_uuid) {
      rowHasMissingParent = true;
      missingPatientParentCount++;

      var patientIssue = migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.feedback_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id BillingFeedbacks tidak ditemukan di migration_row_map patients.',
        { patient_id: payload.patient_id }
      );

      issues.push(patientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(patientIssue);
    }

    if (payload.feedback_status) {
      feedbackStatusCounts[payload.feedback_status] = (feedbackStatusCounts[payload.feedback_status] || 0) + 1;
    }

    if (!rowHasMissingParent) {
      mappedCount++;
    }

    payloads.push(payload);
  });

  var duplicateFeedbackTokenCount = 0;

  Object.keys(tokenGroups).forEach(function(token) {
    var rows = tokenGroups[token];

    if (rows.length > 1) {
      duplicateFeedbackTokenCount += rows.length;

      var duplicateIssue = migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        '',
        '',
        '',
        'DUPLICATE_FEEDBACK_TOKEN_FOUND',
        'Ada feedback_token duplicate pada dry-run BillingFeedbacks.',
        {
          feedback_token: token,
          duplicate_count: rows.length,
          rows: rows
        }
      );

      issues.push(duplicateIssue);
      if (sampleIssues.length < 10) sampleIssues.push(duplicateIssue);
    }
  });

  return {
    success: migrationStage5UHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      billing_map_count: billingMap.count || 0,
      patient_map_count: patientMap.count || 0,
      mapped_count: mappedCount,
      missing_billing_parent_count: missingBillingParentCount,
      missing_patient_parent_count: missingPatientParentCount,
      duplicate_feedback_token_count: duplicateFeedbackTokenCount,
      feedback_status_counts: feedbackStatusCounts,
      pending_count: feedbackStatusCounts.pending || 0,
      submitted_count: feedbackStatusCounts.submitted || 0,
      blocking_issue_count: migrationStage5UCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5UCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 10),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5ULoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5URequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5UIssue_(
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
    success: migrationStage5UHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5UNormalizeInteger_(value) {
  if (value === null || value === undefined || value === '') return null;

  var numberValue = Number(value);

  if (isNaN(numberValue)) return null;

  return Math.round(numberValue);
}


function migrationStage5UCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

/************************************************************
 * 5U-C INSERT + AUDIT
 ************************************************************/

function runMigrationStage5UInsertBillingFeedbacks() {
  var startedAt = new Date();

  var result = migrationStage5UBaseResult_('insert_billing_feedbacks_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5U_WRITE_ENABLED !== true) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5U_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert billing_feedbacks staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5U sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5UPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      source_row_status: preflight.source_row_status || null,
      target_table_status: preflight.target_table_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5U belum clean. Insert billing_feedbacks dibatalkan.',
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

    var targetEmpty = migrationStage5UCheckTargetEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5UBuildDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5UHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5UInsertRows_(
      MIGRATION_STAGE_5U_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        '',
        '',
        '',
        'BILLING_FEEDBACKS_INSERT_FAILED',
        'Insert billing_feedbacks ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5UBuildRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5UInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5UIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'BILLING_FEEDBACKS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map billing_feedbacks gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5UBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5UInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5UIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5U gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5UAuditBillingFeedbacks();

    result.inserted_summary = {
      billing_feedbacks: {
        target_table: MIGRATION_STAGE_5U_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5UHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
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


function runMigrationStage5UAuditBillingFeedbacks() {
  var startedAt = new Date();

  var result = migrationStage5UBaseResult_('audit_billing_feedbacks_read_only');
  var issues = [];

  var sourceRows = migrationStage5UReadSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5UCountRows_(MIGRATION_STAGE_5U_TARGET_TABLE);
  var rowMapCount = migrationStage5UCountRows_(
    'migration_row_map',
    'target_table=eq.billing_feedbacks'
  );

  var nullBillingUuidCount = migrationStage5UCountRows_(
    MIGRATION_STAGE_5U_TARGET_TABLE,
    'billing_uuid=is.null'
  );

  var patientIdWithNullUuidCount = migrationStage5UCountRows_(
    MIGRATION_STAGE_5U_TARGET_TABLE,
    'patient_id=not.is.null&patient_uuid=is.null'
  );

  var duplicateTokenAudit = migrationStage5UAuditDuplicateFeedbackToken_();

  var pendingCount = migrationStage5UCountRows_(
    MIGRATION_STAGE_5U_TARGET_TABLE,
    'feedback_status=eq.pending'
  );

  var submittedCount = migrationStage5UCountRows_(
    MIGRATION_STAGE_5U_TARGET_TABLE,
    'feedback_status=eq.submitted'
  );

  if (!supabaseCount.success) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_FEEDBACKS_COUNT_FAILED',
      'Gagal menghitung row billing_feedbacks Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5UIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'BILLING_FEEDBACKS_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map billing_feedbacks.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_FEEDBACKS_COUNT_MISMATCH',
      'Jumlah BillingFeedbacks Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5UIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'BILLING_FEEDBACKS_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map billing_feedbacks tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullBillingUuidCount.success && nullBillingUuidCount.count !== 0) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_FEEDBACK_NULL_BILLING_UUID_FOUND',
      'Ada billing_feedbacks dengan billing_uuid kosong.',
      {
        null_billing_uuid_count: nullBillingUuidCount.count
      }
    ));
  }

  if (patientIdWithNullUuidCount.success && patientIdWithNullUuidCount.count !== 0) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_FEEDBACK_PATIENT_UUID_MISSING',
      'Ada billing_feedbacks dengan patient_id terisi tetapi patient_uuid kosong.',
      {
        patient_id_with_null_uuid_count: patientIdWithNullUuidCount.count
      }
    ));
  }

  if (!duplicateTokenAudit.success) {
    issues = issues.concat(duplicateTokenAudit.issues || []);
  }

  result.audit_status = {
    billing_feedbacks: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_billing_uuid_count: nullBillingUuidCount.count,
      patient_id_with_null_uuid_count: patientIdWithNullUuidCount.count,
      duplicate_feedback_token_count: duplicateTokenAudit.duplicate_feedback_token_count || 0,
      pending_count: pendingCount.count,
      submitted_count: submittedCount.count
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5UHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5UAuditDuplicateFeedbackToken_() {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5URequest_(
      'get',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      'select=id,feedback_id,feedback_token&feedback_token=not.is.null&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        '',
        '',
        '',
        'LOAD_FEEDBACK_TOKEN_AUDIT_FAILED',
        'Gagal membaca billing_feedbacks untuk audit duplicate token.',
        response
      ));

      break;
    }

    var pageRows = Array.isArray(response.body) ? response.body : [];
    rows = rows.concat(pageRows);

    if (pageRows.length < pageSize) {
      keepGoing = false;
    } else {
      offset += pageSize;
    }
  }

  var groups = {};
  var duplicateTokenCount = 0;

  rows.forEach(function(row) {
    if (!row.feedback_token) return;

    if (!groups[row.feedback_token]) {
      groups[row.feedback_token] = [];
    }

    groups[row.feedback_token].push(row);
  });

  Object.keys(groups).forEach(function(token) {
    var tokenRows = groups[token];

    if (tokenRows.length > 1) {
      duplicateTokenCount += tokenRows.length;

      issues.push(migrationStage5UIssue_(
        'error',
        MIGRATION_STAGE_5U_TARGET_TABLE,
        '',
        '',
        '',
        'DUPLICATE_FEEDBACK_TOKEN_FOUND',
        'Ada feedback_token duplicate di billing_feedbacks Supabase.',
        {
          feedback_token: token,
          duplicate_count: tokenRows.length,
          rows: tokenRows
        }
      ));
    }
  });

  return {
    success: migrationStage5UHasNoBlockingIssues_(issues),
    issues: issues,
    duplicate_feedback_token_count: duplicateTokenCount
  };
}


function migrationStage5UBuildRowMapRows_(insertedRows) {
  var now = migrationStage5UNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.feedback_id,
      target_table: MIGRATION_STAGE_5U_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5U_NAME,
      created_at: now
    };
  });
}


function migrationStage5UBuildMigrationIssueRows_(issues) {
  var now = migrationStage5UNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: migrationStage5UGetRelatedLegacyIdFromIssue_(issue),
      message: '[' + MIGRATION_STAGE_5U_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5U_NAME,
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


function migrationStage5UGetRelatedLegacyIdFromIssue_(issue) {
  var details = issue && issue.details ? issue.details : {};

  if (details.billing_id) return details.billing_id;
  if (details.patient_id) return details.patient_id;
  if (details.feedback_token) return details.feedback_token;

  return '';
}


function migrationStage5UNormalizeRowsForInsert_(tableName, rows) {
  if (tableName !== MIGRATION_STAGE_5U_TARGET_TABLE) {
    return (rows || []).map(function(row) {
      return migrationStage5UNullUndefinedValues_(row);
    });
  }

  var columns = [
    'feedback_id',
    'billing_id',
    'billing_uuid',
    'feedback_token',
    'feedback_status',
    'rating',
    'service_quality',
    'staff_friendliness',
    'clinic_cleanliness',
    'waiting_time',
    'comment',
    'submitted_at',
    'patient_id',
    'patient_name',
    'patient_uuid',
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


function migrationStage5UNullUndefinedValues_(row) {
  var clean = {};

  Object.keys(row || {}).forEach(function(key) {
    clean[key] = row[key] === undefined ? null : row[key];
  });

  return clean;
}


function migrationStage5UInsertRows_(tableName, rows) {
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
  var normalizedRows = migrationStage5UNormalizeRowsForInsert_(tableName, rows);

  for (var i = 0; i < normalizedRows.length; i += batchSize) {
    var chunk = normalizedRows.slice(i, i + batchSize);

    var response = migrationStage5URequest_(
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
 * 5U TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5UCheckTargetEmpty_() {
  var issues = [];

  var targetCount = migrationStage5UCountRows_(MIGRATION_STAGE_5U_TARGET_TABLE);
  var rowMapCount = migrationStage5UCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(MIGRATION_STAGE_5U_TARGET_TABLE)
  );

  var status = {
    target_table: MIGRATION_STAGE_5U_TARGET_TABLE,
    target_count: targetCount.count,
    target_count_success: targetCount.success,
    row_map_count: rowMapCount.count,
    row_map_count_success: rowMapCount.success
  };

  if (!targetCount.success) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_COUNT_FAILED',
      'Gagal menghitung table billing_feedbacks.',
      targetCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5UIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map untuk billing_feedbacks.',
      rowMapCount
    ));
  }

  if (targetCount.success && targetCount.count !== 0) {
    issues.push(migrationStage5UIssue_(
      'error',
      MIGRATION_STAGE_5U_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_TABLE_NOT_EMPTY',
      'Table billing_feedbacks staging tidak kosong. Insert awal 5U harus ditahan agar tidak duplikat.',
      {
        count: targetCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5UIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk billing_feedbacks sudah ada. Insert awal 5U harus ditahan agar tidak duplikat.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5UHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5U SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5UInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5UFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5UExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5UFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5UPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5UFetchOpenApiSchema_() {
  var config = migrationStage5UGetConfig_();

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
  var body = migrationStage5UParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5UExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5UFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5UPickPropertiesPreview_(properties) {
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
 * 5U SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5UGetConfig_() {
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


function migrationStage5URequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5UGetConfig_();

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
  var parsedBody = migrationStage5UParseJsonSafely_(text);
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


function migrationStage5UCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5URequest_(
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

  var count = migrationStage5UParseCountFromContentRange_(contentRange);

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
 * 5U GENERIC UTILITIES
 ************************************************************/

function migrationStage5UBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5UNowIso_(),
    stage: MIGRATION_STAGE_5U_NAME,
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


function migrationStage5UIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5UHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5UPick_(raw, candidates) {
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


function migrationStage5UParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5UParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5UNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5UGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5UGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5ULogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}