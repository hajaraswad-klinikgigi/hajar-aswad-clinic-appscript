# Phase 2C — Role × Endpoint Matrix

**Status**: FINAL 2026-05-18 — sudah dikonfirmasi pemilik via diskusi 16 pertanyaan.
**Scope**: Sub-tahap C1 dari roadmap Phase 2B (granular role enforcement).
**Next**: C2 — Apply `requireRole()` di Settings + Master Data + Dashboard.

## Konvensi

- **Role**: `owner`, `super_admin`, `admin_appointment`, `admin_finance`, `doctor`
- **owner & super_admin** = fully privileged, otomatis lulus semua check via `userIsFullyPrivileged_()` di Auth.js. Tidak perlu di-list explicit di matrix per endpoint.
- **PUBLIC** = endpoint tanpa auth (login flow, feedback token, totp setup token).
- **AUTH-ONLY** = endpoint butuh login tapi tidak butuh role tertentu (logout).
- Kolom matrix: `✅` = boleh, `❌` = tolak.

## Ringkasan Role × Modul (high-level)

| Modul / Aksi | Owner / Super Admin | Admin Appointment | Admin Finance | Doctor |
|---|:---:|:---:|:---:|:---:|
| **Dashboard** | ✅ Full | ❌ | ❌ | ❌ |
| **Pasien** (CRUD demografis) | ✅ | ✅ Full | 👁️ Read | ❌ |
| **Foto Klinis** | ✅ | ✅ Upload+Edit+Hapus | ❌ | 👁️ Read-only |
| **Catatan Medis** (anamnesis, alergi) | ✅ | ✅ Isi awal + Edit | ❌ | ✅ Lengkapi + Edit |
| **Appointment** (CRUD jadwal) | ✅ | ✅ Full | ❌ | 👁️ Read list hari ini |
| **Treatment** (input tindakan) | ✅ | ❌ | 👁️ Read riwayat | ✅ Full input+save |
| **Treatment — HARGA / RUPIAH** | ✅ | — | ✅ Lihat | ❌ Hidden total |
| **Ortho Recall** | ✅ | ✅ Full | ❌ | ❌ |
| **Billing & Payment** | ✅ | ❌ | ✅ Full | ❌ |
| **Expense** | ✅ | ❌ | ✅ Full | ❌ |
| **Konfirmasi Fee Dokter → Expense** | ✅ | ❌ | ✅ | ❌ |
| **Aturan Fee Dokter** (master) | ✅ Edit | ❌ | 👁️ Read-only | ❌ |
| **Service Catalog & Tarif** | ✅ Edit | 👁️ Read-only | 👁️ Read-only | — (via treatment) |
| **Owner Report** | ✅ Full | ❌ | ✅ Tanpa Profit | ❌ |
| **Settings → Pengguna** | ✅ Full | ❌ | ❌ | ❌ |
| **Landing page setelah login** | Dashboard | Appointment | Billing | Appointment |

## 1. Login & Session (Auth.js, scripts.html)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `loginWithTotp` | PUBLIC | PUBLIC | PUBLIC | Tidak butuh auth |
| `logoutAuthSession` | AUTH-ONLY | AUTH-ONLY | AUTH-ONLY | Semua user yg login |

## 2. Settings (SettingsService.js, settings.html)

