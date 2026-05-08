/* =========================================================
   DATABASE MIGRATION AUDIT - PHASE 1
   Audit struktur Google Spreadsheet saat ini
   Aman: tidak mengubah data utama, hanya membuat sheet audit
   ========================================================= */

function runMigrationDatabaseAuditPhase1() {
  const ss = getMigrationAuditSpreadsheet_();

  const audit = buildMigrationDatabaseAudit_(ss);

  writeMigrationAuditSheets_(ss, audit);

  Logger.log(JSON.stringify({
    success: true,
    spreadsheet_name: ss.getName(),
    spreadsheet_id: ss.getId(),
    sheet_count: audit.sheets.length,
    column_count: audit.columns.length,
    warning_count: audit.warnings.length,
    audit_sheets: [
      'DB_AUDIT_SHEETS',
      'DB_AUDIT_COLUMNS',
      'DB_AUDIT_WARNINGS'
    ]
  }, null, 2));

  return {
    success: true,
    spreadsheet_name: ss.getName(),
    spreadsheet_id: ss.getId(),
    sheet_count: audit.sheets.length,
    column_count: audit.columns.length,
    warning_count: audit.warnings.length
  };
}

function getMigrationAuditSpreadsheet_() {
  let ss = null;

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    ss = null;
  }

  if (ss) return ss;

  const possibleIds = [
    typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : '',
    typeof APP_SPREADSHEET_ID !== 'undefined' ? APP_SPREADSHEET_ID : '',
    typeof DATABASE_SPREADSHEET_ID !== 'undefined' ? DATABASE_SPREADSHEET_ID : ''
  ].filter(Boolean);

  if (possibleIds.length > 0) {
    return SpreadsheetApp.openById(possibleIds[0]);
  }

  throw new Error(
    'Spreadsheet tidak ditemukan. Jalankan script dari project yang terhubung ke Spreadsheet, atau pastikan konstanta SPREADSHEET_ID / APP_SPREADSHEET_ID tersedia.'
  );
}

function buildMigrationDatabaseAudit_(ss) {
  const sheets = [];
  const columns = [];
  const warnings = [];

  const allSheets = ss.getSheets();

  allSheets.forEach(function(sheet) {
    const sheetName = sheet.getName();

    if (isMigrationAuditSheet_(sheetName)) {
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const maxRows = sheet.getMaxRows();
    const maxColumns = sheet.getMaxColumns();

    const headerValues = lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
      : [];

    const normalizedHeaders = headerValues.map(function(header) {
      return normalizeMigrationAuditHeader_(header);
    });

    const duplicateHeaders = findDuplicateValues_(normalizedHeaders.filter(Boolean));
    const blankHeaderIndexes = [];

    normalizedHeaders.forEach(function(header, index) {
      if (!header) blankHeaderIndexes.push(index + 1);
    });

    const dataRowCount = Math.max(0, lastRow - 1);
    const likelyPrimaryKey = detectLikelyPrimaryKey_(normalizedHeaders, sheetName);

    let blankPrimaryKeyCount = '';
    let duplicatePrimaryKeyCount = '';
    let samplePrimaryKeyValues = '';

    if (likelyPrimaryKey) {
      const pkIndex = normalizedHeaders.indexOf(likelyPrimaryKey) + 1;

      if (pkIndex > 0 && dataRowCount > 0) {
        const pkValues = sheet.getRange(2, pkIndex, dataRowCount, 1)
          .getDisplayValues()
          .map(function(row) {
            return String(row[0] || '').trim();
          });

        const nonBlankPkValues = pkValues.filter(Boolean);

        blankPrimaryKeyCount = pkValues.length - nonBlankPkValues.length;
        duplicatePrimaryKeyCount = countDuplicateValues_(nonBlankPkValues);
        samplePrimaryKeyValues = nonBlankPkValues.slice(0, 5).join(', ');
      }
    }

    const formulaCount = countFormulasInSheet_(sheet, lastRow, lastColumn);

    sheets.push({
      sheet_name: sheetName,
      last_row: lastRow,
      last_column: lastColumn,
      data_row_count: dataRowCount,
      max_rows: maxRows,
      max_columns: maxColumns,
      header_count: normalizedHeaders.filter(Boolean).length,
      blank_header_count: blankHeaderIndexes.length,
      duplicate_headers: duplicateHeaders.join(', '),
      likely_primary_key: likelyPrimaryKey || '',
      blank_primary_key_count: blankPrimaryKeyCount,
      duplicate_primary_key_count: duplicatePrimaryKeyCount,
      sample_primary_key_values: samplePrimaryKeyValues,
      formula_count: formulaCount
    });

    if (blankHeaderIndexes.length > 0) {
      warnings.push({
        sheet_name: sheetName,
        type: 'BLANK_HEADER',
        message: 'Ada header kosong di kolom: ' + blankHeaderIndexes.join(', ')
      });
    }

    if (duplicateHeaders.length > 0) {
      warnings.push({
        sheet_name: sheetName,
        type: 'DUPLICATE_HEADER',
        message: 'Ada header duplikat: ' + duplicateHeaders.join(', ')
      });
    }

    if (!likelyPrimaryKey && dataRowCount > 0) {
      warnings.push({
        sheet_name: sheetName,
        type: 'NO_LIKELY_PRIMARY_KEY',
        message: 'Sheet berisi data tetapi primary key belum terdeteksi otomatis.'
      });
    }

    if (duplicatePrimaryKeyCount && Number(duplicatePrimaryKeyCount) > 0) {
      warnings.push({
        sheet_name: sheetName,
        type: 'DUPLICATE_PRIMARY_KEY',
        message: 'Primary key kemungkinan duplikat pada kolom: ' + likelyPrimaryKey
      });
    }

    if (blankPrimaryKeyCount && Number(blankPrimaryKeyCount) > 0) {
      warnings.push({
        sheet_name: sheetName,
        type: 'BLANK_PRIMARY_KEY',
        message: 'Primary key kemungkinan kosong pada kolom: ' + likelyPrimaryKey
      });
    }

    normalizedHeaders.forEach(function(header, index) {
      if (!header) return;

      const colIndex = index + 1;
      const sampleInfo = inspectColumnSample_(sheet, colIndex, dataRowCount);

      columns.push({
        sheet_name: sheetName,
        column_index: colIndex,
        header_name: header,
        raw_header: headerValues[index],
        likely_role: detectLikelyColumnRole_(header),
        inferred_type: sampleInfo.inferred_type,
        non_blank_count: sampleInfo.non_blank_count,
        blank_count: sampleInfo.blank_count,
        sample_values: sampleInfo.sample_values,
        unique_sample_count: sampleInfo.unique_sample_count,
        has_formula: sampleInfo.has_formula ? 'yes' : 'no'
      });
    });
  });

  return {
    sheets: sheets,
    columns: columns,
    warnings: warnings
  };
}

function inspectColumnSample_(sheet, colIndex, dataRowCount) {
  if (dataRowCount <= 0) {
    return {
      inferred_type: 'empty',
      non_blank_count: 0,
      blank_count: 0,
      sample_values: '',
      unique_sample_count: 0,
      has_formula: false
    };
  }

  const sampleSize = Math.min(dataRowCount, 100);
  const values = sheet.getRange(2, colIndex, sampleSize, 1).getValues();
  const displayValues = sheet.getRange(2, colIndex, sampleSize, 1).getDisplayValues();
  const formulas = sheet.getRange(2, colIndex, sampleSize, 1).getFormulas();

  let nonBlankCount = 0;
  let blankCount = 0;
  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let textCount = 0;
  let hasFormula = false;

  const samples = [];
  const uniqueMap = {};

  for (let i = 0; i < sampleSize; i++) {
    const raw = values[i][0];
    const display = String(displayValues[i][0] || '').trim();
    const formula = String(formulas[i][0] || '').trim();

    if (formula) hasFormula = true;

    if (!display) {
      blankCount++;
      continue;
    }

    nonBlankCount++;

    if (samples.length < 5) {
      samples.push(display);
    }

    uniqueMap[display] = true;

    if (Object.prototype.toString.call(raw) === '[object Date]') {
      dateCount++;
    } else if (typeof raw === 'number') {
      numberCount++;
    } else if (typeof raw === 'boolean') {
      booleanCount++;
    } else {
      textCount++;
    }
  }

  return {
    inferred_type: inferMigrationColumnType_(numberCount, dateCount, booleanCount, textCount, nonBlankCount),
    non_blank_count: nonBlankCount,
    blank_count: blankCount,
    sample_values: samples.join(' | '),
    unique_sample_count: Object.keys(uniqueMap).length,
    has_formula: hasFormula
  };
}

function inferMigrationColumnType_(numberCount, dateCount, booleanCount, textCount, nonBlankCount) {
  if (!nonBlankCount) return 'empty';

  const counts = [
    { type: 'date', count: dateCount },
    { type: 'number', count: numberCount },
    { type: 'boolean', count: booleanCount },
    { type: 'text', count: textCount }
  ];

  counts.sort(function(a, b) {
    return b.count - a.count;
  });

  const top = counts[0];

  if (top.count === nonBlankCount) return top.type;

  return 'mixed: ' + counts
    .filter(function(item) {
      return item.count > 0;
    })
    .map(function(item) {
      return item.type + '=' + item.count;
    })
    .join(', ');
}

function detectLikelyPrimaryKey_(headers, sheetName) {
  const normalizedSheet = normalizeMigrationAuditHeader_(sheetName);

  const exactCandidates = [
    normalizedSheet + '_id',
    singularizeMigrationName_(normalizedSheet) + '_id',
    'id'
  ];

  for (let i = 0; i < exactCandidates.length; i++) {
    if (headers.indexOf(exactCandidates[i]) >= 0) {
      return exactCandidates[i];
    }
  }

  const idHeaders = headers.filter(function(header) {
    return /(^id$|_id$)/.test(header);
  });

  if (idHeaders.length === 1) {
    return idHeaders[0];
  }

  const priority = [
    'patient_id',
    'appointment_id',
    'treatment_id',
    'recall_id',
    'billing_id',
    'item_id',
    'adjustment_id',
    'installment_id',
    'payment_id',
    'feedback_id',
    'user_id'
  ];

  for (let j = 0; j < priority.length; j++) {
    if (headers.indexOf(priority[j]) >= 0) {
      return priority[j];
    }
  }

  return '';
}

function detectLikelyColumnRole_(header) {
  if (!header) return '';

  if (/(^id$|_id$)/.test(header)) return 'id_or_foreign_key';
  if (/email/.test(header)) return 'email';
  if (/(phone|telp|whatsapp|wa|mobile)/.test(header)) return 'phone_text';
  if (/(date|tanggal|jatuh_tempo|due)/.test(header)) return 'date_or_datetime';
  if (/(amount|total|subtotal|grand|paid|outstanding|discount|price|nominal|biaya|harga)/.test(header)) return 'amount_number';
  if (/status/.test(header)) return 'status';
  if (/(created_at|updated_at|submitted_at|sent_at|generated_at)/.test(header)) return 'timestamp';
  if (/(token|signature|url|link)/.test(header)) return 'system_text';
  if (/(note|notes|description|comment|catatan)/.test(header)) return 'long_text';

  return 'data';
}

function countFormulasInSheet_(sheet, lastRow, lastColumn) {
  if (lastRow <= 0 || lastColumn <= 0) return 0;

  const formulas = sheet.getRange(1, 1, lastRow, lastColumn).getFormulas();
  let count = 0;

  formulas.forEach(function(row) {
    row.forEach(function(formula) {
      if (formula) count++;
    });
  });

  return count;
}

function writeMigrationAuditSheets_(ss, audit) {
  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_SHEETS',
    [
      'sheet_name',
      'last_row',
      'last_column',
      'data_row_count',
      'max_rows',
      'max_columns',
      'header_count',
      'blank_header_count',
      'duplicate_headers',
      'likely_primary_key',
      'blank_primary_key_count',
      'duplicate_primary_key_count',
      'sample_primary_key_values',
      'formula_count'
    ],
    audit.sheets
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_COLUMNS',
    [
      'sheet_name',
      'column_index',
      'header_name',
      'raw_header',
      'likely_role',
      'inferred_type',
      'non_blank_count',
      'blank_count',
      'sample_values',
      'unique_sample_count',
      'has_formula'
    ],
    audit.columns
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_WARNINGS',
    [
      'sheet_name',
      'type',
      'message'
    ],
    audit.warnings
  );
}

