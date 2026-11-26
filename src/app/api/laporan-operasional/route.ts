import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { punyaRole } from '@/shared/lib/auth/roles';
import { cekFinancePusat } from '@/shared/lib/jurnal';
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
    return NextResponse.json({ success: true, data: { items, financePusat, username, direktur: punyaRole(auth.user, ['Direktur Utama']), dari, sampai } });
  } catch (err) {
    return errorResponse(err, 'LAPORAN_OPERASIONAL_GET');
  }
}
