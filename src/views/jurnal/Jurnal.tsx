'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Ban, ListTree, Plus, RefreshCw, Search, Trash2, Undo2, Library } from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import {
  ambil,
  kirimJson,
  kontrol,
  KotakTerlarang,
  PilihPeriode,
  rentangPreset,
  rpLaporan,
  TIPE_AKUN,
  tglWib,
  Toast,
  type Akun,
} from '@/views/laporan-keuangan/util';

// ============================================================
// PAGE: Jurnal Umum, Buku Besar, Bagan Akun + Jurnal Manual
// Route: /jurnal
// ============================================================

interface BarisJurnal {
  akunKode: string;
  akunNama: string;
  debit: number;
  kredit: number;
  keterangan: string | null;
}
interface ItemJurnal {
  id: string;
  noJurnal: string;
  tanggal: string;
  entitas: string;
  cabang: string;
  sumber: string;
  referensi: string | null;
  keterangan: string;
  pembalikDari: string | null;
  dibatalkan: boolean;
  dibuatOleh: string | null;
  total: number;
  baris: BarisJurnal[];
}
interface DataBukuBesar {
  akun: { kode: string; nama: string; saldoNormal: 'D' | 'K' };
  saldoAwal: number;
  mutasi: { tanggal: string; noJurnal: string; sumber: string; referensi: string | null; keterangan: string; debit: number; kredit: number; saldo: number }[];
  totalDebit: number;
  totalKredit: number;
  saldoAkhir: number;
}

const LABEL_SUMBER: Record<string, string> = {
  POS: 'Penjualan POS',
  FAKTUR: 'Faktur Penjualan',
  BAYAR_PIUTANG: 'Bayar Piutang',
  RETUR: 'Retur',
  PEMBELIAN: 'Pembelian',
  BATAL_PEMBELIAN: 'Batal Pembelian',
  BAYAR_HUTANG: 'Bayar Hutang',
  BIAYA: 'Biaya Operasional',
  KAS_MANUAL: 'Kas & Bank',
  RUSAK: 'Barang Rusak',
  PRODUKSI: 'Produksi',
  REVALUASI: 'Revaluasi Persediaan',
  KAS_OPNAME: 'Kas Opname',
  BATAL_POS: 'Batal POS',
  MANUAL: 'Jurnal Manual',
  PEMBALIK: 'Pembalik',
};
const labelSumber = (s: string) => LABEL_SUMBER[s] ?? s;

const LABEL_TIPE: Record<Akun['tipe'], string> = {
  ASET: 'Aset',
  KEWAJIBAN: 'Kewajiban',
  EKUITAS: 'Ekuitas',
  PENDAPATAN: 'Pendapatan',
  BEBAN: 'Beban',
};

type Tab = 'jurnal' | 'buku-besar' | 'bagan';
const TAB: { kunci: Tab; label: string; ikon: typeof BookOpen }[] = [
  { kunci: 'jurnal', label: 'Jurnal Umum', ikon: BookOpen },
  { kunci: 'buku-besar', label: 'Buku Besar', ikon: Library },
  { kunci: 'bagan', label: 'Bagan Akun', ikon: ListTree },
];

type Notify = (message: string, type: 'success' | 'error') => void;

const angka = (v: number) => (v ? formatRupiah(v) : '');

