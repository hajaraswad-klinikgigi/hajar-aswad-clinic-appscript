function hashPassword(text) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  );

  return raw.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/* =========================================================
   AUTH SESSION / ROLE PERMISSION
   H8 - Backend permission foundation
   ========================================================= */

const APP_SESSION_TTL_SECONDS = 21600; // 6 jam

// Phase 2a: 5 role rangkap (many-to-many via app_user_roles)
const APP_ROLES_VALID = Object.freeze([
  'owner', 'super_admin',
  'admin_appointment', 'admin_finance',
  'doctor'
]);

// Role yang boleh login ke aplikasi. 'admin' = legacy single-role (pra-Phase 2A)
// supaya akun bootstrap lama tidak terkunci sebelum migrasi ke app_user_roles.
const APP_ALLOWED_ROLES = Object.freeze(['admin'].concat(APP_ROLES_VALID));

// Owner & super_admin selalu lulus role check apapun
const APP_ROLES_FULLY_PRIVILEGED = Object.freeze(['owner', 'super_admin']);

// Owner & super_admin scope = global (cross-clinic). Saat insert ke
// app_user_roles, clinic_id di-set NULL supaya tidak perlu duplicate
// row per klinik. Role lain selalu per-clinic.
const APP_ROLES_GLOBAL_SCOPE = Object.freeze(['owner', 'super_admin']);

function isGlobalScopeRole_(role) {
  return APP_ROLES_GLOBAL_SCOPE.indexOf(normalizeAppRole_(role)) !== -1;
}

function normalizeAppRole_(role) {
  return String(role || '').trim().toLowerCase();
}

function isAllowedAppRole_(role) {
  return APP_ALLOWED_ROLES.indexOf(normalizeAppRole_(role)) !== -1;
}

function getAppUserRolesByUserId_(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return [];

  const rows = (typeof dbFindAll_ === 'function')
    ? (dbFindAll_(REPO_TABLES.APP_USER_ROLES) || [])
    : [];

  const seen = {};
  const roles = [];

  rows.forEach(function(row) {
    if (String(row.user_id || '').trim() !== normalizedUserId) return;
    const role = normalizeAppRole_(row.role || '');
    if (APP_ROLES_VALID.indexOf(role) === -1) return;
    if (seen[role]) return;
    seen[role] = true;
    roles.push(role);
  });

  return roles;
}

function userHasRole_(user, role) {
  if (!user || !role) return false;
  const target = normalizeAppRole_(role);
  return Array.isArray(user.roles) && user.roles.indexOf(target) !== -1;
}

function userHasAnyRole_(user, roles) {
  if (!user || !Array.isArray(roles)) return false;
  for (var i = 0; i < roles.length; i++) {
    if (userHasRole_(user, roles[i])) return true;
  }
  return false;
}

function userIsFullyPrivileged_(user) {
  return userHasAnyRole_(user, APP_ROLES_FULLY_PRIVILEGED);
}

function requireRole(context, allowedRoles) {
  const auth = readAuthSession_(context);
  if (!auth || !auth.success) return auth;

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [];
  if (allowed.indexOf('*') !== -1) return auth;
  if (userIsFullyPrivileged_(auth.user)) return auth;
  if (!userHasAnyRole_(auth.user, allowed)) {
    return {
      success: false,
      message: 'Akses ditolak. Role Anda: ' + ((auth.user.roles || []).join(', ') || '-')
    };
  }
  return auth;
}

function buildSafeAuthUser_(user, opts) {
  const rolesArr = (opts && Array.isArray(opts.roles)) ? opts.roles.slice() : [];
  return {
    user_id: String((user && user.user_id) || '').trim(),
    full_name: String((user && user.full_name) || '').trim(),
    username: String((user && user.username) || '').trim(),
    email: String((user && user.email) || '').trim().toLowerCase(),
    role: normalizeAppRole_((user && user.role) || ''),
    clinic_id: String((user && user.clinic_id) || '').trim(),
    roles: rolesArr
  };
}

function getAuthSessionCacheKey_(sessionToken) {
  return 'AUTH_SESSION_' + hashPassword(String(sessionToken || '')).slice(0, 64);
}

function getUsersRaw_() {
  return dbFindAll_('Users') || [];
}

function findUserRawById_(userId) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) return null;

  return getUsersRaw_().find(function(row) {
    return String(row.user_id || '').trim() === normalizedUserId;
  }) || null;
}

