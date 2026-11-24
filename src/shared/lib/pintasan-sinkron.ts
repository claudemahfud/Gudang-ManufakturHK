'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Label tombol sinkron/muat ulang yang dipakai di berbagai halaman
const POLA_LABEL = /refresh|segarkan|muat ulang|sinkron|perbarui data/i;

function terlihat(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** Semua tombol sinkron yang tampil di halaman: ikon refresh-cw atau label/aria-label/title bertema muat ulang. */
export function cariTombolSinkron(): HTMLButtonElement[] {
  // Bila ada pop-up terbuka, jangan memicu tombol di balik pop-up
  if (document.querySelector('[aria-modal="true"], [role="dialog"]')) return [];
  const tombol = Array.from(document.querySelectorAll<HTMLButtonElement>('main button:not(:disabled)'));
  const cocok = tombol.filter((b) => {
    if (!terlihat(b)) return false;
    if (b.querySelector('svg.lucide-refresh-cw, svg.lucide-rotate-cw, svg.lucide-refresh-ccw')) return true;
    const teks = `${b.getAttribute('aria-label') ?? ''} ${b.title ?? ''} ${b.textContent ?? ''}`;
    return POLA_LABEL.test(teks);
  });
  return cocok;
}

/**
 * Alt+R = tekan semua tombol sinkron di halaman aktif (tiap bagian halaman ikut dimuat ulang).
 * Halaman tanpa tombol sinkron
 * memuat ulang data server-nya (router.refresh) tanpa memuat ulang browser.
 */
export function usePintasanSinkron() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== 'KeyR' || e.repeat) return;
      e.preventDefault();
      const daftar = cariTombolSinkron();
      if (daftar.length) {
        daftar.forEach((b) => b.click());
      } else if (!document.querySelector('[aria-modal="true"], [role="dialog"]')) {
        router.refresh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
}
