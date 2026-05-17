-- =========================================================
-- Migration 003a — Rename clinic_id ke 'KLINIK-1' + backfill
-- =========================================================
-- Tujuan: setelah migration 003 dijalankan, kita ganti ID
-- klinik default dari 'HAJAR-ASWAD' ke 'KLINIK-1' supaya
-- lebih netral untuk multi-klinik di masa depan (cabang 2,
-- brand baru, dll). Sekaligus:
--   - backfill row clinic_id NULL (terjadi di tabel yang
--     kolomnya sudah ada sebelum 003, mis. app_users — di
--     mana ADD COLUMN IF NOT EXISTS skip total)
--   - force SET DEFAULT 'KLINIK-1' + NOT NULL semua tabel
--   - force FK kalau ada yang missing
--
-- File ini idempotent. Aman dijalankan walau sebagian sudah
-- benar.
--
-- CARA JALANKAN: paste seluruh isi ke Supabase SQL Editor, Run.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Pastikan row 'KLINIK-1' ada di tabel clinics
-- =========================================================
INSERT INTO clinics (clinic_id, name)
VALUES ('KLINIK-1', 'Klinik Gigi Hajar Aswad')
ON CONFLICT (clinic_id) DO NOTHING;


-- =========================================================
-- 2. Migrate semua row clinic_id = 'HAJAR-ASWAD' atau NULL
--    di seluruh tabel public → 'KLINIK-1'
-- =========================================================
DO $$
DECLARE
  rec RECORD;
  affected BIGINT;
BEGIN
  FOR rec IN
    SELECT table_name
      FROM information_schema.columns
     WHERE column_name = 'clinic_id'
       AND table_schema = 'public'
       AND table_name <> 'clinics'
     ORDER BY table_name
  LOOP
    EXECUTE format(
      'UPDATE %I SET clinic_id = %L WHERE clinic_id = %L OR clinic_id IS NULL',
      rec.table_name, 'KLINIK-1', 'HAJAR-ASWAD'
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      RAISE NOTICE 'Tabel %: % baris di-migrate ke KLINIK-1', rec.table_name, affected;
    END IF;
  END LOOP;
END $$;


-- =========================================================
-- 3. Hapus row 'HAJAR-ASWAD' dari tabel clinics
--    (sudah tidak ada yang reference setelah step 2)
-- =========================================================
DELETE FROM clinics WHERE clinic_id = 'HAJAR-ASWAD';


-- =========================================================
-- 4. Force SET DEFAULT 'KLINIK-1' + NOT NULL di semua tabel
-- =========================================================
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT table_name
      FROM information_schema.columns
     WHERE column_name = 'clinic_id'
       AND table_schema = 'public'
       AND table_name <> 'clinics'
     ORDER BY table_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN clinic_id SET DEFAULT %L',
      rec.table_name, 'KLINIK-1'
    );
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN clinic_id SET NOT NULL',
      rec.table_name
    );
  END LOOP;
END $$;


-- =========================================================
-- 5. Force FK kalau ada yang belum terpasang
-- =========================================================
DO $$
DECLARE
  rec RECORD;
  fk_name TEXT;
BEGIN
  FOR rec IN
    SELECT table_name
      FROM information_schema.columns
     WHERE column_name = 'clinic_id'
       AND table_schema = 'public'
       AND table_name <> 'clinics'
     ORDER BY table_name
  LOOP
    fk_name := 'fk_' || rec.table_name || '_clinic_id';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = fk_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON UPDATE CASCADE',
        rec.table_name, fk_name
      );
      RAISE NOTICE 'FK % di-add', fk_name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit)
-- =========================================================
-- 1) Tabel clinics: hanya KLINIK-1, tidak ada HAJAR-ASWAD lagi
--    SELECT * FROM clinics;
--
-- 2) Tidak ada row dengan clinic_id <> 'KLINIK-1' atau NULL:
--    SELECT 'app_users' AS tbl, clinic_id, COUNT(*) FROM app_users     GROUP BY clinic_id
--    UNION ALL SELECT 'patients',     clinic_id, COUNT(*) FROM patients     GROUP BY clinic_id
--    UNION ALL SELECT 'appointments', clinic_id, COUNT(*) FROM appointments GROUP BY clinic_id
--    UNION ALL SELECT 'treatments',   clinic_id, COUNT(*) FROM treatments   GROUP BY clinic_id
--    UNION ALL SELECT 'billings',     clinic_id, COUNT(*) FROM billings     GROUP BY clinic_id
--    UNION ALL SELECT 'payments',     clinic_id, COUNT(*) FROM payments     GROUP BY clinic_id
--    UNION ALL SELECT 'expenses',     clinic_id, COUNT(*) FROM expenses     GROUP BY clinic_id
--    ORDER BY tbl;
--    Semua clinic_id harus 'KLINIK-1'.
--
-- 3) Default value semua tabel = 'KLINIK-1':
--    SELECT table_name, column_default, is_nullable
--      FROM information_schema.columns
--     WHERE column_name = 'clinic_id'
--       AND table_schema = 'public'
--     ORDER BY table_name;
