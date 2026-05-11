/* =========================================================
   FINANCE PAYMENT SERVICE
   Full payment, installment payment, payoff payment
   ========================================================= */

function validateBillingPaymentPayload(payload) {
  const errors = {};

  const billingId = String((payload && payload.billing_id) || '').trim();
  const paymentScope = String((payload && payload.payment_scope) || '').trim().toLowerCase();
  const installmentId = String((payload && payload.installment_id) || '').trim();
  const paymentDate = financeNormalizeDateOnlyYmd_((payload && payload.payment_date) || '');
  const paymentMethod = String((payload && payload.payment_method) || '').trim().toLowerCase();
  const amount = financeRoundAmount_((payload && payload.amount) || 0);
  const notes = String((payload && payload.notes) || '').trim();
  const referenceNo = String((payload && payload.reference_no) || '').trim();

  const allowedMethods = ['cash', 'transfer', 'qris', 'edc', 'other'];
  const allowedScopes = ['', 'full', 'installment', 'payoff'];

  if (!billingId) {
    errors.billing_id = 'Billing ID tidak ditemukan';
  }

  if (allowedScopes.indexOf(paymentScope) === -1) {
    errors.payment_scope = 'Jenis pembayaran tidak valid';
  }

  if (installmentId && installmentId.length > 100) {
    errors.installment_id = 'Installment ID tidak valid';
  }

  if (!paymentDate) {
    errors.payment_date = 'Tanggal pembayaran wajib diisi';
  } else if (!isValidYmdDate(paymentDate)) {
    errors.payment_date = 'Tanggal pembayaran tidak valid';
  }

  if (!paymentMethod) {
    errors.payment_method = 'Metode pembayaran wajib dipilih';
  } else if (allowedMethods.indexOf(paymentMethod) === -1) {
    errors.payment_method = 'Metode pembayaran tidak valid';
  }

  if (!amount || amount <= 0) {
    errors.amount = 'Nominal pembayaran harus lebih dari 0';
  }

  if (referenceNo.length > 100) {
    errors.reference_no = 'Nomor referensi maksimal 100 karakter';
  }

  if (notes.length > 255) {
    errors.notes = 'Catatan pembayaran maksimal 255 karakter';
  }

  return errors;
}

function findBillingInstallmentRawById_(installmentId) {
  const normalizedInstallmentId = String(installmentId || '').trim();

  if (!normalizedInstallmentId) return null;

  return getBillingInstallmentsRaw().find(function(row) {
    return String(row.installment_id || '').trim() === normalizedInstallmentId;
  }) || null;
}

function getPayableBillingInstallments_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    })
    .filter(function(row) {
      const status = String(row.status || '').trim().toLowerCase();
      const outstanding = Number(row.outstanding_amount || 0);

      return status !== 'paid' && outstanding > 0;
    });
}

function getNextPayableBillingInstallment_(billingId) {
  const rows = getPayableBillingInstallments_(billingId);
  return rows.length ? rows[0] : null;
}

function getBillingPaymentGuardData_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (typeof calculateBillingTotalsFromFreshContext_ === 'function') {
    return calculateBillingTotalsFromFreshContext_(normalizedBillingId);
  }

  const items = getBillingItemsByBillingIdRaw(normalizedBillingId);
  const adjustments = getBillingAdjustmentsByBillingIdRaw(normalizedBillingId);
  const payments = getPaymentsByBillingIdRaw(normalizedBillingId);
  const totals = calculateBillingTotalsFromRows(items, adjustments, payments);

  return {
    items: items,
    adjustments: adjustments,
    payments: payments,
    totals: totals
  };
}

function getBillingInstallmentTargetForPayment_(billingId, installmentId) {
  const normalizedBillingId = String(billingId || '').trim();
  const normalizedInstallmentId = String(installmentId || '').trim();

  recalculateBillingInstallmentPayments(normalizedBillingId);

  const installmentRows = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  if (!installmentRows.length) {
    return {
      success: false,
      message: 'Billing ini belum memiliki jadwal cicilan'
    };
  }

  let targetInstallment = null;

  if (normalizedInstallmentId) {
    targetInstallment = installmentRows.find(function(row) {
      return String(row.installment_id || '').trim() === normalizedInstallmentId;
    }) || null;
  } else {
    targetInstallment = installmentRows.find(function(row) {
      return String(row.status || '').trim().toLowerCase() !== 'paid' &&
        financeRoundAmount_(row.outstanding_amount) > 0;
    }) || null;
  }

  if (!targetInstallment) {
    return {
      success: false,
      message: 'Target cicilan tidak ditemukan'
    };
  }

  const status = String(targetInstallment.status || '').trim().toLowerCase();
  const outstandingAmount = financeRoundAmount_(targetInstallment.outstanding_amount);

  if (status === 'paid' || outstandingAmount <= 0) {
    return {
      success: false,
      message: 'Termin cicilan yang dipilih sudah lunas'
    };
  }

  return {
    success: true,
    data: {
      installment: targetInstallment,
      outstanding_amount: outstandingAmount
    }
  };
}