function writeMigrationAuditSheet_(ss, sheetName, headers, rows) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clearContents();

  const values = [headers];

  rows.forEach(function(row) {
    values.push(headers.map(function(header) {
      return row[header] !== undefined && row[header] !== null ? row[header] : '';
    }));
  });

  if (values.length > 0) {
    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function normalizeMigrationAuditHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function singularizeMigrationName_(value) {
  value = String(value || '').trim();

  if (value.endsWith('ies')) {
    return value.slice(0, -3) + 'y';
  }

  if (value.endsWith('s')) {
    return value.slice(0, -1);
  }

  return value;
}

function findDuplicateValues_(values) {
  const seen = {};
  const duplicates = {};

  values.forEach(function(value) {
    if (!value) return;

    if (seen[value]) {
      duplicates[value] = true;
    }

    seen[value] = true;
  });

  return Object.keys(duplicates);
}

function countDuplicateValues_(values) {
  const seen = {};
  const duplicates = {};

  values.forEach(function(value) {
    if (!value) return;

    if (seen[value]) {
      duplicates[value] = true;
    }

    seen[value] = true;
  });

  return Object.keys(duplicates).length;
}

function isMigrationAuditSheet_(sheetName) {
  return isMigrationAuditOutputSheet_(sheetName);
}

/* =========================================================
   DATABASE MIGRATION AUDIT - PHASE 1B
   Validasi Primary Key dan Relasi Antar Sheet
   Aman: tidak mengubah data utama, hanya membuat sheet audit
   ========================================================= */

function runMigrationDatabaseAuditPhase1B() {
  const ss = getMigrationAuditSpreadsheet_();

  const result = buildMigrationDatabaseRelationAudit_(ss);

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_PRIMARY_KEYS',
    [
      'sheet_name',
      'primary_key',
      'data_row_count',
      'blank_pk_count',
      'duplicate_pk_count',
      'duplicate_pk_samples',
      'status'
    ],
    result.primary_keys
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_RELATIONS',
    [
      'relation_name',
      'child_sheet',
      'child_column',
      'parent_sheet',
      'parent_column',
      'checked_child_rows',
      'blank_fk_count',
      'missing_parent_count',
      'missing_parent_samples',
      'status'
    ],
    result.relations
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_RELATION_ISSUES',
    [
      'issue_type',
      'sheet_name',
      'row_number',
      'column_name',
      'value',
      'message'
    ],
    result.issues
  );

  const summary = {
    success: true,
    primary_key_checked: result.primary_keys.length,
    relation_checked: result.relations.length,
    issue_count: result.issues.length,
    audit_sheets: [
      'DB_AUDIT_PRIMARY_KEYS',
      'DB_AUDIT_RELATIONS',
      'DB_AUDIT_RELATION_ISSUES'
    ]
  };

  Logger.log(JSON.stringify(summary, null, 2));

  return summary;
}

