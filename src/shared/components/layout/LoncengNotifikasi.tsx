'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, AlertOctagon, Info, RefreshCw, CheckCheck } from 'lucide-react';
import { useDivision } from '@/shared/context/DivisionContext';

// ============================================================
// Lonceng notifikasi header: ambil /api/notifikasi tiap 2 menit & saat dibuka.
// Titik merah = ada notifikasi yang id-nya belum pernah dilihat (disimpan di localStorage).
// ============================================================

type Notif = { id: string; tipe: 'warning' | 'error' | 'info'; judul: string; pesan: string; href: string; waktu: string | null };

const KUNCI = 'notif-dilihat';
const bacaDilihat = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KUNCI) || '[]');
  } catch {
    return [];
  }
};

const IKON = {
  error: <AlertOctagon className="w-4 h-4 text-red-600" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  info: <Info className="w-4 h-4 text-blue-600" />,
};

export default function LoncengNotifikasi() {
  const { division } = useDivision();
  const [buka, setBuka] = useState(false);
  const [daftar, setDaftar] = useState<Notif[]>([]);
  const [dilihat, setDilihat] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [gagal, setGagal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/notifikasi?divisi=${division}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error();
      setDaftar(json.data);
      setGagal(false);
    } catch {
      setGagal(true);
    } finally {
      setMemuat(false);
    }
  }, [division]);

  useEffect(() => {
    setDilihat(bacaDilihat());
    muat();
    const t = setInterval(muat, 120_000);
    return () => clearInterval(t);
  }, [muat]);

  // Tutup saat klik di luar / Esc
  useEffect(() => {
    if (!buka) return;
    const tutup = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setBuka(false);
    document.addEventListener('mousedown', tutup);
    document.addEventListener('touchstart', tutup);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', tutup);
      document.removeEventListener('touchstart', tutup);
      document.removeEventListener('keydown', esc);
    };
  }, [buka]);

  const belumDilihat = daftar.filter((n) => !dilihat.includes(n.id)).length;

  const tandaiDilihat = () => {
    const ids = daftar.map((n) => n.id);
    setDilihat(ids);
    try {
      localStorage.setItem(KUNCI, JSON.stringify(ids));
    } catch {
      /* penyimpanan diblokir: penanda hanya berlaku di sesi ini */
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setBuka((v) => !v);
          if (!buka) muat();
        }}
        aria-label={`Notifikasi${belumDilihat ? ` (${belumDilihat} baru)` : ''}`}
        aria-haspopup="menu"
        aria-expanded={buka}
        className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition"
      >
        <Bell className="w-4 h-4" />
        {belumDilihat > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold leading-4 text-center">
            {belumDilihat > 9 ? '9+' : belumDilihat}
          </span>
        )}
      </button>

      {buka && (
        <div
          role="menu"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-80 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-900">Notifikasi</span>
            <div className="flex items-center gap-1">
              {belumDilihat > 0 && (
                <button type="button" onClick={tandaiDilihat} title="Tandai semua dilihat" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={muat} title="Muat ulang notifikasi" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                <RefreshCw className={`w-4 h-4 ${memuat ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {gagal && daftar.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-red-600">Gagal memuat notifikasi. Coba muat ulang.</p>
            ) : daftar.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-500">{memuat ? 'Memuat...' : 'Tidak ada notifikasi. Semua aman.'}</p>
            ) : (
              daftar.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  role="menuitem"
                  onClick={() => {
                    setBuka(false);
                    tandaiDilihat();
                  }}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 ${dilihat.includes(n.id) ? '' : 'bg-blue-50/40'}`}
                >
                  <span className="mt-0.5 shrink-0">{IKON[n.tipe]}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-gray-900">{n.judul}</span>
                    {n.pesan && <span className="block text-[11px] text-gray-500 line-clamp-2">{n.pesan}</span>}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
