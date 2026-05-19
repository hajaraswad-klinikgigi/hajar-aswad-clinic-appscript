# PATTERNS.md — Acuan Konsistensi Aktivitas (Audit Log Page)

> **Tujuan**: Dokumen ini adalah rulebook wajib untuk setiap pekerjaan di halaman
> **Aktivitas** (`audit-log.html` + `AuditLogQueryService.js` + `AuditLogService.js`).
> Setiap perubahan di Aktivitas — frontend, backend, struktur, naming, lifecycle,
> error handling — **wajib** mengikuti pola canonical yang sudah terbukti di
> **Patients**, **Appointments**, **Recall** (urutan prioritas acuan).
>
> **Hierarki acuan** (kalau ada konflik):
> 1. Patients / Appointments / Recall (canonical inti, 3 halaman acuan)
> 2. Kalau tidak ada di ketiganya → cek Finance
> 3. Kalau Finance juga tidak ada → **STOP, diskusi dengan owner** (jangan improvisasi)
>
> **Dibuat**: 2026-05-19 | **Target awal**: Refactor halaman Aktivitas agar konsisten

---

## DAFTAR ISI

1. [Pola Frontend — Struktur HTML & Layout](#1-pola-frontend--struktur-html--layout)
2. [Pola Frontend — CSS & Theme](#2-pola-frontend--css--theme)
3. [Pola Frontend — Lifecycle JS & State](#3-pola-frontend--lifecycle-js--state)
4. [Pola Frontend — Pagination](#4-pola-frontend--pagination)
5. [Pola Frontend — Search & Filter](#5-pola-frontend--search--filter)
6. [Pola Frontend — Tabel & Empty/Loading State](#6-pola-frontend--tabel--emptyloading-state)
7. [Pola Frontend — Modal (Detail, Form, Confirm)](#7-pola-frontend--modal-detail-form-confirm)
8. [Pola Frontend — Komunikasi google.script.run](#8-pola-frontend--komunikasi-googlescriptrun)
9. [Pola Frontend — Naming Convention](#9-pola-frontend--naming-convention)
10. [Pola Frontend — Utility & Helper](#10-pola-frontend--utility--helper)
11. [Pola Backend — Endpoint Signature](#11-pola-backend--endpoint-signature)
12. [Pola Backend — Auth, Role, Clinic Scope](#12-pola-backend--auth-role-clinic-scope)
13. [Pola Backend — Validation, Response, Audit Emission](#13-pola-backend--validation-response-audit-emission)
14. [i18n — Label & Format Indonesia](#14-i18n--label--format-indonesia)
15. [GAP ANALYSIS — Aktivitas vs Canonical](#15-gap-analysis--aktivitas-vs-canonical)
16. [Pola Aktivitas yang Belum Ada di Canonical — Keputusan Final](#16-pola-aktivitas-yang-belum-ada-di-canonical--keputusan-final)
17. [Checklist Wajib Sebelum Commit Aktivitas](#17-checklist-wajib-sebelum-commit-aktivitas)

---

## 1. Pola Frontend — Struktur HTML & Layout

### 1.1 Wrapper utama halaman

**Canonical** (Patients, Recall — Recall sengaja reuse class `patients-*`):

```html
<div class="patients-shell">
  <div class="patients-header">
    <div>
      <div class="patients-eyebrow">{Kategori halaman}</div>
      <h1 class="patients-title">{Nama halaman}</h1>
      <div class="patients-subtitle">{Deskripsi singkat}</div>
    </div>
    <button class="action-btn ..." onclick="...">+ {Aksi utama}</button>
  </div>
  ...
</div>
```

**Aturan**:
- Class wrapper utama selalu `patients-shell` (bahkan untuk Recall — bukan typo).
- Header: `patients-header` + 3-tier teks (`eyebrow` → `title` → `subtitle`).
- Tombol aksi utama di kanan header pakai class `action-btn` + class spesifik halaman (mis. `patients-create-btn`, `appointments-create-btn`).
- Untuk halaman tanpa aksi utama (mis. Recall, Aktivitas), tombol bisa diomit.

**Appointments** mirip tapi pakai prefix `appointments-`:
```html
<div class="appointments-shell">
  <div class="appointments-header appointments-header-main">
    <div>
      <div class="appointments-eyebrow">Operational Queue</div>
      <h2 class="appointments-title">Appointments</h2>
      <div class="appointments-subtitle">...</div>
    </div>
    ...
  </div>
</div>
```

### 1.2 Section di dalam halaman

Setiap blok (toolbar, tabel) dibungkus `content-card`:

```html
<div class="content-card {prefix}-toolbar-card">
  ...
</div>
<div class="content-card">
  <div class="{prefix}-table-head">
    <div>
      <h3 class="{prefix}-section-title">Daftar X</h3>
      <div class="{prefix}-section-subtitle">Deskripsi tabel</div>
    </div>
  </div>
  <div class="table-wrapper">
    <table class="table {prefix}-table">...</table>
  </div>
  <div class="pagination">...</div>
</div>
```

### 1.3 Toolbar (Search + Filter)

**Pola umum** (Patients style — search + 1 toggle):
```html
<div class="{prefix}-toolbar">
  <div class="{prefix}-search-wrap">
    <label class="{prefix}-toolbar-label">Pencarian</label>
    <input type="text" id="{prefix}SearchInput" class="search-box" ... oninput="handleXSearch()">
  </div>
  <div class="{prefix}-toggle-wrap">
    <label class="{prefix}-toolbar-label">Filter</label>
    <label class="inline-toggle">
      <input type="checkbox" id="..." onchange="...">
      <span>Nonaktif</span>
    </label>
  </div>
</div>
```

**Pola filter-panel** (Recall style — search + filter chip yang expand):
```html
<div class="recall-toolbar">
  <div class="recall-toolbar-main">
    <div class="patients-search-wrap recall-search-wrap">
      <label class="patients-toolbar-label">Cari</label>
      <input id="recallSearchInput" class="search-box" oninput="handleRecallSearch()">
    </div>
    <div class="recall-toolbar-actions">
      <button id="recallFiltersToggleBtn" class="recall-filter-chip" onclick="toggleRecallFilters()">
        <svg>...</svg>
        <span class="recall-filter-chip-label">Filters</span>
        <!-- badge count optional -->
      </button>
      <button id="recallFiltersResetBtn" class="recall-reset-link" style="display:none;">Reset</button>
    </div>
  </div>
  <div id="recallFiltersPanel" class="recall-filter-panel">
    <div class="recall-filter-grid">
      <div class="recall-filter-wrap">
        <label class="patients-toolbar-label">Follow Up Status</label>
        <select onchange="applyRecallFilters(false)">...</select>
      </div>
      ...
    </div>
  </div>
</div>
```

**Aturan**: Aktivitas yang punya >1 filter WAJIB pakai pola Recall (chip + panel collapse + badge count + Reset link).

---

## 2. Pola Frontend — CSS & Theme

### 2.1 Class family per halaman

| Halaman | Prefix class | Style file |
|---|---|---|
| Patients | `patients-*` | `style-patients.html` |
| Appointments | `appointments-*` | `style-appointments.html` |
| Recall | `recall-*` + reuse `patients-*` untuk shell/header | `style-recall.html` |
| Finance | `finance-*` | `style-finance.html` |
| Settings | `settings-*` | `style-settings.html` |
| **Aktivitas** | **HARUS pakai `patients-*` untuk shell/header** (mengikuti Recall), prefix unik `activity-*` cuma untuk komponen yang khas Aktivitas (diff table, dll) | `audit-log.html` `<style>` blok |

### 2.2 Status badge (canonical)

```html
<span class="status-badge completed">Aktif</span>      <!-- hijau -->
<span class="status-badge cancelled">Nonaktif</span>   <!-- merah -->
<span class="status-badge scheduled">Due</span>        <!-- biru/info -->
<span class="status-badge default">Done</span>         <!-- abu -->
```

**Aturan**: Untuk badge status, **WAJIB** pakai class `status-badge` + modifier
(`completed`, `cancelled`, `scheduled`, `default`). **Jangan** bikin family baru
(`settings-badge`, `activity-badge`) kecuali memang concept baru.

### 2.3 Icon button (canonical)

```html
<button class="icon-btn detail" title="Detail" aria-label="Detail" onclick="openXDetail(...)">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
</button>

<button class="icon-btn edit" title="Edit" aria-label="Edit" onclick="...">
  <svg ...> <!-- pencil --> </svg>
</button>

<button class="icon-btn expand" title="..." aria-label="...">
  <svg class="expand-chevron" ...> <!-- chevron-down --> </svg>
</button>
```

**Modifier yang valid**: `detail`, `edit`, `expand`, `kebab` (untuk menu 3-titik
seperti di Finance). Pakai SVG inline 24×24, stroke `currentColor`.

### 2.4 Action button utama

```html
<button class="action-btn {prefix}-create-btn" onclick="openCreateXModal()">+ {Label}</button>
```

### 2.5 Tombol secondary di modal

```html
<button class="btn btn-secondary" onclick="closeXModal()">Batal</button>
<button class="btn btn-primary"   onclick="submitX()">Simpan</button>
```

### 2.6 Dark theme palette

Dari style-modals.html & audit-log.html:
- Modal background: `#161b2e`
- Background-soft (info block): `rgba(255,255,255,0.04)` + border `rgba(255,255,255,0.07)`
- Border-subtle: `rgba(255,255,255,0.10)`
- Border-extra-subtle: `rgba(255,255,255,0.05)`
- Text-primary: `#f1f5f9` atau `#e2e8f0`
- Text-secondary: `#cbd5e1`
- Text-muted: `#94a3b8`
- Text-faint: `#64748b`
- Danger: `#fca5a5` (text) / `rgba(239,68,68,0.10)` (bg) / `#dc2626` (border)
- Success: `#86efac`
- Warning: `rgba(234,179,8,0.12)` (bg)

---

## 3. Pola Frontend — Lifecycle JS & State

### 3.1 State variable scope

**Canonical**: state global per modul, `let` (bukan `var`).

```js
// Patients
let showInactivePatients = false;
let allPatients = [];
let filteredPatients = [];
let patientCurrentPage = 1;
const patientPageSize = 5;
let patientSearchDebounce = null;
let patientFormMode = 'create';
let pendingDeletePatientX = '';
let xPatientInFlight = false;
```

**Aturan**:
- Pakai `let` untuk state mutable, `const` untuk konstanta.
- Naming: `{entity}{Action}` (camelCase).
- In-flight guards: `xxxInFlight = false` per operasi.
- Pending action: `pendingXxxId`, `pendingXxxLabel`.
- Form mode: `xxxFormMode = 'create' | 'edit'`.

### 3.2 Entry point (showXPage)

**Wajib urutan**:
1. `setActiveMenu('menuXxx')`
2. Render `contentArea.innerHTML = \`...\``
3. Restore UI controls dari state (mis. toggle.checked = showInactiveX)
4. **Stale-while-revalidate**: kalau `allX.length > 0`, langsung filter + render dari cache
5. **Reset filter state** kalau halaman ini punya filter (Aktivitas style: `xFiltersApplied = {}`)
6. Panggil `loadX()` untuk fetch fresh

```js
function showPatientsPage() {
  setActiveMenu('menuPatients');
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `...`;

  const toggle = document.getElementById('showInactivePatients');
  if (toggle) toggle.checked = showInactivePatients;

  // Stale-while-revalidate
  if (allPatients && allPatients.length > 0) {
    filteredPatients = allPatients.slice();
    patientCurrentPage = 1;
    renderPatientsTable();
  }

  loadPatients();
}
```

### 3.3 Reset state setiap entry halaman (untuk halaman dengan filter)

Mirror Recall & Aktivitas:
```js
xFiltersExpanded = false;
xFiltersApplied = {};
xCurrentPage = 1;
updateXFilterControls();
```

### 3.4 In-flight guard pattern

```js
function executeDeleteX() {
  if (!pendingDeleteXId || deleteXInFlight) return;

  deleteXInFlight = true;
  setModalProcessingState('confirmDeleteXModal', true, {
    primaryButtonId: 'confirmDeleteXSubmitBtn',
    loadingText: 'Menghapus...'
  });

  google.script.run
    .withSuccessHandler(function(res) {
      deleteXInFlight = false;
      // ...
    })
    .withFailureHandler(function(err) {
      deleteXInFlight = false;
      setModalProcessingState('confirmDeleteXModal', false, {
        primaryButtonId: 'confirmDeleteXSubmitBtn',
        idleText: 'Hapus'
      });
      showToast('Error: ' + err.message, 'error');
    })
    .deleteX(attachAuthContext({ x_id: pendingDeleteXId }));
}
```

**Aturan**:
- Setiap mutation pakai `xInFlight` boolean.
- `setModalProcessingState(modalId, isLoading, { primaryButtonId, loadingText, idleText })`.
- Reset in-flight di **success handler DAN failure handler**.

---

## 4. Pola Frontend — Pagination

### 4.1 Struktur DOM (WAJIB SAMA PERSIS)

```html
<div class="pagination">
  <div class="pagination-nav">
    <button class="pagination-arrow" id="xPrevBtn" onclick="prevXPage()" aria-label="Halaman sebelumnya">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <span class="pagination-label">Page</span>
    <span class="pagination-current" id="xCurrentPage" contenteditable="true"
      onkeydown="if(event.key==='Enter'){goToXPage(this);this.blur();event.preventDefault();}"
      onblur="goToXPage(this)"
      onfocus="var r=document.createRange(),s=window.getSelection();r.selectNodeContents(this);s.removeAllRanges();s.addRange(r);">1</span>
    <span class="pagination-sep">of</span>
    <span class="pagination-total" id="xTotalPages">1</span>
    <button class="pagination-arrow" id="xNextBtn" onclick="nextXPage()" aria-label="Halaman berikutnya">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  </div>
  <div class="pagination-meta">
    <span class="pagination-rows-chip">5 rows</span>
    <span class="pagination-count" id="xPaginationInfo">-</span>
  </div>
</div>
```

**Aturan**:
- `pageSize = 5` (semua canonical halaman).
- Tombol prev/next pakai SVG chevron, bukan teks `<` `>`.
- `pagination-current` adalah `contenteditable` — user bisa ketik nomor langsung.
- `pagination-count` format: `{N} records` (Inggris singkat, sengaja).
- ID elemen pakai prefix halaman: `patient...`, `appointment...`, `recall...`, `activity...`.

### 4.2 Handler pagination

```js
function prevXPage() {
  if (xCurrentPage > 1) {
    xCurrentPage--;
    renderXTable();   // client-side
    // ATAU loadXPage();  untuk server-side (Aktivitas)
  }
}

function nextXPage() { /* mirror */ }

function goToXPage(el) {
  var totalPages = Math.ceil(filteredX.length / xPageSize) || 1;
  var page = parseInt(el.textContent, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  el.textContent = page;
  if (xCurrentPage === page) return;
  xCurrentPage = page;
  renderXTable();
}

function renderXPaginationState(current, total, count) {
  var el = function(id) { return document.getElementById(id); };
  var inp = el('xCurrentPage');
  if (inp && document.activeElement !== inp) inp.textContent = current || 0;
  if (el('xTotalPages'))     el('xTotalPages').textContent     = total || 0;
  if (el('xPaginationInfo')) el('xPaginationInfo').textContent = (count || 0) + ' records';
  var prev = el('xPrevBtn'); if (prev) prev.disabled = current <= 1;
  var next = el('xNextBtn'); if (next) next.disabled = current >= total;
}
```

**Aturan**: Jangan overwrite `textContent` `pagination-current` saat user sedang
mengetik (`document.activeElement !== inp` guard).

### 4.3 Client-side vs Server-side pagination

| Pola | Client-side (canonical) | Server-side |
|---|---|---|
| Dipakai oleh | Patients, Appointments, Recall, Finance | **Aktivitas** (audit_log bisa jutaan row) |
| Data flow | Backend kirim semua → frontend slice per page | Backend kirim per-page + has_next/has_prev |
| Filter | Apply di frontend (`filteredX`) | Apply di backend payload |
| Search | Pakai `_search_text` precomputed | Pakai `actor_search` param ke backend |

**Aktivitas WAJIB server-side** karena volume audit log besar (>10K row dalam beberapa
bulan). Tapi UI/handler harus tetap match canonical struktur.

---

## 5. Pola Frontend — Search & Filter

### 5.1 Search dengan debounce

**Canonical**:
```js
let xSearchDebounce = null;

function handleXSearch() {
  if (xSearchDebounce) clearTimeout(xSearchDebounce);
  xSearchDebounce = setTimeout(function() {
    const input = document.getElementById('xSearchInput');
    const keyword = input ? input.value.trim().toLowerCase() : '';

    if (!keyword) {
      filteredX = [...allX];
    } else {
      filteredX = allX.filter(function(row) {
        return String(row._search_text || '').includes(keyword);
      });
    }

    xCurrentPage = 1;
    renderXTable();
  }, 220);
}
```

**Aturan**:
- Debounce **220 ms** (Patients/Appointments/Recall). Aktivitas pakai 280 ms — *acceptable* karena server roundtrip lebih mahal, tapi pertimbangkan turunkan ke 220 untuk konsistensi.
- Precompute `_search_text` di setiap row saat load — gabungan semua field yang searchable, lowercase, dipisah spasi.
- Search field: hanya fields yang relevan (nama, ID, status, dst).

### 5.2 Toggle filter sederhana

```js
function handleToggleInactiveX() {
  const toggle = document.getElementById('showInactiveX');
  showInactiveX = !!(toggle && toggle.checked);
  xCurrentPage = 1;
  loadX();  // refetch karena filter diapply di server
}
```

### 5.3 Filter panel (Recall pattern — WAJIB untuk Aktivitas)

```js
function toggleXFilters() {
  xFiltersExpanded = !xFiltersExpanded;
  updateXFilterControls();
}

function getActiveXFilterCount() {
  // hitung berapa filter aktif untuk badge chip
}

function updateXFilterControls() {
  const panel = document.getElementById('xFiltersPanel');
  const toggleBtn = document.getElementById('xFiltersToggleBtn');
  const resetBtn = document.getElementById('xFiltersResetBtn');
  const activeCount = getActiveXFilterCount();

  if (panel) panel.classList.toggle('show', !!xFiltersExpanded);
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', !!xFiltersExpanded);
    toggleBtn.innerHTML = `<svg>...</svg><span>Filters</span>${
      activeCount > 0 ? `<span class="recall-filter-chip-count">${activeCount}</span>` : ''
    }`;
  }
  if (resetBtn) resetBtn.style.display = activeCount > 0 ? 'inline-flex' : 'none';
}

function applyXFilters(skipResetPage) {
  // baca semua input filter, set state, set xCurrentPage = 1, renderXTable()
}

function resetXFilters() {
  // clear semua filter input, reset state, render
}
```

---

## 6. Pola Frontend — Tabel & Empty/Loading State

### 6.1 Loading awal

```html
<tbody id="xTableBody">
  <tr><td colspan="6">Memuat data...</td></tr>
</tbody>
```

**Aturan WAJIB**: Loading text = `Memuat data...` (titik 3, bukan `Loading...`).
Tidak pakai spinner / skeleton — plain text. Cell `colspan` = jumlah kolom.

### 6.2 Empty state (kalau hasil filter/search kosong)

```html
<tr>
  <td colspan="6">
    <div class="patients-empty-state">
      <div class="patients-empty-title">Data {x} tidak ditemukan</div>
      <div class="patients-empty-subtitle">Coba ubah kata kunci pencarian</div>
    </div>
  </td>
</tr>
```

**Aturan**:
- Bungkus div empty state — JANGAN plain `<td>Tidak ada data</td>`.
- Class `patients-empty-state` boleh direuse semua halaman (atau bikin `{prefix}-empty-state` yang style-nya cascade).
- Title dan subtitle 2-line — title bold, subtitle muted.

### 6.3 Error state

```html
<tr>
  <td colspan="6">Error: {pesan}</td>
</tr>
```

Dipasangkan dengan `showToast(msg, 'error')` untuk feedback ganda.

### 6.4 Tabel structure

```html
<div class="table-wrapper">
  <table class="table {prefix}-table">
    <thead>
      <tr>
        <th>Kolom 1</th>
        ...
      </tr>
    </thead>
    <tbody id="xTableBody">...</tbody>
  </table>
</div>
```

**Aturan**:
- `<div class="table-wrapper">` untuk overflow horizontal.
- `<table class="table">` base + prefix-specific.
- Jika tabel butuh column width fixed → `style="table-layout:fixed;width:100%"` pada `<table>` + `style="width:N%"` pada `<th>`. Aktivitas sudah pakai pola ini — pertahankan.

---

## 7. Pola Frontend — Modal (Detail, Form, Confirm)

### 7.1 Class family modal canonical

| Use case | Wrapper class | Box class |
|---|---|---|
| Form CRUD (Patient, Appointment, Recall contact) | `modal` (+ `hidden` saat tertutup) | `modal-box` atau `modal-box modal-box-sticky` |
| Detail readonly (Patient detail, Appointment detail) | `modal` | `modal-box modal-box-sticky detail-modal-box-sticky` |
| Confirm (delete, cancel) | `modal` | `modal-box` + body khusus |

**HINDARI** family `settings-modal-overlay` / `settings-modal-box` kecuali halaman
itu memang Settings.

### 7.2 Modal sticky (form/detail dengan scroll)

```html
<div id="xModal" class="modal hidden">
  <div class="modal-box modal-box-sticky x-modal-box">
    <div class="detail-modal-header-sticky">
      <h2 class="detail-modal-title-sticky" id="xModalTitle">Judul Modal</h2>
      <button type="button" class="detail-close-btn" onclick="closeXModal()" aria-label="Tutup modal" title="Tutup">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M6 6l12 12"></path>
          <path d="M18 6l-12 12"></path>
        </svg>
      </button>
    </div>

    <div class="modal-form-scroll">
      <!-- isi form / detail di sini -->

      <div class="modal-actions modal-actions-right">
        <button class="btn btn-secondary" onclick="closeXModal()">Batal</button>
        <button class="btn btn-primary" id="xSubmitBtn" type="submit">Simpan</button>
      </div>
    </div>
  </div>
</div>
```

**Aturan close button**:
- Pakai class `detail-close-btn` (BUKAN `×` HTML entity atau `&#x2715;`).
- Pakai SVG inline 2-path X (`M6 6l12 12` + `M18 6l-12 12`).
- `aria-label` & `title` selalu ada.

### 7.3 Modal open/close lifecycle

```js
function openXModal() {
  // optional: reset error, fill form, dll
  clearXErrors();
  setXFormMode(...);

  const modal = document.getElementById('xModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
  }
}

function closeXModal() {
  xSubmitInFlight = false;
  setModalProcessingState('xModal', false, {
    primaryButtonId: 'xSubmitBtn',
    idleText: 'Simpan'
  });

  const modal = document.getElementById('xModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}
```

**Aturan**:
- Toggle DUA-nya: `display` style + `hidden` class (keduanya).
- Selalu reset `xInFlight` + `setModalProcessingState` di close.
- Optimasi UX: untuk modal Edit, **buka instan dari data lokal** (`getLocalXById`)
  → tidak perlu round-trip kalau data ada. Fallback ke server kalau tidak.

### 7.4 Form error display

```html
<label>Nama</label>
<input type="text" id="x_full_name">
<div id="error_x_full_name" class="field-error"></div>
```

```js
function clearXErrors() {
  const ids = ['x_full_name', 'x_gender', ...];
  ids.forEach(function(id) {
    const err = document.getElementById('error_' + id);
    if (err) err.textContent = '';
    const inp = document.getElementById(id);
    if (inp) inp.classList.remove('input-error');
  });
}

function applyXErrors(errors) {
  if (!errors) return;
  Object.keys(errors).forEach(function(field) {
    const err = document.getElementById('error_x_' + field);
    if (err) err.textContent = errors[field];
    const inp = document.getElementById('x_' + field);
    if (inp) inp.classList.add('input-error');
  });
}
```

### 7.5 Confirm modal (delete, cancel, dll)

Untuk konfirmasi simpel pakai `showAppConfirm(...)` (canonical helper di scripts.html).
Kalau butuh form input (alasan, dll), bikin modal khusus.

---

## 8. Pola Frontend — Komunikasi google.script.run

### 8.1 Wrap payload dengan attachAuthContext

**Canonical (Patients, Appointments, Recall, Finance)**:
```js
google.script.run
  .withSuccessHandler(function(res) { ... })
  .withFailureHandler(function(err) { ... })
  .getPatients(attachAuthContext({ show_inactive: !!showInactivePatients }));
```

**Aturan**:
- **WAJIB** pakai `attachAuthContext(payload)` — ini helper yang otomatis inject
  `session_token` + clinic_id + meta lain.
- **JANGAN** manual: `{ session_token: getCurrentSessionToken(), ... }` (yang dipakai
  Aktivitas saat ini — GAP).
- Setiap call **WAJIB** ada `withSuccessHandler` + `withFailureHandler`.

### 8.2 Response shape canonical

```js
// Sukses
{ success: true, data: <array atau object> }

// Gagal validasi/business
{ success: false, message: 'Pesan Indonesia user-friendly', errors?: { field: 'pesan' } }

// Gagal auth
{ success: false, message: 'Sesi habis. Silakan login ulang.' }
```

**Aturan handling di frontend**:
```js
.withSuccessHandler(function(res) {
  if (!res || res.success === false) {
    showToast((res && res.message) || 'Gagal memuat data', 'error');
    return;
  }
  // res.data adalah hasil sebenarnya
})
```

### 8.3 Toast notification

- Sukses: `showToast('Data berhasil disimpan', 'success')`
- Error: `showToast('Error: ' + msg, 'error')` atau `showToast(msg, 'error')`
- Info: `showToast(msg, 'info')` (jarang dipakai)

---

## 9. Pola Frontend — Naming Convention

### 9.1 Function naming

| Tujuan | Pattern | Contoh canonical | Anti-pattern Aktivitas |
|---|---|---|---|
| Entry page | `show{Entity}Page()` | `showPatientsPage()` | `showActivityPage()` ✓ OK |
| Load list | `load{Entities}()` | `loadPatients()`, `loadAppointments()`, `loadRecallList()` | `activityLoadPage_()` ✗ |
| Render table | `render{Entity}Table()` | `renderPatientsTable()` | `activityRenderBody_()` ✗ |
| Search handler | `handle{Entity}Search()` | `handlePatientSearch()` | `activityOnSearchInput_()` ✗ |
| Pagination | `prev{Entity}Page()`, `next{Entity}Page()`, `goTo{Entity}Page()` | `prevPatientPage()` | `activityPrevPage_()` ✗ |
| Open modal | `open{Action}{Entity}Modal()` | `openCreatePatientModal()`, `openEditPatientModal()`, `openPatientDetail()` | `activityOpenDetail_()` ✗ |
| Close modal | `close{Entity}{Action}Modal()` | `closePatientPhotoUploadModal()` | `activityCloseDetail_()` ✗ |
| Submit | `submit{Entity}()` atau `submit{Entity}{Action}()` | `submitRecallContact()` | n/a |
| Apply filter | `apply{Entity}Filters()` | `applyRecallFilters()` | `activityApplyFilter_()` ✗ |
| Reset filter | `reset{Entity}Filters()` | `resetRecallFilters()` | `activityResetFilter_()` ✗ |

**Aturan**:
- **JANGAN** pakai trailing underscore di function frontend. Trailing underscore di
  Apps Script artinya "internal/private" — itu konvensi **backend** (mis. `writeAuditLog_`,
  `querySupabaseAuditLog_`). Frontend semua public.
- CamelCase verb-first, **bukan** noun-first.
- Sebut entitas lengkap: `patient`, bukan `pat`. `appointment`, bukan `appt`.

### 9.2 Variable naming

| Pattern | Contoh canonical | Anti-pattern Aktivitas |
|---|---|---|
| Array semua data | `all{Entities}` | `allPatients`, `allAppointments`, `allRecallRows` | `activityRows` ✗ (ambigu — page rows atau all rows?) |
| Array hasil filter | `filtered{Entities}` | `filteredPatients` | n/a |
| Current page | `{entity}CurrentPage` | `patientCurrentPage` | `activityPageNumber` ✗ (sebut "Page", bukan "PageNumber") |
| Page size const | `{entity}PageSize` | `const patientPageSize = 5` | `activityPageSize` ✓ OK |
| Search debounce | `{entity}SearchDebounce` | `patientSearchDebounce` | `activitySearchDebounce` ✓ OK |
| In-flight | `{action}{entity}InFlight` | `deletePatientPhotoInFlight` | `activityLoading` ✗ (gunakan `loadActivityInFlight` atau ikut canonical `xInFlight`) |
| Form mode | `{entity}FormMode` | `patientFormMode` | n/a |

### 9.3 ID DOM convention

Pakai prefix halaman + camelCase:
- `patientSearchInput`, `patientsTableBody`, `patientCurrentPage`, `patientPrevBtn`
- `appointmentSearchInput`, `appointmentsTableBody`
- `recallSearchInput`, `recallTableBody`, `recallFiltersPanel`
- Aktivitas: `activitySearchActor`, `activityTbody` — **inkonsisten** dengan canonical
  (`activityTableBody` lebih baik).

### 9.4 CSS class convention

Kebab-case, prefix halaman: `patient-cell-primary`, `appointment-expand-row`,
`recall-filter-chip`. Untuk Aktivitas: `activity-time-main`, `activity-diff-row` — OK
(prefix konsisten). Tapi untuk elemen yang reuse pola lain (toolbar, pagination),
**JANGAN bikin prefix baru** — reuse `recall-*` / `patients-*` (sudah dilakukan).

---

## 10. Pola Frontend — Utility & Helper

### 10.1 Escape HTML

**Canonical** (di scripts.html / patients.html):
```js
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

Aktivitas pakai `escapeAppHtml` — **konsolidasi**: jadikan `escapeHtml` saja (atau
pastikan `escapeAppHtml` dan `escapeHtml` identik dan sudah jadi alias).

### 10.2 Format tanggal

| Kebutuhan | Fungsi canonical | Output |
|---|---|---|
| `YYYY-MM-DD` → `DD-MM-YYYY` | `convertYmdToDmy(s)` atau `formatDateDmy(s)` | `19-05-2026` |
| ISO datetime → tanggal Indonesia | `formatAppointmentDateDisplay(s)` | `19-05-2026` |
| Time `HH:MM` extract | `formatAppointmentTimeDisplay(s)` | `14:30` |
| Today YMD | `getTodayYmd()` / `getTodayYmdLocal()` | `2026-05-19` |

Aktivitas pakai format slash (`19/05/2026`) — **inkonsisten**. Canonical pakai dash.

### 10.3 Format mata uang

```js
function formatRupiah(value) {
  const num = Number(value || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}
```

### 10.4 Safe ID untuk inline onclick

```js
const safePatientId = String(row.patient_id || '').replace(/'/g, "\\'");
// ... onclick="openPatientDetail('${safePatientId}')"
```

---

## 11. Pola Backend — Endpoint Signature

### 11.1 Naming endpoint Apps Script

| Operasi | Pattern | Contoh |
|---|---|---|
| List | `get{Entities}` | `getPatients`, `getAppointments`, `getOrthoRecallList` |
| Detail | `get{Entity}ById` | `getPatientById`, `getAppointmentById` |
| Create | `create{Entity}` | `createPatient`, `createAppointment` |
| Update | `update{Entity}` | `updatePatient`, `updateAppointment` |
| Delete | `delete{Entity}` | `deletePatient`, `deletePatientPhoto` |
| State change | `{verb}{Entity}` | `cancelAppointment`, `restoreAppointment`, `deactivatePatient` |
| Audit-specific | (cuma 1, sudah ada) | `getAuditLogPage` |

### 11.2 Signature

```js
function getX(payload) {
  try {
    // 1. Auth
    const auth = requireRole(payload, ['admin_appointment', 'admin_finance']);
    if (!auth.success) return auth;

    // 2. Extract & sanitize input
    const p = payload || {};
    const someParam = String(p.some_param || '').trim();

    // 3. Business logic
    const rows = ...;

    // 4. Return
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, message: 'Gagal {operation}: ' + (err.message || err) };
  }
}
```

### 11.3 Dual signature (frontend payload vs internal call)

Lihat `PatientService.js:138-181`:
```js
function getPatients(payloadOrFlag, optionsArg) {
  let payload, isPayloadMode;
  if (typeof payloadOrFlag === 'object' && payloadOrFlag !== null) {
    payload = payloadOrFlag;
    isPayloadMode = true;
  } else {
    isPayloadMode = false;
    // signature lama untuk internal/test
  }

  if (isPayloadMode) {
    const auth = requireRole(payload, [...]);
    if (!auth.success) return auth;
  }

  // ... business logic ...

  return isPayloadMode ? { success: true, data: sorted } : sorted;
}
```

**Aturan**: Kalau endpoint juga dipakai internal (script trigger, test), bikin dual
signature supaya backward compatible.

---

## 12. Pola Backend — Auth, Role, Clinic Scope

### 12.1 Role enforcement

```js
const auth = requireRole(payload, ['admin_appointment', 'admin_finance']);
if (!auth.success) return auth;
```

**Aturan**:
- Setiap endpoint mutasi **WAJIB** dimulai dengan `requireRole(...)`.
- Daftar role yang valid (lihat memory `role_concept_2026_05_16`):
  - `owner` (≡ super_admin)
  - `super_admin`
  - `admin_appointment`
  - `admin_finance`
  - `doctor`
- `requireRole` otomatis include owner/super_admin → tidak perlu sebut eksplisit.
- Untuk endpoint owner-only: `requireRole(payload, ['owner', 'super_admin'])` atau bikin helper khusus.

### 12.2 Clinic scope

```js
const clinicId = String(
  (auth.user && auth.user.clinic_id) ||
  (typeof getCurrentClinicId_ === 'function' ? getCurrentClinicId_() : '')
).trim();
if (clinicId) {
  // ... filter dengan clinic_id
}
```

**Aturan**:
- Semua query WAJIB di-scope ke `clinic_id` user.
- Kecuali: super_admin/owner yang explicit lintas-klinik (jarang).

### 12.3 Role-based data visibility (advanced)

Lihat `AuditLogQueryService.js:22-33`:
```js
const AUDIT_LOG_ROLE_ALLOWED_ENTITY_TYPES = {
  owner:             null,                              // semua
  super_admin:       null,
  admin_appointment: ['patient', 'appointment', ...],   // whitelist
  admin_finance:     ['billing', 'payment', ...],
  doctor:            []                                  // deny
};
```

Pola ini OK untuk Aktivitas. Untuk endpoint lain yang butuh visibility per-role,
ikuti pola ini.

### 12.4 Role-based UI hints from backend (canonical pattern — Aktivitas-originated)

**Pola**: Backend yang punya visibility rules **wajib** kirim daftar opsi yang
diizinkan ke frontend sebagai bagian dari response. Frontend pakai daftar ini
untuk render dropdown / filter / menu — TIDAK pernah hardcode daftar di frontend.

**Contoh canonical** (`AuditLogQueryService.js:96, 274`):
```js
// Backend response:
return {
  success: true,
  data: {
    rows: [...],
    allowed_entity_types: allowedEntityTypes,  // null = all, [...] = whitelist
    ...
  }
};
```

```js
// Frontend (audit-log.html):
var activityAllowedEntityTypes = data.allowed_entity_types || null;

function activityBuildEntityTypeOptions_() {
  var list = Array.isArray(activityAllowedEntityTypes)
    ? activityAllowedEntityTypes.slice()
    : Object.keys(ACTIVITY_ENTITY_TYPE_LABELS);  // fallback: tampilkan semua
  // ... render <option> berdasarkan list
}
```

**Aturan**:
- Backend = **single source of truth** untuk visibility per-role. Konstanta
  `XXX_ROLE_ALLOWED_*` didefinisikan di service file backend.
- Response **wajib** include `allowed_*` field saat data list/filter dependen role.
- Frontend pakai daftar yang dikirim backend. **JANGAN** duplikat logika role-check
  di frontend (rawan drift kalau aturan berubah).
- Fallback: kalau `allowed_*` null/undefined, frontend boleh tampilkan default lengkap
  (mis. semua opsi konstanta lokal). Tapi prefer eksplisit `null` dari backend untuk
  "semua boleh".

**Kapan adopt**:
- Endpoint baru yang punya visibility kompleks per-role (lebih dari sekedar
  allow/deny seluruh endpoint).
- Halaman dengan dropdown filter yang isinya bergantung role.
- Halaman dengan menu/action yang muncul/hilang berdasarkan role.

**Kapan TIDAK perlu**:
- Endpoint yang full-allow ke role tertentu (cukup `requireRole` saja).
- Halaman read-only yang sama untuk semua role yang punya akses.

---

## 13. Pola Backend — Validation, Response, Audit Emission

### 13.1 Urutan validasi

1. **Auth** (`requireRole`)
2. **Schema** (field wajib ada, format benar)
3. **Business** (cek conflict, ownership, dll)
4. **Database operation**
5. **Audit log emission**
6. **Return**

### 13.2 Audit log emission

**Canonical** (lihat `AuditLogService.js:1-96`):
```js
const oldRow = findXById_(xId);
// ... lakukan update ...
const newRow = ...;

writeAuditLog_({
  actor: auth.user,
  entity_type: 'patient',
  entity_id: patientId,
  action: 'update',
  old_value: oldRow,
  new_value: newRow,
  notes: ''
});
```

**Aturan**:
- Setiap mutation **wajib** emit audit log.
- `entity_type` pakai snake_case singular: `patient`, `appointment`, `treatment`,
  `ortho_recall`, `billing`, `payment`, `expense`, `service_catalog`, `clinic_info`,
  `user`, dll. (Daftar lengkap di `audit-log.html:174-190` constant
  `ACTIVITY_ENTITY_TYPE_LABELS`).
- `action` pakai snake_case verb: `create`, `update`, `delete`, `cancel`, `restore`,
  `activate`, `deactivate`, `complete`, `submit`, `replace`, `clear`,
  `save_contact`, `confirm_doctor_fee`, dll. (lihat `ACTIVITY_ACTION_LABELS`).
- **Audit log gagal TIDAK boleh blocking mutation utama** — `writeAuditLog_` sudah
  swallow error secara internal.

### 13.3 Response shape

```js
// Sukses dengan data
return { success: true, data: rows };

// Sukses tanpa data (operasi mutasi)
return { success: true, message: 'Pasien berhasil disimpan' };

// Validasi gagal per-field
return {
  success: false,
  message: 'Validasi gagal',
  errors: {
    full_name: 'Nama wajib diisi',
    phone: 'Format nomor HP tidak valid'
  }
};

// Generic error
return { success: false, message: 'Gagal memuat data: ...' };
```

---

## 14. i18n — Label & Format Indonesia

### 14.1 Label UI

**WAJIB Indonesia** untuk semua label, button, error, toast, modal title, dll.
Boleh tetap Inggris untuk:
- Technical: `Patient ID`, `Patient Code`, `Email`
- Status badge: `Active`, `Completed`, `Cancelled`, `Due`, `Overdue`, `Reached Target`
  (kalau Inggris sudah jadi konvensi di domain medis). Indonesia untuk badge di
  Aktivitas (`Tambah`, `Ubah`, `Hapus`) **konsisten** — lanjutkan.

### 14.2 Format tanggal

- Tabel/display: `DD-MM-YYYY` (dash, bukan slash) — `19-05-2026`.
- Datetime display: `DD-MM-YYYY HH:MM` — `19-05-2026 14:30`.
- Storage: `YYYY-MM-DD` (ISO, untuk database).
- **Aktivitas saat ini pakai slash** — perlu diubah ke dash agar konsisten dengan
  Patients/Appointments/Recall.

### 14.3 Format angka

- Rupiah: `Rp 1.500.000` (locale id-ID, prefix `Rp ` dengan spasi).
- Count: `123 records` (sengaja Inggris — lihat pola pagination canonical, semua halaman pakai ini).

### 14.4 Status badge label

Indonesia lebih natural untuk badge Aktivitas action (Tambah, Ubah, Hapus). Untuk
entity_type Aktivitas, lanjutkan pakai label Indonesia (Pasien, Appointment, Tagihan).

---

## 15. GAP ANALYSIS — Aktivitas vs Canonical

Berikut **inkonsistensi terverifikasi** yang ditemukan di `audit-log.html` /
`AuditLogQueryService.js` vs canonical Patients/Appointments/Recall/Finance.
**Wajib dibetulkan** kecuali ada alasan kuat (lihat Section 16).

### A. Struktur HTML & wrapper

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| A1 | Wrapper `settings-shell` | `audit-log.html:229` | `patients-shell` (semua halaman utama) | Ganti ke `patients-shell` |
| A2 | Header `settings-header` | `audit-log.html:230` | `patients-header` | Ganti ke `patients-header` |
| A3 | Title classes `owner-eyebrow`, `owner-title`, `owner-subtitle` | `audit-log.html:231-233` | `patients-eyebrow`, `patients-title`, `patients-subtitle` | Ganti semua |
| A4 | Empty state class `settings-empty-state` | `audit-log.html:402-405` | `patients-empty-state` (atau `recall-empty-state` kalau ada — cek; saat ini `patients-empty-state` dipakai juga di Recall) | Ganti ke `patients-empty-state` |

### B. Modal

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| B1 | Modal wrapper `settings-modal-overlay` | `audit-log.html:674` | `modal` (+ `hidden` toggle) | Ganti ke `<div class="modal hidden" id="...">` |
| B2 | Modal box `settings-modal-box settings-modal-box--wide` | `audit-log.html:675` | `modal-box modal-box-sticky detail-modal-box-sticky` (utk detail readonly besar) | Ganti ke pola sticky |
| B3 | Modal header `settings-modal-head` / title `settings-modal-title` | `audit-log.html:676-677` | `detail-modal-header-sticky` / `detail-modal-title-sticky` | Ganti |
| B4 | Close button isi pakai `&#x2715;` (character) | `audit-log.html:678` | SVG inline 2-path X | Ganti ke SVG canonical (lihat 7.2) |
| B5 | Modal footer `settings-modal-footer` + tombol di luar body | `audit-log.html:690-693` | Tombol di dalam `modal-form-scroll` pakai `modal-actions modal-actions-right` | Pindahkan tombol ke dalam body, ganti class |
| B6 | Buka modal pakai `.classList.add('open')` | `audit-log.html:729` | `display:flex` + `.classList.remove('hidden')` | Ganti ke pola canonical |
| B7 | Tombol "Tutup" di footer terpisah (`settings-modal-footer`) di luar body | `audit-log.html:690-693` | Tombol di dalam `modal-form-scroll` pakai `<div class="modal-actions modal-actions-right">` | Pindahkan tombol ke body, hapus footer block (lihat Q3 di Section 16 — sudah diputuskan) |

### C. Badge & status

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| C1 | Badge `settings-badge`, `settings-badge-active`, `settings-badge-inactive` untuk entity/action | `audit-log.html:489, 497-501, 717` | `status-badge` + modifier (`completed`, `cancelled`, `scheduled`, `default`) | Mapping: positive→`completed`, danger→`cancelled`, neutral→`default`, action→`scheduled` |

### D. Naming JS (trailing underscore di frontend)

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| D1 | `activityLoadPage_`, `activityRenderBody_`, `activityPrevPage_`, dll (~20 fungsi) | sepanjang `audit-log.html` | Tanpa underscore: `loadActivity`, `renderActivityTable`, `prevActivityPage` | Rename semua frontend function — trailing `_` cuma untuk backend privat |
| D2 | `escapeAppHtml` | `audit-log.html:412, 416, ...` | `escapeHtml` | Konsolidasi (atau pastikan alias) |
| D3 | `activityPageNumber` (canonical: `currentPage`) | state | `activityCurrentPage` | Rename |
| D4 | `activityRows` (ambigu — page-rows, bukan all) | state | Tetap `activityRows` OK kalau server-side, tapi dokumentasikan beda |
| D5 | `activityLoading` boolean | state | Canonical pakai `loadXInFlight` | Rename `loadActivityInFlight` |
| D6 | `activityTbody` (DOM ID) | `audit-log.html:296` | Canonical: `activityTableBody` | Rename |

### E. Variable declaration

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| E1 | `var activityRows = []`, `var activityPageNumber = 1`, dll | `audit-log.html:158-171` | `let` (Patients/Recall) | Ganti `var` → `let` (kecuali `const` untuk konstanta) |

### F. Auth & payload

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| F1 | Manual `session_token: getCurrentSessionToken()` di payload | `audit-log.html:353-355` | `attachAuthContext(payload)` | Ganti ke `attachAuthContext({ page_number, page_size, ...filters })` |

### G. Format & i18n

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| G1 | Tanggal pakai slash `19/05/2026` | `audit-log.html:480-483, 742-743` | Dash `19-05-2026` | Ganti separator slash → dash di `activityFormatTimestamp_` & `activityFormatTimestampLong_` |

### H. Lifecycle / pagination behavior

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| H1 | Debounce 280 ms | `audit-log.html:171` | 220 ms (Patients/Appointments/Recall) | Turunkan ke 220 ms (optional — debatable karena server-roundtrip lebih mahal; bisa juga **diskusi**: tetap 280 untuk Aktivitas?) |
| H2 | Filter date `<input type="date">` tanpa label format ID | `audit-log.html:261, 265` | Canonical date inputs di Patients juga pakai `type="date"` (OK) — tapi label “Dari tanggal” / “Sampai tanggal” formatnya konsisten | OK, no fix needed |

### I. Server-side pagination (KEPT, but ensure consistency)

Server-side pagination Aktivitas adalah **trade-off yang OK** (audit_log bisa
jutaan row), tapi:

| # | Item | Status |
|---|---|---|
| I1 | UI handler `prev/next/goTo` tetap match canonical signature | ✓ Sudah |
| I2 | DOM struktur pagination tetap pakai canonical class | ✓ Sudah |
| I3 | Response shape `has_next`/`has_prev`/`total_pages` valid | ✓ Sudah (well-designed) |
| I4 | **Belum ada stale-while-revalidate untuk filter change** | ✗ Saat ganti filter, langsung flash loading. Pertimbangkan tetap render data lama dengan opacity dimmed sampai response masuk |

### J. Backend pattern

| # | Inkonsistensi | Lokasi | Canonical | Fix |
|---|---|---|---|---|
| J1 | `requireRole(payload, ['admin_appointment', 'admin_finance'])` benar | `AuditLogQueryService.js:93` | Sama dengan PatientService | ✓ Konsisten |
| J2 | Custom URL builder `querySupabaseAuditLog_` (perlu karena multi-filter pada kolom yang sama) | `AuditLogQueryService.js:349-395` | PatientRepository pakai `supabaseSelect_` (single-key object) | **OK keep** — alasan teknis valid; tapi tambahkan komentar referensi |

---

## 16. Pola Aktivitas yang Belum Ada di Canonical — KEPUTUSAN FINAL

Berikut hal-hal di Aktivitas yang **tidak ada padanan** di Patients/Appointments/Recall
DAN tidak ada di Finance. Berikut keputusan final setelah diskusi owner
(2026-05-19), beserta justifikasi.

### Q1. Diff table (old_value vs new_value side-by-side) — **KEEP**

**Status**: Unik di Aktivitas. Color-coded cells dengan class `activity-diff-*`.

**Keputusan**: **PERTAHANKAN apa adanya** — tidak ada change.

**Justifikasi**:
- Diff visualization adalah **nilai inti** halaman Aktivitas. Tanpa ini, owner
  cuma tahu "ada perubahan" tapi tidak tahu APA yang berubah.
- Color coding (kuning=changed, hijau=added, merah=removed) sudah pola industri
  standar (Git diff, Google Docs revision history).
- Class naming `activity-diff-*` sudah konsisten dengan konvensi prefix per-halaman.
- Tidak ada pola serupa di canonical karena memang use-case berbeda.

**Future polish (non-blocker)**: Grid `170px 1fr 1fr` sebaiknya tambah breakpoint
untuk layar sempit (mobile). Tapi ini optional.

### Q2. Server-side pagination shape (`has_next`, `has_prev`, `total_count`, `total_pages`) — **KEEP**

**Status**: Aktivitas pakai struktur boolean explicit dari backend. Canonical
(client-side) tidak punya konsep ini.

**Keputusan**: **PERTAHANKAN struktur boolean explicit** — tidak ada change.

**Justifikasi**:
- Boolean `has_next` memang **redundant** secara matematis dengan
  `page_number < total_pages`, TAPI:
  - **Server-of-truth**: Race condition aman — backend kasih state terkini
    berdasarkan data nyata, bukan derive di frontend yang bisa drift.
  - **Reduce bug surface**: Hitung sekali di backend (yang sudah punya total
    count), bukan berulang di setiap render.
  - **Standar REST pagination**: Banyak API enterprise kirim flag eksplisit.
- Payload cost ±8 byte — negligible.

### Q3. Detail modal footer (tombol "Tutup" di luar body) — **FIX**

**Status**: Saat ini ada `settings-modal-footer` block terpisah dari body.

**Keputusan**: **PINDAHKAN tombol ke dalam body**. Hapus footer block.

**Justifikasi**:
- Canonical (Patient detail, Appointment detail) tidak pakai footer terpisah —
  semua tombol di dalam scroll area pakai `modal-actions modal-actions-right`.
- Visual rhythm konsisten = mata user tidak relearning per-halaman.
- 1 tombol di `modal-actions modal-actions-right` tetap rapi (kanan-rata).

**Pattern target** (sudah ditambahkan ke Section 15-B item B7):
```html
<div class="modal-form-scroll">
  <!-- ... isi detail / diff ... -->
  <div class="modal-actions modal-actions-right">
    <button type="button" class="btn btn-secondary" onclick="closeActivityDetail()">Tutup</button>
  </div>
</div>
```

### Q4. Actor search via lookup ke `app_users` — **KEEP**

**Status**: Backend `querySupabaseAuditLogActors_` lookup `app_users` dulu (cari by
nama/username/user_id), baru filter `audit_log` pakai user_ids hasil lookup.

**Keputusan**: **PERTAHANKAN pola 2-step lookup** — tidak ada change.

**Justifikasi**:
- **Performa**: User mau search "by nama", tapi `audit_log.actor_user_id` cuma
  simpan ID (mis. `USR-0042`). Tanpa lookup ke `app_users`, tidak ada cara cari by
  nama tanpa data redundancy yang lebih buruk.
- **Separation of concerns**: `audit_log` simpan minimal columns (immutable,
  append-only, growth tinggi). `app_users` punya nama lengkap.
- **Keamanan**: Sudah ada sanitization input di line 308
  (`replace(/[(),.*%_]/g, '')`) untuk cegah PostgREST injection. Bagus.
- Trade-off: 1 extra query, tapi search jarang dipakai dibanding pagination
  navigation.

**Aturan future**: Kalau nanti butuh "cari semua aktivitas pasien X" (search by
entity), bikin endpoint **terpisah** (`getAuditLogByEntity`). JANGAN overload
`getAuditLogPage`.

### Q5. `allowed_entity_types` dikirim ke frontend — **KEEP & PROMOTE jadi canonical**

**Status**: Backend kirim `allowed_entity_types` array ke frontend untuk drive
dropdown filter dinamis. Pola ini bagus.

**Keputusan**: **PERTAHANKAN + DOKUMENTASIKAN sebagai pola canonical baru**.

**Action sudah dilakukan**: Tambah Section 12.4 "Role-based UI hints from backend"
yang dokumentasikan pola ini. Endpoint future yang punya visibility kompleks
per-role wajib ikuti pola ini.

**Justifikasi**:
- **Single source of truth**: Backend punya satu konstanta. Frontend tinggal
  render — tidak ada duplicate config (rawan drift).
- **UX bagus**: Doctor login → dropdown filter entitas otomatis kosong. Owner
  login → semua opsi muncul.
- **Future-proof**: Saat sistem tumbuh (mis. dokter cuma boleh lihat appointment
  dirinya), pola ini jadi standar.

---

## 17. Checklist Wajib Sebelum Commit Aktivitas

Setiap perubahan di Aktivitas — bug fix kecil atau fitur baru — **WAJIB** lulus
checklist ini sebelum commit:

### Frontend HTML

- [ ] Wrapper utama `<div class="patients-shell">` (BUKAN `settings-shell`)
- [ ] Header `<div class="patients-header">` dengan `patients-eyebrow`/`patients-title`/`patients-subtitle`
- [ ] Tabel dibungkus `<div class="content-card">` → `<div class="table-wrapper">` → `<table class="table">`
- [ ] Loading state plain text `Memuat data...` dengan `<td colspan="...">`
- [ ] Empty state pakai `patients-empty-state` (atau alias yang sudah ada di style canonical)
- [ ] Pagination struktur DOM **persis sama** dengan canonical (SVG chevron, contenteditable, "of", "5 rows", "N records")
- [ ] Modal pakai `class="modal hidden"` + `modal-box modal-box-sticky` + `detail-modal-header-sticky`
- [ ] Close button pakai class `detail-close-btn` + SVG 2-path X (bukan `&#x2715;`)
- [ ] Filter panel pakai pola recall (chip + panel + reset link)
- [ ] Badge pakai `status-badge` + modifier valid (`completed`/`cancelled`/`scheduled`/`default`)
- [ ] Icon button pakai `icon-btn` + modifier (`detail`/`edit`/`expand`)
- [ ] Tombol action pakai `btn btn-primary` / `btn btn-secondary` / `action-btn`

### Frontend JS

- [ ] State variable `let` (bukan `var`), naming canonical (`all{Entities}`, `filtered{Entities}`, `{entity}CurrentPage`, dll)
- [ ] Function naming verb-first camelCase, **TANPA** trailing underscore
- [ ] Lifecycle entry: setActiveMenu → render → restore controls → stale-while-revalidate → loadX
- [ ] Reset filter state setiap entry halaman (`xFiltersApplied = {}`, `xFiltersExpanded = false`)
- [ ] Search debounce 220 ms (atau alasan dokumentasi kalau beda)
- [ ] Setiap row precompute `_search_text` (lowercase, fields yang searchable)
- [ ] Pagination handler: `prev`, `next`, `goTo` dengan guard `document.activeElement !== inp`
- [ ] In-flight guard: `xInFlight` boolean, reset di success **dan** failure handler
- [ ] Modal open/close: toggle `display:flex/none` + class `hidden` (DUA-nya)
- [ ] `setModalProcessingState(modalId, isLoading, { primaryButtonId, loadingText, idleText })`
- [ ] Format tanggal display: dash `DD-MM-YYYY`, bukan slash
- [ ] Format Rupiah: `formatRupiah(value)` → `Rp 1.500.000`
- [ ] Escape HTML pakai `escapeHtml` (atau alias `escapeAppHtml`)

### Frontend komunikasi server

- [ ] **WAJIB** pakai `attachAuthContext(payload)` — bukan manual `session_token`
- [ ] **WAJIB** ada `withSuccessHandler` + `withFailureHandler`
- [ ] Handle `res.success === false` → `showToast(res.message, 'error')`
- [ ] Handle network failure → `showToast('Error: ' + err.message, 'error')`

### Backend

- [ ] Function naming canonical: `getX`, `getXById`, `createX`, `updateX`, `deleteX`, atau `{verb}X`
- [ ] Mulai dengan `const auth = requireRole(payload, [...])` + `if (!auth.success) return auth;`
- [ ] Scope ke `clinic_id` user (kecuali super_admin lintas-klinik eksplisit)
- [ ] Validasi schema → business → DB → audit log
- [ ] Mutation **wajib** emit `writeAuditLog_({ actor, entity_type, entity_id, action, old_value, new_value, notes })`
- [ ] `entity_type` & `action` pakai snake_case dari daftar canonical (lihat 13.2)
- [ ] Wrap try-catch — return `{ success: false, message }` di catch
- [ ] Response shape: sukses `{ success: true, data }`, error `{ success: false, message, errors? }`
- [ ] Trailing underscore untuk helper privat backend (`writeAuditLog_`, `querySupabaseAuditLog_`)

### Keamanan & performa

- [ ] Sanitize input dari user sebelum query (lihat `querySupabaseAuditLogActors_` line 308 sebagai contoh)
- [ ] Jangan log sensitive data (password, totp_secret, dll) ke audit_log
- [ ] Server-side pagination untuk Aktivitas (audit_log besar) — JANGAN ambil semua
- [ ] `_search_text` precompute di load time, bukan di setiap render

### i18n

- [ ] Label UI Indonesia (kecuali technical seperti "Patient ID")
- [ ] Tanggal display dash format DD-MM-YYYY
- [ ] Toast/error message Indonesia user-friendly

### Memory & dokumentasi

- [ ] Update memori kalau ada pola baru yang naik jadi canonical
- [ ] Update `MEMORY.md` index kalau perlu
- [ ] Kalau ada deviasi dari PATTERNS.md, dokumentasikan **alasan** di commit message

---

## REFERENSI FILE

### Canonical (acuan utama)
- `patients.html` (80K) — state, modal CRUD, pagination, search debounce, stale-while-revalidate
- `appointments.html` (85K) — pagination + fullscreen + live refresh
- `recall.html` (47K) — filter chip+panel, contact modal, program action modal
- `PatientService.js` (50K) — dual signature endpoint, role check, response shape
- `AppointmentService.js` (47K), `OrthoRecallService.js` (49K) — similar

### Canonical CSS
- `style.html` (24K) — base
- `style-modals.html` (15K) — modal-box, detail-modal-*, modal-actions, field-error
- `style-patients.html` (13K) — patients-shell, patients-header, patients-table, patients-empty-state
- `style-appointments.html` (13K)
- `style-recall.html` (11K) — recall-toolbar, recall-filter-chip, recall-filter-panel, recall-filter-grid
- `style-finance.html` (31K) — fallback acuan

### Target refactor
- `audit-log.html` (33K) — frontend Aktivitas
- `AuditLogQueryService.js` (17K) — backend query (sudah baik, minor)
- `AuditLogService.js` (7K) — audit log emitter (sudah baik)

### Related
- `scripts.html` — `attachAuthContext`, `showToast`, `setModalProcessingState`, `showAppConfirm`, `escapeHtml`
- `Auth.js` — `requireRole`
- `ClinicScope.js` — `getCurrentClinicId_`

---

**END OF PATTERNS.md**

> **Cara pakai**: Sebelum mengerjakan task di halaman Aktivitas, baca section
> yang relevan + checklist section 17. Setiap deviasi dari PATTERNS.md wajib ada
> alasan dokumentasi di commit message.
