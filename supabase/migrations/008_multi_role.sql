-- ============================================================
-- 008: Multi-role per akun
-- users.role tetap role utama. users.roles_tambahan berisi role lain
-- yang ditetapkan Direktur Utama; hak akses = gabungan semua role.
-- Hanya menambah kolom dengan nilai bawaan kosong; data lama tidak berubah.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS roles_tambahan text[] NOT NULL DEFAULT '{}';
