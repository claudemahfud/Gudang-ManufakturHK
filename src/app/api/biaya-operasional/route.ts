import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { biayaOperasional, keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { desc, eq } from 'drizzle-orm';
import { akunKas, posting, wajibAkunPosting } from '@/shared/lib/jurnal';
import { BusinessError, errorResponse } from '@/shared/lib/stock';

// ============================================================
// API: /api/biaya-operasional
// GET daftar biaya per divisi + POST catat biaya (kas keluar + jurnal Dr Beban / Cr Kas)
// Hak akses: pembukuan (Direktur Utama & Manager)
// ============================================================

export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!authResult.authorized) return authResult.response;

    const divisi = new URL(req.url).searchParams.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const items = await db
      .select()
      .from(biayaOperasional)
      .where(eq(biayaOperasional.divisi, divisi))
      .orderBy(desc(biayaOperasional.tanggal))
      .limit(300);

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    return errorResponse(err, 'BIAYA_GET');
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { tanggal, akunKode, keterangan } = body;
    const metode = body.metode === 'transfer' ? 'transfer' : 'tunai';
    const divisi = body.divisi === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const cabang = String(body.cabang || 'Pusat');
    const jumlah = Math.round(Number(body.jumlah) * 100) / 100;

    if (!akunKode || !Number.isFinite(jumlah) || jumlah <= 0) {
      return NextResponse.json(
        { success: false, message: 'Akun beban dan Jumlah (harus lebih dari 0) wajib diisi' },
        { status: 400 }
      );
    }
    const tgl = tanggal ? new Date(tanggal) : new Date();
    if (Number.isNaN(tgl.getTime())) throw new BusinessError('Tanggal tidak valid');

    const user = authResult.user?.name || authResult.user?.username || 'System';

    const row = await db.transaction(async (tx) => {
      const a = await wajibAkunPosting(tx, String(akunKode));
      if (a.tipe !== 'BEBAN' || !a.kode.startsWith('6-')) throw new BusinessError('Pilih akun beban operasional (6-xxxx)');

      const [kas] = await tx
        .insert(keuangan)
        .values({
          tanggal: tgl,
          jenis: 'keluar',
          kategori: a.nama,
          jumlah: String(jumlah),
          divisi,
          cabang,
          keterangan: `Biaya operasional${keterangan ? `: ${keterangan}` : ''} (${metode})`,
          createdBy: authResult.user?.username ?? user,
        })
        .returning({ id: keuangan.id });

      const [r] = await tx
        .insert(biayaOperasional)
        .values({
          tanggal: tgl,
          kategori: a.nama,
          jumlah: String(jumlah),
          divisi,
          cabang,
          keterangan: keterangan || null,
          akunKode: a.kode,
          metode,
          keuanganId: kas.id,
          createdBy: user,
        })
        .returning();

      await posting(tx, {
        tanggal: tgl,
        divisi,
        cabang,
        sumber: 'BIAYA',
        referensi: r.id,
        keterangan: `${a.nama}${keterangan ? `: ${keterangan}` : ''}`,
        user,
        baris: [
          { akun: a.kode, debit: jumlah },
          { akun: akunKas(metode), kredit: jumlah },
        ],
      });

      await tx.insert(logs).values({
        user,
        aksi: 'BIAYA_OPERASIONAL',
        detail: `Catat biaya operasional [${divisi}] ${a.kode} ${a.nama}: Rp ${jumlah.toLocaleString('id-ID')} (${metode})`,
      });
      return r;
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'BIAYA_POST');
  }
}
