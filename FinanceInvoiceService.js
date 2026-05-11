/* =========================================================
   FINANCE INVOICE SERVICE
   Invoice PDF, Drive file, email invoice, dan delivery info
   ========================================================= */

const FINANCE_INVOICE_FOLDER_ID_PROPERTY_KEY_ = 'FINANCE_INVOICE_FOLDER_ID';

function getFinanceInvoiceFolderName_() {
  return 'Dental Clinic Billing Invoices';
}

function getFinanceInvoiceFolder_() {
  const folderName = getFinanceInvoiceFolderName_();
  const props = PropertiesService.getScriptProperties();
  const cachedFolderId = String(
    props.getProperty(FINANCE_INVOICE_FOLDER_ID_PROPERTY_KEY_) || ''
  ).trim();

  if (cachedFolderId) {
    try {
      const cachedFolder = DriveApp.getFolderById(cachedFolderId);

      if (cachedFolder && cachedFolder.getName() === folderName) {
        return cachedFolder;
      }
    } catch (err) {
      props.deleteProperty(FINANCE_INVOICE_FOLDER_ID_PROPERTY_KEY_);
    }
  }

  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(folderName);

  props.setProperty(
    FINANCE_INVOICE_FOLDER_ID_PROPERTY_KEY_,
    folder.getId()
  );

  return folder;
}

function getFinanceClinicProfile_() {
  return {
    clinic_name: 'Hajar Aswad',
    clinic_subtitle: 'Dental Clinic',
    clinic_address: '',
    clinic_phone: '',
    clinic_email: ''
  };
}

function getFinanceSafeInvoiceFileName_(billing) {
  const billingNumber = String((billing && billing.billing_number) || '').trim() || 'invoice';
  const patientName = String((billing && billing.patient_name) || '').trim() || 'pasien';

  const rawName = billingNumber + '_' + patientName;
  const safeName = rawName
    .replace(/[\\\/:*?"<>|#%{}~&]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 140);

  return safeName || 'invoice_billing';
}

function updateBillingInvoiceFieldsWithShortLock_(billingId, updated, actionLabel) {
  const normalizedBillingId = String(billingId || '').trim();
  const fields = updated || {};
  const label = String(actionLabel || 'memperbarui data invoice').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(10000);
    locked = true;

    const ok = dbUpdateById_(
      'Billings',
      'billing_id',
      normalizedBillingId,
      fields
    );

    if (!ok) {
      return {
        success: false,
        message: 'Gagal ' + label
      };
    }

    return {
      success: true,
      data: {
        billing_id: normalizedBillingId,
        updated: normalizeFinanceRow(fields)
      }
    };

  } catch (err) {
    Logger.log(
      'updateBillingInvoiceFieldsWithShortLock_ error: ' +
      (err && err.message ? err.message : err)
    );

    return {
      success: false,
      message: 'Sistem Finance sedang menyelesaikan proses lain. Mohon tunggu beberapa saat lalu coba lagi.'
    };

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function findFinancePatientEmail_(billing, fallbackEmail) {
  const manualEmail = String(fallbackEmail || '').trim();

  if (manualEmail) {
    return manualEmail;
  }

  const patientId = String((billing && billing.patient_id) || '').trim();

  if (!patientId) {
    return '';
  }

  let patient = null;

  if (typeof findPatientRawById === 'function') {
    patient = findPatientRawById(patientId);
  }

  if (!patient) {
    return '';
  }

  const candidateFields = [
    'email',
    'patient_email',
    'contact_email',
    'guardian_email',
    'parent_email'
  ];

  for (let i = 0; i < candidateFields.length; i++) {
    const key = candidateFields[i];
    const value = String(patient[key] || '').trim();

    if (value) {
      return value;
    }
  }

  return '';
}

function getFinanceInvoiceStatusLabel_(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'paid') return 'Lunas';
  if (value === 'partial') return 'Sebagian';
  if (value === 'unpaid') return 'Belum Lunas';

  return value || '-';
}

function getBillingFeedbackUrlForInvoice_(billingId, options) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return '';
  }

  const feedbackRes = ensureBillingFeedbackTokenForBilling(
    normalizedBillingId,
    options || {}
  );

  if (!feedbackRes || !feedbackRes.success || !feedbackRes.data) {
    return '';
  }

  return String(feedbackRes.data.feedback_url || '').trim();
}

function getBillingInvoiceFeedbackUrlFromOptions_(billingId, options) {
  const opts = options || {};

  if (Object.prototype.hasOwnProperty.call(opts, 'feedback_url')) {
    return String(opts.feedback_url || '').trim();
  }

  const useLock = Object.prototype.hasOwnProperty.call(opts, 'use_lock')
    ? opts.use_lock
    : false;

  return getBillingFeedbackUrlForInvoice_(billingId, {
    use_lock: useLock
  });
}