function buildMigrationDatabaseRelationAudit_(ss) {
  const tableMap = buildMigrationTableMap_(ss);

  const primaryKeyRules = [
    { sheet: 'Users', primaryKey: 'user_id' },
    { sheet: 'Patients', primaryKey: 'patient_id' },
    { sheet: 'Appointments', primaryKey: 'appointment_id' },
    { sheet: 'ServiceCatalog', primaryKey: 'service_id' },
    { sheet: 'Treatments', primaryKey: 'treatment_id' },
    { sheet: 'TreatmentItems', primaryKey: 'treatment_item_id' },
    { sheet: 'MedicalRecords', primaryKey: 'record_id' },
    { sheet: 'PatientPhotos', primaryKey: 'photo_id' },
    { sheet: 'OrthoRecall', primaryKey: 'ortho_recall_id' },
    { sheet: 'Billings', primaryKey: 'billing_id' },
    { sheet: 'BillingItems', primaryKey: 'billing_item_id' },
    { sheet: 'BillingAdjustments', primaryKey: 'adjustment_id' },
    { sheet: 'BillingInstallments', primaryKey: 'installment_id' },
    { sheet: 'Payments', primaryKey: 'payment_id' },
    { sheet: 'BillingFeedbacks', primaryKey: 'feedback_id' }
  ];

  const relationRules = [
    {
      name: 'Appointments.patient_id -> Patients.patient_id',
      childSheet: 'Appointments',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: false
    },
    {
      name: 'Treatments.appointment_id -> Appointments.appointment_id',
      childSheet: 'Treatments',
      childColumn: 'appointment_id',
      parentSheet: 'Appointments',
      parentColumn: 'appointment_id',
      allowBlank: true
    },
    {
      name: 'Treatments.patient_id -> Patients.patient_id',
      childSheet: 'Treatments',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: false
    },
    {
      name: 'TreatmentItems.treatment_id -> Treatments.treatment_id',
      childSheet: 'TreatmentItems',
      childColumn: 'treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: false
    },
    {
      name: 'TreatmentItems.service_id -> ServiceCatalog.service_id',
      childSheet: 'TreatmentItems',
      childColumn: 'service_id',
      parentSheet: 'ServiceCatalog',
      parentColumn: 'service_id',
      allowBlank: true
    },
    {
      name: 'MedicalRecords.patient_id -> Patients.patient_id',
      childSheet: 'MedicalRecords',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: false
    },
    {
      name: 'MedicalRecords.appointment_id -> Appointments.appointment_id',
      childSheet: 'MedicalRecords',
      childColumn: 'appointment_id',
      parentSheet: 'Appointments',
      parentColumn: 'appointment_id',
      allowBlank: true
    },
    {
      name: 'MedicalRecords.treatment_id -> Treatments.treatment_id',
      childSheet: 'MedicalRecords',
      childColumn: 'treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: false
    },
    {
      name: 'PatientPhotos.patient_id -> Patients.patient_id',
      childSheet: 'PatientPhotos',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: false
    },
    {
      name: 'PatientPhotos.treatment_id -> Treatments.treatment_id',
      childSheet: 'PatientPhotos',
      childColumn: 'treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: true
    },
    {
      name: 'OrthoRecall.patient_id -> Patients.patient_id',
      childSheet: 'OrthoRecall',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: false
    },
    {
      name: 'OrthoRecall.install_treatment_id -> Treatments.treatment_id',
      childSheet: 'OrthoRecall',
      childColumn: 'install_treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: true
    },
    {
      name: 'OrthoRecall.last_control_treatment_id -> Treatments.treatment_id',
      childSheet: 'OrthoRecall',
      childColumn: 'last_control_treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: true
    },
    {
      name: 'Billings.treatment_id -> Treatments.treatment_id',
      childSheet: 'Billings',
      childColumn: 'treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: false
    },
    {
      name: 'Billings.appointment_id -> Appointments.appointment_id',
      childSheet: 'Billings',
      childColumn: 'appointment_id',
      parentSheet: 'Appointments',
      parentColumn: 'appointment_id',
      allowBlank: true
    },
    {
      name: 'Billings.patient_id -> Patients.patient_id',
      childSheet: 'Billings',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: false
    },
    {
      name: 'BillingItems.billing_id -> Billings.billing_id',
      childSheet: 'BillingItems',
      childColumn: 'billing_id',
      parentSheet: 'Billings',
      parentColumn: 'billing_id',
      allowBlank: false
    },
    {
      name: 'BillingItems.treatment_id -> Treatments.treatment_id',
      childSheet: 'BillingItems',
      childColumn: 'treatment_id',
      parentSheet: 'Treatments',
      parentColumn: 'treatment_id',
      allowBlank: false
    },
    {
      name: 'BillingItems.treatment_item_id -> TreatmentItems.treatment_item_id',
      childSheet: 'BillingItems',
      childColumn: 'treatment_item_id',
      parentSheet: 'TreatmentItems',
      parentColumn: 'treatment_item_id',
      allowBlank: true
    },
    {
      name: 'BillingItems.service_id -> ServiceCatalog.service_id',
      childSheet: 'BillingItems',
      childColumn: 'service_id',
      parentSheet: 'ServiceCatalog',
      parentColumn: 'service_id',
      allowBlank: true
    },
    {
      name: 'BillingAdjustments.billing_id -> Billings.billing_id',
      childSheet: 'BillingAdjustments',
      childColumn: 'billing_id',
      parentSheet: 'Billings',
      parentColumn: 'billing_id',
      allowBlank: false
    },
    {
      name: 'BillingAdjustments.created_by -> Users.user_id',
      childSheet: 'BillingAdjustments',
      childColumn: 'created_by',
      parentSheet: 'Users',
      parentColumn: 'user_id',
      allowBlank: true
    },
    {
      name: 'BillingInstallments.billing_id -> Billings.billing_id',
      childSheet: 'BillingInstallments',
      childColumn: 'billing_id',
      parentSheet: 'Billings',
      parentColumn: 'billing_id',
      allowBlank: false
    },
    {
      name: 'Payments.billing_id -> Billings.billing_id',
      childSheet: 'Payments',
      childColumn: 'billing_id',
      parentSheet: 'Billings',
      parentColumn: 'billing_id',
      allowBlank: false
    },
    {
      name: 'Payments.installment_id -> BillingInstallments.installment_id',
      childSheet: 'Payments',
      childColumn: 'installment_id',
      parentSheet: 'BillingInstallments',
      parentColumn: 'installment_id',
      allowBlank: true
    },
    {
      name: 'Payments.received_by -> Users.user_id',
      childSheet: 'Payments',
      childColumn: 'received_by',
      parentSheet: 'Users',
      parentColumn: 'user_id',
      allowBlank: true
    },
    {
      name: 'BillingFeedbacks.billing_id -> Billings.billing_id',
      childSheet: 'BillingFeedbacks',
      childColumn: 'billing_id',
      parentSheet: 'Billings',
      parentColumn: 'billing_id',
      allowBlank: false
    },
    {
      name: 'BillingFeedbacks.patient_id -> Patients.patient_id',
      childSheet: 'BillingFeedbacks',
      childColumn: 'patient_id',
      parentSheet: 'Patients',
      parentColumn: 'patient_id',
      allowBlank: true
    }
  ];

  const primaryKeyResults = [];
  const relationResults = [];
  const issues = [];

  primaryKeyRules.forEach(function(rule) {
    const result = auditMigrationPrimaryKeyRule_(tableMap, rule);

    primaryKeyResults.push(result.summary);

    result.issues.forEach(function(issue) {
      issues.push(issue);
    });
  });

  relationRules.forEach(function(rule) {
    const result = auditMigrationRelationRule_(tableMap, rule);

    relationResults.push(result.summary);

    result.issues.forEach(function(issue) {
      issues.push(issue);
    });
  });

  return {
    primary_keys: primaryKeyResults,
    relations: relationResults,
    issues: issues
  };
}

function buildMigrationTableMap_(ss) {
  const map = {};

  ss.getSheets().forEach(function(sheet) {
    const sheetName = sheet.getName();

    if (isMigrationAuditSheetExtended_(sheetName)) {
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 1 || lastColumn < 1) {
      map[sheetName] = {
        sheet: sheet,
        headers: [],
        headerIndex: {},
        rows: [],
        rowNumbers: []
      };
      return;
    }

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = values[0].map(function(header) {
      return normalizeMigrationAuditHeader_(header);
    });

    const headerIndex = {};
    headers.forEach(function(header, index) {
      if (header) headerIndex[header] = index;
    });

    const rows = [];
    const rowNumbers = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const hasAnyValue = row.some(function(cell) {
        return String(cell || '').trim() !== '';
      });

      if (!hasAnyValue) continue;

      rows.push(row);
      rowNumbers.push(r + 1);
    }

    map[sheetName] = {
      sheet: sheet,
      headers: headers,
      headerIndex: headerIndex,
      rows: rows,
      rowNumbers: rowNumbers
    };
  });

  return map;
}

function auditMigrationPrimaryKeyRule_(tableMap, rule) {
  const table = tableMap[rule.sheet];

  const issues = [];

  if (!table) {
    return {
      summary: {
        sheet_name: rule.sheet,
        primary_key: rule.primaryKey,
        data_row_count: 0,
        blank_pk_count: '',
        duplicate_pk_count: '',
        duplicate_pk_samples: '',
        status: 'SHEET_NOT_FOUND'
      },
      issues: [{
        issue_type: 'SHEET_NOT_FOUND',
        sheet_name: rule.sheet,
        row_number: '',
        column_name: rule.primaryKey,
        value: '',
        message: 'Sheet tidak ditemukan: ' + rule.sheet
      }]
    };
  }

  const colIndex = table.headerIndex[rule.primaryKey];

  if (colIndex === undefined) {
    return {
      summary: {
        sheet_name: rule.sheet,
        primary_key: rule.primaryKey,
        data_row_count: table.rows.length,
        blank_pk_count: '',
        duplicate_pk_count: '',
        duplicate_pk_samples: '',
        status: 'PK_COLUMN_NOT_FOUND'
      },
      issues: [{
        issue_type: 'PK_COLUMN_NOT_FOUND',
        sheet_name: rule.sheet,
        row_number: '',
        column_name: rule.primaryKey,
        value: '',
        message: 'Kolom primary key tidak ditemukan: ' + rule.primaryKey
      }]
    };
  }

  const seen = {};
  const duplicateValues = {};
  let blankCount = 0;

  table.rows.forEach(function(row, idx) {
    const value = String(row[colIndex] || '').trim();
    const rowNumber = table.rowNumbers[idx];

    if (!value) {
      blankCount++;
      issues.push({
        issue_type: 'BLANK_PRIMARY_KEY',
        sheet_name: rule.sheet,
        row_number: rowNumber,
        column_name: rule.primaryKey,
        value: '',
        message: 'Primary key kosong.'
      });
      return;
    }

    if (seen[value]) {
      duplicateValues[value] = true;

      issues.push({
        issue_type: 'DUPLICATE_PRIMARY_KEY',
        sheet_name: rule.sheet,
        row_number: rowNumber,
        column_name: rule.primaryKey,
        value: value,
        message: 'Primary key duplikat. Pertama kali ditemukan di row ' + seen[value] + '.'
      });
    } else {
      seen[value] = rowNumber;
    }
  });

  const duplicateSamples = Object.keys(duplicateValues).slice(0, 10);

  const status = blankCount === 0 && duplicateSamples.length === 0
    ? 'OK'
    : 'NEEDS_REVIEW';

  return {
    summary: {
      sheet_name: rule.sheet,
      primary_key: rule.primaryKey,
      data_row_count: table.rows.length,
      blank_pk_count: blankCount,
      duplicate_pk_count: duplicateSamples.length,
      duplicate_pk_samples: duplicateSamples.join(', '),
      status: status
    },
    issues: issues
  };
}

