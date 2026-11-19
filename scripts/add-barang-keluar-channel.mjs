import postgres from 'postgres';

const sql = postgres('postgresql://postgres.urqnonszxdqzhdbfxzqf:%40Namikaze04@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres', { prepare: false });

async function run() {
  console.log('--- Adding channel column to barang_keluar ---');

  // 1. Tambah kolom channel ('GROSIR' | 'POS' | 'INTERNAL')
  await sql`ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS channel VARCHAR(30) NOT NULL DEFAULT 'GROSIR'`;
  console.log('✓ Column barang_keluar.channel created or exists');

  // 2. Backfill existing data
  await sql`UPDATE barang_keluar SET channel = 'POS' WHERE trx_id LIKE 'POS-%' OR keterangan ILIKE '%POS%'`;
  await sql`UPDATE barang_keluar SET channel = 'GROSIR' WHERE trx_id LIKE 'OUT-%' OR channel IS NULL OR channel = ''`;
  console.log('✓ Existing barang_keluar rows classified into POS and GROSIR');

  // 3. Cek hasil
  const summary = await sql`SELECT channel, count(*) as total FROM barang_keluar GROUP BY channel`;
  console.log('Summary barang_keluar by channel:');
  for (const s of summary) {
    console.log(`- ${s.channel}: ${s.total} transaksi`);
  }

  await sql.end();
}

run().catch(console.error);
