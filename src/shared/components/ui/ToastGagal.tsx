'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  DURASI_TOAST_MS,
  EVENT_GAGAL,
  infoJaringan,
  perluDiabaikan,
  ringkasGagal,
  tampilkanGagal,
  bersihkanPesan,
  type InfoGagal,
} from '@/shared/lib/toast-gagal';

// Toast kegagalan global (dipasang sekali di ClientProviders). Melayang di atas, 5 detik lalu hilang.
// Menangkap: respons /api/* tidak sukses, jaringan putus, dan promise error yang tidak ditangani.

interface Item extends InfoGagal {
  id: number;
}

const MAKS_TAMPIL = 3;
let sudahPasang = false;

export default function ToastGagal() {
  const [daftar, setDaftar] = useState<Item[]>([]);
  const penghitung = useRef(0);
  const timer = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const tutup = (id: number) => {
    const t = timer.current.get(id);
    if (t) clearTimeout(t);
    timer.current.delete(id);
    setDaftar((d) => d.filter((x) => x.id !== id));
  };

  // Terima kegagalan; pesan yang sama berturut-turut hanya memperpanjang waktu tampil (tidak menumpuk)
  useEffect(() => {
    const masuk = (e: Event) => {
      const info = (e as CustomEvent<InfoGagal>).detail;
      if (!info?.pesan) return;
      setDaftar((d) => {
        const ada = d.find((x) => x.judul === info.judul && x.pesan === info.pesan);
        const id = ada?.id ?? ++penghitung.current;
        const lama = timer.current.get(id);
        if (lama) clearTimeout(lama);
        timer.current.set(id, setTimeout(() => tutup(id), DURASI_TOAST_MS));
        if (ada) return d;
        return [...d, { id, ...info }].slice(-MAKS_TAMPIL);
      });
    };
    window.addEventListener(EVENT_GAGAL, masuk);
    const semuaTimer = timer.current;
    return () => {
      window.removeEventListener(EVENT_GAGAL, masuk);
      semuaTimer.forEach((t) => clearTimeout(t));
      semuaTimer.clear();
    };
  }, []);

  // Penangkap fetch (sekali per halaman) + error tak terduga
  useEffect(() => {
    if (sudahPasang) return;
    sudahPasang = true;
    const asli = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const metode = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const abaikan = perluDiabaikan(url, init ?? (input instanceof Request ? input : undefined));
      try {
        const res = await asli(input, init);
        if (!res.ok && !abaikan) {
          // Baca salinan agar pemanggil tetap bisa membaca respons aslinya
          res
            .clone()
            .json()
            .catch(() => null)
            .then((body) => {
              const i = ringkasGagal(res.status, metode, body);
              tampilkanGagal(i.judul, i.pesan);
            });
        }
        return res;
      } catch (err) {
        const dibatalkan = (err as { name?: string })?.name === 'AbortError';
        if (!abaikan && !dibatalkan) {
          const i = infoJaringan();
          tampilkanGagal(i.judul, i.pesan);
        }
        throw err;
      }
    };

    const tak = (e: PromiseRejectionEvent) => {
      const nama = (e.reason as { name?: string })?.name;
      if (nama === 'AbortError') return;
      const pesan = bersihkanPesan((e.reason as { message?: string })?.message);
      // Kegagalan fetch sudah ditangani di atas; sisanya = kesalahan program yang tidak tertangkap
      if (!pesan || /failed to fetch|networkerror|load failed/i.test(String(e.reason?.message))) return;
      tampilkanGagal('Terjadi kesalahan', pesan);
    };
    window.addEventListener('unhandledrejection', tak);
    // pemasangan sengaja tidak dilepas: berlaku selama halaman terbuka
  }, []);

  if (daftar.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3 print:hidden"
    >
      {daftar.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-red-200 bg-white p-3.5 shadow-xl ring-1 ring-red-100 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-800">{t.judul}</p>
            <p className="mt-0.5 break-words text-xs leading-relaxed text-gray-700">{t.pesan}</p>
          </div>
          <button
            type="button"
            onClick={() => tutup(t.id)}
            aria-label="Tutup"
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
