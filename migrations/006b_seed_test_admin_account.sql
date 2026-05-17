-- =========================================================
-- Migration 006b — SEED akun test hajaraswadklinikgigi@gmail.com
-- =========================================================
-- Tujuan: akun klinik (yang juga punya Apps Script editor access)
-- bisa test Phase 2b Google Sign-In di /dev URL.
--
-- Akun ini bersifat sementara (testing). Setelah cutover sukses
-- ke /exec dan semua staff bisa login, akun ini bisa di-deactivate
-- (is_active = false) supaya tidak jadi entry point security tambahan.
--
-- Role: super_admin (sama seperti Fikri) — full access untuk test
-- semua fitur tanpa terbatas role check.
-- =========================================================

BEGIN;

-- Cegah duplicate kalau migration dijalankan ulang.
INSERT INTO app_users (user_id, username, full_name, email, password_hash, role, clinic_id, is_active)
VALUES
  ('usr-klinik-test', 'klinik_test', 'Akun Klinik (testing)',
   LOWER('hajaraswadklinikgigi@gmail.com'),
   NULL, 'owner', 'KLINIK-1', TRUE)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO app_user_roles (user_id, clinic_id, role)
VALUES
  ('usr-klinik-test', 'KLINIK-1', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- SELECT user_id, full_name, email, role, is_active
--   FROM app_users
--   WHERE user_id = 'usr-klinik-test';
--
-- Expected: 1 row, email = hajaraswadklinikgigi@gmail.com,
-- role = 'owner' (legacy), is_active = true.
--
-- SELECT user_id, role FROM app_user_roles
--   WHERE user_id = 'usr-klinik-test';
--
-- Expected: 1 row, role = 'super_admin'.

-- =========================================================
-- CARA DEACTIVATE NANTI (setelah cutover sukses)
-- =========================================================
-- UPDATE app_users SET is_active = FALSE
--   WHERE user_id = 'usr-klinik-test';
