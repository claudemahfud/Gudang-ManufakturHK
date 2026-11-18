-- ============================================================
-- GUDANG MANUFAKTUR HK — INITIAL POSTGRESQL SCHEMA (SUPABASE)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  nama_lengkap VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  password_hash TEXT NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. INVENTORY (Master Barang)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) NOT NULL UNIQUE,
  nama_barang VARCHAR(150) NOT NULL,
  brand VARCHAR(100),
  gramasi VARCHAR(50),
  varian VARCHAR(100),
  stok INTEGER NOT NULL DEFAULT 0,
  harga_beli DECIMAL(15, 2) DEFAULT 0,
  harga_jual DECIMAL(15, 2) DEFAULT 0,
  setting_pcs INTEGER NOT NULL DEFAULT 1,
  pakai_karton BOOLEAN NOT NULL DEFAULT TRUE,
  stok_minimum INTEGER DEFAULT 10,
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. BARANG MASUK
CREATE TABLE IF NOT EXISTS barang_masuk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL,
  satuan VARCHAR(20) NOT NULL DEFAULT 'pcs',
  harga_beli DECIMAL(15, 2) DEFAULT 0,
  supplier VARCHAR(150),
  no_faktur VARCHAR(100),
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. BARANG KELUAR
CREATE TABLE IF NOT EXISTS barang_keluar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_id VARCHAR(100) NOT NULL,
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL,
  satuan VARCHAR(20) NOT NULL DEFAULT 'pcs',
  harga_jual DECIMAL(15, 2) DEFAULT 0,
  total DECIMAL(15, 2) DEFAULT 0,
  pelanggan VARCHAR(150),
  salesman VARCHAR(100),
  diskon DECIMAL(5, 2) DEFAULT 0,
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. SURAT JALAN
CREATE TABLE IF NOT EXISTS surat_jalan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_sj VARCHAR(100) NOT NULL UNIQUE,
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  pelanggan VARCHAR(150) NOT NULL,
  alamat TEXT,
  ekspedisi VARCHAR(100),
  armada VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  catatan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surat_jalan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_jalan_id UUID NOT NULL REFERENCES surat_jalan(id) ON DELETE CASCADE,
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL,
  satuan VARCHAR(20) NOT NULL DEFAULT 'pcs',
  keterangan TEXT
);

-- 6. PO LOADING
CREATE TABLE IF NOT EXISTS po_loading (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_po VARCHAR(100) NOT NULL UNIQUE,
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  supplier VARCHAR(150),
  armada VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  catatan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_loading_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_loading_id UUID NOT NULL REFERENCES po_loading(id) ON DELETE CASCADE,
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty_order INTEGER NOT NULL DEFAULT 0,
  qty_terima INTEGER NOT NULL DEFAULT 0,
  satuan VARCHAR(20) NOT NULL DEFAULT 'pcs'
);

-- 7. RETUR BARANG
CREATE TABLE IF NOT EXISTS retur_barang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL,
  alasan TEXT,
  pelanggan VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. BARANG RUSAK
CREATE TABLE IF NOT EXISTS barang_rusak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL,
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. MUTASI BARANG
CREATE TABLE IF NOT EXISTS mutasi_barang (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL,
  dari VARCHAR(100) NOT NULL,
  ke VARCHAR(100) NOT NULL,
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. KONTAK
CREATE TABLE IF NOT EXISTS kontak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(150) NOT NULL,
  tipe VARCHAR(20) NOT NULL DEFAULT 'pelanggan',
  telepon VARCHAR(30),
  alamat TEXT,
  email VARCHAR(100),
  keterangan TEXT,
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. ARMADA
CREATE TABLE IF NOT EXISTS armada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nopol VARCHAR(20) NOT NULL UNIQUE,
  jenis VARCHAR(50),
  kapasitas VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'aktif',
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 12. KEUANGAN
CREATE TABLE IF NOT EXISTS keuangan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  jenis VARCHAR(20) NOT NULL,
  kategori VARCHAR(100) NOT NULL,
  jumlah DECIMAL(15, 2) NOT NULL,
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. BIAYA OPERASIONAL
CREATE TABLE IF NOT EXISTS biaya_operasional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  kategori VARCHAR(100) NOT NULL,
  jumlah DECIMAL(15, 2) NOT NULL,
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. DISKON REQUEST
CREATE TABLE IF NOT EXISTS diskon_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  salesman VARCHAR(100) NOT NULL,
  pelanggan VARCHAR(150) NOT NULL,
  sku VARCHAR(50),
  nama_barang VARCHAR(150),
  qty INTEGER,
  diskon_pct DECIMAL(5, 2),
  alasan TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 15. TARGET KOMISI
CREATE TABLE IF NOT EXISTS target_komisi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman VARCHAR(100) NOT NULL,
  periode VARCHAR(10) NOT NULL,
  target DECIMAL(15, 2) NOT NULL DEFAULT 0,
  realisasi DECIMAL(15, 2) NOT NULL DEFAULT 0,
  pct_komisi DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 16. LOGS (Audit Trail)
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP DEFAULT NOW(),
  "user" VARCHAR(50),
  aksi VARCHAR(100) NOT NULL,
  detail TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. OTP CODES
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(100) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 18. NOTIF SISTEM
CREATE TABLE IF NOT EXISTS notif_sistem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul VARCHAR(200) NOT NULL,
  pesan TEXT NOT NULL,
  tipe VARCHAR(30) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 19. STOK FISIK SESI & OPNAME
CREATE TABLE IF NOT EXISTS stok_fisik_sesi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by VARCHAR(50),
  closed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stok_fisik (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_id UUID NOT NULL REFERENCES stok_fisik_sesi(id) ON DELETE CASCADE,
  sku VARCHAR(50) NOT NULL,
  nama_barang VARCHAR(150) NOT NULL,
  stok_sistem INTEGER NOT NULL DEFAULT 0,
  stok_fisik_aktual INTEGER NOT NULL DEFAULT 0,
  selisih INTEGER NOT NULL DEFAULT 0,
  keterangan TEXT
);