function getBillingPaymentModeSuggestion(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const billing = findBillingRawById(normalizedBillingId);

  if (!billing) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  const items = getBillingItemsByBillingIdRaw(normalizedBillingId);
  const adjustments = getBillingAdjustmentsByBillingIdRaw(normalizedBillingId);
  const payments = getPaymentsByBillingIdRaw(normalizedBillingId);
  const totals = calculateBillingTotalsFromRows(items, adjustments, payments);

  const installments = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  const nextInstallment = installments.find(function(row) {
    return String(row.status || '').trim().toLowerCase() !== 'paid' &&
      Number(row.outstanding_amount || 0) > 0;
  }) || null;

  return {
    success: true,
    data: {
      billing: normalizeFinanceRow(Object.assign({}, billing, totals)),
      has_installment_plan: installments.length > 0,
      installments: installments,
      next_installment: nextInstallment,
      suggested_amount: nextInstallment
        ? Math.min(Number(nextInstallment.outstanding_amount || 0), Number(totals.outstanding_total || 0))
        : Number(totals.outstanding_total || 0),
      billing_outstanding: Number(totals.outstanding_total || 0)
    }
  };
}

function appendBillingPaymentFast_(payment) {
  const sheetName = 'Payments';
  const row = payment || {};
  const sheet = getSheet(sheetName);

  if (!sheet) {
    return {
      success: false,
      message: 'Sheet Payments tidak ditemukan'
    };
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    return {
      success: false,
      message: 'Header Payments tidak ditemukan'
    };
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  const requiredHeaders = [
    'payment_id',
    'billing_id',
    'payment_scope',
    'installment_id',
    'payment_date',
    'payment_method',
    'amount',
    'reference_no',
    'received_by',
    'notes',
    'created_at',
    'updated_at'
  ];

  const missingHeaders = requiredHeaders.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    return {
      success: false,
      message: 'Header Payments tidak lengkap: ' + missingHeaders.join(', ')
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
    message: 'Pembayaran berhasil ditambahkan',
    data: {
      row_number: startRow
    }
  };
}

function buildBillingTotalsAfterNewPayment_(guardData, payment) {
  const source = guardData || {};

  const items = Array.isArray(source.items) ? source.items : [];
  const adjustments = Array.isArray(source.adjustments) ? source.adjustments : [];
  const payments = Array.isArray(source.payments)
    ? source.payments.slice()
    : [];

  if (payment) {
    payments.push(payment);
  }

  return calculateBillingTotalsFromRows(items, adjustments, payments);
}

function updateBillingTotalsAfterPaymentUnlocked_(billingId, billing, totals, updatedAt, options) {
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
    subtotal: financeRoundAmount_(result.subtotal),
    discount_total: financeRoundAmount_(result.discount_total),
    grand_total: financeRoundAmount_(result.grand_total),
    paid_total: financeRoundAmount_(result.paid_total),
    outstanding_total: financeRoundAmount_(result.outstanding_total),
    payment_status: String(result.payment_status || '').trim() || calculateBillingPaymentStatus(
      result.grand_total,
      result.paid_total
    ),
    updated_at: now
  };

  let invoiceStaleRes = null;

  if (opts.mark_invoice_stale === true) {
    const hasInvoiceArtifact = typeof hasFinanceBillingInvoiceArtifactForMutation_ === 'function'
      ? hasFinanceBillingInvoiceArtifactForMutation_(sourceBilling)
      : !!(
          String(sourceBilling.invoice_pdf_file_id || '').trim() ||
          String(sourceBilling.invoice_pdf_url || '').trim() ||
          String(sourceBilling.invoice_pdf_signature || '').trim() ||
          String(sourceBilling.invoice_sent_to || '').trim() ||
          String(sourceBilling.invoice_sent_at || '').trim()
        );

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

  const ok = dbUpdateById_('Billings', 'billing_id', normalizedBillingId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Pembayaran tersimpan, tetapi total billing gagal diperbarui'
    };
  }

  return {
    success: true,
    message: 'Total billing berhasil diperbarui setelah pembayaran',
    data: normalizeFinanceRow(Object.assign({}, sourceBilling, updated)),
    invoice_stale_update: invoiceStaleRes
  };
}

