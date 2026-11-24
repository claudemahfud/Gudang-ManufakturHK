-- ============================================================
-- 009: Harga beli per karton di Master Barang
-- Harga karton dari suplier berbeda dengan harga per pcs, jadi disimpan terpisah.
-- inventory.harga_beli tetap harga beli / HPP per pcs.
-- Hanya menambah kolom dengan nilai bawaan 0; data lama tidak berubah.
-- ============================================================

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS harga_beli_karton numeric(15,2) NOT NULL DEFAULT 0;