function auditMigrationRelationRule_(tableMap, rule) {
  const child = tableMap[rule.childSheet];
  const parent = tableMap[rule.parentSheet];

  const issues = [];

  if (!child) {
    return buildMigrationRelationMissingSheetResult_(rule, 'CHILD_SHEET_NOT_FOUND');
  }

  if (!parent) {
    return buildMigrationRelationMissingSheetResult_(rule, 'PARENT_SHEET_NOT_FOUND');
  }

  const childColIndex = child.headerIndex[rule.childColumn];
  const parentColIndex = parent.headerIndex[rule.parentColumn];

  if (childColIndex === undefined) {
    return buildMigrationRelationMissingColumnResult_(rule, 'CHILD_COLUMN_NOT_FOUND', rule.childSheet, rule.childColumn);
  }

  if (parentColIndex === undefined) {
    return buildMigrationRelationMissingColumnResult_(rule, 'PARENT_COLUMN_NOT_FOUND', rule.parentSheet, rule.parentColumn);
  }

  const parentValues = {};

  parent.rows.forEach(function(row) {
    const value = String(row[parentColIndex] || '').trim();
    if (value) parentValues[value] = true;
  });

  let checkedRows = 0;
  let blankFkCount = 0;
  let missingParentCount = 0;
  const missingSamples = {};

  child.rows.forEach(function(row, idx) {
    const value = String(row[childColIndex] || '').trim();
    const rowNumber = child.rowNumbers[idx];

    checkedRows++;

    if (!value) {
      blankFkCount++;

      if (!rule.allowBlank) {
        issues.push({
          issue_type: 'BLANK_FOREIGN_KEY',
          sheet_name: rule.childSheet,
          row_number: rowNumber,
          column_name: rule.childColumn,
          value: '',
          message: 'Foreign key kosong untuk relasi: ' + rule.name
        });
      }

      return;
    }

    if (!parentValues[value]) {
      missingParentCount++;
      missingSamples[value] = true;

      issues.push({
        issue_type: 'MISSING_PARENT',
        sheet_name: rule.childSheet,
        row_number: rowNumber,
        column_name: rule.childColumn,
        value: value,
        message: 'Data induk tidak ditemukan pada ' + rule.parentSheet + '.' + rule.parentColumn
      });
    }
  });

  const missingParentSamples = Object.keys(missingSamples).slice(0, 10);

  const status = missingParentCount === 0 && (rule.allowBlank || blankFkCount === 0)
    ? 'OK'
    : 'NEEDS_REVIEW';

  return {
    summary: {
      relation_name: rule.name,
      child_sheet: rule.childSheet,
      child_column: rule.childColumn,
      parent_sheet: rule.parentSheet,
      parent_column: rule.parentColumn,
      checked_child_rows: checkedRows,
      blank_fk_count: blankFkCount,
      missing_parent_count: missingParentCount,
      missing_parent_samples: missingParentSamples.join(', '),
      status: status
    },
    issues: issues
  };
}

function buildMigrationRelationMissingSheetResult_(rule, status) {
  return {
    summary: {
      relation_name: rule.name,
      child_sheet: rule.childSheet,
      child_column: rule.childColumn,
      parent_sheet: rule.parentSheet,
      parent_column: rule.parentColumn,
      checked_child_rows: 0,
      blank_fk_count: '',
      missing_parent_count: '',
      missing_parent_samples: '',
      status: status
    },
    issues: [{
      issue_type: status,
      sheet_name: rule.childSheet,
      row_number: '',
      column_name: rule.childColumn,
      value: '',
      message: 'Sheet relasi tidak ditemukan: ' + rule.name
    }]
  };
}

function buildMigrationRelationMissingColumnResult_(rule, status, sheetName, columnName) {
  return {
    summary: {
      relation_name: rule.name,
      child_sheet: rule.childSheet,
      child_column: rule.childColumn,
      parent_sheet: rule.parentSheet,
      parent_column: rule.parentColumn,
      checked_child_rows: 0,
      blank_fk_count: '',
      missing_parent_count: '',
      missing_parent_samples: '',
      status: status
    },
    issues: [{
      issue_type: status,
      sheet_name: sheetName,
      row_number: '',
      column_name: columnName,
      value: '',
      message: 'Kolom relasi tidak ditemukan: ' + sheetName + '.' + columnName
    }]
  };
}

function isMigrationAuditSheetExtended_(sheetName) {
  return isMigrationAuditOutputSheet_(sheetName);
}

function isMigrationAuditOutputSheet_(sheetName) {
  return String(sheetName || '').indexOf('DB_AUDIT_') === 0;
}

/* =========================================================
   DATABASE MIGRATION AUDIT - PHASE 1C
   Audit detail anomali primary key dan missing parent
   Aman: tidak mengubah data utama, hanya membuat sheet audit
   ========================================================= */

function runMigrationDatabaseAuditPhase1C() {
  const ss = getMigrationAuditSpreadsheet_();
  const tableMap = buildMigrationTableMap_(ss);

  const duplicateDetail = buildMigrationDuplicateKeyDetail_(
    tableMap,
    'TreatmentItems',
    'treatment_item_id',
    [
      'treatment_id',
      'service_id',
      'service_name',
      'qty',
      'unit_price',
      'subtotal',
      'created_at',
      'updated_at'
    ]
  );

  const missingParentDetail = buildMigrationMissingParentDetail_(tableMap, [
    {
      relation_name: 'OrthoRecall.install_treatment_id -> Treatments.treatment_id',
      child_sheet: 'OrthoRecall',
      child_column: 'install_treatment_id',
      parent_sheet: 'Treatments',
      parent_column: 'treatment_id',
      allow_blank: true
    },
    {
      relation_name: 'Billings.treatment_id -> Treatments.treatment_id',
      child_sheet: 'Billings',
      child_column: 'treatment_id',
      parent_sheet: 'Treatments',
      parent_column: 'treatment_id',
      allow_blank: false
    },
    {
      relation_name: 'BillingItems.treatment_id -> Treatments.treatment_id',
      child_sheet: 'BillingItems',
      child_column: 'treatment_id',
      parent_sheet: 'Treatments',
      parent_column: 'treatment_id',
      allow_blank: false
    },
    {
      relation_name: 'BillingItems.treatment_item_id -> TreatmentItems.treatment_item_id',
      child_sheet: 'BillingItems',
      child_column: 'treatment_item_id',
      parent_sheet: 'TreatmentItems',
      parent_column: 'treatment_item_id',
      allow_blank: true
    }
  ]);

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_DUPLICATE_DETAILS',
    [
      'sheet_name',
      'key_column',
      'key_value',
      'occurrence_count',
      'duplicate_extra_count',
      'row_numbers',
      'context_summary'
    ],
    duplicateDetail.details
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_MISSING_PARENT_DETAILS',
    [
      'relation_name',
      'child_sheet',
      'row_number',
      'child_column',
      'child_value',
      'parent_sheet',
      'parent_column',
      'row_snapshot',
      'status'
    ],
    missingParentDetail.details
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_ANOMALY_SUMMARY',
    [
      'audit_area',
      'sheet_name',
      'issue_count',
      'affected_key_count',
      'affected_row_count',
      'status',
      'notes'
    ],
    [
      {
        audit_area: 'duplicate_primary_key',
        sheet_name: 'TreatmentItems',
        issue_count: duplicateDetail.summary.issue_count,
        affected_key_count: duplicateDetail.summary.affected_key_count,
        affected_row_count: duplicateDetail.summary.affected_row_count,
        status: duplicateDetail.summary.issue_count > 0 ? 'NEEDS_REVIEW' : 'OK',
        notes: 'Audit detail duplikat treatment_item_id.'
      },
      {
        audit_area: 'missing_parent',
        sheet_name: 'OrthoRecall/Billings/BillingItems',
        issue_count: missingParentDetail.summary.issue_count,
        affected_key_count: missingParentDetail.summary.affected_key_count,
        affected_row_count: missingParentDetail.summary.affected_row_count,
        status: missingParentDetail.summary.issue_count > 0 ? 'NEEDS_REVIEW' : 'OK',
        notes: 'Audit detail foreign key yang tidak punya parent.'
      }
    ]
  );

  const summary = {
    success: true,
    duplicate_issue_count: duplicateDetail.summary.issue_count,
    duplicate_affected_key_count: duplicateDetail.summary.affected_key_count,
    duplicate_affected_row_count: duplicateDetail.summary.affected_row_count,
    missing_parent_issue_count: missingParentDetail.summary.issue_count,
    missing_parent_affected_key_count: missingParentDetail.summary.affected_key_count,
    missing_parent_affected_row_count: missingParentDetail.summary.affected_row_count,
    audit_sheets: [
      'DB_AUDIT_DUPLICATE_DETAILS',
      'DB_AUDIT_MISSING_PARENT_DETAILS',
      'DB_AUDIT_ANOMALY_SUMMARY'
    ]
  };

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

