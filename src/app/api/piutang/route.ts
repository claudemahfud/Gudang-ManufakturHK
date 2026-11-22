import { NextResponse } from 'next/server';
import { and, asc, desc, gt, ilike, or } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { fakturPenjualan } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { hariTerlambat } from '@/shared/lib/piutang';

// ============================================================
// API: GET /api/piutang?q=&semua=1
// Daftar faktur penjualan yang masih punya sisa piutang (semua=1: termasuk lunas),
// plus ringkasan umur piutang (aging) dari jatuh tempo.
// ============================================================

export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const semua = searchParams.get('semua') === '1';

    const filter = and(
      semua ? undefined : gt(fakturPenjualan.sisaPiutang, '0'),
      q ? or(ilike(fakturPenjualan.pelanggan, `%${q}%`), ilike(fakturPenjualan.noFaktur, `%${q}%`)) : undefined
    );
    const rows = await db
      .select()
      .from(fakturPenjualan)
      .where(filter)
      .orderBy(asc(fakturPenjualan.jatuhTempo), desc(fakturPenjualan.tanggal))
      .limit(500);

    const umur = { belumJatuhTempo: 0, terlambat1_30: 0, terlambat31_60: 0, terlambatLebih60: 0 };
    let totalPiutang = 0;
    let jatuhTempo7Hari = 0;
    let jumlahTerlambat = 0;
    let jumlahFaktur = 0;

    const data = rows.map((r) => {
      const sisa = Number(r.sisaPiutang) || 0;
      const telat = hariTerlambat(r.jatuhTempo);
      if (sisa > 0) {
        jumlahFaktur++;
        totalPiutang += sisa;
        if (telat === null || telat <= 0) {
          umur.belumJatuhTempo += sisa;
          if (telat !== null && telat >= -7) jatuhTempo7Hari += sisa;
        } else {
          jumlahTerlambat++;
          if (telat <= 30) umur.terlambat1_30 += sisa;
          else if (telat <= 60) umur.terlambat31_60 += sisa;
          else umur.terlambatLebih60 += sisa;
        }
      }
      return { ...r, hariTerlambat: telat };
    });

    return NextResponse.json({
      success: true,
      data,
      ringkasan: { totalPiutang, jatuhTempo7Hari, jumlahTerlambat, jumlahFaktur, umur },
    });
  } catch (err) {
    return errorResponse(err, 'PIUTANG_GET');
  }
}
