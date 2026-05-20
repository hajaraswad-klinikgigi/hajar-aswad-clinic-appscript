# Quality Audit — Production Readiness Check

> **Tujuan dokumen**: catatan jujur tentang status kualitas (performa, keamanan,
> jangka panjang) untuk SEMUA modul. Bukan dokumentasi self-praise — di sini
> termasuk gap, hutang teknis, dan roadmap fix-nya.
>
> **Komplementer dengan**:
> - `PATTERNS.md` → pola UI/code konvensi (rulebook)
> - `CLAUDE.md` → konvensi global project (kalau ada)
>
> **Update terakhir**: 2026-05-20 (post Phase 3 audit log refactor)

---

## 1. Prinsip Umum (Best Practice Lintas Modul)

Setiap modul list/CRUD WAJIB memenuhi 10 prinsip ini. Kalau ada yang belum,
catat di section "Status per Modul" di bawah.

### A. Keamanan (Security)

1. **Auth gate di awal endpoint** — `requireRole(payload, [...])` panggil
   PERTAMA sebelum logic apapun. Jangan kerjakan apa pun kalau auth gagal.

2. **Clinic scope di semua query** — `clinic_id = eq.{user.clinic_id}` WAJIB
   di setiap SELECT/UPDATE/DELETE. Cegah cross-clinic leak.

3. **Input validation via whitelist, bukan blacklist** — string enum
   (`action`, `entity_type`, `status`, dll) di-cek terhadap `Object.keys(VALID_X)`.
   Date pakai regex strict. User_id pakai regex format. Drop nilai invalid
   diam-diam, jangan throw (UI tetap render).

4. **Tidak leak error message Supabase ke UI** — jangan return
   `'HTTP ' + status + ' - ' + JSON.stringify(body)` ke client. Log internal,
   return generic message.

5. **Role-based visibility** — field/entity yang sensitif per-role di-filter
   di backend (mis. `admin_finance` tidak lihat data patient).

### B. Performa

6. **Index DB sesuai pola query utama** — composite `(scope_col, sort_col DESC)`
   untuk query yang sering. Pakai `EXPLAIN ANALYZE` untuk verify.

7. **Pagination client-side untuk list** — fetch sekali (≤ cap reasonable),
   paginate via `array.slice()`. **JANGAN server-side pagination dengan
   page_number/offset** untuk halaman list biasa — UX terasa lag.
   Lihat `PATTERNS.md` Section 4.3.

8. **Cache + TTL untuk fetch berat** — bootstrap response per period/scope
   di-cache di memory (`const cacheTtl = 5 * 60 * 1000`). Refresh saat balik
   ke halaman SETELAH TTL expired.

9. **Request token untuk race condition** — saat user cepat switch period/
   filter, in-flight request lama di-discard di handler (`if (myToken !==
   currentToken) return;`).

### C. UX & Lifecycle

10. **Stale-while-revalidate** — saat balik ke halaman dengan cache, RENDER
    CACHE LANGSUNG, fetch refresh di background, JANGAN lock UI. User bisa
    langsung interact dengan data lama. Update UI saat response fresh masuk.

---

## 2. Status per Modul (per 2026-05-20)

Legend:
- ✅ = sudah memenuhi
- ⚠️ = ada gap tapi acceptable untuk konteks saat ini
- 🔴 = gap signifikan, harus fix

### 2.1 Aktivitas (`audit-log.html` + `AuditLogQueryService.js`)

