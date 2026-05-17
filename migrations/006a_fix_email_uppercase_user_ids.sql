-- =========================================================
-- Migration 006a — Fix email backfill (user_id case mismatch)
-- =========================================================
-- Tujuan: migration 006 sebelumnya UPDATE pakai user_id lowercase
-- ('owner', 'usr-dr01', dll), tapi database actual pakai UPPERCASE
-- (USR-0001, USR-DR01..06, USR-ADM01). Akibatnya 7 user existing
-- email tetap NULL.
--
-- Migration 006a ini cuma UPDATE email dengan user_id YANG BENAR.
-- Idempotent: aman dijalankan walau migration 006 sudah jalan.
--
-- CATATAN: 6 user baru yang dibuat migration 006 pakai lowercase
-- user_id (usr-fikri, usr-staff01..05). Itu inkonsisten dgn 8 user
-- existing yang UPPERCASE. TIDAK di-fix di sini karena cosmetic
-- (Auth.js pakai case-sensitive match, jadi tetap berfungsi).
-- Kalau owner ingin rapihin nanti, akan dibuat migration terpisah.
-- =========================================================

BEGIN;

-- ── 1. UPDATE email 7 user existing ────────────────────────
UPDATE app_users SET email = LOWER('hasnanhabibisiregar@gmail.com') WHERE user_id = 'USR-0001';
UPDATE app_users SET email = LOWER('nzbanurea@gmail.com')           WHERE user_id = 'USR-DR01';
UPDATE app_users SET email = LOWER('maswitahazni@gmail.com')        WHERE user_id = 'USR-DR02';
UPDATE app_users SET email = LOWER('sellyrl392@gmail.com')          WHERE user_id = 'USR-DR03';
UPDATE app_users SET email = LOWER('michaelchristian495@gmail.com') WHERE user_id = 'USR-DR04';
UPDATE app_users SET email = LOWER('Zulminia2@gmail.com')           WHERE user_id = 'USR-DR05';
UPDATE app_users SET email = LOWER('davidjuli78@gmail.com')         WHERE user_id = 'USR-DR06';

-- USR-ADM01 (Admin Klinik 1 shared) sengaja TIDAK diisi email —
-- akun ini akan di-deactivate setelah cutover ke 5 akun individu.

-- ── 2. Rapihin password_hash 6 user baru → NULL ────────────
-- Sebelumnya migration 006 set 'GOOGLE_SIGN_IN_ONLY' (placeholder).
-- NULL lebih clean & semantik jelas: tidak ada password = login
-- Google only. Login form lama tetap reject (hashPassword tidak
-- pernah return NULL).
UPDATE app_users SET password_hash = NULL
  WHERE user_id IN ('usr-fikri', 'usr-staff01', 'usr-staff02',
                    'usr-staff03', 'usr-staff04', 'usr-staff05');

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- SELECT u.user_id, u.full_name, u.email,
--        ARRAY_AGG(r.role ORDER BY r.role) AS roles
--   FROM app_users u
--   LEFT JOIN app_user_roles r ON r.user_id = u.user_id
--   WHERE u.is_active = TRUE
--   GROUP BY u.user_id, u.full_name, u.email
--   ORDER BY u.user_id;
--
-- Expected setelah 006a:
--   USR-0001 (Hasnan)       → hasnanhabibisiregar@gmail.com
--   USR-ADM01 (Admin Klinik) → NULL (sengaja, akan dideaktivasi)
--   USR-DR01..06            → 6 email dokter lowercase
--   usr-fikri               → fikrimrc1@gmail.com
--   usr-staff01..05         → 5 email staff lowercase
