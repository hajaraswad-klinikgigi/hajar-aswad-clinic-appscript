# Rencana — Multi-Klinik + Google Sign-In + Audit Log

Dibuat: 2026-05-16
Status: Phase 1 selesai, Phase 1.5 selesai, Phase 2a selesai (role rangkap foundation), Phase 2b sedang dikerjakan (Google Sign-In)

## ⚠️ REVISI 2026-05-17 — Auth provider diubah dari Clerk → Google Sign-In

Setelah evaluasi ulang, **Clerk DIBATALKAN** sebagai auth provider. Alasan:
- Apps Script di-host di iframe Google (`script.google.com/macros/...`) — banyak friksi dgn widget/redirect Clerk
- Tidak bisa pakai npm/SDK Clerk — harus pakai REST API yang lebih rumit
- Aplikasi sudah di Google ecosystem (Apps Script + Supabase + Google Drive backup) — lebih natural pakai Google Sign-In
- Setiap staff klinik sudah punya akun Gmail pribadi — tidak perlu daftar ke provider eksternal

**Ganti dengan**: Google Identity Services (GIS) client-side + verify JWT id_token di backend via tokeninfo endpoint. Gratis tanpa batas user. Native Apps Script.

Section PHASE 2 di bawah masih berisi konten Clerk sebagai **arsip historis**. Implementasi sebenarnya = Phase 2a (role rangkap foundation, sudah selesai & commit `c6e3862`) + Phase 2b (Google Sign-In, sedang dikerjakan). Lihat memory `multi_clinic_phase2a_progress_2026_05_17.md` untuk status terkini.

## Konteks & Tujuan

Klinik Hajar Aswad pakai Apps Script + Supabase. Saat ini admin share **1 akun**, jadi audit log tidak meaningful — tidak jelas siapa yang ubah apa. Multi-klinik akan datang di masa depan, jadi fondasi harus disiapkan sekarang supaya tidak refactor besar nanti.

**Tujuan utama:**
- Setiap user punya akun email sendiri (owner, admin, dokter) → audit log akurat
- Audit log "siapa-ubah-apa" tampil di dashboard
- Fondasi multi-klinik (data sudah ter-scope per klinik) — zero refactor saat klinik kedua datang
- Role check di semua function (sementara `['*']` = lulus untuk siapa saja) — siap di-tighten saat butuh
- ID klinik default: `KLINIK-1` (netral, extensible untuk cabang/brand berikut)

## Keputusan Arsitektur (sudah aligned)

| Aspek | Keputusan |
|---|---|
| Multi-klinik | Single Supabase + kolom `clinic_id` di semua tabel utama (default `'KLINIK-1'`) |
| Auth | **Google Sign-In (GIS)** — id_token JWT di-verify via Google tokeninfo endpoint. Lookup email di `app_users.email` (UNIQUE). ~~Clerk dibatalkan, lihat revisi di atas.~~ |
| Sign-up | Owner add user manual via Settings → input email Gmail staff. Tidak open sign-up. |
| Audit visibility | Owner & Super Admin lihat semua; Admin lihat scope modulnya; Dokter tidak akses |
| Migration | Big bang ke `/dev`, deploy ke `/exec` setelah lulus testing |
| Scope | 4 fase bertahap (1, 1.5, 2, 3) |
| User aktif | Semua role login: owner, super admin, admin (appointment/finance), dokter |
| Role rangkap | **Banyak role per user** — pakai tabel relasi `clinic_users_roles` (many-to-many) |
| Master dokter | `doctor_compensation_rules` tetap sebagai master fee; `clinic_users.role=doctor` untuk login. Link via `doctor_name` (atau optional `clinic_user_id`) |

---

## Konsep Role (revised 2026-05-16)

Sistem punya **5 role** yang bisa dirangkap dalam 1 akun:

| Role | Identitas | Akses utama |
|---|---|---|
| **Owner** | Pemilik klinik | Full access ke semua modul (identik Super Admin, beda hanya label) |
| **Super Admin** | Manajer dipercaya | Full access ke semua modul (identik Owner). Bisa diberi ke 1+ staff yg dipercaya. |
| **Admin Appointment** | Resepsionis / front-office | Pasien, Appointment, view ke modul lain |
| **Admin Finance** | Staff keuangan | Finance (billing, payment, expense), Settings layanan, view Owner Report |
| **Doctor** | Dokter | Treatment (full pada pasien dia), view appointment hari ini, view data pasien yg dia treat (read-only), view fee dia sendiri di Owner Report |

