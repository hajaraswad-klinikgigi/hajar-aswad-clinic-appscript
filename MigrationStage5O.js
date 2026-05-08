/************************************************************
 * MigrationStage5O.gs
 * Tahap 5O — Migrasi treatment_items ke Supabase staging
 *
 * 5O-A:
 * - Inspect schema treatment_items Supabase
 * - Inspect source sheet TreatmentItems
 * - Inspect row_map treatments dan service_catalog
 * - Inspect duplicate treatment_item_id legacy
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5O CONFIG
 ************************************************************/

var MIGRATION_STAGE_5O_NAME = '5O';
var MIGRATION_STAGE_5O_WRITE_ENABLED = false;

var MIGRATION_STAGE_5O_SOURCE_SHEET_ALIASES = [
  'TreatmentItems',
  'Treatment Items',
  'Treatment_Items',
  'treatment_items'
];

var MIGRATION_STAGE_5O_TARGET_TABLE = 'treatment_items';


/************************************************************
 * 5O PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5OInspectSchemaAndSourceLog() {
  var result = runMigrationStage5OInspectSchemaAndSource();
  migrationStage5OLogJson_('testMigrationStage5OInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5OPreflightLog() {
  var result = runMigrationStage5OPreflight();
  migrationStage5OLogJson_('testMigrationStage5OPreflight', result);
  return result;
}

function testMigrationStage5ODryRunPayloadLog() {
  var result = runMigrationStage5ODryRunPayload();
  migrationStage5OLogJson_('testMigrationStage5ODryRunPayload', result);
  return result;
}

function testMigrationStage5OInsertTreatmentItemsLog() {
  var result = runMigrationStage5OInsertTreatmentItems();
  migrationStage5OLogJson_('testMigrationStage5OInsertTreatmentItems', result);
  return result;
}


function testMigrationStage5OAuditTreatmentItemsLog() {
  var result = runMigrationStage5OAuditTreatmentItems();
  migrationStage5OLogJson_('testMigrationStage5OAuditTreatmentItems', result);
  return result;
}


/************************************************************
 * 5O-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5OInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5OBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5OInspectSupabaseTableSchema_(MIGRATION_STAGE_5O_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEMS_SCHEMA_NOT_FOUND',
      'Schema table treatment_items tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5OInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var rowMaps = migrationStage5OInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;

  if (!rowMaps.success) {
    issues = issues.concat(rowMaps.issues || []);
  }

  var duplicateInspect = migrationStage5OInspectDuplicateTreatmentItemIds_();
  result.duplicate_status = duplicateInspect.status;

  if (!duplicateInspect.success) {
    issues = issues.concat(duplicateInspect.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5OHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5O PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5OPreflight() {
  var startedAt = new Date();

  var result = migrationStage5OBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5OInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.row_map_status = inspect.row_map_status;
  result.duplicate_status = inspect.duplicate_status;

  issues = issues.concat(inspect.issues || []);

  var sourceRows = migrationStage5OReadTreatmentItemSourceRows_();
  result.treatment_item_source_status = sourceRows.status;

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var targetStatus = migrationStage5OCheckTargetTreatmentItemsEmpty_();
  result.target_table_status = targetStatus.status;

  if (!targetStatus.success) {
    issues = issues.concat(targetStatus.issues || []);
  }

  if (migrationStage5OHasNoBlockingIssues_(issues)) {
    var dryRun = runMigrationStage5ODryRunPayload();
    result.dry_run_status = dryRun.dry_run_status;
    result.sample_payloads = dryRun.sample_payloads;
    result.sample_issues = dryRun.sample_issues;

    issues = issues.concat(dryRun.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5OHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5O SOURCE SHEET
 ************************************************************/

function migrationStage5OInspectSourceSheet_() {
  var sheet = migrationStage5OFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5OIssue_(
          'error',
          MIGRATION_STAGE_5O_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber TreatmentItems tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5O_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 10);

  return {
    success: migrationStage5OHasNoBlockingIssues_(rowsResult.issues || []),
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


function migrationStage5OFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5O_SOURCE_SHEET_ALIASES);
}


