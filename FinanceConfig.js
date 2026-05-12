/* =========================================================
   FINANCE CONFIG / SHEET SETUP
   Schema, setup sheet, audit final, hardening Finance,
   dan manual tests
   ========================================================= */

/* =========================================================
   1. FINANCE SHEETS SCHEMA
   ========================================================= */

const FINANCE_SHEETS_SCHEMA = {
  Billings: {
    headers: [
      'billing_id',
      'billing_number',
      'treatment_id',
      'appointment_id',
      'patient_id',
      'patient_name',
      'billing_date',
      'due_date',
      'subtotal',
      'discount_total',
      'grand_total',
      'paid_total',
      'outstanding_total',
      'payment_status',
      'billing_status',
      'payment_type',
      'payment_terms',
      'notes',
      'invoice_pdf_file_id',
      'invoice_pdf_url',
      'invoice_sent_to',
      'invoice_sent_at',
      'invoice_delivery_status',
      'invoice_pdf_signature',
      'invoice_pdf_signature_at',
      'created_at',
      'updated_at'
    ],
    textColumns: [
      'billing_id',
      'billing_number',
      'treatment_id',
      'appointment_id',
      'patient_id',
      'patient_name',
      'billing_date',
      'due_date',
      'payment_status',
      'billing_status',
      'payment_type',
      'payment_terms',
      'notes',
      'invoice_pdf_file_id',
      'invoice_pdf_url',
      'invoice_sent_to',
      'invoice_sent_at',
      'invoice_delivery_status',
      'invoice_pdf_signature',
      'invoice_pdf_signature_at',
      'created_at',
      'updated_at'
    ],
    numberColumns: [
      'subtotal',
      'discount_total',
      'grand_total',
      'paid_total',
      'outstanding_total'
    ]
  },

  BillingItems: {
    headers: [
      'billing_item_id',
      'billing_id',
      'treatment_id',
      'treatment_item_id',
      'service_id',
      'service_name',
      'qty',
      'unit_price',
      'subtotal',
      'created_at',
      'updated_at'
    ],
    textColumns: [
      'billing_item_id',
      'billing_id',
      'treatment_id',
      'treatment_item_id',
      'service_id',
      'service_name',
      'created_at',
      'updated_at'
    ],
    numberColumns: [
      'qty',
      'unit_price',
      'subtotal'
    ]
  },

  BillingAdjustments: {
    headers: [
      'adjustment_id',
      'billing_id',
      'adjustment_type',
      'label',
      'amount',
      'reason',
      'created_by',
      'created_at',
      'updated_at'
    ],
    textColumns: [
      'adjustment_id',
      'billing_id',
      'adjustment_type',
      'label',
      'reason',
      'created_by',
      'created_at',
      'updated_at'
    ],
    numberColumns: [
      'amount'
    ]
  },

  BillingInstallments: {
    headers: [
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
    ],
    textColumns: [
      'installment_id',
      'billing_id',
      'due_date',
      'status',
      'paid_at',
      'notes',
      'created_at',
      'updated_at'
    ],
    numberColumns: [
      'installment_no',
      'amount_due',
      'paid_amount'
    ]
  },

  Payments: {
    headers: [
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
    ],
    textColumns: [
      'payment_id',
      'billing_id',
      'payment_scope',
      'installment_id',
      'payment_date',
      'payment_method',
      'reference_no',
      'received_by',
      'notes',
      'created_at',
      'updated_at'
    ],
    numberColumns: [
      'amount'
    ]
  },

  BillingFeedbacks: {
    headers: [
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
      'patient_name',
      'created_at',
      'updated_at'
    ],
    textColumns: [
      'feedback_id',
      'billing_id',
      'feedback_token',
      'feedback_status',
      'service_quality',
      'staff_friendliness',
      'clinic_cleanliness',
      'waiting_time',
      'comment',
      'submitted_at',
      'patient_id',
      'patient_name',
      'created_at',
      'updated_at'
    ],
    numberColumns: [
      'rating'
    ]
  }
};

/* =========================================================
   2. FINANCE SHEET SETUP
   ========================================================= */

function setupFinanceSheets() {
  const ss = getSpreadsheet();

  const result = {
    success: true,
    message: 'Setup sheet Finance selesai',
    created_sheets: [],
    updated_sheets: [],
    checked_sheets: []
  };

  Object.keys(FINANCE_SHEETS_SCHEMA).forEach(function(sheetName) {
    const config = FINANCE_SHEETS_SCHEMA[sheetName];
    const setupResult = ensureFinanceSheet_(ss, sheetName, config.headers);

    if (setupResult.created) {
      result.created_sheets.push(sheetName);
    }

    if (setupResult.updated) {
      result.updated_sheets.push(sheetName);
    }

    result.checked_sheets.push(sheetName);

    hardenFinanceSheetColumns_(
      setupResult.sheet,
      config.textColumns || [],
      config.numberColumns || []
    );
  });

  return result;
}

/*
  Compatibility wrapper.
  Dipertahankan sementara agar pemanggilan lama tidak rusak.
  Setelah H10 final dan semua pemanggilan sudah memakai setupFinanceSheets(),
  wrapper ini boleh dihapus.
*/
function setupFinanceStage1Sheets() {
  return setupFinanceSheets();
}

function setupBillingInstallmentsSheet() {
  const setupRes = setupFinanceSheets();

  if (!setupRes || !setupRes.success) {
    return {
      success: false,
      message: 'Gagal menyiapkan sheet BillingInstallments'
    };
  }

  return {
    success: true,
    message: 'Sheet BillingInstallments berhasil disiapkan',
    headers: FINANCE_SHEETS_SCHEMA.BillingInstallments.headers
  };
}

function ensureFinanceSheet_(ss, sheetName, requiredHeaders) {
  let sheet = ss.getSheetByName(sheetName);
  let created = false;
  let updated = false;

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);

    created = true;
    updated = true;

    return {
      sheet: sheet,
      created: created,
      updated: updated
    };
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  if (!currentHeaders.some(function(header) {
    return !!header;
  })) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);

    updated = true;

    return {
      sheet: sheet,
      created: created,
      updated: updated
    };
  }

  const missingHeaders = requiredHeaders.filter(function(header) {
    return currentHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    const startColumn = sheet.getLastColumn() + 1;
    sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
    updated = true;
  }

  sheet.setFrozenRows(1);

  return {
    sheet: sheet,
    created: created,
    updated: updated
  };
}

function hardenFinanceSheetColumns_(sheet, textColumns, numberColumns) {
  const lastColumn = sheet.getLastColumn();
  const maxRows = sheet.getMaxRows();

  if (!lastColumn || !maxRows) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  (textColumns || []).forEach(function(headerName) {
    const colIndex = headers.indexOf(headerName) + 1;

    if (colIndex > 0) {
      sheet.getRange(1, colIndex, maxRows, 1).setNumberFormat('@');
    }
  });

  (numberColumns || []).forEach(function(headerName) {
    const colIndex = headers.indexOf(headerName) + 1;

    if (colIndex > 0) {
      sheet.getRange(1, colIndex, maxRows, 1).setNumberFormat('#,##0');
    }
  });
}

/* =========================================================
   3. FINANCE BASIC SHEET AUDIT
   ========================================================= */

