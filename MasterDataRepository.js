/* =========================================================
   MASTER DATA REPOSITORY
   Tahap 4A - Repository Layer Read-Only
   Backend saat ini tetap Spreadsheet via DataAccess.gs
   ========================================================= */

/**
 * MasterDataRepository adalah layer baca data master.
 *
 * Catatan penting:
 * - Tahap 4A hanya read-only.
 * - Belum mengganti MasterDataService.gs.
 * - Belum mengubah endpoint frontend.
 * - Belum mengubah business logic.
 * - Belum menyentuh createServiceCatalog / updateServiceCatalog.
 * - Semua data masih berasal dari Spreadsheet melalui DataAccess.gs.
 */

const MASTER_DATA_REPOSITORY_CONTEXT_KEYS = Object.freeze({
  SERVICE_CATALOG: 'serviceCatalog'
});

const MasterDataRepository = Object.freeze({
  getServiceCatalogRaw: function(options) {
    return dbFindAll_(REPO_TABLES.SERVICE_CATALOG, options);
  },

  findServiceById: function(serviceId, options) {
    return dbFindById_(
      REPO_TABLES.SERVICE_CATALOG,
      repoGetPrimaryKeyForTable_(REPO_TABLES.SERVICE_CATALOG),
      serviceId,
      options
    );
  },

  listActiveServices: function(options) {
    return this.getServiceCatalogRaw(options).filter(function(row) {
      return isMasterDataRepositoryActive_(row.is_active);
    });
  },

  listInactiveServices: function(options) {
    return this.getServiceCatalogRaw(options).filter(function(row) {
      return !isMasterDataRepositoryActive_(row.is_active);
    });
  },

  listActiveOrthoInstallServices: function(options) {
    return this.listActiveServices(options).filter(function(row) {
      return isMasterDataRepositoryBooleanTrue_(row.is_ortho_install);
    });
  },

  listActiveOrthoControlServices: function(options) {
    return this.listActiveServices(options).filter(function(row) {
      return isMasterDataRepositoryBooleanTrue_(row.is_ortho_control);
    });
  },

  findServiceByName: function(serviceName, options) {
    const normalizedName = normalizeMasterDataRepositoryText_(serviceName).toLowerCase();

    if (!normalizedName) return null;

    return this.getServiceCatalogRaw(options).find(function(row) {
      return normalizeMasterDataRepositoryText_(row.service_name).toLowerCase() === normalizedName;
    }) || null;
  },

  serviceNameExists: function(serviceName, excludeServiceId, options) {
    const normalizedName = normalizeMasterDataRepositoryText_(serviceName).toLowerCase();
    const normalizedExcludeId = normalizeMasterDataRepositoryKeyValue_(excludeServiceId);

    if (!normalizedName) return false;

    return this.getServiceCatalogRaw(options).some(function(row) {
      const rowServiceId = normalizeMasterDataRepositoryKeyValue_(row.service_id);

      if (normalizedExcludeId && rowServiceId === normalizedExcludeId) {
        return false;
      }

      return normalizeMasterDataRepositoryText_(row.service_name).toLowerCase() === normalizedName;
    });
  },

  getServicePriceData: function(serviceId, options) {
    const service = this.findServiceById(serviceId, options);

    if (!service) return null;

    return {
      service_id: normalizeMasterDataRepositoryKeyValue_(service.service_id),
      service_name: normalizeMasterDataRepositoryText_(service.service_name),
      default_price: Number(service.default_price || 0),
      is_ortho_install: isMasterDataRepositoryBooleanTrue_(service.is_ortho_install),
      is_ortho_control: isMasterDataRepositoryBooleanTrue_(service.is_ortho_control)
    };
  },

  getServiceOrthoFlagsData: function(serviceId, options) {
    const service = this.findServiceById(serviceId, options);

    if (!service) return null;

    return {
      service_id: normalizeMasterDataRepositoryKeyValue_(service.service_id),
      service_name: normalizeMasterDataRepositoryText_(service.service_name),
      is_ortho_install: isMasterDataRepositoryBooleanTrue_(service.is_ortho_install),
      is_ortho_control: isMasterDataRepositoryBooleanTrue_(service.is_ortho_control)
    };
  },

  buildRawContext: function(options) {
    return buildMasterDataRepositoryRawContext_(options || {});
  },

  getRawContextRows: function(ctx, key) {
    return getMasterDataRepositoryRawContextRows_(ctx, key);
  },

  findServiceByIdFromContext: function(ctx, serviceId) {
    return findMasterDataRepositoryServiceByIdFromContext_(ctx, serviceId);
  },

  listActiveServicesFromContext: function(ctx) {
    return getMasterDataRepositoryRawContextRows_(
      ctx,
      MASTER_DATA_REPOSITORY_CONTEXT_KEYS.SERVICE_CATALOG
    ).filter(function(row) {
      return isMasterDataRepositoryActive_(row.is_active);
    });
  },

  listActiveOrthoInstallServicesFromContext: function(ctx) {
    return this.listActiveServicesFromContext(ctx).filter(function(row) {
      return isMasterDataRepositoryBooleanTrue_(row.is_ortho_install);
    });
  },

  listActiveOrthoControlServicesFromContext: function(ctx) {
    return this.listActiveServicesFromContext(ctx).filter(function(row) {
      return isMasterDataRepositoryBooleanTrue_(row.is_ortho_control);
    });
  }
});

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function normalizeMasterDataRepositoryKeyValue_(value) {
  return String(value || '').trim();
}

