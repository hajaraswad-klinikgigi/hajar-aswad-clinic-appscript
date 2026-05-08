/************************************************************
 * MigrationStage5S.gs
 * Tahap 5S — Migrasi finance child: billing_items
 *
 * 5S-A:
 * - Inspect schema billing_items Supabase
 * - Inspect source sheet BillingItems
 * - Validasi row_map billings, treatments, treatment_items, service_catalog
 * - Cek target staging masih kosong
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5S CONFIG
 ************************************************************/

var MIGRATION_STAGE_5S_NAME = '5S';
var MIGRATION_STAGE_5S_WRITE_ENABLED = false;

var MIGRATION_STAGE_5S_TARGET_TABLE = 'billing_items';

var MIGRATION_STAGE_5S_SOURCE_SHEET_ALIASES = [
  'BillingItems',
  'Billing Items',
  'Billing_Items',
  'billing_items'
];


/************************************************************
 * 5S PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5SInspectSchemaAndSourceLog() {
  var result = runMigrationStage5SInspectSchemaAndSource();
  migrationStage5SLogJson_('testMigrationStage5SInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5SPreflightLog() {
  var result = runMigrationStage5SPreflight();
  migrationStage5SLogJson_('testMigrationStage5SPreflight', result);
  return result;
}

function testMigrationStage5SDryRunPayloadLog() {
  var result = runMigrationStage5SDryRunPayload();
  migrationStage5SLogJson_('testMigrationStage5SDryRunPayload', result);
  return result;
}

function testMigrationStage5SInsertBillingItemsLog() {
  var result = runMigrationStage5SInsertBillingItems();
  migrationStage5SLogJson_('testMigrationStage5SInsertBillingItems', result);
  return result;
}


function testMigrationStage5SAuditBillingItemsLog() {
  var result = runMigrationStage5SAuditBillingItems();
  migrationStage5SLogJson_('testMigrationStage5SAuditBillingItems', result);
  return result;
}


/************************************************************
 * 5S-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5SInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5SBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5SInspectSupabaseTableSchema_(MIGRATION_STAGE_5S_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_ITEMS_SCHEMA_NOT_FOUND',
      'Schema table billing_items tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5SInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var rowMaps = migrationStage5SInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;

  if (!rowMaps.success) {
    issues = issues.concat(rowMaps.issues || []);
  }

  var duplicateInspect = migrationStage5SInspectSourceDuplicateKeys_();
  result.source_duplicate_status = duplicateInspect.status;

  if (!duplicateInspect.success) {
    issues = issues.concat(duplicateInspect.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5SHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5S PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5SPreflight() {
  var startedAt = new Date();

  var result = migrationStage5SBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5SInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.row_map_status = inspect.row_map_status;
  result.source_duplicate_status = inspect.source_duplicate_status;

  issues = issues.concat(inspect.issues || []);

  var sourceRows = migrationStage5SReadSourceRows_();
  result.source_row_status = sourceRows.status;

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var targetStatus = migrationStage5SCheckTargetEmpty_();
  result.target_table_status = targetStatus.status;

  if (!targetStatus.success) {
    issues = issues.concat(targetStatus.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5SHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5S SOURCE SHEET
 ************************************************************/

function migrationStage5SInspectSourceSheet_() {
  var sheet = migrationStage5SFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5SIssue_(
          'error',
          MIGRATION_STAGE_5S_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber BillingItems tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5S_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 10);

  return {
    success: migrationStage5SHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      target_table: MIGRATION_STAGE_5S_TARGET_TABLE,
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5SFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5S_SOURCE_SHEET_ALIASES);
}


function migrationStage5SReadSourceRows_() {
  var sheet = migrationStage5SFindSourceSheet_();

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
        migrationStage5SIssue_(
          'error',
          MIGRATION_STAGE_5S_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber BillingItems tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5SHasNoBlockingIssues_(rowsResult.issues || []),
    rows: rowsResult.rows || [],
    headers: rowsResult.headers || [],
    status: {
      source_sheet: sheet.getName(),
      target_table: MIGRATION_STAGE_5S_TARGET_TABLE,
      spreadsheet_row_count: rowsResult.row_count_total || 0,
      non_blank_payload_row_count: rowsResult.rows ? rowsResult.rows.length : 0,
      header_count: rowsResult.headers ? rowsResult.headers.length : 0
    },
    issues: rowsResult.issues || []
  };
}


