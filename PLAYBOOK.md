# PLAYBOOK — Hajar Aswad Clinic App

Dokumen ini adalah acuan engineering untuk proyek ini.
Berlaku untuk semua kontributor (manusia maupun AI).
Update dokumen ini setiap kali ada pola baru yang disepakati.

---

## 1. Arsitektur Sistem

```
Browser (GAS Web App)
  └── google.script.run (async RPC)
        └── GAS Server (Apps Script)
              └── SupabaseClient.js → Supabase REST API (PostgreSQL)
```

- **Frontend**: HTML + vanilla JS, dirender oleh GAS `HtmlService`
- **Backend**: Google Apps Script, berjalan di server Google
- **Database**: Supabase (PostgreSQL), diakses via REST API
- **Deployment**: `/dev` untuk testing, `/exec` untuk produksi

### File Inti

| File | Peran |
|---|---|
| `Code.js` | Entry point: `doGet()`, routing halaman |
| `Auth.js` | Session management, login, role check |
| `DataAccess.js` | Router CRUD dual-backend (Supabase / Spreadsheet) |
| `SupabaseClient.js` | HTTP client ke Supabase REST API |
| `RepositoryConfig.js` | Mapping nama tabel, primary key, backend mode |
| `scripts.html` | Global JS utilities client-side (semua halaman pakai) |
| `style.html` | CSS global, design tokens, dark theme |

---

## 2. Pola Performa (Server-Side)

### 2.1 Bootstrap Halaman — 1 Round-Trip

Setiap halaman **wajib** memuat semua data yang dibutuhkan dalam **satu** `google.script.run` call.
Jangan fetch per-section atau per-tab saat pertama buka.

```javascript
// ✅ BENAR — 1 call, semua data siap
google.script.run
  .withSuccessHandler(function(res) {
    cache.doctors  = res.data.doctors;
    cache.services = res.data.services;
    renderActiveTab();
  })
  .getAllSettingsData({ session_token: token });

// ❌ SALAH — 4 call terpisah, loading berlipat
google.script.run.withSuccessHandler(...).getDoctors(...);
google.script.run.withSuccessHandler(...).getServices(...);
```

### 2.2 Parallel Fetch di Server — `supabaseSelectParallel_()`

Jika satu fungsi server perlu query beberapa tabel, gunakan `supabaseSelectParallel_()`.
Ini mengirim semua HTTP request ke Supabase **serentak** via `UrlFetchApp.fetchAll()`.

```javascript
// Waktu total = max(t1, t2, t3, t4) — bukan t1+t2+t3+t4
const results = supabaseSelectParallel_([
  { table: 'clinic_info',               options: { limit: 10  } },
  { table: 'doctor_compensation_rules', options: { limit: 100 } },
  { table: 'service_catalog',           options: { limit: 500 } },
  { table: 'users',                     options: { limit: 100 } }
]);
const clinicRows = results[0];
const doctors    = results[1];
```

Gunakan `supabaseSelect_()` (sequential) hanya jika hasil query pertama
dibutuhkan sebagai parameter query berikutnya.

### 2.3 Pola CRUD — Pattern B (Update Lokal, Tanpa Re-Fetch)

Setelah operasi CRUD berhasil di server, **jangan** fetch ulang seluruh tabel.
Update array lokal langsung dari `res.data` yang dikembalikan server, lalu re-render.

```javascript
// ✅ BENAR — update lokal, re-render instan
.withSuccessHandler(function(res) {
  if (isEdit) {
    var idx = localArray.findIndex(function(r) { return r.id === targetId; });
    if (idx !== -1) localArray[idx] = res.data;
  } else {
    localArray.push(res.data);
  }
  renderTable();
})

// ❌ SALAH — re-fetch seluruh tabel setelah setiap CRUD
.withSuccessHandler(function(res) {
  loadEntireTable();
})
```

**Syarat wajib:** Setiap fungsi server CRUD **harus** mengembalikan row lengkap dalam `res.data`.

```javascript
return { success: true, data: updated };  // ✅ full row
return { success: true };                 // ❌ client tidak bisa update cache
```

**Kapan Pattern B tidak cocok:**
- Halaman dengan banyak user aktif bersamaan (Appointments — tetap re-fetch)
- Ketika server melakukan kalkulasi kompleks yang hasilnya tidak bisa diprediksi client

---

## 3. Pola Performa (Client-Side)

### 3.1 Client-Side Cache — Tab / Section

Setelah data berhasil dimuat, simpan di variabel global halaman.
Gunakan flag `loaded` untuk mencegah fetch ulang saat user pindah tab.