**Aturan default: hanya owner/super_admin.**

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getAllSettingsData` | ❌ | ❌ | ❌ | owner-only |
| `getClinicInfo` | ❌ | ❌ | ❌ | owner-only |
| `updateClinicInfo` | ❌ | ❌ | ❌ | owner-only |
| `getServiceCatalogList` | ✅ | ✅ | ❌ | Read-only untuk admin_appt (lookup appointment) & admin_fin (verifikasi billing) |
| `addServiceCatalog` | ❌ | ❌ | ❌ | owner-only |
| `updateServiceCatalog` | ❌ | ❌ | ❌ | owner-only |
| `deleteServiceCatalog` | ❌ | ❌ | ❌ | owner-only |
| `getUserList` | ❌ | ❌ | ❌ | owner-only |
| `addUser` | ❌ | ❌ | ❌ | owner-only |
| `updateUser` | ❌ | ❌ | ❌ | owner-only |
| `deleteUser` | ❌ | ❌ | ❌ | owner-only |
| `generateTotpForUser` | ❌ | ❌ | ❌ | owner-only (security-sensitive) |
| `sendTotpSetupEmail` | ❌ | ❌ | ❌ | owner-only |
| `resetTotpForUser` | ❌ | ❌ | ❌ | owner-only |
| `disableTotpForUser` | ❌ | ❌ | ❌ | owner-only |
| `getTotpSetupByToken` | PUBLIC | PUBLIC | PUBLIC | Token-based, no auth |
| `markTotpSetupTokenUsed` | PUBLIC | PUBLIC | PUBLIC | Token-based, no auth |

## 3. Master Data (MasterDataService.js, DoctorCompensationService.js)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getActiveServices` | ✅ | ✅ | ✅ | Internal helper, dipanggil dari banyak modul |
| `getActiveOrthoInstallServices` | ❌ | ❌ | ✅ | Doctor pakai saat input treatment ortho |
| `getActiveOrthoControlServices` | ❌ | ❌ | ✅ | Doctor pakai saat input treatment ortho |
| `getServiceById` | ✅ | ✅ | ✅ | Internal lookup |
| `getServiceOrthoFlags` | ❌ | ❌ | ✅ | Doctor only |
| `getActiveDoctors` | ✅ | ✅ | ✅ | Lookup |
| `getDoctorCompensationRules` | ❌ | ✅ | ❌ | admin_fin read-only |
| `getDoctorCompensationRule` | ❌ | ✅ | ❌ | admin_fin read-only |
| `addDoctorCompensationRule` | ❌ | ❌ | ❌ | owner-only |
| `updateDoctorCompensationRule` | ❌ | ❌ | ❌ | owner-only |
| `getDoctorMaterialDeductions` | ❌ | ✅ | ❌ | admin_fin read-only |
| `addDoctorMaterialDeduction` | ❌ | ❌ | ❌ | owner-only |
| `updateDoctorMaterialDeduction` | ❌ | ❌ | ❌ | owner-only |
| `deleteDoctorMaterialDeduction` | ❌ | ❌ | ❌ | owner-only |
| `calculateDoctorFeeDraft` | ❌ | ✅ | ❌ | admin_fin: hitung draft fee |
| `confirmDoctorFeeToExpenses` | ❌ | ✅ | ❌ | admin_fin: konfirmasi fee → expense |

## 4. Dashboard (DashboardService.js, dashboard.html)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getDashboardOwnerSummary` | ❌ | ❌ | ❌ | **Owner/Super Admin ONLY** |

## 5. Patients (PatientService.js, PatientPhotoService.js)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getPatients` | ✅ | ✅ | ❌ | List pasien — doctor tidak browse |
| `getPatientById` | ✅ | ✅ | ✅ | Doctor: hanya untuk pasien yang sedang ditreat |
| `getPatientDetailBundle` | ✅ | ✅ | ✅ | Frontend filter section per role (admin_fin hide klinis, doctor hide finance) |
| `getPatientDetailPrimary` | ✅ | ✅ | ✅ | Frontend filter |
| `getPatientDetailSecondary` | ✅ | ✅ | ✅ | Frontend filter |
| `getMedicalRecordsByPatientId` | ✅ | ❌ | ✅ | admin_appt isi awal + edit, doctor lengkapi + edit |
| `getTreatmentsByPatientId` | ❌ | ✅ | ✅ | admin_fin read riwayat (billing context); admin_appt strict ❌ (scope tidak include treatment) |
| `searchPatientsForAppointment` | ✅ | ❌ | ❌ | admin_appt only |
| `createPatient` | ✅ | ❌ | ❌ | admin_appt only |
| `updatePatient` | ✅ | ❌ | ❌ | admin_appt only |
| `deactivatePatient` | ✅ | ❌ | ❌ | admin_appt only |
| `createPatientPhotoUpload` | ✅ | ❌ | ❌ | admin_appt only (upload+edit+hapus) |
| `deletePatientPhoto` | ✅ | ❌ | ❌ | admin_appt only |
| `getPatientPhotosByPatientId` | ✅ | ❌ | ✅ | Doctor read-only, admin_fin ❌ |

## 6. Appointments (AppointmentService.js, appointments.html)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getAppointments` | ✅ | ❌ | ✅ | Doctor lihat list hari ini |
| `getAppointmentById` | ✅ | ❌ | ✅ | Doctor: untuk start treatment |
| `autoUpdateOverdueScheduledAppointments` | ✅ | ❌ | ❌ | admin_appt only |
| `createAppointment` | ✅ | ❌ | ❌ | admin_appt only |
| `updateAppointment` | ✅ | ❌ | ❌ | admin_appt only |
| `cancelAppointment` | ✅ | ❌ | ❌ | admin_appt only |
| `restoreAppointment` | ✅ | ❌ | ❌ | admin_appt only |
| `hasOpenAppointmentForPatient` | ✅ | ❌ | ✅ | Doctor cek sebelum start treatment |
| `checkPatientOpenAppointment` | ✅ | ❌ | ✅ | sama |

