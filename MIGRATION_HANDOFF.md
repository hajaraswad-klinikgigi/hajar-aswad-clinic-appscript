# Migration Handoff Document
## Klinik Hajar Aswad - Apps Script to Supabase Migration

**Tanggal handoff:** 11 Mei 2026
**Status:** Migrasi 80% selesai, siap untuk testing komprehensif & cutover

---

## Tentang Project Ini

Aplikasi manajemen klinik gigi berbasis Google Apps Script dengan UI HTML.
Saat ini sedang dalam proses migrasi backend dari Google Spreadsheet ke Supabase (PostgreSQL).

**Pemilik:** Fikri Mubarak
**Bahasa komunikasi:** Bahasa Indonesia
**Workflow:** Edit di Apps Script Editor → clasp pull → git push ke GitHub
**Deployment:** `/dev` (untuk testing), `/exec` (untuk staff produksi)
**Penting:** `/exec` hanya update saat Deploy → New Version secara manual. Ini memberi isolasi yang aman saat testing.

---

## Stack Teknologi

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Google Apps Script
- **Database lama:** Google Spreadsheet (sheet sebagai tabel)
- **Database baru:** Supabase (PostgreSQL)
- **Version control:** Git + GitHub (`hajaraswad-klinikgigi/hajar-aswad-clinic-appscript`)
- **Sync tool:** clasp (apps script CLI)

---

## Struktur Project

### File Konfigurasi Inti
- `RepositoryConfig.js` — Mapping nama sheet ↔ tabel Supabase, primary keys, backend mode flags
- `SupabaseConfig.js` — Konfigurasi koneksi Supabase (URL & service role key di Script Properties)
- `DataAccess.js` — Router CRUD untuk Spreadsheet vs Supabase
- `SupabaseClient.js` — Client REST API Supabase (select, insert, update, delete)

### File Service (Business Logic)
- `PatientService.js`, `AppointmentService.js`, `TreatmentService.js`
- `DashboardService.js`, `MasterDataService.js`
- `OrthoRecallService.js`, `PatientPhotoService.js`
- `FinanceBillingService.js`, `FinancePaymentService.js`, `FinanceInstallmentService.js`
- `FinanceInvoiceService.js`, `FinanceFeedbackService.js`, `FinanceReportService.js`
- `FinanceRawData.js`, `FinanceConfig.js`, `FinanceUtils.js`
- `Auth.js`

### File Repository (Data Layer)
- `PatientRepository.js`, `AppointmentRepository.js`, `TreatmentRepository.js`
- `OrthoRecallRepository.js`, `MasterDataRepository.js`, `FinanceRepository.js`

### File UI
- `index.html`, `dashboard.html`, `appointments.html`, `patients.html`
- `finance.html`, `recall.html`, `billing-feedback.html`, `scripts.html`
- `style*.html` — file styling

### File Migration & Test
- `SupabaseMigration.js` — Script migrasi data dari Spreadsheet ke Supabase
- `SupabaseTest.js` — Test functions untuk verifikasi Supabase

### File Entry Point
- `Code.js` — Entry point Apps Script (doGet, dll)

---

## Tabel Database (15 tabel)

| Sheet Name | Supabase Table | Primary Key |
|---|---|---|
| Users | app_users | user_id |
| Patients | patients | patient_id |
| Appointments | appointments | appointment_id |
| ServiceCatalog | service_catalog | service_id |
| Treatments | treatments | treatment_id |
| TreatmentItems | treatment_items | treatment_item_id |
| MedicalRecords | medical_records | record_id |
| PatientPhotos | patient_photos | photo_id |
| OrthoRecall | ortho_recalls | ortho_recall_id |
| Billings | billings | billing_id |
| BillingItems | billing_items | billing_item_id |
| BillingAdjustments | billing_adjustments | adjustment_id |
| BillingInstallments | billing_installments | installment_id |
| Payments | payments | payment_id |
| BillingFeedbacks | feedback_id | feedback_id |

Setiap tabel di Supabase juga punya kolom internal `id` (UUID) sebagai primary key teknis.

---

## Status Migrasi Saat Ini

### ✅ Tahap 1 — Pulihkan Aplikasi (Selesai)
- Backend default kembali ke Spreadsheet
- Production mutation freeze dimatikan
- Aplikasi berjalan normal untuk staff

