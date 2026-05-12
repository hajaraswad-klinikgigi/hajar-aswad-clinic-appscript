/* =========================================================
   FINANCE REPORT SERVICE
   Summary finance, laporan piutang, payment report, feedback summary hook
   ========================================================= */

function normalizePaymentForReport(row) {
  return {
    payment_id: String(row.payment_id || ''),
    billing_id: String(row.billing_id || ''),
    payment_scope: String(row.payment_scope || '').trim().toLowerCase(),
    installment_id: String(row.installment_id || ''),
    payment_date: financeExtractYmd_(row.payment_date),
    payment_method: String(row.payment_method || '').trim().toLowerCase(),
    amount: Number(row.amount || 0),
    reference_no: String(row.reference_no || ''),
    received_by: String(row.received_by || ''),
    notes: String(row.notes || ''),
    created_at: formatCellValue(row.created_at || '')
  };
}

function normalizeBillingForReport(row) {
  return {
    billing_id: String(row.billing_id || ''),
    billing_number: String(row.billing_number || ''),
    treatment_id: String(row.treatment_id || ''),
    appointment_id: String(row.appointment_id || ''),
    patient_id: String(row.patient_id || ''),
    patient_name: String(row.patient_name || ''),
    billing_date: financeExtractYmd_(row.billing_date),
    due_date: financeExtractYmd_(row.due_date),
    subtotal: Number(row.subtotal || 0),
    discount_total: Number(row.discount_total || 0),
    grand_total: Number(row.grand_total || 0),
    paid_total: Number(row.paid_total || 0),
    outstanding_total: Number(row.outstanding_total || 0),
    payment_status: String(row.payment_status || '').trim().toLowerCase(),
    billing_status: String(row.billing_status || '').trim().toLowerCase(),
    payment_type: String(row.payment_type || '').trim().toLowerCase(),
    payment_terms: String(row.payment_terms || '').trim().toLowerCase(),
    notes: String(row.notes || ''),
    created_at: formatCellValue(row.created_at || '')
  };
}

function normalizeBillingInstallmentForReceivableReport_(row) {
  const amountDue = financeRoundAmount_((row && row.amount_due) || 0);
  const paidAmount = financeRoundAmount_((row && row.paid_amount) || 0);
  const outstandingAmount = Math.max(0, financeRoundAmount_(amountDue - paidAmount));

  return {
    installment_id: String((row && row.installment_id) || '').trim(),
    billing_id: String((row && row.billing_id) || '').trim(),
    installment_no: Number((row && row.installment_no) || 0),
    due_date: financeNormalizeDateOnlyYmd_((row && row.due_date) || ''),
    amount_due: amountDue,
    paid_amount: paidAmount,
    outstanding_amount: outstandingAmount,
    status: String((row && row.status) || '').trim().toLowerCase(),
    paid_at: formatCellValue((row && row.paid_at) || ''),
    created_at: formatCellValue((row && row.created_at) || ''),
    updated_at: formatCellValue((row && row.updated_at) || '')
  };
}

function buildBillingInstallmentIndexForReceivableReport_(installmentsRaw) {
  const index = {};

  (installmentsRaw || []).forEach(function(row) {
    const normalized = normalizeBillingInstallmentForReceivableReport_(row);
    const billingId = String(normalized.billing_id || '').trim();

    if (!billingId) return;

    if (!index[billingId]) {
      index[billingId] = [];
    }

    index[billingId].push(normalized);
  });

  Object.keys(index).forEach(function(billingId) {
    index[billingId].sort(function(a, b) {
      const dueA = String(a.due_date || '9999-12-31');
      const dueB = String(b.due_date || '9999-12-31');

      const dueCompare = dueA.localeCompare(dueB);
      if (dueCompare !== 0) return dueCompare;

      return Number(a.installment_no || 0) - Number(b.installment_no || 0);
    });
  });

  return index;
}

function isFinanceReceivableInstallmentBilling_(billing) {
  const data = billing || {};
  const paymentType = String(data.payment_type || '').trim().toLowerCase();
  const paymentTerms = String(data.payment_terms || '').trim().toLowerCase();

  return paymentType === 'installment' || paymentTerms === 'installment';
}

function getNextReceivableInstallmentForBilling_(billing, installmentIndex) {
  const billingId = String((billing && billing.billing_id) || '').trim();

  if (!billingId || !installmentIndex || !installmentIndex[billingId]) {
    return null;
  }

  const rows = installmentIndex[billingId] || [];

  return rows.find(function(row) {
    const status = String(row.status || '').trim().toLowerCase();
    const outstanding = financeRoundAmount_(row.outstanding_amount);

    return status !== 'paid' && outstanding > 0;
  }) || null;
}

