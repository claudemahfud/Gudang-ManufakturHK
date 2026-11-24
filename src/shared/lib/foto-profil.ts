'use client';

import { useEffect, useState } from 'react';

const EVENT = 'foto-profil-berubah';

/** Perkecil & potong tengah gambar menjadi persegi 256px (WebP, fallback JPEG). */
export async function siapkanFoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Pilih file gambar (JPG, PNG, atau WebP)');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, gagal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => gagal(new Error('Gambar tidak bisa dibaca'));
      i.src = url;
    });
    const sisi = Math.min(img.naturalWidth, img.naturalHeight);
    const kanvas = document.createElement('canvas');
    kanvas.width = kanvas.height = 256;
    const c = kanvas.getContext('2d');
    if (!c) throw new Error('Kanvas tidak didukung');
    c.drawImage(img, (img.naturalWidth - sisi) / 2, (img.naturalHeight - sisi) / 2, sisi, sisi, 0, 0, 256, 256);
    const webp = kanvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : kanvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Beri tahu komponen lain (Header) bahwa foto berubah. */
export function umumkanFotoBerubah(foto: string | null) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: foto }));
}

/** Foto profil akun yang sedang login; ikut berubah saat diunggah/dihapus. */
export function useFotoProfil(): string | null {
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    let batal = false;
    fetch('/api/profile/foto')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !batal && j?.success && setFoto(j.foto ?? null))
      .catch(() => {});
    const ubah = (e: Event) => setFoto((e as CustomEvent<string | null>).detail);
    window.addEventListener(EVENT, ubah);
    return () => {
      batal = true;
      window.removeEventListener(EVENT, ubah);
    };
  }, []);
  return foto;
}
