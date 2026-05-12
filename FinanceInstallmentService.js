/* =========================================================
   FINANCE INSTALLMENT SERVICE
   Cicilan billing, jadwal termin, status cicilan, lock perubahan
   ========================================================= */

function getBillingInstallmentRowsByBillingId(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return [];

  return getBillingInstallmentsRaw()
    .filter(function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    })
    .sort(function(a, b) {
      const dueCompare = String(financeExtractYmd_(a.due_date || '')).localeCompare(String(financeExtractYmd_(b.due_date || '')));
      if (dueCompare !== 0) return dueCompare;

      return Number(a.installment_no || 0) - Number(b.installment_no || 0);
    });
}

function normalizeBillingInstallmentForClient(row) {
  const obj = normalizeFinanceRow(row || {});

  obj.installment_no = Number(obj.installment_no || 0);
  obj.amount_due = Number(obj.amount_due || 0);
  obj.paid_amount = Number(obj.paid_amount || 0);
  obj.outstanding_amount = Math.max(0, obj.amount_due - obj.paid_amount);

  return obj;
}

function getBillingGrandTotalForInstallment_(billing) {
  return Number(
    billing.grand_total ||
    billing.net_total ||
    billing.total_after_discount ||
    billing.total_amount ||
    0
  );
}

function getBillingPaidTotalForInstallment_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  return getBillingPaymentsForInstallmentRaw_()
    .filter(function(row) {
      return String(row.billing_id || '').trim() === normalizedBillingId;
    })
    .filter(function(row) {
      const status = String(row.payment_status || row.status || '').trim().toLowerCase();
      return status !== 'cancelled' && status !== 'void';
    })
    .reduce(function(sum, row) {
      return sum + Number(row.payment_amount || row.amount_paid || row.amount || 0);
    }, 0);
}

function deleteBillingInstallmentsByBillingId_(billingId, options) {
  const opts = options || {};
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return 0;
  }

  if (repoIsSupabaseBackendMode_()) {
    try {
      const existing = dbFindWhere_('BillingInstallments', function(row) {
        return String(row.billing_id || '').trim() === normalizedBillingId;
      });
      existing.forEach(function(row) {
        const id = String(row.installment_id || '').trim();
        if (id) dbDeleteById_('BillingInstallments', 'installment_id', id);
      });
      return existing.length;
    } catch (err) {
      return 0;
    }
  }

  const shouldEnsureSetup = opts.ensure_setup !== false;
  if (shouldEnsureSetup) {
    setupFinanceStage1Sheets();
  }

  const sheet = getSheet(getBillingInstallmentSheetName_());
  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) return 0;

  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  const billingIdCol = headers.indexOf('billing_id');

  if (billingIdCol === -1) {
    throw new Error('Kolom billing_id tidak ditemukan di BillingInstallments');
  }

  const targetRows = [];

  for (let r = 1; r < values.length; r++) {
    const rowBillingId = String(values[r][billingIdCol] || '').trim();

    if (rowBillingId === normalizedBillingId) {
      targetRows.push(r + 1); // row sheet asli, 1-based
    }
  }

  if (!targetRows.length) {
    return 0;
  }

  const ranges = [];
  let rangeStart = targetRows[0];
  let rangeEnd = targetRows[0];

  for (let i = 1; i < targetRows.length; i++) {
    const rowNumber = targetRows[i];

    if (rowNumber === rangeEnd + 1) {
      rangeEnd = rowNumber;
    } else {
      ranges.push({
        start: rangeStart,
        count: rangeEnd - rangeStart + 1
      });

      rangeStart = rowNumber;
      rangeEnd = rowNumber;
    }
  }

  ranges.push({
    start: rangeStart,
    count: rangeEnd - rangeStart + 1
  });

  let deleted = 0;

  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];

    if (range.count > 0) {
      sheet.deleteRows(range.start, range.count);
      deleted += range.count;
    }
  }

  return deleted;
}

