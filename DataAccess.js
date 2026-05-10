/* =========================================================
   DATA ACCESS LAYER
   Tahap 3A - Spreadsheet Adapter awal
   ========================================================= */

/**
 * Backend default aplikasi tetap Spreadsheet.
 *
 * Catatan aman 6A:
 * - Jangan baca Script Properties untuk menentukan runtime backend mode.
 * - Ini mencegah aplikasi tanpa sengaja berpindah ke Supabase.
 * - Mode supabase hanya boleh dipakai lewat opsi eksplisit pada test/staging.
 */
const DATA_ACCESS_BACKEND_MODE = 'spreadsheet';

function dbGetDefaultBackendMode_() {
  if (typeof repoGetDefaultBackendMode_ === 'function') {
    return repoGetDefaultBackendMode_();
  }

  return DATA_ACCESS_BACKEND_MODE;
}

function dbNormalizeBackendMode_(backendMode) {
  if (typeof repoNormalizeBackendMode_ === 'function') {
    return repoNormalizeBackendMode_(backendMode || dbGetDefaultBackendMode_());
  }

  const raw = String(backendMode || DATA_ACCESS_BACKEND_MODE || '').trim().toLowerCase();

  if (!raw || raw === 'spreadsheet') {
    return 'spreadsheet';
  }

  if (raw === 'supabase') {
    return 'supabase';
  }

  throw new Error('Backend mode tidak dikenal: ' + raw);
}

function dbBuildAccessOptions_(options) {
  const rawOptions = Object.assign({}, options || {});
  const backendMode = dbNormalizeBackendMode_(
    rawOptions.backend_mode || rawOptions.backendMode || dbGetDefaultBackendMode_()
  );

  return Object.assign({}, rawOptions, {
    backend_mode: backendMode
  });
}

function dbGetBackendMode_(options) {
  return dbBuildAccessOptions_(options).backend_mode;
}

function dbIsSpreadsheetBackendMode_(backendMode) {
  return dbNormalizeBackendMode_(backendMode) === 'spreadsheet';
}

function dbIsSupabaseBackendMode_(backendMode) {
  return dbNormalizeBackendMode_(backendMode) === 'supabase';
}

function dbAssertReadBackendSupported_(backendMode) {
  const normalizedBackendMode = dbNormalizeBackendMode_(backendMode);

  if (normalizedBackendMode === 'spreadsheet') {
    return true;
  }

  if (normalizedBackendMode === 'supabase') {
    dbAssertSupabaseReadHelpers_();
    return true;
  }

  throw new Error('Backend mode read tidak didukung: ' + normalizedBackendMode);
}

function dbAssertWriteAllowed_(backendMode, operationName) {
  const normalizedBackendMode = dbNormalizeBackendMode_(backendMode);
  const normalizedOperationName = String(operationName || 'WRITE').trim() || 'WRITE';

  if (normalizedBackendMode !== 'spreadsheet') {
    throw new Error(
      normalizedOperationName + ' diblokir untuk backend_mode: ' + normalizedBackendMode
    );
  }

  return true;
}

function dbAssertSupabaseReadHelpers_() {
  const requiredHelpers = [
    'supabaseStagingSelect_'
  ];

  const missing = requiredHelpers.filter(function(fnName) {
    return typeof this[fnName] !== 'function';
  }, this);

  if (missing.length) {
    throw new Error('Helper Supabase read-only belum tersedia: ' + missing.join(', '));
  }
}

function dbGetSupabaseTargetTableForSheet_(tableName) {
  const normalizedTableName = dbNormalizeTableName_(tableName);

  if (typeof repoGetTargetTableForSheet_ !== 'function') {
    throw new Error('repoGetTargetTableForSheet_ belum tersedia');
  }

  const targetTable = String(repoGetTargetTableForSheet_(normalizedTableName) || '').trim();

  if (!targetTable) {
    throw new Error('Target table Supabase belum terdaftar untuk: ' + normalizedTableName);
  }

  return targetTable;
}