function buildMigrationDuplicateKeyDetail_(tableMap, sheetName, keyColumn, contextColumns) {
  const table = tableMap[sheetName];

  if (!table) {
    return {
      summary: {
        issue_count: 1,
        affected_key_count: 0,
        affected_row_count: 0
      },
      details: [{
        sheet_name: sheetName,
        key_column: keyColumn,
        key_value: '',
        occurrence_count: '',
        duplicate_extra_count: '',
        row_numbers: '',
        context_summary: 'Sheet tidak ditemukan.'
      }]
    };
  }

  const keyIndex = table.headerIndex[keyColumn];

  if (keyIndex === undefined) {
    return {
      summary: {
        issue_count: 1,
        affected_key_count: 0,
        affected_row_count: 0
      },
      details: [{
        sheet_name: sheetName,
        key_column: keyColumn,
        key_value: '',
        occurrence_count: '',
        duplicate_extra_count: '',
        row_numbers: '',
        context_summary: 'Kolom key tidak ditemukan.'
      }]
    };
  }

  const groups = {};

  table.rows.forEach(function(row, idx) {
    const value = String(row[keyIndex] || '').trim();
    if (!value) return;

    if (!groups[value]) {
      groups[value] = [];
    }

    groups[value].push({
      row: row,
      row_number: table.rowNumbers[idx]
    });
  });

  const details = [];
  let affectedRowCount = 0;
  let duplicateExtraCount = 0;

  Object.keys(groups).sort().forEach(function(keyValue) {
    const group = groups[keyValue];

    if (group.length <= 1) return;

    affectedRowCount += group.length;
    duplicateExtraCount += group.length - 1;

    const rowNumbers = group.map(function(item) {
      return item.row_number;
    }).join(', ');

    const contextSummary = group.map(function(item) {
      return buildMigrationRowContextSummary_(table, item.row, contextColumns, item.row_number);
    }).join(' || ');

    details.push({
      sheet_name: sheetName,
      key_column: keyColumn,
      key_value: keyValue,
      occurrence_count: group.length,
      duplicate_extra_count: group.length - 1,
      row_numbers: rowNumbers,
      context_summary: contextSummary
    });
  });

  return {
    summary: {
      issue_count: duplicateExtraCount,
      affected_key_count: details.length,
      affected_row_count: affectedRowCount
    },
    details: details
  };
}

function buildMigrationMissingParentDetail_(tableMap, rules) {
  const details = [];
  const affectedValues = {};
  const affectedRows = {};

  rules.forEach(function(rule) {
    const child = tableMap[rule.child_sheet];
    const parent = tableMap[rule.parent_sheet];

    if (!child || !parent) {
      details.push({
        relation_name: rule.relation_name,
        child_sheet: rule.child_sheet,
        row_number: '',
        child_column: rule.child_column,
        child_value: '',
        parent_sheet: rule.parent_sheet,
        parent_column: rule.parent_column,
        row_snapshot: '',
        status: !child ? 'CHILD_SHEET_NOT_FOUND' : 'PARENT_SHEET_NOT_FOUND'
      });
      return;
    }

    const childIndex = child.headerIndex[rule.child_column];
    const parentIndex = parent.headerIndex[rule.parent_column];

    if (childIndex === undefined || parentIndex === undefined) {
      details.push({
        relation_name: rule.relation_name,
        child_sheet: rule.child_sheet,
        row_number: '',
        child_column: rule.child_column,
        child_value: '',
        parent_sheet: rule.parent_sheet,
        parent_column: rule.parent_column,
        row_snapshot: '',
        status: childIndex === undefined ? 'CHILD_COLUMN_NOT_FOUND' : 'PARENT_COLUMN_NOT_FOUND'
      });
      return;
    }

    const parentValues = {};

    parent.rows.forEach(function(row) {
      const value = String(row[parentIndex] || '').trim();
      if (value) parentValues[value] = true;
    });

    child.rows.forEach(function(row, idx) {
      const value = String(row[childIndex] || '').trim();
      const rowNumber = child.rowNumbers[idx];

      if (!value) {
        return;
      }

      if (!parentValues[value]) {
        affectedValues[rule.child_sheet + '.' + rule.child_column + '=' + value] = true;
        affectedRows[rule.child_sheet + '#' + rowNumber] = true;

        details.push({
          relation_name: rule.relation_name,
          child_sheet: rule.child_sheet,
          row_number: rowNumber,
          child_column: rule.child_column,
          child_value: value,
          parent_sheet: rule.parent_sheet,
          parent_column: rule.parent_column,
          row_snapshot: buildMigrationFullRowSnapshot_(child, row),
          status: 'MISSING_PARENT'
        });
      }
    });
  });

  return {
    summary: {
      issue_count: details.length,
      affected_key_count: Object.keys(affectedValues).length,
      affected_row_count: Object.keys(affectedRows).length
    },
    details: details
  };
}

function buildMigrationRowContextSummary_(table, row, contextColumns, rowNumber) {
  const parts = ['row=' + rowNumber];

  contextColumns.forEach(function(columnName) {
    const index = table.headerIndex[columnName];

    if (index === undefined) return;

    const value = String(row[index] || '').trim();

    parts.push(columnName + '=' + value);
  });

  return parts.join('; ');
}

function buildMigrationFullRowSnapshot_(table, row) {
  const obj = {};

  table.headers.forEach(function(header, index) {
    if (!header) return;

    obj[header] = String(row[index] || '').trim();
  });

  return JSON.stringify(obj);
}

/* =========================================================
   DATABASE MIGRATION AUDIT - PHASE 1D
   Klasifikasi TreatmentItems Legacy ID vs New ID
   Aman: tidak mengubah data utama, hanya membuat sheet audit
   ========================================================= */

function runMigrationDatabaseAuditPhase1D() {
  const ss = getMigrationAuditSpreadsheet_();
  const tableMap = buildMigrationTableMap_(ss);

  const result = buildMigrationTreatmentItemsPhase1D_(tableMap);

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_TI_1D_SUMMARY',
    [
      'audit_area',
      'total_count',
      'ok_count',
      'needs_review_count',
      'status',
      'notes'
    ],
    result.summary
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_TI_ID_CLASSES',
    [
      'id_class',
      'total_rows',
      'unique_id_count',
      'duplicate_key_count',
      'duplicate_extra_count',
      'blank_id_count',
      'notes'
    ],
    result.class_summary
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_TI_ROW_CLASSIFICATION',
    [
      'row_number',
      'treatment_item_id',
      'id_class',
      'is_duplicate',
      'duplicate_occurrence_count',
      'treatment_id',
      'service_id',
      'service_name',
      'qty',
      'unit_price',
      'subtotal',
      'created_at',
      'updated_at',
      'migration_strategy',
      'migration_row_key'
    ],
    result.row_classification
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_TI_DUP_GROUPS',
    [
      'id_class',
      'treatment_item_id',
      'occurrence_count',
      'duplicate_extra_count',
      'row_numbers',
      'treatment_ids',
      'service_ids',
      'service_names',
      'created_at_values',
      'mapping_risk'
    ],
    result.duplicate_groups
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_BILLING_TI_LINKS',
    [
      'billing_item_row',
      'billing_item_id',
      'billing_id',
      'treatment_id',
      'treatment_item_id',
      'service_id',
      'qty',
      'unit_price',
      'subtotal',
      'match_by_id_count',
      'match_by_composite_count',
      'matched_treatment_item_rows',
      'mapping_status',
      'notes'
    ],
    result.billing_links
  );

  const consoleSummary = {
    success: true,
    treatment_item_rows: result.metrics.treatment_item_rows,
    legacy_sequence_rows: result.metrics.legacy_sequence_rows,
    new_timestamp_rows: result.metrics.new_timestamp_rows,
    unknown_id_rows: result.metrics.unknown_id_rows,
    blank_id_rows: result.metrics.blank_id_rows,
    duplicate_key_count: result.metrics.duplicate_key_count,
    duplicate_extra_count: result.metrics.duplicate_extra_count,
    duplicate_affected_row_count: result.metrics.duplicate_affected_row_count,
    billing_item_rows: result.metrics.billing_item_rows,
    billing_link_ok_count: result.metrics.billing_link_ok_count,
    billing_link_needs_review_count: result.metrics.billing_link_needs_review_count,
    audit_sheets: [
      'DB_AUDIT_TI_1D_SUMMARY',
      'DB_AUDIT_TI_ID_CLASSES',
      'DB_AUDIT_TI_ROW_CLASSIFICATION',
      'DB_AUDIT_TI_DUP_GROUPS',
      'DB_AUDIT_BILLING_TI_LINKS'
    ]
  };

  Logger.log(JSON.stringify(consoleSummary, null, 2));
  return consoleSummary;
}

