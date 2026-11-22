import { and, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/shared/lib/db';
import { inventory, stokCabang } from '@/shared/lib/db/schema';

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

// Stok disimpan per cabang di tabel stok_cabang; inventory.stok = total semua
// cabang dan selalu diperbarui di transaksi yang sama (dipakai dashboard/laporan).

/** Kurangi stok cabang bila cukup; lempar BusinessError bila SKU tidak ada / stok kurang. */
export async function decrementStock(tx: Executor, sku: string, qty: number, cabang: string) {
  const [row] = await tx
    .update(stokCabang)
    .set({ stok: sql`${stokCabang.stok} - ${qty}`, updatedAt: new Date() })
    .where(and(eq(stokCabang.sku, sku), eq(stokCabang.cabang, cabang), gte(stokCabang.stok, qty)))
    .returning({ stok: stokCabang.stok });

  if (!row) {
    const [inv] = await tx
      .select({ namaBarang: inventory.namaBarang })
      .from(inventory)
      .where(eq(inventory.sku, sku))
      .limit(1);
    if (!inv) throw new BusinessError(`Barang dengan SKU ${sku} tidak ditemukan`, 404);
    const [sc] = await tx
      .select({ stok: stokCabang.stok })
      .from(stokCabang)
      .where(and(eq(stokCabang.sku, sku), eq(stokCabang.cabang, cabang)))
      .limit(1);
    throw new BusinessError(
      `Stok "${inv.namaBarang}" di cabang ${cabang} tidak mencukupi (Tersedia: ${sc?.stok ?? 0}, Diminta: ${qty})`
    );
  }

  const [inv] = await tx
    .update(inventory)
    .set({ stok: sql`${inventory.stok} - ${qty}`, updatedAt: new Date() })
    .where(eq(inventory.sku, sku))
    .returning({ sku: inventory.sku, namaBarang: inventory.namaBarang });
  return { ...inv, stok: row.stok };
}

/** Tambah stok cabang; lempar BusinessError bila SKU tidak ada di master inventory. */
export async function incrementStock(tx: Executor, sku: string, qty: number, cabang: string) {
  const [inv] = await tx
    .update(inventory)
    .set({ stok: sql`${inventory.stok} + ${qty}`, updatedAt: new Date() })
    .where(eq(inventory.sku, sku))
    .returning({ sku: inventory.sku, namaBarang: inventory.namaBarang });
  if (!inv) throw new BusinessError(`Barang dengan SKU ${sku} tidak ditemukan`, 404);

  const [row] = await tx
    .insert(stokCabang)
    .values({ sku, cabang, stok: qty })
    .onConflictDoUpdate({
      target: [stokCabang.sku, stokCabang.cabang],
      set: { stok: sql`${stokCabang.stok} + ${qty}`, updatedAt: new Date() },
    })
    .returning({ stok: stokCabang.stok });
  return { ...inv, stok: row.stok };
}

/**
 * Cabang tempat transaksi stok terjadi. Karyawan cabang dikunci ke cabangnya;
 * pimpinan / pengguna Pusat boleh memilih cabang (aturan yang sama dengan
 * isolasi cabang di route lain).
 */
export function resolveCabang(user: { role?: string; cabang?: string } | null | undefined, requested?: unknown) {
  const isExecutive = ['Administrator', 'Direktur Utama', 'Manager'].includes(user?.role ?? '');
  const userCabang = user?.cabang || 'Pusat';
  if (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat') return userCabang;
  return typeof requested === 'string' && requested.trim() && requested !== 'SEMUA' ? requested.trim() : 'Pusat';
}

/** resolveCabang dengan fallback ke cabang aktif di header aplikasi (cookie app_active_cabang). */
export async function resolveRequestCabang(user: Parameters<typeof resolveCabang>[0], requested?: unknown) {
  const active = (await cookies()).get('app_active_cabang')?.value;
  return resolveCabang(user, requested ?? (active ? decodeURIComponent(active) : undefined));
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
