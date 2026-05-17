-- =========================================================
-- Migration 003b — Doctor Master Consolidation (Phase 1.5)
-- =========================================================
-- Tujuan: pisahkan data master dokter (untuk dropdown treatment
-- + fee) dari identitas login. Dropdown dokter di modal Treatment
-- akan ambil dari `doctor_compensation_rules`, bukan dari
-- `app_users` (role='dokter').
--
-- Manfaat:
--   - Dokter freelance/kontrak yang belum punya akun login
--     tetap bisa ditambah di Settings > Fee Dokter
--   - Owner ganti fee tanpa harus sentuh akun login dokter
--   - Data treatment terpisah dari data autentikasi
--     (separation of concerns)
--
-- PRE-CONDITION (sudah dijalankan manual sebelum migration ini):
--   1. Rename rule `drg. Michael` -> `drg.Michael Christian Ginting`
--   2. Rename rule `drg. Nia`     -> `drg.Nia Zulmi`
--   Verifikasi: 6 dokter di doctor_compensation_rules sekarang
--   konsisten dengan app_users full_name (case-sensitive).
--
-- Yang TIDAK ditangani migration ini (digeser ke Phase 2):
--   - User `dr. Hasnan Habibi Siregar` (owner) role-nya 'dokter'
--     di app_users tapi tidak praktek -> perbaiki saat Phase 2
--     (Clerk + role rangkap)
--   - User `Admin Klinik 1` (shared account 5+ staff) role-nya
--     'dokter' -> perbaiki saat Phase 2 (akun per-staff)
--   - Setelah refactor frontend Phase 1.5, dropdown treatment
--     ambil dari doctor_compensation_rules, jadi 2 user di atas
--     OTOMATIS tidak muncul di dropdown -- tidak ganggu workflow.
--
-- CARA JALANKAN:
--   Buka Supabase Dashboard -> SQL Editor -> Paste seluruh
--   file ini -> Run. Jalankan SEKALI saja. Aman dijalankan
--   dalam satu transaksi.
-- =========================================================

BEGIN;

-- ── 1. Tambah kolom optional `clinic_user_id` ───────────────
-- Kolom ini untuk explicit link rule fee dokter ke akun login
-- (kalau dokter punya akun di clinic_users -- tabel yang akan
-- dibuat di Phase 2). Dokter freelance tanpa akun login tetap
-- punya rule (clinic_user_id = NULL).
--
-- FK ke clinic_users SENGAJA TIDAK ditambah sekarang karena
-- tabel clinic_users belum ada (Phase 2). FK akan ditambah saat
-- Phase 2 setelah clinic_users tersedia.
ALTER TABLE doctor_compensation_rules
  ADD COLUMN IF NOT EXISTS clinic_user_id BIGINT;

COMMENT ON COLUMN doctor_compensation_rules.clinic_user_id IS
  'Optional FK ke clinic_users (Phase 2). NULL = dokter freelance/kontrak yang tidak punya akun login. FK constraint ditambah saat Phase 2 setelah tabel clinic_users tersedia.';

COMMIT;

-- =========================================================
-- VERIFIKASI (jalankan setelah commit untuk cek)
-- =========================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'doctor_compensation_rules'
--   ORDER BY ordinal_position;
--
-- Harus muncul kolom clinic_user_id (bigint, nullable=YES) di
-- daftar kolom.