function auditFinanceSheets() {
  const ss = getSpreadsheet();

  const result = {
    success: true,
    total_issues: 0,
    sheets: {}
  };

  Object.keys(FINANCE_SHEETS_SCHEMA).forEach(function(sheetName) {
    const config = FINANCE_SHEETS_SCHEMA[sheetName];
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      result.sheets[sheetName] = {
        exists: false,
        missing_headers: config.headers
      };

      result.total_issues += config.headers.length;
      return;
    }

    const lastColumn = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
      .map(function(header) {
        return String(header || '').trim();
      });

    const missingHeaders = config.headers.filter(function(header) {
      return headers.indexOf(header) === -1;
    });

    result.sheets[sheetName] = {
      exists: true,
      missing_headers: missingHeaders
    };

    result.total_issues += missingHeaders.length;
  });

  return result;
}

/*
  Compatibility wrapper.
  Dipertahankan sementara agar pemanggilan lama tidak rusak.
  Setelah H10 final dan semua pemanggilan sudah memakai auditFinanceSheets(),
  wrapper ini boleh dihapus.
*/
function auditFinanceStage1Sheets() {
  return auditFinanceSheets();
}

/* =========================================================
   4. FINANCE FINAL HEALTH AUDIT
   ========================================================= */

function auditFinanceFinalHealth_() {
  const report = {
    success: false,
    module: 'Finance',
    audit_name: 'Finance Final Health Audit',
    started_at: nowIso(),
    finished_at: '',
    summary: {
      error_count: 0,
      warning_count: 0,
      total_issues: 0
    },
    errors: [],
    warnings: [],
    sheets: {},
    totals_audit: {},
    relation_audit: {}
  };

  if (typeof FINANCE_SHEETS_SCHEMA === 'undefined') {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'FINANCE_SCHEMA_MISSING',
      'FINANCE_SHEETS_SCHEMA tidak ditemukan',
      {}
    );

    report.finished_at = nowIso();
    report.success = false;
    return report;
  }

  const ss = getSpreadsheet();
  const tables = {};

  Object.keys(FINANCE_SHEETS_SCHEMA).forEach(function(sheetName) {
    const schema = FINANCE_SHEETS_SCHEMA[sheetName];
    const table = readFinanceFinalHealthSheet_(ss, sheetName);

    tables[sheetName] = table;

    auditFinanceFinalHealthSheetStructure_(report, table, schema);
    auditFinanceFinalHealthColumnFormats_(report, table, schema);
    auditFinanceFinalHealthTextValues_(report, table, schema);
    auditFinanceFinalHealthDateOnlyValues_(report, table);
    auditFinanceFinalHealthNumberValues_(report, table, schema);
    auditFinanceFinalHealthDuplicatePrimaryId_(report, table, schema);
  });

  auditFinanceFinalHealthRelations_(report, tables);
  auditFinanceFinalHealthBillingTotals_(report, tables);
  auditFinanceFinalHealthInstallmentConsistency_(report, tables);

  report.summary.total_issues =
    Number(report.summary.error_count || 0) +
    Number(report.summary.warning_count || 0);

  report.success = Number(report.summary.error_count || 0) === 0;
  report.finished_at = nowIso();

  return report;
}

function readFinanceFinalHealthSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  const table = {
    sheet_name: sheetName,
    exists: !!sheet,
    sheet: sheet || null,
    last_row: 0,
    last_column: 0,
    headers: [],
    header_map: {},
    records: []
  };

  if (!sheet) {
    return table;
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  table.last_row = lastRow;
  table.last_column = lastColumn;

  if (lastRow < 1 || lastColumn < 1) {
    return table;
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  table.headers = headers;

  headers.forEach(function(header, index) {
    const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);

    if (normalizedHeader) {
      table.header_map[normalizedHeader] = {
        name: header,
        column: index + 1
      };
    }
  });

  if (lastRow < 2) {
    return table;
  }

  const rowCount = lastRow - 1;
  const rawValues = sheet.getRange(2, 1, rowCount, lastColumn).getValues();
  const displayValues = sheet.getRange(2, 1, rowCount, lastColumn).getDisplayValues();

  rawValues.forEach(function(rawRow, rowIndex) {
    const displayRow = displayValues[rowIndex];

    const isEmptyRow = displayRow.every(function(cell) {
      return String(cell || '').trim() === '';
    });

    if (isEmptyRow) return;

    const raw = {};
    const display = {};

    headers.forEach(function(header, colIndex) {
      const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);
      if (!normalizedHeader) return;

      raw[normalizedHeader] = rawRow[colIndex];
      display[normalizedHeader] = displayRow[colIndex];
    });

    table.records.push({
      row_number: rowIndex + 2,
      raw: raw,
      display: display
    });
  });

  return table;
}

function auditFinanceFinalHealthSheetStructure_(report, table, schema) {
  const sheetName = table.sheet_name;

  report.sheets[sheetName] = {
    exists: table.exists,
    last_row: table.last_row,
    last_column: table.last_column,
    data_rows: table.records.length,
    missing_headers: [],
    blank_header_columns: [],
    duplicate_headers: [],
    extra_headers: []
  };

  if (!table.exists) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'SHEET_MISSING',
      'Sheet Finance tidak ditemukan: ' + sheetName,
      {
        sheet: sheetName
      }
    );
    return;
  }

  if (!table.headers.length) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'HEADER_ROW_EMPTY',
      'Header sheet kosong: ' + sheetName,
      {
        sheet: sheetName
      }
    );
    return;
  }

  const blankHeaderColumns = [];

  table.headers.forEach(function(header, index) {
    if (!String(header || '').trim()) {
      blankHeaderColumns.push(index + 1);
    }
  });

  if (blankHeaderColumns.length) {
    report.sheets[sheetName].blank_header_columns = blankHeaderColumns;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'BLANK_HEADER',
      'Ada header kosong pada sheet ' + sheetName,
      {
        sheet: sheetName,
        columns: blankHeaderColumns
      }
    );
  }

  const duplicateHeaders = findFinanceFinalHealthDuplicateHeaders_(table.headers);

  if (duplicateHeaders.length) {
    report.sheets[sheetName].duplicate_headers = duplicateHeaders;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'DUPLICATE_HEADER',
      'Ada header duplikat pada sheet ' + sheetName,
      {
        sheet: sheetName,
        duplicate_headers: duplicateHeaders
      }
    );
  }

  const requiredHeaders = schema.headers || [];
  const currentHeaderMap = {};

  table.headers.forEach(function(header) {
    currentHeaderMap[normalizeFinanceFinalHealthHeader_(header)] = true;
  });

  const missingHeaders = requiredHeaders.filter(function(header) {
    return !currentHeaderMap[normalizeFinanceFinalHealthHeader_(header)];
  });

  if (missingHeaders.length) {
    report.sheets[sheetName].missing_headers = missingHeaders;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'MISSING_HEADER',
      'Ada header wajib yang hilang pada sheet ' + sheetName,
      {
        sheet: sheetName,
        missing_headers: missingHeaders
      }
    );
  }

  const schemaHeaderMap = {};

  requiredHeaders.forEach(function(header) {
    schemaHeaderMap[normalizeFinanceFinalHealthHeader_(header)] = true;
  });

  const extraHeaders = table.headers.filter(function(header) {
    const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);
    return normalizedHeader && !schemaHeaderMap[normalizedHeader];
  });

  if (extraHeaders.length) {
    report.sheets[sheetName].extra_headers = extraHeaders;

    addFinanceFinalHealthIssue_(
      report,
      'warning',
      'EXTRA_HEADER',
      'Ada header tambahan di luar FINANCE_SHEETS_SCHEMA pada sheet ' + sheetName,
      {
        sheet: sheetName,
        extra_headers: extraHeaders
      }
    );
  }
}

