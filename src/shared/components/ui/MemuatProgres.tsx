'use client';

import { useEffect, useState } from 'react';

/**
 * Indikator memuat: bar + persentase.
 * Server tidak mengirim progres nyata, jadi persen adalah estimasi yang naik cepat
 * lalu melambat mendekati 95% sampai data datang (komponen dilepas saat selesai).
 * Hanya memakai <span> agar sah di dalam <td>, <p>, <li>, maupun <span>.
 */
export default function MemuatProgres({ teks = 'Memuat...', gelap = false }: { teks?: string; gelap?: boolean }) {
  const [persen, setPersen] = useState(8);

  useEffect(() => {
    const id = setInterval(() => {
      setPersen((p) => (p >= 95 ? p : Math.min(95, p + Math.max(0.4, (95 - p) * 0.09))));
    }, 120);
    return () => clearInterval(id);
  }, []);

  const nilai = Math.round(persen);
  return (
    <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nilai} aria-label={teks} className="inline-flex flex-col items-stretch gap-1.5 w-56 max-w-full align-middle">
      <span className={`flex items-center justify-between text-xs font-medium ${gelap ? 'text-slate-300' : 'text-gray-500'}`}>
        <span>{teks}</span>
        <span className={`tabular-nums font-bold ${gelap ? 'text-emerald-300' : 'text-emerald-700'}`}>{nilai}%</span>
      </span>
      <span className={`block h-1.5 w-full rounded-full overflow-hidden ${gelap ? 'bg-slate-800' : 'bg-gray-100'}`}>
        <span
          className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-150 ease-out"
          style={{ width: `${nilai}%` }}
        />
      </span>
    </span>
  );
}
