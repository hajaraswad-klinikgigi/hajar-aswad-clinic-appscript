-- =========================================================
-- Migration 008 — Tabel totp_setup_tokens (link sekali pakai)
-- =========================================================
-- Tujuan: owner / super_admin kirim email berisi link sekali pakai
-- ke staff untuk setup Google Authenticator. Link berisi token unik
-- yg expire dalam 24 jam atau setelah staff selesai scan.
--
-- Flow:
--   1. Owner klik "Kirim Link Setup ke Email" di Settings → backend
--      generate token UUID + simpan di table ini + kirim email pakai
--      MailApp.sendEmail().
--   2. Staff buka email → klik link Apps Script /exec?totp_setup_token=XXX
--   3. doGet detect param token → render halaman standalone berisi QR
--   4. Staff scan QR di Authenticator app → klik "Saya sudah scan"
--   5. Backend markTotpSetupTokenUsed → set used_at, secret tetap
--      tersimpan di app_users.totp_secret (generated saat request)
--
-- Security:
--   - Token UUID v4 (cryptographically random)
--   - Expire 24 jam
--   - Used_at NOT NULL = link sudah dipakai, tidak bisa scan lagi
--   - Kalau link bocor sebelum staff scan, attacker bisa setup
--     Authenticator mereka & login as staff. Mitigation: owner
--     verifikasi staff sudah berhasil scan sebelum forget about it.
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS totp_setup_tokens (
  id            BIGSERIAL PRIMARY KEY,
  token         TEXT        NOT NULL UNIQUE,
  user_id       TEXT        NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_totp_setup_tokens_token ON totp_setup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_totp_setup_tokens_user  ON totp_setup_tokens(user_id);

COMMENT ON TABLE totp_setup_tokens IS
  'Link sekali pakai untuk setup Google Authenticator via email. Expire 24 jam atau setelah used_at di-set.';

COMMIT;

-- =========================================================
-- VERIFIKASI
-- =========================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'totp_setup_tokens'
--   ORDER BY ordinal_position;
