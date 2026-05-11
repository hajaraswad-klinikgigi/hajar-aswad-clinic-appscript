// =============================================
// SUPABASE MIGRATION SCRIPT
// Membaca data dari Spreadsheet → kirim ke Supabase
// Jalankan: runFullMigration()
// =============================================

var MIGRATION_SUPABASE_URL = getSupabaseStagingConfig_().url;
var MIGRATION_SUPABASE_KEY = getSupabaseStagingConfig_().serviceRoleKey;

// Mapping: nama sheet → nama tabel Supabase
var MIGRATION_SHEET_TABLE_MAP = [
  { sheet: 'Users',               table: 'app_users'            },
  { sheet: 'ServiceCatalog',      table: 'service_catalog'      },
  { sheet: 'Patients',            table: 'patients'             },
  { sheet: 'Appointments',        table: 'appointments'         },
  { sheet: 'Treatments',          table: 'treatments'           },
  { sheet: 'TreatmentItems',      table: 'treatment_items'      },
  { sheet: 'MedicalRecords',      table: 'medical_records'      },
  { sheet: 'PatientPhotos',       table: 'patient_photos'       },
  { sheet: 'OrthoRecall',         table: 'ortho_recalls'        },
  { sheet: 'Billings',            table: 'billings'             },
  { sheet: 'BillingItems',        table: 'billing_items'        },
  { sheet: 'BillingAdjustments',  table: 'billing_adjustments'  },
  { sheet: 'BillingInstallments', table: 'billing_installments' },
  { sheet: 'Payments',            table: 'payments'             },
  { sheet: 'BillingFeedbacks',    table: 'billing_feedbacks'    }
];

// =============================================
// FUNGSI UTAMA - jalankan ini
// =============================================
function runFullMigration() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var results = [];

  for (var i = 0; i < MIGRATION_SHEET_TABLE_MAP.length; i++) {
    var mapping = MIGRATION_SHEET_TABLE_MAP[i];
    var result = migrateSingleSheet_(ss, mapping.sheet, mapping.table);
    results.push(result);
    Logger.log('[' + mapping.table + '] ' + (result.success ? 'OK' : 'GAGAL') + 
               ' - ' + result.inserted + ' baris' + 
               (result.error ? ' | ERROR: ' + result.error : ''));
  }

  Logger.log('===== MIGRASI SELESAI =====');
  results.forEach(function(r) {
    Logger.log(r.table + ': ' + (r.success ? '✓ ' + r.inserted + ' baris' : '✗ ' + r.error));
  });

  return results;
}

// =============================================
// FUNGSI TEST - untuk cek satu sheet saja
// Contoh: testMigrateSheet('Patients')
// =============================================
function testMigrateSheet(sheetName) {
  var mapping = MIGRATION_SHEET_TABLE_MAP.filter(function(m) {
    return m.sheet === sheetName;
  })[0];

  if (!mapping) {
    Logger.log('Sheet tidak ditemukan: ' + sheetName);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = migrateSingleSheet_(ss, mapping.sheet, mapping.table);
  Logger.log(JSON.stringify(result, null, 2));
}

// =============================================
// INTERNAL: migrasi satu sheet
// =============================================
function migrateSingleSheet_(ss, sheetName, tableName) {
  var result = {
    sheet: sheetName,
    table: tableName,
    success: false,
    inserted: 0,
    skipped: 0,
    error: null
  };

  try {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      result.error = 'Sheet tidak ditemukan';
      return result;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      result.success = true;
      result.skipped = 1;
      result.error = 'Sheet kosong (tidak ada data)';
      return result;
    }

    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // Skip baris yang benar-benar kosong
      var isEmpty = row.every(function(cell) { return cell === '' || cell === null || cell === undefined; });
      if (isEmpty) continue;

      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j];
        var val = row[j];
        obj[key] = cleanValue_(val, key);
      }
      rows.push(obj);
    }

    if (rows.length === 0) {
      result.success = true;
      result.skipped = 1;
      result.error = 'Tidak ada baris valid';
      return result;
    }

    // Kirim ke Supabase dalam batch 500 baris
    var batchSize = 500;
    for (var start = 0; start < rows.length; start += batchSize) {
      var batch = rows.slice(start, start + batchSize);
      var insertResult = supabaseInsert_(tableName, batch);
      if (!insertResult.success) {
        result.error = insertResult.error;
        return result;
      }
      result.inserted += batch.length;
    }

    result.success = true;

  } catch (e) {
    result.error = e.message || String(e);
  }

  return result;
}

// =============================================
// INTERNAL: bersihkan nilai dari Spreadsheet
// =============================================
function cleanValue_(val, key) {
  if (val === '' || val === null || val === undefined) return null;

  if (val === true || val === false) return val;
  if (String(val).trim().toLowerCase() === 'true') return true;
  if (String(val).trim().toLowerCase() === 'false') return false;

  var lowerKey = key.toLowerCase();

  // Kolom time-only (jam:menit saja)
  var timeOnlyColumns = ['appointment_time'];
  if (timeOnlyColumns.indexOf(lowerKey) !== -1 && val instanceof Date) {
    var hh = String(val.getHours()).padStart(2, '0');
    var mm = String(val.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  if (val instanceof Date) {
    var y   = val.getFullYear();
    var mo  = String(val.getMonth() + 1).padStart(2, '0');
    var d   = String(val.getDate()).padStart(2, '0');
    var h   = String(val.getHours()).padStart(2, '0');
    var mi  = String(val.getMinutes()).padStart(2, '0');
    var s   = String(val.getSeconds()).padStart(2, '0');

    // Kolom timestamp → simpan sebagai local time tanpa konversi UTC
    var timestampColumns = [
      'created_at', 'updated_at', 'completed_at', 'deleted_at',
      'submitted_at', 'paid_at', 'invoice_sent_at', 'invoice_pdf_signature_at'
    ];
    if (timestampColumns.indexOf(lowerKey) !== -1) {
      return y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s;
    }

    // Kolom date-only
    return y + '-' + mo + '-' + d;
  }

  if (typeof val === 'number') return val;

  // String GMT+XXXX
  var strVal = String(val).trim();
  if (/GMT[+-]\d{4}/.test(strVal)) {
    try {
      var parsed = new Date(strVal);
      var y2  = parsed.getFullYear();
      var mo2 = String(parsed.getMonth() + 1).padStart(2, '0');
      var d2  = String(parsed.getDate()).padStart(2, '0');
      var h2  = String(parsed.getHours()).padStart(2, '0');
      var mi2 = String(parsed.getMinutes()).padStart(2, '0');
      var s2  = String(parsed.getSeconds()).padStart(2, '0');
      return y2 + '-' + mo2 + '-' + d2 + 'T' + h2 + ':' + mi2 + ':' + s2;
    } catch(e) {
      return strVal;
    }
  }

  return strVal;
}

// =============================================
// INTERNAL: kirim data ke Supabase
// =============================================
function supabaseInsert_(tableName, rows) {
  var url = MIGRATION_SUPABASE_URL + '/rest/v1/' + tableName;

  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': MIGRATION_SUPABASE_KEY,
      'Authorization': 'Bearer ' + MIGRATION_SUPABASE_KEY,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var statusCode = response.getResponseCode();

  if (statusCode === 201 || statusCode === 200) {
    return { success: true };
  } else {
    return {
      success: false,
      error: 'HTTP ' + statusCode + ': ' + response.getContentText()
    };
  }
}

function runTestSheet() {
  testMigrateSheet('PatientPhotos');
}

function runAllMigration() {
  runFullMigration();
}