function getReceivableDueInfoForBilling_(billing, installmentIndex) {
  const data = billing || {};
  const billingDueDate = financeNormalizeDateOnlyYmd_(data.due_date || '');
  const isInstallmentBilling = isFinanceReceivableInstallmentBilling_(data);
  const nextInstallment = isInstallmentBilling
    ? getNextReceivableInstallmentForBilling_(data, installmentIndex)
    : null;

  if (nextInstallment && nextInstallment.due_date) {
    return {
      due_date: nextInstallment.due_date,
      billing_due_date: billingDueDate,
      is_installment_receivable: true,
      receivable_installment_id: String(nextInstallment.installment_id || ''),
      receivable_installment_no: Number(nextInstallment.installment_no || 0),
      receivable_installment_amount_due: Number(nextInstallment.amount_due || 0),
      receivable_installment_paid_amount: Number(nextInstallment.paid_amount || 0),
      receivable_installment_outstanding: Number(nextInstallment.outstanding_amount || 0)
    };
  }

  return {
    due_date: billingDueDate,
    billing_due_date: billingDueDate,
    is_installment_receivable: isInstallmentBilling,
    receivable_installment_id: '',
    receivable_installment_no: 0,
    receivable_installment_amount_due: 0,
    receivable_installment_paid_amount: 0,
    receivable_installment_outstanding: 0
  };
}

function applyFinanceReceivableStatusFields_(row, today) {
  const data = row || {};
  const todayYmd = financeNormalizeDateOnlyYmd_(today) || getFinanceTodayYmd_();
  const dueDate = financeNormalizeDateOnlyYmd_(data.due_date || '');

  let agingDays = 0;
  let receivableStatus = 'not_due';
  let agingBucket = 'Belum jatuh tempo';

  if (isValidYmdDate(dueDate)) {
    agingDays = financeDateDiffDays_(dueDate, todayYmd);

    if (agingDays > 30) {
      receivableStatus = 'overdue';
      agingBucket = '>30 hari';
    } else if (agingDays >= 8) {
      receivableStatus = 'overdue';
      agingBucket = '8-30 hari';
    } else if (agingDays >= 1) {
      receivableStatus = 'overdue';
      agingBucket = '1-7 hari';
    } else if (agingDays === 0 && dueDate === todayYmd) {
      receivableStatus = 'due_today';
      agingBucket = 'Jatuh tempo hari ini';
    }
  }

  data.aging_days = Math.max(0, agingDays);
  data.age_days = Math.max(0, agingDays);
  data.aging_bucket = agingBucket;
  data.receivable_status = receivableStatus;

  return data;
}

function compareFinanceReceivableReportRows_(a, b) {
  const rank = {
    overdue: 1,
    due_today: 2,
    not_due: 3
  };

  const rankCompare =
    (rank[String((a && a.receivable_status) || '')] || 9) -
    (rank[String((b && b.receivable_status) || '')] || 9);

  if (rankCompare !== 0) return rankCompare;

  const dueA = String((a && a.due_date) || '9999-12-31');
  const dueB = String((b && b.due_date) || '9999-12-31');

  const dueCompare = dueA.localeCompare(dueB);
  if (dueCompare !== 0) return dueCompare;

  return Number((b && b.outstanding_total) || 0) - Number((a && a.outstanding_total) || 0);
}

function buildFinanceReceivableRowsForReport_(billingsForReport, installmentsRaw, today) {
  const todayYmd = financeNormalizeDateOnlyYmd_(today) || getFinanceTodayYmd_();
  const installmentIndex = buildBillingInstallmentIndexForReceivableReport_(installmentsRaw || []);

  return (billingsForReport || [])
    .filter(function(row) {
      return String(row.billing_status || '').trim().toLowerCase() !== 'cancelled' &&
        Number(row.outstanding_total || 0) > 0;
    })
    .map(function(row) {
      const dueInfo = getReceivableDueInfoForBilling_(row, installmentIndex);

      const receivableRow = Object.assign({}, row, {
        billing_due_date: dueInfo.billing_due_date || row.due_date || '',
        receivable_due_date: dueInfo.due_date || row.due_date || '',
        due_date: dueInfo.due_date || row.due_date || '',

        is_installment_receivable: dueInfo.is_installment_receivable === true,
        receivable_installment_id: dueInfo.receivable_installment_id || '',
        receivable_installment_no: Number(dueInfo.receivable_installment_no || 0),
        receivable_installment_amount_due: Number(dueInfo.receivable_installment_amount_due || 0),
        receivable_installment_paid_amount: Number(dueInfo.receivable_installment_paid_amount || 0),
        receivable_installment_outstanding: Number(dueInfo.receivable_installment_outstanding || 0)
      });

      return applyFinanceReceivableStatusFields_(receivableRow, todayYmd);
    })
    .sort(compareFinanceReceivableReportRows_);
}

