/* =========================================================
   SUPABASE CLIENT
   Tahap 5J - Read-only staging client
   ========================================================= */

/**
 * Catatan:
 * - Tahap 5J hanya mengizinkan GET/HEAD.
 * - Belum ada insert/update/delete.
 * - Service role key hanya dipakai server-side Apps Script.
 */

const SUPABASE_STAGING_READ_ONLY_METHODS = Object.freeze([
  'GET',
  'HEAD'
]);

function buildSupabaseStagingQueryString_(params) {
  const query = params || {};
  const parts = [];

  Object.keys(query).forEach(function(key) {
    const value = query[key];

    if (value === null || value === undefined) return;

    parts.push(
      encodeURIComponent(key) + '=' + encodeURIComponent(String(value))
    );
  });

  return parts.length ? '?' + parts.join('&') : '';
}

function buildSupabaseStagingRestUrl_(path, params) {
  const config = assertSupabaseStagingConfig_();
  const normalizedPath = String(path || '').trim();

  if (!normalizedPath) {
    throw new Error('Supabase REST path kosong');
  }

  const safePath = normalizedPath.charAt(0) === '/'
    ? normalizedPath
    : '/' + normalizedPath;

  return config.url + safePath + buildSupabaseStagingQueryString_(params || {});
}

function getHeaderCaseInsensitive_(headers, headerName) {
  const source = headers || {};
  const target = String(headerName || '').toLowerCase();

  const foundKey = Object.keys(source).find(function(key) {
    return String(key || '').toLowerCase() === target;
  });

  return foundKey ? source[foundKey] : '';
}

function parseSupabaseResponseBody_(text) {
  const raw = String(text || '');

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return raw;
  }
}

function assertSupabaseReadOnlyMethod5J_(method) {
  const normalizedMethod = String(method || 'GET').trim().toUpperCase();

  if (SUPABASE_STAGING_READ_ONLY_METHODS.indexOf(normalizedMethod) === -1) {
    throw new Error(
      'Supabase client Tahap 5J hanya boleh read-only. Method ditolak: ' +
      normalizedMethod
    );
  }

  return normalizedMethod;
}