/** Pilihan akun posting, dikelompokkan per tipe. */
function PilihAkun({ akun, value, onChange, className, label }: { akun: Akun[]; value: string; onChange: (v: string) => void; className?: string; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={className ?? kontrol}>
      <option value="">— Pilih akun —</option>
      {TIPE_AKUN.map((t) => {
        const isi = akun.filter((a) => a.posting && a.tipe === t);
        return isi.length ? (
          <optgroup key={t} label={LABEL_TIPE[t]}>
            {isi.map((a) => (
              <option key={a.kode} value={a.kode}>
                {a.kode} · {a.nama}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

// ---------- Tab Jurnal Umum ----------

function TabJurnal({
  entitas,
  versi,
  notify,
  onBatal,
}: {
  entitas: string;
  versi: number;
  notify: Notify;
  onBatal: (j: ItemJurnal) => void;
}) {
  const [periode, setPeriode] = useState(rentangPreset('bulan-ini'));
  const [q, setQ] = useState('');
  const [cari, setCari] = useState('');
  const [sumber, setSumber] = useState('');
  const [data, setData] = useState<ItemJurnal[] | null>(null);
  const [dimuat, setDimuat] = useState('');
  const [terlarang, setTerlarang] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCari(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const p = new URLSearchParams({ entitas, dari: periode.dari, sampai: periode.sampai });
  if (cari) p.set('cari', cari);
  if (sumber) p.set('sumber', sumber);
  const url = `/api/akuntansi/jurnal?${p}`;
  const kunci = `${url}#${versi}`;
  const memuat = dimuat !== kunci;

  useEffect(() => {
    let batal = false;
    ambil<ItemJurnal[]>(url).then((h) => {
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
  }, [url, kunci, notify]);

  if (terlarang) return <KotakTerlarang />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 lg:flex-row lg:flex-wrap lg:items-end">
        <PilihPeriode dari={periode.dari} sampai={periode.sampai} ubah={setPeriode} />
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no jurnal, keterangan, referensi…" aria-label="Cari jurnal" className={`${kontrol} w-full pl-9`} />
        </div>
        <select value={sumber} onChange={(e) => setSumber(e.target.value)} aria-label="Filter sumber" className={kontrol}>
          <option value="">Semua sumber</option>
          {Object.entries(LABEL_SUMBER).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {memuat && !data ? (
        <div className="flex justify-center rounded-2xl border border-gray-100 bg-white py-14">
          <MemuatProgres teks="Memuat jurnal..." />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Tidak ada jurnal pada periode ini.</p>
      ) : (
        <div className={`space-y-3 transition-opacity ${memuat ? 'opacity-60' : ''}`}>
          {data.length >= 500 && <p className="text-xs text-amber-700">Menampilkan 500 jurnal terbaru. Persempit periode atau gunakan pencarian.</p>}
          {data.map((j) => {
            const pembalik = j.sumber === 'PEMBALIK' || !!j.pembalikDari;
            return (
              <article key={j.id} className={`overflow-hidden rounded-2xl border bg-white ${j.dibatalkan ? 'border-red-200' : 'border-gray-200'}`}>
                <header className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-gray-900">{j.noJurnal}</span>
                      <span className="text-xs text-gray-500">{formatTanggal(j.tanggal)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{labelSumber(j.sumber)}</span>
                      {pembalik && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Pembalik</span>}
                      {j.dibatalkan && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Dibatalkan</span>}
                    </div>
                    <p className={`mt-0.5 text-sm text-gray-800 ${j.dibatalkan ? 'line-through decoration-red-300' : ''}`}>{j.keterangan}</p>
                    <p className="text-[11px] text-gray-400">
                      {[j.referensi && `Ref: ${j.referensi}`, j.cabang, j.dibuatOleh && `oleh ${j.dibuatOleh}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {j.sumber === 'MANUAL' && !j.dibatalkan && (
                    <button
                      type="button"
                      onClick={() => onBatal(j)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Batalkan
                    </button>
                  )}
                </header>
                <div className="overflow-x-auto" data-tanpa-kartu>
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-4 py-1.5 text-left font-semibold">Akun</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Debit</th>
                        <th className="px-4 py-1.5 text-right font-semibold">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {j.baris.map((b, i) => (
                        <tr key={i}>
                          <td className={`px-4 py-1.5 ${b.kredit ? 'pl-10' : ''}`}>
                            <span className="font-mono text-[11px] text-gray-400">{b.akunKode}</span> <span className="text-gray-800">{b.akunNama}</span>
                            {b.keterangan && <span className="block text-[11px] text-gray-400">{b.keterangan}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-900">{angka(b.debit)}</td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-right tabular-nums text-gray-900">{angka(b.kredit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 text-xs font-bold text-gray-900">
                      <tr>
                        <td className="px-4 py-1.5">Total</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatRupiah(j.total)}</td>
                        <td className="whitespace-nowrap px-4 py-1.5 text-right tabular-nums">{formatRupiah(j.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Tab Buku Besar ----------

function TabBukuBesar({ entitas, akun, versi, notify }: { entitas: string; akun: Akun[]; versi: number; notify: Notify }) {
  const [periode, setPeriode] = useState(rentangPreset('bulan-ini'));
  const [kode, setKode] = useState('');
  const [data, setData] = useState<DataBukuBesar | null>(null);
  const [dimuat, setDimuat] = useState('');
  const [terlarang, setTerlarang] = useState(false);

  const url = `/api/akuntansi/buku-besar?${new URLSearchParams({ entitas, akun: kode, dari: periode.dari, sampai: periode.sampai })}`;
  const kunci = `${url}#${versi}`;
  const memuat = !!kode && dimuat !== kunci;

  useEffect(() => {
    if (!kode) return;
    let batal = false;
    ambil<DataBukuBesar>(url).then((h) => {
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
  }, [kode, url, kunci, notify]);

  if (terlarang) return <KotakTerlarang />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="min-w-[220px] flex-1 text-xs font-semibold text-gray-600">
          Akun
          <PilihAkun akun={akun} value={kode} onChange={setKode} label="Pilih akun buku besar" className={`${kontrol} mt-1 block w-full`} />
        </label>
        <PilihPeriode dari={periode.dari} sampai={periode.sampai} ubah={setPeriode} />
      </div>

      {!kode ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Pilih akun untuk melihat buku besarnya.</p>
      ) : memuat && !data ? (
        <div className="flex justify-center rounded-2xl border border-gray-100 bg-white py-14">
          <MemuatProgres teks="Memuat buku besar..." />
        </div>
      ) : data ? (
        <section className={`overflow-hidden rounded-2xl border border-gray-200 bg-white transition-opacity ${memuat ? 'opacity-60' : ''}`}>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                <span className="font-mono text-gray-400">{data.akun.kode}</span> {data.akun.nama}
              </h2>
              <p className="text-[11px] text-gray-500">Saldo normal {data.akun.saldoNormal === 'D' ? 'Debit' : 'Kredit'}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              Saldo awal <strong className="block text-sm tabular-nums text-gray-900">{rpLaporan(data.saldoAwal)}</strong>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="p-3 text-left">Tanggal</th>
                  <th className="p-3 text-left">No Jurnal</th>
                  <th className="p-3 text-left">Keterangan</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Kredit</th>
                  <th className="p-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.mutasi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      Tidak ada mutasi pada periode ini
                    </td>
                  </tr>
                ) : (
                  data.mutasi.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap p-3 text-xs text-gray-700">{formatTanggal(m.tanggal)}</td>
                      <td className="p-3">
                        <span className="font-mono text-xs font-semibold text-gray-900">{m.noJurnal}</span>
                        <span className="block text-[10px] text-gray-400">{labelSumber(m.sumber)}</span>
                      </td>
                      <td className="p-3 text-gray-700">
                        {m.keterangan}
                        {m.referensi && <span className="block text-[11px] text-gray-400">Ref: {m.referensi}</span>}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums">{angka(m.debit)}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums">{angka(m.kredit)}</td>
                      <td className={`whitespace-nowrap p-3 text-right font-semibold tabular-nums ${m.saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {rpLaporan(m.saldo)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-900 bg-gray-50 text-sm font-bold text-gray-900">
                <tr>
                  <td colSpan={3} className="p-3">
                    Total mutasi & saldo akhir
                  </td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{formatRupiah(data.totalDebit)}</td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums">{formatRupiah(data.totalKredit)}</td>
                  <td className={`whitespace-nowrap p-3 text-right tabular-nums ${data.saldoAkhir < 0 ? 'text-red-600' : ''}`}>{rpLaporan(data.saldoAkhir)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ---------- Tab Bagan Akun ----------

function TabBagan({ akun }: { akun: Akun[] }) {
  return (
    <div className="space-y-4">
      {TIPE_AKUN.map((t) => {
        const isi = akun.filter((a) => a.tipe === t);
        if (!isi.length) return null;
        return (
          <section key={t} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <h2 className="border-b border-gray-100 bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white">{LABEL_TIPE[t]}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="p-3 text-left">Kode</th>
                    <th className="p-3 text-left">Nama Akun</th>
                    <th className="p-3 text-left">Kelompok</th>
                    <th className="p-3 text-center">Saldo Normal</th>
                    <th className="p-3 text-center">Jenis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isi.map((a) => (
                    <tr key={a.kode} className={a.posting ? '' : 'bg-gray-50/60'}>
                      <td className="whitespace-nowrap p-3 font-mono text-xs text-gray-600">{a.kode}</td>
                      <td className={`p-3 ${a.posting ? 'text-gray-800' : 'font-bold text-gray-900'} ${a.induk ? 'sm:pl-8' : ''}`}>{a.nama}</td>
                      <td className="p-3 text-xs text-gray-500">{a.kelompok}</td>
                      <td className="p-3 text-center text-xs text-gray-700">{a.saldoNormal === 'D' ? 'Debit' : 'Kredit'}</td>
                      <td className="p-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.posting ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                          {a.posting ? 'Posting' : 'Induk'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- Modal Jurnal Manual ----------

interface BarisForm {
  akunKode: string;
  debit: string;
  kredit: string;
  keterangan: string;
}
const barisKosong = (): BarisForm => ({ akunKode: '', debit: '', kredit: '', keterangan: '' });
const nilai = (v: string) => Math.round((Number(v) || 0) * 100) / 100;

function ModalJurnalManual({ entitas, akun, onClose, onSaved, notify }: { entitas: string; akun: Akun[]; onClose: () => void; onSaved: () => void; notify: Notify }) {
  const [tanggal, setTanggal] = useState(tglWib());
  const [keterangan, setKeterangan] = useState('');
  const [referensi, setReferensi] = useState('');
  const [baris, setBaris] = useState<BarisForm[]>([barisKosong(), barisKosong()]);
  const [submitting, setSubmitting] = useState(false);

  const ubah = (i: number, patch: Partial<BarisForm>) => setBaris((b) => b.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const totalDebit = baris.reduce((s, b) => s + nilai(b.debit), 0);
  const totalKredit = baris.reduce((s, b) => s + nilai(b.kredit), 0);
  const selisih = Math.round((totalDebit - totalKredit) * 100) / 100;
  const terisi = baris.filter((b) => b.akunKode && (nilai(b.debit) > 0) !== (nilai(b.kredit) > 0));
  const adaSalah = baris.some((b) => nilai(b.debit) > 0 && nilai(b.kredit) > 0);
  const seimbang = selisih === 0 && totalDebit > 0;
  const bisaSimpan = seimbang && terisi.length >= 2 && !adaSalah && keterangan.trim() !== '' && !submitting;

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bisaSimpan) return;
    setSubmitting(true);
    const h = await kirimJson('/api/akuntansi/jurnal', {
      tanggal,
      entitas,
      keterangan: keterangan.trim(),
      referensi: referensi.trim() || undefined,
      baris: terisi.map((b) => ({ akunKode: b.akunKode, debit: nilai(b.debit), kredit: nilai(b.kredit), keterangan: b.keterangan.trim() || undefined })),
    });
    setSubmitting(false);
    if (!h.ok) return notify(h.pesan, 'error');
    notify(`Jurnal ${(h.data as { noJurnal?: string })?.noJurnal ?? ''} tersimpan`, 'success');
    onSaved();
  };

  const sel = 'h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm focus:border-emerald-500 outline-none';

  return (
    <Bingkai judul="Jurnal Manual" sub="Debit harus sama dengan kredit, minimal 2 baris" onClose={onClose} lebar="max-w-4xl">
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:px-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_200px]">
            <label className="text-xs font-semibold text-gray-600">
              Tanggal *
              <input type="date" required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`${sel} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Keterangan *
              <input required value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Contoh: Setoran modal awal pemilik" className={`${sel} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Referensi
              <input value={referensi} onChange={(e) => setReferensi(e.target.value)} placeholder="Opsional" className={`${sel} mt-1`} />
            </label>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_130px_130px_1fr_36px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 md:grid">
              <span>Akun</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Kredit</span>
              <span>Keterangan baris</span>
              <span />
            </div>
            {baris.map((b, i) => {
              const ganda = nilai(b.debit) > 0 && nilai(b.kredit) > 0;
              return (
                <div key={i} className={`grid grid-cols-2 gap-2 rounded-xl border p-2 md:grid-cols-[1fr_130px_130px_1fr_36px] md:border-0 md:p-0 ${ganda ? 'border-red-300' : 'border-gray-200'}`}>
                  <div className="col-span-2 md:col-span-1">
                    <PilihAkun akun={akun} value={b.akunKode} onChange={(v) => ubah(i, { akunKode: v })} label={`Akun baris ${i + 1}`} className={sel} />
                  </div>
                  <input type="number" min="0" step="any" inputMode="decimal" placeholder="Debit" aria-label={`Debit baris ${i + 1}`} value={b.debit} onChange={(e) => ubah(i, { debit: e.target.value })} className={`${sel} text-right tabular-nums`} />
                  <input type="number" min="0" step="any" inputMode="decimal" placeholder="Kredit" aria-label={`Kredit baris ${i + 1}`} value={b.kredit} onChange={(e) => ubah(i, { kredit: e.target.value })} className={`${sel} text-right tabular-nums`} />
                  <input placeholder="Keterangan (opsional)" aria-label={`Keterangan baris ${i + 1}`} value={b.keterangan} onChange={(e) => ubah(i, { keterangan: e.target.value })} className={`${sel} col-span-2 md:col-span-1`} />
                  <button
                    type="button"
                    disabled={baris.length <= 2}
                    onClick={() => setBaris((x) => x.filter((_, k) => k !== i))}
                    aria-label={`Hapus baris ${i + 1}`}
                    className="col-span-2 flex h-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 md:col-span-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {ganda && <p className="col-span-2 text-[11px] text-red-600 md:col-span-5">Isi debit atau kredit saja, tidak keduanya.</p>}
                </div>
              );
            })}
            <button type="button" onClick={() => setBaris((x) => [...x, barisKosong()])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              <Plus className="h-3.5 w-3.5" /> Tambah baris
            </button>
          </div>

          <div className={`grid grid-cols-3 gap-2 rounded-xl border p-3 text-xs ${seimbang ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div>
              <div className="text-gray-500">Total Debit</div>
              <div className="font-bold tabular-nums text-gray-900">{formatRupiah(totalDebit)}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Kredit</div>
              <div className="font-bold tabular-nums text-gray-900">{formatRupiah(totalKredit)}</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <div className={`font-bold ${seimbang ? 'text-emerald-700' : 'text-amber-800'}`}>
                {seimbang ? 'Seimbang' : totalDebit === 0 && totalKredit === 0 ? 'Belum diisi' : `Selisih ${formatRupiah(Math.abs(selisih))}`}
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-8">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Batal
          </button>
          <button type="submit" disabled={!bisaSimpan} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Menyimpan...' : 'Simpan Jurnal'}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}

function ModalBatal({ jurnal, onClose, onSaved, notify }: { jurnal: ItemJurnal; onClose: () => void; onSaved: () => void; notify: Notify }) {
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim() || submitting) return;
    setSubmitting(true);
    const h = await kirimJson(`/api/akuntansi/jurnal/${encodeURIComponent(jurnal.id)}/batal`, { alasan: alasan.trim() });
    setSubmitting(false);
    if (!h.ok) return notify(h.pesan, 'error');
    notify(`Jurnal ${jurnal.noJurnal} dibatalkan dengan jurnal pembalik`, 'success');
    onSaved();
  };
  return (
    <Bingkai judul="Batalkan Jurnal Manual" sub={`${jurnal.noJurnal} · ${jurnal.keterangan}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 p-5 sm:px-8">
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Jurnal tidak dihapus. Sistem membuat jurnal pembalik dengan debit dan kredit ditukar, sehingga saldo kembali seperti semula.
          </p>
          <label className="block text-xs font-semibold text-gray-600">
            Alasan pembatalan *
            <textarea required rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-8">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Kembali
          </button>
          <button type="submit" disabled={!alasan.trim() || submitting} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            <Undo2 className="h-4 w-4" /> {submitting ? 'Memproses...' : 'Batalkan Jurnal'}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}

// ---------- Halaman ----------

export default function Jurnal() {
  const { division } = useDivision();
  const [tab, setTab] = useState<Tab>('jurnal');
  const [akun, setAkun] = useState<Akun[]>([]);
  const [terlarang, setTerlarang] = useState(false);
  const [versi, setVersi] = useState(0);
  const [modalManual, setModalManual] = useState(false);
  const [batal, setBatal] = useState<ItemJurnal | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    ambil<Akun[]>('/api/akuntansi/akun').then((h) => {
      if (h.ok) setAkun(h.data);
      else if (h.terlarang) setTerlarang(true);
      else notify(h.pesan, 'error');
    });
  }, [notify]);

  const muatUlang = () => setVersi((v) => v + 1);
  const panel = useMemo(() => TAB.find((t) => t.kunci === tab)!, [tab]);

  if (terlarang) return <KotakTerlarang />;

  return (
    <div className="space-y-5">
      <Toast toast={toast} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Jurnal & Buku Besar</h1>
          <p className="mt-1 text-sm text-gray-500">Pembukuan berpasangan perusahaan {division === 'FNB' ? 'F&B' : 'Manufaktur'}</p>
        </div>
        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={RefreshCw} label="Muat ulang" onClick={muatUlang} />
          </GrupIkon>
          <TombolUtama ikon={Plus} onClick={() => setModalManual(true)}>
            Jurnal Manual
          </TombolUtama>
        </AksiHeader>
      </div>

      <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        Transaksi penjualan, pembelian, kas, dan biaya dijurnal otomatis. Gunakan <strong>Jurnal Manual</strong> untuk saldo awal, modal disetor, prive, pinjaman, dan
        pembelian aset tetap.
      </p>

      <div role="tablist" aria-label="Bagian pembukuan" className="flex gap-1.5 overflow-x-auto">
        {TAB.map((t) => (
          <button
            key={t.kunci}
            type="button"
            role="tab"
            aria-selected={tab === t.kunci}
            onClick={() => setTab(t.kunci)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition ${
              tab === t.kunci ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <t.ikon className="h-4 w-4" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={panel.label}>
        {tab === 'jurnal' && <TabJurnal entitas={division} versi={versi} notify={notify} onBatal={setBatal} />}
        {tab === 'buku-besar' && <TabBukuBesar entitas={division} akun={akun} versi={versi} notify={notify} />}
        {tab === 'bagan' && <TabBagan akun={akun} />}
      </div>

      {modalManual && (
        <ModalJurnalManual
          entitas={division}
          akun={akun}
          notify={notify}
          onClose={() => setModalManual(false)}
          onSaved={() => {
            setModalManual(false);
            muatUlang();
          }}
        />
      )}
      {batal && (
        <ModalBatal
          jurnal={batal}
          notify={notify}
          onClose={() => setBatal(null)}
          onSaved={() => {
            setBatal(null);
            muatUlang();
          }}
        />
      )}
    </div>
  );
}
