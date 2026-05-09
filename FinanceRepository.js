/* =========================================================
   FINANCE REPOSITORY
   Tahap 3B - Repository Layer Read-Only Awal
   Backend saat ini tetap Spreadsheet via DataAccess.gs
   ========================================================= */

/**
 * FinanceRepository adalah layer baca data Finance.
 *
 * Catatan penting:
 * - Tahap 3B hanya read-only.
 * - Belum mengganti FinanceRawData.gs.
 * - Belum mengubah endpoint frontend.
 * - Belum mengubah business logic.
 * - Semua data masih berasal dari Spreadsheet melalui DataAccess.gs.
 */

const FINANCE_REPOSITORY_CONTEXT_KEYS = Object.freeze({
  BILLINGS: 'billings',
  BILLING_ITEMS: 'billingItems',
  BILLING_ADJUSTMENTS: 'billingAdjustments',
  BILLING_INSTALLMENTS: 'billingInstallments',
  PAYMENTS: 'payments',
  BILLING_FEEDBACKS: 'billingFeedbacks'
});

const FinanceRepository = Object.freeze({
  getBillingsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLINGS, options);
  },

  getBillingItemsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLING_ITEMS, options);
  },

  getBillingAdjustmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLING_ADJUSTMENTS, options);
  },

  getBillingInstallmentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLING_INSTALLMENTS, options);
  },

  getPaymentsRaw: function(options) {
    return dbFindAll_(REPO_TABLES.PAYMENTS, options);
  },

  getBillingFeedbacksRaw: function(options) {
    return dbFindAll_(REPO_TABLES.BILLING_FEEDBACKS, options);
  },

  findBillingById: function(billingId, options) {
    return dbFindById_(
      REPO_TABLES.BILLINGS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.BILLINGS),
      billingId,
      options
    );
  },

  findBillingItemById: function(billingItemId, options) {
    return dbFindById_(
      REPO_TABLES.BILLING_ITEMS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.BILLING_ITEMS),
      billingItemId,
      options
    );
  },

  findPaymentById: function(paymentId, options) {
    return dbFindById_(
      REPO_TABLES.PAYMENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.PAYMENTS),
      paymentId,
      options
    );
  },

  findInstallmentById: function(installmentId, options) {
    return dbFindById_(
      REPO_TABLES.BILLING_INSTALLMENTS,
      repoGetPrimaryKeyForTable_(REPO_TABLES.BILLING_INSTALLMENTS),
      installmentId,
      options
    );
  },

  listBillingItemsByBillingId: function(billingId, options) {
    const normalizedBillingId = String(billingId || '').trim();

    if (!normalizedBillingId) return [];

    return dbFindWhere_(REPO_TABLES.BILLING_ITEMS, function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    }, options);
  },

  listBillingAdjustmentsByBillingId: function(billingId, options) {
    const normalizedBillingId = String(billingId || '').trim();

    if (!normalizedBillingId) return [];

    return dbFindWhere_(REPO_TABLES.BILLING_ADJUSTMENTS, function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    }, options);
  },

  listPaymentsByBillingId: function(billingId, options) {
    const normalizedBillingId = String(billingId || '').trim();

    if (!normalizedBillingId) return [];

    return dbFindWhere_(REPO_TABLES.PAYMENTS, function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    }, options);
  },

  listInstallmentsByBillingId: function(billingId, options) {
    const normalizedBillingId = String(billingId || '').trim();

    if (!normalizedBillingId) return [];

    return dbFindWhere_(REPO_TABLES.BILLING_INSTALLMENTS, function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    }, options);
  },

  listFeedbacksByBillingId: function(billingId, options) {
    const normalizedBillingId = String(billingId || '').trim();

    if (!normalizedBillingId) return [];

    return dbFindWhere_(REPO_TABLES.BILLING_FEEDBACKS, function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    }, options);
  },

  buildRawContext: function(options) {
    return buildFinanceRepositoryRawContext_(options || {});
  },

  getRawContextRows: function(ctx, key) {
    return getFinanceRepositoryRawContextRows_(ctx, key);
  },

  findBillingRawByIdFromContext: function(ctx, billingId) {
    return findFinanceRepositoryBillingByIdFromContext_(ctx, billingId);
  },

  findBillingRawByTreatmentIdFromContext: function(ctx, treatmentId) {
    return findFinanceRepositoryBillingByTreatmentIdFromContext_(ctx, treatmentId);
  },

  listBillingItemsByBillingIdFromContext: function(ctx, billingId) {
    return listFinanceRepositoryRowsByBillingIdFromContext_(
      ctx,
      FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_ITEMS,
      billingId
    );
  },

  listBillingAdjustmentsByBillingIdFromContext: function(ctx, billingId) {
    return listFinanceRepositoryRowsByBillingIdFromContext_(
      ctx,
      FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_ADJUSTMENTS,
      billingId
    );
  },

  listPaymentsByBillingIdFromContext: function(ctx, billingId) {
    return listFinanceRepositoryRowsByBillingIdFromContext_(
      ctx,
      FINANCE_REPOSITORY_CONTEXT_KEYS.PAYMENTS,
      billingId
    );
  },

  listInstallmentsByBillingIdFromContext: function(ctx, billingId) {
    return listFinanceRepositoryInstallmentsByBillingIdFromContext_(ctx, billingId);
  },

  findFeedbackByBillingIdFromContext: function(ctx, billingId) {
    return findFinanceRepositoryFeedbackByBillingIdFromContext_(ctx, billingId);
  },

  findFeedbackByTokenFromContext: function(ctx, token) {
    return findFinanceRepositoryFeedbackByTokenFromContext_(ctx, token);
  }
});

/* =========================================================
   INTERNAL CONTEXT HELPERS
   ========================================================= */

function shouldFinanceRepositoryLoadContextKey_(only, key) {
  const config = only || {};
  const keys = Object.keys(config);

  if (!keys.length) {
    return true;
  }

  return config[key] === true;
}

function buildFinanceRepositoryRawContext_(options) {
  const opts = options || {};
  const only = opts.only || {};

  const ctx = {
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_(opts)
      : 'spreadsheet',

    loaded_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),

    billings: [],
    billingItems: [],
    billingAdjustments: [],
    billingInstallments: [],
    payments: [],
    billingFeedbacks: []
  };

  if (shouldFinanceRepositoryLoadContextKey_(only, FINANCE_REPOSITORY_CONTEXT_KEYS.BILLINGS)) {
    ctx.billings = FinanceRepository.getBillingsRaw(opts);
  }

  if (shouldFinanceRepositoryLoadContextKey_(only, FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_ITEMS)) {
    ctx.billingItems = FinanceRepository.getBillingItemsRaw(opts);
  }

  if (shouldFinanceRepositoryLoadContextKey_(only, FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_ADJUSTMENTS)) {
    ctx.billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(opts);
  }

  if (shouldFinanceRepositoryLoadContextKey_(only, FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_INSTALLMENTS)) {
    ctx.billingInstallments = FinanceRepository.getBillingInstallmentsRaw(opts);
  }

  if (shouldFinanceRepositoryLoadContextKey_(only, FINANCE_REPOSITORY_CONTEXT_KEYS.PAYMENTS)) {
    ctx.payments = FinanceRepository.getPaymentsRaw(opts);
  }

  if (shouldFinanceRepositoryLoadContextKey_(only, FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_FEEDBACKS)) {
    ctx.billingFeedbacks = FinanceRepository.getBillingFeedbacksRaw(opts);
  }

  return ctx;
}

function getFinanceRepositoryRawContextRows_(ctx, key) {
  const context = ctx || {};
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) return [];

  if (Array.isArray(context[normalizedKey])) {
    return context[normalizedKey];
  }

  const aliases = {
    Billings: 'billings',
    BillingItems: 'billingItems',
    BillingAdjustments: 'billingAdjustments',
    BillingInstallments: 'billingInstallments',
    Payments: 'payments',
    BillingFeedbacks: 'billingFeedbacks',

    billingsRaw: 'billings',
    billingItemsRaw: 'billingItems',
    billingAdjustmentsRaw: 'billingAdjustments',
    billingInstallmentsRaw: 'billingInstallments',
    paymentsRaw: 'payments',
    billingFeedbacksRaw: 'billingFeedbacks'
  };

  const mappedKey = aliases[normalizedKey];

  if (mappedKey && Array.isArray(context[mappedKey])) {
    return context[mappedKey];
  }

  return [];
}

/* =========================================================
   CONTEXT FINDERS
   Tahap 3D - Helper pencarian berbasis raw context.
   Read-only.
   ========================================================= */

function normalizeFinanceRepositoryKeyValue_(value) {
  return String(value || '').trim();
}

function findFinanceRepositoryBillingByIdFromContext_(ctx, billingId) {
  const normalizedBillingId = normalizeFinanceRepositoryKeyValue_(billingId);

  if (!normalizedBillingId) return null;

  return getFinanceRepositoryRawContextRows_(
    ctx,
    FINANCE_REPOSITORY_CONTEXT_KEYS.BILLINGS
  ).find(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  }) || null;
}

function findFinanceRepositoryBillingByTreatmentIdFromContext_(ctx, treatmentId) {
  const normalizedTreatmentId = normalizeFinanceRepositoryKeyValue_(treatmentId);

  if (!normalizedTreatmentId) return null;

  return getFinanceRepositoryRawContextRows_(
    ctx,
    FINANCE_REPOSITORY_CONTEXT_KEYS.BILLINGS
  ).find(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  }) || null;
}

function listFinanceRepositoryRowsByBillingIdFromContext_(ctx, contextKey, billingId) {
  const normalizedBillingId = normalizeFinanceRepositoryKeyValue_(billingId);

  if (!normalizedBillingId) return [];

  return getFinanceRepositoryRawContextRows_(ctx, contextKey).filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

function listFinanceRepositoryInstallmentsByBillingIdFromContext_(ctx, billingId) {
  const rows = listFinanceRepositoryRowsByBillingIdFromContext_(
    ctx,
    FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_INSTALLMENTS,
    billingId
  );

  return rows.sort(function(a, b) {
    const aDue = typeof financeExtractYmd_ === 'function'
      ? financeExtractYmd_(a.due_date || '')
      : String(a.due_date || '');

    const bDue = typeof financeExtractYmd_ === 'function'
      ? financeExtractYmd_(b.due_date || '')
      : String(b.due_date || '');

    const dueCompare = String(aDue || '').localeCompare(String(bDue || ''));

    if (dueCompare !== 0) return dueCompare;

    return Number(a.installment_no || 0) - Number(b.installment_no || 0);
  });
}

function findFinanceRepositoryFeedbackByBillingIdFromContext_(ctx, billingId) {
  const normalizedBillingId = normalizeFinanceRepositoryKeyValue_(billingId);

  if (!normalizedBillingId) return null;

  return getFinanceRepositoryRawContextRows_(
    ctx,
    FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_FEEDBACKS
  ).find(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  }) || null;
}