function buildMigrationTreatmentItemsPhase1D_(tableMap) {
  const treatmentItems = tableMap.TreatmentItems;
  const billingItems = tableMap.BillingItems;

  const rowClassification = [];
  const duplicateGroups = [];
  const classSummaryMap = {};
  const billingLinks = [];

  if (!treatmentItems) {
    return {
      metrics: buildEmptyMigrationTreatmentItemsMetrics_(),
      summary: [{
        audit_area: 'TreatmentItems',
        total_count: 0,
        ok_count: 0,
        needs_review_count: 1,
        status: 'SHEET_NOT_FOUND',
        notes: 'Sheet TreatmentItems tidak ditemukan.'
      }],
      class_summary: [],
      row_classification: [],
      duplicate_groups: [],
      billing_links: []
    };
  }

  const tiRows = getMigrationRowsWithValues_(treatmentItems, [
    'treatment_item_id',
    'treatment_id',
    'service_id',
    'service_name',
    'qty',
    'unit_price',
    'subtotal',
    'created_at',
    'updated_at'
  ]);

  const groupsById = {};

  tiRows.forEach(function(item) {
    const id = item.values.treatment_item_id;

    if (!groupsById[id]) {
      groupsById[id] = [];
    }

    groupsById[id].push(item);
  });

  let duplicateKeyCount = 0;
  let duplicateExtraCount = 0;
  let duplicateAffectedRowCount = 0;

  Object.keys(groupsById).forEach(function(id) {
    if (!id) return;

    const group = groupsById[id];

    if (group.length <= 1) return;

    duplicateKeyCount++;
    duplicateExtraCount += group.length - 1;
    duplicateAffectedRowCount += group.length;
  });

  tiRows.forEach(function(item) {
    const id = item.values.treatment_item_id;
    const idClass = classifyMigrationTreatmentItemId_(id);
    const group = groupsById[id] || [];
    const isDuplicate = !!id && group.length > 1;

    if (!classSummaryMap[idClass]) {
      classSummaryMap[idClass] = {
        id_class: idClass,
        total_rows: 0,
        idMap: {},
        duplicate_key_count: 0,
        duplicate_extra_count: 0,
        blank_id_count: 0
      };
    }

    classSummaryMap[idClass].total_rows++;

    if (!id) {
      classSummaryMap[idClass].blank_id_count++;
    } else {
      classSummaryMap[idClass].idMap[id] = true;
    }

    const migrationStrategy = determineMigrationTreatmentItemStrategy_(idClass, isDuplicate, id);

    rowClassification.push({
      row_number: item.row_number,
      treatment_item_id: id,
      id_class: idClass,
      is_duplicate: isDuplicate ? 'yes' : 'no',
      duplicate_occurrence_count: group.length || '',
      treatment_id: item.values.treatment_id,
      service_id: item.values.service_id,
      service_name: item.values.service_name,
      qty: item.values.qty,
      unit_price: item.values.unit_price,
      subtotal: item.values.subtotal,
      created_at: item.values.created_at,
      updated_at: item.values.updated_at,
      migration_strategy: migrationStrategy,
      migration_row_key: buildMigrationTreatmentItemRowKey_(item)
    });
  });

  Object.keys(groupsById).sort().forEach(function(id) {
    if (!id) return;

    const group = groupsById[id];

    if (group.length <= 1) return;

    const idClass = classifyMigrationTreatmentItemId_(id);

    if (classSummaryMap[idClass]) {
      classSummaryMap[idClass].duplicate_key_count++;
      classSummaryMap[idClass].duplicate_extra_count += group.length - 1;
    }

    duplicateGroups.push({
      id_class: idClass,
      treatment_item_id: id,
      occurrence_count: group.length,
      duplicate_extra_count: group.length - 1,
      row_numbers: uniqueMigrationValues_(group.map(function(item) { return String(item.row_number); })).join(', '),
      treatment_ids: uniqueMigrationValues_(group.map(function(item) { return item.values.treatment_id; })).join(', '),
      service_ids: uniqueMigrationValues_(group.map(function(item) { return item.values.service_id; })).join(', '),
      service_names: uniqueMigrationValues_(group.map(function(item) { return item.values.service_name; })).join(' | '),
      created_at_values: uniqueMigrationValues_(group.map(function(item) { return item.values.created_at; })).join(' | '),
      mapping_risk: determineMigrationTreatmentItemMappingRisk_(idClass, group)
    });
  });

  const classSummary = Object.keys(classSummaryMap).sort().map(function(idClass) {
    const item = classSummaryMap[idClass];

    return {
      id_class: idClass,
      total_rows: item.total_rows,
      unique_id_count: Object.keys(item.idMap).length,
      duplicate_key_count: item.duplicate_key_count,
      duplicate_extra_count: item.duplicate_extra_count,
      blank_id_count: item.blank_id_count,
      notes: getMigrationTreatmentItemClassNotes_(idClass)
    };
  });

  const indexByTreatmentItemId = {};

  tiRows.forEach(function(item) {
    const id = item.values.treatment_item_id;

    if (!id) return;

    if (!indexByTreatmentItemId[id]) {
      indexByTreatmentItemId[id] = [];
    }

    indexByTreatmentItemId[id].push(item);
  });

  let billingLinkOkCount = 0;
  let billingLinkNeedsReviewCount = 0;

  if (billingItems) {
    const biRows = getMigrationRowsWithValues_(billingItems, [
      'billing_item_id',
      'billing_id',
      'treatment_id',
      'treatment_item_id',
      'service_id',
      'qty',
      'unit_price',
      'subtotal'
    ]);

    biRows.forEach(function(billingItem) {
      const treatmentItemId = billingItem.values.treatment_item_id;
      const candidatesById = treatmentItemId ? (indexByTreatmentItemId[treatmentItemId] || []) : [];

      const compositeMatches = candidatesById.filter(function(candidate) {
        return isMigrationTreatmentItemCompositeMatch_(billingItem, candidate);
      });

      const mapping = determineMigrationBillingTreatmentItemMappingStatus_(
        treatmentItemId,
        candidatesById,
        compositeMatches
      );

      if (mapping.status === 'OK') {
        billingLinkOkCount++;
      } else {
        billingLinkNeedsReviewCount++;
      }

      billingLinks.push({
        billing_item_row: billingItem.row_number,
        billing_item_id: billingItem.values.billing_item_id,
        billing_id: billingItem.values.billing_id,
        treatment_id: billingItem.values.treatment_id,
        treatment_item_id: treatmentItemId,
        service_id: billingItem.values.service_id,
        qty: billingItem.values.qty,
        unit_price: billingItem.values.unit_price,
        subtotal: billingItem.values.subtotal,
        match_by_id_count: candidatesById.length,
        match_by_composite_count: compositeMatches.length,
        matched_treatment_item_rows: compositeMatches.length > 0
          ? compositeMatches.map(function(item) { return item.row_number; }).join(', ')
          : candidatesById.map(function(item) { return item.row_number; }).join(', '),
        mapping_status: mapping.mapping_status,
        notes: mapping.notes
      });
    });
  }

  const metrics = {
    treatment_item_rows: tiRows.length,
    legacy_sequence_rows: countMigrationRowsByClass_(rowClassification, 'LEGACY_SEQUENCE_ID'),
    new_timestamp_rows: countMigrationRowsByClass_(rowClassification, 'NEW_TIMESTAMP_ID'),
    unknown_id_rows: countMigrationRowsByClass_(rowClassification, 'UNKNOWN_ID_PATTERN'),
    blank_id_rows: countMigrationRowsByClass_(rowClassification, 'BLANK_ID'),
    duplicate_key_count: duplicateKeyCount,
    duplicate_extra_count: duplicateExtraCount,
    duplicate_affected_row_count: duplicateAffectedRowCount,
    billing_item_rows: billingLinks.length,
    billing_link_ok_count: billingLinkOkCount,
    billing_link_needs_review_count: billingLinkNeedsReviewCount
  };

  const summary = [
    {
      audit_area: 'TreatmentItems ID classification',
      total_count: tiRows.length,
      ok_count: tiRows.length - duplicateAffectedRowCount,
      needs_review_count: duplicateAffectedRowCount,
      status: duplicateAffectedRowCount > 0 ? 'NEEDS_REVIEW' : 'OK',
      notes: 'Baris TreatmentItems yang terkena duplikat treatment_item_id perlu strategi primary key baru saat migrasi.'
    },
    {
      audit_area: 'TreatmentItems duplicate keys',
      total_count: duplicateKeyCount,
      ok_count: duplicateKeyCount === 0 ? 1 : 0,
      needs_review_count: duplicateKeyCount,
      status: duplicateKeyCount > 0 ? 'NEEDS_REVIEW' : 'OK',
      notes: 'Jumlah nilai treatment_item_id yang muncul lebih dari satu kali.'
    },
    {
      audit_area: 'BillingItems to TreatmentItems mapping',
      total_count: billingLinks.length,
      ok_count: billingLinkOkCount,
      needs_review_count: billingLinkNeedsReviewCount,
      status: billingLinkNeedsReviewCount > 0 ? 'NEEDS_REVIEW' : 'OK',
      notes: 'Cek apakah BillingItems masih bisa dipetakan ke TreatmentItems memakai kombinasi treatment_item_id + treatment_id + service_id + qty + subtotal.'
    }
  ];

  return {
    metrics: metrics,
    summary: summary,
    class_summary: classSummary,
    row_classification: rowClassification,
    duplicate_groups: duplicateGroups,
    billing_links: billingLinks
  };
}

