-- Migration 010: Tambah kolom `notes` ke service_catalog
--
-- KENAPA: SettingsService.updateServiceCatalog & addServiceCatalog set field
-- `notes` (deskripsi opsional layanan), tapi tabel Supabase service_catalog
-- tidak punya kolom ini → PostgREST error PGRST204:
-- "Could not find the 'notes' column of 'service_catalog' in the schema cache"
--
-- ROOT CAUSE: service_catalog dibuat manual di Supabase dashboard sebelum
-- folder migrations/ ada — kolom `notes` ada di Spreadsheet headers tapi
-- tidak ikut dimigrate ke Supabase.
--
-- DAMPAK SETELAH FIX: edit layanan di Settings → Katalog Layanan akan
-- berhasil simpan notes ke Supabase.
--
-- CARA JALANKAN:
-- 1. Buka Supabase Dashboard → SQL Editor → New Query
-- 2. Paste seluruh isi file ini
-- 3. Klik Run
-- 4. Verify: SELECT column_name FROM information_schema.columns
--           WHERE table_name='service_catalog' AND column_name='notes';
--    → harus return 1 baris.

ALTER TABLE service_catalog
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Reload PostgREST schema cache supaya kolom baru langsung dikenali API
-- (tanpa reload, butuh tunggu beberapa menit sampai cache auto-refresh).
NOTIFY pgrst, 'reload schema';
