/************************************************************
 * MigrationStage5R.gs
 * Tahap 5R — Migrasi finance parent: billings
 *
 * 5R-A:
 * - Inspect schema billings Supabase
 * - Inspect source sheet Billings
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
 * 5R CONFIG
 ************************************************************/

var MIGRATION_STAGE_5R_NAME = '5R';
var MIGRATION_STAGE_5R_WRITE_ENABLED = false;

var MIGRATION_STAGE_5R_TARGET_TABLE = 'billings';

var MIGRATION_STAGE_5R_SOURCE_SHEET_ALIASES = [
  'Billings',
  'Billing',
  'billings'
];


/************************************************************
 * 5R PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5RInspectSchemaAndSourceLog() {
  var result = runMigrationStage5RInspectSchemaAndSource();
  migrationStage5RLogJson_('testMigrationStage5RInspectSchemaAndSource', result);
  return result;
}


function testMigrationStage5RPreflightLog() {
  var result = runMigrationStage5RPreflight();
  migrationStage5RLogJson_('testMigrationStage5RPreflight', result);
  return result;
}

function testMigrationStage5RDryRunPayloadLog() {
  var result = runMigrationStage5RDryRunPayload();
  migrationStage5RLogJson_('testMigrationStage5RDryRunPayload', result);
  return result;
}

function testMigrationStage5RInsertBillingsLog() {
  var result = runMigrationStage5RInsertBillings();
  migrationStage5RLogJson_('testMigrationStage5RInsertBillings', result);
  return result;
}


function testMigrationStage5RAuditBillingsLog() {
  var result = runMigrationStage5RAuditBillings();
  migrationStage5RLogJson_('testMigrationStage5RAuditBillings', result);
  return result;
}


/************************************************************
 * 5R-A — INSPECT SCHEMA + SOURCE, READ ONLY
 ************************************************************/

