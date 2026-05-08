/************************************************************
 * MigrationStage5V.gs
 * Tahap 5V — Final Audit Data Supabase Staging
 *
 * Tujuan:
 * - Audit final semua table hasil migrasi Fase 5
 * - Cocokkan expected Spreadsheet count vs Supabase count
 * - Cocokkan migration_row_map
 * - Audit relasi parent-child penting
 * - Audit total Finance
 * - Audit duplicate-safe treatment_items
 * - Audit known manual-test artifacts
 * - Audit klasifikasi migration_issues
 *
 * SAFETY:
 * - READ ONLY
 * - NO Supabase insert/update/delete
 * - NO Spreadsheet update/delete
 * - NO frontend/backend active change
 ************************************************************/


/************************************************************
 * 5V CONFIG
 ************************************************************/

var MIGRATION_STAGE_5V_NAME = '5V';

var MIGRATION_STAGE_5V_EXPECTED_TABLES = [
  { table: 'app_users', expected_count: 8, row_map_expected: 8 },
  { table: 'patients', expected_count: 285, row_map_expected: 285 },
  { table: 'service_catalog', expected_count: 100, row_map_expected: 100 },

  { table: 'appointments', expected_count: 284, row_map_expected: 284 },
  { table: 'treatments', expected_count: 254, row_map_expected: 254 },
  { table: 'treatment_items', expected_count: 489, row_map_expected: 489 },

  { table: 'medical_records', expected_count: 254, row_map_expected: 254 },
  { table: 'patient_photos', expected_count: 241, row_map_expected: 241 },
  { table: 'ortho_recalls', expected_count: 124, row_map_expected: 124 },

  { table: 'billings', expected_count: 46, row_map_expected: 46 },
  { table: 'billing_items', expected_count: 99, row_map_expected: 99 },
  { table: 'billing_adjustments', expected_count: 1, row_map_expected: 1 },
  { table: 'billing_installments', expected_count: 0, row_map_expected: 0 },
  { table: 'payments', expected_count: 44, row_map_expected: 44 },
  { table: 'billing_feedbacks', expected_count: 0, row_map_expected: 0 }
];

var MIGRATION_STAGE_5V_EXPECTED_TOTALS = {
  billings: {
    subtotal: 15136500,
    discount_total: 100000,
    grand_total: 15036500,
    paid_total: 15035000,
    outstanding_total: 1500
  },
  billing_items: {
    qty: 157,
    unit_price_total: 14419000,
    subtotal: 15136500
  },
  billing_adjustments: {
    total_amount: 100000
  },
  billing_installments: {
    amount_total: 0,
    paid_total: 0,
    outstanding_total: 0
  },
  payments: {
    total_amount: 15035000
  }
};

var MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES = {
  total_count: 4,
  by_key: {
    'OrthoRecall|INSTALL_TREATMENT_PARENT_NOT_MAPPED': 1,
    'Billings|TREATMENT_PARENT_NOT_MAPPED': 1,
    'BillingItems|TREATMENT_PARENT_NOT_MAPPED': 1,
    'BillingItems|TREATMENT_ITEM_NOT_MAPPED': 1
  }
};


/************************************************************
 * 5V PUBLIC ENTRY POINTS
 ************************************************************/

function testMigrationStage5VFinalAuditLog() {
  var result = runMigrationStage5VFinalAudit();
  migrationStage5VLogJson_('testMigrationStage5VFinalAudit', result);
  return result;
}


function testMigrationStage5VFinalAuditErrorsOnlyLog() {
  var result = runMigrationStage5VFinalAudit();

  var compact = {
    success: result.success,
    checked_at: result.checked_at,
    stage: result.stage,
    mode: result.mode,
    issue_count: result.issue_count,
    errors: (result.issues || []).filter(function(issue) {
      return issue.severity === 'error';
    }),
    warnings: (result.issues || []).filter(function(issue) {
      return issue.severity === 'warning';
    }),
    final_summary: result.final_summary || null
  };

  migrationStage5VLogJson_('testMigrationStage5VFinalAuditErrorsOnly', compact);
  return compact;
}


/************************************************************
 * 5V FINAL AUDIT
 ************************************************************/