function findUserRawByUsername_(username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (!normalizedUsername) return null;

  return getUsersRaw_().find(function(row) {
    return String(row.username || '').trim().toLowerCase() === normalizedUsername;
  }) || null;
}

function createAuthSession_(user) {
  const safeUser = buildSafeAuthUser_(user);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (APP_SESSION_TTL_SECONDS * 1000));

  const sessionToken = Utilities.getUuid() + '.' + generateSafeId('SESS');

  const sessionPayload = {
    user: safeUser,
    created_at: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    expires_at: Utilities.formatDate(expiresAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  };

  CacheService
    .getScriptCache()
    .put(
      getAuthSessionCacheKey_(sessionToken),
      JSON.stringify(sessionPayload),
      APP_SESSION_TTL_SECONDS
    );

  return {
    session_token: sessionToken,
    expires_at: sessionPayload.expires_at
  };
}

function getSessionTokenFromContext_(context) {
  if (typeof context === 'string') {
    return String(context || '').trim();
  }

  const payload = context || {};

  return String(
    payload.session_token ||
    payload.auth_token ||
    payload.actor_session_token ||
    (
      payload.auth && payload.auth.session_token
        ? payload.auth.session_token
        : ''
    ) ||
    ''
  ).trim();
}

function readAuthSession_(context) {
  const sessionToken = getSessionTokenFromContext_(context);

  if (!sessionToken) {
    return {
      success: false,
      message: 'Sesi login tidak ditemukan. Silakan login ulang.'
    };
  }

  const raw = CacheService
    .getScriptCache()
    .get(getAuthSessionCacheKey_(sessionToken));

  if (!raw) {
    return {
      success: false,
      message: 'Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang.'
    };
  }

  let session = null;

  try {
    session = JSON.parse(raw);
  } catch (err) {
    return {
      success: false,
      message: 'Sesi login tidak valid. Silakan login ulang.'
    };
  }

  const sessionUser = session && session.user ? session.user : {};
  const userId = String(sessionUser.user_id || '').trim();

  if (!userId) {
    return {
      success: false,
      message: 'Sesi login tidak valid. Silakan login ulang.'
    };
  }

  const latestUser = findUserRawById_(userId);

  if (!latestUser) {
    return {
      success: false,
      message: 'Akun pengguna tidak ditemukan.'
    };
  }

  const isActive = String(latestUser.is_active || '').trim().toLowerCase() !== 'false';

  if (!isActive) {
    return {
      success: false,
      message: 'Akun tidak aktif.'
    };
  }

  const latestRole = normalizeAppRole_(latestUser.role || '');

  if (!isAllowedAppRole_(latestRole)) {
    return {
      success: false,
      message: 'Akun ini tidak memiliki akses ke aplikasi. (role: "' + (latestRole || '<kosong>') + '")'
    };
  }

  const roles = getAppUserRolesByUserId_(userId);

  return {
    success: true,
    user: buildSafeAuthUser_(latestUser, { roles: roles }),
    session: {
      expires_at: String(session.expires_at || '')
    }
  };
}

function requireFinancePermission_(context, actionLabel) {
  const auth = readAuthSession_(context);

  if (!auth || !auth.success) {
    return {
      success: false,
      message: auth && auth.message
        ? auth.message
        : 'Sesi login tidak valid. Silakan login ulang.'
    };
  }

  if (!userIsFullyPrivileged_(auth.user) &&
      !userHasAnyRole_(auth.user, ['admin_finance'])) {
    return {
      success: false,
      message: 'Anda tidak memiliki izin untuk menjalankan aksi Finance ini.'
    };
  }

  return {
    success: true,
    user: auth.user,
    role: normalizeAppRole_(auth.user.role || ''),
    action: String(actionLabel || '').trim()
  };
}

function requireFinanceOwnerPermission_(context, actionLabel) {
  const auth = readAuthSession_(context);

  if (!auth || !auth.success) {
    return {
      success: false,
      message: auth && auth.message
        ? auth.message
        : 'Sesi login tidak valid. Silakan login ulang.'
    };
  }

  if (!userIsFullyPrivileged_(auth.user)) {
    return {
      success: false,
      message: 'Hanya owner yang memiliki izin menjalankan aksi ini.'
    };
  }

  return {
    success: true,
    user: auth.user,
    role: normalizeAppRole_(auth.user.role || ''),
    action: String(actionLabel || '').trim()
  };
}

function logoutAuthSession(sessionToken) {
  const token = String(sessionToken || '').trim();

  if (token) {
    CacheService
      .getScriptCache()
      .remove(getAuthSessionCacheKey_(token));
  }

  return {
    success: true,
    message: 'Logout berhasil'
  };
}

