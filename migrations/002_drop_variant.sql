-- =========================================================
-- Migration 002 — Drop variant + drop first_plus_extra
-- =========================================================
-- Tujuan:
-- 1) Hapus kolom variant dari doctor_material_deductions dan
--    treatment_items, karena varian (rarb/ra/rb, atau "Tambahan")
--    ternyata sudah dipisah jadi service terpisah di service_catalog.
-- 2) Hapus tipe potongan 'first_plus_extra' beserta kolom
--    first_tooth_amount dan extra_tooth_amount, karena pola
--    "gigi pertama + tambahan" juga sudah ter-handle di level
--    service_catalog (mis. "Gipal Valplast" + "Gipal Valplast Tambahan").
--
-- Constraint baru: deduction_type IN ('fixed', 'per_tooth').
--
-- CARA JALANKAN: Copy isi BEGIN..COMMIT, paste ke Supabase SQL Editor, Run.
-- =========================================================

BEGIN;

-- ── 1. Drop unique index lama yang include variant ─────────
DROP INDEX IF EXISTS dmd_unique_idx;

-- ── 2. Drop kolom variant ──────────────────────────────────
ALTER TABLE doctor_material_deductions DROP COLUMN IF EXISTS variant;
ALTER TABLE treatment_items             DROP COLUMN IF EXISTS variant;

-- ── 3. Create unique index baru tanpa variant ──────────────
CREATE UNIQUE INDEX dmd_unique_idx
  ON doctor_material_deductions (doctor_name, service_id, category);

-- ── 4. Drop check constraint lama (yang allow first_plus_extra) ─
ALTER TABLE doctor_material_deductions DROP CONSTRAINT IF EXISTS dmd_type_chk;
ALTER TABLE doctor_material_deductions DROP CONSTRAINT IF EXISTS dmd_amount_consistency_chk;

-- ── 5. Drop kolom first_tooth_amount & extra_tooth_amount ──
ALTER TABLE doctor_material_deductions DROP COLUMN IF EXISTS first_tooth_amount;
ALTER TABLE doctor_material_deductions DROP COLUMN IF EXISTS extra_tooth_amount;

-- ── 6. Recreate check constraints tanpa first_plus_extra ───
ALTER TABLE doctor_material_deductions
  ADD CONSTRAINT dmd_type_chk
  CHECK (deduction_type IN ('fixed', 'per_tooth'));

ALTER TABLE doctor_material_deductions
  ADD CONSTRAINT dmd_amount_consistency_chk
  CHECK (
    (deduction_type = 'fixed'     AND amount IS NOT NULL AND amount >= 0)
    OR
    (deduction_type = 'per_tooth' AND per_tooth_amount IS NOT NULL AND per_tooth_amount >= 0)
  );

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'doctor_material_deductions' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'treatment_items' AND column_name = 'variant';
