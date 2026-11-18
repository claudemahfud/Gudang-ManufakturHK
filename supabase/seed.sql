-- ============================================================
-- SEED DATA: GUDANG MANUFAKTUR
-- Password default admin: admin123
-- ============================================================

-- 1. USERS
INSERT INTO users (username, nama_lengkap, role, email, password_hash, aktif)
VALUES
  ('admin', 'Super Administrator', 'Administrator', 'admin@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE),
  ('direktur', 'Bpk. Hendra Direktur', 'Direktur Utama', 'direktur@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE),
  ('kepalagudang', 'Ahmad Gudang', 'Kepala Gudang', 'gudang@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE),
  ('sales1', 'Budi Santoso', 'Salesman', 'budi.sales@dutapangan.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 2. SAMPLE INVENTORY
INSERT INTO inventory (sku, nama_barang, brand, gramasi, varian, stok, harga_beli, harga_jual, setting_pcs, pakai_karton, stok_minimum)
VALUES
  ('DP-PANGSIT-01', 'Kulit Pangsit Goreng Renyah', 'Duta Pangan', '500g', 'Original', 450, 15000, 22000, 20, TRUE, 50),
  ('DP-PANGSIT-02', 'Kulit Pangsit Kuah Lembut', 'Duta Pangan', '500g', 'Kuah Spesial', 280, 16000, 23500, 20, TRUE, 40),
  ('DP-MIE-01', 'Mie Basah Mentah Premium', 'Duta Pangan', '1000g', 'Kuning Kenyal', 120, 18000, 26000, 10, TRUE, 30),
  ('DP-MIE-02', 'Mie Telur Pipih Cap Koki', 'Duta Pangan', '1000g', 'Lebar', 60, 19000, 27500, 10, TRUE, 30),
  ('DP-DIMSUM-01', 'Kulit Dimsum Halus Tipis', 'Duta Pangan', '250g', 'Putih Bulat', 5, 12000, 18000, 40, TRUE, 25),
  ('DP-BAKSO-01', 'Bakso Sapi Super Kenyal', 'Duta Pangan', '500g', 'Urat Halus', 0, 32000, 45000, 20, TRUE, 20)
ON CONFLICT (sku) DO NOTHING;

-- 3. SAMPLE KONTAK
INSERT INTO kontak (nama, tipe, telepon, alamat, keterangan)
VALUES
  ('Toko Sembako Berkah Jaya', 'pelanggan', '081234567890', 'Pasar Induk Blok A No. 12', 'Grosir langganan tetap'),
  ('Resto Bakmi Sedap Rasa', 'pelanggan', '081987654321', 'Jl. Sudirman No. 45', 'Kebutuhan rutin mingguan'),
  ('PT. Gandum Mas Perkasa', 'supplier', '0215556677', 'Kawasan Industri Cikarang Blok B2', 'Pabrik tepung terigu utama'),
  ('CV. Rempah Nusantara', 'supplier', '0218889900', 'Jl. Logistik Sentral No. 8', 'Pabrik bumbu & pengawet alami');

-- 4. SAMPLE ARMADA
INSERT INTO armada (nopol, jenis, kapasitas, status, keterangan)
VALUES
  ('B 9876 SAA', 'Truk Box CDD', '4 Ton / 250 Karton', 'aktif', 'Driver: Pak Joko (Rute Barat)'),
  ('B 9123 SBB', 'Grand Max Blind Van', '1 Ton / 70 Karton', 'aktif', 'Driver: Mas Dani (Rute Kota)'),
  ('B 8456 SCC', 'Pickup L300', '1.5 Ton / 100 Karton', 'servis', 'Sedang ganti oli & rem berkala')
ON CONFLICT (nopol) DO NOTHING;