function auditFinanceFinalHealthColumnFormats_(report, table, schema) {
  if (!table.exists || !table.sheet || !table.headers.length) return;

  const sheetName = table.sheet_name;
  const sheet = table.sheet;
  const textColumns = schema.textColumns || [];
  const numberColumns = schema.numberColumns || [];

  textColumns.forEach(function(header) {
    const col = getFinanceFinalHealthColumn_(table, header);
    if (!col) return;

    const format = sheet.getRange(1, col, 1, 1).getNumberFormat();

    if (format !== '@') {
      addFinanceFinalHealthIssue_(
        report,
        'warning',
        'TEXT_COLUMN_FORMAT_NOT_PLAIN_TEXT',
        'Kolom text belum memakai format Plain Text pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          column: col,
          current_format: format,
          expected_format: '@'
        }
      );
    }
  });

  numberColumns.forEach(function(header) {
    const col = getFinanceFinalHealthColumn_(table, header);
    if (!col) return;

    const format = sheet.getRange(1, col, 1, 1).getNumberFormat();

    if (format !== '#,##0') {
      addFinanceFinalHealthIssue_(
        report,
        'warning',
        'NUMBER_COLUMN_FORMAT_NOT_STANDARD',
        'Kolom angka belum memakai format standar #,##0 pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          column: col,
          current_format: format,
          expected_format: '#,##0'
        }
      );
    }
  });
}

function auditFinanceFinalHealthTextValues_(report, table, schema) {
  if (!table.exists) return;

  const sheetName = table.sheet_name;
  const textColumns = schema.textColumns || [];

  textColumns.forEach(function(header) {
    if (!hasFinanceFinalHealthHeader_(table, header)) return;

    const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);
    const invalidRows = [];

    table.records.forEach(function(record) {
      const displayValue = String(record.display[normalizedHeader] || '').trim();
      const rawValue = record.raw[normalizedHeader];

      if (!displayValue) return;

      if (typeof rawValue === 'number') {
        invalidRows.push({
          row: record.row_number,
          value: rawValue,
          reason: 'raw value bertipe number'
        });
      }

      if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
        invalidRows.push({
          row: record.row_number,
          value: displayValue,
          reason: 'raw value bertipe Date'
        });
      }
    });

    if (invalidRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'error',
        'TEXT_COLUMN_HAS_NON_TEXT_VALUE',
        'Kolom text/ID memiliki raw value non-text pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: invalidRows.slice(0, 30),
          total_rows: invalidRows.length
        }
      );
    }
  });
}

function auditFinanceFinalHealthDateOnlyValues_(report, table) {
  if (!table || !table.exists) return;

  const sheetName = table.sheet_name;
  const dateColumnsMap = getFinanceFinalHealthDateOnlyColumnsMap_();
  const dateColumns = dateColumnsMap[sheetName] || [];

  if (!dateColumns.length) return;

  dateColumns.forEach(function(header) {
    if (!hasFinanceFinalHealthHeader_(table, header)) return;

    const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);
    const invalidRows = [];

    table.records.forEach(function(record) {
      const displayValue = String(record.display[normalizedHeader] || '').trim();
      const rawValue = record.raw[normalizedHeader];

      if (!displayValue) {
        invalidRows.push({
          row: record.row_number,
          value: '',
          reason: 'tanggal wajib diisi'
        });
        return;
      }

      if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
        invalidRows.push({
          row: record.row_number,
          value: displayValue,
          reason: 'raw value masih bertipe Date, seharusnya text yyyy-MM-dd'
        });
        return;
      }

      if (!isFinanceFinalHealthDateOnlyYmdText_(displayValue)) {
        invalidRows.push({
          row: record.row_number,
          value: displayValue,
          reason: 'format tanggal harus yyyy-MM-dd'
        });
      }
    });

    if (invalidRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'error',
        'DATE_ONLY_VALUE_NOT_STANDARD',
        'Kolom tanggal Finance harus berupa teks yyyy-MM-dd pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: invalidRows.slice(0, 30),
          total_rows: invalidRows.length
        }
      );
    }
  });
}

function getFinanceFinalHealthDateOnlyColumnsMap_() {
  return {
    Billings: [
      'billing_date',
      'due_date'
    ],
    BillingInstallments: [
      'due_date'
    ],
    Payments: [
      'payment_date'
    ]
  };
}

function isFinanceFinalHealthDateOnlyYmdText_(value) {
  const text = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  if (typeof isValidYmdDate === 'function') {
    return isValidYmdDate(text);
  }

  const parts = text.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function auditFinanceFinalHealthNumberValues_(report, table, schema) {
  if (!table.exists) return;

  const sheetName = table.sheet_name;
  const numberColumns = schema.numberColumns || [];

  numberColumns.forEach(function(header) {
    if (!hasFinanceFinalHealthHeader_(table, header)) return;

    const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);
    const invalidRows = [];
    const negativeRows = [];
    const blankRows = [];
    const requiredBlankRows = [];
    const domainInvalidRows = [];

    table.records.forEach(function(record) {
      const parsed = parseFinanceFinalHealthNumber_(
        record.raw[normalizedHeader],
        record.display[normalizedHeader]
      );

      if (parsed.blank) {
        if (isFinanceFinalHealthAllowedBlankNumber_(table, record, header)) {
          return;
        }

        if (isFinanceFinalHealthRequiredBlankNumber_(table, record, header)) {
          requiredBlankRows.push(record.row_number);
          return;
        }

        blankRows.push(record.row_number);
        return;
      }

      if (!parsed.valid) {
        invalidRows.push({
          row: record.row_number,
          value: record.display[normalizedHeader]
        });
        return;
      }

      if (parsed.value < 0) {
        negativeRows.push({
          row: record.row_number,
          value: parsed.value
        });
      }

      const domainValidation = validateFinanceFinalHealthNumberDomain_(
        table,
        record,
        header,
        parsed.value
      );

      if (!domainValidation.valid) {
        domainInvalidRows.push({
          row: record.row_number,
          value: parsed.value,
          reason: domainValidation.reason
        });
      }
    });

    if (invalidRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'error',
        'INVALID_NUMBER_VALUE',
        'Kolom angka memiliki value tidak valid pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: invalidRows.slice(0, 30),
          total_rows: invalidRows.length
        }
      );
    }

    if (negativeRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'error',
        'NEGATIVE_NUMBER_VALUE',
        'Kolom angka memiliki value negatif pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: negativeRows.slice(0, 30),
          total_rows: negativeRows.length
        }
      );
    }

    if (requiredBlankRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'error',
        'REQUIRED_NUMBER_VALUE_BLANK',
        'Kolom angka wajib tidak boleh kosong pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: requiredBlankRows.slice(0, 30),
          total_rows: requiredBlankRows.length
        }
      );
    }

    if (domainInvalidRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'error',
        'NUMBER_VALUE_OUT_OF_ALLOWED_RANGE',
        'Kolom angka memiliki value di luar batas yang diizinkan pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: domainInvalidRows.slice(0, 30),
          total_rows: domainInvalidRows.length
        }
      );
    }

    if (blankRows.length) {
      addFinanceFinalHealthIssue_(
        report,
        'warning',
        'BLANK_NUMBER_VALUE',
        'Kolom angka memiliki value kosong pada sheet ' + sheetName,
        {
          sheet: sheetName,
          header: header,
          rows: blankRows.slice(0, 30),
          total_rows: blankRows.length
        }
      );
    }
  });
}

