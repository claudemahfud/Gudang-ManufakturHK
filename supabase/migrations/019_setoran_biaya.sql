-- 019: biaya operasional sales memotong setoran (Omset diterima - Biaya = Setoran). HPP tidak disentuh.
ALTER TABLE setoran_sales
  ADD COLUMN IF NOT EXISTS biaya jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_biaya numeric(15,2) NOT NULL DEFAULT 0;

-- jumlah (uang diserahkan) boleh 0 bila seluruh kas habis untuk biaya
ALTER TABLE setoran_sales DROP CONSTRAINT IF EXISTS setoran_sales_jumlah_check;
ALTER TABLE setoran_sales ADD CONSTRAINT setoran_sales_jumlah_check
  CHECK (jumlah >= 0 AND total_biaya >= 0 AND jumlah + total_biaya > 0);

-- penanda baris biaya yang lahir dari setoran: tidak boleh dihapus terpisah
ALTER TABLE biaya_operasional ADD COLUMN IF NOT EXISTS setoran_id uuid REFERENCES setoran_sales(id);
