import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ============================================================
// DATABASE CLIENT — Drizzle ORM + PostgreSQL (Supabase)
// ============================================================

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch karena pakai Supabase transaction pooler
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type Database = typeof db;