| Prinsip | Status | Catatan |
|---|---|---|
| A1 Auth gate | ✅ | `requireRole(['admin_appointment', 'admin_finance'])` |
| A2 Clinic scope | ✅ | `clinic_id=eq.X` di semua query |
| A3 Input validation whitelist | ✅ | actions/entity_types/period whitelist/user_id regex (2026-05-20). Period preset menggantikan free-form date — query selalu bounded |
| A4 Error message leak | 🔴 | `'Audit log SELECT failed: HTTP ' + code + ' - ' + JSON.stringify(body)` masih ada |
| A5 Role-based visibility | ✅ | `AUDIT_LOG_ROLE_ALLOWED_ENTITY_TYPES` whitelist |
| B6 Index DB | ✅ | Migration 012: `idx_audit_log_clinic_occurred` (2026-05-20) |
| B7 Client-side pagination | ✅ | Refactor 2026-05-20, cap 2000 + default period `7days` |
| B8 Cache + TTL | ✅ | `activityCache` keyed `{period+entities+actions}`, TTL 5 menit (2026-05-20 sore). Bulk lookup `app_users` masih per-fetch — masuk Tier 2 |
| B9 Request token | ✅ | `activityRequestToken` (2026-05-20 sore) — sinkron Dashboard/Finance |
| C10 Stale-while-revalidate | ✅ | Refactor 2026-05-20, UI tidak lock saat balik ke halaman + period selector never locked |

**Open items spesifik Aktivitas**:
- 🔴 **Retention policy** — `audit_log` retain selamanya. 5 tahun multi-klinik = 5M+ row. Bom waktu.
- ⚠️ Audit untuk akses audit_log (compliance HIPAA-style) — belum
- ⚠️ PII di `old_value`/`new_value` tidak redacted

### 2.2 Finance (`finance.html` + `FinanceBillingService.js` dll)

| Prinsip | Status | Catatan |
|---|---|---|
| A1 Auth gate | ✅ | `requireRole(...)` di setiap endpoint |
| A2 Clinic scope | ✅ | Verifikasi spot-check OK |
| A3 Input validation whitelist | ⚠️ | Period validated (2026-05-20). Status filter, search keyword belum semua di-whitelist |
| A4 Error message leak | ⚠️ | Helper `financeGetServerErrorMessage` filter sebagian, tapi tidak konsisten |
| A5 Role-based visibility | ✅ | Backend filter per-role |
| B6 Index DB | ⚠️ | `billings`, `payments`, `receivables` — perlu audit index |
| B7 Client-side pagination | ✅ | Billings/receivables paginate client-side |
| B8 Cache + TTL | ✅ | `financeBootstrapCache` TTL 5 menit (2026-05-20) |
| B9 Request token | ✅ | `financeBootstrapRequestToken` (2026-05-20) |
| C10 Stale-while-revalidate | ✅ | Refactor 2026-05-20, period change tidak lock UI |

**Open items spesifik Finance**:
- ⚠️ `getFinancePageBootstrap` query banyak tabel sekaligus — pertimbangkan parallel fetch
- ⚠️ Cache invalidation kalau ada mutation (saat ini tidak invalidate cache)

### 2.3 Dashboard (`dashboard.html` + `DashboardService.js`)

| Prinsip | Status | Catatan |
|---|---|---|
| A1 Auth gate | ✅ | Verifikasi via `getDashboardOwnerSummary` |
| A2 Clinic scope | ✅ | |
| A3 Input validation whitelist | ✅ | Period whitelist (2026-05-20) |
| A4 Error message leak | ✅ | Generic `'Error: '` saja |
| A5 Role-based visibility | ✅ | Owner-only summary |
| B6 Index DB | ⚠️ | Pakai aggregate query, perlu cek pakai materialized view kalau lambat |
| B7 Client-side pagination | ✅ | `dashboardFeedbackPage` paginate client-side |
| B8 Cache + TTL | ✅ | TTL 5 menit (2026-05-20) |
| B9 Request token | ✅ | `dashboardRequestToken` (2026-05-20) |
| C10 Stale-while-revalidate | ✅ | Refactor 2026-05-20, period selector tidak lock |

**Open items spesifik Dashboard**:
- ⚠️ Auth payload pakai `attachAuthContext` (sudah, 2026-05-20)
- Tidak ada open critical item

### 2.4 Patients (`patients.html` + `PatientService.js`)

