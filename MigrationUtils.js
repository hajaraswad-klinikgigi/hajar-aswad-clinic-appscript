/************************************************************
 * MigrationUtils.gs
 * Tahap 5K — Dry-run normalisasi parent tables
 * 
 * SAFE BOUNDARY:
 * - READ ONLY Spreadsheet
 * - NO Supabase insert/update/delete
 * - NO frontend changes
 * - NO backend mode changes
 ************************************************************/

/************************************************************
 * 5K CONFIG
 ************************************************************/

var MIGRATION_5K_PARENT_TABLES = {
  app_users: {
    target_table: 'app_users',
    source_sheet_aliases: ['Users', 'AppUsers', 'App Users', 'app_users'],
    legacy_id_candidates: ['user_id', 'id', 'uid', 'userId'],
    label_candidates: ['name', 'full_name', 'username', 'email']
  },

  patients: {
    target_table: 'patients',
    source_sheet_aliases: ['Patients', 'Patient', 'patients'],
    legacy_id_candidates: ['patient_id', 'id', 'patientId'],
    label_candidates: ['name', 'full_name', 'patient_name', 'phone']
  },

  service_catalog: {
    target_table: 'service_catalog',
    source_sheet_aliases: [
      'Services',
      'ServiceCatalog',
      'Service Catalog',
      'service_catalog',
      'TreatmentServices',
      'Treatment Services',
      'MasterServices',
      'Master Services'
    ],
    legacy_id_candidates: ['service_id', 'id', 'serviceId', 'treatment_id'],
    label_candidates: ['service_name', 'name', 'treatment_name', 'category']
  }
};


/************************************************************
 * 5K PUBLIC TEST ENTRY POINTS
 ************************************************************/

function testMigrationUtils5KNormalizeSamples() {
  var samples = {
    text_trim: migrationNormalizeText_5K_('  Pasien A  '),
    text_empty_to_null: migrationNormalizeNullableText_5K_('   '),
    phone_leading_zero: migrationNormalizePhone_5K_('0812-3456-7890'),
    phone_number_input: migrationNormalizePhone_5K_(81234567890),
    email: migrationNormalizeEmail_5K_('  TEST@Email.Com  '),
    date_from_date: migrationNormalizeDate_5K_(new Date(2026, 4, 6)),
    timestamp_from_date: migrationNormalizeTimestamp_5K_(new Date(2026, 4, 6, 10, 15, 30)),
    number_currency: migrationNormalizeNumber_5K_('Rp 1.250.000'),
    boolean_true: migrationNormalizeBoolean_5K_('ya'),
    boolean_false: migrationNormalizeBoolean_5K_('tidak')
  };

  return {
    success: true,
    checked_at: migrationNowIso_5K_(),
    issue_count: 0,
    issues: [],
    samples: samples
  };
}


function testMigrationUtils5KSourceRowsPreview() {
  var result = {
    success: true,
    checked_at: migrationNowIso_5K_(),
    issue_count: 0,
    issues: [],
    previews: {}
  };

  Object.keys(MIGRATION_5K_PARENT_TABLES).forEach(function(key) {
    var cfg = MIGRATION_5K_PARENT_TABLES[key];
    var sheet = migrationFindSheetByAliases_5K_(cfg.source_sheet_aliases);

    if (!sheet) {
      result.success = false;
      result.issues.push({
        severity: 'error',
        table: key,
        code: 'SOURCE_SHEET_NOT_FOUND',
        message: 'Sheet sumber tidak ditemukan.',
        aliases: cfg.source_sheet_aliases
      });
      return;
    }

    var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName(), 5);
    result.previews[key] = {
      target_table: cfg.target_table,
      source_sheet: sheet.getName(),
      row_count_total: rowsResult.row_count_total,
      preview_count: rowsResult.rows.length,
      headers: rowsResult.headers,
      rows: rowsResult.rows
    };

    if (rowsResult.issues.length) {
      result.issues = result.issues.concat(rowsResult.issues);
    }
  });

  result.issue_count = result.issues.length;
  result.success = result.issue_count === 0;

  return result;
}


