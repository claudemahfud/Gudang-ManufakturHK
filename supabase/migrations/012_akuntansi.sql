-- ============================================================
-- 012: Akuntansi berpasangan (double-entry) dengan Bagan Akun (COA)
-- Dua entitas terpisah: MANUFAKTUR dan FNB (perusahaan berbeda, buku tidak dicampur).
-- akun        : bagan akun (templat sama untuk kedua entitas)
-- jurnal      : kepala jurnal, selalu milik satu entitas
-- jurnal_baris: baris debit/kredit; total debit = total kredit per jurnal (dijaga trigger)
-- Jurnal tidak bisa diubah/dihapus (trigger); koreksi = jurnal pembalik (pembalik_dari).
-- ============================================================

CREATE TABLE IF NOT EXISTS akun (
  kode         varchar(10)  PRIMARY KEY,
  nama         varchar(120) NOT NULL,
  tipe         varchar(12)  NOT NULL CHECK (tipe IN ('ASET','KEWAJIBAN','EKUITAS','PENDAPATAN','BEBAN')),
  saldo_normal char(1)      NOT NULL CHECK (saldo_normal IN ('D','K')),
  induk        varchar(10)  REFERENCES akun(kode),
  kelompok     varchar(40)  NOT NULL,            -- judul kelompok laporan (Aset Lancar, Beban Operasional, ...)
  arus_kas     varchar(10)  CHECK (arus_kas IN ('KAS','OPERASI','INVESTASI','PENDANAAN')),
  posting      boolean      NOT NULL DEFAULT true, -- false = akun judul (tidak boleh dijurnal)
  urutan       integer      NOT NULL DEFAULT 0,
  aktif        boolean      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS jurnal (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  no_jurnal     varchar(30)  NOT NULL UNIQUE,
  tanggal       timestamp    NOT NULL,
  entitas       varchar(20)  NOT NULL CHECK (entitas IN ('MANUFAKTUR','FNB')),
  cabang        varchar(50)  NOT NULL DEFAULT 'Pusat',
  sumber        varchar(30)  NOT NULL,           -- POS, FAKTUR, PEMBELIAN, BAYAR_PIUTANG, MANUAL, PEMBALIK, ...
  referensi     varchar(100),                    -- nomor dokumen asal
  keterangan    text         NOT NULL,
  pembalik_dari uuid         UNIQUE REFERENCES jurnal(id), -- satu jurnal hanya bisa dibalik sekali
  dibuat_oleh   varchar(100),
  created_at    timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jurnal_entitas_tanggal_idx ON jurnal (entitas, tanggal);
CREATE INDEX IF NOT EXISTS jurnal_referensi_idx ON jurnal (referensi);

CREATE TABLE IF NOT EXISTS jurnal_baris (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  jurnal_id  uuid          NOT NULL REFERENCES jurnal(id),
  akun_kode  varchar(10)   NOT NULL REFERENCES akun(kode),
  debit      numeric(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  kredit     numeric(15,2) NOT NULL DEFAULT 0 CHECK (kredit >= 0),
  keterangan text,
  CHECK (debit = 0 OR kredit = 0),
  CHECK (debit > 0 OR kredit > 0)
);
CREATE INDEX IF NOT EXISTS jurnal_baris_jurnal_idx ON jurnal_baris (jurnal_id);
CREATE INDEX IF NOT EXISTS jurnal_baris_akun_idx ON jurnal_baris (akun_kode);

-- Seimbang per jurnal, diperiksa saat COMMIT (baris boleh disisipkan satu per satu).
-- Jurnal tanpa baris juga ditolak.
CREATE OR REPLACE FUNCTION cek_jurnal_seimbang() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d numeric; k numeric; n int;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(kredit),0), COUNT(*) INTO d, k, n
  FROM jurnal_baris WHERE jurnal_id = NEW.id;
  IF n < 2 THEN
    RAISE EXCEPTION 'Jurnal % harus punya minimal 2 baris', NEW.no_jurnal;
  END IF;
  IF d <> k THEN
    RAISE EXCEPTION 'Jurnal % tidak seimbang: debit % <> kredit %', NEW.no_jurnal, d, k;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS jurnal_seimbang ON jurnal;
CREATE CONSTRAINT TRIGGER jurnal_seimbang
  AFTER INSERT ON jurnal
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION cek_jurnal_seimbang();

-- Akun judul / nonaktif tidak boleh dijurnal
CREATE OR REPLACE FUNCTION cek_akun_posting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM akun WHERE kode = NEW.akun_kode AND posting AND aktif) THEN
    RAISE EXCEPTION 'Akun % bukan akun posting aktif', NEW.akun_kode;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS jurnal_baris_akun_posting ON jurnal_baris;
CREATE TRIGGER jurnal_baris_akun_posting BEFORE INSERT ON jurnal_baris
  FOR EACH ROW EXECUTE FUNCTION cek_akun_posting();

-- Jejak audit: jurnal & barisnya tidak bisa diubah atau dihapus (TRUNCATE Reset Total tetap jalan)
CREATE OR REPLACE FUNCTION tolak_ubah_jurnal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Jurnal tidak boleh diubah atau dihapus. Gunakan jurnal pembalik.';
END $$;
DROP TRIGGER IF EXISTS jurnal_tetap ON jurnal;
CREATE TRIGGER jurnal_tetap BEFORE UPDATE OR DELETE ON jurnal
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_jurnal();
DROP TRIGGER IF EXISTS jurnal_baris_tetap ON jurnal_baris;
CREATE TRIGGER jurnal_baris_tetap BEFORE UPDATE OR DELETE ON jurnal_baris
  FOR EACH ROW EXECUTE FUNCTION tolak_ubah_jurnal();

ALTER TABLE akun ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurnal_baris ENABLE ROW LEVEL SECURITY;

-- HPP aktual per baris penjualan (harga beli rata-rata saat terjual x qty)
ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS hpp numeric(15,2) NOT NULL DEFAULT 0;

-- Akun lawan untuk kas manual & biaya operasional
ALTER TABLE keuangan ADD COLUMN IF NOT EXISTS akun_kode varchar(10) REFERENCES akun(kode);
ALTER TABLE biaya_operasional ADD COLUMN IF NOT EXISTS akun_kode varchar(10) REFERENCES akun(kode);
ALTER TABLE biaya_operasional ADD COLUMN IF NOT EXISTS metode varchar(20) NOT NULL DEFAULT 'tunai';
ALTER TABLE biaya_operasional ADD COLUMN IF NOT EXISTS keuangan_id uuid;

-- Pembayaran hutang suplier (cicilan / pelunasan)
CREATE TABLE IF NOT EXISTS hutang_bayar (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  hutang_id   uuid          NOT NULL REFERENCES hutang_supplier(id),
  tanggal     timestamp     NOT NULL,
  jumlah      numeric(15,2) NOT NULL CHECK (jumlah > 0),
  metode      varchar(20)   NOT NULL DEFAULT 'tunai',
  catatan     text,
  created_by  varchar(50),
  created_at  timestamp     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hutang_bayar_hutang_idx ON hutang_bayar (hutang_id);
ALTER TABLE hutang_bayar ENABLE ROW LEVEL SECURITY;

-- Status hutang konsisten huruf kecil (belum_lunas | lunas)
UPDATE hutang_supplier SET status = lower(status) WHERE status <> lower(status);

-- ------------------------------------------------------------
-- Bagan Akun (SAK EMKM, perusahaan dagang & produksi makanan)
-- ------------------------------------------------------------
INSERT INTO akun (kode, nama, tipe, saldo_normal, induk, kelompok, arus_kas, posting, urutan) VALUES
 ('1-0000','ASET','ASET','D',NULL,'Aset',NULL,false,100),
 ('1-1000','Kas & Setara Kas','ASET','D','1-0000','Aset Lancar','KAS',false,110),
 ('1-1100','Kas Tunai','ASET','D','1-1000','Aset Lancar','KAS',true,111),
 ('1-1200','Bank','ASET','D','1-1000','Aset Lancar','KAS',true,112),
 ('1-1300','Kas QRIS / E-Wallet','ASET','D','1-1000','Aset Lancar','KAS',true,113),
 ('1-1400','Piutang Usaha','ASET','D','1-0000','Aset Lancar','OPERASI',true,120),
 ('1-1500','Persediaan Barang','ASET','D','1-0000','Aset Lancar','OPERASI',true,130),
 ('1-1510','Persediaan Bahan Baku','ASET','D','1-0000','Aset Lancar','OPERASI',true,131),
 ('1-1600','PPN Masukan','ASET','D','1-0000','Aset Lancar','OPERASI',true,140),
 ('1-1700','Uang Muka & Biaya Dibayar Dimuka','ASET','D','1-0000','Aset Lancar','OPERASI',true,150),
 ('1-2100','Peralatan & Mesin','ASET','D','1-0000','Aset Tetap','INVESTASI',true,210),
 ('1-2200','Kendaraan','ASET','D','1-0000','Aset Tetap','INVESTASI',true,220),
 ('1-2900','Akumulasi Penyusutan','ASET','K','1-0000','Aset Tetap','INVESTASI',true,290),
 ('2-0000','KEWAJIBAN','KEWAJIBAN','K',NULL,'Kewajiban',NULL,false,300),
 ('2-1100','Hutang Usaha','KEWAJIBAN','K','2-0000','Kewajiban Lancar','OPERASI',true,310),
 ('2-1200','PPN Keluaran','KEWAJIBAN','K','2-0000','Kewajiban Lancar','OPERASI',true,320),
 ('2-1300','Hutang Refund Pelanggan','KEWAJIBAN','K','2-0000','Kewajiban Lancar','OPERASI',true,330),
 ('2-1400','Hutang Gaji & Beban','KEWAJIBAN','K','2-0000','Kewajiban Lancar','OPERASI',true,340),
 ('2-2100','Pinjaman Bank','KEWAJIBAN','K','2-0000','Kewajiban Jangka Panjang','PENDANAAN',true,410),
 ('3-0000','EKUITAS','EKUITAS','K',NULL,'Ekuitas',NULL,false,500),
 ('3-1000','Modal Pemilik','EKUITAS','K','3-0000','Ekuitas','PENDANAAN',true,510),
 ('3-2000','Prive Pemilik','EKUITAS','D','3-0000','Ekuitas','PENDANAAN',true,520),
 ('3-3000','Laba Ditahan','EKUITAS','K','3-0000','Ekuitas','PENDANAAN',true,530),
 ('4-0000','PENDAPATAN','PENDAPATAN','K',NULL,'Pendapatan',NULL,false,600),
 ('4-1100','Penjualan Kasir (POS)','PENDAPATAN','K','4-0000','Pendapatan Usaha','OPERASI',true,610),
 ('4-1200','Penjualan Faktur (Grosir)','PENDAPATAN','K','4-0000','Pendapatan Usaha','OPERASI',true,620),
 ('4-1300','Penjualan Franchise','PENDAPATAN','K','4-0000','Pendapatan Usaha','OPERASI',true,630),
 ('4-1400','Pendapatan Ongkos Kirim','PENDAPATAN','K','4-0000','Pendapatan Usaha','OPERASI',true,640),
 ('4-2100','Retur Penjualan','PENDAPATAN','D','4-0000','Pengurang Pendapatan','OPERASI',true,650),
 ('4-2200','Potongan Penjualan','PENDAPATAN','D','4-0000','Pengurang Pendapatan','OPERASI',true,660),
 ('4-9000','Pendapatan Lain-lain','PENDAPATAN','K','4-0000','Pendapatan Lain','OPERASI',true,690),
 ('5-0000','BEBAN','BEBAN','D',NULL,'Beban',NULL,false,700),
 ('5-1100','Harga Pokok Penjualan','BEBAN','D','5-0000','Harga Pokok Penjualan','OPERASI',true,710),
 ('5-1200','Selisih Persediaan','BEBAN','D','5-0000','Harga Pokok Penjualan','OPERASI',true,720),
 ('5-1300','Kerugian Barang Rusak','BEBAN','D','5-0000','Harga Pokok Penjualan','OPERASI',true,730),
 ('5-1400','Overhead Produksi Dibebankan','BEBAN','K','5-0000','Harga Pokok Penjualan','OPERASI',true,740),
 ('6-1100','Beban Gaji & Upah','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,810),
 ('6-1200','Beban Sewa','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,820),
 ('6-1300','Beban Listrik, Air & Internet','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,830),
 ('6-1400','Beban Transportasi & Pengiriman','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,840),
 ('6-1500','Beban Pemasaran','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,850),
 ('6-1600','Beban Perlengkapan & ATK','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,860),
 ('6-1700','Beban Pemeliharaan','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,870),
 ('6-1800','Beban Penyusutan','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,880),
 ('6-1900','Beban Operasional Lain','BEBAN','D','5-0000','Beban Operasional','OPERASI',true,890),
 ('6-2100','Selisih Kas','BEBAN','D','5-0000','Beban Lain','OPERASI',true,910),
 ('6-2200','Beban Administrasi Bank','BEBAN','D','5-0000','Beban Lain','OPERASI',true,920)
ON CONFLICT (kode) DO NOTHING;
