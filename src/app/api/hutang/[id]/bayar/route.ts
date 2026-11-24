import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { hutangBayar, hutangSupplier, keuangan, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_PEMBUKUAN } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { AKUN, akunKas, posting } from '@/shared/lib/jurnal';

const rp = (n: number) => Math.round(n * 100) / 100;

// POST /api/hutang/[id]/bayar {jumlah, metode: tunai|transfer, tanggal, catatan}
// Kas keluar + jurnal Dr Hutang Usaha / Cr Kas; sisa hutang berkurang.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthRole(ROLES_PEMBUKUAN);
    if (!auth.authorized) return auth.response;
    const user = auth.user?.name || auth.user?.username || 'System';
    const { id } = await params;
    const body = await req.json();
    const jumlah = rp(Number(body.jumlah));
    const metode = body.metode === 'transfer' ? 'transfer' : 'tunai';
    const tanggal = body.tanggal ? new Date(`${String(body.tanggal).slice(0, 10)}T12:00:00+07:00`) : new Date();
    if (!Number.isFinite(jumlah) || jumlah <= 0) throw new BusinessError('Jumlah pembayaran harus lebih dari 0');
    if (Number.isNaN(tanggal.getTime())) throw new BusinessError('Tanggal tidak valid');
    const catatan = body.catatan ? String(body.catatan).slice(0, 500) : null;

    const hasil = await db.transaction(async (tx) => {
      // FOR UPDATE: dua pembayaran bersamaan antre, sisa tidak bisa minus
      const [h] = await tx.select().from(hutangSupplier).where(eq(hutangSupplier.id, id)).for('update').limit(1);
      if (!h) throw new BusinessError('Hutang tidak ditemukan', 404);
      const sisa = rp(Number(h.sisaHutang));
      if (sisa <= 0) throw new BusinessError('Hutang ini sudah lunas');
      if (jumlah > sisa) throw new BusinessError(`Pembayaran melebihi sisa hutang Rp ${sisa.toLocaleString('id-ID')}`);
      const sisaBaru = rp(sisa - jumlah);

      const [u] = await tx
        .update(hutangSupplier)
        .set({ sisaHutang: String(sisaBaru), status: sisaBaru <= 0 ? 'lunas' : 'belum_lunas', updatedAt: new Date() })
        .where(eq(hutangSupplier.id, id))
        .returning();
      await tx.insert(hutangBayar).values({ hutangId: id, tanggal, jumlah: String(jumlah), metode, catatan, createdBy: auth.user?.username ?? user });
      await tx.insert(keuangan).values({
        tanggal,
        jenis: 'keluar',
        kategori: 'Pembayaran Hutang Supplier',
        jumlah: String(jumlah),
        divisi: h.divisi,
        cabang: 'Pusat',
        keterangan: `${sisaBaru <= 0 ? 'Pelunasan' : 'Cicilan'} hutang ${h.supplier} faktur ${h.noFaktur || '-'} (${metode})`,
        createdBy: auth.user?.username ?? user,
      });
      await posting(tx, {
        tanggal,
        divisi: h.divisi,
        cabang: 'Pusat',
        sumber: 'BAYAR_HUTANG',
        referensi: h.noFaktur,
        keterangan: `${sisaBaru <= 0 ? 'Pelunasan' : 'Cicilan'} hutang ${h.supplier} faktur ${h.noFaktur || '-'} (${metode})`,
        user,
        baris: [
          { akun: AKUN.HUTANG_USAHA, debit: jumlah },
          { akun: akunKas(metode), kredit: jumlah },
        ],
      });
      await tx.insert(logs).values({
        user,
        aksi: sisaBaru <= 0 ? 'PELUNASAN_HUTANG' : 'CICILAN_HUTANG',
        detail: `Bayar hutang ${h.supplier} faktur ${h.noFaktur || '-'}: Rp ${jumlah.toLocaleString('id-ID')} (${metode}), sisa Rp ${sisaBaru.toLocaleString('id-ID')}`,
      });
      return u;
    });

    return NextResponse.json({ success: true, data: hasil });
  } catch (err) {
    return errorResponse(err, 'HUTANG_BAYAR');
  }
}
