# Phase 2b Auth — Revisi ke TOTP (Google Authenticator)

**Tanggal diskusi:** 2026-05-17 sore
**Status:** Disepakati. Implementasi ditunda — owner istirahat dulu.
**Pengganti:** Pendekatan Google Sign-In (push terakhir 2026-05-17) di-rollback total.

---

## 1. Konteks: Kenapa berubah dari Google Sign-In?

Setelah implementasi Google Sign-In (Phase 2b foundation pertama, push 2026-05-17), kami menemukan beberapa masalah operasional:

1. **GIS button tidak jalan di Apps Script iframe** — Error 400 `origin_mismatch` karena Apps Script di-render di `*.googleusercontent.com` yang Google forbid sebagai OAuth origin.
2. **Workaround Session-based** (drop GIS button) sebenarnya jalan untuk akun klinik (test sukses), tapi:
   - Manifest `access: ANYONE` memaksa user wajib login Google sebelum akses URL — menambah friksi.
   - URL `/dev` hanya bisa diakses Apps Script editor → testing terbatas.
   - "Bukan Saya — Ganti Akun" sulit di-implement karena Google blokir hampir semua URL account chooser di web app context.
   - `window.location.reload()` di iframe = blank screen.
3. **Operasional klinik**: komputer share dengan beberapa staff. Chrome multi-account auto-primer rentan staff "tanpa sadar login dengan akun temannya".

Solusi Google Sign-In bisa-bisa saja, tapi UX-nya bermasalah untuk realita klinik.

## 2. Keputusan: TOTP (Google Authenticator)

Owner pilih pendekatan **TOTP / Google Authenticator** sebagai pengganti Google Sign-In sepenuhnya.

| Aspek | Keputusan |
|---|---|
| **Auth method** | TOTP RFC 6238 (Google Authenticator app di HP staff) |
| **Identifier login** | Email (sudah di-backfill di `app_users.email`) |
| **Form login** | Email + 6 digit kode Authenticator (refresh tiap 30 detik) |
| **Google Sign-In** | **Drop sepenuhnya** — rollback semua code & manifest changes |
| **Manifest `access`** | Kembali ke `ANYONE_ANONYMOUS` (tidak butuh login Google) |
| **Auto-logout staff** | **10 menit** inactive untuk role admin_appointment / admin_finance saja |
| **Auto-logout owner/super_admin/doctor** | **TIDAK ADA** — login persisten sampai manual logout / tutup browser |
| **Warning sebelum logout** | Toast di menit ke-9 ("Logout dalam 1 menit kalau tidak aktif, klik di sini untuk lanjut") |
| **TOTP setup** | Owner generate QR code per staff via Settings → staff scan ke Google Authenticator di HP |
| **Recovery** | Owner bisa "Reset TOTP Secret" per user via Settings kalau HP hilang/ganti |

## 3. Alasan TOTP cocok untuk klinik

- ✅ **Tidak ada iframe issue** — TOTP murni form input, tidak butuh OAuth/redirect
- ✅ **Setiap login butuh HP staff sendiri** — staff lain tidak bisa login pakai akun rekan (kecuali curi HP)
- ✅ **Audit log akurat** — siapa yang scan QR mereka = siapa yang login
- ✅ **No Google iframe lock-in** — bisa pakai Apps Script default deployment (`ANYONE_ANONYMOUS`)
- ✅ **Authenticator app gratis** di Play Store / App Store
- ✅ **Apps Script support** — `Utilities.computeHmacSignature(SHA_1, ...)` sudah cukup implement RFC 6238 (~50 baris code)

## 4. Trade-off & risk yang diterima

| Trade-off | Konsekuensi |
|---|---|
| UX login lebih panjang dari Google Sign-In | Staff harus: buka Authenticator → baca 6 digit → ketik. ~10 detik per login. |
| Re-login lebih sering (staff 10 menit timeout) | Saat sibuk konsultasi pasien > 10 menit, staff akan re-login. Mitigasi: warning menit 9 + extend button. |
| Setup awal lumayan | 13 staff × scan QR = ~30 menit total setup. Owner dampingi tiap staff sekali. |
| Lost device → terkunci | Mitigasi: owner punya tombol "Reset TOTP Secret" di Settings (admin override). Staff scan ulang QR baru. |
| Phone Authenticator wajib | Staff yang tidak punya HP smartphone tidak bisa login. Saat ini tidak ada staff seperti ini (cek owner). |

