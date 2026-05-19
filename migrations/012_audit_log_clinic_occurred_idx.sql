-- =========================================================
-- Migration 012 — Index audit_log untuk query default
-- =========================================================
-- Migration 011 sudah buat 4 index composite:
--   (clinic_id, actor_user_id, occurred_at DESC)
--   (clinic_id, entity_type, entity_id, occurred_at DESC)
--   (clinic_id, action, occurred_at DESC)
--   (occurred_at DESC)
--
-- TAPI query default halaman Aktivitas (tanpa filter entity/action/actor):
--   WHERE clinic_id = X AND occurred_at >= Y ORDER BY occurred_at DESC LIMIT 2001
-- TIDAK punya index optimal — composite (clinic_id, action, occurred_at) bisa
-- dipakai tapi PostgreSQL harus range-scan semua action value untuk clinic
-- itu. Setelah volume mencapai >100K row akan jadi lambat.
--
-- Index baru `idx_audit_log_clinic_occurred` (clinic_id, occurred_at DESC) =
-- direct match untuk query default. Postgres bisa langsung index range scan
-- dari occurred_at terbaru ke startDate.
--
-- TRADE-OFF: tambah ~1 index → write overhead ~5% per INSERT. Acceptable
-- karena read pattern jauh lebih sering (UI Aktivitas tiap user).
--
-- CARA JALANKAN:
-- 1. Buka Supabase Dashboard → SQL Editor → New Query
-- 2. Paste seluruh isi file ini
-- 3. Klik Run
-- 4. Verify:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'audit_log';
--    → harus include idx_audit_log_clinic_occurred
--
-- PERFORMANCE TEST (post-migration):
--    EXPLAIN ANALYZE
--    SELECT * FROM audit_log
--    WHERE clinic_id = 'KLINIK-1' AND occurred_at >= NOW() - INTERVAL '7 days'
--    ORDER BY occurred_at DESC LIMIT 2001;
--    → harus pakai "Index Scan using idx_audit_log_clinic_occurred"
-- =========================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic_occurred
  ON audit_log (clinic_id, occurred_at DESC);

COMMIT;