function runMigrationStage5VFinalAudit() {
  var startedAt = new Date();

  var result = migrationStage5VBaseResult_('final_audit_supabase_staging_read_only');
  var issues = [];

  var tableCountAudit = migrationStage5VAuditTableCountsAndRowMaps_();
  var relationshipAudit = migrationStage5VAuditRelationships_();
  var financeAudit = migrationStage5VAuditFinanceTotals_();
  var treatmentDuplicateAudit = migrationStage5VAuditTreatmentItemDuplicates_();
  var issueAudit = migrationStage5VAuditMigrationIssues_();

  issues = issues
    .concat(tableCountAudit.issues || [])
    .concat(relationshipAudit.issues || [])
    .concat(financeAudit.issues || [])
    .concat(treatmentDuplicateAudit.issues || [])
    .concat(issueAudit.issues || []);

  result.audit_status = {
    table_counts_and_row_maps: tableCountAudit.status,
    relationships: relationshipAudit.status,
    finance_totals: financeAudit.status,
    treatment_item_duplicates: treatmentDuplicateAudit.status,
    migration_issues: issueAudit.status
  };

  result.final_summary = migrationStage5VBuildFinalSummary_(
    tableCountAudit,
    relationshipAudit,
    financeAudit,
    treatmentDuplicateAudit,
    issueAudit,
    issues
  );

  result.issues = issues;
  result.issue_count = issues.length;
  result.success = migrationStage5VHasNoBlockingIssues_(issues);
  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5V-A TABLE COUNTS + ROW MAPS
 ************************************************************/

function migrationStage5VAuditTableCountsAndRowMaps_() {
  var issues = [];
  var status = {};

  MIGRATION_STAGE_5V_EXPECTED_TABLES.forEach(function(cfg) {
    var tableCount = migrationStage5VCountRows_(cfg.table);
    var rowMapCount = migrationStage5VCountRows_(
      'migration_row_map',
      'target_table=eq.' + encodeURIComponent(cfg.table)
    );

    status[cfg.table] = {
      expected_count: cfg.expected_count,
      supabase_count: tableCount.count,
      supabase_count_success: tableCount.success,
      expected_row_map_count: cfg.row_map_expected,
      migration_row_map_count: rowMapCount.count,
      migration_row_map_count_success: rowMapCount.success
    };

    if (!tableCount.success) {
      issues.push(migrationStage5VIssue_(
        'error',
        cfg.table,
        'TARGET_COUNT_FAILED',
        'Gagal menghitung row table ' + cfg.table + '.',
        tableCount
      ));
    }

    if (!rowMapCount.success) {
      issues.push(migrationStage5VIssue_(
        'error',
        'migration_row_map',
        'ROW_MAP_COUNT_FAILED',
        'Gagal menghitung migration_row_map untuk ' + cfg.table + '.',
        rowMapCount
      ));
    }

    if (tableCount.success && tableCount.count !== cfg.expected_count) {
      issues.push(migrationStage5VIssue_(
        'error',
        cfg.table,
        'TARGET_COUNT_MISMATCH',
        'Jumlah row Supabase tidak sesuai expected final Fase 5 untuk ' + cfg.table + '.',
        {
          expected_count: cfg.expected_count,
          actual_count: tableCount.count
        }
      ));
    }

    if (rowMapCount.success && rowMapCount.count !== cfg.row_map_expected) {
      issues.push(migrationStage5VIssue_(
        'error',
        'migration_row_map',
        'ROW_MAP_COUNT_MISMATCH',
        'Jumlah migration_row_map tidak sesuai expected untuk ' + cfg.table + '.',
        {
          target_table: cfg.table,
          expected_row_map_count: cfg.row_map_expected,
          actual_row_map_count: rowMapCount.count
        }
      ));
    }
  });

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5V-B RELATIONSHIP AUDIT
 ************************************************************/

function migrationStage5VAuditRelationships_() {
  var issues = [];

  var status = {
    appointments: {
      null_patient_uuid_count: migrationStage5VCountRows_('appointments', 'patient_uuid=is.null').count
    },

    treatments: {
      null_patient_uuid_count: migrationStage5VCountRows_('treatments', 'patient_uuid=is.null').count,
      null_appointment_uuid_count: migrationStage5VCountRows_('treatments', 'appointment_uuid=is.null').count,
      null_doctor_user_uuid_count: migrationStage5VCountRows_('treatments', 'doctor_user_uuid=is.null').count
    },

    treatment_items: {
      null_treatment_uuid_count: migrationStage5VCountRows_('treatment_items', 'treatment_uuid=is.null').count,
      null_service_uuid_count: migrationStage5VCountRows_('treatment_items', 'service_uuid=is.null').count,
      missing_parent_status_count: migrationStage5VCountRows_('treatment_items', 'mapping_status=eq.missing_parent').count,
      non_mapped_status_count: migrationStage5VCountRows_('treatment_items', 'mapping_status=neq.mapped').count
    },

    medical_records: {
      null_patient_uuid_count: migrationStage5VCountRows_('medical_records', 'patient_uuid=is.null').count,
      null_appointment_uuid_count: migrationStage5VCountRows_('medical_records', 'appointment_uuid=is.null').count,
      null_treatment_uuid_count: migrationStage5VCountRows_('medical_records', 'treatment_uuid=is.null').count,
      null_doctor_user_uuid_count: migrationStage5VCountRows_('medical_records', 'doctor_user_uuid=is.null').count
    },

    patient_photos: {
      null_patient_uuid_count: migrationStage5VCountRows_('patient_photos', 'patient_uuid=is.null').count,
      null_appointment_uuid_count: migrationStage5VCountRows_('patient_photos', 'appointment_uuid=is.null').count,
      null_treatment_uuid_count: migrationStage5VCountRows_('patient_photos', 'treatment_uuid=is.null').count,
      null_uploaded_by_uuid_count: migrationStage5VCountRows_('patient_photos', 'uploaded_by_uuid=is.null').count
    },

    ortho_recalls: {
      null_patient_uuid_count: migrationStage5VCountRows_('ortho_recalls', 'patient_uuid=is.null').count,
      install_treatment_id_with_null_uuid_count: migrationStage5VCountRows_('ortho_recalls', 'install_treatment_id=not.is.null&install_treatment_uuid=is.null').count,
      last_control_treatment_id_with_null_uuid_count: migrationStage5VCountRows_('ortho_recalls', 'last_control_treatment_id=not.is.null&last_control_treatment_uuid=is.null').count
    },

    billings: {
      null_patient_uuid_count: migrationStage5VCountRows_('billings', 'patient_uuid=is.null').count,
      null_appointment_uuid_count: migrationStage5VCountRows_('billings', 'appointment_uuid=is.null').count,
      treatment_id_with_null_uuid_count: migrationStage5VCountRows_('billings', 'treatment_id=not.is.null&treatment_uuid=is.null').count
    },

    billing_items: {
      null_billing_uuid_count: migrationStage5VCountRows_('billing_items', 'billing_uuid=is.null').count,
      treatment_id_with_null_uuid_count: migrationStage5VCountRows_('billing_items', 'treatment_id=not.is.null&treatment_uuid=is.null').count,
      treatment_item_id_with_null_uuid_count: migrationStage5VCountRows_('billing_items', 'treatment_item_id=not.is.null&treatment_item_uuid=is.null').count,
      null_service_uuid_count: migrationStage5VCountRows_('billing_items', 'service_uuid=is.null').count,
      mapped_count: migrationStage5VCountRows_('billing_items', 'mapping_status=eq.mapped').count,
      missing_parent_count: migrationStage5VCountRows_('billing_items', 'mapping_status=eq.missing_parent').count,
      ambiguous_count: migrationStage5VCountRows_('billing_items', 'mapping_status=eq.ambiguous').count,
      needs_review_count: migrationStage5VCountRows_('billing_items', 'mapping_status=eq.needs_review').count
    },

    billing_adjustments: {
      null_billing_uuid_count: migrationStage5VCountRows_('billing_adjustments', 'billing_uuid=is.null').count,
      created_by_with_null_uuid_count: migrationStage5VCountRows_('billing_adjustments', 'created_by=not.is.null&created_by_uuid=is.null').count
    },

    billing_installments: {
      null_billing_uuid_count: migrationStage5VCountRows_('billing_installments', 'billing_uuid=is.null').count
    },

    payments: {
      null_billing_uuid_count: migrationStage5VCountRows_('payments', 'billing_uuid=is.null').count,
      received_by_with_null_uuid_count: migrationStage5VCountRows_('payments', 'received_by=not.is.null&received_by_uuid=is.null').count,
      installment_id_with_null_uuid_count: migrationStage5VCountRows_('payments', 'installment_id=not.is.null&installment_uuid=is.null').count
    },

    billing_feedbacks: {
      null_billing_uuid_count: migrationStage5VCountRows_('billing_feedbacks', 'billing_uuid=is.null').count,
      patient_id_with_null_uuid_count: migrationStage5VCountRows_('billing_feedbacks', 'patient_id=not.is.null&patient_uuid=is.null').count
    }
  };

  migrationStage5VAssertZero_(issues, 'appointments', 'null_patient_uuid_count', status.appointments.null_patient_uuid_count);

  migrationStage5VAssertZero_(issues, 'treatments', 'null_patient_uuid_count', status.treatments.null_patient_uuid_count);
  migrationStage5VAssertZero_(issues, 'treatments', 'null_appointment_uuid_count', status.treatments.null_appointment_uuid_count);
  migrationStage5VAssertZero_(issues, 'treatments', 'null_doctor_user_uuid_count', status.treatments.null_doctor_user_uuid_count);

  migrationStage5VAssertZero_(issues, 'treatment_items', 'null_treatment_uuid_count', status.treatment_items.null_treatment_uuid_count);
  migrationStage5VAssertZero_(issues, 'treatment_items', 'null_service_uuid_count', status.treatment_items.null_service_uuid_count);
  migrationStage5VAssertZero_(issues, 'treatment_items', 'missing_parent_status_count', status.treatment_items.missing_parent_status_count);
  migrationStage5VAssertZero_(issues, 'treatment_items', 'non_mapped_status_count', status.treatment_items.non_mapped_status_count);

  migrationStage5VAssertZero_(issues, 'medical_records', 'null_patient_uuid_count', status.medical_records.null_patient_uuid_count);
  migrationStage5VAssertZero_(issues, 'medical_records', 'null_appointment_uuid_count', status.medical_records.null_appointment_uuid_count);
  migrationStage5VAssertZero_(issues, 'medical_records', 'null_treatment_uuid_count', status.medical_records.null_treatment_uuid_count);
  migrationStage5VAssertZero_(issues, 'medical_records', 'null_doctor_user_uuid_count', status.medical_records.null_doctor_user_uuid_count);

  migrationStage5VAssertZero_(issues, 'patient_photos', 'null_patient_uuid_count', status.patient_photos.null_patient_uuid_count);
  migrationStage5VAssertZero_(issues, 'patient_photos', 'null_appointment_uuid_count', status.patient_photos.null_appointment_uuid_count);
  migrationStage5VAssertZero_(issues, 'patient_photos', 'null_treatment_uuid_count', status.patient_photos.null_treatment_uuid_count);

  migrationStage5VAssertZero_(issues, 'ortho_recalls', 'null_patient_uuid_count', status.ortho_recalls.null_patient_uuid_count);
  migrationStage5VAssertExpected_(issues, 'ortho_recalls', 'install_treatment_id_with_null_uuid_count', status.ortho_recalls.install_treatment_id_with_null_uuid_count, 1);
  migrationStage5VAssertZero_(issues, 'ortho_recalls', 'last_control_treatment_id_with_null_uuid_count', status.ortho_recalls.last_control_treatment_id_with_null_uuid_count);

  migrationStage5VAssertZero_(issues, 'billings', 'null_patient_uuid_count', status.billings.null_patient_uuid_count);
  migrationStage5VAssertZero_(issues, 'billings', 'null_appointment_uuid_count', status.billings.null_appointment_uuid_count);
  migrationStage5VAssertExpected_(issues, 'billings', 'treatment_id_with_null_uuid_count', status.billings.treatment_id_with_null_uuid_count, 1);

  migrationStage5VAssertZero_(issues, 'billing_items', 'null_billing_uuid_count', status.billing_items.null_billing_uuid_count);
  migrationStage5VAssertExpected_(issues, 'billing_items', 'treatment_id_with_null_uuid_count', status.billing_items.treatment_id_with_null_uuid_count, 1);
  migrationStage5VAssertExpected_(issues, 'billing_items', 'treatment_item_id_with_null_uuid_count', status.billing_items.treatment_item_id_with_null_uuid_count, 1);
  migrationStage5VAssertZero_(issues, 'billing_items', 'null_service_uuid_count', status.billing_items.null_service_uuid_count);
  migrationStage5VAssertExpected_(issues, 'billing_items', 'mapped_count', status.billing_items.mapped_count, 98);
  migrationStage5VAssertExpected_(issues, 'billing_items', 'missing_parent_count', status.billing_items.missing_parent_count, 1);
  migrationStage5VAssertZero_(issues, 'billing_items', 'ambiguous_count', status.billing_items.ambiguous_count);
  migrationStage5VAssertZero_(issues, 'billing_items', 'needs_review_count', status.billing_items.needs_review_count);

  migrationStage5VAssertZero_(issues, 'billing_adjustments', 'null_billing_uuid_count', status.billing_adjustments.null_billing_uuid_count);
  migrationStage5VAssertZero_(issues, 'billing_adjustments', 'created_by_with_null_uuid_count', status.billing_adjustments.created_by_with_null_uuid_count);

  migrationStage5VAssertZero_(issues, 'billing_installments', 'null_billing_uuid_count', status.billing_installments.null_billing_uuid_count);

  migrationStage5VAssertZero_(issues, 'payments', 'null_billing_uuid_count', status.payments.null_billing_uuid_count);
  migrationStage5VAssertZero_(issues, 'payments', 'received_by_with_null_uuid_count', status.payments.received_by_with_null_uuid_count);
  migrationStage5VAssertZero_(issues, 'payments', 'installment_id_with_null_uuid_count', status.payments.installment_id_with_null_uuid_count);

  migrationStage5VAssertZero_(issues, 'billing_feedbacks', 'null_billing_uuid_count', status.billing_feedbacks.null_billing_uuid_count);
  migrationStage5VAssertZero_(issues, 'billing_feedbacks', 'patient_id_with_null_uuid_count', status.billing_feedbacks.patient_id_with_null_uuid_count);

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5V-C FINANCE TOTALS AUDIT
 ************************************************************/

function migrationStage5VAuditFinanceTotals_() {
  var issues = [];

  var billingsTotals = migrationStage5VLoadBillingsTotals_();
  var billingItemsTotals = migrationStage5VLoadBillingItemsTotals_();
  var adjustmentTotal = migrationStage5VLoadAmountTotal_('billing_adjustments');
  var paymentTotal = migrationStage5VLoadAmountTotal_('payments');
  var installmentTotals = migrationStage5VLoadInstallmentTotals_();

  issues = issues
    .concat(billingsTotals.issues || [])
    .concat(billingItemsTotals.issues || [])
    .concat(adjustmentTotal.issues || [])
    .concat(paymentTotal.issues || [])
    .concat(installmentTotals.issues || []);

  var status = {
    billings: billingsTotals.totals,
    billing_items: billingItemsTotals.totals,
    billing_adjustments: {
      total_amount: adjustmentTotal.total_amount
    },
    billing_installments: {
      amount_total: installmentTotals.amount_total,
      paid_total: installmentTotals.paid_total,
      outstanding_total: installmentTotals.outstanding_total,
      installment_total_mismatch_count: installmentTotals.total_mismatch_count
    },
    payments: {
      total_amount: paymentTotal.total_amount
    },
    cross_checks: {
      billing_items_subtotal_equals_billings_subtotal: billingItemsTotals.totals.subtotal === billingsTotals.totals.subtotal,
      adjustment_total_equals_billings_discount_total: adjustmentTotal.total_amount === billingsTotals.totals.discount_total,
      payment_total_equals_billings_paid_total: paymentTotal.total_amount === billingsTotals.totals.paid_total,
      billings_total_mismatch_count: billingsTotals.total_mismatch_count,
      billing_items_total_mismatch_count: billingItemsTotals.total_mismatch_count
    }
  };

  migrationStage5VAssertExpected_(issues, 'billings', 'subtotal', billingsTotals.totals.subtotal, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billings.subtotal);
  migrationStage5VAssertExpected_(issues, 'billings', 'discount_total', billingsTotals.totals.discount_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billings.discount_total);
  migrationStage5VAssertExpected_(issues, 'billings', 'grand_total', billingsTotals.totals.grand_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billings.grand_total);
  migrationStage5VAssertExpected_(issues, 'billings', 'paid_total', billingsTotals.totals.paid_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billings.paid_total);
  migrationStage5VAssertExpected_(issues, 'billings', 'outstanding_total', billingsTotals.totals.outstanding_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billings.outstanding_total);
  migrationStage5VAssertZero_(issues, 'billings', 'total_mismatch_count', billingsTotals.total_mismatch_count);

  migrationStage5VAssertExpected_(issues, 'billing_items', 'qty', billingItemsTotals.totals.qty, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_items.qty);
  migrationStage5VAssertExpected_(issues, 'billing_items', 'unit_price_total', billingItemsTotals.totals.unit_price_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_items.unit_price_total);
  migrationStage5VAssertExpected_(issues, 'billing_items', 'subtotal', billingItemsTotals.totals.subtotal, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_items.subtotal);
  migrationStage5VAssertZero_(issues, 'billing_items', 'total_mismatch_count', billingItemsTotals.total_mismatch_count);

  migrationStage5VAssertExpected_(issues, 'billing_adjustments', 'total_amount', adjustmentTotal.total_amount, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_adjustments.total_amount);
  migrationStage5VAssertExpected_(issues, 'payments', 'total_amount', paymentTotal.total_amount, MIGRATION_STAGE_5V_EXPECTED_TOTALS.payments.total_amount);

  migrationStage5VAssertExpected_(issues, 'billing_installments', 'amount_total', installmentTotals.amount_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_installments.amount_total);
  migrationStage5VAssertExpected_(issues, 'billing_installments', 'paid_total', installmentTotals.paid_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_installments.paid_total);
  migrationStage5VAssertExpected_(issues, 'billing_installments', 'outstanding_total', installmentTotals.outstanding_total, MIGRATION_STAGE_5V_EXPECTED_TOTALS.billing_installments.outstanding_total);
  migrationStage5VAssertZero_(issues, 'billing_installments', 'installment_total_mismatch_count', installmentTotals.total_mismatch_count);

  if (!status.cross_checks.billing_items_subtotal_equals_billings_subtotal) {
    issues.push(migrationStage5VIssue_(
      'error',
      'finance_totals',
      'BILLING_ITEMS_SUBTOTAL_NOT_EQUAL_BILLINGS_SUBTOTAL',
      'Total subtotal billing_items tidak sama dengan subtotal billings.',
      status.cross_checks
    ));
  }

  if (!status.cross_checks.adjustment_total_equals_billings_discount_total) {
    issues.push(migrationStage5VIssue_(
      'error',
      'finance_totals',
      'ADJUSTMENT_TOTAL_NOT_EQUAL_DISCOUNT_TOTAL',
      'Total billing_adjustments tidak sama dengan billings.discount_total.',
      status.cross_checks
    ));
  }

  if (!status.cross_checks.payment_total_equals_billings_paid_total) {
    issues.push(migrationStage5VIssue_(
      'error',
      'finance_totals',
      'PAYMENT_TOTAL_NOT_EQUAL_PAID_TOTAL',
      'Total payments tidak sama dengan billings.paid_total.',
      status.cross_checks
    ));
  }

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5V-D TREATMENT ITEMS DUPLICATE AUDIT
 ************************************************************/

function migrationStage5VAuditTreatmentItemDuplicates_() {
  var issues = [];

  var rowsResult = migrationStage5VLoadRows_(
    'treatment_items',
    'select=id,treatment_item_id,legacy_duplicate_group,legacy_duplicate_index,legacy_duplicate_count,mapping_status'
  );

  issues = issues.concat(rowsResult.issues || []);

  var groups = {};
  var duplicateGroupCount = 0;
  var duplicateRowCount = 0;
  var duplicateMetadataMissingCount = 0;
  var nonMappedCount = 0;

  (rowsResult.rows || []).forEach(function(row) {
    if (row.mapping_status !== 'mapped') {
      nonMappedCount++;
    }

    var legacyId = row.treatment_item_id || '';

    if (!groups[legacyId]) {
      groups[legacyId] = [];
    }

    groups[legacyId].push(row);
  });

  Object.keys(groups).forEach(function(legacyId) {
    var rows = groups[legacyId];

    if (legacyId && rows.length > 1) {
      duplicateGroupCount++;
      duplicateRowCount += rows.length;

      rows.forEach(function(row) {
        if (
          !row.legacy_duplicate_group ||
          row.legacy_duplicate_index === null ||
          row.legacy_duplicate_index === undefined ||
          row.legacy_duplicate_count !== rows.length
        ) {
          duplicateMetadataMissingCount++;
        }
      });
    }
  });

  var status = {
    row_count: rowsResult.rows ? rowsResult.rows.length : 0,
    duplicate_group_count: duplicateGroupCount,
    duplicate_row_count: duplicateRowCount,
    duplicate_metadata_missing_count: duplicateMetadataMissingCount,
    non_mapped_count: nonMappedCount,
    expected_duplicate_group_count: 46,
    expected_duplicate_row_count: 119
  };

  migrationStage5VAssertExpected_(issues, 'treatment_items', 'duplicate_group_count', duplicateGroupCount, 46);
  migrationStage5VAssertExpected_(issues, 'treatment_items', 'duplicate_row_count', duplicateRowCount, 119);
  migrationStage5VAssertZero_(issues, 'treatment_items', 'duplicate_metadata_missing_count', duplicateMetadataMissingCount);
  migrationStage5VAssertZero_(issues, 'treatment_items', 'non_mapped_count', nonMappedCount);

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5V-E MIGRATION ISSUES AUDIT
 ************************************************************/

function migrationStage5VAuditMigrationIssues_() {
  var issues = [];

  var totalCount = migrationStage5VCountRows_('migration_issues');
  var openCount = migrationStage5VCountRows_('migration_issues', 'status=eq.open');
  var warningCount = migrationStage5VCountRows_('migration_issues', 'severity=eq.warning');
  var errorCount = migrationStage5VCountRows_('migration_issues', 'severity=eq.error');

  var rowsResult = migrationStage5VLoadRows_(
    'migration_issues',
    'select=id,issue_type,severity,source_sheet,legacy_id,related_legacy_id,status,message'
  );

  issues = issues.concat(rowsResult.issues || []);

  var byKey = {};
  var unknownIssues = [];

  (rowsResult.rows || []).forEach(function(row) {
    var key = (row.source_sheet || '') + '|' + (row.issue_type || '');
    byKey[key] = (byKey[key] || 0) + 1;

    if (!MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.by_key.hasOwnProperty(key)) {
      unknownIssues.push(row);
    }
  });

  var status = {
    expected_total_count: MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.total_count,
    total_count: totalCount.count,
    open_count: openCount.count,
    warning_count: warningCount.count,
    error_count: errorCount.count,
    by_key: byKey,
    expected_by_key: MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.by_key,
    unknown_issue_count: unknownIssues.length,
    unknown_issues_sample: unknownIssues.slice(0, 20)
  };

  migrationStage5VAssertExpected_(issues, 'migration_issues', 'total_count', totalCount.count, MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.total_count);
  migrationStage5VAssertExpected_(issues, 'migration_issues', 'open_count', openCount.count, MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.total_count);
  migrationStage5VAssertExpected_(issues, 'migration_issues', 'warning_count', warningCount.count, MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.total_count);
  migrationStage5VAssertZero_(issues, 'migration_issues', 'error_count', errorCount.count);
  migrationStage5VAssertZero_(issues, 'migration_issues', 'unknown_issue_count', unknownIssues.length);

  Object.keys(MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.by_key).forEach(function(key) {
    var expected = MIGRATION_STAGE_5V_EXPECTED_KNOWN_ISSUES.by_key[key];
    var actual = byKey[key] || 0;

    if (actual !== expected) {
      issues.push(migrationStage5VIssue_(
        'error',
        'migration_issues',
        'KNOWN_ISSUE_COUNT_MISMATCH',
        'Jumlah known issue tidak sesuai untuk key ' + key + '.',
        {
          key: key,
          expected_count: expected,
          actual_count: actual
        }
      ));
    }
  });

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    status: status,
    issues: issues
  };
}


/************************************************************
 * 5V LOADERS
 ************************************************************/

function migrationStage5VLoadBillingsTotals_() {
  var issues = [];
  var rowsResult = migrationStage5VLoadRows_(
    'billings',
    'select=id,billing_id,subtotal,discount_total,grand_total,paid_total,outstanding_total'
  );

  issues = issues.concat(rowsResult.issues || []);

  var totals = {
    subtotal: 0,
    discount_total: 0,
    grand_total: 0,
    paid_total: 0,
    outstanding_total: 0
  };

  var totalMismatchCount = 0;

  (rowsResult.rows || []).forEach(function(row) {
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
    success: migrationStage5VHasNoBlockingIssues_(issues),
    issues: issues,
    totals: totals,
    total_mismatch_count: totalMismatchCount
  };
}


function migrationStage5VLoadBillingItemsTotals_() {
  var issues = [];
  var rowsResult = migrationStage5VLoadRows_(
    'billing_items',
    'select=id,billing_item_id,qty,unit_price,subtotal'
  );

  issues = issues.concat(rowsResult.issues || []);

  var totals = {
    qty: 0,
    unit_price_total: 0,
    subtotal: 0
  };

  var totalMismatchCount = 0;

  (rowsResult.rows || []).forEach(function(row) {
    var qty = migrationNormalizeNumber_5K_(row.qty) || 0;
    var unitPrice = migrationNormalizeNumber_5K_(row.unit_price) || 0;
    var subtotal = migrationNormalizeNumber_5K_(row.subtotal) || 0;

    totals.qty += qty;
    totals.unit_price_total += unitPrice;
    totals.subtotal += subtotal;

    if (subtotal !== qty * unitPrice) {
      totalMismatchCount++;
    }
  });

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    issues: issues,
    totals: totals,
    total_mismatch_count: totalMismatchCount
  };
}


function migrationStage5VLoadAmountTotal_(targetTable) {
  var issues = [];
  var rowsResult = migrationStage5VLoadRows_(
    targetTable,
    'select=id,amount'
  );

  issues = issues.concat(rowsResult.issues || []);

  var totalAmount = 0;

  (rowsResult.rows || []).forEach(function(row) {
    totalAmount += migrationNormalizeNumber_5K_(row.amount) || 0;
  });

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    issues: issues,
    total_amount: totalAmount
  };
}


function migrationStage5VLoadInstallmentTotals_() {
  var issues = [];
  var rowsResult = migrationStage5VLoadRows_(
    'billing_installments',
    'select=id,amount,paid_amount,outstanding_amount'
  );

  issues = issues.concat(rowsResult.issues || []);

  var amountTotal = 0;
  var paidTotal = 0;
  var outstandingTotal = 0;
  var mismatchCount = 0;

  (rowsResult.rows || []).forEach(function(row) {
    var amount = migrationNormalizeNumber_5K_(row.amount) || 0;
    var paidAmount = migrationNormalizeNumber_5K_(row.paid_amount) || 0;
    var outstandingAmount = migrationNormalizeNumber_5K_(row.outstanding_amount) || 0;

    amountTotal += amount;
    paidTotal += paidAmount;
    outstandingTotal += outstandingAmount;

    if (outstandingAmount !== amount - paidAmount) {
      mismatchCount++;
    }
  });

  return {
    success: migrationStage5VHasNoBlockingIssues_(issues),
    issues: issues,
    amount_total: amountTotal,
    paid_total: paidTotal,
    outstanding_total: outstandingTotal,
    total_mismatch_count: mismatchCount
  };
}


function migrationStage5VLoadRows_(tableName, selectQuery) {
  var issues = [];
  var rows = [];
  var offset = 0;
  var pageSize = 1000;
  var keepGoing = true;

  while (keepGoing) {
    var query = selectQuery + '&limit=' + pageSize + '&offset=' + offset;

    var response = migrationStage5VRequest_(
      'get',
      tableName,
      query,
      null,
      {}
    );

    if (!response.success) {
      issues.push(migrationStage5VIssue_(
        'error',
        tableName,
        'LOAD_ROWS_FAILED',
        'Gagal membaca rows dari table ' + tableName + '.',
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
    success: migrationStage5VHasNoBlockingIssues_(issues),
    rows: rows,
    issues: issues
  };
}


/************************************************************
 * 5V SUMMARY
 ************************************************************/

function migrationStage5VBuildFinalSummary_(tableCountAudit, relationshipAudit, financeAudit, treatmentDuplicateAudit, issueAudit, issues) {
  var errorCount = 0;
  var warningCount = 0;

  (issues || []).forEach(function(issue) {
    if (issue.severity === 'error') errorCount++;
    if (issue.severity === 'warning') warningCount++;
  });

  return {
    ready_for_phase_6_read_only_supabase_mode: errorCount === 0,
    all_table_counts_clean: tableCountAudit.success,
    all_relationships_clean_or_expected: relationshipAudit.success,
    finance_totals_clean: financeAudit.success,
    treatment_item_duplicate_handling_clean: treatmentDuplicateAudit.success,
    migration_issues_classified: issueAudit.success,
    known_manual_test_artifacts_documented: {
      ortho_recall_install_treatment_missing_parent: 1,
      billings_treatment_missing_parent: 1,
      billing_items_treatment_missing_parent: 1,
      billing_items_treatment_item_not_mapped: 1
    },
    error_count: errorCount,
    warning_count: warningCount
  };
}


/************************************************************
 * 5V ASSERTIONS
 ************************************************************/

function migrationStage5VAssertZero_(issues, targetTable, metricName, actualValue) {
  migrationStage5VAssertExpected_(issues, targetTable, metricName, actualValue, 0);
}


function migrationStage5VAssertExpected_(issues, targetTable, metricName, actualValue, expectedValue) {
  if (actualValue !== expectedValue) {
    issues.push(migrationStage5VIssue_(
      'error',
      targetTable,
      'FINAL_AUDIT_METRIC_MISMATCH',
      'Metric final audit tidak sesuai expected: ' + targetTable + '.' + metricName,
      {
        metric: metricName,
        expected_value: expectedValue,
        actual_value: actualValue
      }
    ));
  }
}


/************************************************************
 * 5V SUPABASE HTTP HELPERS
 ************************************************************/

function migrationStage5VGetConfig_() {
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


function migrationStage5VRequest_(method, tableName, queryString, body, extraHeaders) {
  var config = migrationStage5VGetConfig_();

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
  var parsedBody = migrationStage5VParseJsonSafely_(text);
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


function migrationStage5VCountRows_(tableName, filterQuery) {
  var query = 'select=id';

  if (filterQuery) {
    query += '&' + filterQuery;
  }

  var response = migrationStage5VRequest_(
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

  var count = migrationStage5VParseCountFromContentRange_(contentRange);

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
 * 5V GENERIC UTILITIES
 ************************************************************/

function migrationStage5VBaseResult_(mode) {
  return {
    success: false,
    checked_at: migrationStage5VNowIso_(),
    stage: MIGRATION_STAGE_5V_NAME,
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


function migrationStage5VIssue_(severity, targetTable, code, message, details) {
  return {
    severity: severity || 'warning',
    target_table: targetTable || '',
    code: code || '',
    message: message || '',
    details: details || null
  };
}


function migrationStage5VHasNoBlockingIssues_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') return false;
  }

  return true;
}


function migrationStage5VParseCountFromContentRange_(contentRange) {
  if (!contentRange) return null;

  var match = String(contentRange).match(/\/(\d+)$/);

  if (!match) return null;

  var count = Number(match[1]);
  return isNaN(count) ? null : count;
}


function migrationStage5VParseJsonSafely_(text) {
  if (text === null || text === undefined || text === '') return null;

  if (typeof text !== 'string') return text;

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}


function migrationStage5VNowIso_() {
  return Utilities.formatDate(
    new Date(),
    migrationStage5VGetTimezone_(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function migrationStage5VGetTimezone_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}


function migrationStage5VLogJson_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  var chunkSize = 8000;

  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}