function runMigrationStage5RInspectSchemaAndSource() {
  var startedAt = new Date();

  var result = migrationStage5RBaseResult_('inspect_schema_and_source_read_only');
  var issues = [];

  var schema = migrationStage5RInspectSupabaseTableSchema_(MIGRATION_STAGE_5R_TARGET_TABLE);
  result.supabase_schema = schema.schema;

  if (!schema.success) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'BILLINGS_SCHEMA_NOT_FOUND',
      'Schema table billings tidak ditemukan di Supabase OpenAPI.',
      schema
    ));
  }

  var source = migrationStage5RInspectSourceSheet_();
  result.source_sheet = source.source_sheet;

  if (!source.success) {
    issues = issues.concat(source.issues || []);
  }

  var rowMaps = migrationStage5RInspectRequiredRowMaps_();
  result.row_map_status = rowMaps.status;

  if (!rowMaps.success) {
    issues = issues.concat(rowMaps.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5RHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5R PREFLIGHT — READ ONLY
 ************************************************************/

function runMigrationStage5RPreflight() {
  var startedAt = new Date();

  var result = migrationStage5RBaseResult_('preflight_read_only');
  var issues = [];

  var inspect = runMigrationStage5RInspectSchemaAndSource();

  result.supabase_schema = inspect.supabase_schema;
  result.source_sheet = inspect.source_sheet;
  result.row_map_status = inspect.row_map_status;

  issues = issues.concat(inspect.issues || []);

  var sourceRows = migrationStage5RReadSourceRows_();
  result.source_row_status = sourceRows.status;

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var targetStatus = migrationStage5RCheckTargetEmpty_();
  result.target_table_status = targetStatus.status;

  if (!targetStatus.success) {
    issues = issues.concat(targetStatus.issues || []);
  }

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5RHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5R SOURCE SHEET
 ************************************************************/

function migrationStage5RInspectSourceSheet_() {
  var sheet = migrationStage5RFindSourceSheet_();

  if (!sheet) {
    return {
      success: false,
      source_sheet: null,
      issues: [
        migrationStage5RIssue_(
          'error',
          MIGRATION_STAGE_5R_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber Billings tidak ditemukan.',
          {
            aliases: MIGRATION_STAGE_5R_SOURCE_SHEET_ALIASES
          }
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 10);

  return {
    success: migrationStage5RHasNoBlockingIssues_(rowsResult.issues || []),
    source_sheet: {
      name: sheet.getName(),
      target_table: MIGRATION_STAGE_5R_TARGET_TABLE,
      last_row: sheet.getLastRow(),
      last_column: sheet.getLastColumn(),
      data_row_count: Math.max(sheet.getLastRow() - 1, 0),
      headers: rowsResult.headers,
      preview_rows: rowsResult.rows
    },
    issues: rowsResult.issues || []
  };
}


function migrationStage5RFindSourceSheet_() {
  return migrationFindSheetByAliases_5K_(MIGRATION_STAGE_5R_SOURCE_SHEET_ALIASES);
}


function migrationStage5RReadSourceRows_() {
  var sheet = migrationStage5RFindSourceSheet_();

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
        migrationStage5RIssue_(
          'error',
          MIGRATION_STAGE_5R_TARGET_TABLE,
          '',
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber Billings tidak ditemukan.'
        )
      ]
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());

  return {
    success: migrationStage5RHasNoBlockingIssues_(rowsResult.issues || []),
    rows: rowsResult.rows || [],
    headers: rowsResult.headers || [],
    status: {
      source_sheet: sheet.getName(),
      target_table: MIGRATION_STAGE_5R_TARGET_TABLE,
      spreadsheet_row_count: rowsResult.row_count_total || 0,
      non_blank_payload_row_count: rowsResult.rows ? rowsResult.rows.length : 0,
      header_count: rowsResult.headers ? rowsResult.headers.length : 0
    },
    issues: rowsResult.issues || []
  };
}


/************************************************************
 * 5R ROW MAP INSPECTION
 ************************************************************/

function migrationStage5RInspectRequiredRowMaps_() {
  var issues = [];

  var patients = migrationStage5RInspectRowMapByTarget_('patients', 285);
  var appointments = migrationStage5RInspectRowMapByTarget_('appointments', 284);
  var treatments = migrationStage5RInspectRowMapByTarget_('treatments', 254);

  issues = issues
    .concat(patients.issues || [])
    .concat(appointments.issues || [])
    .concat(treatments.issues || []);

  return {
    success: migrationStage5RHasNoBlockingIssues_(issues),
    issues: issues,
    status: {
      patients: patients.status,
      appointments: appointments.status,
      treatments: treatments.status
    }
  };
}


function migrationStage5RInspectRowMapByTarget_(targetTable, expectedCount) {
  var issues = [];

  var countResult = migrationStage5RCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(targetTable)
  );

  var sampleResult = migrationStage5RRequest_(
    'get',
    'migration_row_map',
    'select=id,source_sheet,source_row_number,legacy_id,target_table,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=5',
    null,
    {}
  );

  if (!countResult.success) {
    issues.push(migrationStage5RIssue_(
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
    issues.push(migrationStage5RIssue_(
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
    issues.push(migrationStage5RIssue_(
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
    success: migrationStage5RHasNoBlockingIssues_(issues),
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
 * 5R-B DRY-RUN PAYLOAD — READ ONLY
 ************************************************************/

function runMigrationStage5RDryRunPayload() {
  var startedAt = new Date();

  var result = migrationStage5RBaseResult_('dry_run_payload_read_only');
  var dryRun = migrationStage5RBuildDryRunPayload_();

  result.dry_run_status = dryRun.status;
  result.sample_payloads = dryRun.sample_payloads;
  result.sample_issues = dryRun.sample_issues;
  result.issues = dryRun.issues || [];
  result.issue_count = result.issues.length;
  result.success = migrationStage5RHasNoBlockingIssues_(result.issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5RBuildDryRunPayload_() {
  var sourceRows = migrationStage5RReadSourceRows_();
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
        total_mismatch_count: 0,
        blocking_issue_count: 1,
        warning_issue_count: 0
      },
      payloads: [],
      sample_payloads: [],
      sample_issues: sourceRows.issues || [],
      issues: sourceRows.issues || []
    };
  }

  var patientMap = migrationStage5RLoadLegacyMap_('patients');
  var appointmentMap = migrationStage5RLoadLegacyMap_('appointments');
  var treatmentMap = migrationStage5RLoadLegacyMap_('treatments');

  issues = issues
    .concat(patientMap.issues || [])
    .concat(appointmentMap.issues || [])
    .concat(treatmentMap.issues || []);

  var payloads = [];
  var sampleIssues = [];

  var mappedCount = 0;
  var missingParentCount = 0;
  var totalMismatchCount = 0;

  var paymentStatusCounts = {};
  var billingStatusCounts = {};
  var paymentTypeCounts = {};

  var totalSummary = {
    subtotal: 0,
    discount_total: 0,
    grand_total: 0,
    paid_total: 0,
    outstanding_total: 0
  };

  sourceRows.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var billingId = migrationStage5RPick_(raw, ['billing_id', 'id']);
    var billingNumber = migrationStage5RPick_(raw, ['billing_number', 'invoice_number']);
    var treatmentId = migrationStage5RPick_(raw, ['treatment_id', 'treatmentId']);
    var appointmentId = migrationStage5RPick_(raw, ['appointment_id', 'appointmentId']);
    var patientId = migrationStage5RPick_(raw, ['patient_id', 'patientId']);
    var patientName = migrationStage5RPick_(raw, ['patient_name', 'name', 'full_name']);

    var billingDate = migrationStage5RPick_(raw, ['billing_date']);
    var dueDate = migrationStage5RPick_(raw, ['due_date']);

    var subtotal = migrationStage5RPick_(raw, ['subtotal']);
    var discountTotal = migrationStage5RPick_(raw, ['discount_total']);
    var grandTotal = migrationStage5RPick_(raw, ['grand_total']);
    var paidTotal = migrationStage5RPick_(raw, ['paid_total']);
    var outstandingTotal = migrationStage5RPick_(raw, ['outstanding_total']);

    var paymentStatus = migrationStage5RPick_(raw, ['payment_status']);
    var billingStatus = migrationStage5RPick_(raw, ['billing_status']);
    var paymentType = migrationStage5RPick_(raw, ['payment_type']);
    var paymentTerms = migrationStage5RPick_(raw, ['payment_terms']);
    var notes = migrationStage5RPick_(raw, ['notes']);

    var invoicePdfFileId = migrationStage5RPick_(raw, ['invoice_pdf_file_id']);
    var invoicePdfUrl = migrationStage5RPick_(raw, ['invoice_pdf_url']);
    var invoiceSentTo = migrationStage5RPick_(raw, ['invoice_sent_to']);
    var invoiceSentAt = migrationStage5RPick_(raw, ['invoice_sent_at']);
    var invoiceDeliveryStatus = migrationStage5RPick_(raw, ['invoice_delivery_status']);
    var invoicePdfSignature = migrationStage5RPick_(raw, ['invoice_pdf_signature']);
    var invoicePdfSignatureAt = migrationStage5RPick_(raw, ['invoice_pdf_signature_at']);

    var createdAt = migrationStage5RPick_(raw, ['created_at', 'createdAt']);
    var updatedAt = migrationStage5RPick_(raw, ['updated_at', 'updatedAt']);

    var normalizedBillingId = migrationNormalizeText_5K_(billingId);
    var normalizedTreatmentId = migrationNormalizeNullableText_5K_(treatmentId);
    var normalizedAppointmentId = migrationNormalizeNullableText_5K_(appointmentId);
    var normalizedPatientId = migrationNormalizeText_5K_(patientId);

    var patientUuid = normalizedPatientId
      ? (patientMap.map[normalizedPatientId] || null)
      : null;

    var appointmentUuid = normalizedAppointmentId
      ? (appointmentMap.map[normalizedAppointmentId] || null)
      : null;

    var treatmentUuid = normalizedTreatmentId
      ? (treatmentMap.map[normalizedTreatmentId] || null)
      : null;

    var normalizedSubtotal = migrationNormalizeNumber_5K_(subtotal) || 0;
    var normalizedDiscountTotal = migrationNormalizeNumber_5K_(discountTotal) || 0;
    var normalizedGrandTotal = migrationNormalizeNumber_5K_(grandTotal) || 0;
    var normalizedPaidTotal = migrationNormalizeNumber_5K_(paidTotal) || 0;
    var normalizedOutstandingTotal = migrationNormalizeNumber_5K_(outstandingTotal) || 0;

    var normalizedPaymentStatus = migrationNormalizeNullableText_5K_(paymentStatus);
    var normalizedBillingStatus = migrationNormalizeNullableText_5K_(billingStatus);
    var normalizedPaymentType = migrationNormalizeNullableText_5K_(paymentType);

    if (normalizedPaymentStatus) {
      paymentStatusCounts[normalizedPaymentStatus] = (paymentStatusCounts[normalizedPaymentStatus] || 0) + 1;
    }

    if (normalizedBillingStatus) {
      billingStatusCounts[normalizedBillingStatus] = (billingStatusCounts[normalizedBillingStatus] || 0) + 1;
    }

    if (normalizedPaymentType) {
      paymentTypeCounts[normalizedPaymentType] = (paymentTypeCounts[normalizedPaymentType] || 0) + 1;
    }

    totalSummary.subtotal += normalizedSubtotal;
    totalSummary.discount_total += normalizedDiscountTotal;
    totalSummary.grand_total += normalizedGrandTotal;
    totalSummary.paid_total += normalizedPaidTotal;
    totalSummary.outstanding_total += normalizedOutstandingTotal;

    var payload = {
      billing_id: normalizedBillingId,
      billing_number: migrationNormalizeNullableText_5K_(billingNumber),
      treatment_id: normalizedTreatmentId,
      treatment_uuid: treatmentUuid,
      appointment_id: normalizedAppointmentId,
      appointment_uuid: appointmentUuid,
      patient_id: normalizedPatientId,
      patient_name: migrationNormalizeNullableText_5K_(patientName),
      patient_uuid: patientUuid,
      billing_date: migrationNormalizeDate_5K_(billingDate),
      due_date: migrationNormalizeDate_5K_(dueDate),
      subtotal: normalizedSubtotal,
      discount_total: normalizedDiscountTotal,
      grand_total: normalizedGrandTotal,
      paid_total: normalizedPaidTotal,
      outstanding_total: normalizedOutstandingTotal,
      payment_status: normalizedPaymentStatus,
      billing_status: normalizedBillingStatus,
      payment_type: normalizedPaymentType,
      payment_terms: migrationNormalizeNullableText_5K_(paymentTerms),
      notes: migrationNormalizeNullableText_5K_(notes),
      invoice_pdf_file_id: migrationNormalizeNullableText_5K_(invoicePdfFileId),
      invoice_pdf_url: migrationNormalizeNullableText_5K_(invoicePdfUrl),
      invoice_sent_to: migrationNormalizeNullableText_5K_(invoiceSentTo),
      invoice_sent_at: migrationNormalizeTimestamp_5K_(invoiceSentAt),
      invoice_delivery_status: migrationNormalizeNullableText_5K_(invoiceDeliveryStatus),
      invoice_pdf_signature: migrationNormalizeNullableText_5K_(invoicePdfSignature),
      invoice_pdf_signature_at: migrationNormalizeTimestamp_5K_(invoicePdfSignatureAt),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),
      source_sheet: rowObj.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationStage5RParseJsonSafely_(migrationBuildRawSnapshot_5K_(raw))
    };

    var rowMissingParent = false;

    if (!payload.billing_id) {
      var missingBillingIssue = migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        '',
        'MISSING_BILLING_ID',
        'Billing tidak memiliki billing_id.',
        { raw: raw }
      );

      issues.push(missingBillingIssue);
      if (sampleIssues.length < 10) sampleIssues.push(missingBillingIssue);
    }

    if (!payload.patient_id || !payload.patient_uuid) {
      rowMissingParent = true;

      var patientIssue = migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_id,
        'PATIENT_PARENT_NOT_MAPPED',
        'patient_id Billings tidak ditemukan di migration_row_map patients.',
        { patient_id: payload.patient_id }
      );

      issues.push(patientIssue);
      if (sampleIssues.length < 10) sampleIssues.push(patientIssue);
    }

    if (payload.appointment_id && !payload.appointment_uuid) {
      rowMissingParent = true;

      var appointmentIssue = migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_id,
        'APPOINTMENT_PARENT_NOT_MAPPED',
        'appointment_id Billings tidak ditemukan di migration_row_map appointments.',
        { appointment_id: payload.appointment_id }
      );

      issues.push(appointmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(appointmentIssue);
    }

    if (payload.treatment_id && !payload.treatment_uuid) {
      var treatmentIssue = migrationStage5RIssue_(
        'warning',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_id,
        'TREATMENT_PARENT_NOT_MAPPED',
        'treatment_id Billings tidak ditemukan di migration_row_map treatments. Legacy ID tetap dibawa, treatment_uuid akan null.',
        { treatment_id: payload.treatment_id }
      );

      issues.push(treatmentIssue);
      if (sampleIssues.length < 10) sampleIssues.push(treatmentIssue);
    }

    var expectedGrandTotal = normalizedSubtotal - normalizedDiscountTotal;
    var expectedOutstandingTotal = normalizedGrandTotal - normalizedPaidTotal;

    if (
      expectedGrandTotal !== normalizedGrandTotal ||
      expectedOutstandingTotal !== normalizedOutstandingTotal
    ) {
      totalMismatchCount++;

      var totalIssue = migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        rowObj.source_sheet,
        rowObj.source_row_number,
        payload.billing_id,
        'BILLING_TOTAL_MISMATCH',
        'Total billing tidak konsisten.',
        {
          subtotal: normalizedSubtotal,
          discount_total: normalizedDiscountTotal,
          grand_total: normalizedGrandTotal,
          expected_grand_total: expectedGrandTotal,
          paid_total: normalizedPaidTotal,
          outstanding_total: normalizedOutstandingTotal,
          expected_outstanding_total: expectedOutstandingTotal
        }
      );

      issues.push(totalIssue);
      if (sampleIssues.length < 10) sampleIssues.push(totalIssue);
    }

    if (rowMissingParent) {
      missingParentCount++;
    } else {
      mappedCount++;
    }

    payloads.push(payload);
  });

  return {
    success: migrationStage5RHasNoBlockingIssues_(issues),
    status: {
      source_sheet: sourceRows.status.source_sheet,
      spreadsheet_row_count: sourceRows.status.spreadsheet_row_count,
      dry_run_payload_count: payloads.length,
      patient_map_count: patientMap.count || 0,
      appointment_map_count: appointmentMap.count || 0,
      treatment_map_count: treatmentMap.count || 0,
      mapped_count: mappedCount,
      missing_parent_count: missingParentCount,
      total_mismatch_count: totalMismatchCount,
      payment_status_counts: paymentStatusCounts,
      billing_status_counts: billingStatusCounts,
      payment_type_counts: paymentTypeCounts,
      totals: totalSummary,
      blocking_issue_count: migrationStage5RCountIssuesBySeverity_(issues, 'error'),
      warning_issue_count: migrationStage5RCountIssuesBySeverity_(issues, 'warning')
    },
    payloads: payloads,
    sample_payloads: payloads.slice(0, 10),
    sample_issues: sampleIssues,
    issues: issues
  };
}


function migrationStage5RLoadLegacyMap_(targetTable) {
  var issues = [];
  var map = {};
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5RRequest_(
      'get',
      'migration_row_map',
      'select=legacy_id,target_uuid,mapping_status&target_table=eq.' + encodeURIComponent(targetTable) + '&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5RIssue_(
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
    success: migrationStage5RHasNoBlockingIssues_(issues),
    issues: issues,
    map: map,
    count: Object.keys(map).length
  };
}


function migrationStage5RPick_(raw, candidates) {
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


function migrationStage5RCountIssuesBySeverity_(issues, severity) {
  var count = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}

/************************************************************
 * 5R-C INSERT + AUDIT
 ************************************************************/

function runMigrationStage5RInsertBillings() {
  var startedAt = new Date();

  var result = migrationStage5RBaseResult_('insert_billings_staging');
  result.safe_boundary.supabase_insert = true;

  var issues = [];

  if (MIGRATION_STAGE_5R_WRITE_ENABLED !== true) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'WRITE_DISABLED',
      'MIGRATION_STAGE_5R_WRITE_ENABLED masih false. Jalankan preflight/dry-run dulu. Jika clean, ubah menjadi true hanya untuk insert billings staging.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  var lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'LOCK_BUSY',
      'Proses migrasi 5R sedang berjalan atau lock belum dilepas.'
    ));

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = false;
    result.duration_ms = new Date().getTime() - startedAt.getTime();
    return result;
  }

  try {
    var preflight = runMigrationStage5RPreflight();

    result.preflight_status = {
      success: preflight.success,
      issue_count: preflight.issue_count,
      source_row_status: preflight.source_row_status || null,
      target_table_status: preflight.target_table_status || null
    };

    if (!preflight.success) {
      issues.push(migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        '',
        '',
        '',
        'PREFLIGHT_NOT_CLEAN',
        'Preflight 5R belum clean. Insert billings dibatalkan.',
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

    var targetEmpty = migrationStage5RCheckTargetEmpty_();

    result.target_table_status = targetEmpty.status;

    if (!targetEmpty.success) {
      issues = issues.concat(targetEmpty.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var dryRun = migrationStage5RBuildDryRunPayload_();

    result.dry_run_status = dryRun.status;

    if (!migrationStage5RHasNoBlockingIssues_(dryRun.issues || [])) {
      issues = issues.concat(dryRun.issues || []);

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var insertResult = migrationStage5RInsertRows_(
      MIGRATION_STAGE_5R_TARGET_TABLE,
      dryRun.payloads || []
    );

    if (!insertResult.success) {
      issues.push(migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        '',
        '',
        '',
        'BILLINGS_INSERT_FAILED',
        'Insert billings ke Supabase staging gagal.',
        insertResult
      ));

      result.issues = issues;
      result.issue_count = issues.length;
      result.success = false;
      result.duration_ms = new Date().getTime() - startedAt.getTime();
      return result;
    }

    var rowMapRows = migrationStage5RBuildRowMapRows_(insertResult.rows || []);
    var rowMapInsert = migrationStage5RInsertRows_('migration_row_map', rowMapRows);

    if (!rowMapInsert.success) {
      issues.push(migrationStage5RIssue_(
        'error',
        'migration_row_map',
        '',
        '',
        '',
        'BILLINGS_ROW_MAP_INSERT_FAILED',
        'Insert migration_row_map billings gagal.',
        rowMapInsert
      ));
    }

    var issueRows = migrationStage5RBuildMigrationIssueRows_(dryRun.issues || []);

    if (issueRows.length > 0) {
      var issueInsert = migrationStage5RInsertRows_('migration_issues', issueRows);

      if (!issueInsert.success) {
        issues.push(migrationStage5RIssue_(
          'error',
          'migration_issues',
          '',
          '',
          '',
          'MIGRATION_ISSUES_INSERT_FAILED',
          'Insert migration_issues 5R gagal.',
          issueInsert
        ));
      }
    }

    var audit = runMigrationStage5RAuditBillings();

    result.inserted_summary = {
      billings: {
        target_table: MIGRATION_STAGE_5R_TARGET_TABLE,
        inserted_count: insertResult.rows ? insertResult.rows.length : 0
      }
    };

    result.row_map_inserted_count = rowMapInsert.rows ? rowMapInsert.rows.length : 0;
    result.migration_issues_inserted_count = issueRows.length;
    result.audit_after_insert = audit.audit_status || null;

    issues = issues.concat(audit.issues || []);

    result.issues = issues;
    result.issue_count = issues.length;
    result.success = migrationStage5RHasNoBlockingIssues_(issues);
    result.duration_ms = new Date().getTime() - startedAt.getTime();

    return result;

  } catch (err) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
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


function runMigrationStage5RAuditBillings() {
  var startedAt = new Date();

  var result = migrationStage5RBaseResult_('audit_billings_read_only');
  var issues = [];

  var sourceRows = migrationStage5RReadSourceRows_();

  if (!sourceRows.success) {
    issues = issues.concat(sourceRows.issues || []);
  }

  var spreadsheetCount = sourceRows.status ? sourceRows.status.non_blank_payload_row_count : 0;

  var supabaseCount = migrationStage5RCountRows_(MIGRATION_STAGE_5R_TARGET_TABLE);
  var rowMapCount = migrationStage5RCountRows_(
    'migration_row_map',
    'target_table=eq.billings'
  );

  var nullPatientUuidCount = migrationStage5RCountRows_(
    MIGRATION_STAGE_5R_TARGET_TABLE,
    'patient_uuid=is.null'
  );

  var nullAppointmentUuidCount = migrationStage5RCountRows_(
    MIGRATION_STAGE_5R_TARGET_TABLE,
    'appointment_uuid=is.null'
  );

  var treatmentIdWithNullUuidCount = migrationStage5RCountRows_(
    MIGRATION_STAGE_5R_TARGET_TABLE,
    'treatment_id=not.is.null&treatment_uuid=is.null'
  );

  var migrationIssueCount = migrationStage5RCountRows_(
    'migration_issues',
    'issue_type=eq.TREATMENT_PARENT_NOT_MAPPED&source_sheet=eq.Billings'
  );

  var rowsAudit = migrationStage5RLoadBillingsAuditRows_();
  var totals = rowsAudit.totals || migrationStage5RBlankTotals_();
  var totalMismatchCount = rowsAudit.total_mismatch_count || 0;

  if (!supabaseCount.success) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'BILLINGS_COUNT_FAILED',
      'Gagal menghitung row billings Supabase.',
      supabaseCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5RIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'BILLINGS_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map billings.',
      rowMapCount
    ));
  }

  if (supabaseCount.success && supabaseCount.count !== spreadsheetCount) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'BILLINGS_COUNT_MISMATCH',
      'Jumlah Billings Spreadsheet dan Supabase tidak sama.',
      {
        spreadsheet_count: spreadsheetCount,
        supabase_count: supabaseCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== spreadsheetCount) {
    issues.push(migrationStage5RIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'BILLINGS_ROW_MAP_COUNT_MISMATCH',
      'Jumlah migration_row_map billings tidak sama dengan source.',
      {
        spreadsheet_count: spreadsheetCount,
        row_map_count: rowMapCount.count
      }
    ));
  }

  if (nullPatientUuidCount.success && nullPatientUuidCount.count !== 0) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_NULL_PATIENT_UUID_FOUND',
      'Ada billings dengan patient_uuid kosong.',
      {
        null_patient_uuid_count: nullPatientUuidCount.count
      }
    ));
  }

  if (nullAppointmentUuidCount.success && nullAppointmentUuidCount.count !== 0) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_NULL_APPOINTMENT_UUID_FOUND',
      'Ada billings dengan appointment_uuid kosong.',
      {
        null_appointment_uuid_count: nullAppointmentUuidCount.count
      }
    ));
  }

  if (!rowsAudit.success) {
    issues = issues.concat(rowsAudit.issues || []);
  }

  if (totalMismatchCount !== 0) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'BILLING_TOTAL_MISMATCH_FOUND',
      'Ada total billings Supabase yang tidak konsisten.',
      {
        total_mismatch_count: totalMismatchCount
      }
    ));
  }

  result.audit_status = {
    billings: {
      spreadsheet_count: spreadsheetCount,
      supabase_count: supabaseCount.count,
      migration_row_map_count: rowMapCount.count,
      null_patient_uuid_count: nullPatientUuidCount.count,
      null_appointment_uuid_count: nullAppointmentUuidCount.count,
      treatment_id_with_null_uuid_count: treatmentIdWithNullUuidCount.count,
      migration_issue_treatment_missing_parent_count: migrationIssueCount.count,
      total_mismatch_count: totalMismatchCount,
      totals: totals
    }
  };

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5RHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


