'use client';

// html2canvas 1.4 tidak mengenali warna oklch()/oklab() (palet bawaan Tailwind v4):
// warna pada salinan elemen diubah dulu ke rgb lewat kanvas 1x1 piksel.
const PROPS_WARNA = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
] as const;

function keRgb(ctx: CanvasRenderingContext2D, warna: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = warna;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

function rapikanWarna(asli: HTMLElement, salinan: HTMLElement) {
  const kanvas = document.createElement('canvas');
  kanvas.width = kanvas.height = 1;
  const ctx = kanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const sumber = [asli, ...Array.from(asli.querySelectorAll<HTMLElement>('*'))];
  const tujuan = [salinan, ...Array.from(salinan.querySelectorAll<HTMLElement>('*'))];
  sumber.forEach((el, i) => {
    const t = tujuan[i];
    if (!t) return;
    const cs = getComputedStyle(el);
    for (const p of PROPS_WARNA) {
      const v = cs[p];
      if (v && /okl(ch|ab)|color\(|lab\(|lch\(/.test(v)) t.style[p] = keRgb(ctx, v);
    }
    t.style.boxShadow = 'none';
  });
}

/**
 * Simpan elemen sebagai PNG. Di HP yang mendukung Web Share berkas, muncul lembar bagikan
 * (pilih "Simpan Gambar" untuk masuk Galeri); selain itu berkas diunduh ke folder Unduhan.
 */
export async function unduhElemenPng(el: HTMLElement, namaFile: string) {
  const mod = await import('html2canvas');
  const html2canvas = mod.default;
  const kanvas = await html2canvas(el, {
    scale: 3,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    onclone: (_doc, salinan) => rapikanWarna(el, salinan),
  });
  const blob: Blob | null = await new Promise((ok) => kanvas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Gagal membuat gambar PNG');

  const berkas = new File([blob], namaFile, { type: 'image/png' });
  const sentuh = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (sentuh && navigator.canShare?.({ files: [berkas] })) {
    try {
      await navigator.share({ files: [berkas], title: namaFile });
      return;
    } catch (e) {
      // Dibatalkan pengguna: jangan lanjut mengunduh
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
