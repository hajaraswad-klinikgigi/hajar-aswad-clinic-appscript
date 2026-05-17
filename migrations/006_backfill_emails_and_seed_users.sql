-- =========================================================
-- Migration 006 — Backfill email + SEED 6 user baru (Phase 2b)
-- =========================================================
-- Tujuan: lengkapi data app_users untuk Google Sign-In cutover.
--   1. UPDATE 7 user existing: set kolom `email` (Gmail masing-masing)
--   2. INSERT 6 user baru: Fikri (super_admin) + 5 staff pecahan
--      dari "Admin Klinik 1" shared (rangkap admin_appointment +
--      admin_finance, sementara)
--   3. INSERT app_user_roles untuk 6 user baru
--
-- Setelah migrasi ini:
--   - 13/14 entry di app_users punya email (kecuali usr-admin01
--     shared yang akan di-deactivate setelah cutover)
--   - 6 user baru bisa login via Google Sign-In segera setelah
--     deploy /dev (parallel run dgn login lama)
--   - Owner bisa edit role granular per staff via Settings UI nanti
--
-- CATATAN KEAMANAN:
--   - 6 user baru dapat password_hash = 'GOOGLE_SIGN_IN_ONLY'
--     (placeholder). Login form lama TIDAK BISA dipakai untuk akun
--     ini karena hashPassword() tidak akan pernah produce string
--     literal "GOOGLE_SIGN_IN_ONLY".
--   - Legacy `role` di app_users diisi 'owner'/'admin' supaya
--     backward compat readAuthSession_ tetap kerja sebelum mass
--     refactor Phase 2a-extension.
--   - Email disimpan lowercase (sesuai unique index migration 005).
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard → SQL Editor → Paste seluruh file ini
--   → Run. Single transaction, aman rollback kalau error.
-- =========================================================

BEGIN;

-- ── 1. UPDATE email 7 user existing ────────────────────────
UPDATE app_users SET email = LOWER('hasnanhabibisiregar@gmail.com') WHERE user_id = 'owner';
UPDATE app_users SET email = LOWER('nzbanurea@gmail.com')           WHERE user_id = 'usr-dr01';
UPDATE app_users SET email = LOWER('maswitahazni@gmail.com')        WHERE user_id = 'usr-dr02';
UPDATE app_users SET email = LOWER('sellyrl392@gmail.com')          WHERE user_id = 'usr-dr03';
UPDATE app_users SET email = LOWER('michaelchristian495@gmail.com') WHERE user_id = 'usr-dr04';
UPDATE app_users SET email = LOWER('Zulminia2@gmail.com')           WHERE user_id = 'usr-dr05';
UPDATE app_users SET email = LOWER('davidjuli78@gmail.com')         WHERE user_id = 'usr-dr06';

-- ── 2. INSERT 6 user baru ──────────────────────────────────
-- Fikri = super_admin (operator teknis, identik owner permission).
-- 5 staff = pecahan dari Admin Klinik 1 shared, rangkap default
-- admin_appointment + admin_finance (akan diedit per-orang oleh
-- owner setelah ada keputusan business).
INSERT INTO app_users (user_id, username, full_name, email, password_hash, role, clinic_id, is_active)
VALUES
  ('usr-fikri',   'fikri',    'Fikri Mubarak',              LOWER('fikrimrc1@gmail.com'),         'GOOGLE_SIGN_IN_ONLY', 'owner', 'KLINIK-1', TRUE),
  ('usr-staff01', 'khairani', 'Khairani Aznur Tambunan',    LOWER('Khairaniaznur0109@gmail.com'), 'GOOGLE_SIGN_IN_ONLY', 'admin', 'KLINIK-1', TRUE),
  ('usr-staff02', 'rina',     'Rina Rinata',                LOWER('rinanaa61@gmail.com'),         'GOOGLE_SIGN_IN_ONLY', 'admin', 'KLINIK-1', TRUE),
  ('usr-staff03', 'risma',    'Risma Wani, S.E',            LOWER('rismawani294@gmail.com'),      'GOOGLE_SIGN_IN_ONLY', 'admin', 'KLINIK-1', TRUE),
  ('usr-staff04', 'dira',     'Dira Putri Ayu, S.Tr.Keb',   LOWER('dira21220@gmail.com'),         'GOOGLE_SIGN_IN_ONLY', 'admin', 'KLINIK-1', TRUE),
  ('usr-staff05', 'mala',     'Mala Hayati, S.H',           LOWER('laalaamalaaa@gmail.com'),      'GOOGLE_SIGN_IN_ONLY', 'admin', 'KLINIK-1', TRUE);

-- ── 3. INSERT app_user_roles untuk 6 user baru ─────────────
INSERT INTO app_user_roles (user_id, clinic_id, role)
VALUES
  -- Fikri = super_admin (full access)
  ('usr-fikri',   'KLINIK-1', 'super_admin'),
  -- 5 staff pecahan = rangkap admin_appointment + admin_finance
  ('usr-staff01', 'KLINIK-1', 'admin_appointment'),
  ('usr-staff01', 'KLINIK-1', 'admin_finance'),
  ('usr-staff02', 'KLINIK-1', 'admin_appointment'),
  ('usr-staff02', 'KLINIK-1', 'admin_finance'),
  ('usr-staff03', 'KLINIK-1', 'admin_appointment'),
  ('usr-staff03', 'KLINIK-1', 'admin_finance'),
  ('usr-staff04', 'KLINIK-1', 'admin_appointment'),
  ('usr-staff04', 'KLINIK-1', 'admin_finance'),
  ('usr-staff05', 'KLINIK-1', 'admin_appointment'),
  ('usr-staff05', 'KLINIK-1', 'admin_finance');

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit untuk cek)
-- =========================================================
-- 1. Cek semua user existing punya email:
-- SELECT user_id, full_name, email, role, is_active
--   FROM app_users
--   ORDER BY user_id;
--
-- Expected: 14 row (owner, usr-admin01, usr-dr01..06, usr-fikri,
-- usr-staff01..05). Semua punya email kecuali usr-admin01 (akan
-- di-deactivate setelah cutover).
--
-- 2. Cek app_user_roles untuk 6 user baru:
-- SELECT user_id, clinic_id, role
--   FROM app_user_roles
--   WHERE user_id IN ('usr-fikri', 'usr-staff01', 'usr-staff02',
--                     'usr-staff03', 'usr-staff04', 'usr-staff05')
--   ORDER BY user_id, role;
--
-- Expected: 11 row.
--   usr-fikri: 1 row (super_admin)
--   usr-staff01..05: 2 row each (admin_appointment + admin_finance)
--
-- 3. Cek aggregate role per user:
-- SELECT u.user_id, u.full_name, u.email,
--        ARRAY_AGG(r.role ORDER BY r.role) AS roles
--   FROM app_users u
--   LEFT JOIN app_user_roles r ON r.user_id = u.user_id
--   WHERE u.is_active = TRUE
--   GROUP BY u.user_id, u.full_name, u.email
--   ORDER BY u.user_id;
