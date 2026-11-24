import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { entitasDari, posting, wajibAkunPosting } from '@/shared/lib/jurnal';
import { daftarJurnal, hariIniWib, tanggalQuery } from '@/shared/lib/laporan-keuangan';

// GET  /api/akuntansi/jurnal?entitas=&dari=&sampai=&cari=&sumber=  (Jurnal Umum)
// POST /api/akuntansi/jurnal  jurnal manual: modal awal, prive, pinjaman, aset tetap, penyesuaian
export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const q = new URL(req.url).searchParams;
    const hari = hariIniWib();
    const data = await daftarJurnal(
      entitasDari(q.get('entitas')),
      tanggalQuery(q.get('dari'), `${hari.slice(0, 8)}01`),
      tanggalQuery(q.get('sampai'), hari),
      { cari: q.get('cari'), sumber: q.get('sumber') || null }
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err, 'JURNAL_GET');
  }
}

type BarisMasuk = { akunKode?: unknown; debit?: unknown; kredit?: unknown; keterangan?: unknown };
const rp = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const user = auth.user?.name || auth.user?.username || 'System';

    const body = await req.json();
    if (body.entitas !== 'MANUFAKTUR' && body.entitas !== 'FNB') throw new BusinessError('Entitas wajib MANUFAKTUR atau FNB');
    const keterangan = String(body.keterangan || '').trim();
    if (!keterangan) throw new BusinessError('Keterangan jurnal wajib diisi');
    const tanggal = body.tanggal ? new Date(`${String(body.tanggal).slice(0, 10)}T12:00:00+07:00`) : new Date();
    if (Number.isNaN(tanggal.getTime())) throw new BusinessError('Tanggal tidak valid');

    const masuk: BarisMasuk[] = Array.isArray(body.baris) ? body.baris : [];
    const baris = masuk
      .map((b) => ({
        akun: String(b.akunKode || ''),
        debit: rp(Number(b.debit) || 0),
        kredit: rp(Number(b.kredit) || 0),
        keterangan: b.keterangan ? String(b.keterangan).slice(0, 500) : null,
      }))
      .filter((b) => b.akun && (b.debit > 0 || b.kredit > 0));
    if (baris.length < 2) throw new BusinessError('Jurnal minimal 2 baris dengan nominal');
    if (baris.some((b) => b.debit < 0 || b.kredit < 0 || (b.debit > 0 && b.kredit > 0))) {
      throw new BusinessError('Setiap baris hanya boleh debit ATAU kredit, tidak negatif');
    }
    const d = rp(baris.reduce((s, b) => s + b.debit, 0));
    const k = rp(baris.reduce((s, b) => s + b.kredit, 0));
    if (d !== k) throw new BusinessError(`Jurnal tidak seimbang: debit Rp ${d.toLocaleString('id-ID')} vs kredit Rp ${k.toLocaleString('id-ID')}`);

    const hasil = await db.transaction(async (tx) => {
      for (const b of baris) await wajibAkunPosting(tx, b.akun);
      const id = await posting(tx, {
        tanggal,
        divisi: body.entitas,
        cabang: 'Pusat',
        sumber: 'MANUAL',
        referensi: body.referensi ? String(body.referensi).slice(0, 100) : null,
        keterangan,
        user,
        manual: true,
        baris,
      });
      if (!id) throw new BusinessError('Jurnal tidak memiliki mutasi');
      await tx.insert(logs).values({
        user,
        aksi: 'JURNAL_MANUAL',
        detail: `Jurnal manual ${body.entitas}: ${keterangan} (Rp ${d.toLocaleString('id-ID')})`,
      });
      return id;
    });

    return NextResponse.json({ success: true, data: { id: hasil } }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'JURNAL_POST');
  }
}
