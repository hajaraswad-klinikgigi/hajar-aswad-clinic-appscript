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

function testFinanceRepositorySupabaseReadLog() {
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