function findFinanceRepositoryFeedbackByTokenFromContext_(ctx, token) {
  const normalizedToken = normalizeFinanceRepositoryKeyValue_(token);

  if (!normalizedToken) return null;

  return getFinanceRepositoryRawContextRows_(
    ctx,
    FINANCE_REPOSITORY_CONTEXT_KEYS.BILLING_FEEDBACKS
  ).find(function(row) {
    return String(row.feedback_token || '').trim() === normalizedToken;
  }) || null;
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testFinanceRepositoryPhase3BReadOnly() {
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
    const datasets = {
      billings: FinanceRepository.getBillingsRaw(),
      billingItems: FinanceRepository.getBillingItemsRaw(),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(),
      payments: FinanceRepository.getPaymentsRaw(),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw()
    };

    Object.keys(datasets).forEach(function(key) {
      const rows = datasets[key];

      result.counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          dataset: key,
          issue: 'DATASET_NOT_ARRAY'
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

function testFinanceRepositoryPhase3BBuildRawContext() {
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
    const ctx = FinanceRepository.buildRawContext({
      only: {
        billings: true,
        payments: true,
        billingFeedbacks: true,
        billingInstallments: true
      }
    });

    const expectedArrays = [
      'billings',
      'payments',
      'billingFeedbacks',
      'billingInstallments'
    ];

    expectedArrays.forEach(function(key) {
      const rows = FinanceRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_ROWS_NOT_ARRAY'
        });
      }
    });

    const shouldBeEmptyBecauseNotLoaded = [
      'billingItems',
      'billingAdjustments'
    ];

    shouldBeEmptyBecauseNotLoaded.forEach(function(key) {
      const rows = FinanceRepository.getRawContextRows(ctx, key);

      result.context_counts[key] = Array.isArray(rows) ? rows.length : 0;

      if (!Array.isArray(rows)) {
        result.issues.push({
          key: key,
          issue: 'CONTEXT_UNLOADED_KEY_NOT_ARRAY'
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

function testFinanceRepositoryPhase3BFindBillingSample() {
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
    const billings = FinanceRepository.getBillingsRaw();
    const firstBilling = billings.length ? billings[0] : null;
    const billingId = firstBilling
      ? String(firstBilling.billing_id || '').trim()
      : '';

    result.sample.billing_count = billings.length;
    result.sample.first_billing_id = billingId;

    if (!billingId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada data billing untuk sample find test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundBilling = FinanceRepository.findBillingById(billingId);
    const billingItems = FinanceRepository.listBillingItemsByBillingId(billingId);
    const adjustments = FinanceRepository.listBillingAdjustmentsByBillingId(billingId);
    const payments = FinanceRepository.listPaymentsByBillingId(billingId);
    const installments = FinanceRepository.listInstallmentsByBillingId(billingId);
    const feedbacks = FinanceRepository.listFeedbacksByBillingId(billingId);

    result.sample.find_billing_ok = !!foundBilling;
    result.sample.billing_item_count = billingItems.length;
    result.sample.adjustment_count = adjustments.length;
    result.sample.payment_count = payments.length;
    result.sample.installment_count = installments.length;
    result.sample.feedback_count = feedbacks.length;

    if (!foundBilling) {
      result.issues.push({
        billing_id: billingId,
        issue: 'FIND_BILLING_BY_ID_FAILED'
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

function testFinanceRepositoryPhase6CSupabaseReadOnlyLog() {
  const result = {
    success: true,
    stage: '6C',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    const datasets = {
      billings: FinanceRepository.getBillingsRaw(supabaseOptions),
      billingItems: FinanceRepository.getBillingItemsRaw(supabaseOptions),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(supabaseOptions),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(supabaseOptions),
      payments: FinanceRepository.getPaymentsRaw(supabaseOptions),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(supabaseOptions)
    };

    Object.keys(datasets).forEach(function(key) {
      addCheck('SUPABASE_FINANCE_DATASET_ARRAY_' + key, Array.isArray(datasets[key]), {
        dataset: key,
        row_count: Array.isArray(datasets[key]) ? datasets[key].length : -1
      });
    });

    const firstBilling = datasets.billings.length ? datasets.billings[0] : null;
    const firstBillingId = firstBilling ? String(firstBilling.billing_id || '').trim() : '';

    addCheck('SUPABASE_FINANCE_SAMPLE_BILLING_AVAILABLE', !!firstBillingId, {
      first_billing_id: firstBillingId,
      billing_count: datasets.billings.length
    });

    if (firstBillingId) {
      const foundBilling = FinanceRepository.findBillingById(firstBillingId, supabaseOptions);
      const billingItems = FinanceRepository.listBillingItemsByBillingId(firstBillingId, supabaseOptions);
      const adjustments = FinanceRepository.listBillingAdjustmentsByBillingId(firstBillingId, supabaseOptions);
      const payments = FinanceRepository.listPaymentsByBillingId(firstBillingId, supabaseOptions);
      const installments = FinanceRepository.listInstallmentsByBillingId(firstBillingId, supabaseOptions);
      const feedbacks = FinanceRepository.listFeedbacksByBillingId(firstBillingId, supabaseOptions);

      addCheck('SUPABASE_FINANCE_FIND_BILLING_BY_ID', !!foundBilling, {
        billing_id: firstBillingId
      });

      addCheck('SUPABASE_FINANCE_LIST_RELATED_ROWS', true, {
        billing_id: firstBillingId,
        billing_item_count: billingItems.length,
        adjustment_count: adjustments.length,
        payment_count: payments.length,
        installment_count: installments.length,
        feedback_count: feedbacks.length
      });
    }

    const ctx = FinanceRepository.buildRawContext({
      backend_mode: 'supabase',
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        billingInstallments: true,
        payments: true,
        billingFeedbacks: true
      }
    });

    addCheck('SUPABASE_FINANCE_CONTEXT_BACKEND_MODE', ctx.backend_mode === 'supabase', {
      actual: ctx.backend_mode
    });

    addCheck('SUPABASE_FINANCE_CONTEXT_ROWS_ARRAY', Array.isArray(ctx.billings) && Array.isArray(ctx.payments), {
      billing_count: Array.isArray(ctx.billings) ? ctx.billings.length : -1,
      payment_count: Array.isArray(ctx.payments) ? ctx.payments.length : -1
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

    addCheck('SUPABASE_FINANCE_WRITE_STILL_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6C',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinanceRepositoryPhase6CSpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6C',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    tests: [],
    issue_count: 0,
    issues: []
  };

  function addTest(name, testResult) {
    const success = !!(testResult && testResult.success);

    result.tests.push({
      name: name,
      success: success,
      issue_count: testResult && typeof testResult.issue_count !== 'undefined'
        ? testResult.issue_count
        : null
    });

    if (!success) {
      result.issues.push({
        test: name,
        issue: 'REGRESSION_TEST_FAILED',
        result: testResult || null
      });
    }
  }

  try {
    addTest('testFinanceRepositoryPhase3BReadOnly', testFinanceRepositoryPhase3BReadOnly());
    addTest('testFinanceRepositoryPhase3BBuildRawContext', testFinanceRepositoryPhase3BBuildRawContext());
    addTest('testFinanceRepositoryPhase3BFindBillingSample', testFinanceRepositoryPhase3BFindBillingSample());

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6C',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinancePhase7GPreflightLog() {
  const result = {
    success: true,
    stage: '7G-1-Finance-Preflight',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    baseline: {},
    finance_totals: {},
    status_counts: {},
    relationship_checks: {},
    selected_targets: {},
    guard_checks: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') {
      return financeToAmount_(value);
    }

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') {
      return financeRoundAmount_(value);
    }

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function buildIndexByField(rows, fieldName) {
    const index = {};

    (rows || []).forEach(function(row) {
      const key = normalizeKey(row && row[fieldName]);
      if (!key) return;
      index[key] = row;
    });

    return index;
  }

  function countByStatus(rows, fieldName) {
    const counts = {};

    (rows || []).forEach(function(row) {
      const key = normalizeStatus(row && row[fieldName]) || '(blank)';
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }

  function findSafeReceivableBilling(billings) {
    return (billings || []).find(function(row) {
      return normalizeKey(row.billing_id) &&
        normalizeStatus(row.billing_status) !== 'cancelled' &&
        toAmount(row.outstanding_total) > 0;
    }) || null;
  }

  function findSafePaidBilling(billings) {
    return (billings || []).find(function(row) {
      return normalizeKey(row.billing_id) &&
        normalizeStatus(row.billing_status) !== 'cancelled' &&
        normalizeStatus(row.payment_status) === 'paid' &&
        toAmount(row.outstanding_total) === 0 &&
        toAmount(row.paid_total) > 0;
    }) || null;
  }

  function findBillingWithItems(billings, billingItemsByBillingId) {
    return (billings || []).find(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && Array.isArray(billingItemsByBillingId[billingId]) && billingItemsByBillingId[billingId].length > 0;
    }) || null;
  }

  function groupByBillingId(rows) {
    const grouped = {};

    (rows || []).forEach(function(row) {
      const billingId = normalizeKey(row.billing_id);
      if (!billingId) return;

      if (!grouped[billingId]) grouped[billingId] = [];
      grouped[billingId].push(row);
    });

    return grouped;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const billings = FinanceRepository.getBillingsRaw(supabaseOptions);
    const billingItems = FinanceRepository.getBillingItemsRaw(supabaseOptions);
    const billingAdjustments = FinanceRepository.getBillingAdjustmentsRaw(supabaseOptions);
    const billingInstallments = FinanceRepository.getBillingInstallmentsRaw(supabaseOptions);
    const payments = FinanceRepository.getPaymentsRaw(supabaseOptions);
    const billingFeedbacks = FinanceRepository.getBillingFeedbacksRaw(supabaseOptions);

    const patients = dbFindAll_(REPO_TABLES.PATIENTS, supabaseOptions);
    const treatments = dbFindAll_(REPO_TABLES.TREATMENTS, supabaseOptions);
    const treatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, supabaseOptions);
    const appointments = dbFindAll_(REPO_TABLES.APPOINTMENTS, supabaseOptions);
    const services = dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions);

    addCheck(
      'FINANCE_DATASETS_ARRAY',
      Array.isArray(billings) &&
        Array.isArray(billingItems) &&
        Array.isArray(billingAdjustments) &&
        Array.isArray(billingInstallments) &&
        Array.isArray(payments) &&
        Array.isArray(billingFeedbacks),
      {
        billings_is_array: Array.isArray(billings),
        billing_items_is_array: Array.isArray(billingItems),
        billing_adjustments_is_array: Array.isArray(billingAdjustments),
        billing_installments_is_array: Array.isArray(billingInstallments),
        payments_is_array: Array.isArray(payments),
        billing_feedbacks_is_array: Array.isArray(billingFeedbacks)
      }
    );

    result.baseline = {
      billings: billings.length,
      billing_items: billingItems.length,
      billing_adjustments: billingAdjustments.length,
      billing_installments: billingInstallments.length,
      payments: payments.length,
      billing_feedbacks: billingFeedbacks.length,
      patients: patients.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      appointments: appointments.length,
      service_catalog: services.length
    };

    addCheck(
      'BASELINE_FINANCE_COUNTS_MATCH_EXPECTED',
      result.baseline.billings === 46 &&
        result.baseline.billing_items === 99 &&
        result.baseline.billing_adjustments === 1 &&
        result.baseline.billing_installments === 0 &&
        result.baseline.payments === 44 &&
        result.baseline.billing_feedbacks === 0,
      result.baseline
    );

    addCheck(
      'BASELINE_RELATED_COUNTS_MATCH_EXPECTED',
      result.baseline.patients === 285 &&
        result.baseline.treatments === 254 &&
        result.baseline.treatment_items === 489 &&
        result.baseline.appointments === 284 &&
        result.baseline.service_catalog === 100,
      result.baseline
    );

    result.finance_totals = {
      billings_subtotal: sumAmount(billings, 'subtotal'),
      billings_discount_total: sumAmount(billings, 'discount_total'),
      billings_grand_total: sumAmount(billings, 'grand_total'),
      billings_paid_total: sumAmount(billings, 'paid_total'),
      billings_outstanding_total: sumAmount(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(billingAdjustments, 'amount'),
      payments_amount: sumAmount(payments, 'amount')
    };

    addCheck(
      'FINANCE_TOTALS_MATCH_EXPECTED',
      result.finance_totals.billings_subtotal === 15136500 &&
        result.finance_totals.billings_discount_total === 100000 &&
        result.finance_totals.billings_grand_total === 15036500 &&
        result.finance_totals.billings_paid_total === 15035000 &&
        result.finance_totals.billings_outstanding_total === 1500 &&
        result.finance_totals.billing_items_subtotal === 15136500 &&
        result.finance_totals.billing_adjustments_amount === 100000 &&
        result.finance_totals.payments_amount === 15035000,
      result.finance_totals
    );

    result.status_counts = {
      billing_status: countByStatus(billings, 'billing_status'),
      payment_status: countByStatus(billings, 'payment_status'),
      payment_rows_status: countByStatus(payments, 'payment_status')
    };

    const patientIndex = buildIndexByField(patients, 'patient_id');
    const treatmentIndex = buildIndexByField(treatments, 'treatment_id');
    const treatmentItemIndex = buildIndexByField(treatmentItems, 'treatment_item_id');
    const appointmentIndex = buildIndexByField(appointments, 'appointment_id');
    const serviceIndex = buildIndexByField(services, 'service_id');
    const billingIndex = buildIndexByField(billings, 'billing_id');

    const billingsMissingPatient = billings.filter(function(row) {
      const patientId = normalizeKey(row.patient_id);
      return patientId && !patientIndex[patientId];
    });

    const billingsMissingTreatment = billings.filter(function(row) {
      const treatmentId = normalizeKey(row.treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingsMissingAppointment = billings.filter(function(row) {
      const appointmentId = normalizeKey(row.appointment_id);
      return appointmentId && !appointmentIndex[appointmentId];
    });

    const billingItemsMissingBilling = billingItems.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const billingItemsMissingTreatment = billingItems.filter(function(row) {
      const treatmentId = normalizeKey(row.treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingItemsMissingTreatmentItem = billingItems.filter(function(row) {
      const treatmentItemId = normalizeKey(row.treatment_item_id);
      return treatmentItemId && !treatmentItemIndex[treatmentItemId];
    });

    const billingItemsMissingService = billingItems.filter(function(row) {
      const serviceId = normalizeKey(row.service_id);
      return serviceId && !serviceIndex[serviceId];
    });

    const adjustmentsMissingBilling = billingAdjustments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const paymentsMissingBilling = payments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const installmentsMissingBilling = billingInstallments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const feedbacksMissingBilling = billingFeedbacks.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    result.relationship_checks = {
      billings_missing_patient_count: billingsMissingPatient.length,
      billings_missing_treatment_count: billingsMissingTreatment.length,
      billings_missing_appointment_count: billingsMissingAppointment.length,
      billing_items_missing_billing_count: billingItemsMissingBilling.length,
      billing_items_missing_treatment_count: billingItemsMissingTreatment.length,
      billing_items_missing_treatment_item_count: billingItemsMissingTreatmentItem.length,
      billing_items_missing_service_count: billingItemsMissingService.length,
      adjustments_missing_billing_count: adjustmentsMissingBilling.length,
      payments_missing_billing_count: paymentsMissingBilling.length,
      installments_missing_billing_count: installmentsMissingBilling.length,
      feedbacks_missing_billing_count: feedbacksMissingBilling.length
    };

    addCheck('BILLINGS_RELATIONSHIPS_EXPECTED', 
      result.relationship_checks.billings_missing_patient_count === 0 &&
        result.relationship_checks.billings_missing_treatment_count === 1 &&
        result.relationship_checks.billings_missing_appointment_count === 0,
      {
        billings_missing_patient_count: result.relationship_checks.billings_missing_patient_count,
        billings_missing_treatment_count: result.relationship_checks.billings_missing_treatment_count,
        billings_missing_appointment_count: result.relationship_checks.billings_missing_appointment_count,
        expected_missing_treatment_manual_artifact: 1
      }
    );

    addCheck('BILLING_ITEMS_RELATIONSHIPS_EXPECTED',
      result.relationship_checks.billing_items_missing_billing_count === 0 &&
        result.relationship_checks.billing_items_missing_treatment_count === 1 &&
        result.relationship_checks.billing_items_missing_treatment_item_count === 1 &&
        result.relationship_checks.billing_items_missing_service_count === 0,
      {
        billing_items_missing_billing_count: result.relationship_checks.billing_items_missing_billing_count,
        billing_items_missing_treatment_count: result.relationship_checks.billing_items_missing_treatment_count,
        billing_items_missing_treatment_item_count: result.relationship_checks.billing_items_missing_treatment_item_count,
        billing_items_missing_service_count: result.relationship_checks.billing_items_missing_service_count,
        expected_missing_treatment_manual_artifact: 1,
        expected_missing_treatment_item_manual_artifact: 1
      }
    );

    addCheck('FINANCE_CHILD_RELATIONSHIPS_CLEAN',
      result.relationship_checks.adjustments_missing_billing_count === 0 &&
        result.relationship_checks.payments_missing_billing_count === 0 &&
        result.relationship_checks.installments_missing_billing_count === 0 &&
        result.relationship_checks.feedbacks_missing_billing_count === 0,
      result.relationship_checks
    );

    const billingItemsByBillingId = groupByBillingId(billingItems);
    const paymentsByBillingId = groupByBillingId(payments);
    const adjustmentsByBillingId = groupByBillingId(billingAdjustments);

    const receivableBilling = findSafeReceivableBilling(billings);
    const paidBilling = findSafePaidBilling(billings);
    const billingWithItems = findBillingWithItems(billings, billingItemsByBillingId);

    result.selected_targets = {
      receivable_billing: receivableBilling ? {
        billing_id: normalizeKey(receivableBilling.billing_id),
        billing_number: normalizeKey(receivableBilling.billing_number),
        patient_id: normalizeKey(receivableBilling.patient_id),
        patient_name: normalizeKey(receivableBilling.patient_name),
        treatment_id: normalizeKey(receivableBilling.treatment_id),
        grand_total: toAmount(receivableBilling.grand_total),
        paid_total: toAmount(receivableBilling.paid_total),
        outstanding_total: toAmount(receivableBilling.outstanding_total),
        billing_status: normalizeStatus(receivableBilling.billing_status),
        payment_status: normalizeStatus(receivableBilling.payment_status),
        item_count: billingItemsByBillingId[normalizeKey(receivableBilling.billing_id)]
          ? billingItemsByBillingId[normalizeKey(receivableBilling.billing_id)].length
          : 0,
        payment_count: paymentsByBillingId[normalizeKey(receivableBilling.billing_id)]
          ? paymentsByBillingId[normalizeKey(receivableBilling.billing_id)].length
          : 0,
        adjustment_count: adjustmentsByBillingId[normalizeKey(receivableBilling.billing_id)]
          ? adjustmentsByBillingId[normalizeKey(receivableBilling.billing_id)].length
          : 0
      } : null,

      paid_billing: paidBilling ? {
        billing_id: normalizeKey(paidBilling.billing_id),
        billing_number: normalizeKey(paidBilling.billing_number),
        patient_id: normalizeKey(paidBilling.patient_id),
        patient_name: normalizeKey(paidBilling.patient_name),
        grand_total: toAmount(paidBilling.grand_total),
        paid_total: toAmount(paidBilling.paid_total),
        outstanding_total: toAmount(paidBilling.outstanding_total),
        billing_status: normalizeStatus(paidBilling.billing_status),
        payment_status: normalizeStatus(paidBilling.payment_status)
      } : null,

      billing_with_items: billingWithItems ? {
        billing_id: normalizeKey(billingWithItems.billing_id),
        billing_number: normalizeKey(billingWithItems.billing_number),
        patient_id: normalizeKey(billingWithItems.patient_id),
        patient_name: normalizeKey(billingWithItems.patient_name),
        item_count: billingItemsByBillingId[normalizeKey(billingWithItems.billing_id)]
          ? billingItemsByBillingId[normalizeKey(billingWithItems.billing_id)].length
          : 0
      } : null
    };

    addCheck('SAFE_RECEIVABLE_BILLING_TARGET_AVAILABLE', !!receivableBilling, result.selected_targets.receivable_billing || {});
    addCheck('SAFE_PAID_BILLING_TARGET_AVAILABLE', !!paidBilling, result.selected_targets.paid_billing || {});
    addCheck('BILLING_WITH_ITEMS_TARGET_AVAILABLE', !!billingWithItems, result.selected_targets.billing_with_items || {});

    let explicitBillingInsertBlocked = false;
    let explicitBillingInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7G-PREFLIGHT-SHOULD-NOT-INSERT',
        billing_number: 'INV-7G-PREFLIGHT-SHOULD-NOT-INSERT'
      }, {
        stage: '7G'
      });
    } catch (errInsert) {
      explicitBillingInsertBlocked = true;
      explicitBillingInsertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    result.guard_checks.explicit_billing_insert_default_off_blocked = explicitBillingInsertBlocked;
    result.guard_checks.explicit_billing_insert_message = explicitBillingInsertMessage;

    addCheck('EXPLICIT_BILLING_INSERT_DEFAULT_OFF_BLOCKED', explicitBillingInsertBlocked, {
      message: explicitBillingInsertMessage
    });

    let explicitBillingUpdateBlocked = false;
    let explicitBillingUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        'BIL-7G-PREFLIGHT-SHOULD-NOT-UPDATE',
        {
          notes: 'SHOULD NOT UPDATE - 7G PREFLIGHT',
          updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString()
        },
        {
          stage: '7G'
        }
      );
    } catch (errUpdate) {
      explicitBillingUpdateBlocked = true;
      explicitBillingUpdateMessage = errUpdate && errUpdate.message ? errUpdate.message : String(errUpdate || '');
    }

    result.guard_checks.explicit_billing_update_default_off_blocked = explicitBillingUpdateBlocked;
    result.guard_checks.explicit_billing_update_message = explicitBillingUpdateMessage;

    addCheck('EXPLICIT_BILLING_UPDATE_DEFAULT_OFF_BLOCKED', explicitBillingUpdateBlocked, {
      message: explicitBillingUpdateMessage
    });

    let oldDbInsertSupabaseBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7G-PREFLIGHT-OLD-DBINSERT-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    result.guard_checks.old_db_insert_supabase_blocked = oldDbInsertSupabaseBlocked;
    result.guard_checks.old_db_insert_message = oldDbInsertMessage;

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED', oldDbInsertSupabaseBlocked, {
      message: oldDbInsertMessage
    });

    let oldDbUpdateSupabaseBlocked = false;
    let oldDbUpdateMessage = '';

    try {
      dbUpdateById_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        'BIL-7G-PREFLIGHT-OLD-DBUPDATE-SHOULD-NOT-UPDATE',
        {
          notes: 'SHOULD NOT UPDATE - OLD DB UPDATE 7G PREFLIGHT'
        },
        {
          backend_mode: 'supabase'
        }
      );
    } catch (errOldUpdate) {
      oldDbUpdateSupabaseBlocked = true;
      oldDbUpdateMessage = errOldUpdate && errOldUpdate.message ? errOldUpdate.message : String(errOldUpdate || '');
    }

    result.guard_checks.old_db_update_supabase_blocked = oldDbUpdateSupabaseBlocked;
    result.guard_checks.old_db_update_message = oldDbUpdateMessage;

    addCheck('OLD_DB_UPDATE_SUPABASE_STILL_BLOCKED', oldDbUpdateSupabaseBlocked, {
      message: oldDbUpdateMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-1-Finance-Preflight',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_PREFLIGHT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinancePhase7GDefaultOffGuardLog() {
  const result = {
    success: true,
    stage: '7G-2-Finance-DefaultOffGuard',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    target: {},
    before_counts: {},
    after_counts: {},
    before_totals: {},
    after_totals: {},
    blocked_attempts: {},
    checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    result.checks.push({
      name: name,
      success: !!success,
      details: details || {}
    });

    if (!success) {
      result.issues.push({
        check: name,
        issue: 'CHECK_FAILED',
        details: details || {}
      });
    }
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') {
      return financeToAmount_(value);
    }

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') {
      return financeRoundAmount_(value);
    }

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function buildCounts(datasets) {
    const data = datasets || {};

    return {
      billings: Array.isArray(data.billings) ? data.billings.length : -1,
      billing_items: Array.isArray(data.billingItems) ? data.billingItems.length : -1,
      billing_adjustments: Array.isArray(data.billingAdjustments) ? data.billingAdjustments.length : -1,
      billing_installments: Array.isArray(data.billingInstallments) ? data.billingInstallments.length : -1,
      payments: Array.isArray(data.payments) ? data.payments.length : -1,
      billing_feedbacks: Array.isArray(data.billingFeedbacks) ? data.billingFeedbacks.length : -1
    };
  }

  function buildTotals(datasets) {
    const data = datasets || {};

    return {
      billings_subtotal: sumAmount(data.billings, 'subtotal'),
      billings_discount_total: sumAmount(data.billings, 'discount_total'),
      billings_grand_total: sumAmount(data.billings, 'grand_total'),
      billings_paid_total: sumAmount(data.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(data.billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(data.billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(data.billingAdjustments, 'amount'),
      payments_amount: sumAmount(data.payments, 'amount')
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function findReceivableBilling(billings) {
    return (billings || []).find(function(row) {
      return normalizeKey(row.billing_id) &&
        normalizeStatus(row.billing_status) !== 'cancelled' &&
        toAmount(row.outstanding_total) > 0;
    }) || null;
  }

  function attemptBlocked(name, fn) {
    const attempt = {
      blocked: false,
      message: ''
    };

    try {
      fn();
    } catch (err) {
      attempt.blocked = true;
      attempt.message = err && err.message ? err.message : String(err || '');
    }

    result.blocked_attempts[name] = attempt;

    addCheck(name + '_BLOCKED_WHEN_FLAG_FALSE', attempt.blocked === true, {
      message: attempt.message
    });

    return attempt;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === 'spreadsheet', {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.ui_read_supabase_test_enabled === false, {
      actual: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    /*
     * Safety: test default-off wajib berhenti jika flag ternyata true.
     */
    if (result.supabase_staging_write_test_enabled !== false) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_FALSE_ABORTING_DEFAULT_OFF_GUARD_TEST',
        actual: result.supabase_staging_write_test_enabled
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    addCheck('BASELINE_BEFORE_COUNTS_OK',
      result.before_counts.billings === 46 &&
      result.before_counts.billing_items === 99 &&
      result.before_counts.billing_adjustments === 1 &&
      result.before_counts.billing_installments === 0 &&
      result.before_counts.payments === 44 &&
      result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_BEFORE_TOTALS_OK',
      result.before_totals.billings_subtotal === 15136500 &&
      result.before_totals.billings_discount_total === 100000 &&
      result.before_totals.billings_grand_total === 15036500 &&
      result.before_totals.billings_paid_total === 15035000 &&
      result.before_totals.billings_outstanding_total === 1500 &&
      result.before_totals.billing_items_subtotal === 15136500 &&
      result.before_totals.billing_adjustments_amount === 100000 &&
      result.before_totals.payments_amount === 15035000,
      result.before_totals
    );

    const receivableBilling = findReceivableBilling(beforeDatasets.billings);
    const receivableBillingId = receivableBilling ? normalizeKey(receivableBilling.billing_id) : '';

    result.target.receivable_billing = receivableBilling ? {
      billing_id: receivableBillingId,
      billing_number: normalizeKey(receivableBilling.billing_number),
      patient_id: normalizeKey(receivableBilling.patient_id),
      patient_name: normalizeKey(receivableBilling.patient_name),
      treatment_id: normalizeKey(receivableBilling.treatment_id),
      grand_total: toAmount(receivableBilling.grand_total),
      paid_total: toAmount(receivableBilling.paid_total),
      outstanding_total: toAmount(receivableBilling.outstanding_total),
      billing_status: normalizeStatus(receivableBilling.billing_status),
      payment_status: normalizeStatus(receivableBilling.payment_status)
    } : null;

    addCheck('RECEIVABLE_TARGET_AVAILABLE', !!receivableBillingId, result.target.receivable_billing || {});

    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    attemptBlocked('CREATE_DRAFT_BILLING_INSERT', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7G-GUARD-SHOULD-NOT-INSERT',
        billing_number: 'INV-7G-GUARD-SHOULD-NOT-INSERT',
        patient_id: 'PAT-7G-GUARD',
        patient_name: 'TEST 7G Guard',
        billing_date: '2026-05-09',
        due_date: '2026-05-09',
        subtotal: 1000,
        discount_total: 0,
        grand_total: 1000,
        paid_total: 0,
        outstanding_total: 1000,
        payment_status: 'unpaid',
        billing_status: 'draft',
        payment_type: 'full',
        payment_terms: 'full',
        created_at: now,
        updated_at: now
      }, {
        stage: '7G'
      });
    });

    attemptBlocked('CREATE_BILLING_ITEM_INSERT', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_ITEMS, {
        billing_item_id: 'BII-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-7G-GUARD-SHOULD-NOT-INSERT',
        treatment_id: 'TRX-7G-GUARD',
        treatment_item_id: 'TRI-7G-GUARD',
        service_id: 'SRV-7G-GUARD',
        service_name: 'TEST 7G Guard Item',
        qty: 1,
        unit_price: 1000,
        subtotal: 1000,
        created_at: now,
        updated_at: now
      }, {
        stage: '7G'
      });
    });

    attemptBlocked('PAYMENT_INSERT', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.PAYMENTS, {
        payment_id: 'PAY-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: receivableBillingId || 'BIL-7G-GUARD',
        payment_date: '2026-05-09',
        amount: 500,
        method: 'cash',
        reference_no: 'TEST-7G-GUARD',
        notes: 'SHOULD NOT INSERT - 7G payment guard',
        created_at: now,
        updated_at: now
      }, {
        stage: '7G'
      });
    });

    attemptBlocked('PAYMENT_UPDATE_BILLING_TOTALS', function() {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        receivableBillingId || 'BIL-7G-GUARD-SHOULD-NOT-UPDATE',
        {
          paid_total: 500,
          outstanding_total: 1000,
          payment_status: 'partial',
          updated_at: now
        },
        {
          stage: '7G'
        }
      );
    });

    attemptBlocked('DISCOUNT_ADJUSTMENT_INSERT', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_ADJUSTMENTS, {
        adjustment_id: 'ADJ-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: receivableBillingId || 'BIL-7G-GUARD',
        adjustment_type: 'discount',
        label: 'TEST 7G Guard Discount',
        amount: 100,
        reason: 'SHOULD NOT INSERT - 7G discount guard',
        created_by: 'TEST-7G',
        created_at: now,
        updated_at: now
      }, {
        stage: '7G'
      });
    });

    attemptBlocked('DISCOUNT_UPDATE_BILLING_TOTALS', function() {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        receivableBillingId || 'BIL-7G-GUARD-SHOULD-NOT-UPDATE',
        {
          discount_total: 100,
          grand_total: 1400,
          outstanding_total: 1400,
          payment_status: 'unpaid',
          updated_at: now
        },
        {
          stage: '7G'
        }
      );
    });

    attemptBlocked('INSTALLMENT_INSERT', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_INSTALLMENTS, {
        installment_id: 'INS-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: receivableBillingId || 'BIL-7G-GUARD',
        installment_no: 1,
        due_date: '2026-05-09',
        amount: 500,
        paid_amount: 0,
        status: 'pending',
        created_at: now,
        updated_at: now
      }, {
        stage: '7G'
      });
    });

    attemptBlocked('FEEDBACK_TOKEN_INSERT', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_FEEDBACKS, {
        feedback_id: 'FBK-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: receivableBillingId || 'BIL-7G-GUARD',
        patient_id: 'PAT-7G-GUARD',
        feedback_token: 'TOKEN-7G-GUARD-SHOULD-NOT-INSERT',
        status: 'pending',
        created_at: now,
        updated_at: now
      }, {
        stage: '7G'
      });
    });

    attemptBlocked('INVOICE_STATUS_UPDATE', function() {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        receivableBillingId || 'BIL-7G-GUARD-SHOULD-NOT-UPDATE',
        {
          invoice_delivery_status: 'stale',
          invoice_pdf_signature: 'SHOULD-NOT-UPDATE-7G',
          invoice_pdf_signature_at: now,
          updated_at: now
        },
        {
          stage: '7G'
        }
      );
    });

    attemptBlocked('BILLING_DELETE_CLEANUP_PATH', function() {
      dbSupabaseDeleteByIdStaging7A_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        'BIL-7G-GUARD-SHOULD-NOT-DELETE',
        {
          stage: '7G'
        }
      );
    });

    attemptBlocked('PAYMENT_DELETE_CLEANUP_PATH', function() {
      dbSupabaseDeleteByIdStaging7A_(
        REPO_TABLES.PAYMENTS,
        'payment_id',
        'PAY-7G-GUARD-SHOULD-NOT-DELETE',
        {
          stage: '7G'
        }
      );
    });

    attemptBlocked('OLD_DB_INSERT_SUPABASE', function() {
      dbInsert_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7G-OLD-DBINSERT-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    });

    attemptBlocked('OLD_DB_UPDATE_SUPABASE', function() {
      dbUpdateById_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        receivableBillingId || 'BIL-7G-OLD-DBUPDATE-SHOULD-NOT-UPDATE',
        {
          notes: 'SHOULD NOT UPDATE - OLD DB UPDATE 7G'
        },
        {
          backend_mode: 'supabase'
        }
      );
    });

    attemptBlocked('OLD_DB_DELETE_SUPABASE', function() {
      dbDeleteById_(
        REPO_TABLES.BILLINGS,
        'billing_id',
        'BIL-7G-OLD-DBDELETE-SHOULD-NOT-DELETE',
        {
          backend_mode: 'supabase'
        }
      );
    });

    const afterDatasets = loadFinanceDatasets(supabaseOptions);
    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    addCheck('COUNTS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    const targetAfter = receivableBillingId
      ? FinanceRepository.findBillingById(receivableBillingId, supabaseOptions)
      : null;

    addCheck('RECEIVABLE_TARGET_UNCHANGED_AFTER_BLOCKED_ATTEMPTS',
      targetAfter &&
      toAmount(targetAfter.grand_total) === toAmount(receivableBilling.grand_total) &&
      toAmount(targetAfter.paid_total) === toAmount(receivableBilling.paid_total) &&
      toAmount(targetAfter.outstanding_total) === toAmount(receivableBilling.outstanding_total) &&
      normalizeStatus(targetAfter.payment_status) === normalizeStatus(receivableBilling.payment_status),
      {
        before: result.target.receivable_billing,
        after: targetAfter ? {
          billing_id: normalizeKey(targetAfter.billing_id),
          grand_total: toAmount(targetAfter.grand_total),
          paid_total: toAmount(targetAfter.paid_total),
          outstanding_total: toAmount(targetAfter.outstanding_total),
          payment_status: normalizeStatus(targetAfter.payment_status)
        } : null
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-2-Finance-DefaultOffGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_DEFAULT_OFF_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinancePhase7GPaymentMutationLog() {
  const result = {
    success: true,
    stage: '7G-3-Finance-PaymentMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    target: {},
    before_counts: {},
    mutation_counts: {},
    after_counts: {},
    before_totals: {},
    mutation_totals: {},
    after_totals: {},
    payment_insert: {},
    billing_update: {},
    cleanup_payment_delete: {},
    cleanup_billing_update: {},
    readback: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') {
      return financeToAmount_(value);
    }

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') {
      return financeRoundAmount_(value);
    }

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function compactMutationResult(res) {
    return {
      success: !!(res && res.success),
      operation: res && res.operation ? res.operation : '',
      table_name: res && res.table_name ? res.table_name : '',
      target_table: res && res.target_table ? res.target_table : '',
      status_code: res && res.status_code ? res.status_code : null,
      row_count: res && typeof res.row_count !== 'undefined' ? res.row_count : null
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    const data = datasets || {};

    return {
      billings: Array.isArray(data.billings) ? data.billings.length : -1,
      billing_items: Array.isArray(data.billingItems) ? data.billingItems.length : -1,
      billing_adjustments: Array.isArray(data.billingAdjustments) ? data.billingAdjustments.length : -1,
      billing_installments: Array.isArray(data.billingInstallments) ? data.billingInstallments.length : -1,
      payments: Array.isArray(data.payments) ? data.payments.length : -1,
      billing_feedbacks: Array.isArray(data.billingFeedbacks) ? data.billingFeedbacks.length : -1
    };
  }

  function buildTotals(datasets) {
    const data = datasets || {};

    return {
      billings_subtotal: sumAmount(data.billings, 'subtotal'),
      billings_discount_total: sumAmount(data.billings, 'discount_total'),
      billings_grand_total: sumAmount(data.billings, 'grand_total'),
      billings_paid_total: sumAmount(data.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(data.billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(data.billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(data.billingAdjustments, 'amount'),
      payments_amount: sumAmount(data.payments, 'amount')
    };
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const billingId = 'BIL-20260505-140855694-907';
    const paymentId = 'PAY-7G-TEST-001';
    const paymentAmount = 1500;
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const today = typeof getFinanceTodayYmd_ === 'function'
      ? getFinanceTodayYmd_()
      : now.slice(0, 10);

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.flags.supabase_staging_write_test_enabled === true, result.flags);

    if (result.flags.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_PAYMENT_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7G-3.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    const billingBefore = FinanceRepository.findBillingById(billingId, supabaseOptions);

    result.target = billingBefore ? {
      billing_id: normalizeKey(billingBefore.billing_id),
      billing_number: normalizeKey(billingBefore.billing_number),
      patient_id: normalizeKey(billingBefore.patient_id),
      patient_name: normalizeKey(billingBefore.patient_name),
      treatment_id: normalizeKey(billingBefore.treatment_id),
      grand_total: toAmount(billingBefore.grand_total),
      paid_total: toAmount(billingBefore.paid_total),
      outstanding_total: toAmount(billingBefore.outstanding_total),
      billing_status: normalizeStatus(billingBefore.billing_status),
      payment_status: normalizeStatus(billingBefore.payment_status),
      updated_at: normalizeKey(billingBefore.updated_at)
    } : null;

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_grand_total === 15036500 &&
        result.before_totals.billings_paid_total === 15035000 &&
        result.before_totals.billings_outstanding_total === 1500 &&
        result.before_totals.payments_amount === 15035000,
      result.before_totals
    );

    addCheck('TARGET_RECEIVABLE_BILLING_READY',
      billingBefore &&
        toAmount(billingBefore.grand_total) === 1500 &&
        toAmount(billingBefore.paid_total) === 0 &&
        toAmount(billingBefore.outstanding_total) === 1500 &&
        normalizeStatus(billingBefore.payment_status) === 'unpaid',
      result.target || {}
    );

    const existingPaymentBefore = FinanceRepository.findPaymentById(paymentId, supabaseOptions);
    addCheck('TEST_PAYMENT_ID_NOT_EXIST_BEFORE', !existingPaymentBefore, {
      payment_id: paymentId
    });

    result.payment_insert = compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.PAYMENTS,
      {
        payment_id: paymentId,
        billing_id: billingId,
        payment_scope: 'full',
        installment_id: null,
        payment_date: today,
        payment_method: 'cash',
        amount: paymentAmount,
        reference_no: 'TEST-7G-PAYMENT',
        received_by: 'TEST-7G',
        notes: 'TEST 7G-3 payment Supabase staging - will be reverted',
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('PAYMENT_INSERT_SUCCESS',
      result.payment_insert.success === true &&
        result.payment_insert.row_count === 1,
      result.payment_insert
    );

    result.billing_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        paid_total: paymentAmount,
        outstanding_total: 0,
        payment_status: 'paid',
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('BILLING_TOTALS_AFTER_PAYMENT_UPDATE_SUCCESS',
      result.billing_update.success === true &&
        result.billing_update.row_count === 1,
      result.billing_update
    );

    const paymentAfterInsert = FinanceRepository.findPaymentById(paymentId, supabaseOptions);
    const billingAfterPayment = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const mutationDatasets = loadFinanceDatasets(supabaseOptions);

    result.mutation_counts = buildCounts(mutationDatasets);
    result.mutation_totals = buildTotals(mutationDatasets);

    result.readback.after_payment = {
      payment_found: !!paymentAfterInsert,
      payment_id: paymentAfterInsert ? normalizeKey(paymentAfterInsert.payment_id) : '',
      payment_billing_id: paymentAfterInsert ? normalizeKey(paymentAfterInsert.billing_id) : '',
      payment_amount: paymentAfterInsert ? toAmount(paymentAfterInsert.amount) : 0,
      billing_paid_total: billingAfterPayment ? toAmount(billingAfterPayment.paid_total) : null,
      billing_outstanding_total: billingAfterPayment ? toAmount(billingAfterPayment.outstanding_total) : null,
      billing_payment_status: billingAfterPayment ? normalizeStatus(billingAfterPayment.payment_status) : ''
    };

    addCheck('PAYMENT_READBACK_OK',
      paymentAfterInsert &&
        normalizeKey(paymentAfterInsert.payment_id) === paymentId &&
        normalizeKey(paymentAfterInsert.billing_id) === billingId &&
        toAmount(paymentAfterInsert.amount) === paymentAmount,
      result.readback.after_payment
    );

    addCheck('BILLING_READBACK_AFTER_PAYMENT_OK',
      billingAfterPayment &&
        toAmount(billingAfterPayment.paid_total) === 1500 &&
        toAmount(billingAfterPayment.outstanding_total) === 0 &&
        normalizeStatus(billingAfterPayment.payment_status) === 'paid',
      result.readback.after_payment
    );

    addCheck('COUNTS_AFTER_PAYMENT_EXPECTED',
      result.mutation_counts.billings === 46 &&
        result.mutation_counts.payments === 45 &&
        result.mutation_counts.billing_items === 99 &&
        result.mutation_counts.billing_adjustments === 1,
      result.mutation_counts
    );

    addCheck('TOTALS_AFTER_PAYMENT_EXPECTED',
      result.mutation_totals.billings_paid_total === 15036500 &&
        result.mutation_totals.billings_outstanding_total === 0 &&
        result.mutation_totals.payments_amount === 15036500,
      result.mutation_totals
    );

    /*
     * Cleanup: delete payment test, then revert billing totals.
     */
    result.cleanup_payment_delete = compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.PAYMENTS,
      'payment_id',
      paymentId,
      {
        stage: '7G'
      }
    ));

    addCheck('PAYMENT_CLEANUP_DELETE_SUCCESS',
      result.cleanup_payment_delete.success === true &&
        result.cleanup_payment_delete.row_count === 1,
      result.cleanup_payment_delete
    );

    result.cleanup_billing_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        paid_total: toAmount(billingBefore.paid_total),
        outstanding_total: toAmount(billingBefore.outstanding_total),
        payment_status: normalizeStatus(billingBefore.payment_status),
        updated_at: normalizeKey(billingBefore.updated_at) || null
      },
      {
        stage: '7G'
      }
    ));

    addCheck('BILLING_TOTALS_CLEANUP_UPDATE_SUCCESS',
      result.cleanup_billing_update.success === true &&
        result.cleanup_billing_update.row_count === 1,
      result.cleanup_billing_update
    );

    const paymentAfterCleanup = FinanceRepository.findPaymentById(paymentId, supabaseOptions);
    const billingAfterCleanup = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const afterDatasets = loadFinanceDatasets(supabaseOptions);

    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    result.readback.after_cleanup = {
      payment_exists: !!paymentAfterCleanup,
      billing_paid_total: billingAfterCleanup ? toAmount(billingAfterCleanup.paid_total) : null,
      billing_outstanding_total: billingAfterCleanup ? toAmount(billingAfterCleanup.outstanding_total) : null,
      billing_payment_status: billingAfterCleanup ? normalizeStatus(billingAfterCleanup.payment_status) : '',
      billing_updated_at: billingAfterCleanup ? normalizeKey(billingAfterCleanup.updated_at) : ''
    };

    addCheck('PAYMENT_DELETED_AFTER_CLEANUP',
      !paymentAfterCleanup,
      result.readback.after_cleanup
    );

    addCheck('BILLING_REVERTED_AFTER_CLEANUP',
      billingAfterCleanup &&
        toAmount(billingAfterCleanup.paid_total) === toAmount(billingBefore.paid_total) &&
        toAmount(billingAfterCleanup.outstanding_total) === toAmount(billingBefore.outstanding_total) &&
        normalizeStatus(billingAfterCleanup.payment_status) === normalizeStatus(billingBefore.payment_status),
      {
        before: result.target,
        after: result.readback.after_cleanup
      }
    );

    addCheck('COUNTS_REVERTED_AFTER_PAYMENT_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_REVERTED_AFTER_PAYMENT_TEST',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-3-Finance-PaymentMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'PAYMENT_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah insert/update, jangan lanjut. Jalankan read-back payment_id PAY-7G-TEST-001 dan billing target sebelum cleanup manual.'
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinancePhase7GSchemaAlignmentLog() {
  const result = {
    success: true,
    stage: '7G-3A-Finance-SchemaAlignment',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    table_checks: {},
    missing_columns_by_table: {},
    extra_columns_by_table: {},
    suggested_sql: [],
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function getTargetTable(tableName) {
    if (typeof repoGetTargetTableForSheet_ === 'function') {
      return repoGetTargetTableForSheet_(tableName);
    }

    return '';
  }

  function checkSupabaseColumnExists(tableName, columnName) {
    const targetTable = getTargetTable(tableName);

    if (!targetTable) {
      return {
        exists: false,
        status_code: null,
        message: 'Target table tidak ditemukan untuk ' + tableName
      };
    }

    const response = supabaseStagingSelect_(
      targetTable,
      {
        select: columnName,
        limit: 1
      },
      {}
    );

    return {
      exists: !!(response && response.success),
      status_code: response ? response.status_code : null,
      message: response && !response.success
        ? String(response.raw_body || response.body || '')
        : ''
    };
  }

  function inferSqlType(tableName, columnName) {
    const numericColumns = {
      Billings: ['subtotal', 'discount_total', 'grand_total', 'paid_total', 'outstanding_total'],
      BillingItems: ['qty', 'unit_price', 'subtotal'],
      BillingAdjustments: ['amount'],
      BillingInstallments: ['installment_no', 'amount_due', 'paid_amount'],
      Payments: ['amount'],
      BillingFeedbacks: ['rating']
    };

    const dateColumns = {
      Billings: ['billing_date', 'due_date'],
      BillingInstallments: ['due_date'],
      Payments: ['payment_date']
    };

    const timestampColumns = {
      Billings: ['invoice_sent_at', 'invoice_pdf_signature_at', 'created_at', 'updated_at'],
      BillingItems: ['created_at', 'updated_at'],
      BillingAdjustments: ['created_at', 'updated_at'],
      BillingInstallments: ['paid_at', 'created_at', 'updated_at'],
      Payments: ['created_at', 'updated_at'],
      BillingFeedbacks: ['submitted_at', 'created_at', 'updated_at']
    };

    if ((numericColumns[tableName] || []).indexOf(columnName) !== -1) {
      return 'numeric';
    }

    if ((dateColumns[tableName] || []).indexOf(columnName) !== -1) {
      return 'date';
    }

    if ((timestampColumns[tableName] || []).indexOf(columnName) !== -1) {
      return 'timestamptz';
    }

    return 'text';
  }

  try {
    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_FALSE', result.flags.supabase_staging_write_test_enabled === false, result.flags);

    const financeTables = [
      'Billings',
      'BillingItems',
      'BillingAdjustments',
      'BillingInstallments',
      'Payments',
      'BillingFeedbacks'
    ];

    financeTables.forEach(function(tableName) {
      const schema = FINANCE_SHEETS_SCHEMA[tableName] || {};
      const expectedColumns = schema.headers || [];
      const targetTable = getTargetTable(tableName);

      result.table_checks[tableName] = {
        target_table: targetTable,
        expected_column_count: expectedColumns.length,
        existing_columns: [],
        missing_columns: []
      };

      expectedColumns.forEach(function(columnName) {
        const check = checkSupabaseColumnExists(tableName, columnName);

        if (check.exists) {
          result.table_checks[tableName].existing_columns.push(columnName);
        } else {
          result.table_checks[tableName].missing_columns.push({
            column: columnName,
            status_code: check.status_code,
            message: check.message
          });
        }
      });

      result.missing_columns_by_table[tableName] =
        result.table_checks[tableName].missing_columns.map(function(item) {
          return item.column;
        });

      const missingColumns = result.missing_columns_by_table[tableName];

      missingColumns.forEach(function(columnName) {
        result.suggested_sql.push(
          'ALTER TABLE public.' + targetTable +
          ' ADD COLUMN IF NOT EXISTS ' + columnName + ' ' +
          inferSqlType(tableName, columnName) + ';'
        );
      });

      addCheck(
        'SCHEMA_COLUMNS_ALIGNED_' + tableName,
        missingColumns.length === 0,
        {
          table: tableName,
          target_table: targetTable,
          missing_columns: missingColumns
        }
      );
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-3A-Finance-SchemaAlignment',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_SCHEMA_ALIGNMENT_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testFinancePhase7GDefaultOffGuardCompactLog() {
  const result = {
    success: true,
    stage: '7G-Guard-DefaultOff-Compact',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    target_billing_id: 'BIL-20260505-140855694-907',
    before_counts: {},
    after_counts: {},
    before_totals: {},
    after_totals: {},
    blocked_summary: {
      expected_blocked: 14,
      blocked_count: 0,
      failed_to_block: []
    },
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });
    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      payments_amount: sumAmount(datasets.payments, 'amount'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount')
    };
  }

  function attemptBlocked(name, fn) {
    try {
      fn();
      result.blocked_summary.failed_to_block.push(name);
      return false;
    } catch (err) {
      result.blocked_summary.blocked_count++;
      return true;
    }
  }

  try {
    const supabaseOptions = { backend_mode: 'supabase' };
    const billingId = result.target_billing_id;
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
      result.flags.ui_read_backend_mode === 'spreadsheet' &&
      result.flags.ui_read_supabase_test_enabled === false &&
      result.flags.supabase_staging_write_test_enabled === false,
      result.flags
    );

    if (result.flags.supabase_staging_write_test_enabled !== false) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_FALSE_ABORTING_COMPACT_GUARD_TEST',
        actual: result.flags.supabase_staging_write_test_enabled
      });
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result));
      return result;
    }

    const before = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(before);
    result.before_totals = buildTotals(before);

    const targetBefore = FinanceRepository.findBillingById(billingId, supabaseOptions);

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
      result.before_counts.billing_items === 99 &&
      result.before_counts.billing_adjustments === 1 &&
      result.before_counts.billing_installments === 0 &&
      result.before_counts.payments === 44 &&
      result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_grand_total === 15036500 &&
      result.before_totals.billings_paid_total === 15035000 &&
      result.before_totals.billings_outstanding_total === 1500 &&
      result.before_totals.payments_amount === 15035000 &&
      result.before_totals.billing_adjustments_amount === 100000,
      result.before_totals
    );

    addCheck('TARGET_RECEIVABLE_OK',
      targetBefore &&
      toAmount(targetBefore.grand_total) === 1500 &&
      toAmount(targetBefore.paid_total) === 0 &&
      toAmount(targetBefore.outstanding_total) === 1500 &&
      normalizeStatus(targetBefore.payment_status) === 'unpaid',
      targetBefore ? {
        billing_id: billingId,
        grand_total: toAmount(targetBefore.grand_total),
        paid_total: toAmount(targetBefore.paid_total),
        outstanding_total: toAmount(targetBefore.outstanding_total),
        payment_status: normalizeStatus(targetBefore.payment_status)
      } : null
    );

    attemptBlocked('billing_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7G-GUARD-SHOULD-NOT-INSERT',
        billing_number: 'INV-7G-GUARD-SHOULD-NOT-INSERT'
      }, { stage: '7G' });
    });

    attemptBlocked('billing_item_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_ITEMS, {
        billing_item_id: 'BII-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: 'BIL-7G-GUARD-SHOULD-NOT-INSERT'
      }, { stage: '7G' });
    });

    attemptBlocked('payment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.PAYMENTS, {
        payment_id: 'PAY-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: billingId,
        payment_scope: 'full',
        payment_date: '2026-05-09',
        payment_method: 'cash',
        amount: 500,
        created_at: now,
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('billing_payment_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', billingId, {
        paid_total: 500,
        outstanding_total: 1000,
        payment_status: 'partial',
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('adjustment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_ADJUSTMENTS, {
        adjustment_id: 'ADJ-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: billingId,
        adjustment_type: 'discount',
        label: 'TEST 7G Guard',
        amount: 100,
        created_at: now,
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('billing_discount_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', billingId, {
        discount_total: 100,
        grand_total: 1400,
        outstanding_total: 1400,
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('installment_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_INSTALLMENTS, {
        installment_id: 'INS-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: billingId,
        installment_no: 1,
        due_date: '2026-05-09',
        amount_due: 500,
        paid_amount: 0,
        status: 'pending',
        created_at: now,
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('feedback_insert', function() {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLING_FEEDBACKS, {
        feedback_id: 'FBK-7G-GUARD-SHOULD-NOT-INSERT',
        billing_id: billingId,
        feedback_token: 'TOKEN-7G-GUARD-SHOULD-NOT-INSERT',
        feedback_status: 'pending',
        created_at: now,
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('invoice_update', function() {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', billingId, {
        invoice_delivery_status: 'stale',
        invoice_pdf_signature: 'SHOULD-NOT-UPDATE-7G',
        invoice_pdf_signature_at: now,
        updated_at: now
      }, { stage: '7G' });
    });

    attemptBlocked('billing_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', 'BIL-7G-GUARD-SHOULD-NOT-DELETE', { stage: '7G' });
    });

    attemptBlocked('payment_delete', function() {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.PAYMENTS, 'payment_id', 'PAY-7G-GUARD-SHOULD-NOT-DELETE', { stage: '7G' });
    });

    attemptBlocked('old_db_insert', function() {
      dbInsert_(REPO_TABLES.BILLINGS, { billing_id: 'BIL-7G-OLD-SHOULD-NOT-INSERT' }, { backend_mode: 'supabase' });
    });

    attemptBlocked('old_db_update', function() {
      dbUpdateById_(REPO_TABLES.BILLINGS, 'billing_id', billingId, { notes: 'SHOULD NOT UPDATE' }, { backend_mode: 'supabase' });
    });

    attemptBlocked('old_db_delete', function() {
      dbDeleteById_(REPO_TABLES.BILLINGS, 'billing_id', 'BIL-7G-OLD-SHOULD-NOT-DELETE', { backend_mode: 'supabase' });
    });

    addCheck('ALL_MUTATION_ATTEMPTS_BLOCKED',
      result.blocked_summary.blocked_count === result.blocked_summary.expected_blocked &&
      result.blocked_summary.failed_to_block.length === 0,
      result.blocked_summary
    );

    const after = loadFinanceDatasets(supabaseOptions);
    result.after_counts = buildCounts(after);
    result.after_totals = buildTotals(after);

    addCheck('COUNTS_UNCHANGED',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_UNCHANGED',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-Guard-DefaultOff-Compact',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_COMPACT_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testFinancePhase7GDiscountMutationLog() {
  const result = {
    success: true,
    stage: '7G-4-Finance-DiscountMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    target: {},
    before_counts: {},
    mutation_counts: {},
    after_counts: {},
    before_totals: {},
    mutation_totals: {},
    after_totals: {},
    adjustment_insert: {},
    billing_update: {},
    cleanup_adjustment_delete: {},
    cleanup_billing_update: {},
    readback: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') {
      return financeToAmount_(value);
    }

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') {
      return financeRoundAmount_(value);
    }

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function compactMutationResult(res) {
    return {
      success: !!(res && res.success),
      operation: res && res.operation ? res.operation : '',
      table_name: res && res.table_name ? res.table_name : '',
      target_table: res && res.target_table ? res.target_table : '',
      status_code: res && res.status_code ? res.status_code : null,
      row_count: res && typeof res.row_count !== 'undefined' ? res.row_count : null
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_subtotal: sumAmount(datasets.billings, 'subtotal'),
      billings_discount_total: sumAmount(datasets.billings, 'discount_total'),
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(datasets.billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount'),
      payments_amount: sumAmount(datasets.payments, 'amount')
    };
  }

  function findAdjustmentById(adjustmentId, options) {
    const id = normalizeKey(adjustmentId);
    if (!id) return null;

    return FinanceRepository.getBillingAdjustmentsRaw(options).find(function(row) {
      return normalizeKey(row.adjustment_id) === id;
    }) || null;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const billingId = 'BIL-20260505-140855694-907';
    const adjustmentId = 'ADJ-7G-TEST-001';
    const discountAmount = 500;
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.flags.supabase_staging_write_test_enabled === true, result.flags);

    if (result.flags.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_DISCOUNT_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7G-4.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    const billingBefore = FinanceRepository.findBillingById(billingId, supabaseOptions);

    result.target = billingBefore ? {
      billing_id: normalizeKey(billingBefore.billing_id),
      billing_number: normalizeKey(billingBefore.billing_number),
      patient_id: normalizeKey(billingBefore.patient_id),
      patient_name: normalizeKey(billingBefore.patient_name),
      treatment_id: normalizeKey(billingBefore.treatment_id),
      subtotal: toAmount(billingBefore.subtotal),
      discount_total: toAmount(billingBefore.discount_total),
      grand_total: toAmount(billingBefore.grand_total),
      paid_total: toAmount(billingBefore.paid_total),
      outstanding_total: toAmount(billingBefore.outstanding_total),
      billing_status: normalizeStatus(billingBefore.billing_status),
      payment_status: normalizeStatus(billingBefore.payment_status),
      updated_at: normalizeKey(billingBefore.updated_at)
    } : null;

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_grand_total === 15036500 &&
        result.before_totals.billings_discount_total === 100000 &&
        result.before_totals.billings_outstanding_total === 1500 &&
        result.before_totals.billing_adjustments_amount === 100000,
      result.before_totals
    );

    addCheck('TARGET_RECEIVABLE_BILLING_READY_FOR_DISCOUNT',
      billingBefore &&
        toAmount(billingBefore.subtotal) === 1500 &&
        toAmount(billingBefore.discount_total) === 0 &&
        toAmount(billingBefore.grand_total) === 1500 &&
        toAmount(billingBefore.paid_total) === 0 &&
        toAmount(billingBefore.outstanding_total) === 1500 &&
        normalizeStatus(billingBefore.payment_status) === 'unpaid',
      result.target || {}
    );

    const existingAdjustmentBefore = findAdjustmentById(adjustmentId, supabaseOptions);
    addCheck('TEST_ADJUSTMENT_ID_NOT_EXIST_BEFORE', !existingAdjustmentBefore, {
      adjustment_id: adjustmentId
    });

    result.adjustment_insert = compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLING_ADJUSTMENTS,
      {
        adjustment_id: adjustmentId,
        billing_id: billingId,
        adjustment_type: 'discount',
        label: 'TEST 7G Discount',
        amount: discountAmount,
        reason: 'TEST 7G-4 discount Supabase staging - will be reverted',
        created_by: 'TEST-7G',
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('DISCOUNT_ADJUSTMENT_INSERT_SUCCESS',
      result.adjustment_insert.success === true &&
        result.adjustment_insert.row_count === 1,
      result.adjustment_insert
    );

    result.billing_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        discount_total: discountAmount,
        grand_total: 1000,
        outstanding_total: 1000,
        payment_status: 'unpaid',
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('BILLING_TOTALS_AFTER_DISCOUNT_UPDATE_SUCCESS',
      result.billing_update.success === true &&
        result.billing_update.row_count === 1,
      result.billing_update
    );

    const adjustmentAfterInsert = findAdjustmentById(adjustmentId, supabaseOptions);
    const billingAfterDiscount = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const mutationDatasets = loadFinanceDatasets(supabaseOptions);

    result.mutation_counts = buildCounts(mutationDatasets);
    result.mutation_totals = buildTotals(mutationDatasets);

    result.readback.after_discount = {
      adjustment_found: !!adjustmentAfterInsert,
      adjustment_id: adjustmentAfterInsert ? normalizeKey(adjustmentAfterInsert.adjustment_id) : '',
      adjustment_billing_id: adjustmentAfterInsert ? normalizeKey(adjustmentAfterInsert.billing_id) : '',
      adjustment_amount: adjustmentAfterInsert ? toAmount(adjustmentAfterInsert.amount) : 0,
      billing_discount_total: billingAfterDiscount ? toAmount(billingAfterDiscount.discount_total) : null,
      billing_grand_total: billingAfterDiscount ? toAmount(billingAfterDiscount.grand_total) : null,
      billing_paid_total: billingAfterDiscount ? toAmount(billingAfterDiscount.paid_total) : null,
      billing_outstanding_total: billingAfterDiscount ? toAmount(billingAfterDiscount.outstanding_total) : null,
      billing_payment_status: billingAfterDiscount ? normalizeStatus(billingAfterDiscount.payment_status) : ''
    };

    addCheck('DISCOUNT_ADJUSTMENT_READBACK_OK',
      adjustmentAfterInsert &&
        normalizeKey(adjustmentAfterInsert.adjustment_id) === adjustmentId &&
        normalizeKey(adjustmentAfterInsert.billing_id) === billingId &&
        toAmount(adjustmentAfterInsert.amount) === discountAmount,
      result.readback.after_discount
    );

    addCheck('BILLING_READBACK_AFTER_DISCOUNT_OK',
      billingAfterDiscount &&
        toAmount(billingAfterDiscount.discount_total) === 500 &&
        toAmount(billingAfterDiscount.grand_total) === 1000 &&
        toAmount(billingAfterDiscount.paid_total) === 0 &&
        toAmount(billingAfterDiscount.outstanding_total) === 1000 &&
        normalizeStatus(billingAfterDiscount.payment_status) === 'unpaid',
      result.readback.after_discount
    );

    addCheck('COUNTS_AFTER_DISCOUNT_EXPECTED',
      result.mutation_counts.billings === 46 &&
        result.mutation_counts.billing_adjustments === 2 &&
        result.mutation_counts.payments === 44 &&
        result.mutation_counts.billing_items === 99,
      result.mutation_counts
    );

    addCheck('TOTALS_AFTER_DISCOUNT_EXPECTED',
      result.mutation_totals.billings_discount_total === 100500 &&
        result.mutation_totals.billings_grand_total === 15036000 &&
        result.mutation_totals.billings_paid_total === 15035000 &&
        result.mutation_totals.billings_outstanding_total === 1000 &&
        result.mutation_totals.billing_adjustments_amount === 100500,
      result.mutation_totals
    );

    /*
     * Cleanup: delete test adjustment, then revert billing totals.
     */
    result.cleanup_adjustment_delete = compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLING_ADJUSTMENTS,
      'adjustment_id',
      adjustmentId,
      {
        stage: '7G'
      }
    ));

    addCheck('DISCOUNT_ADJUSTMENT_CLEANUP_DELETE_SUCCESS',
      result.cleanup_adjustment_delete.success === true &&
        result.cleanup_adjustment_delete.row_count === 1,
      result.cleanup_adjustment_delete
    );

    result.cleanup_billing_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        discount_total: toAmount(billingBefore.discount_total),
        grand_total: toAmount(billingBefore.grand_total),
        paid_total: toAmount(billingBefore.paid_total),
        outstanding_total: toAmount(billingBefore.outstanding_total),
        payment_status: normalizeStatus(billingBefore.payment_status),
        updated_at: normalizeKey(billingBefore.updated_at) || null
      },
      {
        stage: '7G'
      }
    ));

    addCheck('BILLING_TOTALS_CLEANUP_UPDATE_SUCCESS',
      result.cleanup_billing_update.success === true &&
        result.cleanup_billing_update.row_count === 1,
      result.cleanup_billing_update
    );

    const adjustmentAfterCleanup = findAdjustmentById(adjustmentId, supabaseOptions);
    const billingAfterCleanup = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const afterDatasets = loadFinanceDatasets(supabaseOptions);

    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    result.readback.after_cleanup = {
      adjustment_exists: !!adjustmentAfterCleanup,
      billing_discount_total: billingAfterCleanup ? toAmount(billingAfterCleanup.discount_total) : null,
      billing_grand_total: billingAfterCleanup ? toAmount(billingAfterCleanup.grand_total) : null,
      billing_paid_total: billingAfterCleanup ? toAmount(billingAfterCleanup.paid_total) : null,
      billing_outstanding_total: billingAfterCleanup ? toAmount(billingAfterCleanup.outstanding_total) : null,
      billing_payment_status: billingAfterCleanup ? normalizeStatus(billingAfterCleanup.payment_status) : '',
      billing_updated_at: billingAfterCleanup ? normalizeKey(billingAfterCleanup.updated_at) : ''
    };

    addCheck('DISCOUNT_ADJUSTMENT_DELETED_AFTER_CLEANUP',
      !adjustmentAfterCleanup,
      result.readback.after_cleanup
    );

    addCheck('BILLING_REVERTED_AFTER_DISCOUNT_CLEANUP',
      billingAfterCleanup &&
        toAmount(billingAfterCleanup.discount_total) === toAmount(billingBefore.discount_total) &&
        toAmount(billingAfterCleanup.grand_total) === toAmount(billingBefore.grand_total) &&
        toAmount(billingAfterCleanup.paid_total) === toAmount(billingBefore.paid_total) &&
        toAmount(billingAfterCleanup.outstanding_total) === toAmount(billingBefore.outstanding_total) &&
        normalizeStatus(billingAfterCleanup.payment_status) === normalizeStatus(billingBefore.payment_status),
      {
        before: result.target,
        after: result.readback.after_cleanup
      }
    );

    addCheck('COUNTS_REVERTED_AFTER_DISCOUNT_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_REVERTED_AFTER_DISCOUNT_TEST',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-4-Finance-DiscountMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'DISCOUNT_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah insert/update, jangan lanjut. Jalankan read-back adjustment_id ADJ-7G-TEST-001 dan billing target sebelum cleanup manual.'
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testFinancePhase7GInstallmentMutationLog() {
  const result = {
    success: true,
    stage: '7G-5-Finance-InstallmentMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    target: {},
    before_counts: {},
    mutation_counts: {},
    after_counts: {},
    before_totals: {},
    mutation_totals: {},
    after_totals: {},
    installment_inserts: [],
    billing_update: {},
    cleanup_installment_deletes: [],
    cleanup_billing_update: {},
    readback: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') {
      return financeToAmount_(value);
    }

    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') {
      return financeRoundAmount_(value);
    }

    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function compactMutationResult(res) {
    return {
      success: !!(res && res.success),
      operation: res && res.operation ? res.operation : '',
      table_name: res && res.table_name ? res.table_name : '',
      target_table: res && res.target_table ? res.target_table : '',
      status_code: res && res.status_code ? res.status_code : null,
      row_count: res && typeof res.row_count !== 'undefined' ? res.row_count : null
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_subtotal: sumAmount(datasets.billings, 'subtotal'),
      billings_discount_total: sumAmount(datasets.billings, 'discount_total'),
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(datasets.billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount'),
      billing_installments_amount_due: sumAmount(datasets.billingInstallments, 'amount_due'),
      billing_installments_paid_amount: sumAmount(datasets.billingInstallments, 'paid_amount'),
      payments_amount: sumAmount(datasets.payments, 'amount')
    };
  }

  function findInstallmentById(installmentId, options) {
    const id = normalizeKey(installmentId);
    if (!id) return null;

    return FinanceRepository.getBillingInstallmentsRaw(options).find(function(row) {
      return normalizeKey(row.installment_id) === id;
    }) || null;
  }

  function listInstallmentsByBillingId(billingId, options) {
    const id = normalizeKey(billingId);
    if (!id) return [];

    return FinanceRepository.getBillingInstallmentsRaw(options).filter(function(row) {
      return normalizeKey(row.billing_id) === id;
    });
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const billingId = 'BIL-20260505-140855694-907';
    const installmentId1 = 'INS-7G-TEST-001';
    const installmentId2 = 'INS-7G-TEST-002';
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const dueDate1 = '2026-06-09';
    const dueDate2 = '2026-07-09';

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.flags.supabase_staging_write_test_enabled === true, result.flags);

    if (result.flags.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_INSTALLMENT_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7G-5.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    const billingBefore = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const existingInstallment1 = findInstallmentById(installmentId1, supabaseOptions);
    const existingInstallment2 = findInstallmentById(installmentId2, supabaseOptions);
    const existingBillingInstallmentsBefore = listInstallmentsByBillingId(billingId, supabaseOptions);

    result.target = billingBefore ? {
      billing_id: normalizeKey(billingBefore.billing_id),
      billing_number: normalizeKey(billingBefore.billing_number),
      patient_id: normalizeKey(billingBefore.patient_id),
      patient_name: normalizeKey(billingBefore.patient_name),
      treatment_id: normalizeKey(billingBefore.treatment_id),
      grand_total: toAmount(billingBefore.grand_total),
      paid_total: toAmount(billingBefore.paid_total),
      outstanding_total: toAmount(billingBefore.outstanding_total),
      payment_type: normalizeStatus(billingBefore.payment_type),
      payment_terms: normalizeStatus(billingBefore.payment_terms),
      payment_status: normalizeStatus(billingBefore.payment_status),
      updated_at: normalizeKey(billingBefore.updated_at)
    } : null;

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_grand_total === 15036500 &&
        result.before_totals.billings_paid_total === 15035000 &&
        result.before_totals.billings_outstanding_total === 1500 &&
        result.before_totals.billing_installments_amount_due === 0 &&
        result.before_totals.billing_installments_paid_amount === 0,
      result.before_totals
    );

    addCheck('TARGET_RECEIVABLE_BILLING_READY_FOR_INSTALLMENT',
      billingBefore &&
        toAmount(billingBefore.grand_total) === 1500 &&
        toAmount(billingBefore.paid_total) === 0 &&
        toAmount(billingBefore.outstanding_total) === 1500 &&
        normalizeStatus(billingBefore.payment_status) === 'unpaid',
      result.target || {}
    );

    addCheck('TEST_INSTALLMENT_IDS_NOT_EXIST_BEFORE',
      !existingInstallment1 &&
        !existingInstallment2 &&
        existingBillingInstallmentsBefore.length === 0,
      {
        installment_id_1_exists: !!existingInstallment1,
        installment_id_2_exists: !!existingInstallment2,
        existing_billing_installments: existingBillingInstallmentsBefore.length
      }
    );

    result.installment_inserts.push(compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLING_INSTALLMENTS,
      {
        installment_id: installmentId1,
        billing_id: billingId,
        installment_no: 1,
        due_date: dueDate1,
        amount_due: 750,
        paid_amount: 0,
        status: 'pending',
        paid_at: null,
        notes: 'TEST 7G-5 installment 1 Supabase staging - will be reverted',
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    )));

    result.installment_inserts.push(compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLING_INSTALLMENTS,
      {
        installment_id: installmentId2,
        billing_id: billingId,
        installment_no: 2,
        due_date: dueDate2,
        amount_due: 750,
        paid_amount: 0,
        status: 'pending',
        paid_at: null,
        notes: 'TEST 7G-5 installment 2 Supabase staging - will be reverted',
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    )));

    addCheck('INSTALLMENT_INSERTS_SUCCESS',
      result.installment_inserts.length === 2 &&
        result.installment_inserts.every(function(item) {
          return item.success === true && item.row_count === 1;
        }),
      result.installment_inserts
    );

    result.billing_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        payment_type: 'installment',
        payment_terms: 'installment',
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('BILLING_PAYMENT_TERMS_UPDATE_SUCCESS',
      result.billing_update.success === true &&
        result.billing_update.row_count === 1,
      result.billing_update
    );

    const installment1AfterInsert = findInstallmentById(installmentId1, supabaseOptions);
    const installment2AfterInsert = findInstallmentById(installmentId2, supabaseOptions);
    const billingAfterInstallments = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const billingInstallmentsAfterInsert = listInstallmentsByBillingId(billingId, supabaseOptions);
    const mutationDatasets = loadFinanceDatasets(supabaseOptions);

    result.mutation_counts = buildCounts(mutationDatasets);
    result.mutation_totals = buildTotals(mutationDatasets);

    result.readback.after_installment = {
      installment_1_found: !!installment1AfterInsert,
      installment_2_found: !!installment2AfterInsert,
      billing_installment_count: billingInstallmentsAfterInsert.length,
      amount_due_total: sumAmount(billingInstallmentsAfterInsert, 'amount_due'),
      paid_amount_total: sumAmount(billingInstallmentsAfterInsert, 'paid_amount'),
      billing_payment_type: billingAfterInstallments ? normalizeStatus(billingAfterInstallments.payment_type) : '',
      billing_payment_terms: billingAfterInstallments ? normalizeStatus(billingAfterInstallments.payment_terms) : '',
      billing_payment_status: billingAfterInstallments ? normalizeStatus(billingAfterInstallments.payment_status) : '',
      billing_outstanding_total: billingAfterInstallments ? toAmount(billingAfterInstallments.outstanding_total) : null
    };

    addCheck('INSTALLMENTS_READBACK_OK',
      installment1AfterInsert &&
        installment2AfterInsert &&
        billingInstallmentsAfterInsert.length === 2 &&
        sumAmount(billingInstallmentsAfterInsert, 'amount_due') === 1500 &&
        sumAmount(billingInstallmentsAfterInsert, 'paid_amount') === 0,
      result.readback.after_installment
    );

    addCheck('BILLING_READBACK_AFTER_INSTALLMENT_OK',
      billingAfterInstallments &&
        normalizeStatus(billingAfterInstallments.payment_type) === 'installment' &&
        normalizeStatus(billingAfterInstallments.payment_terms) === 'installment' &&
        toAmount(billingAfterInstallments.grand_total) === 1500 &&
        toAmount(billingAfterInstallments.paid_total) === 0 &&
        toAmount(billingAfterInstallments.outstanding_total) === 1500 &&
        normalizeStatus(billingAfterInstallments.payment_status) === 'unpaid',
      result.readback.after_installment
    );

    addCheck('COUNTS_AFTER_INSTALLMENT_EXPECTED',
      result.mutation_counts.billings === 46 &&
        result.mutation_counts.billing_installments === 2 &&
        result.mutation_counts.payments === 44 &&
        result.mutation_counts.billing_adjustments === 1,
      result.mutation_counts
    );

    addCheck('TOTALS_AFTER_INSTALLMENT_EXPECTED',
      result.mutation_totals.billings_grand_total === 15036500 &&
        result.mutation_totals.billings_paid_total === 15035000 &&
        result.mutation_totals.billings_outstanding_total === 1500 &&
        result.mutation_totals.billing_installments_amount_due === 1500 &&
        result.mutation_totals.billing_installments_paid_amount === 0,
      result.mutation_totals
    );

    /*
     * Cleanup: delete test installments, then revert billing payment_type/payment_terms.
     */
    result.cleanup_installment_deletes.push(compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLING_INSTALLMENTS,
      'installment_id',
      installmentId1,
      {
        stage: '7G'
      }
    )));

    result.cleanup_installment_deletes.push(compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLING_INSTALLMENTS,
      'installment_id',
      installmentId2,
      {
        stage: '7G'
      }
    )));

    addCheck('INSTALLMENT_CLEANUP_DELETES_SUCCESS',
      result.cleanup_installment_deletes.length === 2 &&
        result.cleanup_installment_deletes.every(function(item) {
          return item.success === true && item.row_count === 1;
        }),
      result.cleanup_installment_deletes
    );

    result.cleanup_billing_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        payment_type: normalizeStatus(billingBefore.payment_type) || 'full',
        payment_terms: normalizeStatus(billingBefore.payment_terms) || 'full',
        updated_at: normalizeKey(billingBefore.updated_at) || null
      },
      {
        stage: '7G'
      }
    ));

    addCheck('BILLING_PAYMENT_TERMS_CLEANUP_UPDATE_SUCCESS',
      result.cleanup_billing_update.success === true &&
        result.cleanup_billing_update.row_count === 1,
      result.cleanup_billing_update
    );

    const installment1AfterCleanup = findInstallmentById(installmentId1, supabaseOptions);
    const installment2AfterCleanup = findInstallmentById(installmentId2, supabaseOptions);
    const billingAfterCleanup = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const billingInstallmentsAfterCleanup = listInstallmentsByBillingId(billingId, supabaseOptions);
    const afterDatasets = loadFinanceDatasets(supabaseOptions);

    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    result.readback.after_cleanup = {
      installment_1_exists: !!installment1AfterCleanup,
      installment_2_exists: !!installment2AfterCleanup,
      billing_installment_count: billingInstallmentsAfterCleanup.length,
      billing_payment_type: billingAfterCleanup ? normalizeStatus(billingAfterCleanup.payment_type) : '',
      billing_payment_terms: billingAfterCleanup ? normalizeStatus(billingAfterCleanup.payment_terms) : '',
      billing_updated_at: billingAfterCleanup ? normalizeKey(billingAfterCleanup.updated_at) : ''
    };

    addCheck('INSTALLMENTS_DELETED_AFTER_CLEANUP',
      !installment1AfterCleanup &&
        !installment2AfterCleanup &&
        billingInstallmentsAfterCleanup.length === 0,
      result.readback.after_cleanup
    );

    addCheck('BILLING_PAYMENT_TERMS_REVERTED_AFTER_CLEANUP',
      billingAfterCleanup &&
        normalizeStatus(billingAfterCleanup.payment_type) === normalizeStatus(billingBefore.payment_type) &&
        normalizeStatus(billingAfterCleanup.payment_terms) === normalizeStatus(billingBefore.payment_terms),
      {
        before: result.target,
        after: result.readback.after_cleanup
      }
    );

    addCheck('COUNTS_REVERTED_AFTER_INSTALLMENT_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_REVERTED_AFTER_INSTALLMENT_TEST',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-5-Finance-InstallmentMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'INSTALLMENT_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah insert/update, jangan lanjut. Jalankan read-back installment_id INS-7G-TEST-001/002 dan billing target sebelum cleanup manual.'
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testFinancePhase7GInvoiceMutationLog() {
  const result = {
    success: true,
    stage: '7G-6-Finance-InvoiceMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    target: {},
    before_counts: {},
    mutation_counts: {},
    after_counts: {},
    before_totals: {},
    mutation_totals: {},
    after_totals: {},
    invoice_update: {},
    cleanup_invoice_update: {},
    readback: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function nullIfBlank(value) {
    const text = normalizeKey(value);
    return text ? text : null;
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function compactMutationResult(res) {
    return {
      success: !!(res && res.success),
      operation: res && res.operation ? res.operation : '',
      table_name: res && res.table_name ? res.table_name : '',
      target_table: res && res.target_table ? res.target_table : '',
      status_code: res && res.status_code ? res.status_code : null,
      row_count: res && typeof res.row_count !== 'undefined' ? res.row_count : null
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      payments_amount: sumAmount(datasets.payments, 'amount'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount')
    };
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const billingId = 'BIL-20260505-140855694-907';
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.flags.supabase_staging_write_test_enabled === true, result.flags);

    if (result.flags.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_INVOICE_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7G-6.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    const billingBefore = FinanceRepository.findBillingById(billingId, supabaseOptions);

    result.target = billingBefore ? {
      billing_id: normalizeKey(billingBefore.billing_id),
      billing_number: normalizeKey(billingBefore.billing_number),
      patient_id: normalizeKey(billingBefore.patient_id),
      patient_name: normalizeKey(billingBefore.patient_name),
      grand_total: toAmount(billingBefore.grand_total),
      paid_total: toAmount(billingBefore.paid_total),
      outstanding_total: toAmount(billingBefore.outstanding_total),
      payment_status: normalizeStatus(billingBefore.payment_status),
      invoice_pdf_file_id: normalizeKey(billingBefore.invoice_pdf_file_id),
      invoice_pdf_url: normalizeKey(billingBefore.invoice_pdf_url),
      invoice_sent_to: normalizeKey(billingBefore.invoice_sent_to),
      invoice_sent_at: normalizeKey(billingBefore.invoice_sent_at),
      invoice_delivery_status: normalizeStatus(billingBefore.invoice_delivery_status),
      invoice_pdf_signature: normalizeKey(billingBefore.invoice_pdf_signature),
      invoice_pdf_signature_at: normalizeKey(billingBefore.invoice_pdf_signature_at),
      updated_at: normalizeKey(billingBefore.updated_at)
    } : null;

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_grand_total === 15036500 &&
        result.before_totals.billings_paid_total === 15035000 &&
        result.before_totals.billings_outstanding_total === 1500 &&
        result.before_totals.payments_amount === 15035000 &&
        result.before_totals.billing_adjustments_amount === 100000,
      result.before_totals
    );

    addCheck('TARGET_BILLING_FOUND_FOR_INVOICE_TEST', !!billingBefore, {
      billing_id: billingId
    });

    result.invoice_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        invoice_pdf_file_id: 'FILE-7G-TEST-001',
        invoice_pdf_url: 'https://example.com/test-7g-invoice.pdf',
        invoice_sent_to: 'test-7g@example.com',
        invoice_sent_at: now,
        invoice_delivery_status: 'sent',
        invoice_pdf_signature: 'SIG-7G-TEST-001',
        invoice_pdf_signature_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('INVOICE_UPDATE_SUCCESS',
      result.invoice_update.success === true &&
        result.invoice_update.row_count === 1,
      result.invoice_update
    );

    const billingAfterInvoice = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const mutationDatasets = loadFinanceDatasets(supabaseOptions);

    result.mutation_counts = buildCounts(mutationDatasets);
    result.mutation_totals = buildTotals(mutationDatasets);

    result.readback.after_invoice = billingAfterInvoice ? {
      invoice_pdf_file_id: normalizeKey(billingAfterInvoice.invoice_pdf_file_id),
      invoice_pdf_url: normalizeKey(billingAfterInvoice.invoice_pdf_url),
      invoice_sent_to: normalizeKey(billingAfterInvoice.invoice_sent_to),
      invoice_sent_at: normalizeKey(billingAfterInvoice.invoice_sent_at),
      invoice_delivery_status: normalizeStatus(billingAfterInvoice.invoice_delivery_status),
      invoice_pdf_signature: normalizeKey(billingAfterInvoice.invoice_pdf_signature),
      invoice_pdf_signature_at: normalizeKey(billingAfterInvoice.invoice_pdf_signature_at),
      updated_at: normalizeKey(billingAfterInvoice.updated_at),
      grand_total: toAmount(billingAfterInvoice.grand_total),
      paid_total: toAmount(billingAfterInvoice.paid_total),
      outstanding_total: toAmount(billingAfterInvoice.outstanding_total),
      payment_status: normalizeStatus(billingAfterInvoice.payment_status)
    } : null;

    addCheck('INVOICE_READBACK_UPDATED',
      billingAfterInvoice &&
        normalizeKey(billingAfterInvoice.invoice_pdf_file_id) === 'FILE-7G-TEST-001' &&
        normalizeKey(billingAfterInvoice.invoice_pdf_url) === 'https://example.com/test-7g-invoice.pdf' &&
        normalizeKey(billingAfterInvoice.invoice_sent_to) === 'test-7g@example.com' &&
        normalizeStatus(billingAfterInvoice.invoice_delivery_status) === 'sent' &&
        normalizeKey(billingAfterInvoice.invoice_pdf_signature) === 'SIG-7G-TEST-001' &&
        !!normalizeKey(billingAfterInvoice.invoice_sent_at) &&
        !!normalizeKey(billingAfterInvoice.invoice_pdf_signature_at),
      result.readback.after_invoice || {}
    );

    addCheck('TOTAL_FIELDS_UNCHANGED_AFTER_INVOICE_UPDATE',
      billingAfterInvoice &&
        toAmount(billingAfterInvoice.grand_total) === toAmount(billingBefore.grand_total) &&
        toAmount(billingAfterInvoice.paid_total) === toAmount(billingBefore.paid_total) &&
        toAmount(billingAfterInvoice.outstanding_total) === toAmount(billingBefore.outstanding_total) &&
        normalizeStatus(billingAfterInvoice.payment_status) === normalizeStatus(billingBefore.payment_status),
      result.readback.after_invoice || {}
    );

    addCheck('COUNTS_UNCHANGED_AFTER_INVOICE_UPDATE',
      JSON.stringify(result.mutation_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.mutation_counts
      }
    );

    addCheck('TOTALS_UNCHANGED_AFTER_INVOICE_UPDATE',
      JSON.stringify(result.mutation_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.mutation_totals
      }
    );

    /*
     * Cleanup/revert invoice fields.
     * Kolom timestamp nullable wajib pakai null jika baseline kosong.
     */
    result.cleanup_invoice_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      billingId,
      {
        invoice_pdf_file_id: result.target.invoice_pdf_file_id,
        invoice_pdf_url: result.target.invoice_pdf_url,
        invoice_sent_to: result.target.invoice_sent_to,
        invoice_sent_at: nullIfBlank(result.target.invoice_sent_at),
        invoice_delivery_status: result.target.invoice_delivery_status,
        invoice_pdf_signature: result.target.invoice_pdf_signature,
        invoice_pdf_signature_at: nullIfBlank(result.target.invoice_pdf_signature_at),
        updated_at: nullIfBlank(result.target.updated_at)
      },
      {
        stage: '7G'
      }
    ));

    addCheck('INVOICE_CLEANUP_UPDATE_SUCCESS',
      result.cleanup_invoice_update.success === true &&
        result.cleanup_invoice_update.row_count === 1,
      result.cleanup_invoice_update
    );

    const billingAfterCleanup = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const afterDatasets = loadFinanceDatasets(supabaseOptions);

    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    result.readback.after_cleanup = billingAfterCleanup ? {
      invoice_pdf_file_id: normalizeKey(billingAfterCleanup.invoice_pdf_file_id),
      invoice_pdf_url: normalizeKey(billingAfterCleanup.invoice_pdf_url),
      invoice_sent_to: normalizeKey(billingAfterCleanup.invoice_sent_to),
      invoice_sent_at: normalizeKey(billingAfterCleanup.invoice_sent_at),
      invoice_delivery_status: normalizeStatus(billingAfterCleanup.invoice_delivery_status),
      invoice_pdf_signature: normalizeKey(billingAfterCleanup.invoice_pdf_signature),
      invoice_pdf_signature_at: normalizeKey(billingAfterCleanup.invoice_pdf_signature_at),
      updated_at: normalizeKey(billingAfterCleanup.updated_at),
      grand_total: toAmount(billingAfterCleanup.grand_total),
      paid_total: toAmount(billingAfterCleanup.paid_total),
      outstanding_total: toAmount(billingAfterCleanup.outstanding_total),
      payment_status: normalizeStatus(billingAfterCleanup.payment_status)
    } : null;

    addCheck('INVOICE_FIELDS_REVERTED_AFTER_CLEANUP',
      billingAfterCleanup &&
        normalizeKey(billingAfterCleanup.invoice_pdf_file_id) === result.target.invoice_pdf_file_id &&
        normalizeKey(billingAfterCleanup.invoice_pdf_url) === result.target.invoice_pdf_url &&
        normalizeKey(billingAfterCleanup.invoice_sent_to) === result.target.invoice_sent_to &&
        normalizeKey(billingAfterCleanup.invoice_sent_at) === result.target.invoice_sent_at &&
        normalizeStatus(billingAfterCleanup.invoice_delivery_status) === result.target.invoice_delivery_status &&
        normalizeKey(billingAfterCleanup.invoice_pdf_signature) === result.target.invoice_pdf_signature &&
        normalizeKey(billingAfterCleanup.invoice_pdf_signature_at) === result.target.invoice_pdf_signature_at,
      {
        before: result.target,
        after: result.readback.after_cleanup
      }
    );

    addCheck('COUNTS_REVERTED_AFTER_INVOICE_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_REVERTED_AFTER_INVOICE_TEST',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-6-Finance-InvoiceMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'INVOICE_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah invoice update, jangan lanjut. Jalankan read-back billing target sebelum cleanup manual.'
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testFinancePhase7GFeedbackTokenMutationLog() {
  const result = {
    success: true,
    stage: '7G-7-Finance-FeedbackTokenMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    target: {},
    before_counts: {},
    mutation_counts: {},
    submitted_counts: {},
    after_counts: {},
    before_totals: {},
    mutation_totals: {},
    submitted_totals: {},
    after_totals: {},
    feedback_insert: {},
    feedback_update: {},
    cleanup_feedback_delete: {},
    readback: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function compactMutationResult(res) {
    return {
      success: !!(res && res.success),
      operation: res && res.operation ? res.operation : '',
      table_name: res && res.table_name ? res.table_name : '',
      target_table: res && res.target_table ? res.target_table : '',
      status_code: res && res.status_code ? res.status_code : null,
      row_count: res && typeof res.row_count !== 'undefined' ? res.row_count : null
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      payments_amount: sumAmount(datasets.payments, 'amount'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount')
    };
  }

  function findFeedbackById(feedbackId, options) {
    const id = normalizeKey(feedbackId);
    if (!id) return null;

    return FinanceRepository.getBillingFeedbacksRaw(options).find(function(row) {
      return normalizeKey(row.feedback_id) === id;
    }) || null;
  }

  function findFeedbackByToken(token, options) {
    const normalizedToken = normalizeKey(token);
    if (!normalizedToken) return null;

    return FinanceRepository.getBillingFeedbacksRaw(options).find(function(row) {
      return normalizeKey(row.feedback_token) === normalizedToken;
    }) || null;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const billingId = 'BIL-20260505-140855694-907';
    const feedbackId = 'FBK-7G-TEST-001';
    const feedbackToken = 'TOKEN-7G-TEST-001';
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.flags.supabase_staging_write_test_enabled === true, result.flags);

    if (result.flags.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_FEEDBACK_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7G-7.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    const billingBefore = FinanceRepository.findBillingById(billingId, supabaseOptions);
    const existingFeedbackBefore = findFeedbackById(feedbackId, supabaseOptions);
    const existingTokenBefore = findFeedbackByToken(feedbackToken, supabaseOptions);

    result.target = billingBefore ? {
      billing_id: normalizeKey(billingBefore.billing_id),
      billing_number: normalizeKey(billingBefore.billing_number),
      patient_id: normalizeKey(billingBefore.patient_id),
      patient_name: normalizeKey(billingBefore.patient_name),
      grand_total: toAmount(billingBefore.grand_total),
      paid_total: toAmount(billingBefore.paid_total),
      outstanding_total: toAmount(billingBefore.outstanding_total),
      payment_status: normalizeStatus(billingBefore.payment_status)
    } : null;

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_grand_total === 15036500 &&
        result.before_totals.billings_paid_total === 15035000 &&
        result.before_totals.billings_outstanding_total === 1500 &&
        result.before_totals.payments_amount === 15035000 &&
        result.before_totals.billing_adjustments_amount === 100000,
      result.before_totals
    );

    addCheck('TARGET_BILLING_FOUND_FOR_FEEDBACK_TEST', !!billingBefore, {
      billing_id: billingId
    });

    addCheck('TEST_FEEDBACK_ID_AND_TOKEN_NOT_EXIST_BEFORE',
      !existingFeedbackBefore && !existingTokenBefore,
      {
        feedback_id_exists: !!existingFeedbackBefore,
        feedback_token_exists: !!existingTokenBefore
      }
    );

    result.feedback_insert = compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLING_FEEDBACKS,
      {
        feedback_id: feedbackId,
        billing_id: billingId,
        feedback_token: feedbackToken,
        feedback_status: 'pending',
        rating: null,
        service_quality: '',
        staff_friendliness: '',
        clinic_cleanliness: '',
        waiting_time: '',
        comment: '',
        submitted_at: null,
        patient_id: normalizeKey(billingBefore.patient_id),
        patient_name: normalizeKey(billingBefore.patient_name),
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('FEEDBACK_TOKEN_INSERT_SUCCESS',
      result.feedback_insert.success === true &&
        result.feedback_insert.row_count === 1,
      result.feedback_insert
    );

    const feedbackAfterInsert = findFeedbackById(feedbackId, supabaseOptions);
    const feedbackByTokenAfterInsert = findFeedbackByToken(feedbackToken, supabaseOptions);
    const mutationDatasets = loadFinanceDatasets(supabaseOptions);

    result.mutation_counts = buildCounts(mutationDatasets);
    result.mutation_totals = buildTotals(mutationDatasets);

    result.readback.after_pending = feedbackAfterInsert ? {
      feedback_found: true,
      feedback_id: normalizeKey(feedbackAfterInsert.feedback_id),
      billing_id: normalizeKey(feedbackAfterInsert.billing_id),
      feedback_token: normalizeKey(feedbackAfterInsert.feedback_token),
      feedback_status: normalizeStatus(feedbackAfterInsert.feedback_status),
      rating: feedbackAfterInsert.rating === null || typeof feedbackAfterInsert.rating === 'undefined'
        ? null
        : Number(feedbackAfterInsert.rating),
      submitted_at: normalizeKey(feedbackAfterInsert.submitted_at),
      find_by_token_ok: !!feedbackByTokenAfterInsert
    } : {
      feedback_found: false
    };

    addCheck('FEEDBACK_PENDING_READBACK_OK',
      feedbackAfterInsert &&
        feedbackByTokenAfterInsert &&
        normalizeKey(feedbackAfterInsert.feedback_id) === feedbackId &&
        normalizeKey(feedbackAfterInsert.billing_id) === billingId &&
        normalizeKey(feedbackAfterInsert.feedback_token) === feedbackToken &&
        normalizeStatus(feedbackAfterInsert.feedback_status) === 'pending' &&
        normalizeKey(feedbackAfterInsert.submitted_at) === '',
      result.readback.after_pending
    );

    addCheck('COUNTS_AFTER_FEEDBACK_INSERT_EXPECTED',
      result.mutation_counts.billings === 46 &&
        result.mutation_counts.billing_feedbacks === 1 &&
        result.mutation_counts.payments === 44 &&
        result.mutation_counts.billing_adjustments === 1,
      result.mutation_counts
    );

    addCheck('TOTALS_UNCHANGED_AFTER_FEEDBACK_INSERT',
      JSON.stringify(result.mutation_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.mutation_totals
      }
    );

    result.feedback_update = compactMutationResult(dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.BILLING_FEEDBACKS,
      'feedback_id',
      feedbackId,
      {
        feedback_status: 'submitted',
        rating: 5,
        service_quality: 'very_satisfied',
        staff_friendliness: 'very_satisfied',
        clinic_cleanliness: 'very_satisfied',
        waiting_time: 'very_satisfied',
        comment: 'TEST 7G-7 feedback submitted Supabase staging - will be reverted',
        submitted_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('FEEDBACK_SUBMITTED_UPDATE_SUCCESS',
      result.feedback_update.success === true &&
        result.feedback_update.row_count === 1,
      result.feedback_update
    );

    const feedbackAfterSubmitted = findFeedbackById(feedbackId, supabaseOptions);
    const submittedDatasets = loadFinanceDatasets(supabaseOptions);

    result.submitted_counts = buildCounts(submittedDatasets);
    result.submitted_totals = buildTotals(submittedDatasets);

    result.readback.after_submitted = feedbackAfterSubmitted ? {
      feedback_found: true,
      feedback_id: normalizeKey(feedbackAfterSubmitted.feedback_id),
      feedback_status: normalizeStatus(feedbackAfterSubmitted.feedback_status),
      rating: Number(feedbackAfterSubmitted.rating || 0),
      service_quality: normalizeKey(feedbackAfterSubmitted.service_quality),
      staff_friendliness: normalizeKey(feedbackAfterSubmitted.staff_friendliness),
      clinic_cleanliness: normalizeKey(feedbackAfterSubmitted.clinic_cleanliness),
      waiting_time: normalizeKey(feedbackAfterSubmitted.waiting_time),
      submitted_at: normalizeKey(feedbackAfterSubmitted.submitted_at),
      comment: normalizeKey(feedbackAfterSubmitted.comment)
    } : {
      feedback_found: false
    };

    addCheck('FEEDBACK_SUBMITTED_READBACK_OK',
      feedbackAfterSubmitted &&
        normalizeStatus(feedbackAfterSubmitted.feedback_status) === 'submitted' &&
        Number(feedbackAfterSubmitted.rating || 0) === 5 &&
        normalizeKey(feedbackAfterSubmitted.service_quality) === 'very_satisfied' &&
        normalizeKey(feedbackAfterSubmitted.staff_friendliness) === 'very_satisfied' &&
        normalizeKey(feedbackAfterSubmitted.clinic_cleanliness) === 'very_satisfied' &&
        normalizeKey(feedbackAfterSubmitted.waiting_time) === 'very_satisfied' &&
        !!normalizeKey(feedbackAfterSubmitted.submitted_at),
      result.readback.after_submitted
    );

    addCheck('COUNTS_AFTER_FEEDBACK_SUBMITTED_EXPECTED',
      result.submitted_counts.billings === 46 &&
        result.submitted_counts.billing_feedbacks === 1 &&
        result.submitted_counts.payments === 44,
      result.submitted_counts
    );

    addCheck('TOTALS_UNCHANGED_AFTER_FEEDBACK_SUBMITTED',
      JSON.stringify(result.submitted_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.submitted_totals
      }
    );

    /*
     * Cleanup: delete feedback test.
     */
    result.cleanup_feedback_delete = compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLING_FEEDBACKS,
      'feedback_id',
      feedbackId,
      {
        stage: '7G'
      }
    ));

    addCheck('FEEDBACK_CLEANUP_DELETE_SUCCESS',
      result.cleanup_feedback_delete.success === true &&
        result.cleanup_feedback_delete.row_count === 1,
      result.cleanup_feedback_delete
    );

    const feedbackAfterCleanup = findFeedbackById(feedbackId, supabaseOptions);
    const tokenAfterCleanup = findFeedbackByToken(feedbackToken, supabaseOptions);
    const afterDatasets = loadFinanceDatasets(supabaseOptions);

    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    result.readback.after_cleanup = {
      feedback_exists: !!feedbackAfterCleanup,
      token_exists: !!tokenAfterCleanup
    };

    addCheck('FEEDBACK_DELETED_AFTER_CLEANUP',
      !feedbackAfterCleanup && !tokenAfterCleanup,
      result.readback.after_cleanup
    );

    addCheck('COUNTS_REVERTED_AFTER_FEEDBACK_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_REVERTED_AFTER_FEEDBACK_TEST',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-7-Finance-FeedbackTokenMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FEEDBACK_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah insert/update, jangan lanjut. Jalankan read-back feedback_id FBK-7G-TEST-001 dan token TOKEN-7G-TEST-001 sebelum cleanup manual.'
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testFinancePhase7GDraftBillingMutationLog() {
  const result = {
    success: true,
    stage: '7G-8-Finance-DraftBillingMutation',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    source_template: {},
    test_ids: {
      billing_id: 'BIL-7G-TEST-001',
      billing_number: 'INV-7G-TEST-001',
      billing_item_id: 'BII-7G-TEST-001'
    },
    before_counts: {},
    mutation_counts: {},
    after_counts: {},
    before_totals: {},
    mutation_totals: {},
    after_totals: {},
    billing_insert: {},
    billing_item_insert: {},
    cleanup_billing_item_delete: {},
    cleanup_billing_delete: {},
    readback: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function compactMutationResult(res) {
    return {
      success: !!(res && res.success),
      operation: res && res.operation ? res.operation : '',
      table_name: res && res.table_name ? res.table_name : '',
      target_table: res && res.target_table ? res.target_table : '',
      status_code: res && res.status_code ? res.status_code : null,
      row_count: res && typeof res.row_count !== 'undefined' ? res.row_count : null
    };
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_subtotal: sumAmount(datasets.billings, 'subtotal'),
      billings_discount_total: sumAmount(datasets.billings, 'discount_total'),
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(datasets.billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount'),
      payments_amount: sumAmount(datasets.payments, 'amount')
    };
  }

  function findBillingItemById(billingItemId, options) {
    const id = normalizeKey(billingItemId);
    if (!id) return null;

    return FinanceRepository.getBillingItemsRaw(options).find(function(row) {
      return normalizeKey(row.billing_item_id) === id;
    }) || null;
  }

  function listBillingItemsByBillingId(billingId, options) {
    const id = normalizeKey(billingId);
    if (!id) return [];

    return FinanceRepository.getBillingItemsRaw(options).filter(function(row) {
      return normalizeKey(row.billing_id) === id;
    });
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    const sourceBillingId = 'BIL-20260505-140855694-907';
    const testBillingId = result.test_ids.billing_id;
    const testBillingNumber = result.test_ids.billing_number;
    const testBillingItemId = result.test_ids.billing_item_id;
    const testAmount = 1500;
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();
    const today = typeof getFinanceTodayYmd_ === 'function'
      ? getFinanceTodayYmd_()
      : now.slice(0, 10);

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.flags.default_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.flags.ui_read_backend_mode === 'spreadsheet', result.flags);
    addCheck('UI_READ_SUPABASE_TEST_FLAG_FALSE', result.flags.ui_read_supabase_test_enabled === false, result.flags);
    addCheck('SUPABASE_STAGING_WRITE_FLAG_TRUE_FOR_THIS_TEST', result.flags.supabase_staging_write_test_enabled === true, result.flags);

    if (result.flags.supabase_staging_write_test_enabled !== true) {
      result.issues.push({
        issue: 'WRITE_FLAG_NOT_TRUE_ABORTING_DRAFT_BILLING_MUTATION_TEST',
        message: 'Aktifkan sementara REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED = true sebelum menjalankan 7G-8.'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result));
      return result;
    }

    const beforeDatasets = loadFinanceDatasets(supabaseOptions);
    result.before_counts = buildCounts(beforeDatasets);
    result.before_totals = buildTotals(beforeDatasets);

    const sourceBilling = FinanceRepository.findBillingById(sourceBillingId, supabaseOptions);
    const sourceItems = listBillingItemsByBillingId(sourceBillingId, supabaseOptions);
    const sourceItem = sourceItems[0] || null;

    const existingTestBilling = FinanceRepository.findBillingById(testBillingId, supabaseOptions);
    const existingTestItem = findBillingItemById(testBillingItemId, supabaseOptions);

    result.source_template = {
      source_billing_id: sourceBillingId,
      source_item_count: sourceItems.length,
      patient_id: sourceBilling ? normalizeKey(sourceBilling.patient_id) : '',
      patient_name: sourceBilling ? normalizeKey(sourceBilling.patient_name) : '',
      treatment_id: sourceBilling ? normalizeKey(sourceBilling.treatment_id) : '',
      appointment_id: sourceBilling ? normalizeKey(sourceBilling.appointment_id) : '',
      service_id: sourceItem ? normalizeKey(sourceItem.service_id) : '',
      service_name: sourceItem ? normalizeKey(sourceItem.service_name) : '',
      treatment_item_id: sourceItem ? normalizeKey(sourceItem.treatment_item_id) : '',
      amount: testAmount
    };

    addCheck('BASELINE_COUNTS_OK',
      result.before_counts.billings === 46 &&
        result.before_counts.billing_items === 99 &&
        result.before_counts.billing_adjustments === 1 &&
        result.before_counts.billing_installments === 0 &&
        result.before_counts.payments === 44 &&
        result.before_counts.billing_feedbacks === 0,
      result.before_counts
    );

    addCheck('BASELINE_TOTALS_OK',
      result.before_totals.billings_subtotal === 15136500 &&
        result.before_totals.billings_discount_total === 100000 &&
        result.before_totals.billings_grand_total === 15036500 &&
        result.before_totals.billings_paid_total === 15035000 &&
        result.before_totals.billings_outstanding_total === 1500 &&
        result.before_totals.billing_items_subtotal === 15136500,
      result.before_totals
    );

    addCheck('SOURCE_TEMPLATE_READY',
      !!sourceBilling &&
        !!sourceItem &&
        !!result.source_template.patient_id &&
        !!result.source_template.treatment_id &&
        !!result.source_template.service_id,
      result.source_template
    );

    addCheck('TEST_BILLING_AND_ITEM_NOT_EXIST_BEFORE',
      !existingTestBilling && !existingTestItem,
      {
        test_billing_exists: !!existingTestBilling,
        test_billing_item_exists: !!existingTestItem
      }
    );

    result.billing_insert = compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLINGS,
      {
        billing_id: testBillingId,
        billing_number: testBillingNumber,
        treatment_id: result.source_template.treatment_id,
        appointment_id: result.source_template.appointment_id,
        patient_id: result.source_template.patient_id,
        patient_name: result.source_template.patient_name,
        billing_date: today,
        due_date: today,
        subtotal: testAmount,
        discount_total: 0,
        grand_total: testAmount,
        paid_total: 0,
        outstanding_total: testAmount,
        payment_status: 'unpaid',
        billing_status: 'draft',
        payment_type: 'full',
        payment_terms: 'full',
        notes: 'TEST 7G-8 draft billing Supabase staging - will be reverted',
        invoice_pdf_file_id: '',
        invoice_pdf_url: '',
        invoice_sent_to: '',
        invoice_sent_at: null,
        invoice_delivery_status: '',
        invoice_pdf_signature: '',
        invoice_pdf_signature_at: null,
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('DRAFT_BILLING_INSERT_SUCCESS',
      result.billing_insert.success === true &&
        result.billing_insert.row_count === 1,
      result.billing_insert
    );

    result.billing_item_insert = compactMutationResult(dbSupabaseInsertStaging7A_(
      REPO_TABLES.BILLING_ITEMS,
      {
        billing_item_id: testBillingItemId,
        billing_id: testBillingId,
        treatment_id: result.source_template.treatment_id,
        treatment_item_id: result.source_template.treatment_item_id,
        service_id: result.source_template.service_id,
        service_name: result.source_template.service_name,
        qty: 1,
        unit_price: testAmount,
        subtotal: testAmount,
        created_at: now,
        updated_at: now
      },
      {
        stage: '7G'
      }
    ));

    addCheck('DRAFT_BILLING_ITEM_INSERT_SUCCESS',
      result.billing_item_insert.success === true &&
        result.billing_item_insert.row_count === 1,
      result.billing_item_insert
    );

    const testBillingAfterInsert = FinanceRepository.findBillingById(testBillingId, supabaseOptions);
    const testItemAfterInsert = findBillingItemById(testBillingItemId, supabaseOptions);
    const testItemsAfterInsert = listBillingItemsByBillingId(testBillingId, supabaseOptions);
    const mutationDatasets = loadFinanceDatasets(supabaseOptions);

    result.mutation_counts = buildCounts(mutationDatasets);
    result.mutation_totals = buildTotals(mutationDatasets);

    result.readback.after_insert = {
      billing_found: !!testBillingAfterInsert,
      billing_item_found: !!testItemAfterInsert,
      billing_item_count: testItemsAfterInsert.length,
      billing_grand_total: testBillingAfterInsert ? toAmount(testBillingAfterInsert.grand_total) : null,
      billing_paid_total: testBillingAfterInsert ? toAmount(testBillingAfterInsert.paid_total) : null,
      billing_outstanding_total: testBillingAfterInsert ? toAmount(testBillingAfterInsert.outstanding_total) : null,
      billing_payment_status: testBillingAfterInsert ? normalizeStatus(testBillingAfterInsert.payment_status) : '',
      item_subtotal: testItemAfterInsert ? toAmount(testItemAfterInsert.subtotal) : null
    };

    addCheck('DRAFT_BILLING_READBACK_OK',
      testBillingAfterInsert &&
        normalizeKey(testBillingAfterInsert.billing_id) === testBillingId &&
        normalizeKey(testBillingAfterInsert.billing_number) === testBillingNumber &&
        toAmount(testBillingAfterInsert.grand_total) === testAmount &&
        toAmount(testBillingAfterInsert.paid_total) === 0 &&
        toAmount(testBillingAfterInsert.outstanding_total) === testAmount &&
        normalizeStatus(testBillingAfterInsert.payment_status) === 'unpaid' &&
        normalizeStatus(testBillingAfterInsert.billing_status) === 'draft',
      result.readback.after_insert
    );

    addCheck('DRAFT_BILLING_ITEM_READBACK_OK',
      testItemAfterInsert &&
        normalizeKey(testItemAfterInsert.billing_item_id) === testBillingItemId &&
        normalizeKey(testItemAfterInsert.billing_id) === testBillingId &&
        toAmount(testItemAfterInsert.qty) === 1 &&
        toAmount(testItemAfterInsert.unit_price) === testAmount &&
        toAmount(testItemAfterInsert.subtotal) === testAmount,
      result.readback.after_insert
    );

    addCheck('COUNTS_AFTER_DRAFT_BILLING_EXPECTED',
      result.mutation_counts.billings === 47 &&
        result.mutation_counts.billing_items === 100 &&
        result.mutation_counts.billing_adjustments === 1 &&
        result.mutation_counts.payments === 44,
      result.mutation_counts
    );

    addCheck('TOTALS_AFTER_DRAFT_BILLING_EXPECTED',
      result.mutation_totals.billings_subtotal === 15138000 &&
        result.mutation_totals.billings_discount_total === 100000 &&
        result.mutation_totals.billings_grand_total === 15038000 &&
        result.mutation_totals.billings_paid_total === 15035000 &&
        result.mutation_totals.billings_outstanding_total === 3000 &&
        result.mutation_totals.billing_items_subtotal === 15138000,
      result.mutation_totals
    );

    /*
     * Cleanup order: child first, then parent.
     */
    result.cleanup_billing_item_delete = compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLING_ITEMS,
      'billing_item_id',
      testBillingItemId,
      {
        stage: '7G'
      }
    ));

    addCheck('DRAFT_BILLING_ITEM_CLEANUP_DELETE_SUCCESS',
      result.cleanup_billing_item_delete.success === true &&
        result.cleanup_billing_item_delete.row_count === 1,
      result.cleanup_billing_item_delete
    );

    result.cleanup_billing_delete = compactMutationResult(dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.BILLINGS,
      'billing_id',
      testBillingId,
      {
        stage: '7G'
      }
    ));

    addCheck('DRAFT_BILLING_CLEANUP_DELETE_SUCCESS',
      result.cleanup_billing_delete.success === true &&
        result.cleanup_billing_delete.row_count === 1,
      result.cleanup_billing_delete
    );

    const testBillingAfterCleanup = FinanceRepository.findBillingById(testBillingId, supabaseOptions);
    const testItemAfterCleanup = findBillingItemById(testBillingItemId, supabaseOptions);
    const testItemsAfterCleanup = listBillingItemsByBillingId(testBillingId, supabaseOptions);
    const afterDatasets = loadFinanceDatasets(supabaseOptions);

    result.after_counts = buildCounts(afterDatasets);
    result.after_totals = buildTotals(afterDatasets);

    result.readback.after_cleanup = {
      billing_exists: !!testBillingAfterCleanup,
      billing_item_exists: !!testItemAfterCleanup,
      billing_item_count: testItemsAfterCleanup.length
    };

    addCheck('DRAFT_BILLING_BUNDLE_DELETED_AFTER_CLEANUP',
      !testBillingAfterCleanup &&
        !testItemAfterCleanup &&
        testItemsAfterCleanup.length === 0,
      result.readback.after_cleanup
    );

    addCheck('COUNTS_REVERTED_AFTER_DRAFT_BILLING_TEST',
      JSON.stringify(result.after_counts) === JSON.stringify(result.before_counts),
      {
        before: result.before_counts,
        after: result.after_counts
      }
    );

    addCheck('TOTALS_REVERTED_AFTER_DRAFT_BILLING_TEST',
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals),
      {
        before: result.before_totals,
        after: result.after_totals
      }
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-8-Finance-DraftBillingMutation',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'DRAFT_BILLING_MUTATION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      cleanup_warning: 'Jika error terjadi setelah insert parent/child, jangan lanjut. Jalankan read-back BIL-7G-TEST-001 dan BII-7G-TEST-001 sebelum cleanup manual.'
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}

function testFinancePhase7GFinalAuditLog() {
  const result = {
    success: true,
    stage: '7G-9-Finance-FinalAudit',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function' ? repoGetUiReadBackendMode_() : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null
    },
    baseline_counts: {},
    finance_totals: {},
    residue_check: {},
    schema_check: {},
    relationship_check: {},
    guard_check: {},
    checks_summary: {
      passed: 0,
      failed: 0
    },
    failed_checks: [],
    issue_count: 0,
    issues: []
  };

  function addCheck(name, success, details) {
    if (success) {
      result.checks_summary.passed++;
      return;
    }

    result.checks_summary.failed++;
    result.failed_checks.push({
      name: name,
      details: details || {}
    });

    result.issues.push({
      check: name,
      issue: 'CHECK_FAILED',
      details: details || {}
    });
  }

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toAmount(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount(rows, fieldName) {
    return roundAmount((rows || []).reduce(function(sum, row) {
      return sum + toAmount(row && row[fieldName]);
    }, 0));
  }

  function buildIndexByField(rows, fieldName) {
    const index = {};

    (rows || []).forEach(function(row) {
      const key = normalizeKey(row && row[fieldName]);
      if (!key) return;
      index[key] = row;
    });

    return index;
  }

  function loadFinanceDatasets(options) {
    return {
      billings: FinanceRepository.getBillingsRaw(options),
      billingItems: FinanceRepository.getBillingItemsRaw(options),
      billingAdjustments: FinanceRepository.getBillingAdjustmentsRaw(options),
      billingInstallments: FinanceRepository.getBillingInstallmentsRaw(options),
      payments: FinanceRepository.getPaymentsRaw(options),
      billingFeedbacks: FinanceRepository.getBillingFeedbacksRaw(options)
    };
  }

  function buildCounts(datasets, related) {
    return {
      billings: datasets.billings.length,
      billing_items: datasets.billingItems.length,
      billing_adjustments: datasets.billingAdjustments.length,
      billing_installments: datasets.billingInstallments.length,
      payments: datasets.payments.length,
      billing_feedbacks: datasets.billingFeedbacks.length,
      patients: related.patients.length,
      treatments: related.treatments.length,
      treatment_items: related.treatmentItems.length,
      appointments: related.appointments.length,
      service_catalog: related.services.length
    };
  }

  function buildTotals(datasets) {
    return {
      billings_subtotal: sumAmount(datasets.billings, 'subtotal'),
      billings_discount_total: sumAmount(datasets.billings, 'discount_total'),
      billings_grand_total: sumAmount(datasets.billings, 'grand_total'),
      billings_paid_total: sumAmount(datasets.billings, 'paid_total'),
      billings_outstanding_total: sumAmount(datasets.billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount(datasets.billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount(datasets.billingAdjustments, 'amount'),
      billing_installments_amount_due: sumAmount(datasets.billingInstallments, 'amount_due'),
      billing_installments_paid_amount: sumAmount(datasets.billingInstallments, 'paid_amount'),
      payments_amount: sumAmount(datasets.payments, 'amount')
    };
  }

  function checkSupabaseColumnExists(tableName, columnName) {
    const targetTable = typeof repoGetTargetTableForSheet_ === 'function'
      ? repoGetTargetTableForSheet_(tableName)
      : '';

    if (!targetTable) {
      return false;
    }

    const response = supabaseStagingSelect_(
      targetTable,
      {
        select: columnName,
        limit: 1
      },
      {}
    );

    return !!(response && response.success);
  }

  function findByField(rows, fieldName, value) {
    const target = normalizeKey(value);
    if (!target) return null;

    return (rows || []).find(function(row) {
      return normalizeKey(row && row[fieldName]) === target;
    }) || null;
  }

  function containsText(value, pattern) {
    return normalizeKey(value).indexOf(pattern) !== -1;
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('FLAGS_SAFE_DEFAULT_OFF',
      result.flags.default_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_backend_mode === 'spreadsheet' &&
        result.flags.ui_read_supabase_test_enabled === false &&
        result.flags.supabase_staging_write_test_enabled === false,
      result.flags
    );

    const datasets = loadFinanceDatasets(supabaseOptions);

    const related = {
      patients: dbFindAll_(REPO_TABLES.PATIENTS, supabaseOptions),
      treatments: dbFindAll_(REPO_TABLES.TREATMENTS, supabaseOptions),
      treatmentItems: dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, supabaseOptions),
      appointments: dbFindAll_(REPO_TABLES.APPOINTMENTS, supabaseOptions),
      services: dbFindAll_(REPO_TABLES.SERVICE_CATALOG, supabaseOptions)
    };

    result.baseline_counts = buildCounts(datasets, related);

    addCheck('BASELINE_COUNTS_MATCH_EXPECTED',
      result.baseline_counts.billings === 46 &&
        result.baseline_counts.billing_items === 99 &&
        result.baseline_counts.billing_adjustments === 1 &&
        result.baseline_counts.billing_installments === 0 &&
        result.baseline_counts.payments === 44 &&
        result.baseline_counts.billing_feedbacks === 0 &&
        result.baseline_counts.patients === 285 &&
        result.baseline_counts.treatments === 254 &&
        result.baseline_counts.treatment_items === 489 &&
        result.baseline_counts.appointments === 284 &&
        result.baseline_counts.service_catalog === 100,
      result.baseline_counts
    );

    result.finance_totals = buildTotals(datasets);

    addCheck('FINANCE_TOTALS_MATCH_EXPECTED',
      result.finance_totals.billings_subtotal === 15136500 &&
        result.finance_totals.billings_discount_total === 100000 &&
        result.finance_totals.billings_grand_total === 15036500 &&
        result.finance_totals.billings_paid_total === 15035000 &&
        result.finance_totals.billings_outstanding_total === 1500 &&
        result.finance_totals.billing_items_subtotal === 15136500 &&
        result.finance_totals.billing_adjustments_amount === 100000 &&
        result.finance_totals.billing_installments_amount_due === 0 &&
        result.finance_totals.billing_installments_paid_amount === 0 &&
        result.finance_totals.payments_amount === 15035000,
      result.finance_totals
    );

    const residue = {
      payment_exists: !!findByField(datasets.payments, 'payment_id', 'PAY-7G-TEST-001'),
      adjustment_exists: !!findByField(datasets.billingAdjustments, 'adjustment_id', 'ADJ-7G-TEST-001'),
      installment_1_exists: !!findByField(datasets.billingInstallments, 'installment_id', 'INS-7G-TEST-001'),
      installment_2_exists: !!findByField(datasets.billingInstallments, 'installment_id', 'INS-7G-TEST-002'),
      feedback_exists: !!findByField(datasets.billingFeedbacks, 'feedback_id', 'FBK-7G-TEST-001'),
      feedback_token_exists: !!findByField(datasets.billingFeedbacks, 'feedback_token', 'TOKEN-7G-TEST-001'),
      draft_billing_exists: !!findByField(datasets.billings, 'billing_id', 'BIL-7G-TEST-001'),
      draft_billing_item_exists: !!findByField(datasets.billingItems, 'billing_item_id', 'BII-7G-TEST-001')
    };

    const textResidues = {
      billings_test_7g_count: datasets.billings.filter(function(row) {
        return containsText(row.notes, 'TEST 7G') ||
          containsText(row.invoice_pdf_file_id, '7G') ||
          containsText(row.invoice_pdf_signature, '7G');
      }).length,
      billing_items_test_7g_count: datasets.billingItems.filter(function(row) {
        return containsText(row.billing_item_id, '7G') ||
          containsText(row.billing_id, '7G');
      }).length,
      adjustments_test_7g_count: datasets.billingAdjustments.filter(function(row) {
        return containsText(row.adjustment_id, '7G') ||
          containsText(row.reason, 'TEST 7G') ||
          containsText(row.label, 'TEST 7G');
      }).length,
      installments_test_7g_count: datasets.billingInstallments.filter(function(row) {
        return containsText(row.installment_id, '7G') ||
          containsText(row.notes, 'TEST 7G');
      }).length,
      payments_test_7g_count: datasets.payments.filter(function(row) {
        return containsText(row.payment_id, '7G') ||
          containsText(row.notes, 'TEST 7G') ||
          containsText(row.reference_no, '7G');
      }).length,
      feedbacks_test_7g_count: datasets.billingFeedbacks.filter(function(row) {
        return containsText(row.feedback_id, '7G') ||
          containsText(row.feedback_token, '7G') ||
          containsText(row.comment, 'TEST 7G');
      }).length
    };

    result.residue_check = Object.assign({}, residue, textResidues);

    addCheck('NO_7G_TEST_ROW_RESIDUE',
      Object.keys(result.residue_check).every(function(key) {
        return result.residue_check[key] === false || result.residue_check[key] === 0;
      }),
      result.residue_check
    );

    const expectedSchemaColumns = {
      BillingAdjustments: ['label'],
      BillingInstallments: ['amount_due', 'status', 'paid_at'],
      Payments: ['payment_scope'],
      BillingFeedbacks: [
        'feedback_id',
        'billing_id',
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
        'patient_name'
      ]
    };

    result.schema_check = {};

    Object.keys(expectedSchemaColumns).forEach(function(tableName) {
      result.schema_check[tableName] = {
        missing_columns: []
      };

      expectedSchemaColumns[tableName].forEach(function(columnName) {
        if (!checkSupabaseColumnExists(tableName, columnName)) {
          result.schema_check[tableName].missing_columns.push(columnName);
        }
      });
    });

    addCheck('FINANCE_SCHEMA_PATCHES_STILL_ALIGNED',
      Object.keys(result.schema_check).every(function(tableName) {
        return result.schema_check[tableName].missing_columns.length === 0;
      }),
      result.schema_check
    );

    const billingIndex = buildIndexByField(datasets.billings, 'billing_id');
    const patientIndex = buildIndexByField(related.patients, 'patient_id');
    const treatmentIndex = buildIndexByField(related.treatments, 'treatment_id');
    const treatmentItemIndex = buildIndexByField(related.treatmentItems, 'treatment_item_id');
    const appointmentIndex = buildIndexByField(related.appointments, 'appointment_id');
    const serviceIndex = buildIndexByField(related.services, 'service_id');

    const billingsMissingPatient = datasets.billings.filter(function(row) {
      const patientId = normalizeKey(row.patient_id);
      return patientId && !patientIndex[patientId];
    });

    const billingsMissingTreatment = datasets.billings.filter(function(row) {
      const treatmentId = normalizeKey(row.treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingsMissingAppointment = datasets.billings.filter(function(row) {
      const appointmentId = normalizeKey(row.appointment_id);
      return appointmentId && !appointmentIndex[appointmentId];
    });

    const billingItemsMissingBilling = datasets.billingItems.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const billingItemsMissingTreatment = datasets.billingItems.filter(function(row) {
      const treatmentId = normalizeKey(row.treatment_id);
      return treatmentId && !treatmentIndex[treatmentId];
    });

    const billingItemsMissingTreatmentItem = datasets.billingItems.filter(function(row) {
      const treatmentItemId = normalizeKey(row.treatment_item_id);
      return treatmentItemId && !treatmentItemIndex[treatmentItemId];
    });

    const billingItemsMissingService = datasets.billingItems.filter(function(row) {
      const serviceId = normalizeKey(row.service_id);
      return serviceId && !serviceIndex[serviceId];
    });

    const adjustmentsMissingBilling = datasets.billingAdjustments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const installmentsMissingBilling = datasets.billingInstallments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const paymentsMissingBilling = datasets.payments.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    const feedbacksMissingBilling = datasets.billingFeedbacks.filter(function(row) {
      const billingId = normalizeKey(row.billing_id);
      return billingId && !billingIndex[billingId];
    });

    result.relationship_check = {
      billings_missing_patient_count: billingsMissingPatient.length,
      billings_missing_treatment_count: billingsMissingTreatment.length,
      billings_missing_appointment_count: billingsMissingAppointment.length,
      billing_items_missing_billing_count: billingItemsMissingBilling.length,
      billing_items_missing_treatment_count: billingItemsMissingTreatment.length,
      billing_items_missing_treatment_item_count: billingItemsMissingTreatmentItem.length,
      billing_items_missing_service_count: billingItemsMissingService.length,
      adjustments_missing_billing_count: adjustmentsMissingBilling.length,
      installments_missing_billing_count: installmentsMissingBilling.length,
      payments_missing_billing_count: paymentsMissingBilling.length,
      feedbacks_missing_billing_count: feedbacksMissingBilling.length
    };

    addCheck('RELATIONSHIPS_MATCH_EXPECTED_WITH_KNOWN_ARTIFACTS',
      result.relationship_check.billings_missing_patient_count === 0 &&
        result.relationship_check.billings_missing_treatment_count === 1 &&
        result.relationship_check.billings_missing_appointment_count === 0 &&
        result.relationship_check.billing_items_missing_billing_count === 0 &&
        result.relationship_check.billing_items_missing_treatment_count === 1 &&
        result.relationship_check.billing_items_missing_treatment_item_count === 1 &&
        result.relationship_check.billing_items_missing_service_count === 0 &&
        result.relationship_check.adjustments_missing_billing_count === 0 &&
        result.relationship_check.installments_missing_billing_count === 0 &&
        result.relationship_check.payments_missing_billing_count === 0 &&
        result.relationship_check.feedbacks_missing_billing_count === 0,
      Object.assign({}, result.relationship_check, {
        expected_known_artifacts: {
          billings_missing_treatment_count: 1,
          billing_items_missing_treatment_count: 1,
          billing_items_missing_treatment_item_count: 1
        }
      })
    );

    let explicitInsertBlocked = false;
    let explicitUpdateBlocked = false;
    let explicitDeleteBlocked = false;

    try {
      dbSupabaseInsertStaging7A_(REPO_TABLES.BILLINGS, {
        billing_id: 'BIL-7G-FINAL-AUDIT-SHOULD-NOT-INSERT'
      }, {
        stage: '7G'
      });
    } catch (errInsert) {
      explicitInsertBlocked = true;
    }

    try {
      dbSupabaseUpdateByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', 'BIL-7G-FINAL-AUDIT-SHOULD-NOT-UPDATE', {
        notes: 'SHOULD NOT UPDATE 7G FINAL AUDIT'
      }, {
        stage: '7G'
      });
    } catch (errUpdate) {
      explicitUpdateBlocked = true;
    }

    try {
      dbSupabaseDeleteByIdStaging7A_(REPO_TABLES.BILLINGS, 'billing_id', 'BIL-7G-FINAL-AUDIT-SHOULD-NOT-DELETE', {
        stage: '7G'
      });
    } catch (errDelete) {
      explicitDeleteBlocked = true;
    }

    result.guard_check = {
      explicit_insert_default_off_blocked: explicitInsertBlocked,
      explicit_update_default_off_blocked: explicitUpdateBlocked,
      explicit_delete_default_off_blocked: explicitDeleteBlocked
    };

    addCheck('EXPLICIT_FINANCE_WRITES_DEFAULT_OFF_BLOCKED',
      explicitInsertBlocked && explicitUpdateBlocked && explicitDeleteBlocked,
      result.guard_check
    );

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7G-9-Finance-FinalAudit',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_7G_FINAL_AUDIT_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}