**Catatan penting:**
- Owner ≡ Super Admin dari sisi permission. Audit log tetap bisa bedakan (`role` di setiap log entry).
- 1 user boleh punya 2+ role (mis. seorang dokter merangkap admin appointment) → cek pakai `userHasAnyRole_(user, [r1, r2, ...])`.
- Dokter login lewat akun mereka sendiri; modul Treatment auto-filter ke pasien yang dia treat (via `treatments.doctor_name === user.full_name`).

### Role × Modul Matrix (target Phase 2+)

| Modul | Owner | Super Admin | Admin Appt | Admin Finance | Doctor |
|---|---|---|---|---|---|
| Dashboard | full | full | full | full | summary (terbatas) |
| Pasien | full | full | full | read | read (yg dia treat) |
| Appointment | full | full | full | read | read (hari ini, yg dia treat) |
| Treatment | full | full | full | read | full (yg dia treat) |
| Finance / Billing / Payment | full | full | none | full | none |
| Expense | full | full | none | full | none |
| Owner Report | full | full | none | read | self-only (fee dia) |
| Settings Layanan | full | full | none | full | none |
| Settings Fee Dokter | full | full | none | none | none |
| Settings Pengguna | full | full | none | none | none |
| Audit Log | full | full | scope modul | scope modul | none |

Matrix di atas adalah **target Phase 2+**. Sekarang (Phase 1) semua function pakai `requireRole(['*'])` (lulus untuk siapa saja yang login) — matrix di-tighten saat Phase 2/3.

---

## PHASE 1 — Multi-Klinik Foundation

**Tujuan**: tambah `clinic_id` di semua tabel utama, tanpa ada perubahan UX.

### Data Model

**Tabel baru `clinics`:**
```sql
CREATE TABLE clinics (
  clinic_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO clinics (clinic_id, name) VALUES
  ('HAJAR-ASWAD', 'Klinik Gigi Hajar Aswad');
```

**Tambah `clinic_id` ke tabel utama** (default `'HAJAR-ASWAD'` untuk data existing):
- `patients`
- `appointments`
- `treatments`
- `treatment_items`
- `billings`
- `billing_items`
- `payments`
- `expenses`
- `service_catalog`
- `users`
- `doctor_compensation_rules`
- `doctor_material_deductions`
- `ortho_recall_programs`
- semua tabel mutasi lain

Pattern:
```sql
ALTER TABLE <tabel> ADD COLUMN clinic_id TEXT NOT NULL DEFAULT 'HAJAR-ASWAD'
  REFERENCES clinics(clinic_id);
CREATE INDEX idx_<tabel>_clinic_id ON <tabel>(clinic_id);
```

### Backend Changes

**Helper baru** di `RepositoryConfig.js` atau file baru `ClinicScope.js`:
```js
function getCurrentClinicId_(payload) {
  // Sekarang: hardcode 'HAJAR-ASWAD'
  // Phase 2 (Clerk): baca dari auth context user.clinic_id
  return 'HAJAR-ASWAD';
}
```

**Update semua `dbFindAll_`, `dbFindWhere_`, `dbFindById_`, `dbInsert_` di `DataAccess.js`**:
- SELECT/UPDATE/DELETE: auto-append `WHERE clinic_id = ?`
- INSERT: auto-inject `clinic_id` dari `getCurrentClinicId_()`

Helper tambahan: `scopeByClinic_(query, clinicId)` untuk query custom.

### Migration

File baru: `migrations/003_add_clinic_id.sql`
- Transaction BEGIN/COMMIT
- Bikin tabel `clinics` + seed
- ALTER TABLE setiap tabel utama: add `clinic_id` column + FK + index
- Update existing rows: semua kena default `'HAJAR-ASWAD'`

### Testing checklist Phase 1
- [ ] List patients tetap tampil
- [ ] List appointments tetap tampil
- [ ] List billings tetap tampil
- [ ] Create/update/delete masih jalan
- [ ] Settings page (CRUD layanan, dokter, user) tetap jalan
- [ ] Owner report tetap tampil data
- [ ] **Tidak ada UI change** — user tidak harus belajar apa-apa baru

---

## PHASE 1.5 — Konsolidasi Master Dokter (revised 2026-05-16)

