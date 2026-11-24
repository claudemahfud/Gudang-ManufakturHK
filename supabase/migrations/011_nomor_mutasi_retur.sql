-- ============================================================
-- 011: Nomor dokumen untuk mutasi barang & retur
-- MTSBBTTNNN dan RTRNBBTTNNN (seri harian dari tabel nomor_urut, migrasi 010).
-- Kolom boleh kosong: catatan lama tidak punya nomor.
-- ============================================================

ALTER TABLE mutasi_barang ADD COLUMN IF NOT EXISTS no_mutasi varchar(30);
ALTER TABLE retur_barang  ADD COLUMN IF NOT EXISTS no_retur  varchar(30);