function isFinanceFinalHealthAllowedBlankNumber_(table, record, header) {
  if (!table || !record) return false;

  const sheetName = String(table.sheet_name || '').trim();
  const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);

  if (sheetName === 'BillingFeedbacks' && normalizedHeader === 'rating') {
    const status = String(record.display.feedback_status || '').trim().toLowerCase();

    return status !== 'submitted';
  }

  return false;
}

function isFinanceFinalHealthRequiredBlankNumber_(table, record, header) {
  if (!table || !record) return false;

  const sheetName = String(table.sheet_name || '').trim();
  const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);

  if (sheetName === 'BillingFeedbacks' && normalizedHeader === 'rating') {
    const status = String(record.display.feedback_status || '').trim().toLowerCase();

    return status === 'submitted';
  }

  return false;
}

function validateFinanceFinalHealthNumberDomain_(table, record, header, value) {
  if (!table || !record) {
    return {
      valid: true
    };
  }

  const sheetName = String(table.sheet_name || '').trim();
  const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);

  if (sheetName === 'BillingFeedbacks' && normalizedHeader === 'rating') {
    const status = String(record.display.feedback_status || '').trim().toLowerCase();
    const rating = Number(value || 0);

    if (status === 'submitted') {
      if (rating < 1 || rating > 5 || Math.floor(rating) !== rating) {
        return {
          valid: false,
          reason: 'Rating feedback submitted harus angka bulat 1 sampai 5'
        };
      }
    }
  }

  return {
    valid: true
  };
}

function auditFinanceFinalHealthDuplicatePrimaryId_(report, table, schema) {
  if (!table.exists) return;

  const sheetName = table.sheet_name;
  const idHeader = (schema.headers || [])[0];

  if (!idHeader || !hasFinanceFinalHealthHeader_(table, idHeader)) return;

  const normalizedIdHeader = normalizeFinanceFinalHealthHeader_(idHeader);
  const seen = {};
  const duplicates = [];
  const blankRows = [];

  table.records.forEach(function(record) {
    const idValue = String(record.display[normalizedIdHeader] || '').trim();

    if (!idValue) {
      blankRows.push(record.row_number);
      return;
    }

    if (seen[idValue]) {
      duplicates.push({
        id: idValue,
        first_row: seen[idValue],
        duplicate_row: record.row_number
      });
    } else {
      seen[idValue] = record.row_number;
    }
  });

  if (blankRows.length) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'EMPTY_PRIMARY_ID',
      'Ada baris tanpa primary ID pada sheet ' + sheetName,
      {
        sheet: sheetName,
        id_header: idHeader,
        rows: blankRows.slice(0, 30),
        total_rows: blankRows.length
      }
    );
  }

  if (duplicates.length) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'DUPLICATE_PRIMARY_ID',
      'Ada primary ID duplikat pada sheet ' + sheetName,
      {
        sheet: sheetName,
        id_header: idHeader,
        duplicates: duplicates.slice(0, 30),
        total_duplicates: duplicates.length
      }
    );
  }
}

function auditFinanceFinalHealthRelations_(report, tables) {
  const billingsTable = tables.Billings;

  report.relation_audit = {
    billing_count: 0,
    orphan_items: 0,
    orphan_adjustments: 0,
    orphan_installments: 0,
    orphan_payments: 0,
    orphan_feedbacks: 0,
    invalid_payment_installments: 0
  };

  if (!billingsTable || !billingsTable.exists || !hasFinanceFinalHealthHeader_(billingsTable, 'billing_id')) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'BILLING_ID_UNAVAILABLE_FOR_RELATION_AUDIT',
      'Audit relasi tidak bisa dilakukan karena Billings.billing_id tidak tersedia',
      {}
    );
    return;
  }

  const billingMap = buildFinanceFinalHealthIdMap_(billingsTable, 'billing_id');
  report.relation_audit.billing_count = Object.keys(billingMap).length;

  auditFinanceFinalHealthChildBillingRelation_(
    report,
    tables.BillingItems,
    billingMap,
    'BillingItems',
    'orphan_items'
  );

  auditFinanceFinalHealthChildBillingRelation_(
    report,
    tables.BillingAdjustments,
    billingMap,
    'BillingAdjustments',
    'orphan_adjustments'
  );

  auditFinanceFinalHealthChildBillingRelation_(
    report,
    tables.BillingInstallments,
    billingMap,
    'BillingInstallments',
    'orphan_installments'
  );

  auditFinanceFinalHealthChildBillingRelation_(
    report,
    tables.Payments,
    billingMap,
    'Payments',
    'orphan_payments'
  );

  auditFinanceFinalHealthChildBillingRelation_(
    report,
    tables.BillingFeedbacks,
    billingMap,
    'BillingFeedbacks',
    'orphan_feedbacks'
  );

  auditFinanceFinalHealthPaymentInstallmentRelation_(report, tables);
}

function auditFinanceFinalHealthChildBillingRelation_(report, childTable, billingMap, childName, summaryKey) {
  if (!childTable || !childTable.exists) return;
  if (!hasFinanceFinalHealthHeader_(childTable, 'billing_id')) return;

  const normalizedBillingHeader = normalizeFinanceFinalHealthHeader_('billing_id');
  const emptyRows = [];
  const orphanRows = [];

  childTable.records.forEach(function(record) {
    const billingId = String(record.display[normalizedBillingHeader] || '').trim();

    if (!billingId) {
      emptyRows.push(record.row_number);
      return;
    }

    if (!billingMap[billingId]) {
      orphanRows.push({
        row: record.row_number,
        billing_id: billingId
      });
    }
  });

  if (emptyRows.length) {
    report.relation_audit[summaryKey] =
      Number(report.relation_audit[summaryKey] || 0) + emptyRows.length;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'CHILD_EMPTY_BILLING_ID',
      'Ada data ' + childName + ' tanpa billing_id',
      {
        sheet: childName,
        rows: emptyRows.slice(0, 30),
        total_rows: emptyRows.length
      }
    );
  }

  if (orphanRows.length) {
    report.relation_audit[summaryKey] =
      Number(report.relation_audit[summaryKey] || 0) + orphanRows.length;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'CHILD_WITHOUT_BILLING',
      'Ada data ' + childName + ' dengan billing_id yang tidak ada di Billings',
      {
        sheet: childName,
        rows: orphanRows.slice(0, 30),
        total_rows: orphanRows.length
      }
    );
  }
}