function testMigrationUtils5KDryRunParentTables() {
  return runMigrationParentTablesDryRun5K();
}


function runMigrationParentTablesDryRun5K() {
  var startedAt = new Date();

  var result = {
    success: true,
    checked_at: migrationNowIso_5K_(),
    stage: '5K',
    mode: 'dry_run_read_only',
    safe_boundary: {
      supabase_insert: false,
      supabase_update: false,
      supabase_delete: false,
      spreadsheet_update: false,
      frontend_change: false
    },
    issue_count: 0,
    issues: [],
    tables: {},
    duration_ms: 0
  };

  var appUsers = migrationBuildAppUsersPayloadDryRun5K_();
  var patients = migrationBuildPatientsPayloadDryRun5K_();
  var serviceCatalog = migrationBuildServiceCatalogPayloadDryRun5K_();

  result.tables.app_users = appUsers.summary;
  result.tables.patients = patients.summary;
  result.tables.service_catalog = serviceCatalog.summary;

  result.issues = []
    .concat(appUsers.issues || [])
    .concat(patients.issues || [])
    .concat(serviceCatalog.issues || []);

  result.issue_count = result.issues.length;
  result.success = migrationHasNoBlockingIssues5K_(result.issues);

  result.duration_ms = new Date().getTime() - startedAt.getTime();

  return result;
}


/************************************************************
 * 5K PAYLOAD BUILDERS — PARENT TABLES
 ************************************************************/

function migrationBuildAppUsersPayloadDryRun5K_() {
  var cfg = MIGRATION_5K_PARENT_TABLES.app_users;
  var base = migrationBuildBaseParentPayloadResult5K_(cfg);

  if (!base.ok) return base;

  var payloads = [];
  var issues = base.issues.slice();

  base.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var legacyUserId = migrationPickFirstValue_5K_(raw, [
      'user_id', 'id', 'uid', 'userId'
    ]);

    var username = migrationPickFirstValue_5K_(raw, [
      'username', 'user_name', 'email', 'name'
    ]);

    var fullName = migrationPickFirstValue_5K_(raw, [
      'full_name', 'name', 'display_name', 'doctor_name'
    ]);

    var passwordHash = migrationPickFirstValue_5K_(raw, [
      'password_hash', 'passwordHash'
    ]);

    var role = migrationPickFirstValue_5K_(raw, [
      'role', 'user_role', 'level'
    ]);

    var email = migrationPickFirstValue_5K_(raw, [
      'email', 'email_address'
    ]);

    var phone = migrationPickFirstValue_5K_(raw, [
      'phone', 'phone_number', 'no_hp', 'whatsapp', 'wa'
    ]);

    var clinicId = migrationPickFirstValue_5K_(raw, [
      'clinic_id', 'clinicId'
    ]);

    var activeRaw = migrationPickFirstValue_5K_(raw, [
      'is_active', 'active', 'status'
    ]);

    var createdAt = migrationPickFirstValue_5K_(raw, [
      'created_at', 'createdAt', 'created_date'
    ]);

    var updatedAt = migrationPickFirstValue_5K_(raw, [
      'updated_at', 'updatedAt', 'updated_date'
    ]);

    var payload = {
      legacy_user_id: migrationNormalizeText_5K_(legacyUserId),
      username: migrationNormalizeNullableText_5K_(username),
      full_name: migrationNormalizeNullableText_5K_(fullName),
      password_hash: migrationNormalizeNullableText_5K_(passwordHash),
      role: migrationNormalizeRole_5K_(role),
      email: migrationNormalizeEmail_5K_(email),
      phone: migrationNormalizePhone_5K_(phone),
      clinic_id: migrationNormalizeNullableText_5K_(clinicId),
      is_active: migrationNormalizeActiveStatus_5K_(activeRaw, true),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),

      source_sheet: base.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationBuildRawSnapshot_5K_(raw)
    };

    if (!payload.legacy_user_id) {
      issues.push(migrationIssue5K_(
        'error',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'MISSING_LEGACY_USER_ID',
        'User tidak memiliki legacy ID.'
      ));
    }

    if (!payload.username && !payload.email && !payload.full_name) {
      issues.push(migrationIssue5K_(
        'warning',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'USER_LABEL_EMPTY',
        'User tidak memiliki username/email/full_name yang jelas.'
      ));
    }

    if (!payload.password_hash) {
      issues.push(migrationIssue5K_(
        'warning',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'USER_PASSWORD_HASH_EMPTY',
        'User tidak memiliki password_hash.'
      ));
    }

    payloads.push(payload);
  });

  return migrationFinalizeParentPayloadResult5K_(cfg, base, payloads, issues);
}


