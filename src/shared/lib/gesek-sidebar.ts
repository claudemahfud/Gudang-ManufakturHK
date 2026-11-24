'use client';

import { useEffect, useRef } from 'react';

// ============================================================
// Gestur sentuh sidebar (HP & tablet, iOS/Android):
// - geser ke KANAN di mana saja di layar (bukan hanya tepi) = buka sidebar
// - geser ke KIRI = tutup sidebar (ketuk area kosong di luar sidebar sudah menutup lewat overlay)
// Hanya untuk layar sentuh & lebar < 1024px (mode sidebar laci). Desktop tidak terpengaruh.
// Diabaikan bila gestur dimulai di: input, area yang bisa digulir ke samping (tabel, tab, grafik),
// popup/dialog terbuka, area bertanda data-tanpa-gesek, atau tepi kiri 24px (gestur "kembali" iOS).
// ============================================================

const JARAK_MIN = 70; // px horizontal minimum
const JARAK_CEPAT = 45; // cukup bila cepat
const WAKTU_CEPAT_MS = 350;
const TEPI_PX = 24;
const MODE_LACI = '(max-width: 1023.98px)';

function dalamAreaGulirSamping(el: Element | null): boolean {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    if (n instanceof HTMLElement) {
      if (n.dataset.tanpaGesek !== undefined) return true;
      const ox = getComputedStyle(n).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
  }
  return false;
}

const elemenIsian = 'input, textarea, select, [contenteditable="true"], [role="slider"], canvas, .recharts-wrapper';

export function useGesekSidebar(terbuka: boolean, setTerbuka: (v: boolean) => void) {
  const terbukaRef = useRef(terbuka);
  const setRef = useRef(setTerbuka);
  useEffect(() => {
    terbukaRef.current = terbuka;
    setRef.current = setTerbuka;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window || navigator.maxTouchPoints > 0)) return;
    let awal: { x: number; y: number; t: number; boleh: boolean } | null = null;

    const mulai = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !window.matchMedia(MODE_LACI).matches) {
        awal = null;
        return;
      }
      const t = e.touches[0];
      const target = e.target as Element | null;
      let boleh = true;
      if (!terbukaRef.current) {
        // Buka: hindari tepi kiri, input, area gulir samping, dan popup yang sedang terbuka
        if (t.clientX < TEPI_PX) boleh = false;
        else if (target?.closest(elemenIsian)) boleh = false;
        else if (dalamAreaGulirSamping(target)) boleh = false;
        else if (document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0')) boleh = false;
      }
      awal = { x: t.clientX, y: t.clientY, t: Date.now(), boleh };
    };

    const selesai = (e: TouchEvent) => {
      const a = awal;
      awal = null;
      if (!a || !a.boleh) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - a.x;
      const dy = t.clientY - a.y;
      const cepat = Date.now() - a.t <= WAKTU_CEPAT_MS;
      const cukup = Math.abs(dx) >= JARAK_MIN || (cepat && Math.abs(dx) >= JARAK_CEPAT);
      // Dominan horizontal (bukan gulir vertikal)
      if (!cukup || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      if (dx > 0 && !terbukaRef.current) setRef.current(true);
      else if (dx < 0 && terbukaRef.current) setRef.current(false);
    };

    const batal = () => {
      awal = null;
    };

    document.addEventListener('touchstart', mulai, { passive: true });
    document.addEventListener('touchend', selesai, { passive: true });
    document.addEventListener('touchcancel', batal, { passive: true });
    return () => {
      document.removeEventListener('touchstart', mulai);
      document.removeEventListener('touchend', selesai);
      document.removeEventListener('touchcancel', batal);
    };
  }, []);
}