## 7. Treatments (TreatmentService.js)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getTreatmentInitDataForUi` | ❌ | ❌ | ✅ | Doctor only |
| `getTreatmentInitDataPreview` | ❌ | ❌ | ✅ | Doctor only |
| `getTreatmentByAppointmentId` | ❌ | ✅ | ✅ | admin_fin read riwayat |
| `createTreatment` | ❌ | ❌ | ✅ | Doctor only — trigger auto-generate billing |

**⚠️ UI GUARD UNTUK DOCTOR — hide semua angka rupiah:**
- Modal "Tambah Tindakan" → hide kolom **harga satuan**
- Review akhir treatment → hide total harga
- Riwayat treatment lama pasien → hide kolom harga/total
- Doctor tidak boleh lihat angka rupiah di seluruh modul Treatment

## 8. Finance — Billing/Payment/Invoice (Finance*.js)

**Aturan default: admin_finance only (sebagian sudah pakai `requireFinancePermission_`).**

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getFinancePageBootstrap` | ❌ | ✅ | ❌ | |
| `getFinanceSummary` | ❌ | ✅ | ❌ | |
| `getBillingList` | ❌ | ✅ | ❌ | |
| `getBillingById` | ❌ | ✅ | ❌ | |
| `addBillingDiscount` | ❌ | ✅ | ❌ | |
| `recordBillingPayment` | ❌ | ✅ | ❌ | |
| `getReceivablesReport` | ❌ | ✅ | ❌ | |
| `getBillingInvoiceDeliveryInfo` | ❌ | ✅ | ❌ | |
| `generateBillingInvoicePdf` | ❌ | ✅ | ❌ | |
| `sendBillingInvoiceEmail` | ❌ | ✅ | ❌ | |
| `getBillingInstallmentPlan` | ❌ | ✅ | ❌ | |
| `clearBillingInstallmentPlan` | ❌ | ✅ | ❌ | |
| `getBillingInstallmentChangePolicy` | ❌ | ✅ | ❌ | |
| `createOrReplaceBillingInstallmentPlan` | ❌ | ✅ | ❌ | |
| `generateBillingFromTreatment` | ❌ | ✅ | ✅ | Auto-triggered saat doctor save treatment + manual oleh admin_fin |

## 9. Expense (ExpenseService.js)

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getExpensesByDate` | ❌ | ✅ | ❌ | |
| `getExpensesByDateRange` | ❌ | ✅ | ❌ | admin_fin boleh (untuk Owner Report tanpa profit) |
| `addExpense` | ❌ | ✅ | ❌ | |
| `updateExpense` | ❌ | ✅ | ❌ | |
| `deleteExpense` | ❌ | ❌ | ❌ | owner-only (sudah `requireFinanceOwnerPermission_`) |
| `getExpenseSummary` | ❌ | ✅ | ❌ | admin_fin boleh |

## 10. Owner Report (FinanceReportService.js, owner-report.html)