function getFinanceSummary(payload) {
  const permission = requireFinancePermission_(payload, 'read_finance_summary');

  if (!permission.success) {
    return permission;
  }

  const period = String((payload && payload.period) || 'today').trim().toLowerCase();
  const range = getFinanceDateRange(period || 'today');
  const startYmd = range.start;
  const endYmd = range.end;

  let billingsRaw = [];
  let paymentsRaw = [];
  let feedbacksRaw = [];

  if (typeof buildFinanceRawContext_ === 'function') {
    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        payments: true,
        billingFeedbacks: true
      }
    });

    billingsRaw = Array.isArray(ctx.billings) ? ctx.billings : [];
    paymentsRaw = Array.isArray(ctx.payments) ? ctx.payments : [];
    feedbacksRaw = Array.isArray(ctx.billingFeedbacks) ? ctx.billingFeedbacks : [];
  } else {
    billingsRaw = getBillingsRaw();
    paymentsRaw = getPaymentsRaw();
    feedbacksRaw = getBillingFeedbacksRaw();
  }

  const billings = billingsRaw.map(normalizeBillingForReport);
  const payments = paymentsRaw.map(normalizePaymentForReport);

  const billingById = {};

  billings.forEach(function(row) {
    billingById[String(row.billing_id || '')] = row;
  });

  const billingsInPeriod = billings.filter(function(row) {
    return financeIsDateBetweenYmd_(row.billing_date, startYmd, endYmd) &&
      row.billing_status !== 'cancelled';
  });

  const paymentsInPeriod = payments.filter(function(row) {
    return financeIsDateBetweenYmd_(row.payment_date, startYmd, endYmd);
  });

  const paymentMethodMap = {};

  paymentsInPeriod.forEach(function(payment) {
    const method = payment.payment_method || 'other';

    if (!paymentMethodMap[method]) {
      paymentMethodMap[method] = 0;
    }

    paymentMethodMap[method] += Number(payment.amount || 0);
  });

  const grossBilling = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.subtotal || 0);
  }, 0);

  const discountTotal = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.discount_total || 0);
  }, 0);

  const netBilling = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.grand_total || 0);
  }, 0);

  const cashIn = paymentsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.amount || 0);
  }, 0);

  const totalOutstandingAll = billings
    .filter(function(row) {
      return row.billing_status !== 'cancelled';
    })
    .reduce(function(sum, row) {
      return sum + Number(row.outstanding_total || 0);
    }, 0);

  const unpaidCount = billings.filter(function(row) {
    return row.billing_status !== 'cancelled' &&
      Number(row.outstanding_total || 0) > 0;
  }).length;

  const latestPayments = paymentsInPeriod
    .slice()
    .sort(function(a, b) {
      const dateCompare = String(b.payment_date || '').localeCompare(String(a.payment_date || ''));
      if (dateCompare !== 0) return dateCompare;

      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    })
    .slice(0, 10)
    .map(function(payment) {
      const billing = billingById[String(payment.billing_id || '')] || {};

      return Object.assign({}, payment, {
        billing_number: billing.billing_number || '',
        patient_id: billing.patient_id || '',
        patient_name: billing.patient_name || ''
      });
    });

  const feedbackSummary = buildBillingFeedbackSummaryForRange_(startYmd, endYmd, {
    feedbacks: feedbacksRaw
  });

  return {
    success: true,
    data: {
      period: range,
      kpi: {
        billing_count: billingsInPeriod.length,
        gross_billing: grossBilling,
        discount_total: discountTotal,
        net_billing: netBilling,
        cash_in: cashIn,
        outstanding_total: totalOutstandingAll,
        unpaid_billing_count: unpaidCount
      },
      payment_methods: paymentMethodMap,
      feedback_summary: feedbackSummary,
      latest_payments: latestPayments,
      latest_billings: billingsInPeriod
        .slice()
        .sort(function(a, b) {
          const dateCompare = String(b.billing_date || '').localeCompare(String(a.billing_date || ''));
          if (dateCompare !== 0) return dateCompare;

          return String(b.created_at || '').localeCompare(String(a.created_at || ''));
        })
        .slice(0, 10)
    }
  };
}

function getReceivablesReport(payload) {
  const permission = requireFinancePermission_(payload, 'read_receivables_report');

  if (!permission.success) {
    return permission;
  }

  const today = getFinanceTodayYmd_();

  let billingsRaw = [];
  let installmentsRaw = [];

  if (typeof buildFinanceRawContext_ === 'function') {
    const ctx = buildFinanceRawContext_({
      only: {
        billings: true,
        billingInstallments: true
      }
    });

    billingsRaw = Array.isArray(ctx.billings) ? ctx.billings : [];
    installmentsRaw = Array.isArray(ctx.billingInstallments) ? ctx.billingInstallments : [];
  } else {
    billingsRaw = getBillingsRaw();
    installmentsRaw = typeof getBillingInstallmentsRaw === 'function'
      ? getBillingInstallmentsRaw()
      : [];
  }

  const billingsForReport = billingsRaw.map(normalizeBillingForReport);
  const rows = buildFinanceReceivableRowsForReport_(
    billingsForReport,
    installmentsRaw,
    today
  );

  const summary = buildReceivablesSummary_(rows);

  return {
    success: true,
    data: {
      today: today,
      total_outstanding: summary.total_outstanding,
      total_rows: rows.length,
      summary: summary,
      bucket_summary: summary.bucket_summary,
      rows: rows
    }
  };
}