/************************************************************
 * 5S ROW MAP INSPECTION
 ************************************************************/

function migrationStage5SInspectRequiredRowMaps_() {
  var issues = [];

  var billings = migrationStage5SInspectRowMapByTarget_('billings', 46);
  var treatments = migrationStage5SInspectRowMapByTarget_('treatments', 254);
  var treatmentItems = migrationStage5SInspectRowMapByTarget_('treatment_items', 489);
  var serviceCatalog = migrationStage5SInspectRowMapByTarget_('service_catalog', 100);

  issues = issues
    .concat(billings.issues || [])
    .concat(treatments.issues || [])
    .concat(treatmentItems.issues || [])
    .concat(serviceCatalog.issues || []);

  return {
    success: migrationStage5SHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      billings: billings.status,
      treatments: treatments.status,
      treatment_items: treatmentItems.status,
      service_catalog: serviceCatalog.status
    }
  };
}


function migrationStage5SInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5SCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5SRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5SIssue_(
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
    issues.push(migrationStage5SIssue_(
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
    issues.push(migrationStage5SIssue_(
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
    success: migrationStage5SHasNoBlockingIssues_(issues),
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
 * 5S SOURCE DUPLICATE INSPECTION — READ ONLY
 ************************************************************/

function migrationStage5SInspectSourceDuplicateKeys_() {
  var sourceRows = migrationStage5SReadSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      issues: sourceRows.issues || [],
      status: {
        source_sheet: null,
        total_rows: 0,
        unique_billing_item_id_count: 0,
        duplicate_billing_item_id_group_count: 0,
        duplicate_billing_item_id_row_count: 0,
        missing_billing_item_id_count: 0,
        missing_billing_id_count: 0,
        missing_treatment_item_id_count: 0,
        duplicate_groups_sample: []
      }
    };
  }

  var groups = {};
  var missingBillingItemIdCount = 0;
  var missingBillingIdCount = 0;
  var missingTreatmentItemIdCount = 0;

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var billingItemId = migrationStage5SPick_(raw, [
      'billing_item_id',
      'billingItemId',
      'item_id',
      'id'
    ]);

    var billingId = migrationStage5SPick_(raw, [
      'billing_id',
      'billingId'
    ]);

    var treatmentItemId = migrationStage5SPick_(raw, [
      'treatment_item_id',
      'treatmentItemId'
    ]);

    var normalizedBillingItemId = migrationNormalizeText_5K_(billingItemId);

    if (!normalizedBillingItemId) {
      missingBillingItemIdCount++;
    }

    if (!migrationNormalizeText_5K_(billingId)) {
      missingBillingIdCount++;
    }

    if (!migrationNormalizeText_5K_(treatmentItemId)) {
      missingTreatmentItemIdCount++;
    }

    if (!normalizedBillingItemId) return;

    if (!groups[normalizedBillingItemId]) {
      groups[normalizedBillingItemId] = [];
    }

    groups[normalizedBillingItemId].push({
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      billing_item_id: normalizedBillingItemId,
      billing_id: migrationNormalizeNullableText_5K_(billingId),
      treatment_item_id: migrationNormalizeNullableText_5K_(treatmentItemId)
    });
  });

  var duplicateGroups = [];
  var duplicateRowCount = 0;

  Object.keys(groups).sort().forEach(function(billingItemId) {
    var rows = groups[billingItemId];

    if (rows.length > 1) {
      duplicateGroups.push({
        billing_item_id: billingItemId,
        duplicate_count: rows.length,
        rows: rows
      });

      duplicateRowCount += rows.length;
    }
  });

  return {
    success: migrationStage5SHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      source_sheet: sourceRows.status.source_sheet,
      total_rows: sourceRows.status.non_blank_payload_row_count,
      unique_billing_item_id_count: Object.keys(groups).length,
      duplicate_billing_item_id_group_count: duplicateGroups.length,
      duplicate_billing_item_id_row_count: duplicateRowCount,
      missing_billing_item_id_count: missingBillingItemIdCount,
      missing_billing_id_count: missingBillingIdCount,
      missing_treatment_item_id_count: missingTreatmentItemIdCount,
      duplicate_groups_sample: duplicateGroups.slice(0, 20)
    }
  };
}

/************************************************************
 * 5S-B DRY-RUN PAYLOAD — READ ONLY
 ************************************************************/

