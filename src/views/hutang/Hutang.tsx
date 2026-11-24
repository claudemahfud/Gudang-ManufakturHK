'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, RefreshCw, Truck } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import { AksiHeader, GrupIkon, TombolIkon } from '@/shared/components/ui/AksiHeader';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, kirimJson, kontrol, KotakTerlarang, tglWib, Toast } from '@/views/laporan-keuangan/util';

// ============================================================
// PAGE: Hutang Suplier
// Route: /hutang
// ============================================================

interface Pembayaran {
  id: string;
  tanggal: string;
  jumlah: number;
  metode: string;
  catatan: string | null;
  createdBy: string | null;
}
interface ItemHutang {
  id: string;
  supplier: string;
  noFaktur: string;
  tanggal: string;
  jatuhTempo: string | null;
  totalHutang: number;
  sisaHutang: number;
  status: 'belum_lunas' | 'lunas';
  divisi: string;
  catatan: string | null;
  pembayaran: Pembayaran[];
}
interface Ringkasan {
  totalSisa: number;
  jumlahBelumLunas: number;
  lewatTempo: number;
}

type Status = 'belum_lunas' | 'lunas' | 'semua';
type Notify = (message: string, type: 'success' | 'error') => void;

const lewat = (h: ItemHutang) => h.status !== 'lunas' && !!h.jatuhTempo && h.jatuhTempo.slice(0, 10) < tglWib();

