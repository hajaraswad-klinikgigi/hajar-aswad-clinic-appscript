-- =========================================================
-- Migration 014 — normalize legacy role 'dokter' → 'doctor'
-- =========================================================
-- Phase 2A men-standarkan naming role dari Bahasa Indonesia
-- ('dokter') ke English ('doctor'). Migration ini meng-cleanup
-- baris-baris yang masih tertinggal:
--   * app_users.role            → kolom legacy single-role (pra-Phase 2A)
--   * app_user_roles.role   → tabel many-to-many Phase 2C
--
-- Aliasing code-side di Auth.js `normalizeAppRole_` tetap sebagai
-- safety-net, tapi setelah migrasi ini, semua data DB sudah pakai
-- nama canonical 'doctor'.
--
-- Backup tables pre-013 (`_backup_pre_013_*`) sudah meng-snapshot
-- state sebelum migration 013; tidak perlu backup lagi untuk ini.
-- =========================================================

BEGIN;

-- ── 1. Snapshot rows yang akan diubah (untuk audit/rollback) ──
CREATE TABLE IF NOT EXISTS _backup_pre_014_app_users_role_dokter AS
  SELECT user_id, role
    FROM app_users
   WHERE role = 'dokter';

CREATE TABLE IF NOT EXISTS _backup_pre_014_app_user_roles_dokter AS
  SELECT user_id, role, clinic_id
    FROM app_user_roles
   WHERE role = 'dokter';

-- ── 2. Update app_users.role legacy ─────────────────────────────
UPDATE app_users
   SET role = 'doctor'
 WHERE role = 'dokter';

-- ── 3. Update app_user_roles.role Phase 2C ──────────────────
UPDATE app_user_roles
   SET role = 'doctor'
 WHERE role = 'dokter';

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah COMMIT)
-- =========================================================
-- 1. Pastikan tidak ada 'dokter' tersisa:
-- SELECT 'app_users' AS source, COUNT(*) AS leftover
--   FROM app_users WHERE role = 'dokter'
-- UNION ALL
-- SELECT 'app_user_roles', COUNT(*)
--   FROM app_user_roles WHERE role = 'dokter';
-- → kedua baris harus leftover = 0
--
-- 2. Cek jumlah baris yang ke-update:
-- SELECT 'app_users' AS source, COUNT(*) AS migrated
--   FROM _backup_pre_014_app_users_role_dokter
-- UNION ALL
-- SELECT 'app_user_roles', COUNT(*)
--   FROM _backup_pre_014_app_user_roles_dokter;
--
-- 3. Spot-check akun yang berubah:
-- SELECT u.user_id, u.username, u.role,
--        ARRAY_AGG(aur.role) AS app_roles
--   FROM app_users u
--   LEFT JOIN app_user_roles aur ON aur.user_id = u.user_id
--  WHERE u.role = 'doctor'
--  GROUP BY u.user_id, u.username, u.role;
--
-- =========================================================
-- ROLLBACK (kalau perlu, jalankan manual)
-- =========================================================
-- UPDATE app_users u SET role = b.role
--   FROM _backup_pre_014_app_users_role_dokter b
--  WHERE u.user_id = b.user_id;
-- UPDATE app_user_roles a SET role = b.role
--   FROM _backup_pre_014_app_user_roles_dokter b
--  WHERE a.user_id = b.user_id
--    AND COALESCE(a.clinic_id, '') = COALESCE(b.clinic_id, '');
--
-- =========================================================
-- CLEANUP backup tables (jalankan kalau confident setelah ~3 hari)
-- =========================================================
-- DROP TABLE IF EXISTS _backup_pre_014_app_users_role_dokter;
-- DROP TABLE IF EXISTS _backup_pre_014_app_user_roles_dokter;