function migrationBuildPatientsPayloadDryRun5K_() {
  var cfg = MIGRATION_5K_PARENT_TABLES.patients;
  var base = migrationBuildBaseParentPayloadResult5K_(cfg);

  if (!base.ok) return base;

  var payloads = [];
  var issues = base.issues.slice();

  base.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var legacyPatientId = migrationPickFirstValue_5K_(raw, [
      'patient_id', 'id', 'patientId'
    ]);

    var patientCode = migrationPickFirstValue_5K_(raw, [
      'patient_code', 'code', 'no_rm', 'medical_record_number', 'mrn'
    ]);

    var name = migrationPickFirstValue_5K_(raw, [
      'full_name', 'name', 'patient_name', 'nama', 'nama_pasien'
    ]);

    var gender = migrationPickFirstValue_5K_(raw, [
      'gender', 'jenis_kelamin', 'sex'
    ]);

    var birthDate = migrationPickFirstValue_5K_(raw, [
      'birth_date', 'date_of_birth', 'dob', 'tanggal_lahir'
    ]);

    var phone = migrationPickFirstValue_5K_(raw, [
      'phone', 'phone_number', 'no_hp', 'whatsapp', 'wa'
    ]);

    var email = migrationPickFirstValue_5K_(raw, [
      'email', 'email_address'
    ]);

    var guardianName = migrationPickFirstValue_5K_(raw, [
      'guardian_name', 'nama_wali'
    ]);

    var guardianRelationship = migrationPickFirstValue_5K_(raw, [
      'guardian_relationship', 'hubungan_wali'
    ]);

    var guardianPhone = migrationPickFirstValue_5K_(raw, [
      'guardian_phone', 'phone_guardian', 'no_hp_wali'
    ]);

    var guardianEmail = migrationPickFirstValue_5K_(raw, [
      'guardian_email', 'email_guardian'
    ]);

    var address = migrationPickFirstValue_5K_(raw, [
      'address', 'alamat'
    ]);

    var allergyNotes = migrationPickFirstValue_5K_(raw, [
      'allergy_notes', 'allergy', 'catatan_alergi'
    ]);

    var medicalNotes = migrationPickFirstValue_5K_(raw, [
      'medical_notes', 'medical_note', 'catatan_medis'
    ]);

    var firstClinicId = migrationPickFirstValue_5K_(raw, [
      'first_clinic_id', 'firstClinicId'
    ]);

    var activeRaw = migrationPickFirstValue_5K_(raw, [
      'is_active', 'active', 'status'
    ]);

    var createdAt = migrationPickFirstValue_5K_(raw, [
      'created_at', 'createdAt', 'created_date'
    ]);

    var updatedAt = migrationPickFirstValue_5K_(raw, [
      'updated_at', 'updatedAt', 'updated_date'
    ]);

    var payload = {
      legacy_patient_id: migrationNormalizeText_5K_(legacyPatientId),
      patient_code: migrationNormalizeNullableText_5K_(patientCode),
      full_name: migrationNormalizeNullableText_5K_(name),
      gender: migrationNormalizeGender_5K_(gender),
      birth_date: migrationNormalizeDate_5K_(birthDate),
      phone: migrationNormalizePhone_5K_(phone),
      email: migrationNormalizeEmail_5K_(email),
      guardian_name: migrationNormalizeNullableText_5K_(guardianName),
      guardian_relationship: migrationNormalizeNullableText_5K_(guardianRelationship),
      guardian_phone: migrationNormalizePhone_5K_(guardianPhone),
      guardian_email: migrationNormalizeEmail_5K_(guardianEmail),
      address: migrationNormalizeNullableText_5K_(address),
      allergy_notes: migrationNormalizeNullableText_5K_(allergyNotes),
      medical_notes: migrationNormalizeNullableText_5K_(medicalNotes),
      first_clinic_id: migrationNormalizeNullableText_5K_(firstClinicId),
      is_active: migrationNormalizeActiveStatus_5K_(activeRaw, true),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),

      source_sheet: base.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationBuildRawSnapshot_5K_(raw)
    };

    if (!payload.legacy_patient_id) {
      issues.push(migrationIssue5K_(
        'error',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'MISSING_LEGACY_PATIENT_ID',
        'Pasien tidak memiliki legacy patient_id.'
      ));
    }

    if (!payload.full_name) {
      issues.push(migrationIssue5K_(
        'warning',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'PATIENT_NAME_EMPTY',
        'Nama pasien kosong.'
      ));
    }

    payloads.push(payload);
  });

  return migrationFinalizeParentPayloadResult5K_(cfg, base, payloads, issues);
}


