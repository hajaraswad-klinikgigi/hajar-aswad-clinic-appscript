/* =========================================================
   REPOSITORY CONFIG
   Mapping nama sheet ↔ tabel Supabase, primary key, dan
   pengaturan backend mode (spreadsheet vs supabase).
   ========================================================= */

/**
 * Nama sheet di Google Spreadsheet.
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
  BILLING_FEEDBACKS: 'BillingFeedbacks',
  EXPENSES: 'Expenses',
  DOCTOR_COMPENSATION_RULES: 'DoctorCompensationRules',
  DOCTOR_MATERIAL_DEDUCTIONS: 'DoctorMaterialDeductions',
  CLINIC_INFO: 'ClinicInfo',
  APP_USER_ROLES: 'AppUserRoles'
});

/**
 * Mapping nama sheet → nama tabel di Supabase.
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
  BillingFeedbacks: 'billing_feedbacks',
  Expenses: 'expenses',
  DoctorCompensationRules: 'doctor_compensation_rules',
  DoctorMaterialDeductions: 'doctor_material_deductions',
  ClinicInfo: 'clinic_info',
  AppUserRoles: 'app_user_roles'
});

/**
 * Primary key untuk setiap tabel.
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
  BillingFeedbacks: 'feedback_id',
  Expenses: 'expense_id',
  DoctorCompensationRules: 'doctor_name',
  DoctorMaterialDeductions: 'id',
  ClinicInfo: 'id',
  AppUserRoles: 'user_id'
});

/* =========================================================
   BACKEND MODE
   ========================================================= */

const REPO_BACKEND_MODES = Object.freeze({
  SPREADSHEET: 'spreadsheet',
  SUPABASE: 'supabase'
});

/**
 * Backend default aplikasi.
 * - SPREADSHEET: aplikasi pakai Google Sheets (mode saat ini)
 * - SUPABASE: aplikasi pakai Supabase (setelah final cutover)
 */
const REPO_DEFAULT_BACKEND_MODE = REPO_BACKEND_MODES.SUPABASE;

function repoNormalizeBackendMode_(backendMode) {
  const raw = String(backendMode || REPO_DEFAULT_BACKEND_MODE || '').trim().toLowerCase();

  if (!raw) {
    return REPO_DEFAULT_BACKEND_MODE;
  }

  if (raw === REPO_BACKEND_MODES.SPREADSHEET) return REPO_BACKEND_MODES.SPREADSHEET;
  if (raw === REPO_BACKEND_MODES.SUPABASE) return REPO_BACKEND_MODES.SUPABASE;

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
   UI READ OPTIONS
   Helper untuk service yang baca data untuk ditampilkan ke UI.
   ========================================================= */

function repoGetUiReadBackendMode_() {
  return repoGetDefaultBackendMode_();
}

function repoBuildUiReadOptions_(extraOptions) {
  const opts = Object.assign({}, extraOptions || {});
  return Object.assign({}, opts, {
    backend_mode: repoGetUiReadBackendMode_()
  });
}

/* =========================================================
   PRODUCTION MUTATION FREEZE
   Guard untuk membekukan semua operasi tulis saat cutover.
   ========================================================= */

const REPO_PRODUCTION_MUTATION_FREEZE_ENABLED = false;

const REPO_PRODUCTION_MUTATION_FREEZE_MESSAGE =
  'Sistem sedang dalam proses migrasi database. Perubahan data sementara dinonaktifkan. Silakan coba kembali setelah proses selesai.';

function repoIsProductionMutationFreezeEnabled_(options) {
  const opts = options || {};

  // __test_freeze_enabled hanya untuk unit test
  if (opts.__test_freeze_enabled === true) {
    return true;
  }

  return REPO_PRODUCTION_MUTATION_FREEZE_ENABLED === true;
}

function repoGetProductionMutationFreezeMessage_() {
  return REPO_PRODUCTION_MUTATION_FREEZE_MESSAGE;
}

function repoAssertProductionMutationAllowed_(options) {
  const opts = options || {};
  const operationName = String(opts.operation || 'PRODUCTION_MUTATION').trim() || 'PRODUCTION_MUTATION';
  const moduleName = String(opts.module || '').trim();
  const actionName = String(opts.action || '').trim();

  if (repoIsProductionMutationFreezeEnabled_(opts)) {
    const context = [];
    if (moduleName) context.push('module=' + moduleName);
    if (actionName) context.push('action=' + actionName);

    throw new Error(
      operationName + ' diblokir. ' +
      repoGetProductionMutationFreezeMessage_() +
      (context.length ? ' [' + context.join(', ') + ']' : '')
    );
  }

  return true;
}

function repoCheckProductionMutationAllowed_(options) {
  try {
    repoAssertProductionMutationAllowed_(options);
    return { allowed: true, message: '' };
  } catch (err) {
    return {
      allowed: false,
      message: err && err.message ? err.message : String(err || '')
    };
  }
}

/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

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