export default function Hutang() {
  const { division } = useDivision();
  const [status, setStatus] = useState<Status>('belum_lunas');
  const [data, setData] = useState<ItemHutang[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [dimuat, setDimuat] = useState('');
  const [terlarang, setTerlarang] = useState(false);
  const [versi, setVersi] = useState(0);
  const [buka, setBuka] = useState<string | null>(null);
  const [bayar, setBayar] = useState<ItemHutang | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const url = `/api/hutang?divisi=${division}&status=${status}`;
  const kunci = `${url}#${versi}`;
  const memuat = dimuat !== kunci;

  useEffect(() => {
    let batal = false;
    ambil<ItemHutang[]>(url).then((h) => {
      if (batal) return;
      if (h.ok) {
        setData(h.data);
        setRingkasan((h.json.ringkasan as Ringkasan) ?? null);
      } else {
        setTerlarang(h.terlarang);
        notify(h.pesan, 'error');
      }
      setDimuat(kunci);
    });
    return () => {
      batal = true;
    };
  }, [url, kunci, notify]);

  if (terlarang) return <KotakTerlarang />;

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hutang Suplier</h1>
            <p className="text-sm text-gray-500">Tagihan pembelian ke suplier yang belum dibayar dan riwayat pembayarannya.</p>
          </div>
        </div>
        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={RefreshCw} label="Muat ulang" onClick={() => setVersi((v) => v + 1)} putar={memuat} />
          </GrupIkon>
        </AksiHeader>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { judul: 'Total Sisa Hutang', nilai: formatRupiah(ringkasan?.totalSisa ?? 0), bahaya: false },
          { judul: 'Faktur Belum Lunas', nilai: String(ringkasan?.jumlahBelumLunas ?? 0), bahaya: false },
          { judul: 'Lewat Jatuh Tempo', nilai: String(ringkasan?.lewatTempo ?? 0), bahaya: (ringkasan?.lewatTempo ?? 0) > 0 },
        ].map((k) => (
          <div key={k.judul} className={`rounded-2xl border bg-white p-4 ${k.bahaya ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{k.judul}</div>
            <div className={`mt-1 text-lg font-bold tabular-nums ${k.bahaya ? 'text-red-700' : 'text-gray-900'}`}>{k.nilai}</div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4" role="group" aria-label="Filter status">
          {(
            [
              ['belum_lunas', 'Belum Lunas'],
              ['lunas', 'Lunas'],
              ['semua', 'Semua'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={status === k}
              onClick={() => setStatus(k)}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                status === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-white">
              <tr>
                <th className="p-3 text-left">Suplier</th>
                <th className="p-3 text-left">No Faktur</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Jatuh Tempo</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Sisa</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {memuat && data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-400">
                    <MemuatProgres teks="Memuat hutang…" />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">
                    {status === 'belum_lunas' ? 'Tidak ada hutang terbuka.' : 'Tidak ada data hutang.'}
                  </td>
                </tr>
              ) : (
                data.map((h) => {
                  const telat = lewat(h);
                  const terbuka = buka === h.id;
                  return (
                    <Fragment key={h.id}>
                      <tr className={`align-top ${telat ? 'bg-red-50/40' : 'hover:bg-gray-50/70'}`}>
                        <td className="p-3 font-semibold text-gray-900">
                          {h.supplier}
                          {h.catatan && <span className="block text-[11px] font-normal text-gray-400">{h.catatan}</span>}
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-800">{h.noFaktur}</td>
                        <td className="whitespace-nowrap p-3 text-gray-700">{formatTanggal(h.tanggal)}</td>
                        <td className={`whitespace-nowrap p-3 ${telat ? 'font-bold text-red-700' : 'text-gray-700'}`}>
                          {h.jatuhTempo ? formatTanggal(h.jatuhTempo) : '-'}
                          {telat && <span className="block text-[10px] font-bold">Lewat tempo</span>}
                        </td>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums text-gray-700">{formatRupiah(h.totalHutang)}</td>
                        <td className={`whitespace-nowrap p-3 text-right font-bold tabular-nums ${h.sisaHutang > 0 ? 'text-gray-900' : 'text-emerald-700'}`}>
                          {formatRupiah(h.sisaHutang)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              h.status === 'lunas' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {h.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1.5">
                            {h.status !== 'lunas' && h.sisaHutang > 0 && (
                              <button
                                type="button"
                                onClick={() => setBayar(h)}
                                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                Bayar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setBuka(terbuka ? null : h.id)}
                              aria-expanded={terbuka}
                              aria-label={`Riwayat pembayaran ${h.noFaktur}`}
                              title="Riwayat pembayaran"
                              className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              {h.pembayaran.length}
                              <ChevronDown className={`h-4 w-4 transition-transform ${terbuka ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {terbuka && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50 p-3">
                            {h.pembayaran.length === 0 ? (
                              <p className="text-xs text-gray-500">Belum ada pembayaran.</p>
                            ) : (
                              <ul className="space-y-1.5 text-xs">
                                {h.pembayaran.map((p) => (
                                  <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                    <span className="text-gray-500">{formatTanggal(p.tanggal)}</span>
                                    <span className="font-bold tabular-nums text-gray-900">{formatRupiah(p.jumlah)}</span>
                                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">{p.metode}</span>
                                    {p.catatan && <span className="text-gray-600">{p.catatan}</span>}
                                    {p.createdBy && <span className="text-gray-400">oleh {p.createdBy}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {bayar && (
        <ModalBayar
          hutang={bayar}
          notify={notify}
          onClose={() => setBayar(null)}
          onSaved={() => {
            setBayar(null);
            setVersi((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

function ModalBayar({ hutang, onClose, onSaved, notify }: { hutang: ItemHutang; onClose: () => void; onSaved: () => void; notify: Notify }) {
  const sisa = hutang.sisaHutang;
  const [jumlah, setJumlah] = useState(String(sisa));
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('transfer');
  const [tanggal, setTanggal] = useState(tglWib());
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const n = Number(jumlah) || 0;
  const salah = !(n > 0) ? 'Isi jumlah pembayaran' : n > sisa ? `Maksimal ${formatRupiah(sisa)}` : '';

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salah || submitting) return;
    setSubmitting(true);
    const h = await kirimJson(`/api/hutang/${encodeURIComponent(hutang.id)}/bayar`, { jumlah: n, metode, tanggal, catatan });
    setSubmitting(false);
    if (!h.ok) return notify(h.pesan, 'error');
    notify(n >= sisa ? `Hutang ${hutang.noFaktur} lunas` : `Pembayaran ${formatRupiah(n)} tercatat. Sisa ${formatRupiah(sisa - n)}`, 'success');
    onSaved();
  };

  const lbl = 'block text-[11px] font-bold uppercase tracking-wider text-gray-600';
  return (
    <Bingkai judul="Bayar Hutang Suplier" sub={`${hutang.noFaktur} · ${hutang.supplier}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs">
            <div>
              <dt className="text-gray-500">Total hutang</dt>
              <dd className="font-semibold tabular-nums text-gray-900">{formatRupiah(hutang.totalHutang)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Sisa hutang</dt>
              <dd className="font-bold tabular-nums text-red-700">{formatRupiah(sisa)}</dd>
            </div>
          </dl>
          <label className={lbl}>
            Jumlah dibayar *
            <input type="number" min="1" max={sisa} step="any" inputMode="decimal" required value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={`${kontrol} mt-1 w-full font-semibold`} />
            {salah && <span className="mt-1 block text-[11px] normal-case tracking-normal text-red-600">{salah}</span>}
          </label>
          <fieldset>
            <legend className={lbl}>Metode</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(['tunai', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metode === m}
                  onClick={() => setMetode(m)}
                  className={`h-10 rounded-xl border text-sm font-semibold capitalize ${metode === m ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </fieldset>
          <label className={lbl}>
            Tanggal bayar *
            <input type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`${kontrol} mt-1 w-full`} />
          </label>
          <label className={lbl}>
            Catatan
            <textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-emerald-500" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-8">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          <button type="submit" disabled={!!salah || submitting} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}