function dbNormalizeSupabaseLimit_(limitValue) {
  const num = Number(limitValue);

  if (!isFinite(num) || num <= 0) {
    return null;
  }

  return Math.floor(num);
}

function dbBuildSupabaseReadParams_(options) {
  const opts = Object.assign({}, options || {});
  const params = {
    select: String(opts.select || '*')
  };

  const limit = dbNormalizeSupabaseLimit_(opts.limit);

  if (limit) {
    params.limit = limit;
  }

  if (opts.offset !== null && opts.offset !== undefined && opts.offset !== '') {
    const offset = Number(opts.offset);

    if (isFinite(offset) && offset >= 0) {
      params.offset = Math.floor(offset);
    }
  }

  if (opts.order) {
    params.order = String(opts.order);
  }

  return params;
}

function dbAssertSupabaseResponseOk_(response, tableName) {
  if (!response || !response.success) {
    throw new Error(
      'Supabase read gagal untuk table ' + tableName +
      '. Status: ' + (response ? response.status_code : 'NO_RESPONSE') +
      '. Body: ' + JSON.stringify(response ? response.body : null)
    );
  }

  if (!Array.isArray(response.body)) {
    throw new Error(
      'Response Supabase bukan array untuk table ' + tableName +
      '. Body type: ' + typeof (response ? response.body : null)
    );
  }

  return true;
}

function dbSupabaseFindAll_(tableName, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const targetTable = dbGetSupabaseTargetTableForSheet_(normalizedTableName);
  const params = dbBuildSupabaseReadParams_(options);

  dbAssertSupabaseReadHelpers_();

  const response = supabaseStagingSelect_(
    targetTable,
    params,
    {
      prefer: 'count=exact'
    }
  );

  dbAssertSupabaseResponseOk_(response, targetTable);

  return response.body.map(function(row) {
    return Object.assign({}, row);
  });
}

function dbSupabaseFindById_(tableName, idFieldName, idValue, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const targetTable = dbGetSupabaseTargetTableForSheet_(normalizedTableName);
  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();
  const normalizedIdValue = String(idValue || '').trim();

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (!normalizedIdValue) {
    return null;
  }

  dbAssertSupabaseReadHelpers_();

  const params = {
    select: '*',
    limit: 1
  };

  params[keyField] = 'eq.' + normalizedIdValue;

  const response = supabaseStagingSelect_(
    targetTable,
    params,
    {
      prefer: 'count=exact'
    }
  );

  dbAssertSupabaseResponseOk_(response, targetTable);

  return response.body.length
    ? Object.assign({}, response.body[0])
    : null;
}

function dbNormalizeTableName_(tableName) {
  if (typeof repoNormalizeTableName_ !== 'function') {
    throw new Error('RepositoryConfig.gs belum tersedia atau belum dimuat');
  }

  return repoNormalizeTableName_(tableName);
}

function dbGetPrimaryKeyForTable_(tableName) {
  if (typeof repoGetPrimaryKeyForTable_ !== 'function') {
    throw new Error('repoGetPrimaryKeyForTable_ belum tersedia');
  }

  return repoGetPrimaryKeyForTable_(tableName);
}

function dbAssertSpreadsheetHelpers_() {
  const requiredHelpers = [
    'getSheet',
    'getRowsAsObjects',
    'appendObject',
    'updateObjectById',
    'deleteObjectById'
  ];

  const missing = requiredHelpers.filter(function(fnName) {
    return typeof this[fnName] !== 'function';
  }, this);

  if (missing.length) {
    throw new Error('Helper Spreadsheet belum tersedia: ' + missing.join(', '));
  }
}

/* =========================================================
   READ HELPERS
   ========================================================= */

function dbFindAll_(tableName, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const accessOptions = dbBuildAccessOptions_(options);

  dbAssertReadBackendSupported_(accessOptions.backend_mode);

  if (dbIsSupabaseBackendMode_(accessOptions.backend_mode)) {
    return dbSupabaseFindAll_(normalizedTableName, accessOptions);
  }

  dbAssertSpreadsheetHelpers_();

  const rows = getRowsAsObjects(normalizedTableName);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(function(row) {
    return Object.assign({}, row);
  });
}

