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