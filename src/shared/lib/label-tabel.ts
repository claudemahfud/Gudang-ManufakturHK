'use client';

import { useEffect } from 'react';

/**
 * Mode kartu tabel di HP: tiap <td> diberi data-label dari judul kolomnya (<th>),
 * lalu CSS (globals.css, layar < 768px) menyusun tiap baris sebagai kartu berlabel.
 * Berlaku otomatis untuk semua tabel di area dashboard, termasuk yang dimuat kemudian.
 * Tabel yang tidak ingin diubah cukup dibungkus elemen ber-atribut data-tanpa-kartu.
 */
function labeli(akar: ParentNode) {
  akar.querySelectorAll<HTMLTableElement>('table').forEach((tabel) => {
    if (tabel.closest('[data-tanpa-kartu]')) return;
    const kepala = tabel.tHead?.rows[tabel.tHead.rows.length - 1];
    if (!kepala) return;
    // Judul per indeks kolom (memperhitungkan colspan)
    const judul: string[] = [];
    for (const th of Array.from(kepala.cells)) {
      const teks = (th.textContent || '').replace(/\s+/g, ' ').trim();
      for (let i = 0; i < (th.colSpan || 1); i++) judul.push(teks);
    }
    tabel.classList.add('tabel-kartu');
    for (const tb of Array.from(tabel.tBodies).concat(tabel.tFoot ? [tabel.tFoot as unknown as HTMLTableSectionElement] : [])) {
      for (const tr of Array.from(tb.rows)) {
        let kol = 0;
        for (const td of Array.from(tr.cells)) {
          const label = td.colSpan > 1 && tr.cells.length === 1 ? '' : judul[kol] || '';
          if (td.dataset.label !== label) td.dataset.label = label;
          const aksi = /^aksi\b/i.test(label);
          if (aksi && td.dataset.aksi !== '1') td.dataset.aksi = '1';
          kol += td.colSpan || 1;
        }
      }
    }
  });
}

export function useLabelTabelHp() {
  useEffect(() => {
    const akar = document.querySelector('main') ?? document.body;
    let antre = 0;
    const jalankan = () => {
      antre = 0;
      labeli(akar);
    };
    jalankan();
    // Tabel dirender ulang saat data dimuat: beri label lagi (hanya pantau perubahan isi, bukan atribut)
    const pengamat = new MutationObserver(() => {
      if (!antre) antre = requestAnimationFrame(jalankan);
    });
    pengamat.observe(akar, { childList: true, subtree: true });
    return () => {
      pengamat.disconnect();
      if (antre) cancelAnimationFrame(antre);
    };
  }, []);
}
