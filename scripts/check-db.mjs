import postgres from 'postgres';

async function check() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log('TABLES_FOUND:', tables.length);
    console.log(tables.map(t => t.table_name).join(', '));
    const userCount = await sql`SELECT count(*) FROM users`;
    const invCount = await sql`SELECT count(*) FROM inventory`;
    console.log(`USERS: ${userCount[0].count} rows`);
    console.log(`INVENTORY: ${invCount[0].count} rows`);
  } finally {
    await sql.end();
  }
}

check();
