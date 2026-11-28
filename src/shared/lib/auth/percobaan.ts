import { and, count, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs } from '@/shared/lib/db/schema';

/**
 * Batas percobaan: jatah diambil SEBELUM sandi / OTP / PIN diperiksa. Hitung dan catat berjalan
 * di bawah satu kunci, sehingga permintaan serentak tidak bisa lolos bersama.
 * Percobaan dicatat sebagai gagal; bila ternyata benar, panggil kembalikanJatah.
 * Return null = terkunci.
 */
export async function ambilJatah(user: string, aksi: string, maks: number, jendelaMs: number, detail: string) {
  const siapa = user.slice(0, 50);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`coba:${aksi}:${siapa}`}))`);
    const [r] = await tx
      .select({ n: count() })
      .from(logs)
      .where(and(eq(logs.user, siapa), eq(logs.aksi, aksi), gt(logs.createdAt, new Date(Date.now() - jendelaMs))));
    const n = Number(r?.n ?? 0);
    if (n >= maks) return null;
    const [baris] = await tx.insert(logs).values({ user: siapa, aksi, detail }).returning({ id: logs.id });
    return { id: baris.id, sisa: maks - n - 1 };
  });
}

export async function kembalikanJatah(id: string) {
  await db.delete(logs).where(eq(logs.id, id));
}
