/* =========================================================
   PHASE 6G - FINANCE RAW DATA UI READ OPTIONS
   ========================================================= */

function getFinanceRawDataUiReadOptions_(options) {
  const opts = Object.assign({}, options || {});

  if (opts.backend_mode) {
    return opts;
  }

  if (typeof repoBuildUiReadOptions_ === 'function') {
    return repoBuildUiReadOptions_(opts);
  }

  return Object.assign({}, opts, {
    backend_mode: 'spreadsheet',
    ui_read_supabase_test_enabled: false
  });
}

function getFinanceRawDataUiReadBackendMode_(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

/* =========================================================
   FINANCE RAW DATA
   Tahap 3C:
   Fungsi raw lama tetap dipertahankan namanya,
   tetapi sumber baca diarahkan ke FinanceRepository.
   ========================================================= */

function getBillingsRaw(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getBillingsRaw === 'function'
  ) {
    return FinanceRepository.getBillingsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.BILLINGS || 'Billings', opts) || [];
  }

  return getRowsAsObjects('Billings') || [];
}

function getBillingItemsRaw(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getBillingItemsRaw === 'function'
  ) {
    return FinanceRepository.getBillingItemsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.BILLING_ITEMS || 'BillingItems', opts) || [];
  }

  return getRowsAsObjects('BillingItems') || [];
}

function getBillingAdjustmentsRaw(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getBillingAdjustmentsRaw === 'function'
  ) {
    return FinanceRepository.getBillingAdjustmentsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.BILLING_ADJUSTMENTS || 'BillingAdjustments', opts) || [];
  }

  return getRowsAsObjects('BillingAdjustments') || [];
}

function getPaymentsRaw(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getPaymentsRaw === 'function'
  ) {
    return FinanceRepository.getPaymentsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.PAYMENTS || 'Payments', opts) || [];
  }

  return getRowsAsObjects('Payments') || [];
}

function getBillingPaymentsRaw(options) {
  return getPaymentsRaw(options);
}

function getBillingInstallmentsRaw(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getBillingInstallmentsRaw === 'function'
  ) {
    return FinanceRepository.getBillingInstallmentsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.BILLING_INSTALLMENTS || 'BillingInstallments', opts) || [];
  }

  return getRowsAsObjects('BillingInstallments') || [];
}

function getBillingFeedbacksRaw(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getBillingFeedbacksRaw === 'function'
  ) {
    return FinanceRepository.getBillingFeedbacksRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.BILLING_FEEDBACKS || 'BillingFeedbacks', opts) || [];
  }

  return getRowsAsObjects('BillingFeedbacks') || [];
}

/* =========================================================
   FINANCE RAW CONTEXT
   Request-scope helper untuk mengurangi pembacaan sheet berulang.
   Helper ini tidak memakai CacheService dan tidak menyimpan data lintas request.
   ========================================================= */

function buildFinanceRawContext_(options) {
  const opts = getFinanceRawDataUiReadOptions_(options);

  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.buildRawContext === 'function'
  ) {
    return FinanceRepository.buildRawContext(opts);
  }

  const only = opts.only || {};
  const hasOnlyFilter = Object.keys(only).length > 0;

  return {
    backend_mode: getFinanceRawDataUiReadBackendMode_(opts),

    billings: !hasOnlyFilter || only.billings === true
      ? getBillingsRaw(opts)
      : [],

    billingItems: !hasOnlyFilter || only.billingItems === true
      ? getBillingItemsRaw(opts)
      : [],

    billingAdjustments: !hasOnlyFilter || only.billingAdjustments === true
      ? getBillingAdjustmentsRaw(opts)
      : [],

    payments: !hasOnlyFilter || only.payments === true
      ? getPaymentsRaw(opts)
      : [],

    billingInstallments: !hasOnlyFilter || only.billingInstallments === true
      ? getBillingInstallmentsRaw(opts)
      : [],

    billingFeedbacks: !hasOnlyFilter || only.billingFeedbacks === true
      ? getBillingFeedbacksRaw(opts)
      : []
  };
}

function getFinanceRawContextRows_(ctx, key) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.getRawContextRows === 'function'
  ) {
    return FinanceRepository.getRawContextRows(ctx, key);
  }

  if (!ctx || !key) return [];

  const rows = ctx[key];

  return Array.isArray(rows) ? rows : [];
}

function findBillingRawByIdFromContext_(ctx, billingId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.findBillingRawByIdFromContext === 'function'
  ) {
    return FinanceRepository.findBillingRawByIdFromContext(ctx, billingId);
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return null;

  return getFinanceRawContextRows_(ctx, 'billings').find(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  }) || null;
}

