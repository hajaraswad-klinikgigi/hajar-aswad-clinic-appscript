/************************************************************
 * MigrationStage5T.gs
 * Tahap 5T — Migrasi billing_adjustments, billing_installments, payments
 *
 * 5T-A:
 * - Inspect schema billing_adjustments Supabase
 * - Inspect schema billing_installments Supabase
 * - Inspect schema payments Supabase
 * - Inspect source sheet BillingAdjustments
 * - Inspect source sheet BillingInstallments
 * - Inspect source sheet Payments
 * - Validasi row_map billings
 * - Cek target staging masih kosong
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5T CONFIG
 ************************************************************/

var MIGRATION_STAGE_5T_NAME = '5T';
var MIGRATION_STAGE_5T_WRITE_ENABLED = false;

var MIGRATION_STAGE_5T_TARGET_TABLES = {
  billing_adjustments: {
    target_table: 'billing_adjustments',
    source_sheet_aliases: [
      'BillingAdjustments',
      'Billing Adjustments',
      'Billing_Adjustments',
      'billing_adjustments'
    ],
    legacy_id_candidates: [
      'adjustment_id',
      'billing_adjustment_id',
      'id'
    ]
  },

  billing_installments: {
    target_table: 'billing_installments',
    source_sheet_aliases: [
      'BillingInstallments',
      'Billing Installments',
      'Billing_Installments',
      'billing_installments'
    ],
    legacy_id_candidates: [
      'installment_id',
      'billing_installment_id',
      'id'
    ]
  },

  payments: {
    target_table: 'payments',
    source_sheet_aliases: [
      'Payments',
      'Payment',
      'payments'
    ],
    legacy_id_candidates: [
      'payment_id',
      'id'
    ]
  }
};


/************************************************************
 * 5T PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5TInspectSchemaAndSourceLog() {
  var result = runMigrationStage5TInspectSchemaAndSource();
  migrationStage5TLogJson_('testMigrationStage5TInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5TPreflightLog() {
  var result = runMigrationStage5TPreflight();
  migrationStage5TLogJson_('testMigrationStage5TPreflight', result);
  return result;
}

function testMigrationStage5TDryRunPayloadLog() {
  var result = runMigrationStage5TDryRunPayload();
  migrationStage5TLogJson_('testMigrationStage5TDryRunPayload', result);
  return result;
}

function testMigrationStage5TInsertFinanceChildrenLog() {
  var result = runMigrationStage5TInsertFinanceChildren();
  migrationStage5TLogJson_('testMigrationStage5TInsertFinanceChildren', result);
  return result;
}


function testMigrationStage5TAuditFinanceChildrenLog() {
  var result = runMigrationStage5TAuditFinanceChildren();
  migrationStage5TLogJson_('testMigrationStage5TAuditFinanceChildren', result);
  return result;
}


/************************************************************
 * 5T-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5TInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5TBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schemas = migrationStage5TInspectAllTargetSchemas_();
  result.supabase_schemas = schemas.schemas;
  issues = issues.concat(schemas.issues || []);

  var sources = migrationStage5TInspectAllSourceSheets_();
  result.source_sheets = sources.source_sheets;
  issues = issues.concat(sources.issues || []);

  var rowMaps = migrationStage5TInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;
  issues = issues.concat(rowMaps.issues || []);

  var duplicateInspect = migrationStage5TInspectAllSourceDuplicateKeys_();
  result.source_duplicate_status = duplicateInspect.status;
  issues = issues.concat(duplicateInspect.issues || []);

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5THasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5T PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5TPreflight() {
  var startedAt = new Date();

  var result = migrationStage5TBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5TInspectSchemaAndSource();

  result.supabase_schemas = inspect.supabase_schemas;
  result.source_sheets = inspect.source_sheets;
  result.row_map_status = inspect.row_map_status;
  result.source_duplicate_status = inspect.source_duplicate_status;

  issues = issues.concat(inspect.issues || []);

  var sourceStatus = migrationStage5TReadAllSourceRowsStatus_();
  result.source_row_status = sourceStatus.status;
  issues = issues.concat(sourceStatus.issues || []);

  var targetStatus = migrationStage5TCheckTargetsEmpty_();
  result.target_table_status = targetStatus.status;
  issues = issues.concat(targetStatus.issues || []);

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5THasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5T SCHEMA INSPECT
 ************************************************************/

