import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_FINANCE_SETORAN, ROLES_PENYETOR } from '@/shared/lib/auth/rbac';
import { cekFinancePusat } from '@/shared/lib/jurnal';
import { punyaRole } from '@/shared/lib/auth/roles';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { ajukanSetoran, daftarSetoran, omsetHariIni, saldoSales } from '@/shared/lib/setoran';

const STATUS = ['semua', 'menunggu', 'dikonfirmasi', 'ditolak', 'dibatalkan'];

// GET /api/setoran?divisi=&status=
// Penyetor: kas yang dipegang & riwayat sendiri. Finance & pimpinan melihat semua penyetor;
// hanya Finance Pusat yang boleh memproses (sebagai.proses).
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole([...ROLES_PENYETOR, ...ROLES_FINANCE_SETORAN]);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const divisi = q.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const status = STATUS.includes(q.get('status') ?? '') ? String(q.get('status')) : 'semua';
    const finance = punyaRole(auth.user, ROLES_FINANCE_SETORAN);
    const sales = punyaRole(auth.user, ROLES_PENYETOR);
    const username = String(auth.user?.username ?? '');
    const proses = await cekFinancePusat(db, username);

    // Finance melihat semua; sales murni hanya miliknya
    const saldo = await saldoSales(db, divisi, finance ? undefined : username);
    const riwayat = await daftarSetoran(db, divisi, { sales: finance ? undefined : username, status });
    const [r] = (await db.execute(sql`
      SELECT COALESCE(SUM(jumlah), 0)::float8 AS jumlah, COUNT(*)::int AS n
      FROM setoran_sales WHERE status = 'menunggu' AND divisi = ${divisi}
      ${finance ? sql`` : sql`AND sales = ${username}`}
    `)) as unknown as { jumlah: number; n: number }[];

    return NextResponse.json({
      success: true,
      data: {
        sebagai: { sales, finance, proses },
        saldo,
        riwayat,
        omset: sales ? await omsetHariIni(db, divisi, username) : null,
        ringkasan: {
          totalBelumDisetor: saldo.reduce((s, x) => s + x.saldo, 0),
          totalMenunggu: Number(r?.jumlah) || 0,
          jumlahMenunggu: Number(r?.n) || 0,
        },
      },
    });
  } catch (err) {
    return errorResponse(err, 'SETORAN_GET');
  }
}

// POST /api/setoran {divisi, jumlah, biaya[], metode, tanggal, catatan}: penyetor mengajukan setoran kas yang dipegangnya
export async function POST(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PENYETOR);
    if (!auth.authorized) return auth.response;
    const body = await req.json();
    const divisi = body.divisi === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const tanggal = body.tanggal ? new Date(`${String(body.tanggal).slice(0, 10)}T12:00:00+07:00`) : new Date();
    if (Number.isNaN(tanggal.getTime())) throw new BusinessError('Tanggal tidak valid');
    const username = String(auth.user?.username ?? '');
    const nama = String(auth.user?.name || username);

    const row = await db.transaction((tx) =>
      ajukanSetoran(tx, {
        username,
        nama,
        divisi,
        jumlah: Number(body.jumlah),
        biaya: body.biaya,
        metode: body.metode === 'transfer' ? 'transfer' : 'tunai',
        tanggal,
        catatan: body.catatan ? String(body.catatan).slice(0, 500) : null,
      })
    );
    return NextResponse.json({ success: true, data: { id: row.id, noSetoran: row.noSetoran } }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'SETORAN_POST');
  }
}
