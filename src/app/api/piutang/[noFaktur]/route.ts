import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { fakturPenjualan, piutangMutasi } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { bayarPiutang, mundurkanJatuhTempo } from '@/shared/lib/piutang';

// ============================================================
// API: /api/piutang/[noFaktur]
// GET  = header faktur + riwayat mutasi piutang
// POST = { aksi: 'bayar', jumlah, metode, tanggal?, jatuhTempoBaru?, catatan? }
//      | { aksi: 'tempo', jatuhTempoBaru, alasan }
// ============================================================

const tanggalOpsional = (v: unknown, label: string) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new BusinessError(`${label} tidak valid`);
  return d;
};

export async function GET(_req: Request, { params }: { params: Promise<{ noFaktur: string }> }) {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;
    const { noFaktur } = await params;

    const [faktur] = await db.select().from(fakturPenjualan).where(eq(fakturPenjualan.noFaktur, noFaktur)).limit(1);
    if (!faktur) throw new BusinessError('Faktur tidak ditemukan', 404);
    const mutasi = await db
      .select()
      .from(piutangMutasi)
      .where(eq(piutangMutasi.noFaktur, noFaktur))
      .orderBy(asc(piutangMutasi.createdAt));
    return NextResponse.json({ success: true, data: { faktur, mutasi } });
  } catch (err) {
    return errorResponse(err, 'PIUTANG_DETAIL');
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ noFaktur: string }> }) {
  try {
    const authResult = await requireAuthRole(ROLES_FINANCE);
    if (!authResult.authorized) return authResult.response;
    const { noFaktur } = await params;
    const body = await req.json();
    const user = authResult.user?.name || authResult.user?.username || 'System';

    if (body?.aksi === 'bayar') {
      const jumlah = Number(body.jumlah);
      if (!Number.isFinite(jumlah) || jumlah <= 0) throw new BusinessError('Jumlah pembayaran tidak valid');
      const metode = body.metode === 'transfer' ? 'transfer' : body.metode === 'tunai' ? 'tunai' : null;
      if (!metode) throw new BusinessError('Metode pembayaran wajib Tunai atau Transfer');
      const hasil = await db.transaction((tx) =>
        bayarPiutang(
          tx,
          noFaktur,
          {
            jumlah,
            metode,
            tanggal: tanggalOpsional(body.tanggal, 'Tanggal bayar') ?? new Date(),
            jatuhTempoBaru: tanggalOpsional(body.jatuhTempoBaru, 'Jatuh tempo baru'),
            catatan: typeof body.catatan === 'string' && body.catatan.trim() ? body.catatan.trim() : null,
          },
          user
        )
      );
      return NextResponse.json({ success: true, data: hasil });
    }

    if (body?.aksi === 'tempo') {
      const baru = tanggalOpsional(body.jatuhTempoBaru, 'Jatuh tempo baru');
      if (!baru) throw new BusinessError('Jatuh tempo baru wajib diisi');
      const hasil = await db.transaction((tx) =>
        mundurkanJatuhTempo(tx, noFaktur, baru, typeof body.alasan === 'string' ? body.alasan : '', user)
      );
      return NextResponse.json({ success: true, data: hasil });
    }

    throw new BusinessError('Aksi tidak dikenal');
  } catch (err) {
    return errorResponse(err, 'PIUTANG_POST');
  }
}
