/* =========================================================
   PHASE 6G - FINANCE BILLING UI READ OPTIONS
   ========================================================= */

function getFinanceBillingUiReadOptions_(options) {
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

function getFinanceBillingUiReadBackendMode_(options) {
  const opts = getFinanceBillingUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function isFinanceBillingUiReadSupabaseMode_(options) {
  return getFinanceBillingUiReadBackendMode_(options) === 'supabase';
}

function getFinanceBillingSpreadsheetReadOptions_(options) {
  const opts = Object.assign({}, options || {});
  opts.backend_mode = 'spreadsheet';
  return opts;
}

/* =========================================================
   FINANCE BILLING SERVICE
   Billing core, finder, totals, read, create, discount
   ========================================================= */

/* =========================================================
   FINDERS
   ========================================================= */

function findBillingRawById(billingId, options) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return null;

  return getBillingsRaw(options).find(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  }) || null;
}

function findBillingRawByTreatmentId(treatmentId, options) {
  const normalizedTreatmentId = String(treatmentId || '').trim();

  if (!normalizedTreatmentId) return null;

  return getBillingsRaw(options).find(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  }) || null;
}

function getBillingItemsByBillingIdRaw(billingId, options) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getBillingItemsRaw(options).filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

function getBillingAdjustmentsByBillingIdRaw(billingId, options) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getBillingAdjustmentsRaw(options).filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

function getPaymentsByBillingIdRaw(billingId, options) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getPaymentsRaw(options).filter(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  });
}

/* =========================================================
   BILLING NUMBER
   ========================================================= */

function generateNextBillingNumber(billingDate) {
  const ymd = financeExtractYmd_(billingDate) || getFinanceTodayYmd_();
  const safeYmd = isValidYmdDate(ymd) ? ymd : getFinanceTodayYmd_();
  const compactDate = safeYmd.replace(/-/g, '');
  const prefix = 'INV-' + compactDate + '-';

  let maxNumber = 0;

  getBillingsRaw().forEach(function(row) {
    const billingNumber = String(row.billing_number || '').trim();

    if (billingNumber.indexOf(prefix) !== 0) return;

    const tail = billingNumber.replace(prefix, '');
    const num = Number(tail);

    if (!isNaN(num) && num > maxNumber) {
      maxNumber = num;
    }
  });

  return prefix + String(maxNumber + 1).padStart(4, '0');
}

/* =========================================================
   TOTALS
   ========================================================= */

function calculateBillingPaymentStatus(grandTotal, paidTotal) {
  const total = financeRoundAmount_(grandTotal);
  const paid = financeRoundAmount_(paidTotal);

  if (total <= 0) return 'paid';
  if (paid <= 0) return 'unpaid';
  if (paid + 0.01 >= total) return 'paid';

  return 'partial';
}

function calculateBillingTotalsFromRows(items, adjustments, payments) {
  const subtotal = financeRoundAmount_(
    (items || []).reduce(function(sum, item) {
      return sum + financeToAmount_(item.subtotal);
    }, 0)
  );

  const discountTotal = financeRoundAmount_(
    (adjustments || []).reduce(function(sum, adj) {
      const type = String(adj.adjustment_type || '').trim().toLowerCase();

      if (
        type === 'discount' ||
        type === 'manual_adjustment' ||
        type === 'voucher'
      ) {
        return sum + financeToAmount_(adj.amount);
      }

      return sum;
    }, 0)
  );

  const safeDiscountTotal = Math.min(discountTotal, subtotal);
  const grandTotal = Math.max(0, financeRoundAmount_(subtotal - safeDiscountTotal));

  const paidTotalRaw = financeRoundAmount_(
    (payments || []).reduce(function(sum, payment) {
      const paymentStatus = String(payment.payment_status || payment.status || '').trim().toLowerCase();

      if (paymentStatus === 'cancelled' || paymentStatus === 'void') {
        return sum;
      }

      return sum + financeToAmount_(payment.amount);
    }, 0)
  );

  const paidTotal = Math.min(paidTotalRaw, grandTotal);
  const outstandingTotal = Math.max(0, financeRoundAmount_(grandTotal - paidTotal));
  const paymentStatus = calculateBillingPaymentStatus(grandTotal, paidTotal);

  return {
    subtotal: subtotal,
    discount_total: safeDiscountTotal,
    grand_total: grandTotal,
    paid_total: paidTotal,
    outstanding_total: outstandingTotal,
    payment_status: paymentStatus,

    raw_discount_total: discountTotal,
    raw_paid_total: paidTotalRaw,
    has_discount_overflow: discountTotal > subtotal,
    has_payment_overflow: paidTotalRaw > grandTotal
  };
}

/* =========================================================
   TOTALS RAW CONTEXT HELPERS
   Request-scope helper untuk menghitung total billing tanpa
   membaca sheet items/adjustments/payments berulang kali.
   ========================================================= */

function buildBillingTotalsRawContext_(options) {
  if (typeof buildFinanceRawContext_ !== 'function') {
    return null;
  }

  return buildFinanceRawContext_(Object.assign({}, options || {}, {
    only: {
      billingItems: true,
      billingAdjustments: true,
      payments: true
    }
  }));
}

function getBillingTotalRowsFromContext_(ctx, billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      items: [],
      adjustments: [],
      payments: []
    };
  }

  if (
    ctx &&
    typeof getBillingItemsByBillingIdFromContext_ === 'function' &&
    typeof getBillingAdjustmentsByBillingIdFromContext_ === 'function' &&
    typeof getPaymentsByBillingIdFromContext_ === 'function'
  ) {
    return {
      items: getBillingItemsByBillingIdFromContext_(ctx, normalizedBillingId),
      adjustments: getBillingAdjustmentsByBillingIdFromContext_(ctx, normalizedBillingId),
      payments: getPaymentsByBillingIdFromContext_(ctx, normalizedBillingId)
    };
  }

  return {
    items: getBillingItemsByBillingIdRaw(normalizedBillingId),
    adjustments: getBillingAdjustmentsByBillingIdRaw(normalizedBillingId),
    payments: getPaymentsByBillingIdRaw(normalizedBillingId)
  };
}

function calculateBillingTotalsFromContext_(ctx, billingId) {
  const normalizedBillingId = String(billingId || '').trim();
  const sourceRows = getBillingTotalRowsFromContext_(ctx, normalizedBillingId);
  const totals = calculateBillingTotalsFromRows(
    sourceRows.items,
    sourceRows.adjustments,
    sourceRows.payments
  );

  return {
    items: sourceRows.items,
    adjustments: sourceRows.adjustments,
    payments: sourceRows.payments,
    totals: totals
  };
}