function auditFinanceFinalHealthPaymentInstallmentRelation_(report, tables) {
  const paymentsTable = tables.Payments;
  const installmentsTable = tables.BillingInstallments;

  if (!paymentsTable || !paymentsTable.exists) return;
  if (!installmentsTable || !installmentsTable.exists) return;

  if (!hasFinanceFinalHealthHeader_(paymentsTable, 'installment_id')) return;
  if (!hasFinanceFinalHealthHeader_(paymentsTable, 'billing_id')) return;
  if (!hasFinanceFinalHealthHeader_(installmentsTable, 'installment_id')) return;
  if (!hasFinanceFinalHealthHeader_(installmentsTable, 'billing_id')) return;

  const installmentMap = buildFinanceFinalHealthIdMap_(installmentsTable, 'installment_id');
  const invalidRows = [];
  const billingMismatchRows = [];

  paymentsTable.records.forEach(function(record) {
    const paymentScope = String(record.display.payment_scope || '').trim().toLowerCase();
    const installmentId = String(record.display.installment_id || '').trim();
    const billingId = String(record.display.billing_id || '').trim();

    if (!installmentId) return;

    const installment = installmentMap[installmentId];

    if (!installment) {
      invalidRows.push({
        row: record.row_number,
        payment_scope: paymentScope,
        billing_id: billingId,
        installment_id: installmentId
      });
      return;
    }

    const installmentBillingId = String(installment.record.display.billing_id || '').trim();

    if (billingId && installmentBillingId && billingId !== installmentBillingId) {
      billingMismatchRows.push({
        row: record.row_number,
        payment_billing_id: billingId,
        installment_billing_id: installmentBillingId,
        installment_id: installmentId
      });
    }
  });

  if (invalidRows.length) {
    report.relation_audit.invalid_payment_installments =
      Number(report.relation_audit.invalid_payment_installments || 0) + invalidRows.length;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'PAYMENT_INSTALLMENT_NOT_FOUND',
      'Ada payment dengan installment_id yang tidak ditemukan di BillingInstallments',
      {
        sheet: 'Payments',
        rows: invalidRows.slice(0, 30),
        total_rows: invalidRows.length
      }
    );
  }

  if (billingMismatchRows.length) {
    report.relation_audit.invalid_payment_installments =
      Number(report.relation_audit.invalid_payment_installments || 0) + billingMismatchRows.length;

    addFinanceFinalHealthIssue_(
      report,
      'error',
      'PAYMENT_INSTALLMENT_BILLING_MISMATCH',
      'Ada payment installment yang billing_id-nya tidak sesuai dengan BillingInstallments',
      {
        sheet: 'Payments',
        rows: billingMismatchRows.slice(0, 30),
        total_rows: billingMismatchRows.length
      }
    );
  }
}

function auditFinanceFinalHealthBillingTotals_(report, tables) {
  const billingsTable = tables.Billings;
  const itemsTable = tables.BillingItems;
  const adjustmentsTable = tables.BillingAdjustments;
  const paymentsTable = tables.Payments;

  report.totals_audit = {
    checked_billings: 0,
    subtotal_mismatch: 0,
    discount_total_mismatch: 0,
    grand_total_mismatch: 0,
    paid_total_mismatch: 0,
    outstanding_total_mismatch: 0,
    payment_status_mismatch: 0
  };

  if (!billingsTable || !billingsTable.exists) return;

  const requiredBillingHeaders = [
    'billing_id',
    'subtotal',
    'discount_total',
    'grand_total',
    'paid_total',
    'outstanding_total',
    'payment_status'
  ];

  const missingBillingHeaders = requiredBillingHeaders.filter(function(header) {
    return !hasFinanceFinalHealthHeader_(billingsTable, header);
  });

  if (missingBillingHeaders.length) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'BILLING_TOTAL_AUDIT_HEADER_MISSING',
      'Audit sinkronisasi total billing tidak bisa lengkap karena header Billings ada yang hilang',
      {
        missing_headers: missingBillingHeaders
      }
    );
    return;
  }

  const itemSubtotalMap = buildFinanceFinalHealthSumMap_(itemsTable, 'billing_id', 'subtotal');
  const adjustmentDiscountMap = buildFinanceFinalHealthAdjustmentDiscountMap_(adjustmentsTable);
  const paymentAmountMap = buildFinanceFinalHealthSumMap_(paymentsTable, 'billing_id', 'amount');

  const subtotalMismatchRows = [];
  const discountMismatchRows = [];
  const grandMismatchRows = [];
  const paidMismatchRows = [];
  const outstandingMismatchRows = [];
  const paymentStatusMismatchRows = [];

  billingsTable.records.forEach(function(record) {
    const billingId = String(record.display.billing_id || '').trim();
    if (!billingId) return;

    report.totals_audit.checked_billings++;

    const expectedSubtotal = roundFinanceFinalHealthAmount_(itemSubtotalMap[billingId] || 0);
    const expectedDiscount = roundFinanceFinalHealthAmount_(adjustmentDiscountMap[billingId] || 0);
    const expectedGrandTotal = Math.max(0, roundFinanceFinalHealthAmount_(expectedSubtotal - expectedDiscount));
    const expectedPaidTotal = roundFinanceFinalHealthAmount_(paymentAmountMap[billingId] || 0);
    const expectedOutstandingTotal = Math.max(0, roundFinanceFinalHealthAmount_(expectedGrandTotal - expectedPaidTotal));
    const expectedPaymentStatus = calculateFinanceFinalHealthPaymentStatus_(expectedGrandTotal, expectedPaidTotal);

    const actualSubtotal = getFinanceFinalHealthNumberFromRecord_(record, 'subtotal');
    const actualDiscount = getFinanceFinalHealthNumberFromRecord_(record, 'discount_total');
    const actualGrandTotal = getFinanceFinalHealthNumberFromRecord_(record, 'grand_total');
    const actualPaidTotal = getFinanceFinalHealthNumberFromRecord_(record, 'paid_total');
    const actualOutstandingTotal = getFinanceFinalHealthNumberFromRecord_(record, 'outstanding_total');
    const actualPaymentStatus = String(record.display.payment_status || '').trim().toLowerCase();

    if (actualSubtotal.valid && !isFinanceFinalHealthAmountEqual_(actualSubtotal.value, expectedSubtotal)) {
      subtotalMismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        expected: expectedSubtotal,
        actual: actualSubtotal.value
      });
    }

    if (actualDiscount.valid && !isFinanceFinalHealthAmountEqual_(actualDiscount.value, expectedDiscount)) {
      discountMismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        expected: expectedDiscount,
        actual: actualDiscount.value
      });
    }

    if (actualGrandTotal.valid && !isFinanceFinalHealthAmountEqual_(actualGrandTotal.value, expectedGrandTotal)) {
      grandMismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        expected: expectedGrandTotal,
        actual: actualGrandTotal.value
      });
    }

    if (actualPaidTotal.valid && !isFinanceFinalHealthAmountEqual_(actualPaidTotal.value, expectedPaidTotal)) {
      paidMismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        expected: expectedPaidTotal,
        actual: actualPaidTotal.value
      });
    }

    if (actualOutstandingTotal.valid && !isFinanceFinalHealthAmountEqual_(actualOutstandingTotal.value, expectedOutstandingTotal)) {
      outstandingMismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        expected: expectedOutstandingTotal,
        actual: actualOutstandingTotal.value
      });
    }

    if (actualPaymentStatus && actualPaymentStatus !== expectedPaymentStatus) {
      paymentStatusMismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        expected: expectedPaymentStatus,
        actual: actualPaymentStatus
      });
    }
  });

  report.totals_audit.subtotal_mismatch = subtotalMismatchRows.length;
  report.totals_audit.discount_total_mismatch = discountMismatchRows.length;
  report.totals_audit.grand_total_mismatch = grandMismatchRows.length;
  report.totals_audit.paid_total_mismatch = paidMismatchRows.length;
  report.totals_audit.outstanding_total_mismatch = outstandingMismatchRows.length;
  report.totals_audit.payment_status_mismatch = paymentStatusMismatchRows.length;

  addFinanceFinalHealthMismatchIssue_(
    report,
    'BILLING_SUBTOTAL_NOT_SYNC',
    'Ada subtotal billing yang tidak sinkron dengan BillingItems.subtotal',
    subtotalMismatchRows
  );

  addFinanceFinalHealthMismatchIssue_(
    report,
    'BILLING_DISCOUNT_TOTAL_NOT_SYNC',
    'Ada discount_total billing yang tidak sinkron dengan BillingAdjustments',
    discountMismatchRows
  );

  addFinanceFinalHealthMismatchIssue_(
    report,
    'BILLING_GRAND_TOTAL_NOT_SYNC',
    'Ada grand_total billing yang tidak sinkron dengan subtotal - discount_total',
    grandMismatchRows
  );

  addFinanceFinalHealthMismatchIssue_(
    report,
    'BILLING_PAID_TOTAL_NOT_SYNC',
    'Ada paid_total billing yang tidak sinkron dengan total Payments.amount',
    paidMismatchRows
  );

  addFinanceFinalHealthMismatchIssue_(
    report,
    'BILLING_OUTSTANDING_TOTAL_NOT_SYNC',
    'Ada outstanding_total billing yang tidak sinkron dengan grand_total - paid_total',
    outstandingMismatchRows
  );

  addFinanceFinalHealthMismatchIssue_(
    report,
    'BILLING_PAYMENT_STATUS_NOT_SYNC',
    'Ada payment_status billing yang tidak sinkron dengan grand_total dan paid_total',
    paymentStatusMismatchRows
  );
}