```javascript
var pageTabLoaded = {};   // { clinic: false, doctor: false, ... }

function switchTab(tab) {
  if (pageTabLoaded[tab]) {
    renderTab(tab);     // instan dari memori, 0 network call
  } else {
    loadTab(tab);       // fetch 1x, set pageTabLoaded[tab] = true saat sukses
  }
}
```

Cache **tidak direset** saat user navigasi ke halaman lain dan kembali.
Cache hanya direset saat refresh browser (session baru).

### 3.2 Stale-While-Revalidate

Untuk halaman yang sering dibuka berulang (Patients, Appointments, Finance):
tampilkan data lama **langsung** agar terasa instan, sambil fetch data segar di background.

```javascript
// ✅ Tampilkan cache lama dulu (instan), lalu fetch ulang
if (allPatients && allPatients.length > 0) {
  filteredPatients = allPatients.slice();
  renderPatientsTable();          // langsung tampil
}
loadPatients();                   // fetch segar di background, replace saat selesai
```

Berbeda dengan tab cache (Section 3.1) yang tidak re-fetch sama sekali,
stale-while-revalidate selalu re-fetch — hanya saja tidak menunggu selesai dulu.

### 3.3 Race Condition Guard

Setiap `withSuccessHandler` yang merender UI **wajib** cek apakah
user masih di konteks yang sama sebelum menulis ke DOM.

**Level 1 — Tab/Halaman (simple):**
```javascript
// Cek apakah user masih di tab yang sama saat respons tiba
if (settingsTab === 'doctor') settingsRenderDoctorTab();
```

**Level 2 — Request Token (untuk detail view yang cepat berganti):**
```javascript
// Increment token setiap kali buka detail baru
const requestToken = ++patientDetailRequestToken;

google.script.run
  .withSuccessHandler(function(res) {
    // Abaikan jika user sudah buka detail pasien lain
    if (requestToken !== patientDetailRequestToken) return;
    renderPatientDetail(res.data);
  })
  .getPatientDetail(patientId);
```

Gunakan Level 2 untuk detail view yang bisa berganti cepat (klik pasien A → cepat klik pasien B).

### 3.4 Pre-Computed Search Text (`_search_text`)

Saat data pertama kali diterima dari server, gabungkan semua field yang akan di-search
menjadi satu string `_search_text`. Filter client-side cukup cek satu string ini.

```javascript
allPatients = rows.map(function(row) {
  row._search_text = [
    row.patient_code || '',
    row.full_name    || '',
    row.phone        || ''
  ].join(' ').toLowerCase();
  return row;
});

// Search: O(n) string match, tidak ada server call
filteredPatients = allPatients.filter(function(row) {
  return row._search_text.includes(keyword);
});
```

### 3.5 Debounce Search (220ms)

Input search **wajib** di-debounce agar tidak re-render setiap keystroke.
Standar delay di seluruh aplikasi ini: **220ms**.

```javascript
var searchDebounce = null;

function handleSearch() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(function() {
    applyFilters();
    renderTable();
  }, 220);
}
```

Finance memiliki reusable helper `runFinanceDebounce(key, callback, delay)`.
Halaman baru sebaiknya membuat helper serupa daripada raw `setTimeout`.

### 3.6 Live Refresh dengan Smart Pause (Appointments)

Halaman Appointments melakukan auto-refresh berkala. Refresh **dijeda otomatis** ketika:
- Tab browser tidak aktif (`document.hidden`)
- Ada modal yang sedang terbuka

```javascript
function shouldPauseLiveRefresh() {
  if (document.hidden)       return true;
  if (isAppointmentModalOpen()) return true;
  if (isTreatmentModalOpen())   return true;
  return false;
}
```

Pola ini mencegah race condition antara auto-refresh dan aksi user yang sedang berjalan.

---

## 4. Pola Form & Modal

### 4.1 In-Flight Guard (Double-Submit Prevention)

Setiap form submission **wajib** menggunakan flag `inFlight` untuk mencegah submit ganda.
Format nama: `[konteks][Aksi]InFlight` — jelas siapa yang di-guard.

```javascript
// ✅ var appointmentSubmitInFlight, var treatmentInitInFlight
// ❌ var inFlight  (terlalu generik)

var appointmentSubmitInFlight = false;

function handleSubmit() {
  if (appointmentSubmitInFlight) return;   // blok submit kedua
  appointmentSubmitInFlight = true;

  google.script.run
    .withSuccessHandler(function(res) {
      formSubmitInFlight = false;   // reset setelah selesai
      // ...
    })
    .withFailureHandler(function(err) {
      formSubmitInFlight = false;   // reset juga saat error
      // ...
    })
    .saveData(payload);
}
```

Flag **wajib** di-reset di **keduanya**: `withSuccessHandler` dan `withFailureHandler`.
Flag juga di-reset saat modal ditutup (`closeModal()`).

