'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, HeartPulse, RefreshCw } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { punyaRole } from '@/shared/lib/auth/roles';
import { ROUTES } from '@/router/routes';
import { useDivision } from '@/shared/context/DivisionContext';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { ambil, ROLES_PEMBUKUAN, rpLaporan } from '@/views/laporan-keuangan/util';

// ============================================================
// Keuangan & Kesehatan Bisnis (atas Dashboard, khusus Direktur Utama & Manager)
// Sumber: GET /api/akuntansi/ringkasan?entitas=
// ============================================================

interface Periode {
  pendapatanBersih: number;
  labaKotor: number;
  bebanOperasional: number;
  labaBersih: number;
  marginKotor: number | null;
  marginBersih: number | null;
  arusKasOperasi: number;
}
interface Ringkasan {
  entitas: string;
  posisi: {
    kasBank: number;
    piutang: number;
    persediaan: number;
    asetLancar: number;
    totalAset: number;
    hutangUsaha: number;
    kewajibanLancar: number;
    totalKewajiban: number;
    ekuitas: number;
  };
  bulanIni: Periode;
  bulanLalu: Periode;
  rasio: { lancar: number | null; cepat: number | null; der: number | null };
  peringatan: {
    piutangLewatTempo: { jumlah: number; total: number };
    hutangJatuhTempo7Hari: { jumlah: number; total: number };
  };
  tren: { bulan: string; pendapatan: number; labaBersih: number; kasAkhir: number }[];
  skor: { nilai: number; label: 'Sehat' | 'Waspada' | 'Kritis'; catatan: string[] };
}

type Warna = 'hijau' | 'kuning' | 'merah' | 'abu';
const KELAS_WARNA: Record<Warna, string> = {
  hijau: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  kuning: 'bg-amber-50 text-amber-700 border-amber-200',
  merah: 'bg-red-50 text-red-700 border-red-200',
  abu: 'bg-gray-50 text-gray-500 border-gray-200',
};

const warnaLancar = (v: number | null): Warna => (v === null ? 'abu' : v >= 1.5 ? 'hijau' : v >= 1 ? 'kuning' : 'merah');
const warnaCepat = (v: number | null): Warna => (v === null ? 'abu' : v >= 1 ? 'hijau' : v >= 0.5 ? 'kuning' : 'merah');
const warnaDer = (v: number | null): Warna => (v === null ? 'abu' : v <= 1 ? 'hijau' : v <= 2 ? 'kuning' : 'merah');
const rasio = (v: number | null) => (v === null ? '–' : v.toLocaleString('id-ID', { maximumFractionDigits: 2 }));
const persen = (v: number | null) => (v === null ? '–' : `${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const labelBulan = (b: string) => `${NAMA_BULAN[Number(b.slice(5, 7)) - 1] ?? b} ${b.slice(2, 4)}`;
const fmtSumbu = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1_000_000_000 ? `${(a / 1_000_000_000).toFixed(1)}M` : a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}jt` : a >= 1000 ? `${Math.round(a / 1000)}rb` : String(a);
  return v < 0 ? `-${s}` : s;
};

/** Perubahan % laba bersih vs bulan lalu (null bila bulan lalu nol). */
function perubahan(kini: number, lalu: number) {
  if (!lalu) return null;
  return ((kini - lalu) / Math.abs(lalu)) * 100;
}

