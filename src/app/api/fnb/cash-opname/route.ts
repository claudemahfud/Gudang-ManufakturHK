import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { cashOpname, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_POS } from '@/shared/lib/auth/rbac';
import { desc } from 'drizzle-orm';
import { roleUtamaDi } from '@/shared/lib/auth/roles';

// ============================================================
// API: /api/fnb/cash-opname
// Rekonsiliasi Kas Laci Kasir Harian (Kas Seharusnya vs Fisik)
// Hak Akses: Multi-Role POS (Kasir, Supervisor, Admin, Manager)
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_POS);
    if (!authResult.authorized) return authResult.response;

    const { user } = authResult;
    const isExecutive = roleUtamaDi(user, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum']);

    let list = await db.select().from(cashOpname).orderBy(desc(cashOpname.tanggal)).limit(100);

    // Privasi: Kasir bawahan hanya boleh melihat riwayat cash opname miliknya sendiri
    if (!isExecutive) {
      list = list.filter(
        (i) => i.kasir === user.name || i.kasir === user.username || i.createdBy === user.username
      );
    }

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
    const authResult = await requireAuthRole(ROLES_POS);
    if (!authResult.authorized) return authResult.response;

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

    const parsedKasFisik = Number(kasFisik);
    if (isNaN(parsedKasFisik) || parsedKasFisik < 0) {
      return NextResponse.json(
        { success: false, message: 'Nominal uang fisik kasir tidak boleh kosong atau negatif' },
        { status: 400 }
      );
    }

    const kasSeharusnya = Number(kasAwal) + Number(omsetTunai) - Number(kasKeluar);
    const selisih = parsedKasFisik - kasSeharusnya;

    let status = 'pas';
    if (selisih > 0) status = 'lebih';
    if (selisih < 0) status = 'kurang';

    const user = authResult.user?.name || authResult.user?.username || 'Kasir';

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
        kasFisik: String(parsedKasFisik),
        selisih: String(selisih),
        status,
        catatan,
        createdBy: user,
      })
      .returning();

    await db.insert(logs).values({
      user,
      aksi: 'CASH_OPNAME',
      detail: `Cash Opname ${shift} oleh ${kasir || user}: Fisik Rp ${parsedKasFisik.toLocaleString('id-ID')} vs Sistem Rp ${kasSeharusnya.toLocaleString('id-ID')} (Selisih: Rp ${selisih.toLocaleString('id-ID')})`,
    });

    return NextResponse.json({ success: true, data: row });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
