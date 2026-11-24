'use client';

import { useRef, useState } from 'react';
import { ChevronsRight, Loader2 } from 'lucide-react';

/**
 * Bar geser-untuk-konfirmasi: tombol bulat harus digeser penuh ke kanan untuk mengeksekusi.
 * Lepas sebelum ujung = kembali ke awal. Keyboard: fokus lalu Enter / panah kanan.
 */
export default function GeserKonfirmasi({
  label,
  onKonfirmasi,
  memproses = false,
}: {
  label: string;
  onKonfirmasi: () => Promise<unknown> | unknown;
  memproses?: boolean;
}) {
  const jalur = useRef<HTMLDivElement>(null);
  const awal = useRef<{ x: number; pos: number } | null>(null);
  const [pos, setPos] = useState(0);
  const [tarik, setTarik] = useState(false);
  const UKURAN = 52;

  const maks = () => Math.max(0, (jalur.current?.clientWidth ?? 0) - UKURAN - 8);

  const jalankan = async () => {
    setPos(maks());
    try {
      await onKonfirmasi();
    } finally {
      // Bila modal masih terbuka (mis. validasi gagal), siap digeser lagi
      setPos(0);
    }
  };

  const mulai = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (memproses) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    awal.current = { x: e.clientX, pos };
    setTarik(true);
  };
  const gerak = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!awal.current) return;
    setPos(Math.min(maks(), Math.max(0, awal.current.pos + e.clientX - awal.current.x)));
  };
  const lepas = () => {
    if (!awal.current) return;
    awal.current = null;
    setTarik(false);
    if (pos >= maks() - 4) void jalankan();
    else setPos(0);
  };

  const persen = maks() > 0 ? pos / maks() : 0;
  return (
    <div
      ref={jalur}
      className="relative w-full h-[60px] rounded-full bg-slate-800 border border-emerald-500/40 overflow-hidden select-none touch-none"
    >
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400"
        style={{ width: pos + UKURAN + 4, transition: tarik ? 'none' : 'width 250ms cubic-bezier(0.23,1,0.32,1)' }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center pl-12 pr-4 text-sm font-bold text-white pointer-events-none"
        style={{ opacity: memproses ? 1 : 1 - persen * 0.9 }}
      >
        {memproses ? 'Memproses pembayaran...' : label}
      </span>
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(persen * 100)}
        disabled={memproses}
        onPointerDown={mulai}
        onPointerMove={gerak}
        onPointerUp={lepas}
        onPointerCancel={lepas}
        onKeyDown={(e) => {
          if (memproses) return;
          if (e.key === 'Enter' || e.key === 'ArrowRight') {
            e.preventDefault();
            void jalankan();
          }
        }}
        className="absolute top-1 left-1 grid place-items-center rounded-full bg-white text-emerald-700 shadow-lg cursor-grab active:cursor-grabbing focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
        style={{
          width: UKURAN,
          height: UKURAN,
          translate: `${pos}px 0`,
          transition: tarik ? 'none' : 'translate 250ms cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        {memproses ? <Loader2 className="w-6 h-6 animate-spin" /> : <ChevronsRight className="w-6 h-6" />}
      </button>
    </div>
  );
}