function runMigrationStage5SDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5SBaseResult_('dry_run_payload_read_only');
  var dryRun = migrationStage5SBuildDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5SHasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5SBuildDryRunPayload_() {
  var sourceRows = migrationStage5SReadSourceRows_();
  var issues = [];

  if (!sourceRows.success) {
    return {
      success: false,
      status: {
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        mapped_count: 0,
        missing_parent_count: 0,
        ambiguous_count: 0,
        needs_review_count: 0,
        item_total_mismatch_count: 0,
        blocking_issue_count: 1,
        warning_issue_count: 0
      },
      payloads: [],
      sample_payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var billingMap = migrationStage5SLoadLegacyMap_('billings');
  var treatmentMap = migrationStage5SLoadLegacyMap_('treatments');
  var serviceMap = migrationStage5SLoadLegacyMap_('service_catalog');
  var treatmentItemIndex = migrationStage5SLoadTreatmentItemIndex_();

  issues = issues
    .concat(billingMap.issues || [])
    .concat(treatmentMap.issues || [])
    .concat(serviceMap.issues || [])
    .concat(treatmentItemIndex.issues || []);

  var payloads = [];
  var sampleIssues = [];

  var mappingStatusCounts = {
    mapped: 0,
    missing_parent: 0,
    ambiguous: 0,
    needs_review: 0
  };

  var itemTotalMismatchCount = 0;

  var totalSummary = {
    qty: 0,
    unit_price_total: 0,
    subtotal: 0
  };

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var billingItemId = migrationStage5SPick_(raw, [
      'billing_item_id',
      'billingItemId',
      'id'
    ]);

    var billingId = migrationStage5SPick_(raw, [
      'billing_id',
      'billingId'
    ]);

    var treatmentId = migrationStage5SPick_(raw, [
      'treatment_id',
      'treatmentId'
    ]);

    var treatmentItemId = migrationStage5SPick_(raw, [
      'treatment_item_id',
      'treatmentItemId'
    ]);

    var serviceId = migrationStage5SPick_(raw, [
      'service_id',
      'serviceId'
    ]);

    var serviceName = migrationStage5SPick_(raw, [
      'service_name',
      'serviceName'
    ]);

    var qty = migrationStage5SPick_(raw, [
      'qty',
      'quantity'
    ]);

    var unitPrice = migrationStage5SPick_(raw, [
      'unit_price',
      'price'
    ]);

    var subtotal = migrationStage5SPick_(raw, [
      'subtotal',
      'total'
    ]);

    var createdAt = migrationStage5SPick_(raw, [
      'created_at',
      'createdAt'
    ]);

    var updatedAt = migrationStage5SPick_(raw, [
      'updated_at',
      'updatedAt'
    ]);

    var normalizedBillingItemId = migrationNormalizeText_5K_(billingItemId);
    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedTreatmentId = migrationNormalizeNullableText_5K_(treatmentId);
    var normalizedTreatmentItemId = migrationNormalizeNullableText_5K_(treatmentItemId);
    var normalizedServiceId = migrationNormalizeNullableText_5K_(serviceId);

    var normalizedQty = migrationNormalizeNumber_5K_(qty) || 0;
    var normalizedUnitPrice = migrationNormalizeNumber_5K_(unitPrice) || 0;
    var normalizedSubtotal = migrationNormalizeNumber_5K_(subtotal) || 0;

    var billingUuid = normalizedBillingId
      ? (billingMap.map[normalizedBillingId] || null)
      : null;

    var treatmentUuid = normalizedTreatmentId
      ? (treatmentMap.map[normalizedTreatmentId] || null)
      : null;

    var serviceUuid = normalizedServiceId
      ? (serviceMap.map[normalizedServiceId] || null)
      : null;

    var itemMatch = migrationStage5SFindTreatmentItemMatch_(
      treatmentItemIndex,
      {
        treatment_item_id: normalizedTreatmentItemId,
        treatment_id: normalizedTreatmentId,
        service_id: normalizedServiceId,
        qty: normalizedQty,
        unit_price: normalizedUnitPrice,
        subtotal: normalizedSubtotal
      }
    );

    var treatmentItemUuid = itemMatch.uuid || null;

    if (!treatmentUuid && itemMatch.treatment_uuid) {
      treatmentUuid = itemMatch.treatment_uuid;
    }

    if (!serviceUuid && itemMatch.service_uuid) {
      serviceUuid = itemMatch.service_uuid;
    }

    var mappingStatus = 'mapped';
    var mappingNotes = [];

    var payload = {
      billing_item_id: normalizedBillingItemId,
      billing_id: normalizedBillingId,
      billing_uuid: billingUuid,
      treatment_id: normalizedTreatmentId,
      treatment_uuid: treatmentUuid,
      treatment_item_id: normalizedTreatmentItemId,
      treatment_item_uuid: treatmentItemUuid,
      service_id: normalizedServiceId,
      service_uuid: serviceUuid,
      service_name: migrationNormalizeNullableText_5K_(serviceName),
      qty: normalizedQty,
      unit_price: normalizedUnitPrice,
      subtotal: normalizedSubtotal,
      mapping_status: mappingStatus,
      mapping_note: '',
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5SParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    if (!payload.billing_item_id) {
      var missingBillingItemIssue = migrationStage5SIssue_(
        'error',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_BILLING_ITEM_ID',
        'BillingItems tidak memiliki billing_item_id.',
        { raw: raw }
      );

      issues.push(missingBillingItemIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingBillingItemIssue);
    }

    if (!payload.billing_id || !payload.billing_uuid) {
      mappingStatus = 'missing_parent';
      mappingNotes.push('billing_uuid_missing');

      var billingIssue = migrationStage5SIssue_(
        'error',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_item_id,
        'BILLING_PARENT_NOT_MAPPED',
        'billing_id BillingItems tidak ditemukan di migration_row_map billings.',
        { billing_id: payload.billing_id }
      );

      issues.push(billingIssue);
      if (sampleIssues.length < 10) sampleIssues.push(billingIssue);
    }

    if (payload.treatment_id && !payload.treatment_uuid) {
      mappingStatus = 'missing_parent';
      mappingNotes.push('treatment_uuid_missing');

      var treatmentIssue = migrationStage5SIssue_(
        'warning',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_item_id,
        'TREATMENT_PARENT_NOT_MAPPED',
        'treatment_id BillingItems tidak ditemukan di migration_row_map treatments. Legacy ID tetap dibawa, treatment_uuid akan null.',
        { treatment_id: payload.treatment_id }
      );

      issues.push(treatmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(treatmentIssue);
    }

    if (payload.service_id && !payload.service_uuid) {
      mappingStatus = 'missing_parent';
      mappingNotes.push('service_uuid_missing');

      var serviceIssue = migrationStage5SIssue_(
        'warning',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_item_id,
        'SERVICE_PARENT_NOT_MAPPED',
        'service_id BillingItems tidak ditemukan di migration_row_map service_catalog. Legacy ID tetap dibawa, service_uuid akan null.',
        { service_id: payload.service_id }
      );

      issues.push(serviceIssue);
      if (sampleIssues.length < 10) sampleIssues.push(serviceIssue);
    }

    if (itemMatch.status === 'ambiguous') {
      mappingStatus = 'ambiguous';
      mappingNotes.push('treatment_item_ambiguous');

      var ambiguousIssue = migrationStage5SIssue_(
        'warning',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_item_id,
        'TREATMENT_ITEM_MAPPING_AMBIGUOUS',
        'treatment_item_id BillingItems cocok ke lebih dari satu treatment_items Supabase.',
        itemMatch.details
      );

      issues.push(ambiguousIssue);
      if (sampleIssues.length < 10) sampleIssues.push(ambiguousIssue);
    } else if (itemMatch.status === 'missing') {
      if (mappingStatus === 'mapped') {
        mappingStatus = 'needs_review';
      }

      mappingNotes.push('treatment_item_uuid_missing');

      var missingItemIssue = migrationStage5SIssue_(
        'warning',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_item_id,
        'TREATMENT_ITEM_NOT_MAPPED',
        'treatment_item_id BillingItems tidak berhasil dicocokkan ke treatment_items Supabase.',
        itemMatch.details
      );

      issues.push(missingItemIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingItemIssue);
    } else if (itemMatch.status === 'mapped_relaxed') {
      mappingNotes.push('treatment_item_mapped_relaxed');
    } else {
      mappingNotes.push('treatment_item_mapped_exact');
    }

    var expectedSubtotal = normalizedQty * normalizedUnitPrice;

    if (expectedSubtotal !== normalizedSubtotal) {
      itemTotalMismatchCount++;

      var totalIssue = migrationStage5SIssue_(
        'error',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_item_id,
        'BILLING_ITEM_TOTAL_MISMATCH',
        'Subtotal BillingItems tidak sama dengan qty x unit_price.',
        {
          qty: normalizedQty,
          unit_price: normalizedUnitPrice,
          subtotal: normalizedSubtotal,
          expected_subtotal: expectedSubtotal
        }
      );

      issues.push(totalIssue);
      if (sampleIssues.length < 10) sampleIssues.push(totalIssue);
    }

    payload.mapping_status = mappingStatus;
    payload.mapping_note = mappingNotes.join('; ');

    mappingStatusCounts[mappingStatus] = (mappingStatusCounts[mappingStatus] || 0) + 1;

    totalSummary.qty += normalizedQty;
    totalSummary.unit_price_total += normalizedUnitPrice;
    totalSummary.subtotal += normalizedSubtotal;

    payloads.push(payload);
  });

  return {
    success: migrationStage5SHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      billing_map_count: billingMap.count || 0,
      treatment_map_count: treatmentMap.count || 0,
      service_map_count: serviceMap.count || 0,
      treatment_item_candidate_count: treatmentItemIndex.row_count || 0,
      mapped_count: mappingStatusCounts.mapped || 0,
      missing_parent_count: mappingStatusCounts.missing_parent || 0,
      ambiguous_count: mappingStatusCounts.ambiguous || 0,
      needs_review_count: mappingStatusCounts.needs_review || 0,
      item_total_mismatch_count: itemTotalMismatchCount,
      totals: totalSummary,
      blocking_issue_count: migrationStage5SCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5SCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 10),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5SLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5SRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5SIssue_(
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
    success: migrationStage5SHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5SLoadTreatmentItemIndex_() {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5SRequest_(
      'get',
      'treatment_items',
      'select=id,treatment_item_id,treatment_id,treatment_uuid,service_id,service_uuid,qty,unit_price,subtotal,source_row_number,mapping_status&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5SIssue_(
        'error',
        'treatment_items',
        '',
        '',
        '',
        'LOAD_TREATMENT_ITEMS_FAILED',
        'Gagal load treatment_items untuk mapping billing_items.',
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

  var exactIndex = {};
  var relaxedIndex = {};

  rows.forEach(function(row) {
    var exactKey = migrationStage5STreatmentItemExactKey_({
      treatment_item_id: row.treatment_item_id,
      treatment_id: row.treatment_id,
      service_id: row.service_id,
      qty: row.qty,
      unit_price: row.unit_price,
      subtotal: row.subtotal
    });

    var relaxedKey = migrationStage5STreatmentItemRelaxedKey_({
      treatment_item_id: row.treatment_item_id,
      treatment_id: row.treatment_id,
      service_id: row.service_id
    });

    if (!exactIndex[exactKey]) exactIndex[exactKey] = [];
    if (!relaxedIndex[relaxedKey]) relaxedIndex[relaxedKey] = [];

    exactIndex[exactKey].push(row);
    relaxedIndex[relaxedKey].push(row);
  });

  return {
    success: migrationStage5SHasNoBlockingIssues_(issues),
    issues: issues,
    rows: rows,
    row_count: rows.length,
    exact_index: exactIndex,
    relaxed_index: relaxedIndex
  };
}


function migrationStage5SFindTreatmentItemMatch_(index, criteria) {
  var exactKey = migrationStage5STreatmentItemExactKey_(criteria);
  var exactMatches = index.exact_index[exactKey] || [];

  if (exactMatches.length === 1) {
    return migrationStage5SBuildTreatmentItemMatch_('mapped_exact', exactMatches[0], {
      exact_key: exactKey
    });
  }

  if (exactMatches.length > 1) {
    return {
      status: 'ambiguous',
      uuid: null,
      treatment_uuid: null,
      service_uuid: null,
      details: {
        strategy: 'exact',
        exact_key: exactKey,
        match_count: exactMatches.length,
        sample_matches: exactMatches.slice(0, 5)
      }
    };
  }

  var relaxedKey = migrationStage5STreatmentItemRelaxedKey_(criteria);
  var relaxedMatches = index.relaxed_index[relaxedKey] || [];

  if (relaxedMatches.length === 1) {
    return migrationStage5SBuildTreatmentItemMatch_('mapped_relaxed', relaxedMatches[0], {
      relaxed_key: relaxedKey
    });
  }

  if (relaxedMatches.length > 1) {
    return {
      status: 'ambiguous',
      uuid: null,
      treatment_uuid: null,
      service_uuid: null,
      details: {
        strategy: 'relaxed',
        relaxed_key: relaxedKey,
        match_count: relaxedMatches.length,
        sample_matches: relaxedMatches.slice(0, 5)
      }
    };
  }

  return {
    status: 'missing',
    uuid: null,
    treatment_uuid: null,
    service_uuid: null,
    details: {
      exact_key: exactKey,
      relaxed_key: relaxedKey,
      criteria: criteria
    }
  };
}


function migrationStage5SBuildTreatmentItemMatch_(status, row, details) {
  return {
    status: status,
    uuid: row.id || null,
    treatment_uuid: row.treatment_uuid || null,
    service_uuid: row.service_uuid || null,
    details: details || {}
  };
}


function migrationStage5STreatmentItemExactKey_(criteria) {
  return [
    migrationNormalizeNullableText_5K_(criteria.treatment_item_id),
    migrationNormalizeNullableText_5K_(criteria.treatment_id),
    migrationNormalizeNullableText_5K_(criteria.service_id),
    migrationStage5SNumberKey_(criteria.qty),
    migrationStage5SNumberKey_(criteria.unit_price),
    migrationStage5SNumberKey_(criteria.subtotal)
  ].join('|');
}


function migrationStage5STreatmentItemRelaxedKey_(criteria) {
  return [
    migrationNormalizeNullableText_5K_(criteria.treatment_item_id),
    migrationNormalizeNullableText_5K_(criteria.treatment_id),
    migrationNormalizeNullableText_5K_(criteria.service_id)
  ].join('|');
}


function migrationStage5SNumberKey_(value) {
  var numberValue = migrationNormalizeNumber_5K_(value);

  if (numberValue === null || numberValue === undefined || isNaN(numberValue)) {
    return '';
  }

  return String(numberValue);
}


function migrationStage5SCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

/************************************************************
 * 5S-C INSERT + AUDIT
 ************************************************************/

function runMigrationStage5SInsertBillingItems() {
  var startedAt = new Date();

  var result = migrationStage5SBaseResult_('insert_billing_items_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5S_WRITE_ENABLED !== true) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5S_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert billing_items staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5S sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5SPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      source_row_status: preflight.source_row_status || null,
      target_table_status: preflight.target_table_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5SIssue_(
        'error',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5S belum clean. Insert billing_items dibatalkan.',
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

    var targetEmpty = migrationStage5SCheckTargetEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5SBuildDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5SHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5SInsertRows_(
      MIGRATION_STAGE_5S_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5SIssue_(
        'error',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        '',
        '',
        '',
        'BILLING_ITEMS_INSERT_FAILED',
        'Insert billing_items ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5SBuildRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5SInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5SIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'BILLING_ITEMS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map billing_items gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5SBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5SInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5SIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5S gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5SAuditBillingItems();

    result.inserted_summary = {
      billing_items: {
        target_table: MIGRATION_STAGE_5S_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5SHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
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


function runMigrationStage5SAuditBillingItems() {
  var startedAt = new Date();

  var result = migrationStage5SBaseResult_('audit_billing_items_read_only');
  var issues = [];

  var sourceRows = migrationStage5SReadSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5SCountRows_(MIGRATION_STAGE_5S_TARGET_TABLE);
  var rowMapCount = migrationStage5SCountRows_(
    'migration_row_map',
    'target_table=eq.billing_items'
  );

  var nullBillingUuidCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'billing_uuid=is.null'
  );

  var treatmentIdWithNullUuidCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'treatment_id=not.is.null&treatment_uuid=is.null'
  );

  var treatmentItemIdWithNullUuidCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'treatment_item_id=not.is.null&treatment_item_uuid=is.null'
  );

  var nullServiceUuidCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'service_uuid=is.null'
  );

  var mappedCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'mapping_status=eq.mapped'
  );

  var missingParentCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'mapping_status=eq.missing_parent'
  );

  var ambiguousCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'mapping_status=eq.ambiguous'
  );

  var needsReviewCount = migrationStage5SCountRows_(
    MIGRATION_STAGE_5S_TARGET_TABLE,
    'mapping_status=eq.needs_review'
  );

  var migrationIssueTreatmentMissingCount = migrationStage5SCountRows_(
    'migration_issues',
    'issue_type=eq.TREATMENT_PARENT_NOT_MAPPED&source_sheet=eq.BillingItems'
  );

  var migrationIssueTreatmentItemMissingCount = migrationStage5SCountRows_(
    'migration_issues',
    'issue_type=eq.TREATMENT_ITEM_NOT_MAPPED&source_sheet=eq.BillingItems'
  );

  var rowsAudit = migrationStage5SLoadBillingItemsAuditRows_();
  var totals = rowsAudit.totals || migrationStage5SBlankBillingItemTotals_();
  var itemTotalMismatchCount = rowsAudit.item_total_mismatch_count || 0;

  if (!supabaseCount.success) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_ITEMS_COUNT_FAILED',
      'Gagal menghitung row billing_items Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5SIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'BILLING_ITEMS_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map billing_items.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_ITEMS_COUNT_MISMATCH',
      'Jumlah BillingItems Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5SIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'BILLING_ITEMS_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map billing_items tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullBillingUuidCount.success && nullBillingUuidCount.count !== 0) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_ITEM_NULL_BILLING_UUID_FOUND',
      'Ada billing_items dengan billing_uuid kosong.',
      {
        null_billing_uuid_count: nullBillingUuidCount.count
      }
    ));
  }

  if (nullServiceUuidCount.success && nullServiceUuidCount.count !== 0) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_ITEM_NULL_SERVICE_UUID_FOUND',
      'Ada billing_items dengan service_uuid kosong.',
      {
        null_service_uuid_count: nullServiceUuidCount.count
      }
    ));
  }

  if (!rowsAudit.success) {
    issues = issues.concat(rowsAudit.issues || []);
  }

  if (itemTotalMismatchCount !== 0) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_ITEM_TOTAL_MISMATCH_FOUND',
      'Ada subtotal billing_items Supabase yang tidak sama dengan qty x unit_price.',
      {
        item_total_mismatch_count: itemTotalMismatchCount
      }
    ));
  }

  result.audit_status = {
    billing_items: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_billing_uuid_count: nullBillingUuidCount.count,
      treatment_id_with_null_uuid_count: treatmentIdWithNullUuidCount.count,
      treatment_item_id_with_null_uuid_count: treatmentItemIdWithNullUuidCount.count,
      null_service_uuid_count: nullServiceUuidCount.count,
      mapped_count: mappedCount.count,
      missing_parent_count: missingParentCount.count,
      ambiguous_count: ambiguousCount.count,
      needs_review_count: needsReviewCount.count,
      migration_issue_treatment_missing_parent_count: migrationIssueTreatmentMissingCount.count,
      migration_issue_treatment_item_not_mapped_count: migrationIssueTreatmentItemMissingCount.count,
      item_total_mismatch_count: itemTotalMismatchCount,
      totals: totals
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5SHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5SBuildRowMapRows_(insertedRows) {
  var now = migrationStage5SNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.billing_item_id,
      target_table: MIGRATION_STAGE_5S_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: row.mapping_status || 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5S_NAME + '; mapping_note=' + (row.mapping_note || ''),
      created_at: now
    };
  });
}