function validateBillingInstallmentPlan_(payload, billing) {
  const errors = {};

  const billingId = String((payload && payload.billing_id) || '').trim();
  const installments = Array.isArray(payload.installments) ? payload.installments : [];

  if (!billingId) {
    errors.billing_id = 'Billing ID tidak ditemukan';
  }

  if (!billing) {
    errors.billing_id = 'Data billing tidak ditemukan';
  }

  if (billing && String(billing.billing_status || '').trim().toLowerCase() === 'cancelled') {
    errors.billing_status = 'Billing cancelled tidak bisa dibuatkan cicilan';
  }

  if (!installments.length) {
    errors.installments = 'Minimal satu termin wajib dibuat';
  }

  const grandTotal = getBillingGrandTotalForInstallment_(billing);
  let sumAmount = 0;

  installments.forEach(function(item, index) {
    const dueDate = financeNormalizeDateOnlyYmd_(item.due_date);
    const amountDue = financeRoundAmount_(item.amount_due);

    if (!dueDate) {
      errors['due_date_' + index] = 'Due date termin ke-' + (index + 1) + ' wajib diisi';
    } else if (!isValidYmdDate(dueDate)) {
      errors['due_date_' + index] = 'Due date termin ke-' + (index + 1) + ' tidak valid';
    }

    if (!amountDue || amountDue <= 0) {
      errors['amount_due_' + index] = 'Nominal termin ke-' + (index + 1) + ' harus lebih dari 0';
    }

    sumAmount += amountDue;
  });

  if (grandTotal <= 0) {
    errors.grand_total = 'Grand total billing tidak valid';
  }

  if (grandTotal > 0 && installments.length && Math.round(sumAmount) !== Math.round(grandTotal)) {
    errors.installments_total =
      'Total cicilan harus sama dengan grand total billing. Total cicilan: ' +
      sumAmount +
      ', grand total: ' +
      grandTotal;
  }

  return errors;
}

function buildBillingInstallmentRows_(payload) {
  const billingId = String(payload.billing_id || '').trim();
  const now = nowIso();

  return (payload.installments || []).map(function(item, index) {
    return {
      installment_id: generateNextBillingInstallmentId(),
      billing_id: billingId,
      installment_no: index + 1,
      due_date: financeNormalizeDateOnlyYmd_(item.due_date),
      amount_due: financeRoundAmount_(item.amount_due),
      paid_amount: 0,
      status: 'unpaid',
      paid_at: null,
      notes: String(item.notes || '').trim(),
      created_at: now,
      updated_at: now
    };
  });
}

function appendBillingInstallmentRowsBatch_(rows) {
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    return {
      success: true,
      message: 'Tidak ada row cicilan yang perlu ditambahkan',
      appended_rows: 0
    };
  }

  if (repoIsSupabaseBackendMode_()) {
    try {
      list.forEach(function(row) {
        dbInsert_('BillingInstallments', row);
      });
      return { success: true, message: 'Cicilan berhasil ditambahkan', appended_rows: list.length };
    } catch (err) {
      return { success: false, message: 'Gagal menyimpan cicilan: ' + (err && err.message ? err.message : String(err || '')) };
    }
  }

  const sheetName = getBillingInstallmentSheetName_();
  const sheet = getSheet(sheetName);
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    return {
      success: false,
      message: 'Header BillingInstallments tidak ditemukan'
    };
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  const requiredHeaders = [
    'installment_id',
    'billing_id',
    'installment_no',
    'due_date',
    'amount_due',
    'paid_amount',
    'status',
    'paid_at',
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
      message: 'Header BillingInstallments tidak lengkap: ' + missingHeaders.join(', ')
    };
  }

  const startRow = sheet.getLastRow() + 1;
  const values = list.map(function(row) {
    return headers.map(function(header) {
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
  });

  const schema = typeof FINANCE_SHEETS_SCHEMA !== 'undefined'
    ? FINANCE_SHEETS_SCHEMA[sheetName]
    : null;

  if (schema) {
    const textColumns = schema.textColumns || [];
    const numberColumns = schema.numberColumns || [];

    textColumns.forEach(function(headerName) {
      const colIndex = headers.indexOf(headerName) + 1;

      if (colIndex > 0) {
        sheet.getRange(startRow, colIndex, list.length, 1).setNumberFormat('@');
      }
    });

    numberColumns.forEach(function(headerName) {
      const colIndex = headers.indexOf(headerName) + 1;

      if (colIndex > 0) {
        sheet.getRange(startRow, colIndex, list.length, 1).setNumberFormat('#,##0');
      }
    });
  }

  sheet.getRange(startRow, 1, values.length, lastColumn).setValues(values);

  return {
    success: true,
    message: 'Rows cicilan berhasil ditambahkan secara batch',
    appended_rows: list.length,
    start_row: startRow
  };
}

function getBillingPaymentCount_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return 0;

  return getPaymentsByBillingIdRaw(normalizedBillingId).filter(function(row) {
    return Number(row.amount || 0) > 0;
  }).length;
}

