/* =========================================================
   8E-4D-1 — DATA PARITY AUDIT
   Spreadsheet vs Supabase row-level compact audit.
   Read-only only. Tidak menulis data.
   ========================================================= */

function audit8E4D_str_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function audit8E4D_num_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function audit8E4D_isDateObject_(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value);
}

function audit8E4D_formatDateObjectYmd_(value) {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function audit8E4D_formatDateObjectHm_(value) {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
}

function audit8E4D_ymd_(value) {
  if (!value) return '';

  if (audit8E4D_isDateObject_(value)) {
    return audit8E4D_formatDateObjectYmd_(value);
  }

  const s = audit8E4D_str_(value);
  if (!s) return '';

  const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (ymdMatch) {
    // Penting:
    // Untuk value ISO UTC seperti 2026-05-09T17:00:00.000Z,
    // parse sebagai Date lalu format local supaya date-only Spreadsheet tidak geser.
    if (s.indexOf('T') !== -1 && /Z$/.test(s)) {
      const parsedUtc = new Date(s);
      if (!isNaN(parsedUtc.getTime())) {
        return audit8E4D_formatDateObjectYmd_(parsedUtc);
      }
    }

    return ymdMatch[1] + '-' + ymdMatch[2] + '-' + ymdMatch[3];
  }

  const dmyMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:$|[T\s])/);
  if (dmyMatch) {
    return dmyMatch[3] + '-' + dmyMatch[2] + '-' + dmyMatch[1];
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return audit8E4D_formatDateObjectYmd_(parsed);
  }

  return s;
}

function audit8E4D_hm_(value) {
  if (!value) return '';

  if (audit8E4D_isDateObject_(value)) {
    return audit8E4D_formatDateObjectHm_(value);
  }

  const s = audit8E4D_str_(value);
  if (!s) return '';

  const hmMatch = s.match(/(\d{2}):(\d{2})/);
  if (hmMatch) {
    // Untuk ISO time-like dari Spreadsheet, parse local date object bila ada Z.
    if (s.indexOf('T') !== -1 && /Z$/.test(s)) {
      const parsedUtc = new Date(s);
      if (!isNaN(parsedUtc.getTime())) {
        return audit8E4D_formatDateObjectHm_(parsedUtc);
      }
    }

    return hmMatch[1] + ':' + hmMatch[2];
  }

  return s;
}

