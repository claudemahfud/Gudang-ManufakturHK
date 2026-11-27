'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Bingkai from '@/shared/components/ui/Bingkai';

/**
 * Sesi hilang saat halaman masih terbuka: tanpa ini tombol & data hilang diam-diam
 * (mis. tombol Edit lenyap dan avatar jadi "U").
 */
export default function SesiHabis() {
  const { status } = useSession();
  const [tampil, setTampil] = useState(false);

  // ditunda sebentar agar tidak berkedip saat Keluar biasa (langsung pindah ke halaman login)
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const t = setTimeout(() => setTampil(true), 1500);
    return () => {
      clearTimeout(t);
      setTampil(false);
    };
  }, [status]);

  if (!tampil) return null;
  return (
    <Bingkai judul="Sesi Anda berakhir" sub="Login lagi untuk melanjutkan" onClose={() => setTampil(false)} lebar="max-w-sm">
      <div className="space-y-4 p-5 sm:px-8">
        <p className="text-sm text-gray-700">Aplikasi tidak lagi mengenali akun Anda. Isian yang belum disimpan akan hilang saat pindah ke halaman login.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Muat ulang
          </button>
          <button
            type="button"
            onClick={() => {
              // muat penuh disengaja: status sesi lama di memori ikut terbuang
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
            }}
            className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Login lagi
          </button>
        </div>
      </div>
    </Bingkai>
  );
}