function calculateBillingTotalsFromFreshContext_(billingId, options) {
  const ctx = buildBillingTotalsRawContext_(options || {});

  return calculateBillingTotalsFromContext_(ctx, billingId);
}

function recalculateBillingTotalsUnlocked_(billingId, options) {
  const opts = options || {};
  const shouldRecalculateInstallments = opts.recalculate_installments !== false;

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  let billing = null;
  let totalsResult = null;

  if (
    typeof buildFinanceRawContext_ === 'function' &&
    typeof findBillingRawByIdFromContext_ === 'function' &&
    typeof calculateBillingTotalsFromContext_ === 'function'
  ) {
    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        billingItems: true,
        billingAdjustments: true,
        payments: true
      }
    });

    billing = findBillingRawByIdFromContext_(ctx, normalizedBillingId);
    totalsResult = calculateBillingTotalsFromContext_(ctx, normalizedBillingId);
  } else {
    billing = findBillingRawById(normalizedBillingId);

    const items = getBillingItemsByBillingIdRaw(normalizedBillingId);
    const adjustments = getBillingAdjustmentsByBillingIdRaw(normalizedBillingId);
    const payments = getPaymentsByBillingIdRaw(normalizedBillingId);

    totalsResult = {
      items: items,
      adjustments: adjustments,
      payments: payments,
      totals: calculateBillingTotalsFromRows(items, adjustments, payments)
    };
  }

  if (!billing) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  const totals = totalsResult && totalsResult.totals
    ? totalsResult.totals
    : calculateBillingTotalsFromRows([], [], []);

  const updated = {
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    grand_total: totals.grand_total,
    paid_total: totals.paid_total,
    outstanding_total: totals.outstanding_total,
    payment_status: totals.payment_status,
    updated_at: nowIso()
  };

  const ok = updateObjectById('Billings', 'billing_id', normalizedBillingId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal memperbarui total billing'
    };
  }

  if (
    shouldRecalculateInstallments &&
    typeof recalculateBillingInstallmentPayments === 'function'
  ) {
    recalculateBillingInstallmentPayments(normalizedBillingId);
  }

  const merged = Object.assign({}, billing, updated);

  return {
    success: true,
    message: 'Total billing berhasil dihitung ulang',
    data: normalizeFinanceRow(merged)
  };
}

function recalculateBillingTotals(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'RECALCULATE_BILLING_TOTALS',
    module: 'FinanceBillingService',
    action: 'recalculateBillingTotals',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const permission = requireFinancePermission_(payload, 'recalculate_billing_totals');

  if (!permission.success) {
    return permission;
  }

  const billingId = String(
    (payload && payload.billing_id) ||
    payload ||
    ''
  ).trim();

  return recalculateBillingTotalsUnlocked_(billingId);
}

/* =========================================================
   CREATE BILLING FROM TREATMENT
   ========================================================= */

function createDraftBillingFromTreatment(treatment, treatmentItems, options) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CREATE_DRAFT_BILLING_FROM_TREATMENT',
    module: 'FinanceBillingService',
    action: 'createDraftBillingFromTreatment',
    __test_freeze_enabled: options && options.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const opts = options || {};

  if (opts.internal_call !== true) {
    return {
      success: false,
      message: 'Akses langsung membuat draft billing tidak diizinkan.'
    };
  }

  const useLock = opts.use_lock !== false;
  const lock = useLock ? LockService.getScriptLock() : null;
  let locked = false;

  try {
    if (lock) {
      lock.waitLock(5000);
      locked = true;
    }

    return createDraftBillingFromTreatment_(treatment, treatmentItems);

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat membuat draft billing'
    };
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function createDraftBillingFromTreatment_(treatment, treatmentItems) {
  const treatmentId = String((treatment && treatment.treatment_id) || '').trim();
  const appointmentId = String((treatment && treatment.appointment_id) || '').trim();
  const patientId = String((treatment && treatment.patient_id) || '').trim();
  const patientName = String((treatment && treatment.patient_name) || '').trim();

  if (!treatmentId) {
    return {
      success: false,
      message: 'Treatment ID tidak ditemukan untuk membuat billing'
    };
  }

  if (!patientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan untuk membuat billing'
    };
  }

  const existingBilling = findBillingRawByTreatmentId(treatmentId);

  if (existingBilling) {
    const existingBillingId = String(existingBilling.billing_id || '').trim();

    return {
      success: true,
      message: 'Billing untuk treatment ini sudah ada',
      data: {
        billing: normalizeFinanceRow(existingBilling),
        items: getBillingItemsByBillingIdRaw(existingBillingId).map(normalizeFinanceRow),
        adjustments: getBillingAdjustmentsByBillingIdRaw(existingBillingId).map(normalizeFinanceRow),
        payments: getPaymentsByBillingIdRaw(existingBillingId).map(normalizeFinanceRow),
        installments: getBillingInstallmentRowsByBillingId(existingBillingId).map(normalizeBillingInstallmentForClient)
      }
    };
  }

  let sourceItems = Array.isArray(treatmentItems) ? treatmentItems : [];

  if (!sourceItems.length) {
    sourceItems = getTreatmentItemsRaw().filter(function(row) {
      return String(row.treatment_id || '').trim() === treatmentId;
    });
  }

  if (!sourceItems.length) {
    return {
      success: false,
      message: 'Item treatment tidak ditemukan untuk membuat billing'
    };
  }

  const billingDate = financeExtractYmd_((treatment && treatment.treatment_date) || '') || getFinanceTodayYmd_();
  const dueDate = billingDate;

  const subtotal = sourceItems.reduce(function(sum, item) {
    return sum + Number(item.subtotal || 0);
  }, 0);

  const billingId = generateNextBillingId();
  const now = nowIso();

  const billing = {
    billing_id: billingId,
    billing_number: generateNextBillingNumber(billingDate),
    treatment_id: treatmentId,
    appointment_id: appointmentId,
    patient_id: patientId,
    patient_name: patientName,
    billing_date: billingDate,
    due_date: dueDate,
    subtotal: subtotal,
    discount_total: 0,
    grand_total: subtotal,
    paid_total: 0,
    outstanding_total: subtotal,
    payment_status: subtotal > 0 ? 'unpaid' : 'paid',
    billing_status: 'draft',
    payment_type: 'full',
    payment_terms: 'full',
    notes: '',
    created_at: now,
    updated_at: now
  };

  appendObject('Billings', billing);

  const billingItems = sourceItems.map(function(item) {
    return {
      billing_item_id: generateNextBillingItemId(),
      billing_id: billingId,
      treatment_id: treatmentId,
      treatment_item_id: String(item.treatment_item_id || '').trim(),
      service_id: String(item.service_id || '').trim(),
      service_name: String(item.service_name || '').trim(),
      qty: Number(item.qty || 0),
      unit_price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal || 0),
      created_at: now,
      updated_at: now
    };
  });

  billingItems.forEach(function(item) {
    appendObject('BillingItems', item);
  });

  return {
    success: true,
    message: 'Draft billing berhasil dibuat',
    data: {
      billing: normalizeFinanceRow(billing),
      items: billingItems.map(normalizeFinanceRow),
      adjustments: [],
      payments: [],
      installments: []
    }
  };
}

