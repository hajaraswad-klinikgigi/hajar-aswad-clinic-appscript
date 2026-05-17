-- =========================================================
-- Migration 001 — Doctor Material & Lab Deductions
-- =========================================================
-- Tujuan: Mengganti model material_deduction lama (1 persentase
-- per dokter) dengan model baru per LAYANAN per DOKTER, dalam
-- NOMINAL Rupiah, dengan dukungan varian (rarb/ra/rb) dan
-- formula khusus untuk lab (per_tooth, first_plus_extra).
--
-- Juga menambah operational_deduction untuk dokter dengan
-- kasus khusus (mis. Drg David: 15%).
--
-- Formula fee baru:
--   fee = (subtotal - total_bahan - total_lab)
--         * (1 - operational_deduction)
--         * percentage
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard -> SQL Editor -> Paste seluruh
--   file ini -> Run. Jalankan SEKALI saja. Aman dijalankan
--   dalam satu transaksi.
-- =========================================================

BEGIN;

-- ── 0. Pastikan service_catalog.service_id UNIQUE ──────────
-- Diperlukan supaya FK dari doctor_material_deductions bisa dibuat.
-- Aman dijalankan berulang: kalau constraint sudah ada, ALTER akan gagal
-- → kita pakai DO block dengan cek pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'service_catalog'::regclass
      AND contype IN ('p', 'u')
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'service_catalog'::regclass AND attname = 'service_id')
      ]
  ) THEN
    -- Cek dulu apakah ada duplikat
    IF EXISTS (
      SELECT service_id FROM service_catalog
      GROUP BY service_id HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'service_catalog.service_id ada duplikat. Bersihkan dulu sebelum lanjut migration.';
    END IF;

    ALTER TABLE service_catalog
      ADD CONSTRAINT service_catalog_service_id_unique UNIQUE (service_id);
  END IF;
END $$;


-- ── 1. Tabel baru: doctor_material_deductions ───────────────
CREATE TABLE IF NOT EXISTS doctor_material_deductions (
  id                  BIGSERIAL PRIMARY KEY,
  doctor_name         TEXT NOT NULL REFERENCES doctor_compensation_rules(doctor_name)
                        ON DELETE CASCADE ON UPDATE CASCADE,
  service_id          TEXT NOT NULL REFERENCES service_catalog(service_id)
                        ON UPDATE CASCADE,
  variant             TEXT,                       -- 'rarb', 'ra', 'rb', atau NULL (tanpa varian)
  category            TEXT NOT NULL,              -- 'material' atau 'lab'
  deduction_type      TEXT NOT NULL,              -- 'fixed' | 'per_tooth' | 'first_plus_extra'
  amount              NUMERIC,                    -- untuk deduction_type='fixed'
  per_tooth_amount    NUMERIC,                    -- untuk deduction_type='per_tooth'
  first_tooth_amount  NUMERIC,                    -- untuk deduction_type='first_plus_extra'
  extra_tooth_amount  NUMERIC,                    -- untuk deduction_type='first_plus_extra'
  is_active           BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint kategori valid
  CONSTRAINT dmd_category_chk CHECK (category IN ('material', 'lab')),

  -- Constraint deduction_type valid
  CONSTRAINT dmd_type_chk CHECK (
    deduction_type IN ('fixed', 'per_tooth', 'first_plus_extra')
  ),

  -- Constraint: kolom nominal sesuai deduction_type
  CONSTRAINT dmd_amount_consistency_chk CHECK (
    (deduction_type = 'fixed'             AND amount IS NOT NULL AND amount >= 0)
    OR
    (deduction_type = 'per_tooth'         AND per_tooth_amount IS NOT NULL AND per_tooth_amount >= 0)
    OR
    (deduction_type = 'first_plus_extra'  AND first_tooth_amount IS NOT NULL AND first_tooth_amount >= 0
                                          AND extra_tooth_amount IS NOT NULL AND extra_tooth_amount >= 0)
  )
);

-- UNIQUE per (dokter, layanan, varian, kategori).
-- Catatan: NULL di Postgres dianggap distinct, jadi (dokter, svc, NULL, 'material')
-- bisa muncul lebih dari sekali. Pakai NULLS NOT DISTINCT (Postgres 15+) untuk strict.
CREATE UNIQUE INDEX IF NOT EXISTS dmd_unique_idx
  ON doctor_material_deductions (doctor_name, service_id, COALESCE(variant, ''), category);

CREATE INDEX IF NOT EXISTS dmd_doctor_idx  ON doctor_material_deductions (doctor_name);
CREATE INDEX IF NOT EXISTS dmd_service_idx ON doctor_material_deductions (service_id);

COMMENT ON TABLE doctor_material_deductions IS
  'Potongan bahan/lab per dokter per layanan. Nominal Rupiah dengan dukungan varian dan formula per_tooth.';
COMMENT ON COLUMN doctor_material_deductions.variant IS
  'Varian layanan: rarb (rahang atas+bawah), ra (rahang atas), rb (rahang bawah), atau NULL jika tidak bervarian.';
COMMENT ON COLUMN doctor_material_deductions.deduction_type IS
  'fixed = nominal tetap. per_tooth = amount per qty gigi. first_plus_extra = gigi pertama + (qty-1)*tambahan.';


-- ── 2. doctor_compensation_rules: drop material_deduction lama
ALTER TABLE doctor_compensation_rules
  DROP COLUMN IF EXISTS material_deduction;

-- ── 3. doctor_compensation_rules: tambah operational_deduction
ALTER TABLE doctor_compensation_rules
  ADD COLUMN IF NOT EXISTS operational_deduction NUMERIC(4,3) NOT NULL DEFAULT 0
  CHECK (operational_deduction >= 0 AND operational_deduction <= 1);

COMMENT ON COLUMN doctor_compensation_rules.operational_deduction IS
  'Potongan operasional persentase (0..1). Diterapkan setelah potongan bahan & lab, sebelum percentage fee. Contoh: 0.15 = 15% untuk Drg David.';


-- ── 4. treatment_items: tambah variant
ALTER TABLE treatment_items
  ADD COLUMN IF NOT EXISTS variant TEXT;

COMMENT ON COLUMN treatment_items.variant IS
  'Varian layanan yang dipilih saat treatment (rarb/ra/rb). NULL jika layanan tidak punya varian. Dipakai untuk lookup potongan bahan/lab.';


-- ── 5. Trigger updated_at di doctor_material_deductions ────
CREATE OR REPLACE FUNCTION dmd_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dmd_updated_at_trg ON doctor_material_deductions;
CREATE TRIGGER dmd_updated_at_trg
  BEFORE UPDATE ON doctor_material_deductions
  FOR EACH ROW EXECUTE FUNCTION dmd_set_updated_at();

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit untuk cek)
-- =========================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'doctor_compensation_rules' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'treatment_items' AND column_name = 'variant';
-- SELECT * FROM doctor_material_deductions LIMIT 1;
