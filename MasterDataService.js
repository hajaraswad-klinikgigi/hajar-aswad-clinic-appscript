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

function testGetActiveServices() {
  Logger.log(JSON.stringify(getActiveServices()));
}

function testGetActiveServicesNow() {
  Logger.log(JSON.stringify(getActiveServices()));
}

function testGetActiveOrthoInstallServices() {
  Logger.log(JSON.stringify(getActiveOrthoInstallServices()));
}

function testGetActiveOrthoControlServices() {
  Logger.log(JSON.stringify(getActiveOrthoControlServices()));
}

/* =========================================================
   PHASE 4B MANUAL TESTS
   MasterDataService read-only -> MasterDataRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testMasterDataServicePhase4BReadOnlyBridge() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    counts: {},
    sample: {}
  };

  try {
    if (
      typeof MasterDataRepository === 'undefined' ||
      !MasterDataRepository
    ) {
      result.issues.push({
        issue: 'MASTER_DATA_REPOSITORY_NOT_FOUND'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperServices = getServiceCatalogRaw();
    const repoServices = MasterDataRepository.getServiceCatalogRaw();

    result.counts.wrapper_services = Array.isArray(wrapperServices)
      ? wrapperServices.length
      : -1;

    result.counts.repository_services = Array.isArray(repoServices)
      ? repoServices.length
      : -1;

    if (!Array.isArray(wrapperServices)) {
      result.issues.push({
        issue: 'WRAPPER_SERVICE_CATALOG_NOT_ARRAY'
      });
    }

    if (!Array.isArray(repoServices)) {
      result.issues.push({
        issue: 'REPOSITORY_SERVICE_CATALOG_NOT_ARRAY'
      });
    }

    if (result.counts.wrapper_services !== result.counts.repository_services) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_services,
        repository_count: result.counts.repository_services,
        issue: 'SERVICE_CATALOG_COUNT_MISMATCH'
      });
    }

    const activeRes = getActiveServices();
    const orthoInstallRes = getActiveOrthoInstallServices();
    const orthoControlRes = getActiveOrthoControlServices();

    const repoActive = MasterDataRepository.listActiveServices();
    const repoOrthoInstall = MasterDataRepository.listActiveOrthoInstallServices();
    const repoOrthoControl = MasterDataRepository.listActiveOrthoControlServices();

    result.counts.wrapper_active_services =
      activeRes && Array.isArray(activeRes.data) ? activeRes.data.length : -1;

    result.counts.repository_active_services =
      Array.isArray(repoActive) ? repoActive.length : -1;

    result.counts.wrapper_ortho_install_services =
      orthoInstallRes && Array.isArray(orthoInstallRes.data) ? orthoInstallRes.data.length : -1;

    result.counts.repository_ortho_install_services =
      Array.isArray(repoOrthoInstall) ? repoOrthoInstall.length : -1;

    result.counts.wrapper_ortho_control_services =
      orthoControlRes && Array.isArray(orthoControlRes.data) ? orthoControlRes.data.length : -1;

    result.counts.repository_ortho_control_services =
      Array.isArray(repoOrthoControl) ? repoOrthoControl.length : -1;

    if (!activeRes || activeRes.success !== true || !Array.isArray(activeRes.data)) {
      result.issues.push({
        endpoint: 'getActiveServices',
        issue: 'GET_ACTIVE_SERVICES_FAILED'
      });
    }

    if (!orthoInstallRes || orthoInstallRes.success !== true || !Array.isArray(orthoInstallRes.data)) {
      result.issues.push({
        endpoint: 'getActiveOrthoInstallServices',
        issue: 'GET_ACTIVE_ORTHO_INSTALL_SERVICES_FAILED'
      });
    }

    if (!orthoControlRes || orthoControlRes.success !== true || !Array.isArray(orthoControlRes.data)) {
      result.issues.push({
        endpoint: 'getActiveOrthoControlServices',
        issue: 'GET_ACTIVE_ORTHO_CONTROL_SERVICES_FAILED'
      });
    }

    if (result.counts.wrapper_active_services !== result.counts.repository_active_services) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_active_services,
        repository_count: result.counts.repository_active_services,
        issue: 'ACTIVE_SERVICE_COUNT_MISMATCH'
      });
    }

    if (result.counts.wrapper_ortho_install_services !== result.counts.repository_ortho_install_services) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_ortho_install_services,
        repository_count: result.counts.repository_ortho_install_services,
        issue: 'ORTHO_INSTALL_SERVICE_COUNT_MISMATCH'
      });
    }

    if (result.counts.wrapper_ortho_control_services !== result.counts.repository_ortho_control_services) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_ortho_control_services,
        repository_count: result.counts.repository_ortho_control_services,
        issue: 'ORTHO_CONTROL_SERVICE_COUNT_MISMATCH'
      });
    }

    const firstService = wrapperServices.length ? wrapperServices[0] : null;
    const serviceId = firstService
      ? String(firstService.service_id || '').trim()
      : '';

    result.sample.first_service_id = serviceId;

    if (serviceId) {
      const wrapperServiceRes = getServiceById(serviceId);
      const repoService = MasterDataRepository.findServiceById(serviceId);

      result.sample.wrapper_find_service_ok = !!(
        wrapperServiceRes &&
        wrapperServiceRes.success === true &&
        wrapperServiceRes.data
      );

      result.sample.repository_find_service_ok = !!repoService;

      if (!result.sample.wrapper_find_service_ok || !result.sample.repository_find_service_ok) {
        result.issues.push({
          service_id: serviceId,
          issue: 'FIND_SERVICE_FAILED'
        });
      }
    } else {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada service untuk sample bridge test';
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataServicePhase4BEndpointSample() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const activeRes = getActiveServices();
    const orthoInstallRes = getActiveOrthoInstallServices();
    const orthoControlRes = getActiveOrthoControlServices();

    result.sample.active_services_ok = !!(
      activeRes &&
      activeRes.success === true &&
      Array.isArray(activeRes.data)
    );

    result.sample.ortho_install_services_ok = !!(
      orthoInstallRes &&
      orthoInstallRes.success === true &&
      Array.isArray(orthoInstallRes.data)
    );

    result.sample.ortho_control_services_ok = !!(
      orthoControlRes &&
      orthoControlRes.success === true &&
      Array.isArray(orthoControlRes.data)
    );

    result.sample.active_service_count =
      activeRes && Array.isArray(activeRes.data) ? activeRes.data.length : -1;

    result.sample.ortho_install_count =
      orthoInstallRes && Array.isArray(orthoInstallRes.data) ? orthoInstallRes.data.length : -1;

    result.sample.ortho_control_count =
      orthoControlRes && Array.isArray(orthoControlRes.data) ? orthoControlRes.data.length : -1;

    if (!result.sample.active_services_ok) {
      result.issues.push({
        endpoint: 'getActiveServices',
        issue: 'ACTIVE_SERVICES_ENDPOINT_FAILED'
      });
    }

    if (!result.sample.ortho_install_services_ok) {
      result.issues.push({
        endpoint: 'getActiveOrthoInstallServices',
        issue: 'ORTHO_INSTALL_ENDPOINT_FAILED'
      });
    }

    if (!result.sample.ortho_control_services_ok) {
      result.issues.push({
        endpoint: 'getActiveOrthoControlServices',
        issue: 'ORTHO_CONTROL_ENDPOINT_FAILED'
      });
    }

    const serviceSample =
      activeRes &&
      Array.isArray(activeRes.data) &&
      activeRes.data.length
        ? activeRes.data[0]
        : null;

    const serviceId = serviceSample
      ? String(serviceSample.service_id || '').trim()
      : '';

    result.sample.first_active_service_id = serviceId;

    if (serviceId) {
      const serviceRes = getServiceById(serviceId);
      const flagsRes = getServiceOrthoFlags(serviceId);

      result.sample.get_service_by_id_ok = !!(
        serviceRes &&
        serviceRes.success === true &&
        serviceRes.data &&
        String(serviceRes.data.service_id || '').trim() === serviceId
      );

      result.sample.get_service_ortho_flags_ok = !!(
        flagsRes &&
        flagsRes.success === true &&
        flagsRes.data &&
        String(flagsRes.data.service_id || '').trim() === serviceId
      );

      if (typeof getServicePrice === 'function') {
        const priceRes = getServicePrice(serviceId);

        result.sample.get_service_price_checked = true;
        result.sample.get_service_price_ok = !!(
          priceRes &&
          priceRes.success === true &&
          priceRes.data &&
          String(priceRes.data.service_id || '').trim() === serviceId
        );

        if (!result.sample.get_service_price_ok) {
          result.issues.push({
            endpoint: 'getServicePrice',
            service_id: serviceId,
            issue: 'GET_SERVICE_PRICE_FAILED'
          });
        }
      } else {
        result.sample.get_service_price_checked = false;
      }

      if (!result.sample.get_service_by_id_ok) {
        result.issues.push({
          endpoint: 'getServiceById',
          service_id: serviceId,
          issue: 'GET_SERVICE_BY_ID_FAILED'
        });
      }

      if (!result.sample.get_service_ortho_flags_ok) {
        result.issues.push({
          endpoint: 'getServiceOrthoFlags',
          service_id: serviceId,
          issue: 'GET_SERVICE_ORTHO_FLAGS_FAILED'
        });
      }
    } else {
      result.sample.skipped_service_detail = true;
      result.sample.reason = 'Tidak ada active service untuk sample detail test';
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataServicePhase4BRegressionPack() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    tests: []
  };

  try {
    const testList = [
      {
        name: 'testMasterDataRepositoryPhase4AReadOnly',
        fn: typeof testMasterDataRepositoryPhase4AReadOnly === 'function'
          ? testMasterDataRepositoryPhase4AReadOnly
          : null
      },
      {
        name: 'testMasterDataRepositoryPhase4ABuildRawContext',
        fn: typeof testMasterDataRepositoryPhase4ABuildRawContext === 'function'
          ? testMasterDataRepositoryPhase4ABuildRawContext
          : null
      },
      {
        name: 'testMasterDataRepositoryPhase4AFindServiceSample',
        fn: typeof testMasterDataRepositoryPhase4AFindServiceSample === 'function'
          ? testMasterDataRepositoryPhase4AFindServiceSample
          : null
      },
      {
        name: 'testMasterDataRepositoryPhase4AContextFinderSample',
        fn: typeof testMasterDataRepositoryPhase4AContextFinderSample === 'function'
          ? testMasterDataRepositoryPhase4AContextFinderSample
          : null
      },
      {
        name: 'testMasterDataServicePhase4BReadOnlyBridge',
        fn: typeof testMasterDataServicePhase4BReadOnlyBridge === 'function'
          ? testMasterDataServicePhase4BReadOnlyBridge
          : null
      },
      {
        name: 'testMasterDataServicePhase4BEndpointSample',
        fn: typeof testMasterDataServicePhase4BEndpointSample === 'function'
          ? testMasterDataServicePhase4BEndpointSample
          : null
      }
    ];

    testList.forEach(function(item) {
      if (!item.fn) {
        result.tests.push({
          name: item.name,
          success: false,
          issue_count: 1,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        result.issues.push({
          test: item.name,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        return;
      }

      const testResult = item.fn();
      const success = !!(testResult && testResult.success === true);
      const issueCount = testResult && testResult.issue_count !== undefined
        ? Number(testResult.issue_count || 0)
        : (success ? 0 : 1);

      result.tests.push({
        name: item.name,
        success: success,
        issue_count: issueCount
      });

      if (!success || issueCount > 0) {
        result.issues.push({
          test: item.name,
          success: success,
          issue_count: issueCount,
          issue: 'REGRESSION_TEST_FAILED'
        });
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}