function supabaseStagingRequest_(method, path, options) {
  const opts = options || {};
  const normalizedMethod = assertSupabaseReadOnlyMethod5J_(method);
  const config = assertSupabaseStagingConfig_();

  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: 'Bearer ' + config.serviceRoleKey,
    Accept: 'application/json'
  };

  if (opts.prefer) {
    headers.Prefer = String(opts.prefer);
  }

  const url = buildSupabaseStagingRestUrl_(path, opts.params || {});

  const response = UrlFetchApp.fetch(url, {
    method: normalizedMethod,
    headers: headers,
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  const responseHeaders = response.getAllHeaders();

  return {
    success: statusCode >= 200 && statusCode < 300,
    status_code: statusCode,
    body: parseSupabaseResponseBody_(responseText),
    raw_body: responseText,
    headers: responseHeaders,
    content_range: getHeaderCaseInsensitive_(responseHeaders, 'content-range')
  };
}

function supabaseStagingSelect_(tableName, params, options) {
  const table = String(tableName || '').trim();

  if (!table) {
    throw new Error('Nama table Supabase kosong');
  }

  const safeTable = encodeURIComponent(table);

  return supabaseStagingRequest_(
    'GET',
    '/rest/v1/' + safeTable,
    {
      params: params || {},
      prefer: options && options.prefer ? options.prefer : ''
    }
  );
}

/* =========================================================
   SUPABASE MUTATION CLIENT SCAFFOLD - PHASE 7A-2
   ========================================================= */

/**
 * Catatan aman 7A-2:
 * - Ini jalur mutation baru dan eksplisit.
 * - Tidak mengubah supabaseStagingRequest_ read-only Tahap 5J.
 * - Tidak dipakai otomatis oleh dbInsert_/dbUpdate_/dbDelete_ lama.
 * - Tetap diblokir saat REPO_SUPABASE_STAGING_WRITE_TEST_ENABLED false.
 */

const SUPABASE_STAGING_MUTATION_METHODS_7A = Object.freeze([
  'POST',
  'PATCH',
  'DELETE'
]);

function assertSupabaseMutationMethod7A_(method) {
  const normalizedMethod = String(method || '').trim().toUpperCase();

  if (SUPABASE_STAGING_MUTATION_METHODS_7A.indexOf(normalizedMethod) === -1) {
    throw new Error(
      'Method mutation Supabase 7A tidak valid: ' + normalizedMethod +
      '. Method yang diizinkan: ' + SUPABASE_STAGING_MUTATION_METHODS_7A.join(', ')
    );
  }

  return normalizedMethod;
}

function normalizeSupabaseMutationPath7A_(path) {
  const rawPath = String(path || '').trim();

  if (!rawPath) {
    throw new Error('Path mutation Supabase tidak boleh kosong');
  }

  const normalizedPath = rawPath.charAt(0) === '/'
    ? rawPath
    : '/' + rawPath;

  if (normalizedPath.indexOf('/rest/v1/') !== 0) {
    throw new Error(
      'Path mutation Supabase harus memakai REST table path /rest/v1/{table}. Path ditolak: ' +
      normalizedPath
    );
  }

  return normalizedPath;
}

function getSupabaseMutationTargetTableFromPath7A_(path) {
  const normalizedPath = normalizeSupabaseMutationPath7A_(path);
  const match = normalizedPath.match(/^\/rest\/v1\/([^\/\?]+)/);

  if (!match || !match[1]) {
    throw new Error('Target table Supabase tidak ditemukan dari path: ' + normalizedPath);
  }

  return decodeURIComponent(match[1]);
}

function assertSupabaseMutationTableMatchesPath7A_(tableName, path) {
  const normalizedTableName = repoNormalizeTableName_(tableName);
  const expectedTargetTable = repoGetTargetTableForSheet_(normalizedTableName);
  const actualTargetTable = getSupabaseMutationTargetTableFromPath7A_(path);

  if (!expectedTargetTable) {
    throw new Error('Target table Supabase belum terdaftar untuk: ' + normalizedTableName);
  }

  if (actualTargetTable !== expectedTargetTable) {
    throw new Error(
      'Target table Supabase tidak sesuai. Sheet: ' + normalizedTableName +
      ', expected target: ' + expectedTargetTable +
      ', actual path target: ' + actualTargetTable
    );
  }

  return true;
}

function isPlainObjectSupabaseMutation7A_(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function hasOwnKeysSupabaseMutation7A_(value) {
  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function assertSupabaseMutationPayload7A_(method, payload) {
  const normalizedMethod = assertSupabaseMutationMethod7A_(method);

  if (normalizedMethod === 'DELETE') {
    return true;
  }

  if (Array.isArray(payload)) {
    if (!payload.length) {
      throw new Error('Payload mutation Supabase tidak boleh array kosong');
    }

    payload.forEach(function(item, index) {
      if (!isPlainObjectSupabaseMutation7A_(item) || !hasOwnKeysSupabaseMutation7A_(item)) {
        throw new Error('Payload array mutation Supabase item ke-' + index + ' tidak valid');
      }
    });

    return true;
  }

  if (!isPlainObjectSupabaseMutation7A_(payload) || !hasOwnKeysSupabaseMutation7A_(payload)) {
    throw new Error('Payload mutation Supabase harus object non-kosong');
  }

  return true;
}

function assertSupabaseMutationFilterParams7A_(method, params) {
  const normalizedMethod = assertSupabaseMutationMethod7A_(method);
  const queryParams = params || {};

  if (normalizedMethod !== 'PATCH' && normalizedMethod !== 'DELETE') {
    return true;
  }

  const filterKeys = Object.keys(queryParams).filter(function(key) {
    const normalizedKey = String(key || '').trim().toLowerCase();

    return normalizedKey &&
      normalizedKey !== 'select' &&
      normalizedKey !== 'order' &&
      normalizedKey !== 'limit' &&
      normalizedKey !== 'offset';
  });

  if (!filterKeys.length) {
    throw new Error(
      normalizedMethod + ' Supabase staging wajib memakai filter params agar tidak update/delete massal'
    );
  }

  return true;
}

function buildSupabaseMutationHeaders7A_(config, options) {
  const opts = options || {};
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: 'Bearer ' + config.serviceRoleKey,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  if (opts.prefer) {
    headers.Prefer = String(opts.prefer);
  } else {
    headers.Prefer = 'return=representation';
  }

  return headers;
}

function normalizeSupabaseMutationOptions7A_(options) {
  const opts = Object.assign({}, options || {});

  return Object.assign({}, opts, {
    backend_mode: opts.backend_mode || opts.backendMode || REPO_BACKEND_MODES.SUPABASE,
    write_intent: opts.write_intent ||
      opts.writeIntent ||
      (
        typeof repoGetSupabaseStagingWriteIntent_ === 'function'
          ? repoGetSupabaseStagingWriteIntent_()
          : 'SUPABASE_STAGING_MUTATION_TEST'
      ),
    stage: opts.stage || '7A'
  });
}

function supabaseStagingMutationRequest7A_(method, path, options) {
  const opts = normalizeSupabaseMutationOptions7A_(options || {});
  const normalizedMethod = assertSupabaseMutationMethod7A_(method);
  const normalizedPath = normalizeSupabaseMutationPath7A_(path);
  const tableName = String(opts.table_name || opts.tableName || '').trim();
  const payload = opts.payload;
  const params = opts.params || {};

  if (!tableName) {
    throw new Error('table_name wajib diisi untuk mutation Supabase 7A');
  }

  assertSupabaseMutationTableMatchesPath7A_(tableName, normalizedPath);
  assertSupabaseMutationPayload7A_(normalizedMethod, payload);
  assertSupabaseMutationFilterParams7A_(normalizedMethod, params);

  if (typeof repoAssertSupabaseStagingWriteAllowed_ !== 'function') {
    throw new Error('repoAssertSupabaseStagingWriteAllowed_ belum tersedia. Terapkan 7A-1 terlebih dahulu.');
  }

  repoAssertSupabaseStagingWriteAllowed_(Object.assign({}, opts, {
    operation: opts.operation || ('SUPABASE_' + normalizedMethod + '_7A'),
    table_name: tableName,
    backend_mode: opts.backend_mode,
    write_intent: opts.write_intent,
    stage: opts.stage
  }));

  const config = assertSupabaseStagingConfig_();
  const url = buildSupabaseStagingRestUrl_(normalizedPath, params);

  const fetchOptions = {
    method: normalizedMethod.toLowerCase(),
    headers: buildSupabaseMutationHeaders7A_(config, opts),
    muteHttpExceptions: true
  };

  if (normalizedMethod !== 'DELETE') {
    fetchOptions.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, fetchOptions);
  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();
  const responseHeaders = response.getAllHeaders();

  return {
    success: statusCode >= 200 && statusCode < 300,
    status_code: statusCode,
    body: parseSupabaseResponseBody_(responseText),
    raw_body: responseText,
    headers: responseHeaders,
    content_range: getHeaderCaseInsensitive_(responseHeaders, 'content-range'),
    method: normalizedMethod,
    path: normalizedPath,
    target_table: getSupabaseMutationTargetTableFromPath7A_(normalizedPath)
  };
}

function supabaseStagingInsert7A_(tableName, payload, options) {
  const normalizedTableName = repoNormalizeTableName_(tableName);
  const targetTable = repoGetTargetTableForSheet_(normalizedTableName);
  const safeTable = encodeURIComponent(targetTable);

  return supabaseStagingMutationRequest7A_(
    'POST',
    '/rest/v1/' + safeTable,
    Object.assign({}, options || {}, {
      table_name: normalizedTableName,
      payload: payload,
      operation: 'SUPABASE_INSERT_7A'
    })
  );
}

function supabaseStagingPatchByFilters7A_(tableName, filters, patch, options) {
  const normalizedTableName = repoNormalizeTableName_(tableName);
  const targetTable = repoGetTargetTableForSheet_(normalizedTableName);
  const safeTable = encodeURIComponent(targetTable);

  return supabaseStagingMutationRequest7A_(
    'PATCH',
    '/rest/v1/' + safeTable,
    Object.assign({}, options || {}, {
      table_name: normalizedTableName,
      params: Object.assign({}, filters || {}),
      payload: patch,
      operation: 'SUPABASE_PATCH_7A'
    })
  );
}

function supabaseStagingDeleteByFilters7A_(tableName, filters, options) {
  const normalizedTableName = repoNormalizeTableName_(tableName);
  const targetTable = repoGetTargetTableForSheet_(normalizedTableName);
  const safeTable = encodeURIComponent(targetTable);

  return supabaseStagingMutationRequest7A_(
    'DELETE',
    '/rest/v1/' + safeTable,
    Object.assign({}, options || {}, {
      table_name: normalizedTableName,
      params: Object.assign({}, filters || {}),
      payload: null,
      operation: 'SUPABASE_DELETE_7A'
    })
  );
}

function testSupabaseMutationClientPhase7AScaffoldLog() {
  const result = {
    success: true,
    stage: '7A-2',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof repoGetDefaultBackendMode_ === 'function'
      ? repoGetDefaultBackendMode_()
      : '',
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

    let invalidMethodBlocked = false;
    let invalidMethodMessage = '';

    try {
      supabaseStagingMutationRequest7A_('GET', '/rest/v1/patients', {
        table_name: REPO_TABLES.PATIENTS,
        payload: {
          patient_id: 'TEST-7A-METHOD'
        }
      });
    } catch (errInvalidMethod) {
      invalidMethodBlocked = true;
      invalidMethodMessage = errInvalidMethod && errInvalidMethod.message
        ? errInvalidMethod.message
        : String(errInvalidMethod || '');
    }

    addCheck('INVALID_MUTATION_METHOD_BLOCKED', invalidMethodBlocked, {
      message: invalidMethodMessage
    });

    let invalidPathBlocked = false;
    let invalidPathMessage = '';

    try {
      supabaseStagingMutationRequest7A_('POST', '/rpc/test_function', {
        table_name: REPO_TABLES.PATIENTS,
        payload: {
          patient_id: 'TEST-7A-PATH'
        }
      });
    } catch (errInvalidPath) {
      invalidPathBlocked = true;
      invalidPathMessage = errInvalidPath && errInvalidPath.message
        ? errInvalidPath.message
        : String(errInvalidPath || '');
    }

    addCheck('INVALID_MUTATION_PATH_BLOCKED', invalidPathBlocked, {
      message: invalidPathMessage
    });

    let tablePathMismatchBlocked = false;
    let tablePathMismatchMessage = '';

    try {
      supabaseStagingMutationRequest7A_('POST', '/rest/v1/billings', {
        table_name: REPO_TABLES.PATIENTS,
        payload: {
          patient_id: 'TEST-7A-MISMATCH'
        }
      });
    } catch (errMismatch) {
      tablePathMismatchBlocked = true;
      tablePathMismatchMessage = errMismatch && errMismatch.message
        ? errMismatch.message
        : String(errMismatch || '');
    }

    addCheck('TABLE_PATH_MISMATCH_BLOCKED', tablePathMismatchBlocked, {
      message: tablePathMismatchMessage
    });

    let emptyPayloadBlocked = false;
    let emptyPayloadMessage = '';

    try {
      supabaseStagingInsert7A_(REPO_TABLES.PATIENTS, {}, {
        stage: '7A'
      });
    } catch (errEmptyPayload) {
      emptyPayloadBlocked = true;
      emptyPayloadMessage = errEmptyPayload && errEmptyPayload.message
        ? errEmptyPayload.message
        : String(errEmptyPayload || '');
    }

    addCheck('EMPTY_INSERT_PAYLOAD_BLOCKED', emptyPayloadBlocked, {
      message: emptyPayloadMessage
    });

    let patchWithoutFilterBlocked = false;
    let patchWithoutFilterMessage = '';

    try {
      supabaseStagingPatchByFilters7A_(REPO_TABLES.PATIENTS, {}, {
        full_name: 'TEST 7A PATCH'
      }, {
        stage: '7A'
      });
    } catch (errPatchNoFilter) {
      patchWithoutFilterBlocked = true;
      patchWithoutFilterMessage = errPatchNoFilter && errPatchNoFilter.message
        ? errPatchNoFilter.message
        : String(errPatchNoFilter || '');
    }

    addCheck('PATCH_WITHOUT_FILTER_BLOCKED', patchWithoutFilterBlocked, {
      message: patchWithoutFilterMessage
    });

    let deleteWithoutFilterBlocked = false;
    let deleteWithoutFilterMessage = '';

    try {
      supabaseStagingDeleteByFilters7A_(REPO_TABLES.PATIENTS, {}, {
        stage: '7A'
      });
    } catch (errDeleteNoFilter) {
      deleteWithoutFilterBlocked = true;
      deleteWithoutFilterMessage = errDeleteNoFilter && errDeleteNoFilter.message
        ? errDeleteNoFilter.message
        : String(errDeleteNoFilter || '');
    }

    addCheck('DELETE_WITHOUT_FILTER_BLOCKED', deleteWithoutFilterBlocked, {
      message: deleteWithoutFilterMessage
    });

    let defaultOffInsertBlocked = false;
    let defaultOffInsertMessage = '';

    try {
      supabaseStagingInsert7A_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-7A-SHOULD-NOT-INSERT',
        full_name: 'Test 7A Should Not Insert'
      }, {
        stage: '7A'
      });
    } catch (errDefaultOffInsert) {
      defaultOffInsertBlocked = true;
      defaultOffInsertMessage = errDefaultOffInsert && errDefaultOffInsert.message
        ? errDefaultOffInsert.message
        : String(errDefaultOffInsert || '');
    }

    addCheck('MUTATION_CLIENT_DEFAULT_OFF_BLOCKS_INSERT', defaultOffInsertBlocked, {
      message: defaultOffInsertMessage
    });

    let legacyReadOnlyClientStillBlocked = false;
    let legacyReadOnlyClientMessage = '';

    try {
      supabaseStagingRequest_('POST', '/rest/v1/patients', {});
    } catch (errLegacyClient) {
      legacyReadOnlyClientStillBlocked = true;
      legacyReadOnlyClientMessage = errLegacyClient && errLegacyClient.message
        ? errLegacyClient.message
        : String(errLegacyClient || '');
    }

    addCheck('LEGACY_SUPABASE_CLIENT_POST_STILL_BLOCKED', legacyReadOnlyClientStillBlocked, {
      message: legacyReadOnlyClientMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7A-2',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function parseSupabaseContentRangeCount_(contentRange) {
  const text = String(contentRange || '').trim();

  if (!text) return null;

  const match = text.match(/\/(\d+)$/);

  if (!match) return null;

  return Number(match[1]);
}

function testSupabaseStagingConnection5J() {
  const result = {
    success: true,
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    config_status: getSupabaseStagingConfigStatus_(),
    request: {},
    table_check: {}
  };

  try {
    const response = supabaseStagingSelect_(
      'patients',
      {
        select: 'id',
        limit: 1
      },
      {
        prefer: 'count=exact'
      }
    );

    result.request = {
      success: response.success,
      status_code: response.status_code,
      content_range: response.content_range
    };

    const count = parseSupabaseContentRangeCount_(response.content_range);

    result.table_check = {
      table: 'patients',
      readable: response.success,
      count_from_content_range: count,
      body_is_array: Array.isArray(response.body),
      sample_length: Array.isArray(response.body) ? response.body.length : -1
    };

    if (!response.success) {
      result.issues.push({
        issue: 'SUPABASE_READ_REQUEST_FAILED',
        status_code: response.status_code,
        body: response.body
      });
    }

    if (!Array.isArray(response.body)) {
      result.issues.push({
        issue: 'SUPABASE_RESPONSE_BODY_NOT_ARRAY',
        body_type: typeof response.body
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      checked_at: typeof nowIso === 'function'
        ? nowIso()
        : new Date().toISOString(),
      issue_count: 1,
      issues: [
        {
          issue: 'SUPABASE_CONNECTION_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ],
      config_status: getSupabaseStagingConfigStatus_()
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testSupabaseStagingReadOnlyGuard5J() {
  const result = {
    success: true,
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    guard: {}
  };

  try {
    let blocked = false;
    let message = '';

    try {
      supabaseStagingRequest_('POST', '/rest/v1/patients', {});
    } catch (err) {
      blocked = true;
      message = err && err.message ? err.message : String(err || '');
    }

    result.guard.post_blocked = blocked;
    result.guard.message = message;

    if (!blocked) {
      result.issues.push({
        issue: 'READ_ONLY_GUARD_FAILED',
        message: 'POST tidak terblokir pada Tahap 5J'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      issue_count: 1,
      issues: [
        {
          issue: 'READ_ONLY_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}