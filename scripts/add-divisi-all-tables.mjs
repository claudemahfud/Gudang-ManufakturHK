import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan: node --env-file=.env.local " + process.argv[1]);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  console.log('Migrating divisi column to all operational tables...');

  await sql`
    ALTER TABLE barang_masuk 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR';
  `;
  console.log('✓ barang_masuk.divisi ready');

  await sql`
    ALTER TABLE barang_keluar 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR';
  `;
  console.log('✓ barang_keluar.divisi ready');

  await sql`
    ALTER TABLE mutasi_barang 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR';
  `;
  console.log('✓ mutasi_barang.divisi ready');

  await sql`
    ALTER TABLE retur_barang 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR';
  `;
  console.log('✓ retur_barang.divisi ready');

  await sql`
    ALTER TABLE barang_rusak 
    ADD COLUMN IF NOT EXISTS divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR';
  `;
  console.log('✓ barang_rusak.divisi ready');

  // Pastikan ada beberapa sampel menu/produk F&B di inventory jika belum ada
  const existingFnb = await sql`SELECT count(*) FROM inventory WHERE divisi = 'FNB'`;
  console.log('Current FNB items count:', existingFnb[0].count);

  if (Number(existingFnb[0].count) < 3) {
    await sql`
      INSERT INTO inventory (sku, nama_barang, brand, gramasi, varian, stok, harga_beli, harga_jual, setting_pcs, pakai_karton, stok_minimum, keterangan, divisi, tipe_item)
      VALUES 
      ('FNB-KOP-01', 'Biji Kopi Arabika House Blend', 'SRasa Roast', '1000gr', 'Medium Roast', 25, 120000, 160000, 1, false, 5, 'Bahan Baku Kopi Cafe', 'FNB', 'bahan_mentah'),
      ('FNB-SUS-01', 'Fresh Milk Pasteurisasi', 'Diamond Milk', '1000ml', 'Plain Fresh', 60, 18000, 24000, 1, false, 12, 'Bahan Susu Barista', 'FNB', 'bahan_mentah'),
      ('FNB-GUL-01', 'Sirup Gula Aren Organik', 'SRasa Sweet', '1000ml', 'Liquid Sugar', 30, 35000, 48000, 1, false, 6, 'Bahan Pemanis Minuman', 'FNB', 'bahan_mentah'),
      ('FNB-CUP-01', 'Cup Plastik PET 16oz + Tutup Seal', 'SRasa Pack', '50pcs', 'Clear 16oz', 200, 25000, 35000, 50, false, 20, 'Kemasan Minuman Takeaway', 'FNB', 'bahan_kemasan'),
      ('FNB-MNU-01', 'Es Kopi Susu Aren Gula Aren', 'SRasa Signature', '1cup', 'Iced 16oz', 100, 6500, 22000, 1, false, 10, 'Menu Olahan Siap Jual', 'FNB', 'menu_olahan'),
      ('FNB-MNU-02', 'Matcha Latte Creamy Frappe', 'SRasa Signature', '1cup', 'Iced 16oz', 80, 8000, 26000, 1, false, 10, 'Menu Olahan Siap Jual', 'FNB', 'menu_olahan'),
      ('FNB-MNU-03', 'Croissant Butter Danish', 'SRasa Bakery', '1pcs', 'Plain Butter', 40, 9000, 24000, 1, false, 5, 'Menu Pastry Bakery', 'FNB', 'menu_olahan')
      ON CONFLICT (sku) DO NOTHING;
    `;
    console.log('✓ Seeded sample F&B items (Bahan baku & Menu olahan)');
  }

  await sql.end();
  console.log('Migration complete!');
}

run().catch(console.error);
