/* =========================================================
   SUPABASE BACKUP TO GOOGLE DRIVE
   Backup manual semua tabel Supabase ke folder Google Drive.

   CARA PAKAI:
   1. Buka script editor (script.google.com → project ini)
   2. Pilih fungsi "backupAllTablesToDrive" dari dropdown
   3. Klik "Run" → folder backup otomatis dibuat di Drive
   4. (Opsional) Set trigger harian via Triggers menu kalau mau
      backup otomatis tiap hari

   STRUKTUR HASIL:
   My Drive / HajarAswad_Backup / 2026-05-16_07-00-00 /
     Patients.json
     Appointments.json
     ... (18 file JSON, 1 per tabel)
     _summary.json  (ringkasan: timestamp, jumlah baris per tabel)
   ========================================================= */

const BACKUP_ROOT_FOLDER_NAME = 'HajarAswad_Backup';
const BACKUP_TABLE_ROW_LIMIT  = 50000; // safety cap per tabel

function backupAllTablesToDrive() {
  const startTime = new Date();
  const folderName = formatBackupFolderName_(startTime);
  const folder = getOrCreateBackupSubfolder_(folderName);

  const sheetNames = [
    REPO_TABLES.USERS,
    REPO_TABLES.PATIENTS,
    REPO_TABLES.APPOINTMENTS,
    REPO_TABLES.SERVICE_CATALOG,
    REPO_TABLES.TREATMENTS,
    REPO_TABLES.TREATMENT_ITEMS,
    REPO_TABLES.MEDICAL_RECORDS,
    REPO_TABLES.PATIENT_PHOTOS,
    REPO_TABLES.ORTHO_RECALL,
    REPO_TABLES.BILLINGS,
    REPO_TABLES.BILLING_ITEMS,
    REPO_TABLES.BILLING_ADJUSTMENTS,
    REPO_TABLES.BILLING_INSTALLMENTS,
    REPO_TABLES.PAYMENTS,
    REPO_TABLES.BILLING_FEEDBACKS,
    REPO_TABLES.EXPENSES,
    REPO_TABLES.DOCTOR_COMPENSATION_RULES,
    REPO_TABLES.CLINIC_INFO
  ];

  // Fetch semua tabel paralel (jauh lebih cepat dari sequential)
  const requests = sheetNames.map(function(sheetName) {
    return {
      table:   repoGetTargetTableForSheet_(sheetName),
      options: { limit: BACKUP_TABLE_ROW_LIMIT }
    };
  });

  const tableResults = supabaseSelectParallel_(requests);

  // Tulis setiap tabel sebagai file JSON terpisah
  const summary = {
    backed_up_at:    startTime.toISOString(),
    folder_name:     folderName,
    folder_id:       folder.getId(),
    folder_url:      folder.getUrl(),
    table_row_limit: BACKUP_TABLE_ROW_LIMIT,
    tables: []
  };

  sheetNames.forEach(function(sheetName, i) {
    const rows = tableResults[i] || [];
    const json = JSON.stringify(rows, null, 2);
    folder.createFile(sheetName + '.json', json, MimeType.PLAIN_TEXT);

    summary.tables.push({
      sheet_name:     sheetName,
      supabase_table: requests[i].table,
      row_count:      rows.length,
      hit_limit:      rows.length >= BACKUP_TABLE_ROW_LIMIT
    });
  });

  // File ringkasan
  folder.createFile('_summary.json', JSON.stringify(summary, null, 2), MimeType.PLAIN_TEXT);

  const durationSec = (new Date().getTime() - startTime.getTime()) / 1000;
  const totalRows = summary.tables.reduce(function(s, t) { return s + t.row_count; }, 0);

  Logger.log('✅ Backup selesai dalam ' + durationSec.toFixed(1) + ' detik');
  Logger.log('📁 Folder: ' + folder.getUrl());
  Logger.log('📊 Total ' + sheetNames.length + ' tabel, ' + totalRows + ' baris');

  return {
    success:       true,
    folder_url:    folder.getUrl(),
    folder_id:     folder.getId(),
    duration_sec:  durationSec,
    total_tables:  sheetNames.length,
    total_rows:    totalRows,
    summary:       summary
  };
}

/**
 * Format nama folder: YYYY-MM-DD_HH-MM-SS
 */
function formatBackupFolderName_(date) {
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(date, tz, 'yyyy-MM-dd_HH-mm-ss');
}

/**
 * Cari atau buat folder root HajarAswad_Backup di My Drive,
 * lalu buat subfolder dengan timestamp.
 */
function getOrCreateBackupSubfolder_(subfolderName) {
  const rootFolders = DriveApp.getFoldersByName(BACKUP_ROOT_FOLDER_NAME);
  const rootFolder = rootFolders.hasNext()
    ? rootFolders.next()
    : DriveApp.createFolder(BACKUP_ROOT_FOLDER_NAME);

  return rootFolder.createFolder(subfolderName);
}

/**
 * Helper: backup 1 tabel saja (untuk debugging atau partial backup).
 * Contoh: backupOneTable_('Patients')
 */
function backupOneTable_(sheetName) {
  const startTime = new Date();
  const folder = getOrCreateBackupSubfolder_(
    formatBackupFolderName_(startTime) + '_' + sheetName
  );

  const targetTable = repoGetTargetTableForSheet_(sheetName);
  const rows = supabaseSelect_(targetTable, null, { limit: BACKUP_TABLE_ROW_LIMIT });

  folder.createFile(sheetName + '.json', JSON.stringify(rows, null, 2), MimeType.PLAIN_TEXT);

  Logger.log('✅ ' + sheetName + ': ' + rows.length + ' baris → ' + folder.getUrl());

  return { success: true, row_count: rows.length, folder_url: folder.getUrl() };
}
