-- Stok per cabang + perbaikan kolom cabang yang ada di schema.ts tapi belum ada di DB.
-- Aman dijalankan berulang (idempoten).

-- 1. Kolom cabang yang hilang (drift): select() Drizzle pada tabel ini gagal tanpa kolom ini
ALTER TABLE barang_rusak      ADD COLUMN IF NOT EXISTS cabang varchar(50) NOT NULL DEFAULT 'Pusat';
ALTER TABLE mutasi_barang     ADD COLUMN IF NOT EXISTS cabang varchar(50) NOT NULL DEFAULT 'Pusat';
ALTER TABLE biaya_operasional ADD COLUMN IF NOT EXISTS cabang varchar(50) NOT NULL DEFAULT 'Pusat';
ALTER TABLE retur_barang      ADD COLUMN IF NOT EXISTS cabang varchar(50) NOT NULL DEFAULT 'Pusat';
ALTER TABLE po_loading        ADD COLUMN IF NOT EXISTS cabang varchar(50) NOT NULL DEFAULT 'Pusat';

-- 2. Stok per cabang
CREATE TABLE IF NOT EXISTS stok_cabang (
  sku varchar(50) NOT NULL REFERENCES inventory(sku) ON UPDATE CASCADE ON DELETE CASCADE,
  cabang varchar(50) NOT NULL,
  stok integer NOT NULL DEFAULT 0 CHECK (stok >= 0),
  updated_at timestamp DEFAULT now(),
  PRIMARY KEY (sku, cabang)
);
ALTER TABLE stok_cabang ENABLE ROW LEVEL SECURITY;

-- 3. Saldo awal: seluruh stok inventory dianggap berada di cabang pemilik barang.
--    Hanya untuk SKU yang belum punya baris stok_cabang sama sekali, sehingga
--    menjalankan ulang tidak menimpa stok cabang yang sudah bergerak.
INSERT INTO stok_cabang (sku, cabang, stok)
SELECT i.sku, COALESCE(NULLIF(i.cabang, ''), 'Pusat'), GREATEST(i.stok, 0)
FROM inventory i
WHERE NOT EXISTS (SELECT 1 FROM stok_cabang s WHERE s.sku = i.sku);

-- 4. Selaraskan SKU yang stoknya hanya ada di satu cabang dengan total inventory.
--    Perlu bila migrasi dijalankan sebelum kode baru ter-deploy (kode lama hanya
--    mengubah inventory.stok). Jalankan ulang berkas ini sekali setelah deploy.
UPDATE stok_cabang s
SET stok = GREATEST(i.stok, 0), updated_at = now()
FROM inventory i
WHERE s.sku = i.sku
  AND s.stok <> GREATEST(i.stok, 0)
  AND (SELECT count(*) FROM stok_cabang x WHERE x.sku = s.sku) = 1;