function generateBillingFromTreatment(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'GENERATE_BILLING_FROM_TREATMENT',
    module: 'FinanceBillingService',
    action: 'generateBillingFromTreatment',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const permission = requireFinancePermission_(payload, 'generate_billing_from_treatment');

  if (!permission.success) {
    return permission;
  }

  const normalizedTreatmentId = String(
    (payload && payload.treatment_id) ||
    payload ||
    ''
  ).trim();

  if (!normalizedTreatmentId) {
    return {
      success: false,
      message: 'Treatment ID tidak ditemukan'
    };
  }

  const treatment = getTreatmentsRaw().find(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  });

  if (!treatment) {
    return {
      success: false,
      message: 'Treatment tidak ditemukan'
    };
  }

  const items = getTreatmentItemsRaw().filter(function(row) {
    return String(row.treatment_id || '').trim() === normalizedTreatmentId;
  });

  return createDraftBillingFromTreatment(treatment, items, {
    use_lock: true,
    internal_call: true
  });
}

/* =========================================================
   BILLING READ
   ========================================================= */

function getBillingByTreatmentId(treatmentId, options) {
  const opts = getFinanceBillingUiReadOptions_(options || {});
  const billing = findBillingRawByTreatmentId(treatmentId, opts);

  if (!billing) {
    return {
      success: false,
      message: 'Billing untuk treatment ini belum ditemukan'
    };
  }

  return getBillingByIdUnlocked_(billing.billing_id, Object.assign({}, opts, {
    recalculate: false
  }));
}

function sortBillingsForClient(rows) {
  return (rows || []).sort(function(a, b) {
    const dateCompare = String(b.billing_date || '').localeCompare(String(a.billing_date || ''));
    if (dateCompare !== 0) return dateCompare;

    const createdCompare = String(b.created_at || '').localeCompare(String(a.created_at || ''));
    if (createdCompare !== 0) return createdCompare;

    return String(b.billing_number || '').localeCompare(String(a.billing_number || ''));
  });
}

function getBillingList(payload) {
  const permission = requireFinancePermission_(payload, 'read_billing_list');

  if (!permission.success) {
    return permission;
  }

  const rows = getBillingsRaw(getFinanceBillingUiReadOptions_()).map(function(row) {
    return normalizeFinanceRow(row);
  });

  return {
    success: true,
    data: sortBillingsForClient(rows)
  };
}

function getBillingById(payload, options) {
  const permission = requireFinancePermission_(payload, 'read_billing_detail');

  if (!permission.success) {
    return permission;
  }

  const billingId = String((payload && payload.billing_id) || '').trim();

  return getBillingByIdUnlocked_(billingId, options || {});
}

function getBillingSuggestedEmailForDetail_(billing) {
  const data = billing || {};
  const patientId = String(data.patient_id || '').trim();

  if (!patientId) {
    return '';
  }

  if (typeof findFinancePatientEmail_ !== 'function') {
    return '';
  }

  return String(findFinancePatientEmail_(data, '') || '').trim();
}

function getBillingByIdUnlocked_(billingId, options) {
  const opts = getFinanceBillingUiReadOptions_(options || {});
  const isSupabaseReadMode = isFinanceBillingUiReadSupabaseMode_(opts);
  const shouldRecalculate = opts.recalculate !== false && !isSupabaseReadMode;

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  let billing = null;
  let ctx = null;

  if (typeof buildFinanceRawContext_ === 'function') {
    if (shouldRecalculate) {
      const billingCtx = buildFinanceRawContext_(Object.assign({}, opts, {
        only: {
          billings: true
        }
      }));

      billing = findBillingRawByIdFromContext_(billingCtx, normalizedBillingId);

      if (!billing) {
        return {
          success: false,
          message: 'Data billing tidak ditemukan'
        };
      }

      if (typeof recalculateBillingInstallmentPayments === 'function') {
        recalculateBillingInstallmentPayments(normalizedBillingId);
      }

      ctx = buildFinanceRawContext_(Object.assign({}, opts, {
        only: {
          billings: true,
          billingItems: true,
          billingAdjustments: true,
          payments: true,
          billingInstallments: true,
          billingFeedbacks: true
        }
      }));
    } else {
      ctx = buildFinanceRawContext_(Object.assign({}, opts, {
        only: {
          billings: true,
          billingItems: true,
          billingAdjustments: true,
          payments: true,
          billingInstallments: true,
          billingFeedbacks: true
        }
      }));

      billing = findBillingRawByIdFromContext_(ctx, normalizedBillingId);

      if (!billing) {
        return {
          success: false,
          message: 'Data billing tidak ditemukan'
        };
      }
    }

    const latestBilling = findBillingRawByIdFromContext_(ctx, normalizedBillingId) || billing;
    const feedback = findBillingFeedbackRawByBillingIdFromContext_(ctx, normalizedBillingId);
    const suggestedEmail = getBillingSuggestedEmailForDetail_(latestBilling);

    const normalizedBilling = normalizeFinanceRow(latestBilling);
    normalizedBilling.suggested_email = suggestedEmail;

    return {
      success: true,
      data: {
        billing: normalizedBilling,
        suggested_email: suggestedEmail,
        items: getBillingItemsByBillingIdFromContext_(ctx, normalizedBillingId).map(normalizeFinanceRow),
        adjustments: getBillingAdjustmentsByBillingIdFromContext_(ctx, normalizedBillingId).map(normalizeFinanceRow),
        payments: getPaymentsByBillingIdFromContext_(ctx, normalizedBillingId).map(normalizeFinanceRow),
        installments: getBillingInstallmentsByBillingIdFromContext_(ctx, normalizedBillingId).map(normalizeBillingInstallmentForClient),
        feedback: feedback ? normalizeFinanceRow(feedback) : null
      }
    };
  }

  billing = findBillingRawById(normalizedBillingId, opts);

  if (!billing) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  if (shouldRecalculate && typeof recalculateBillingInstallmentPayments === 'function') {
    recalculateBillingInstallmentPayments(normalizedBillingId);
  }

  const latestBilling = findBillingRawById(normalizedBillingId, opts) || billing;
  const feedbackRes = getBillingFeedbackByBillingId(normalizedBillingId);
  const suggestedEmail = getBillingSuggestedEmailForDetail_(latestBilling);

  const normalizedBilling = normalizeFinanceRow(latestBilling);
  normalizedBilling.suggested_email = suggestedEmail;

  return {
    success: true,
    data: {
      billing: normalizedBilling,
      suggested_email: suggestedEmail,
      items: getBillingItemsByBillingIdRaw(normalizedBillingId, opts).map(normalizeFinanceRow),
      adjustments: getBillingAdjustmentsByBillingIdRaw(normalizedBillingId, opts).map(normalizeFinanceRow),
      payments: getPaymentsByBillingIdRaw(normalizedBillingId, opts).map(normalizeFinanceRow),
      installments: getBillingInstallmentRowsByBillingId(normalizedBillingId).map(normalizeBillingInstallmentForClient),
      feedback: feedbackRes && feedbackRes.success ? feedbackRes.data : null
    }
  };
}

