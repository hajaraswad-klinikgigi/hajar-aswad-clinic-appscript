/* =========================================================
   SUPABASE CLIENT
   Client sederhana untuk REST API Supabase
   ========================================================= */

/**
 * Mengambil konfigurasi Supabase dari Script Properties.
 * Konfigurasi disimpan di:
 *   - SUPABASE_STAGING_URL
 *   - SUPABASE_STAGING_SERVICE_ROLE_KEY
 */
function getSupabaseConfig_() {
  return getSupabaseStagingConfig_();
}

/**
 * Build URL untuk REST endpoint Supabase.
 */
function buildSupabaseUrl_(table, params) {
  var config = getSupabaseConfig_();
  var query = '';

  if (params) {
    var parts = [];
    Object.keys(params).forEach(function(key) {
      var value = params[key];
      if (value === null || value === undefined) return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    });
    if (parts.length) query = '?' + parts.join('&');
  }

  return config.url + '/rest/v1/' + encodeURIComponent(table) + query;
}

/**
 * Build headers standar untuk request Supabase.
 */
function buildSupabaseHeaders_(extraHeaders) {
  var config = getSupabaseConfig_();
  var headers = {
    'apikey': config.serviceRoleKey,
    'Authorization': 'Bearer ' + config.serviceRoleKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function(key) {
      headers[key] = extraHeaders[key];
    });
  }

  return headers;
}

/**
 * Parse response body dari Supabase.
 */
function parseSupabaseResponse_(response) {
  var statusCode = response.getResponseCode();
  var text = response.getContentText();
  var body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }
  }

  return {
    success: statusCode >= 200 && statusCode < 300,
    status_code: statusCode,
    body: body
  };
}

/**
 * SELECT data dari Supabase.
 *
 * @param {string} table - nama tabel
 * @param {object} filters - filter: { patient_id: 'eq.P001', is_active: 'eq.true' }
 * @param {object} options - { select, limit, order }
 * @returns {array} array of rows
 */
function supabaseSelect_(table, filters, options) {
  var opts = options || {};
  var params = {};

  params.select = opts.select || '*';
  if (opts.limit) params.limit = opts.limit;
  if (opts.order) params.order = opts.order;

  // Tambahkan filter (sudah dalam format PostgREST: 'eq.value', 'gt.value', dll)
  if (filters) {
    Object.keys(filters).forEach(function(key) {
      params[key] = filters[key];
    });
  }

  var url = buildSupabaseUrl_(table, params);
  var response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: buildSupabaseHeaders_(),
    muteHttpExceptions: true
  });

  var result = parseSupabaseResponse_(response);

  if (!result.success) {
    throw new Error('Supabase SELECT failed for ' + table + ': HTTP ' + result.status_code + ' - ' + JSON.stringify(result.body));
  }

  return Array.isArray(result.body) ? result.body : [];
}

/**
 * INSERT data ke Supabase.
 *
 * @param {string} table
 * @param {object|array} data - object tunggal atau array of objects
 * @returns {object} inserted row(s)
 */
function supabaseInsert_(table, data) {
  var url = buildSupabaseUrl_(table);
  var response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: buildSupabaseHeaders_({ 'Prefer': 'return=representation' }),
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  });

  var result = parseSupabaseResponse_(response);

  if (!result.success) {
    throw new Error('Supabase INSERT failed for ' + table + ': HTTP ' + result.status_code + ' - ' + JSON.stringify(result.body));
  }

  // Kalau input data adalah object tunggal, return object pertama dari response array
  if (!Array.isArray(data) && Array.isArray(result.body) && result.body.length > 0) {
    return result.body[0];
  }
  return result.body;
}

/**
 * UPDATE data di Supabase by filter.
 *
 * @param {string} table
 * @param {object} filters - WAJIB ada, untuk menghindari update massal
 * @param {object} patch - data yang akan di-update
 */
function supabaseUpdate_(table, filters, patch) {
  if (!filters || Object.keys(filters).length === 0) {
    throw new Error('Supabase UPDATE wajib menyertakan filters untuk menghindari update massal');
  }

  var url = buildSupabaseUrl_(table, filters);
  var response = UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: buildSupabaseHeaders_({ 'Prefer': 'return=representation' }),
    payload: JSON.stringify(patch),
    muteHttpExceptions: true
  });

  var result = parseSupabaseResponse_(response);

  if (!result.success) {
    throw new Error('Supabase UPDATE failed for ' + table + ': HTTP ' + result.status_code + ' - ' + JSON.stringify(result.body));
  }

  // Update biasanya single record, return object pertama
  if (Array.isArray(result.body) && result.body.length > 0) {
    return result.body[0];
  }
  return result.body;
}

/**
 * DELETE data di Supabase by filter.
 *
 * @param {string} table
 * @param {object} filters - WAJIB ada, untuk menghindari delete massal
 */
function supabaseDelete_(table, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    throw new Error('Supabase DELETE wajib menyertakan filters untuk menghindari delete massal');
  }

  var url = buildSupabaseUrl_(table, filters);
  var response = UrlFetchApp.fetch(url, {
    method: 'delete',
    headers: buildSupabaseHeaders_(),
    muteHttpExceptions: true
  });

  var result = parseSupabaseResponse_(response);

  if (!result.success) {
    throw new Error('Supabase DELETE failed for ' + table + ': HTTP ' + result.status_code + ' - ' + JSON.stringify(result.body));
  }

  return { success: true };
}

/* =========================================================
   TEST HELPERS - aman dijalankan, hanya read
   ========================================================= */

function testSupabaseConnection() {
  try {
    var rows = supabaseSelect_('patients', null, { limit: 1 });
    Logger.log('✅ Koneksi Supabase OK. Sample rows: ' + rows.length);
    if (rows.length) Logger.log('Sample data: ' + JSON.stringify(rows[0], null, 2));
    return { success: true, sample_count: rows.length };
  } catch (e) {
    Logger.log('❌ Koneksi Supabase gagal: ' + e.message);
    return { success: false, error: e.message };
  }
}