function dbFindById_(tableName, idFieldName, idValue, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const accessOptions = dbBuildAccessOptions_(options);
  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();
  const normalizedIdValue = String(idValue || '').trim();

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (!normalizedIdValue) {
    return null;
  }

  dbAssertReadBackendSupported_(accessOptions.backend_mode);

  if (dbIsSupabaseBackendMode_(accessOptions.backend_mode)) {
    return dbSupabaseFindById_(
      normalizedTableName,
      keyField,
      normalizedIdValue,
      accessOptions
    );
  }

  const rows = dbFindAll_(normalizedTableName, accessOptions);

  return rows.find(function(row) {
    return String(row[keyField] || '').trim() === normalizedIdValue;
  }) || null;
}

function dbFindWhere_(tableName, predicateFn, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);

  if (typeof predicateFn !== 'function') {
    throw new Error('dbFindWhere_ membutuhkan predicate function');
  }

  return dbFindAll_(normalizedTableName, options).filter(predicateFn);
}

function dbFindFirstWhere_(tableName, predicateFn, options) {
  const rows = dbFindWhere_(tableName, predicateFn, options);
  return rows.length ? rows[0] : null;
}

function dbCountRows_(tableName, options) {
  return dbFindAll_(tableName, options).length;
}

function dbBuildIndexByField_(tableName, fieldName, options) {
  const normalizedFieldName = String(fieldName || '').trim();

  if (!normalizedFieldName) {
    throw new Error('Field index tidak boleh kosong');
  }

  const index = {};

  dbFindAll_(tableName, options).forEach(function(row) {
    const key = String(row[normalizedFieldName] || '').trim();

    if (!key) return;

    index[key] = row;
  });

  return index;
}

function dbGroupByField_(tableName, fieldName, options) {
  const normalizedFieldName = String(fieldName || '').trim();

  if (!normalizedFieldName) {
    throw new Error('Field group tidak boleh kosong');
  }

  const group = {};

  dbFindAll_(tableName, options).forEach(function(row) {
    const key = String(row[normalizedFieldName] || '').trim();

    if (!key) return;

    if (!group[key]) {
      group[key] = [];
    }

    group[key].push(row);
  });

  return group;
}

/* =========================================================
   WRITE HELPERS
   Catatan:
   - Fungsi write disiapkan untuk fase berikutnya.
   - Tahap 3A belum memakai fungsi write ini di service lama.
   ========================================================= */

function dbInsert_(tableName, obj, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const accessOptions = dbBuildAccessOptions_(options);

  dbAssertWriteAllowed_(accessOptions.backend_mode, 'INSERT');
  dbAssertSpreadsheetHelpers_();

  const data = Object.assign({}, obj || {});

  return appendObject(normalizedTableName, data);
}

function dbUpdateById_(tableName, idFieldName, idValue, patch, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const accessOptions = dbBuildAccessOptions_(options);

  dbAssertWriteAllowed_(accessOptions.backend_mode, 'UPDATE');
  dbAssertSpreadsheetHelpers_();

  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();
  const normalizedIdValue = String(idValue || '').trim();

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (!normalizedIdValue) {
    throw new Error('ID update tidak boleh kosong untuk table: ' + normalizedTableName);
  }

  return updateObjectById(
    normalizedTableName,
    keyField,
    normalizedIdValue,
    Object.assign({}, patch || {})
  );
}

function dbDeleteById_(tableName, idFieldName, idValue, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const accessOptions = dbBuildAccessOptions_(options);

  dbAssertWriteAllowed_(accessOptions.backend_mode, 'DELETE');
  dbAssertSpreadsheetHelpers_();

  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();
  const normalizedIdValue = String(idValue || '').trim();

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (!normalizedIdValue) {
    throw new Error('ID delete tidak boleh kosong untuk table: ' + normalizedTableName);
  }

  return deleteObjectById(
    normalizedTableName,
    keyField,
    normalizedIdValue
  );
}