function loginUser(username, password) {
  const users = getUsersRaw_();

  const normalizedUsername = String(username || '').trim().toLowerCase();
  const passwordHash = hashPassword(password);

  const user = users.find(function(row) {
    return String(row.username || '').trim().toLowerCase() === normalizedUsername;
  });

  if (!user) {
    return {
      success: false,
      message: 'Username atau password salah'
    };
  }

  const isActive = String(user.is_active || '').trim().toLowerCase() !== 'false';
  if (!isActive) {
    return {
      success: false,
      message: 'Akun tidak aktif'
    };
  }

  const storedHash = String(user.password_hash || '').trim();
  if (storedHash !== passwordHash) {
    return {
      success: false,
      message: 'Username atau password salah'
    };
  }

  const role = String(user.role || '').trim().toLowerCase();

  if (!isAllowedAppRole_(role)) {
    return {
      success: false,
      message: 'Akun ini tidak memiliki akses ke aplikasi (role: "' + (role || '<kosong>') + '")'
    };
  }

  const session = createAuthSession_(user);
  const roles = getAppUserRolesByUserId_(user.user_id);

  return {
    success: true,
    message: 'Login berhasil',
    data: Object.assign(
      buildSafeAuthUser_(user, { roles: roles }),
      {
        session_token: session.session_token,
        session_expires_at: session.expires_at
      }
    )
  };
}

function seedUsersFromList() {
  return {
    success: false,
    message: 'Seed user sudah dinonaktifkan demi keamanan aplikasi. Jalankan seed manual hanya dari editor Apps Script bila benar-benar diperlukan.'
  };
}

// =========================================================
// Phase 2b — Login via TOTP (Google Authenticator)
// =========================================================
// Pendekatan: setiap user punya `totp_secret` (base32) di app_users.
// User scan QR code (otpauth:// URI) ke Google Authenticator app
// di HP. Saat login, input email + 6 digit code dari Authenticator
// (refresh tiap 30 detik). Server verify pakai HMAC-SHA1 RFC 6238.
//
// Lihat PHASE_2B_AUTH_DISCUSSION_2026_05_17.md untuk rasionale
// kenapa pilih TOTP (Google Sign-In tidak feasible di Apps Script
// iframe).

var TOTP_ISSUER = 'Hajar Aswad Dental Clinic';
var TOTP_PERIOD_SEC = 30;
var TOTP_DIGITS = 6;
var TOTP_DRIFT_STEPS = 1; // tolerate ±1 time step (±30 detik clock skew)
var TOTP_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate base32 secret 20-byte (160 bit) — standard untuk TOTP.
 * Sumber entropy: Utilities.getUuid() × 2 = 32 hex byte (cryptographically secure).
 */
function generateTotpSecret_() {
  var hex = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  // 64 hex chars = 32 bytes. Ambil 20 byte pertama untuk SHA-1 standard.
  var bytes = [];
  for (var i = 0; i < 20; i++) {
    bytes.push(parseInt(hex.substr(i * 2, 2), 16));
  }
  return base32Encode_(bytes);
}

/**
 * Base32 encode (RFC 4648 alphabet A-Z2-7, no padding).
 */
function base32Encode_(bytes) {
  var out = '';
  var buffer = 0;
  var bits = 0;
  for (var i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | (bytes[i] & 0xFF);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += TOTP_BASE32_ALPHABET.charAt((buffer >> bits) & 0x1F);
    }
  }
  if (bits > 0) {
    out += TOTP_BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 0x1F);
  }
  return out;
}

/**
 * Base32 decode (RFC 4648). Return byte array.
 */
function base32Decode_(s) {
  var clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  var bytes = [];
  var buffer = 0;
  var bits = 0;
  for (var i = 0; i < clean.length; i++) {
    var idx = TOTP_BASE32_ALPHABET.indexOf(clean.charAt(i));
    if (idx < 0) continue;
    buffer = (buffer << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xFF);
    }
  }
  return bytes;
}

/**
 * Compute TOTP code dari secret (base32) + counter.
 * Return string 6 digit (zero-padded).
 */
