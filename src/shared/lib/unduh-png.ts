'use client';

// Nota digambar langsung ke kanvas dari data transaksi (bukan tangkapan layar elemen):
// html2canvas menggeser posisi teks sehingga baris nama barang terpotong dan "Subtotal" tercoret.

export interface DataNota {
  trxId: string;
  tanggal: string | number | Date;
  kasir: string;
  pelanggan: string;
  items: { namaBarang: string; qty: number; hargaJual: number }[];
  subtotal: number;
  nominalDiskon?: number;
  diskonPct?: number;
  grandTotal: number;
  metodePembayaran: string;
  uangDiterima: number;
  kembalian: number;
}

export interface TokoNota {
  namaToko: string;
  alamatToko?: string;
  teleponToko?: string;
  pesanFooter?: string;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const rp = (n: number) => (Number(n) || 0).toLocaleString('id-ID');

/** Gambar nota 58mm (lebar 300px x skala 3) menjadi PNG. */
export async function gambarNotaPng(d: DataNota, t: TokoNota): Promise<Blob> {
  const S = 3;
  const W = 300;
  const PAD = 16;
  const isi = W - PAD * 2;
  const kanvas = document.createElement('canvas');
  kanvas.width = W * S;
  kanvas.height = 3000 * S;
  const c = kanvas.getContext('2d');
  if (!c) throw new Error('Kanvas tidak didukung');
  c.scale(S, S);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, 3000);
  c.textBaseline = 'top';
  let y = PAD;

  const huruf = (ukuran: number, tebal = false) => {
    c.font = `${tebal ? '700' : '400'} ${ukuran}px ${MONO}`;
  };
  const pecah = (teks: string, lebar: number) => {
    const baris: string[] = [];
    for (const paragraf of String(teks ?? '').split('\n')) {
      let kini = '';
      for (const kata of paragraf.split(' ')) {
        const coba = kini ? `${kini} ${kata}` : kata;
        if (c.measureText(coba).width > lebar && kini) {
          baris.push(kini);
          kini = kata;
        } else kini = coba;
      }
      baris.push(kini);
    }
    return baris;
  };
  const tengah = (teks: string, ukuran: number, warna = '#111', tebal = false) => {
    huruf(ukuran, tebal);
    c.fillStyle = warna;
    for (const b of pecah(teks, isi)) {
      c.fillText(b, (W - c.measureText(b).width) / 2, y);
      y += ukuran * 1.35;
    }
  };
  const kiriKanan = (kiri: string, kanan: string, ukuran = 11, tebal = false, warna = '#111') => {
    huruf(ukuran, tebal);
    c.fillStyle = warna;
    c.fillText(kiri, PAD, y);
    c.fillText(kanan, W - PAD - c.measureText(kanan).width, y);
    y += ukuran * 1.45;
  };
  const putus = () => {
    y += 4;
    c.strokeStyle = '#9ca3af';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(PAD, y + 0.5);
    c.lineTo(W - PAD, y + 0.5);
    c.stroke();
    c.setLineDash([]);
    y += 8;
  };

  // Kepala
  tengah(t.namaToko || 'Nota', 15, '#000', true);
  if (t.alamatToko) tengah(t.alamatToko, 10, '#374151');
  if (t.teleponToko) tengah(`Telp: ${t.teleponToko}`, 10, '#374151');
  putus();

  // Data transaksi
  const waktu = new Date(d.tanggal).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  kiriKanan('No Trx:', d.trxId, 11, true);
  kiriKanan('Waktu:', waktu);
  kiriKanan('Kasir:', d.kasir);
  kiriKanan('Pelanggan:', d.pelanggan);
  putus();

  // Barang
  for (const it of d.items ?? []) {
    huruf(12, true);
    c.fillStyle = '#000';
    for (const b of pecah(it.namaBarang, isi)) {
      c.fillText(b, PAD, y);
      y += 12 * 1.35;
    }
    kiriKanan(`${it.qty} x ${rp(it.hargaJual)}`, rp(it.qty * it.hargaJual), 11, false, '#374151');
    y += 3;
  }
  putus();

  // Total
  kiriKanan('Subtotal:', `Rp ${rp(d.subtotal)}`);
  if ((d.nominalDiskon ?? 0) > 0) kiriKanan(`Diskon (${d.diskonPct ?? 0}%):`, `- Rp ${rp(d.nominalDiskon ?? 0)}`);
  y += 2;
  c.strokeStyle = '#d1d5db';
  c.beginPath();
  c.moveTo(PAD, y + 0.5);
  c.lineTo(W - PAD, y + 0.5);
  c.stroke();
  y += 6;
  kiriKanan('TOTAL:', `Rp ${rp(d.grandTotal)}`, 13, true, '#000');
  kiriKanan(`Bayar (${d.metodePembayaran}):`, `Rp ${rp(d.uangDiterima)}`);
  if (d.metodePembayaran === 'Tunai') kiriKanan('Kembali:', `Rp ${rp(d.kembalian)}`, 11, true, '#000');
  putus();

  if (t.pesanFooter) {
    y += 4;
    tengah(t.pesanFooter, 10, '#4b5563');
  }
  y += PAD;

  // Potong kanvas sesuai tinggi isi
  const hasil = document.createElement('canvas');
  hasil.width = W * S;
  hasil.height = Math.ceil(y * S);
  hasil.getContext('2d')!.drawImage(kanvas, 0, 0);
  const blob: Blob | null = await new Promise((ok) => hasil.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Gagal membuat gambar PNG');
  return blob;
}

/**
 * Simpan PNG. Di HP yang mendukung Web Share berkas, muncul lembar bagikan
 * (pilih "Simpan Gambar" untuk masuk Galeri); selain itu berkas diunduh ke folder Unduhan.
 */
export async function simpanPng(blob: Blob, namaFile: string) {
  const berkas = new File([blob], namaFile, { type: 'image/png' });
  const sentuh = matchMedia('(pointer: coarse)').matches;
  if (sentuh && navigator.canShare?.({ files: [berkas] })) {
    try {
      await navigator.share({ files: [berkas], title: namaFile });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