### 4.2 Modal Processing State — `setModalProcessingState()`

Helper global di `scripts.html`. Gunakan ini untuk disable semua input dalam modal
dan update teks tombol saat proses sedang berjalan.

```javascript
// Saat mulai proses
setModalProcessingState('namaModal', true, {
  primaryButtonId: 'submitBtn',
  loadingText:     'Menyimpan...'
});

// Saat selesai (sukses atau gagal)
setModalProcessingState('namaModal', false, {
  primaryButtonId: 'submitBtn',
  idleText:        'Simpan'
});
```

Fungsi ini otomatis menyimpan state disabled sebelumnya dan memulihkannya.

### 4.3 Siklus Hidup Modal (Open → Submit → Close)

```
openModal()
  ├── reset form (form.reset())
  ├── reset in-flight flag
  ├── clear field errors
  └── tampilkan modal (.classList.remove('hidden'))

submitModal()
  ├── cek in-flight guard → return jika true
  ├── set in-flight = true
  ├── setModalProcessingState(true)
  ├── google.script.run ...
  │     ├── sukses → update local array → closeModal() → renderTable()
  │     └── gagal  → setModalProcessingState(false) → tampilkan error

closeModal()
  ├── reset in-flight flag
  ├── setModalProcessingState(false)
  ├── clear field errors
  └── sembunyikan modal (.classList.add('hidden'))
```

### 4.4 Field-Level Error Display

Server mengembalikan `errors` sebagai objek `{ field: 'pesan error' }`.
Client memetakan field server ke ID elemen HTML dan menampilkan per-field.

```javascript
// Server return:
return { success: false, errors: { full_name: 'Nama wajib diisi' } };

// Client:
function applyErrors(errors) {
  var fieldMap = { full_name: 'input_full_name' };
  Object.keys(errors || {}).forEach(function(key) {
    var inputEl = document.getElementById(fieldMap[key]);
    var errorEl = document.getElementById('error_' + fieldMap[key]);
    if (inputEl) inputEl.classList.add('input-error');
    if (errorEl) errorEl.textContent = errors[key];
  });
}

function clearErrors() {
  document.querySelectorAll('.input-error').forEach(function(el) {
    el.classList.remove('input-error');
  });
  document.querySelectorAll('[id^="error_"]').forEach(function(el) {
    el.textContent = '';
  });
}
```

---

## 5. Pola Keamanan

### 5.1 Validasi Auth di Setiap Fungsi Server

Setiap fungsi publik (bisa dipanggil client) **wajib** validasi sesi di baris pertama.

```javascript
function updateClinicInfo(payload) {
  const auth = readAuthSession_(payload);  // WAJIB — baris pertama
  if (!auth.success) return auth;
  // ... baru proses
}
```

**Role yang tersedia:** `admin`, `owner`. Beberapa operasi finance memerlukan
permission tambahan via `requireFinancePermission_()` atau `requireFinanceOwnerPermission_()`.

**Session TTL:** 6 jam, disimpan di GAS `CacheService`. Token dari client dikirim
di field `session_token` pada setiap payload.

### 5.2 UPDATE dan DELETE Wajib Ada Filter

`supabaseUpdate_()` dan `supabaseDelete_()` akan throw error jika filter kosong.

```javascript
// ✅ BENAR
supabaseUpdate_('patients', { patient_id: 'eq.P001' }, patch);

// ❌ AKAN ERROR — potensial update/delete semua row
supabaseUpdate_('patients', {}, patch);
```

### 5.3 Soft Delete — Jangan Hapus Fisik

Data yang masih bisa direferensi tabel lain **tidak boleh** dihapus fisik.

```javascript
// ✅ BENAR — soft delete
function deleteServiceCatalog(payload) {
  return updateServiceCatalog(Object.assign({}, payload, { is_active: false }));
}
```

| Tabel | Wajib Soft Delete | Alasan |
|---|---|---|
| `users` | ✅ | Direferensi di treatments, appointments |
| `service_catalog` | ✅ | Direferensi di treatment_items lama |
| `doctor_compensation_rules` | ✅ | Direferensi di laporan historis |
| Data tanpa foreign ref | Boleh hard delete | — |

### 5.4 Password — Tidak Pernah Dikembalikan ke Client

```javascript
// ✅ BENAR — mapping eksplisit, password_hash tidak ikut
const users = usersRaw.map(function(u) {
  return { user_id: u.user_id, username: u.username,
           full_name: u.full_name, role: u.role, is_active: u.is_active };
});
```

### 5.5 Kredensial di Script Properties

URL dan API key Supabase **tidak boleh** ada di kode (tidak di-commit ke git).

```javascript
// ✅ BENAR — baca dari Script Properties
var key = PropertiesService.getScriptProperties()
            .getProperty('SUPABASE_STAGING_SERVICE_ROLE_KEY');
```

