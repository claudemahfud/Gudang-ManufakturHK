import postgres from 'postgres';

const sql = postgres('postgresql://postgres.urqnonszxdqzhdbfxzqf:%40Namikaze04@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres', { prepare: false });

async function main() {
  const tables = ['inventory', 'barang_masuk', 'barang_keluar', 'keuangan', 'mutasi_barang', 'retur_barang'];
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${t}
    `;
    console.log(t, cols.map(c => c.column_name));
  }
  await sql.end();
}

main().catch(console.error);