function dbBatchInsert_(tableName, objects, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const accessOptions = dbBuildAccessOptions_(options);
  const rows = Array.isArray(objects) ? objects : [];

  dbAssertWriteAllowed_(accessOptions.backend_mode, 'BATCH_INSERT');

  if (!rows.length) {
    return {
      success: true,
      inserted_count: 0
    };
  }

  rows.forEach(function(row) {
    dbInsert_(normalizedTableName, row, accessOptions);
  });

  return {
    success: true,
    inserted_count: rows.length
  };
}

/* =========================================================
   SUPABASE STAGING EXPLICIT WRITE HELPERS - PHASE 7A-3

   Catatan aman:
   - Helper ini eksplisit untuk Supabase staging Fase 7.
   - Tidak mengubah dbInsert_/dbUpdateById_/dbDeleteById_ lama.
   - Tidak dipakai otomatis oleh service/UI.
   - Tetap blocked saat REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED false.
   ========================================================= */

function dbAssertSupabaseStagingWriteHelpers7A_() {
  const requiredHelpers = [
    'supabaseStagingInsert7A_',
    'supabaseStagingPatchByFilters7A_',
    'supabaseStagingDeleteByFilters7A_',
    'repoAssertSupabaseStagingWriteAllowed_'
  ];

  const missing = requiredHelpers.filter(function(fnName) {
    return typeof this[fnName] !== 'function';
  }, this);

  if (missing.length) {
    throw new Error('Helper Supabase staging write 7A belum tersedia: ' + missing.join(', '));
  }

  return true;
}

function dbBuildSupabaseStagingWriteOptions7A_(options, operationName) {
  const opts = Object.assign({}, options || {});

  return Object.assign({}, opts, {
    backend_mode: REPO_BACKEND_MODES.SUPABASE,
    write_intent: typeof repoGetSupabaseStagingWriteIntent_ === 'function'
      ? repoGetSupabaseStagingWriteIntent_()
      : 'SUPABASE_STAGING_MUTATION_TEST',
    stage: opts.stage || '7A',
    operation: operationName || opts.operation || 'DB_SUPABASE_STAGING_WRITE_7A'
  });
}

function dbBuildSupabaseEqFilter7A_(fieldName, value) {
  const keyField = String(fieldName || '').trim();
  const normalizedValue = String(value || '').trim();
  const filter = {};

  if (!keyField) {
    throw new Error('Field filter Supabase staging tidak boleh kosong');
  }

  if (!normalizedValue) {
    throw new Error('Value filter Supabase staging tidak boleh kosong');
  }

  filter[keyField] = 'eq.' + normalizedValue;

  return filter;
}

function dbAssertSupabaseStagingSafeUpdateDeleteById7A_(tableName, idFieldName) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (
    normalizedTableName === REPO_TABLES.TREATMENT_ITEMS &&
    keyField === repoGetPrimaryKeyForTable_(REPO_TABLES.TREATMENT_ITEMS)
  ) {
    throw new Error(
      'Update/delete TreatmentItems via legacy treatment_item_id diblokir. ' +
      'ID legacy TreatmentItems tidak dijamin unik; gunakan UUID internal Supabase pada fase khusus jika diperlukan.'
    );
  }

  return true;
}

function dbNormalizeSupabaseStagingWriteResult7A_(response, operationName, tableName) {
  const normalizedOperationName = String(operationName || 'SUPABASE_STAGING_WRITE_7A').trim();
  const normalizedTableName = dbNormalizeTableName_(tableName);

  if (!response || !response.success) {
    throw new Error(
      normalizedOperationName + ' gagal untuk table ' + normalizedTableName +
      '. Status: ' + (response ? response.status_code : 'NO_RESPONSE') +
      '. Body: ' + JSON.stringify(response ? response.body : null)
    );
  }

  return {
    success: true,
    operation: normalizedOperationName,
    table_name: normalizedTableName,
    target_table: response.target_table || dbGetSupabaseTargetTableForSheet_(normalizedTableName),
    status_code: response.status_code,
    row_count: Array.isArray(response.body) ? response.body.length : null,
    body: response.body
  };
}