function migrationStage5OReadTreatmentItemSourceRows_() {
  var sheet = migrationStage5OFindSourceSheet_();

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
        migrationStage5OIssue_(
          'error',
          MIGRATION_STAGE_5O_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber TreatmentItems tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5OHasNoBlockingIssues_(rowsResult.issues || []),
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
 * 5O ROW MAP INSPECTION
 ************************************************************/

function migrationStage5OInspectRequiredRowMaps_() {
  var issues = [];

  var treatments = migrationStage5OInspectRowMapByTarget_('treatments', 254);
  var serviceCatalog = migrationStage5OInspectRowMapByTarget_('service_catalog', 100);

  issues = issues
    .concat(treatments.issues || [])
    .concat(serviceCatalog.issues || []);

  return {
    success: migrationStage5OHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      treatments: treatments.status,
      service_catalog: serviceCatalog.status
    }
  };
}


function migrationStage5OInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5OCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5ORequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5OIssue_(
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
    issues.push(migrationStage5OIssue_(
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
    issues.push(migrationStage5OIssue_(
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
    success: migrationStage5OHasNoBlockingIssues_(issues),
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
 * 5O DUPLICATE INSPECTION — READ ONLY
 ************************************************************/

function migrationStage5OInspectDuplicateTreatmentItemIds_() {
  var sourceRows = migrationStage5OReadTreatmentItemSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      issues: sourceRows.issues || [],
      status: {
        source_sheet: null,
        total_rows: 0,
        unique_treatment_item_id_count: 0,
        duplicate_group_count: 0,
        duplicate_row_count: 0,
        missing_treatment_item_id_count: 0,
        missing_treatment_id_count: 0,
        missing_service_id_count: 0,
        duplicate_groups_sample: []
      }
    };
  }

  var groups = {};
  var missingTreatmentItemIdCount = 0;
  var missingTreatmentIdCount = 0;
  var missingServiceIdCount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var treatmentItemId = migrationStage5OPick_(raw, [
      'treatment_item_id',
      'treatmentItemId',
      'item_id',
      'id'
    ]);

    var treatmentId = migrationStage5OPick_(raw, [
      'treatment_id',
      'treatmentId'
    ]);

    var serviceId = migrationStage5OPick_(raw, [
      'service_id',
      'serviceId'
    ]);

    var normalizedTreatmentItemId = migrationNormalizeText_5K_(treatmentItemId);

    if (!normalizedTreatmentItemId) {
      missingTreatmentItemIdCount++;
    }

    if (!migrationNormalizeText_5K_(treatmentId)) {
      missingTreatmentIdCount++;
    }

    if (!migrationNormalizeText_5K_(serviceId)) {
      missingServiceIdCount++;
    }

    if (!normalizedTreatmentItemId) return;

    if (!groups[normalizedTreatmentItemId]) {
      groups[normalizedTreatmentItemId] = [];
    }

    groups[normalizedTreatmentItemId].push({
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      treatment_item_id: normalizedTreatmentItemId,
      treatment_id: migrationNormalizeNullableText_5K_(treatmentId),
      service_id: migrationNormalizeNullableText_5K_(serviceId)
    });
  });

  var duplicateGroups = [];
  var duplicateRowCount = 0;

  Object.keys(groups).sort().forEach(function(treatmentItemId) {
    var rows = groups[treatmentItemId];

    if (rows.length > 1) {
      duplicateGroups.push({
        treatment_item_id: treatmentItemId,
        duplicate_count: rows.length,
        rows: rows
      });

      duplicateRowCount += rows.length;
    }
  });

  return {
    success: migrationStage5OHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      source_sheet: sourceRows.status.source_sheet,
      total_rows: sourceRows.status.non_blank_payload_row_count,
      unique_treatment_item_id_count: Object.keys(groups).length,
      duplicate_group_count: duplicateGroups.length,
      duplicate_row_count: duplicateRowCount,
      missing_treatment_item_id_count: missingTreatmentItemIdCount,
      missing_treatment_id_count: missingTreatmentIdCount,
      missing_service_id_count: missingServiceIdCount,
      duplicate_groups_sample: duplicateGroups.slice(0, 20)
    }
  };
}

/************************************************************
 * 5O-B DRY-RUN PAYLOAD
 ************************************************************/

function runMigrationStage5ODryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5OBaseResult_('dry_run_payload_read_only');
  var dryRun = migrationStage5OBuildTreatmentItemDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5OHasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5OBuildTreatmentItemDryRunPayload_() {
  var sourceRows = migrationStage5OReadTreatmentItemSourceRows_();
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

  var treatmentMap = migrationStage5OLoadLegacyMap_('treatments');
  var serviceMap = migrationStage5OLoadLegacyMap_('service_catalog');
  var serviceMeta = migrationStage5OLoadServiceCatalogMeta_();
  var duplicateMeta = migrationStage5OBuildDuplicateMetaBySourceRow_();

  issues = issues
    .concat(treatmentMap.issues || [])
    .concat(serviceMap.issues || [])
    .concat(serviceMeta.issues || [])
    .concat(duplicateMeta.issues || []);

  var payloads = [];
  var sampleIssues = [];
  var mappingStatusCounts = {
    mapped: 0,
    missing_parent: 0
  };

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var treatmentItemId = migrationStage5OPick_(raw, [
      'treatment_item_id',
      'treatmentItemId',
      'item_id',
      'id'
    ]);

    var treatmentId = migrationStage5OPick_(raw, [
      'treatment_id',
      'treatmentId'
    ]);

    var serviceId = migrationStage5OPick_(raw, [
      'service_id',
      'serviceId'
    ]);

    var serviceName = migrationStage5OPick_(raw, [
      'service_name',
      'serviceName',
      'name'
    ]);

    var qty = migrationStage5OPick_(raw, [
      'qty',
      'quantity',
      'jumlah'
    ]);

    var unitPrice = migrationStage5OPick_(raw, [
      'unit_price',
      'price',
      'harga'
    ]);

    var subtotal = migrationStage5OPick_(raw, [
      'subtotal',
      'total',
      'amount'
    ]);

    var createdAt = migrationStage5OPick_(raw, [
      'created_at',
      'createdAt',
      'created_date'
    ]);

    var updatedAt = migrationStage5OPick_(raw, [
      'updated_at',
      'updatedAt',
      'updated_date'
    ]);

    var normalizedTreatmentItemId = migrationNormalizeText_5K_(treatmentItemId);
    var normalizedTreatmentId = migrationNormalizeText_5K_(treatmentId);
    var normalizedServiceId = migrationNormalizeText_5K_(serviceId);

    var treatmentUuid = normalizedTreatmentId ? treatmentMap.map[normalizedTreatmentId] : null;
    var serviceUuid = normalizedServiceId ? serviceMap.map[normalizedServiceId] : null;
    var serviceInfo = normalizedServiceId ? serviceMeta.map[normalizedServiceId] : null;

    var duplicateInfo = duplicateMeta.by_source_row_number[rowObj.source_row_number] || {
      legacy_duplicate_group: normalizedTreatmentItemId || null,
      legacy_duplicate_index: 1,
      legacy_duplicate_count: 1
    };

    var mappingStatus = 'mapped';

    if (!treatmentUuid || !serviceUuid) {
      mappingStatus = 'missing_parent';
    }

    var payload = {
      treatment_item_id: normalizedTreatmentItemId,
      treatment_id: normalizedTreatmentId,
      treatment_uuid: treatmentUuid,
      service_id: normalizedServiceId,
      service_uuid: serviceUuid,
      service_name: migrationNormalizeNullableText_5K_(serviceName),
      qty: migrationNormalizeNumber_5K_(qty),
      unit_price: migrationNormalizeNumber_5K_(unitPrice),
      subtotal: migrationNormalizeNumber_5K_(subtotal),
      is_ortho_install: serviceInfo ? serviceInfo.is_ortho_install === true : false,
      is_ortho_control: serviceInfo ? serviceInfo.is_ortho_control === true : false,
      mapping_status: mappingStatus,
      legacy_duplicate_group: duplicateInfo.legacy_duplicate_group,
      legacy_duplicate_index: duplicateInfo.legacy_duplicate_index,
      legacy_duplicate_count: duplicateInfo.legacy_duplicate_count,
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5OParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.treatment_item_id) {
      var missingItemIssue = migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_TREATMENT_ITEM_ID',
        'Treatment item tidak memiliki treatment_item_id.',
        { raw: raw }
      );

      issues.push(missingItemIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingItemIssue);
    }

    if (!payload.treatment_id) {
      var missingTreatmentIssue = migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_item_id,
        'MISSING_TREATMENT_ID',
        'Treatment item tidak memiliki treatment_id.'
      );

      issues.push(missingTreatmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingTreatmentIssue);
    } else if (!payload.treatment_uuid) {
      var missingTreatmentMapIssue = migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_item_id,
        'TREATMENT_PARENT_NOT_MAPPED',
        'treatment_id pada TreatmentItems tidak ditemukan di migration_row_map treatments.',
        { treatment_id: payload.treatment_id }
      );

      issues.push(missingTreatmentMapIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingTreatmentMapIssue);
    }

    if (!payload.service_id) {
      var missingServiceIssue = migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_item_id,
        'MISSING_SERVICE_ID',
        'Treatment item tidak memiliki service_id.'
      );

      issues.push(missingServiceIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingServiceIssue);
    } else if (!payload.service_uuid) {
      var missingServiceMapIssue = migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_item_id,
        'SERVICE_PARENT_NOT_MAPPED',
        'service_id pada TreatmentItems tidak ditemukan di migration_row_map service_catalog.',
        { service_id: payload.service_id }
      );

      issues.push(missingServiceMapIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingServiceMapIssue);
    }

    if (!serviceInfo && payload.service_id) {
      var missingServiceMetaIssue = migrationStage5OIssue_(
        'warning',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.treatment_item_id,
        'SERVICE_META_NOT_FOUND',
        'service_id tidak ditemukan saat membaca service_catalog meta. is_ortho flags diset false.',
        { service_id: payload.service_id }
      );

      issues.push(missingServiceMetaIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingServiceMetaIssue);
    }

    mappingStatusCounts[mappingStatus] = (mappingStatusCounts[mappingStatus] || 0) + 1;

    payloads.push(payload);
  });

  return {
    success: migrationStage5OHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      treatment_map_count: treatmentMap.count || 0,
      service_map_count: serviceMap.count || 0,
      service_meta_count: serviceMeta.count || 0,
      duplicate_group_count: duplicateMeta.duplicate_group_count || 0,
      duplicate_row_count: duplicateMeta.duplicate_row_count || 0,
      mapped_count: mappingStatusCounts.mapped || 0,
      missing_parent_count: mappingStatusCounts.missing_parent || 0,
      blocking_issue_count: migrationStage5OCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5OCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 10),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5OLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5ORequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5OIssue_(
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
    success: migrationStage5OHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5OLoadServiceCatalogMeta_() {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5ORequest_(
      'get',
      'service_catalog',
      'select=id,service_id,service_name,is_ortho_install,is_ortho_control&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5OIssue_(
        'error',
        'service_catalog',
        '',
        '',
        '',
        'LOAD_SERVICE_CATALOG_META_FAILED',
        'Gagal load service_catalog meta.',
        response
      ));

      break;
    }

    var rows = Array.isArray(response.body) ? response.body : [];

    rows.forEach(function(row) {
      if (row.service_id) {
        map[row.service_id] = {
          id: row.id,
          service_id: row.service_id,
          service_name: row.service_name,
          is_ortho_install: row.is_ortho_install === true,
          is_ortho_control: row.is_ortho_control === true
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
    success: migrationStage5OHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5OBuildDuplicateMetaBySourceRow_() {
  var sourceRows = migrationStage5OReadTreatmentItemSourceRows_();
  var issues = [];
  var groups = {};
  var bySourceRowNumber = {};

  if (!sourceRows.success) {
    return {
      success: false,
      issues: sourceRows.issues || [],
      by_source_row_number: {},
      duplicate_group_count: 0,
      duplicate_row_count: 0
    };
  }

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var treatmentItemId = migrationStage5OPick_(raw, [
      'treatment_item_id',
      'treatmentItemId',
      'item_id',
      'id'
    ]);

    var normalizedTreatmentItemId = migrationNormalizeText_5K_(treatmentItemId);

    if (!normalizedTreatmentItemId) return;

    if (!groups[normalizedTreatmentItemId]) {
      groups[normalizedTreatmentItemId] = [];
    }

    groups[normalizedTreatmentItemId].push(rowObj);
  });

  var duplicateGroupCount = 0;
  var duplicateRowCount = 0;

  Object.keys(groups).forEach(function(treatmentItemId) {
    var rows = groups[treatmentItemId];

    rows.sort(function(a, b) {
      return a.source_row_number - b.source_row_number;
    });

    if (rows.length > 1) {
      duplicateGroupCount++;
      duplicateRowCount += rows.length;
    }

    rows.forEach(function(rowObj, index) {
      bySourceRowNumber[rowObj.source_row_number] = {
        legacy_duplicate_group: treatmentItemId,
        legacy_duplicate_index: index + 1,
        legacy_duplicate_count: rows.length
      };
    });
  });

  return {
    success: true,
    issues: issues,
    by_source_row_number: bySourceRowNumber,
    duplicate_group_count: duplicateGroupCount,
    duplicate_row_count: duplicateRowCount
  };
}


function migrationStage5OCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

function runMigrationStage5OInsertTreatmentItems() {
  var startedAt = new Date();

  var result = migrationStage5OBaseResult_('insert_treatment_items_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5O_WRITE_ENABLED !== true) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5O_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert treatment_items staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5O sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5OPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      treatment_item_source_status: preflight.treatment_item_source_status || null,
      target_table_status: preflight.target_table_status || null,
      dry_run_status: preflight.dry_run_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5O belum clean. Insert treatment_items dibatalkan.',
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

    var targetEmpty = migrationStage5OCheckTargetTreatmentItemsEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5OBuildTreatmentItemDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5OHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5OInsertRows_(
      MIGRATION_STAGE_5O_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        '',
        '',
        '',
        'TREATMENT_ITEMS_INSERT_FAILED',
        'Insert treatment_items ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5OBuildTreatmentItemRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5OInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5OIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'TREATMENT_ITEM_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map treatment_items gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5OBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5OInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5OIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5O gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5OAuditTreatmentItems();

    result.inserted_summary = {
      treatment_items: {
        target_table: MIGRATION_STAGE_5O_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5OHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
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


function runMigrationStage5OAuditTreatmentItems() {
  var startedAt = new Date();

  var result = migrationStage5OBaseResult_('audit_treatment_items_read_only');
  var issues = [];

  var sourceRows = migrationStage5OReadTreatmentItemSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5OCountRows_(MIGRATION_STAGE_5O_TARGET_TABLE);
  var rowMapCount = migrationStage5OCountRows_(
    'migration_row_map',
    'target_table=eq.treatment_items'
  );
  var nullTreatmentUuidCount = migrationStage5OCountRows_(
    MIGRATION_STAGE_5O_TARGET_TABLE,
    'treatment_uuid=is.null'
  );
  var nullServiceUuidCount = migrationStage5OCountRows_(
    MIGRATION_STAGE_5O_TARGET_TABLE,
    'service_uuid=is.null'
  );
  var missingParentStatusCount = migrationStage5OCountRows_(
    MIGRATION_STAGE_5O_TARGET_TABLE,
    'mapping_status=eq.missing_parent'
  );
  var nonMappedStatusCount = migrationStage5OCountRows_(
    MIGRATION_STAGE_5O_TARGET_TABLE,
    'mapping_status=neq.mapped'
  );
  var duplicateRowCount = migrationStage5OCountRows_(
    MIGRATION_STAGE_5O_TARGET_TABLE,
    'legacy_duplicate_count=gt.1'
  );

  var duplicateAudit = migrationStage5OLoadTreatmentItemDuplicateAudit_();

  if (!supabaseCount.success) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEMS_COUNT_FAILED',
      'Gagal menghitung row treatment_items Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5OIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ITEM_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map treatment_items.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEMS_COUNT_MISMATCH',
      'Jumlah TreatmentItems Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5OIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ITEM_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map treatment_items tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullTreatmentUuidCount.success && nullTreatmentUuidCount.count !== 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEM_NULL_TREATMENT_UUID_FOUND',
      'Ada treatment_items dengan treatment_uuid kosong.',
      {
        null_treatment_uuid_count: nullTreatmentUuidCount.count
      }
    ));
  }

  if (nullServiceUuidCount.success && nullServiceUuidCount.count !== 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEM_NULL_SERVICE_UUID_FOUND',
      'Ada treatment_items dengan service_uuid kosong.',
      {
        null_service_uuid_count: nullServiceUuidCount.count
      }
    ));
  }

  if (missingParentStatusCount.success && missingParentStatusCount.count !== 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEM_MISSING_PARENT_STATUS_FOUND',
      'Ada treatment_items dengan mapping_status missing_parent.',
      {
        missing_parent_count: missingParentStatusCount.count
      }
    ));
  }

  if (nonMappedStatusCount.success && nonMappedStatusCount.count !== 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEM_NON_MAPPED_STATUS_FOUND',
      'Ada treatment_items dengan mapping_status selain mapped.',
      {
        non_mapped_count: nonMappedStatusCount.count
      }
    ));
  }

  if (!duplicateAudit.success) {
    issues = issues.concat(duplicateAudit.issues || []);
  }

  if (duplicateAudit.success && duplicateAudit.duplicate_group_count !== 46) {
    issues.push(migrationStage5OIssue_(
      'warning',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'DUPLICATE_GROUP_COUNT_UNEXPECTED',
      'Jumlah duplicate group treatment_items berbeda dari hasil inspect awal.',
      {
        expected_duplicate_group_count: 46,
        actual_duplicate_group_count: duplicateAudit.duplicate_group_count
      }
    ));
  }

  if (duplicateRowCount.success && duplicateRowCount.count !== 119) {
    issues.push(migrationStage5OIssue_(
      'warning',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'DUPLICATE_ROW_COUNT_UNEXPECTED',
      'Jumlah duplicate row treatment_items berbeda dari hasil inspect awal.',
      {
        expected_duplicate_row_count: 119,
        actual_duplicate_row_count: duplicateRowCount.count
      }
    ));
  }

  result.audit_status = {
    treatment_items: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_treatment_uuid_count: nullTreatmentUuidCount.count,
      null_service_uuid_count: nullServiceUuidCount.count,
      missing_parent_status_count: missingParentStatusCount.count,
      non_mapped_status_count: nonMappedStatusCount.count,
      duplicate_group_count: duplicateAudit.duplicate_group_count,
      duplicate_row_count: duplicateRowCount.count
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5OHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5OBuildTreatmentItemRowMapRows_(insertedRows) {
  var now = migrationStage5ONowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.treatment_item_id,
      target_table: MIGRATION_STAGE_5O_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: row.mapping_status || 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5O_NAME +
        '; source_table=TreatmentItems' +
        '; duplicate_group=' + (row.legacy_duplicate_group || '') +
        '; duplicate_index=' + (row.legacy_duplicate_index || '') +
        '; duplicate_count=' + (row.legacy_duplicate_count || ''),
      created_at: now
    };
  });
}