function auditFinanceFinalHealthInstallmentConsistency_(report, tables) {
  const billingsTable = tables.Billings;
  const installmentsTable = tables.BillingInstallments;

  if (!billingsTable || !billingsTable.exists) return;
  if (!installmentsTable || !installmentsTable.exists) return;

  if (!hasFinanceFinalHealthHeader_(billingsTable, 'billing_id')) return;
  if (!hasFinanceFinalHealthHeader_(billingsTable, 'grand_total')) return;
  if (!hasFinanceFinalHealthHeader_(installmentsTable, 'billing_id')) return;
  if (!hasFinanceFinalHealthHeader_(installmentsTable, 'amount_due')) return;

  const installmentAmountMap = buildFinanceFinalHealthSumMap_(installmentsTable, 'billing_id', 'amount_due');
  const installmentCountMap = buildFinanceFinalHealthCountMap_(installmentsTable, 'billing_id');
  const mismatchRows = [];

  billingsTable.records.forEach(function(record) {
    const billingId = String(record.display.billing_id || '').trim();
    if (!billingId) return;

    const installmentCount = Number(installmentCountMap[billingId] || 0);
    if (installmentCount <= 0) return;

    const grandTotal = getFinanceFinalHealthNumberFromRecord_(record, 'grand_total');
    const totalInstallment = roundFinanceFinalHealthAmount_(installmentAmountMap[billingId] || 0);

    if (grandTotal.valid && !isFinanceFinalHealthAmountEqual_(grandTotal.value, totalInstallment)) {
      mismatchRows.push({
        row: record.row_number,
        billing_id: billingId,
        installment_count: installmentCount,
        expected_from_grand_total: grandTotal.value,
        actual_installment_total: totalInstallment
      });
    }
  });

  if (mismatchRows.length) {
    addFinanceFinalHealthIssue_(
      report,
      'error',
      'INSTALLMENT_TOTAL_NOT_SYNC_WITH_BILLING',
      'Ada total cicilan yang tidak sama dengan grand_total billing',
      {
        rows: mismatchRows.slice(0, 30),
        total_rows: mismatchRows.length
      }
    );
  }
}

/* =========================================================
   5. FINAL HEALTH HELPERS
   ========================================================= */

function addFinanceFinalHealthMismatchIssue_(report, code, message, rows) {
  if (!rows || !rows.length) return;

  addFinanceFinalHealthIssue_(
    report,
    'error',
    code,
    message,
    {
      rows: rows.slice(0, 30),
      total_rows: rows.length
    }
  );
}

function buildFinanceFinalHealthIdMap_(table, idHeader) {
  const map = {};

  if (!table || !table.exists || !hasFinanceFinalHealthHeader_(table, idHeader)) {
    return map;
  }

  const normalizedHeader = normalizeFinanceFinalHealthHeader_(idHeader);

  table.records.forEach(function(record) {
    const idValue = String(record.display[normalizedHeader] || '').trim();

    if (idValue) {
      map[idValue] = {
        row_number: record.row_number,
        record: record
      };
    }
  });

  return map;
}

function buildFinanceFinalHealthSumMap_(table, keyHeader, amountHeader) {
  const map = {};

  if (!table || !table.exists) return map;
  if (!hasFinanceFinalHealthHeader_(table, keyHeader)) return map;
  if (!hasFinanceFinalHealthHeader_(table, amountHeader)) return map;

  const normalizedKey = normalizeFinanceFinalHealthHeader_(keyHeader);
  const normalizedAmount = normalizeFinanceFinalHealthHeader_(amountHeader);

  table.records.forEach(function(record) {
    const key = String(record.display[normalizedKey] || '').trim();
    if (!key) return;

    const parsed = parseFinanceFinalHealthNumber_(
      record.raw[normalizedAmount],
      record.display[normalizedAmount]
    );

    if (!parsed.valid || parsed.blank) return;

    map[key] = Number(map[key] || 0) + Number(parsed.value || 0);
  });

  return map;
}

function buildFinanceFinalHealthCountMap_(table, keyHeader) {
  const map = {};

  if (!table || !table.exists) return map;
  if (!hasFinanceFinalHealthHeader_(table, keyHeader)) return map;

  const normalizedKey = normalizeFinanceFinalHealthHeader_(keyHeader);

  table.records.forEach(function(record) {
    const key = String(record.display[normalizedKey] || '').trim();
    if (!key) return;

    map[key] = Number(map[key] || 0) + 1;
  });

  return map;
}

function buildFinanceFinalHealthAdjustmentDiscountMap_(adjustmentsTable) {
  const map = {};

  if (!adjustmentsTable || !adjustmentsTable.exists) return map;
  if (!hasFinanceFinalHealthHeader_(adjustmentsTable, 'billing_id')) return map;
  if (!hasFinanceFinalHealthHeader_(adjustmentsTable, 'amount')) return map;

  adjustmentsTable.records.forEach(function(record) {
    const billingId = String(record.display.billing_id || '').trim();
    if (!billingId) return;

    const type = String(record.display.adjustment_type || '').trim().toLowerCase();

    if (
      type !== 'discount' &&
      type !== 'manual_adjustment' &&
      type !== 'voucher'
    ) {
      return;
    }

    const amount = getFinanceFinalHealthNumberFromRecord_(record, 'amount');

    if (!amount.valid || amount.blank) return;

    map[billingId] = Number(map[billingId] || 0) + Number(amount.value || 0);
  });

  return map;
}

function calculateFinanceFinalHealthPaymentStatus_(grandTotal, paidTotal) {
  if (typeof calculateBillingPaymentStatus === 'function') {
    return calculateBillingPaymentStatus(grandTotal, paidTotal);
  }

  const total = Number(grandTotal || 0);
  const paid = Number(paidTotal || 0);

  if (total <= 0) return 'paid';
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';

  return 'partial';
}

