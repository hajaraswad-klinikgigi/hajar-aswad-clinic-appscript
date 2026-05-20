-- =========================================================
-- Migration 013 — Backfill Timezone Offset (-7 jam) untuk
-- Data Pre-Deploy Hotfix nowIso() Fix (2026-05-20)
-- =========================================================
-- KONTEKS:
--   Sebelum hotfix /exec @154 di 2026-05-20, `nowIso()` di
--   PatientService.js return Bangkok local string TANPA timezone
--   marker (format 'yyyy-MM-dd HH:mm:ss'). Postgres TIMESTAMPTZ
--   interpret string tanpa TZ sebagai UTC → data tersimpan dengan
--   label UTC tapi angka jam-nya = jam WIB → display geser +7 jam.
--
--   Setelah hotfix, `nowIso()` return ISO 8601 UTC dengan 'Z' marker
--   dan milliseconds (e.g., '2026-05-20T08:16:07.366Z') → benar.
--
-- IDENTIFIKASI PRE-DEPLOY (bugged) vs POST-DEPLOY (correct):
--   - Pre-deploy: Utilities.formatDate(...) TIDAK include milliseconds
--     → tersimpan dengan ms = 0  → `date_trunc('second', col) = col`
--   - Post-deploy: new Date().toISOString() ALWAYS include milliseconds
--     (random 0-999) → ~99.9% probability ms != 0
--   Pakai kriterion ms = 0 untuk detect pre-deploy row.
--
-- TIDAK di-shift (tabel yang sudah benar sejak awal):
--   - doctor_compensation_rules (service pakai new Date().toISOString())
--   - doctor_material_deductions (sama)
--   - clinics (insert via migration DEFAULT now())
--
-- SAFETY:
--   1. Backup database WAJIB sebelum execute (Supabase Dashboard →
--      Database → Backups → Create backup)
--   2. Script wrapped dalam BEGIN/COMMIT — kalau ada error, rollback
--      otomatis (sebelum COMMIT)
--   3. Per-kolom UPDATE (bukan per-row) supaya row dengan created_at
--      pre-deploy + updated_at post-deploy ter-handle benar
--   4. WHERE col IS NOT NULL untuk kolom optional supaya NULL tidak
--      ter-evaluasi (defensif)
--   5. Edge case: ~0.1% probability post-deploy row punya ms = 0
--      kebetulan → akan false-positive shifted. Volume diestimasi
--      <1 row per ribuan write. Acceptable.
--
-- LANGKAH EXECUTE:
--   1. BACKUP DATABASE di Supabase Dashboard
--   2. Buka Supabase SQL Editor
--   3. Paste seluruh script ini
--   4. Klik RUN
--   5. Spot-check via query verifikasi di akhir
-- =========================================================

BEGIN;

-- =========================================================
-- AUDIT LOG (paling sering dilihat owner di halaman Aktivitas)
-- =========================================================
UPDATE audit_log
SET occurred_at = occurred_at - INTERVAL '7 hours'
WHERE date_trunc('second', occurred_at) = occurred_at;

-- =========================================================
-- PATIENTS
-- =========================================================
UPDATE patients
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE patients
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- APPOINTMENTS
-- =========================================================
UPDATE appointments
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE appointments
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- TREATMENTS
-- =========================================================
UPDATE treatments
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE treatments
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- TREATMENT_ITEMS
-- =========================================================
UPDATE treatment_items
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE treatment_items
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- BILLINGS (+ kolom optional invoice_pdf_signature_at, invoice_sent_at)
-- =========================================================
UPDATE billings
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE billings
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

UPDATE billings
SET invoice_pdf_signature_at = invoice_pdf_signature_at - INTERVAL '7 hours'
WHERE invoice_pdf_signature_at IS NOT NULL
  AND date_trunc('second', invoice_pdf_signature_at) = invoice_pdf_signature_at;

UPDATE billings
SET invoice_sent_at = invoice_sent_at - INTERVAL '7 hours'
WHERE invoice_sent_at IS NOT NULL
  AND date_trunc('second', invoice_sent_at) = invoice_sent_at;

-- =========================================================
-- BILLING_ITEMS
-- =========================================================
UPDATE billing_items
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE billing_items
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- BILLING_ADJUSTMENTS
-- =========================================================
UPDATE billing_adjustments
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE billing_adjustments
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- BILLING_INSTALLMENTS (+ paid_at optional)
-- =========================================================
UPDATE billing_installments
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE billing_installments
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

UPDATE billing_installments
SET paid_at = paid_at - INTERVAL '7 hours'
WHERE paid_at IS NOT NULL
  AND date_trunc('second', paid_at) = paid_at;