**Tujuan**: pisahkan **data master dokter** (untuk treatment + fee) dari **identitas login**. Konsisten dengan separation of concerns: `clinic_users` = siapa yang login (semua role, termasuk dokter), `doctor_compensation_rules` = master data fee dokter yang independen dari status login.

**Catatan revisi**: Plan asli berasumsi "dokter tidak login". Owner sudah revise — dokter LOGIN dengan role `doctor` (lihat section Konsep Role). Jadi alasan split berubah: bukan supaya users bersih dari dokter, tapi supaya **data treatment terpisah dari data autentikasi**. Manfaat:
- Dokter freelance / kontrak yang belum punya akun login tetap bisa ditambah di `doctor_compensation_rules`
- Owner ganti fee tanpa harus sentuh akun login dokter
- Migrasi dokter pindah klinik / berhenti / cuti tidak putuskan referensi historical treatment

### Kondisi saat ini

- Tabel `users` punya row dengan `role = 'dokter'` — dipakai sebagai master daftar dokter
- `Treatments.doctor_user_id` FK ke `users.user_id` — identifier dokter di treatment
- `Treatments.doctor_name` juga ada (display name, denormalized) — sudah ter-isi
- `getActiveDoctors()` di `TreatmentService.js` query dari `users` (filter `role === 'dokter'`)
- `findActiveDoctorById(userId)` lookup ke `users`
- Modal Treatment di `appointments.html` pakai `<select id="treatment_doctor_user_id">` dari `getActiveDoctors()`
- Modal lain (finance, dll) panggil `getActiveDoctors` juga

### Migration

**File baru**: `migrations/003b_split_doctors_from_users.sql` (atau gabungkan ke `003_add_clinic_id.sql` kalau urutan eksekusi sama)

```sql
BEGIN;

-- 1. Pastikan semua dokter di users sudah ada di doctor_compensation_rules.
--    Kalau belum, insert dengan rule default (fee_type=percentage, base_percentage=NULL)
--    sehingga owner bisa lengkapi nanti via Settings.
INSERT INTO doctor_compensation_rules (doctor_name, fee_type, is_active, clinic_id)
SELECT DISTINCT u.full_name, 'percentage', TRUE, 'KLINIK-1'
  FROM app_users u
 WHERE LOWER(TRIM(u.role)) = 'dokter'
   AND u.is_active IS NOT FALSE
   AND NOT EXISTS (
     SELECT 1 FROM doctor_compensation_rules d
      WHERE d.doctor_name = u.full_name
   );

-- 2. (REVISED 2026-05-16) Dokter SEKARANG TETAP login — jangan soft delete.
--    Cukup pastikan role-nya kelak ter-mapping ke 'doctor' di clinic_users (Phase 2).
--    Tabel app_users sementara biarkan apa adanya sampai Phase 2 cutover ke clinic_users.

-- 3. (OPSIONAL) Tambah kolom optional clinic_user_id di doctor_compensation_rules
--    untuk explicit link ke akun login (kalau dokter punya akun). Dokter freelance
--    yang tidak login tetap punya rule (clinic_user_id = NULL).
ALTER TABLE doctor_compensation_rules
  ADD COLUMN IF NOT EXISTS clinic_user_id BIGINT; -- FK ditambah saat Phase 2 (setelah clinic_users ada)

COMMIT;
```

**Catatan revisi**:
- `Treatments.doctor_name` (denormalized) SUDAH ada → identifier valid untuk treatment historical.
- `Treatments.doctor_user_id` (existing) TETAP dipertahankan — semantiknya berubah: "user dokter yang treat" (link ke `app_users` / `clinic_users` Phase 2). Bukan lagi master dokter.
- Dokter LOGIN dengan akun mereka sendiri (role `doctor` di Phase 2).

### Backend Changes

**`TreatmentService.js`**:
- `getActiveDoctors(options)` → refactor ambil dari `doctor_compensation_rules`:
  ```js
  function getActiveDoctors(options) {
    const rules = dbFindAll_('DoctorCompensationRules', options) || [];
    const doctors = rules
      .filter(r => r.is_active !== false)
      .map(r => ({
        doctor_name: String(r.doctor_name || '').trim(),
        // Tidak ada user_id lagi — pakai doctor_name sebagai identifier
      }));
    return { success: true, data: doctors };
  }
  ```
