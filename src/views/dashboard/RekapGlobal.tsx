'use client';

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, CreditCard, Package, Route, UserRound, Users } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// Rekap Penjualan Global (tampilan utama Dashboard)
// Total periode + rincian per jalur, metode bayar, salesman/kasir, produk, pelanggan,
// dan tren harian. Hanya untuk role yang boleh melihat HPP/laba (API membalas 403
// untuk role lain, dan seksi ini tidak ditampilkan).
// ============================================================

interface BarisRekap {
  kunci: string;
  label: string;
  qty: number;
  trx: number;
  omzet: number;
  hpp: number;
  laba: number;
  margin: number;
  persen: number;
}

interface DataRekap {
  periode: { dari: string; sampai: string };
  total: { omzet: number; hpp: number; laba: number; margin: number; qty: number; trx: number; diskon: number };
  perHari: BarisRekap[];
  perProduk: BarisRekap[];
  perSales: BarisRekap[];
  perJalur: BarisRekap[];
  perMetode: BarisRekap[];
  perPelanggan: BarisRekap[];
}

type Preset = 'hari' | '7' | '30' | 'bulan';
const PRESET: { kunci: Preset; label: string }[] = [
  { kunci: 'hari', label: 'Hari Ini' },
  { kunci: '7', label: '7 Hari' },
  { kunci: '30', label: '30 Hari' },
  { kunci: 'bulan', label: 'Bulan Ini' },
];

const tglWib = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);

function rentang(p: Preset) {
  const kini = new Date();
  const sampai = tglWib(kini);
  if (p === 'hari') return { dari: sampai, sampai };
  if (p === 'bulan') return { dari: `${sampai.slice(0, 8)}01`, sampai };
  const hari = p === '7' ? 6 : 29;
  return { dari: tglWib(new Date(kini.getTime() - hari * 86_400_000)), sampai };
}

const labelTgl = (iso: string) => {
  const [, b, t] = iso.split('-');
  return `${t}/${b}`;
};

const fmtSumbu = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v);

