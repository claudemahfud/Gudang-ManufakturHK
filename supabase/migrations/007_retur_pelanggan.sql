-- ============================================================
-- 007: Barang Masuk jenis Retur Pelanggan
-- - barang_masuk.jenis membedakan pembelian dari suplier dan retur pelanggan
--   (retur tidak dihitung sebagai pembelian / hutang).
-- - retur_barang menyimpan tautan ke faktur asal, kondisi barang, nilai retur,
--   bagian yang memotong piutang dan bagian yang dikembalikan sebagai uang,
--   serta baris barang_masuk / barang_rusak yang dibuatnya (untuk pembatalan).
-- - piutang_mutasi.jenis kini juga 'retur' (potong piutang), 'refund' (uang kembali),
--   serta 'batal_retur' / 'batal_refund' saat retur dibatalkan (jumlah tetap positif).
-- Menambah kolom dengan nilai bawaan dan memperluas CHECK piutang_mutasi; data lama tidak berubah.
-- ============================================================

ALTER TABLE barang_masuk
  ADD COLUMN IF NOT EXISTS jenis varchar(30) NOT NULL DEFAULT 'PEMBELIAN';

ALTER TABLE retur_barang
  ADD COLUMN IF NOT EXISTS no_faktur varchar(100),
  ADD COLUMN IF NOT EXISTS kondisi varchar(20) NOT NULL DEFAULT 'layak',
  ADD COLUMN IF NOT EXISTS nilai decimal(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS potong_piutang decimal(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund decimal(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metode_refund varchar(20),
  ADD COLUMN IF NOT EXISTS barang_masuk_id uuid,
  ADD COLUMN IF NOT EXISTS barang_rusak_id uuid;

CREATE INDEX IF NOT EXISTS retur_barang_no_faktur_idx ON retur_barang (no_faktur);

ALTER TABLE piutang_mutasi DROP CONSTRAINT IF EXISTS piutang_mutasi_jenis_check;
ALTER TABLE piutang_mutasi DROP CONSTRAINT IF EXISTS piutang_mutasi_check;
ALTER TABLE piutang_mutasi
  ADD CONSTRAINT piutang_mutasi_jenis_check
    CHECK (jenis IN ('bayar', 'ubah_tempo', 'retur', 'refund', 'batal_retur', 'batal_refund')),
  ADD CONSTRAINT piutang_mutasi_check CHECK (
    (jenis = 'bayar' AND jumlah > 0 AND metode IS NOT NULL)
    OR (jenis = 'ubah_tempo' AND jumlah = 0 AND jatuh_tempo_baru IS NOT NULL)
    OR (jenis IN ('retur', 'batal_retur') AND jumlah > 0)
    OR (jenis IN ('refund', 'batal_refund') AND jumlah > 0 AND metode IS NOT NULL)
  );