### ✅ Tahap 2 — Migrasi Data ke Supabase (Selesai)
- Semua 15 tabel di Supabase dibuat ulang dengan struktur bersih
- Kolom artifact migrasi lama dihapus (source_row_number, raw_snapshot, dll)
- Urutan kolom Supabase = urutan kolom Spreadsheet
- Semua data berhasil dimigrasi:
  - 8 users
  - 326 patients
  - 341 appointments
  - 300 treatments
  - 573 treatment_items
  - 300 medical_records
  - 301 patient_photos
  - 161 ortho_recalls
  - 91 billings
  - 183 billing_items
  - 3 billing_adjustments
  - 87 payments
  - 100 service_catalog
  - 0 billing_installments (sheet kosong)
  - 0 billing_feedbacks (sheet kosong)

### ✅ Tahap 3 — Sederhanakan SupabaseClient & DataAccess (Selesai)
- `SupabaseClient.js` ditulis ulang dari ~700 → ~210 baris (clean REST API client)
- `DataAccess.js` ditulis ulang dari ~1500 → ~285 baris (clean dual-backend router)
- Semua service repository (`PatientRepository`, dll) tetap kompatibel — mereka pass `options` ke `dbFindAll_` dkk
- CRUD operations berfungsi sempurna di Supabase mode

### ✅ Tahap 4 — Cleanup File Lama (Selesai)
- 18 file dihapus:
  - MigrationStage5L.js sampai MigrationStage5V.js (11 file)
  - DatabaseMigrationAudit.js, MigrationDataParityAudit8E4D.js
  - MigrationUiMappingDiagnostic8E4B.js, MigrationUiMappingHelpers8E4C.js
  - RepositoryBridgeAudit.js, RepositoryReadOnlyAudit.js
  - MigrationUtils.js
- Pemanggilan `migration8E4C_enrich*` di `AppointmentService.js` & `DashboardService.js` dihapus
- Data sudah lengkap di Supabase, tidak butuh enrichment

### ✅ Tahap 5 — Cleanup RepositoryConfig (Selesai)
- `RepositoryConfig.js` dari ~800 → ~210 baris
- Flag-flag staging yang tidak dipakai dihapus
- Tetap dipertahankan: backend mode, production mutation freeze (untuk cutover)

### ⏳ Tahap 6 — Testing Komprehensif & Final Cutover (BELUM DILAKUKAN)
**Inilah yang harus dilanjutkan oleh Claude Code di VS Code.**

---

## Kondisi Flag di Apps Script Sekarang

```javascript
// RepositoryConfig.js
const REPO_DEFAULT_BACKEND_MODE = REPO_BACKEND_MODES.SPREADSHEET;
const REPO_PRODUCTION_MUTATION_FREEZE_ENABLED = false;
```

**Artinya:**
- Aplikasi saat ini pakai Spreadsheet (staff aman)
- Tidak ada freeze (semua write berfungsi normal)
- Supabase mode tersedia via `{ backend_mode: 'supabase' }` options

---

## Rencana Tahap 6 (yang harus dilakukan)

### Step 1 — Testing Komprehensif (Opsi E)

Sebelum cutover, perlu test semua fitur dengan Supabase mode. Strateginya:

1. **Sementara ubah** `REPO_DEFAULT_BACKEND_MODE = REPO_BACKEND_MODES.SUPABASE` di Apps Script
2. **Test via `/dev` URL** (jangan deploy ke `/exec`) — karena `/exec` hanya update saat manual deploy
3. **Checklist test komprehensif** (perlu dibuat detail):
   - Auth: login dengan berbagai role
   - Patients: list, search, tambah, edit, lihat detail, hapus
   - Appointments: list, tambah, edit, cancel, restore
   - Treatments: tambah, edit, complete appointment workflow
   - Medical Records: tambah, edit, lihat history
   - Patient Photos: upload, lihat, hapus
   - Ortho Recall: lihat list, update status, follow-up
   - Billings: tambah, edit, lihat detail invoice
   - Payments: tambah pembayaran, lihat history
   - Billing Adjustments: tambah diskon/penyesuaian
   - Billing Installments: tambah cicilan, bayar cicilan
   - Billing Feedbacks: lihat & submit feedback
   - Dashboard: KPI, charts, latest activities
   - Finance Reports: berbagai laporan
   - Edge cases: tanggal kosong, angka 0, karakter khusus

4. **Setelah semua test pass**, kembalikan ke Spreadsheet mode

