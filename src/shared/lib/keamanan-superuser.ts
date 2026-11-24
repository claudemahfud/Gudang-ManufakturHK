import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, users } from '@/shared/lib/db/schema';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { roleUtamaDi } from '@/shared/lib/auth/roles';
import { NextResponse } from 'next/server';

// ============================================================
// Keamanan aksi Superuser (Administrator sebagai role utama).
// Percobaan gagal dicatat di logs; setelah BATAS_GAGAL kali dalam JENDELA_MS
// aksi dikunci sementara. Pesan galat tidak membedakan PIN salah / belum diatur
// lebih dari yang perlu.
// ============================================================

export const BATAS_GAGAL = 5;
export const JENDELA_MS = 15 * 60 * 1000;
export const POLA_PIN = /^\d{6}$/;

/** Hanya Administrator sebagai role UTAMA (role tambahan tidak cukup). */
export async function superuserSaja() {
  const r = await requireAuthRole(['Administrator']);
  if (!r.authorized) return { galat: r.response, user: null as null };
  if (!roleUtamaDi(r.user, ['Administrator'])) {
    return {
      galat: NextResponse.json({ success: false, message: 'Khusus akun Superuser (Administrator utama)' }, { status: 403 }),
      user: null as null,
    };
  }
  const username = (r.user as { username?: string })?.username;
  const [u] = username
    ? await db
        .select({ id: users.id, username: users.username, namaLengkap: users.namaLengkap, passwordHash: users.passwordHash, pinResetHash: users.pinResetHash })
        .from(users)
        .where(eq(users.username, username))
        .limit(1)
    : [];
  if (!u) {
    return { galat: NextResponse.json({ success: false, message: 'Akun tidak ditemukan' }, { status: 401 }), user: null as null };
  }
  return { galat: null, user: u };
}

/** Jumlah kegagalan terbaru untuk aksi tertentu oleh akun ini. */
export async function jumlahGagal(username: string, aksiGagal: string) {
  const [row] = await db
    .select({ n: count() })
    .from(logs)
    .where(and(eq(logs.user, username), eq(logs.aksi, aksiGagal), gt(logs.createdAt, new Date(Date.now() - JENDELA_MS))));
  return Number(row?.n ?? 0);
}

export async function catatGagal(username: string, aksiGagal: string, detail: string) {
  await db.insert(logs).values({ user: username, aksi: aksiGagal, detail });
}

export function terkunci() {
  return NextResponse.json(
    { success: false, message: `Terlalu banyak percobaan gagal. Coba lagi setelah ${JENDELA_MS / 60000} menit.` },
    { status: 429 }
  );
}
