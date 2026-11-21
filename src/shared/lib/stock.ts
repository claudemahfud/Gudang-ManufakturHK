import { and, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory } from '@/shared/lib/db/schema';

// ============================================================
// STOCK HELPERS — mutasi stok atomik (server only)
// Semua perubahan stok lewat UPDATE bersyarat di dalam transaksi,
// sehingga dua request bersamaan tidak bisa membuat stok minus.
// SKU di tabel inventory selalu disimpan UPPERCASE (lihat /api/inventory POST),
// jadi input wajib dinormalisasi dengan normalizeSku() sebelum dipakai.
// ============================================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** Error bisnis yang aman ditampilkan ke pengguna (dengan HTTP status). */
export class BusinessError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'BusinessError';
  }
}

export function normalizeSku(sku: unknown): string {
  return typeof sku === 'string' ? sku.trim().toUpperCase() : '';
}

/** Bilangan bulat > 0, selain itu null. */
export function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

/** Kurangi stok bila cukup; lempar BusinessError bila SKU tidak ada / stok kurang. */
export async function decrementStock(tx: Executor, sku: string, qty: number) {
  const [row] = await tx
    .update(inventory)
    .set({ stok: sql`${inventory.stok} - ${qty}`, updatedAt: new Date() })
    .where(and(eq(inventory.sku, sku), gte(inventory.stok, qty)))
    .returning({ sku: inventory.sku, stok: inventory.stok, namaBarang: inventory.namaBarang });
  if (row) return row;

  const [inv] = await tx
    .select({ namaBarang: inventory.namaBarang, stok: inventory.stok })
    .from(inventory)
    .where(eq(inventory.sku, sku))
    .limit(1);
  if (!inv) throw new BusinessError(`Barang dengan SKU ${sku} tidak ditemukan`, 404);
  throw new BusinessError(
    `Stok "${inv.namaBarang}" tidak mencukupi (Tersedia: ${inv.stok}, Diminta: ${qty})`
  );
}

/** Tambah stok; lempar BusinessError bila SKU tidak ada. */
export async function incrementStock(tx: Executor, sku: string, qty: number) {
  const [row] = await tx
    .update(inventory)
    .set({ stok: sql`${inventory.stok} + ${qty}`, updatedAt: new Date() })
    .where(eq(inventory.sku, sku))
    .returning({ sku: inventory.sku, stok: inventory.stok });
  if (!row) throw new BusinessError(`Barang dengan SKU ${sku} tidak ditemukan`, 404);
  return row;
}

/** Ambil baris inventory dan kunci (FOR UPDATE) sampai transaksi selesai. */
export async function lockInventory(tx: Tx, sku: string) {
  const [inv] = await tx
    .select()
    .from(inventory)
    .where(eq(inventory.sku, sku))
    .for('update')
    .limit(1);
  return inv ?? null;
}

/** Ubah error menjadi respons JSON; error tak terduga tidak membocorkan detail DB. */
export function errorResponse(err: unknown, context: string) {
  if (err instanceof BusinessError) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status });
  }
  console.error(`[${context}]`, err);
  return NextResponse.json(
    { success: false, message: 'Terjadi kesalahan server. Coba lagi nanti.' },
    { status: 500 }
  );
}
