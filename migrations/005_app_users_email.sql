-- =========================================================
-- Migration 005 — Tambah kolom email di app_users
-- =========================================================
-- Tujuan: foundation Phase 2b Google Sign-In.
--   - Tambah kolom `email` (UNIQUE, nullable dulu supaya backward compat)
--   - Belum di-set NOT NULL: user existing belum punya email sampai
--     owner backfill via Settings UI (Edit Pengguna), user baru wajib
--     pakai email saat Tambah Pengguna.
--   - Constraint UNIQUE untuk cegah dua user pakai email Google sama.
--
-- Skenario A (Gmail pribadi): email kolom ini = email Google
-- yang dipakai user untuk Sign in with Google.
--
-- POST-MIGRATION TODO (via UI Settings, bukan SQL):
--   1. Owner login (login lama) → Pengaturan → Pengguna
--   2. Edit setiap user existing → isi field Email (Gmail mereka)
--   3. Tambah akun baru untuk: Fikri (super_admin, fikrimrc1@gmail.com)
--      + staff pecahan dari "Admin Klinik 1" (admin_appointment /
--      admin_finance sesuai peran)
--   4. Setelah semua user punya email, owner test "Sign in with Google"
--      dari incognito window
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard → SQL Editor → Paste seluruh file ini →
--   Run. Aman: ALTER kolom nullable + UNIQUE constraint tidak block
--   user existing.
-- =========================================================

BEGIN;

-- Tambah kolom email kalau belum ada.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Pastikan email unik (case-insensitive). Gunakan partial unique index
-- supaya banyak row dgn email NULL tetap valid (user existing belum
-- punya email).
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_lower_unique
  ON app_users (LOWER(email))
  WHERE email IS NOT NULL;

COMMENT ON COLUMN app_users.email IS
  'Email Google untuk Sign in with Google (Phase 2b). NULL = user lama yang belum di-backfill. Setelah Phase 2b cutover, kolom ini akan jadi sumber identity utama (menggantikan username/password).';

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit untuk cek)
-- =========================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'app_users'
--   ORDER BY ordinal_position;
--
-- Harus muncul kolom `email` (text, nullable=YES) di daftar.
--
-- SELECT user_id, username, full_name, email
--   FROM app_users
--   ORDER BY user_id;
--
-- Saat ini semua user email = NULL. Akan diisi owner via Settings UI.