function migrationStage5RBuildRowMapRows_(insertedRows) {
  var now = migrationStage5RNowIso_();

  return (insertedRows || []).map(function(row) {
    return {
      source_sheet: row.source_sheet,
      source_row_number: row.source_row_number,
      legacy_id: row.billing_id,
      target_table: MIGRATION_STAGE_5R_TARGET_TABLE,
      target_uuid: row.id,
      mapping_status: 'mapped',
      notes: 'stage=' + MIGRATION_STAGE_5R_NAME,
      created_at: now
    };
  });
}


function migrationStage5RBuildMigrationIssueRows_(issues) {
  var now = migrationStage5RNowIso_();

  return (issues || []).map(function(issue) {
    return {
      issue_type: issue.code || 'MIGRATION_ISSUE',
      severity: issue.severity || 'warning',
      source_sheet: issue.source_sheet || '',
      source_row_number: issue.source_row_number || null,
      legacy_id: issue.legacy_id || '',
      related_legacy_id: issue.details && issue.details.treatment_id
        ? issue.details.treatment_id
        : '',
      message: '[' + MIGRATION_STAGE_5R_NAME + '] ' + (issue.message || ''),
      row_snapshot: {
        stage: MIGRATION_STAGE_5R_NAME,
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


function migrationStage5RLoadBillingsAuditRows_() {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var response = migrationStage5RRequest_(
      'get',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      'select=id,billing_id,subtotal,discount_total,grand_total,paid_total,outstanding_total&limit=' + pageSize + '&offset=' + offset,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5RIssue_(
        'error',
        MIGRATION_STAGE_5R_TARGET_TABLE,
        '',
        '',
        '',
        'LOAD_BILLINGS_AUDIT_ROWS_FAILED',
        'Gagal membaca billings untuk audit totals.',
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

  var totals = migrationStage5RBlankTotals_();
  var totalMismatchCount = 0;

  rows.forEach(function(row) {
    var subtotal = migrationNormalizeNumber_5K_(row.subtotal) || 0;
    var discountTotal = migrationNormalizeNumber_5K_(row.discount_total) || 0;
    var grandTotal = migrationNormalizeNumber_5K_(row.grand_total) || 0;
    var paidTotal = migrationNormalizeNumber_5K_(row.paid_total) || 0;
    var outstandingTotal = migrationNormalizeNumber_5K_(row.outstanding_total) || 0;

    totals.subtotal += subtotal;
    totals.discount_total += discountTotal;
    totals.grand_total += grandTotal;
    totals.paid_total += paidTotal;
    totals.outstanding_total += outstandingTotal;

    if (
      grandTotal !== subtotal - discountTotal ||
      outstandingTotal !== grandTotal - paidTotal
    ) {
      totalMismatchCount++;
    }
  });

  return {
    success: migrationStage5RHasNoBlockingIssues_(issues),
    issues: issues,
    rows: rows,
    totals: totals,
    total_mismatch_count: totalMismatchCount
  };
}


function migrationStage5RBlankTotals_() {
  return {
    subtotal: 0,
    discount_total: 0,
    grand_total: 0,
    paid_total: 0,
    outstanding_total: 0
  };
}


function migrationStage5RNormalizeRowsForInsert_(tableName, rows) {
  if (tableName !== MIGRATION_STAGE_5R_TARGET_TABLE) {
    return (rows || []).map(function(row) {
      return migrationStage5RNullUndefinedValues_(row);
    });
  }

  var columns = [
    'billing_id',
    'billing_number',
    'treatment_id',
    'treatment_uuid',
    'appointment_id',
    'appointment_uuid',
    'patient_id',
    'patient_name',
    'patient_uuid',
    'billing_date',
    'due_date',
    'subtotal',
    'discount_total',
    'grand_total',
    'paid_total',
    'outstanding_total',
    'payment_status',
    'billing_status',
    'payment_type',
    'payment_terms',
    'notes',
    'invoice_pdf_file_id',
    'invoice_pdf_url',
    'invoice_sent_to',
    'invoice_sent_at',
    'invoice_delivery_status',
    'invoice_pdf_signature',
    'invoice_pdf_signature_at',
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


function migrationStage5RNullUndefinedValues_(row) {
  var clean = {};

  Object.keys(row || {}).forEach(function(key) {
    clean[key] = row[key] === undefined ? null : row[key];
  });

  return clean;
}


function migrationStage5RInsertRows_(tableName, rows) {
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
  var normalizedRows = migrationStage5RNormalizeRowsForInsert_(tableName, rows);

  for (var i = 0; i < normalizedRows.length; i += batchSize) {
    var chunk = normalizedRows.slice(i, i + batchSize);

    var response = migrationStage5RRequest_(
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
 * 5R TARGET EMPTY CHECK — READ ONLY
 ************************************************************/

function migrationStage5RCheckTargetEmpty_() {
  var issues = [];

  var targetCount = migrationStage5RCountRows_(MIGRATION_STAGE_5R_TARGET_TABLE);
  var rowMapCount = migrationStage5RCountRows_(
    'migration_row_map',
    'target_table=eq.' + encodeURIComponent(MIGRATION_STAGE_5R_TARGET_TABLE)
  );

  var status = {
    target_table: MIGRATION_STAGE_5R_TARGET_TABLE,
    target_count: targetCount.count,
    target_count_success: targetCount.success,
    row_map_count: rowMapCount.count,
    row_map_count_success: rowMapCount.success
  };

  if (!targetCount.success) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_COUNT_FAILED',
      'Gagal menghitung table billings.',
      targetCount
    ));
  }

  if (!rowMapCount.success) {
    issues.push(migrationStage5RIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_COUNT_FAILED',
      'Gagal menghitung migration_row_map untuk billings.',
      rowMapCount
    ));
  }

  if (targetCount.success && targetCount.count !== 0) {
    issues.push(migrationStage5RIssue_(
      'error',
      MIGRATION_STAGE_5R_TARGET_TABLE,
      '',
      '',
      '',
      'TARGET_TABLE_NOT_EMPTY',
      'Table billings staging tidak kosong. Insert awal 5R harus ditahan agar tidak duplikat.',
      {
        count: targetCount.count
      }
    ));
  }

  if (rowMapCount.success && rowMapCount.count !== 0) {
    issues.push(migrationStage5RIssue_(
      'error',
      'migration_row_map',
      '',
      '',
      '',
      'TARGET_ROW_MAP_NOT_EMPTY',
      'migration_row_map untuk billings sudah ada. Insert awal 5R harus ditahan agar tidak duplikat.',
      {
        count: rowMapCount.count
      }
    ));
  }

  return {
    success: migrationStage5RHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5R SUPABASE SCHEMA INSPECT
 ************************************************************/

function migrationStage5RInspectSupabaseTableSchema_(tableName) {
  var schemaResult = migrationStage5RFetchOpenApiSchema_();

  if (!schemaResult.success) {
    return {
      success: false,
      schema: null,
      response: schemaResult
    };
  }

  var definitions = migrationStage5RExtractOpenApiDefinitions_(schemaResult.body);
  var tableDef = migrationStage5RFindOpenApiTableDefinition_(definitions, tableName);

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
      properties_preview: migrationStage5RPickPropertiesPreview_(properties)
    }
  };
}


function migrationStage5RFetchOpenApiSchema_() {
  var config = migrationStage5RGetConfig_();

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
  var body = migrationStage5RParseJsonSafely_(text);

  return {
    success: httpCode >= 200 && httpCode < 300 && !!body,
    http_code: httpCode,
    body: body
  };
}


function migrationStage5RExtractOpenApiDefinitions_(body) {
  if (!body) return {};

  if (body.definitions) return body.definitions;
  if (body.components && body.components.schemas) return body.components.schemas;

  return {};
}


function migrationStage5RFindOpenApiTableDefinition_(definitions, tableName) {
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


function migrationStage5RPickPropertiesPreview_(properties) {
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
 * 5R SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5RGetConfig_() {
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


function migrationStage5RRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5RGetConfig_();

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
  var parsedBody = migrationStage5RParseJsonSafely_(text);
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


function migrationStage5RCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5RRequest_(
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

  var count = migrationStage5RParseCountFromContentRange_(contentRange);

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
 * 5R GENERIC UTILITIES
 ************************************************************/

function migrationStage5RBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5RNowIso_(),
    stage: MIGRATION_STAGE_5R_NAME,
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


function migrationStage5RIssue_(severity, targetTable, sourceSheet, sourceRowNumber, legacyId, code, message, details) {
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


function migrationStage5RHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5RParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5RParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5RNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5RGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5RGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5RLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}