### 5.6 XSS Prevention — Escape Wajib di HTML dan Onclick

Semua nilai dari server yang dirender ke HTML **wajib** di-escape.
Nilai yang dipakai di inline `onclick` butuh **double escape** (HTML + JS).

```javascript
// Render ke innerHTML — gunakan escapeAppHtml() dari scripts.html
'<td>' + escapeAppHtml(row.patient_name) + '</td>'

// Nilai di onclick param — gunakan escapeFinanceOnclickParam() (HTML + JS escape)
'onclick="openDetail(\'' + escapeFinanceOnclickParam(row.id) + '\')"'
```

### 5.7 Production Mutation Freeze Guard

`RepositoryConfig.js` memiliki flag `REPO_PRODUCTION_MUTATION_FREEZE_ENABLED`.
Saat diaktifkan (`true`), semua operasi write (INSERT/UPDATE/DELETE) akan diblokir.

Gunakan flag ini saat migrasi data atau maintenance untuk mencegah write tidak sengaja
ke database produksi sementara operasi sensitif sedang berjalan.

```javascript
// RepositoryConfig.js
const REPO_PRODUCTION_MUTATION_FREEZE_ENABLED = false; // true = freeze semua write
```

---

## 6. UI Utilities (Global — scripts.html)

### 6.1 Toast Notification

```javascript
showToast('Pasien berhasil disimpan', 'success'); // type: 'success', 'error', 'info'
```

- Max 3 toast tampil bersamaan; toast terlama otomatis dihapus
- Auto-dismiss setelah 3 detik

### 6.2 Design Tokens

Semua warna, border, dan token visual didefinisikan sebagai CSS custom properties
di blok `:root` pada `style.html`. **Jangan hardcode warna di luar sana.**

```css
/* Contoh penggunaan token */
background: var(--color-surface);
color:      var(--color-primary);
border:     1px solid var(--color-border);
```

Tambah token baru langsung di `style.html` — tidak perlu update PLAYBOOK.

---

## 7. Konvensi Kode

### 7.1 Fungsi Server (GAS)

| Konvensi | Keterangan |
|---|---|
| `functionName()` | Fungsi publik — bisa dipanggil client via `google.script.run` |
| `functionName_()` | Fungsi private — hanya untuk internal antar file GAS |
| Return `{ success, data?, message?, errors? }` | Wajib konsisten di semua fungsi publik |

### 7.2 Variabel Global Client (per halaman)

Gunakan prefix nama halaman untuk menghindari konflik.

```javascript
var settingsTab = 'clinic';     // ✅ prefix 'settings'
var settingsDoctorRules = [];   // ✅
var tab = 'clinic';             // ❌ terlalu generik
```

### 7.3 ID Generator

Gunakan `generateSafeId('PREFIX')` untuk ID baru — jangan pakai timestamp mentah.

```javascript
const userId = generateSafeId('USR');  // → 'USR-a3f9b2'
```

---

## 8. Persiapan Multi-Klinik

Saat ini aplikasi berjalan sebagai **single-tenant** (1 klinik).
Untuk multi-klinik, setiap tabel utama perlu kolom `clinic_id`.

**Yang perlu disiapkan saat migrasi ke multi-tenant:**
- Tambah kolom `clinic_id` di semua tabel operasional
- Setiap query di-filter by `clinic_id`
- Auth session menyimpan `clinic_id` aktif user
- Row Level Security (RLS) Supabase sebagai safety net berlapis

**Pola yang sudah multi-klinik friendly:**
- `SETTINGS_OPTS`, `DOCTOR_COMP_OPTIONS` per-service → cukup tambah filter `clinic_id`
- `supabaseSelectParallel_()` → tambah `filters: { clinic_id: 'eq.' + clinicId }` per request
- Pattern B CRUD → tidak perlu diubah di layer client
- `generateSafeId()` → prefix bisa di-extend dengan kode klinik

---

## 9. Deployment

| Target | Perintah | Kapan |
|---|---|---|
| Push kode | `clasp push` | Setelah setiap perubahan, **sebelum** minta test di /dev |
| Test | Buka `/dev` URL | Setelah `clasp push` |
| Deploy produksi | `clasp deploy --deploymentId AKfycbyo2WhrZZY5JBRn1VwG3iDU5bOoNYZDZbSUconYcQ7nk4AskbemYyb77oZJ6z4eNhpQ --description "HajarAswad"` | Hanya atas perintah eksplisit pemilik |
| Produksi | Buka `/exec` URL (via Cloudflare) | Setelah deploy |

**Aturan:** `clasp push` boleh otomatis. `clasp deploy` **wajib** tunggu perintah pemilik.