function buildBillingInvoiceHtml_(detail, options) {
  const clinic = getFinanceClinicProfile_();

  const billing = (detail && detail.billing) || {};
  const items = Array.isArray(detail && detail.items) ? detail.items : [];
  const adjustments = Array.isArray(detail && detail.adjustments) ? detail.adjustments : [];
  const payments = Array.isArray(detail && detail.payments) ? detail.payments : [];
  const installments = Array.isArray(detail && detail.installments) ? detail.installments : [];

  const paymentStatusLabel = getFinanceInvoiceStatusLabel_(billing.payment_status);
  const generatedAt = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd-MM-yyyy HH:mm'
  );

  const billingFeedbackUrl = getBillingInvoiceFeedbackUrlFromOptions_(
    billing.billing_id,
    options || {
      use_lock: false
    }
  );

  const itemRowsHtml = items.length
    ? items.map(function(item, index) {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeFinanceInvoiceHtml_(item.service_name || '-')}</td>
            <td class="text-center">${Number(item.qty || 0)}</td>
            <td class="text-right">${financeFormatCurrencyText_(item.unit_price || 0)}</td>
            <td class="text-right">${financeFormatCurrencyText_(item.subtotal || 0)}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="5" class="muted text-center">Belum ada item billing</td>
      </tr>
    `;

  const adjustmentRowsHtml = adjustments.length
    ? adjustments.map(function(adj) {
        return `
          <tr>
            <td>${escapeFinanceInvoiceHtml_(adj.label || '-')}</td>
            <td>${escapeFinanceInvoiceHtml_(adj.reason || '-')}</td>
            <td class="text-right">-${financeFormatCurrencyText_(adj.amount || 0)}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="3" class="muted text-center">Tidak ada diskon / adjustment</td>
      </tr>
    `;

  const paymentRowsHtml = payments.length
    ? payments.map(function(payment) {
        return `
          <tr>
            <td>${financeFormatDateText_(payment.payment_date || '')}</td>
            <td>${escapeFinanceInvoiceHtml_(String(payment.payment_method || '').toUpperCase())}</td>
            <td>${escapeFinanceInvoiceHtml_(payment.reference_no || payment.notes || '-')}</td>
            <td class="text-right">${financeFormatCurrencyText_(payment.amount || 0)}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="4" class="muted text-center">Belum ada pembayaran</td>
      </tr>
    `;

  const installmentSectionHtml = installments.length
    ? `
      <div class="section">
        <h3>Jadwal Cicilan</h3>
        <table>
          <thead>
            <tr>
              <th>Termin</th>
              <th>Due Date</th>
              <th class="text-right">Nominal</th>
              <th class="text-right">Terbayar</th>
              <th class="text-right">Sisa</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${installments.map(function(row) {
              return `
                <tr>
                  <td>${Number(row.installment_no || 0)}</td>
                  <td>${financeFormatDateText_(row.due_date || '')}</td>
                  <td class="text-right">${financeFormatCurrencyText_(row.amount_due || 0)}</td>
                  <td class="text-right">${financeFormatCurrencyText_(row.paid_amount || 0)}</td>
                  <td class="text-right">${financeFormatCurrencyText_(row.outstanding_amount || 0)}</td>
                  <td>${escapeFinanceInvoiceHtml_(row.status || '-')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            box-sizing: border-box;
            font-family: Arial, sans-serif;
          }

          body {
            margin: 0;
            padding: 28px;
            color: #0f172a;
            background: #ffffff;
            font-size: 12px;
          }

          .invoice-box {
            width: 100%;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            padding-bottom: 18px;
            border-bottom: 2px solid #0f766e;
            margin-bottom: 20px;
          }

          .clinic-name {
            font-size: 24px;
            font-weight: 800;
            color: #0f766e;
            margin-bottom: 4px;
          }

          .clinic-subtitle {
            font-size: 13px;
            color: #475569;
            margin-bottom: 8px;
          }

          .clinic-meta {
            color: #64748b;
            line-height: 1.5;
          }

          .invoice-title {
            text-align: right;
          }

          .invoice-title h1 {
            margin: 0 0 8px;
            font-size: 26px;
            letter-spacing: 1px;
          }

          .invoice-number {
            font-size: 13px;
            font-weight: 700;
            color: #334155;
          }

          .status-badge {
            display: inline-block;
            margin-top: 10px;
            padding: 6px 10px;
            border-radius: 999px;
            color: #ffffff;
            background: #0f766e;
            font-size: 11px;
            font-weight: 700;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 20px;
          }

          .info-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            background: #f8fafc;
          }

          .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 5px;
          }

          .value {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.4;
          }

          .section {
            margin-top: 18px;
          }

          .section h3 {
            margin: 0 0 10px;
            font-size: 15px;
            color: #0f172a;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }

          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            font-size: 11px;
            padding: 9px;
            border: 1px solid #e2e8f0;
            text-align: left;
          }

          td {
            padding: 9px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
            line-height: 1.4;
          }

          .text-right {
            text-align: right;
          }

          .text-center {
            text-align: center;
          }

          .muted {
            color: #64748b;
          }

          .total-wrap {
            display: flex;
            justify-content: flex-end;
            margin-top: 18px;
          }

          .total-table {
            width: 360px;
          }

          .total-table td {
            padding: 8px 10px;
          }

          .total-label {
            color: #475569;
            font-weight: 700;
          }

          .grand-total {
            background: #f0fdfa;
            color: #0f766e;
            font-size: 14px;
            font-weight: 800;
          }

          .outstanding {
            background: #fef2f2;
            color: #b91c1c;
            font-size: 14px;
            font-weight: 800;
          }

          .footer {
            margin-top: 28px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.6;
          }
        </style>
      </head>

      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <div class="clinic-name">${escapeFinanceInvoiceHtml_(clinic.clinic_name)}</div>
              <div class="clinic-subtitle">${escapeFinanceInvoiceHtml_(clinic.clinic_subtitle)}</div>
              <div class="clinic-meta">
                ${clinic.clinic_address ? escapeFinanceInvoiceHtml_(clinic.clinic_address) + '<br>' : ''}
                ${clinic.clinic_phone ? 'Telp: ' + escapeFinanceInvoiceHtml_(clinic.clinic_phone) + '<br>' : ''}
                ${clinic.clinic_email ? 'Email: ' + escapeFinanceInvoiceHtml_(clinic.clinic_email) : ''}
              </div>
            </div>

            <div class="invoice-title">
              <h1>INVOICE</h1>
              <div class="invoice-number">${escapeFinanceInvoiceHtml_(billing.billing_number || billing.billing_id || '-')}</div>
              <div class="status-badge">${escapeFinanceInvoiceHtml_(paymentStatusLabel)}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="label">Pasien</div>
              <div class="value">${escapeFinanceInvoiceHtml_(billing.patient_name || '-')}</div>
              <div class="muted">${escapeFinanceInvoiceHtml_(billing.patient_id || '-')}</div>
            </div>

            <div class="info-card">
              <div class="label">Informasi Billing</div>
              <div class="value">Tanggal: ${financeFormatDateText_(billing.billing_date || '')}</div>
              <div class="muted">Due Date: ${financeFormatDateText_(billing.due_date || '')}</div>
              <div class="muted">Treatment ID: ${escapeFinanceInvoiceHtml_(billing.treatment_id || '-')}</div>
            </div>
          </div>

          <div class="section">
            <h3>Item Billing</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">No</th>
                  <th>Layanan</th>
                  <th class="text-center" style="width: 60px;">Qty</th>
                  <th class="text-right" style="width: 120px;">Harga</th>
                  <th class="text-right" style="width: 120px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemRowsHtml}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h3>Diskon / Adjustment</h3>
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Catatan</th>
                  <th class="text-right" style="width: 140px;">Nominal</th>
                </tr>
              </thead>
              <tbody>
                ${adjustmentRowsHtml}
              </tbody>
            </table>
          </div>

          ${installmentSectionHtml}

          <div class="section">
            <h3>Riwayat Pembayaran</h3>
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Metode</th>
                  <th>Referensi / Catatan</th>
                  <th class="text-right" style="width: 140px;">Nominal</th>
                </tr>
              </thead>
              <tbody>
                ${paymentRowsHtml}
              </tbody>
            </table>
          </div>

          <div class="total-wrap">
            <table class="total-table">
              <tr>
                <td class="total-label">Subtotal</td>
                <td class="text-right">${financeFormatCurrencyText_(billing.subtotal || 0)}</td>
              </tr>
              <tr>
                <td class="total-label">Diskon</td>
                <td class="text-right">-${financeFormatCurrencyText_(billing.discount_total || 0)}</td>
              </tr>
              <tr>
                <td class="total-label grand-total">Grand Total</td>
                <td class="text-right grand-total">${financeFormatCurrencyText_(billing.grand_total || 0)}</td>
              </tr>
              <tr>
                <td class="total-label">Sudah Dibayar</td>
                <td class="text-right">${financeFormatCurrencyText_(billing.paid_total || 0)}</td>
              </tr>
              <tr>
                <td class="total-label outstanding">Sisa Tagihan</td>
                <td class="text-right outstanding">${financeFormatCurrencyText_(billing.outstanding_total || 0)}</td>
              </tr>
            </table>
          </div>

          ${billingFeedbackUrl ? `
            <div class="section" style="margin-top:18px; padding:14px; border:1px solid #dbeafe; border-radius:12px; background:#eff6ff;">
              <h3 style="margin-top:0;">Feedback Kepuasan Layanan</h3>

              <p style="margin:0 0 8px; color:#334155; line-height:1.5;">
                Kami sangat menghargai penilaian Anda. Silakan berikan feedback layanan klinik melalui link berikut:
              </p>

              <p style="margin:0; word-break:break-all;">
                <a href="${escapeFinanceInvoiceHtml_(billingFeedbackUrl)}" target="_blank">
                  ${escapeFinanceInvoiceHtml_(billingFeedbackUrl)}
                </a>
              </p>
            </div>
          ` : ''}

          <div class="footer">
            Invoice ini dibuat secara digital pada ${escapeFinanceInvoiceHtml_(generatedAt)}.
            <br>
            Mohon simpan invoice ini sebagai bukti administrasi billing klinik.
          </div>
        </div>
      </body>
    </html>
  `;
}

function getBillingDetailForInvoice_(billingId, options) {
  const opts = options || {};

  const res = getBillingByIdUnlocked_(billingId, {
    recalculate: opts.recalculate !== false
  });

  if (!res || !res.success) {
    return {
      success: false,
      message: (res && res.message) || 'Data billing tidak ditemukan'
    };
  }

  return {
    success: true,
    data: res.data
  };
}

function generateBillingInvoicePdfUnlocked_(billingId, options) {
  const opts = options || {};

  if (opts.ensure_setup === true) {
    setupFinanceStage1Sheets();
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  let detail = opts.detail || null;

  if (!detail) {
    const detailRes = getBillingDetailForInvoice_(normalizedBillingId, {
      recalculate: opts.recalculate !== false
    });

    if (!detailRes.success) {
      return detailRes;
    }

    detail = detailRes.data || {};
  }

  const billing = detail.billing || {};

  if (!billing.billing_id) {
    return {
      success: false,
      message: 'Data billing tidak valid'
    };
  }

  const billingFeedbackUrl = getBillingFeedbackUrlForInvoice_(normalizedBillingId, {
    use_lock: true
  });

  const html = buildBillingInvoiceHtml_(detail, {
    feedback_url: billingFeedbackUrl
  });

  const fileName = getFinanceSafeInvoiceFileName_(billing);

  const pdfBlob = Utilities
    .newBlob(html, MimeType.HTML, fileName + '.html')
    .getAs(MimeType.PDF)
    .setName(fileName + '.pdf');

  const folder = getFinanceInvoiceFolder_();
  const file = folder.createFile(pdfBlob);

  const invoicePdfSignature = buildBillingInvoiceSignature_(normalizedBillingId, {
    detail: detail,
    recalculate: false
  });

  const invoicePdfSignatureAt = nowIso();

  const updated = {
    invoice_pdf_file_id: file.getId(),
    invoice_pdf_url: file.getUrl(),
    invoice_delivery_status: 'generated',
    invoice_pdf_signature: invoicePdfSignature,
    invoice_pdf_signature_at: invoicePdfSignatureAt,
    updated_at: invoicePdfSignatureAt
  };

  const updateRes = updateBillingInvoiceFieldsWithShortLock_(
    normalizedBillingId,
    updated,
    'menyimpan status PDF invoice'
  );

  if (!updateRes || !updateRes.success) {
    return {
      success: false,
      message:
        (updateRes && updateRes.message) ||
        'PDF berhasil dibuat, tetapi status PDF invoice gagal disimpan.',
      data: {
        file_id: file.getId(),
        file_url: file.getUrl(),
        file_name: file.getName(),
        feedback_url: billingFeedbackUrl
      }
    };
  }

  return {
    success: true,
    message: 'Invoice PDF berhasil dibuat',
    data: {
      billing: normalizeFinanceRow(Object.assign({}, billing, updated)),
      file_id: file.getId(),
      file_url: file.getUrl(),
      file_name: file.getName(),
      feedback_url: billingFeedbackUrl,
      invoice_pdf_signature: invoicePdfSignature,
      invoice_pdf_signature_at: invoicePdfSignatureAt
    }
  };
}

function generateBillingInvoicePdf(payload) {
  try {
    const freezeCheck = repoCheckProductionMutationAllowed_({
      operation: 'GENERATE_BILLING_INVOICE_PDF',
      module: 'FinanceInvoiceService',
      action: 'generateBillingInvoicePdf',
      __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
    });

    if (!freezeCheck.allowed) {
      return {
        success: false,
        message: freezeCheck.message
      };
    }

    const permission = requireFinancePermission_(
      payload,
      'generate_billing_invoice_pdf'
    );

    if (!permission.success) {
      return permission;
    }

    const billingId = String((payload && payload.billing_id) || '').trim();

    return generateBillingInvoicePdfUnlocked_(billingId, {
      ensure_setup: false
    });

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat membuat invoice PDF: ' +
        (err && err.message ? err.message : err)
    };
  }
}

function getBillingInvoicePdfBlob_(billingId, options) {
  const opts = options || {};
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  let billing = opts.billing || null;
  let fileId = String(opts.file_id || '').trim();

  if (!fileId && billing) {
    fileId = String(billing.invoice_pdf_file_id || '').trim();
  }

  if (!fileId) {
    billing = findBillingRawById(normalizedBillingId);

    if (!billing) {
      return {
        success: false,
        message: 'Data billing tidak ditemukan'
      };
    }

    fileId = String(billing.invoice_pdf_file_id || '').trim();
  }

  if (!fileId) {
    return {
      success: false,
      message: 'File PDF invoice belum tersedia. Generate PDF invoice terlebih dahulu.'
    };
  }

  try {
    const file = DriveApp.getFileById(fileId);

    return {
      success: true,
      data: {
        file: file,
        blob: file.getBlob(),
        file_id: file.getId(),
        file_url: file.getUrl(),
        file_name: file.getName()
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'File PDF invoice tidak dapat dibuka. Generate ulang PDF invoice terlebih dahulu.'
    };
  }
}

function buildBillingInvoiceEmailHtml_(detail, customMessage, options) {
  const billing = (detail && detail.billing) || {};
  const message = String(customMessage || '').trim();

  const defaultMessage = `
    Berikut kami kirimkan billing/invoice digital untuk layanan klinik Anda.
    Mohon periksa lampiran PDF pada email ini.
  `;

  const billingFeedbackUrl = getBillingInvoiceFeedbackUrlFromOptions_(
    billing.billing_id,
    options || {
      use_lock: false
    }
  );

  return `
    <div style="font-family: Arial, sans-serif; color:#0f172a; line-height:1.6;">
      <p>Yth. ${escapeFinanceInvoiceHtml_(billing.patient_name || 'Pasien')},</p>

      <p>${escapeFinanceInvoiceHtml_(message || defaultMessage)}</p>

      <table style="border-collapse:collapse; margin:16px 0; width:100%; max-width:520px;">
        <tr>
          <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold;">Invoice</td>
          <td style="border:1px solid #e2e8f0; padding:8px;">${escapeFinanceInvoiceHtml_(billing.billing_number || billing.billing_id || '-')}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold;">Tanggal Billing</td>
          <td style="border:1px solid #e2e8f0; padding:8px;">${financeFormatDateText_(billing.billing_date || '')}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold;">Grand Total</td>
          <td style="border:1px solid #e2e8f0; padding:8px;">${financeFormatCurrencyText_(billing.grand_total || 0)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold;">Sudah Dibayar</td>
          <td style="border:1px solid #e2e8f0; padding:8px;">${financeFormatCurrencyText_(billing.paid_total || 0)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold;">Sisa Tagihan</td>
          <td style="border:1px solid #e2e8f0; padding:8px; color:#b91c1c; font-weight:bold;">${financeFormatCurrencyText_(billing.outstanding_total || 0)}</td>
        </tr>
      </table>

      ${billingFeedbackUrl ? `
        <div style="margin:18px 0; padding:14px; border:1px solid #dbeafe; border-radius:12px; background:#eff6ff;">
          <p style="margin:0 0 8px; font-weight:bold; color:#0f172a;">
            Feedback Kepuasan Layanan
          </p>

          <p style="margin:0 0 8px; color:#334155;">
            Kami sangat menghargai penilaian Anda. Silakan isi feedback melalui link berikut:
          </p>

          <p style="margin:0;">
            <a href="${escapeFinanceInvoiceHtml_(billingFeedbackUrl)}" target="_blank">
              Isi Feedback Kepuasan Layanan
            </a>
          </p>
        </div>
      ` : ''}

      <p>
        Terima kasih atas kepercayaan Anda kepada Hajar Aswad Dental Clinic.
      </p>

      <p style="font-size:12px; color:#64748b;">
        Email ini dikirim secara otomatis oleh sistem billing klinik.
      </p>
    </div>
  `;
}

function buildBillingInvoiceEmailPlainText_(detail, customMessage, options) {
  const billing = (detail && detail.billing) || {};
  const message = String(customMessage || '').trim();
  const billingFeedbackUrl = getBillingInvoiceFeedbackUrlFromOptions_(
    billing.billing_id,
    options || {
      use_lock: false
    }
  );

  const lines = [
    'Yth. ' + String(billing.patient_name || 'Pasien') + ',',
    '',
    message || 'Berikut kami kirimkan billing/invoice digital untuk layanan klinik Anda. Mohon periksa lampiran PDF pada email ini.',
    '',
    'Invoice: ' + String(billing.billing_number || billing.billing_id || '-'),
    'Tanggal Billing: ' + financeFormatDateText_(billing.billing_date || ''),
    'Grand Total: ' + financeFormatCurrencyText_(billing.grand_total || 0),
    'Sudah Dibayar: ' + financeFormatCurrencyText_(billing.paid_total || 0),
    'Sisa Tagihan: ' + financeFormatCurrencyText_(billing.outstanding_total || 0),
    ''
  ];

  if (billingFeedbackUrl) {
    lines.push('Feedback Kepuasan Layanan:');
    lines.push(billingFeedbackUrl);
    lines.push('');
  }

  lines.push('Terima kasih atas kepercayaan Anda kepada Hajar Aswad Dental Clinic.');

  return lines.join('\n');
}

function ensureFreshBillingInvoicePdfForEmail_(billingId, options) {
  const opts = options || {};
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  let detail = opts.detail || null;
  let billing = detail && detail.billing ? detail.billing : null;

  if (!billing) {
    const detailRes = getBillingDetailForInvoice_(normalizedBillingId, {
      recalculate: opts.recalculate !== false
    });

    if (!detailRes || !detailRes.success) {
      return {
        success: false,
        message: (detailRes && detailRes.message) || 'Data billing tidak ditemukan'
      };
    }

    detail = detailRes.data || {};
    billing = detail.billing || {};
  }

  if (!billing || !billing.billing_id) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  let freshnessInfo = null;

  try {
    freshnessInfo = getBillingInvoiceFreshnessInfo_(
      normalizedBillingId,
      billing,
      {
        detail: detail,
        recalculate: false
      }
    );
  } catch (err) {
    freshnessInfo = {
      invoice_pdf_status: 'unknown',
      invoice_pdf_is_fresh: false,
      invoice_pdf_needs_regenerate: true
    };
  }

  const hasPdf = !!String(billing.invoice_pdf_url || '').trim();
  const isFresh = !!(freshnessInfo && freshnessInfo.invoice_pdf_is_fresh);

  if (hasPdf && isFresh) {
    return {
      success: true,
      regenerated: false,
      message: 'PDF invoice masih fresh',
      data: {
        detail: detail,
        billing: normalizeFinanceRow(billing),
        freshness_info: freshnessInfo
      }
    };
  }

  const generateRes = generateBillingInvoicePdfUnlocked_(normalizedBillingId, {
    detail: detail,
    recalculate: false,
    ensure_setup: false
  });

  if (!generateRes || !generateRes.success) {
    return {
      success: false,
      message: (generateRes && generateRes.message) || 'Gagal membuat PDF invoice terbaru'
    };
  }

  return {
    success: true,
    regenerated: true,
    message: 'PDF invoice terbaru berhasil dibuat',
    data: {
      detail: detail,
      billing: generateRes.data ? generateRes.data.billing : normalizeFinanceRow(billing),
      generated_pdf: generateRes.data || null,
      feedback_url: generateRes.data ? String(generateRes.data.feedback_url || '') : '',
      freshness_info: freshnessInfo
    }
  };
}

function sendBillingInvoiceEmail(payload) {
  try {
    const freezeCheck = repoCheckProductionMutationAllowed_({
      operation: 'SEND_BILLING_INVOICE_EMAIL',
      module: 'FinanceInvoiceService',
      action: 'sendBillingInvoiceEmail',
      __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
    });

    if (!freezeCheck.allowed) {
      return {
        success: false,
        message: freezeCheck.message
      };
    }

    const permission = requireFinancePermission_(
      payload,
      'send_billing_invoice_email'
    );

    if (!permission.success) {
      return permission;
    }

    if (payload && payload.ensure_setup === true) {
      setupFinanceStage1Sheets();
    }

    const billingId = String((payload && payload.billing_id) || '').trim();

    if (!billingId) {
      return {
        success: false,
        message: 'Billing ID tidak ditemukan'
      };
    }

    const detailRes = getBillingDetailForInvoice_(billingId, {
      recalculate: true
    });

    if (!detailRes.success) {
      return detailRes;
    }

    const detail = detailRes.data || {};
    const billing = detail.billing || {};

    const emailTo = findFinancePatientEmail_(
      billing,
      payload && payload.email_to
    );

    if (!emailTo) {
      return {
        success: false,
        message: 'Email pasien belum tersedia. Isi email tujuan secara manual.'
      };
    }

    if (!isValidFinanceEmail_(emailTo)) {
      return {
        success: false,
        message: 'Format email tujuan tidak valid'
      };
    }

    const freshPdfRes = ensureFreshBillingInvoicePdfForEmail_(billingId, {
      detail: detail,
      recalculate: false
    });

    if (!freshPdfRes || !freshPdfRes.success) {
      return {
        success: false,
        message:
          (freshPdfRes && freshPdfRes.message) ||
          'Gagal menyiapkan PDF invoice terbaru'
      };
    }

    const freshPdfData = freshPdfRes.data || {};
    const latestBillingForDelivery = freshPdfData.billing || billing;

    const pdfRes = getBillingInvoicePdfBlob_(billingId, {
      billing: latestBillingForDelivery
    });

    if (!pdfRes.success) {
      return pdfRes;
    }

    const pdfData = pdfRes.data || {};

    const subject = String((payload && payload.subject) || '').trim() ||
      'Invoice Billing ' +
      String(billing.billing_number || billing.billing_id || '');

    const customMessage = String((payload && payload.message) || '').trim();

    const billingFeedbackUrl = String(freshPdfData.feedback_url || '').trim() ||
      getBillingFeedbackUrlForInvoice_(billingId, {
        use_lock: true
      });

    const emailBuildOptions = {
      feedback_url: billingFeedbackUrl
    };

    MailApp.sendEmail({
      to: emailTo,
      subject: subject,
      body: buildBillingInvoiceEmailPlainText_(
        detail,
        customMessage,
        emailBuildOptions
      ),
      htmlBody: buildBillingInvoiceEmailHtml_(
        detail,
        customMessage,
        emailBuildOptions
      ),
      attachments: [pdfData.blob]
    });

    const now = nowIso();

    const updated = {
      invoice_pdf_file_id: pdfData.file_id,
      invoice_pdf_url: pdfData.file_url,
      invoice_pdf_signature: String(latestBillingForDelivery.invoice_pdf_signature || ''),
      invoice_pdf_signature_at: String(latestBillingForDelivery.invoice_pdf_signature_at || ''),
      invoice_sent_to: emailTo,
      invoice_sent_at: now,
      invoice_delivery_status: 'sent',
      updated_at: now
    };

    const updateRes = updateBillingInvoiceFieldsWithShortLock_(
      billingId,
      updated,
      'menyimpan status pengiriman invoice'
    );

    const deliveryUpdateFailed = !updateRes || !updateRes.success;

    return {
      success: true,
      message: deliveryUpdateFailed
        ? 'Invoice berhasil dikirim ke email pasien, tetapi status pengiriman belum sempat tersimpan karena sistem sedang sibuk.'
        : 'Invoice berhasil dikirim ke email pasien',
      data: {
        billing: normalizeFinanceRow(
          Object.assign({}, latestBillingForDelivery, updated)
        ),
        email_to: emailTo,
        file_id: pdfData.file_id,
        file_url: pdfData.file_url,
        file_name: pdfData.file_name,
        pdf_regenerated: !!freshPdfRes.regenerated,
        delivery_update_failed: deliveryUpdateFailed,
        delivery_update_message: deliveryUpdateFailed
          ? ((updateRes && updateRes.message) || 'Status pengiriman belum tersimpan.')
          : ''
      }
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat mengirim invoice email: ' +
        (err && err.message ? err.message : err)
    };
  }
}

function hashInvoiceSnapshot_(text) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );

  return raw.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function normalizeInvoiceSnapshotValue_(value) {
  if (value === null || value === undefined) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  return String(value).trim();
}

function normalizeInvoiceSnapshotNumber_(value) {
  const num = Number(value || 0);
  if (isNaN(num)) return 0;
  return num;
}

function buildBillingInvoiceSnapshotFromDetail_(detail) {
  const data = detail || {};
  const billing = data.billing || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const installments = Array.isArray(data.installments) ? data.installments : [];

  return {
    billing: {
      billing_id: normalizeInvoiceSnapshotValue_(billing.billing_id),
      billing_number: normalizeInvoiceSnapshotValue_(billing.billing_number),
      billing_date: normalizeInvoiceSnapshotValue_(billing.billing_date).slice(0, 10),
      due_date: normalizeInvoiceSnapshotValue_(billing.due_date).slice(0, 10),
      treatment_id: normalizeInvoiceSnapshotValue_(billing.treatment_id),
      appointment_id: normalizeInvoiceSnapshotValue_(billing.appointment_id),
      patient_id: normalizeInvoiceSnapshotValue_(billing.patient_id),
      patient_name: normalizeInvoiceSnapshotValue_(billing.patient_name),

      subtotal: normalizeInvoiceSnapshotNumber_(billing.subtotal),
      discount_total: normalizeInvoiceSnapshotNumber_(billing.discount_total),
      grand_total: normalizeInvoiceSnapshotNumber_(billing.grand_total),
      paid_total: normalizeInvoiceSnapshotNumber_(billing.paid_total),
      outstanding_total: normalizeInvoiceSnapshotNumber_(billing.outstanding_total),

      billing_status: normalizeInvoiceSnapshotValue_(billing.billing_status).toLowerCase(),
      payment_status: normalizeInvoiceSnapshotValue_(billing.payment_status).toLowerCase(),
      payment_type: normalizeInvoiceSnapshotValue_(billing.payment_type || billing.payment_terms).toLowerCase()
    },

    items: items.map(function(item) {
      return {
        service_id: normalizeInvoiceSnapshotValue_(item.service_id),
        service_name: normalizeInvoiceSnapshotValue_(item.service_name),
        qty: normalizeInvoiceSnapshotNumber_(item.qty),
        unit_price: normalizeInvoiceSnapshotNumber_(item.unit_price),
        subtotal: normalizeInvoiceSnapshotNumber_(item.subtotal)
      };
    }).sort(function(a, b) {
      return String(a.service_id + a.service_name).localeCompare(String(b.service_id + b.service_name));
    }),

    adjustments: adjustments.map(function(adj) {
      return {
        adjustment_id: normalizeInvoiceSnapshotValue_(adj.adjustment_id),
        label: normalizeInvoiceSnapshotValue_(adj.label),
        amount: normalizeInvoiceSnapshotNumber_(adj.amount),
        reason: normalizeInvoiceSnapshotValue_(adj.reason),
        created_at: normalizeInvoiceSnapshotValue_(adj.created_at)
      };
    }).sort(function(a, b) {
      return String(a.adjustment_id || a.created_at || a.label).localeCompare(
        String(b.adjustment_id || b.created_at || b.label)
      );
    }),

    payments: payments.map(function(payment) {
      return {
        payment_id: normalizeInvoiceSnapshotValue_(payment.payment_id),
        payment_date: normalizeInvoiceSnapshotValue_(payment.payment_date).slice(0, 10),
        payment_method: normalizeInvoiceSnapshotValue_(payment.payment_method),
        payment_scope: normalizeInvoiceSnapshotValue_(payment.payment_scope),
        installment_id: normalizeInvoiceSnapshotValue_(payment.installment_id),
        amount: normalizeInvoiceSnapshotNumber_(payment.amount),
        reference_no: normalizeInvoiceSnapshotValue_(payment.reference_no),
        notes: normalizeInvoiceSnapshotValue_(payment.notes)
      };
    }).sort(function(a, b) {
      return String(a.payment_id || a.payment_date || a.amount).localeCompare(
        String(b.payment_id || b.payment_date || b.amount)
      );
    }),

    installments: installments.map(function(row) {
      return {
        installment_id: normalizeInvoiceSnapshotValue_(row.installment_id),
        installment_no: normalizeInvoiceSnapshotNumber_(row.installment_no),
        due_date: normalizeInvoiceSnapshotValue_(row.due_date).slice(0, 10),
        amount_due: normalizeInvoiceSnapshotNumber_(row.amount_due),
        paid_amount: normalizeInvoiceSnapshotNumber_(row.paid_amount),
        outstanding_amount: normalizeInvoiceSnapshotNumber_(row.outstanding_amount),
        status: normalizeInvoiceSnapshotValue_(row.status),
        notes: normalizeInvoiceSnapshotValue_(row.notes)
      };
    }).sort(function(a, b) {
      return Number(a.installment_no || 0) - Number(b.installment_no || 0);
    })
  };
}

function buildBillingInvoiceSnapshot_(billingId, options) {
  const opts = options || {};

  if (opts.detail) {
    return buildBillingInvoiceSnapshotFromDetail_(opts.detail);
  }

  const billingRes = getBillingByIdUnlocked_(billingId, {
    recalculate: opts.recalculate !== false
  });

  if (!billingRes || !billingRes.success) {
    throw new Error((billingRes && billingRes.message) || 'Data billing tidak ditemukan');
  }

  return buildBillingInvoiceSnapshotFromDetail_(billingRes.data || {});
}

function buildBillingInvoiceSignature_(billingId, options) {
  const snapshot = buildBillingInvoiceSnapshot_(billingId, options || {});
  return hashInvoiceSnapshot_(JSON.stringify(snapshot));
}

function getBillingInvoiceFreshnessInfo_(billingId, deliveryInfo, options) {
  const opts = options || {};
  const info = deliveryInfo || {};
  const hasPdf = !!String(info.invoice_pdf_url || '').trim();

  const storedSignature = String(info.invoice_pdf_signature || '').trim();
  const currentSignature = buildBillingInvoiceSignature_(billingId, {
    detail: opts.detail || null,
    recalculate: opts.recalculate !== false
  });

  const isFresh = hasPdf && storedSignature && storedSignature === currentSignature;
  const needsRegenerate = hasPdf && (!storedSignature || storedSignature !== currentSignature);

  let status = 'not_generated';
  let label = 'PDF belum dibuat';
  let message = 'PDF invoice belum dibuat. Generate PDF sebelum mengirim email.';

  if (hasPdf && isFresh) {
    status = 'fresh';
    label = 'PDF fresh';
    message = 'PDF invoice masih sesuai dengan data billing terbaru.';
  }

  if (hasPdf && needsRegenerate) {
    status = 'stale';
    label = 'PDF perlu diperbarui';
    message = 'Data billing berubah setelah PDF terakhir dibuat. Generate PDF terbaru sebelum mengirim email.';
  }

  return {
    invoice_pdf_status: status,
    invoice_pdf_status_label: label,
    invoice_pdf_status_message: message,
    invoice_pdf_is_fresh: isFresh,
    invoice_pdf_needs_regenerate: needsRegenerate,
    invoice_pdf_current_signature: currentSignature,
    invoice_pdf_signature: storedSignature
  };
}

function markBillingInvoiceStaleAfterDataChange_(billingId, options) {
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

  const hasInvoiceArtifact =
    !!String(billing.invoice_pdf_file_id || '').trim() ||
    !!String(billing.invoice_pdf_url || '').trim() ||
    !!String(billing.invoice_pdf_signature || '').trim() ||
    !!String(billing.invoice_sent_to || '').trim() ||
    !!String(billing.invoice_sent_at || '').trim();

  if (!hasInvoiceArtifact) {
    return {
      success: true,
      message: 'Billing belum memiliki invoice PDF/email, status invoice tidak perlu diubah',
      data: {
        billing_id: normalizedBillingId,
        marked_stale: false,
        invoice_delivery_status: String(billing.invoice_delivery_status || '')
      }
    };
  }

  const currentStatus = String(billing.invoice_delivery_status || '').trim().toLowerCase();

  if (currentStatus === 'stale') {
    return {
      success: true,
      message: 'Invoice sudah berstatus stale',
      data: {
        billing_id: normalizedBillingId,
        marked_stale: false,
        invoice_delivery_status: 'stale'
      }
    };
  }

  const updated = {
    invoice_delivery_status: 'stale',
    updated_at: nowIso()
  };

  const ok = dbUpdateById_('Billings', 'billing_id', normalizedBillingId, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal menandai invoice sebagai stale'
    };
  }

  return {
    success: true,
    message: 'Invoice ditandai stale karena data billing berubah',
    data: {
      billing_id: normalizedBillingId,
      marked_stale: true,
      reason: String(opts.reason || ''),
      previous_invoice_delivery_status: String(billing.invoice_delivery_status || ''),
      invoice_delivery_status: 'stale'
    }
  };
}

function getBillingInvoiceDeliveryInfo(payload) {
  const permission = requireFinancePermission_(payload, 'read_billing_invoice_delivery_info');

  if (!permission.success) {
    return permission;
  }

  const normalizedBillingId = String((payload && payload.billing_id) || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const detailRes = getBillingDetailForInvoice_(normalizedBillingId, {
    recalculate: true
  });

  if (!detailRes || !detailRes.success) {
    return {
      success: false,
      message: (detailRes && detailRes.message) || 'Data billing tidak ditemukan'
    };
  }

  const detail = detailRes.data || {};
  const billing = detail.billing || {};

  if (!billing || !billing.billing_id) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  const email = findFinancePatientEmail_(billing, '');

  const deliveryInfo = {
    billing_id: normalizedBillingId,
    billing_number: String(billing.billing_number || ''),
    patient_id: String(billing.patient_id || ''),
    patient_name: String(billing.patient_name || ''),
    suggested_email: email,

    invoice_pdf_file_id: String(billing.invoice_pdf_file_id || ''),
    invoice_pdf_url: String(billing.invoice_pdf_url || ''),
    invoice_sent_to: String(billing.invoice_sent_to || ''),
    invoice_sent_at: formatCellValue(billing.invoice_sent_at || ''),
    invoice_delivery_status: String(billing.invoice_delivery_status || ''),

    invoice_pdf_signature: String(billing.invoice_pdf_signature || ''),
    invoice_pdf_signature_at: formatCellValue(billing.invoice_pdf_signature_at || '')
  };

  let freshnessInfo = null;

  try {
    freshnessInfo = getBillingInvoiceFreshnessInfo_(
      normalizedBillingId,
      deliveryInfo,
      {
        detail: detail,
        recalculate: false
      }
    );
  } catch (err) {
    const hasPdf = !!String(deliveryInfo.invoice_pdf_url || '').trim();

    freshnessInfo = {
      invoice_pdf_status: hasPdf ? 'unknown' : 'not_generated',
      invoice_pdf_status_label: hasPdf ? 'Status PDF tidak bisa dicek' : 'PDF belum dibuat',
      invoice_pdf_status_message: hasPdf
        ? 'Sistem tidak dapat memeriksa apakah PDF invoice masih fresh. Generate ulang PDF untuk memastikan invoice terbaru.'
        : 'PDF invoice belum dibuat. Generate PDF sebelum mengirim email.',
      invoice_pdf_is_fresh: false,
      invoice_pdf_needs_regenerate: hasPdf,
      invoice_pdf_current_signature: '',
      invoice_pdf_signature: String(deliveryInfo.invoice_pdf_signature || '')
    };
  }

  return {
    success: true,
    data: Object.assign({}, deliveryInfo, freshnessInfo)
  };
}

function testFinanceInvoiceFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-8-FinanceInvoiceService-FreezeGuard',
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
    before_invoice_summary: {},
    after_invoice_summary: {},
    checks: {
      default_off_generate_normal_flow_reached: false,
      default_off_send_normal_flow_reached: false,
      simulated_freeze_generate_blocked: false,
      simulated_freeze_send_blocked: false,
      counts_unchanged: false,
      invoice_summary_unchanged: false
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
      billing_feedbacks: getBillingFeedbacksRaw().length
    };
  }

  function getInvoiceSummary_() {
    const billings = getBillingsRaw();

    return {
      invoice_pdf_file_id_count: billings.filter(function(row) {
        return String(row.invoice_pdf_file_id || '').trim();
      }).length,
      invoice_pdf_url_count: billings.filter(function(row) {
        return String(row.invoice_pdf_url || '').trim();
      }).length,
      invoice_sent_to_count: billings.filter(function(row) {
        return String(row.invoice_sent_to || '').trim();
      }).length,
      invoice_sent_at_count: billings.filter(function(row) {
        return String(row.invoice_sent_at || '').trim();
      }).length,
      invoice_signature_count: billings.filter(function(row) {
        return String(row.invoice_pdf_signature || '').trim();
      }).length,
      invoice_delivery_sent_count: billings.filter(function(row) {
        return String(row.invoice_delivery_status || '').trim().toLowerCase() === 'sent';
      }).length,
      invoice_delivery_generated_count: billings.filter(function(row) {
        return String(row.invoice_delivery_status || '').trim().toLowerCase() === 'generated';
      }).length,
      invoice_delivery_stale_count: billings.filter(function(row) {
        return String(row.invoice_delivery_status || '').trim().toLowerCase() === 'stale';
      }).length
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
        msg === 'Data billing tidak ditemukan' ||
        msg === 'Sesi login tidak ditemukan. Silakan login ulang.' ||
        msg.indexOf('Sesi login') !== -1 ||
        msg.indexOf('Akses ditolak') !== -1 ||
        msg.indexOf('Tidak memiliki akses') !== -1 ||
        msg.indexOf('Terjadi kesalahan') !== -1
      )
    );
  }

  try {
    result.before_counts = getCounts_();
    result.before_invoice_summary = getInvoiceSummary_();

    if (
      result.flags.default_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_supabase_test_enabled !== false ||
      result.flags.supabase_staging_write_test_enabled !== false ||
      result.flags.production_mutation_freeze_enabled !== false
    ) {
      addIssue('FLAGS_NOT_SAFE_DEFAULT_OFF', result.flags);
    }

    const defaultOffGenerate = generateBillingInvoicePdf({
      billing_id: '',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.default_off_generate = defaultOffGenerate && defaultOffGenerate.message
      ? defaultOffGenerate.message
      : '';

    result.checks.default_off_generate_normal_flow_reached = isNormalPermissionOrValidationMessage_(defaultOffGenerate);

    if (!result.checks.default_off_generate_normal_flow_reached) {
      addIssue('DEFAULT_OFF_GENERATE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffGenerate
      });
    }

    const defaultOffSend = sendBillingInvoiceEmail({
      billing_id: '',
      email_to: '',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.default_off_send = defaultOffSend && defaultOffSend.message
      ? defaultOffSend.message
      : '';

    result.checks.default_off_send_normal_flow_reached = isNormalPermissionOrValidationMessage_(defaultOffSend);

    if (!result.checks.default_off_send_normal_flow_reached) {
      addIssue('DEFAULT_OFF_SEND_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffSend
      });
    }

    const simulatedFreezeGenerate = generateBillingInvoicePdf({
      __test_freeze_enabled: true,
      billing_id: 'BIL-20260505-140855694-907',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_generate = simulatedFreezeGenerate && simulatedFreezeGenerate.message
      ? simulatedFreezeGenerate.message
      : '';

    result.checks.simulated_freeze_generate_blocked = isFreezeMessage_(simulatedFreezeGenerate);

    if (!result.checks.simulated_freeze_generate_blocked) {
      addIssue('SIMULATED_FREEZE_GENERATE_NOT_BLOCKED', {
        response: simulatedFreezeGenerate
      });
    }

    const simulatedFreezeSend = sendBillingInvoiceEmail({
      __test_freeze_enabled: true,
      billing_id: 'BIL-20260505-140855694-907',
      email_to: 'test@example.com',
      actor_role: 'owner',
      actor_user_id: 'USR-OWNER'
    });

    result.messages.simulated_freeze_send = simulatedFreezeSend && simulatedFreezeSend.message
      ? simulatedFreezeSend.message
      : '';

    result.checks.simulated_freeze_send_blocked = isFreezeMessage_(simulatedFreezeSend);

    if (!result.checks.simulated_freeze_send_blocked) {
      addIssue('SIMULATED_FREEZE_SEND_NOT_BLOCKED', {
        response: simulatedFreezeSend
      });
    }

    result.after_counts = getCounts_();
    result.after_invoice_summary = getInvoiceSummary_();

    result.checks.counts_unchanged =
      result.after_counts.billings === result.before_counts.billings &&
      result.after_counts.billing_feedbacks === result.before_counts.billing_feedbacks;

    if (!result.checks.counts_unchanged) {
      addIssue('FINANCE_INVOICE_COUNTS_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_counts,
        after: result.after_counts
      });
    }

    result.checks.invoice_summary_unchanged =
      JSON.stringify(result.after_invoice_summary) === JSON.stringify(result.before_invoice_summary);

    if (!result.checks.invoice_summary_unchanged) {
      addIssue('FINANCE_INVOICE_FIELDS_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_invoice_summary,
        after: result.after_invoice_summary
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-8-FinanceInvoiceService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_INVOICE_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}