-- Faktur Penjualan (header). Baris barang tetap di barang_keluar (trx_id = no_faktur).
-- Idempoten: aman dijalankan ulang.
CREATE TABLE IF NOT EXISTS faktur_penjualan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_faktur varchar(100) NOT NULL UNIQUE,
  tanggal timestamp NOT NULL,
  jatuh_tempo timestamp,
  pelanggan varchar(150) NOT NULL,
  pelanggan_id uuid REFERENCES kontak(id) ON DELETE SET NULL,
  telepon varchar(30),
  alamat text,
  salesman varchar(100),
  subtotal numeric(15, 2) NOT NULL DEFAULT 0,
  diskon_faktur numeric(15, 2) NOT NULL DEFAULT 0 CHECK (diskon_faktur >= 0),
  ppn_persen numeric(5, 2) NOT NULL DEFAULT 0 CHECK (ppn_persen BETWEEN 0 AND 100),
  ppn numeric(15, 2) NOT NULL DEFAULT 0,
  ongkir numeric(15, 2) NOT NULL DEFAULT 0 CHECK (ongkir >= 0),
  grand_total numeric(15, 2) NOT NULL DEFAULT 0,
  metode_bayar varchar(20) NOT NULL DEFAULT 'tunai' CHECK (metode_bayar IN ('tunai', 'transfer', 'tempo')),
  dibayar numeric(15, 2) NOT NULL DEFAULT 0 CHECK (dibayar >= 0),
  sisa_piutang numeric(15, 2) NOT NULL DEFAULT 0 CHECK (sisa_piutang >= 0),
  status varchar(20) NOT NULL DEFAULT 'lunas' CHECK (status IN ('lunas', 'sebagian', 'belum_lunas')),
  divisi varchar(30) NOT NULL DEFAULT 'MANUFAKTUR',
  cabang varchar(50) NOT NULL DEFAULT 'Pusat',
  catatan text,
  created_by varchar(50),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faktur_penjualan_tanggal_idx ON faktur_penjualan (tanggal DESC);
CREATE INDEX IF NOT EXISTS faktur_penjualan_status_idx ON faktur_penjualan (status) WHERE status <> 'lunas';
CREATE INDEX IF NOT EXISTS barang_keluar_trx_id_idx ON barang_keluar (trx_id);

-- Tabel hanya diakses server lewat koneksi Postgres langsung; tutup akses anon/REST.
ALTER TABLE faktur_penjualan ENABLE ROW LEVEL SECURITY;
