-- =========================================================
-- Migration 009 — owner & super_admin scope global (cross-clinic)
-- =========================================================
-- Konvensi baru:
--   app_user_roles.clinic_id = NULL  → role berlaku di SEMUA klinik
--                                      (global, cross-clinic scope)
--   app_user_roles.clinic_id = 'X'   → role berlaku khusus klinik X
--
-- Untuk role full-privileged (owner, super_admin) supaya tidak
-- perlu duplicate row per klinik saat klinik ke-2 hadir. Single
-- business entity: Hasnan = owner semua klinik, Fikri = super_admin
-- semua klinik.
--
-- Role lain (admin_appointment, admin_finance, doctor) tetap
-- per-clinic — staff/dokter biasanya melekat ke 1 klinik spesifik.
--
-- FK clinic_id -> clinics(clinic_id) tetap valid: NULL value
-- otomatis bypass FK check di PostgreSQL (semantic FK = "kalau
-- non-null, harus reference baris valid"; null = "tidak reference").
-- =========================================================

BEGIN;

-- ── 1. Drop NOT NULL & DEFAULT supaya NULL valid ───────────────
ALTER TABLE app_user_roles ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE app_user_roles ALTER COLUMN clinic_id DROP DEFAULT;

-- ── 2. Backfill: owner & super_admin → NULL (global) ───────────
UPDATE app_user_roles
   SET clinic_id = NULL
 WHERE role IN ('owner', 'super_admin');

-- ── 3. Update komentar dokumentasi ─────────────────────────────
COMMENT ON COLUMN app_user_roles.clinic_id IS
  'NULL = role berlaku global (cross-clinic). Dipakai untuk owner & super_admin. Non-NULL = role per-clinic.';

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- 1. Cek owner & super_admin sekarang clinic_id NULL:
-- SELECT user_id, role, clinic_id
--   FROM app_user_roles
--  WHERE role IN ('owner', 'super_admin')
--  ORDER BY role, user_id;
-- → Semua harus clinic_id = NULL
--
-- 2. Cek role lain tetap per-clinic:
-- SELECT role, clinic_id, COUNT(*) AS jumlah
--   FROM app_user_roles
--  GROUP BY role, clinic_id
--  ORDER BY role, clinic_id;
-- → owner & super_admin di clinic_id NULL,
--   admin_*/doctor di clinic_id = 'KLINIK-1'
--
-- 3. Konfirmasi NOT NULL sudah di-drop:
-- SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'app_user_roles'
--    AND column_name = 'clinic_id';
-- → is_nullable = YES, column_default = NULL
