'use client';

import { useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { MAKS_FOTO, MAKS_PANJANG_FOTO } from '@/shared/lib/biaya-aturan';

/** Kecilkan foto di browser (sisi terpanjang 1400 px, JPEG) sampai muat batas server. */
async function kecilkan(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let sisi = 1400;
    let mutu = 0.75;
    for (let i = 0; i < 5; i++) {
      const skala = Math.min(1, sisi / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * skala);
      c.height = Math.round(img.naturalHeight * skala);
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const hasil = c.toDataURL('image/jpeg', mutu);
      if (hasil.length <= MAKS_PANJANG_FOTO) return hasil;
      sisi = Math.round(sisi * 0.8);
      mutu -= 0.08;
    }
    throw new Error('Foto terlalu besar');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const tombol = 'inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-emerald-300';

export default function FotoNota({ foto, onChange, onProses, maks = MAKS_FOTO, label = 'Foto nota / invoice' }: { foto: string[]; onChange: (f: string[]) => void; onProses: (sedang: boolean) => void; maks?: number; label?: string }) {
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);

  const pilih = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const berkas = [...(e.target.files ?? [])].slice(0, maks - foto.length);
    e.target.value = '';
    if (!berkas.length) return;
    setProses(true);
    onProses(true);
    setGalat('');
    try {
      const baru: string[] = [];
      for (const f of berkas) baru.push(await kecilkan(f));
      onChange([...foto, ...baru]);
    } catch {
      setGalat('Foto tidak bisa dibaca. Gunakan JPG atau PNG.');
    } finally {
      setProses(false);
      onProses(false);
    }
  };

  return (
    <fieldset>
      <legend className="text-xs font-semibold text-gray-700">{label}</legend>
      {foto.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {foto.map((src, i) => (
            <li key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded-lg border border-gray-200 object-cover" />
              <button type="button" aria-label={`Hapus foto ${i + 1}`} disabled={proses} onClick={() => onChange(foto.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {foto.length < maks && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={tombol}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Pilih File
            <input type="file" accept="image/*" multiple={maks > 1} disabled={proses} onChange={pilih} className="sr-only" />
          </label>
          <label className={tombol}>
            <Camera className="h-4 w-4" aria-hidden="true" /> Buka Kamera
            <input type="file" accept="image/*" capture="environment" disabled={proses} onChange={pilih} className="sr-only" />
          </label>
        </div>
      )}
      {proses && <p role="status" className="mt-1 text-[11px] text-gray-500">Memproses foto…</p>}
      {galat && <p role="alert" className="mt-1 text-[11px] font-semibold text-red-600">{galat}</p>}
    </fieldset>
  );
}
