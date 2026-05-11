/* =========================================================
   DATA ACCESS LAYER
   Router sederhana untuk Spreadsheet dan Supabase
   ========================================================= */

/**
 * Tentukan backend mode yang akan dipakai.
 * Default ambil dari RepositoryConfig (REPO_DEFAULT_BACKEND_MODE).
 * Bisa di-override per-call dengan options.backend_mode.
 */
function dbGetBackendMode_(options) {
  var opts = options || {};
  var mode = opts.backend_mode || opts.backendMode || repoGetDefaultBackendMode_();
  return repoNormalizeBackendMode_(mode);
}

function dbIsSpreadsheetMode_(options) {
  return dbGetBackendMode_(options) === REPO_BACKEND_MODES.SPREADSHEET;
}

function dbIsSupabaseMode_(options) {
  return dbGetBackendMode_(options) === REPO_BACKEND_MODES.SUPABASE;
}

/* =========================================================
   READ HELPERS
   ========================================================= */

/**
 * Ambil semua baris dari sebuah tabel.
 */
function dbFindAll_(tableName, options) {
  var normalizedTable = repoNormalizeTableName_(tableName);

  if (dbIsSupabaseMode_(options)) {
    var targetTable = repoGetTargetTableForSheet_(normalizedTable);
    var rows = supabaseSelect_(targetTable, null, {
      limit: options && options.limit ? options.limit : 10000
    });
    return rows.map(function(row) { return Object.assign({}, row); });
  }

  // Spreadsheet mode
  var rows = getRowsAsObjects(normalizedTable);
  if (!Array.isArray(rows)) return [];
  return rows.map(function(row) { return Object.assign({}, row); });
}

/**
 * Cari satu baris by ID.
 */
function dbFindById_(tableName, idFieldName, idValue, options) {
  var normalizedTable = repoNormalizeTableName_(tableName);
  var keyField = String(idFieldName || repoGetPrimaryKeyForTable_(normalizedTable) || '').trim();
  var normalizedId = String(idValue || '').trim();

  if (!keyField) throw new Error('Primary key tidak ditemukan untuk: ' + normalizedTable);
  if (!normalizedId) return null;

  if (dbIsSupabaseMode_(options)) {
    var targetTable = repoGetTargetTableForSheet_(normalizedTable);
    var filters = {};
    filters[keyField] = 'eq.' + normalizedId;
    var rows = supabaseSelect_(targetTable, filters, { limit: 1 });
    return rows.length ? Object.assign({}, rows[0]) : null;
  }

  // Spreadsheet mode - scan rows
  var allRows = dbFindAll_(normalizedTable, options);
  return allRows.find(function(row) {
    return String(row[keyField] || '').trim() === normalizedId;
  }) || null;
}

/**
 * Cari baris dengan predicate function (in-memory filter).
 */
function dbFindWhere_(tableName, predicateFn, options) {
  if (typeof predicateFn !== 'function') {
    throw new Error('dbFindWhere_ membutuhkan predicate function');
  }
  return dbFindAll_(tableName, options).filter(predicateFn);
}

function dbFindFirstWhere_(tableName, predicateFn, options) {
  var rows = dbFindWhere_(tableName, predicateFn, options);
  return rows.length ? rows[0] : null;
}

function dbCountRows_(tableName, options) {
  return dbFindAll_(tableName, options).length;
}

function dbBuildIndexByField_(tableName, fieldName, options) {
  var field = String(fieldName || '').trim();
  if (!field) throw new Error('Field index tidak boleh kosong');

  var index = {};
  dbFindAll_(tableName, options).forEach(function(row) {
    var key = String(row[field] || '').trim();
    if (key) index[key] = row;
  });
  return index;
}

function dbGroupByField_(tableName, fieldName, options) {
  var field = String(fieldName || '').trim();
  if (!field) throw new Error('Field group tidak boleh kosong');

  var group = {};
  dbFindAll_(tableName, options).forEach(function(row) {
    var key = String(row[field] || '').trim();
    if (!key) return;
    if (!group[key]) group[key] = [];
    group[key].push(row);
  });
  return group;
}

/* =========================================================
   WRITE HELPERS
   ========================================================= */

function dbInsert_(tableName, obj, options) {
  var normalizedTable = repoNormalizeTableName_(tableName);
  var data = Object.assign({}, obj || {});

  if (dbIsSupabaseMode_(options)) {
    var targetTable = repoGetTargetTableForSheet_(normalizedTable);
    return supabaseInsert_(targetTable, data);
  }

  // Spreadsheet mode
  return appendObject(normalizedTable, data);
}