### Step 2 — Persiapan Cutover

1. Pilih waktu cutover (staff offline, misalnya weekend)
2. Backup terakhir Spreadsheet (sebagai safety net)
3. Jalankan `runFullMigration()` di `SupabaseMigration.js` untuk sync data terbaru dari Spreadsheet ke Supabase
4. Verifikasi jumlah row di Supabase = jumlah row di Spreadsheet

### Step 3 — Eksekusi Cutover

1. Ubah `REPO_DEFAULT_BACKEND_MODE` ke `SUPABASE` di Apps Script
2. Save
3. Deploy → New Version (agar `/exec` ikut update)
4. Test cepat di `/exec` (login, lihat dashboard, tambah pasien dummy)

### Step 4 — Monitoring Post-Cutover

1. Pantau aplikasi 1-2 hari pertama secara intensif
2. Siapkan rollback plan: kalau ada masalah serius, ubah balik flag ke SPREADSHEET dan re-deploy

### Step 5 — Cleanup Setelah Stabil

Setelah Supabase stabil 1-2 minggu, bisa hapus:
- `SupabaseMigration.js` (sudah tidak perlu)
- Spreadsheet bisa dijadikan backup archive saja
- File `SupabaseTest.js` (test functions)

---

## Catatan Penting tentang Workflow

### Backend Mode
- Backend mode di-default oleh `REPO_DEFAULT_BACKEND_MODE` di `RepositoryConfig.js`
- Bisa di-override per-call dengan `{ backend_mode: 'supabase' }` di options
- Semua function `dbFindAll_`, `dbFindById_`, `dbInsert_`, `dbUpdateById_`, `dbDeleteById_` mendukung options

### Data Type Handling
Saat migrasi, ada beberapa tipe data yang butuh handling khusus (sudah dihandle di `SupabaseMigration.js`):

1. **Timestamp** (created_at, updated_at): Jangan convert ke UTC, simpan as-is sebagai local time
2. **Time-only** (appointment_time): Format `HH:mm`, bukan Date object dari Sheets `1899-12-30`
3. **Date string GMT+XXXX**: Convert ke ISO local time
4. **Boolean dari string 'true'/'false'**: Convert ke boolean asli

### Naming Conflict
Pernah ada konflik fungsi `supabaseInsert_` antara `SupabaseClient.js` dan `SupabaseMigration.js`. Sudah diresolve dengan rename ke `migrationSupabaseInsert_` di file migration.

---

## Commit History (Tahap Migrasi)

```
9680a9d - refactor: simplify RepositoryConfig.js with clean dual-backend setup
83876c6 - chore: remove orphaned migration and audit files from local repo
f8ff53d - refactor: remove migration helper files and clean enrichment calls
856caf6 - fix: resolve supabaseInsert_ naming conflict and verify CRUD operations
5588ee6 - feat: rewrite SupabaseClient and DataAccess with clean dual-backend support
ec27337 - feat: add clean Supabase migration script
b02bb98 - fix: restore spreadsheet backend and disable production freeze
```

---

## Modul Berikutnya: Finance

Setelah migrasi selesai, pemilik berencana mengembangkan modul finance lebih lanjut. File-file finance yang ada saat ini:

- `FinanceBillingService.js` — Pengelolaan billing/tagihan
- `FinancePaymentService.js` — Pengelolaan pembayaran
- `FinanceInstallmentService.js` — Pengelolaan cicilan
- `FinanceInvoiceService.js` — Generate invoice PDF
- `FinanceFeedbackService.js` — Feedback pasien setelah billing
- `FinanceReportService.js` — Laporan keuangan
- `FinanceRawData.js`, `FinanceUtils.js`, `FinanceConfig.js`

---

## Hal yang Perlu Diingat Claude Code

1. **Komunikasi dalam Bahasa Indonesia**
2. **Selalu konfirmasi sebelum melakukan perubahan besar** — pemilik prefer pelan tapi pasti
3. **Test di /dev dulu sebelum deploy ke /exec** — staff aktif pakai produksi
4. **Push ke GitHub setelah setiap step berhasil** — sebagai checkpoint
5. **Workflow: edit di Apps Script → clasp pull → git add → git commit → git push**
6. **Jika ada konflik fungsi, cari dengan `grep` atau VS Code search dulu**
7. **Pemilik tidak terlalu teknis** — jelaskan dengan sederhana, beri context kenapa, bukan hanya apa