function Ubin({ judul, nilai, sub, negatif }: { judul: string; nilai: string; sub?: React.ReactNode; negatif?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{judul}</p>
      <p className={`mt-1 text-base font-bold tabular-nums lg:text-lg ${negatif ? 'text-red-600' : 'text-gray-900'}`}>{nilai}</p>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

function UbinRasio({ judul, nilai, warna, ket }: { judul: string; nilai: string; warna: Warna; ket: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${KELAS_WARNA[warna]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{judul}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums">{nilai}</p>
      <p className="text-[11px] opacity-80">{ket}</p>
    </div>
  );
}

function Gauge({ nilai, label }: { nilai: number; label: Ringkasan['skor']['label'] }) {
  const v = Math.max(0, Math.min(100, nilai));
  const warna = label === 'Sehat' ? '#10B981' : label === 'Waspada' ? '#F59E0B' : '#EF4444';
  // Busur setengah lingkaran: panjang = π·r
  const r = 52;
  const pj = Math.PI * r;
  return (
    <div className="relative mx-auto w-40" role="img" aria-label={`Skor kesehatan ${Math.round(v)} dari 100, ${label}`}>
      <svg viewBox="0 0 120 70" className="w-full">
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={warna} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * pj} ${pj}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-3xl font-extrabold tabular-nums text-gray-900">{Math.round(v)}</div>
        <div className="text-xs font-bold" style={{ color: warna }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function KesehatanBisnis() {
  const { data: session } = useSession();
  const boleh = punyaRole(session?.user as { role?: string; roles?: string[] } | undefined, ROLES_PEMBUKUAN);
  const { division } = useDivision();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [dimuat, setDimuat] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [versi, setVersi] = useState(0);

  const url = `/api/akuntansi/ringkasan?entitas=${division}`;
  const kunci = `${url}#${versi}`;
  const memuat = dimuat !== kunci;

  useEffect(() => {
    if (!boleh) return;
    let batal = false;
    ambil<Ringkasan>(url).then((h) => {
      if (batal) return;
      if (h.ok) {
        setData(h.data);
        setGalat(null);
      } else setGalat(h.pesan);
      setDimuat(kunci);
    });
    return () => {
      batal = true;
    };
  }, [boleh, url, kunci]);

  if (!boleh) return null;

  const header = (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <HeartPulse className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          Keuangan & Kesehatan Bisnis
        </h2>
        <p className="text-xs text-gray-500">Perusahaan {division === 'FNB' ? 'F&B' : 'Manufaktur'} · dari jurnal pembukuan</p>
      </div>
      <button
        type="button"
        onClick={() => setVersi((v) => v + 1)}
        disabled={memuat}
        aria-label="Muat ulang kesehatan bisnis"
        title="Muat ulang"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );

  if (!data) {
    return (
      <section aria-label="Keuangan & Kesehatan Bisnis" className="space-y-4">
        {header}
        {memuat ? (
          <div className="flex justify-center rounded-2xl border border-gray-100 bg-white py-12">
            <MemuatProgres teks="Menghitung kesehatan bisnis..." />
          </div>
        ) : (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{galat}</p>
        )}
      </section>
    );
  }

  const { posisi: p, bulanIni: bi, bulanLalu: bl, rasio: r, peringatan: w, skor } = data;
  const ubahLaba = perubahan(bi.labaBersih, bl.labaBersih);
  const grafik = data.tren.map((t) => ({ ...t, nama: labelBulan(t.bulan) }));

  return (
    <section aria-label="Keuangan & Kesehatan Bisnis" className={`space-y-4 transition-opacity ${memuat ? 'opacity-60' : ''}`}>
      {header}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Skor */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:col-span-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Skor Kesehatan</p>
          <Gauge nilai={skor.nilai} label={skor.label} />
          {skor.catatan.length > 0 && (
            <ul className="mt-3 space-y-1 text-[11px] text-gray-600">
              {skor.catatan.map((c, i) => (
                <li key={i} className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ubin angka */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-9 lg:grid-cols-4">
          <Ubin judul="Kas & Bank" nilai={rpLaporan(p.kasBank)} negatif={p.kasBank < 0} />
          <Ubin judul="Piutang" nilai={formatRupiah(p.piutang)} />
          <Ubin judul="Persediaan" nilai={formatRupiah(p.persediaan)} />
          <Ubin judul="Hutang Usaha" nilai={formatRupiah(p.hutangUsaha)} />
          <Ubin
            judul="Laba Bersih Bulan Ini"
            nilai={rpLaporan(bi.labaBersih)}
            negatif={bi.labaBersih < 0}
            sub={
              ubahLaba === null ? (
                'Bulan lalu belum ada data'
              ) : (
                <span className={ubahLaba >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                  {ubahLaba >= 0 ? '▲' : '▼'} {Math.abs(ubahLaba).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% vs bulan lalu
                </span>
              )
            }
          />
          <Ubin judul="Margin Kotor" nilai={persen(bi.marginKotor)} sub={`Bulan lalu ${persen(bl.marginKotor)}`} />
          <Ubin judul="Margin Bersih" nilai={persen(bi.marginBersih)} negatif={(bi.marginBersih ?? 0) < 0} sub={`Bulan lalu ${persen(bl.marginBersih)}`} />
          <Ubin judul="Arus Kas Operasi" nilai={rpLaporan(bi.arusKasOperasi)} negatif={bi.arusKasOperasi < 0} sub="Bulan ini" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <UbinRasio judul="Rasio Lancar" nilai={rasio(r.lancar)} warna={warnaLancar(r.lancar)} ket="Aset lancar ÷ kewajiban lancar (sehat ≥ 1,5)" />
        <UbinRasio judul="Rasio Cepat" nilai={rasio(r.cepat)} warna={warnaCepat(r.cepat)} ket="Tanpa persediaan (sehat ≥ 1)" />
        <UbinRasio judul="Debt to Equity" nilai={rasio(r.der)} warna={warnaDer(r.der)} ket="Total kewajiban ÷ ekuitas (sehat ≤ 1)" />
      </div>

      {(w.piutangLewatTempo.jumlah > 0 || w.hutangJatuhTempo7Hari.jumlah > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {w.piutangLewatTempo.jumlah > 0 && (
            <Link href={ROUTES.PIUTANG} className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 hover:bg-red-100">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                <strong>{w.piutangLewatTempo.jumlah} faktur piutang lewat jatuh tempo</strong> senilai {formatRupiah(w.piutangLewatTempo.total)}. Tagih sekarang →
              </span>
            </Link>
          )}
          {w.hutangJatuhTempo7Hari.jumlah > 0 && (
            <Link href={ROUTES.HUTANG} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 hover:bg-amber-100">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                <strong>{w.hutangJatuhTempo7Hari.jumlah} hutang suplier jatuh tempo ≤ 7 hari</strong> senilai {formatRupiah(w.hutangJatuhTempo7Hari.total)}. Siapkan kas →
              </span>
            </Link>
          )}
        </div>
      )}

      {grafik.length > 0 && (
        <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800">Tren 6 Bulan</h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={grafik} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="nama" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtSumbu} />
                <Tooltip formatter={(v) => rpLaporan(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pendapatan" name="Pendapatan" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="labaBersih" name="Laba Bersih" fill="#0EA5E9" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Line type="monotone" dataKey="kasAkhir" name="Kas Akhir" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      )}
    </section>
  );
}
