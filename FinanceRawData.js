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

/* =========================================================
   PHASE 3D MANUAL TESTS
   FinanceRawData context helper -> FinanceRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

/* =========================================================
   PHASE 3E FINAL AUDIT
   Final audit FinanceRawData -> FinanceRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testFinanceRawDataReadLog() {
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