function getMigrationRowsWithValues_(table, columns) {
  const result = [];

  table.rows.forEach(function(row, idx) {
    const values = {};

    columns.forEach(function(columnName) {
      const index = table.headerIndex[columnName];

      values[columnName] = index === undefined
        ? ''
        : String(row[index] || '').trim();
    });

    result.push({
      row_number: table.rowNumbers[idx],
      row: row,
      values: values
    });
  });

  return result;
}

function classifyMigrationTreatmentItemId_(value) {
  value = String(value || '').trim();

  if (!value) {
    return 'BLANK_ID';
  }

  if (/^TRI-\d{8}-\d{9}-\d{3}$/.test(value)) {
    return 'NEW_TIMESTAMP_ID';
  }

  if (/^TRI-\d+$/.test(value)) {
    return 'LEGACY_SEQUENCE_ID';
  }

  if (/^TRI-\d{8}-/.test(value)) {
    return 'NEW_LIKE_UNEXPECTED_PATTERN';
  }

  return 'UNKNOWN_ID_PATTERN';
}

function determineMigrationTreatmentItemStrategy_(idClass, isDuplicate, id) {
  if (!id) {
    return 'CREATE_INTERNAL_PK_AND_GENERATE_LEGACY_PLACEHOLDER';
  }

  if (isDuplicate) {
    return 'CREATE_INTERNAL_PK_KEEP_DUPLICATE_LEGACY_ID';
  }

  if (idClass === 'NEW_TIMESTAMP_ID') {
    return 'CAN_KEEP_AS_UNIQUE_BUSINESS_KEY_BUT_USE_INTERNAL_PK_RECOMMENDED';
  }

  if (idClass === 'LEGACY_SEQUENCE_ID') {
    return 'KEEP_AS_LEGACY_ID_USE_INTERNAL_PK';
  }

  return 'REVIEW_ID_PATTERN_USE_INTERNAL_PK';
}

function buildMigrationTreatmentItemRowKey_(item) {
  const parts = [
    'TIROW',
    String(item.row_number || ''),
    item.values.treatment_id || '',
    item.values.treatment_item_id || '',
    item.values.service_id || ''
  ];

  return parts
    .map(function(part) {
      return String(part || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]/g, '_');
    })
    .join('__');
}

function determineMigrationTreatmentItemMappingRisk_(idClass, group) {
  const uniqueTreatmentIds = uniqueMigrationValues_(group.map(function(item) {
    return item.values.treatment_id;
  }));

  const uniqueServiceIds = uniqueMigrationValues_(group.map(function(item) {
    return item.values.service_id;
  }));

  if (idClass === 'NEW_TIMESTAMP_ID') {
    return 'HIGH_UNEXPECTED_DUPLICATE_NEW_ID';
  }

  if (uniqueTreatmentIds.length === 1 && uniqueServiceIds.length > 1) {
    return 'LEGACY_DUPLICATE_WITHIN_SAME_TREATMENT';
  }

  if (uniqueTreatmentIds.length > 1) {
    return 'HIGH_DUPLICATE_ACROSS_MULTIPLE_TREATMENTS';
  }

  return 'NEEDS_REVIEW';
}

function getMigrationTreatmentItemClassNotes_(idClass) {
  if (idClass === 'LEGACY_SEQUENCE_ID') {
    return 'Pola ID lama seperti TRI-00002. Tidak boleh dijadikan primary key tunggal jika ada duplikat.';
  }

  if (idClass === 'NEW_TIMESTAMP_ID') {
    return 'Pola ID baru berbasis timestamp. Diharapkan unik.';
  }

  if (idClass === 'BLANK_ID') {
    return 'ID kosong. Wajib dibuatkan key baru saat migrasi.';
  }

  if (idClass === 'NEW_LIKE_UNEXPECTED_PATTERN') {
    return 'Mirip ID baru tetapi format tidak sesuai pola standar.';
  }

  return 'Pola ID tidak dikenal.';
}

function isMigrationTreatmentItemCompositeMatch_(billingItem, treatmentItem) {
  return billingItem.values.treatment_id === treatmentItem.values.treatment_id
    && billingItem.values.treatment_item_id === treatmentItem.values.treatment_item_id
    && billingItem.values.service_id === treatmentItem.values.service_id
    && normalizeMigrationComparableNumber_(billingItem.values.qty) === normalizeMigrationComparableNumber_(treatmentItem.values.qty)
    && normalizeMigrationComparableNumber_(billingItem.values.subtotal) === normalizeMigrationComparableNumber_(treatmentItem.values.subtotal);
}

function determineMigrationBillingTreatmentItemMappingStatus_(treatmentItemId, candidatesById, compositeMatches) {
  if (!treatmentItemId) {
    return {
      status: 'NEEDS_REVIEW',
      mapping_status: 'BLANK_TREATMENT_ITEM_ID',
      notes: 'BillingItems tidak memiliki treatment_item_id.'
    };
  }

  if (candidatesById.length === 0) {
    return {
      status: 'NEEDS_REVIEW',
      mapping_status: 'MISSING_TREATMENT_ITEM_PARENT',
      notes: 'Tidak ada TreatmentItems dengan treatment_item_id ini.'
    };
  }

  if (compositeMatches.length === 1) {
    return {
      status: 'OK',
      mapping_status: 'OK_COMPOSITE_MATCH',
      notes: 'Cocok unik memakai treatment_item_id + treatment_id + service_id + qty + subtotal.'
    };
  }

  if (candidatesById.length === 1) {
    return {
      status: 'OK',
      mapping_status: 'OK_ID_MATCH_ONLY',
      notes: 'Treatment item ID cocok unik, meskipun composite tidak cocok penuh.'
    };
  }

  if (compositeMatches.length > 1) {
    return {
      status: 'NEEDS_REVIEW',
      mapping_status: 'AMBIGUOUS_COMPOSITE_MATCH',
      notes: 'Lebih dari satu TreatmentItems cocok secara composite.'
    };
  }

  return {
    status: 'NEEDS_REVIEW',
    mapping_status: 'AMBIGUOUS_ID_ONLY',
    notes: 'Treatment item ID ditemukan lebih dari satu, tetapi tidak ada composite match unik.'
  };
}

function normalizeMigrationComparableNumber_(value) {
  value = String(value || '').trim();

  if (!value) return '';

  return value
    .replace(/[^\d\-]/g, '')
    .replace(/^0+(\d)/, '$1');
}

function uniqueMigrationValues_(values) {
  const map = {};
  const result = [];

  values.forEach(function(value) {
    value = String(value || '').trim();

    if (!value) return;

    if (map[value]) return;

    map[value] = true;
    result.push(value);
  });

  return result;
}

function countMigrationRowsByClass_(rows, idClass) {
  return rows.filter(function(row) {
    return row.id_class === idClass;
  }).length;
}

function buildEmptyMigrationTreatmentItemsMetrics_() {
  return {
    treatment_item_rows: 0,
    legacy_sequence_rows: 0,
    new_timestamp_rows: 0,
    unknown_id_rows: 0,
    blank_id_rows: 0,
    duplicate_key_count: 0,
    duplicate_extra_count: 0,
    duplicate_affected_row_count: 0,
    billing_item_rows: 0,
    billing_link_ok_count: 0,
    billing_link_needs_review_count: 0
  };
}

/* =========================================================
   DATABASE MIGRATION AUDIT - PHASE 1E
   Audit tipe data kritis untuk persiapan migrasi database
   Aman: tidak mengubah data utama, hanya membuat sheet audit
   ========================================================= */

function runMigrationDatabaseAuditPhase1E() {
  const ss = getMigrationAuditSpreadsheet_();

  const result = buildMigrationCriticalDataTypeAudit_(ss);

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_TYPE_SUMMARY',
    [
      'sheet_name',
      'column_name',
      'column_role',
      'total_non_blank',
      'blank_count',
      'date_raw_count',
      'number_raw_count',
      'boolean_raw_count',
      'text_raw_count',
      'valid_count',
      'issue_count',
      'sample_values',
      'migration_recommendation',
      'status'
    ],
    result.summary
  );

  writeMigrationAuditSheet_(
    ss,
    'DB_AUDIT_TYPE_ISSUES',
    [
      'sheet_name',
      'row_number',
      'column_name',
      'column_role',
      'raw_type',
      'display_value',
      'issue_type',
      'message'
    ],
    result.issues
  );

  const consoleSummary = {
    success: true,
    checked_columns: result.summary.length,
    issue_count: result.issues.length,
    audit_sheets: [
      'DB_AUDIT_TYPE_SUMMARY',
      'DB_AUDIT_TYPE_ISSUES'
    ]
  };

  Logger.log(JSON.stringify(consoleSummary, null, 2));
  return consoleSummary;
}

