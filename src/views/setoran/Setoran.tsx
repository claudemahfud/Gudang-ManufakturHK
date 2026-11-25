'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { HandCoins, RefreshCw } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { punyaRole } from '@/shared/lib/auth/roles';
import { useDivision } from '@/shared/context/DivisionContext';
import { AksiHeader, GrupIkon, TombolIkon } from '@/shared/components/ui/AksiHeader';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, kirimJson, kontrol, KotakTerlarang, tglWib, Toast } from '@/views/laporan-keuangan/util';
import { FINANCE, SALES } from './peran';

// ============================================================
// PAGE: Setoran ke Finance
// Route: /setoran
// Sales menyetor uang tunai yang dipegang ke Finance; Finance konfirmasi / tolak.
// ============================================================

type StatusSetoran = 'menunggu' | 'dikonfirmasi' | 'ditolak' | 'dibatalkan';
type Metode = 'tunai' | 'transfer';

interface SaldoSales {
  sales: string;
  nama: string;
  saldo: number;
  menunggu: number;
  tersedia: number;
}
interface ItemSetoran {
  id: string;
  noSetoran: string;
  tanggal: string;
  sales: string;
  namaSales: string;
  jumlah: number;
  metode: Metode;
  catatan: string | null;
  status: StatusSetoran;
  jumlahDiterima: number | null;
  diprosesOleh: string | null;
  diprosesAt: string | null;
  alasanTolak: string | null;
}
interface Data {
  sebagai: { sales: boolean; finance: boolean };
  saldo: SaldoSales[];
  riwayat: ItemSetoran[];
  ringkasan: { totalBelumDisetor: number; totalMenunggu: number; jumlahMenunggu: number };
}

type Notify = (message: string, type: 'success' | 'error') => void;
type FilterStatus = StatusSetoran | 'semua';

const LABEL_METODE: Record<Metode, string> = { tunai: 'Tunai diserahkan', transfer: 'Transfer ke rekening perusahaan' };
const STATUS: Record<StatusSetoran, { label: string; kelas: string }> = {
  menunggu: { label: 'Menunggu', kelas: 'bg-amber-50 text-amber-700' },
  dikonfirmasi: { label: 'Dikonfirmasi', kelas: 'bg-emerald-50 text-emerald-700' },
  ditolak: { label: 'Ditolak', kelas: 'bg-red-50 text-red-700' },
  dibatalkan: { label: 'Dibatalkan', kelas: 'bg-gray-100 text-gray-600' },
};

const lbl = 'block text-[11px] font-bold uppercase tracking-wider text-gray-600';

