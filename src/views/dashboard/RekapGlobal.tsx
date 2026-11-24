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

function TabelRekap({
  judul,
  ikon: Ikon,
  baris,
  kolomNama,
}: {
  judul: string;
  ikon: typeof Package;
  baris: BarisRekap[];
  kolomNama: string;
}) {
  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Ikon className="w-4 h-4 text-emerald-600" aria-hidden="true" />
        <h3 className="text-sm font-bold text-gray-800">{judul}</h3>
      </header>
      {baris.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-gray-400">Belum ada penjualan pada periode ini</p>
      ) : (
        <div className="overflow-x-auto">
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
      )}
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

          {/* Tren harian */}
          {data.perHari.length > 1 && (
            <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Tren Omzet & Laba Harian</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.perHari.map((h) => ({ ...h, tgl: labelTgl(h.kunci) }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="tgl" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v))}
                    />
                    <Tooltip formatter={(v) => formatRupiah(Number(v))} />
                    <Bar dataKey="omzet" name="Omzet" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="laba" name="Laba" fill="#0EA5E9" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          )}

          {/* Rincian */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <TabelRekap judul="Per Jalur Penjualan" ikon={Route} baris={data.perJalur} kolomNama="Jalur" />
            <TabelRekap judul="Per Metode Bayar" ikon={CreditCard} baris={data.perMetode} kolomNama="Metode" />
            <TabelRekap judul="Per Salesman / Kasir" ikon={UserRound} baris={data.perSales} kolomNama="Salesman / Kasir" />
            <TabelRekap judul="Produk Terlaris (Top 10)" ikon={Package} baris={data.perProduk} kolomNama="Produk" />
            <TabelRekap judul="Pelanggan Terbesar (Top 10)" ikon={Users} baris={data.perPelanggan} kolomNama="Pelanggan" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
