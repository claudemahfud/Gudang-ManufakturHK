import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan: node --env-file=.env.local " + process.argv[1]);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function run() {
  console.log('--- Setting up master_cabang table ---');

  // 1. Create table master_cabang
  await sql`
    CREATE TABLE IF NOT EXISTS master_cabang (
      id SERIAL PRIMARY KEY,
      kode_cabang VARCHAR(20) NOT NULL UNIQUE,
      nama_cabang VARCHAR(100) NOT NULL UNIQUE,
      divisi VARCHAR(30) NOT NULL DEFAULT 'ALL',
      alamat TEXT,
      telepon VARCHAR(50),
      is_pusat BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  console.log('✓ master_cabang table created or exists');

  // 2. Enable RLS
  await sql`ALTER TABLE master_cabang ENABLE ROW LEVEL SECURITY`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'master_cabang' AND policyname = 'Allow read master_cabang'
      ) THEN
        CREATE POLICY "Allow read master_cabang" ON master_cabang FOR SELECT USING (true);
      END IF;
    END $$;
  `;
  console.log('✓ master_cabang RLS enabled');

  // 3. Ensure Default: Hanya ada 'Pusat'
  await sql`
    INSERT INTO master_cabang (kode_cabang, nama_cabang, divisi, alamat, is_pusat, status)
    VALUES ('PST', 'Pusat', 'ALL', 'Kantor & Gudang Pusat', true, 'ACTIVE')
    ON CONFLICT (nama_cabang) DO NOTHING
  `;
  console.log('✓ Default "Pusat" seeded');

  // 4. Update existing users: pastikan semua user default ke 'Pusat'
  await sql`UPDATE users SET cabang = 'Pusat' WHERE cabang IS NULL OR cabang = '' OR cabang LIKE '%Pabrik%' OR cabang LIKE '%Cikarang%' OR cabang LIKE '%Surabaya%'`;
  console.log('✓ Users synced to "Pusat"');

  // 5. Update existing inventory, barang_masuk, barang_keluar, keuangan ke 'Pusat'
  await sql`UPDATE inventory SET cabang = 'Pusat' WHERE cabang IS NULL OR cabang = ''`;
  await sql`UPDATE barang_masuk SET cabang = 'Pusat' WHERE cabang IS NULL OR cabang = ''`;
  await sql`UPDATE barang_keluar SET cabang = 'Pusat' WHERE cabang IS NULL OR cabang = ''`;
  await sql`UPDATE keuangan SET cabang = 'Pusat' WHERE cabang IS NULL OR cabang = ''`;
  console.log('✓ Operational data synced to "Pusat"');

  const branches = await sql`SELECT id, kode_cabang, nama_cabang, divisi, is_pusat, status FROM master_cabang`;
  console.log('Current branches in database:');
  for (const b of branches) {
    console.log(`- [${b.kode_cabang}] ${b.nama_cabang} (Divisi: ${b.divisi}, Pusat: ${b.is_pusat}, Status: ${b.status})`);
  }

  await sql.end();
}

run().catch(console.error);