function hasBillingPaymentHistory_(billingId) {
  return getBillingPaymentCount_(billingId) > 0;
}

function getBillingInstallmentChangePolicy(payload) {
  const permission = requireFinancePermission_(payload, 'read_billing_installment_change_policy');

  if (!permission.success) {
    return permission;
  }

  const billingId = String((payload && payload.billing_id) || '').trim();

  return getBillingInstallmentChangePolicyUnlocked_(billingId);
}

function getBillingInstallmentChangePolicyUnlocked_(billingId) {
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

  const billingStatus = String(billing.billing_status || '').trim().toLowerCase();
  const paymentCount = getBillingPaymentCount_(normalizedBillingId);
  const paidTotal = Number(billing.paid_total || 0);
  const outstandingTotal = Number(billing.outstanding_total || 0);
  const installments = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  let canEditPlan = true;
  let canClearPlan = true;
  let canCreatePlan = true;
  let reason = '';

  if (billingStatus === 'cancelled') {
    canEditPlan = false;
    canClearPlan = false;
    canCreatePlan = false;
    reason = 'Billing yang sudah cancelled tidak bisa diubah jadwal cicilannya';
  } else if (paymentCount > 0 || paidTotal > 0) {
    canEditPlan = false;
    canClearPlan = false;
    canCreatePlan = false;
    reason = 'Jadwal cicilan tidak bisa diubah karena billing sudah memiliki riwayat pembayaran';
  } else if (outstandingTotal <= 0) {
    canEditPlan = false;
    canClearPlan = false;
    canCreatePlan = false;
    reason = 'Billing sudah lunas';
  }

  return {
    success: true,
    data: {
      billing_id: normalizedBillingId,
      can_create_plan: canCreatePlan,
      can_edit_plan: canEditPlan,
      can_clear_plan: canClearPlan,
      has_installment_plan: installments.length > 0,
      payment_count: paymentCount,
      paid_total: paidTotal,
      outstanding_total: outstandingTotal,
      lock_reason: reason,
      installments: installments
    }
  };
}

function hasBillingInvoiceArtifactForInstallment_(billing) {
  const data = billing || {};

  return !!(
    String(data.invoice_pdf_file_id || '').trim() ||
    String(data.invoice_pdf_url || '').trim() ||
    String(data.invoice_pdf_signature || '').trim() ||
    String(data.invoice_sent_to || '').trim() ||
    String(data.invoice_sent_at || '').trim()
  );
}

