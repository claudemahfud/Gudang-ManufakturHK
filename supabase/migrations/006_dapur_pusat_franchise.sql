-- Dapur Pusat & Franchise (lihat docs/PRD-dapur-pusat-franchise.md):
-- tipe cabang, harga franchise, resep per batch + biaya lain, produksi dapur,
-- order franchise. Idempoten: aman dijalankan ulang.

-- 1. Tipe cabang: PUSAT (Dapur Pusat) | CABANG (milik sendiri) | FRANCHISE
ALTER TABLE master_cabang ADD COLUMN IF NOT EXISTS tipe varchar(20) NOT NULL DEFAULT 'CABANG';
UPDATE master_cabang SET tipe = 'PUSAT' WHERE is_pusat AND tipe <> 'PUSAT';
DO $$ BEGIN
  ALTER TABLE master_cabang ADD CONSTRAINT master_cabang_tipe_chk CHECK (tipe IN ('PUSAT', 'CABANG', 'FRANCHISE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Harga jual Dapur Pusat ke franchise (per unit stok)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS harga_franchise numeric(15, 2) NOT NULL DEFAULT 0;

-- 3. Resep per batch: jumlah hasil + biaya lain-lain (bahan tetap di resep_items)
CREATE TABLE IF NOT EXISTS resep_header (
  menu_sku varchar(50) PRIMARY KEY,
  hasil_qty integer NOT NULL DEFAULT 1 CHECK (hasil_qty > 0),
  catatan text,
  updated_by varchar(50),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resep_biaya (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_sku varchar(50) NOT NULL,
  nama varchar(100) NOT NULL,
  jumlah numeric(15, 2) NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resep_biaya_menu_idx ON resep_biaya (menu_sku);
CREATE INDEX IF NOT EXISTS resep_items_menu_idx ON resep_items (menu_sku);

-- 4. Produksi Dapur Pusat (jejak HPP; tidak dihapus)
CREATE TABLE IF NOT EXISTS produksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_produksi varchar(100) NOT NULL UNIQUE,
  tanggal timestamp NOT NULL DEFAULT now(),
  menu_sku varchar(50) NOT NULL,
  nama_barang varchar(150) NOT NULL,
  jumlah_batch integer NOT NULL CHECK (jumlah_batch > 0),
  hasil_qty integer NOT NULL CHECK (hasil_qty > 0),
  biaya_bahan numeric(15, 2) NOT NULL DEFAULT 0,
  biaya_lain numeric(15, 2) NOT NULL DEFAULT 0,
  hpp_total numeric(15, 2) NOT NULL DEFAULT 0,
  hpp_per_unit numeric(15, 2) NOT NULL DEFAULT 0,
  cabang varchar(50) NOT NULL DEFAULT 'Pusat',
  catatan text,
  created_by varchar(50),
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS produksi_tanggal_idx ON produksi (tanggal DESC);

CREATE TABLE IF NOT EXISTS produksi_bahan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produksi_id uuid NOT NULL REFERENCES produksi(id) ON DELETE CASCADE,
  bahan_sku varchar(50) NOT NULL,
  nama_bahan varchar(150) NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  harga numeric(15, 2) NOT NULL DEFAULT 0,
  subtotal numeric(15, 2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS produksi_bahan_produksi_idx ON produksi_bahan (produksi_id);

-- 5. Order franchise ke Dapur Pusat
CREATE TABLE IF NOT EXISTS order_franchise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  no_order varchar(100) NOT NULL UNIQUE,
  tanggal timestamp NOT NULL DEFAULT now(),
  franchise varchar(50) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'diajukan'
    CHECK (status IN ('diajukan', 'dikirim', 'diterima', 'ditolak', 'dibatalkan')),
  total numeric(15, 2) NOT NULL DEFAULT 0,
  no_faktur varchar(100),
  catatan text,
  alasan text,
  created_by varchar(50),
  dikirim_by varchar(50),
  dikirim_at timestamp,
  diterima_by varchar(50),
  diterima_at timestamp,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_franchise_franchise_idx ON order_franchise (franchise, tanggal DESC);
CREATE INDEX IF NOT EXISTS order_franchise_status_idx ON order_franchise (status);

CREATE TABLE IF NOT EXISTS order_franchise_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES order_franchise(id) ON DELETE CASCADE,
  sku varchar(50) NOT NULL,
  nama_barang varchar(150) NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  harga numeric(15, 2) NOT NULL DEFAULT 0,
  subtotal numeric(15, 2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_franchise_items_order_idx ON order_franchise_items (order_id);

-- Tabel hanya diakses server lewat koneksi Postgres langsung; tutup akses anon/REST.
ALTER TABLE resep_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE resep_biaya ENABLE ROW LEVEL SECURITY;
ALTER TABLE produksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE produksi_bahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_franchise_items ENABLE ROW LEVEL SECURITY;
