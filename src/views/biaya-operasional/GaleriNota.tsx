'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { adalahPdf } from '@/shared/lib/biaya-aturan';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil } from '@/views/laporan-keuangan/util';

/** Foto / PDF nota & bukti bayar satu biaya. Klik foto untuk memperbesar; PDF diunduh. */
export default function GaleriNota({ id, versi = 0, onMuat }: { id: string; versi?: number; onMuat?: (jumlahNota: number) => void }) {
  const [foto, setFoto] = useState<{ id: string; jenis: 'nota' | 'bayar'; data: string }[] | null>(null);
  const [galat, setGalat] = useState('');
  const [besar, setBesar] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    ambil<NonNullable<typeof foto>>(`/api/biaya-operasional/${id}/lampiran`).then((h) => {
      if (batal) return;
      if (h.ok) {
        setFoto(h.data);
        onMuat?.(h.data.filter((f) => f.jenis === 'nota').length);
      }
      else {
        setFoto([]);
        setGalat(h.pesan);
      }
    });
    return () => {
      batal = true;
    };
  }, [id, versi, onMuat]);

  if (!foto) return <MemuatProgres teks="Memuat foto…" />;
  if (galat) return <p role="alert" className="text-xs text-red-600">{galat}</p>;
  if (!foto.length) return <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Belum ada foto nota / invoice.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {foto.map((f, i) => (
        <li key={f.id} className={besar === f.id ? 'w-full' : ''}>
          {adalahPdf(f.data) ? (
            // diunduh, tidak dibuka di dalam halaman aplikasi
            <a href={f.data} download={`${f.jenis === 'bayar' ? 'bukti-bayar' : 'nota'}-${i + 1}.pdf`} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-700 hover:bg-gray-100">
              <FileText className="h-7 w-7" aria-hidden="true" /> Unduh PDF
            </a>
          ) : (
          <button type="button" onClick={() => setBesar(besar === f.id ? null : f.id)} aria-label={`${besar === f.id ? 'Perkecil' : 'Perbesar'} foto ${i + 1}`} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.data} alt={f.jenis === 'bayar' ? 'Bukti pembayaran reimburse' : `Nota ${i + 1}`} className={besar === f.id ? 'max-h-[65vh] w-full rounded-lg border border-gray-200 object-contain' : 'h-24 w-24 rounded-lg border border-gray-200 object-cover'} />
          </button>
          )}
          <span className="text-[10px] font-semibold text-gray-500">{f.jenis === 'bayar' ? 'Bukti bayar' : 'Nota'}</span>
        </li>
      ))}
    </ul>
  );
}
