'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  HandCoins,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import Bingkai from '@/shared/components/ui/Bingkai';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// Piutang Pelanggan: tagihan dari Faktur Penjualan yang belum lunas.
// Terima pembayaran (lunas penuh / sebagian + mundurkan jatuh tempo sisa),
// mundurkan jatuh tempo tanpa bayar, riwayat per faktur, dan audit arus kas.
// ============================================================

interface Faktur {
  noFaktur: string;
  tanggal: string;
  jatuhTempo: string | null;
  pelanggan: string;
  telepon: string | null;
  salesman: string | null;
  grandTotal: string;
  dibayar: string;
  sisaPiutang: string;
  status: 'lunas' | 'sebagian' | 'belum_lunas';
  hariTerlambat: number | null;
}

interface Ringkasan {
  totalPiutang: number;
  jatuhTempo7Hari: number;
  jumlahTerlambat: number;
  jumlahFaktur: number;
  umur: { belumJatuhTempo: number; terlambat1_30: number; terlambat31_60: number; terlambatLebih60: number };
}

interface Audit {
  jumlahFaktur: number;
  totalPiutang: number;
  totalKasFaktur: number;
  sehat: boolean;
  temuan: { noFaktur: string; pelanggan: string | null; masalah: string }[];
}

interface Mutasi {
  id: string;
  jenis: 'bayar' | 'ubah_tempo' | 'retur' | 'refund' | 'batal_retur' | 'batal_refund';
  tanggal: string;
  jumlah: string;
  metode: 'tunai' | 'transfer' | null;
  jatuhTempoLama: string | null;
  jatuhTempoBaru: string | null;
  sisaSetelah: string;
  catatan: string | null;
  createdBy: string | null;
}

type Modal = { jenis: 'bayar' | 'tempo' | 'riwayat'; faktur: Faktur } | null;
type Notify = (message: string, type: 'success' | 'error') => void;

const input =
  'w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition';
const label = 'block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider';

const n = (v: string | number | null | undefined) => Number(v) || 0;
const keInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tambahHari = (d: Date, hari: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + hari);

/** Saran jatuh tempo baru: 30 hari setelah yang lebih akhir antara jatuh tempo lama dan hari ini. */
const saranTempo = (lama: string | null) => {
  const hariIni = new Date();
  const acuan = lama && new Date(lama) > hariIni ? new Date(lama) : hariIni;
  return keInput(tambahHari(acuan, 30));
};

function BadgeTempo({ f }: { f: Faktur }) {
  if (n(f.sisaPiutang) <= 0) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Lunas</span>;
  }
  if (f.hariTerlambat === null) return <span className="text-[11px] text-gray-400">Tanpa tempo</span>;
  if (f.hariTerlambat > 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
        Terlambat {f.hariTerlambat} hari
      </span>
    );
  }
  if (f.hariTerlambat === 0) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Jatuh tempo hari ini</span>;
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        f.hariTerlambat >= -7 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {-f.hariTerlambat} hari lagi
    </span>
  );
}

