-- =========================================================
-- Migration 003 — Multi-Klinik Foundation
-- =========================================================
-- Tujuan: Menyiapkan fondasi multi-klinik dengan menambah
-- kolom `clinic_id` di SEMUA tabel mutasi. Semua data existing
-- akan ter-tag ke klinik 'KLINIK-1' lewat DEFAULT value,
-- sehingga TIDAK perlu backfill manual.
--
-- Setelah migration ini, klinik kedua dapat ditambahkan kapan
-- saja tanpa refactor schema — cukup INSERT ke tabel `clinics`.
--
-- CATATAN PENTING:
-- 1. Backend code (DataAccess.js + ClinicScope.js) akan auto-
--    inject `clinic_id` di semua INSERT dan auto-filter di
--    semua SELECT setelah migration ini dijalankan.
-- 2. Aman dijalankan SEKALI saja dalam satu transaksi.
-- 3. Idempotent: bisa dijalankan ulang tanpa error
--    (pakai IF NOT EXISTS).
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard -> SQL Editor -> Paste seluruh
--   file ini -> Run.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Tabel `clinics` — master daftar klinik
-- =========================================================
CREATE TABLE IF NOT EXISTS clinics (
  clinic_id   TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinics IS
  'Master daftar klinik. Setiap row di tabel mutasi (patients, appointments, dll) di-scope ke salah satu clinic_id di sini.';

-- Seed klinik default — semua data existing akan ter-tag ke sini.
INSERT INTO clinics (clinic_id, name)
VALUES ('KLINIK-1', 'Klinik Gigi Hajar Aswad')
ON CONFLICT (clinic_id) DO NOTHING;


-- =========================================================
-- 2. Trigger updated_at untuk tabel `clinics`
-- =========================================================
CREATE OR REPLACE FUNCTION clinics_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinics_updated_at_trg ON clinics;
CREATE TRIGGER clinics_updated_at_trg
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION clinics_set_updated_at();


-- =========================================================
-- 3. Tambah `clinic_id` ke semua tabel mutasi
-- =========================================================
-- Pattern untuk setiap tabel:
--   - ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'KLINIK-1'
--   - FK ke clinics(clinic_id) dengan ON UPDATE CASCADE
--   - Index untuk performa scope query
--
-- Helper: function yang patch sebuah tabel sekaligus (kolom +
-- FK + index). Idempotent — bisa dijalankan ulang.
-- =========================================================
CREATE OR REPLACE FUNCTION pg_temp.add_clinic_id_to_(table_name TEXT) RETURNS VOID AS $$
DECLARE
  fk_name  TEXT := 'fk_' || table_name || '_clinic_id';
  idx_name TEXT := 'idx_' || table_name || '_clinic_id';
BEGIN
  -- Skip dengan NOTICE kalau tabel belum ada (mis. fitur belum
  -- live di klinik ini). Aman supaya migration tidak gagal
  -- total karena satu tabel yang absent.
  IF to_regclass(table_name) IS NULL THEN
    RAISE NOTICE 'Tabel % tidak ditemukan, skip.', table_name;
    RETURN;
  END IF;

  -- 3a. Tambah kolom clinic_id (kalau belum ada)
  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT %L',
    table_name, 'KLINIK-1'
  );

  -- 3b. Tambah FK ke clinics (kalau belum ada)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = fk_name
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON UPDATE CASCADE',
      table_name, fk_name
    );
  END IF;

  -- 3c. Tambah index (kalau belum ada)
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (clinic_id)',
    idx_name, table_name
  );
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 4. Eksekusi untuk semua 19 tabel mutasi
-- =========================================================
SELECT pg_temp.add_clinic_id_to_('app_users');
SELECT pg_temp.add_clinic_id_to_('patients');
SELECT pg_temp.add_clinic_id_to_('appointments');
SELECT pg_temp.add_clinic_id_to_('service_catalog');
SELECT pg_temp.add_clinic_id_to_('treatments');
SELECT pg_temp.add_clinic_id_to_('treatment_items');
SELECT pg_temp.add_clinic_id_to_('medical_records');
SELECT pg_temp.add_clinic_id_to_('patient_photos');
SELECT pg_temp.add_clinic_id_to_('ortho_recalls');
SELECT pg_temp.add_clinic_id_to_('billings');
SELECT pg_temp.add_clinic_id_to_('billing_items');
SELECT pg_temp.add_clinic_id_to_('billing_adjustments');
SELECT pg_temp.add_clinic_id_to_('billing_installments');
SELECT pg_temp.add_clinic_id_to_('payments');
SELECT pg_temp.add_clinic_id_to_('billing_feedbacks');
SELECT pg_temp.add_clinic_id_to_('expenses');
SELECT pg_temp.add_clinic_id_to_('doctor_compensation_rules');
SELECT pg_temp.add_clinic_id_to_('doctor_material_deductions');
SELECT pg_temp.add_clinic_id_to_('clinic_info');


-- =========================================================
-- 5. Cleanup function pg_temp (otomatis di-drop akhir session,
--    tapi kita drop eksplisit untuk kebersihan)
-- =========================================================
DROP FUNCTION IF EXISTS pg_temp.add_clinic_id_to_(TEXT);

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit untuk cek)
-- =========================================================
-- 1) Cek tabel clinics terbentuk + seed:
--    SELECT * FROM clinics;
--
-- 2) Cek semua 19 tabel sudah punya kolom clinic_id:
--    SELECT table_name FROM information_schema.columns
--     WHERE column_name = 'clinic_id'
--       AND table_schema = 'public'
--     ORDER BY table_name;
--    Harusnya return 19 baris.
--
-- 3) Cek semua data existing ter-tag KLINIK-1:
--    SELECT 'patients'  AS tbl, clinic_id, COUNT(*) FROM patients     GROUP BY clinic_id
--    UNION ALL SELECT 'appointments', clinic_id, COUNT(*) FROM appointments GROUP BY clinic_id
--    UNION ALL SELECT 'treatments',   clinic_id, COUNT(*) FROM treatments   GROUP BY clinic_id
--    UNION ALL SELECT 'billings',     clinic_id, COUNT(*) FROM billings     GROUP BY clinic_id
--    UNION ALL SELECT 'payments',     clinic_id, COUNT(*) FROM payments     GROUP BY clinic_id
--    UNION ALL SELECT 'expenses',     clinic_id, COUNT(*) FROM expenses     GROUP BY clinic_id
--    ORDER BY tbl;
--    Harusnya semua row clinic_id = 'KLINIK-1'.
--
-- 4) Cek FK + index terpasang untuk semua tabel:
--    SELECT conname, conrelid::regclass AS table
--      FROM pg_constraint
--     WHERE conname LIKE 'fk_%_clinic_id'
--     ORDER BY table;
--
--    SELECT indexname, tablename
--      FROM pg_indexes
--     WHERE indexname LIKE 'idx_%_clinic_id'
--     ORDER BY tablename;
