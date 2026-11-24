'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import { ShoppingBag, Sparkles } from 'lucide-react';

// ============================================================
// COMPONENT: AssistivePosButton
// Tombol mengambang seperti iOS AssistiveTouch:
// - Desktop: pojok kanan bawah, menebal saat di-hover mouse.
// - HP/tablet: bisa digeser ke mana saja, menempel ke tepi kiri/kanan, posisi diingat.
//   Tinggi layar di browser HP berubah saat bilah alamat mengecil/membesar, jadi posisi
//   tetap dari bawah tidak pernah pas di semua kondisi; biarkan pengguna menaruhnya.
// - Membuka Kasir POS (tab baru).
// ============================================================

const KUNCI = 'assistive-pos-posisi';
const UKURAN = 44; // px, tombol di HP
const TEPI = 10; // jarak dari tepi layar
const ATAS_MIN = 72; // di bawah header

type Posisi = { sisi: 'kiri' | 'kanan'; y: number }; // y = rasio tinggi layar (0..1)

function bacaPosisi(): Posisi {
  try {
    const p = JSON.parse(localStorage.getItem(KUNCI) || '');
    if ((p?.sisi === 'kiri' || p?.sisi === 'kanan') && typeof p.y === 'number') return p;
  } catch {}
  return { sisi: 'kanan', y: 0.72 };
}

const Q_SENTUH = '(max-width: 767px), (pointer: coarse)';
function langgananSentuh(cb: () => void) {
  const mq = window.matchMedia(Q_SENTUH);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function tinggiLayar() {
  return window.visualViewport?.height ?? window.innerHeight;
}

export default function AssistivePosButton() {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  // Server & hidrasi awal: mode desktop; setelah itu mengikuti media query
  const sentuh = useSyncExternalStore(langgananSentuh, () => window.matchMedia(Q_SENTUH).matches, () => false);
  const [posisi, setPosisi] = useState<Posisi>(() =>
    typeof window === 'undefined' ? { sisi: 'kanan', y: 0.72 } : bacaPosisi()
  );
  const [geser, setGeser] = useState<{ x: number; y: number } | null>(null);
  const [, setUkuranLayar] = useState(0);
  const awal = useRef<{ x: number; y: number; px: number; py: number; pindah: boolean } | null>(null);
  const barusDigeser = useRef(false);

  // Render ulang saat ukuran layar berubah (bilah alamat HP mengecil/membesar, rotasi)
  useEffect(() => {
    const ubah = () => setUkuranLayar(tinggiLayar() + window.innerWidth);
    window.addEventListener('resize', ubah);
    window.visualViewport?.addEventListener('resize', ubah);
    return () => {
      window.removeEventListener('resize', ubah);
      window.visualViewport?.removeEventListener('resize', ubah);
    };
  }, []);

  // Jangan tampilkan floating button jika sudah berada di halaman POS
  if (pathname === ROUTES.POS || pathname?.startsWith('/pos')) {
    return null;
  }

  // ---------- Mode HP: tombol kecil yang bisa digeser ----------
  if (sentuh) {
    const vh = tinggiLayar();
    const vw = window.innerWidth;
    const batasY = (y: number) => Math.min(Math.max(y, ATAS_MIN), vh - UKURAN - TEPI);
    const top = geser ? batasY(geser.y) : batasY(posisi.y * vh - UKURAN / 2);
    const left = geser
      ? Math.min(Math.max(geser.x, TEPI), vw - UKURAN - TEPI)
      : posisi.sisi === 'kiri'
        ? TEPI
        : vw - UKURAN - TEPI;

    const mulai = (e: React.PointerEvent<HTMLAnchorElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      awal.current = { x: e.clientX, y: e.clientY, px: left, py: top, pindah: false };
    };
    const gerak = (e: React.PointerEvent<HTMLAnchorElement>) => {
      const a = awal.current;
      if (!a) return;
      const dx = e.clientX - a.x;
      const dy = e.clientY - a.y;
      if (!a.pindah && Math.hypot(dx, dy) < 6) return;
      a.pindah = true;
      setGeser({ x: a.px + dx, y: a.py + dy });
    };
    const lepas = (e: React.PointerEvent<HTMLAnchorElement>) => {
      const a = awal.current;
      awal.current = null;
      if (!a?.pindah) return;
      barusDigeser.current = true;
      const tengahX = a.px + (e.clientX - a.x) + UKURAN / 2;
      const baru: Posisi = {
        sisi: tengahX < vw / 2 ? 'kiri' : 'kanan',
        y: (batasY(a.py + (e.clientY - a.y)) + UKURAN / 2) / vh,
      };
      setPosisi(baru);
      setGeser(null);
      try {
        localStorage.setItem(KUNCI, JSON.stringify(baru));
      } catch {}
    };

    return (
      <div
        className="assistive-pos fixed z-50 select-none"
        style={{
          top,
          left,
          transition: geser ? 'none' : 'top 250ms cubic-bezier(0.23,1,0.32,1), left 250ms cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        <Link
          href={ROUTES.POS}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buka Kasir POS (geser untuk memindahkan tombol)"
          draggable={false}
          onPointerDown={mulai}
          onPointerMove={gerak}
          onPointerUp={lepas}
          onPointerCancel={() => {
            awal.current = null;
            setGeser(null);
          }}
          onClick={(e) => {
            // Selesai digeser = bukan ketukan; jangan buka POS
            if (barusDigeser.current) {
              e.preventDefault();
              barusDigeser.current = false;
            }
          }}
          className={`relative flex items-center justify-center rounded-full touch-none bg-slate-900/75 backdrop-blur-md border border-white/25 text-white shadow-lg transition-opacity ${
            geser ? 'opacity-100' : 'opacity-60'
          }`}
          style={{ width: UKURAN, height: UKURAN }}
        >
          <ShoppingBag className="w-5 h-5" aria-hidden="true" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        </Link>
      </div>
    );
  }

  // ---------- Mode desktop ----------
  return (
    <div
      className="assistive-pos fixed bottom-8 right-8 z-50 flex items-center gap-3 select-none"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* Tooltip Pill (Muncul saat hover) */}
      <div
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-xl border border-slate-700/60 backdrop-blur-md transition-all duration-300 pointer-events-none ${
          isHovered ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-2 scale-95'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span>Buka Kasir POS (58mm)</span>
      </div>

      <Link
        href={ROUTES.POS}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Point of Sales Kasir Mobile"
        className={`relative group flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-emerald-500/30 ${
          isHovered
            ? 'opacity-100 scale-110 shadow-2xl shadow-emerald-500/25 bg-slate-900 border-2 border-emerald-400/80 text-white'
            : 'opacity-40 scale-95 shadow-lg bg-slate-900/70 backdrop-blur-md border border-white/20 text-slate-200'
        }`}
      >
        <span
          className={`absolute inset-1 rounded-full border border-white/20 transition-all duration-300 ${
            isHovered ? 'scale-105 border-emerald-400/40' : 'scale-100'
          }`}
        />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <ShoppingBag className="w-7 h-7 transition-transform group-hover:scale-110" />
          <span className="text-[9px] font-bold tracking-tighter uppercase mt-0.5 opacity-90">POS</span>
        </div>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
        </span>
      </Link>
    </div>
  );
}
