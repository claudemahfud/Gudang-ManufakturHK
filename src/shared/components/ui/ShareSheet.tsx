'use client';

import { useEffect, useState } from 'react';
import { SHARE_EVENT } from '@/shared/lib/simpan-berkas';

// Dialog global "File siap" (dipasang sekali di ClientProviders). Muncul setelah berkas diunduh di layar
// sentuh yang mendukung Web Share berkas: ketuk "Bagikan / Simpan" lalu pilih "Simpan Gambar" / "Simpan ke File".
export default function ShareSheet() {
  const [file, setFile] = useState<File | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    const onFile = (e: Event) => {
      setFile((e as CustomEvent<File>).detail);
      setGalat('');
    };
    window.addEventListener(SHARE_EVENT, onFile);
    return () => window.removeEventListener(SHARE_EVENT, onFile);
  }, []);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFile(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [file]);

  if (!file) return null;

  // Dipanggil LANGSUNG dari klik: tidak boleh ada await sebelum navigator.share
  const bagikan = async () => {
    try {
      await navigator.share({ files: [file], title: file.name });
      setFile(null);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return; // pengguna menutup lembar bagikan
      setGalat((err as Error)?.message || 'Gagal membagikan berkas.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simpan atau bagikan file"
      onClick={() => setFile(null)}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center print:hidden"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">File siap</h2>
        <p className="mt-1 break-all text-sm text-gray-600">{file.name}</p>
        <p className="mt-3 text-sm text-gray-700">
          Ketuk <strong>Bagikan / Simpan</strong>, lalu pilih <strong>Simpan Gambar</strong> atau <strong>Simpan ke File</strong>.
        </p>
        {galat && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {galat}
          </p>
        )}
        <button type="button" onClick={bagikan} className="mt-4 w-full rounded-xl bg-sky-600 py-3 font-semibold text-white hover:bg-sky-700">
          Bagikan / Simpan
        </button>
        <button type="button" onClick={() => setFile(null)} className="mt-2 w-full py-2 text-sm text-gray-600">
          Tutup
        </button>
      </div>
    </div>
  );
}