export default function Setoran() {
  const { division } = useDivision();
  const { data: session } = useSession();
  const user = session?.user as { role?: string; roles?: string[]; username?: string } | undefined;
  const jadiSales = punyaRole(user, SALES);
  const jadiFinance = punyaRole(user, FINANCE);
  const username = (user?.username ?? '').toLowerCase();

  const [data, setData] = useState<Data | null>(null);
  const [dimuat, setDimuat] = useState('');
  const [terlarang, setTerlarang] = useState(false);
  const [versi, setVersi] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>('menunggu');
  const [setor, setSetor] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ItemSetoran | null>(null);
  const [tolak, setTolak] = useState<ItemSetoran | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const url = `/api/setoran?divisi=${division}&status=semua`;
  const kunci = `${url}#${versi}`;
  const memuat = dimuat !== kunci;
  const adaAkses = jadiSales || jadiFinance;

  useEffect(() => {
    if (!adaAkses) return;
    let batal = false;
    ambil<Data>(url).then((h) => {
      if (batal) return;
      if (h.ok) setData(h.data);
      else {
        setTerlarang(h.terlarang);
        notify(h.pesan, 'error');
      }
      setDimuat(kunci);
    });
    return () => {
      batal = true;
    };
  }, [url, kunci, notify, adaAkses]);

  const muatUlang = () => setVersi((v) => v + 1);

  const batalkan = async (s: ItemSetoran) => {
    if (!window.confirm(`Batalkan setoran ${s.noSetoran} sebesar ${formatRupiah(s.jumlah)}?`)) return;
    const h = await ambil<unknown>(`/api/setoran/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    if (!h.ok) return notify(h.pesan, 'error');
    notify(`Setoran ${s.noSetoran} dibatalkan`, 'success');
    muatUlang();
  };

  if (session && !adaAkses) return <KotakTerlarang />;
  if (terlarang) return <KotakTerlarang />;

  const riwayat = data?.riwayat ?? [];
  const saldoSaya: SaldoSales =
    (jadiFinance ? data?.saldo.find((s) => s.sales.toLowerCase() === username) : data?.saldo[0]) ?? { sales: username, nama: '', saldo: 0, menunggu: 0, tersedia: 0 };
  const riwayatSaya = jadiFinance && username ? riwayat.filter((r) => r.sales.toLowerCase() === username) : riwayat;
  const riwayatMasuk = riwayat.filter((r) => filter === 'semua' || r.status === filter);

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Setoran ke Finance</h1>
            <p className="text-sm text-gray-500">Uang tunai hasil penjualan yang dipegang sales, disetor ke Finance lalu dikonfirmasi.</p>
          </div>
        </div>
        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={RefreshCw} label="Muat ulang" onClick={muatUlang} putar={memuat} />
          </GrupIkon>
        </AksiHeader>
      </div>

      {jadiFinance && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { judul: 'Total Belum Disetor (Semua Sales)', nilai: formatRupiah(data?.ringkasan.totalBelumDisetor ?? 0) },
              { judul: 'Total Menunggu Konfirmasi', nilai: formatRupiah(data?.ringkasan.totalMenunggu ?? 0) },
              { judul: 'Setoran Menunggu', nilai: String(data?.ringkasan.jumlahMenunggu ?? 0) },
            ].map((k) => (
              <div key={k.judul} className="hover-lift rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{k.judul}</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">{k.nilai}</div>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <h2 className="border-b border-gray-100 p-4 text-sm font-bold text-gray-900">Saldo per Sales</h2>
            <div className="overflow-x-auto">
              <table className="tabel-kartu w-full min-w-[480px] text-sm">
                <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-white">
                  <tr>
                    <th className="p-3 text-left">Sales</th>
                    <th className="p-3 text-right">Belum Disetor</th>
                    <th className="p-3 text-right">Menunggu Konfirmasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {memuat && !data ? (
                    <tr>
                      <td colSpan={3} className="p-10 text-center text-gray-400">
                        <MemuatProgres teks="Memuat saldo…" />
                      </td>
                    </tr>
                  ) : !data || data.saldo.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-10 text-center text-gray-500">
                        Tidak ada kas di tangan sales.
                      </td>
                    </tr>
                  ) : (
                    data.saldo.map((s) => (
                      <tr key={s.sales} className="hover:bg-gray-50/70">
                        <td data-label="Sales" className="p-3 font-semibold text-gray-900">
                          {s.nama || s.sales}
                          <span className="block text-[11px] font-normal text-gray-400">{s.sales}</span>
                        </td>
                        <td data-label="Belum Disetor" className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-gray-900">
                          {formatRupiah(s.saldo)}
                        </td>
                        <td data-label="Menunggu Konfirmasi" className="whitespace-nowrap p-3 text-right tabular-nums text-amber-700">
                          {formatRupiah(s.menunggu)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4" role="group" aria-label="Filter status setoran">
              <h2 className="mr-2 text-sm font-bold text-gray-900">Setoran Masuk</h2>
              {(
                [
                  ['menunggu', 'Menunggu'],
                  ['dikonfirmasi', 'Dikonfirmasi'],
                  ['ditolak', 'Ditolak'],
                  ['semua', 'Semua'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
                    filter === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <TabelRiwayat
              baris={riwayatMasuk}
              memuat={memuat && !data}
              kosong="Tidak ada setoran."
              tampilSales
              aksi={(s) =>
                s.status === 'menunggu' && (
                  <>
                    <button type="button" onClick={() => setKonfirmasi(s)} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                      Konfirmasi
                    </button>
                    <button type="button" onClick={() => setTolak(s)} className="h-8 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Tolak
                    </button>
                  </>
                )
              }
            />
          </section>
        </>
      )}

      {jadiSales && (
        <>
          <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Belum Disetor</div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums text-gray-900">{formatRupiah(saldoSaya.saldo)}</div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Menunggu konfirmasi</dt>
                <dd className="font-bold tabular-nums text-amber-700">{formatRupiah(saldoSaya.menunggu)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Bisa disetor sekarang</dt>
                <dd className="font-bold tabular-nums text-emerald-700">{formatRupiah(saldoSaya.tersedia)}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={saldoSaya.tersedia <= 0 || memuat}
              onClick={() => setSetor(true)}
              className="mt-4 h-11 w-full rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              Setor ke Finance
            </button>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <h2 className="border-b border-gray-100 p-4 text-sm font-bold text-gray-900">Riwayat Setoran Saya</h2>
            <TabelRiwayat
              baris={riwayatSaya}
              memuat={memuat && !data}
              kosong="Belum ada setoran."
              aksi={(s) =>
                s.status === 'menunggu' && (
                  <button type="button" onClick={() => batalkan(s)} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Batalkan
                  </button>
                )
              }
            />
          </section>
        </>
      )}

      {setor && (
        <ModalSetor
          divisi={division}
          tersedia={saldoSaya.tersedia}
          notify={notify}
          onClose={() => setSetor(false)}
          onSaved={() => {
            setSetor(false);
            muatUlang();
          }}
        />
      )}
      {konfirmasi && (
        <ModalKonfirmasi
          setoran={konfirmasi}
          notify={notify}
          onClose={() => setKonfirmasi(null)}
          onSaved={() => {
            setKonfirmasi(null);
            muatUlang();
          }}
        />
      )}
      {tolak && (
        <ModalTolak
          setoran={tolak}
          notify={notify}
          onClose={() => setTolak(null)}
          onSaved={() => {
            setTolak(null);
            muatUlang();
          }}
        />
      )}
    </div>
  );
}

function TabelRiwayat({
  baris,
  memuat,
  kosong,
  tampilSales,
  aksi,
}: {
  baris: ItemSetoran[];
  memuat: boolean;
  kosong: string;
  tampilSales?: boolean;
  aksi: (s: ItemSetoran) => React.ReactNode;
}) {
  const kolom = tampilSales ? 8 : 7;
  return (
    <div className="overflow-x-auto">
      <table className="tabel-kartu w-full min-w-[820px] text-sm">
        <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-white">
          <tr>
            <th className="p-3 text-left">No Setoran</th>
            <th className="p-3 text-left">Tanggal</th>
            {tampilSales && <th className="p-3 text-left">Sales</th>}
            <th className="p-3 text-right">Jumlah</th>
            <th className="p-3 text-left">Metode</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Keterangan</th>
            <th className="p-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {memuat ? (
            <tr>
              <td colSpan={kolom} className="p-10 text-center text-gray-400">
                <MemuatProgres teks="Memuat setoran…" />
              </td>
            </tr>
          ) : baris.length === 0 ? (
            <tr>
              <td colSpan={kolom} className="p-10 text-center text-gray-500">
                {kosong}
              </td>
            </tr>
          ) : (
            baris.map((s) => {
              const st = STATUS[s.status];
              const selisih = s.status === 'dikonfirmasi' && s.jumlahDiterima !== null && s.jumlahDiterima !== s.jumlah;
              return (
                <tr key={s.id} className="align-top hover:bg-gray-50/70">
                  <td data-label="No Setoran" className="p-3 font-mono text-xs font-semibold text-gray-900">
                    {s.noSetoran}
                  </td>
                  <td data-label="Tanggal" className="whitespace-nowrap p-3 text-gray-700">
                    {formatTanggal(s.tanggal)}
                  </td>
                  {tampilSales && (
                    <td data-label="Sales" className="p-3 font-semibold text-gray-900">
                      {s.namaSales || s.sales}
                    </td>
                  )}
                  <td data-label="Jumlah" className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-gray-900">
                    {formatRupiah(s.jumlah)}
                    {selisih && <span className="block text-[11px] font-semibold text-red-700">Diterima {formatRupiah(s.jumlahDiterima ?? 0)}</span>}
                  </td>
                  <td data-label="Metode" className="p-3 text-gray-700">
                    {s.metode === 'tunai' ? 'Tunai' : 'Transfer'}
                  </td>
                  <td data-label="Status" className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.kelas}`}>{st.label}</span>
                  </td>
                  <td data-label="Keterangan" className="p-3 text-xs text-gray-600">
                    {s.status === 'ditolak' && s.alasanTolak && <span className="block font-semibold text-red-700">Alasan: {s.alasanTolak}</span>}
                    {s.catatan && <span className="block">{s.catatan}</span>}
                    {s.diprosesOleh && <span className="block text-gray-400">oleh {s.diprosesOleh}</span>}
                    {!s.catatan && !s.alasanTolak && !s.diprosesOleh && '-'}
                  </td>
                  <td data-aksi className="p-3">
                    <div className="flex justify-end gap-1.5">{aksi(s)}</div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function Tombol({ onClose, kirim, nonaktif, teks }: { onClose: () => void; kirim: boolean; nonaktif: boolean; teks: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-8">
      <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
        Batal
      </button>
      <button type="submit" disabled={nonaktif || kirim} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
        {kirim ? 'Menyimpan...' : teks}
      </button>
    </div>
  );
}

function ModalSetor({ divisi, tersedia, onClose, onSaved, notify }: { divisi: string; tersedia: number; onClose: () => void; onSaved: () => void; notify: Notify }) {
  const [jumlah, setJumlah] = useState(String(tersedia));
  const [metode, setMetode] = useState<Metode>('tunai');
  const [tanggal, setTanggal] = useState(tglWib());
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [galat, setGalat] = useState('');

  const n = Number(jumlah) || 0;
  const salah = !(n > 0) ? 'Isi nominal setoran' : n > tersedia ? `Maksimal ${formatRupiah(tersedia)}` : '';

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salah || submitting) return;
    setSubmitting(true);
    setGalat('');
    const h = await kirimJson('/api/setoran', { divisi, jumlah: n, metode, tanggal, catatan });
    setSubmitting(false);
    if (!h.ok) return setGalat(h.pesan);
    notify(`Setoran ${formatRupiah(n)} diajukan, menunggu konfirmasi Finance`, 'success');
    onSaved();
  };

  return (
    <Bingkai judul="Setor ke Finance" sub={`Bisa disetor sekarang ${formatRupiah(tersedia)}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <label className={lbl}>
            Nominal setoran *
            <input type="number" min="1" max={tersedia} step="any" inputMode="decimal" required value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={`${kontrol} mt-1 w-full font-semibold`} />
            {salah && <span className="mt-1 block text-[11px] normal-case tracking-normal text-red-600">{salah}</span>}
          </label>
          <fieldset>
            <legend className={lbl}>Metode setoran</legend>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['tunai', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metode === m}
                  onClick={() => setMetode(m)}
                  className={`min-h-10 rounded-xl border px-2 text-sm font-semibold ${metode === m ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}
                >
                  {LABEL_METODE[m]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className={lbl}>
            Tanggal setoran *
            <input type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`${kontrol} mt-1 w-full`} />
          </label>
          <label className={lbl}>
            Catatan / bukti
            <textarea rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Mis. nomor referensi transfer" className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-emerald-500" />
          </label>
          {galat && <p role="alert" className="text-xs font-semibold text-red-600">{galat}</p>}
        </div>
        <Tombol onClose={onClose} kirim={submitting} nonaktif={!!salah} teks="Ajukan Setoran" />
      </form>
    </Bingkai>
  );
}

function ModalKonfirmasi({ setoran, onClose, onSaved, notify }: { setoran: ItemSetoran; onClose: () => void; onSaved: () => void; notify: Notify }) {
  const [diterima, setDiterima] = useState(String(setoran.jumlah));
  const [submitting, setSubmitting] = useState(false);
  const [galat, setGalat] = useState('');

  const n = Number(diterima);
  const salah = !(n >= 0) || diterima === '' ? 'Isi jumlah diterima' : n > setoran.jumlah ? `Maksimal ${formatRupiah(setoran.jumlah)}` : '';
  const kurang = !salah && n < setoran.jumlah ? setoran.jumlah - n : 0;

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salah || submitting) return;
    setSubmitting(true);
    setGalat('');
    const h = await kirimJson(`/api/setoran/${encodeURIComponent(setoran.id)}/konfirmasi`, { jumlahDiterima: n });
    setSubmitting(false);
    if (!h.ok) return setGalat(h.pesan);
    notify(`Setoran ${setoran.noSetoran} dikonfirmasi ${formatRupiah(n)}`, 'success');
    onSaved();
  };

  return (
    <Bingkai judul="Konfirmasi Setoran" sub={`${setoran.noSetoran} · ${setoran.namaSales || setoran.sales}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs">
            <div>
              <dt className="text-gray-500">Diajukan</dt>
              <dd className="font-bold tabular-nums text-gray-900">{formatRupiah(setoran.jumlah)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Metode</dt>
              <dd className="font-semibold text-gray-900">{LABEL_METODE[setoran.metode]}</dd>
            </div>
          </dl>
          <label className={lbl}>
            Diterima Finance *
            <input type="number" min="0" max={setoran.jumlah} step="any" inputMode="decimal" required value={diterima} onChange={(e) => setDiterima(e.target.value)} className={`${kontrol} mt-1 w-full font-semibold`} />
            {salah ? (
              <span className="mt-1 block text-[11px] normal-case tracking-normal text-red-600">{salah}</span>
            ) : (
              <span className="mt-1 block text-[11px] normal-case tracking-normal text-gray-500">Kurang dari yang diajukan = selisih kas dibukukan sebagai Selisih Kas.</span>
            )}
          </label>
          {kurang > 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Selisih kas {formatRupiah(kurang)} akan dibukukan.</p>}
          {galat && <p role="alert" className="text-xs font-semibold text-red-600">{galat}</p>}
        </div>
        <Tombol onClose={onClose} kirim={submitting} nonaktif={!!salah} teks="Konfirmasi Diterima" />
      </form>
    </Bingkai>
  );
}

function ModalTolak({ setoran, onClose, onSaved, notify }: { setoran: ItemSetoran; onClose: () => void; onSaved: () => void; notify: Notify }) {
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [galat, setGalat] = useState('');

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim() || submitting) return;
    setSubmitting(true);
    setGalat('');
    const h = await kirimJson(`/api/setoran/${encodeURIComponent(setoran.id)}/tolak`, { alasan: alasan.trim() });
    setSubmitting(false);
    if (!h.ok) return setGalat(h.pesan);
    notify(`Setoran ${setoran.noSetoran} ditolak`, 'success');
    onSaved();
  };

  return (
    <Bingkai judul="Tolak Setoran" sub={`${setoran.noSetoran} · ${setoran.namaSales || setoran.sales} · ${formatRupiah(setoran.jumlah)}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <label className={lbl}>
            Alasan penolakan *
            <textarea rows={3} required value={alasan} onChange={(e) => setAlasan(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-emerald-500" />
          </label>
          {galat && <p role="alert" className="text-xs font-semibold text-red-600">{galat}</p>}
        </div>
        <Tombol onClose={onClose} kirim={submitting} nonaktif={!alasan.trim()} teks="Tolak Setoran" />
      </form>
    </Bingkai>
  );
}
