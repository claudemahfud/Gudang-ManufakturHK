// ============================================================
// Pemetaan transaksi -> akun COA (murni, tanpa DB; dipakai browser).
// Orang keuangan memilih/mengetik JENIS transaksi dalam bahasa biasa; aplikasi menentukan
// akun debit & kredit. Tidak perlu hafal kode akun atau aturan debit/kredit.
// Server tetap memvalidasi akun & keseimbangan jurnal (jurnal.ts), jadi ini hanya pemandu.
// ============================================================

export type Arah = 'masuk' | 'keluar' | 'nonkas' | 'pindah';
export type Rute = 'keuangan' | 'biaya' | 'jurnal';

export interface Template {
  id: string;
  label: string;
  deskripsi: string;
  arah: Arah;
  rute: Rute;
  /** Akun lawan tetap (masuk/keluar). */
  lawan?: string;
  /** Akun lawan dipilih dari daftar ini (awalan kode). */
  pilihAwalan?: string[];
  labelPilih?: string;
  /** Jurnal non-kas: akun debit & kredit (debit boleh dipilih). */
  debit?: string;
  kredit?: string;
  /** Kata kunci pengenal dari teks bebas. */
  kata: string[];
}

export const TEMPLATE: Template[] = [
  { id: 'MODAL', label: 'Setoran Modal Pemilik', deskripsi: 'Pemilik menyetor uang ke usaha', arah: 'masuk', rute: 'keuangan', lawan: '3-1000', kata: ['modal', 'setor', 'setoran', 'investasi pemilik', 'tambahan modal', 'suntik'] },
  { id: 'PINJAMAN', label: 'Terima Pinjaman', deskripsi: 'Dana pinjaman dari bank / pihak lain masuk', arah: 'masuk', rute: 'keuangan', lawan: '2-2100', kata: ['pinjaman', 'pinjam', 'kredit bank', 'kur', 'dana talangan', 'hutang bank'] },
  { id: 'PENDAPATAN_LAIN', label: 'Pendapatan Lain-lain', deskripsi: 'Bunga bank, komisi, hadiah, penjualan barang bekas', arah: 'masuk', rute: 'keuangan', lawan: '4-9000', kata: ['bunga', 'komisi', 'hadiah', 'bonus', 'barang bekas', 'cashback', 'denda diterima', 'pendapatan lain'] },
  { id: 'BIAYA', label: 'Bayar Biaya Operasional', deskripsi: 'Listrik, gaji, sewa, bensin, iklan, perawatan, dll', arah: 'keluar', rute: 'biaya', pilihAwalan: ['6-'], labelPilih: 'Jenis biaya', kata: ['bayar', 'biaya', 'beban', 'listrik', 'gaji', 'upah', 'sewa', 'bensin', 'solar', 'iklan', 'servis', 'service', 'perbaikan', 'atk', 'internet', 'pulsa', 'parkir', 'tol', 'konsumsi', 'lembur', 'honor'] },
  { id: 'PRIVE', label: 'Prive (Ambil Pribadi)', deskripsi: 'Pemilik mengambil uang usaha untuk pribadi', arah: 'keluar', rute: 'keuangan', lawan: '3-2000', kata: ['prive', 'pribadi', 'ambil owner', 'tarik owner', 'kebutuhan pribadi', 'ambil uang'] },
  { id: 'BAYAR_PINJAMAN', label: 'Bayar Cicilan Pinjaman', deskripsi: 'Angsuran pokok pinjaman bank / pihak lain', arah: 'keluar', rute: 'keuangan', lawan: '2-2100', kata: ['cicilan pinjaman', 'angsuran', 'cicil bank', 'bayar pinjaman', 'lunasi pinjaman', 'pokok pinjaman'] },
  { id: 'BELI_ASET', label: 'Beli Aset Tetap', deskripsi: 'Mesin, oven, freezer, motor, mobil (dipakai jangka panjang)', arah: 'keluar', rute: 'keuangan', pilihAwalan: ['1-21', '1-22'], labelPilih: 'Jenis aset', kata: ['beli mesin', 'beli motor', 'beli mobil', 'beli truk', 'beli oven', 'beli freezer', 'beli peralatan', 'aset tetap', 'kendaraan', 'mesin'] },
  { id: 'BAYAR_BEBAN_TERUTANG', label: 'Bayar Beban yang Sudah Dicatat (Terutang)', deskripsi: 'Melunasi gaji / beban yang sebelumnya dicatat belum dibayar', arah: 'keluar', rute: 'keuangan', lawan: '2-1400', kata: ['bayar gaji terutang', 'lunasi gaji', 'beban terutang', 'gaji belum dibayar', 'bayar terutang'] },
  { id: 'BEBAN_TERUTANG', label: 'Catat Beban Belum Dibayar', deskripsi: 'Beban sudah terjadi (mis. gaji bulan ini) tetapi uang belum keluar', arah: 'nonkas', rute: 'jurnal', pilihAwalan: ['6-'], labelPilih: 'Jenis beban', kredit: '2-1400', kata: ['terutang', 'akrual', 'belum dibayar', 'gaji bulan ini belum', 'tagihan belum dibayar'] },
  { id: 'PENYUSUTAN', label: 'Penyusutan Aset Tetap', deskripsi: 'Beban susut bulanan mesin / kendaraan (tanpa uang keluar)', arah: 'nonkas', rute: 'jurnal', debit: '6-1800', kredit: '1-2900', kata: ['penyusutan', 'susut', 'depresiasi'] },
  { id: 'PINDAH_KAS', label: 'Pindah Antar Kas / Bank', deskripsi: 'Setor tunai ke bank, tarik tunai, transfer antar rekening', arah: 'pindah', rute: 'jurnal', kata: ['setor ke bank', 'tarik tunai', 'pindah kas', 'transfer antar', 'pindah saldo', 'setor tunai'] },
];