function audit8E4D_addDays_(ymd, delta) {
  const s = audit8E4D_str_(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';

  const parts = s.split('-');
  const d = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  d.setDate(d.getDate() + Number(delta || 0));

  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function audit8E4D_text_(value) {
  return audit8E4D_str_(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function audit8E4D_phone_(value) {
  let s = audit8E4D_str_(value);
  s = s.replace(/^'/, '').trim();
  s = s.replace(/\D/g, '');

  if (!s) return '';

  if (s.indexOf('62') === 0) {
    return '0' + s.slice(2);
  }

  if (s.indexOf('8') === 0) {
    return '0' + s;
  }

  return s;
}

function audit8E4D_indexRows_(rows, keyFn) {
  const map = {};
  const duplicates = [];

  (rows || []).forEach(function(row, idx) {
    const key = audit8E4D_str_(keyFn(row, idx));

    if (!key) return;

    if (map[key]) {
      duplicates.push(key);
      return;
    }

    map[key] = row;
  });

  return {
    map: map,
    duplicates: duplicates
  };
}

function audit8E4D_defaultKey_(keyField) {
  return function(row) {
    return row[keyField];
  };
}

function audit8E4D_sourceRowKey_(row, idx, sourceName) {
  if (sourceName === 'supabase') {
    return row.source_row_number || row.source_row || row.row_number || '';
  }

  // Spreadsheet source row number: header row = 1, data starts row 2
  return idx + 2;
}

function audit8E4D_compareTable_(config) {
  const supabaseOpts = { backend_mode: 'supabase' };
  const spreadsheetOpts = { backend_mode: 'spreadsheet' };

  const tableName = config.table;
  const label = config.label;

  const sourceRows = dbFindAll_(tableName, spreadsheetOpts) || [];
  const targetRows = dbFindAll_(tableName, supabaseOpts) || [];

  const sourceIndex = audit8E4D_indexRows_(sourceRows, function(row, idx) {
    return config.keyFn
      ? config.keyFn(row, idx, 'spreadsheet')
      : row[config.keyField];
  });

  const targetIndex = audit8E4D_indexRows_(targetRows, function(row, idx) {
    return config.keyFn
      ? config.keyFn(row, idx, 'supabase')
      : row[config.keyField];
  });

  const sourceKeys = Object.keys(sourceIndex.map);
  const targetKeys = Object.keys(targetIndex.map);

  const tableResult = {
    label: label,
    table: tableName,
    key: config.keyField || config.keyName || '',
    spreadsheet_count: sourceRows.length,
    supabase_count: targetRows.length,
    source_key_count: sourceKeys.length,
    target_key_count: targetKeys.length,
    duplicate_keys: {
      spreadsheet: sourceIndex.duplicates.slice(0, 5),
      supabase: targetIndex.duplicates.slice(0, 5),
      spreadsheet_count: sourceIndex.duplicates.length,
      supabase_count: targetIndex.duplicates.length
    },
    missing_in_supabase_count: 0,
    extra_in_supabase_count: 0,
    compared_count: 0,
    field_summary: {},
    sample_mismatches: []
  };

  function initField(field, type) {
    const key = type + ':' + field;

    if (!tableResult.field_summary[key]) {
      tableResult.field_summary[key] = {
        field: field,
        type: type,
        equal: 0,
        mismatch: 0,
        blank_equal: 0,
        date_shift_minus_1: 0,
        date_shift_plus_1: 0,
        source_blank_target_filled: 0,
        source_filled_target_blank: 0
      };
    }

    return tableResult.field_summary[key];
  }

  function addSample(sample) {
    if (tableResult.sample_mismatches.length >= 8) return;
    tableResult.sample_mismatches.push(sample);
  }

  sourceKeys.forEach(function(key) {
    if (!targetIndex.map[key]) {
      tableResult.missing_in_supabase_count++;

      addSample({
        key: key,
        issue: 'MISSING_IN_SUPABASE'
      });
    }
  });

  targetKeys.forEach(function(key) {
    if (!sourceIndex.map[key]) {
      tableResult.extra_in_supabase_count++;

      addSample({
        key: key,
        issue: 'EXTRA_IN_SUPABASE'
      });
    }
  });

  sourceKeys.forEach(function(key) {
    const source = sourceIndex.map[key];
    const target = targetIndex.map[key];

    if (!target) return;

    tableResult.compared_count++;

    (config.dateFields || []).forEach(function(field) {
      const summary = initField(field, 'date');

      const sourceValue = audit8E4D_ymd_(source[field]);
      const targetValue = audit8E4D_ymd_(target[field]);

      if (!sourceValue && !targetValue) {
        summary.blank_equal++;
        summary.equal++;
        return;
      }

      if (sourceValue === targetValue) {
        summary.equal++;
        return;
      }

      summary.mismatch++;

      if (sourceValue && !targetValue) {
        summary.source_filled_target_blank++;
      } else if (!sourceValue && targetValue) {
        summary.source_blank_target_filled++;
      } else if (audit8E4D_addDays_(targetValue, 1) === sourceValue) {
        summary.date_shift_minus_1++;
      } else if (audit8E4D_addDays_(targetValue, -1) === sourceValue) {
        summary.date_shift_plus_1++;
      }

      addSample({
        key: key,
        field: field,
        type: 'date',
        spreadsheet: sourceValue,
        supabase: targetValue,
        raw_spreadsheet: audit8E4D_str_(source[field]),
        raw_supabase: audit8E4D_str_(target[field])
      });
    });

    (config.timeFields || []).forEach(function(field) {
      const summary = initField(field, 'time');

      const sourceValue = audit8E4D_hm_(source[field]);
      const targetValue = audit8E4D_hm_(target[field]);

      if (!sourceValue && !targetValue) {
        summary.blank_equal++;
        summary.equal++;
        return;
      }

      if (sourceValue === targetValue) {
        summary.equal++;
        return;
      }

      summary.mismatch++;

      if (sourceValue && !targetValue) {
        summary.source_filled_target_blank++;
      } else if (!sourceValue && targetValue) {
        summary.source_blank_target_filled++;
      }

      addSample({
        key: key,
        field: field,
        type: 'time',
        spreadsheet: sourceValue,
        supabase: targetValue,
        raw_spreadsheet: audit8E4D_str_(source[field]),
        raw_supabase: audit8E4D_str_(target[field])
      });
    });

    (config.textFields || []).forEach(function(field) {
      const summary = initField(field, 'text');

      const sourceValue = audit8E4D_text_(source[field]);
      const targetValue = audit8E4D_text_(target[field]);

      if (!sourceValue && !targetValue) {
        summary.blank_equal++;
        summary.equal++;
        return;
      }

      if (sourceValue === targetValue) {
        summary.equal++;
        return;
      }

      summary.mismatch++;

      if (sourceValue && !targetValue) {
        summary.source_filled_target_blank++;
      } else if (!sourceValue && targetValue) {
        summary.source_blank_target_filled++;
      }

      addSample({
        key: key,
        field: field,
        type: 'text',
        spreadsheet: sourceValue,
        supabase: targetValue
      });
    });

    (config.phoneFields || []).forEach(function(field) {
      const summary = initField(field, 'phone');

      const sourceValue = audit8E4D_phone_(source[field]);
      const targetValue = audit8E4D_phone_(target[field]);

      if (!sourceValue && !targetValue) {
        summary.blank_equal++;
        summary.equal++;
        return;
      }

      if (sourceValue === targetValue) {
        summary.equal++;
        return;
      }

      summary.mismatch++;

      if (sourceValue && !targetValue) {
        summary.source_filled_target_blank++;
      } else if (!sourceValue && targetValue) {
        summary.source_blank_target_filled++;
      }

      addSample({
        key: key,
        field: field,
        type: 'phone',
        spreadsheet: sourceValue,
        supabase: targetValue,
        raw_spreadsheet: audit8E4D_str_(source[field]),
        raw_supabase: audit8E4D_str_(target[field])
      });
    });

    (config.numberFields || []).forEach(function(field) {
      const summary = initField(field, 'number');

      const sourceValue = audit8E4D_num_(source[field]);
      const targetValue = audit8E4D_num_(target[field]);

      if (sourceValue === targetValue) {
        summary.equal++;
        return;
      }

      summary.mismatch++;

      if (sourceValue && !targetValue) {
        summary.source_filled_target_blank++;
      } else if (!sourceValue && targetValue) {
        summary.source_blank_target_filled++;
      }

      addSample({
        key: key,
        field: field,
        type: 'number',
        spreadsheet: sourceValue,
        supabase: targetValue
      });
    });
  });

  return tableResult;
}

function testMigrationStage8E4DDataParityCompactLog() {
  const result = {
    success: true,
    stage: '8E-4D-1-Data-Parity-Compact-Audit',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    timezone: Session.getScriptTimeZone(),
    issue_count: 0,
    issues: [],
    summary: {
      table_count: 0,
      count_mismatch_tables: 0,
      missing_or_extra_tables: 0,
      date_mismatch_fields: 0,
      date_shift_minus_1_fields: 0,
      time_mismatch_fields: 0,
      text_mismatch_fields: 0,
      phone_mismatch_fields: 0,
      number_mismatch_fields: 0
    },
    tables: {}
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({ issue: issue }, details || {}));
  }

  const tableConfigs = [
    {
      label: 'patients',
      table: REPO_TABLES.PATIENTS || 'Patients',
      keyField: 'patient_id',
      dateFields: ['birth_date'],
      phoneFields: ['phone', 'guardian_phone'],
      textFields: [
        'patient_code',
        'full_name',
        'gender',
        'email',
        'guardian_name',
        'guardian_relationship',
        'guardian_email',
        'address',
        'is_active'
      ],
      numberFields: []
    },
    {
      label: 'appointments',
      table: REPO_TABLES.APPOINTMENTS || 'Appointments',
      keyField: 'appointment_id',
      dateFields: ['appointment_date'],
      timeFields: ['appointment_time'],
      textFields: [
        'patient_id',
        'status',
        'complaint'
      ],
      numberFields: []
    },
    {
      label: 'treatments',
      table: REPO_TABLES.TREATMENTS || 'Treatments',
      keyField: 'treatment_id',
      dateFields: ['treatment_date'],
      textFields: [
        'patient_id',
        'appointment_id',
        'doctor_user_id',
        'complaint',
        'diagnosis',
        'notes'
      ],
      numberFields: []
    },
    {
      label: 'treatment_items',
      table: REPO_TABLES.TREATMENT_ITEMS || 'TreatmentItems',
      keyName: 'source_row_number',
      keyFn: audit8E4D_sourceRowKey_,
      textFields: [
        'treatment_id',
        'treatment_item_id',
        'service_id',
        'service_name',
        'category'
      ],
      numberFields: [
        'qty',
        'unit_price',
        'subtotal'
      ]
    },
    {
      label: 'medical_records',
      table: REPO_TABLES.MEDICAL_RECORDS || 'MedicalRecords',
      keyField: 'record_id',
      dateFields: ['visit_date'],
      textFields: [
        'patient_id',
        'treatment_id',
        'appointment_id',
        'chief_complaint',
        'complaint',
        'diagnosis',
        'clinical_notes',
        'notes'
      ],
      numberFields: []
    },
    {
      label: 'patient_photos',
      table: REPO_TABLES.PATIENT_PHOTOS || 'PatientPhotos',
      keyField: 'photo_id',
      dateFields: ['photo_date', 'treatment_date'],
      textFields: [
        'patient_id',
        'treatment_id',
        'photo_type',
        'file_id',
        'file_url',
        'file_name',
        'description'
      ],
      numberFields: []
    },
    {
      label: 'ortho_recalls',
      table: REPO_TABLES.ORTHO_RECALL || 'OrthoRecall',
      keyField: 'ortho_recall_id',
      dateFields: [
        'install_date',
        'last_control_date',
        'next_due_date',
        'completed_at',
        'last_contact_date'
      ],
      phoneFields: ['phone'],
      textFields: [
        'patient_id',
        'install_treatment_id',
        'last_control_treatment_id',
        'program_status',
        'followup_status',
        'last_contact_note',
        'notes'
      ],
      numberFields: [
        'control_count',
        'target_months'
      ]
    },
    {
      label: 'billings',
      table: REPO_TABLES.BILLINGS || 'Billings',
      keyField: 'billing_id',
      dateFields: [
        'billing_date',
        'due_date'
      ],
      textFields: [
        'billing_number',
        'patient_id',
        'appointment_id',
        'treatment_id',
        'billing_status',
        'payment_status',
        'notes'
      ],
      numberFields: [
        'subtotal',
        'discount_total',
        'grand_total',
        'paid_total',
        'outstanding_total'
      ]
    },
    {
      label: 'billing_items',
      table: REPO_TABLES.BILLING_ITEMS || 'BillingItems',
      keyName: 'source_row_number',
      keyFn: audit8E4D_sourceRowKey_,
      textFields: [
        'billing_id',
        'treatment_id',
        'treatment_item_id',
        'service_id',
        'service_name',
        'category'
      ],
      numberFields: [
        'qty',
        'unit_price',
        'subtotal'
      ]
    },
    {
      label: 'billing_adjustments',
      table: REPO_TABLES.BILLING_ADJUSTMENTS || 'BillingAdjustments',
      keyField: 'adjustment_id',
      dateFields: ['adjustment_date'],
      textFields: [
        'billing_id',
        'adjustment_type',
        'reason',
        'created_by'
      ],
      numberFields: ['amount']
    },
    {
      label: 'billing_installments',
      table: REPO_TABLES.BILLING_INSTALLMENTS || 'BillingInstallments',
      keyField: 'installment_id',
      dateFields: [
        'due_date',
        'paid_at'
      ],
      textFields: [
        'billing_id',
        'installment_status',
        'notes'
      ],
      numberFields: [
        'installment_number',
        'amount',
        'paid_amount'
      ]
    },
    {
      label: 'payments',
      table: REPO_TABLES.PAYMENTS || 'Payments',
      keyField: 'payment_id',
      dateFields: ['payment_date'],
      textFields: [
        'billing_id',
        'installment_id',
        'payment_method',
        'payment_type',
        'received_by',
        'notes'
      ],
      numberFields: ['amount']
    },
    {
      label: 'billing_feedbacks',
      table: REPO_TABLES.BILLING_FEEDBACKS || 'BillingFeedbacks',
      keyField: 'feedback_id',
      dateFields: [
        'submitted_at'
      ],
      textFields: [
        'billing_id',
        'patient_id',
        'feedback_token',
        'feedback_status',
        'comment'
      ],
      numberFields: ['rating']
    }
  ];

  try {
    tableConfigs.forEach(function(config) {
      const tableResult = audit8E4D_compareTable_(config);
      result.tables[config.label] = tableResult;
      result.summary.table_count++;

      if (tableResult.spreadsheet_count !== tableResult.supabase_count) {
        result.summary.count_mismatch_tables++;
        addIssue('TABLE_COUNT_MISMATCH', {
          table: config.label,
          spreadsheet_count: tableResult.spreadsheet_count,
          supabase_count: tableResult.supabase_count
        });
      }

      if (tableResult.missing_in_supabase_count || tableResult.extra_in_supabase_count) {
        result.summary.missing_or_extra_tables++;
        addIssue('TABLE_MISSING_OR_EXTRA_ROWS', {
          table: config.label,
          missing_in_supabase_count: tableResult.missing_in_supabase_count,
          extra_in_supabase_count: tableResult.extra_in_supabase_count
        });
      }

      Object.keys(tableResult.field_summary || {}).forEach(function(key) {
        const fs = tableResult.field_summary[key];

        if (!fs.mismatch) return;

        if (fs.type === 'date') {
          result.summary.date_mismatch_fields++;

          if (fs.date_shift_minus_1 > 0) {
            result.summary.date_shift_minus_1_fields++;
          }

          addIssue('DATE_FIELD_MISMATCH', {
            table: config.label,
            field: fs.field,
            mismatch: fs.mismatch,
            date_shift_minus_1: fs.date_shift_minus_1,
            date_shift_plus_1: fs.date_shift_plus_1,
            source_filled_target_blank: fs.source_filled_target_blank,
            source_blank_target_filled: fs.source_blank_target_filled
          });
        }

        if (fs.type === 'time') {
          result.summary.time_mismatch_fields++;
          addIssue('TIME_FIELD_MISMATCH', {
            table: config.label,
            field: fs.field,
            mismatch: fs.mismatch
          });
        }

        if (fs.type === 'text') {
          result.summary.text_mismatch_fields++;
          addIssue('TEXT_FIELD_MISMATCH', {
            table: config.label,
            field: fs.field,
            mismatch: fs.mismatch,
            source_filled_target_blank: fs.source_filled_target_blank,
            source_blank_target_filled: fs.source_blank_target_filled
          });
        }

        if (fs.type === 'phone') {
          result.summary.phone_mismatch_fields++;
          addIssue('PHONE_FIELD_MISMATCH', {
            table: config.label,
            field: fs.field,
            mismatch: fs.mismatch,
            source_filled_target_blank: fs.source_filled_target_blank,
            source_blank_target_filled: fs.source_blank_target_filled
          });
        }

        if (fs.type === 'number') {
          result.summary.number_mismatch_fields++;
          addIssue('NUMBER_FIELD_MISMATCH', {
            table: config.label,
            field: fs.field,
            mismatch: fs.mismatch,
            source_filled_target_blank: fs.source_filled_target_blank,
            source_blank_target_filled: fs.source_blank_target_filled
          });
        }
      });
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8E-4D-1-Data-Parity-Compact-Audit',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMigrationStage8E4D2DateOnlyRepairDryRunLog() {
  const result = {
    success: true,
    stage: '8E-4D-2-Date-Only-Repair-Dry-Run',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    timezone: Session.getScriptTimeZone(),
    dry_run: true,
    write_executed: false,
    issue_count: 0,
    issues: [],
    summary: {
      table_count: 0,
      planned_update_count: 0,
      safe_shift_minus_1_count: 0,
      skipped_equal_count: 0,
      blocked_not_shift_count: 0,
      blocked_blank_source_count: 0,
      blocked_missing_target_count: 0
    },
    tables: {},
    samples: []
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({ issue: issue }, details || {}));
  }

  function addSample(sample) {
    if (result.samples.length >= 12) return;
    result.samples.push(sample);
  }

  function getPrimaryKeyValue_(row, keyField) {
    return audit8E4D_str_(row && row[keyField]);
  }

  function buildMapByKey_(rows, keyField) {
    const map = {};

    (rows || []).forEach(function(row) {
      const key = getPrimaryKeyValue_(row, keyField);
      if (key) map[key] = row;
    });

    return map;
  }

  const configs = [
    {
      label: 'patients',
      table: REPO_TABLES.PATIENTS || 'Patients',
      keyField: 'patient_id',
      fields: ['birth_date']
    },
    {
      label: 'appointments',
      table: REPO_TABLES.APPOINTMENTS || 'Appointments',
      keyField: 'appointment_id',
      fields: ['appointment_date']
    },
    {
      label: 'treatments',
      table: REPO_TABLES.TREATMENTS || 'Treatments',
      keyField: 'treatment_id',
      fields: ['treatment_date']
    },
    {
      label: 'ortho_recalls',
      table: REPO_TABLES.ORTHO_RECALL || 'OrthoRecall',
      keyField: 'ortho_recall_id',
      fields: ['install_date', 'last_control_date', 'next_due_date']
    },
    {
      label: 'billings',
      table: REPO_TABLES.BILLINGS || 'Billings',
      keyField: 'billing_id',
      fields: ['billing_date', 'due_date']
    }
  ];

  try {
    const sourceOptions = { backend_mode: 'spreadsheet' };
    const targetOptions = { backend_mode: 'supabase' };

    configs.forEach(function(config) {
      const sourceRows = dbFindAll_(config.table, sourceOptions) || [];
      const targetRows = dbFindAll_(config.table, targetOptions) || [];

      const targetMap = buildMapByKey_(targetRows, config.keyField);

      const tableResult = {
        table: config.table,
        keyField: config.keyField,
        spreadsheet_count: sourceRows.length,
        supabase_count: targetRows.length,
        planned_update_count: 0,
        safe_shift_minus_1_count: 0,
        skipped_equal_count: 0,
        blocked_not_shift_count: 0,
        blocked_blank_source_count: 0,
        blocked_missing_target_count: 0,
        fields: {}
      };

      config.fields.forEach(function(field) {
        tableResult.fields[field] = {
          planned_update_count: 0,
          safe_shift_minus_1_count: 0,
          skipped_equal_count: 0,
          blocked_not_shift_count: 0,
          blocked_blank_source_count: 0,
          blocked_missing_target_count: 0
        };
      });

      sourceRows.forEach(function(sourceRow) {
        const key = getPrimaryKeyValue_(sourceRow, config.keyField);
        if (!key) return;

        const targetRow = targetMap[key];

        config.fields.forEach(function(field) {
          const fieldResult = tableResult.fields[field];

          if (!targetRow) {
            fieldResult.blocked_missing_target_count++;
            tableResult.blocked_missing_target_count++;
            result.summary.blocked_missing_target_count++;

            addSample({
              table: config.label,
              key: key,
              field: field,
              issue: 'MISSING_TARGET_ROW'
            });

            return;
          }

          const sourceYmd = audit8E4D_ymd_(sourceRow[field]);
          const targetYmd = audit8E4D_ymd_(targetRow[field]);

          if (!sourceYmd) {
            if (!targetYmd) {
              fieldResult.skipped_equal_count++;
              tableResult.skipped_equal_count++;
              result.summary.skipped_equal_count++;
              return;
            }

            fieldResult.blocked_blank_source_count++;
            tableResult.blocked_blank_source_count++;
            result.summary.blocked_blank_source_count++;

            addSample({
              table: config.label,
              key: key,
              field: field,
              issue: 'SOURCE_BLANK_TARGET_FILLED',
              spreadsheet: sourceYmd,
              supabase: targetYmd
            });

            return;
          }

          if (sourceYmd === targetYmd) {
            fieldResult.skipped_equal_count++;
            tableResult.skipped_equal_count++;
            result.summary.skipped_equal_count++;
            return;
          }

          const targetPlusOne = audit8E4D_addDays_(targetYmd, 1);

          if (targetYmd && targetPlusOne === sourceYmd) {
            fieldResult.safe_shift_minus_1_count++;
            fieldResult.planned_update_count++;

            tableResult.safe_shift_minus_1_count++;
            tableResult.planned_update_count++;

            result.summary.safe_shift_minus_1_count++;
            result.summary.planned_update_count++;

            addSample({
              table: config.label,
              key: key,
              field: field,
              action: 'PLAN_UPDATE_SUPABASE_DATE',
              from_supabase: targetYmd,
              to_spreadsheet: sourceYmd
            });

            return;
          }

          fieldResult.blocked_not_shift_count++;
          tableResult.blocked_not_shift_count++;
          result.summary.blocked_not_shift_count++;

          addSample({
            table: config.label,
            key: key,
            field: field,
            issue: 'DATE_MISMATCH_NOT_SAFE_SHIFT_MINUS_1',
            spreadsheet: sourceYmd,
            supabase: targetYmd
          });
        });
      });

      result.tables[config.label] = tableResult;
      result.summary.table_count++;
    });

    Object.keys(result.tables).forEach(function(label) {
      const table = result.tables[label];

      if (table.blocked_missing_target_count > 0) {
        addIssue('BLOCKED_MISSING_TARGET_ROWS', {
          table: label,
          count: table.blocked_missing_target_count
        });
      }

      if (table.blocked_not_shift_count > 0) {
        addIssue('BLOCKED_DATE_MISMATCH_NOT_SAFE_SHIFT_MINUS_1', {
          table: label,
          count: table.blocked_not_shift_count
        });
      }

      if (table.blocked_blank_source_count > 0) {
        addIssue('BLOCKED_SOURCE_BLANK_TARGET_FILLED', {
          table: label,
          count: table.blocked_blank_source_count
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
      stage: '8E-4D-2-Date-Only-Repair-Dry-Run',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      dry_run: true,
      write_executed: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}