import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { biayaLampiran, biayaOperasional } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { punyaRole } from '@/shared/lib/auth/roles';
import { cekFinancePusat } from '@/shared/lib/jurnal';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { tambahNota } from '@/shared/lib/biaya';

const UUID = /^[0-9a-f-]{36}$/i;

// GET foto nota & bukti bayar: pengaju, pimpinan pembukuan, atau Finance Pusat
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole();
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    if (!UUID.test(id)) throw new BusinessError('Biaya tidak ditemukan', 404);
    const [b] = await db.select({ username: biayaOperasional.username }).from(biayaOperasional).where(eq(biayaOperasional.id, id)).limit(1);
    if (!b) throw new BusinessError('Biaya tidak ditemukan', 404);
    const username = String(auth.user?.username ?? '');
    if (b.username !== username && !punyaRole(auth.user, ROLES_PEMBUKUAN) && !(await cekFinancePusat(db, username))) {
      throw new BusinessError('Anda tidak berhak melihat nota ini', 403);
    }
    const foto = await db.select({ id: biayaLampiran.id, jenis: biayaLampiran.jenis, data: biayaLampiran.data, oleh: biayaLampiran.oleh })
      .from(biayaLampiran).where(eq(biayaLampiran.biayaId, id)).orderBy(asc(biayaLampiran.createdAt));
    return NextResponse.json({ success: true, data: foto });
  } catch (err) {
    return errorResponse(err, 'BIAYA_LAMPIRAN_GET');
  }
}

// POST {foto: [dataUrl]}: pengaju menambah foto nota selama menunggu
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole();
    if (!auth.authorized) return auth.response;
    const { id } = await params;
    if (!UUID.test(id)) throw new BusinessError('Biaya tidak ditemukan', 404);
    const body = await req.json().catch(() => ({}));
    const user = { username: String(auth.user?.username ?? ''), nama: String(auth.user?.name || auth.user?.username) };
    await db.transaction((tx) => tambahNota(tx, id, body.foto, user));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'BIAYA_LAMPIRAN_POST');
  }
}