export default function Piutang() {
  const [data, setData] = useState<Faktur[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditTerbuka, setAuditTerbuka] = useState(false);
  const [q, setQ] = useState('');
  const [cari, setCari] = useState('');
  const [semua, setSemua] = useState(false);
  const [loading, setLoading] = useState(true);
  const [versi, setVersi] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify: Notify = useCallback((message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Pencarian ditunda sedikit agar tidak memanggil API di setiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setCari(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let batal = false;
    const params = new URLSearchParams();
    if (cari) params.set('q', cari);
    if (semua) params.set('semua', '1');
    Promise.all([
      fetch(`/api/piutang?${params}`).then((r) => r.json()),
      fetch('/api/piutang/audit').then((r) => r.json()),
    ])
      .then(([list, aud]) => {
        if (batal) return;
        if (list.success) {
          setData(list.data);
          setRingkasan(list.ringkasan);
        } else notify(list.message || 'Gagal memuat piutang', 'error');
        if (aud.success) setAudit(aud.data);
      })
      .catch(() => !batal && notify('Gagal memuat data piutang', 'error'))
      .finally(() => !batal && setLoading(false));
    return () => {
      batal = true;
    };
  }, [cari, semua, versi, notify]);

  const muatUlang = () => {
    setLoading(true);
    setVersi((v) => v + 1);
  };

  const umur = ringkasan?.umur;
  const totalUmur = umur ? umur.belumJatuhTempo + umur.terlambat1_30 + umur.terlambat31_60 + umur.terlambatLebih60 : 0;
  const segmen = umur
    ? [
        { label: 'Belum jatuh tempo', nilai: umur.belumJatuhTempo, warna: 'bg-emerald-500' },
        { label: 'Terlambat 1-30 hari', nilai: umur.terlambat1_30, warna: 'bg-amber-400' },
        { label: 'Terlambat 31-60 hari', nilai: umur.terlambat31_60, warna: 'bg-orange-500' },
        { label: 'Terlambat > 60 hari', nilai: umur.terlambatLebih60, warna: 'bg-red-600' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-[60] px-5 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <HandCoins className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Piutang Pelanggan</h1>
            <p className="text-sm text-gray-500">
              Tagihan Faktur Penjualan yang dihutangkan. Terima pelunasan penuh atau cicilan, dan mundurkan jatuh tempo.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={muatUlang}
          className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </header>

      {/* Ringkasan */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { judul: 'Total Piutang', nilai: formatRupiah(ringkasan?.totalPiutang ?? 0), sub: `${ringkasan?.jumlahFaktur ?? 0} faktur terbuka`, tegas: true },
          {
            judul: 'Lewat Jatuh Tempo',
            nilai: formatRupiah((umur?.terlambat1_30 ?? 0) + (umur?.terlambat31_60 ?? 0) + (umur?.terlambatLebih60 ?? 0)),
            sub: `${ringkasan?.jumlahTerlambat ?? 0} faktur terlambat`,
            bahaya: (ringkasan?.jumlahTerlambat ?? 0) > 0,
          },
          { judul: 'Jatuh Tempo ≤ 7 Hari', nilai: formatRupiah(ringkasan?.jatuhTempo7Hari ?? 0), sub: 'Segera tagih' },
          { judul: 'Belum Jatuh Tempo', nilai: formatRupiah(umur?.belumJatuhTempo ?? 0), sub: 'Termasuk ≤ 7 hari' },
        ].map((k) => (
          <div
            key={k.judul}
            className={`rounded-2xl border p-4 bg-white ${k.bahaya ? 'border-red-200' : 'border-gray-200'}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{k.judul}</div>
            <div
              className={`mt-1 text-lg font-bold tabular-nums ${
                k.bahaya ? 'text-red-700' : k.tegas ? 'text-gray-900' : 'text-gray-800'
              }`}
            >
              {k.nilai}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* Umur piutang */}
      {totalUmur > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Umur Piutang</div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" aria-hidden>
            {segmen.map((s) =>
              s.nilai > 0 ? <div key={s.label} className={s.warna} style={{ width: `${(s.nilai / totalUmur) * 100}%` }} /> : null
            )}
          </div>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {segmen.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${s.warna}`} />
                <dt className="text-gray-500">{s.label}</dt>
                <dd className="ml-auto font-semibold text-gray-900 tabular-nums">{formatRupiah(s.nilai)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Audit arus kas */}
      {audit && (
        <section
          className={`rounded-2xl border p-4 ${audit.sehat ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/60'}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {audit.sehat ? (
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-700" />
            )}
            <div className="flex-1 min-w-[220px]">
              <div className={`text-sm font-bold ${audit.sehat ? 'text-emerald-800' : 'text-red-800'}`}>
                {audit.sehat
                  ? 'Audit arus kas piutang: cocok'
                  : `Audit arus kas piutang: ${audit.temuan.length} temuan`}
              </div>
              <div className="text-xs text-gray-600">
                {audit.jumlahFaktur} faktur diperiksa. Kas dari faktur {formatRupiah(audit.totalKasFaktur)}, sisa piutang{' '}
                {formatRupiah(audit.totalPiutang)}. Setiap faktur: grand total = dibayar + sisa, dan dibayar = kas tercatat.
              </div>
            </div>
            {!audit.sehat && (
              <button
                type="button"
                onClick={() => setAuditTerbuka((v) => !v)}
                className="text-xs font-semibold text-red-700 underline underline-offset-2"
              >
                {auditTerbuka ? 'Sembunyikan' : 'Lihat temuan'}
              </button>
            )}
          </div>
          {auditTerbuka && !audit.sehat && (
            <ul className="mt-3 space-y-1 text-xs text-red-800">
              {audit.temuan.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono font-semibold">{t.noFaktur}</span>
                  {t.pelanggan && <span className="text-red-600">({t.pelanggan})</span>}
                  <span>{t.masalah}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Daftar */}
      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari pelanggan atau nomor faktur…"
              aria-label="Cari piutang"
              className={`${input} pl-9`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={semua}
              onChange={(e) => {
                setLoading(true);
                setSemua(e.target.checked);
              }}
              className="w-4 h-4 accent-emerald-600"
            />
            Tampilkan yang sudah lunas
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3 text-left">Faktur</th>
                <th className="p-3 text-left">Pelanggan</th>
                <th className="p-3 text-left">Jatuh Tempo</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Dibayar</th>
                <th className="p-3 text-right">Sisa Piutang</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-400">
                    <MemuatProgres teks="Memuat piutang…" />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-500">
                    {cari ? 'Tidak ada faktur yang cocok.' : 'Tidak ada piutang terbuka. Semua faktur sudah lunas.'}
                  </td>
                </tr>
              ) : (
                data.map((f) => {
                  const terbuka = n(f.sisaPiutang) > 0;
                  return (
                    <tr key={f.noFaktur} className="hover:bg-gray-50/70 align-top">
                      <td className="p-3">
                        <div className="font-mono text-xs font-semibold text-gray-900">{f.noFaktur}</div>
                        <div className="text-[11px] text-gray-400">{formatTanggal(f.tanggal)}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">{f.pelanggan}</div>
                        <div className="text-[11px] text-gray-400">
                          {[f.telepon, f.salesman && `Sales: ${f.salesman}`].filter(Boolean).join(' · ') || '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-800">{f.jatuhTempo ? formatTanggal(f.jatuhTempo) : '-'}</div>
                        <div className="mt-1">
                          <BadgeTempo f={f} />
                        </div>
                      </td>
                      <td className="p-3 text-right tabular-nums text-gray-700">{formatRupiah(f.grandTotal)}</td>
                      <td className="p-3 text-right tabular-nums text-gray-700">{formatRupiah(f.dibayar)}</td>
                      <td className={`p-3 text-right tabular-nums font-bold ${terbuka ? 'text-gray-900' : 'text-emerald-700'}`}>
                        {formatRupiah(f.sisaPiutang)}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1.5">
                          {terbuka && (
                            <>
                              <button
                                type="button"
                                onClick={() => setModal({ jenis: 'bayar', faktur: f })}
                                className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                              >
                                Terima Bayar
                              </button>
                              <button
                                type="button"
                                onClick={() => setModal({ jenis: 'tempo', faktur: f })}
                                title="Mundurkan jatuh tempo"
                                aria-label={`Mundurkan jatuh tempo ${f.noFaktur}`}
                                className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                              >
                                <CalendarClock className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setModal({ jenis: 'riwayat', faktur: f })}
                            title="Riwayat pembayaran"
                            aria-label={`Riwayat ${f.noFaktur}`}
                            className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.jenis === 'bayar' && (
        <ModalBayar
          faktur={modal.faktur}
          onClose={() => setModal(null)}
          notify={notify}
          onSaved={() => {
            setModal(null);
            muatUlang();
          }}
        />
      )}
      {modal?.jenis === 'tempo' && (
        <ModalTempo
          faktur={modal.faktur}
          onClose={() => setModal(null)}
          notify={notify}
          onSaved={() => {
            setModal(null);
            muatUlang();
          }}
        />
      )}
      {modal?.jenis === 'riwayat' && <ModalRiwayat faktur={modal.faktur} onClose={() => setModal(null)} notify={notify} />}
    </div>
  );
}

function RingkasFaktur({ f }: { f: Faktur }) {
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs">
      <div>
        <dt className="text-gray-500">Total</dt>
        <dd className="font-semibold text-gray-900 tabular-nums">{formatRupiah(f.grandTotal)}</dd>
      </div>
      <div>
        <dt className="text-gray-500">Sudah dibayar</dt>
        <dd className="font-semibold text-gray-900 tabular-nums">{formatRupiah(f.dibayar)}</dd>
      </div>
      <div>
        <dt className="text-gray-500">Sisa piutang</dt>
        <dd className="font-bold text-red-700 tabular-nums">{formatRupiah(f.sisaPiutang)}</dd>
      </div>
    </dl>
  );
}

async function kirim(noFaktur: string, body: object) {
  const res = await fetch(`/api/piutang/${encodeURIComponent(noFaktur)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function ModalBayar({
  faktur,
  onClose,
  onSaved,
  notify,
}: {
  faktur: Faktur;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const sisa = n(faktur.sisaPiutang);
  const [skema, setSkema] = useState<'penuh' | 'sebagian'>('penuh');
  const [jumlahSebagian, setJumlahSebagian] = useState('');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('transfer');
  const [tanggal, setTanggal] = useState(keInput(new Date()));
  const [tempoBaru, setTempoBaru] = useState(saranTempo(faktur.jatuhTempo));
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const jumlah = skema === 'penuh' ? sisa : n(jumlahSebagian);
  const sisaSetelah = Math.max(0, Math.round((sisa - jumlah) * 100) / 100);
  const salah =
    skema === 'sebagian'
      ? !(jumlah > 0)
        ? 'Isi jumlah yang dibayar'
        : jumlah >= sisa
          ? 'Jumlah sama dengan / melebihi sisa: pilih Lunas Penuh'
          : !tempoBaru
            ? 'Isi jatuh tempo baru untuk sisa'
            : tempoBaru < tanggal
              ? 'Jatuh tempo baru tidak boleh sebelum tanggal bayar'
              : ''
      : '';
  const tempoMundur = skema === 'sebagian' && !!tempoBaru && (!faktur.jatuhTempo || tempoBaru !== keInput(new Date(faktur.jatuhTempo)));

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || salah) return;
    setSubmitting(true);
    try {
      const json = await kirim(faktur.noFaktur, {
        aksi: 'bayar',
        jumlah,
        metode,
        tanggal,
        jatuhTempoBaru: skema === 'sebagian' ? tempoBaru : undefined,
        catatan,
      });
      if (!json.success) return notify(json.message || 'Gagal mencatat pembayaran', 'error');
      notify(
        skema === 'penuh'
          ? `Faktur ${faktur.noFaktur} lunas. Kas masuk ${formatRupiah(jumlah)}`
          : `Cicilan ${formatRupiah(jumlah)} tercatat. Sisa ${formatRupiah(sisaSetelah)}`,
        'success'
      );
      onSaved();
    } catch {
      notify('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Bingkai judul="Terima Pembayaran Piutang" sub={`${faktur.noFaktur} · ${faktur.pelanggan}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-5 sm:px-8 space-y-4">
          <RingkasFaktur f={faktur} />

          <fieldset>
            <legend className={label}>Skema Penagihan</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'penuh', judul: 'Lunas Penuh', hint: `Tagih seluruh sisa ${formatRupiah(sisa)}` },
                  { id: 'sebagian', judul: 'Sebagian', hint: 'Cicilan, sisa dengan tempo baru' },
                ] as const
              ).map((o) => (
                <label
                  key={o.id}
                  className={`rounded-xl border p-3 cursor-pointer transition ${
                    skema === o.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="skema"
                    value={o.id}
                    checked={skema === o.id}
                    onChange={() => setSkema(o.id)}
                    className="sr-only"
                  />
                  <div className="text-sm font-bold text-gray-900">{o.judul}</div>
                  <div className="text-[11px] text-gray-500">{o.hint}</div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bayar-jumlah" className={label}>
                Jumlah Dibayar
              </label>
              <input
                id="bayar-jumlah"
                type="number"
                min={1}
                step="0.01"
                max={sisa}
                readOnly={skema === 'penuh'}
                value={skema === 'penuh' ? sisa : jumlahSebagian}
                onChange={(e) => setJumlahSebagian(e.target.value)}
                placeholder="0"
                className={`${input} text-right tabular-nums font-semibold read-only:bg-gray-50`}
              />
            </div>
            <div>
              <label htmlFor="bayar-tanggal" className={label}>
                Tanggal Bayar
              </label>
              <input
                id="bayar-tanggal"
                type="date"
                required
                min={keInput(new Date(faktur.tanggal))}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <fieldset>
            <legend className={label}>Diterima Via</legend>
            <div className="flex gap-2">
              {(['transfer', 'tunai'] as const).map((m) => (
                <label
                  key={m}
                  className={`flex-1 h-10 rounded-xl border flex items-center justify-center text-sm font-semibold cursor-pointer transition ${
                    metode === m ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input type="radio" name="metode" value={m} checked={metode === m} onChange={() => setMetode(m)} className="sr-only" />
                  {m === 'transfer' ? 'Transfer' : 'Tunai'}
                </label>
              ))}
            </div>
          </fieldset>

          {skema === 'sebagian' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <label htmlFor="bayar-tempo" className={label}>
                Jatuh Tempo Baru untuk Sisa {formatRupiah(sisaSetelah)}
              </label>
              <input
                id="bayar-tempo"
                type="date"
                required
                min={tanggal}
                value={tempoBaru}
                onChange={(e) => setTempoBaru(e.target.value)}
                className={input}
              />
              <p className="text-[11px] text-amber-800">
                Jatuh tempo lama: {faktur.jatuhTempo ? formatTanggal(faktur.jatuhTempo) : 'tidak ada'}.
                {tempoMundur ? ' Tempo akan dimundurkan dan tercatat di riwayat.' : ' Tempo tidak berubah.'}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="bayar-catatan" className={label}>
              Catatan
            </label>
            <input
              id="bayar-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="No. bukti transfer, nama penyetor…"
              className={input}
            />
          </div>

          {salah && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {salah}
            </p>
          )}
        </div>

        <div className="px-5 sm:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/60">
          <div className="text-xs text-gray-500">
            Kas masuk <span className="font-bold text-gray-900 tabular-nums">{formatRupiah(jumlah)}</span>
            <span className="block">
              Sisa setelah ini: <span className="font-semibold tabular-nums">{formatRupiah(sisaSetelah)}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !!salah}
              className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan…' : skema === 'penuh' ? 'Simpan Pelunasan' : 'Simpan Cicilan'}
            </button>
          </div>
        </div>
      </form>
    </Bingkai>
  );
}

function ModalTempo({
  faktur,
  onClose,
  onSaved,
  notify,
}: {
  faktur: Faktur;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const lama = faktur.jatuhTempo ? new Date(faktur.jatuhTempo) : new Date();
  const minimal = keInput(tambahHari(lama, 1));
  const [baru, setBaru] = useState(saranTempo(faktur.jatuhTempo));
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const salah = !baru ? 'Isi tanggal baru' : baru < minimal ? `Harus setelah ${formatTanggal(lama)}` : !alasan.trim() ? 'Alasan wajib diisi' : '';

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || salah) return;
    setSubmitting(true);
    try {
      const json = await kirim(faktur.noFaktur, { aksi: 'tempo', jatuhTempoBaru: baru, alasan });
      if (!json.success) return notify(json.message || 'Gagal memundurkan jatuh tempo', 'error');
      notify(`Jatuh tempo ${faktur.noFaktur} dimundurkan ke ${formatTanggal(baru)}`, 'success');
      onSaved();
    } catch {
      notify('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Bingkai judul="Mundurkan Jatuh Tempo" sub={`${faktur.noFaktur} · ${faktur.pelanggan}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-5 sm:px-8 space-y-4">
          <RingkasFaktur f={faktur} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={label}>Jatuh Tempo Sekarang</div>
              <div className="h-10 px-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center text-sm text-gray-700">
                {faktur.jatuhTempo ? formatTanggal(faktur.jatuhTempo) : 'Tidak ada'}
              </div>
            </div>
            <div>
              <label htmlFor="tempo-baru" className={label}>
                Jatuh Tempo Baru
              </label>
              <input
                id="tempo-baru"
                type="date"
                required
                min={minimal}
                value={baru}
                onChange={(e) => setBaru(e.target.value)}
                className={input}
              />
            </div>
          </div>
          <div>
            <label htmlFor="tempo-alasan" className={label}>
              Alasan Penundaan
            </label>
            <textarea
              id="tempo-alasan"
              required
              rows={3}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: pelanggan minta mundur karena pembayaran dari toko mereka tertunda"
              className={`${input} h-auto py-2`}
            />
          </div>
          <p className="text-[11px] text-gray-500">Tidak ada uang yang dicatat. Perubahan tempo tersimpan di riwayat faktur.</p>
          {salah && <p className="text-xs text-red-600">{salah}</p>}
        </div>
        <div className="px-5 sm:px-8 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/60">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white">
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || !!salah}
            className="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Menyimpan…' : 'Mundurkan Tempo'}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}

function ModalRiwayat({ faktur, onClose, notify }: { faktur: Faktur; onClose: () => void; notify: Notify }) {
  const [mutasi, setMutasi] = useState<Mutasi[] | null>(null);

  useEffect(() => {
    let batal = false;
    fetch(`/api/piutang/${encodeURIComponent(faktur.noFaktur)}`)
      .then((r) => r.json())
      .then((json) => {
        if (batal) return;
        if (json.success) setMutasi(json.data.mutasi);
        else notify(json.message || 'Gagal memuat riwayat', 'error');
      })
      .catch(() => !batal && notify('Gagal memuat riwayat', 'error'));
    return () => {
      batal = true;
    };
  }, [faktur.noFaktur, notify]);

  // Uang muka = dibayar saat faktur dibuat = total dibayar dikurangi semua cicilan sesudahnya
  const uangMuka = useMemo(
    () =>
      mutasi
        ? Math.round(
            (n(faktur.dibayar) -
              mutasi.filter((m) => m.jenis === 'bayar').reduce((t, m) => t + n(m.jumlah), 0) +
              mutasi.filter((m) => m.jenis === 'refund').reduce((t, m) => t + n(m.jumlah), 0) -
              mutasi.filter((m) => m.jenis === 'batal_refund').reduce((t, m) => t + n(m.jumlah), 0)) *
              100
          ) / 100
        : 0,
    [mutasi, faktur.dibayar]
  );

  return (
    <Bingkai judul="Riwayat Piutang" sub={`${faktur.noFaktur} · ${faktur.pelanggan}`} onClose={onClose} lebar="max-w-2xl">
      <div className="flex-1 overflow-y-auto p-5 sm:px-8 space-y-4">
        <RingkasFaktur f={faktur} />
        {!mutasi ? (
          <p className="text-sm text-gray-400 text-center py-6"><MemuatProgres teks="Memuat riwayat…" /></p>
        ) : (
          <ol className="relative border-l-2 border-gray-100 ml-2 space-y-4">
            <li className="pl-5 relative">
              <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-slate-900" />
              <div className="text-sm font-semibold text-gray-900">Faktur terbit · {formatRupiah(faktur.grandTotal)}</div>
              <div className="text-xs text-gray-500">
                {formatTanggal(faktur.tanggal)}
                {uangMuka > 0 ? ` · Uang muka ${formatRupiah(uangMuka)}` : ' · Tanpa uang muka (dihutangkan penuh)'}
              </div>
            </li>
            {mutasi.map((m) => (
              <li key={m.id} className="pl-5 relative">
                <span
                  className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${
                    m.jenis === 'bayar' ? 'bg-emerald-500' : m.jenis === 'ubah_tempo' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
                <div className="text-sm font-semibold text-gray-900">
                  {m.jenis === 'bayar'
                    ? `${n(m.sisaSetelah) <= 0 ? 'Pelunasan' : 'Cicilan'} ${formatRupiah(m.jumlah)} (${m.metode === 'tunai' ? 'Tunai' : 'Transfer'})`
                    : m.jenis === 'retur'
                      ? `Retur barang, piutang dipotong ${formatRupiah(m.jumlah)}`
                      : m.jenis === 'batal_retur'
                        ? `Retur dibatalkan, piutang kembali ${formatRupiah(m.jumlah)}`
                        : m.jenis === 'refund'
                          ? `Refund retur ${formatRupiah(m.jumlah)} (${m.metode === 'transfer' ? 'Transfer' : 'Tunai'})`
                          : m.jenis === 'batal_refund'
                            ? `Refund retur dibatalkan ${formatRupiah(m.jumlah)}`
                            : 'Jatuh tempo dimundurkan'}
                </div>
                <div className="text-xs text-gray-500">
                  {formatTanggal(m.tanggal)} · sisa {formatRupiah(m.sisaSetelah)}
                  {m.createdBy ? ` · oleh ${m.createdBy}` : ''}
                </div>
                {m.jatuhTempoBaru && (
                  <div className="text-xs text-amber-700">
                    Tempo {m.jatuhTempoLama ? formatTanggal(m.jatuhTempoLama) : '-'} → {formatTanggal(m.jatuhTempoBaru)}
                  </div>
                )}
                {m.catatan && <div className="text-xs text-gray-600 italic">“{m.catatan}”</div>}
              </li>
            ))}
            {mutasi.length === 0 && (
              <li className="pl-5 text-xs text-gray-400">Belum ada pembayaran atau perubahan tempo setelah faktur terbit.</li>
            )}
          </ol>
        )}
      </div>
    </Bingkai>
  );
}
