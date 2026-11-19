import postgres from 'postgres';

const sql = postgres('postgresql://postgres.urqnonszxdqzhdbfxzqf:REDACTED@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres', { prepare: false });

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
