-- =========================================================
-- Migration 011 — Phase 3 Audit Log
-- =========================================================
-- Tabel rekam jejak setiap mutasi data penting di aplikasi.
-- Tiap entry = 1 baris: siapa actor-nya, role-nya saat itu,
-- entity apa yang disentuh, action apa yang dilakukan, dan
-- snapshot nilai sebelum/sesudah perubahan.
--
-- KOLOM:
--   id              BIGSERIAL PK  — auto-increment, ordering
--   occurred_at     TIMESTAMPTZ   — waktu kejadian (server time)
--   clinic_id       TEXT          — per-clinic scope
--   actor_user_id   TEXT          — user_id yang melakukan action
--   actor_roles     TEXT[]        — snapshot semua role aktor saat action
--                                   (role rangkap → array; mis. {admin_appointment,admin_finance})
--   entity_type     TEXT          — patient | appointment | treatment | billing |
--                                   payment | expense | service_catalog |
--                                   doctor_compensation_rule | ortho_recall |
--                                   user | etc
--   entity_id       TEXT          — ID record yang dimodifikasi
--   action          TEXT          — create | update | delete | cancel | restore |
--                                   complete | confirm | activate | deactivate | etc
--   old_value       JSONB         — snapshot nilai sebelum mutasi (NULL untuk create)
--   new_value       JSONB         — snapshot nilai sesudah mutasi (NULL untuk delete)
--   notes           TEXT          — catatan tambahan opsional
--
-- VISIBILITY PER ROLE (di-enforce di UI tab Aktivitas P3.5):
--   owner / super_admin → lihat semua entry
--   admin_appointment   → entity_type ∈ {patient, appointment, treatment, ortho_recall}
--   admin_finance       → entity_type ∈ {billing, payment, expense, service_catalog, doctor_compensation_rule}
--   doctor              → tab Aktivitas hidden total
--
-- RETENTION POLICY: defer ke akhir Phase 3 (sekarang retain selamanya).
--
-- CARA JALANKAN:
-- 1. Buka Supabase Dashboard → SQL Editor → New Query
-- 2. Paste seluruh isi file ini
-- 3. Klik Run
-- 4. Verify:
--    SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='audit_log' ORDER BY ordinal_position;
--    → harus return 11 baris (id, occurred_at, ..., notes)
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clinic_id       TEXT        NOT NULL,
  actor_user_id   TEXT        NOT NULL,
  actor_roles     TEXT[]      NOT NULL DEFAULT '{}',
  entity_type     TEXT        NOT NULL,
  entity_id       TEXT        NOT NULL,
  action          TEXT        NOT NULL,
  old_value       JSONB,
  new_value       JSONB,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at
  ON audit_log (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic_actor
  ON audit_log (clinic_id, actor_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic_entity
  ON audit_log (clinic_id, entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic_action
  ON audit_log (clinic_id, action, occurred_at DESC);

COMMENT ON TABLE audit_log IS
  'Phase 3: rekam jejak setiap mutasi data penting (actor, entity, action, old/new value snapshot)';

COMMENT ON COLUMN audit_log.actor_roles IS
  'Snapshot SEMUA role yang dimiliki actor saat action terjadi (role rangkap → array)';

COMMENT ON COLUMN audit_log.entity_type IS
  'patient | appointment | treatment | billing | payment | expense | service_catalog | doctor_compensation_rule | ortho_recall | user | etc';

COMMENT ON COLUMN audit_log.action IS
  'create | update | delete | cancel | restore | complete | confirm | activate | deactivate | etc';

COMMENT ON COLUMN audit_log.old_value IS
  'JSONB snapshot nilai sebelum mutasi (NULL untuk action create)';

COMMENT ON COLUMN audit_log.new_value IS
  'JSONB snapshot nilai sesudah mutasi (NULL untuk action delete)';

-- Reload PostgREST schema cache supaya tabel baru langsung dikenali API
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- 1. Cek tabel terbentuk + jumlah kolom:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'audit_log'
--  ORDER BY ordinal_position;
-- → 11 baris
--
-- 2. Cek index terbentuk:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'audit_log';
-- → idx_audit_log_occurred_at, idx_audit_log_clinic_actor,
--   idx_audit_log_clinic_entity, idx_audit_log_clinic_action,
--   audit_log_pkey
--
-- 3. Smoke test insert (cleanup setelah):
-- INSERT INTO audit_log (clinic_id, actor_user_id, actor_roles, entity_type, entity_id, action, new_value)
-- VALUES ('KLINIK-1', 'TEST-USER', ARRAY['owner'], 'test', 'TEST-001', 'create', '{"x":1}'::jsonb)
-- RETURNING *;
-- DELETE FROM audit_log WHERE actor_user_id = 'TEST-USER';