function dbSupabaseInsertStaging7A_(tableName, obj, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const data = Object.assign({}, obj || {});
  const accessOptions = dbBuildSupabaseStagingWriteOptions7A_(
    options,
    'DB_SUPABASE_INSERT_7A'
  );

  dbAssertSupabaseStagingWriteHelpers7A_();

  const response = supabaseStagingInsert7A_(
    normalizedTableName,
    data,
    accessOptions
  );

  return dbNormalizeSupabaseStagingWriteResult7A_(
    response,
    'DB_SUPABASE_INSERT_7A',
    normalizedTableName
  );
}

function dbSupabaseUpdateByIdStaging7A_(tableName, idFieldName, idValue, patch, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();
  const normalizedIdValue = String(idValue || '').trim();
  const dataPatch = Object.assign({}, patch || {});
  const accessOptions = dbBuildSupabaseStagingWriteOptions7A_(
    options,
    'DB_SUPABASE_UPDATE_BY_ID_7A'
  );

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (!normalizedIdValue) {
    throw new Error('ID update Supabase staging tidak boleh kosong untuk table: ' + normalizedTableName);
  }

  dbAssertSupabaseStagingSafeUpdateDeleteById7A_(normalizedTableName, keyField);
  dbAssertSupabaseStagingWriteHelpers7A_();

  const response = supabaseStagingPatchByFilters7A_(
    normalizedTableName,
    dbBuildSupabaseEqFilter7A_(keyField, normalizedIdValue),
    dataPatch,
    accessOptions
  );

  return dbNormalizeSupabaseStagingWriteResult7A_(
    response,
    'DB_SUPABASE_UPDATE_BY_ID_7A',
    normalizedTableName
  );
}

function dbSupabaseDeleteByIdStaging7A_(tableName, idFieldName, idValue, options) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  const keyField = String(idFieldName || dbGetPrimaryKeyForTable_(normalizedTableName) || '').trim();
  const normalizedIdValue = String(idValue || '').trim();
  const accessOptions = dbBuildSupabaseStagingWriteOptions7A_(
    options,
    'DB_SUPABASE_DELETE_BY_ID_7A'
  );

  if (!keyField) {
    throw new Error('Primary key tidak ditemukan untuk table: ' + normalizedTableName);
  }

  if (!normalizedIdValue) {
    throw new Error('ID delete Supabase staging tidak boleh kosong untuk table: ' + normalizedTableName);
  }

  dbAssertSupabaseStagingSafeUpdateDeleteById7A_(normalizedTableName, keyField);
  dbAssertSupabaseStagingWriteHelpers7A_();

  const response = supabaseStagingDeleteByFilters7A_(
    normalizedTableName,
    dbBuildSupabaseEqFilter7A_(keyField, normalizedIdValue),
    accessOptions
  );

  return dbNormalizeSupabaseStagingWriteResult7A_(
    response,
    'DB_SUPABASE_DELETE_BY_ID_7A',
    normalizedTableName
  );
}