function createOrReplaceBillingInstallmentPlan(payload) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const permission = requireFinancePermission_(payload, 'create_or_replace_billing_installment_plan');

    if (!permission.success) {
      return permission;
    }

    if (payload && payload.ensure_setup === true) {
      setupFinanceStage1Sheets();
    }

    const billingId = String((payload && payload.billing_id) || '').trim();
    const billing = findBillingRawById(billingId);
    const existingInstallments = getBillingInstallmentRowsByBillingId(billingId);
    const hasPaymentHistory =
      hasBillingPaymentHistory_(billingId) ||
      Number((billing && billing.paid_total) || 0) > 0;

    if (existingInstallments.length && hasPaymentHistory) {
      return {
        success: false,
        message: 'Jadwal cicilan tidak bisa diubah karena billing sudah memiliki riwayat pembayaran'
      };
    }

    if (!existingInstallments.length && hasPaymentHistory) {
      return {
        success: false,
        message: 'Jadwal cicilan tidak bisa dibuat karena billing sudah memiliki riwayat pembayaran'
      };
    }

    const errors = validateBillingInstallmentPlan_(payload, billing);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    deleteBillingInstallmentsByBillingId_(billingId, {
      ensure_setup: false
    });

    const rows = buildBillingInstallmentRows_(payload).map(function(row) {
      const amountDue = financeRoundAmount_(row.amount_due);
      const paidAmount = financeRoundAmount_(row.paid_amount);

      return Object.assign({}, row, {
        amount_due: amountDue,
        paid_amount: paidAmount,
        status: calculateInstallmentStatus_(row.due_date, amountDue, paidAmount),
        paid_at: null
      });
    });

    const appendRowsRes = appendBillingInstallmentRowsBatch_(rows);

    if (!appendRowsRes || !appendRowsRes.success) {
      return {
        success: false,
        message: (appendRowsRes && appendRowsRes.message) ||
          'Gagal menyimpan rows cicilan secara batch'
      };
    }

    const firstDueDate = rows.length
      ? financeNormalizeDateOnlyYmd_(rows[0].due_date)
      : '';

    const updatedAt = nowIso();

    const billingPatch = {
      payment_type: 'installment',
      payment_terms: 'installment',
      due_date: firstDueDate,
      updated_at: updatedAt
    };

    const billingUpdateOk = dbUpdateById_(
      getBillingSheetNameForInstallment_(),
      'billing_id',
      billingId,
      billingPatch
    );

    if (!billingUpdateOk) {
      return {
        success: false,
        message: 'Jadwal cicilan tersimpan, tetapi update metadata billing gagal'
      };
    }

    let latestBilling = Object.assign({}, billing, billingPatch);

    let invoiceStaleRes = null;

    if (
      typeof markBillingInvoiceStaleAfterDataChange_ === 'function' &&
      hasBillingInvoiceArtifactForInstallment_(billing)
    ) {
      invoiceStaleRes = markBillingInvoiceStaleAfterDataChange_(billingId, {
        reason: 'installment_plan'
      });

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
    }

    const normalizedInstallments = rows.map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

    const grandTotal = getBillingGrandTotalForInstallment_(latestBilling);
    const paidTotal = Number(latestBilling.paid_total || 0);
    const outstandingTotal = Math.max(0, grandTotal - paidTotal);

    const nextInstallment = normalizedInstallments.find(function(row) {
      return String(row.status || '').trim().toLowerCase() !== 'paid';
    }) || null;

    const recalculationRes = {
      success: true,
      message: 'Status cicilan dihitung langsung saat penyimpanan',
      data: normalizedInstallments,
      summary: {
        checked_rows: normalizedInstallments.length,
        updated_rows: 0,
        skipped_rows: normalizedInstallments.length
      }
    };

    return {
      success: true,
      message: 'Jadwal cicilan berhasil disimpan',
      data: {
        billing: normalizeFinanceRow(latestBilling),
        installments: normalizedInstallments,
        summary: {
          grand_total: grandTotal,
          paid_total: paidTotal,
          outstanding_total: outstandingTotal,
          installment_count: normalizedInstallments.length,
          next_due_date: nextInstallment ? nextInstallment.due_date : '',
          next_due_amount: nextInstallment
            ? Math.max(
                0,
                Number(nextInstallment.amount_due || 0) -
                  Number(nextInstallment.paid_amount || 0)
              )
            : 0
        },
        invoice_stale_update: invoiceStaleRes,
        recalculation: recalculationRes
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menyimpan jadwal cicilan: ' + (err && err.message ? err.message : err)
    };
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function clearBillingInstallmentPlan(payload) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const permission = requireFinancePermission_(payload, 'clear_billing_installment_plan');

    if (!permission.success) {
      return permission;
    }

    const billingId = String((payload && payload.billing_id) || '').trim();

    if (!billingId) {
      return {
        success: false,
        message: 'Billing ID tidak ditemukan'
      };
    }

    const billing = findBillingRawById(billingId);

    if (!billing) {
      return {
        success: false,
        message: 'Data billing tidak ditemukan'
      };
    }

    if (hasBillingPaymentHistory_(billingId) || Number(billing.paid_total || 0) > 0) {
      return {
        success: false,
        message: 'Jadwal cicilan tidak bisa dihapus karena billing sudah memiliki riwayat pembayaran'
      };
    }

    const deleted = deleteBillingInstallmentsByBillingId_(billingId, {
      ensure_setup: false
    });

    const fallbackDueDate =
      financeNormalizeDateOnlyYmd_(billing.billing_date || '') ||
      getFinanceTodayYmd_();

    const updatedAt = nowIso();

    const billingPatch = {
      payment_type: 'full',
      payment_terms: 'full',
      due_date: fallbackDueDate,
      updated_at: updatedAt
    };

    const billingUpdateOk = dbUpdateById_('Billings', 'billing_id', billingId, billingPatch);

    if (!billingUpdateOk) {
      return {
        success: false,
        message: 'Jadwal cicilan terhapus, tetapi update metadata billing gagal'
      };
    }

    let latestBilling = Object.assign({}, billing, billingPatch);

    let invoiceStaleRes = null;

    if (
      typeof markBillingInvoiceStaleAfterDataChange_ === 'function' &&
      hasBillingInvoiceArtifactForInstallment_(billing)
    ) {
      invoiceStaleRes = markBillingInvoiceStaleAfterDataChange_(billingId, {
        reason: 'installment_plan_cleared'
      });

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
    }

    return {
      success: true,
      message: 'Jadwal cicilan berhasil dihapus',
      data: {
        deleted_installments: deleted,
        billing: normalizeFinanceRow(latestBilling),
        invoice_stale_update: invoiceStaleRes
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menghapus jadwal cicilan: ' + (err && err.message ? err.message : err)
    };
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function calculateInstallmentStatus_(dueDate, amountDue, paidAmount) {
  const due = financeExtractYmd_(dueDate);
  const today = getFinanceTodayYmd_();

  const amount = Number(amountDue || 0);
  const paid = Number(paidAmount || 0);

  if (amount > 0 && paid >= amount) return 'paid';
  if (paid > 0 && paid < amount) return 'partial';

  if (due && due < today) return 'overdue';
  if (due && due === today) return 'due_today';

  return 'unpaid';
}

function recalculateBillingInstallmentPayments(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const rows = getBillingInstallmentRowsByBillingId(normalizedBillingId);

  if (!rows.length) {
    return {
      success: true,
      message: 'Billing belum memiliki jadwal cicilan',
      data: [],
      summary: {
        checked_rows: 0,
        updated_rows: 0,
        skipped_rows: 0
      }
    };
  }

  let remainingPaid = financeRoundAmount_(getBillingPaidTotalForInstallment_(normalizedBillingId));
  const updatedRows = [];
  const now = nowIso();

  let updatedCount = 0;
  let skippedCount = 0;

  rows.forEach(function(row) {
    const installmentId = String(row.installment_id || '').trim();

    const amountDue = financeRoundAmount_(row.amount_due);
    const existingPaidAmount = financeRoundAmount_(row.paid_amount);
    const paidAmount = financeRoundAmount_(
      Math.min(amountDue, Math.max(0, remainingPaid))
    );

    remainingPaid = financeRoundAmount_(remainingPaid - paidAmount);

    const nextStatus = calculateInstallmentStatus_(row.due_date, amountDue, paidAmount);
    const existingStatus = String(row.status || '').trim().toLowerCase();

    const existingPaidAt = String(formatCellValue(row.paid_at || '') || '').trim();
    const nextPaidAt = nextStatus === 'paid'
      ? (existingPaidAt || now)
      : null;

    const shouldUpdate =
      !financeIsAmountEqual_(existingPaidAmount, paidAmount) ||
      existingStatus !== nextStatus ||
      existingPaidAt !== nextPaidAt;

    const calculatedPatch = {
      paid_amount: paidAmount,
      status: nextStatus,
      paid_at: nextPaidAt
    };

    if (shouldUpdate && installmentId) {
      dbUpdateById_(
        getBillingInstallmentSheetName_(),
        'installment_id',
        installmentId,
        Object.assign({}, calculatedPatch, {
          updated_at: now
        })
      );

      updatedCount++;
    } else {
      skippedCount++;
    }

    updatedRows.push(
      normalizeBillingInstallmentForClient(
        Object.assign({}, row, calculatedPatch, shouldUpdate ? { updated_at: now } : {})
      )
    );
  });

  return {
    success: true,
    message: updatedCount > 0
      ? 'Status cicilan berhasil dihitung ulang'
      : 'Status cicilan sudah sinkron, tidak ada update sheet',
    data: updatedRows,
    summary: {
      checked_rows: rows.length,
      updated_rows: updatedCount,
      skipped_rows: skippedCount,
      remaining_paid_after_distribution: remainingPaid
    }
  };
}

function getBillingInstallmentPlan(payload) {
  const permission = requireFinancePermission_(payload, 'read_billing_installment_plan');

  if (!permission.success) {
    return permission;
  }

  const billingId = String((payload && payload.billing_id) || '').trim();

  return getBillingInstallmentPlanUnlocked_(billingId);
}

function getBillingInstallmentPlanUnlocked_(billingId, options) {
  const opts = options || {};
  const shouldRecalculate = opts.recalculate !== false;

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

  if (shouldRecalculate) {
    recalculateBillingInstallmentPayments(normalizedBillingId);
  }

  const latestBilling = findBillingRawById(normalizedBillingId) || billing;

  const rows = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  const grandTotal = getBillingGrandTotalForInstallment_(latestBilling);
  const paidTotal = getBillingPaidTotalForInstallment_(normalizedBillingId);
  const outstandingTotal = Math.max(0, grandTotal - paidTotal);

  const nextInstallment = rows.find(function(row) {
    return String(row.status || '').trim().toLowerCase() !== 'paid';
  }) || null;

  return {
    success: true,
    data: {
      billing: normalizeFinanceRow(latestBilling),
      installments: rows,
      summary: {
        grand_total: grandTotal,
        paid_total: paidTotal,
        outstanding_total: outstandingTotal,
        installment_count: rows.length,
        next_due_date: nextInstallment ? nextInstallment.due_date : '',
        next_due_amount: nextInstallment
          ? Math.max(0, Number(nextInstallment.amount_due || 0) - Number(nextInstallment.paid_amount || 0))
          : 0
      }
    }
  };
}

/* =========================================================
   H7-4 - INSTALLMENT SYNC AFTER BILLING TOTAL CHANGE
   Sinkronisasi cicilan setelah grand_total berubah karena diskon
   ========================================================= */

function syncBillingInstallmentsAfterBillingTotalChange_(billingId, options) {
  const opts = options || {};
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

  const existingRows = getBillingInstallmentRowsByBillingId(normalizedBillingId);

  if (!existingRows.length) {
    return {
      success: true,
      message: 'Billing tidak memiliki jadwal cicilan',
      data: {
        billing_id: normalizedBillingId,
        has_installment_plan: false,
        updated_installments: 0,
        deleted_installments: 0,
        renumbered_installments: 0
      }
    };
  }

  recalculateBillingInstallmentPayments(normalizedBillingId);

  const latestBilling = findBillingRawById(normalizedBillingId) || billing;
  const grandTotal = financeRoundAmount_(latestBilling.grand_total);

  let rows = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  const currentInstallmentTotal = financeRoundAmount_(
    rows.reduce(function(sum, row) {
      return sum + financeToAmount_(row.amount_due);
    }, 0)
  );

  let updatedInstallments = 0;
  let deletedInstallments = 0;
  let renumberedInstallments = 0;
  const changes = [];

  if (financeIsAmountEqual_(currentInstallmentTotal, grandTotal)) {
    const recalcRes = recalculateBillingInstallmentPayments(normalizedBillingId);

    return {
      success: true,
      message: 'Total cicilan sudah sinkron dengan grand total billing',
      data: {
        billing_id: normalizedBillingId,
        has_installment_plan: true,
        grand_total: grandTotal,
        installment_total_before: currentInstallmentTotal,
        installment_total_after: currentInstallmentTotal,
        updated_installments: 0,
        deleted_installments: 0,
        renumbered_installments: 0,
        recalculation: recalcRes
      }
    };
  }

  if (currentInstallmentTotal > grandTotal) {
    let excess = financeRoundAmount_(currentInstallmentTotal - grandTotal);

    for (let i = rows.length - 1; i >= 0 && excess > 0.01; i--) {
      const row = rows[i];

      const installmentId = String(row.installment_id || '').trim();
      const amountDue = financeRoundAmount_(row.amount_due);
      const paidAmount = financeRoundAmount_(row.paid_amount);

      const minimumAmountDue = paidAmount > 0 ? paidAmount : 0;
      const reducibleAmount = Math.max(0, financeRoundAmount_(amountDue - minimumAmountDue));

      if (reducibleAmount <= 0) continue;

      const reduction = Math.min(reducibleAmount, excess);
      const nextAmountDue = financeRoundAmount_(amountDue - reduction);

      dbUpdateById_('BillingInstallments', 'installment_id', installmentId, {
        amount_due: nextAmountDue,
        updated_at: nowIso()
      });

      updatedInstallments++;
      changes.push({
        installment_id: installmentId,
        action: 'reduce_amount_due',
        amount_due_before: amountDue,
        amount_due_after: nextAmountDue,
        reduction: reduction
      });

      excess = financeRoundAmount_(excess - reduction);
    }

    if (excess > 0.01) {
      return {
        success: false,
        message: 'Total cicilan tidak bisa disinkronkan karena ada pembayaran yang sudah melebihi grand total baru',
        data: {
          billing_id: normalizedBillingId,
          grand_total: grandTotal,
          installment_total_before: currentInstallmentTotal,
          remaining_excess: excess,
          changes: changes
        }
      };
    }
  }

  if (currentInstallmentTotal < grandTotal) {
    const deficit = financeRoundAmount_(grandTotal - currentInstallmentTotal);

    rows = getBillingInstallmentRowsByBillingId(normalizedBillingId)
      .map(function(row) {
        return normalizeBillingInstallmentForClient(row);
      });

    let targetRow = null;

    for (let j = rows.length - 1; j >= 0; j--) {
      const status = String(rows[j].status || '').trim().toLowerCase();

      if (status !== 'paid') {
        targetRow = rows[j];
        break;
      }
    }

    if (!targetRow && rows.length) {
      targetRow = rows[rows.length - 1];
    }

    if (!targetRow) {
      return {
        success: false,
        message: 'Target termin untuk penyesuaian cicilan tidak ditemukan'
      };
    }

    const targetInstallmentId = String(targetRow.installment_id || '').trim();
    const amountDueBefore = financeRoundAmount_(targetRow.amount_due);
    const amountDueAfter = financeRoundAmount_(amountDueBefore + deficit);

    dbUpdateById_('BillingInstallments', 'installment_id', targetInstallmentId, {
      amount_due: amountDueAfter,
      updated_at: nowIso()
    });

    updatedInstallments++;
    changes.push({
      installment_id: targetInstallmentId,
      action: 'increase_amount_due',
      amount_due_before: amountDueBefore,
      amount_due_after: amountDueAfter,
      increase: deficit
    });
  }

  rows = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  const deletableInstallmentIds = [];

  rows.forEach(function(row) {
    const installmentId = String(row.installment_id || '').trim();
    const amountDue = financeRoundAmount_(row.amount_due);
    const paidAmount = financeRoundAmount_(row.paid_amount);

    if (
      installmentId &&
      amountDue <= 0.01 &&
      paidAmount <= 0.01 &&
      !hasBillingPaymentReferenceForInstallment_(installmentId)
    ) {
      deletableInstallmentIds.push(installmentId);
    }
  });

  if (deletableInstallmentIds.length) {
    deletedInstallments = deleteBillingInstallmentRowsByIds_(deletableInstallmentIds);

    changes.push({
      action: 'delete_zero_unpaid_installments',
      installment_ids: deletableInstallmentIds,
      deleted_count: deletedInstallments
    });
  }

  renumberedInstallments = renumberBillingInstallments_(normalizedBillingId);

  updateBillingInstallmentMetaAfterSync_(normalizedBillingId);

  const recalcRes = recalculateBillingInstallmentPayments(normalizedBillingId);

  const finalRows = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  const finalInstallmentTotal = financeRoundAmount_(
    finalRows.reduce(function(sum, row) {
      return sum + financeToAmount_(row.amount_due);
    }, 0)
  );

  if (!financeIsAmountEqual_(finalInstallmentTotal, grandTotal)) {
    return {
      success: false,
      message: 'Total cicilan masih belum sinkron setelah penyesuaian',
      data: {
        billing_id: normalizedBillingId,
        grand_total: grandTotal,
        final_installment_total: finalInstallmentTotal,
        changes: changes,
        recalculation: recalcRes
      }
    };
  }

  return {
    success: true,
    message: 'Jadwal cicilan berhasil disinkronkan dengan grand total billing',
    data: {
      billing_id: normalizedBillingId,
      reason: String(opts.reason || ''),
      grand_total: grandTotal,
      installment_total_before: currentInstallmentTotal,
      installment_total_after: finalInstallmentTotal,
      has_installment_plan: finalRows.length > 0,
      updated_installments: updatedInstallments,
      deleted_installments: deletedInstallments,
      renumbered_installments: renumberedInstallments,
      changes: changes,
      installments: finalRows,
      recalculation: recalcRes
    }
  };
}

function hasBillingPaymentReferenceForInstallment_(installmentId) {
  const normalizedInstallmentId = String(installmentId || '').trim();

  if (!normalizedInstallmentId) return false;

  return getPaymentsRaw().some(function(row) {
    return String(row.installment_id || '').trim() === normalizedInstallmentId;
  });
}

function deleteBillingInstallmentRowsByIds_(installmentIds) {
  const ids = {};

  (installmentIds || []).forEach(function(id) {
    const normalizedId = String(id || '').trim();

    if (normalizedId) {
      ids[normalizedId] = true;
    }
  });

  const targetIds = Object.keys(ids);

  if (!targetIds.length) return 0;

  const sheet = getSheet(getBillingInstallmentSheetName_());
  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) return 0;

  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  const installmentIdCol = headers.indexOf('installment_id');

  if (installmentIdCol === -1) {
    throw new Error('Kolom installment_id tidak ditemukan di BillingInstallments');
  }

  let deleted = 0;

  for (let r = values.length - 1; r >= 1; r--) {
    const installmentId = String(values[r][installmentIdCol] || '').trim();

    if (ids[installmentId]) {
      sheet.deleteRow(r + 1);
      deleted++;
    }
  }

  return deleted;
}

function renumberBillingInstallments_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return 0;

  const rows = getBillingInstallmentRowsByBillingId(normalizedBillingId);

  let changed = 0;

  rows.forEach(function(row, index) {
    const expectedNo = index + 1;
    const currentNo = Number(row.installment_no || 0);
    const installmentId = String(row.installment_id || '').trim();

    if (!installmentId) return;

    if (currentNo !== expectedNo) {
      dbUpdateById_('BillingInstallments', 'installment_id', installmentId, {
        installment_no: expectedNo,
        updated_at: nowIso()
      });

      changed++;
    }
  });

  return changed;
}

