-- Piutang pelanggan: pembayaran (lunas penuh / cicilan) & mundur jatuh tempo,
-- plus referensi kas -> faktur agar arus kas bisa diaudit.
-- Idempoten: aman dijalankan ulang.

-- 1. Setiap kas yang berasal dari faktur menyimpan nomor fakturnya.
ALTER TABLE keuangan ADD COLUMN IF NOT EXISTS referensi varchar(100);
CREATE INDEX IF NOT EXISTS keuangan_referensi_idx ON keuangan (referensi) WHERE referensi IS NOT NULL;

-- Isi referensi kas faktur yang sudah tercatat sebelum kolom ini ada.
UPDATE keuangan
SET referensi = substring(keterangan FROM '(FJ-[A-Za-z0-9-]+)')
WHERE referensi IS NULL
  AND kategori IN ('Penjualan Grosir', 'Pembatalan Penjualan Grosir')
  AND keterangan ~ 'FJ-';

-- 2. Riwayat mutasi piutang per faktur (tidak memakai FK: riwayat tetap ada
--    walau faktur dibatalkan, untuk jejak audit).
CREATE TABLE IF NOT EXISTS piutang_mutasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_faktur varchar(100) NOT NULL,
  jenis varchar(20) NOT NULL CHECK (jenis IN ('bayar', 'ubah_tempo')),
  tanggal timestamp NOT NULL DEFAULT now(),
  jumlah numeric(15, 2) NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
  metode varchar(20) CHECK (metode IN ('tunai', 'transfer')),
  jatuh_tempo_lama timestamp,
  jatuh_tempo_baru timestamp,
  sisa_setelah numeric(15, 2) NOT NULL DEFAULT 0 CHECK (sisa_setelah >= 0),
  catatan text,
  created_by varchar(50),
  created_at timestamp DEFAULT now(),
  CHECK (
    (jenis = 'bayar' AND jumlah > 0 AND metode IS NOT NULL)
    OR (jenis = 'ubah_tempo' AND jumlah = 0 AND jatuh_tempo_baru IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS piutang_mutasi_faktur_idx ON piutang_mutasi (no_faktur, created_at);

-- Tabel hanya diakses server lewat koneksi Postgres langsung; tutup akses anon/REST.
ALTER TABLE piutang_mutasi ENABLE ROW LEVEL SECURITY;
