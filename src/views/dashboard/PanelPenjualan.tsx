'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { punyaRole } from '@/shared/lib/auth/roles';
import { useDivision } from '@/shared/context/DivisionContext';
import { ambil, tglWib } from '@/views/laporan-keuangan/util';
import { PANEL } from '@/views/setoran/peran';

// ============================================================
// Panel Penjualan (di bawah banner Dashboard)
// Sumber: GET /api/dashboard/penjualan?divisi=&mode=&tgl=
// Laba/margin hanya dirender bila server mengirim tampilLaba = true.
// ============================================================

type Mode = 'harian' | 'mingguan' | 'bulan';

interface Penjualan {
  mode: Mode;
  dari: string;
  sampai: string;
  total: number;
  belumDibayar: number;
  terbayar: number;
  transaksi: number;
  perTransaksi: number;
  produkTerjual: number;
  produkPerTransaksi: number;
  akumulasi: number;
  proyeksi: number | null;
  tampilLaba: boolean;
  labaKotor?: number;
  marginKotor?: number | null;
}

const MODE: { kunci: Mode; label: string }[] = [
  { kunci: 'harian', label: 'Harian' },
  { kunci: 'mingguan', label: 'Mingguan' },
  { kunci: 'bulan', label: 'Bulan' },
];
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const fmtTgl = (s: string) => {
  const [t, b, h] = s.split('-').map(Number);
  return `${h} ${NAMA_BULAN[b - 1]} ${String(t).slice(2)}`;
};
const utc = (s: string) => {
  const [t, b, h] = s.split('-').map(Number);
  return new Date(Date.UTC(t, b - 1, h));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Periode lokal (cadangan sebelum server menjawab; server tetap yang berwenang). */
function periodeLokal(mode: Mode, tgl: string) {
  const d = utc(tgl);
  if (mode === 'harian') return { dari: tgl, sampai: tgl };
  if (mode === 'mingguan') {
    const mundur = (d.getUTCDay() + 6) % 7; // Senin = 0
    const senin = new Date(d.getTime() - mundur * 86_400_000);
    return { dari: iso(senin), sampai: iso(new Date(senin.getTime() + 6 * 86_400_000)) };
  }
  return { dari: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), sampai: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
}

function geser(mode: Mode, tgl: string, arah: 1 | -1) {
  const d = utc(tgl);
  if (mode === 'bulan') return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + arah, 1)));
  return iso(new Date(d.getTime() + arah * (mode === 'harian' ? 1 : 7) * 86_400_000));
}

const persen = (v: number | null | undefined) => (v == null ? '-' : `${v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const angka = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 });

export default function PanelPenjualan() {
  const { data: session } = useSession();
  const { division } = useDivision();
  const boleh = punyaRole(session?.user as { role?: string; roles?: string[] } | undefined, PANEL);

  const [mode, setMode] = useState<Mode>('harian');
  const [tgl, setTgl] = useState(() => tglWib());
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState<{ kunci: string; data: Penjualan | null; terlarang: boolean } | null>(null);

  const kunci = `${division}|${mode}|${tgl}|${versi}`;
  const memuat = hasil?.kunci !== kunci;

  useEffect(() => {
    if (!boleh) return;
    let batal = false;
    ambil<Penjualan>(`/api/dashboard/penjualan?divisi=${division}&mode=${mode}&tgl=${tgl}`).then((h) => {
      if (batal) return;
      setHasil({ kunci, data: h.ok ? h.data : null, terlarang: !h.ok && h.terlarang });
    });
    return () => {
      batal = true;
    };
  }, [boleh, division, mode, tgl, kunci]);

  if (!boleh || hasil?.terlarang) return null;

  const d = !memuat ? hasil?.data ?? null : null;
  const periode = d ?? periodeLokal(mode, tgl);
  const sudahSekarang = periode.sampai >= tglWib();
  const pilihMode = (m: Mode) => {
    setMode(m);
    setTgl(tglWib());
  };
  const cell = (v: string | undefined) => (memuat || v === undefined ? <span className="inline-block h-5 w-20 animate-pulse rounded bg-gray-200 align-middle" /> : v);

  return (
    <section aria-label="Panel penjualan" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mode periode">
          {MODE.map((m) => (
            <button
              key={m.kunci}
              type="button"
              aria-pressed={mode === m.kunci}
              onClick={() => pilihMode(m.kunci)}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition ${mode === m.kunci ? 'bg-emerald-500 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button type="button" aria-label="Periode sebelumnya" onClick={() => setTgl(geser(mode, tgl, -1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10.5rem] text-center text-sm font-semibold tabular-nums text-gray-800">
            {fmtTgl(periode.dari)} - {fmtTgl(periode.sampai)}
          </span>
          <button
            type="button"
            aria-label="Periode berikutnya"
            disabled={sudahSekarang}
            onClick={() => setTgl(geser(mode, tgl, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Muat ulang panel penjualan" title="Muat ulang" onClick={() => setVersi((v) => v + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
            <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 border-t border-gray-100 pt-4 lg:grid-cols-3">
        <div>
          <p className="text-sm text-gray-500">Total Penjualan</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-gray-900 sm:text-4xl">{cell(d ? formatRupiah(d.total) : undefined)}</p>
          <p className="mt-3 text-xs text-gray-500">
            Akumulasi dari Awal Bulan <span className="font-semibold tabular-nums text-gray-700">{d ? formatRupiah(d.akumulasi) : '-'}</span>
          </p>
          {d && d.proyeksi !== null && (
            <p className="mt-1 text-xs text-gray-500">
              Proyeksi Bulan Ini <span className="font-semibold tabular-nums text-gray-700">{formatRupiah(d.proyeksi)}</span>
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Penjualan Belum Dibayar</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{cell(d ? formatRupiah(d.belumDibayar) : undefined)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Penjualan Terbayar</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">{cell(d ? formatRupiah(d.terbayar) : undefined)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-4">
          {[
            ['Transaksi', d ? angka(d.transaksi) : undefined],
            ['Penjualan per Transaksi', d ? formatRupiah(d.perTransaksi) : undefined],
            ['Produk Terjual', d ? angka(d.produkTerjual) : undefined],
            ['Produk per Transaksi', d ? angka(d.produkPerTransaksi) : undefined],
            ...(d?.tampilLaba
              ? [
                  ['Laba Kotor', formatRupiah(d.labaKotor ?? 0)],
                  ['Margin Kotor', persen(d.marginKotor)],
                ]
              : []),
          ].map(([label, nilai]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-0.5 break-words text-sm font-bold tabular-nums text-gray-900">{cell(nilai)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