function migrationStage5OBuildMigrationIssueRows_(issues) {
  var now = migrationStage5ONowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: '',
      message: '[' + MIGRATION_STAGE_5O_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5O_NAME,
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


function migrationStage5OLoadTreatmentItemDuplicateAudit_() {
  var issues = [];
  var rowsResult = migrationStage5OLoadTreatmentItemsAuditRows_();

  if (!rowsResult.success) {
    return {
      success: false,
      issues: rowsResult.issues || [],
      duplicate_group_count: 0
    };
  }

  var groups = {};

  rowsResult.rows.forEach(function(row) {
    var group = row.legacy_duplicate_group;

    if (!group) return;

    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(row);
  });

  var duplicateGroupCount = 0;
  var invalidDuplicateMetaGroups = [];

  Object.keys(groups).forEach(function(group) {
    var rows = groups[group];

    if (rows.length > 1) {
      duplicateGroupCount++;
    }

    rows.forEach(function(row) {
      if (Number(row.legacy_duplicate_count) !== rows.length) {
        invalidDuplicateMetaGroups.push({
          legacy_duplicate_group: group,
          source_row_number: row.source_row_number,
          stored_duplicate_count: row.legacy_duplicate_count,
          actual_group_count: rows.length
        });
      }

      if (!row.legacy_duplicate_index || Number(row.legacy_duplicate_index) < 1) {
        invalidDuplicateMetaGroups.push({
          legacy_duplicate_group: group,
          source_row_number: row.source_row_number,
          invalid_duplicate_index: row.legacy_duplicate_index
        });
      }
    });
  });

  if (invalidDuplicateMetaGroups.length > 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'INVALID_DUPLICATE_METADATA',
      'Metadata duplikat treatment_items tidak konsisten.',
      {
        sample: invalidDuplicateMetaGroups.slice(0, 20),
        issue_count: invalidDuplicateMetaGroups.length
      }
    ));
  }

  return {
    success: migrationStage5OHasNoBlockingIssues_(issues),
    issues: issues,
    duplicate_group_count: duplicateGroupCount
  };
}