| Prinsip | Status | Catatan |
|---|---|---|
| A1 Auth gate | ✅ | `requireRole` |
| A2 Clinic scope | ✅ | |
| A3 Input validation whitelist | ⚠️ | Search keyword belum di-sanitize secara explisit |
| A4 Error message leak | ⚠️ | Beberapa endpoint expose Supabase error mentah |
| A5 Role-based visibility | ✅ | Doctor visibility scope by appointment |
| B6 Index DB | ⚠️ | Perlu audit (full_name search pakai ILIKE) |
| B7 Client-side pagination | ✅ | Canonical reference pattern |
| B8 Cache + TTL | ❌ | Tidak ada cache — fetch ulang setiap entry halaman |
| B9 Request token | ❌ | Tidak ada (rapid switch jarang) |
| C10 Stale-while-revalidate | ✅ | Render `allPatients` lama dulu, fetch background |

**Open items spesifik Patients**:
- ⚠️ Cache invalidation strategy kalau add/edit/delete patient
- ⚠️ Index `(clinic_id, full_name)` atau `pg_trgm` untuk search performa di volume tinggi

### 2.5 Recall (`recall.html` + `OrthoRecallService.js`)

| Prinsip | Status | Catatan |
|---|---|---|
| A1 Auth gate | ✅ | |
| A2 Clinic scope | ✅ | |
| A3 Input validation whitelist | ⚠️ | Status enum belum strict whitelist |
| A4 Error message leak | ⚠️ | Sama dengan Patients |
| A5 Role-based visibility | ✅ | |
| B6 Index DB | ⚠️ | Perlu cek index `(clinic_id, next_due_date)` |
| B7 Client-side pagination | ✅ | |
| B8 Cache + TTL | ❌ | Tidak ada |
| B9 Request token | ❌ | |
| C10 Stale-while-revalidate | ⚠️ | Partial — fetch tetap lock UI saat tidak ada cache |

### 2.6 Appointments (`appointments.html` + `AppointmentService.js`)

| Prinsip | Status | Catatan |
|---|---|---|
| A1-A5 Security | ✅ | Spot-check OK |
| B6-B9 Performance | ⚠️ | Belum di-audit detail |
| C10 UX lifecycle | ⚠️ | Belum di-audit detail |

**Action**: Audit detail di Phase 4 atau saat owner protes performa.

### 2.7 Settings (`settings.html` + `SettingsService.js`)

| Prinsip | Status | Catatan |
|---|---|---|
| A1-A5 Security | ✅ | TOTP, role management — solid |
| B6-B9 Performance | ✅ | Volume rendah (≤ 50 user/klinik) |
| C10 UX lifecycle | ⚠️ | Tab search dipakai canonical refactor 2026-05-18 |

---

## 3. Roadmap Prioritas

### 🔴 Tier 1 — Lakukan dalam 1-2 bulan

| Item | Modul | Effort | Rasionalisasi |
|---|---|---|---|
| Retention policy `audit_log` | Aktivitas | 1 hari | Bom waktu 5 tahun multi-klinik (5M+ row) |
| Error message hardening | Semua | 4 jam | Cegah schema leak ke admin UI |
| Index audit untuk Patients/Recall | Patients/Recall | 2 jam | Audit `EXPLAIN ANALYZE`, tambah index kalau perlu |

### 🟡 Tier 2 — Lakukan saat volume nyata mendekati threshold

| Item | Modul | Trigger | Effort |
|---|---|---|---|
| Cache `app_users` lookup | Aktivitas | `enrichAuditLogRowsWithActorNames_` >500ms | 2 jam |
| Cache invalidation strategy | Patients/Finance | Owner protes "data tidak update" | 4 jam |
| Parallel fetch Finance bootstrap | Finance | Bootstrap >3 detik | 1 hari |
| Monitoring slow query | Semua | Owner pertama kali bilang "lambat" tanpa sebab jelas | 4 jam |

### 🟢 Tier 3 — Compliance / enterprise readiness