function migrationBuildServiceCatalogPayloadDryRun5K_() {
  var cfg = MIGRATION_5K_PARENT_TABLES.service_catalog;
  var base = migrationBuildBaseParentPayloadResult5K_(cfg);

  if (!base.ok) return base;

  var payloads = [];
  var issues = base.issues.slice();

  base.rows.forEach(function(rowObj) {
    var raw = rowObj.raw;

    var legacyServiceId = migrationPickFirstValue_5K_(raw, [
      'service_id', 'id', 'serviceId', 'treatment_id'
    ]);

    var serviceName = migrationPickFirstValue_5K_(raw, [
      'service_name', 'name', 'treatment_name', 'nama_layanan'
    ]);

    var category = migrationPickFirstValue_5K_(raw, [
      'category', 'kategori', 'service_category'
    ]);

    var defaultPrice = migrationPickFirstValue_5K_(raw, [
      'default_price', 'price', 'harga', 'tarif'
    ]);

    var durationMinutes = migrationPickFirstValue_5K_(raw, [
      'duration_minutes', 'duration', 'durasi'
    ]);

    var isOrthoInstall = migrationPickFirstValue_5K_(raw, [
      'is_ortho_install', 'ortho_install'
    ]);

    var isOrthoControl = migrationPickFirstValue_5K_(raw, [
      'is_ortho_control', 'ortho_control'
    ]);

    var activeRaw = migrationPickFirstValue_5K_(raw, [
      'is_active', 'active', 'status'
    ]);

    var createdAt = migrationPickFirstValue_5K_(raw, [
      'created_at', 'createdAt', 'created_date'
    ]);

    var updatedAt = migrationPickFirstValue_5K_(raw, [
      'updated_at', 'updatedAt', 'updated_date'
    ]);

    var payload = {
      legacy_service_id: migrationNormalizeText_5K_(legacyServiceId),
      service_name: migrationNormalizeNullableText_5K_(serviceName),
      category: migrationNormalizeNullableText_5K_(category),
      default_price: migrationNormalizeNumber_5K_(defaultPrice),
      duration_minutes: migrationNormalizeInteger_5K_(durationMinutes),
      is_ortho_install: migrationNormalizeBoolean_5K_(isOrthoInstall) === true,
      is_ortho_control: migrationNormalizeBoolean_5K_(isOrthoControl) === true,
      is_active: migrationNormalizeActiveStatus_5K_(activeRaw, true),
      created_at: migrationNormalizeTimestamp_5K_(createdAt),
      updated_at: migrationNormalizeTimestamp_5K_(updatedAt),

      source_sheet: base.source_sheet,
      source_row_number: rowObj.source_row_number,
      raw_snapshot: migrationBuildRawSnapshot_5K_(raw)
    };

    if (!payload.legacy_service_id) {
      issues.push(migrationIssue5K_(
        'error',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'MISSING_LEGACY_SERVICE_ID',
        'Service catalog tidak memiliki legacy service_id.'
      ));
    }

    if (!payload.service_name) {
      issues.push(migrationIssue5K_(
        'warning',
        cfg.target_table,
        base.source_sheet,
        rowObj.source_row_number,
        'SERVICE_NAME_EMPTY',
        'Nama layanan kosong.'
      ));
    }

    payloads.push(payload);
  });

  return migrationFinalizeParentPayloadResult5K_(cfg, base, payloads, issues);
}