function isBillingEditableStatus_(billingStatus) {
  const status = String(billingStatus || '').trim().toLowerCase();
  return status !== 'cancelled';
}

function shouldReturnBillingInstallmentPlanAfterMutation_(billing, options) {
  const opts = options || {};
  const data = billing || {};

  if (opts.force_installment_plan === true) {
    return true;
  }

  const installmentSyncRes = opts.installment_sync || null;
  const installmentSyncData = installmentSyncRes && installmentSyncRes.data
    ? installmentSyncRes.data
    : null;

  if (installmentSyncData) {
    if (installmentSyncData.has_installment_plan === true) {
      return true;
    }

    if (
      Array.isArray(installmentSyncData.installments) &&
      installmentSyncData.installments.length > 0
    ) {
      return true;
    }
  }

  const paymentType = String(data.payment_type || '').trim().toLowerCase();
  const paymentTerms = String(data.payment_terms || '').trim().toLowerCase();

  return paymentType === 'installment' || paymentTerms === 'installment';
}

function getBillingInstallmentPlanForMutationResponse_(billingId, billing, options) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return null;
  }

  if (
    typeof getBillingInstallmentPlanUnlocked_ !== 'function' ||
    !shouldReturnBillingInstallmentPlanAfterMutation_(billing, options || {})
  ) {
    return null;
  }

  const installmentRes = getBillingInstallmentPlanUnlocked_(normalizedBillingId);

  if (installmentRes && installmentRes.success) {
    return installmentRes.data;
  }

  return null;
}

function hasFinanceBillingInvoiceArtifactForMutation_(billing) {
  const data = billing || {};

  return !!(
    String(data.invoice_pdf_file_id || '').trim() ||
    String(data.invoice_pdf_url || '').trim() ||
    String(data.invoice_pdf_signature || '').trim() ||
    String(data.invoice_sent_to || '').trim() ||
    String(data.invoice_sent_at || '').trim()
  );
}

function shouldSyncInstallmentsAfterDiscount_(billing) {
  const data = billing || {};

  const paymentType = String(data.payment_type || '').trim().toLowerCase();
  const paymentTerms = String(data.payment_terms || '').trim().toLowerCase();

  return paymentType === 'installment' || paymentTerms === 'installment';
}

function buildBillingTotalsAfterNewDiscount_(guardData, adjustment) {
  const source = guardData || {};

  const items = Array.isArray(source.items) ? source.items : [];
  const payments = Array.isArray(source.payments) ? source.payments : [];
  const adjustments = Array.isArray(source.adjustments)
    ? source.adjustments.slice()
    : [];

  if (adjustment) {
    adjustments.push(adjustment);
  }

  return calculateBillingTotalsFromRows(items, adjustments, payments);
}

function updateBillingTotalsAfterDiscountUnlocked_(billingId, billing, totals, updatedAt, options) {
  const opts = options || {};
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const result = totals || {};
  const sourceBilling = billing || {};
  const now = updatedAt || nowIso();

  const updated = {
    subtotal: result.subtotal,
    discount_total: result.discount_total,
    grand_total: result.grand_total,
    paid_total: result.paid_total,
    outstanding_total: result.outstanding_total,
    payment_status: result.payment_status,
    updated_at: now
  };

  let invoiceStaleRes = null;

  if (opts.mark_invoice_stale === true) {
    const hasInvoiceArtifact = hasFinanceBillingInvoiceArtifactForMutation_(sourceBilling);
    const currentInvoiceStatus = String(sourceBilling.invoice_delivery_status || '').trim().toLowerCase();

    if (hasInvoiceArtifact) {
      const shouldMarkStale = currentInvoiceStatus !== 'stale';

      if (shouldMarkStale) {
        updated.invoice_delivery_status = 'stale';
      }

      invoiceStaleRes = {
        success: true,
        message: shouldMarkStale
          ? 'Invoice ditandai stale karena data billing berubah'
          : 'Invoice sudah berstatus stale',
        data: {
          billing_id: normalizedBillingId,
          marked_stale: shouldMarkStale,
          reason: String(opts.invoice_stale_reason || ''),
          previous_invoice_delivery_status: String(sourceBilling.invoice_delivery_status || ''),
          invoice_delivery_status: 'stale'
        }
      };
    } else {
      invoiceStaleRes = {
        success: true,
        message: 'Billing belum memiliki invoice PDF/email, status invoice tidak perlu diubah',
        data: {
          billing_id: normalizedBillingId,
          marked_stale: false,
          invoice_delivery_status: String(sourceBilling.invoice_delivery_status || '')
        }
      };
    }
  }

  const ok = updateObjectById('Billings', 'billing_id', normalizedBillingId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Diskon tersimpan, tetapi total billing gagal diperbarui'
    };
  }

  return {
    success: true,
    message: 'Total billing berhasil diperbarui setelah diskon',
    data: normalizeFinanceRow(Object.assign({}, sourceBilling, updated)),
    invoice_stale_update: invoiceStaleRes
  };
}

