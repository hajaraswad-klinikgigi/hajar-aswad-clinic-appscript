/* =========================================================
   SETTINGS SERVICE
   Manajemen info klinik, katalog layanan, dan user.
   ========================================================= */

const SETTINGS_OPTS = { backend_mode: 'supabase' };

// ── BOOTSTRAP (semua data sekaligus, 1 round-trip) ──

function getAllSettingsData(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const results = supabaseSelectParallel_([
      { table: repoGetTargetTableForSheet_('ClinicInfo'),                options: { limit: 10  } },
      { table: repoGetTargetTableForSheet_('DoctorCompensationRules'),   options: { limit: 100 } },
      { table: repoGetTargetTableForSheet_('ServiceCatalog'),            options: { limit: 500 } },
      { table: repoGetTargetTableForSheet_('Users'),                     options: { limit: 100 } },
      { table: repoGetTargetTableForSheet_('DoctorMaterialDeductions'),  options: { limit: 1000 } },
      { table: repoGetTargetTableForSheet_(REPO_TABLES.APP_USER_ROLES),  options: { limit: 1000 } }
    ]);

    const clinicRows   = results[0];
    const doctors      = results[1];
    const services     = results[2];
    const usersRaw     = results[3];
    const deductions   = results[4];
    const allRoleRows  = results[5] || [];

    const rolesByUser = {};
    allRoleRows.forEach(function(r) {
      const uid = String(r.user_id || '').trim();
      const role = normalizeAppRole_(r.role || '');
      if (!uid || APP_ROLES_VALID.indexOf(role) === -1) return;
      if (!rolesByUser[uid]) rolesByUser[uid] = [];
      if (rolesByUser[uid].indexOf(role) === -1) rolesByUser[uid].push(role);
    });

    const users = usersRaw.map(function(u) {
      const uid = String(u.user_id || '').trim();
      return {
        user_id:      u.user_id,
        username:     u.username,
        full_name:    u.full_name,
        email:        u.email || null,
        role:         u.role,
        roles:        rolesByUser[uid] || [],
        is_active:    u.is_active,
        totp_enabled: !!String(u.totp_secret || '').trim(),
        created_at:   u.created_at
      };
    });

    return {
      success: true,
      data: {
        clinic:     clinicRows[0] || null,
        doctors:    doctors,
        services:   services,
        users:      users,
        deductions: deductions
      }
    };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

// ── CLINIC INFO ──

function getClinicInfo(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;
    const rows = dbFindAll_('ClinicInfo', SETTINGS_OPTS);
    return { success: true, data: rows[0] || null };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function updateClinicInfo(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const rows = dbFindAll_('ClinicInfo', SETTINGS_OPTS);
    if (!rows.length) return { success: false, message: 'Data klinik belum ada.' };

    const id    = rows[0].id;
    const patch = {};
    ['clinic_name', 'address', 'phone', 'email', 'logo_url'].forEach(function(f) {
      if (payload[f] !== undefined) patch[f] = String(payload[f] || '').trim();
    });
    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_('ClinicInfo', 'id', id, patch, SETTINGS_OPTS);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

// ── SERVICE CATALOG ──

function getServiceCatalogList(payload) {
  try {
    const auth = requireRole(payload, ['admin_appointment', 'admin_finance']);
    if (!auth.success) return auth;
    const includeInactive = payload && payload.include_inactive === true;
    const all = dbFindAll_('ServiceCatalog', SETTINGS_OPTS);
    const filtered = includeInactive
      ? all
      : all.filter(function(s) { return s.is_active !== false; });
    return { success: true, data: filtered };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function addServiceCatalog(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const name = String((payload && payload.service_name) || '').trim();
    if (!name) return { success: false, message: 'Nama layanan wajib diisi.' };
    const price = Number(payload.default_price || 0);

    const existing = dbFindAll_('ServiceCatalog', SETTINGS_OPTS);
    const maxNum = existing.reduce(function(max, s) {
      const n = parseInt(String(s.service_id || '').replace('SRV-', ''), 10) || 0;
      return Math.max(max, n);
    }, 0);
    const newId = 'SRV-' + String(maxNum + 1).padStart(3, '0');

    const row = {
      service_id:       newId,
      service_name:     name,
      default_price:    price,
      is_ortho_install: payload.is_ortho_install === true,
      is_ortho_control: payload.is_ortho_control === true,
      is_active:        true,
      notes:            payload.notes ? String(payload.notes).trim() : null
    };

    const inserted = dbInsert_('ServiceCatalog', row, SETTINGS_OPTS);
    return { success: true, data: inserted };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function updateServiceCatalog(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const serviceId = String((payload && payload.service_id) || '').trim();
    if (!serviceId) return { success: false, message: 'service_id wajib diisi.' };

    const patch = {};
    ['service_name', 'default_price', 'is_ortho_install', 'is_ortho_control', 'is_active', 'notes'].forEach(function(f) {
      if (payload[f] !== undefined) patch[f] = payload[f];
    });
    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_('ServiceCatalog', 'service_id', serviceId, patch, SETTINGS_OPTS);
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function deleteServiceCatalog(payload) {
  // Soft delete — set is_active = false, jangan hapus fisik
  // karena service mungkin masih dipakai di treatment_items lama
  return updateServiceCatalog(Object.assign({}, payload, { is_active: false }));
}

// ── USER MANAGEMENT ──

function normalizeRolesPayload_(rolesPayload) {
  if (!Array.isArray(rolesPayload)) return [];
  const seen = {};
  const out = [];
  rolesPayload.forEach(function(r) {
    const role = normalizeAppRole_(r);
    if (APP_ROLES_VALID.indexOf(role) === -1) return;
    if (seen[role]) return;
    seen[role] = true;
    out.push(role);
  });
  return out;
}

function deriveLegacyRoleFromRoles_(roles) {
  if (!Array.isArray(roles)) return 'admin';
  if (roles.indexOf('owner') !== -1) return 'owner';
  if (roles.indexOf('super_admin') !== -1) return 'owner';
  if (roles.indexOf('admin_finance') !== -1 ||
      roles.indexOf('admin_appointment') !== -1) return 'admin';
  if (roles.indexOf('doctor') !== -1) return 'dokter';
  return 'admin';
}

function syncAppUserRoles_(userId, roles, clinicId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return;

  const targetClinic = String(clinicId || CLINIC_DEFAULT_ID || '').trim() || CLINIC_DEFAULT_ID;

  const existingRows = (dbFindAll_(REPO_TABLES.APP_USER_ROLES, SETTINGS_OPTS) || [])
    .filter(function(r) { return String(r.user_id || '').trim() === normalizedUserId; });

  const existingRoles = {};
  existingRows.forEach(function(r) { existingRoles[normalizeAppRole_(r.role)] = true; });

  const targetRoles = {};
  roles.forEach(function(r) { targetRoles[r] = true; });

  const targetTable = repoGetTargetTableForSheet_(REPO_TABLES.APP_USER_ROLES);

  Object.keys(existingRoles).forEach(function(role) {
    if (!targetRoles[role]) {
      supabaseDelete_(targetTable, {
        user_id: 'eq.' + normalizedUserId,
        role: 'eq.' + role
      });
    }
  });

  Object.keys(targetRoles).forEach(function(role) {
    if (!existingRoles[role]) {
      // owner & super_admin → clinic_id NULL (global scope, cross-clinic).
      // Role lain → per-clinic. Sinkron dengan migration 009.
      const rowClinicId = isGlobalScopeRole_(role) ? null : targetClinic;
      supabaseInsert_(targetTable, {
        user_id: normalizedUserId,
        clinic_id: rowClinicId,
        role: role
      });
    }
  });
}

function getUserList(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const users = dbFindAll_('Users', SETTINGS_OPTS);
    const allRoleRows = dbFindAll_(REPO_TABLES.APP_USER_ROLES, SETTINGS_OPTS) || [];

    const rolesByUser = {};
    allRoleRows.forEach(function(r) {
      const uid = String(r.user_id || '').trim();
      const role = normalizeAppRole_(r.role || '');
      if (!uid || APP_ROLES_VALID.indexOf(role) === -1) return;
      if (!rolesByUser[uid]) rolesByUser[uid] = [];
      if (rolesByUser[uid].indexOf(role) === -1) rolesByUser[uid].push(role);
    });

    const safe = users.map(function(u) {
      const uid = String(u.user_id || '').trim();
      return {
        user_id:    u.user_id,
        username:   u.username,
        full_name:  u.full_name,
        email:      u.email || null,
        role:       u.role,
        roles:      rolesByUser[uid] || [],
        is_active:  u.is_active,
        totp_enabled: !!String(u.totp_secret || '').trim(),
        created_at: u.created_at
      };
    });
    return { success: true, data: safe };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function addUser(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const username = String((payload && payload.username) || '').trim();
    const fullName = String((payload && payload.full_name) || '').trim();
    const email    = String((payload && payload.email) || '').trim().toLowerCase();
    const roles    = normalizeRolesPayload_(payload && payload.roles);

    if (!username) return { success: false, message: 'Username wajib diisi.' };
    if (!fullName) return { success: false, message: 'Nama lengkap wajib diisi.' };
    if (!email)    return { success: false, message: 'Email wajib diisi (dipakai untuk login).' };
    if (!roles.length) return { success: false, message: 'Minimal pilih 1 role.' };

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Format email tidak valid.' };
    }
    const allUsers = dbFindAll_('Users', SETTINGS_OPTS);
    const dupEmail = allUsers.find(function(u) {
      return String(u.email || '').trim().toLowerCase() === email;
    });
    if (dupEmail) return { success: false, message: 'Email sudah dipakai pengguna lain.' };

    const existing = dbFindById_('Users', 'username', username, SETTINGS_OPTS);
    if (existing) return { success: false, message: 'Username sudah dipakai.' };

    const userId = generateSafeId('USR');
    const legacyRole = deriveLegacyRoleFromRoles_(roles);
    // TOTP-only: password tidak dipakai untuk auth. Isi random UUID supaya kolom
    // NOT NULL legacy terpenuhi, dan loginUser() lama otomatis menolak (hash mismatch).
    const randomLegacyPassword = Utilities.getUuid() + Utilities.getUuid();
    const row = {
      user_id:       userId,
      username:      username,
      password_hash: randomLegacyPassword,
      full_name:     fullName,
      email:         email,
      role:          legacyRole,
      is_active:     true
    };

    const inserted = dbInsert_('Users', row, SETTINGS_OPTS);
    syncAppUserRoles_(userId, roles, auth.user.clinic_id);

    return { success: true, data: { user_id: inserted.user_id, username: inserted.username, email: inserted.email || null, roles: roles } };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function updateUser(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const userId = String((payload && payload.user_id) || '').trim();
    if (!userId) return { success: false, message: 'user_id wajib diisi.' };

    const patch = {};
    if (payload.full_name !== undefined) patch.full_name = payload.full_name;
    if (payload.is_active !== undefined) patch.is_active = payload.is_active;

    if (payload.email !== undefined) {
      const newEmail = String(payload.email || '').trim().toLowerCase();
      if (!newEmail) {
        return { success: false, message: 'Email wajib diisi (dipakai untuk login).' };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return { success: false, message: 'Format email tidak valid.' };
      }
      const allUsers = dbFindAll_('Users', SETTINGS_OPTS);
      const dupEmail = allUsers.find(function(u) {
        return String(u.email || '').trim().toLowerCase() === newEmail &&
               String(u.user_id || '').trim() !== userId;
      });
      if (dupEmail) return { success: false, message: 'Email sudah dipakai pengguna lain.' };
      patch.email = newEmail;
    }

    let rolesToSync = null;
    if (payload.roles !== undefined) {
      rolesToSync = normalizeRolesPayload_(payload.roles);
      if (!rolesToSync.length) {
        return { success: false, message: 'Minimal pilih 1 role.' };
      }
      patch.role = deriveLegacyRoleFromRoles_(rolesToSync);
    }

    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_('Users', 'user_id', userId, patch, SETTINGS_OPTS);

    if (rolesToSync) {
      syncAppUserRoles_(userId, rolesToSync, auth.user.clinic_id);
    }

    return { success: true, data: Object.assign({}, updated, { roles: rolesToSync || undefined }) };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function deleteUser(payload) {
  return updateUser(Object.assign({}, payload, { is_active: false, roles: undefined }));
}

// =========================================================
// Phase 2b — Setup / Reset / Disable TOTP per user (Settings)
// =========================================================

/**
 * Generate TOTP secret baru untuk user (atau regenerate kalau sudah ada).
 * Return otpauth URI + secret base32 supaya frontend tampil QR code.
 *
 * WAJIB owner / super_admin.
 */
function generateTotpForUser(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const userId = String((payload && payload.user_id) || '').trim();
    if (!userId) return { success: false, message: 'user_id wajib diisi.' };

    const user = dbFindById_('Users', 'user_id', userId, SETTINGS_OPTS);
    if (!user) return { success: false, message: 'User tidak ditemukan.' };

    const email = String(user.email || '').trim();
    if (!email) {
      return {
        success: false,
        message: 'User belum punya email. Isi email lewat Edit Pengguna dulu sebelum setup Authenticator.'
      };
    }

    const secret = generateTotpSecret_();
    const nowIso = new Date().toISOString();

    dbUpdateById_('Users', 'user_id', userId, {
      totp_secret: secret,
      totp_enabled_at: nowIso,
      updated_at: nowIso
    }, SETTINGS_OPTS);

    const otpauthUri = buildOtpAuthUri_(secret, email);

    return {
      success: true,
      data: {
        user_id: userId,
        email: email,
        full_name: String(user.full_name || '').trim(),
        secret: secret,
        otpauth_uri: otpauthUri,
        enabled_at: nowIso
      }
    };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

/**
 * Reset TOTP secret (hapus secret lama, generate baru).
 * Sama persis dengan generateTotpForUser — tinggal alias supaya
 * call site lebih jelas semantik.
 */
function resetTotpForUser(payload) {
  return generateTotpForUser(payload);
}

function sendTotpSetupEmail(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;
    const userId = String((payload && payload.user_id) || '').trim();
    if (!userId) return { success: false, message: 'user_id wajib diisi.' };
    const user = dbFindById_('Users', 'user_id', userId, SETTINGS_OPTS);
    if (!user) return { success: false, message: 'User tidak ditemukan.' };
    if (!user.email) return { success: false, message: 'User belum punya email. Isi email dulu via Edit Pengguna.' };

    const secret = generateTotpSecret_();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

    dbUpdateById_('Users', 'user_id', userId, {
      totp_secret: secret,
      totp_enabled_at: nowIso,
      updated_at: nowIso
    }, SETTINGS_OPTS);

    dbInsert_('TotpSetupTokens', {
      token: token,
      user_id: userId,
      expires_at: expiresAt,
      created_by: String(auth.user.user_id || '')
    }, SETTINGS_OPTS);

    const webAppUrl = ScriptApp.getService().getUrl();
    const setupUrl = webAppUrl + '?totp_setup_token=' + encodeURIComponent(token);
    const fullName = String(user.full_name || '').trim() || user.email;

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a2035">' +
        '<h2>Halo ' + escapeHtmlServer_(fullName) + ',</h2>' +
        '<p>Admin klinik baru saja generate setup Google Authenticator untuk akun Anda di sistem Klinik Hajar Aswad.</p>' +
        '<p><strong>Sebelum mulai, install app <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2">Google Authenticator</a> di HP Anda (gratis).</strong></p>' +
        '<p>Setelah app terpasang, klik tombol di bawah untuk buka halaman setup berisi QR code:</p>' +
        '<p style="text-align:center;margin:24px 0">' +
          '<a href="' + setupUrl + '" style="display:inline-block;padding:14px 28px;background:#4f6ef7;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Buka Halaman Setup</a>' +
        '</p>' +
        '<p style="font-size:13px;color:#64748b">Atau copy link ini ke browser:<br><code style="font-size:11px;background:#f1f5f9;padding:4px 8px;border-radius:4px;word-break:break-all">' + setupUrl + '</code></p>' +
        '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:20px 0;border-radius:8px;font-size:13px;color:#78350f">' +
          '&#9888; Link ini <strong>sekali pakai</strong> dan akan kadaluwarsa dalam 24 jam. ' +
          'Jangan teruskan email ini ke siapa pun.' +
        '</div>' +
      '</div>';

    MailApp.sendEmail({
      to: user.email,
      subject: '[Klinik Hajar Aswad] Setup Google Authenticator Anda',
      htmlBody: htmlBody
    });

    return {
      success: true,
      message: 'Email setup terkirim ke ' + user.email,
      data: { email: user.email, full_name: fullName, expires_at: expiresAt }
    };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function getTotpSetupByToken(token) {
  try {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) return { success: false, message: 'Token tidak valid.' };
    const tokenRow = dbFindById_('TotpSetupTokens', 'token', cleanToken, SETTINGS_OPTS);
    if (!tokenRow) return { success: false, message: 'Link tidak valid atau sudah kadaluwarsa.' };
    if (tokenRow.used_at) return { success: false, message: 'Link sudah pernah dipakai. Hubungi admin klinik untuk generate ulang.' };
    const expiresAt = new Date(tokenRow.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      return { success: false, message: 'Link sudah kadaluwarsa. Hubungi admin klinik untuk generate ulang.' };
    }
    const user = dbFindById_('Users', 'user_id', tokenRow.user_id, SETTINGS_OPTS);
    if (!user || !user.totp_secret) return { success: false, message: 'Data user tidak ditemukan.' };
    const isActive = String(user.is_active || '').trim().toLowerCase() !== 'false';
    if (!isActive) return { success: false, message: 'Akun tidak aktif.' };
    return {
      success: true,
      data: {
        full_name: String(user.full_name || '').trim() || user.email,
        email: user.email,
        secret: user.totp_secret,
        otpauth_uri: buildOtpAuthUri_(user.totp_secret, user.email)
      }
    };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function markTotpSetupTokenUsed(token) {
  try {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) return { success: false, message: 'Token tidak valid.' };
    const tokenRow = dbFindById_('TotpSetupTokens', 'token', cleanToken, SETTINGS_OPTS);
    if (!tokenRow) return { success: false, message: 'Token tidak ditemukan.' };
    if (tokenRow.used_at) return { success: true, message: 'Token sudah ditandai pakai.' };
    dbUpdateById_('TotpSetupTokens', 'token', cleanToken, {
      used_at: new Date().toISOString()
    }, SETTINGS_OPTS);
    return { success: true, message: 'Setup selesai. Anda bisa login sekarang.' };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

/**
 * Disable TOTP untuk user (set null). User tidak bisa login sampai
 * di-setup ulang. Berguna kalau staff resign.
 */
function disableTotpForUser(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const userId = String((payload && payload.user_id) || '').trim();
    if (!userId) return { success: false, message: 'user_id wajib diisi.' };

    dbUpdateById_('Users', 'user_id', userId, {
      totp_secret: null,
      totp_enabled_at: null,
      updated_at: new Date().toISOString()
    }, SETTINGS_OPTS);

    return { success: true, message: 'Authenticator dinonaktifkan.' };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}