function normalizeMasterDataRepositoryText_(value) {
  return String(value || '').trim();
}

function isMasterDataRepositoryBooleanTrue_(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === '' || value === null || value === undefined) return false;

  return String(value).trim().toLowerCase() === 'true';
}

function isMasterDataRepositoryActive_(value) {
  if (value === false) return false;
  if (value === true) return true;
  if (value === '' || value === null || value === undefined) return true;

  return String(value).trim().toLowerCase() !== 'false';
}

function shouldMasterDataRepositoryLoadContextKey_(only, key) {
  const config = only || {};
  const keys = Object.keys(config);

  if (!keys.length) {
    return true;
  }

  return config[key] === true;
}

function buildMasterDataRepositoryRawContext_(options) {
  const opts = options || {};
  const only = opts.only || {};

  const ctx = {
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_(opts)
      : 'spreadsheet',

    loaded_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),

    serviceCatalog: []
  };

  if (shouldMasterDataRepositoryLoadContextKey_(only, MASTER_DATA_REPOSITORY_CONTEXT_KEYS.SERVICE_CATALOG)) {
    ctx.serviceCatalog = MasterDataRepository.getServiceCatalogRaw(opts);
  }

  return ctx;
}

function getMasterDataRepositoryRawContextRows_(ctx, key) {
  const context = ctx || {};
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) return [];

  if (Array.isArray(context[normalizedKey])) {
    return context[normalizedKey];
  }

  const aliases = {
    ServiceCatalog: 'serviceCatalog',
    serviceCatalogRaw: 'serviceCatalog',
    services: 'serviceCatalog'
  };

  const mappedKey = aliases[normalizedKey];

  if (mappedKey && Array.isArray(context[mappedKey])) {
    return context[mappedKey];
  }

  return [];
}

function findMasterDataRepositoryServiceByIdFromContext_(ctx, serviceId) {
  const normalizedServiceId = normalizeMasterDataRepositoryKeyValue_(serviceId);

  if (!normalizedServiceId) return null;

  return getMasterDataRepositoryRawContextRows_(
    ctx,
    MASTER_DATA_REPOSITORY_CONTEXT_KEYS.SERVICE_CATALOG
  ).find(function(row) {
    return String(row.service_id || '').trim() === normalizedServiceId;
  }) || null;
}

/* =========================================================
   MANUAL TESTS - READ ONLY
   Aman dijalankan. Tidak menulis / mengubah data.
   ========================================================= */

