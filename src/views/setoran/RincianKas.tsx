'use client';

import { useEffect, useState } from 'react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil } from '@/views/laporan-keuangan/util';

// Asal-usul kas di tangan sales: penjualan tunai menambah, batal & setoran mengurangi.
interface Mutasi {
  tanggal: string;
  noJurnal: string;
  sumber: string;
  referensi: string | null;
  keterangan: string;
  jumlah: number;
}

export default function RincianKas({ divisi, sales, nama, onClose }: { divisi: string; sales: string; nama: string; onClose: () => void }) {
  const [data, setData] = useState<Mutasi[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambil<Mutasi[]>(`/api/setoran/rincian?divisi=${divisi}&sales=${encodeURIComponent(sales)}`).then((h) => {
      if (batal) return;
      if (h.ok) setData(h.data);
      else {
        setData([]);
        setGalat(h.pesan);
      }
    });
    return () => {
      batal = true;
    };
  }, [divisi, sales]);

  const total = (data ?? []).reduce((s, m) => s + m.jumlah, 0);

  return (
    <Bingkai judul="Rincian Kas di Tangan" sub={nama} onClose={onClose}>
      {data === null ? (
        <div className="py-8 text-center text-gray-400">
          <MemuatProgres teks="Memuat rincian…" />
        </div>
      ) : galat ? (
        <p role="alert" className="py-6 text-center text-sm text-red-600">{galat}</p>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Belum ada transaksi tunai.</p>
      ) : (
        <>
          <ul className="max-h-[55vh] divide-y divide-gray-100 overflow-y-auto">
            {data.map((m) => (
              <li key={m.noJurnal} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {m.sumber}
                    {m.referensi && <span className="ml-1.5 font-mono text-[11px] text-gray-500">{m.referensi}</span>}
                  </p>
                  <p className="text-[11px] text-gray-500">{formatTanggal(m.tanggal)} · {m.keterangan}</p>
                </div>
                <span className={`shrink-0 text-sm font-bold tabular-nums ${m.jumlah >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {m.jumlah >= 0 ? '+' : '-'} {formatRupiah(Math.abs(m.jumlah))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm font-bold text-gray-900">
            <span>Saldo (200 mutasi terakhir)</span>
            <span className="tabular-nums">{formatRupiah(total)}</span>
          </div>
        </>
      )}
    </Bingkai>
  );
}
