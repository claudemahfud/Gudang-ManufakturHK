import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { punyaRole } from '@/shared/lib/auth/roles';
import { adalahFinancePusat, cekFinancePusat } from '@/shared/lib/jurnal';
import { errorResponse } from '@/shared/lib/stock';
import { daftarBiaya } from '@/shared/lib/biaya';
import { awalHariWib, akhirHariWib, hariIniWib, tanggalQuery } from '@/shared/lib/laporan-keuangan';

// GET /api/laporan-operasional?divisi=&dari=&sampai=
// Catatan biaya seluruh karyawan. Pimpinan pembukuan melihat; Finance Pusat memproses.
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole([...ROLES_PEMBUKUAN, 'Finance & Accounting']);
    if (!auth.authorized) return auth.response;
    const username = String(auth.user?.username ?? '');
    const financePusat = await cekFinancePusat(db, username);
    if (!financePusat && !punyaRole(auth.user, ROLES_PEMBUKUAN)) {
      return NextResponse.json({ success: false, message: 'Hanya pimpinan pembukuan dan Finance Pusat' }, { status: 403 });
    }
    const q = new URL(req.url).searchParams;
    const divisi = q.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const hari = hariIniWib();
    const dari = tanggalQuery(q.get('dari'), `${hari.slice(0, 8)}01`);
    const sampai = tanggalQuery(q.get('sampai'), hari);
    const items = await daftarBiaya(db, { divisi, dari: awalHariWib(dari), sampai: akhirHariWib(sampai) });
    // sama dengan penjaga di server (biaya.ts wajibPemroses), agar tombol tidak muncul bila pasti ditolak
    const direktur = punyaRole(auth.user, ['Direktur Utama']);
    const daftar = direktur ? await db.select({ username: users.username, role: users.role, cabang: users.cabang }).from(users) : [];
    const milikFinance = new Set(daftar.filter(adalahFinancePusat).map((u) => u.username));
    const baris = items.map((i) => ({ ...i, bisaProses: i.username !== username && (financePusat || milikFinance.has(i.username ?? '')) }));
    return NextResponse.json({ success: true, data: { items: baris, financePusat, dari, sampai } });
  } catch (err) {
    return errorResponse(err, 'LAPORAN_OPERASIONAL_GET');
  }
}