**Aturan: owner/super_admin full. admin_finance boleh, TAPI profit di-hide.**

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getOwnerDailyReport` | ❌ | ✅ | ❌ | Backend/Frontend: hide `profit` field untuk admin_fin |
| `getOwnerMonthlyReport` | ❌ | ✅ | ❌ | sama |
| `getOwnerYearlyReport` | ❌ | ✅ | ❌ | sama |
| `getOwnerReportBootstrap` | ❌ | ✅ | ❌ | sama |

**⚠️ UI GUARD UNTUK ADMIN_FINANCE di Owner Report:**
- Hide field/kolom `profit` & `margin` di response & rendering
- admin_finance lihat omzet + expense saja

## 11. Ortho Recall (OrthoRecallService.js, recall.html)

**Aturan: admin_appointment only. Doctor TIDAK akses sama sekali.**

| Endpoint | admin_appt | admin_fin | doctor | Catatan |
|---|:---:|:---:|:---:|---|
| `getOrthoRecallList` | ✅ | ❌ | ❌ | admin_appt: tracking program |
| `getOrthoRecallById` | ✅ | ❌ | ❌ | |
| `getPatientOrthoRecallSummary` | ✅ | ❌ | ❌ | |
| `completeOrthoRecallProgram` | ✅ | ❌ | ❌ | admin_appt: tutup program |
| `cancelOrthoRecallProgram` | ✅ | ❌ | ❌ | admin_appt: cancel program |
| `saveOrthoRecallContact` | ✅ | ❌ | ❌ | admin_appt: log kontak |

## 12. Public/Token-based Endpoints

Tidak butuh role check:

- `getBillingFeedbackPageData(token)` — billing-feedback.html (pasien isi feedback)
- `submitBillingFeedback(payload)` — billing-feedback.html
- `getTotpSetupByToken(token)` — totp-setup.html (one-time setup link)
- `markTotpSetupTokenUsed(token)` — totp-setup.html

## Pattern Enforcement (decision Q9)

**Hybrid:**
- **Endpoint baru** → pakai `requireRole(context, [...])` dari Auth.js
- **Endpoint Finance existing** → tetap `requireFinancePermission_` / `requireFinanceOwnerPermission_` (sudah teruji). Verifikasi logika match dengan matrix di atas.

## Landing Page Per Role (decision Q16)

Setelah login + TOTP sukses, redirect berdasarkan role utama (kalau role rangkap, pakai priority order berikut):

1. `owner` / `super_admin` → **Dashboard**
2. `admin_finance` → **Finance (billing list)**
3. `admin_appointment` → **Appointment list hari ini**
4. `doctor` → **Appointment list hari ini**

Priority: kalau user punya rangkap `[admin_appointment, admin_finance]`, redirect ke **Finance** (kasir biasanya prioritas finance saat login). Owner > admin_fin > admin_appt > doctor.

## Catatan UI Guard Per Role (untuk C6)

### Sidebar menu visibility

| Menu | Owner/Super | Admin Appt | Admin Fin | Doctor |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ❌ | ❌ | ❌ |
| Pasien | ✅ | ✅ | ✅ | ❌ |
| Appointment | ✅ | ✅ | ❌ | ✅ |
| Treatment | ✅ | ❌ | ❌ | (via Appointment) |
| Ortho Recall | ✅ | ✅ | ❌ | ❌ |
| Finance | ✅ | ❌ | ✅ | ❌ |
| Owner Report | ✅ | ❌ | ✅ (tanpa profit) | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ |

### Conditional buttons / actions

- **Konfirmasi Fee Dokter** → tampil untuk owner, super_admin, admin_finance saja
- **Tombol delete expense** → tampil untuk owner, super_admin saja
- **Tombol upload foto klinis** → tampil untuk owner, super_admin, admin_appointment saja
- **Tombol delete foto klinis** → tampil untuk owner, super_admin, admin_appointment saja
- **Tombol Add/Edit Service Catalog** → tampil untuk owner, super_admin saja
- **Tombol Add/Edit Aturan Fee Dokter** → tampil untuk owner, super_admin saja

### Conditional data hiding

- **Profit di Owner Report** → hide untuk admin_finance
- **Harga/total/rupiah di Treatment screen** → hide untuk doctor (modal Tambah Tindakan, review akhir, total, riwayat treatment lama)
- **Section finance di Patient Detail** → hide untuk doctor & admin_appointment
- **Section klinis (foto+catatan medis) di Patient Detail** → hide untuk admin_finance

## Catatan akun shared

(Sudah disepakati sebelumnya — [[role-concept-2026-05-16]])

Akun shared (dipakai banyak orang) WAJIB pakai role rangkap admin biasa (`admin_appointment + admin_finance`). **TIDAK BOLEH** diberi `super_admin` atau `owner`. Saat staff per-individu sudah pakai akun masing-masing (akhir Phase 2B), akun shared bisa dipecah.

## Role Rangkap (many-to-many)

1 user bisa punya banyak role. Permission = **UNION** dari semua role yang dia punya. Contoh:
- Staff X: `[admin_appointment, admin_finance]` → bisa kelola pasien + appointment + ortho recall + billing + payment + expense + Service Catalog read-only + Aturan Fee Dokter read-only + Owner Report tanpa profit
- Staff Y: `[doctor, admin_appointment]` → bisa input treatment + lihat appointment hari ini + (juga) CRUD pasien + appointment + ortho recall

Implementasi: `userHasAnyRole_(user, [...])` di `requireRole()`.

---

**Status**: Matrix FINAL 2026-05-18. Siap untuk C2-C6.