function findBillingRawByTreatmentIdFromContext_(ctx, treatmentId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.findBillingRawByTreatmentIdFromContext === 'function'
  ) {
    return FinanceRepository.findBillingRawByTreatmentIdFromContext(ctx, treatmentId);
  }

  const normalizedTreatmentId = String(treatmentId || '').trim();

  if (!normalizedTreatmentId) return null;

  return getFinanceRawContextRows_(ctx, 'billings').find(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  }) || null;
}

function getBillingItemsByBillingIdFromContext_(ctx, billingId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.listBillingItemsByBillingIdFromContext === 'function'
  ) {
    return FinanceRepository.listBillingItemsByBillingIdFromContext(ctx, billingId);
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getFinanceRawContextRows_(ctx, 'billingItems').filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

function getBillingAdjustmentsByBillingIdFromContext_(ctx, billingId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.listBillingAdjustmentsByBillingIdFromContext === 'function'
  ) {
    return FinanceRepository.listBillingAdjustmentsByBillingIdFromContext(ctx, billingId);
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getFinanceRawContextRows_(ctx, 'billingAdjustments').filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

function getPaymentsByBillingIdFromContext_(ctx, billingId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.listPaymentsByBillingIdFromContext === 'function'
  ) {
    return FinanceRepository.listPaymentsByBillingIdFromContext(ctx, billingId);
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getFinanceRawContextRows_(ctx, 'payments').filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

function getBillingInstallmentsByBillingIdFromContext_(ctx, billingId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.listInstallmentsByBillingIdFromContext === 'function'
  ) {
    return FinanceRepository.listInstallmentsByBillingIdFromContext(ctx, billingId);
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getFinanceRawContextRows_(ctx, 'billingInstallments')
    .filter(function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    })
    .sort(function(a, b) {
      const dueCompare = String(financeExtractYmd_(a.due_date || '')).localeCompare(
        String(financeExtractYmd_(b.due_date || ''))
      );

      if (dueCompare !== 0) return dueCompare;

      return Number(a.installment_no || 0) - Number(b.installment_no || 0);
    });
}

function findBillingFeedbackRawByBillingIdFromContext_(ctx, billingId) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.findFeedbackByBillingIdFromContext === 'function'
  ) {
    return FinanceRepository.findFeedbackByBillingIdFromContext(ctx, billingId);
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return null;

  return getFinanceRawContextRows_(ctx, 'billingFeedbacks').find(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  }) || null;
}

function findBillingFeedbackRawByTokenFromContext_(ctx, token) {
  if (
    typeof FinanceRepository !== 'undefined' &&
    FinanceRepository &&
    typeof FinanceRepository.findFeedbackByTokenFromContext === 'function'
  ) {
    return FinanceRepository.findFeedbackByTokenFromContext(ctx, token);
  }

  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) return null;

  return getFinanceRawContextRows_(ctx, 'billingFeedbacks').find(function(row) {
    return String(row.feedback_token || '').trim() === normalizedToken;
  }) || null;
}

/* =========================================================
   FINANCE SHEET NAME HELPERS
   ========================================================= */

function getBillingInstallmentSheetName_() {
  return 'BillingInstallments';
}

function getBillingSheetNameForInstallment_() {
  return 'Billings';
}

/*
  Compatibility helper.
  Di sistem kita, pembayaran billing disimpan di sheet Payments,
  bukan BillingPayments.
*/
function getBillingPaymentSheetNameForInstallment_() {
  return 'Payments';
}

function getBillingPaymentsForInstallmentRaw_(options) {
  if (typeof getBillingPaymentsRaw === 'function') {
    return getBillingPaymentsRaw(options) || [];
  }

  const opts = getFinanceRawDataUiReadOptions_(options);

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.PAYMENTS || getBillingPaymentSheetNameForInstallment_(), opts) || [];
  }

  return getRowsAsObjects(getBillingPaymentSheetNameForInstallment_()) || [];
}

