'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Bingkai modal standar: judul, sub-judul, tombol tutup, Esc untuk menutup. */
export default function Bingkai({
  judul,
  sub,
  onClose,
  children,
  lebar = 'max-w-xl',
}: {
  judul: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
  lebar?: string;
}) {
  const kotak = useRef<HTMLDivElement>(null);

  // fokus masuk ke dialog saat dibuka dan kembali ke tombol pemicu saat ditutup
  useEffect(() => {
    const semula = document.activeElement as HTMLElement | null;
    const el = kotak.current;
    if (el && !el.contains(document.activeElement)) el.focus();
    // Tab berputar di dalam dialog
    const tab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const fokus = [...el.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.matches(':disabled'));
      if (!fokus.length) return;
      const awal = fokus[0];
      const akhir = fokus[fokus.length - 1];
      const kini = document.activeElement;
      if (e.shiftKey && (kini === awal || kini === el)) {
        e.preventDefault();
        akhir.focus();
      } else if (!e.shiftKey && kini === akhir) {
        e.preventDefault();
        awal.focus();
      }
    };
    el?.addEventListener('keydown', tab);
    return () => {
      el?.removeEventListener('keydown', tab);
      semula?.focus();
    };
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={kotak}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        className={`bg-white rounded-2xl shadow-2xl w-full ${lebar} max-h-[94vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="px-5 sm:px-8 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{judul}</h2>
            <p className="text-xs text-gray-500">{sub}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
