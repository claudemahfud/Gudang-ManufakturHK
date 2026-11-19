import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { cashOpname, barangKeluar, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { desc, sql } from 'drizzle-orm';

// ============================================================
// API: /api/fnb/cash-opname
// Rekonsiliasi Kas Laci Kasir Harian (Kas Seharusnya vs Fisik)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const list = await db.select().from(cashOpname).orderBy(desc(cashOpname.tanggal)).limit(100);

    // Hitung ringkasan hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayItems = list.filter((i) => new Date(i.tanggal) >= today);
    const totalSelisih = todayItems.reduce((acc, c) => acc + Number(c.selisih || 0), 0);

    return NextResponse.json({
      success: true,
      data: list,
      summary: {
        totalSesiHariIni: todayItems.length,
        totalSelisihHariIni: totalSelisih,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      shift = 'Shift 1',
      kasir,
      kasAwal = 0,
      omsetTunai = 0,
      kasKeluar = 0,
      kasFisik = 0,
      catatan = '',
    } = body;

    const kasSeharusnya = Number(kasAwal) + Number(omsetTunai) - Number(kasKeluar);
    const selisih = Number(kasFisik) - kasSeharusnya;

    let status = 'pas';
    if (selisih > 0) status = 'lebih';
    if (selisih < 0) status = 'kurang';

    const user = (session.user as any)?.name || (session.user as any)?.username || 'Kasir';

    const [row] = await db
      .insert(cashOpname)
      .values({
        tanggal: new Date(),
        shift,
        kasir: kasir || user,
        kasAwal: String(kasAwal),
        omsetTunai: String(omsetTunai),
        kasKeluar: String(kasKeluar),
        kasSeharusnya: String(kasSeharusnya),
        kasFisik: String(kasFisik),
        selisih: String(selisih),
        status,
        catatan,
        createdBy: user,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'CASH_OPNAME',
      detail: `Cash Opname ${shift} oleh ${kasir || user}: Fisik Rp ${Number(kasFisik).toLocaleString('id-ID')} vs Sistem Rp ${kasSeharusnya.toLocaleString('id-ID')} (Selisih: Rp ${selisih.toLocaleString('id-ID')})`,
    });

    return NextResponse.json({ success: true, data: row });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