- `findActiveDoctorById(userId)` → rename `findActiveDoctorByName(name)`:
  ```js
  function findActiveDoctorByName(name) {
    const rule = dbFindById_('DoctorCompensationRules', 'doctor_name', name, opts);
    return (rule && rule.is_active !== false) ? rule : null;
  }
  ```
- `validateTreatmentPayload`: validate `doctor_name` (bukan `doctor_user_id`)
- `createTreatment`: ambil `payload.doctor_name`, lookup via `findActiveDoctorByName`, simpan `doctor_name` di treatment

**`AppointmentService.js`** (kalau ada reference doctor): cek, refactor serupa.

**`DoctorCompensationService.js`**: tidak perlu refactor — sudah pakai `doctor_name` sebagai key.

### Frontend Changes

**`index.html`** — Modal Treatment:
- `<select id="treatment_doctor_user_id">` → rename `<select id="treatment_doctor_name">`
- `<div id="error_treatment_doctor_user_id">` → rename `error_treatment_doctor_name`

**`appointments.html`** — semua reference:
- `treatment_doctor_user_id` → `treatment_doctor_name`
- Build dropdown options:
  ```js
  doctors.forEach(d => {
    select.add(new Option(d.doctor_name, d.doctor_name));
  });
  ```
- Submit payload: `doctor_name` (bukan `doctor_user_id`)
- Validation field: `errors.doctor_name`

**`finance.html`** — `getActiveDoctors({})` di line 7053 (cek untuk apa dipakai, refactor sesuai):
- Kemungkinan filter laporan per dokter — ganti dropdown source ke `doctor_compensation_rules`

**`settings.html`** — tab Pengguna (yang sekarang ada CRUD user):
- (REVISED 2026-05-16) **TIDAK perlu hapus role 'doctor'** — dokter login juga sekarang. Update dropdown role jadi 5 opsi: `owner | super_admin | admin_appointment | admin_finance | doctor`.
- Support role rangkap: ganti single-select dropdown jadi multi-select / checklist (UI Phase 2).
- Tab "Fee Dokter" tetap tempat manage daftar dokter (CRUD doctor_compensation_rules), terpisah dari tab Pengguna.

### Testing checklist Phase 1.5
- [ ] Migration SQL: semua dokter dari users sudah ada di doctor_compensation_rules
- [ ] Users dokter sekarang `is_active = false`
- [ ] Modal Treatment: dropdown dokter tampil dari `doctor_compensation_rules`
- [ ] Submit treatment baru: berhasil, `treatment.doctor_name` ter-isi
- [ ] Owner report Fee Dokter: kalkulasi tetap akurat
- [ ] Settings → Pengguna: tidak ada dokter di list, dropdown role tanpa 'dokter'
- [ ] Settings → Fee Dokter: list dokter lengkap
- [ ] Treatment historical (lama, sebelum migrasi): tetap tampil benar (pakai `doctor_name` denormalized)

### Risk Phase 1.5

| Risk | Mitigation |
|---|---|
| Treatment baru salah simpan doctor_name (typo) | Validation: `findActiveDoctorByName` cek dokter exists & active |
| Dokter belum ada di doctor_compensation_rules saat migrasi | Migration auto-insert dengan rule default — owner lengkapi nanti |
| Reference `doctor_user_id` masih dipakai di laporan / dashboard | Grep menyeluruh sebelum deploy, refactor semua call site |
| Confusing UX kalau ada dua tempat manage user (Pengguna + Fee Dokter) | Sembunyikan role 'dokter' dari Tambah Pengguna; clear messaging |

---

## PHASE 2 — Clerk Auth + Role Foundation

**Tujuan**: replace session_token dengan Clerk JWT, whitelist email via `clinic_users`, foundation role check di semua function.

### Prerequisites (perlu disiapkan owner sebelum mulai)

