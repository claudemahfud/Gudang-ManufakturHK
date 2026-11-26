'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, SearchX } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, kirimJson, kontrol } from '@/views/laporan-keuangan/util';

// Finance mencocokkan penerimaan Bank/QRIS yang dicatat sales dengan mutasi rekening.
interface Item {
  referensi: string;
  akun: string;
  akunNama: string;
  sales: string;
  namaSales: string;
  tanggal: string;
  jumlah: number;
  umurHari: number;
  status: 'belum' | 'cocok' | 'dipindahkan';
  catatan: string | null;
  diverifikasiOleh: string | null;
}

const LABEL = { belum: 'Belum dicek', cocok: 'Cocok', dipindahkan: 'Tidak ditemukan' } as const;
const KELAS = { belum: 'bg-amber-50 text-amber-700', cocok: 'bg-emerald-50 text-emerald-700', dipindahkan: 'bg-red-50 text-red-700' } as const;

export default function VerifikasiTransfer({
  divisi,
  notify,
  onBerubah,
}: {
  divisi: string;
  notify: (message: string, type: 'success' | 'error') => void;
  onBerubah: () => void;
}) {
  const [data, setData] = useState<Item[] | null>(null);
  const [semua, setSemua] = useState(false);
  const [tolak, setTolak] = useState<Item | null>(null);
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const h = await ambil<Item[]>(`/api/verifikasi-transfer?divisi=${divisi}&status=${semua ? 'semua' : 'belum'}`);
    if (h.ok) setData(h.data);
    else {
      setData([]);
      setGalat(h.pesan);
    }
  }, [divisi, semua]);

  useEffect(() => {
    const t = setTimeout(muat, 0);
    return () => clearTimeout(t);
  }, [muat]);

  const kirim = async (it: Item, hasil: 'cocok' | 'tidak_ditemukan', catatan?: string) => {
    setProses(true);
    setGalat(null);
    const h = await kirimJson('/api/verifikasi-transfer', { divisi, referensi: it.referensi, akun: it.akun, sales: it.sales, hasil, catatan });
    setProses(false);
    if (!h.ok) {
      setGalat(h.pesan);
      return;
    }
    notify(hasil === 'cocok' ? `${it.referensi} cocok` : `${it.referensi} dipindahkan ke kas di tangan ${it.namaSales}`, 'success');
    setTolak(null);
    setAlasan('');
    muat();
    onBerubah();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Verifikasi Transfer</h2>
          <p className="text-xs text-gray-500">Transfer / QRIS yang dicatat sales. Cocokkan dengan mutasi rekening.</p>
        </div>
        <button
          type="button"
          aria-pressed={semua}
          onClick={() => setSemua((v) => !v)}
          className={`h-9 rounded-lg border px-3 text-xs font-semibold ${semua ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          {semua ? 'Menampilkan semua' : 'Tampilkan riwayat'}
        </button>
      </div>
      {galat && <p role="alert" className="px-4 pt-3 text-sm text-red-600">{galat}</p>}
      <div className="overflow-x-auto">
        <table className="tabel-kartu w-full min-w-[640px] text-sm">
          <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-white">
            <tr>
              <th className="p-3 text-left">Dokumen</th>
              <th className="p-3 text-left">Sales</th>
              <th className="p-3 text-left">Masuk ke</th>
              <th className="p-3 text-right">Jumlah</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data === null ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400"><MemuatProgres teks="Memuat transfer…" /></td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">{semua ? 'Belum ada transfer dari sales.' : 'Semua transfer sales sudah dicek.'}</td>
              </tr>
            ) : (
              data.map((it) => (
                <tr key={`${it.referensi}-${it.akun}-${it.sales}`} className="hover:bg-gray-50/70">
                  <td data-label="Dokumen" className="p-3 font-semibold text-gray-900">
                    {it.referensi}
                    <span className="block text-[11px] font-normal text-gray-400">
                      {formatTanggal(it.tanggal)}
                      {it.status === 'belum' && it.umurHari >= 1 && <span className="ml-1 font-semibold text-red-600">· {it.umurHari} hari</span>}
                    </span>
                  </td>
                  <td data-label="Sales" className="p-3 text-gray-700">{it.namaSales}</td>
                  <td data-label="Masuk ke" className="p-3 text-gray-700">{it.akunNama}</td>
                  <td data-label="Jumlah" className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-gray-900">{formatRupiah(it.jumlah)}</td>
                  <td data-label="Status" className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${KELAS[it.status]}`}>{LABEL[it.status]}</span>
                    {it.catatan && <span className="mt-1 block text-[11px] text-gray-500">{it.catatan}</span>}
                    {it.diverifikasiOleh && <span className="block text-[11px] text-gray-400">oleh {it.diverifikasiOleh}</span>}
                  </td>
                  <td data-aksi className="p-3">
                    {it.status === 'belum' && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <button type="button" disabled={proses} onClick={() => kirim(it, 'cocok')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Cocok
                        </button>
                        <button type="button" disabled={proses} onClick={() => { setTolak(it); setAlasan(''); setGalat(null); }} className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                          <SearchX className="h-3.5 w-3.5" aria-hidden="true" /> Tidak ditemukan
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {tolak && (
        <div role="dialog" aria-modal="true" aria-label="Transfer tidak ditemukan" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">Transfer tidak ditemukan</h3>
            <p className="mt-1 text-sm text-gray-600">
              {tolak.referensi} · {formatRupiah(tolak.jumlah)} · {tolak.namaSales}. Nilai ini akan menjadi kas di tangan {tolak.namaSales} dan wajib disetor.
            </p>
            <label className="mt-3 block text-xs font-semibold text-gray-700">
              Catatan pengecekan *
              <textarea rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. tidak ada di mutasi BCA 25/11" className={`${kontrol} mt-1 h-auto w-full py-2`} />
            </label>
            {galat && <p role="alert" className="mt-2 text-sm text-red-600">{galat}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTolak(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="button" disabled={proses || !alasan.trim()} onClick={() => kirim(tolak, 'tidak_ditemukan', alasan)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
                {proses ? 'Menyimpan...' : 'Pindahkan ke kas sales'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
