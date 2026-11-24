import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ============================================================
// DATABASE CLIENT — Drizzle ORM + PostgreSQL (Supabase)
// ============================================================

const connectionString = process.env.DATABASE_URL!;

// prepare: false agar aman di Supabase pooler (transaction mode).
// Serverless: tiap instance cukup sedikit koneksi dan segera dilepas saat diam, supaya
// pool Supabase (session mode: 15 klien) tidak habis ("max clients reached").
const client = postgres(connectionString, {
  prepare: false,
  max: Number(process.env.DB_POOL_MAX) || 3,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
