// ============================================================
// Perhitungan Faktur Penjualan (murni, tanpa DB).
// Dipakai formulir (pratinjau langsung) dan server (sumber kebenaran).
// ============================================================

export type MetodeBayar = 'tunai' | 'transfer' | 'tempo';
export type StatusFaktur = 'lunas' | 'sebagian' | 'belum_lunas';

export interface BarisFaktur {
  qty: number;
  hargaJual: number;
  diskon: number; // persen 0-100 per baris
}

export interface OpsiFaktur {
  diskonFaktur: number; // rupiah
  ppnPersen: number; // 0-100
  ongkir: number; // rupiah
  metodeBayar: MetodeBayar;
  /** Jumlah yang dibayar sekarang. undefined = lunas penuh (tunai/transfer) atau 0 (tempo). */
  dibayar?: number;
}

export interface HasilFaktur {
  totalBaris: number[];
  subtotal: number;
  diskonFaktur: number;
  dpp: number; // dasar pengenaan pajak = subtotal - diskon faktur
  ppn: number;
  ongkir: number;
  grandTotal: number;
  dibayar: number;
  sisaPiutang: number;
  status: StatusFaktur;
}

const rp = (n: number) => Math.round(n * 100) / 100;
const aman = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function totalBaris(b: BarisFaktur): number {
  const diskon = Math.min(100, aman(b.diskon));
  return rp(aman(b.qty) * aman(b.hargaJual) * (1 - diskon / 100));
}

export function hitungFaktur(baris: BarisFaktur[], o: OpsiFaktur): HasilFaktur {
  const totals = baris.map(totalBaris);
  const subtotal = rp(totals.reduce((s, n) => s + n, 0));
  const diskonFaktur = rp(Math.min(aman(o.diskonFaktur), subtotal));
  const dpp = rp(subtotal - diskonFaktur);
  const ppn = rp((dpp * Math.min(100, aman(o.ppnPersen))) / 100);
  const ongkir = rp(aman(o.ongkir));
  const grandTotal = rp(dpp + ppn + ongkir);

  const bawaan = o.metodeBayar === 'tempo' ? 0 : grandTotal;
  const dibayar = rp(Math.min(o.dibayar === undefined ? bawaan : aman(o.dibayar), grandTotal));
  const sisaPiutang = rp(grandTotal - dibayar);
  const status: StatusFaktur = sisaPiutang <= 0 ? 'lunas' : dibayar > 0 ? 'sebagian' : 'belum_lunas';

  return { totalBaris: totals, subtotal, diskonFaktur, dpp, ppn, ongkir, grandTotal, dibayar, sisaPiutang, status };
}

export const LABEL_METODE: Record<MetodeBayar, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer Bank',
  tempo: 'Tempo (Piutang)',
};

export const LABEL_STATUS: Record<StatusFaktur, string> = {
  lunas: 'Lunas',
  sebagian: 'Dibayar Sebagian',
  belum_lunas: 'Belum Dibayar',
};