-- =========================================================
-- BILLING_FEEDBACKS (+ submitted_at optional)
-- =========================================================
UPDATE billing_feedbacks
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE billing_feedbacks
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

UPDATE billing_feedbacks
SET submitted_at = submitted_at - INTERVAL '7 hours'
WHERE submitted_at IS NOT NULL
  AND date_trunc('second', submitted_at) = submitted_at;

-- =========================================================
-- PAYMENTS
-- =========================================================
UPDATE payments
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE payments
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- EXPENSES
-- =========================================================
UPDATE expenses
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE expenses
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- ORTHO_RECALLS (+ completed_at optional)
-- =========================================================
UPDATE ortho_recalls
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE ortho_recalls
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

UPDATE ortho_recalls
SET completed_at = completed_at - INTERVAL '7 hours'
WHERE completed_at IS NOT NULL
  AND date_trunc('second', completed_at) = completed_at;

-- =========================================================
-- PATIENT_PHOTOS (+ deleted_at optional)
-- =========================================================
UPDATE patient_photos
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE patient_photos
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

UPDATE patient_photos
SET deleted_at = deleted_at - INTERVAL '7 hours'
WHERE deleted_at IS NOT NULL
  AND date_trunc('second', deleted_at) = deleted_at;

-- =========================================================
-- SERVICE_CATALOG
-- =========================================================
UPDATE service_catalog
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE service_catalog
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- CLINIC_INFO
-- =========================================================
UPDATE clinic_info
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE clinic_info
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

-- =========================================================
-- MEDICAL_RECORDS (cuma created_at, no updated_at)
-- =========================================================
UPDATE medical_records
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

-- =========================================================
-- APP_USERS (+ totp_enabled_at optional)
-- =========================================================
UPDATE app_users
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE app_users
SET updated_at = updated_at - INTERVAL '7 hours'
WHERE date_trunc('second', updated_at) = updated_at;

UPDATE app_users
SET totp_enabled_at = totp_enabled_at - INTERVAL '7 hours'
WHERE totp_enabled_at IS NOT NULL
  AND date_trunc('second', totp_enabled_at) = totp_enabled_at;

-- =========================================================
-- APP_USER_ROLES
-- =========================================================
UPDATE app_user_roles
SET granted_at = granted_at - INTERVAL '7 hours'
WHERE date_trunc('second', granted_at) = granted_at;

-- =========================================================
-- TOTP_SETUP_TOKENS (+ used_at optional)
-- =========================================================
UPDATE totp_setup_tokens
SET created_at = created_at - INTERVAL '7 hours'
WHERE date_trunc('second', created_at) = created_at;

UPDATE totp_setup_tokens
SET expires_at = expires_at - INTERVAL '7 hours'
WHERE date_trunc('second', expires_at) = expires_at;

UPDATE totp_setup_tokens
SET used_at = used_at - INTERVAL '7 hours'
WHERE used_at IS NOT NULL
  AND date_trunc('second', used_at) = used_at;

COMMIT;

-- =========================================================
-- VERIFIKASI POST-BACKFILL — JALANKAN MANUAL SETELAH COMMIT
-- =========================================================
-- Spot-check audit_log (paling sering dilihat owner)
-- Hasil yang diharapkan: kolom waktu_wib menampilkan waktu yang
-- masuk akal (mis. action sore kemarin tampak sebagai sore kemarin,
-- bukan tengah malam hari ini).
--
-- SELECT id,
--        occurred_at AS raw_utc,
--        occurred_at AT TIME ZONE 'Asia/Jakarta' AS waktu_wib,
--        actor_user_id,
--        entity_type,
--        action
-- FROM audit_log
-- ORDER BY occurred_at DESC
-- LIMIT 10;
--
-- Spot-check patients (membandingkan pre vs post fix)
-- - Patient yang ditambah PRE-deploy (sebelum ~15:13 WIB hari ini):
--   stored ms = 0, sudah di-shift, harusnya waktu_wib = waktu action asli
-- - Patient yang ditambah POST-deploy (setelah ~15:13 WIB hari ini):
--   stored ms != 0, TIDAK di-shift, waktu_wib = waktu action benar
--
-- SELECT patient_id,
--        created_at AS raw_utc,
--        created_at AT TIME ZONE 'Asia/Jakarta' AS waktu_wib,
--        EXTRACT(MILLISECONDS FROM created_at)::INT % 1000 AS ms_part
-- FROM patients
-- ORDER BY created_at DESC
-- LIMIT 10;
--
-- =========================================================
-- ROLLBACK PLAN (kalau hasil ternyata tidak benar):
-- =========================================================
-- Restore dari Supabase Backup yang dibuat di langkah 1.
-- Dashboard → Database → Backups → pilih backup → Restore
-- =========================================================
