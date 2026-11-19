import postgres from 'postgres';

const sql = postgres('postgresql://postgres.urqnonszxdqzhdbfxzqf:%40Namikaze04@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres', { prepare: false });

async function runMigration() {
  console.log('Running F&B harmonization migration on Supabase...');

  // 1. Tambah kolom divisi & tipeItem di inventory
  await sql`
    ALTER TABLE inventory 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR',
    ADD COLUMN IF NOT EXISTS tipe_item VARCHAR(30) NOT NULL DEFAULT 'barang_jadi';
  `;
  console.log('✓ Kolom divisi & tipe_item ditambahkan ke inventory');

  // 2. Tambah kolom divisi di keuangan
  await sql`
    ALTER TABLE keuangan 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR';
  `;
  console.log('✓ Kolom divisi ditambahkan ke keuangan');

  // 3. Buat tabel resep_items (Bill of Materials untuk menu F&B & olahan manufaktur)
  await sql`
    CREATE TABLE IF NOT EXISTS resep_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      menu_sku VARCHAR(50) NOT NULL,
      bahan_sku VARCHAR(50) NOT NULL,
      nama_bahan VARCHAR(150) NOT NULL,
      takaran DECIMAL(10, 2) NOT NULL DEFAULT 1,
      satuan VARCHAR(20) NOT NULL DEFAULT 'gram',
      jenis VARCHAR(20) NOT NULL DEFAULT 'bahan',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  console.log('✓ Tabel resep_items dibuat');

  // 4. Buat tabel cash_opname (Rekonsiliasi laci kasir harian)
  await sql`
    CREATE TABLE IF NOT EXISTS cash_opname (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
      shift VARCHAR(50) NOT NULL DEFAULT 'Shift 1',
      kasir VARCHAR(100) NOT NULL,
      kas_awal DECIMAL(15, 2) NOT NULL DEFAULT 0,
      omset_tunai DECIMAL(15, 2) NOT NULL DEFAULT 0,
      kas_keluar DECIMAL(15, 2) NOT NULL DEFAULT 0,
      kas_seharusnya DECIMAL(15, 2) NOT NULL DEFAULT 0,
      kas_fisik DECIMAL(15, 2) NOT NULL DEFAULT 0,
      selisih DECIMAL(15, 2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'pas',
      catatan TEXT,
      created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  console.log('✓ Tabel cash_opname dibuat');

  // 5. Buat tabel hutang_supplier (Utang usaha tempo supplier)
  await sql`
    CREATE TABLE IF NOT EXISTS hutang_supplier (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier VARCHAR(150) NOT NULL,
      no_faktur VARCHAR(100),
      tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
      jatuh_tempo TIMESTAMP,
      total_hutang DECIMAL(15, 2) NOT NULL DEFAULT 0,
      sisa_hutang DECIMAL(15, 2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'belum_lunas',
      divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR',
      catatan TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
  console.log('✓ Tabel hutang_supplier dibuat');

  // 6. Aktifkan RLS di tabel-tabel baru
  await sql`ALTER TABLE resep_items ENABLE ROW LEVEL SECURITY;`;
  await sql`ALTER TABLE cash_opname ENABLE ROW LEVEL SECURITY;`;
  await sql`ALTER TABLE hutang_supplier ENABLE ROW LEVEL SECURITY;`;
  console.log('✓ RLS ENABLED pada tabel resep_items, cash_opname, dan hutang_supplier');

  // 7. Seed beberapa contoh bahan baku F&B dan Menu Olahan agar siap pakai tanpa bentrok
  await sql`
    INSERT INTO inventory (sku, nama_barang, brand, gramasi, varian, stok, harga_beli, harga_jual, setting_pcs, pakai_karton, stok_minimum, divisi, tipe_item)
    VALUES
      ('FNB-BB-KOPI', 'Biji Kopi Arabika House Blend', 'Srasa Coffee', '1000g', 'Roasted', 5000, 180, 0, 1, FALSE, 1000, 'FNB', 'bahan_baku'),
      ('FNB-BB-SUSU', 'Susu Segar Fresh Milk Full Cream', 'Diamond', '1000ml', 'Plain', 24000, 20, 0, 1, FALSE, 5000, 'FNB', 'bahan_baku'),
      ('FNB-BB-GULA', 'Sirup Gula Aren Organik Cair', 'Srasa Sweet', '1000ml', 'Aren Asli', 8000, 35, 0, 1, FALSE, 2000, 'FNB', 'bahan_baku'),
      ('FNB-KM-CUP', 'Cup Plastik Cold Drink 16oz + Lid', 'Srasa Pack', '1pcs', 'Transparan', 250, 450, 0, 1, FALSE, 50, 'FNB', 'kemasan'),
      ('FNB-MN-KOPSUS', 'Es Kopi Susu Gula Aren Spesial', 'Srasa Cafe', '16oz', 'Dingin', 100, 8500, 22000, 1, FALSE, 10, 'FNB', 'menu_olahan')
    ON CONFLICT (sku) DO NOTHING;
  `;
  console.log('✓ Seed master F&B berhasil ditambahkan');

  // 8. Seed resep untuk Es Kopi Susu
  await sql`
    INSERT INTO resep_items (menu_sku, bahan_sku, nama_bahan, takaran, satuan, jenis)
    VALUES
      ('FNB-MN-KOPSUS', 'FNB-BB-KOPI', 'Biji Kopi Arabika House Blend', 18, 'gram', 'bahan'),
      ('FNB-MN-KOPSUS', 'FNB-BB-SUSU', 'Susu Segar Fresh Milk Full Cream', 120, 'ml', 'bahan'),
      ('FNB-MN-KOPSUS', 'FNB-BB-GULA', 'Sirup Gula Aren Organik Cair', 25, 'ml', 'bahan'),
      ('FNB-MN-KOPSUS', 'FNB-KM-CUP', 'Cup Plastik Cold Drink 16oz + Lid', 1, 'pcs', 'kemasan')
    ON CONFLICT DO NOTHING;
  `;
  console.log('✓ Seed resep BOM berhasil ditambahkan');

  await sql.end();
  console.log('Semua migrasi F&B selesai sukses 100%!');
}

runMigration().catch(console.error);
