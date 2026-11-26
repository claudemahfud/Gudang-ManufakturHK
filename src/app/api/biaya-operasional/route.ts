import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { ajukanBiaya, daftarBiaya, pilihanAkunBiaya } from '@/shared/lib/biaya';
import { saldoSales } from '@/shared/lib/setoran';

// ============================================================
// API: /api/biaya-operasional — SEMUA karyawan
// GET  biaya milik sendiri + pilihan jenis biaya + uang penjualan yang masih dipegang
// POST ajukan biaya (status menunggu; dibukukan setelah Finance Pusat menyetujui)
// ============================================================

export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole();
    if (!auth.authorized) return auth.response;
    const divisi = new URL(req.url).searchParams.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const username = String(auth.user?.username ?? '');
    if (!username) throw new BusinessError('Akun tidak punya username', 401);
    const [items, akun, [kas]] = await Promise.all([
      daftarBiaya(db, { divisi, username }),
      pilihanAkunBiaya(db),
      saldoSales(db, divisi, username),
    ]);
    return NextResponse.json({ success: true, data: { items, akun, uangPenjualan: kas?.tersedia ?? 0 } });
  } catch (err) {
    return errorResponse(err, 'BIAYA_GET');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthRole();
    if (!auth.authorized) return auth.response;
    const body = await req.json().catch(() => ({}));
    const username = String(auth.user?.username ?? '');
    if (!username) throw new BusinessError('Akun tidak punya username', 401);
    const nama = String(auth.user?.name || username);

    const row = await db.transaction((tx) =>
      ajukanBiaya(
        tx,
        {
          // tanggal tanpa jam = siang WIB, agar tidak bergeser hari
          tanggal: body.tanggal ? new Date(`${String(body.tanggal).slice(0, 10)}T12:00:00+07:00`) : new Date(),
          akunKode: String(body.akunKode ?? ''),
          jumlah: Number(body.jumlah),
          keterangan: String(body.keterangan ?? ''),
          sumber: String(body.sumber ?? ''),
          metode: body.metode,
          divisi: String(body.divisi ?? ''),
          cabang: String(body.cabang || 'Pusat').slice(0, 50),
          foto: body.foto,
        },
        { username, nama }
      )
    );
    return NextResponse.json({ success: true, data: { id: row.id, noBiaya: row.noBiaya } }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'BIAYA_POST');
  }
}