function appendBillingAdjustmentForDiscountFast_(adjustment) {
  const sheetName = 'BillingAdjustments';
  const row = adjustment || {};
  const sheet = getSheet(sheetName);

  if (!sheet) {
    return {
      success: false,
      message: 'Sheet BillingAdjustments tidak ditemukan'
    };
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    return {
      success: false,
      message: 'Header BillingAdjustments tidak ditemukan'
    };
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  const requiredHeaders = [
    'adjustment_id',
    'billing_id',
    'adjustment_type',
    'label',
    'amount',
    'reason',
    'created_by',
    'created_at',
    'updated_at'
  ];

  const missingHeaders = requiredHeaders.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    return {
      success: false,
      message: 'Header BillingAdjustments tidak lengkap: ' + missingHeaders.join(', ')
    };
  }

  const startRow = sheet.getLastRow() + 1;

  const schema = typeof FINANCE_SHEETS_SCHEMA !== 'undefined'
    ? FINANCE_SHEETS_SCHEMA[sheetName]
    : null;

  if (schema) {
    const textColumns = schema.textColumns || [];
    const numberColumns = schema.numberColumns || [];

    textColumns.forEach(function(headerName) {
      const colIndex = headers.indexOf(headerName) + 1;

      if (colIndex > 0) {
        sheet.getRange(startRow, colIndex, 1, 1).setNumberFormat('@');
      }
    });

    numberColumns.forEach(function(headerName) {
      const colIndex = headers.indexOf(headerName) + 1;

      if (colIndex > 0) {
        sheet.getRange(startRow, colIndex, 1, 1).setNumberFormat('#,##0');
      }
    });
  }

  const values = headers.map(function(header) {
    if (!header) return '';

    if (!Object.prototype.hasOwnProperty.call(row, header)) {
      return '';
    }

    const value = row[header];

    if (value === null || value === undefined) {
      return '';
    }

    return value;
  });

  sheet.getRange(startRow, 1, 1, lastColumn).setValues([values]);

  return {
    success: true,
    message: 'Diskon berhasil ditambahkan',
    data: {
      row_number: startRow
    }
  };
}

function buildBillingInstallmentPlanFromSyncData_(billing, syncData) {
  const data = syncData || {};
  const rows = Array.isArray(data.installments) ? data.installments : [];

  if (!rows.length) {
    return null;
  }

  const billingData = normalizeFinanceRow(billing || {});

  const installments = rows.map(function(row) {
    return normalizeBillingInstallmentForClient(row);
  });

  const nextInstallment = installments.find(function(row) {
    return String(row.status || '').trim().toLowerCase() !== 'paid';
  }) || null;

  return {
    billing: billingData,
    installments: installments,
    summary: {
      grand_total: Number(billingData.grand_total || 0),
      paid_total: Number(billingData.paid_total || 0),
      outstanding_total: Number(billingData.outstanding_total || 0),
      installment_count: installments.length,
      next_due_date: nextInstallment ? nextInstallment.due_date : '',
      next_due_amount: nextInstallment
        ? Math.max(
            0,
            Number(nextInstallment.amount_due || 0) -
              Number(nextInstallment.paid_amount || 0)
          )
        : 0
    }
  };
}

/* =========================================================
   DISCOUNT
   ========================================================= */

function validateBillingDiscountPayload(payload) {
  const errors = {};

  const billingId = String((payload && payload.billing_id) || '').trim();
  const label = String((payload && payload.label) || '').trim();
  const amount = financeRoundAmount_((payload && payload.amount) || 0);
  const reason = String((payload && payload.reason) || '').trim();

  if (!billingId) {
    errors.billing_id = 'Billing ID tidak ditemukan';
  }

  if (!label) {
    errors.label = 'Label diskon wajib diisi';
  } else if (label.length > 100) {
    errors.label = 'Label diskon maksimal 100 karakter';
  }

  if (!amount || amount <= 0) {
    errors.amount = 'Nominal diskon harus lebih dari 0';
  }

  if (reason && reason.length > 255) {
    errors.reason = 'Alasan diskon maksimal 255 karakter';
  }

  return errors;
}

function getBillingDiscountGuardData_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  let result = null;

  if (typeof calculateBillingTotalsFromFreshContext_ === 'function') {
    result = calculateBillingTotalsFromFreshContext_(normalizedBillingId);
  } else {
    const items = getBillingItemsByBillingIdRaw(normalizedBillingId);
    const adjustments = getBillingAdjustmentsByBillingIdRaw(normalizedBillingId);
    const payments = getPaymentsByBillingIdRaw(normalizedBillingId);
    const totals = calculateBillingTotalsFromRows(items, adjustments, payments);

    result = {
      items: items,
      adjustments: adjustments,
      payments: payments,
      totals: totals
    };
  }

  const totals = result && result.totals ? result.totals : {};

  const subtotal = financeRoundAmount_(totals.subtotal);
  const discountTotal = financeRoundAmount_(totals.discount_total);
  const grandTotal = financeRoundAmount_(totals.grand_total);
  const paidTotal = financeRoundAmount_(totals.paid_total);
  const outstandingTotal = financeRoundAmount_(totals.outstanding_total);

  return {
    items: result.items || [],
    adjustments: result.adjustments || [],
    payments: result.payments || [],
    totals: totals,
    subtotal: subtotal,
    discount_total: discountTotal,
    grand_total: grandTotal,
    paid_total: paidTotal,
    outstanding_total: outstandingTotal,
    max_discount_allowed: outstandingTotal
  };
}