function migrationStage5OLoadTreatmentItemsAuditRows_() {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5ORequest_(
      'get',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      'select=id,treatment_item_id,source_row_number,legacy_duplicate_group,legacy_duplicate_index,legacy_duplicate_count,mapping_status,treatment_uuid,service_uuid&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5OIssue_(
        'error',
        MIGRATION_STAGE_5O_TARGET_TABLE,
        '',
        '',
        '',
        'LOAD_TREATMENT_ITEMS_AUDIT_ROWS_FAILED',
        'Gagal membaca treatment_items untuk audit metadata duplikat.',
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

  return {
    success: migrationStage5OHasNoBlockingIssues_(issues),
    issues: issues,
    rows: rows
  };
}


function migrationStage5OInsertRows_(tableName, rows) {
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

    var response = migrationStage5ORequest_(
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
 * 5O TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5OCheckTargetTreatmentItemsEmpty_() {
  var issues = [];

  var treatmentItemCount = migrationStage5OCountRows_(MIGRATION_STAGE_5O_TARGET_TABLE);
  var rowMapCount = migrationStage5OCountRows_(
    'migration_row_map',
    'target_table=eq.treatment_items'
  );

  var status = {
    treatment_items_count: treatmentItemCount.count,
    treatment_items_count_success: treatmentItemCount.success,
    treatment_item_row_map_count: rowMapCount.count,
    treatment_item_row_map_count_success: rowMapCount.success
  };

  if (!treatmentItemCount.success) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEMS_COUNT_FAILED',
      'Gagal menghitung table treatment_items.',
      treatmentItemCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5OIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ITEM_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map treatment_items.',
      rowMapCount
    ));
  }

  if (treatmentItemCount.success && treatmentItemCount.count !== 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      MIGRATION_STAGE_5O_TARGET_TABLE,
      '',
      '',
      '',
      'TREATMENT_ITEMS_TARGET_NOT_EMPTY',
      'Table treatment_items staging tidak kosong. Insert 5O awal harus ditahan agar tidak duplikat.',
      {
        count: treatmentItemCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5OIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TREATMENT_ITEM_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk treatment_items sudah ada. Insert 5O awal harus ditahan agar tidak duplikat.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5OHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5O SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5OInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5OFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5OExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5OFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5OPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5OFetchOpenApiSchema_() {
  var config = migrationStage5OGetConfig_();

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
  var body = migrationStage5OParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5OExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5OFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5OPickPropertiesPreview_(properties) {
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
 * 5O SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5OGetConfig_() {
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


function migrationStage5ORequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5OGetConfig_();

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
  var parsedBody = migrationStage5OParseJsonSafely_(text);
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


function migrationStage5OCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5ORequest_(
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

  var count = migrationStage5OParseCountFromContentRange_(contentRange);

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
 * 5O GENERIC UTILITIES
 ************************************************************/

function migrationStage5OBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5ONowIso_(),
    stage: MIGRATION_STAGE_5O_NAME,
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


function migrationStage5OIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5OHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5OPick_(raw, candidates) {
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


function migrationStage5OParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5OParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5ONowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5OGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5OGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5OLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}