function shouldRecalculateInstallmentsAfterPayment_(billing, paymentScope, installmentId) {
  const data = billing || {};

  const scope = String(paymentScope || '').trim().toLowerCase();
  const normalizedInstallmentId = String(installmentId || '').trim();

  const paymentType = String(data.payment_type || '').trim().toLowerCase();
  const paymentTerms = String(data.payment_terms || '').trim().toLowerCase();

  return (
    scope === 'installment' ||
    scope === 'payoff' ||
    !!normalizedInstallmentId ||
    paymentType === 'installment' ||
    paymentTerms === 'installment'
  );
}

function buildBillingInstallmentPlanForPaymentResponse_(billing, recalculationRes) {
  const rows = recalculationRes && Array.isArray(recalculationRes.data)
    ? recalculationRes.data
    : [];

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

  const grandTotal = Number(billingData.grand_total || 0);
  const paidTotal = Number(billingData.paid_total || 0);
  const outstandingTotal = Math.max(0, grandTotal - paidTotal);

  return {
    billing: billingData,
    installments: installments,
    summary: {
      grand_total: grandTotal,
      paid_total: paidTotal,
      outstanding_total: outstandingTotal,
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

function recordBillingPayment(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'RECORD_BILLING_PAYMENT',
    module: 'FinancePaymentService',
    action: 'recordBillingPayment',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const permission = requireFinancePermission_(payload, 'record_billing_payment');

    if (!permission.success) {
      return permission;
    }

    const errors = validateBillingPaymentPayload(payload);

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

    if (!isBillingEditableStatus_(billing.billing_status)) {
      return {
        success: false,
        message: 'Billing yang sudah cancelled tidak bisa menerima pembayaran'
      };
    }

    const guardData = getBillingPaymentGuardData_(billingId);
    const currentTotals = guardData.totals || {};
    const amount = financeRoundAmount_(payload.amount);
    const outstandingTotal = financeRoundAmount_(currentTotals.outstanding_total);

    if (currentTotals.has_payment_overflow) {
      return {
        success: false,
        message: 'Data pembayaran billing sudah melebihi total tagihan. Jalankan audit/perbaikan data sebelum menambah pembayaran baru.'
      };
    }

    if (outstandingTotal <= 0) {
      return {
        success: false,
        message: 'Billing ini sudah lunas'
      };
    }

    if (amount > outstandingTotal + 0.01) {
      return {
        success: false,
        message: 'Nominal pembayaran tidak boleh melebihi sisa tagihan',
        errors: {
          amount: 'Sisa tagihan saat ini adalah ' + financeFormatCurrencyText_(outstandingTotal)
        }
      };
    }

    const rawPaymentScope = String(payload.payment_scope || '').trim().toLowerCase();
    let paymentScope = rawPaymentScope || 'full';
    let installmentId = String(payload.installment_id || '').trim();

    if (installmentId) {
      paymentScope = 'installment';
    }

    if (paymentScope === 'payoff') {
      installmentId = '';
    }

    if (paymentScope === 'installment') {
      const targetRes = getBillingInstallmentTargetForPayment_(billingId, installmentId);

      if (!targetRes || !targetRes.success) {
        return {
          success: false,
          message: (targetRes && targetRes.message) || 'Target cicilan tidak valid'
        };
      }

      const targetInstallment = targetRes.data.installment;
      const installmentOutstanding = financeRoundAmount_(targetRes.data.outstanding_amount);

      if (amount > installmentOutstanding + 0.01) {
        return {
          success: false,
          message: 'Nominal pembayaran cicilan tidak boleh melebihi sisa termin yang dipilih',
          errors: {
            amount: 'Sisa termin ini adalah ' + financeFormatCurrencyText_(installmentOutstanding)
          }
        };
      }

      installmentId = String(targetInstallment.installment_id || '').trim();
    } else {
      installmentId = '';
    }

    const now = nowIso();

    const payment = {
      payment_id: generateNextPaymentId(),
      billing_id: billingId,
      payment_scope: paymentScope,
      installment_id: installmentId,
      payment_date: financeNormalizeDateOnlyYmd_(payload.payment_date),
      payment_method: String(payload.payment_method || '').trim().toLowerCase(),
      amount: amount,
      reference_no: String(payload.reference_no || '').trim(),
      received_by: String(
        (permission.user && permission.user.user_id) ||
        payload.received_by ||
        payload.actor_user_id ||
        ''
      ).trim(),
      notes: String(payload.notes || '').trim(),
      created_at: now,
      updated_at: now
    };

    const appendPaymentRes = appendBillingPaymentFast_(payment);

    if (!appendPaymentRes || !appendPaymentRes.success) {
      return {
        success: false,
        message:
          (appendPaymentRes && appendPaymentRes.message) ||
          'Gagal menyimpan pembayaran'
      };
    }

    const nextTotals = buildBillingTotalsAfterNewPayment_(
      guardData,
      payment
    );

    const updateTotalsRes = updateBillingTotalsAfterPaymentUnlocked_(
      billingId,
      billing,
      nextTotals,
      now,
      {
        mark_invoice_stale: true,
        invoice_stale_reason: 'payment'
      }
    );

    if (!updateTotalsRes || !updateTotalsRes.success) {
      return {
        success: false,
        message:
          (updateTotalsRes && updateTotalsRes.message) ||
          'Pembayaran tersimpan, tetapi total billing gagal diperbarui'
      };
    }

    let latestBilling = Object.assign({}, billing, updateTotalsRes.data || {});
    const invoiceStaleRes = updateTotalsRes.invoice_stale_update || null;

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

    const shouldRefreshInstallmentPlan = shouldRecalculateInstallmentsAfterPayment_(
      latestBilling,
      paymentScope,
      installmentId
    );

    let installmentRecalcRes = null;
    let installmentPlan = null;

    if (
      shouldRefreshInstallmentPlan &&
      typeof recalculateBillingInstallmentPayments === 'function'
    ) {
      installmentRecalcRes = recalculateBillingInstallmentPayments(billingId);

      if (!installmentRecalcRes || !installmentRecalcRes.success) {
        return {
          success: false,
          message: 'Pembayaran tersimpan, tetapi sinkronisasi cicilan gagal: ' +
            ((installmentRecalcRes && installmentRecalcRes.message) || 'Unknown error'),
          data: {
            payment: normalizeFinanceRow(payment),
            billing: normalizeFinanceRow(latestBilling),
            installment_recalculation: installmentRecalcRes
          }
        };
      }

      installmentPlan = buildBillingInstallmentPlanForPaymentResponse_(
        latestBilling,
        installmentRecalcRes
      );
    }

    if (
      shouldRefreshInstallmentPlan &&
      !installmentPlan &&
      typeof getBillingInstallmentPlanForMutationResponse_ === 'function'
    ) {
      installmentPlan = getBillingInstallmentPlanForMutationResponse_(
        billingId,
        latestBilling,
        {
          force_installment_plan: true
        }
      );
    }

    return {
      success: true,
      message: 'Pembayaran berhasil dicatat',
      data: {
        payment: normalizeFinanceRow(payment),
        billing: normalizeFinanceRow(latestBilling),
        installment_plan: installmentPlan,
        installment_recalculation: installmentRecalcRes,
        invoice_stale_update: invoiceStaleRes
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat mencatat pembayaran: ' +
        (err && err.message ? err.message : err)
    };
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function createBillingPayment(payload) {
  return recordBillingPayment(payload);
}

function saveBillingPayment(payload) {
  return recordBillingPayment(payload);
}

function testCutoverPhase8BFinancePaymentFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-7-FinancePaymentService-FreezeGuard',
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
      default_off_record_payment_normal_flow_reached: false,
      simulated_freeze_record_payment_blocked: false,
      simulated_freeze_create_payment_wrapper_blocked: false,
      simulated_freeze_save_payment_wrapper_blocked: false,
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

  function getCounts_() {
    return {
      billings: getBillingsRaw().length,
      payments: getPaymentsRaw().length,
      billing_installments: getBillingInstallmentsRaw().length
    };
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

  function getTotals_() {
    const billings = getBillingsRaw();
    const payments = getPaymentsRaw();
    const installments = getBillingInstallmentsRaw();

    return {
      billings_paid_total: sumAmount_(billings, 'paid_total'),
      billings_outstanding_total: sumAmount_(billings, 'outstanding_total'),
      payments_amount: sumAmount_(payments, 'amount'),
      billing_installments_paid_amount: sumAmount_(installments, 'paid_amount')
    };
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
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

    const defaultOffRecord = recordBillingPayment({
      billing_id: '',
      payment_scope: '',
      installment_id: '',
      payment_date: '',
      payment_method: '',
      amount: 0,
      reference_no: '',
      notes: '',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.default_off_record_payment = defaultOffRecord && defaultOffRecord.message
      ? defaultOffRecord.message
      : '';

    result.checks.default_off_record_payment_normal_flow_reached = !!(
      defaultOffRecord &&
      defaultOffRecord.success === false &&
      (
        defaultOffRecord.message === 'Validasi gagal' ||
        defaultOffRecord.message === 'Billing ID tidak ditemukan' ||
        defaultOffRecord.message === 'Data billing tidak ditemukan' ||
        defaultOffRecord.message === 'Sesi login tidak ditemukan. Silakan login ulang.' ||
        String(defaultOffRecord.message || '').indexOf('Akses ditolak') !== -1 ||
        String(defaultOffRecord.message || '').indexOf('Tidak memiliki akses') !== -1 ||
        String(defaultOffRecord.message || '').indexOf('Sesi login') !== -1
      )
    );

    if (!result.checks.default_off_record_payment_normal_flow_reached) {
      addIssue('DEFAULT_OFF_RECORD_PAYMENT_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffRecord
      });
    }

    const simulatedFreezeRecord = recordBillingPayment({
      __test_freeze_enabled: true,
      billing_id: 'BIL-20260505-140855694-907',
      payment_scope: 'full',
      installment_id: '',
      payment_date: '2027-01-01',
      payment_method: 'cash',
      amount: 1000,
      reference_no: 'SHOULD-NOT-WRITE-8B',
      notes: 'SHOULD NOT WRITE 8B',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_record_payment = simulatedFreezeRecord && simulatedFreezeRecord.message
      ? simulatedFreezeRecord.message
      : '';

    result.checks.simulated_freeze_record_payment_blocked = isFreezeMessage_(simulatedFreezeRecord);

    if (!result.checks.simulated_freeze_record_payment_blocked) {
      addIssue('SIMULATED_FREEZE_RECORD_PAYMENT_NOT_BLOCKED', {
        response: simulatedFreezeRecord
      });
    }

    const simulatedFreezeCreateWrapper = createBillingPayment({
      __test_freeze_enabled: true,
      billing_id: 'BIL-20260505-140855694-907',
      payment_scope: 'full',
      payment_date: '2027-01-01',
      payment_method: 'cash',
      amount: 1000,
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_create_payment_wrapper = simulatedFreezeCreateWrapper && simulatedFreezeCreateWrapper.message
      ? simulatedFreezeCreateWrapper.message
      : '';

    result.checks.simulated_freeze_create_payment_wrapper_blocked = isFreezeMessage_(simulatedFreezeCreateWrapper);

    if (!result.checks.simulated_freeze_create_payment_wrapper_blocked) {
      addIssue('SIMULATED_FREEZE_CREATE_PAYMENT_WRAPPER_NOT_BLOCKED', {
        response: simulatedFreezeCreateWrapper
      });
    }

    const simulatedFreezeSaveWrapper = saveBillingPayment({
      __test_freeze_enabled: true,
      billing_id: 'BIL-20260505-140855694-907',
      payment_scope: 'full',
      payment_date: '2027-01-01',
      payment_method: 'cash',
      amount: 1000,
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_save_payment_wrapper = simulatedFreezeSaveWrapper && simulatedFreezeSaveWrapper.message
      ? simulatedFreezeSaveWrapper.message
      : '';

    result.checks.simulated_freeze_save_payment_wrapper_blocked = isFreezeMessage_(simulatedFreezeSaveWrapper);

    if (!result.checks.simulated_freeze_save_payment_wrapper_blocked) {
      addIssue('SIMULATED_FREEZE_SAVE_PAYMENT_WRAPPER_NOT_BLOCKED', {
        response: simulatedFreezeSaveWrapper
      });
    }

    result.after_counts = getCounts_();
    result.after_totals = getTotals_();

    result.checks.counts_unchanged =
      result.after_counts.billings === result.before_counts.billings &&
      result.after_counts.payments === result.before_counts.payments &&
      result.after_counts.billing_installments === result.before_counts.billing_installments;

    if (!result.checks.counts_unchanged) {
      addIssue('FINANCE_PAYMENT_COUNTS_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_counts,
        after: result.after_counts
      });
    }

    result.checks.totals_unchanged =
      result.after_totals.billings_paid_total === result.before_totals.billings_paid_total &&
      result.after_totals.billings_outstanding_total === result.before_totals.billings_outstanding_total &&
      result.after_totals.payments_amount === result.before_totals.payments_amount &&
      result.after_totals.billing_installments_paid_amount === result.before_totals.billing_installments_paid_amount;

    if (!result.checks.totals_unchanged) {
      addIssue('FINANCE_PAYMENT_TOTALS_CHANGED_DURING_FREEZE_GUARD_TEST', {
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
      stage: '8B-7-FinancePaymentService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_PAYMENT_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}