/************************************************************
 * 5K BASE PAYLOAD HELPERS
 ************************************************************/

function migrationBuildBaseParentPayloadResult5K_(cfg) {
  var issues = [];
  var sheet = migrationFindSheetByAliases_5K_(cfg.source_sheet_aliases);

  if (!sheet) {
    return {
      ok: false,
      success: false,
      issues: [
        migrationIssue5K_(
          'error',
          cfg.target_table,
          '',
          '',
          'SOURCE_SHEET_NOT_FOUND',
          'Sheet sumber tidak ditemukan untuk table ' + cfg.target_table + '.',
          { aliases: cfg.source_sheet_aliases }
        )
      ],
      summary: {
        target_table: cfg.target_table,
        source_sheet: null,
        spreadsheet_row_count: 0,
        dry_run_payload_count: 0,
        sample_payloads: []
      }
    };
  }

  var rowsResult = migrationReadSheetRowsWithSource_5K_(sheet.getName());
  issues = issues.concat(rowsResult.issues || []);

  return {
    ok: true,
    success: true,
    source_sheet: sheet.getName(),
    headers: rowsResult.headers,
    rows: rowsResult.rows,
    row_count_total: rowsResult.row_count_total,
    issues: issues
  };
}


function migrationFinalizeParentPayloadResult5K_(cfg, base, payloads, issues) {
  var duplicateLegacyIds = migrationFindDuplicateValues5K_(
    payloads,
    migrationGetLegacyFieldNameByTarget5K_(cfg.target_table)
  );

  duplicateLegacyIds.forEach(function(item) {
    issues.push(migrationIssue5K_(
      'error',
      cfg.target_table,
      base.source_sheet,
      '',
      'DUPLICATE_LEGACY_ID',
      'Legacy ID duplikat ditemukan pada payload dry-run.',
      item
    ));
  });

  return {
    ok: true,
    success: migrationHasNoBlockingIssues5K_(issues),
    issues: issues,
    payloads: payloads,
    summary: {
      target_table: cfg.target_table,
      source_sheet: base.source_sheet,
      spreadsheet_row_count: base.row_count_total,
      dry_run_payload_count: payloads.length,
      blocking_issue_count: migrationCountIssuesBySeverity5K_(issues, 'error'),
      warning_issue_count: migrationCountIssuesBySeverity5K_(issues, 'warning'),
      sample_payloads: payloads.slice(0, 5)
    }
  };
}


function migrationGetLegacyFieldNameByTarget5K_(targetTable) {
  if (targetTable === 'app_users') return 'legacy_user_id';
  if (targetTable === 'patients') return 'legacy_patient_id';
  if (targetTable === 'service_catalog') return 'legacy_service_id';
  return 'legacy_id';
}


/************************************************************
 * 5K SPREADSHEET READ HELPERS — READ ONLY
 ************************************************************/

function migrationGetActiveSpreadsheet5K_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}


function migrationFindSheetByAliases_5K_(aliases) {
  var ss = migrationGetActiveSpreadsheet5K_();

  for (var i = 0; i < aliases.length; i++) {
    var sheet = ss.getSheetByName(aliases[i]);
    if (sheet) return sheet;
  }

  var allSheets = ss.getSheets();
  var normalizedAliases = aliases.map(function(name) {
    return migrationNormalizeHeaderKey_5K_(name);
  });

  for (var j = 0; j < allSheets.length; j++) {
    var normalizedSheetName = migrationNormalizeHeaderKey_5K_(allSheets[j].getName());
    if (normalizedAliases.indexOf(normalizedSheetName) !== -1) {
      return allSheets[j];
    }
  }

  return null;
}


