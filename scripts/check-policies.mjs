import postgres from 'postgres';

const sql = postgres('postgresql://postgres.urqnonszxdqzhdbfxzqf:%40Namikaze04@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres', { prepare: false });

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
