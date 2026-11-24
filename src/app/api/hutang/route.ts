import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { hutangBayar, hutangSupplier } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';

// GET /api/hutang?divisi=MANUFAKTUR|FNB&status=belum_lunas|lunas|semua
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const divisi = q.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const status = q.get('status') || 'belum_lunas';

    const syarat = [eq(hutangSupplier.divisi, divisi)];
    if (status === 'lunas') syarat.push(sql`lower(${hutangSupplier.status}) = 'lunas'`);
    else if (status !== 'semua') syarat.push(sql`lower(${hutangSupplier.status}) <> 'lunas'`);

    const rows = await db
      .select()
      .from(hutangSupplier)
      .where(and(...syarat))
      .orderBy(sql`${hutangSupplier.jatuhTempo} ASC NULLS LAST`, desc(hutangSupplier.tanggal))
      .limit(500);
    const bayar = rows.length
      ? await db.select().from(hutangBayar).where(inArray(hutangBayar.hutangId, rows.map((r) => r.id))).orderBy(desc(hutangBayar.tanggal))
      : [];

    const [r] = (await db.execute(sql`
      SELECT COALESCE(SUM(sisa_hutang), 0)::float8 AS total_sisa,
             COUNT(*)::int AS jumlah,
             COUNT(*) FILTER (WHERE jatuh_tempo < now())::int AS lewat
      FROM hutang_supplier WHERE divisi = ${divisi} AND lower(status) <> 'lunas' AND sisa_hutang > 0
    `)) as unknown as { total_sisa: number; jumlah: number; lewat: number }[];

    return NextResponse.json({
      success: true,
      data: rows.map((h) => ({
        ...h,
        status: h.status.toLowerCase(),
        totalHutang: Number(h.totalHutang),
        sisaHutang: Number(h.sisaHutang),
        pembayaran: bayar
          .filter((b) => b.hutangId === h.id)
          .map((b) => ({ id: b.id, tanggal: b.tanggal, jumlah: Number(b.jumlah), metode: b.metode, catatan: b.catatan, createdBy: b.createdBy })),
      })),
      ringkasan: { totalSisa: Number(r?.total_sisa) || 0, jumlahBelumLunas: Number(r?.jumlah) || 0, lewatTempo: Number(r?.lewat) || 0 },
    });
  } catch (err) {
    return errorResponse(err, 'HUTANG_GET');
  }
}