function getFinancePageBootstrap(payload) {
  const permission = requireFinancePermission_(payload, 'read_finance_summary');

  if (!permission.success) {
    return permission;
  }

  const period = String((payload && payload.period) || 'today').trim().toLowerCase();
  const range = getFinanceDateRange(period || 'today');
  const startYmd = range.start;
  const endYmd = range.end;
  const today = getFinanceTodayYmd_();

  const ctx = typeof buildFinanceRawContext_ === 'function'
    ? buildFinanceRawContext_({
        only: {
          billings: true,
          payments: true,
          billingFeedbacks: true,
          billingInstallments: true
        }
      })
    : null;

  const billingsRaw = ctx
    ? getFinanceRawContextRows_(ctx, 'billings')
    : getBillingsRaw();

  const paymentsRaw = ctx
    ? getFinanceRawContextRows_(ctx, 'payments')
    : getPaymentsRaw();

  const feedbacksRaw = ctx
    ? getFinanceRawContextRows_(ctx, 'billingFeedbacks')
    : getBillingFeedbacksRaw();

  const installmentsRaw = ctx
    ? getFinanceRawContextRows_(ctx, 'billingInstallments')
    : (
        typeof getBillingInstallmentsRaw === 'function'
          ? getBillingInstallmentsRaw()
          : []
      );

  const billingsForReport = billingsRaw.map(normalizeBillingForReport);
  const paymentsForReport = paymentsRaw.map(normalizePaymentForReport);

  const billingById = {};

  billingsForReport.forEach(function(row) {
    billingById[String(row.billing_id || '')] = row;
  });

  const billingsInPeriod = billingsForReport.filter(function(row) {
    return financeIsDateBetweenYmd_(row.billing_date, startYmd, endYmd) &&
      row.billing_status !== 'cancelled';
  });

  const paymentsInPeriod = paymentsForReport.filter(function(row) {
    return financeIsDateBetweenYmd_(row.payment_date, startYmd, endYmd);
  });

  const paymentMethodMap = {};

  paymentsInPeriod.forEach(function(payment) {
    const method = payment.payment_method || 'other';

    if (!paymentMethodMap[method]) {
      paymentMethodMap[method] = 0;
    }

    paymentMethodMap[method] += Number(payment.amount || 0);
  });

  const grossBilling = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.subtotal || 0);
  }, 0);

  const discountTotal = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.discount_total || 0);
  }, 0);

  const netBilling = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.grand_total || 0);
  }, 0);

  const cashIn = paymentsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.amount || 0);
  }, 0);

  const totalOutstandingAll = billingsForReport
    .filter(function(row) {
      return row.billing_status !== 'cancelled';
    })
    .reduce(function(sum, row) {
      return sum + Number(row.outstanding_total || 0);
    }, 0);

  const unpaidCount = billingsForReport.filter(function(row) {
    return row.billing_status !== 'cancelled' &&
      Number(row.outstanding_total || 0) > 0;
  }).length;

  const latestPayments = paymentsInPeriod
    .slice()
    .sort(function(a, b) {
      const dateCompare = String(b.payment_date || '').localeCompare(String(a.payment_date || ''));
      if (dateCompare !== 0) return dateCompare;

      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    })
    .slice(0, 10)
    .map(function(payment) {
      const billing = billingById[String(payment.billing_id || '')] || {};

      return Object.assign({}, payment, {
        billing_number: billing.billing_number || '',
        patient_id: billing.patient_id || '',
        patient_name: billing.patient_name || ''
      });
    });

  const feedbackSummary = buildBillingFeedbackSummaryForRange_(startYmd, endYmd, {
    feedbacks: feedbacksRaw
  });

  const latestBillings = billingsInPeriod
    .slice()
    .sort(function(a, b) {
      const dateCompare = String(b.billing_date || '').localeCompare(String(a.billing_date || ''));
      if (dateCompare !== 0) return dateCompare;

      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    })
    .slice(0, 10);

  const billingListRows = billingsRaw.map(function(row) {
    return normalizeFinanceRow(row);
  });

  const sortedBillingList = typeof sortBillingsForClient === 'function'
    ? sortBillingsForClient(billingListRows)
    : billingListRows.sort(function(a, b) {
        const dateCompare = String(b.billing_date || '').localeCompare(String(a.billing_date || ''));
        if (dateCompare !== 0) return dateCompare;

        const createdCompare = String(b.created_at || '').localeCompare(String(a.created_at || ''));
        if (createdCompare !== 0) return createdCompare;

        return String(b.billing_number || '').localeCompare(String(a.billing_number || ''));
      });

  const receivableRows = buildFinanceReceivableRowsForReport_(
    billingsForReport,
    installmentsRaw,
    today
  );

  const receivablesSummary = buildReceivablesSummary_(receivableRows);

  const summaryRes = {
    success: true,
    data: {
      period: range,
      kpi: {
        billing_count: billingsInPeriod.length,
        gross_billing: grossBilling,
        discount_total: discountTotal,
        net_billing: netBilling,
        cash_in: cashIn,
        outstanding_total: totalOutstandingAll,
        unpaid_billing_count: unpaidCount
      },
      payment_methods: paymentMethodMap,
      feedback_summary: feedbackSummary,
      latest_payments: latestPayments,
      latest_billings: latestBillings
    }
  };

  const billingsRes = {
    success: true,
    data: sortedBillingList
  };

  const receivablesRes = {
    success: true,
    data: {
      today: today,
      total_outstanding: receivablesSummary.total_outstanding,
      total_rows: receivableRows.length,
      summary: receivablesSummary,
      bucket_summary: receivablesSummary.bucket_summary,
      rows: receivableRows
    }
  };

  return {
    success: true,
    message: 'Data halaman Finance berhasil dimuat',
    data: {
      period: period,
      summary: summaryRes,
      billings: billingsRes,
      receivables: receivablesRes
    }
  };
}