function dbUpdateById_(tableName, idFieldName, idValue, patch, options) {
  var normalizedTable = repoNormalizeTableName_(tableName);
  var keyField = String(idFieldName || repoGetPrimaryKeyForTable_(normalizedTable) || '').trim();
  var normalizedId = String(idValue || '').trim();
  var data = Object.assign({}, patch || {});

  if (!keyField) throw new Error('Primary key tidak ditemukan untuk: ' + normalizedTable);
  if (!normalizedId) throw new Error('ID update tidak boleh kosong untuk: ' + normalizedTable);

  if (dbIsSupabaseMode_(options)) {
    var targetTable = repoGetTargetTableForSheet_(normalizedTable);
    var filters = {};
    filters[keyField] = 'eq.' + normalizedId;
    return supabaseUpdate_(targetTable, filters, data);
  }

  // Spreadsheet mode
  return updateObjectById(normalizedTable, keyField, normalizedId, data);
}

function dbDeleteById_(tableName, idFieldName, idValue, options) {
  var normalizedTable = repoNormalizeTableName_(tableName);
  var keyField = String(idFieldName || repoGetPrimaryKeyForTable_(normalizedTable) || '').trim();
  var normalizedId = String(idValue || '').trim();

  if (!keyField) throw new Error('Primary key tidak ditemukan untuk: ' + normalizedTable);
  if (!normalizedId) throw new Error('ID delete tidak boleh kosong untuk: ' + normalizedTable);

  if (dbIsSupabaseMode_(options)) {
    var targetTable = repoGetTargetTableForSheet_(normalizedTable);
    var filters = {};
    filters[keyField] = 'eq.' + normalizedId;
    return supabaseDelete_(targetTable, filters);
  }

  // Spreadsheet mode
  return deleteObjectById(normalizedTable, keyField, normalizedId);
}

function dbBatchInsert_(tableName, objects, options) {
  var rows = Array.isArray(objects) ? objects : [];
  if (!rows.length) return { success: true, inserted_count: 0 };

  // Untuk Supabase, kirim sebagai array sekaligus
  if (dbIsSupabaseMode_(options)) {
    var normalizedTable = repoNormalizeTableName_(tableName);
    var targetTable = repoGetTargetTableForSheet_(normalizedTable);
    supabaseInsert_(targetTable, rows);
    return { success: true, inserted_count: rows.length };
  }

  // Spreadsheet mode - insert satu per satu
  rows.forEach(function(row) {
    dbInsert_(tableName, row, options);
  });
  return { success: true, inserted_count: rows.length };
}

/* =========================================================
   INSPECTION HELPERS
   Read-only utilities untuk inspeksi tabel.
   ========================================================= */

function dbGetSheetHeaders_(tableName) {
  var normalizedTable = repoNormalizeTableName_(tableName);
  var sheet = getSheet(normalizedTable);
  if (!sheet) return [];

  var lastCol = sheet.getLastColumn();
  if (!lastCol) return [];

  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h || '').trim();
  });
}

function dbInspectTable_(tableName) {
  var normalizedTable = repoNormalizeTableName_(tableName);
  var sheet = getSheet(normalizedTable);
  var primaryKey = repoGetPrimaryKeyForTable_(normalizedTable);
  var headers = dbGetSheetHeaders_(normalizedTable);

  return {
    sheet_name: normalizedTable,
    target_table: repoGetTargetTableForSheet_(normalizedTable),
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
  return repoGetAllTableNames_().map(function(tableName) {
    return dbInspectTable_(tableName);
  });
}

/* =========================================================
   TEST HELPERS - aman dijalankan
   ========================================================= */

function testDataAccessSpreadsheet() {
  try {
    var patients = dbFindAll_('Patients');
    Logger.log('✅ Spreadsheet OK. Total pasien: ' + patients.length);
    if (patients.length) Logger.log('Sample: ' + JSON.stringify(patients[0]).slice(0, 200));
    return { success: true, count: patients.length };
  } catch (e) {
    Logger.log('❌ Spreadsheet error: ' + e.message);
    return { success: false, error: e.message };
  }
}

function testDataAccessSupabase() {
  try {
    var patients = dbFindAll_('Patients', { backend_mode: 'supabase' });
    Logger.log('✅ Supabase OK. Total pasien: ' + patients.length);
    if (patients.length) Logger.log('Sample: ' + JSON.stringify(patients[0]).slice(0, 200));
    return { success: true, count: patients.length };
  } catch (e) {
    Logger.log('❌ Supabase error: ' + e.message);
    return { success: false, error: e.message };
  }
}