-- ============================================================
-- 016: Setoran sales ke Finance
-- - akun 1-1350 "Kas di Tangan Sales": uang tunai yang sudah diterima sales tetapi belum disetor.
-- - jurnal_baris.sales: username sales pada baris akun 1-1350 (saldo per sales = jumlah debit - kredit).
-- - setoran_sales: pengajuan setoran sales; setelah Finance konfirmasi, dijurnal Dr Kas/Bank, Cr 1-1350.
-- ============================================================

ALTER TABLE jurnal_baris ADD COLUMN IF NOT EXISTS sales varchar(50);
CREATE INDEX IF NOT EXISTS jurnal_baris_sales_idx ON jurnal_baris (sales) WHERE sales IS NOT NULL;

INSERT INTO akun (kode, nama, tipe, saldo_normal, induk, kelompok, arus_kas, posting, urutan) VALUES
 ('1-1350','Kas di Tangan Sales','ASET','D','1-0000','Aset Lancar','KAS',true,114)
ON CONFLICT (kode) DO NOTHING;

CREATE TABLE IF NOT EXISTS setoran_sales (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  no_setoran       varchar(30)   NOT NULL UNIQUE,
  tanggal          timestamp     NOT NULL,
  sales            varchar(50)   NOT NULL,            -- username
  nama_sales       varchar(100)  NOT NULL,
  divisi           varchar(30)   NOT NULL,            -- MANUFAKTUR | FNB
  jumlah           numeric(15,2) NOT NULL CHECK (jumlah > 0),
  metode           varchar(20)   NOT NULL DEFAULT 'tunai' CHECK (metode IN ('tunai','transfer')),
  catatan          text,
  status           varchar(20)   NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','dikonfirmasi','ditolak','dibatalkan')),
  jumlah_diterima  numeric(15,2),
  diproses_oleh    varchar(50),
  diproses_at      timestamp,
  alasan_tolak     text,
  jurnal_id        uuid REFERENCES jurnal(id),
  created_at       timestamp     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS setoran_sales_status_idx ON setoran_sales (divisi, status);
CREATE INDEX IF NOT EXISTS setoran_sales_sales_idx ON setoran_sales (sales);
ALTER TABLE setoran_sales ENABLE ROW LEVEL SECURITY;
