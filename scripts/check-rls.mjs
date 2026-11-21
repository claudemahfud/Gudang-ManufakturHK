import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan: node --env-file=.env.local " + process.argv[1]);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function checkRLS() {
  const tables = await sql`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  console.log('Tables RLS status:');
  for (const t of tables) {
    console.log(`- ${t.tablename.padEnd(25)}: RLS ${t.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
  }
  await sql.end();
}

checkRLS().catch(console.error);