function buildReceivablesSummary_(rows) {
  const list = Array.isArray(rows) ? rows : [];

  const summary = {
    receivable_count: list.length,
    total_outstanding: 0,
    overdue_count: 0,
    overdue_total: 0,
    due_today_count: 0,
    due_today_total: 0,
    not_due_count: 0,
    not_due_total: 0,
    bucket_summary: {
      'Belum jatuh tempo': 0,
      'Jatuh tempo hari ini': 0,
      '1-7 hari': 0,
      '8-30 hari': 0,
      '>30 hari': 0
    }
  };

  list.forEach(function(row) {
    const outstanding = Number(row.outstanding_total || 0);
    const status = String(row.receivable_status || '').trim().toLowerCase();
    const bucket = String(row.aging_bucket || 'Belum jatuh tempo').trim();

    summary.total_outstanding += outstanding;
    summary.bucket_summary[bucket] = (summary.bucket_summary[bucket] || 0) + outstanding;

    if (status === 'overdue') {
      summary.overdue_count++;
      summary.overdue_total += outstanding;
    } else if (status === 'due_today') {
      summary.due_today_count++;
      summary.due_today_total += outstanding;
    } else {
      summary.not_due_count++;
      summary.not_due_total += outstanding;
    }
  });

  return summary;
}