function TabelIsi({ baris, kolomNama }: { baris: BarisRekap[]; kolomNama: string }) {
  if (baris.length === 0) {
    return <p className="px-4 py-6 text-center text-xs text-gray-400">Belum ada penjualan pada periode ini</p>;
  }
  return (
    <div className="overflow-x-auto border-t border-gray-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50/80 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          <tr>
            <th className="py-2.5 px-4">{kolomNama}</th>
            <th className="py-2.5 px-3 text-right">Trx</th>
            <th className="py-2.5 px-3 text-right">Qty</th>
            <th className="py-2.5 px-3 text-right">Omzet</th>
            <th className="py-2.5 px-3 text-right">Laba</th>
            <th className="py-2.5 px-4">Porsi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700">
          {baris.map((b) => (
            <tr key={b.kunci}>
              <td className="py-2.5 px-4 font-semibold text-gray-900">{b.label}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{b.trx}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{b.qty.toLocaleString('id-ID')}</td>
              <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                {formatRupiah(b.omzet)}
              </td>
              <td className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${b.laba < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {formatRupiah(b.laba)}
                <span className="block text-[10px] text-gray-400">{b.margin}%</span>
              </td>
              <td className="py-2.5 px-4 min-w-[90px]">
                <span className="block text-[10px] text-gray-500 tabular-nums">{b.persen}%</span>
                <span className="mt-1 block h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, b.persen)}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type KunciTab = 'tren' | 'jalur' | 'metode' | 'sales' | 'produk' | 'pelanggan';
const TAB: { kunci: KunciTab; label: string; ikon: typeof Package; kolom: string }[] = [
  { kunci: 'tren', label: 'Tren Harian', ikon: BarChart3, kolom: 'Tanggal' },
  { kunci: 'jalur', label: 'Jalur', ikon: Route, kolom: 'Jalur' },
  { kunci: 'metode', label: 'Metode Bayar', ikon: CreditCard, kolom: 'Metode' },
  { kunci: 'sales', label: 'Salesman / Kasir', ikon: UserRound, kolom: 'Salesman / Kasir' },
  { kunci: 'produk', label: 'Produk Top 10', ikon: Package, kolom: 'Produk' },
  { kunci: 'pelanggan', label: 'Pelanggan Top 10', ikon: Users, kolom: 'Pelanggan' },
];

/** Satu kotak grafik analitik; tiap bagian rekap menjadi tab: grafik + tabel ringkas. */
function GrafikAnalitik({ data }: { data: DataRekap }) {
  const [tab, setTab] = useState<KunciTab>('tren');
  const aktif = TAB.find((t) => t.kunci === tab)!;
  const baris =
    tab === 'tren'
      ? data.perHari.map((h) => ({ ...h, label: labelTgl(h.kunci) }))
      : tab === 'jalur'
        ? data.perJalur
        : tab === 'metode'
          ? data.perMetode
          : tab === 'sales'
            ? data.perSales
            : tab === 'produk'
              ? data.perProduk
              : data.perPelanggan;
  const grafik = baris.map((b) => ({ nama: b.label.length > 22 ? `${b.label.slice(0, 21)}…` : b.label, omzet: b.omzet, laba: b.laba }));
  const tinggi = tab === 'tren' ? 240 : Math.max(160, grafik.length * 44 + 40);

  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <header className="px-4 pt-4">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          Grafik Analitik Tren
        </h3>
        <div role="tablist" aria-label="Bagian grafik analitik" className="mt-3 flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1">
          {TAB.map((t) => (
            <button
              key={t.kunci}
              type="button"
              role="tab"
              aria-selected={tab === t.kunci}
              onClick={() => setTab(t.kunci)}
              className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                tab === t.kunci ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <t.ikon className="w-3.5 h-3.5" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div role="tabpanel" aria-label={aktif.label}>
        {baris.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-gray-400 border-t border-gray-100">Belum ada penjualan pada periode ini</p>
        ) : (
          <>
            <div className="px-2 pb-2" style={{ height: tinggi }}>
              <ResponsiveContainer width="100%" height="100%">
                {tab === 'tren' ? (
                  <BarChart data={grafik} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="nama" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtSumbu} />
                    <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                    <Bar dataKey="omzet" name="Omzet" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="laba" name="Laba" fill="#0EA5E9" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                ) : (
                  <BarChart data={grafik} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtSumbu} />
                    <YAxis type="category" dataKey="nama" width={110} tick={{ fill: '#374151', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                    <Bar dataKey="omzet" name="Omzet" fill="#10B981" radius={[0, 6, 6, 0]} maxBarSize={16} />
                    <Bar dataKey="laba" name="Laba" fill="#0EA5E9" radius={[0, 6, 6, 0]} maxBarSize={16} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <TabelIsi baris={baris} kolomNama={aktif.kolom} />
          </>
        )}
      </div>
    </article>
  );
}

export default function RekapGlobal() {
  const { division } = useDivision();
  const [preset, setPreset] = useState<Preset>('hari');
  const [data, setData] = useState<DataRekap | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [tanpaAkses, setTanpaAkses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    const { dari, sampai } = rentang(preset);
    fetch(`/api/laporan/rekap?dari=${dari}&sampai=${sampai}&divisi=${division}`)
      .then(async (r) => {
        if (batal) return;
        if (r.status === 401 || r.status === 403) {
          setTanpaAkses(true);
          return;
        }
        const j = await r.json();
        if (batal) return;
        if (!r.ok || !j.success) throw new Error(j.message || 'Gagal memuat rekap');
        setData(j);
        setGalat(null);
      })
      .catch((e: unknown) => !batal && setGalat(e instanceof Error ? e.message : 'Gagal memuat rekap'))
      .finally(() => !batal && setMemuat(false));
    return () => {
      batal = true;
    };
  }, [preset, division]);

  if (tanpaAkses) return null;

  const t = data?.total;
  const kpi = [
    { label: 'Omzet (Netto)', nilai: formatRupiah(t?.omzet || 0), sub: `${t?.trx || 0} transaksi`, warna: 'text-gray-900' },
    { label: 'Laba Kotor', nilai: formatRupiah(t?.laba || 0), sub: `Margin ${t?.margin || 0}%`, warna: (t?.laba || 0) < 0 ? 'text-red-600' : 'text-emerald-700' },
    { label: 'HPP Modal', nilai: formatRupiah(t?.hpp || 0), sub: 'Harga beli x qty', warna: 'text-gray-900' },
    { label: 'Qty Terjual', nilai: `${(t?.qty || 0).toLocaleString('id-ID')} pcs`, sub: `${data?.perProduk.length || 0} produk teratas`, warna: 'text-gray-900' },
    {
      label: 'Rata-rata / Transaksi',
      nilai: formatRupiah(t && t.trx ? t.omzet / t.trx : 0),
      sub: 'Nilai per nota',
      warna: 'text-gray-900',
    },
    { label: 'Potongan Diskon', nilai: formatRupiah(t?.diskon || 0), sub: 'Diskon item', warna: 'text-amber-700' },
  ];

  return (
    <section aria-label="Rekap Penjualan Global" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            Rekap Penjualan Global
          </h2>
          <p className="text-xs text-gray-500">
            {data ? (data.periode.dari === data.periode.sampai ? labelTgl(data.periode.dari) : `${labelTgl(data.periode.dari)} – ${labelTgl(data.periode.sampai)}`) : '…'}
            {' · '}POS, faktur penjualan & franchise · HPP dari harga beli master
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Periode rekap">
          {PRESET.map((p) => (
            <button
              key={p.kunci}
              type="button"
              onClick={() => {
                if (p.kunci === preset) return;
                setMemuat(true);
                setPreset(p.kunci);
              }}
              aria-pressed={preset === p.kunci}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                preset === p.kunci ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {memuat && !data ? (
        <div className="py-12 flex justify-center bg-white rounded-2xl border border-gray-100">
          <MemuatProgres teks="Memuat rekap penjualan..." />
        </div>
      ) : galat && !data ? (
        <p className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{galat}</p>
      ) : data ? (
        <div className={`space-y-4 transition-opacity ${memuat ? 'opacity-60' : ''}`}>
          {/* Angka utama */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {kpi.map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
                <p className={`mt-1 text-base lg:text-lg font-bold tabular-nums ${k.warna}`}>{k.nilai}</p>
                <p className="text-[11px] text-gray-500">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Rincian: satu kotak grafik, tiap bagian jadi tab */}
          <GrafikAnalitik data={data} />
        </div>
      ) : null}
    </section>
  );
}