function buildMigrationCriticalDataTypeAudit_(ss) {
  const summary = [];
  const issues = [];

  ss.getSheets().forEach(function(sheet) {
    const sheetName = sheet.getName();

    if (isMigrationAuditSheetExtended_(sheetName) || isMigrationAuditTypeSheet_(sheetName)) {
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 1 || lastColumn < 1) return;

    const displayValues = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const rawValues = sheet.getRange(1, 1, lastRow, lastColumn).getValues();

    const headers = displayValues[0].map(function(header) {
      return normalizeMigrationAuditHeader_(header);
    });

    headers.forEach(function(header, colIndex) {
      if (!header) return;

      const role = detectMigrationCriticalColumnRole_(header);

      if (!role) return;

      const columnAudit = auditMigrationCriticalColumn_(
        sheetName,
        header,
        role,
        colIndex,
        rawValues,
        displayValues
      );

      summary.push(columnAudit.summary);

      columnAudit.issues.forEach(function(issue) {
        issues.push(issue);
      });
    });
  });

  return {
    summary: summary,
    issues: issues
  };
}

function detectMigrationCriticalColumnRole_(header) {
  header = String(header || '').trim();

  if (!header) return '';

  if (/^(created_at|updated_at|submitted_at|sent_at|generated_at|invoice_sent_at|invoice_pdf_signature_at|deleted_at|paid_at|completed_at)$/.test(header)) {
    return 'timestamp';
  }

  if (/(^date$|_date$|birth_date|visit_date|due_date|install_date|last_control_date|next_due_date|last_contact_date|payment_date|billing_date|appointment_date)/.test(header)) {
    return 'date';
  }

  if (/(amount|total|subtotal|grand|paid|outstanding|discount|price|unit_price|default_price|amount_due|paid_amount|qty|rating|service_quality|staff_friendliness|clinic_cleanliness|waiting_time|control_count|target_months|sort_order)/.test(header)) {
    return 'number';
  }

  if (/(phone|telp|whatsapp|wa|mobile)/.test(header)) {
    return 'phone_text';
  }

  if (/(^id$|_id$|token|signature|url|link|file_drive_id|file_name|billing_number|patient_code|username|password_hash|email)/.test(header)) {
    return 'system_text';
  }

  if (/^(is_active|is_ortho_install|is_ortho_control)$/.test(header)) {
    return 'boolean';
  }

  if (/status/.test(header)) {
    return 'status_text';
  }

  return '';
}

function auditMigrationCriticalColumn_(sheetName, header, role, colIndex, rawValues, displayValues) {
  let blankCount = 0;
  let dateRawCount = 0;
  let numberRawCount = 0;
  let booleanRawCount = 0;
  let textRawCount = 0;
  let validCount = 0;

  const issues = [];
  const samples = [];

  for (let r = 1; r < rawValues.length; r++) {
    const raw = rawValues[r][colIndex];
    const display = String(displayValues[r][colIndex] || '').trim();
    const rowNumber = r + 1;

    if (!display) {
      blankCount++;
      continue;
    }

    if (samples.length < 5) {
      samples.push(display);
    }

    const rawType = getMigrationRawType_(raw);

    if (rawType === 'date') dateRawCount++;
    else if (rawType === 'number') numberRawCount++;
    else if (rawType === 'boolean') booleanRawCount++;
    else textRawCount++;

    const validation = validateMigrationValueByRole_(role, raw, display, rawType);

    if (validation.valid) {
      validCount++;
    } else {
      issues.push({
        sheet_name: sheetName,
        row_number: rowNumber,
        column_name: header,
        column_role: role,
        raw_type: rawType,
        display_value: display,
        issue_type: validation.issue_type,
        message: validation.message
      });
    }
  }

  const totalNonBlank = rawValues.length - 1 - blankCount;
  const issueCount = issues.length;

  return {
    summary: {
      sheet_name: sheetName,
      column_name: header,
      column_role: role,
      total_non_blank: totalNonBlank,
      blank_count: blankCount,
      date_raw_count: dateRawCount,
      number_raw_count: numberRawCount,
      boolean_raw_count: booleanRawCount,
      text_raw_count: textRawCount,
      valid_count: validCount,
      issue_count: issueCount,
      sample_values: samples.join(' | '),
      migration_recommendation: getMigrationTypeRecommendation_(role, dateRawCount, numberRawCount, booleanRawCount, textRawCount, issueCount),
      status: issueCount > 0 ? 'NEEDS_REVIEW' : 'OK'
    },
    issues: issues
  };
}

function validateMigrationValueByRole_(role, raw, display, rawType) {
  if (role === 'timestamp') {
    if (rawType === 'date') {
      return { valid: true };
    }

    if (isMigrationYmdHmsText_(display) || isMigrationYmdText_(display)) {
      return { valid: true };
    }

    if (isMigrationJsDateString_(display)) {
      return {
        valid: false,
        issue_type: 'JS_DATE_STRING',
        message: 'Tanggal berbentuk JavaScript Date string. Perlu normalisasi sebelum migrasi.'
      };
    }

    return {
      valid: false,
      issue_type: 'INVALID_TIMESTAMP',
      message: 'Nilai timestamp tidak sesuai pola tanggal/waktu yang aman.'
    };
  }

  if (role === 'date') {
    if (rawType === 'date') {
      return { valid: true };
    }

    if (isMigrationYmdText_(display) || isMigrationYmdHmsText_(display)) {
      return { valid: true };
    }

    if (isMigrationJsDateString_(display)) {
      return {
        valid: false,
        issue_type: 'JS_DATE_STRING',
        message: 'Tanggal berbentuk JavaScript Date string. Perlu normalisasi menjadi YYYY-MM-DD.'
      };
    }

    return {
      valid: false,
      issue_type: 'INVALID_DATE',
      message: 'Nilai date tidak sesuai pola tanggal yang aman.'
    };
  }

  if (role === 'number') {
    if (rawType === 'number') {
      return { valid: true };
    }

    if (isMigrationDisplayNumber_(display)) {
      return { valid: true };
    }

    return {
      valid: false,
      issue_type: 'INVALID_NUMBER',
      message: 'Nilai angka/nominal tidak valid.'
    };
  }

  if (role === 'phone_text') {
    if (rawType === 'number') {
      return {
        valid: false,
        issue_type: 'PHONE_STORED_AS_NUMBER',
        message: 'Nomor HP tersimpan sebagai number. Risiko angka 0 depan hilang.'
      };
    }

    if (/^\d+$/.test(display) && display.charAt(0) !== '0') {
      return {
        valid: false,
        issue_type: 'PHONE_LEADING_ZERO_RISK',
        message: 'Nomor HP tidak diawali 0. Perlu cek apakah leading zero sudah hilang.'
      };
    }

    return { valid: true };
  }

  if (role === 'system_text') {
    if (rawType === 'number' || rawType === 'date' || rawType === 'boolean') {
      return {
        valid: false,
        issue_type: 'TEXT_COLUMN_RAW_TYPE_RISK',
        message: 'Kolom text/system ID tersimpan bukan sebagai text murni.'
      };
    }

    return { valid: true };
  }

  if (role === 'boolean') {
    if (rawType === 'boolean') {
      return { valid: true };
    }

    if (/^(true|false)$/i.test(display)) {
      return { valid: true };
    }

    return {
      valid: false,
      issue_type: 'INVALID_BOOLEAN',
      message: 'Nilai boolean tidak valid.'
    };
  }

  if (role === 'status_text') {
    if (rawType === 'date' || rawType === 'number' || rawType === 'boolean') {
      return {
        valid: false,
        issue_type: 'STATUS_RAW_TYPE_RISK',
        message: 'Kolom status sebaiknya text.'
      };
    }

    return { valid: true };
  }

  return { valid: true };
}

function getMigrationRawType_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return 'date';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  return 'text';
}

function isMigrationYmdText_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isMigrationYmdHmsText_(value) {
  return /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2}$/.test(String(value || '').trim());
}

function isMigrationJsDateString_(value) {
  return /^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT/.test(String(value || '').trim());
}

function isMigrationDisplayNumber_(value) {
  value = String(value || '').trim();

  if (!value) return false;

  return /^-?[\d.,]+$/.test(value);
}

function getMigrationTypeRecommendation_(role, dateRawCount, numberRawCount, booleanRawCount, textRawCount, issueCount) {
  if (role === 'timestamp') {
    return issueCount > 0
      ? 'Normalize to timestamptz/text ISO before migration.'
      : 'Map to timestamptz or timestamp with timezone policy.';
  }

  if (role === 'date') {
    return issueCount > 0
      ? 'Normalize to YYYY-MM-DD before migration.'
      : 'Map to date.';
  }

  if (role === 'number') {
    return issueCount > 0
      ? 'Clean numeric display values before migration.'
      : 'Map to numeric/integer depending on column.';
  }

  if (role === 'phone_text') {
    return issueCount > 0
      ? 'Force phone to text and review leading zero.'
      : 'Map to text.';
  }

  if (role === 'system_text') {
    return issueCount > 0
      ? 'Force to text before migration.'
      : 'Map to text.';
  }

  if (role === 'boolean') {
    return issueCount > 0
      ? 'Normalize to true/false.'
      : 'Map to boolean.';
  }

  if (role === 'status_text') {
    return 'Map to text first; optional check constraint later.';
  }

  return 'Review manually.';
}

function isMigrationAuditTypeSheet_(sheetName) {
  return [
    'DB_AUDIT_TYPE_SUMMARY',
    'DB_AUDIT_TYPE_ISSUES'
  ].indexOf(sheetName) >= 0;
}