function getFinanceFinalHealthColumn_(table, header) {
  const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);
  const found = table.header_map[normalizedHeader];

  return found ? found.column : 0;
}

function hasFinanceFinalHealthHeader_(table, header) {
  if (!table || !table.header_map) return false;

  return !!table.header_map[normalizeFinanceFinalHealthHeader_(header)];
}

function normalizeFinanceFinalHealthHeader_(header) {
  return String(header || '').trim().toLowerCase();
}

function findFinanceFinalHealthDuplicateHeaders_(headers) {
  const seen = {};
  const duplicates = [];

  (headers || []).forEach(function(header) {
    const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);

    if (!normalizedHeader) return;

    if (seen[normalizedHeader] && duplicates.indexOf(normalizedHeader) === -1) {
      duplicates.push(normalizedHeader);
    }

    seen[normalizedHeader] = true;
  });

  return duplicates;
}

function getFinanceFinalHealthNumberFromRecord_(record, header) {
  const normalizedHeader = normalizeFinanceFinalHealthHeader_(header);

  return parseFinanceFinalHealthNumber_(
    record.raw[normalizedHeader],
    record.display[normalizedHeader]
  );
}

function parseFinanceFinalHealthNumber_(rawValue, displayValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    const displayText = String(displayValue || '').trim();

    if (!displayText) {
      return {
        blank: true,
        valid: true,
        value: 0
      };
    }
  }

  if (typeof rawValue === 'number') {
    if (!isFinite(rawValue)) {
      return {
        blank: false,
        valid: false,
        value: 0
      };
    }

    return {
      blank: false,
      valid: true,
      value: Number(rawValue)
    };
  }

  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return {
      blank: false,
      valid: false,
      value: 0
    };
  }

  let text = String(
    displayValue !== undefined && displayValue !== null
      ? displayValue
      : rawValue
  ).trim();

  if (!text) {
    return {
      blank: true,
      valid: true,
      value: 0
    };
  }

  text = text
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/[^\d,.\-]/g, '');

  if (!text || text === '-' || text === ',' || text === '.') {
    return {
      blank: false,
      valid: false,
      value: 0
    };
  }

  const hasDot = text.indexOf('.') !== -1;
  const hasComma = text.indexOf(',') !== -1;

  if (hasDot && hasComma) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaParts = text.split(',');

    if (commaParts.length > 2) {
      text = text.replace(/,/g, '');
    } else if (commaParts[1] && commaParts[1].length === 3) {
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(',', '.');
    }
  } else if (hasDot) {
    const dotParts = text.split('.');

    if (dotParts.length > 2) {
      text = text.replace(/\./g, '');
    } else if (dotParts[1] && dotParts[1].length === 3) {
      text = text.replace(/\./g, '');
    }
  }

  const numberValue = Number(text);

  if (!isFinite(numberValue)) {
    return {
      blank: false,
      valid: false,
      value: 0
    };
  }

  return {
    blank: false,
    valid: true,
    value: numberValue
  };
}

function roundFinanceFinalHealthAmount_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isFinanceFinalHealthAmountEqual_(a, b) {
  return Math.abs(
    roundFinanceFinalHealthAmount_(a) - roundFinanceFinalHealthAmount_(b)
  ) <= 0.01;
}

function addFinanceFinalHealthIssue_(report, severity, code, message, detail) {
  const issue = {
    severity: severity,
    code: code,
    message: message,
    detail: detail || {}
  };

  if (severity === 'error') {
    report.summary.error_count++;
    report.errors.push(issue);
  } else {
    report.summary.warning_count++;
    report.warnings.push(issue);
  }
}

/* =========================================================
   6. FINANCE FINAL HARDENING
   ========================================================= */

function hardenFinanceFinalHealth_() {
  const setupResult = setupFinanceSheets();
  const stageAudit = auditFinanceSheets();
  const finalAudit = auditFinanceFinalHealth_();

  const issues = [];

  if (!setupResult || !setupResult.success) {
    issues.push('Setup Finance sheet gagal');
  }

  if (stageAudit && Number(stageAudit.total_issues || 0) > 0) {
    issues.push('Masih ada issue pada audit header Finance');
  }

  if (finalAudit && !finalAudit.success) {
    issues.push('Masih ada error kritis pada audit final Finance');
  }

  return {
    success: issues.length === 0,
    message: issues.length === 0
      ? 'Finance final hardening lulus'
      : 'Finance final hardening menemukan issue',
    total_issues: issues.length,
    issues: issues,
    setup_result: setupResult,
    stage_audit: stageAudit,
    final_audit_summary: finalAudit ? finalAudit.summary : null,
    final_audit_errors: finalAudit ? finalAudit.errors : [],
    final_audit_warnings: finalAudit ? finalAudit.warnings : []
  };
}

/* =========================================================
   7. FINANCE TEXT COLUMN HARDENING
   ========================================================= */

function hardenFinanceTextColumnValues_() {
  const result = {
    success: true,
    message: 'Hardening text column Finance selesai',
    sheets: {},
    total_updated_cells: 0
  };

  setupFinanceSheets();

  Object.keys(FINANCE_SHEETS_SCHEMA).forEach(function(sheetName) {
    const schema = FINANCE_SHEETS_SCHEMA[sheetName];
    const textColumns = schema.textColumns || [];

    const sheet = getSpreadsheet().getSheetByName(sheetName);

    result.sheets[sheetName] = {
      exists: !!sheet,
      updated_cells: 0,
      updated_columns: []
    };

    if (!sheet) {
      result.success = false;
      result.sheets[sheetName].message = 'Sheet tidak ditemukan';
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 2 || lastColumn < 1) {
      return;
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
      .map(function(header) {
        return String(header || '').trim();
      });

    textColumns.forEach(function(headerName) {
      const colIndex = headers.indexOf(headerName) + 1;

      if (colIndex <= 0) return;

      const range = sheet.getRange(2, colIndex, lastRow - 1, 1);
      const displayValues = range.getDisplayValues();

      range.setNumberFormat('@');

      const textValues = displayValues.map(function(row) {
        return [String(row[0] || '').trim()];
      });

      range.setValues(textValues);

      result.sheets[sheetName].updated_columns.push(headerName);
      result.sheets[sheetName].updated_cells += textValues.length;
      result.total_updated_cells += textValues.length;
    });
  });

  setupFinanceSheets();

  result.audit_after = auditFinanceFinalHealth_();
  result.success = result.success && result.audit_after.success;

  return result;
}

function hardenFinanceTextColumnsForObjectRow_(sheetName, idHeader, idValue, sourceObject) {
  const schema = FINANCE_SHEETS_SCHEMA[sheetName];

  if (!schema) {
    return {
      success: false,
      message: 'Schema Finance tidak ditemukan untuk sheet: ' + sheetName
    };
  }

  const normalizedIdValue = String(idValue || '').trim();

  if (!normalizedIdValue) {
    return {
      success: false,
      message: 'ID row tidak ditemukan untuk hardening text columns'
    };
  }

  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return {
      success: true,
      message: 'Sheet belum memiliki data row',
      updated_cells: 0
    };
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });

  const idCol = headers.indexOf(idHeader) + 1;

  if (idCol <= 0) {
    return {
      success: false,
      message: 'Kolom ID tidak ditemukan: ' + idHeader
    };
  }

  const idValues = sheet.getRange(2, idCol, lastRow - 1, 1).getDisplayValues();

  let targetRow = 0;

  idValues.some(function(row, index) {
    if (String(row[0] || '').trim() === normalizedIdValue) {
      targetRow = index + 2;
      return true;
    }

    return false;
  });

  if (!targetRow) {
    return {
      success: false,
      message: 'Row target tidak ditemukan untuk ID: ' + normalizedIdValue
    };
  }

  let updatedCells = 0;
  const updatedColumns = [];
  const textColumns = schema.textColumns || [];
  const source = sourceObject || {};

  textColumns.forEach(function(headerName) {
    const colIndex = headers.indexOf(headerName) + 1;

    if (colIndex <= 0) return;

    const range = sheet.getRange(targetRow, colIndex, 1, 1);

    let textValue = '';

    if (Object.prototype.hasOwnProperty.call(source, headerName)) {
      textValue = String(source[headerName] === null || source[headerName] === undefined ? '' : source[headerName]).trim();
    } else {
      textValue = String(range.getDisplayValue() || '').trim();
    }

    range.setNumberFormat('@');
    range.setValue(textValue);

    updatedCells++;
    updatedColumns.push(headerName);
  });

  return {
    success: true,
    message: 'Text columns row berhasil di-hardening',
    sheet: sheetName,
    row: targetRow,
    id_header: idHeader,
    id_value: normalizedIdValue,
    updated_cells: updatedCells,
    updated_columns: updatedColumns
  };
}