/* =========================================================
   PHASE 3C MANUAL TESTS
   FinanceRawData -> FinanceRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testFinanceRawDataPhase3CRepositoryBridge() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    counts: {}
  };

  try {
    const checks = [
      {
        key: 'billings',
        legacyFn: getBillingsRaw,
        repoFn: FinanceRepository.getBillingsRaw
      },
      {
        key: 'billingItems',
        legacyFn: getBillingItemsRaw,
        repoFn: FinanceRepository.getBillingItemsRaw
      },
      {
        key: 'billingAdjustments',
        legacyFn: getBillingAdjustmentsRaw,
        repoFn: FinanceRepository.getBillingAdjustmentsRaw
      },
      {
        key: 'payments',
        legacyFn: getPaymentsRaw,
        repoFn: FinanceRepository.getPaymentsRaw
      },
      {
        key: 'billingInstallments',
        legacyFn: getBillingInstallmentsRaw,
        repoFn: FinanceRepository.getBillingInstallmentsRaw
      },
      {
        key: 'billingFeedbacks',
        legacyFn: getBillingFeedbacksRaw,
        repoFn: FinanceRepository.getBillingFeedbacksRaw
      }
    ];

    checks.forEach(function(check) {
      const legacyRows = check.legacyFn();
      const repoRows = check.repoFn();

      const legacyCount = Array.isArray(legacyRows) ? legacyRows.length : -1;
      const repoCount = Array.isArray(repoRows) ? repoRows.length : -1;

      result.counts[check.key] = {
        legacy_count: legacyCount,
        repository_count: repoCount,
        match: legacyCount === repoCount
      };

      if (!Array.isArray(legacyRows)) {
        result.issues.push({
          key: check.key,
          issue: 'LEGACY_RAW_NOT_ARRAY'
        });
      }

      if (!Array.isArray(repoRows)) {
        result.issues.push({
          key: check.key,
          issue: 'REPOSITORY_RAW_NOT_ARRAY'
        });
      }

      if (legacyCount !== repoCount) {
        result.issues.push({
          key: check.key,
          legacy_count: legacyCount,
          repository_count: repoCount,
          issue: 'COUNT_MISMATCH'
        });
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinanceRawDataPhase3CRawContext() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    context_counts: {}
  };

  try {
    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        payments: true,
        billingFeedbacks: true,
        billingInstallments: true
      }
    });

    const expectedKeys = [
      'billings',
      'payments',
      'billingFeedbacks',
      'billingInstallments'
    ];

    expectedKeys.forEach(function(key) {
      const rows = getFinanceRawContextRows_(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_ROWS_NOT_ARRAY'
        });
      }
    });

    const unloadedKeys = [
      'billingItems',
      'billingAdjustments'
    ];

    unloadedKeys.forEach(function(key) {
      const rows = getFinanceRawContextRows_(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'UNLOADED_CONTEXT_ROWS_NOT_ARRAY'
        });
      }

      if (Array.isArray(rows) && rows.length > 0) {
        result.issues.push({
          key: key,
          row_count: rows.length,
          issue: 'UNLOADED_CONTEXT_SHOULD_BE_EMPTY'
        });
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinanceRawDataPhase3CBillingContextSample() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        payments: true,
        billingInstallments: true,
        billingFeedbacks: true
      }
    });

    const billings = getFinanceRawContextRows_(ctx, 'billings');
    const firstBilling = billings.length ? billings[0] : null;
    const billingId = firstBilling
      ? String(firstBilling.billing_id || '').trim()
      : '';

    result.sample.billing_count = billings.length;
    result.sample.first_billing_id = billingId;

    if (!billingId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada billing untuk sample context test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundBilling = findBillingRawByIdFromContext_(ctx, billingId);
    const items = getBillingItemsByBillingIdFromContext_(ctx, billingId);
    const adjustments = getBillingAdjustmentsByBillingIdFromContext_(ctx, billingId);
    const payments = getPaymentsByBillingIdFromContext_(ctx, billingId);
    const installments = getBillingInstallmentsByBillingIdFromContext_(ctx, billingId);
    const feedback = findBillingFeedbackRawByBillingIdFromContext_(ctx, billingId);

    result.sample.find_billing_ok = !!foundBilling;
    result.sample.item_count = items.length;
    result.sample.adjustment_count = adjustments.length;
    result.sample.payment_count = payments.length;
    result.sample.installment_count = installments.length;
    result.sample.has_feedback = !!feedback;

    if (!foundBilling) {
      result.issues.push({
        billing_id: billingId,
        issue: 'FIND_BILLING_FROM_CONTEXT_FAILED'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   PHASE 3D MANUAL TESTS
   FinanceRawData context helper -> FinanceRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testFinanceRawDataPhase3DContextFinderBridge() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        payments: true,
        billingInstallments: true,
        billingFeedbacks: true
      }
    });

    const billings = getFinanceRawContextRows_(ctx, 'billings');
    const firstBilling = billings.length ? billings[0] : null;
    const billingId = firstBilling ? String(firstBilling.billing_id || '').trim() : '';
    const treatmentId = firstBilling ? String(firstBilling.treatment_id || '').trim() : '';

    result.sample.billing_count = billings.length;
    result.sample.first_billing_id = billingId;
    result.sample.first_treatment_id = treatmentId;

    if (!billingId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada billing untuk context finder test';
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperBillingById = findBillingRawByIdFromContext_(ctx, billingId);
    const repoBillingById = FinanceRepository.findBillingRawByIdFromContext(ctx, billingId);

    const wrapperBillingByTreatment = treatmentId
      ? findBillingRawByTreatmentIdFromContext_(ctx, treatmentId)
      : null;

    const repoBillingByTreatment = treatmentId
      ? FinanceRepository.findBillingRawByTreatmentIdFromContext(ctx, treatmentId)
      : null;

    const wrapperItems = getBillingItemsByBillingIdFromContext_(ctx, billingId);
    const repoItems = FinanceRepository.listBillingItemsByBillingIdFromContext(ctx, billingId);

    const wrapperAdjustments = getBillingAdjustmentsByBillingIdFromContext_(ctx, billingId);
    const repoAdjustments = FinanceRepository.listBillingAdjustmentsByBillingIdFromContext(ctx, billingId);

    const wrapperPayments = getPaymentsByBillingIdFromContext_(ctx, billingId);
    const repoPayments = FinanceRepository.listPaymentsByBillingIdFromContext(ctx, billingId);

    const wrapperInstallments = getBillingInstallmentsByBillingIdFromContext_(ctx, billingId);
    const repoInstallments = FinanceRepository.listInstallmentsByBillingIdFromContext(ctx, billingId);

    const wrapperFeedback = findBillingFeedbackRawByBillingIdFromContext_(ctx, billingId);
    const repoFeedback = FinanceRepository.findFeedbackByBillingIdFromContext(ctx, billingId);

    result.sample.wrapper_find_billing_ok = !!wrapperBillingById;
    result.sample.repo_find_billing_ok = !!repoBillingById;

    result.sample.wrapper_find_treatment_ok = treatmentId ? !!wrapperBillingByTreatment : true;
    result.sample.repo_find_treatment_ok = treatmentId ? !!repoBillingByTreatment : true;

    result.sample.item_count = wrapperItems.length;
    result.sample.adjustment_count = wrapperAdjustments.length;
    result.sample.payment_count = wrapperPayments.length;
    result.sample.installment_count = wrapperInstallments.length;
    result.sample.has_feedback = !!wrapperFeedback;

    if (!wrapperBillingById || !repoBillingById) {
      result.issues.push({
        billing_id: billingId,
        issue: 'FIND_BILLING_BY_ID_FAILED'
      });
    }

    if (wrapperItems.length !== repoItems.length) {
      result.issues.push({
        billing_id: billingId,
        wrapper_count: wrapperItems.length,
        repository_count: repoItems.length,
        issue: 'ITEM_COUNT_MISMATCH'
      });
    }

    if (wrapperAdjustments.length !== repoAdjustments.length) {
      result.issues.push({
        billing_id: billingId,
        wrapper_count: wrapperAdjustments.length,
        repository_count: repoAdjustments.length,
        issue: 'ADJUSTMENT_COUNT_MISMATCH'
      });
    }

    if (wrapperPayments.length !== repoPayments.length) {
      result.issues.push({
        billing_id: billingId,
        wrapper_count: wrapperPayments.length,
        repository_count: repoPayments.length,
        issue: 'PAYMENT_COUNT_MISMATCH'
      });
    }

    if (wrapperInstallments.length !== repoInstallments.length) {
      result.issues.push({
        billing_id: billingId,
        wrapper_count: wrapperInstallments.length,
        repository_count: repoInstallments.length,
        issue: 'INSTALLMENT_COUNT_MISMATCH'
      });
    }

    const wrapperFeedbackId = wrapperFeedback ? String(wrapperFeedback.feedback_id || '').trim() : '';
    const repoFeedbackId = repoFeedback ? String(repoFeedback.feedback_id || '').trim() : '';

    if (wrapperFeedbackId !== repoFeedbackId) {
      result.issues.push({
        billing_id: billingId,
        wrapper_feedback_id: wrapperFeedbackId,
        repository_feedback_id: repoFeedbackId,
        issue: 'FEEDBACK_MISMATCH'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinanceRawDataPhase3DFeedbackTokenContextFinder() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const ctx = buildFinanceRawContext_({
      only: {
        billingFeedbacks: true
      }
    });

    const feedbacks = getFinanceRawContextRows_(ctx, 'billingFeedbacks');
    const sampleFeedback = feedbacks.find(function(row) {
      return !!String(row.feedback_token || '').trim();
    }) || null;

    const token = sampleFeedback
      ? String(sampleFeedback.feedback_token || '').trim()
      : '';

    result.sample.feedback_count = feedbacks.length;
    result.sample.sample_token_found = !!token;

    if (!token) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada feedback_token untuk sample test';
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperFeedback = findBillingFeedbackRawByTokenFromContext_(ctx, token);
    const repoFeedback = FinanceRepository.findFeedbackByTokenFromContext(ctx, token);

    const wrapperId = wrapperFeedback ? String(wrapperFeedback.feedback_id || '').trim() : '';
    const repoId = repoFeedback ? String(repoFeedback.feedback_id || '').trim() : '';

    result.sample.wrapper_feedback_id = wrapperId;
    result.sample.repository_feedback_id = repoId;
    result.sample.find_by_token_ok = !!wrapperFeedback && !!repoFeedback && wrapperId === repoId;

    if (!result.sample.find_by_token_ok) {
      result.issues.push({
        issue: 'FIND_FEEDBACK_BY_TOKEN_MISMATCH',
        wrapper_feedback_id: wrapperId,
        repository_feedback_id: repoId
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   PHASE 3E FINAL AUDIT
   Final audit FinanceRawData -> FinanceRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testFinanceRawDataPhase3EFinalRepositoryBridgeAudit() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    method_audit: {},
    raw_count_audit: {},
    context_count_audit: {},
    sample_audit: {}
  };

  try {
    if (typeof FinanceRepository === 'undefined' || !FinanceRepository) {
      result.issues.push({
        issue: 'FINANCE_REPOSITORY_NOT_FOUND'
      });

      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const requiredMethods = [
      'getBillingsRaw',
      'getBillingItemsRaw',
      'getBillingAdjustmentsRaw',
      'getBillingInstallmentsRaw',
      'getPaymentsRaw',
      'getBillingFeedbacksRaw',
      'findBillingById',
      'findBillingItemById',
      'findPaymentById',
      'findInstallmentById',
      'listBillingItemsByBillingId',
      'listBillingAdjustmentsByBillingId',
      'listPaymentsByBillingId',
      'listInstallmentsByBillingId',
      'listFeedbacksByBillingId',
      'buildRawContext',
      'getRawContextRows',
      'findBillingRawByIdFromContext',
      'findBillingRawByTreatmentIdFromContext',
      'listBillingItemsByBillingIdFromContext',
      'listBillingAdjustmentsByBillingIdFromContext',
      'listPaymentsByBillingIdFromContext',
      'listInstallmentsByBillingIdFromContext',
      'findFeedbackByBillingIdFromContext',
      'findFeedbackByTokenFromContext'
    ];

    requiredMethods.forEach(function(methodName) {
      const exists = typeof FinanceRepository[methodName] === 'function';

      result.method_audit[methodName] = exists ? 'OK' : 'MISSING';

      if (!exists) {
        result.issues.push({
          method: methodName,
          issue: 'REPOSITORY_METHOD_MISSING'
        });
      }
    });

    const forbiddenWriteLikeMethods = Object.keys(FinanceRepository).filter(function(key) {
      return /^(create|insert|append|update|delete|remove|clear|save|record|submit)/i.test(key);
    });

    result.method_audit.forbidden_write_like_methods = forbiddenWriteLikeMethods;

    if (forbiddenWriteLikeMethods.length) {
      result.issues.push({
        methods: forbiddenWriteLikeMethods,
        issue: 'FINANCE_REPOSITORY_SHOULD_STAY_READ_ONLY_IN_PHASE_3E'
      });
    }

    const rawChecks = [
      {
        key: 'billings',
        wrapperFn: getBillingsRaw,
        repoFn: FinanceRepository.getBillingsRaw
      },
      {
        key: 'billingItems',
        wrapperFn: getBillingItemsRaw,
        repoFn: FinanceRepository.getBillingItemsRaw
      },
      {
        key: 'billingAdjustments',
        wrapperFn: getBillingAdjustmentsRaw,
        repoFn: FinanceRepository.getBillingAdjustmentsRaw
      },
      {
        key: 'payments',
        wrapperFn: getPaymentsRaw,
        repoFn: FinanceRepository.getPaymentsRaw
      },
      {
        key: 'billingInstallments',
        wrapperFn: getBillingInstallmentsRaw,
        repoFn: FinanceRepository.getBillingInstallmentsRaw
      },
      {
        key: 'billingFeedbacks',
        wrapperFn: getBillingFeedbacksRaw,
        repoFn: FinanceRepository.getBillingFeedbacksRaw
      }
    ];

    rawChecks.forEach(function(check) {
      const wrapperRows = check.wrapperFn();
      const repoRows = check.repoFn();

      const wrapperCount = Array.isArray(wrapperRows) ? wrapperRows.length : -1;
      const repoCount = Array.isArray(repoRows) ? repoRows.length : -1;

      result.raw_count_audit[check.key] = {
        wrapper_count: wrapperCount,
        repository_count: repoCount,
        match: wrapperCount === repoCount
      };

      if (!Array.isArray(wrapperRows)) {
        result.issues.push({
          key: check.key,
          issue: 'WRAPPER_RAW_NOT_ARRAY'
        });
      }

      if (!Array.isArray(repoRows)) {
        result.issues.push({
          key: check.key,
          issue: 'REPOSITORY_RAW_NOT_ARRAY'
        });
      }

      if (wrapperCount !== repoCount) {
        result.issues.push({
          key: check.key,
          wrapper_count: wrapperCount,
          repository_count: repoCount,
          issue: 'RAW_COUNT_MISMATCH'
        });
      }
    });

    const wrapperCtx = buildFinanceRawContext_({
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        payments: true,
        billingInstallments: true,
        billingFeedbacks: true
      }
    });

    const repoCtx = FinanceRepository.buildRawContext({
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        payments: true,
        billingInstallments: true,
        billingFeedbacks: true
      }
    });

    const contextKeys = [
      'billings',
      'billingItems',
      'billingAdjustments',
      'payments',
      'billingInstallments',
      'billingFeedbacks'
    ];

    contextKeys.forEach(function(key) {
      const wrapperRows = getFinanceRawContextRows_(wrapperCtx, key);
      const repoRows = FinanceRepository.getRawContextRows(repoCtx, key);

      const wrapperCount = Array.isArray(wrapperRows) ? wrapperRows.length : -1;
      const repoCount = Array.isArray(repoRows) ? repoRows.length : -1;

      result.context_count_audit[key] = {
        wrapper_context_count: wrapperCount,
        repository_context_count: repoCount,
        match: wrapperCount === repoCount
      };

      if (!Array.isArray(wrapperRows)) {
        result.issues.push({
          key: key,
          issue: 'WRAPPER_CONTEXT_ROWS_NOT_ARRAY'
        });
      }

      if (!Array.isArray(repoRows)) {
        result.issues.push({
          key: key,
          issue: 'REPOSITORY_CONTEXT_ROWS_NOT_ARRAY'
        });
      }

      if (wrapperCount !== repoCount) {
        result.issues.push({
          key: key,
          wrapper_context_count: wrapperCount,
          repository_context_count: repoCount,
          issue: 'CONTEXT_COUNT_MISMATCH'
        });
      }
    });

    const billings = getFinanceRawContextRows_(wrapperCtx, 'billings');
    const firstBilling = billings.length ? billings[0] : null;
    const billingId = firstBilling ? String(firstBilling.billing_id || '').trim() : '';
    const treatmentId = firstBilling ? String(firstBilling.treatment_id || '').trim() : '';

    result.sample_audit.billing_count = billings.length;
    result.sample_audit.first_billing_id = billingId;
    result.sample_audit.first_treatment_id = treatmentId;

    if (billingId) {
      const wrapperBilling = findBillingRawByIdFromContext_(wrapperCtx, billingId);
      const repoBilling = FinanceRepository.findBillingRawByIdFromContext(wrapperCtx, billingId);

      const wrapperItems = getBillingItemsByBillingIdFromContext_(wrapperCtx, billingId);
      const repoItems = FinanceRepository.listBillingItemsByBillingIdFromContext(wrapperCtx, billingId);

      const wrapperAdjustments = getBillingAdjustmentsByBillingIdFromContext_(wrapperCtx, billingId);
      const repoAdjustments = FinanceRepository.listBillingAdjustmentsByBillingIdFromContext(wrapperCtx, billingId);

      const wrapperPayments = getPaymentsByBillingIdFromContext_(wrapperCtx, billingId);
      const repoPayments = FinanceRepository.listPaymentsByBillingIdFromContext(wrapperCtx, billingId);

      const wrapperInstallments = getBillingInstallmentsByBillingIdFromContext_(wrapperCtx, billingId);
      const repoInstallments = FinanceRepository.listInstallmentsByBillingIdFromContext(wrapperCtx, billingId);

      const wrapperFeedback = findBillingFeedbackRawByBillingIdFromContext_(wrapperCtx, billingId);
      const repoFeedback = FinanceRepository.findFeedbackByBillingIdFromContext(wrapperCtx, billingId);

      result.sample_audit.find_billing_wrapper_ok = !!wrapperBilling;
      result.sample_audit.find_billing_repository_ok = !!repoBilling;

      result.sample_audit.item_count_match = wrapperItems.length === repoItems.length;
      result.sample_audit.adjustment_count_match = wrapperAdjustments.length === repoAdjustments.length;
      result.sample_audit.payment_count_match = wrapperPayments.length === repoPayments.length;
      result.sample_audit.installment_count_match = wrapperInstallments.length === repoInstallments.length;

      const wrapperFeedbackId = wrapperFeedback ? String(wrapperFeedback.feedback_id || '').trim() : '';
      const repoFeedbackId = repoFeedback ? String(repoFeedback.feedback_id || '').trim() : '';

      result.sample_audit.feedback_id_match = wrapperFeedbackId === repoFeedbackId;

      if (!wrapperBilling || !repoBilling) {
        result.issues.push({
          billing_id: billingId,
          issue: 'SAMPLE_FIND_BILLING_FAILED'
        });
      }

      if (wrapperItems.length !== repoItems.length) {
        result.issues.push({
          billing_id: billingId,
          issue: 'SAMPLE_ITEM_COUNT_MISMATCH'
        });
      }

      if (wrapperAdjustments.length !== repoAdjustments.length) {
        result.issues.push({
          billing_id: billingId,
          issue: 'SAMPLE_ADJUSTMENT_COUNT_MISMATCH'
        });
      }

      if (wrapperPayments.length !== repoPayments.length) {
        result.issues.push({
          billing_id: billingId,
          issue: 'SAMPLE_PAYMENT_COUNT_MISMATCH'
        });
      }

      if (wrapperInstallments.length !== repoInstallments.length) {
        result.issues.push({
          billing_id: billingId,
          issue: 'SAMPLE_INSTALLMENT_COUNT_MISMATCH'
        });
      }

      if (wrapperFeedbackId !== repoFeedbackId) {
        result.issues.push({
          billing_id: billingId,
          wrapper_feedback_id: wrapperFeedbackId,
          repository_feedback_id: repoFeedbackId,
          issue: 'SAMPLE_FEEDBACK_ID_MISMATCH'
        });
      }

      if (treatmentId) {
        const wrapperByTreatment = findBillingRawByTreatmentIdFromContext_(wrapperCtx, treatmentId);
        const repoByTreatment = FinanceRepository.findBillingRawByTreatmentIdFromContext(wrapperCtx, treatmentId);

        const wrapperByTreatmentId = wrapperByTreatment ? String(wrapperByTreatment.billing_id || '').trim() : '';
        const repoByTreatmentId = repoByTreatment ? String(repoByTreatment.billing_id || '').trim() : '';

        result.sample_audit.find_by_treatment_match = wrapperByTreatmentId === repoByTreatmentId;

        if (wrapperByTreatmentId !== repoByTreatmentId) {
          result.issues.push({
            treatment_id: treatmentId,
            wrapper_billing_id: wrapperByTreatmentId,
            repository_billing_id: repoByTreatmentId,
            issue: 'SAMPLE_FIND_BY_TREATMENT_MISMATCH'
          });
        }
      }
    } else {
      result.sample_audit.skipped = true;
      result.sample_audit.reason = 'Belum ada billing untuk sample audit';
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinanceRawDataPhase3ERegressionPack() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    tests: []
  };

  try {
    const testList = [
      {
        name: 'testFinanceRepositoryPhase3BReadOnly',
        fn: typeof testFinanceRepositoryPhase3BReadOnly === 'function'
          ? testFinanceRepositoryPhase3BReadOnly
          : null
      },
      {
        name: 'testFinanceRepositoryPhase3BBuildRawContext',
        fn: typeof testFinanceRepositoryPhase3BBuildRawContext === 'function'
          ? testFinanceRepositoryPhase3BBuildRawContext
          : null
      },
      {
        name: 'testFinanceRepositoryPhase3BFindBillingSample',
        fn: typeof testFinanceRepositoryPhase3BFindBillingSample === 'function'
          ? testFinanceRepositoryPhase3BFindBillingSample
          : null
      },
      {
        name: 'testFinanceRawDataPhase3CRepositoryBridge',
        fn: typeof testFinanceRawDataPhase3CRepositoryBridge === 'function'
          ? testFinanceRawDataPhase3CRepositoryBridge
          : null
      },
      {
        name: 'testFinanceRawDataPhase3CRawContext',
        fn: typeof testFinanceRawDataPhase3CRawContext === 'function'
          ? testFinanceRawDataPhase3CRawContext
          : null
      },
      {
        name: 'testFinanceRawDataPhase3CBillingContextSample',
        fn: typeof testFinanceRawDataPhase3CBillingContextSample === 'function'
          ? testFinanceRawDataPhase3CBillingContextSample
          : null
      },
      {
        name: 'testFinanceRawDataPhase3DContextFinderBridge',
        fn: typeof testFinanceRawDataPhase3DContextFinderBridge === 'function'
          ? testFinanceRawDataPhase3DContextFinderBridge
          : null
      },
      {
        name: 'testFinanceRawDataPhase3DFeedbackTokenContextFinder',
        fn: typeof testFinanceRawDataPhase3DFeedbackTokenContextFinder === 'function'
          ? testFinanceRawDataPhase3DFeedbackTokenContextFinder
          : null
      },
      {
        name: 'testFinanceRawDataPhase3EFinalRepositoryBridgeAudit',
        fn: typeof testFinanceRawDataPhase3EFinalRepositoryBridgeAudit === 'function'
          ? testFinanceRawDataPhase3EFinalRepositoryBridgeAudit
          : null
      }
    ];

    testList.forEach(function(item) {
      if (!item.fn) {
        result.tests.push({
          name: item.name,
          success: false,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        result.issues.push({
          test: item.name,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        return;
      }

      const testResult = item.fn();
      const success = !!(testResult && testResult.success === true);
      const issueCount = testResult && testResult.issue_count !== undefined
        ? Number(testResult.issue_count || 0)
        : (success ? 0 : 1);

      result.tests.push({
        name: item.name,
        success: success,
        issue_count: issueCount
      });

      if (!success || issueCount > 0) {
        result.issues.push({
          test: item.name,
          success: success,
          issue_count: issueCount,
          issue: 'REGRESSION_TEST_FAILED'
        });
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinanceRawDataPhase6GUiReadLog() {
  const result = {
    success: true,
    stage: '6G-FinanceRawData',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getFinanceRawDataUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    counts: {},
    context_counts: {},
    issue_count: 0,
    issues: []
  };

  function assertArray(key, rows) {
    result.counts[key] = Array.isArray(rows) ? rows.length : -1;

    if (!Array.isArray(rows)) {
      result.issues.push({
        key: key,
        issue: 'RAW_NOT_ARRAY'
      });
    }
  }

  try {
    const opts = getFinanceRawDataUiReadOptions_();

    const billings = getBillingsRaw(opts);
    const billingItems = getBillingItemsRaw(opts);
    const billingAdjustments = getBillingAdjustmentsRaw(opts);
    const payments = getPaymentsRaw(opts);
    const billingInstallments = getBillingInstallmentsRaw(opts);
    const billingFeedbacks = getBillingFeedbacksRaw(opts);

    assertArray('billings', billings);
    assertArray('billingItems', billingItems);
    assertArray('billingAdjustments', billingAdjustments);
    assertArray('payments', payments);
    assertArray('billingInstallments', billingInstallments);
    assertArray('billingFeedbacks', billingFeedbacks);

    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        payments: true,
        billingInstallments: true,
        billingFeedbacks: true
      }
    });

    [
      'billings',
      'billingItems',
      'billingAdjustments',
      'payments',
      'billingInstallments',
      'billingFeedbacks'
    ].forEach(function(key) {
      const rows = getFinanceRawContextRows_(ctx, key);
      result.context_counts[key] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_ROWS_NOT_ARRAY'
        });
      }
    });

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.BILLINGS, {
        billing_id: 'TEST-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    if (!supabaseWriteBlocked) {
      result.issues.push({
        issue: 'SUPABASE_WRITE_NOT_BLOCKED'
      });
    }

    result.supabase_write_guard = {
      blocked: supabaseWriteBlocked,
      message: supabaseWriteMessage
    };

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6G-FinanceRawData',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}