function validateBillingDiscountAgainstCurrentState_(billing, amount, guardData) {
  const errors = {};

  const billingStatus = String((billing && billing.billing_status) || '').trim().toLowerCase();
  const paymentStatus = String((billing && billing.payment_status) || '').trim().toLowerCase();

  const subtotal = financeRoundAmount_(guardData.subtotal);
  const grandTotal = financeRoundAmount_(guardData.grand_total);
  const paidTotal = financeRoundAmount_(guardData.paid_total);
  const outstandingTotal = financeRoundAmount_(guardData.outstanding_total);
  const maxDiscountAllowed = financeRoundAmount_(guardData.max_discount_allowed);

  if (billingStatus === 'cancelled') {
    errors.billing_status = 'Billing yang sudah cancelled tidak bisa diberi diskon';
    return errors;
  }

  if (guardData.totals && guardData.totals.has_discount_overflow) {
    errors.discount_total = 'Data diskon billing sudah melebihi subtotal. Jalankan audit/perbaikan data sebelum menambah diskon baru.';
  }

  if (guardData.totals && guardData.totals.has_payment_overflow) {
    errors.paid_total = 'Data pembayaran billing sudah melebihi total tagihan. Jalankan audit/perbaikan data sebelum menambah diskon baru.';
  }

  if (subtotal <= 0) {
    errors.subtotal = 'Subtotal billing tidak valid untuk diberi diskon';
  }

  if (grandTotal <= 0 || outstandingTotal <= 0 || paymentStatus === 'paid') {
    errors.amount = 'Billing ini sudah lunas, tidak bisa diberi diskon tambahan';
  }

  if (paidTotal > grandTotal + 0.01) {
    errors.paid_total = 'Paid total lebih besar dari grand total. Data perlu diaudit sebelum diskon ditambahkan.';
  }

  if (amount > maxDiscountAllowed + 0.01) {
    errors.amount = 'Nominal diskon tidak boleh melebihi sisa tagihan saat ini: ' +
      financeFormatCurrencyText_(maxDiscountAllowed);
  }

  return errors;
}

function updateBillingTotalsFromCalculatedTotalsUnlocked_(billingId, billing, totals) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const sourceTotals = totals || {};

  const updated = {
    subtotal: financeRoundAmount_(sourceTotals.subtotal),
    discount_total: financeRoundAmount_(sourceTotals.discount_total),
    grand_total: financeRoundAmount_(sourceTotals.grand_total),
    paid_total: financeRoundAmount_(sourceTotals.paid_total),
    outstanding_total: financeRoundAmount_(sourceTotals.outstanding_total),
    payment_status: String(sourceTotals.payment_status || '').trim() || calculateBillingPaymentStatus(
      sourceTotals.grand_total,
      sourceTotals.paid_total
    ),
    updated_at: nowIso()
  };

  const ok = updateObjectById('Billings', 'billing_id', normalizedBillingId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal memperbarui total billing'
    };
  }

  return {
    success: true,
    message: 'Total billing berhasil dihitung ulang',
    data: normalizeFinanceRow(Object.assign({}, billing || {}, updated))
  };
}

function shouldSyncInstallmentsAfterBillingTotalChangeFast_(billing) {
  const data = billing || {};
  const paymentType = String(data.payment_type || '').trim().toLowerCase();
  const paymentTerms = String(data.payment_terms || '').trim().toLowerCase();

  return paymentType === 'installment' || paymentTerms === 'installment';
}

function shouldSyncBillingInstallmentsAfterDiscount_(billing) {
  const data = billing || {};

  const paymentType = String(data.payment_type || '').trim().toLowerCase();
  const paymentTerms = String(data.payment_terms || '').trim().toLowerCase();

  return paymentType === 'installment' || paymentTerms === 'installment';
} 

function shouldMarkBillingInvoiceStaleFromBilling_(billing) {
  const data = billing || {};

  return !!(
    String(data.invoice_pdf_file_id || '').trim() ||
    String(data.invoice_pdf_url || '').trim() ||
    String(data.invoice_pdf_signature || '').trim() ||
    String(data.invoice_sent_to || '').trim() ||
    String(data.invoice_sent_at || '').trim()
  );
}

