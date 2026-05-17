/* =========================================================
   SETTINGS SERVICE
   Manajemen info klinik, katalog layanan, dan user.
   ========================================================= */

const SETTINGS_OPTS = { backend_mode: 'supabase' };

// ── BOOTSTRAP (semua data sekaligus, 1 round-trip) ──

function getAllSettingsData(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const results = supabaseSelectParallel_([
      { table: repoGetTargetTableForSheet_('ClinicInfo'),                options: { limit: 10  } },
      { table: repoGetTargetTableForSheet_('DoctorCompensationRules'),   options: { limit: 100 } },
      { table: repoGetTargetTableForSheet_('ServiceCatalog'),            options: { limit: 500 } },
      { table: repoGetTargetTableForSheet_('Users'),                     options: { limit: 100 } },
      { table: repoGetTargetTableForSheet_('DoctorMaterialDeductions'),  options: { limit: 1000 } }
    ]);

    const clinicRows  = results[0];
    const doctors     = results[1];
    const services    = results[2];
    const usersRaw    = results[3];
    const deductions  = results[4];

    const users = usersRaw.map(function(u) {
      return {
        user_id:    u.user_id,
        username:   u.username,
        full_name:  u.full_name,
        role:       u.role,
        is_active:  u.is_active,
        created_at: u.created_at
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
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;
    const rows = dbFindAll_('ClinicInfo', SETTINGS_OPTS);
    return { success: true, data: rows[0] || null };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function updateClinicInfo(payload) {
  try {
    const auth = readAuthSession_(payload);
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
    const auth = readAuthSession_(payload);
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
    const auth = readAuthSession_(payload);
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
    const auth = readAuthSession_(payload);
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
      supabaseInsert_(targetTable, {
        user_id: normalizedUserId,
        clinic_id: targetClinic,
        role: role
      });
    }
  });
}

function getUserList(payload) {
  try {
    const auth = readAuthSession_(payload);
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
        role:       u.role,
        roles:      rolesByUser[uid] || [],
        is_active:  u.is_active,
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
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;
    if (!userIsFullyPrivileged_(auth.user)) {
      return { success: false, message: 'Hanya owner atau super admin yang bisa menambah pengguna.' };
    }

    const username = String((payload && payload.username) || '').trim();
    const password = String((payload && payload.password) || '').trim();
    const fullName = String((payload && payload.full_name) || '').trim();
    const roles    = normalizeRolesPayload_(payload && payload.roles);

    if (!username) return { success: false, message: 'Username wajib diisi.' };
    if (!password) return { success: false, message: 'Password wajib diisi.' };
    if (!fullName) return { success: false, message: 'Nama lengkap wajib diisi.' };
    if (!roles.length) return { success: false, message: 'Minimal pilih 1 role.' };

    const existing = dbFindById_('Users', 'username', username, SETTINGS_OPTS);
    if (existing) return { success: false, message: 'Username sudah dipakai.' };

    const userId = generateSafeId('USR');
    const legacyRole = deriveLegacyRoleFromRoles_(roles);
    const row = {
      user_id:       userId,
      username:      username,
      password_hash: password,
      full_name:     fullName,
      role:          legacyRole,
      is_active:     true
    };

    const inserted = dbInsert_('Users', row, SETTINGS_OPTS);
    syncAppUserRoles_(userId, roles, auth.user.clinic_id);

    return { success: true, data: { user_id: inserted.user_id, username: inserted.username, roles: roles } };
  } catch (err) {
    return { success: false, message: err.message || err };
  }
}

function updateUser(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;
    if (!userIsFullyPrivileged_(auth.user)) {
      return { success: false, message: 'Hanya owner atau super admin yang bisa mengubah pengguna.' };
    }

    const userId = String((payload && payload.user_id) || '').trim();
    if (!userId) return { success: false, message: 'user_id wajib diisi.' };

    const patch = {};
    if (payload.full_name !== undefined) patch.full_name = payload.full_name;
    if (payload.is_active !== undefined) patch.is_active = payload.is_active;

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
