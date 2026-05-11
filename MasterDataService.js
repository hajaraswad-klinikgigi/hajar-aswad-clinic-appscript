/* =========================================================
   PHASE 4B - MASTER DATA REPOSITORY BRIDGE HELPERS
   Read-only bridge. Backend tetap Spreadsheet.
   ========================================================= */

function isMasterDataRepositoryBridgeAvailable_() {
  return typeof MasterDataRepository !== 'undefined' &&
    MasterDataRepository &&
    typeof MasterDataRepository.getServiceCatalogRaw === 'function';
}

function getServiceCatalogRaw() {
  if (
    isMasterDataRepositoryBridgeAvailable_() &&
    typeof MasterDataRepository.getServiceCatalogRaw === 'function'
  ) {
    return MasterDataRepository.getServiceCatalogRaw() || [];
  }

  return getRowsAsObjects('ServiceCatalog') || [];
}

function normalizeRowForClient(row) {
  const obj = {};
  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });
  return obj;
}

function normalizeBooleanCell(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === '' || value === null || value === undefined) return false;

  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true';
}

function normalizeServiceCatalogRowForClient(row) {
  const obj = normalizeRowForClient(row);

  obj.is_ortho_install = normalizeBooleanCell(row && row.is_ortho_install);
  obj.is_ortho_control = normalizeBooleanCell(row && row.is_ortho_control);

  return obj;
}

function isOrthoInstallServiceRow(row) {
  return normalizeBooleanCell(row && row.is_ortho_install);
}

function isOrthoControlServiceRow(row) {
  return normalizeBooleanCell(row && row.is_ortho_control);
}

function generateNextServiceId() {
  const rows = getServiceCatalogRaw();
  return 'SRV-' + String(rows.length + 1).padStart(3, '0');
}

function getActiveServices() {
  const rows = getServiceCatalogRaw()
    .filter(function(row) {
      return String(row.is_active || '').toLowerCase() !== 'false';
    })
    .map(function(row) {
      return normalizeServiceCatalogRowForClient(row);
    })
    .sort(function(a, b) {
      return String(a.service_name || '').localeCompare(String(b.service_name || ''));
    });

  return {
    success: true,
    data: rows
  };
}

function getActiveOrthoInstallServices() {
  const rows = getServiceCatalogRaw()
    .filter(function(row) {
      return String(row.is_active || '').toLowerCase() !== 'false' &&
        isOrthoInstallServiceRow(row);
    })
    .map(function(row) {
      return normalizeServiceCatalogRowForClient(row);
    })
    .sort(function(a, b) {
      return String(a.service_name || '').localeCompare(String(b.service_name || ''));
    });

  return {
    success: true,
    data: rows
  };
}

function getActiveOrthoControlServices() {
  const rows = getServiceCatalogRaw()
    .filter(function(row) {
      return String(row.is_active || '').toLowerCase() !== 'false' &&
        isOrthoControlServiceRow(row);
    })
    .map(function(row) {
      return normalizeServiceCatalogRowForClient(row);
    })
    .sort(function(a, b) {
      return String(a.service_name || '').localeCompare(String(b.service_name || ''));
    });

  return {
    success: true,
    data: rows
  };
}

function getServiceById(serviceId) {
  const normalizedServiceId = String(serviceId || '').trim();

  if (!normalizedServiceId) {
    return {
      success: false,
      message: 'Service ID tidak ditemukan'
    };
  }

  let service = null;

  if (
    isMasterDataRepositoryBridgeAvailable_() &&
    typeof MasterDataRepository.findServiceById === 'function'
  ) {
    service = MasterDataRepository.findServiceById(normalizedServiceId);
  } else {
    service = getServiceCatalogRaw().find(function(row) {
      return String(row.service_id || '').trim() === normalizedServiceId;
    }) || null;
  }

  if (!service) {
    return {
      success: false,
      message: 'Data layanan tidak ditemukan'
    };
  }

  return {
    success: true,
    data: normalizeServiceCatalogRowForClient(service)
  };
}

function getServiceOrthoFlags(serviceId) {
  const serviceRes = getServiceById(serviceId);

  if (!serviceRes.success) {
    return {
      success: false,
      message: serviceRes.message || 'Data layanan tidak ditemukan'
    };
  }

  const service = serviceRes.data || {};

  return {
    success: true,
    data: {
      service_id: String(service.service_id || '').trim(),
      service_name: String(service.service_name || '').trim(),
      is_ortho_install: !!service.is_ortho_install,
      is_ortho_control: !!service.is_ortho_control
    }
  };
}

function validateServiceCatalogData(data, excludeServiceId) {
  const errors = {};

  const serviceName = String(data.service_name || '').trim();
  const defaultPrice = Number(data.default_price || 0);

  if (!serviceName) {
    errors.service_name = 'Nama layanan wajib diisi';
  } else if (serviceName.length < 3) {
    errors.service_name = 'Nama layanan minimal 3 karakter';
  } else if (serviceName.length > 100) {
    errors.service_name = 'Nama layanan maksimal 100 karakter';
  }

  if (defaultPrice <= 0) {
    errors.default_price = 'Harga layanan harus lebih dari 0';
  }

  const duplicate = getServiceCatalogRaw().find(function(row) {
    if (excludeServiceId && String(row.service_id || '') === String(excludeServiceId)) {
      return false;
    }

    return String(row.service_name || '').trim().toLowerCase() === serviceName.toLowerCase();
  });

  if (duplicate) {
    errors.service_name = 'Nama layanan sudah ada';
  }

  return errors;
}

function createServiceCatalog(data) {
  const errors = validateServiceCatalogData(data);

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: 'Validasi gagal',
      errors: errors
    };
  }

  const service = {
    service_id: generateNextServiceId(),
    service_name: String(data.service_name || '').trim(),
    default_price: Number(data.default_price || 0),
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    is_ortho_install: false,
    is_ortho_control: false
  };

  dbInsert_('ServiceCatalog', service);

  return {
    success: true,
    message: 'Layanan berhasil ditambahkan',
    data: normalizeServiceCatalogRowForClient(service)
  };
}

function updateServiceCatalog(data) {
  if (!data.service_id) {
    return {
      success: false,
      message: 'Service ID tidak ditemukan'
    };
  }

  const existing = getServiceCatalogRaw().find(function(row) {
    return String(row.service_id || '') === String(data.service_id || '');
  });

  if (!existing) {
    return {
      success: false,
      message: 'Data layanan tidak ditemukan'
    };
  }

  const errors = validateServiceCatalogData(data, data.service_id);

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: 'Validasi gagal',
      errors: errors
    };
  }

  const updated = {
    service_id: existing.service_id,
    service_name: String(data.service_name || '').trim(),
    default_price: Number(data.default_price || 0),
    is_active: String(existing.is_active || '').toLowerCase() !== 'false',
    created_at: formatCellValue(existing.created_at || ''),
    updated_at: nowIso(),
    is_ortho_install: normalizeBooleanCell(existing.is_ortho_install),
    is_ortho_control: normalizeBooleanCell(existing.is_ortho_control)
  };

  const ok = dbUpdateById_('ServiceCatalog', 'service_id', data.service_id, updated);

  if (!ok) {
    return {
      success: false,
      message: 'Gagal memperbarui layanan'
    };
  }

  return {
    success: true,
    message: 'Layanan berhasil diperbarui',
    data: normalizeServiceCatalogRowForClient(updated)
  };
}

/* =========================================================
   PHASE 4B MANUAL TESTS
   MasterDataService read-only -> MasterDataRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

