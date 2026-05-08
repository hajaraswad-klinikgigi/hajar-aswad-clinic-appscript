/* =========================================================
   SUPABASE CONFIG
   Tahap 5J - Staging connection config
   Read-only test phase
   ========================================================= */

/**
 * Catatan keamanan:
 * - Jangan hardcode Supabase service_role key di file ini.
 * - Simpan credential di Apps Script Properties.
 * - Jangan pernah kirim service_role key ke frontend.
 */

const SUPABASE_STAGING_PROPERTY_KEYS = Object.freeze({
  URL: 'SUPABASE_STAGING_URL',
  SERVICE_ROLE_KEY: 'SUPABASE_STAGING_SERVICE_ROLE_KEY'
});

function normalizeSupabaseStagingUrl_(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getSupabaseStagingConfig_() {
  const props = PropertiesService.getScriptProperties();

  const url = normalizeSupabaseStagingUrl_(
    props.getProperty(SUPABASE_STAGING_PROPERTY_KEYS.URL)
  );

  const serviceRoleKey = String(
    props.getProperty(SUPABASE_STAGING_PROPERTY_KEYS.SERVICE_ROLE_KEY) || ''
  ).trim();

  return {
    url: url,
    serviceRoleKey: serviceRoleKey
  };
}

function getSupabaseStagingConfigStatus_() {
  const config = getSupabaseStagingConfig_();

  return {
    has_url: !!config.url,
    has_service_role_key: !!config.serviceRoleKey,
    url_preview: config.url
      ? config.url.replace(/^https?:\/\//, '').slice(0, 24) + '...'
      : '',
    service_role_key_length: config.serviceRoleKey
      ? config.serviceRoleKey.length
      : 0
  };
}

function assertSupabaseStagingConfig_() {
  const config = getSupabaseStagingConfig_();
  const errors = [];

  if (!config.url) {
    errors.push('SUPABASE_STAGING_URL belum diisi di Script Properties');
  }

  if (config.url && !/^https:\/\/.+\.supabase\.co$/i.test(config.url)) {
    errors.push('SUPABASE_STAGING_URL tidak terlihat seperti URL Supabase yang valid');
  }

  if (!config.serviceRoleKey) {
    errors.push('SUPABASE_STAGING_SERVICE_ROLE_KEY belum diisi di Script Properties');
  }

  if (config.serviceRoleKey && /^sb_secret_/i.test(config.serviceRoleKey)) {
    errors.push('SUPABASE_STAGING_SERVICE_ROLE_KEY saat ini berisi sb_secret_..., bukan legacy service_role JWT. Untuk Apps Script Tahap 5J gunakan legacy service_role JWT dari Supabase Settings > API Keys > Legacy API keys.');
  }

  if (config.serviceRoleKey && /^sb_publishable_/i.test(config.serviceRoleKey)) {
    errors.push('SUPABASE_STAGING_SERVICE_ROLE_KEY saat ini berisi sb_publishable_..., bukan service_role JWT.');
  }

  if (
    config.serviceRoleKey &&
    !/^sb_/i.test(config.serviceRoleKey) &&
    config.serviceRoleKey.split('.').length !== 3
  ) {
    errors.push('SUPABASE_STAGING_SERVICE_ROLE_KEY tidak terlihat seperti JWT legacy service_role. Pastikan memakai key legacy service_role yang diawali eyJ...');
  }

  if (errors.length) {
    throw new Error(errors.join(' | '));
  }

  return config;
}

function testSupabaseStagingConfig5J() {
  const result = {
    success: true,
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    config_status: {}
  };

  try {
    assertSupabaseStagingConfig_();

    result.config_status = getSupabaseStagingConfigStatus_();

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    result.success = false;
    result.issues.push({
      issue: 'SUPABASE_STAGING_CONFIG_INVALID',
      message: err && err.message ? err.message : String(err || 'Unknown error')
    });
    result.issue_count = result.issues.length;
    result.config_status = getSupabaseStagingConfigStatus_();

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}