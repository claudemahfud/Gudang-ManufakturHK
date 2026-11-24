-- ============================================================
-- 014: PIN Reset Total milik Superuser
-- Hash scrypt (format sama dengan password); PIN asli tidak pernah disimpan.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_reset_hash text;