function updateBillingInstallmentMetaAfterSync_(billingId) {
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

  const rows = getBillingInstallmentRowsByBillingId(normalizedBillingId);
  const now = nowIso();

  if (rows.length) {
    const firstDueDate =
      financeNormalizeDateOnlyYmd_(rows[0].due_date || '') ||
      getFinanceTodayYmd_();

    dbUpdateById_('Billings', 'billing_id', normalizedBillingId, {
      payment_type: 'installment',
      payment_terms: 'installment',
      due_date: firstDueDate,
      updated_at: now
    });

    return {
      success: true,
      data: {
        payment_type: 'installment',
        payment_terms: 'installment',
        due_date: firstDueDate
      }
    };
  }

  const fallbackDueDate =
    financeNormalizeDateOnlyYmd_(billing.billing_date || '') ||
    getFinanceTodayYmd_();

  dbUpdateById_('Billings', 'billing_id', normalizedBillingId, {
    payment_type: 'full',
    payment_terms: 'full',
    due_date: fallbackDueDate,
    updated_at: now
  });

  return {
    success: true,
    data: {
      payment_type: 'full',
      payment_terms: 'full',
      due_date: fallbackDueDate
    }
  };
}

/* =========================================================
   FINANCE INSTALLMENT MANUAL TESTS / DEV ONLY
   Function di bawah ini hanya untuk inspeksi manual cicilan.
   Tidak dipanggil otomatis oleh UI Finance.
   ========================================================= */

