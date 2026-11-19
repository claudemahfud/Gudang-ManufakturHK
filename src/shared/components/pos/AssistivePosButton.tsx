'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import { ShoppingBag, Sparkles } from 'lucide-react';

// ============================================================
// COMPONENT: AssistivePosButton
// Floating Button seperti iOS AssistiveTouch:
// - Transparan lembut saat diam/dibiarkan (opacity-40)
// - Tebal & aktif saat di-hover/di-klik (opacity-100)
// - Membuka Fullscreen Menu Point of Sales (POS)
// ============================================================

export default function AssistivePosButton() {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  // Jangan tampilkan floating button jika sudah berada di halaman POS
  if (pathname === ROUTES.POS || pathname?.startsWith('/pos')) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex items-center gap-3 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip Pill (Muncul saat hover) */}
      <div
        className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-xl border border-slate-700/60 backdrop-blur-md transition-all duration-300 pointer-events-none ${
          isHovered
            ? 'opacity-100 translate-x-0 scale-100'
            : 'opacity-0 translate-x-2 scale-95'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span>Buka Kasir POS (58mm)</span>
      </div>

      {/* Assistive Touch Button */}
      <Link
        href={ROUTES.POS}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Point of Sales Kasir Mobile"
        className={`relative group flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-emerald-500/30 ${
          isHovered
            ? 'opacity-100 scale-110 shadow-2xl shadow-emerald-500/25 bg-slate-900 border-2 border-emerald-400/80 text-white'
            : 'opacity-40 scale-95 shadow-lg bg-slate-900/70 backdrop-blur-md border border-white/20 text-slate-200'
        }`}
      >
        {/* Outer concentric decorative ring (AssistiveTouch style) */}
        <span
          className={`absolute inset-1 rounded-full border border-white/20 transition-all duration-300 ${
            isHovered ? 'scale-105 border-emerald-400/40' : 'scale-100'
          }`}
        />

        {/* Center POS Icon */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <ShoppingBag className="w-6 h-6 md:w-7 md:h-7 transition-transform group-hover:scale-110" />
          <span className="text-[9px] font-bold tracking-tighter uppercase mt-0.5 opacity-90">
            POS
          </span>
        </div>

        {/* Pulse Beacon Indicator */}
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
        </span>
      </Link>
    </div>
  );
}