function getFinanceReportUiReadOptions_(options) {
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

function getFinanceReportUiReadBackendMode_(options) {
  const opts = getFinanceReportUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function testFinanceReportServiceReadLog() {
  const result = {
    success: true,
    stage: '6G-FinanceReportService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getFinanceReportUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    probe: {}
  };

  try {
    const opts = getFinanceReportUiReadOptions_();

    const ctx = buildFinanceRawContext_(Object.assign({}, opts, {
      only: {
        billings: true,
        payments: true,
        billingFeedbacks: true,
        billingInstallments: true
      }
    }));

    const billingsRaw = getFinanceRawContextRows_(ctx, 'billings');
    const paymentsRaw = getFinanceRawContextRows_(ctx, 'payments');
    const feedbacksRaw = getFinanceRawContextRows_(ctx, 'billingFeedbacks');
    const installmentsRaw = getFinanceRawContextRows_(ctx, 'billingInstallments');

    result.probe.counts = {
      billings: Array.isArray(billingsRaw) ? billingsRaw.length : -1,
      payments: Array.isArray(paymentsRaw) ? paymentsRaw.length : -1,
      billingFeedbacks: Array.isArray(feedbacksRaw) ? feedbacksRaw.length : -1,
      billingInstallments: Array.isArray(installmentsRaw) ? installmentsRaw.length : -1
    };

    if (!Array.isArray(billingsRaw)) result.issues.push({ issue: 'BILLINGS_NOT_ARRAY' });
    if (!Array.isArray(paymentsRaw)) result.issues.push({ issue: 'PAYMENTS_NOT_ARRAY' });
    if (!Array.isArray(feedbacksRaw)) result.issues.push({ issue: 'FEEDBACKS_NOT_ARRAY' });
    if (!Array.isArray(installmentsRaw)) result.issues.push({ issue: 'INSTALLMENTS_NOT_ARRAY' });

    const period = 'all';
    const range = getFinanceDateRange(period);
    const startYmd = range.start;
    const endYmd = range.end;
    const today = getFinanceTodayYmd_();

    const billingsForReport = billingsRaw.map(normalizeBillingForReport);
    const paymentsForReport = paymentsRaw.map(normalizePaymentForReport);

    const billingsInPeriod = billingsForReport.filter(function(row) {
      return financeIsDateBetweenYmd_(row.billing_date, startYmd, endYmd) &&
        row.billing_status !== 'cancelled';
    });

    const paymentsInPeriod = paymentsForReport.filter(function(row) {
      return financeIsDateBetweenYmd_(row.payment_date, startYmd, endYmd);
    });

    const totalOutstandingAll = billingsForReport
      .filter(function(row) {
        return row.billing_status !== 'cancelled';
      })
      .reduce(function(sum, row) {
        return sum + Number(row.outstanding_total || 0);
      }, 0);

    const receivableRows = buildFinanceReceivableRowsForReport_(
      billingsForReport,
      installmentsRaw,
      today
    );

    const receivablesSummary = buildReceivablesSummary_(receivableRows);

    result.probe.summary = {
      period: range,
      billing_count: billingsInPeriod.length,
      payment_count: paymentsInPeriod.length,
      outstanding_total: totalOutstandingAll,
      receivable_rows: receivableRows.length,
      receivable_total_outstanding: receivablesSummary.total_outstanding
    };

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
      stage: '6G-FinanceReportService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   OWNER REPORT — INTERNAL HELPERS
   ========================================================= */

function ownerFetchRawData_(startDate, endDate) {
  const opts = repoBuildUiReadOptions_({});
  return {
    billings:       getBillingsRaw(opts),
    payments:       getPaymentsRaw(opts),
    treatments:     getTreatmentsRaw(opts),
    treatmentItems: getTreatmentItemsRaw(opts),
    expenses:       dbFindAll_('Expenses', { backend_mode: 'supabase' })
  };
}

function ownerGetExpensesForRange_(startDate, endDate) {
  const all = dbFindAll_('Expenses', { backend_mode: 'supabase' });
  return ownerFilterExpensesForRange_(all, startDate, endDate);
}

function ownerFilterExpensesForRange_(allExpenses, startDate, endDate) {
  return allExpenses.filter(function(e) {
    const d = String(e.expense_date || '').slice(0, 10);
    return d >= startDate && d <= endDate;
  });
}

function ownerBuildExpenseSummary_(expenses) {
  const categories = ['doctor_salary','doctor_meal','doctor_standby','operational','utility','owner_withdrawal','other'];
  const byCategory = {};
  categories.forEach(function(c) { byCategory[c] = 0; });

  var total = 0;
  expenses.forEach(function(e) {
    const amt = Number(e.amount || 0);
    total += amt;
    const cat = String(e.category || 'other').trim();
    if (byCategory[cat] !== undefined) byCategory[cat] += amt;
    else byCategory['other'] += amt;
  });

  return { total_expense: total, by_category: byCategory };
}

// Fetch data dari Supabase sekali, kemudian filter untuk range tertentu (no additional API calls)
function ownerBuildRevenueForRange_(startDate, endDate) {
  const opts = repoBuildUiReadOptions_({});
  const rawData = {
    billings:       getBillingsRaw(opts),
    payments:       getPaymentsRaw(opts),
    treatments:     getTreatmentsRaw(opts),
    treatmentItems: getTreatmentItemsRaw(opts)
  };
  return ownerBuildRevenueFromRawData_(rawData, startDate, endDate);
}

// Core compute — tidak ada API call, semua dari pre-fetched data
function ownerBuildRevenueFromRawData_(rawData, startDate, endDate) {
  const billings = rawData.billings.filter(function(b) {
    const d = financeExtractYmd_(b.billing_date);
    return d >= startDate && d <= endDate && String(b.billing_status || '').trim().toLowerCase() !== 'cancelled';
  });

  const payments = rawData.payments.filter(function(p) {
    const d = financeExtractYmd_(p.payment_date);
    return d >= startDate && d <= endDate;
  });

  const treatments = rawData.treatments.filter(function(t) {
    const d = financeExtractYmd_(t.treatment_date);
    return d >= startDate && d <= endDate;
  });

  const treatmentIdSet = {};
  treatments.forEach(function(t) { treatmentIdSet[String(t.treatment_id || '')] = true; });

  const treatmentItems = rawData.treatmentItems.filter(function(ti) {
    return treatmentIdSet[String(ti.treatment_id || '')];
  });

  const totalBilling = billings.reduce(function(s, b) { return s + Number(b.grand_total || 0); }, 0);
  const totalCashIn  = payments.reduce(function(s, p) { return s + Number(p.amount || 0); }, 0);
  const patientCount = treatments.length;

  const billingByTreatmentId = {};
  billings.forEach(function(b) {
    billingByTreatmentId[String(b.treatment_id || '')] = b;
  });

  const paymentsByBillingId = {};
  payments.forEach(function(p) {
    const bid = String(p.billing_id || '');
    paymentsByBillingId[bid] = (paymentsByBillingId[bid] || 0) + Number(p.amount || 0);
  });

  const byDoctorMap = {};
  treatments.forEach(function(t) {
    const doc = String(t.doctor_name || 'Tidak diketahui').trim();
    const billing = billingByTreatmentId[String(t.treatment_id || '')];
    const billingId = billing ? String(billing.billing_id || '') : '';
    const cashIn = billingId ? (paymentsByBillingId[billingId] || 0) : 0;

    if (!byDoctorMap[doc]) {
      byDoctorMap[doc] = { doctor_name: doc, patient_count: 0, total_billing: 0, total_cash_in: 0 };
    }
    byDoctorMap[doc].patient_count++;
    byDoctorMap[doc].total_billing += billing ? Number(billing.grand_total || 0) : 0;
    byDoctorMap[doc].total_cash_in += cashIn;
  });

  const byServiceMap = {};
  treatmentItems.forEach(function(ti) {
    const name = String(ti.service_name || ti.item_name || 'Lainnya').trim();
    if (!byServiceMap[name]) {
      byServiceMap[name] = { service_name: name, count: 0, total: 0 };
    }
    byServiceMap[name].count += Number(ti.qty || 1);
    byServiceMap[name].total += Number(ti.subtotal || 0);
  });

  const byPaymentMethod = { cash: 0, transfer: 0, other: 0 };
  payments.forEach(function(p) {
    const method = String(p.payment_method || '').trim().toLowerCase();
    if (method === 'cash') byPaymentMethod.cash += Number(p.amount || 0);
    else if (method === 'transfer' || method === 'bank_transfer') byPaymentMethod.transfer += Number(p.amount || 0);
    else byPaymentMethod.other += Number(p.amount || 0);
  });

  return {
    total_billing:     totalBilling,
    total_cash_in:     totalCashIn,
    patient_count:     patientCount,
    by_doctor:         Object.values(byDoctorMap),
    by_service:        Object.values(byServiceMap),
    by_payment_method: byPaymentMethod
  };
}

function ownerMonthLabel_(year, month) {
  const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return names[month - 1] + ' ' + year;
}

function ownerCalcDiffPercent_(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/* =========================================================
   OWNER REPORT — LAPORAN HARIAN
   ========================================================= */

function getOwnerDailyReport(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const date = String((payload && payload.date) || formatTodayYmd()).trim();
    if (!date) return { success: false, message: 'Tanggal wajib diisi.' };

    const revenue  = ownerBuildRevenueForRange_(date, date);
    const expenses = ownerGetExpensesForRange_(date, date);
    const expSummary = ownerBuildExpenseSummary_(expenses);

    const piutangBillings = getBillingsRaw(repoBuildUiReadOptions_({})).filter(function(b) {
      const d = financeExtractYmd_(b.billing_date);
      return d === date &&
        String(b.billing_status || '').trim().toLowerCase() !== 'cancelled' &&
        Number(b.outstanding_total || 0) > 0;
    });
    const piutangBaru = piutangBillings.reduce(function(s, b) { return s + Number(b.outstanding_total || 0); }, 0);

    return {
      success: true,
      data: {
        date: date,
        revenue: Object.assign({ piutang_baru: piutangBaru }, revenue),
        expense: Object.assign({ items: expenses }, expSummary),
        net: {
          cash_in:       revenue.total_cash_in,
          total_expense: expSummary.total_expense,
          net_cash:      revenue.total_cash_in - expSummary.total_expense
        }
      }
    };

  } catch (err) {
    return { success: false, message: 'Gagal membuat laporan harian: ' + (err.message || err) };
  }
}

/* =========================================================
   OWNER REPORT — LAPORAN BULANAN
   ========================================================= */

function getOwnerMonthlyReport(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const year  = Number((payload && payload.year)  || new Date().getFullYear());
    const month = Number((payload && payload.month) || (new Date().getMonth() + 1));

    const startDate = year + '-' + String(month).padStart(2, '0') + '-01';
    const lastDay   = new Date(year, month, 0).getDate();
    const endDate   = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevStart = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-01';
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevEnd   = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-' + String(prevLastDay).padStart(2, '0');

    // Fetch semua data sekali — current + prev month dalam satu batch
    const rawData = ownerFetchRawData_(prevStart, endDate);

    const revenue    = ownerBuildRevenueFromRawData_(rawData, startDate, endDate);
    const expenses   = ownerFilterExpensesForRange_(rawData.expenses, startDate, endDate);
    const expSummary = ownerBuildExpenseSummary_(expenses);

    const prevRevenue    = ownerBuildRevenueFromRawData_(rawData, prevStart, prevEnd);
    const prevExpenses   = ownerFilterExpensesForRange_(rawData.expenses, prevStart, prevEnd);
    const prevExpSummary = ownerBuildExpenseSummary_(prevExpenses);

    const netCash     = revenue.total_cash_in - expSummary.total_expense;
    const prevNetCash = prevRevenue.total_cash_in - prevExpSummary.total_expense;

    // Daily breakdown — pure in-memory, no API calls
    const dailyBreakdown = [];
    for (var d = 1; d <= lastDay; d++) {
      const dayStr = year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const dayRev = ownerBuildRevenueFromRawData_(rawData, dayStr, dayStr);
      const dayExp = ownerBuildExpenseSummary_(ownerFilterExpensesForRange_(rawData.expenses, dayStr, dayStr));
      dailyBreakdown.push({
        date:    dayStr,
        revenue: dayRev.total_cash_in,
        expense: dayExp.total_expense,
        net:     dayRev.total_cash_in - dayExp.total_expense
      });
    }

    return {
      success: true,
      data: {
        period: { year: year, month: month, label: ownerMonthLabel_(year, month) },
        revenue: {
          total_billing:  revenue.total_billing,
          total_cash_in:  revenue.total_cash_in,
          patient_count:  revenue.patient_count
        },
        expense: {
          total_expense: expSummary.total_expense,
          by_category:   expSummary.by_category
        },
        net: {
          cash_in:       revenue.total_cash_in,
          total_expense: expSummary.total_expense,
          net_cash:      netCash
        },
        comparison: {
          prev_month: {
            revenue: prevRevenue.total_cash_in,
            expense: prevExpSummary.total_expense,
            net:     prevNetCash
          },
          diff_percent: {
            revenue: ownerCalcDiffPercent_(revenue.total_cash_in, prevRevenue.total_cash_in),
            expense: ownerCalcDiffPercent_(expSummary.total_expense, prevExpSummary.total_expense),
            net:     ownerCalcDiffPercent_(netCash, prevNetCash)
          }
        },
        by_doctor:       revenue.by_doctor,
        by_service:      revenue.by_service,
        daily_breakdown: dailyBreakdown
      }
    };

  } catch (err) {
    return { success: false, message: 'Gagal membuat laporan bulanan: ' + (err.message || err) };
  }
}

/* =========================================================
   OWNER REPORT — LAPORAN TAHUNAN
   ========================================================= */

function getOwnerYearlyReport(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const year = Number((payload && payload.year) || new Date().getFullYear());
    const startDate = year + '-01-01';
    const endDate   = year + '-12-31';

    // Fetch semua data sekali untuk seluruh tahun
    const rawData = ownerFetchRawData_(startDate, endDate);

    const revenue    = ownerBuildRevenueFromRawData_(rawData, startDate, endDate);
    const expenses   = ownerFilterExpensesForRange_(rawData.expenses, startDate, endDate);
    const expSummary = ownerBuildExpenseSummary_(expenses);

    // Monthly breakdown — pure in-memory, no API calls
    const monthlyBreakdown = [];
    for (var m = 1; m <= 12; m++) {
      const mStart = year + '-' + String(m).padStart(2, '0') + '-01';
      const mLastDay = new Date(year, m, 0).getDate();
      const mEnd   = year + '-' + String(m).padStart(2, '0') + '-' + String(mLastDay).padStart(2, '0');
      const mRev   = ownerBuildRevenueFromRawData_(rawData, mStart, mEnd);
      const mExp   = ownerBuildExpenseSummary_(ownerFilterExpensesForRange_(rawData.expenses, mStart, mEnd));
      monthlyBreakdown.push({
        month:   m,
        label:   ownerMonthLabel_(year, m),
        revenue: mRev.total_cash_in,
        expense: mExp.total_expense,
        net:     mRev.total_cash_in - mExp.total_expense
      });
    }

    return {
      success: true,
      data: {
        period:  { year: year },
        revenue: {
          total_billing: revenue.total_billing,
          total_cash_in: revenue.total_cash_in,
          patient_count: revenue.patient_count
        },
        expense: {
          total_expense: expSummary.total_expense,
          by_category:   expSummary.by_category
        },
        net: {
          cash_in:       revenue.total_cash_in,
          total_expense: expSummary.total_expense,
          net_cash:      revenue.total_cash_in - expSummary.total_expense
        },
        monthly_breakdown: monthlyBreakdown
      }
    };

  } catch (err) {
    return { success: false, message: 'Gagal membuat laporan tahunan: ' + (err.message || err) };
  }
}

/* =========================================================
   OWNER REPORT — BOOTSTRAP (semua data dalam 1 call)
   ========================================================= */


function getOwnerReportBootstrap(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const date  = String((payload && payload.date) || formatTodayYmd()).trim();
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    const daily   = getOwnerDailyReport(Object.assign({}, payload, { date: date }));
    const monthly = getOwnerMonthlyReport(Object.assign({}, payload, { year: year, month: month }));

    const piutangBillings = getBillingsRaw(repoBuildUiReadOptions_({})).filter(function(b) {
      return String(b.billing_status || '').trim().toLowerCase() !== 'cancelled' &&
        Number(b.outstanding_total || 0) > 0;
    });
    const totalPiutang = piutangBillings.reduce(function(s, b) { return s + Number(b.outstanding_total || 0); }, 0);

    return {
      success: true,
      data: {
        daily:           daily.success  ? daily.data  : null,
        monthly:         monthly.success ? monthly.data : null,
        total_piutang:   totalPiutang,
        piutang_count:   piutangBillings.length
      }
    };

  } catch (err) {
    return { success: false, message: 'Gagal bootstrap laporan owner: ' + (err.message || err) };
  }
}