| Item | Modul | Effort | Pra-syarat |
|---|---|---|---|
| Audit access ke audit_log | Aktivitas | 4 jam | Saat tunduk HIPAA-like |
| PII redaction | Aktivitas | 1 hari | Saat tunduk regulasi privasi |
| Rate limiting | Semua | 1 hari | Saat ada vector abuse nyata |
| Test otomatis (CI) | Semua | berhari-hari | Saat tim >1 orang, refactor sering |

---

## 4. Anti-Pattern yang Sudah Pernah Dicoba & Salah

Dokumentasi pelajaran pahit supaya tidak diulang.

### 4.1 Server-side pagination dengan `offset/has_next/page_size`

**Pernah dipakai di**: Aktivitas (P3c.1) — 2026-05-19

**Masalah**: setiap navigasi `prev/next/goTo` round-trip Apps Script + Supabase 1-3 detik. Owner protes 2026-05-20.

**Diganti dengan**: client-side pagination dengan cap + filter date default (sesuai Section 4.3 PATTERNS.md).

**Pelajaran**: **konsistensi UX > optimasi antisipatif**. Pola canonical Patients/Recall dulu, baru optimize kalau benar terbukti scale issue.

### 4.2 Lock period selector saat fetch

**Pernah dipakai di**: Finance + Dashboard pre-2026-05-20

**Masalah**: user rapid switch period terasa "lag" karena dropdown revert / tidak respond.

**Diganti dengan**: request token + cache. Period selector TIDAK PERNAH locked, race condition di-discard via token check di handler.

**Pelajaran**: jangan pakai UI lock untuk solve race condition. Pakai token/version.

### 4.3 `Prefer: count=exact` header di query besar

**Pernah dipakai di**: Aktivitas (P3c.1)

**Masalah**: PostgREST `count=exact` = full table scan untuk hitung total. Mahal di tabel besar (>100K row).

**Diganti dengan**: query `limit + 1` lalu deteksi `hit_cap = rows.length > LIMIT`. O(LIMIT) vs O(N).

**Pelajaran**: butuhkan `total_count` cuma untuk pagination — kalau client-side pagination, total = `filteredRows.length` (gratis).

### 4.4 `getCurrentSessionToken()` manual di payload

**Pernah dipakai di**: Dashboard pre-2026-05-20

**Masalah**: Tidak konsisten dengan halaman lain yang pakai `attachAuthContext`. Saat refactor multi-clinic, perlu update banyak tempat.

**Diganti dengan**: `attachAuthContext(payload)` di semua endpoint.

**Pelajaran**: 1 helper untuk auth context — single source of truth.

---

## 5. Bagaimana Gunakan Dokumen Ini

1. **Sebelum bikin modul baru**: baca Section 1 (Prinsip Umum) + Section 4 (Anti-Pattern).
2. **Sebelum refactor modul existing**: cek Section 2 status modul itu, fix gap di Tier 1.
3. **Saat owner protes performa**: cek dimension B6-B9 di modul itu.
4. **Saat owner protes UX**: cek C10 stale-while-revalidate.
5. **Setiap selesai fix tier**: update Section 2 status + tanggal.

---

## 6. Log Perubahan Status

| Tanggal | Modul | Item | Status |
|---|---|---|---|
| 2026-05-19 | Aktivitas | P3c.1 launched (server-side pagination) | ⚠️ → 🔴 owner protes |
| 2026-05-20 | Aktivitas | Refactor client-side pagination | 🔴 → ✅ |
| 2026-05-20 | Aktivitas | Input validation whitelist | 🔴 → ✅ |
| 2026-05-20 | Aktivitas | Index DB clinic_occurred | 🔴 → ✅ |
| 2026-05-20 | Finance | Period race condition + cache TTL | ⚠️ → ✅ |
| 2026-05-20 | Dashboard | Period race condition + cache TTL | ⚠️ → ✅ |
| 2026-05-20 | Dokumentasi | QUALITY_AUDIT.md dibuat | — |