function migrationStage5SBuildMigrationIssueRows_(issues) {
  var now = migrationStage5SNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: migrationStage5SGetRelatedLegacyIdFromIssue_(issue),
      message: '[' + MIGRATION_STAGE_5S_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5S_NAME,
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


function migrationStage5SGetRelatedLegacyIdFromIssue_(issue) {
  var details = issue && issue.details ? issue.details : {};

  if (details.billing_id) return details.billing_id;
  if (details.treatment_id) return details.treatment_id;
  if (details.treatment_item_id) return details.treatment_item_id;
  if (details.service_id) return details.service_id;

  if (details.criteria && details.criteria.treatment_item_id) {
    return details.criteria.treatment_item_id;
  }

  return '';
}


function migrationStage5SLoadBillingItemsAuditRows_() {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5SRequest_(
      'get',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      'select=id,billing_item_id,qty,unit_price,subtotal,mapping_status&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5SIssue_(
        'error',
        MIGRATION_STAGE_5S_TARGET_TABLE,
        '',
        '',
        '',
        'LOAD_BILLING_ITEMS_AUDIT_ROWS_FAILED',
        'Gagal membaca billing_items untuk audit totals.',
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

  var totals = migrationStage5SBlankBillingItemTotals_();
  var itemTotalMismatchCount = 0;

  rows.forEach(function(row) {
    var qty = migrationNormalizeNumber_5K_(row.qty) || 0;
    var unitPrice = migrationNormalizeNumber_5K_(row.unit_price) || 0;
    var subtotal = migrationNormalizeNumber_5K_(row.subtotal) || 0;

    totals.qty += qty;
    totals.unit_price_total += unitPrice;
    totals.subtotal += subtotal;

    if (subtotal !== qty * unitPrice) {
      itemTotalMismatchCount++;
    }
  });

  return {
    success: migrationStage5SHasNoBlockingIssues_(issues),
    issues: issues,
    rows: rows,
    totals: totals,
    item_total_mismatch_count: itemTotalMismatchCount
  };
}


function migrationStage5SBlankBillingItemTotals_() {
  return {
    qty: 0,
    unit_price_total: 0,
    subtotal: 0
  };
}


function migrationStage5SNormalizeRowsForInsert_(tableName, rows) {
  if (tableName !== MIGRATION_STAGE_5S_TARGET_TABLE) {
    return (rows || []).map(function(row) {
      return migrationStage5SNullUndefinedValues_(row);
    });
  }

  var columns = [
    'billing_item_id',
    'billing_id',
    'billing_uuid',
    'treatment_id',
    'treatment_uuid',
    'treatment_item_id',
    'treatment_item_uuid',
    'service_id',
    'service_uuid',
    'service_name',
    'qty',
    'unit_price',
    'subtotal',
    'mapping_status',
    'mapping_note',
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


function migrationStage5SNullUndefinedValues_(row) {
  var clean = {};

  Object.keys(row || {}).forEach(function(key) {
    clean[key] = row[key] === undefined ? null : row[key];
  });

  return clean;
}


function migrationStage5SInsertRows_(tableName, rows) {
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
  var normalizedRows = migrationStage5SNormalizeRowsForInsert_(tableName, rows);

  for (var i = 0; i < normalizedRows.length; i += batchSize) {
    var chunk = normalizedRows.slice(i, i + batchSize);

    var response = migrationStage5SRequest_(
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
 * 5S TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5SCheckTargetEmpty_() {
  var issues = [];

  var targetCount = migrationStage5SCountRows_(MIGRATION_STAGE_5S_TARGET_TABLE);
  var rowMapCount = migrationStage5SCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(MIGRATION_STAGE_5S_TARGET_TABLE)
  );

  var status = {
    target_table: MIGRATION_STAGE_5S_TARGET_TABLE,
    target_count: targetCount.count,
    target_count_success: targetCount.success,
    row_map_count: rowMapCount.count,
    row_map_count_success: rowMapCount.success
  };

  if (!targetCount.success) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_COUNT_FAILED',
      'Gagal menghitung table billing_items.',
      targetCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5SIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map untuk billing_items.',
      rowMapCount
    ));
  }

  if (targetCount.success && targetCount.count !== 0) {
    issues.push(migrationStage5SIssue_(
      'error',
      MIGRATION_STAGE_5S_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_TABLE_NOT_EMPTY',
      'Table billing_items staging tidak kosong. Insert awal 5S harus ditahan agar tidak duplikat.',
      {
        count: targetCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5SIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk billing_items sudah ada. Insert awal 5S harus ditahan agar tidak duplikat.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5SHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5S SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5SInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5SFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5SExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5SFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5SPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5SFetchOpenApiSchema_() {
  var config = migrationStage5SGetConfig_();

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
  var body = migrationStage5SParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5SExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5SFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5SPickPropertiesPreview_(properties) {
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
 * 5S SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5SGetConfig_() {
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


function migrationStage5SRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5SGetConfig_();

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
  var parsedBody = migrationStage5SParseJsonSafely_(text);
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


function migrationStage5SCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5SRequest_(
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

  var count = migrationStage5SParseCountFromContentRange_(contentRange);

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
 * 5S GENERIC UTILITIES
 ************************************************************/

function migrationStage5SBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5SNowIso_(),
    stage: MIGRATION_STAGE_5S_NAME,
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


function migrationStage5SIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5SHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5SPick_(raw, candidates) {
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


function migrationStage5SParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5SParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5SNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5SGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5SGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5SLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}