export const AKUN_KAS_PILIHAN = [
  { kode: '1-1100', nama: 'Kas Tunai' },
  { kode: '1-1200', nama: 'Bank' },
  { kode: '1-1300', nama: 'Kas QRIS / E-Wallet' },
];

// Kata kunci -> akun beban (urut dari yang paling spesifik)
const KATA_BIAYA: [string, string[]][] = [
  ['6-2200', ['admin bank', 'biaya transfer', 'provisi', 'biaya bank']],
  ['6-1800', ['penyusutan', 'depresiasi']],
  ['6-1100', ['gaji', 'upah', 'honor', 'lembur', 'thr', 'bonus karyawan', 'karyawan', 'pegawai']],
  ['6-1200', ['sewa', 'kontrak tempat', 'kontrakan', 'kos']],
  ['6-1300', ['listrik', 'pln', 'token', 'air', 'pdam', 'internet', 'wifi', 'indihome', 'pulsa', 'telepon', 'telpon']],
  ['6-1400', ['bensin', 'solar', 'bbm', 'ongkir', 'kirim', 'ekspedisi', 'parkir', 'tol', 'transport', 'angkut', 'bongkar muat']],
  ['6-1500', ['iklan', 'promo', 'marketing', 'banner', 'brosur', 'endorse', 'ads', 'sponsor', 'spanduk']],
  ['6-1600', ['atk', 'kertas', 'tinta', 'plastik', 'perlengkapan', 'sabun', 'alat tulis', 'nota', 'lakban', 'kantong']],
  ['6-1700', ['servis', 'service', 'perbaikan', 'perawatan', 'maintenance', 'reparasi', 'ganti oli', 'tambal']],
];

