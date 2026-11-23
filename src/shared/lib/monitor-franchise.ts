import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { barangKeluar, fakturPenjualan, inventory, masterCabang, orderFranchise, stokCabang } from '@/shared/lib/db/schema';

// ============================================================
// Monitor Franchise: penjualan POS, stok, pembelian & tagihan per outlet.
// Lihat docs/PRD-dapur-pusat-franchise.md (F4).
// ============================================================

const num = (v: unknown) => Number(v ?? 0) || 0;

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function monitorFranchise(dari: Date, sampai: Date, ex: Executor = db) {
  const outlet = await ex
    .select({ nama: masterCabang.namaCabang, kode: masterCabang.kodeCabang, status: masterCabang.status })
    .from(masterCabang)
    .where(eq(masterCabang.tipe, 'FRANCHISE'))
    .orderBy(masterCabang.namaCabang);
  const nama = outlet.map((o) => o.nama);
  if (nama.length === 0) return { outlet: [], total: null };

  const periodePos = and(
    eq(barangKeluar.channel, 'POS'),
    inArray(barangKeluar.cabang, nama),
    gte(barangKeluar.tanggal, dari),
    lt(barangKeluar.tanggal, sampai)
  );
  const [omset, terlaris, stok, beli, tagihan, menunggu] = await Promise.all([
    ex
      .select({
        cabang: barangKeluar.cabang,
        omset: sql<string>`coalesce(sum(${barangKeluar.total}), 0)`,
        transaksi: sql<number>`count(distinct ${barangKeluar.trxId})`.mapWith(Number),
        qty: sql<number>`coalesce(sum(${barangKeluar.qty}), 0)`.mapWith(Number),
      })
      .from(barangKeluar)
      .where(periodePos)
      .groupBy(barangKeluar.cabang),
    ex
      .select({
        cabang: barangKeluar.cabang,
        namaBarang: barangKeluar.namaBarang,
        qty: sql<number>`sum(${barangKeluar.qty})`.mapWith(Number),
        omset: sql<string>`sum(${barangKeluar.total})`,
      })
      .from(barangKeluar)
      .where(periodePos)
      .groupBy(barangKeluar.cabang, barangKeluar.namaBarang),
    ex
      .select({
        cabang: stokCabang.cabang,
        nilai: sql<string>`coalesce(sum(${stokCabang.stok} * ${inventory.hargaFranchise}), 0)`,
        item: sql<number>`count(*) filter (where ${stokCabang.stok} > 0)`.mapWith(Number),
      })
      .from(stokCabang)
      .innerJoin(inventory, eq(inventory.sku, stokCabang.sku))
      .where(inArray(stokCabang.cabang, nama))
      .groupBy(stokCabang.cabang),
    ex
      .select({ franchise: orderFranchise.franchise, total: sql<string>`coalesce(sum(${orderFranchise.total}), 0)` })
      .from(orderFranchise)
      .where(
        and(
          inArray(orderFranchise.status, ['dikirim', 'diterima']),
          gte(orderFranchise.tanggal, dari),
          lt(orderFranchise.tanggal, sampai)
        )
      )
      .groupBy(orderFranchise.franchise),
    ex
      .select({ pelanggan: fakturPenjualan.pelanggan, sisa: sql<string>`coalesce(sum(${fakturPenjualan.sisaPiutang}), 0)` })
      .from(fakturPenjualan)
      .where(and(inArray(fakturPenjualan.pelanggan, nama), sql`${fakturPenjualan.sisaPiutang} > 0`))
      .groupBy(fakturPenjualan.pelanggan),
    ex
      .select({ franchise: orderFranchise.franchise, jumlah: sql<number>`count(*)`.mapWith(Number) })
      .from(orderFranchise)
      .where(eq(orderFranchise.status, 'diajukan'))
      .groupBy(orderFranchise.franchise),
  ]);

  const baris = outlet.map((o) => {
    const om = omset.find((x) => x.cabang === o.nama);
    return {
      ...o,
      omset: num(om?.omset),
      transaksi: om?.transaksi ?? 0,
      qtyTerjual: om?.qty ?? 0,
      terlaris: terlaris
        .filter((t) => t.cabang === o.nama)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 3)
        .map((t) => ({ namaBarang: t.namaBarang, qty: t.qty, omset: num(t.omset) })),
      nilaiStok: num(stok.find((x) => x.cabang === o.nama)?.nilai),
      itemStok: stok.find((x) => x.cabang === o.nama)?.item ?? 0,
      pembelian: num(beli.find((x) => x.franchise === o.nama)?.total),
      sisaTagihan: num(tagihan.find((x) => x.pelanggan === o.nama)?.sisa),
      orderMenunggu: menunggu.find((x) => x.franchise === o.nama)?.jumlah ?? 0,
    };
  });
  const jumlah = (k: 'omset' | 'transaksi' | 'nilaiStok' | 'pembelian' | 'sisaTagihan' | 'orderMenunggu') =>
    Math.round(baris.reduce((s, b) => s + b[k], 0) * 100) / 100;
  return {
    outlet: baris,
    total: {
      omset: jumlah('omset'),
      transaksi: jumlah('transaksi'),
      nilaiStok: jumlah('nilaiStok'),
      pembelian: jumlah('pembelian'),
      sisaTagihan: jumlah('sisaTagihan'),
      orderMenunggu: jumlah('orderMenunggu'),
    },
  };
}