function migrationStage5TInspectAllTargetSchemas_() {
  var issues = [];
  var schemas = {};

  Object.keys(MIGRATION_STAGE_5T_TARGET_TABLES).forEach(function(key) {
    var targetTable = MIGRATION_STAGE_5T_TARGET_TABLES[key].target_table;
    var schema = migrationStage5TInspectSupabaseTableSchema_(targetTable);

    schemas[key] = schema.schema;

    if (!schema.success) {
      issues.push(migrationStage5TIssue_(
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
    success: migrationStage5THasNoBlockingIssues_(issues),
    schemas: schemas,
    issues: issues
  };
}


function migrationStage5TInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5TFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5TExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5TFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5TPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5TFetchOpenApiSchema_() {
  var config = migrationStage5TGetConfig_();

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
  var body = migrationStage5TParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5TExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5TFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5TPickPropertiesPreview_(properties) {
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
 * 5T SOURCE SHEET INSPECT
 ************************************************************/

function migrationStage5TInspectAllSourceSheets_() {
  var issues = [];
  var sourceSheets = {};

  Object.keys(MIGRATION_STAGE_5T_TARGET_TABLES).forEach(function(key) {
    var cfg = MIGRATION_STAGE_5T_TARGET_TABLES[key];
    var source = migrationStage5TInspectSourceSheet_(key, cfg);

    sourceSheets[key] = source.source_sheet;
    issues = issues.concat(source.issues || []);
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    source_sheets: sourceSheets,
    issues: issues
  };
}


function migrationStage5TInspectSourceSheet_(key, cfg) {
  var sheet = migrationStage5TFindSourceSheet_(cfg.source_sheet_aliases);

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5TIssue_(
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
    success: migrationStage5THasNoBlockingIssues_(rowsResult.issues || []),
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


function migrationStage5TFindSourceSheet_(aliases) {
  return migrationFindSheetByAliases_5K_(aliases);
}


function migrationStage5TReadSourceRows_(key) {
  var cfg = MIGRATION_STAGE_5T_TARGET_TABLES[key];

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
        migrationStage5TIssue_(
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

  var sheet = migrationStage5TFindSourceSheet_(cfg.source_sheet_aliases);

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
        migrationStage5TIssue_(
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
    success: migrationStage5THasNoBlockingIssues_(rowsResult.issues || []),
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


function migrationStage5TReadAllSourceRowsStatus_() {
  var issues = [];
  var status = {};

  Object.keys(MIGRATION_STAGE_5T_TARGET_TABLES).forEach(function(key) {
    var rowsResult = migrationStage5TReadSourceRows_(key);

    status[key] = rowsResult.status;
    issues = issues.concat(rowsResult.issues || []);
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5T ROW MAP INSPECTION
 ************************************************************/

function migrationStage5TInspectRequiredRowMaps_() {
  var issues = [];

  var billings = migrationStage5TInspectRowMapByTarget_('billings', 46);

  issues = issues.concat(billings.issues || []);

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      billings: billings.status
    }
  };
}


function migrationStage5TInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5TCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5TRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5TIssue_(
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
    issues.push(migrationStage5TIssue_(
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
    issues.push(migrationStage5TIssue_(
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
    success: migrationStage5THasNoBlockingIssues_(issues),
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
 * 5T SOURCE DUPLICATE INSPECTION — READ ONLY
 ************************************************************/

function migrationStage5TInspectAllSourceDuplicateKeys_() {
  var issues = [];
  var status = {};

  Object.keys(MIGRATION_STAGE_5T_TARGET_TABLES).forEach(function(key) {
    var result = migrationStage5TInspectSourceDuplicateKeys_(key);

    status[key] = result.status;
    issues = issues.concat(result.issues || []);
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


function migrationStage5TInspectSourceDuplicateKeys_(key) {
  var cfg = MIGRATION_STAGE_5T_TARGET_TABLES[key];
  var sourceRows = migrationStage5TReadSourceRows_(key);
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      issues: sourceRows.issues || [],
      status: {
        source_sheet: null,
        target_table: cfg ? cfg.target_table : '',
        total_rows: 0,
        unique_legacy_id_count: 0,
        duplicate_legacy_id_group_count: 0,
        duplicate_legacy_id_row_count: 0,
        missing_legacy_id_count: 0,
        missing_billing_id_count: 0,
        duplicate_groups_sample: []
      }
    };
  }

  var groups = {};
  var missingLegacyIdCount = 0;
  var missingBillingIdCount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var legacyId = migrationStage5TPick_(raw, cfg.legacy_id_candidates || ['id']);
    var billingId = migrationStage5TPick_(raw, ['billing_id', 'billingId']);

    var normalizedLegacyId = migrationNormalizeText_5K_(legacyId);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);

    if (!normalizedLegacyId) missingLegacyIdCount++;
    if (!normalizedBillingId) missingBillingIdCount++;

    if (!normalizedLegacyId) return;

    if (!groups[normalizedLegacyId]) {
      groups[normalizedLegacyId] = [];
    }

    groups[normalizedLegacyId].push({
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      legacy_id: normalizedLegacyId,
      billing_id: normalizedBillingId || null
    });
  });

  var duplicateGroups = [];
  var duplicateRowCount = 0;

  Object.keys(groups).sort().forEach(function(legacyId) {
    var rows = groups[legacyId];

    if (rows.length > 1) {
      duplicateGroups.push({
        legacy_id: legacyId,
        duplicate_count: rows.length,
        rows: rows
      });

      duplicateRowCount += rows.length;
    }
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      source_sheet: sourceRows.status.source_sheet,
      target_table: cfg.target_table,
      total_rows: sourceRows.status.non_blank_payload_row_count,
      unique_legacy_id_count: Object.keys(groups).length,
      duplicate_legacy_id_group_count: duplicateGroups.length,
      duplicate_legacy_id_row_count: duplicateRowCount,
      missing_legacy_id_count: missingLegacyIdCount,
      missing_billing_id_count: missingBillingIdCount,
      duplicate_groups_sample: duplicateGroups.slice(0, 20)
    }
  };
}

/************************************************************
 * 5T-B DRY-RUN PAYLOAD — READ ONLY
 ************************************************************/

function runMigrationStage5TDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5TBaseResult_('dry_run_payload_read_only');
  var dryRun = migrationStage5TBuildDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5THasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5TBuildDryRunPayload_() {
  var issues = [];

  var billingMap = migrationStage5TLoadLegacyMap_('billings');
  var userMap = migrationStage5TLoadLegacyMap_('app_users');

  issues = issues
    .concat(billingMap.issues || [])
    .concat(userMap.issues || []);

  var adjustments = migrationStage5TBuildBillingAdjustmentsPayload_(billingMap, userMap);
  var installments = migrationStage5TBuildBillingInstallmentsPayload_(billingMap);
  var installmentSourceMap = migrationStage5TBuildInstallmentSourceMap_(installments.payloads || []);
  var payments = migrationStage5TBuildPaymentsPayload_(billingMap, userMap, installmentSourceMap);

  issues = issues
    .concat(adjustments.issues || [])
    .concat(installments.issues || [])
    .concat(payments.issues || []);

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: {
      parent_maps: {
        billings: billingMap.count || 0,
        app_users: userMap.count || 0,
        billing_installments_source_map: installmentSourceMap.count || 0
      },
      billing_adjustments: adjustments.status,
      billing_installments: installments.status,
      payments: payments.status,
      totals: {
        adjustment_total: adjustments.status.total_amount || 0,
        installment_amount_total: installments.status.amount_total || 0,
        installment_paid_total: installments.status.paid_total || 0,
        installment_outstanding_total: installments.status.outstanding_total || 0,
        payment_total: payments.status.total_amount || 0
      },
      blocking_issue_count: migrationStage5TCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5TCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: {
      billing_adjustments: adjustments.payloads || [],
      billing_installments: installments.payloads || [],
      payments: payments.payloads || []
    },
    sample_payloads: {
      billing_adjustments: (adjustments.payloads || []).slice(0, 5),
      billing_installments: (installments.payloads || []).slice(0, 5),
      payments: (payments.payloads || []).slice(0, 10)
    },
    sample_issues: []
      .concat(adjustments.sample_issues || [])
      .concat(installments.sample_issues || [])
      .concat(payments.sample_issues || [])
      .slice(0, 20),
    issues: issues
  };
}


function migrationStage5TBuildBillingAdjustmentsPayload_(billingMap, userMap) {
  var sourceRows = migrationStage5TReadSourceRows_('billing_adjustments');
  var issues = [];
  var sampleIssues = [];
  var payloads = [];

  if (!sourceRows.success) {
    return migrationStage5TEmptyPayloadResult_(sourceRows, sourceRows.issues || []);
  }

  var mappedCount = 0;
  var missingParentCount = 0;
  var missingUserCount = 0;
  var totalAmount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var adjustmentId = migrationStage5TPick_(raw, ['adjustment_id', 'billing_adjustment_id', 'id']);
    var billingId = migrationStage5TPick_(raw, ['billing_id', 'billingId']);
    var adjustmentType = migrationStage5TPick_(raw, ['adjustment_type', 'type']);
    var label = migrationStage5TPick_(raw, ['label']);
    var amount = migrationStage5TPick_(raw, ['amount']);
    var reason = migrationStage5TPick_(raw, ['reason', 'notes', 'note']);
    var createdBy = migrationStage5TPick_(raw, ['created_by', 'createdBy']);
    var createdAt = migrationStage5TPick_(raw, ['created_at', 'createdAt']);
    var updatedAt = migrationStage5TPick_(raw, ['updated_at', 'updatedAt']);

    var normalizedAdjustmentId = migrationNormalizeText_5K_(adjustmentId);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedCreatedBy = migrationNormalizeNullableText_5K_(createdBy);
    var normalizedAmount = migrationNormalizeNumber_5K_(amount) || 0;

    var billingUuid = normalizedBillingId
      ? (billingMap.map[normalizedBillingId] || null)
      : null;

    var createdByUuid = normalizedCreatedBy
      ? (userMap.map[normalizedCreatedBy] || null)
      : null;

    var normalizedReason = migrationNormalizeNullableText_5K_(reason);

    if (!normalizedReason) {
      normalizedReason = migrationNormalizeNullableText_5K_(label);
    }

    var payload = {
      adjustment_id: normalizedAdjustmentId,
      billing_id: normalizedBillingId,
      billing_uuid: billingUuid,
      adjustment_type: migrationNormalizeNullableText_5K_(adjustmentType),
      amount: normalizedAmount,
      reason: normalizedReason,
      created_by: normalizedCreatedBy,
      created_by_uuid: createdByUuid,
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5TParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.adjustment_id) {
      var missingIdIssue = migrationStage5TIssue_(
        'error',
        'billing_adjustments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_ADJUSTMENT_ID',
        'BillingAdjustments tidak memiliki adjustment_id.',
        { raw: raw }
      );

      issues.push(missingIdIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingIdIssue);
    }

    if (!payload.billing_id || !payload.billing_uuid) {
      missingParentCount++;

      var billingIssue = migrationStage5TIssue_(
        'error',
        'billing_adjustments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.adjustment_id,
        'BILLING_PARENT_NOT_MAPPED',
        'billing_id BillingAdjustments tidak ditemukan di migration_row_map billings.',
        { billing_id: payload.billing_id }
      );

      issues.push(billingIssue);
      if (sampleIssues.length < 10) sampleIssues.push(billingIssue);
    } else {
      mappedCount++;
    }

    if (payload.created_by && !payload.created_by_uuid) {
      missingUserCount++;

      var userIssue = migrationStage5TIssue_(
        'warning',
        'billing_adjustments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.adjustment_id,
        'CREATED_BY_USER_NOT_MAPPED',
        'created_by BillingAdjustments tidak ditemukan di migration_row_map app_users. Legacy ID tetap dibawa, created_by_uuid null.',
        { created_by: payload.created_by }
      );

      issues.push(userIssue);
      if (sampleIssues.length < 10) sampleIssues.push(userIssue);
    }

    totalAmount += normalizedAmount;
    payloads.push(payload);
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      mapped_count: mappedCount,
      missing_parent_count: missingParentCount,
      created_by_missing_user_count: missingUserCount,
      total_amount: totalAmount
    },
    payloads: payloads,
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5TBuildBillingInstallmentsPayload_(billingMap) {
  var sourceRows = migrationStage5TReadSourceRows_('billing_installments');
  var issues = [];
  var sampleIssues = [];
  var payloads = [];

  if (!sourceRows.success) {
    return migrationStage5TEmptyPayloadResult_(sourceRows, sourceRows.issues || []);
  }

  var mappedCount = 0;
  var missingParentCount = 0;
  var amountTotal = 0;
  var paidTotal = 0;
  var outstandingTotal = 0;
  var paymentStatusCounts = {};

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var installmentId = migrationStage5TPick_(raw, ['installment_id', 'billing_installment_id', 'id']);
    var billingId = migrationStage5TPick_(raw, ['billing_id', 'billingId']);
    var installmentNo = migrationStage5TPick_(raw, ['installment_no', 'no']);
    var dueDate = migrationStage5TPick_(raw, ['due_date']);
    var amountDue = migrationStage5TPick_(raw, ['amount_due', 'amount']);
    var paidAmount = migrationStage5TPick_(raw, ['paid_amount']);
    var status = migrationStage5TPick_(raw, ['status', 'payment_status']);
    var paidAt = migrationStage5TPick_(raw, ['paid_at']);
    var notes = migrationStage5TPick_(raw, ['notes', 'note']);
    var createdAt = migrationStage5TPick_(raw, ['created_at', 'createdAt']);
    var updatedAt = migrationStage5TPick_(raw, ['updated_at', 'updatedAt']);

    var normalizedInstallmentId = migrationNormalizeText_5K_(installmentId);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedAmount = migrationNormalizeNumber_5K_(amountDue) || 0;
    var normalizedPaidAmount = migrationNormalizeNumber_5K_(paidAmount) || 0;
    var normalizedOutstandingAmount = normalizedAmount - normalizedPaidAmount;
    var normalizedPaymentStatus = migrationNormalizeNullableText_5K_(status);

    var billingUuid = normalizedBillingId
      ? (billingMap.map[normalizedBillingId] || null)
      : null;

    var payload = {
      installment_id: normalizedInstallmentId,
      billing_id: normalizedBillingId,
      billing_uuid: billingUuid,
      installment_no: migrationStage5TNormalizeInteger_(installmentNo),
      due_date: migrationNormalizeDate_5K_(dueDate),
      amount: normalizedAmount,
      paid_amount: normalizedPaidAmount,
      outstanding_amount: normalizedOutstandingAmount,
      payment_status: normalizedPaymentStatus,
      notes: migrationNormalizeNullableText_5K_(notes || paidAt),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5TParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.billing_id || !payload.billing_uuid) {
      missingParentCount++;

      var billingIssue = migrationStage5TIssue_(
        'error',
        'billing_installments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.installment_id,
        'BILLING_PARENT_NOT_MAPPED',
        'billing_id BillingInstallments tidak ditemukan di migration_row_map billings.',
        { billing_id: payload.billing_id }
      );

      issues.push(billingIssue);
      if (sampleIssues.length < 10) sampleIssues.push(billingIssue);
    } else {
      mappedCount++;
    }

    if (normalizedPaymentStatus) {
      paymentStatusCounts[normalizedPaymentStatus] = (paymentStatusCounts[normalizedPaymentStatus] || 0) + 1;
    }

    amountTotal += normalizedAmount;
    paidTotal += normalizedPaidAmount;
    outstandingTotal += normalizedOutstandingAmount;

    payloads.push(payload);
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      mapped_count: mappedCount,
      missing_parent_count: missingParentCount,
      payment_status_counts: paymentStatusCounts,
      amount_total: amountTotal,
      paid_total: paidTotal,
      outstanding_total: outstandingTotal
    },
    payloads: payloads,
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5TBuildPaymentsPayload_(billingMap, userMap, installmentSourceMap) {
  var sourceRows = migrationStage5TReadSourceRows_('payments');
  var issues = [];
  var sampleIssues = [];
  var payloads = [];

  if (!sourceRows.success) {
    return migrationStage5TEmptyPayloadResult_(sourceRows, sourceRows.issues || []);
  }

  var mappedCount = 0;
  var missingParentCount = 0;
  var installmentReferenceCount = 0;
  var installmentMissingCount = 0;
  var receivedByMissingUserCount = 0;
  var totalAmount = 0;
  var paymentMethodCounts = {};
  var paymentScopeCounts = {};

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var paymentId = migrationStage5TPick_(raw, ['payment_id', 'id']);
    var billingId = migrationStage5TPick_(raw, ['billing_id', 'billingId']);
    var paymentScope = migrationStage5TPick_(raw, ['payment_scope']);
    var installmentId = migrationStage5TPick_(raw, ['installment_id', 'billing_installment_id']);
    var paymentDate = migrationStage5TPick_(raw, ['payment_date']);
    var paymentMethod = migrationStage5TPick_(raw, ['payment_method', 'method']);
    var amount = migrationStage5TPick_(raw, ['amount']);
    var referenceNo = migrationStage5TPick_(raw, ['reference_no', 'reference']);
    var receivedBy = migrationStage5TPick_(raw, ['received_by', 'receivedBy']);
    var notes = migrationStage5TPick_(raw, ['notes', 'note']);
    var createdAt = migrationStage5TPick_(raw, ['created_at', 'createdAt']);
    var updatedAt = migrationStage5TPick_(raw, ['updated_at', 'updatedAt']);

    var normalizedPaymentId = migrationNormalizeText_5K_(paymentId);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedInstallmentId = migrationNormalizeNullableText_5K_(installmentId);
    var normalizedReceivedBy = migrationNormalizeNullableText_5K_(receivedBy);
    var normalizedPaymentScope = migrationNormalizeNullableText_5K_(paymentScope);
    var normalizedPaymentMethod = migrationNormalizeNullableText_5K_(paymentMethod);
    var normalizedAmount = migrationNormalizeNumber_5K_(amount) || 0;

    var billingUuid = normalizedBillingId
      ? (billingMap.map[normalizedBillingId] || null)
      : null;

    var receivedByUuid = normalizedReceivedBy
      ? (userMap.map[normalizedReceivedBy] || null)
      : null;

    var installmentUuid = null;

    if (normalizedInstallmentId) {
      installmentReferenceCount++;

      if (installmentSourceMap.map[normalizedInstallmentId]) {
        installmentUuid = null;
      } else {
        installmentMissingCount++;

        var installmentIssue = migrationStage5TIssue_(
          'warning',
          'payments',
          rowObj.source_sheet,
          rowObj.source_row_number,
          normalizedPaymentId,
          'INSTALLMENT_PARENT_NOT_MAPPED_IN_DRY_RUN',
          'installment_id Payments belum bisa di-resolve saat dry-run. Jika source installment ada, UUID akan diisi setelah insert billing_installments.',
          { installment_id: normalizedInstallmentId }
        );

        issues.push(installmentIssue);
        if (sampleIssues.length < 10) sampleIssues.push(installmentIssue);
      }
    }

    var payload = {
      payment_id: normalizedPaymentId,
      billing_id: normalizedBillingId,
      billing_uuid: billingUuid,
      installment_id: normalizedInstallmentId,
      installment_uuid: installmentUuid,
      payment_date: migrationNormalizeDate_5K_(paymentDate),
      payment_method: normalizedPaymentMethod,
      amount: normalizedAmount,
      reference_no: migrationNormalizeNullableText_5K_(referenceNo),
      received_by: normalizedReceivedBy,
      received_by_uuid: receivedByUuid,
      notes: migrationNormalizeNullableText_5K_(notes || normalizedPaymentScope),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5TParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.payment_id) {
      var missingPaymentIssue = migrationStage5TIssue_(
        'error',
        'payments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_PAYMENT_ID',
        'Payments tidak memiliki payment_id.',
        { raw: raw }
      );

      issues.push(missingPaymentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingPaymentIssue);
    }

    if (!payload.billing_id || !payload.billing_uuid) {
      missingParentCount++;

      var billingIssue = migrationStage5TIssue_(
        'error',
        'payments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.payment_id,
        'BILLING_PARENT_NOT_MAPPED',
        'billing_id Payments tidak ditemukan di migration_row_map billings.',
        { billing_id: payload.billing_id }
      );

      issues.push(billingIssue);
      if (sampleIssues.length < 10) sampleIssues.push(billingIssue);
    } else {
      mappedCount++;
    }

    if (payload.received_by && !payload.received_by_uuid) {
      receivedByMissingUserCount++;

      var userIssue = migrationStage5TIssue_(
        'warning',
        'payments',
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.payment_id,
        'RECEIVED_BY_USER_NOT_MAPPED',
        'received_by Payments tidak ditemukan di migration_row_map app_users. Legacy ID tetap dibawa, received_by_uuid null.',
        { received_by: payload.received_by }
      );

      issues.push(userIssue);
      if (sampleIssues.length < 10) sampleIssues.push(userIssue);
    }

    if (normalizedPaymentMethod) {
      paymentMethodCounts[normalizedPaymentMethod] = (paymentMethodCounts[normalizedPaymentMethod] || 0) + 1;
    }

    if (normalizedPaymentScope) {
      paymentScopeCounts[normalizedPaymentScope] = (paymentScopeCounts[normalizedPaymentScope] || 0) + 1;
    }

    totalAmount += normalizedAmount;
    payloads.push(payload);
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      mapped_count: mappedCount,
      missing_parent_count: missingParentCount,
      installment_reference_count: installmentReferenceCount,
      installment_missing_count: installmentMissingCount,
      received_by_missing_user_count: receivedByMissingUserCount,
      payment_method_counts: paymentMethodCounts,
      payment_scope_counts: paymentScopeCounts,
      total_amount: totalAmount
    },
    payloads: payloads,
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5TBuildInstallmentSourceMap_(installmentPayloads) {
  var map = {};

  (installmentPayloads || []).forEach(function(row) {
    if (row.installment_id) {
      map[row.installment_id] = row;
    }
  });

  return {
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5TEmptyPayloadResult_(sourceRows, issues) {
  return {
    success: false,
    status: {
      source_sheet: sourceRows && sourceRows.status ? sourceRows.status.source_sheet : null,
      spreadsheet_row_count: 0,
      dry_run_payload_count: 0,
      mapped_count: 0,
      missing_parent_count: 0
    },
    payloads: [],
    sample_issues: issues || [],
    issues: issues || []
  };
}


function migrationStage5TLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5TRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5TIssue_(
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
    success: migrationStage5THasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5TNormalizeInteger_(value) {
  if (value === null || value === undefined || value === '') return null;

  var numberValue = Number(value);

  if (isNaN(numberValue)) return null;

  return Math.round(numberValue);
}


function migrationStage5TCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

/************************************************************
 * 5T-C INSERT + AUDIT
 ************************************************************/

function runMigrationStage5TInsertFinanceChildren() {
  var startedAt = new Date();

  var result = migrationStage5TBaseResult_('insert_finance_children_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5T_WRITE_ENABLED !== true) {
    issues.push(migrationStage5TIssue_(
      'error',
      '',
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5T_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert 5T staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5TIssue_(
      'error',
      '',
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5T sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5TPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      source_row_status: preflight.source_row_status || null,
      target_table_status: preflight.target_table_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        '',
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5T belum clean. Insert dibatalkan.',
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

    var targetEmpty = migrationStage5TCheckTargetsEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5TBuildDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5THasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var adjustmentRows = dryRun.payloads.billing_adjustments || [];
    var installmentRows = dryRun.payloads.billing_installments || [];
    var paymentRows = dryRun.payloads.payments || [];

    var adjustmentInsert = migrationStage5TInsertRows_(
      'billing_adjustments',
      adjustmentRows
    );

    if (!adjustmentInsert.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'billing_adjustments',
        '',
        '',
        '',
        'BILLING_ADJUSTMENTS_INSERT_FAILED',
        'Insert billing_adjustments ke Supabase staging gagal.',
        adjustmentInsert
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var installmentInsert = migrationStage5TInsertRows_(
      'billing_installments',
      installmentRows
    );

    if (!installmentInsert.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'billing_installments',
        '',
        '',
        '',
        'BILLING_INSTALLMENTS_INSERT_FAILED',
        'Insert billing_installments ke Supabase staging gagal.',
        installmentInsert
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var finalizedPayments = migrationStage5TApplyInstallmentUuidToPayments_(
      paymentRows,
      installmentInsert.rows || []
    );

    var paymentInsert = migrationStage5TInsertRows_(
      'payments',
      finalizedPayments
    );

    if (!paymentInsert.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'payments',
        '',
        '',
        '',
        'PAYMENTS_INSERT_FAILED',
        'Insert payments ke Supabase staging gagal.',
        paymentInsert
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var adjustmentRowMapRows = migrationStage5TBuildRowMapRows_(
      'billing_adjustments',
      adjustmentInsert.rows || []
    );

    var installmentRowMapRows = migrationStage5TBuildRowMapRows_(
      'billing_installments',
      installmentInsert.rows || []
    );

    var paymentRowMapRows = migrationStage5TBuildRowMapRows_(
      'payments',
      paymentInsert.rows || []
    );

    var adjustmentRowMapInsert = migrationStage5TInsertRows_(
      'migration_row_map',
      adjustmentRowMapRows
    );

    var installmentRowMapInsert = migrationStage5TInsertRows_(
      'migration_row_map',
      installmentRowMapRows
    );

    var paymentRowMapInsert = migrationStage5TInsertRows_(
      'migration_row_map',
      paymentRowMapRows
    );

    if (!adjustmentRowMapInsert.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'BILLING_ADJUSTMENTS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map billing_adjustments gagal.',
        adjustmentRowMapInsert
      ));
    }

    if (!installmentRowMapInsert.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'BILLING_INSTALLMENTS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map billing_installments gagal.',
        installmentRowMapInsert
      ));
    }

    if (!paymentRowMapInsert.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'PAYMENTS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map payments gagal.',
        paymentRowMapInsert
      ));
    }

    var issueRows = migrationStage5TBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5TInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5TIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5T gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5TAuditFinanceChildren();

    result.inserted_summary = {
      billing_adjustments: {
        target_table: 'billing_adjustments',
        inserted_count: adjustmentInsert.rows ? adjustmentInsert.rows.length : 0
      },
      billing_installments: {
        target_table: 'billing_installments',
        inserted_count: installmentInsert.rows ? installmentInsert.rows.length : 0
      },
      payments: {
        target_table: 'payments',
        inserted_count: paymentInsert.rows ? paymentInsert.rows.length : 0
      }
    };

    result.row_map_inserted_count = {
      billing_adjustments: adjustmentRowMapInsert.rows ? adjustmentRowMapInsert.rows.length : 0,
      billing_installments: installmentRowMapInsert.rows ? installmentRowMapInsert.rows.length : 0,
      payments: paymentRowMapInsert.rows ? paymentRowMapInsert.rows.length : 0
    };

    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5THasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5TIssue_(
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


function runMigrationStage5TAuditFinanceChildren() {
  var startedAt = new Date();

  var result = migrationStage5TBaseResult_('audit_finance_children_read_only');
  var issues = [];

  var adjustmentSource = migrationStage5TReadSourceRows_('billing_adjustments');
  var installmentSource = migrationStage5TReadSourceRows_('billing_installments');
  var paymentSource = migrationStage5TReadSourceRows_('payments');

  if (!adjustmentSource.success) issues = issues.concat(adjustmentSource.issues || []);
  if (!installmentSource.success) issues = issues.concat(installmentSource.issues || []);
  if (!paymentSource.success) issues = issues.concat(paymentSource.issues || []);

  var adjustmentSourceCount = adjustmentSource.status ? adjustmentSource.status.non_blank_payload_row_count : 0;
  var installmentSourceCount = installmentSource.status ? installmentSource.status.non_blank_payload_row_count : 0;
  var paymentSourceCount = paymentSource.status ? paymentSource.status.non_blank_payload_row_count : 0;

  var adjustmentAudit = migrationStage5TAuditSingleFinanceChildTable_(
    'billing_adjustments',
    adjustmentSourceCount
  );

  var installmentAudit = migrationStage5TAuditSingleFinanceChildTable_(
    'billing_installments',
    installmentSourceCount
  );

  var paymentAudit = migrationStage5TAuditSingleFinanceChildTable_(
    'payments',
    paymentSourceCount
  );

  issues = issues
    .concat(adjustmentAudit.issues || [])
    .concat(installmentAudit.issues || [])
    .concat(paymentAudit.issues || []);

  result.audit_status = {
    billing_adjustments: adjustmentAudit.status,
    billing_installments: installmentAudit.status,
    payments: paymentAudit.status,
    totals: {
      adjustment_total: adjustmentAudit.status.total_amount || 0,
      installment_amount_total: installmentAudit.status.amount_total || 0,
      installment_paid_total: installmentAudit.status.paid_total || 0,
      installment_outstanding_total: installmentAudit.status.outstanding_total || 0,
      payment_total: paymentAudit.status.total_amount || 0
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5THasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5TAuditSingleFinanceChildTable_(targetTable, spreadsheetCount) {
  var issues = [];

  var supabaseCount = migrationStage5TCountRows_(targetTable);
  var rowMapCount = migrationStage5TCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var nullBillingUuidCount = migrationStage5TCountRows_(
    targetTable,
    'billing_uuid=is.null'
  );

  var status = {
    spreadsheet_count: spreadsheetCount,
    supabase_count: supabaseCount.count,
    migration_row_map_count: rowMapCount.count,
    null_billing_uuid_count: nullBillingUuidCount.count
  };

  if (!supabaseCount.success) {
    issues.push(migrationStage5TIssue_(
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
    issues.push(migrationStage5TIssue_(
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
    issues.push(migrationStage5TIssue_(
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
    issues.push(migrationStage5TIssue_(
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

  if (nullBillingUuidCount.success && nullBillingUuidCount.count !== 0) {
    issues.push(migrationStage5TIssue_(
      'error',
      targetTable,
      '',
      '',
      '',
      'NULL_BILLING_UUID_FOUND',
      'Ada row ' + targetTable + ' dengan billing_uuid kosong.',
      {
        null_billing_uuid_count: nullBillingUuidCount.count
      }
    ));
  }

  if (targetTable === 'billing_adjustments') {
    var createdByNullCount = migrationStage5TCountRows_(
      targetTable,
      'created_by=not.is.null&created_by_uuid=is.null'
    );

    var adjustmentRowsAudit = migrationStage5TLoadAmountRowsAudit_(
      targetTable,
      'select=id,amount'
    );

    status.created_by_with_null_uuid_count = createdByNullCount.count;
    status.total_amount = adjustmentRowsAudit.total_amount || 0;

    if (createdByNullCount.success && createdByNullCount.count !== 0) {
      issues.push(migrationStage5TIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'CREATED_BY_UUID_MISSING',
        'Ada billing_adjustments dengan created_by terisi tetapi created_by_uuid kosong.',
        {
          created_by_with_null_uuid_count: createdByNullCount.count
        }
      ));
    }

    if (!adjustmentRowsAudit.success) {
      issues = issues.concat(adjustmentRowsAudit.issues || []);
    }
  }

  if (targetTable === 'billing_installments') {
    var installmentRowsAudit = migrationStage5TLoadInstallmentRowsAudit_();

    status.amount_total = installmentRowsAudit.amount_total || 0;
    status.paid_total = installmentRowsAudit.paid_total || 0;
    status.outstanding_total = installmentRowsAudit.outstanding_total || 0;
    status.installment_total_mismatch_count = installmentRowsAudit.total_mismatch_count || 0;

    if (!installmentRowsAudit.success) {
      issues = issues.concat(installmentRowsAudit.issues || []);
    }

    if (installmentRowsAudit.total_mismatch_count !== 0) {
      issues.push(migrationStage5TIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'INSTALLMENT_TOTAL_MISMATCH_FOUND',
        'Ada billing_installments dengan outstanding_amount tidak sama dengan amount - paid_amount.',
        {
          mismatch_count: installmentRowsAudit.total_mismatch_count
        }
      ));
    }
  }

  if (targetTable === 'payments') {
    var receivedByNullCount = migrationStage5TCountRows_(
      targetTable,
      'received_by=not.is.null&received_by_uuid=is.null'
    );

    var installmentRefNullCount = migrationStage5TCountRows_(
      targetTable,
      'installment_id=not.is.null&installment_uuid=is.null'
    );

    var paymentRowsAudit = migrationStage5TLoadAmountRowsAudit_(
      targetTable,
      'select=id,amount'
    );

    status.received_by_with_null_uuid_count = receivedByNullCount.count;
    status.installment_id_with_null_uuid_count = installmentRefNullCount.count;
    status.total_amount = paymentRowsAudit.total_amount || 0;

    if (receivedByNullCount.success && receivedByNullCount.count !== 0) {
      issues.push(migrationStage5TIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'RECEIVED_BY_UUID_MISSING',
        'Ada payments dengan received_by terisi tetapi received_by_uuid kosong.',
        {
          received_by_with_null_uuid_count: receivedByNullCount.count
        }
      ));
    }

    if (installmentRefNullCount.success && installmentRefNullCount.count !== 0) {
      issues.push(migrationStage5TIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'INSTALLMENT_UUID_MISSING',
        'Ada payments dengan installment_id terisi tetapi installment_uuid kosong.',
        {
          installment_id_with_null_uuid_count: installmentRefNullCount.count
        }
      ));
    }

    if (!paymentRowsAudit.success) {
      issues = issues.concat(paymentRowsAudit.issues || []);
    }
  }

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


function migrationStage5TApplyInstallmentUuidToPayments_(paymentRows, insertedInstallments) {
  var installmentUuidMap = {};

  (insertedInstallments || []).forEach(function(row) {
    if (row.installment_id && row.id) {
      installmentUuidMap[row.installment_id] = row.id;
    }
  });

  return (paymentRows || []).map(function(row) {
    var copy = {};

    Object.keys(row || {}).forEach(function(key) {
      copy[key] = row[key];
    });

    if (copy.installment_id && installmentUuidMap[copy.installment_id]) {
      copy.installment_uuid = installmentUuidMap[copy.installment_id];
    }

    return copy;
  });
}


function migrationStage5TBuildRowMapRows_(targetTable, insertedRows) {
  var now = migrationStage5TNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: migrationStage5TGetLegacyIdFromInsertedRow_(targetTable, row),
      target_table: targetTable,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5T_NAME,
      created_at: now
    };
  });
}


function migrationStage5TGetLegacyIdFromInsertedRow_(targetTable, row) {
  if (targetTable === 'billing_adjustments') return row.adjustment_id || '';
  if (targetTable === 'billing_installments') return row.installment_id || '';
  if (targetTable === 'payments') return row.payment_id || '';

  return '';
}


function migrationStage5TBuildMigrationIssueRows_(issues) {
  var now = migrationStage5TNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: migrationStage5TGetRelatedLegacyIdFromIssue_(issue),
      message: '[' + MIGRATION_STAGE_5T_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5T_NAME,
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


function migrationStage5TGetRelatedLegacyIdFromIssue_(issue) {
  var details = issue && issue.details ? issue.details : {};

  if (details.billing_id) return details.billing_id;
  if (details.installment_id) return details.installment_id;
  if (details.created_by) return details.created_by;
  if (details.received_by) return details.received_by;

  return '';
}


function migrationStage5TLoadAmountRowsAudit_(targetTable, selectQuery) {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var query = selectQuery + '&limit=' + pageSize + '&offset=' + offset;

    var response = migrationStage5TRequest_(
      'get',
      targetTable,
      query,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'LOAD_AMOUNT_AUDIT_ROWS_FAILED',
        'Gagal membaca ' + targetTable + ' untuk audit amount.',
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

  var totalAmount = 0;

  rows.forEach(function(row) {
    totalAmount += migrationNormalizeNumber_5K_(row.amount) || 0;
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    issues: issues,
    rows: rows,
    total_amount: totalAmount
  };
}


function migrationStage5TLoadInstallmentRowsAudit_() {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5TRequest_(
      'get',
      'billing_installments',
      'select=id,amount,paid_amount,outstanding_amount&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5TIssue_(
        'error',
        'billing_installments',
        '',
        '',
        '',
        'LOAD_INSTALLMENT_AUDIT_ROWS_FAILED',
        'Gagal membaca billing_installments untuk audit totals.',
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

  var amountTotal = 0;
  var paidTotal = 0;
  var outstandingTotal = 0;
  var totalMismatchCount = 0;

  rows.forEach(function(row) {
    var amount = migrationNormalizeNumber_5K_(row.amount) || 0;
    var paidAmount = migrationNormalizeNumber_5K_(row.paid_amount) || 0;
    var outstandingAmount = migrationNormalizeNumber_5K_(row.outstanding_amount) || 0;

    amountTotal += amount;
    paidTotal += paidAmount;
    outstandingTotal += outstandingAmount;

    if (outstandingAmount !== amount - paidAmount) {
      totalMismatchCount++;
    }
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    issues: issues,
    rows: rows,
    amount_total: amountTotal,
    paid_total: paidTotal,
    outstanding_total: outstandingTotal,
    total_mismatch_count: totalMismatchCount
  };
}


function migrationStage5TNormalizeRowsForInsert_(tableName, rows) {
  var columnsByTable = {
    billing_adjustments: [
      'adjustment_id',
      'billing_id',
      'billing_uuid',
      'adjustment_type',
      'amount',
      'reason',
      'created_by',
      'created_by_uuid',
      'created_at',
      'updated_at',
      'source_sheet',
      'source_row_number',
      'raw_snapshot'
    ],

    billing_installments: [
      'installment_id',
      'billing_id',
      'billing_uuid',
      'installment_no',
      'due_date',
      'amount',
      'paid_amount',
      'outstanding_amount',
      'payment_status',
      'notes',
      'created_at',
      'updated_at',
      'source_sheet',
      'source_row_number',
      'raw_snapshot'
    ],

    payments: [
      'payment_id',
      'billing_id',
      'billing_uuid',
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
      'source_sheet',
      'source_row_number',
      'raw_snapshot'
    ]
  };

  var columns = columnsByTable[tableName];

  if (!columns) {
    return (rows || []).map(function(row) {
      return migrationStage5TNullUndefinedValues_(row);
    });
  }

  return (rows || []).map(function(row) {
    var clean = {};

    columns.forEach(function(column) {
      clean[column] = row && row[column] !== undefined ? row[column] : null;
    });

    return clean;
  });
}


function migrationStage5TNullUndefinedValues_(row) {
  var clean = {};

  Object.keys(row || {}).forEach(function(key) {
    clean[key] = row[key] === undefined ? null : row[key];
  });

  return clean;
}


function migrationStage5TInsertRows_(tableName, rows) {
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
  var normalizedRows = migrationStage5TNormalizeRowsForInsert_(tableName, rows);

  for (var i = 0; i < normalizedRows.length; i += batchSize) {
    var chunk = normalizedRows.slice(i, i + batchSize);

    var response = migrationStage5TRequest_(
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
 * 5T TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5TCheckTargetsEmpty_() {
  var issues = [];
  var status = {};

  Object.keys(MIGRATION_STAGE_5T_TARGET_TABLES).forEach(function(key) {
    var targetTable = MIGRATION_STAGE_5T_TARGET_TABLES[key].target_table;

    var targetCount = migrationStage5TCountRows_(targetTable);
    var rowMapCount = migrationStage5TCountRows_(
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
      issues.push(migrationStage5TIssue_(
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
      issues.push(migrationStage5TIssue_(
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
      issues.push(migrationStage5TIssue_(
        'error',
        targetTable,
        '',
        '',
        '',
        'TARGET_TABLE_NOT_EMPTY',
        'Table ' + targetTable + ' staging tidak kosong. Insert awal 5T harus ditahan agar tidak duplikat.',
        {
          count: targetCount.count
        }
      ));
    }

    if (rowMapCount.success && rowMapCount.count !== 0) {
      issues.push(migrationStage5TIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'TARGET_ROW_MAP_NOT_EMPTY',
        'migration_row_map untuk ' + targetTable + ' sudah ada. Insert awal 5T harus ditahan agar tidak duplikat.',
        {
          target_table: targetTable,
          count: rowMapCount.count
        }
      ));
    }
  });

  return {
    success: migrationStage5THasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5T SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5TGetConfig_() {
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


function migrationStage5TRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5TGetConfig_();

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
  var parsedBody = migrationStage5TParseJsonSafely_(text);
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


function migrationStage5TCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5TRequest_(
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

  var count = migrationStage5TParseCountFromContentRange_(contentRange);

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
 * 5T GENERIC UTILITIES
 ************************************************************/

function migrationStage5TBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5TNowIso_(),
    stage: MIGRATION_STAGE_5T_NAME,
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


function migrationStage5TIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5THasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5TPick_(raw, candidates) {
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


function migrationStage5TParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5TParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5TNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5TGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5TGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5TLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}