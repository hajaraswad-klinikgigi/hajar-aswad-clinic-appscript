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
 * @param {object} [options] - { return_rows: true } untuk mendapat array baris yang dihapus
 * @returns {object} { success: true, rows?: Array } — rows hanya jika return_rows=true
 */
function supabaseDelete_(table, filters, options) {
  if (!filters || Object.keys(filters).length === 0) {
    throw new Error('Supabase DELETE wajib menyertakan filters untuk menghindari delete massal');
  }

  var opts = options || {};
  var headers = opts.return_rows
    ? buildSupabaseHeaders_({ 'Prefer': 'return=representation' })
    : buildSupabaseHeaders_();

  var url = buildSupabaseUrl_(table, filters);
  var response = UrlFetchApp.fetch(url, {
    method: 'delete',
    headers: headers,
    muteHttpExceptions: true
  });

  var result = parseSupabaseResponse_(response);

  if (!result.success) {
    throw new Error('Supabase DELETE failed for ' + table + ': HTTP ' + result.status_code + ' - ' + JSON.stringify(result.body));
  }

  if (opts.return_rows) {
    return { success: true, rows: Array.isArray(result.body) ? result.body : [] };
  }
  return { success: true };
}

/**
 * SELECT paralel dari beberapa tabel sekaligus menggunakan UrlFetchApp.fetchAll().
 * Semua request dikirim bersamaan → total waktu = max(t1,t2,...,tn) bukan t1+t2+...+tn.
 *
 * @param {Array} requests - array of { table, filters, options }
 * @returns {Array} array of row arrays, sesuai urutan input
 *
 * Contoh penggunaan:
 *   var results = supabaseSelectParallel_([
 *     { table: 'clinic_info', options: { limit: 10 } },
 *     { table: 'doctor_compensation_rules', options: { limit: 100 } }
 *   ]);
 *   var clinicRows  = results[0];
 *   var doctorRows  = results[1];
 */
function supabaseSelectParallel_(requests) {
  var sharedHeaders = buildSupabaseHeaders_();

  var fetchRequests = requests.map(function(req) {
    var opts   = req.options || {};
    var params = { select: opts.select || '*' };
    if (opts.limit) params.limit = opts.limit;
    if (opts.order) params.order = opts.order;

    if (req.filters) {
      Object.keys(req.filters).forEach(function(key) {
        params[key] = req.filters[key];
      });
    }

    return {
      url:               buildSupabaseUrl_(req.table, params),
      method:            'GET',
      headers:           sharedHeaders,
      muteHttpExceptions: true
    };
  });

  var responses = UrlFetchApp.fetchAll(fetchRequests);

  return responses.map(function(response, i) {
    var result = parseSupabaseResponse_(response);
    if (!result.success) {
      throw new Error(
        'Supabase parallel SELECT failed [' + requests[i].table + ']: ' +
        'HTTP ' + result.status_code + ' — ' + JSON.stringify(result.body)
      );
    }
    return Array.isArray(result.body) ? result.body : [];
  });
}

/**
 * PATCH paralel ke beberapa row sekaligus menggunakan UrlFetchApp.fetchAll().
 * Setiap item dalam requests adalah satu PATCH operation dengan filter + data berbeda.
 * Total waktu = max(t1,...,tn) bukan t1+...+tn.
 *
 * @param {Array} requests - array of { table, filters, patch }
 *   filters: { installment_id: 'eq.XXX' }
 *   patch:   object field yang akan di-update
 *
 * Contoh:
 *   supabaseBatchPatch_([
 *     { table: 'billing_installments', filters: { installment_id: 'eq.INS-001' }, patch: { status: 'paid', paid_amount: 500000 } },
 *     { table: 'billing_installments', filters: { installment_id: 'eq.INS-002' }, patch: { status: 'partial', paid_amount: 250000 } }
 *   ]);
 */
function supabaseBatchPatch_(requests) {
  if (!requests || !requests.length) return [];

  var sharedHeaders = buildSupabaseHeaders_({ 'Prefer': 'return=minimal' });

  var fetchRequests = requests.map(function(req) {
    return {
      url:                buildSupabaseUrl_(req.table, req.filters || {}),
      method:             'patch',
      headers:            sharedHeaders,
      payload:            JSON.stringify(req.patch || {}),
      muteHttpExceptions: true
    };
  });

  var responses = UrlFetchApp.fetchAll(fetchRequests);

  responses.forEach(function(response, i) {
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error(
        'Supabase batch PATCH failed [' + requests[i].table + ']: ' +
        'HTTP ' + status + ' — ' + response.getContentText()
      );
    }
  });

  return responses;
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