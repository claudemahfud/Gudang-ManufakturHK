-- ============================================================
-- 013: Foto profil akun
-- Gambar kecil (256px, diperkecil di browser) disimpan sebagai data URL.
-- Kolom boleh kosong: akun tanpa foto memakai inisial nama.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS foto text;
