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

const APP_ALLOWED_ROLES = ['admin', 'owner'];
const APP_SESSION_TTL_SECONDS = 21600; // 6 jam

// Phase 2a: 5 role rangkap (many-to-many via app_user_roles)
const APP_ROLES_VALID = Object.freeze([
  'owner', 'super_admin',
  'admin_appointment', 'admin_finance',
  'doctor'
]);

// Owner & super_admin selalu lulus role check apapun
const APP_ROLES_FULLY_PRIVILEGED = Object.freeze(['owner', 'super_admin']);

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
      message: 'Akun ini tidak memiliki akses ke aplikasi.'
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

  if (role !== 'admin' && role !== 'owner') {
    return {
      success: false,
      message: 'Akun ini tidak memiliki akses ke aplikasi'
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