function migrationReadSheetRowsWithSource_5K_(sheetName, limit) {
  var issues = [];
  var ss = migrationGetActiveSpreadsheet5K_();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return {
      success: false,
      headers: [],
      rows: [],
      row_count_total: 0,
      issues: [
        migrationIssue5K_(
          'error',
          '',
          sheetName,
          '',
          'SHEET_NOT_FOUND',
          'Sheet tidak ditemukan: ' + sheetName
        )
      ]
    };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return {
      success: true,
      headers: [],
      rows: [],
      row_count_total: 0,
      issues: [
        migrationIssue5K_(
          'warning',
          '',
          sheetName,
          '',
          'EMPTY_SHEET',
          'Sheet kosong.'
        )
      ]
    };
  }

  var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = migrationNormalizeHeaders5K_(headerValues);

  var duplicateHeaders = migrationFindDuplicateSimpleValues5K_(headers.filter(function(h) {
    return !!h;
  }));

  duplicateHeaders.forEach(function(h) {
    issues.push(migrationIssue5K_(
      'error',
      '',
      sheetName,
      1,
      'DUPLICATE_HEADER',
      'Header duplikat setelah normalisasi: ' + h
    ));
  });

  if (lastRow < 2) {
    return {
      success: true,
      headers: headers,
      rows: [],
      row_count_total: 0,
      issues: issues
    };
  }

  var dataRowCount = lastRow - 1;
  var readCount = limit ? Math.min(dataRowCount, limit) : dataRowCount;
  var values = sheet.getRange(2, 1, readCount, lastCol).getValues();

  var rows = [];

  values.forEach(function(rowValues, index) {
    var sourceRowNumber = index + 2;
    var raw = {};

    headers.forEach(function(header, colIndex) {
      if (!header) return;
      raw[header] = rowValues[colIndex];
    });

    if (migrationIsCompletelyBlankRow5K_(raw)) return;

    rows.push({
      source_sheet: sheetName,
      source_row_number: sourceRowNumber,
      raw: raw
    });
  });

  return {
    success: migrationHasNoBlockingIssues5K_(issues),
    headers: headers,
    rows: rows,
    row_count_total: dataRowCount,
    issues: issues
  };
}


function migrationNormalizeHeaders5K_(headers) {
  return headers.map(function(header) {
    return migrationNormalizeHeaderKey_5K_(header);
  });
}


function migrationNormalizeHeaderKey_5K_(value) {
  var text = String(value == null ? '' : value)
    .trim()
    .toLowerCase();

  text = text.replace(/\s+/g, '_');
  text = text.replace(/[^a-z0-9_]/g, '_');
  text = text.replace(/_+/g, '_');
  text = text.replace(/^_+|_+$/g, '');

  return text;
}


function migrationIsCompletelyBlankRow5K_(raw) {
  var keys = Object.keys(raw);

  for (var i = 0; i < keys.length; i++) {
    var value = raw[keys[i]];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return false;
    }
  }

  return true;
}


/************************************************************
 * 5K NORMALIZATION HELPERS
 ************************************************************/

function migrationNormalizeText_5K_(value) {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) {
    return migrationFormatDateTimeForSnapshot5K_(value);
  }

  return String(value).trim();
}


function migrationNormalizeNullableText_5K_(value) {
  var text = migrationNormalizeText_5K_(value);
  return text === '' ? null : text;
}


function migrationNormalizeEmail_5K_(value) {
  var text = migrationNormalizeNullableText_5K_(value);
  if (!text) return null;
  return text.toLowerCase();
}