function inspectBillingInstallmentSync_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (
    !normalizedBillingId ||
    normalizedBillingId === 'ISI_BILLING_ID_DI_SINI'
  ) {
    return {
      success: false,
      message: 'Isi billingId terlebih dahulu untuk menjalankan inspect cicilan manual'
    };
  }

  const billing = findBillingRawById(normalizedBillingId);

  if (!billing) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  const installments = getBillingInstallmentRowsByBillingId(normalizedBillingId)
    .map(function(row) {
      return normalizeBillingInstallmentForClient(row);
    });

  const payments = getPaymentsByBillingIdRaw(normalizedBillingId)
    .map(function(row) {
      return normalizeFinanceRow(row);
    });

  const installmentTotal = financeRoundAmount_(
    installments.reduce(function(sum, row) {
      return sum + financeToAmount_(row.amount_due);
    }, 0)
  );

  const installmentPaidTotal = financeRoundAmount_(
    installments.reduce(function(sum, row) {
      return sum + financeToAmount_(row.paid_amount);
    }, 0)
  );

  const paymentTotal = financeRoundAmount_(
    payments.reduce(function(sum, row) {
      return sum + financeToAmount_(row.amount);
    }, 0)
  );

  const grandTotal = financeRoundAmount_(billing.grand_total);
  const paidTotal = financeRoundAmount_(billing.paid_total);
  const outstandingTotal = financeRoundAmount_(billing.outstanding_total);

  return {
    success: true,
    billing_id: normalizedBillingId,
    billing: normalizeFinanceRow(billing),
    summary: {
      grand_total: grandTotal,
      billing_paid_total: paidTotal,
      billing_outstanding_total: outstandingTotal,
      installment_total: installmentTotal,
      installment_paid_total: installmentPaidTotal,
      payment_total: paymentTotal,
      installment_vs_grand_total_diff: financeRoundAmount_(installmentTotal - grandTotal),
      payment_vs_billing_paid_diff: financeRoundAmount_(paymentTotal - paidTotal),
      installment_paid_vs_payment_diff: financeRoundAmount_(installmentPaidTotal - paymentTotal),
      expected_outstanding_total: financeRoundAmount_(grandTotal - paidTotal),
      outstanding_diff: financeRoundAmount_(outstandingTotal - financeRoundAmount_(grandTotal - paidTotal))
    },
    installments: installments,
    payments: payments
  };
}