/* =========================================================
   8. FINANCE MANUAL TESTS / DEV ONLY
   Function di bawah ini hanya untuk audit manual,
   regression check, dan hardening selama development.
   Tidak dipanggil otomatis oleh UI Finance.
   ========================================================= */

const FINANCE_ENABLE_H94B_DEV_AUTO_REGRESSION = false;

function runFinanceH94BAutoCheck() {
  const enabled =
    typeof FINANCE_ENABLE_H94B_DEV_AUTO_REGRESSION !== 'undefined' &&
    FINANCE_ENABLE_H94B_DEV_AUTO_REGRESSION === true;

  if (!enabled) {
    const result = {
      success: true,
      skipped: true,
      dev_only: true,
      message: 'H9-4B auto regression tidak dijalankan karena flag DEV nonaktif.',
      instruction: 'Ubah FINANCE_ENABLE_H94B_DEV_AUTO_REGRESSION menjadi true hanya saat development/manual regression, lalu kembalikan ke false.',
      checked_at: nowIso()
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  return runFinanceH94BAutoCheckUnsafe_();
}

function runFinanceH94BAutoCheckUnsafe_() {
  const result = {
    success: true,
    failed_count: 0,
    checked_at: nowIso(),
    checks: []
  };

  function addCheck(name, ok, message, data) {
    const item = {
      name: name,
      success: !!ok,
      message: message || (ok ? 'OK' : 'FAILED')
    };

    if (data !== undefined) {
      item.data = data;
    }

    result.checks.push(item);

    if (!ok) {
      result.success = false;
      result.failed_count++;
    }
  }

  function getFinanceH94BTestAuthContext_() {
    const users = dbFindAll_('Users') || [];

    const user = users.find(function(row) {
      const role = String(row.role || '').trim().toLowerCase();
      const isActive = String(row.is_active || '').trim().toLowerCase() !== 'false';

      return isActive && (role === 'owner' || role === 'admin');
    });

    if (!user) {
      throw new Error('Tidak ada user owner/admin aktif untuk menjalankan auto check.');
    }

    const session = createAuthSession_(user);

    return {
      session_token: session.session_token
    };
  }

  try {
    const authContext = getFinanceH94BTestAuthContext_();

    const summaryToday = getFinanceSummary(Object.assign({}, authContext, {
      period: 'today'
    }));

    addCheck(
      'Finance Summary - Today',
      summaryToday && summaryToday.success,
      summaryToday && summaryToday.message ? summaryToday.message : 'Summary today berhasil dipanggil'
    );

    const summary7Days = getFinanceSummary(Object.assign({}, authContext, {
      period: '7days'
    }));

    addCheck(
      'Finance Summary - 7 Days',
      summary7Days && summary7Days.success,
      summary7Days && summary7Days.message ? summary7Days.message : 'Summary 7 days berhasil dipanggil'
    );

    const summary30Days = getFinanceSummary(Object.assign({}, authContext, {
      period: '30days'
    }));

    addCheck(
      'Finance Summary - 30 Days',
      summary30Days && summary30Days.success,
      summary30Days && summary30Days.message ? summary30Days.message : 'Summary 30 days berhasil dipanggil'
    );

    const billingList = getBillingList(Object.assign({}, authContext));

    addCheck(
      'Billing List',
      billingList && billingList.success && Array.isArray(billingList.data),
      billingList && billingList.message ? billingList.message : 'Billing list berhasil dipanggil',
      {
        count: billingList && Array.isArray(billingList.data) ? billingList.data.length : 0
      }
    );

    const receivables = getReceivablesReport(Object.assign({}, authContext));

    addCheck(
      'Receivables Report',
      receivables && receivables.success,
      receivables && receivables.message ? receivables.message : 'Receivables berhasil dipanggil'
    );

    const firstBilling = billingList &&
      billingList.success &&
      Array.isArray(billingList.data) &&
      billingList.data.length
        ? billingList.data[0]
        : null;

    if (!firstBilling || !firstBilling.billing_id) {
      addCheck(
        'Detail Billing Sample',
        true,
        'Tidak ada billing sample. Check detail dilewati.'
      );
    } else {
      const billingId = firstBilling.billing_id;

      const detail = getBillingById(Object.assign({}, authContext, {
        billing_id: billingId
      }));

      addCheck(
        'Detail Billing Sample',
        detail && detail.success && detail.data && detail.data.billing,
        detail && detail.message ? detail.message : 'Detail billing berhasil dipanggil',
        {
          billing_id: billingId
        }
      );

      const installmentPlan = getBillingInstallmentPlan(Object.assign({}, authContext, {
        billing_id: billingId
      }));

      addCheck(
        'Installment Plan Read',
        installmentPlan && installmentPlan.success,
        installmentPlan && installmentPlan.message ? installmentPlan.message : 'Jadwal cicilan berhasil dipanggil',
        {
          billing_id: billingId
        }
      );

      const installmentPolicy = getBillingInstallmentChangePolicy(Object.assign({}, authContext, {
        billing_id: billingId
      }));

      addCheck(
        'Installment Change Policy',
        installmentPolicy && installmentPolicy.success,
        installmentPolicy && installmentPolicy.message ? installmentPolicy.message : 'Policy cicilan berhasil dipanggil',
        {
          billing_id: billingId
        }
      );

      const invoiceInfo = getBillingInvoiceDeliveryInfo(Object.assign({}, authContext, {
        billing_id: billingId
      }));

      addCheck(
        'Invoice Digital Info',
        invoiceInfo && invoiceInfo.success,
        invoiceInfo && invoiceInfo.message ? invoiceInfo.message : 'Info invoice digital berhasil dipanggil',
        {
          billing_id: billingId
        }
      );
    }
  } catch (err) {
    addCheck(
      'Auto Check Runner',
      false,
      err && err.message ? err.message : String(err)
    );
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}