function migrationNormalizePhone_5K_(value) {
  if (value === null || value === undefined || value === '') return null;

  var text = String(value).trim();

  if (value instanceof Date) {
    return null;
  }

  text = text.replace(/[^\d+]/g, '');

  if (!text) return null;

  if (text.indexOf('+62') === 0) {
    return '0' + text.substring(3);
  }

  if (text.indexOf('62') === 0 && text.length >= 10) {
    return '0' + text.substring(2);
  }

  if (text.charAt(0) !== '0' && text.length >= 9) {
    return '0' + text;
  }

  return text;
}


function migrationNormalizeDate_5K_(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, migrationGetTimezone5K_(), 'yyyy-MM-dd');
  }

  var text = String(value).trim();
  if (!text) return null;

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, migrationGetTimezone5K_(), 'yyyy-MM-dd');
  }

  return text;
}


function migrationNormalizeTimestamp_5K_(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, migrationGetTimezone5K_(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  var text = String(value).trim();
  if (!text) return null;

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, migrationGetTimezone5K_(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  return text;
}


function migrationNormalizeNumber_5K_(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    if (isNaN(value)) return 0;
    return value;
  }

  var text = String(value).trim();

  if (!text) return 0;

  text = text.replace(/rp/ig, '');
  text = text.replace(/\s+/g, '');

  if (text.indexOf(',') !== -1 && text.indexOf('.') !== -1) {
    text = text.replace(/\./g, '');
    text = text.replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }

  text = text.replace(/[^\d.-]/g, '');

  var number = Number(text);
  return isNaN(number) ? 0 : number;
}


function migrationNormalizeInteger_5K_(value) {
  var number = migrationNormalizeNumber_5K_(value);
  return Math.round(number);
}


function migrationNormalizeBoolean_5K_(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  var text = String(value).trim().toLowerCase();

  if (['true', 'yes', 'ya', 'y', 'aktif', 'active', '1'].indexOf(text) !== -1) {
    return true;
  }

  if (['false', 'no', 'tidak', 'n', 'nonaktif', 'inactive', '0'].indexOf(text) !== -1) {
    return false;
  }

  return null;
}


function migrationNormalizeActiveStatus_5K_(value, defaultValue) {
  var bool = migrationNormalizeBoolean_5K_(value);
  if (bool !== null) return bool;

  var text = migrationNormalizeText_5K_(value).toLowerCase();

  if (!text) return defaultValue;

  if (['deleted', 'hapus', 'inactive', 'nonaktif', 'cancelled', 'canceled'].indexOf(text) !== -1) {
    return false;
  }

  if (['active', 'aktif', 'enabled', 'available'].indexOf(text) !== -1) {
    return true;
  }

  return defaultValue;
}


function migrationNormalizeRole_5K_(value) {
  var text = migrationNormalizeNullableText_5K_(value);
  if (!text) return null;

  text = text.toLowerCase();

  if (text === 'owner') return 'owner';
  if (text === 'admin') return 'admin';
  if (text === 'doctor' || text === 'dokter') return 'doctor';
  if (text === 'staff') return 'staff';

  return text;
}


function migrationNormalizeGender_5K_(value) {
  var text = migrationNormalizeNullableText_5K_(value);
  if (!text) return null;

  var lower = text.toLowerCase();

  if (['l', 'lk', 'laki-laki', 'laki laki', 'male', 'm'].indexOf(lower) !== -1) {
    return 'male';
  }

  if (['p', 'pr', 'perempuan', 'female', 'f'].indexOf(lower) !== -1) {
    return 'female';
  }

  return lower;
}


/************************************************************
 * 5K RAW SNAPSHOT
 ************************************************************/

function migrationBuildRawSnapshot_5K_(raw) {
  var snapshot = {};
  var keys = Object.keys(raw);

  keys.forEach(function(key) {
    snapshot[key] = migrationNormalizeSnapshotValue5K_(raw[key]);
  });

  return JSON.stringify(snapshot);
}


function migrationNormalizeSnapshotValue5K_(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return migrationFormatDateTimeForSnapshot5K_(value);
  }

  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;

  var text = String(value).trim();
  return text === '' ? null : text;
}