function testMasterDataRepositorySupabaseReadLog() {
  const result = {
    success: true,
    stage: '6F-MasterData',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
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
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === 'spreadsheet', {
      actual: result.default_backend_mode
    });

    const serviceCatalog = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const activeServices = MasterDataRepository.listActiveServices(supabaseOptions);
    const inactiveServices = MasterDataRepository.listInactiveServices(supabaseOptions);
    const orthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices(supabaseOptions);
    const orthoControlServices = MasterDataRepository.listActiveOrthoControlServices(supabaseOptions);

    addCheck('SUPABASE_MASTERDATA_SERVICE_CATALOG_ARRAY', Array.isArray(serviceCatalog), {
      row_count: Array.isArray(serviceCatalog) ? serviceCatalog.length : -1
    });

    addCheck('SUPABASE_MASTERDATA_ACTIVE_INACTIVE_ARRAYS', Array.isArray(activeServices) && Array.isArray(inactiveServices), {
      active_count: Array.isArray(activeServices) ? activeServices.length : -1,
      inactive_count: Array.isArray(inactiveServices) ? inactiveServices.length : -1
    });

    addCheck('SUPABASE_MASTERDATA_ORTHO_SERVICE_ARRAYS', Array.isArray(orthoInstallServices) && Array.isArray(orthoControlServices), {
      ortho_install_count: Array.isArray(orthoInstallServices) ? orthoInstallServices.length : -1,
      ortho_control_count: Array.isArray(orthoControlServices) ? orthoControlServices.length : -1
    });

    addCheck('SUPABASE_MASTERDATA_ACTIVE_INACTIVE_COUNT_MATCH', serviceCatalog.length === activeServices.length + inactiveServices.length, {
      service_count: serviceCatalog.length,
      active_count: activeServices.length,
      inactive_count: inactiveServices.length
    });

    const firstService = serviceCatalog.length ? serviceCatalog[0] : null;
    const firstServiceId = firstService ? String(firstService.service_id || '').trim() : '';
    const firstServiceName = firstService ? String(firstService.service_name || '').trim() : '';

    addCheck('SUPABASE_MASTERDATA_SAMPLE_SERVICE_AVAILABLE', !!firstServiceId, {
      service_count: serviceCatalog.length,
      first_service_id: firstServiceId,
      first_service_name: firstServiceName
    });

    if (firstServiceId) {
      const foundById = MasterDataRepository.findServiceById(firstServiceId, supabaseOptions);
      const foundByName = firstServiceName
        ? MasterDataRepository.findServiceByName(firstServiceName, supabaseOptions)
        : null;
      const nameExists = firstServiceName
        ? MasterDataRepository.serviceNameExists(firstServiceName, '', supabaseOptions)
        : true;
      const priceData = MasterDataRepository.getServicePriceData(firstServiceId, supabaseOptions);
      const orthoFlags = MasterDataRepository.getServiceOrthoFlagsData(firstServiceId, supabaseOptions);

      addCheck('SUPABASE_MASTERDATA_FIND_SERVICE_BY_ID', !!foundById, {
        service_id: firstServiceId
      });

      addCheck('SUPABASE_MASTERDATA_FIND_SERVICE_BY_NAME', firstServiceName ? !!foundByName : true, {
        service_name: firstServiceName
      });

      addCheck('SUPABASE_MASTERDATA_SERVICE_NAME_EXISTS', !!nameExists, {
        service_name: firstServiceName
      });

      addCheck('SUPABASE_MASTERDATA_PRICE_AND_FLAGS_DATA', !!(priceData && orthoFlags), {
        service_id: firstServiceId,
        default_price: priceData ? priceData.default_price : null
      });
    }

    const ctx = MasterDataRepository.buildRawContext({
      backend_mode: 'supabase',
      only: {
        serviceCatalog: true
      }
    });

    const ctxRows = MasterDataRepository.getRawContextRows(ctx, 'serviceCatalog');

    addCheck('SUPABASE_MASTERDATA_CONTEXT_BACKEND_MODE', ctx.backend_mode === 'supabase', {
      actual: ctx.backend_mode
    });

    addCheck('SUPABASE_MASTERDATA_CONTEXT_ROWS_ARRAY', Array.isArray(ctxRows), {
      service_count: Array.isArray(ctxRows) ? ctxRows.length : -1
    });

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.SERVICE_CATALOG, {
        service_id: 'TEST-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    addCheck('SUPABASE_MASTERDATA_WRITE_STILL_BLOCKED', supabaseWriteBlocked, {
      message: supabaseWriteMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6F-MasterData',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}


