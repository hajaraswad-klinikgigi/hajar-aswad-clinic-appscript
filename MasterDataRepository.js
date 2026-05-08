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

function testMasterDataRepositoryPhase4AReadOnly() {
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
    counts: {}
  };

  try {
    const serviceCatalog = MasterDataRepository.getServiceCatalogRaw();
    const activeServices = MasterDataRepository.listActiveServices();
    const inactiveServices = MasterDataRepository.listInactiveServices();
    const orthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices();
    const orthoControlServices = MasterDataRepository.listActiveOrthoControlServices();

    result.counts.serviceCatalog = Array.isArray(serviceCatalog) ? serviceCatalog.length : -1;
    result.counts.activeServices = Array.isArray(activeServices) ? activeServices.length : -1;
    result.counts.inactiveServices = Array.isArray(inactiveServices) ? inactiveServices.length : -1;
    result.counts.orthoInstallServices = Array.isArray(orthoInstallServices) ? orthoInstallServices.length : -1;
    result.counts.orthoControlServices = Array.isArray(orthoControlServices) ? orthoControlServices.length : -1;

    [
      { key: 'serviceCatalog', rows: serviceCatalog },
      { key: 'activeServices', rows: activeServices },
      { key: 'inactiveServices', rows: inactiveServices },
      { key: 'orthoInstallServices', rows: orthoInstallServices },
      { key: 'orthoControlServices', rows: orthoControlServices }
    ].forEach(function(item) {
      if (!Array.isArray(item.rows)) {
        result.issues.push({
          dataset: item.key,
          issue: 'DATASET_NOT_ARRAY'
        });
      }
    });

    if (
      Array.isArray(serviceCatalog) &&
      Array.isArray(activeServices) &&
      Array.isArray(inactiveServices) &&
      serviceCatalog.length !== activeServices.length + inactiveServices.length
    ) {
      result.issues.push({
        service_count: serviceCatalog.length,
        active_count: activeServices.length,
        inactive_count: inactiveServices.length,
        issue: 'ACTIVE_INACTIVE_COUNT_MISMATCH'
      });
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

function testMasterDataRepositoryPhase4ABuildRawContext() {
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
    context_counts: {}
  };

  try {
    const ctx = MasterDataRepository.buildRawContext({
      only: {
        serviceCatalog: true
      }
    });

    const serviceCatalog = MasterDataRepository.getRawContextRows(ctx, 'serviceCatalog');

    result.context_counts.serviceCatalog = Array.isArray(serviceCatalog)
      ? serviceCatalog.length
      : -1;

    if (!Array.isArray(serviceCatalog)) {
      result.issues.push({
        key: 'serviceCatalog',
        issue: 'CONTEXT_ROWS_NOT_ARRAY'
      });
    }

    const aliases = [
      'ServiceCatalog',
      'serviceCatalogRaw',
      'services'
    ];

    aliases.forEach(function(alias) {
      const rows = MasterDataRepository.getRawContextRows(ctx, alias);

      result.context_counts[alias] = Array.isArray(rows) ? rows.length : -1;

      if (!Array.isArray(rows)) {
        result.issues.push({
          alias: alias,
          issue: 'CONTEXT_ALIAS_NOT_ARRAY'
        });
      }

      if (
        Array.isArray(rows) &&
        Array.isArray(serviceCatalog) &&
        rows.length !== serviceCatalog.length
      ) {
        result.issues.push({
          alias: alias,
          alias_count: rows.length,
          service_catalog_count: serviceCatalog.length,
          issue: 'CONTEXT_ALIAS_COUNT_MISMATCH'
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

function testMasterDataRepositoryPhase4AFindServiceSample() {
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
    const services = MasterDataRepository.getServiceCatalogRaw();
    const firstService = services.length ? services[0] : null;

    const serviceId = firstService
      ? String(firstService.service_id || '').trim()
      : '';

    const serviceName = firstService
      ? String(firstService.service_name || '').trim()
      : '';

    result.sample.service_count = services.length;
    result.sample.first_service_id = serviceId;
    result.sample.first_service_name = serviceName;

    if (!serviceId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada layanan untuk sample test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const foundById = MasterDataRepository.findServiceById(serviceId);
    const foundByName = serviceName
      ? MasterDataRepository.findServiceByName(serviceName)
      : null;

    const priceData = MasterDataRepository.getServicePriceData(serviceId);
    const orthoFlags = MasterDataRepository.getServiceOrthoFlagsData(serviceId);

    result.sample.find_by_id_ok = !!foundById;
    result.sample.find_by_name_ok = serviceName ? !!foundByName : true;
    result.sample.price_data_ok = !!(
      priceData &&
      String(priceData.service_id || '').trim() === serviceId &&
      Number(priceData.default_price || 0) >= 0
    );
    result.sample.ortho_flags_ok = !!(
      orthoFlags &&
      String(orthoFlags.service_id || '').trim() === serviceId
    );

    if (!foundById) {
      result.issues.push({
        service_id: serviceId,
        issue: 'FIND_SERVICE_BY_ID_FAILED'
      });
    }

    if (serviceName && !foundByName) {
      result.issues.push({
        service_name: serviceName,
        issue: 'FIND_SERVICE_BY_NAME_FAILED'
      });
    }

    if (!result.sample.price_data_ok) {
      result.issues.push({
        service_id: serviceId,
        issue: 'GET_SERVICE_PRICE_DATA_FAILED'
      });
    }

    if (!result.sample.ortho_flags_ok) {
      result.issues.push({
        service_id: serviceId,
        issue: 'GET_SERVICE_ORTHO_FLAGS_FAILED'
      });
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

function testMasterDataRepositoryPhase4AContextFinderSample() {
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
    const ctx = MasterDataRepository.buildRawContext({
      only: {
        serviceCatalog: true
      }
    });

    const services = MasterDataRepository.getRawContextRows(ctx, 'serviceCatalog');
    const firstService = services.length ? services[0] : null;

    const serviceId = firstService
      ? String(firstService.service_id || '').trim()
      : '';

    result.sample.service_count = services.length;
    result.sample.first_service_id = serviceId;

    if (!serviceId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada layanan untuk context finder test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const service = MasterDataRepository.findServiceByIdFromContext(ctx, serviceId);
    const activeServices = MasterDataRepository.listActiveServicesFromContext(ctx);
    const orthoInstallServices = MasterDataRepository.listActiveOrthoInstallServicesFromContext(ctx);
    const orthoControlServices = MasterDataRepository.listActiveOrthoControlServicesFromContext(ctx);

    result.sample.find_service_ok = !!service;
    result.sample.active_service_count = activeServices.length;
    result.sample.ortho_install_count = orthoInstallServices.length;
    result.sample.ortho_control_count = orthoControlServices.length;

    if (!service) {
      result.issues.push({
        service_id: serviceId,
        issue: 'FIND_SERVICE_FROM_CONTEXT_FAILED'
      });
    }

    if (!Array.isArray(activeServices)) {
      result.issues.push({
        issue: 'ACTIVE_SERVICES_CONTEXT_NOT_ARRAY'
      });
    }

    if (!Array.isArray(orthoInstallServices)) {
      result.issues.push({
        issue: 'ORTHO_INSTALL_CONTEXT_NOT_ARRAY'
      });
    }

    if (!Array.isArray(orthoControlServices)) {
      result.issues.push({
        issue: 'ORTHO_CONTROL_CONTEXT_NOT_ARRAY'
      });
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

function testMasterDataRepositoryPhase6FSupabaseReadOnlyLog() {
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

function testMasterDataRepositoryPhase6FSpreadsheetRegressionLog() {
  const result = {
    success: true,
    stage: '6F-MasterData',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    tests: [],
    issue_count: 0,
    issues: []
  };

  function addTest(name, testResult) {
    const success = !!(testResult && testResult.success);

    result.tests.push({
      name: name,
      success: success,
      issue_count: testResult && typeof testResult.issue_count !== 'undefined'
        ? testResult.issue_count
        : null
    });

    if (!success) {
      result.issues.push({
        test: name,
        issue: 'REGRESSION_TEST_FAILED',
        result: testResult || null
      });
    }
  }

  try {
    addTest('testMasterDataRepositoryPhase4AReadOnly', testMasterDataRepositoryPhase4AReadOnly());
    addTest('testMasterDataRepositoryPhase4ABuildRawContext', testMasterDataRepositoryPhase4ABuildRawContext());
    addTest('testMasterDataRepositoryPhase4AFindServiceSample', testMasterDataRepositoryPhase4AFindServiceSample());
    addTest('testMasterDataRepositoryPhase4AContextFinderSample', testMasterDataRepositoryPhase4AContextFinderSample());

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

/* =========================================================
   PHASE 7B - MASTER DATA / SERVICE CATALOG MUTATION PREFLIGHT
   Read-only preflight. Aman dijalankan. Tidak menulis data.
   ========================================================= */

const MASTER_DATA_PHASE_7B_TEST_SERVICE = Object.freeze({
  SERVICE_ID: 'SRV-7B-TEST-001',
  SERVICE_NAME: 'ZZ_TEST_7B_SUPABASE_SERVICE',
  SERVICE_NAME_UPDATED: 'ZZ_TEST_7B_SUPABASE_SERVICE_UPDATED',
  DEFAULT_PRICE: 777000,
  DEFAULT_PRICE_UPDATED: 888000
});

function buildMasterDataPhase7BTestServicePayload_() {
  const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

  return {
    service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
    service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
    default_price: MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE,
    is_active: true,
    created_at: now,
    updated_at: now,
    is_ortho_install: false,
    is_ortho_control: false
  };
}

function testMasterDataPhase7BPreflightLog() {
  const result = {
    success: true,
    stage: '7B-1',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_updated: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED
    },
    counts: {},
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

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_OFF', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetServices = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseServices = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const supabaseActiveServices = MasterDataRepository.listActiveServices(supabaseOptions);
    const supabaseInactiveServices = MasterDataRepository.listInactiveServices(supabaseOptions);
    const supabaseOrthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices(supabaseOptions);
    const supabaseOrthoControlServices = MasterDataRepository.listActiveOrthoControlServices(supabaseOptions);

    result.counts.spreadsheet_service_catalog = Array.isArray(spreadsheetServices) ? spreadsheetServices.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(supabaseServices) ? supabaseServices.length : -1;
    result.counts.supabase_active_services = Array.isArray(supabaseActiveServices) ? supabaseActiveServices.length : -1;
    result.counts.supabase_inactive_services = Array.isArray(supabaseInactiveServices) ? supabaseInactiveServices.length : -1;
    result.counts.supabase_ortho_install_services = Array.isArray(supabaseOrthoInstallServices) ? supabaseOrthoInstallServices.length : -1;
    result.counts.supabase_ortho_control_services = Array.isArray(supabaseOrthoControlServices) ? supabaseOrthoControlServices.length : -1;

    addCheck('SUPABASE_SERVICE_CATALOG_READABLE', Array.isArray(supabaseServices), {
      row_count: result.counts.supabase_service_catalog
    });

    addCheck('SUPABASE_SERVICE_CATALOG_BASELINE_COUNT_100', result.counts.supabase_service_catalog === 100, {
      actual: result.counts.supabase_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH', result.counts.supabase_service_catalog === result.counts.supabase_active_services + result.counts.supabase_inactive_services, {
      service_count: result.counts.supabase_service_catalog,
      active_count: result.counts.supabase_active_services,
      inactive_count: result.counts.supabase_inactive_services
    });

    addCheck('SUPABASE_ORTHO_COUNTS_BASELINE', result.counts.supabase_ortho_install_services === 8 && result.counts.supabase_ortho_control_services === 10, {
      ortho_install_count: result.counts.supabase_ortho_install_services,
      expected_ortho_install_count: 8,
      ortho_control_count: result.counts.supabase_ortho_control_services,
      expected_ortho_control_count: 10
    });

    const existingById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const existingByName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const existingByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    addCheck('TEST_SERVICE_ID_NOT_EXISTING_BEFORE_7B', !existingById, {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      exists: !!existingById
    });

    addCheck('TEST_SERVICE_NAME_NOT_EXISTING_BEFORE_7B', !existingByName && !existingByUpdatedName, {
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_updated: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      name_exists: !!existingByName,
      updated_name_exists: !!existingByUpdatedName
    });

    const payload = buildMasterDataPhase7BTestServicePayload_();

    addCheck('TEST_SERVICE_PAYLOAD_VALID_SHAPE', !!(
      payload &&
      payload.service_id === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      payload.service_name === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME &&
      Number(payload.default_price || 0) > 0 &&
      payload.is_active === true &&
      payload.is_ortho_install === false &&
      payload.is_ortho_control === false
    ), {
      payload: payload
    });

    let explicitInsertBlocked = false;
    let explicitInsertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.SERVICE_CATALOG,
        payload,
        {
          stage: '7B'
        }
      );
    } catch (errInsert) {
      explicitInsertBlocked = true;
      explicitInsertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('SERVICE_CATALOG_INSERT_STILL_BLOCKED_WHEN_FLAG_FALSE', explicitInsertBlocked, {
      message: explicitInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-1',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

/* =========================================================
   PHASE 7B-2 - SERVICE CATALOG INSERT TEST DEFAULT-OFF
   Tidak menulis data. Memastikan insert helper siap tetapi tetap blocked.
   ========================================================= */

function testMasterDataPhase7BInsertDummyServiceDefaultOffLog() {
  const result = {
    success: true,
    stage: '7B-2',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME
    },
    counts_before: {},
    counts_after: {},
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

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_OFF', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const beforeRows = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const beforeById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    result.counts_before.supabase_service_catalog = Array.isArray(beforeRows) ? beforeRows.length : -1;

    addCheck('BASELINE_SERVICE_COUNT_100_BEFORE_INSERT_TEST', result.counts_before.supabase_service_catalog === 100, {
      actual: result.counts_before.supabase_service_catalog,
      expected: 100
    });

    addCheck('TEST_SERVICE_NOT_EXISTING_BEFORE_INSERT_TEST', !beforeById, {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      exists: !!beforeById
    });

    const payload = buildMasterDataPhase7BTestServicePayload_();

    let insertBlocked = false;
    let insertMessage = '';

    try {
      dbSupabaseInsertStaging7A_(
        REPO_TABLES.SERVICE_CATALOG,
        payload,
        {
          stage: '7B'
        }
      );
    } catch (errInsert) {
      insertBlocked = true;
      insertMessage = errInsert && errInsert.message ? errInsert.message : String(errInsert || '');
    }

    addCheck('DUMMY_SERVICE_INSERT_BLOCKED_WHEN_FLAG_FALSE', insertBlocked, {
      message: insertMessage
    });

    const afterRows = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const afterById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );
    const afterByName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    result.counts_after.supabase_service_catalog = Array.isArray(afterRows) ? afterRows.length : -1;

    addCheck('SERVICE_COUNT_UNCHANGED_AFTER_BLOCKED_INSERT', result.counts_after.supabase_service_catalog === result.counts_before.supabase_service_catalog, {
      before_count: result.counts_before.supabase_service_catalog,
      after_count: result.counts_after.supabase_service_catalog
    });

    addCheck('TEST_SERVICE_STILL_NOT_INSERTED_AFTER_BLOCKED_INSERT', !afterById && !afterByName, {
      service_id_exists: !!afterById,
      service_name_exists: !!afterByName
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-2',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BWriteFlagEnabledPreMutationLog() {
  const result = {
    success: true,
    stage: '7B-3',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME
    },
    counts: {},
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

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const services = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const existingById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );
    const existingByName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    result.counts.supabase_service_catalog = Array.isArray(services) ? services.length : -1;

    addCheck('SUPABASE_SERVICE_CATALOG_STILL_BASELINE_100', result.counts.supabase_service_catalog === 100, {
      actual: result.counts.supabase_service_catalog,
      expected: 100
    });

    addCheck('TEST_SERVICE_STILL_NOT_EXISTING_BEFORE_REAL_INSERT', !existingById && !existingByName, {
      service_id_exists: !!existingById,
      service_name_exists: !!existingByName
    });

    const writeCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7B',
      table_name: REPO_TABLES.SERVICE_CATALOG,
      operation: 'TEST_SERVICE_CATALOG_WRITE_7B'
    });

    addCheck('SERVICE_CATALOG_WRITE_GUARD_ALLOWS_7B_WHEN_FLAG_TRUE', writeCheck.allowed === true, {
      allowed: writeCheck.allowed,
      message: writeCheck.message
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.SERVICE_CATALOG, {
        service_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7B'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_EVEN_WHEN_WRITE_FLAG_TRUE', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-3',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BInsertDummyServiceLog() {
  const result = {
    success: true,
    stage: '7B-4',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME
    },
    counts_before: {},
    counts_after: {},
    insert_result: {},
    readback: {},
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

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  function boolFalse_(value) {
    if (value === false) return true;
    if (value === true) return false;
    const text = String(value || '').trim().toLowerCase();
    return text === '' || text === 'false';
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_ENABLED', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseBefore = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);

    const existingByIdBefore = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const existingByNameBefore = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    result.counts_before.spreadsheet_service_catalog = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_service_catalog = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    addCheck('SPREADSHEET_COUNT_BASELINE_100_BEFORE_INSERT', result.counts_before.spreadsheet_service_catalog === 100, {
      actual: result.counts_before.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_COUNT_BASELINE_100_BEFORE_INSERT', result.counts_before.supabase_service_catalog === 100, {
      actual: result.counts_before.supabase_service_catalog,
      expected: 100
    });

    addCheck('TEST_SERVICE_NOT_EXISTING_BEFORE_INSERT', !existingByIdBefore && !existingByNameBefore, {
      service_id_exists: !!existingByIdBefore,
      service_name_exists: !!existingByNameBefore
    });

    if (existingByIdBefore || existingByNameBefore) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const payload = buildMasterDataPhase7BTestServicePayload_();

    const insertResponse = dbSupabaseInsertStaging7A_(
      REPO_TABLES.SERVICE_CATALOG,
      payload,
      {
        stage: '7B'
      }
    );

    result.insert_result = {
      success: !!(insertResponse && insertResponse.success),
      status_code: insertResponse ? insertResponse.status_code : null,
      row_count: insertResponse ? insertResponse.row_count : null,
      target_table: insertResponse ? insertResponse.target_table : ''
    };

    addCheck('DUMMY_SERVICE_INSERT_RESPONSE_SUCCESS', !!(insertResponse && insertResponse.success), result.insert_result);

    const spreadsheetAfter = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseAfter = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);

    const insertedById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const insertedByName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    result.counts_after.spreadsheet_service_catalog = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_service_catalog = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.readback = insertedById ? {
      service_id: String(insertedById.service_id || '').trim(),
      service_name: String(insertedById.service_name || '').trim(),
      default_price: Number(insertedById.default_price || 0),
      is_active: insertedById.is_active,
      is_ortho_install: insertedById.is_ortho_install,
      is_ortho_control: insertedById.is_ortho_control
    } : null;

    addCheck('SPREADSHEET_COUNT_UNCHANGED_AFTER_SUPABASE_INSERT', result.counts_after.spreadsheet_service_catalog === result.counts_before.spreadsheet_service_catalog, {
      before_count: result.counts_before.spreadsheet_service_catalog,
      after_count: result.counts_after.spreadsheet_service_catalog
    });

    addCheck('SUPABASE_COUNT_INCREASED_TO_101_AFTER_INSERT', result.counts_after.supabase_service_catalog === 101, {
      before_count: result.counts_before.supabase_service_catalog,
      after_count: result.counts_after.supabase_service_catalog,
      expected_after_count: 101
    });

    addCheck('DUMMY_SERVICE_READBACK_BY_ID_FOUND', !!insertedById, {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID
    });

    addCheck('DUMMY_SERVICE_READBACK_BY_NAME_FOUND', !!insertedByName, {
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME
    });

    addCheck('DUMMY_SERVICE_READBACK_FIELDS_MATCH', !!(
      insertedById &&
      String(insertedById.service_id || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      String(insertedById.service_name || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME &&
      Number(insertedById.default_price || 0) === MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE &&
      boolTrue_(insertedById.is_active) &&
      boolFalse_(insertedById.is_ortho_install) &&
      boolFalse_(insertedById.is_ortho_control)
    ), {
      readback: result.readback
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-4',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BReadBackInsertedDummyServiceLog() {
  const result = {
    success: true,
    stage: '7B-5',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME
    },
    counts: {},
    readback: {},
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

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  function boolFalse_(value) {
    if (value === false) return true;
    if (value === true) return false;
    const text = String(value || '').trim().toLowerCase();
    return text === '' || text === 'false';
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7B', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetServices = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseServices = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const activeServices = MasterDataRepository.listActiveServices(supabaseOptions);
    const inactiveServices = MasterDataRepository.listInactiveServices(supabaseOptions);
    const orthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices(supabaseOptions);
    const orthoControlServices = MasterDataRepository.listActiveOrthoControlServices(supabaseOptions);

    result.counts.spreadsheet_service_catalog = Array.isArray(spreadsheetServices) ? spreadsheetServices.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(supabaseServices) ? supabaseServices.length : -1;
    result.counts.supabase_active_services = Array.isArray(activeServices) ? activeServices.length : -1;
    result.counts.supabase_inactive_services = Array.isArray(inactiveServices) ? inactiveServices.length : -1;
    result.counts.supabase_ortho_install_services = Array.isArray(orthoInstallServices) ? orthoInstallServices.length : -1;
    result.counts.supabase_ortho_control_services = Array.isArray(orthoControlServices) ? orthoControlServices.length : -1;

    addCheck('SPREADSHEET_SERVICE_COUNT_STILL_100', result.counts.spreadsheet_service_catalog === 100, {
      actual: result.counts.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_SERVICE_COUNT_NOW_101', result.counts.supabase_service_catalog === 101, {
      actual: result.counts.supabase_service_catalog,
      expected: 101
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH_AFTER_INSERT', result.counts.supabase_service_catalog === result.counts.supabase_active_services + result.counts.supabase_inactive_services, {
      service_count: result.counts.supabase_service_catalog,
      active_count: result.counts.supabase_active_services,
      inactive_count: result.counts.supabase_inactive_services
    });

    addCheck('SUPABASE_ORTHO_COUNTS_UNCHANGED_AFTER_INSERT', result.counts.supabase_ortho_install_services === 8 && result.counts.supabase_ortho_control_services === 10, {
      ortho_install_count: result.counts.supabase_ortho_install_services,
      expected_ortho_install_count: 8,
      ortho_control_count: result.counts.supabase_ortho_control_services,
      expected_ortho_control_count: 10
    });

    const serviceById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceByName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    result.readback.by_id = serviceById ? {
      service_id: String(serviceById.service_id || '').trim(),
      service_name: String(serviceById.service_name || '').trim(),
      default_price: Number(serviceById.default_price || 0),
      is_active: serviceById.is_active,
      is_ortho_install: serviceById.is_ortho_install,
      is_ortho_control: serviceById.is_ortho_control
    } : null;

    addCheck('DUMMY_SERVICE_FOUND_BY_ID_AFTER_INSERT', !!serviceById, {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID
    });

    addCheck('DUMMY_SERVICE_FOUND_BY_NAME_AFTER_INSERT', !!serviceByName, {
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME
    });

    addCheck('DUMMY_SERVICE_UPDATED_NAME_NOT_YET_EXISTING', !serviceByUpdatedName, {
      service_name_updated: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      exists: !!serviceByUpdatedName
    });

    addCheck('DUMMY_SERVICE_FIELDS_MATCH_AFTER_INSERT', !!(
      serviceById &&
      String(serviceById.service_id || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      String(serviceById.service_name || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME &&
      Number(serviceById.default_price || 0) === MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE &&
      boolTrue_(serviceById.is_active) &&
      boolFalse_(serviceById.is_ortho_install) &&
      boolFalse_(serviceById.is_ortho_control)
    ), {
      readback: result.readback.by_id
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-5',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BUpdateDummyServiceLog() {
  const result = {
    success: true,
    stage: '7B-6',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name_before: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_after: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED
    },
    counts_before: {},
    counts_after: {},
    update_result: {},
    readback: {},
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

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  function boolFalse_(value) {
    if (value === false) return true;
    if (value === true) return false;
    const text = String(value || '').trim().toLowerCase();
    return text === '' || text === 'false';
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7B', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseBefore = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);

    const serviceBeforeById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceBeforeByName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceBeforeByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    result.counts_before.spreadsheet_service_catalog = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_service_catalog = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    addCheck('SPREADSHEET_COUNT_STILL_100_BEFORE_UPDATE', result.counts_before.spreadsheet_service_catalog === 100, {
      actual: result.counts_before.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_COUNT_STILL_101_BEFORE_UPDATE', result.counts_before.supabase_service_catalog === 101, {
      actual: result.counts_before.supabase_service_catalog,
      expected: 101
    });

    addCheck('DUMMY_SERVICE_EXISTS_BEFORE_UPDATE', !!serviceBeforeById && !!serviceBeforeByName && !serviceBeforeByUpdatedName, {
      by_id_exists: !!serviceBeforeById,
      by_old_name_exists: !!serviceBeforeByName,
      by_updated_name_exists: !!serviceBeforeByUpdatedName
    });

    if (!serviceBeforeById || !serviceBeforeByName || serviceBeforeByUpdatedName) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const patch = {
      service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      default_price: MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE_UPDATED,
      is_active: true,
      updated_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      is_ortho_install: false,
      is_ortho_control: false
    };

    const updateResponse = dbSupabaseUpdateByIdStaging7A_(
      REPO_TABLES.SERVICE_CATALOG,
      'service_id',
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      patch,
      {
        stage: '7B'
      }
    );

    result.update_result = {
      success: !!(updateResponse && updateResponse.success),
      status_code: updateResponse ? updateResponse.status_code : null,
      row_count: updateResponse ? updateResponse.row_count : null,
      target_table: updateResponse ? updateResponse.target_table : ''
    };

    addCheck('DUMMY_SERVICE_UPDATE_RESPONSE_SUCCESS', !!(updateResponse && updateResponse.success), result.update_result);

    const spreadsheetAfter = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseAfter = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);

    const serviceAfterById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceAfterByOldName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceAfterByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    result.counts_after.spreadsheet_service_catalog = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_service_catalog = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    result.readback.by_id = serviceAfterById ? {
      service_id: String(serviceAfterById.service_id || '').trim(),
      service_name: String(serviceAfterById.service_name || '').trim(),
      default_price: Number(serviceAfterById.default_price || 0),
      is_active: serviceAfterById.is_active,
      is_ortho_install: serviceAfterById.is_ortho_install,
      is_ortho_control: serviceAfterById.is_ortho_control
    } : null;

    addCheck('SPREADSHEET_COUNT_UNCHANGED_AFTER_SUPABASE_UPDATE', result.counts_after.spreadsheet_service_catalog === result.counts_before.spreadsheet_service_catalog, {
      before_count: result.counts_before.spreadsheet_service_catalog,
      after_count: result.counts_after.spreadsheet_service_catalog
    });

    addCheck('SUPABASE_COUNT_UNCHANGED_101_AFTER_UPDATE', result.counts_after.supabase_service_catalog === result.counts_before.supabase_service_catalog, {
      before_count: result.counts_before.supabase_service_catalog,
      after_count: result.counts_after.supabase_service_catalog
    });

    addCheck('DUMMY_SERVICE_FOUND_BY_ID_AFTER_UPDATE', !!serviceAfterById, {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID
    });

    addCheck('DUMMY_SERVICE_OLD_NAME_NOT_FOUND_AFTER_UPDATE', !serviceAfterByOldName, {
      old_service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      exists: !!serviceAfterByOldName
    });

    addCheck('DUMMY_SERVICE_UPDATED_NAME_FOUND_AFTER_UPDATE', !!serviceAfterByUpdatedName, {
      updated_service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      exists: !!serviceAfterByUpdatedName
    });

    addCheck('DUMMY_SERVICE_FIELDS_MATCH_AFTER_UPDATE', !!(
      serviceAfterById &&
      String(serviceAfterById.service_id || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      String(serviceAfterById.service_name || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED &&
      Number(serviceAfterById.default_price || 0) === MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE_UPDATED &&
      boolTrue_(serviceAfterById.is_active) &&
      boolFalse_(serviceAfterById.is_ortho_install) &&
      boolFalse_(serviceAfterById.is_ortho_control)
    ), {
      readback: result.readback.by_id
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-6',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BReadBackUpdatedDummyServiceLog() {
  const result = {
    success: true,
    stage: '7B-7',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name_before: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_after: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED
    },
    counts: {},
    readback: {},
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

  function boolTrue_(value) {
    if (value === true) return true;
    if (value === false) return false;
    return String(value || '').trim().toLowerCase() === 'true';
  }

  function boolFalse_(value) {
    if (value === false) return true;
    if (value === true) return false;
    const text = String(value || '').trim().toLowerCase();
    return text === '' || text === 'false';
  }

  try {
    const supabaseOptions = {
      backend_mode: 'supabase'
    };

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7B', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetServices = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseServices = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const activeServices = MasterDataRepository.listActiveServices(supabaseOptions);
    const inactiveServices = MasterDataRepository.listInactiveServices(supabaseOptions);
    const orthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices(supabaseOptions);
    const orthoControlServices = MasterDataRepository.listActiveOrthoControlServices(supabaseOptions);

    result.counts.spreadsheet_service_catalog = Array.isArray(spreadsheetServices) ? spreadsheetServices.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(supabaseServices) ? supabaseServices.length : -1;
    result.counts.supabase_active_services = Array.isArray(activeServices) ? activeServices.length : -1;
    result.counts.supabase_inactive_services = Array.isArray(inactiveServices) ? inactiveServices.length : -1;
    result.counts.supabase_ortho_install_services = Array.isArray(orthoInstallServices) ? orthoInstallServices.length : -1;
    result.counts.supabase_ortho_control_services = Array.isArray(orthoControlServices) ? orthoControlServices.length : -1;

    addCheck('SPREADSHEET_SERVICE_COUNT_STILL_100_AFTER_UPDATE', result.counts.spreadsheet_service_catalog === 100, {
      actual: result.counts.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_SERVICE_COUNT_STILL_101_AFTER_UPDATE', result.counts.supabase_service_catalog === 101, {
      actual: result.counts.supabase_service_catalog,
      expected: 101
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_MATCH_AFTER_UPDATE', result.counts.supabase_service_catalog === result.counts.supabase_active_services + result.counts.supabase_inactive_services, {
      service_count: result.counts.supabase_service_catalog,
      active_count: result.counts.supabase_active_services,
      inactive_count: result.counts.supabase_inactive_services
    });

    addCheck('SUPABASE_ORTHO_COUNTS_UNCHANGED_AFTER_UPDATE', result.counts.supabase_ortho_install_services === 8 && result.counts.supabase_ortho_control_services === 10, {
      ortho_install_count: result.counts.supabase_ortho_install_services,
      expected_ortho_install_count: 8,
      ortho_control_count: result.counts.supabase_ortho_control_services,
      expected_ortho_control_count: 10
    });

    const serviceById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceByOldName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    result.readback.by_id = serviceById ? {
      service_id: String(serviceById.service_id || '').trim(),
      service_name: String(serviceById.service_name || '').trim(),
      default_price: Number(serviceById.default_price || 0),
      is_active: serviceById.is_active,
      is_ortho_install: serviceById.is_ortho_install,
      is_ortho_control: serviceById.is_ortho_control
    } : null;

    addCheck('DUMMY_SERVICE_FOUND_BY_ID_AFTER_UPDATE_VERIFY', !!serviceById, {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID
    });

    addCheck('DUMMY_SERVICE_OLD_NAME_NOT_FOUND_AFTER_UPDATE_VERIFY', !serviceByOldName, {
      old_service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      exists: !!serviceByOldName
    });

    addCheck('DUMMY_SERVICE_UPDATED_NAME_FOUND_AFTER_UPDATE_VERIFY', !!serviceByUpdatedName, {
      updated_service_name: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      exists: !!serviceByUpdatedName
    });

    addCheck('DUMMY_SERVICE_FIELDS_MATCH_AFTER_UPDATE_VERIFY', !!(
      serviceById &&
      String(serviceById.service_id || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      String(serviceById.service_name || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED &&
      Number(serviceById.default_price || 0) === MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE_UPDATED &&
      boolTrue_(serviceById.is_active) &&
      boolFalse_(serviceById.is_ortho_install) &&
      boolFalse_(serviceById.is_ortho_control)
    ), {
      readback: result.readback.by_id
    });

    const priceData = MasterDataRepository.getServicePriceData(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const orthoFlags = MasterDataRepository.getServiceOrthoFlagsData(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    addCheck('DUMMY_SERVICE_PRICE_DATA_MATCH_AFTER_UPDATE', !!(
      priceData &&
      String(priceData.service_id || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      String(priceData.service_name || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED &&
      Number(priceData.default_price || 0) === MASTER_DATA_PHASE_7B_TEST_SERVICE.DEFAULT_PRICE_UPDATED
    ), {
      price_data: priceData
    });

    addCheck('DUMMY_SERVICE_ORTHO_FLAGS_MATCH_AFTER_UPDATE', !!(
      orthoFlags &&
      String(orthoFlags.service_id || '').trim() === MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID &&
      orthoFlags.is_ortho_install === false &&
      orthoFlags.is_ortho_control === false
    ), {
      ortho_flags: orthoFlags
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-7',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BDeleteDummyServiceLog() {
  const result = {
    success: true,
    stage: '7B-8',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name_before: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_after: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED
    },
    counts_before: {},
    counts_after: {},
    delete_result: {},
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

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_7B', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetBefore = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseBefore = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);

    const serviceBeforeById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceBeforeByOldName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceBeforeByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    result.counts_before.spreadsheet_service_catalog = Array.isArray(spreadsheetBefore) ? spreadsheetBefore.length : -1;
    result.counts_before.supabase_service_catalog = Array.isArray(supabaseBefore) ? supabaseBefore.length : -1;

    addCheck('SPREADSHEET_COUNT_STILL_100_BEFORE_DELETE', result.counts_before.spreadsheet_service_catalog === 100, {
      actual: result.counts_before.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_COUNT_STILL_101_BEFORE_DELETE', result.counts_before.supabase_service_catalog === 101, {
      actual: result.counts_before.supabase_service_catalog,
      expected: 101
    });

    addCheck('DUMMY_SERVICE_EXISTS_BEFORE_DELETE', !!serviceBeforeById && !serviceBeforeByOldName && !!serviceBeforeByUpdatedName, {
      by_id_exists: !!serviceBeforeById,
      by_old_name_exists: !!serviceBeforeByOldName,
      by_updated_name_exists: !!serviceBeforeByUpdatedName
    });

    if (!serviceBeforeById || serviceBeforeByOldName || !serviceBeforeByUpdatedName) {
      result.issue_count = result.issues.length;
      result.success = false;
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const deleteResponse = dbSupabaseDeleteByIdStaging7A_(
      REPO_TABLES.SERVICE_CATALOG,
      'service_id',
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      {
        stage: '7B'
      }
    );

    result.delete_result = {
      success: !!(deleteResponse && deleteResponse.success),
      status_code: deleteResponse ? deleteResponse.status_code : null,
      row_count: deleteResponse ? deleteResponse.row_count : null,
      target_table: deleteResponse ? deleteResponse.target_table : ''
    };

    addCheck('DUMMY_SERVICE_DELETE_RESPONSE_SUCCESS', !!(deleteResponse && deleteResponse.success), result.delete_result);

    const spreadsheetAfter = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseAfter = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);

    const serviceAfterById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceAfterByOldName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceAfterByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    result.counts_after.spreadsheet_service_catalog = Array.isArray(spreadsheetAfter) ? spreadsheetAfter.length : -1;
    result.counts_after.supabase_service_catalog = Array.isArray(supabaseAfter) ? supabaseAfter.length : -1;

    addCheck('SPREADSHEET_COUNT_UNCHANGED_AFTER_SUPABASE_DELETE', result.counts_after.spreadsheet_service_catalog === result.counts_before.spreadsheet_service_catalog, {
      before_count: result.counts_before.spreadsheet_service_catalog,
      after_count: result.counts_after.spreadsheet_service_catalog
    });

    addCheck('SUPABASE_COUNT_BACK_TO_100_AFTER_DELETE', result.counts_after.supabase_service_catalog === 100, {
      before_count: result.counts_before.supabase_service_catalog,
      after_count: result.counts_after.supabase_service_catalog,
      expected_after_count: 100
    });

    addCheck('DUMMY_SERVICE_NOT_FOUND_AFTER_DELETE', !serviceAfterById && !serviceAfterByOldName && !serviceAfterByUpdatedName, {
      by_id_exists: !!serviceAfterById,
      by_old_name_exists: !!serviceAfterByOldName,
      by_updated_name_exists: !!serviceAfterByUpdatedName
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-8',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BConfirmCleanupLog() {
  const result = {
    success: true,
    stage: '7B-9',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name_before: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_after: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED
    },
    counts: {},
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

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_STILL_ENABLED_FOR_CLEANUP_CHECK', result.supabase_staging_write_test_enabled === true, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetServices = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseServices = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const activeServices = MasterDataRepository.listActiveServices(supabaseOptions);
    const inactiveServices = MasterDataRepository.listInactiveServices(supabaseOptions);
    const orthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices(supabaseOptions);
    const orthoControlServices = MasterDataRepository.listActiveOrthoControlServices(supabaseOptions);

    result.counts.spreadsheet_service_catalog = Array.isArray(spreadsheetServices) ? spreadsheetServices.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(supabaseServices) ? supabaseServices.length : -1;
    result.counts.supabase_active_services = Array.isArray(activeServices) ? activeServices.length : -1;
    result.counts.supabase_inactive_services = Array.isArray(inactiveServices) ? inactiveServices.length : -1;
    result.counts.supabase_ortho_install_services = Array.isArray(orthoInstallServices) ? orthoInstallServices.length : -1;
    result.counts.supabase_ortho_control_services = Array.isArray(orthoControlServices) ? orthoControlServices.length : -1;

    addCheck('SPREADSHEET_SERVICE_COUNT_BACK_TO_BASELINE_100', result.counts.spreadsheet_service_catalog === 100, {
      actual: result.counts.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_SERVICE_COUNT_BACK_TO_BASELINE_100', result.counts.supabase_service_catalog === 100, {
      actual: result.counts.supabase_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_COUNT_BACK_TO_BASELINE', result.counts.supabase_active_services === 100 && result.counts.supabase_inactive_services === 0, {
      active_count: result.counts.supabase_active_services,
      expected_active_count: 100,
      inactive_count: result.counts.supabase_inactive_services,
      expected_inactive_count: 0
    });

    addCheck('SUPABASE_ORTHO_COUNTS_BACK_TO_BASELINE', result.counts.supabase_ortho_install_services === 8 && result.counts.supabase_ortho_control_services === 10, {
      ortho_install_count: result.counts.supabase_ortho_install_services,
      expected_ortho_install_count: 8,
      ortho_control_count: result.counts.supabase_ortho_control_services,
      expected_ortho_control_count: 10
    });

    const serviceById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const serviceByOldName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const serviceByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    addCheck('DUMMY_SERVICE_CLEANED_UP_BY_ID_AND_NAMES', !serviceById && !serviceByOldName && !serviceByUpdatedName, {
      by_id_exists: !!serviceById,
      by_old_name_exists: !!serviceByOldName,
      by_updated_name_exists: !!serviceByUpdatedName
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.SERVICE_CATALOG, {
        service_id: 'TEST-OLD-DBINSERT-STILL-BLOCKED-7B-CLEANUP'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_AFTER_7B_MUTATION', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-9',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMasterDataPhase7BFinalAuditLog() {
  const result = {
    success: true,
    stage: '7B-11',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
    ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
      ? repoGetUiReadBackendMode_()
      : '',
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : null,
    supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
      ? repoIsSupabaseStagingWriteTestEnabled_()
      : null,
    counts: {},
    test_service: {
      service_id: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      service_name_before: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      service_name_after: MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED
    },
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

    addCheck('DEFAULT_BACKEND_STILL_SPREADSHEET', result.default_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.default_backend_mode
    });

    addCheck('UI_READ_BACKEND_STILL_SPREADSHEET', result.ui_read_backend_mode === REPO_BACKEND_MODES.SPREADSHEET, {
      actual: result.ui_read_backend_mode,
      ui_read_supabase_test_enabled: result.ui_read_supabase_test_enabled
    });

    addCheck('SUPABASE_STAGING_WRITE_FLAG_BACK_TO_FALSE', result.supabase_staging_write_test_enabled === false, {
      actual: result.supabase_staging_write_test_enabled
    });

    const spreadsheetServices = MasterDataRepository.getServiceCatalogRaw({
      backend_mode: 'spreadsheet'
    });

    const supabaseServices = MasterDataRepository.getServiceCatalogRaw(supabaseOptions);
    const supabaseActiveServices = MasterDataRepository.listActiveServices(supabaseOptions);
    const supabaseInactiveServices = MasterDataRepository.listInactiveServices(supabaseOptions);
    const supabaseOrthoInstallServices = MasterDataRepository.listActiveOrthoInstallServices(supabaseOptions);
    const supabaseOrthoControlServices = MasterDataRepository.listActiveOrthoControlServices(supabaseOptions);

    result.counts.spreadsheet_service_catalog = Array.isArray(spreadsheetServices) ? spreadsheetServices.length : -1;
    result.counts.supabase_service_catalog = Array.isArray(supabaseServices) ? supabaseServices.length : -1;
    result.counts.supabase_active_services = Array.isArray(supabaseActiveServices) ? supabaseActiveServices.length : -1;
    result.counts.supabase_inactive_services = Array.isArray(supabaseInactiveServices) ? supabaseInactiveServices.length : -1;
    result.counts.supabase_ortho_install_services = Array.isArray(supabaseOrthoInstallServices) ? supabaseOrthoInstallServices.length : -1;
    result.counts.supabase_ortho_control_services = Array.isArray(supabaseOrthoControlServices) ? supabaseOrthoControlServices.length : -1;

    addCheck('SPREADSHEET_SERVICE_CATALOG_STILL_100', result.counts.spreadsheet_service_catalog === 100, {
      actual: result.counts.spreadsheet_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_SERVICE_CATALOG_FINAL_100', result.counts.supabase_service_catalog === 100, {
      actual: result.counts.supabase_service_catalog,
      expected: 100
    });

    addCheck('SUPABASE_ACTIVE_INACTIVE_FINAL_BASELINE', result.counts.supabase_active_services === 100 && result.counts.supabase_inactive_services === 0, {
      active_count: result.counts.supabase_active_services,
      expected_active_count: 100,
      inactive_count: result.counts.supabase_inactive_services,
      expected_inactive_count: 0
    });

    addCheck('SUPABASE_ORTHO_COUNTS_FINAL_BASELINE', result.counts.supabase_ortho_install_services === 8 && result.counts.supabase_ortho_control_services === 10, {
      ortho_install_count: result.counts.supabase_ortho_install_services,
      expected_ortho_install_count: 8,
      ortho_control_count: result.counts.supabase_ortho_control_services,
      expected_ortho_control_count: 10
    });

    const dummyById = MasterDataRepository.findServiceById(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_ID,
      supabaseOptions
    );

    const dummyByOldName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME,
      supabaseOptions
    );

    const dummyByUpdatedName = MasterDataRepository.findServiceByName(
      MASTER_DATA_PHASE_7B_TEST_SERVICE.SERVICE_NAME_UPDATED,
      supabaseOptions
    );

    addCheck('DUMMY_SERVICE_FULLY_CLEANED_UP_FINAL', !dummyById && !dummyByOldName && !dummyByUpdatedName, {
      by_id_exists: !!dummyById,
      by_old_name_exists: !!dummyByOldName,
      by_updated_name_exists: !!dummyByUpdatedName
    });

    const guardCheck = repoCheckSupabaseStagingWriteAllowed_({
      backend_mode: REPO_BACKEND_MODES.SUPABASE,
      write_intent: repoGetSupabaseStagingWriteIntent_(),
      stage: '7B',
      table_name: REPO_TABLES.SERVICE_CATALOG,
      operation: 'FINAL_7B_WRITE_GUARD_CHECK'
    });

    addCheck('WRITE_GUARD_BLOCKS_AFTER_FLAG_FALSE_FINAL', guardCheck.allowed === false, {
      allowed: guardCheck.allowed,
      message: guardCheck.message
    });

    let oldDbInsertSupabaseStillBlocked = false;
    let oldDbInsertMessage = '';

    try {
      dbInsert_(REPO_TABLES.SERVICE_CATALOG, {
        service_id: 'TEST-7B-FINAL-OLD-DBINSERT-SHOULD-NOT-INSERT'
      }, {
        backend_mode: REPO_BACKEND_MODES.SUPABASE
      });
    } catch (errOldInsert) {
      oldDbInsertSupabaseStillBlocked = true;
      oldDbInsertMessage = errOldInsert && errOldInsert.message ? errOldInsert.message : String(errOldInsert || '');
    }

    addCheck('OLD_DB_INSERT_SUPABASE_STILL_BLOCKED_FINAL', oldDbInsertSupabaseStillBlocked, {
      message: oldDbInsertMessage
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '7B-11',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}