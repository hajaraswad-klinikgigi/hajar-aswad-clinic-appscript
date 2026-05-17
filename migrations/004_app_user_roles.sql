-- =========================================================
-- Migration 004 — App User Roles (Phase 2a)
-- =========================================================
-- Tujuan: bikin tabel relasi `app_user_roles` (many-to-many)
-- untuk dukungan ROLE RANGKAP. 1 user bisa punya banyak role.
--
-- Tabel `app_users` tetap dipertahankan sebagai akun login
-- (username/password/session_token). Phase 2a TIDAK ganti auth.
-- Phase 2b (Clerk) yang akan ganti auth nanti.
--
-- 5 role yang valid (sesuai role-concept-2026-05-16):
--   - owner             : pemilik klinik, full access
--   - super_admin       : full access, bisa diberi ke staff dipercaya
--   - admin_appointment : pasien, appointment, treatment
--   - admin_finance     : finance, settings layanan, owner report
--   - doctor            : treatment (yg dia treat), view-only related
--
-- Owner & super_admin = fully privileged (selalu lulus role check)
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard -> SQL Editor -> Paste -> Run.
--   Jalankan SEKALI saja. Aman dalam satu transaksi.
-- =========================================================

BEGIN;

-- ── 0. Pastikan app_users.user_id UNIQUE ────────────────────
-- Diperlukan supaya FK dari app_user_roles bisa dibuat.
-- PK app_users adalah `id` (bigint serial), `user_id` text
-- secara logical sudah unique (USR-DR01, USR-DR02, dst) tapi
-- belum punya constraint formal. Tambah di sini.
-- Aman dijalankan berulang (cek pg_constraint dulu).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'app_users'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) LIKE '%(user_id)%'
  ) THEN
    -- Cek duplikat dulu; kalau ada, abort migration
    IF EXISTS (
      SELECT user_id FROM app_users
       GROUP BY user_id HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'Ada duplikat user_id di app_users. Bersihkan dulu sebelum tambah UNIQUE.';
    END IF;

    ALTER TABLE app_users
      ADD CONSTRAINT app_users_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- ── 1. Tabel app_user_roles (many-to-many) ──────────────────
CREATE TABLE IF NOT EXISTS app_user_roles (
  user_id    TEXT        NOT NULL,
  clinic_id  TEXT        NOT NULL DEFAULT 'KLINIK-1' REFERENCES clinics(clinic_id) ON UPDATE CASCADE,
  role       TEXT        NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, role),

  CONSTRAINT app_user_roles_role_chk CHECK (role IN (
    'owner', 'super_admin',
    'admin_appointment', 'admin_finance',
    'doctor'
  )),

  CONSTRAINT app_user_roles_user_fk FOREIGN KEY (user_id)
    REFERENCES app_users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_user_roles_user
  ON app_user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_app_user_roles_clinic_role
  ON app_user_roles(clinic_id, role);

COMMENT ON TABLE app_user_roles IS
  'Many-to-many user <-> role. 1 user bisa punya banyak role (rangkap). Owner & super_admin fully privileged.';
COMMENT ON COLUMN app_user_roles.role IS
  '5 role valid: owner, super_admin, admin_appointment, admin_finance, doctor.';

-- ── 2. Backfill default mapping dari app_users.role existing ─
-- Mapping default (konservatif):
--   'owner'        -> ['owner']
--   'super_admin'  -> ['super_admin']
--   'admin'        -> ['admin_appointment', 'admin_finance']  (rangkap, krn admin lama bisa keduanya)
--   'dokter'       -> ['doctor']
--   lainnya/NULL   -> SKIP (owner manual assign nanti)
--
-- Owner bebas mengubah mapping setelah migration via SQL atau
-- Settings UI (akan dibuat di Step 3 Phase 2a).
INSERT INTO app_user_roles (user_id, clinic_id, role)
SELECT u.user_id,
       COALESCE(u.clinic_id, 'KLINIK-1'),
       'owner'
  FROM app_users u
 WHERE u.is_active IS NOT FALSE
   AND LOWER(TRIM(u.role)) = 'owner'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO app_user_roles (user_id, clinic_id, role)
SELECT u.user_id,
       COALESCE(u.clinic_id, 'KLINIK-1'),
       'super_admin'
  FROM app_users u
 WHERE u.is_active IS NOT FALSE
   AND LOWER(TRIM(u.role)) = 'super_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO app_user_roles (user_id, clinic_id, role)
SELECT u.user_id,
       COALESCE(u.clinic_id, 'KLINIK-1'),
       'admin_appointment'
  FROM app_users u
 WHERE u.is_active IS NOT FALSE
   AND LOWER(TRIM(u.role)) = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO app_user_roles (user_id, clinic_id, role)
SELECT u.user_id,
       COALESCE(u.clinic_id, 'KLINIK-1'),
       'admin_finance'
  FROM app_users u
 WHERE u.is_active IS NOT FALSE
   AND LOWER(TRIM(u.role)) = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO app_user_roles (user_id, clinic_id, role)
SELECT u.user_id,
       COALESCE(u.clinic_id, 'KLINIK-1'),
       'doctor'
  FROM app_users u
 WHERE u.is_active IS NOT FALSE
   AND LOWER(TRIM(u.role)) = 'dokter'
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit untuk cek)
-- =========================================================
-- 1. Lihat semua user + roles[] yg ter-assign
-- SELECT
--   u.user_id,
--   u.full_name,
--   u.role AS old_role_single,
--   STRING_AGG(r.role, ', ' ORDER BY r.role) AS new_roles_rangkap
-- FROM app_users u
-- LEFT JOIN app_user_roles r ON r.user_id = u.user_id
-- WHERE u.is_active IS NOT FALSE
-- GROUP BY u.user_id, u.full_name, u.role
-- ORDER BY u.full_name;
--
-- 2. Hitung total assignment per role
-- SELECT role, COUNT(*) AS user_count
--   FROM app_user_roles
--  GROUP BY role
--  ORDER BY role;
--
-- =========================================================
-- POST-MIGRATION NOTES (no manual edit needed)
-- =========================================================
-- Pre-check distribusi role (2026-05-17) menunjukkan data sudah
-- clean: 6 dokter + 1 admin (Admin Klinik 1) + 1 owner (Hasnan).
-- Default mapping otomatis menghasilkan assignment yg benar.
--
-- Admin Klinik 1 (shared 5+ staff) sengaja diberi rangkap
-- ['admin_appointment', 'admin_finance']. Phase 2b nanti pecah
-- jadi akun per-staff via Clerk dengan role spesifik per orang.
-- =========================================================
