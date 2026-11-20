import { db } from '../src/shared/lib/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('--- RUNNING SUPPLIER & FINANCIAL MIGRATION ---');

  // 1. Alter inventory table: add supplier column
  await db.execute(sql`
    ALTER TABLE inventory 
    ADD COLUMN IF NOT EXISTS supplier VARCHAR(150);
  `);
  console.log('✓ Added supplier column to inventory');

  // 2. Alter barang_masuk table: add skema_bayar, jatuh_tempo, total_beli
  await db.execute(sql`
    ALTER TABLE barang_masuk 
    ADD COLUMN IF NOT EXISTS skema_bayar VARCHAR(30) DEFAULT 'lunas';
  `);
  await db.execute(sql`
    ALTER TABLE barang_masuk 
    ADD COLUMN IF NOT EXISTS jatuh_tempo TIMESTAMP;
  `);
  await db.execute(sql`
    ALTER TABLE barang_masuk 
    ADD COLUMN IF NOT EXISTS total_beli NUMERIC(15, 2) DEFAULT 0;
  `);
  console.log('✓ Added skema_bayar, jatuh_tempo, total_beli to barang_masuk');

  // 3. Ensure hutang_supplier table exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hutang_supplier (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier VARCHAR(150) NOT NULL,
      no_faktur VARCHAR(100),
      tanggal TIMESTAMP NOT NULL DEFAULT NOW(),
      jatuh_tempo TIMESTAMP,
      total_hutang NUMERIC(15, 2) NOT NULL DEFAULT 0,
      sisa_hutang NUMERIC(15, 2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'belum_lunas',
      divisi VARCHAR(30) NOT NULL DEFAULT 'MANUFAKTUR',
      catatan TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✓ Verified hutang_supplier table');

  // 4. Check existing suppliers in kontak
  const suppliers: any[] = await db.execute(sql`
    SELECT id, nama, tipe, telepon, email, alamat, keterangan 
    FROM kontak 
    WHERE tipe IN ('supplier', 'keduanya')
  `);

  console.log(`✓ Existing suppliers in kontak: ${suppliers.length}`);
  if (suppliers.length === 0) {
    console.log('Inserting initial default suppliers...');
    await db.execute(sql`
      INSERT INTO kontak (nama, tipe, telepon, email, alamat, keterangan)
      VALUES 
        ('PT. Pangan Inti Sejahtera', 'supplier', '021-5551234', 'order@panganinti.co.id', 'Kawasan Industri Cikarang Blok A-12', 'Pemasok utama bahan baku tepung & bumbu'),
        ('CV. Mitra Kemasan Nusantara', 'supplier', '081298765432', 'sales@mitrakemasan.com', 'Jl. Pergudangan Dadap No. 88, Tangerang', 'Pemasok kardus, cup, dan plastik kemasan'),
        ('PT. Duta Niaga Distribusi', 'supplier', '022-7788990', 'cs@dutaniaga.com', 'Jl. Soekarno Hatta No. 450, Bandung', 'Pemasok minyak, bumbu saus, dan packaging');
    `);
    console.log('✓ Inserted 3 starter suppliers');
  } else {
    for (const s of suppliers) {
      console.log(` - ${s.nama} (${s.tipe})`);
    }
  }

  console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
