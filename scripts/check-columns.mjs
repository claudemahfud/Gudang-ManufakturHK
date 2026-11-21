import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan: node --env-file=.env.local " + process.argv[1]);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

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