function testDataAccessPhase7AExplicitSupabaseWriteHelpersLog() {
  const result = {
    success: true,
    stage: '7A-3',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
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
    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_DEFAULT_OFF', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    let helpersAvailable = false;
    let helpersMessage = '';

    try {
      helpersAvailable = dbAssertSupabaseStagingWriteHelpers7A_() === true;
    } catch (errHelpers) {
      helpersMessage = errHelpers && errHelpers.message ? errHelpers.message : String(errHelpers || '');
    }

    addCheck('SUPABASE_STAGING_WRITE_HELPERS_AVAILABLE', helpersAvailable, {
      message: helpersMessage
    });

    let explicitInsertBlocked = false;
    let explicitInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-7A-3-SHOULD-NOT-INSERT',
        full_name: 'Test 7A-3 Should Not Insert'
      }, {
        stage: '7A'
      });
    } catch (errInsert) {
      explicitInsertBlocked = true;
      explicitInsertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('EXPLICIT_DB_SUPABASE_INSERT_DEFAULT_OFF_BLOCKED', explicitInsertBlocked, {
      message: explicitInsertMessage
    });

    let explicitUpdateBlocked = false;
    let explicitUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.PATIENTS,
        'patient_id',
        'TEST-7A-3-SHOULD-NOT-UPDATE',
        {
          full_name: 'Test 7A-3 Should Not Update'
        },
        {
          stage: '7A'
        }
      );
    } catch (errUpdate) {
      explicitUpdateBlocked = true;
      explicitUpdateMessage = errUpdate && errUpdate.message ? errUpdate.message : String(errUpdate || '');
    }

    addCheck('EXPLICIT_DB_SUPABASE_UPDATE_DEFAULT_OFF_BLOCKED', explicitUpdateBlocked, {
      message: explicitUpdateMessage
    });

    let explicitDeleteBlocked = false;
    let explicitDeleteMessage = '';

    try {
      dbSupabaseDeleteByIdStaging7A_(
        REPO_TABLES.PATIENTS,
        'patient_id',
        'TEST-7A-3-SHOULD-NOT-DELETE',
        {
          stage: '7A'
        }
      );
    } catch (errDelete) {
      explicitDeleteBlocked = true;
      explicitDeleteMessage = errDelete && errDelete.message ? errDelete.message : String(errDelete || '');
    }

    addCheck('EXPLICIT_DB_SUPABASE_DELETE_DEFAULT_OFF_BLOCKED', explicitDeleteBlocked, {
      message: explicitDeleteMessage
    });

    let treatmentItemsLegacyUpdateBlocked = false;
    let treatmentItemsLegacyUpdateMessage = '';

    try {
      dbSupabaseUpdateByIdStaging7A_(
        REPO_TABLES.TREATMENT_ITEMS,
        '',
        'TEST-LEGACY-TREATMENT-ITEM-ID',
        {
          quantity: 1
        },
        {
          stage: '7A'
        }
      );
    } catch (errTreatmentItemUpdate) {
      treatmentItemsLegacyUpdateBlocked = true;
      treatmentItemsLegacyUpdateMessage = errTreatmentItemUpdate && errTreatmentItemUpdate.message
        ? errTreatmentItemUpdate.message
        : String(errTreatmentItemUpdate || '');
    }

    addCheck('TREATMENT_ITEMS_LEGACY_ID_UPDATE_BLOCKED', treatmentItemsLegacyUpdateBlocked, {
      message: treatmentItemsLegacyUpdateMessage
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-OLD-DBINSERT-SHOULD-NOT-INSERT'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7A-3',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   SPREADSHEET INSPECTION HELPERS
   Read-only. Aman untuk aplikasi yang sedang dipakai.
   ========================================================= */

function dbGetSheetHeaders_(tableName) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  dbAssertSpreadsheetHelpers_();

  const sheet = getSheet(normalizedTableName);

  if (!sheet) {
    return [];
  }

  const lastColumn = sheet.getLastColumn();

  if (!lastColumn) {
    return [];
  }

  return sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function(header) {
      return String(header || '').trim();
    });
}

function dbInspectTable_(tableName) {
  const normalizedTableName = dbNormalizeTableName_(tableName);
  dbAssertSpreadsheetHelpers_();

  const sheet = getSheet(normalizedTableName);
  const primaryKey = dbGetPrimaryKeyForTable_(normalizedTableName);
  const headers = dbGetSheetHeaders_(normalizedTableName);

  return {
    sheet_name: normalizedTableName,
    target_table: typeof repoGetTargetTableForSheet_ === 'function'
      ? repoGetTargetTableForSheet_(normalizedTableName)
      : '',
    primary_key: primaryKey,
    sheet_exists: !!sheet,
    last_row: sheet ? sheet.getLastRow() : 0,
    last_column: sheet ? sheet.getLastColumn() : 0,
    data_row_count: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
    header_count: headers.length,
    primary_key_exists_in_header: headers.indexOf(primaryKey) !== -1
  };
}