1. **Buat akun Clerk** di [clerk.com](https://clerk.com) — pakai akun owner
2. **Buat Clerk Application** baru:
   - Application name: "Klinik Hajar Aswad"
   - Sign-in methods: Email + Password (atau Email magic link, terserah)
3. **Catat credentials**:
   - Publishable Key (boleh expose di frontend)
   - Secret Key (rahasia, hanya untuk backend)
4. **Configure redirect URLs**:
   - `https://script.google.com/macros/s/.../dev` (untuk testing)
   - `https://script.google.com/macros/s/.../exec` (untuk produksi)
5. **Daftar email** yang akan diberi akses (format: email + nama + role)
6. **Komunikasi ke staff**: jelaskan akan ada perubahan login (dari user/password lama → email + password Clerk)

### Data Model

**Tabel baru `clinic_users`** (whitelist akun — TANPA role di sini):
```sql
CREATE TABLE clinic_users (
  id BIGSERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(clinic_id) ON UPDATE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, email)
);

CREATE INDEX idx_clinic_users_email ON clinic_users(email);
CREATE INDEX idx_clinic_users_clinic_active ON clinic_users(clinic_id, is_active);
```

**Tabel relasi `clinic_users_roles`** (many-to-many — owner pilih role rangkap):
```sql
CREATE TABLE clinic_users_roles (
  clinic_user_id BIGINT NOT NULL REFERENCES clinic_users(id) ON DELETE CASCADE,
  clinic_id      TEXT   NOT NULL REFERENCES clinics(clinic_id) ON UPDATE CASCADE,
  role           TEXT   NOT NULL CHECK (role IN (
                   'owner', 'super_admin',
                   'admin_appointment', 'admin_finance',
                   'doctor'
                 )),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (clinic_user_id, role)
);

CREATE INDEX idx_clinic_users_roles_user ON clinic_users_roles(clinic_user_id);
CREATE INDEX idx_clinic_users_roles_clinic_role ON clinic_users_roles(clinic_id, role);
```

**Seed contoh**:
- Owner: email pemilik → roles `[owner]`
- Manajer: email manajer → roles `[super_admin]`
- Resepsionis: email staff → roles `[admin_appointment]`
- Staff keuangan: → roles `[admin_finance]`
- Dokter A: → roles `[doctor]`
- Dokter merangkap admin: → roles `[doctor, admin_appointment]`

### Backend Changes

**Helper baru** di file baru `Auth.js` (atau extend yg sudah ada):

```js
// Verify Clerk JWT via REST API, cache hasil 5 menit
function verifyClerkSession_(jwt) {
  // 1. Cek cache di PropertiesService
  // 2. Kalau tidak ada, call Clerk API:
  //    UrlFetchApp.fetch('https://api.clerk.com/v1/sessions/verify', {
  //      method: 'post',
  //      headers: { Authorization: 'Bearer ' + CLERK_SECRET_KEY },
  //      payload: JSON.stringify({ token: jwt })
  //    })
  // 3. Return { success, email, verified_at }
  // 4. Cache hasilnya 5 menit
}

// Resolve user dari Clerk JWT → email → clinic_users + roles[]
function readAuthSession_(payload) {
  const jwt = payload && payload.clerk_jwt;
  if (!jwt) return { success: false, message: 'JWT tidak ada' };

  const verified = verifyClerkSession_(jwt);
  if (!verified.success) return { success: false, message: 'JWT invalid' };

  const clinicId = getCurrentClinicId_(payload);  // dari header / default
  const user = dbFindOne_('clinic_users', {
    email: verified.email,
    clinic_id: clinicId,
    is_active: true
  });

  if (!user) return { success: false, message: 'Akun belum terdaftar di klinik ini. Hubungi owner.' };

  // Load semua role yang dimiliki user (many-to-many)
  const roles = dbFindWhere_('clinic_users_roles', function(r) {
    return r.clinic_user_id === user.id && r.clinic_id === clinicId;
  }).map(function(r) { return r.role; });

  user.roles = roles;  // attach ke user object
  return { success: true, user: user };
}

// Helper: cek user punya role tertentu
function userHasRole_(user, role) {
  return Array.isArray(user.roles) && user.roles.indexOf(role) !== -1;
}

function userHasAnyRole_(user, roles) {
  if (!Array.isArray(user.roles)) return false;
  for (var i = 0; i < roles.length; i++) {
    if (user.roles.indexOf(roles[i]) !== -1) return true;
  }
  return false;
}

// Convenience: Owner & Super Admin dianggap fully privileged
function userIsFullyPrivileged_(user) {
  return userHasAnyRole_(user, ['owner', 'super_admin']);
}

// Role check — sementara semua pakai ['*']
function requireRole(payload, allowedRoles) {
  const auth = readAuthSession_(payload);
  if (!auth.success) return auth;

  if (allowedRoles.indexOf('*') !== -1) return auth;  // wildcard
  if (userIsFullyPrivileged_(auth.user)) return auth; // owner/super_admin selalu lulus
  if (!userHasAnyRole_(auth.user, allowedRoles)) {
    return { success: false, message: 'Akses ditolak. Role Anda: ' + (auth.user.roles || []).join(', ') };
  }
  return auth;
}
```

**Refactor semua function** yang sekarang panggil `readAuthSession_(payload)`:
- Pattern lama: `const auth = readAuthSession_(payload); if (!auth.success) return auth;`
- Pattern baru: `const auth = requireRole(payload, ['*']); if (!auth.success) return auth;`
- Mass replace di semua service files (DoctorCompensationService, PatientService, AppointmentService, dll)

**Simpan Clerk Secret Key** di `PropertiesService` (script properties), bukan hardcode di file.

### Frontend Changes

**Halaman login** (`index.html`):
- Replace login form lama dengan Clerk widget
- Load Clerk JS SDK:
  ```html
  <script
    async crossorigin="anonymous"
    data-clerk-publishable-key="<PUBLISHABLE_KEY>"
    src="https://<YOUR_DOMAIN>.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  ></script>
  ```
- Setelah sign-in: ambil JWT via `Clerk.session.getToken()` → call backend `validateClerkUser({ clerk_jwt: token })`
- Sukses → render main app
- Gagal (email tidak di whitelist) → tampilkan pesan "Akun belum terdaftar, hubungi owner klinik"

**Semua `google.script.run` call**:
- Replace `session_token: getCurrentSessionToken()` dengan `clerk_jwt: await Clerk.session.getToken()`
- Wrap helper `attachAuthContext()` agar otomatis inject JWT

**Logout button** → `Clerk.signOut()` lalu redirect ke halaman login.

### Settings UI baru — tab Pengguna

Ganti / extend tab "Pengguna" existing untuk manage `clinic_users` whitelist:
- **List**: tabel email + nama + **roles[] (chip)** + status aktif
- **Tambah**: form input email + nama + **multi-select role** (5 opsi: owner, super_admin, admin_appointment, admin_finance, doctor)
- **Edit**: ubah nama atau **set/unset role** (multi-select), toggle aktif
- **Hapus**: soft delete (set `is_active = false`)

Validasi: minimal 1 role harus dipilih. Hanya `owner` / `super_admin` yang bisa edit user lain.

Kalau user belum sign up di Clerk: tetap masuk whitelist, baru aktif saat dia sign up dengan email yang sesuai.

### Migration / Cutover

1. Jalankan migration SQL: bikin tabel `clinic_users` + seed semua email
2. Setup Clerk application + simpan secret key di PropertiesService
3. Deploy ke `/dev`
4. Owner + 1-2 admin test login: sign up via Clerk pakai email pribadi → cek bisa akses sistem
5. Test full flow CRUD: tambah pasien, treatment, billing, dll → semua harus jalan
6. Komunikasi ke seluruh staff: jadwal cutover, instruksi login baru
7. Deploy ke `/exec`: staff dapat email instruksi sign up + login pakai email pribadi
8. Hapus old session_token code setelah 2 minggu (cleanup)

### Testing checklist Phase 2
- [ ] Sign up email yang ada di whitelist → bisa akses
- [ ] Sign up email yang TIDAK ada di whitelist → ditolak dengan pesan jelas
- [ ] Logout → redirect ke login page
- [ ] Reload halaman → tetap logged in (Clerk session persist)
- [ ] Semua function CRUD masih jalan (role `['*']` lulus untuk siapa saja)
- [ ] Settings → Pengguna: tambah/edit/hapus whitelist
- [ ] Edge case: JWT expired → re-auth otomatis atau prompt login

---

## PHASE 3 — Audit Log + Dashboard

**Tujuan**: log semua mutasi data ke tabel `audit_logs`, tampilkan di dashboard tab "Aktivitas".

### Data Model

**Tabel baru `audit_logs`:**
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(clinic_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,           -- CREATE | UPDATE | DELETE | LOGIN | LOGOUT
  entity_type TEXT,               -- 'patient' | 'treatment' | 'billing' | ...
  entity_id TEXT,                 -- 'PAT-001' / 'TRT-002' / ...
  description TEXT NOT NULL,      -- "Tambah pasien Budi"
  meta_json JSONB                 -- NULL sekarang, before/after nanti
);

CREATE INDEX idx_audit_logs_clinic_created ON audit_logs(clinic_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

### Backend Changes

**Helper baru** di `Auth.js` atau file baru `AuditLog.js`:
```js
function logAudit_(auth, action, entityType, entityId, description, meta) {
  if (!auth || !auth.success || !auth.user) return;  // silent skip kalau auth tidak valid
  
  dbInsert_('audit_logs', {
    clinic_id:   auth.user.clinic_id,
    user_email:  auth.user.email,
    user_name:   auth.user.full_name,
    user_role:   auth.user.role,
    action:      action,
    entity_type: entityType,
    entity_id:   entityId,
    description: description,
    meta_json:   meta || null
  });
}
```

**Inject `logAudit_` ke semua mutation function sukses:**

Contoh:
```js
function createPatient(payload) {
  const auth = requireRole(payload, ['*']);
  if (!auth.success) return auth;
  
  // ... existing logic ...
  
  const inserted = dbInsert_('patients', row);
  
  logAudit_(auth, 'CREATE', 'patient', inserted.patient_id,
    'Tambah pasien ' + inserted.full_name);
  
  return { success: true, data: inserted };
}
```

Function yang perlu di-instrument (tidak exhaustive — cek semua write function di service files):
- Patient: create, update, deactivate, upload photo, delete photo
- Appointment: create, update, cancel, restore
- Treatment: create
- Billing: create, update, cancel, payment, discount, installment plan
- Expense: create, update, delete
- Settings: CRUD service catalog, doctor compensation rule, doctor material deduction, clinic_users
- Owner: confirm doctor fee

LOGIN / LOGOUT: di `validateClerkUser` setelah sukses → log LOGIN. Logout di frontend kirim event ke backend → log LOGOUT.

### Frontend — Dashboard tab Aktivitas

Tab baru di `dashboard.html`:
- Tabel: `Tanggal | User | Role | Aksi | Deskripsi`
- Filter di atas tabel:
  - Range tanggal (default: 7 hari terakhir)
  - User dropdown (dari `clinic_users`)
  - Action type (CREATE/UPDATE/DELETE/LOGIN/LOGOUT)
  - Entity type (patient/treatment/billing/...)
- Pagination: 20 per page
- Sort: created_at DESC

**Visibility (revised 2026-05-16)**:
- `owner`, `super_admin` → lihat semua audit log
- `admin_appointment` → lihat audit log untuk entity_type ∈ {patient, appointment, treatment}
- `admin_finance` → lihat audit log untuk entity_type ∈ {billing, payment, expense, service_catalog}
- `doctor` → tab Aktivitas TIDAK muncul (hidden)

### Testing checklist Phase 3
- [ ] CRUD patient → log muncul di audit_logs
- [ ] CRUD treatment → log muncul
- [ ] CRUD billing/payment/expense → log muncul
- [ ] Login/logout → log muncul
- [ ] Dashboard tab Aktivitas → tampil list, filter berfungsi
- [ ] Role doctor tidak lihat tab Aktivitas

---

## Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Apps Script + Clerk integration unusual, ada edge case | Phase 2 test extensively di `/dev` sebelum deploy. Bisa rollback dengan hide-deploy-unhide cycle. |
| Existing data perlu migrate `clinic_id` | Migration SQL set semua existing row = `'HAJAR-ASWAD'` |
| Whitelist mismatch saat first login | Pesan error jelas ("akun belum terdaftar"). Owner manage via Settings. |
| Staff bingung pertama kali login pakai Clerk | Pre-deploy: kirim email instruksi step-by-step + video pendek (kalau perlu) |
| Bug di backend setelah cutover | Hide-deploy-unhide cycle untuk rollback cepat |
| Clerk API quota / latency | Cache JWT verification 5 menit di PropertiesService. Fallback graceful kalau Clerk down. |
| Audit log spam (terlalu banyak entry) | Tidak log READ. Hanya WRITE + LOGIN/LOGOUT. Retention default no-delete (review nanti) |
| Multi-klinik join tidak ter-scope | Helper `scopeByClinic_()` otomatis di semua dbXxx_. Code review wajib saat tambah query baru. |

---

## Urutan Eksekusi yang Disarankan

**Sesi Phase 1 — Multi-klinik Foundation** (estimasi 1-2 sesi):
1. Tulis migration SQL `003_add_clinic_id.sql`
2. Owner jalankan migration di Supabase
3. Refactor backend: helper `getCurrentClinicId_`, update `dbXxx_` functions
4. Test semua flow di `/dev`
5. Deploy ke `/exec`

**Sesi Phase 1.5 — Pisahkan Dokter dari Users** (estimasi 1 sesi):
1. Tulis migration SQL `003b_split_doctors_from_users.sql`
2. Owner jalankan migration di Supabase
3. Refactor `TreatmentService.js`: `getActiveDoctors` & `findActiveDoctorByName` → source dari `doctor_compensation_rules`
4. Refactor frontend: rename `treatment_doctor_user_id` → `treatment_doctor_name`, build dropdown dari rules
5. Refactor `settings.html`: hapus role 'dokter' dari form Tambah Pengguna
6. Test full flow treatment + owner report fee
7. Deploy ke `/exec`

**Sesi Phase 2 — Clerk Auth** (estimasi 3-5 sesi):
1. Owner setup Clerk account + application + dapatkan credentials
2. Tulis migration SQL `004_clinic_users.sql` + seed
3. Backend: helper `verifyClerkSession_`, `readAuthSession_`, `requireRole`
4. Frontend: Clerk widget di login page, replace session_token di semua `google.script.run`
5. Settings UI: tab Pengguna untuk manage whitelist
6. Komunikasi ke staff
7. Test full di `/dev`
8. Deploy ke `/exec`

**Sesi Phase 3 — Audit Log** (estimasi 2-3 sesi):
1. Migration SQL `005_audit_logs.sql`
2. Backend: helper `logAudit_` + inject ke semua mutation function
3. Frontend: dashboard tab Aktivitas
4. Test + deploy

---

## Out of Scope (untuk masa depan, bukan sesi ini)

- Role-specific permissions tightening (matrix Role × Modul di section "Konsep Role") — sementara semua function pakai `requireRole(['*'])`. Tightening dilakukan bertahap setelah Phase 2 stabil.
- Audit log filter per role (admin_appointment hanya lihat scope modulnya) — Phase 3 first iteration tampilkan semua untuk owner/super_admin saja; filter per role di iterasi berikutnya.
- Audit log diff (before/after value) — sementara hanya deskripsi, kolom `meta_json` siap diisi nanti
- Multi-faktor authentication (Clerk support) — bisa tambah belakangan
- SSO dengan Google — Clerk support, tambah belakangan kalau perlu
- Clinic switcher UI — saat klinik kedua datang
- Export audit log ke CSV / PDF
- Realtime audit log update (sekarang polling/refresh manual)

---

## Open Questions / Decisions Lanjutan

- [ ] Clerk custom domain (production paid feature) atau cukup `*.clerk.accounts.dev` (free)?
- [ ] Retention audit log: hapus otomatis setelah N bulan, atau simpan selamanya?
- [ ] Backup audit log otomatis: include di `SupabaseBackup.js` (sudah ada untuk tabel utama)
- [ ] Branding Clerk sign-in page: pakai logo & warna klinik, atau default?

---

## Tracking

File migration yang akan dibuat:
- `migrations/003_add_clinic_id.sql` (Phase 1)
- `migrations/003b_split_doctors_from_users.sql` (Phase 1.5)
- `migrations/004_clinic_users.sql` (Phase 2)
- `migrations/005_audit_logs.sql` (Phase 3)

File baru di proyek:
- `Auth.js` (atau extend file yang ada)
- `ClinicScope.js` (helper multi-klinik)
- `AuditLog.js` (helper audit log)

File yang akan kena banyak refactor:
- Semua `*Service.js` (auth pattern change)
- `DataAccess.js` (auto-scope by clinic_id)
- `TreatmentService.js` (`getActiveDoctors`/`findActiveDoctorByName` — Phase 1.5)
- `index.html` (login page replace dengan Clerk widget + dropdown rename Phase 1.5)
- `appointments.html` (rename `treatment_doctor_user_id` → `treatment_doctor_name` — Phase 1.5)
- `dashboard.html` (tab Aktivitas baru)
- `settings.html` (tab Pengguna refactor + hapus role 'dokter')
- `finance.html` (dropdown dokter di laporan — Phase 1.5)
- Semua `*.html` page yang panggil `google.script.run` (replace session_token)