function addBillingDiscount(payload) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const permission = requireFinancePermission_(payload, 'add_billing_discount');

    if (!permission.success) {
      return permission;
    }

    const errors = validateBillingDiscountPayload(payload);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    const billingId = String(payload.billing_id || '').trim();
    const billing = findBillingRawById(billingId);

    if (!billing) {
      return {
        success: false,
        message: 'Data billing tidak ditemukan'
      };
    }

    const amount = financeRoundAmount_(payload.amount);
    const guardData = getBillingDiscountGuardData_(billingId);

    const stateErrors = validateBillingDiscountAgainstCurrentState_(
      billing,
      amount,
      guardData
    );

    if (Object.keys(stateErrors).length > 0) {
      return {
        success: false,
        message: 'Diskon tidak dapat ditambahkan',
        errors: stateErrors
      };
    }

    const now = nowIso();

    const adjustment = {
      adjustment_id: generateNextBillingAdjustmentId(),
      billing_id: billingId,
      adjustment_type: 'discount',
      label: String(payload.label || '').trim(),
      amount: amount,
      reason: String(payload.reason || '').trim(),
      created_by: String(
        (permission.user && permission.user.user_id) ||
        payload.created_by ||
        payload.actor_user_id ||
        ''
      ).trim(),
      created_at: now,
      updated_at: now
    };

    const appendAdjustmentRes = appendBillingAdjustmentForDiscountFast_(adjustment);

    if (!appendAdjustmentRes || !appendAdjustmentRes.success) {
      return {
        success: false,
        message:
          (appendAdjustmentRes && appendAdjustmentRes.message) ||
          'Gagal menyimpan diskon billing'
      };
    }

    const nextTotals = buildBillingTotalsAfterNewDiscount_(
      guardData,
      adjustment
    );

    const updateTotalsRes = updateBillingTotalsAfterDiscountUnlocked_(
      billingId,
      billing,
      nextTotals,
      now,
      {
        mark_invoice_stale: true,
        invoice_stale_reason: 'discount'
      }
    );

    if (!updateTotalsRes || !updateTotalsRes.success) {
      return {
        success: false,
        message:
          (updateTotalsRes && updateTotalsRes.message) ||
          'Diskon tersimpan, tetapi total billing gagal diperbarui'
      };
    }

    let latestBilling = Object.assign({}, billing, updateTotalsRes.data || {});
    let invoiceStaleRes = updateTotalsRes.invoice_stale_update || null;

    if (
      invoiceStaleRes &&
      invoiceStaleRes.success &&
      invoiceStaleRes.data &&
      Object.prototype.hasOwnProperty.call(invoiceStaleRes.data, 'invoice_delivery_status')
    ) {
      latestBilling.invoice_delivery_status = String(
        invoiceStaleRes.data.invoice_delivery_status || ''
      );
    }

    let installmentSyncRes = {
      success: true,
      message: 'Billing tidak memiliki jadwal cicilan',
      data: null
    };

    if (
      shouldSyncInstallmentsAfterDiscount_(latestBilling) &&
      typeof syncBillingInstallmentsAfterBillingTotalChange_ === 'function'
    ) {
      installmentSyncRes = syncBillingInstallmentsAfterBillingTotalChange_(billingId, {
        reason: 'discount'
      });

      if (!installmentSyncRes || !installmentSyncRes.success) {
        return {
          success: false,
          message: 'Diskon tersimpan, tetapi sinkronisasi cicilan gagal: ' +
            ((installmentSyncRes && installmentSyncRes.message) || 'Unknown error'),
          data: {
            adjustment: normalizeFinanceRow(adjustment),
            billing: normalizeFinanceRow(latestBilling),
            installment_sync: installmentSyncRes
          }
        };
      }
    }

    let installmentPlan = buildBillingInstallmentPlanFromSyncData_(
      latestBilling,
      installmentSyncRes.data || null
    );

    if (!installmentPlan) {
      installmentPlan = getBillingInstallmentPlanForMutationResponse_(
        billingId,
        latestBilling,
        {
          installment_sync: installmentSyncRes
        }
      );
    }

    return {
      success: true,
      message: 'Diskon billing berhasil ditambahkan',
      data: {
        adjustment: normalizeFinanceRow(adjustment),
        billing: normalizeFinanceRow(latestBilling),
        installment_sync: installmentSyncRes.data || null,
        installment_plan: installmentPlan,
        invoice_stale_update: invoiceStaleRes
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menambahkan diskon billing: ' +
        (err && err.message ? err.message : err)
    };
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function testFinanceBillingServicePhase6GUiReadLog() {
  const result = {
    success: true,
    stage: '6G-FinanceBillingService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getFinanceBillingUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    probe: {}
  };

  try {
    const opts = getFinanceBillingUiReadOptions_({
      recalculate: false
    });

    const billings = getBillingsRaw(opts);
    const firstBilling = billings.length ? billings[0] : null;
    const billingId = firstBilling ? String(firstBilling.billing_id || '').trim() : '';
    const treatmentId = firstBilling ? String(firstBilling.treatment_id || '').trim() : '';

    result.probe.billing_count = Array.isArray(billings) ? billings.length : -1;
    result.probe.first_billing_id = billingId;
    result.probe.first_treatment_id = treatmentId;

    if (!Array.isArray(billings)) {
      result.issues.push({
        issue: 'BILLINGS_NOT_ARRAY'
      });
    }

    if (!billingId) {
      result.issues.push({
        issue: 'NO_BILLING_SAMPLE_AVAILABLE'
      });
    }

    if (billingId) {
      const detail = getBillingByIdUnlocked_(billingId, Object.assign({}, opts, {
        recalculate: false
      }));

      result.probe.detail_success = !!(detail && detail.success);
      result.probe.detail_item_count = detail && detail.data && Array.isArray(detail.data.items)
        ? detail.data.items.length
        : -1;
      result.probe.detail_payment_count = detail && detail.data && Array.isArray(detail.data.payments)
        ? detail.data.payments.length
        : -1;

      if (!detail || !detail.success) {
        result.issues.push({
          billing_id: billingId,
          issue: 'GET_BILLING_DETAIL_FAILED',
          message: detail && detail.message ? detail.message : ''
        });
      }
    }

    if (treatmentId) {
      const byTreatment = getBillingByTreatmentId(treatmentId, Object.assign({}, opts, {
        recalculate: false
      }));

      result.probe.by_treatment_success = !!(byTreatment && byTreatment.success);

      if (!byTreatment || !byTreatment.success) {
        result.issues.push({
          treatment_id: treatmentId,
          issue: 'GET_BILLING_BY_TREATMENT_FAILED',
          message: byTreatment && byTreatment.message ? byTreatment.message : ''
        });
      }
    }

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
      stage: '6G-FinanceBillingService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testCutoverPhase8BFinanceBillingFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-10-FinanceBillingService-FreezeGuard',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
        ? repoGetUiReadBackendMode_()
        : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null,
      production_mutation_freeze_enabled: typeof repoIsProductionMutationFreezeEnabled_ === 'function'
        ? repoIsProductionMutationFreezeEnabled_()
        : null
    },
    before_counts: {},
    after_counts: {},
    before_totals: {},
    after_totals: {},
    checks: {
      default_off_recalculate_normal_flow_reached: false,
      default_off_generate_from_treatment_normal_flow_reached: false,
      default_off_create_draft_normal_flow_reached: false,
      simulated_freeze_recalculate_blocked: false,
      simulated_freeze_generate_from_treatment_blocked: false,
      simulated_freeze_create_draft_blocked: false,
      counts_unchanged: false,
      totals_unchanged: false
    },
    messages: {},
    issue_count: 0,
    issues: []
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({
      issue: issue
    }, details || {}));
  }

  function toAmount_(value) {
    if (typeof financeToAmount_ === 'function') return financeToAmount_(value);
    const num = Number(value || 0);
    return isFinite(num) ? num : 0;
  }

  function roundAmount_(value) {
    if (typeof financeRoundAmount_ === 'function') return financeRoundAmount_(value);
    return Math.round(Number(value || 0));
  }

  function sumAmount_(rows, fieldName) {
    return roundAmount_((rows || []).reduce(function(sum, row) {
      return sum + toAmount_(row && row[fieldName]);
    }, 0));
  }

  function getCounts_() {
    return {
      billings: getBillingsRaw().length,
      billing_items: getBillingItemsRaw().length,
      billing_adjustments: getBillingAdjustmentsRaw().length,
      payments: getPaymentsRaw().length
    };
  }

  function getTotals_() {
    const billings = getBillingsRaw();
    const billingItems = getBillingItemsRaw();
    const adjustments = getBillingAdjustmentsRaw();
    const payments = getPaymentsRaw();

    return {
      billings_subtotal: sumAmount_(billings, 'subtotal'),
      billings_discount_total: sumAmount_(billings, 'discount_total'),
      billings_grand_total: sumAmount_(billings, 'grand_total'),
      billings_paid_total: sumAmount_(billings, 'paid_total'),
      billings_outstanding_total: sumAmount_(billings, 'outstanding_total'),
      billing_items_subtotal: sumAmount_(billingItems, 'subtotal'),
      billing_adjustments_amount: sumAmount_(adjustments, 'amount'),
      payments_amount: sumAmount_(payments, 'amount')
    };
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );
  }

  function isNormalPermissionOrValidationMessage_(res) {
    const msg = String((res && res.message) || '');

    return !!(
      res &&
      res.success === false &&
      (
        msg === 'Billing ID tidak ditemukan' ||
        msg === 'Treatment ID tidak ditemukan' ||
        msg === 'Treatment tidak ditemukan' ||
        msg === 'Akses langsung membuat draft billing tidak diizinkan.' ||
        msg === 'Sesi login tidak ditemukan. Silakan login ulang.' ||
        msg.indexOf('Sesi login') !== -1 ||
        msg.indexOf('Akses ditolak') !== -1 ||
        msg.indexOf('Tidak memiliki akses') !== -1 ||
        msg.indexOf('Validasi gagal') !== -1
      )
    );
  }

  try {
    result.before_counts = getCounts_();
    result.before_totals = getTotals_();

    if (
      result.flags.default_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_supabase_test_enabled !== false ||
      result.flags.supabase_staging_write_test_enabled !== false ||
      result.flags.production_mutation_freeze_enabled !== false
    ) {
      addIssue('FLAGS_NOT_SAFE_DEFAULT_OFF', result.flags);
    }

    const defaultOffRecalculate = recalculateBillingTotals({
      billing_id: '',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.default_off_recalculate = defaultOffRecalculate && defaultOffRecalculate.message
      ? defaultOffRecalculate.message
      : '';

    result.checks.default_off_recalculate_normal_flow_reached =
      isNormalPermissionOrValidationMessage_(defaultOffRecalculate);

    if (!result.checks.default_off_recalculate_normal_flow_reached) {
      addIssue('DEFAULT_OFF_RECALCULATE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffRecalculate
      });
    }

    const defaultOffGenerateFromTreatment = generateBillingFromTreatment({
      treatment_id: '',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.default_off_generate_from_treatment = defaultOffGenerateFromTreatment && defaultOffGenerateFromTreatment.message
      ? defaultOffGenerateFromTreatment.message
      : '';

    result.checks.default_off_generate_from_treatment_normal_flow_reached =
      isNormalPermissionOrValidationMessage_(defaultOffGenerateFromTreatment);

    if (!result.checks.default_off_generate_from_treatment_normal_flow_reached) {
      addIssue('DEFAULT_OFF_GENERATE_FROM_TREATMENT_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffGenerateFromTreatment
      });
    }

    const defaultOffCreateDraft = createDraftBillingFromTreatment(
      {},
      [],
      {
        use_lock: false,
        internal_call: false
      }
    );

    result.messages.default_off_create_draft = defaultOffCreateDraft && defaultOffCreateDraft.message
      ? defaultOffCreateDraft.message
      : '';

    result.checks.default_off_create_draft_normal_flow_reached =
      isNormalPermissionOrValidationMessage_(defaultOffCreateDraft);

    if (!result.checks.default_off_create_draft_normal_flow_reached) {
      addIssue('DEFAULT_OFF_CREATE_DRAFT_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffCreateDraft
      });
    }

    const simulatedFreezeRecalculate = recalculateBillingTotals({
      __test_freeze_enabled: true,
      billing_id: 'BIL-20260505-140855694-907',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_recalculate = simulatedFreezeRecalculate && simulatedFreezeRecalculate.message
      ? simulatedFreezeRecalculate.message
      : '';

    result.checks.simulated_freeze_recalculate_blocked =
      isFreezeMessage_(simulatedFreezeRecalculate);

    if (!result.checks.simulated_freeze_recalculate_blocked) {
      addIssue('SIMULATED_FREEZE_RECALCULATE_NOT_BLOCKED', {
        response: simulatedFreezeRecalculate
      });
    }

    const simulatedFreezeGenerateFromTreatment = generateBillingFromTreatment({
      __test_freeze_enabled: true,
      treatment_id: 'TRX-0001',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_generate_from_treatment = simulatedFreezeGenerateFromTreatment && simulatedFreezeGenerateFromTreatment.message
      ? simulatedFreezeGenerateFromTreatment.message
      : '';

    result.checks.simulated_freeze_generate_from_treatment_blocked =
      isFreezeMessage_(simulatedFreezeGenerateFromTreatment);

    if (!result.checks.simulated_freeze_generate_from_treatment_blocked) {
      addIssue('SIMULATED_FREEZE_GENERATE_FROM_TREATMENT_NOT_BLOCKED', {
        response: simulatedFreezeGenerateFromTreatment
      });
    }

    const simulatedFreezeCreateDraft = createDraftBillingFromTreatment(
      {
        treatment_id: 'TRX-0001',
        appointment_id: 'APT-0001',
        patient_id: 'PAT-0001',
        patient_name: 'SHOULD NOT WRITE',
        treatment_date: '2027-01-01'
      },
      [
        {
          treatment_item_id: 'TRI-8B-SHOULD-NOT-WRITE',
          treatment_id: 'TRX-0001',
          service_id: 'SRV-001',
          service_name: 'SHOULD NOT WRITE',
          qty: 1,
          unit_price: 1000,
          subtotal: 1000
        }
      ],
      {
        use_lock: false,
        internal_call: true,
        __test_freeze_enabled: true
      }
    );

    result.messages.simulated_freeze_create_draft = simulatedFreezeCreateDraft && simulatedFreezeCreateDraft.message
      ? simulatedFreezeCreateDraft.message
      : '';

    result.checks.simulated_freeze_create_draft_blocked =
      isFreezeMessage_(simulatedFreezeCreateDraft);

    if (!result.checks.simulated_freeze_create_draft_blocked) {
      addIssue('SIMULATED_FREEZE_CREATE_DRAFT_NOT_BLOCKED', {
        response: simulatedFreezeCreateDraft
      });
    }

    result.after_counts = getCounts_();
    result.after_totals = getTotals_();

    result.checks.counts_unchanged =
      result.after_counts.billings === result.before_counts.billings &&
      result.after_counts.billing_items === result.before_counts.billing_items &&
      result.after_counts.billing_adjustments === result.before_counts.billing_adjustments &&
      result.after_counts.payments === result.before_counts.payments;

    if (!result.checks.counts_unchanged) {
      addIssue('FINANCE_BILLING_COUNTS_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_counts,
        after: result.after_counts
      });
    }

    result.checks.totals_unchanged =
      JSON.stringify(result.after_totals) === JSON.stringify(result.before_totals);

    if (!result.checks.totals_unchanged) {
      addIssue('FINANCE_BILLING_TOTALS_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_totals,
        after: result.after_totals
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-10-FinanceBillingService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_BILLING_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}