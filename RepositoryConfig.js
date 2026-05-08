/* =========================================================
   REPOSITORY CONFIG
   Peta resmi sheet/table, primary key, dan target database
   Tahap 3A - Data Access Layer preparation
   ========================================================= */

/**
 * Nama sheet Spreadsheet saat ini.
 * Jangan ubah nama value karena masih mengikuti struktur DB Google Spreadsheet.
 */
const REPO_TABLES = Object.freeze({
  USERS: 'Users',
  PATIENTS: 'Patients',
  APPOINTMENTS: 'Appointments',
  SERVICE_CATALOG: 'ServiceCatalog',
  TREATMENTS: 'Treatments',
  TREATMENT_ITEMS: 'TreatmentItems',
  MEDICAL_RECORDS: 'MedicalRecords',
  PATIENT_PHOTOS: 'PatientPhotos',
  ORTHO_RECALL: 'OrthoRecall',
  BILLINGS: 'Billings',
  BILLING_ITEMS: 'BillingItems',
  BILLING_ADJUSTMENTS: 'BillingAdjustments',
  BILLING_INSTALLMENTS: 'BillingInstallments',
  PAYMENTS: 'Payments',
  BILLING_FEEDBACKS: 'BillingFeedbacks'
});

/**
 * Nama target table PostgreSQL/Supabase nanti.
 * Belum dipakai untuk runtime sekarang, hanya sebagai peta migrasi.
 */
const REPO_TARGET_TABLES = Object.freeze({
  Users: 'app_users',
  Patients: 'patients',
  Appointments: 'appointments',
  ServiceCatalog: 'service_catalog',
  Treatments: 'treatments',
  TreatmentItems: 'treatment_items',
  MedicalRecords: 'medical_records',
  PatientPhotos: 'patient_photos',
  OrthoRecall: 'ortho_recalls',
  Billings: 'billings',
  BillingItems: 'billing_items',
  BillingAdjustments: 'billing_adjustments',
  BillingInstallments: 'billing_installments',
  Payments: 'payments',
  BillingFeedbacks: 'billing_feedbacks'
});

/**
 * Primary key aktif di Spreadsheet saat ini.
 *
 * Catatan penting:
 * - TreatmentItems tetap memakai treatment_item_id untuk kompatibilitas app saat ini.
 * - Saat migrasi ke PostgreSQL, TreatmentItems wajib punya internal UUID primary key baru,
 *   karena ID legacy lama tidak selalu unik.
 */
const REPO_PRIMARY_KEYS = Object.freeze({
  Users: 'user_id',
  Patients: 'patient_id',
  Appointments: 'appointment_id',
  ServiceCatalog: 'service_id',
  Treatments: 'treatment_id',
  TreatmentItems: 'treatment_item_id',
  MedicalRecords: 'record_id',
  PatientPhotos: 'photo_id',
  OrthoRecall: 'ortho_recall_id',
  Billings: 'billing_id',
  BillingItems: 'billing_item_id',
  BillingAdjustments: 'adjustment_id',
  BillingInstallments: 'installment_id',
  Payments: 'payment_id',
  BillingFeedbacks: 'feedback_id'
});

/**
 * Backend mode resmi untuk repository/data access.
 *
 * Catatan aman 6A:
 * - Default aplikasi tetap spreadsheet.
 * - Mode supabase hanya dikenali untuk staging/test read-only.
 * - Jangan jadikan supabase sebagai default pada tahap ini.
 */
const REPO_BACKEND_MODES = Object.freeze({
  SPREADSHEET: 'spreadsheet',
  SUPABASE: 'supabase'
});

const REPO_DEFAULT_BACKEND_MODE = REPO_BACKEND_MODES.SPREADSHEET;

function repoNormalizeBackendMode_(backendMode) {
  const raw = String(backendMode || REPO_DEFAULT_BACKEND_MODE || '').trim().toLowerCase();

  if (!raw) {
    return REPO_DEFAULT_BACKEND_MODE;
  }

  if (raw === REPO_BACKEND_MODES.SPREADSHEET) {
    return REPO_BACKEND_MODES.SPREADSHEET;
  }

  if (raw === REPO_BACKEND_MODES.SUPABASE) {
    return REPO_BACKEND_MODES.SUPABASE;
  }

  throw new Error('Backend mode tidak dikenal: ' + raw);
}