function migrationFormatDateTimeForSnapshot5K_(date) {
  return Utilities.formatDate(date, migrationGetTimezone5K_(), "yyyy-MM-dd'T'HH:mm:ss");
}


/************************************************************
 * 5K SMALL UTILITIES
 ************************************************************/

function migrationPickFirstValue_5K_(raw, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var normalizedKey = migrationNormalizeHeaderKey_5K_(candidates[i]);

    if (raw.hasOwnProperty(normalizedKey)) {
      var value = raw[normalizedKey];

      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }
  }

  return null;
}


function migrationFindDuplicateValues5K_(objects, fieldName) {
  var map = {};
  var duplicates = [];

  objects.forEach(function(obj, index) {
    var value = obj[fieldName];

    if (!value) return;

    if (!map[value]) {
      map[value] = [];
    }

    map[value].push({
      index: index,
      source_sheet: obj.source_sheet,
      source_row_number: obj.source_row_number
    });
  });

  Object.keys(map).forEach(function(value) {
    if (map[value].length > 1) {
      duplicates.push({
        field: fieldName,
        value: value,
        occurrences: map[value]
      });
    }
  });

  return duplicates;
}


function migrationFindDuplicateSimpleValues5K_(values) {
  var seen = {};
  var duplicates = {};

  values.forEach(function(value) {
    if (!value) return;

    if (seen[value]) {
      duplicates[value] = true;
    } else {
      seen[value] = true;
    }
  });

  return Object.keys(duplicates);
}


function migrationIssue5K_(severity, targetTable, sourceSheet, sourceRowNumber, code, message, details) {
  return {
    severity: severity || 'warning',
    target_table: targetTable || '',
    source_sheet: sourceSheet || '',
    source_row_number: sourceRowNumber || '',
    code: code || '',
    message: message || '',
    details: details || null
  };
}


function migrationHasNoBlockingIssues5K_(issues) {
  for (var i = 0; i < issues.length; i++) {
    if (issues[i].severity === 'error') {
      return false;
    }
  }

  return true;
}


function migrationCountIssuesBySeverity5K_(issues, severity) {
  var count = 0;

  issues.forEach(function(issue) {
    if (issue.severity === severity) count++;
  });

  return count;
}


function migrationNowIso_5K_() {
  return Utilities.formatDate(new Date(), migrationGetTimezone5K_(), "yyyy-MM-dd'T'HH:mm:ss");
}


function migrationGetTimezone5K_() {
  try {
    return Session.getScriptTimeZone() || 'Asia/Jakarta';
  } catch (err) {
    return 'Asia/Jakarta';
  }
}

/************************************************************
 * 5K LOGGING WRAPPERS
 * Tambahan aman:
 * - READ ONLY
 * - hanya memanggil test 5K
 * - hanya menampilkan hasil ke Logs
 ************************************************************/

function testMigrationUtils5KNormalizeSamplesLog() {
  var result = testMigrationUtils5KNormalizeSamples();
  migrationLogJson5K_('testMigrationUtils5KNormalizeSamples', result);
  return result;
}


function testMigrationUtils5KSourceRowsPreviewLog() {
  var result = testMigrationUtils5KSourceRowsPreview();
  migrationLogJson5K_('testMigrationUtils5KSourceRowsPreview', result);
  return result;
}


function testMigrationUtils5KDryRunParentTablesLog() {
  var result = testMigrationUtils5KDryRunParentTables();
  migrationLogJson5K_('testMigrationUtils5KDryRunParentTables', result);
  return result;
}


function migrationLogJson5K_(label, result) {
  var text = JSON.stringify(result, null, 2);

  Logger.log('===== ' + label + ' =====');

  // Logger Apps Script kadang kurang nyaman untuk output panjang.
  // Jadi kita pecah agar tetap terbaca.
  var chunkSize = 8000;
  for (var i = 0; i < text.length; i += chunkSize) {
    Logger.log(text.substring(i, i + chunkSize));
  }
}