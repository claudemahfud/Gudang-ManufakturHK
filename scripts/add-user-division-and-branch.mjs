import postgres from 'postgres';

const sql = postgres('postgresql://postgres.urqnonszxdqzhdbfxzqf:REDACTED@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres', { prepare: false });

async function run() {
  console.log('Adding divisi_assigned and cabang columns to users and operational tables...');

  // 1. Kolom divisi_assigned di users ('ALL' | 'MANUFAKTUR' | 'FNB')
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS divisi_assigned VARCHAR(30) NOT NULL DEFAULT 'ALL'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cabang VARCHAR(50) NOT NULL DEFAULT 'Pusat'`;
  console.log('✓ users.divisi_assigned & users.cabang ready');

  // 2. Tambah kolom cabang di operational tables
  await sql`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cabang VARCHAR(50) NOT NULL DEFAULT 'Pusat'`;
  await sql`ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS cabang VARCHAR(50) NOT NULL DEFAULT 'Pusat'`;
  await sql`ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS cabang VARCHAR(50) NOT NULL DEFAULT 'Pusat'`;
  await sql`ALTER TABLE keuangan ADD COLUMN IF NOT EXISTS cabang VARCHAR(50) NOT NULL DEFAULT 'Pusat'`;
  console.log('✓ cabang column added to operational tables');

  // 3. Tampilkan list users
  const userList = await sql`SELECT username, role, divisi_assigned, cabang FROM users`;
  console.log('Current users list:');
  for (const u of userList) {
    console.log(`- ${u.username} (${u.role}) -> Divisi: ${u.divisi_assigned}, Cabang: ${u.cabang}`);
  }

  await sql.end();
}

run().catch(console.error);
