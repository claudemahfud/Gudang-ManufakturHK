import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum di-set. Jalankan: node --env-file=.env.local " + process.argv[1]);
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function main() {
  const policies = await sql`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;
  console.log(`Found ${policies.length} RLS policies:`);
  for (const p of policies) {
    console.log(`[${p.tablename}] ${p.policyname} (${p.cmd}) -> roles: ${p.roles}`);
  }
  await sql.end();
}

main().catch(console.error);