const bersih = (t: string) => ` ${t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
const adaKata = (teks: string, k: string) => teks.includes(` ${k} `) || (k.includes(' ') && teks.includes(k));

/** Saran akun beban dari uraian bebas ("bayar listrik pln") -> kode 6-xxxx; null bila tidak yakin. */
export function sarankanAkunBiaya(uraian: string): string | null {
  const t = bersih(uraian);
  if (t.trim().length < 3) return null;
  for (const [kode, kata] of KATA_BIAYA) if (kata.some((k) => adaKata(t, k))) return kode;
  return null;
}

/** Saran jenis transaksi dari teks bebas. Skor = jumlah kata kunci yang cocok (kata lebih panjang bernilai lebih). */
export function sarankanTemplate(uraian: string): { template: Template; akun: string | null } | null {
  const t = bersih(uraian);
  if (t.trim().length < 3) return null;
  let terbaik: { tpl: Template; skor: number } | null = null;
  for (const tpl of TEMPLATE) {
    const skor = tpl.kata.reduce((s, k) => s + (adaKata(t, k) ? (k.includes(' ') ? 3 : 1) : 0), 0);
    if (skor > 0 && (!terbaik || skor > terbaik.skor)) terbaik = { tpl, skor };
  }
  const biaya = sarankanAkunBiaya(uraian);
  // Tidak ada kata transaksi, tetapi ada kata biaya spesifik (kertas, lakban, ...): biaya operasional
  if (!terbaik) return biaya ? { template: TEMPLATE.find((x) => x.id === 'BIAYA')!, akun: biaya } : null;
  return { template: terbaik.tpl, akun: terbaik.tpl.pilihAwalan?.some((a) => a.startsWith('6-')) ? biaya : null };
}

export interface BarisPratinjau {
  akun: string;
  debit: number;
  kredit: number;
}

export interface MasukanSusun {
  jumlah: number;
  /** Akun kas sumber/tujuan (1-1100/1-1200/1-1300). */
  kas: string;
  /** Akun lawan pilihan pengguna (untuk template berpilihan). */
  akun?: string;
  /** Pindah kas: akun tujuan. */
  kasTujuan?: string;
}

/** Baris jurnal dari template. Null bila masukan belum lengkap. */
export function susunBaris(t: Template, m: MasukanSusun): BarisPratinjau[] | null {
  const j = Math.round((Number(m.jumlah) || 0) * 100) / 100;
  if (!(j > 0)) return null;
  const lawan = t.lawan ?? m.akun;
  switch (t.arah) {
    case 'masuk':
      return lawan ? [{ akun: m.kas, debit: j, kredit: 0 }, { akun: lawan, debit: 0, kredit: j }] : null;
    case 'keluar':
      return lawan ? [{ akun: lawan, debit: j, kredit: 0 }, { akun: m.kas, debit: 0, kredit: j }] : null;
    case 'nonkas': {
      const d = t.debit ?? m.akun;
      return d && t.kredit ? [{ akun: d, debit: j, kredit: 0 }, { akun: t.kredit, debit: 0, kredit: j }] : null;
    }
    case 'pindah':
      return m.kasTujuan && m.kasTujuan !== m.kas
        ? [{ akun: m.kasTujuan, debit: j, kredit: 0 }, { akun: m.kas, debit: 0, kredit: j }]
        : null;
  }
}

/** Kalimat dampak dalam bahasa biasa: "Kas Tunai bertambah Rp ...". */
export function dampak(baris: BarisPratinjau[], akun: { kode: string; nama: string; saldoNormal: 'D' | 'K' }[], rupiah: (n: number) => string) {
  return baris.map((b) => {
    const a = akun.find((x) => x.kode === b.akun);
    const nama = a?.nama ?? b.akun;
    const naik = a ? (a.saldoNormal === 'D' ? b.debit > 0 : b.kredit > 0) : b.debit > 0;
    return `${nama} ${naik ? 'bertambah' : 'berkurang'} ${rupiah(b.debit || b.kredit)}`;
  });
}
