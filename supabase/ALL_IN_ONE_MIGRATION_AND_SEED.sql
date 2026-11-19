-- ==============================================================================
-- GUDANG MANUFAKTUR HK — ALL-IN-ONE SQL (SCHEMA + SEED)
-- Dapat dijalankan langsung sekali RUN di Supabase SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL USERS
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

-- 3. TABEL INVENTORY (Master Barang)
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

-- 4. TABEL BARANG MASUK
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

-- 5. TABEL BARANG KELUAR
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

-- 6. TABEL SURAT JALAN & ITEMS
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

-- 7. TABEL PO LOADING & ITEMS
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

-- 8. TABEL RETUR BARANG
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

-- 9. TABEL BARANG RUSAK
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

-- 10. TABEL MUTASI BARANG
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

-- 11. TABEL KONTAK
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

-- 12. TABEL ARMADA
CREATE TABLE IF NOT EXISTS armada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nopol VARCHAR(20) NOT NULL UNIQUE,
  jenis VARCHAR(50),
  kapasitas VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'aktif',
  keterangan TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. TABEL KEUANGAN
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

-- 14. TABEL BIAYA OPERASIONAL
CREATE TABLE IF NOT EXISTS biaya_operasional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
  kategori VARCHAR(100) NOT NULL,
  jumlah DECIMAL(15, 2) NOT NULL,
  keterangan TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. TABEL DISKON REQUEST
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

-- 16. TABEL TARGET KOMISI
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

-- 17. TABEL LOGS (Audit Trail)
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal TIMESTAMP DEFAULT NOW(),
  "user" VARCHAR(50),
  aksi VARCHAR(100) NOT NULL,
  detail TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 18. TABEL OTP CODES
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(100) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 19. TABEL NOTIF SISTEM
CREATE TABLE IF NOT EXISTS notif_sistem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul VARCHAR(200) NOT NULL,
  pesan TEXT NOT NULL,
  tipe VARCHAR(30) NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 20. TABEL STOK FISIK SESI & OPNAME
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

-- ==============================================================================
-- DATA AWAL (SEED DATA)
-- Password default admin: admin123 (hash SHA-256)
-- ==============================================================================

-- A. USERS DEFAULT
INSERT INTO users (username, nama_lengkap, role, email, password_hash, aktif)
VALUES
  ('admin', 'Super Administrator', 'Administrator', 'admin@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE),
  ('direktur', 'Bpk. Hendra Direktur', 'Direktur Utama', 'direktur@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE),
  ('kepalagudang', 'Ahmad Gudang', 'Kepala Gudang', 'gudang@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE),
  ('sales1', 'Budi Santoso', 'Salesman', 'budi.sales@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE)
ON CONFLICT (username) DO NOTHING;

-- B. CONTOH MASTER INVENTORY
INSERT INTO inventory (sku, nama_barang, brand, gramasi, varian, stok, harga_beli, harga_jual, setting_pcs, pakai_karton, stok_minimum)
VALUES
  ('DP-PANGSIT-01', 'Kulit Pangsit Goreng Renyah', 'Duta Pangan', '500g', 'Original', 450, 15000, 22000, 20, TRUE, 50),
  ('DP-PANGSIT-02', 'Kulit Pangsit Kuah Lembut', 'Duta Pangan', '500g', 'Kuah Spesial', 280, 16000, 23500, 20, TRUE, 40),
  ('DP-MIE-01', 'Mie Basah Mentah Premium', 'Duta Pangan', '1000g', 'Kuning Kenyal', 120, 18000, 26000, 10, TRUE, 30),
  ('DP-MIE-02', 'Mie Telur Pipih Cap Koki', 'Duta Pangan', '1000g', 'Lebar', 60, 19000, 27500, 10, TRUE, 30),
  ('DP-DIMSUM-01', 'Kulit Dimsum Halus Tipis', 'Duta Pangan', '250g', 'Putih Bulat', 5, 12000, 18000, 40, TRUE, 25),
  ('DP-BAKSO-01', 'Bakso Sapi Super Kenyal', 'Duta Pangan', '500g', 'Urat Halus', 0, 32000, 45000, 20, TRUE, 20)
ON CONFLICT (sku) DO NOTHING;

-- C. CONTOH MITRA KONTAK
INSERT INTO kontak (nama, tipe, telepon, alamat, keterangan)
VALUES
  ('Toko Sembako Berkah Jaya', 'pelanggan', '081234567890', 'Pasar Induk Blok A No. 12', 'Grosir langganan tetap'),
  ('Resto Bakmi Sedap Rasa', 'pelanggan', '081987654321', 'Jl. Sudirman No. 45', 'Kebutuhan rutin mingguan'),
  ('PT. Gandum Mas Perkasa', 'supplier', '0215556677', 'Kawasan Industri Cikarang Blok B2', 'Pabrik tepung terigu utama'),
  ('CV. Rempah Nusantara', 'supplier', '0218889900', 'Jl. Logistik Sentral No. 8', 'Pabrik bumbu & pengawet alami');

-- D. CONTOH ARMADA PENGIRIMAN
INSERT INTO armada (nopol, jenis, kapasitas, status, keterangan)
VALUES
  ('B 9876 SAA', 'Truk Box CDD', '4 Ton / 250 Karton', 'aktif', 'Driver: Pak Joko (Rute Barat)'),
  ('B 9123 SBB', 'Grand Max Blind Van', '1 Ton / 70 Karton', 'aktif', 'Driver: Mas Dani (Rute Kota)'),
  ('B 8456 SCC', 'Pickup L300', '1.5 Ton / 100 Karton', 'servis', 'Sedang ganti oli & rem berkala')
ON CONFLICT (nopol) DO NOTHING;
