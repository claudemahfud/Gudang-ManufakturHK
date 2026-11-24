import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { and, desc, eq } from 'drizzle-orm';
import { AKUN_KAS, posting, wajibAkunPosting } from '@/shared/lib/jurnal';
import { BusinessError, errorResponse } from '@/shared/lib/stock';

// ============================================================
// API: /api/keuangan (Kas & Bank)
// GET  daftar mutasi kas per divisi (otomatis dari transaksi + manual)
// POST catat kas manual: akun kas <-> akun lawan (COA), langsung dijurnal
// Hak akses: pembukuan (Direktur Utama & Manager)
// ============================================================

export async function GET(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const divisi = searchParams.get('divisi') === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const cabang = searchParams.get('cabang');

    const syarat = [eq(keuangan.divisi, divisi)];
    if (cabang && cabang !== 'SEMUA') syarat.push(eq(keuangan.cabang, cabang));

    const items = await db
      .select()
      .from(keuangan)
      .where(and(...syarat))
      .orderBy(desc(keuangan.tanggal))
      .limit(300);

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    return errorResponse(err, 'KEUANGAN_GET');
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { tanggal, jenis, akunKode, keterangan } = body;
    const akunKasDipilih = AKUN_KAS.includes(body.akunKas) ? String(body.akunKas) : AKUN_KAS[0];
    const divisi = body.divisi === 'FNB' ? 'FNB' : 'MANUFAKTUR';
    const cabang = String(body.cabang || 'Pusat');

    const parsedJumlah = Math.round(Number(body.jumlah) * 100) / 100;
    if ((jenis !== 'masuk' && jenis !== 'keluar') || !akunKode || !Number.isFinite(parsedJumlah) || parsedJumlah <= 0) {
      return NextResponse.json(
        { success: false, message: 'Jenis, Akun lawan, dan Jumlah (harus lebih dari 0) wajib diisi' },
        { status: 400 }
      );
    }

    const user = authResult.user?.name || authResult.user?.username || 'System';
    const tgl = tanggal ? new Date(tanggal) : new Date();
    if (Number.isNaN(tgl.getTime())) throw new BusinessError('Tanggal tidak valid');

    const row = await db.transaction(async (tx) => {
      const lawan = await wajibAkunPosting(tx, String(akunKode));
      if (lawan.kode === akunKasDipilih) throw new BusinessError('Akun lawan tidak boleh sama dengan akun kas');

      const [r] = await tx
        .insert(keuangan)
        .values({
          tanggal: tgl,
          jenis,
          kategori: lawan.nama,
          jumlah: String(parsedJumlah),
          divisi,
          cabang,
          keterangan: keterangan || null,
          akunKode: lawan.kode,
          createdBy: authResult.user?.username ?? user,
        })
        .returning();

      await posting(tx, {
        tanggal: tgl,
        divisi,
        cabang,
        sumber: 'KAS_MANUAL',
        referensi: r.id,
        keterangan: `Kas ${jenis} manual: ${lawan.nama}${keterangan ? ` - ${keterangan}` : ''}`,
        user,
        manual: true,
        baris:
          jenis === 'masuk'
            ? [{ akun: akunKasDipilih, debit: parsedJumlah }, { akun: lawan.kode, kredit: parsedJumlah }]
            : [{ akun: lawan.kode, debit: parsedJumlah }, { akun: akunKasDipilih, kredit: parsedJumlah }],
      });

      await tx.insert(logs).values({
        user,
        aksi: 'CATAT_KEUANGAN',
        detail: `Catat kas ${jenis.toUpperCase()} [${divisi}] ${lawan.kode} ${lawan.nama}: Rp ${parsedJumlah.toLocaleString('id-ID')}`,
      });
      return r;
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'KEUANGAN_POST');
  }
}