function computeTotpCode_(secretBase32, counter) {
  var keyBytes = base32Decode_(secretBase32);
  // Counter ke 8-byte big-endian.
  var counterBytes = [0, 0, 0, 0, 0, 0, 0, 0];
  for (var i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xFF;
    counter = Math.floor(counter / 256);
  }
  // Convert byte arrays ke Byte[] yang dipakai Utilities API (signed -128..127).
  var keyBlob = keyBytes.map(function(b) { return b > 127 ? b - 256 : b; });
  var counterBlob = counterBytes.map(function(b) { return b > 127 ? b - 256 : b; });
  var hmac = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    counterBlob,
    keyBlob
  );
  // hmac adalah Byte[] (signed). Convert ke unsigned.
  var h = hmac.map(function(b) { return b < 0 ? b + 256 : b; });
  // Dynamic truncation (RFC 4226 / 6238).
  var offset = h[19] & 0x0F;
  var binary = ((h[offset] & 0x7F) << 24)
             | ((h[offset + 1] & 0xFF) << 16)
             | ((h[offset + 2] & 0xFF) << 8)
             |  (h[offset + 3] & 0xFF);
  var modulus = Math.pow(10, TOTP_DIGITS);
  var code = binary % modulus;
  var s = String(code);
  while (s.length < TOTP_DIGITS) s = '0' + s;
  return s;
}

/**
 * Verify TOTP code dengan tolerance ±TOTP_DRIFT_STEPS time steps.
 */
function verifyTotpCode_(secretBase32, code) {
  if (!secretBase32 || !code) return false;
  var clean = String(code).replace(/\D/g, '');
  if (clean.length !== TOTP_DIGITS) return false;
  var now = Math.floor(Date.now() / 1000);
  var baseCounter = Math.floor(now / TOTP_PERIOD_SEC);
  for (var i = -TOTP_DRIFT_STEPS; i <= TOTP_DRIFT_STEPS; i++) {
    try {
      if (computeTotpCode_(secretBase32, baseCounter + i) === clean) return true;
    } catch (e) {
      // continue
    }
  }
  return false;
}

/**
 * Build otpauth:// URI untuk QR code Authenticator app.
 * Format: otpauth://totp/Issuer:account?secret=BASE32&issuer=Issuer&...
 */
function buildOtpAuthUri_(secretBase32, accountLabel) {
  var label = String(accountLabel || 'user').trim();
  var issuer = TOTP_ISSUER;
  return 'otpauth://totp/' +
    encodeURIComponent(issuer) + ':' + encodeURIComponent(label) +
    '?secret=' + encodeURIComponent(secretBase32) +
    '&issuer=' + encodeURIComponent(issuer) +
    '&algorithm=SHA1' +
    '&digits=' + TOTP_DIGITS +
    '&period=' + TOTP_PERIOD_SEC;
}
/**
 * Login dengan email + 6 digit TOTP code.
 * Identifier: email (case-insensitive). Lookup di app_users.
 */
function loginWithTotp(email, code) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanCode  = String(code || '').replace(/\D/g, '');

  if (!cleanEmail || !cleanCode) {
    return { success: false, message: 'Email dan kode wajib diisi.' };
  }
  if (cleanCode.length !== TOTP_DIGITS) {
    return { success: false, message: 'Kode harus 6 digit.' };
  }

  const users = getUsersRaw_();
  const user = users.find(function(row) {
    return String(row.email || '').trim().toLowerCase() === cleanEmail;
  });

  if (!user) {
    return { success: false, message: 'Email atau kode salah.' };
  }

  const isActive = String(user.is_active || '').trim().toLowerCase() !== 'false';
  if (!isActive) {
    return { success: false, message: 'Akun tidak aktif. Hubungi admin klinik.' };
  }

  const secret = String(user.totp_secret || '').trim();
  if (!secret) {
    return {
      success: false,
      message: 'Akun belum di-setup Authenticator. Hubungi admin klinik untuk setup.'
    };
  }

  if (!verifyTotpCode_(secret, cleanCode)) {
    return { success: false, message: 'Email atau kode salah.' };
  }

  const roles = getAppUserRolesByUserId_(user.user_id);
  const legacyRole = String(user.role || '').trim().toLowerCase();
  const hasModernRole = Array.isArray(roles) && roles.length > 0;
  const hasLegacyAccess = legacyRole === 'admin' || legacyRole === 'owner';
  if (!hasModernRole && !hasLegacyAccess) {
    return { success: false, message: 'Akun ini belum diberi role. Hubungi admin klinik.' };
  }

  const session = createAuthSession_(user);

  return {
    success: true,
    message: 'Login berhasil',
    data: Object.assign(
      buildSafeAuthUser_(user, { roles: roles }),
      {
        session_token: session.session_token,
        session_expires_at: session.expires_at
      }
    )
  };
}