function repoGetDefaultBackendMode_() {
  return REPO_DEFAULT_BACKEND_MODE;
}

function repoIsSpreadsheetBackendMode_(backendMode) {
  return repoNormalizeBackendMode_(backendMode) === REPO_BACKEND_MODES.SPREADSHEET;
}

function repoIsSupabaseBackendMode_(backendMode) {
  return repoNormalizeBackendMode_(backendMode) === REPO_BACKEND_MODES.SUPABASE;
}

/* =========================================================
   UI READ BACKEND TEST SWITCH - PHASE 6G
   ========================================================= */

/**
 * Switch sementara untuk UI regression read-only.
 *
 * AMAN:
 * - Default false = UI tetap baca Spreadsheet.
 * - Jika true = UI read boleh diarahkan ke Supabase staging.
 * - Mutasi/write tetap tidak boleh diarahkan ke Supabase.
 * - Jangan jadikan true permanen.
 */
const REPO_UI_READ_SUPABASE_TEST_ENABLED = true;

function repoIsUiReadSupabaseTestEnabled_() {
  return REPO_UI_READ_SUPABASE_TEST_ENABLED === true;
}

function repoGetUiReadBackendMode_() {
  return repoIsUiReadSupabaseTestEnabled_()
    ? REPO_BACKEND_MODES.SUPABASE
    : REPO_BACKEND_MODES.SPREADSHEET;
}

function repoBuildUiReadOptions_(extraOptions) {
  const opts = Object.assign({}, extraOptions || {});

  return Object.assign({}, opts, {
    backend_mode: repoGetUiReadBackendMode_(),
    ui_read_supabase_test_enabled: repoIsUiReadSupabaseTestEnabled_()
  });
}

function testRepositoryConfigPhase6GUiReadSwitchLog() {
  const result = {
    success: true,
    stage: '6G-RepositoryConfig',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    default_backend_mode: typeof repoGetDefaultBackendMode_ === 'function'
      ? repoGetDefaultBackendMode_()
      : '',
    ui_read_backend_mode: repoGetUiReadBackendMode_(),
    ui_read_supabase_test_enabled: repoIsUiReadSupabaseTestEnabled_(),
    issue_count: 0,
    issues: []
  };

  if (result.default_backend_mode !== REPO_BACKEND_MODES.SPREADSHEET) {
    result.issues.push({
      issue: 'DEFAULT_BACKEND_NOT_SPREADSHEET',
      actual: result.default_backend_mode
    });
  }

  if (!repoIsUiReadSupabaseTestEnabled_() && result.ui_read_backend_mode !== REPO_BACKEND_MODES.SPREADSHEET) {
    result.issues.push({
      issue: 'UI_READ_BACKEND_SHOULD_STAY_SPREADSHEET_WHEN_TEST_DISABLED',
      actual: result.ui_read_backend_mode
    });
  }

  result.issue_count = result.issues.length;
  result.success = result.issue_count === 0;

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function repoGetAllTableNames_() {
  return Object.keys(REPO_PRIMARY_KEYS);
}

function repoNormalizeTableName_(tableName) {
  const raw = String(tableName || '').trim();

  if (!raw) {
    throw new Error('Nama table/sheet tidak boleh kosong');
  }

  const tableNames = repoGetAllTableNames_();

  for (let i = 0; i < tableNames.length; i++) {
    if (tableNames[i].toLowerCase() === raw.toLowerCase()) {
      return tableNames[i];
    }
  }

  throw new Error('Table/sheet tidak terdaftar di RepositoryConfig: ' + raw);
}

function repoGetPrimaryKeyForTable_(tableName) {
  const normalizedTableName = repoNormalizeTableName_(tableName);
  return REPO_PRIMARY_KEYS[normalizedTableName] || '';
}

function repoGetTargetTableForSheet_(tableName) {
  const normalizedTableName = repoNormalizeTableName_(tableName);
  return REPO_TARGET_TABLES[normalizedTableName] || '';
}

function repoIsKnownTable_(tableName) {
  try {
    repoNormalizeTableName_(tableName);
    return true;
  } catch (err) {
    return false;
  }
}

function repoBuildConfigSummary_() {
  return repoGetAllTableNames_().map(function(tableName) {
    return {
      sheet_name: tableName,
      primary_key: repoGetPrimaryKeyForTable_(tableName),
      target_table: repoGetTargetTableForSheet_(tableName)
    };
  });
}