## 5. Schema database changes (untuk implementasi nanti)

Migration baru (007 atau setelah Phase 2b code stable):

```sql
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

COMMENT ON COLUMN app_users.totp_secret IS
  'Base32 secret untuk TOTP (RFC 6238). Generate saat owner setup Authenticator per user. NULL = belum setup, user tidak bisa login.';
```

Tidak perlu encryption at rest — Supabase sudah encrypt by default di disk.

Recovery codes (optional, Phase 2c):
```sql
CREATE TABLE app_user_recovery_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 6. Code changes yang akan dilakukan (next session)

### 6.1 Rollback Google Sign-In (cleanup)
- `appsscript.json`: `access: ANYONE_ANONYMOUS` (revert dari `ANYONE`)
- `appsscript.json`: hapus `oauthScopes` `userinfo.email` (tidak butuh lagi)
- `Auth.js`: hapus `getCurrentGoogleEmail_`, `getCurrentGoogleUser`, `loginWithGoogle` versi Session-based
- `index.html`: hapus `loginConfirmCard`, `loginErrorCard`, `loginLoadingState` — kembali ke form sederhana
- `scripts.html`: hapus `autoDetectGoogleUser`, `submitLoginConfirm`, `switchGoogleAccount`, `injectSwitchAccountActions_`

### 6.2 Implementasi TOTP
- `Auth.js`: `loginWithTotp(email, code)` — verify TOTP via HMAC-SHA1, create session sama seperti loginUser
- `Auth.js`: helper `generateTotpSecret_()` (base32 random 20 byte) + `verifyTotpCode_(secret, code)` (allow ±1 step drift)
- `SettingsService.js`: `generateTotpForUser(user_id)` (return otpauth URI + base64 PNG QR), `resetTotpForUser(user_id)`, `disableTotpForUser(user_id)`
- `settings.html` tab Pengguna: tombol "Setup Authenticator" per user → modal tampil QR code
- `index.html`: form login = email + 6 digit code

### 6.3 Auto-logout role-based
- `scripts.html`: setelah login sukses, cek `currentUser.roles`:
  - Kalau `roles` contains `admin_appointment` atau `admin_finance` saja (tidak ada owner/super_admin/doctor) → enable 10-minute inactivity timer + warning at minute 9
  - Else → no timer
- Konstanta: `INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000` (10 menit), `INACTIVITY_WARNING_MS = 9 * 60 * 1000` (warning 1 menit sebelum)

### 6.4 Logout button polish (Lapis 4)
- Sudah ada di sidebar (`menuLogout` / `sidebar-logout`). Verify icon clear & color mencolok.

### 6.5 Identitas prominent topbar (Lapis 2) — keep existing
- Avatar initial + identitas mencolok sudah di-implement saat Google Sign-In iteration. **Keep** untuk TOTP version.

## 7. Implementation roadmap

| Step | Pekerjaan | PIC | Status |
|---|---|---|---|
| 1 | Rollback Google Sign-In code & manifest | Saya | ⏳ |
| 2 | Migration 007: tambah kolom `totp_secret` + `totp_enabled_at` di app_users | Saya bikin SQL, owner run | ⏳ |
| 3 | Backend: helper TOTP (generate, verify) di Auth.js | Saya | ⏳ |
| 4 | Backend: endpoint `loginWithTotp`, `generateTotpForUser`, `resetTotpForUser` | Saya | ⏳ |
| 5 | Frontend: form login email + 6 digit code | Saya | ⏳ |
| 6 | Frontend: modal Setup Authenticator (QR code) di Settings tab Pengguna | Saya | ⏳ |
| 7 | Frontend: auto-logout 10 menit role-based + warning menit 9 | Saya | ⏳ |
| 8 | Push /dev + test owner sendiri (akun klinik test) | Saya + Owner | ⏳ |
| 9 | Setup Authenticator untuk 13 staff (one-time, owner-assisted) | Owner | ⏳ |
| 10 | Test login per staff | Owner + staff | ⏳ |
| 11 | Deploy /exec final | Owner approve, saya deploy | ⏳ |
| 12 | Phase 2a-extension: granular role enforcement | Saya | ⏳ |

## 8. Data state saat ini (yang tetap dipertahankan)

Migration 005, 006, 006a, 006b sudah jalan. State app_users:
- 14 user di app_users (8 existing + 6 baru + 1 test)
- Email lengkap untuk 12 user (kecuali USR-ADM01 Admin Klinik 1)
- app_user_roles lengkap untuk semua user baru + test

Untuk TOTP, **migration 007 baru tinggal tambah kolom `totp_secret`**. Tidak perlu ubah data existing.

## 9. UX flow login TOTP (preview)

```
┌─────────────────────────────────────┐
│  Klinik Hajar Aswad — Login         │
│                                     │
│  📧 Email                           │
│  ┌─────────────────────────────────┐│
│  │ fikrimrc1@gmail.com            ││
│  └─────────────────────────────────┘│
│                                     │
│  🔢 Kode dari Google Authenticator  │
│  ┌─────────────────────────────────┐│
│  │ 123 456                         ││
│  └─────────────────────────────────┘│
│   Buka app Authenticator di HP Anda │
│                                     │
│         [   Login   ]               │
│                                     │
│  Tidak punya kode? Hubungi admin    │
│  klinik untuk reset Authenticator   │
└─────────────────────────────────────┘
```

Setelah login → dashboard normal. Untuk admin staff: timer 10 menit aktif silent + warning menit 9.

## 10. UX flow Setup Authenticator (preview, Settings → Pengguna)

```
Modal "Setup Authenticator untuk drg. Novita":
┌─────────────────────────────────────┐
│  📱 Scan QR Code ini ke aplikasi    │
│     Google Authenticator di HP      │
│     drg. Novita                     │
│                                     │
│  ┌─────────────┐                    │
│  │  ████ ██ █  │                    │
│  │  █  ████ █  │  (QR code)         │
│  │  █ ██  █ █  │                    │
│  │  ████████   │                    │
│  └─────────────┘                    │
│                                     │
│  Atau masukkan kode manual:         │
│  JBSWY3DPEHPK3PXP                   │
│                                     │
│  ⚠️ Simpan QR di tempat aman.        │
│  Setelah scan, Authenticator akan   │
│  generate 6 digit code yang berubah │
│  tiap 30 detik untuk login.         │
│                                     │
│  [ Tutup ]                          │
└─────────────────────────────────────┘
```

## 11. Action items untuk owner (sebelum sesi berikutnya)

Tidak ada action urgent. Owner istirahat dulu.

Saat sesi berikut dimulai:
1. Buka diskusi ini (file `PHASE_2B_AUTH_DISCUSSION_2026_05_17.md`)
2. Konfirmasi keputusan masih sama → saya mulai rollback + implementasi
3. Sesi rollback + implement TOTP estimasi 1-2 jam coding + 30 menit testing

## 12. Risk yang owner harus aware

- **Cutover full TOTP**: setelah deploy /exec, login lama (akun owner shared) **tidak bisa dipakai lagi**. Semua staff WAJIB sudah setup Authenticator. Kalau ada staff belum setup saat deploy, dia terblok login.
- **Mitigation**: cutover bertahap — setup Authenticator semua staff DI /dev DULU. Test semua bisa login. Baru deploy /exec.
- **Recovery**: owner punya akses Supabase untuk emergency reset secret kalau ada staff terkunci. Plus tombol "Reset TOTP Secret" di Settings UI.

## 13. Linked dokumen / memory

- `PLAN_MULTI_CLINIC_AUTH_AUDIT.md` — plan original (sekarang outdated soal Clerk dan Google Sign-In)
- Memory `phase2b_email_collection_2026_05_17.md` — daftar 13 user email
- Memory `multi_clinic_phase2a_progress_2026_05_17.md` — Phase 2a foundation (sudah commit `c6e3862` + `7c14299`)
- Memory `ui_consistency_patterns_2026_05_17.md` — UI canonical patterns
- Memory `feedback_deploy_approval.md` — wajib persetujuan owner sebelum deploy /exec
