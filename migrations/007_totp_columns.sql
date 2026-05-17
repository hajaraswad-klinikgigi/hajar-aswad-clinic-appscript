-- =========================================================
-- Migration 007 — Tambah kolom TOTP di app_users (Phase 2b revisi)
-- =========================================================
-- Tujuan: foundation TOTP (Google Authenticator) login.
--   - totp_secret: base32 secret (~32 char) yang di-generate owner
--     via Settings → "Setup Authenticator" per user. NULL = user
--     belum di-setup, tidak bisa login.
--   - totp_enabled_at: timestamp kapan secret ter-generate. Berguna
--     untuk audit / debugging.
--
-- Sebelumnya dicoba Google Sign-In, di-rollback total karena Apps
-- Script iframe blokir GIS button (origin_mismatch error 400).
-- Lihat PHASE_2B_AUTH_DISCUSSION_2026_05_17.md untuk rasionale.
--
-- POST-MIGRATION TODO (via UI Settings):
--   1. Owner login lama (USR-0001 / Hasnan) di /dev (head deployment)
--   2. Pengaturan → Pengguna → klik tombol "Setup Authenticator" per
--      staff yang sudah punya email
--   3. Modal tampil QR code → staff scan ke Google Authenticator app
--      di HP mereka
--   4. Setelah semua staff sudah scan, owner test login: email + 6
--      digit dari Authenticator
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard → SQL Editor → Paste → Run. Aman
--   idempotent: IF NOT EXISTS.
-- =========================================================

BEGIN;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

COMMENT ON COLUMN app_users.totp_secret IS
  'Base32 secret (RFC 4648, 20-byte / 32 char) untuk TOTP Google Authenticator. NULL = belum setup, user tidak bisa login.';

COMMENT ON COLUMN app_users.totp_enabled_at IS
  'Timestamp kapan totp_secret di-generate. NULL berbarengan dgn totp_secret.';

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'app_users'
--     AND column_name IN ('totp_secret', 'totp_enabled_at')
--   ORDER BY column_name;
--
-- Expected: 2 row, keduanya nullable=YES.
--
-- Cek semua user belum punya secret (memang baru bikin kolom):
-- SELECT user_id, full_name, email,
--        CASE WHEN totp_secret IS NULL THEN 'BELUM' ELSE 'SETUP' END AS totp_status
--   FROM app_users
--   ORDER BY user_id;
