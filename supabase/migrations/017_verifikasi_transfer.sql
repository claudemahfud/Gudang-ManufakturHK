-- 017: Verifikasi Transfer. Finance mencocokkan penerimaan Bank/QRIS yang dicatat sales dengan mutasi rekening.
-- cocok = ada di mutasi; dipindahkan = tidak ditemukan, uang menjadi tanggungan sales (Kas di Tangan Sales).
CREATE TABLE IF NOT EXISTS verifikasi_transfer (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  referensi         varchar(100)  NOT NULL,
  akun_kode         varchar(10)   NOT NULL REFERENCES akun(kode),
  sales             varchar(50)   NOT NULL,
  divisi            varchar(30)   NOT NULL,
  jumlah            numeric(15,2) NOT NULL,
  status            varchar(20)   NOT NULL CHECK (status IN ('cocok','dipindahkan')),
  catatan           text,
  diverifikasi_oleh varchar(50)   NOT NULL,
  diverifikasi_at   timestamp     NOT NULL DEFAULT now(),
  jurnal_id         uuid REFERENCES jurnal(id),
  UNIQUE (referensi, akun_kode, sales, divisi)
);
ALTER TABLE verifikasi_transfer ENABLE ROW LEVEL SECURITY;
