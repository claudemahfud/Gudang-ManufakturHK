import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment!');
    process.exit(1);
  }

  console.log('Connecting to Supabase PostgreSQL...');
  const sql = postgres(connectionString, { prepare: false });

  try {
    const schemaFile = path.join(process.cwd(), 'supabase', 'migrations', '001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaFile, 'utf8');

    console.log('Executing schema migration...');
    await sql.unsafe(schemaSql);
    console.log('✓ Schema migration successful!');

    const seedFile = path.join(process.cwd(), 'supabase', 'seed.sql');
    if (fs.existsSync(seedFile)) {
      console.log('Executing seed data...');
      const seedSql = fs.readFileSync(seedFile, 'utf8');
      await sql.unsafe(seedSql);
      console.log('✓ Seed data inserted successfully!');
    }

    console.log('Database initialization completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await sql.end();
  }
}

main();