function dbInspectAllTables_() {
  if (typeof repoGetAllTableNames_ !== 'function') {
    throw new Error('repoGetAllTableNames_ belum tersedia');
  }

  return repoGetAllTableNames_().map(function(tableName) {
    return dbInspectTable_(tableName);
  });
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testDataAccessPhase3AReadOnly() {
  const result = {
    success: true,
    backend_mode: dbGetBackendMode_(),
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    table_count: 0,
    issue_count: 0,
    issues: [],
    tables: []
  };

  try {
    const tables = dbInspectAllTables_();

    result.table_count = tables.length;
    result.tables = tables;

    tables.forEach(function(table) {
      if (!table.sheet_exists) {
        result.issues.push({
          sheet_name: table.sheet_name,
          issue: 'SHEET_NOT_FOUND'
        });
      }

      if (!table.primary_key) {
        result.issues.push({
          sheet_name: table.sheet_name,
          issue: 'PRIMARY_KEY_NOT_CONFIGURED'
        });
      }

      if (table.primary_key && !table.primary_key_exists_in_header) {
        result.issues.push({
          sheet_name: table.sheet_name,
          primary_key: table.primary_key,
          issue: 'PRIMARY_KEY_HEADER_NOT_FOUND'
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

function testDataAccessPhase3AFindSamples() {
  const result = {
    success: true,
    backend_mode: dbGetBackendMode_(),
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    samples: [],
    issue_count: 0,
    issues: []
  };

  try {
    const tableNames = repoGetAllTableNames_();

    tableNames.forEach(function(tableName) {
      const primaryKey = dbGetPrimaryKeyForTable_(tableName);
      const rows = dbFindAll_(tableName);
      const firstRow = rows.length ? rows[0] : null;
      const firstId = firstRow ? String(firstRow[primaryKey] || '').trim() : '';
      const found = firstId ? dbFindById_(tableName, primaryKey, firstId) : null;

      const sample = {
        sheet_name: tableName,
        primary_key: primaryKey,
        row_count: rows.length,
        first_id: firstId,
        find_by_id_ok: firstId ? !!found : true
      };

      result.samples.push(sample);

      if (firstId && !found) {
        result.issues.push({
          sheet_name: tableName,
          primary_key: primaryKey,
          first_id: firstId,
          issue: 'FIND_BY_ID_FAILED'
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

function testDataAccessPhase6ABackendModeSwitchLog() {
  const result = {
    success: true,
    stage: '6A',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: '',
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
    const defaultMode = dbGetBackendMode_();
    result.default_backend_mode = defaultMode;

    addCheck('DEFAULT_BACKEND_MODE_IS_SPREADSHEET', defaultMode === 'spreadsheet', {
      actual: defaultMode
    });

    const spreadsheetMode = dbGetBackendMode_({
      backend_mode: 'spreadsheet'
    });

    addCheck('SPREADSHEET_MODE_RECOGNIZED', spreadsheetMode === 'spreadsheet', {
      actual: spreadsheetMode
    });

    const supabaseMode = dbGetBackendMode_({
      backend_mode: 'supabase'
    });

    addCheck('SUPABASE_MODE_RECOGNIZED_FOR_TEST_ONLY', supabaseMode === 'supabase', {
      actual: supabaseMode
    });

    let unknownModeRejected = false;
    let unknownModeMessage = '';

    try {
      dbGetBackendMode_({
        backend_mode: 'unknown_backend'
      });
    } catch (errUnknown) {
      unknownModeRejected = true;
      unknownModeMessage = errUnknown && errUnknown.message ? errUnknown.message : String(errUnknown || '');
    }

    addCheck('UNKNOWN_BACKEND_MODE_REJECTED', unknownModeRejected, {
      message: unknownModeMessage
    });

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbAssertWriteAllowed_('supabase', 'TEST_WRITE');
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    addCheck('SUPABASE_WRITE_GUARD_BLOCKS_WRITE', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    let spreadsheetWriteAllowed = false;
    let spreadsheetWriteMessage = '';

    try {
      spreadsheetWriteAllowed = dbAssertWriteAllowed_('spreadsheet', 'TEST_WRITE') === true;
    } catch (errSpreadsheetWrite) {
      spreadsheetWriteMessage = errSpreadsheetWrite && errSpreadsheetWrite.message
        ? errSpreadsheetWrite.message
        : String(errSpreadsheetWrite || '');
    }

    addCheck('SPREADSHEET_WRITE_GUARD_STILL_ALLOWED', spreadsheetWriteAllowed, {
      message: spreadsheetWriteMessage
    });

    let supabaseReadSupported = false;
    let supabaseReadMessage = '';

    try {
      supabaseReadSupported = dbAssertReadBackendSupported_('supabase') === true;
    } catch (errRead) {
      supabaseReadMessage = errRead && errRead.message ? errRead.message : String(errRead || '');
    }

    addCheck('SUPABASE_READ_ADAPTER_ACTIVE_IN_6B', supabaseReadSupported, {
      message: supabaseReadMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6A',
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testDataAccessPhase6ARepositoryReadOnlyRegressionLog() {
  const result = {
    success: true,
    stage: '6A',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: dbGetBackendMode_(),
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
    addTest('testDataAccessPhase3AReadOnly', testDataAccessPhase3AReadOnly());
    addTest('testDataAccessPhase3AFindSamples', testDataAccessPhase3AFindSamples());

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6A',
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testDataAccessPhase6BSupabaseReadOnlyAdapterLog() {
  const result = {
    success: true,
    stage: '6B',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: dbGetBackendMode_(),
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
    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    const tablesToCheck = [
      'Patients',
      'ServiceCatalog',
      'Billings'
    ];

    tablesToCheck.forEach(function(tableName) {
      const primaryKey = dbGetPrimaryKeyForTable_(tableName);
      const rows = dbFindAll_(tableName, {
        backend_mode: 'supabase',
        limit: 3
      });

      addCheck('SUPABASE_FIND_ALL_' + tableName, Array.isArray(rows), {
        table_name: tableName,
        row_count_sample: Array.isArray(rows) ? rows.length : -1
      });

      const firstRow = rows.length ? rows[0] : null;
      const firstId = firstRow ? String(firstRow[primaryKey] || '').trim() : '';

      if (firstId) {
        const found = dbFindById_(tableName, primaryKey, firstId, {
          backend_mode: 'supabase'
        });

        addCheck('SUPABASE_FIND_BY_ID_' + tableName, !!found, {
          table_name: tableName,
          primary_key: primaryKey,
          first_id: firstId
        });

        const filtered = dbFindWhere_(
          tableName,
          function(row) {
            return String(row[primaryKey] || '').trim() === firstId;
          },
          {
            backend_mode: 'supabase',
            limit: 10
          }
        );

        addCheck('SUPABASE_FIND_WHERE_' + tableName, filtered.length >= 1, {
          table_name: tableName,
          primary_key: primaryKey,
          first_id: firstId,
          filtered_count: filtered.length
        });
      } else {
        addCheck('SUPABASE_SAMPLE_ID_AVAILABLE_' + tableName, rows.length === 0, {
          table_name: tableName,
          row_count_sample: rows.length,
          note: 'Table kosong atau sample tidak memiliki primary key'
        });
      }
    });

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_('Patients', {
        patient_id: 'TEST-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    addCheck('SUPABASE_DB_INSERT_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6B',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testDataAccessPhase6BSpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6B',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: dbGetBackendMode_(),
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
    addTest('testDataAccessPhase6ABackendModeSwitchLog', testDataAccessPhase6ABackendModeSwitchLog());
    addTest('testDataAccessPhase6ARepositoryReadOnlyRegressionLog', testDataAccessPhase6ARepositoryReadOnlyRegressionLog());

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6B',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}