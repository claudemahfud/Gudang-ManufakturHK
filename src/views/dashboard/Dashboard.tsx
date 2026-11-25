'use client';

// ============================================================
// PAGE: Dashboard
// Route: /dashboard
// ============================================================

import { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { formatRupiah, formatStok, formatTanggal } from '@/shared/lib/utils';
import { ROUTES } from '@/router/routes';
import type { InventoryItem } from '@/shared/types';
import { useDivision } from '@/shared/context/DivisionContext';
import RekapGlobal from './RekapGlobal';
import KesehatanBisnis from './KesehatanBisnis';
import {
  ArrowDownToLine,
  Truck,
  ShoppingBag,
  ShieldAlert,
  Zap,
  ExternalLink,
  Wallet,
  Boxes,
  AlertTriangle,
} from 'lucide-react';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// SECTION: Interfaces & Types
// ============================================================

interface DashboardStatsData {
  totalInventory: number;
  totalSKU: number;
  stokKritis: number;
  barangMasukHariIni: number;
  barangKeluarHariIni: number;
}

interface BrandChartData {
  brand: string;
  stok: number;
}

interface DashboardApiResponse {
  success: boolean;
  data?: {
    stats: DashboardStatsData;
    chartData: BrandChartData[];
    kritisItems: InventoryItem[];
  };
  error?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}

// Client-safe mounting check (React 18/19 standard via useSyncExternalStore)
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

// ============================================================
// SECTION: Custom Recharts Tooltip (dideklarasikan di luar render)
// ============================================================

function CustomChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        <p className="text-emerald-600 font-bold">
          Total Stok:{' '}
          <span className="text-gray-900">
            {payload[0].value.toLocaleString('id-ID')} pcs
          </span>
        </p>
      </div>
    );
  }
  return null;
}

// ============================================================
// SECTION: Main Component
// ============================================================

export default function Dashboard() {
  const isClient = useIsClient();

  const [stats, setStats] = useState<DashboardStatsData>({
    totalInventory: 0,
    totalSKU: 0,
    stokKritis: 0,
    barangMasukHariIni: 0,
    barangKeluarHariIni: 0,
  });
  const [chartData, setChartData] = useState<BrandChartData[]>([]);
  const [kritisItems, setKritisItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // ============================================================
  // SECTION: Data Fetching
  // ============================================================

  const { division, isManufaktur, isFnb } = useDivision();

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      try {
        const res = await fetch(`/api/dashboard?divisi=${division}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const json: DashboardApiResponse = await res.json();

        if (isCancelled) return;

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Gagal memuat data dashboard');
        }

        if (json.data) {
          setStats(json.data.stats);
          setChartData(json.data.chartData);
          setKritisItems(json.data.kritisItems);
          setError(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [refreshKey, division]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  // ============================================================
  // SECTION: Render Loading Skeleton
  // ============================================================

  if (loading && !isClient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-gray-500"><MemuatProgres teks="Memuat data dashboard..." /></p>
        </div>
      </div>
    );
  }

  // ============================================================
  // SECTION: Render Main View
  // ============================================================

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Hero Banner (Z-Pattern CTA) */}
      <header className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base sm:text-lg font-extrabold tracking-tight leading-tight">
              <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-300 animate-pulse" title="Live Monitor" aria-hidden="true" />
              <span className="truncate">Ringkasan Operasional Gudang</span>
            </h1>
            <p className="text-emerald-100 text-[11px] sm:text-xs mt-0.5 truncate">
              {formatTanggal(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg text-xs font-medium transition backdrop-blur-md border border-white/20"
              title="Perbarui Data"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="hidden sm:inline">{loading ? 'Menyinkronkan...' : 'Segarkan'}</span>
            </button>

            <Link
              href={ROUTES.INVENTORY}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <span>Buka Inventory</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Keuangan & kesehatan bisnis (khusus Direktur Utama & Manager) */}
      <KesehatanBisnis />

      {/* Grafik analitik penjualan (hanya role yang boleh melihat laba) */}
      <RekapGlobal />

      {/* ============================================================ */}
      {/* 2. SECTION: Quick Action Hub (Grid Layout Archetype) */}
      {/* ============================================================ */}
      <section aria-label="Pusat Aksi Cepat" className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider">
              Pusat Aksi Cepat (2-3 Klik Selesai)
            </h2>
          </div>
          <span className="text-[11px] font-medium text-gray-400 hidden sm:inline">
            Akses langsung tanpa perlu mencari di menu sidebar
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Aksi 1: Terima Barang Masuk */}
          <article>
            <Link
              href={ROUTES.BARANG_MASUK}
              className="group flex flex-col p-4 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/80 hover-lift h-full"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-emerald-950 leading-tight">
                Terima Barang Masuk
              </span>
              <span className="text-[10px] sm:text-[11px] text-emerald-700 mt-1">
                Catat kiriman supplier & stok masuk
              </span>
            </Link>
          </article>

          {/* Aksi 2: Kirim Muatan Keluar */}
          <article>
            <Link
              href={ROUTES.BARANG_KELUAR}
              className="group flex flex-col p-4 rounded-2xl bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/80 hover-lift h-full"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-blue-950 leading-tight">
                Kirim Muatan Keluar
              </span>
              <span className="text-[10px] sm:text-[11px] text-blue-700 mt-1">
                Surat loading & pengiriman grosir
              </span>
            </Link>
          </article>

          {/* Aksi 3: Kasir POS Fullscreen */}
          <article>
            <Link
              href={ROUTES.POS}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col p-4 rounded-2xl bg-purple-50/70 hover:bg-purple-100/80 border border-purple-200/80 hover-lift h-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-600" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-purple-950 leading-tight">
                Buka Kasir POS
              </span>
              <span className="text-[10px] sm:text-[11px] text-purple-700 mt-1">
                Layar penuh kasir & nota thermal 58mm
              </span>
            </Link>
          </article>

          {/* Aksi 4: Lapor Rusak & Retur */}
          <article>
            <Link
              href={ROUTES.LAPORAN_RUSAK_RETUR}
              className="group flex flex-col p-4 rounded-2xl bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 hover-lift h-full"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-rose-950 leading-tight">
                Lapor Rusak & Retur
              </span>
              <span className="text-[10px] sm:text-[11px] text-rose-700 mt-1">
                Audit barang afkir & retur pelanggan
              </span>
            </Link>
          </article>
        </div>
      </section>

      {/* Alert Error If Any */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl"></span>
            <div>
              <p className="font-semibold text-sm">Gagal Mengambil Data</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="text-xs font-semibold px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. SECTION: Stats Cards (Grid Layout Archetype) */}
      {/* ============================================================ */}
      <section aria-label="Indikator Kunci Operasional" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Nilai Inventory */}
        <article className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Total Nilai Inventory
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                <Wallet className="w-5 h-5" aria-hidden="true" />
              </div>
          </div>
          <div className="text-xl font-bold text-gray-900 tracking-tight">
            {loading ? (
              <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
            ) : (
              formatRupiah(stats.totalInventory)
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Estimasi aset stok tersedia</p>
        </article>

        {/* Card 2: Total SKU */}
        <article className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Total Master SKU
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                <Boxes className="w-5 h-5" aria-hidden="true" />
              </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            {loading ? (
              <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              `${stats.totalSKU.toLocaleString('id-ID')} SKU`
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Varian produk terdaftar</p>
        </article>

        {/* Card 3: Stok Kritis */}
        <article className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Stok Kritis
            </span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                stats.stokKritis > 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                stats.stokKritis > 0 ? 'text-amber-600' : 'text-gray-900'
              }`}
            >
              {loading ? (
                <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
              ) : (
                stats.stokKritis
              )}
            </span>
            <span className="text-xs text-gray-500">Barang</span>
          </div>
          <p className="text-xs text-amber-700 mt-1 font-medium">
            {stats.stokKritis > 0 ? 'Perlu segera restock' : 'Semua stok aman'}
          </p>
        </article>

        {/* Card 4: Barang Masuk Hari Ini */}
        <article className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Barang Masuk (Hari Ini)
            </span>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-lg">
                <ArrowDownToLine className="w-5 h-5" aria-hidden="true" />
              </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">
              {loading ? (
                <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
              ) : (
                stats.barangMasukHariIni
              )}
            </span>
            <span className="text-xs text-gray-500">Transaksi</span>
          </div>
          <p className="text-xs text-teal-600 mt-1 font-medium">Aktivitas penerimaan</p>
        </article>

        {/* Card 5: Barang Keluar Hari Ini */}
        <article className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Barang Keluar (Hari Ini)
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                <Truck className="w-5 h-5" aria-hidden="true" />
              </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">
              {loading ? (
                <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
              ) : (
                stats.barangKeluarHariIni
              )}
            </span>
            <span className="text-xs text-gray-500">Transaksi</span>
          </div>
          <p className="text-xs text-indigo-600 mt-1 font-medium">Aktivitas pengiriman</p>
        </article>
      </section>

      {/* ============================================================ */}
      {/* 4. SECTION: Magazine / Asymmetrical Layout (Charts & Critical Stock) */}
      {/* ============================================================ */}
      <section aria-label="Analisis Stok & Peringatan Kritis" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri (7 Kolom): Bar Chart Stok per Brand */}
        <article className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  Distribusi Stok per Brand
                </h2>
                <p className="text-xs text-gray-400">
                  Total kuantitas stok fisik (pcs) dikelompokkan menurut brand
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                Recharts
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              {isClient && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis
                      dataKey="brand"
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar
                      dataKey="stok"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={48}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index % 2 === 0 ? '#00C853' : '#009688'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <span className="text-3xl mb-2"></span>
                  <p className="text-sm">Belum ada data barang untuk ditampilkan di grafik</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Menampilkan brand dengan akumulasi stok tertinggi</span>
            <Link href={ROUTES.INVENTORY} className="text-emerald-600 hover:text-emerald-700 font-semibold">
              Kelola Brand &rarr;
            </Link>
          </div>
        </article>

        {/* Kolom Kanan (5 Kolom): 5 Barang Stok Kritis Terbaru (Semantic Aside) */}
        <aside aria-label="Panel Stok Kritis" className="lg:col-span-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <span>Stok Kritis</span>
                  {stats.stokKritis > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                      {stats.stokKritis} Perlu Restock
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400">
                  Barang dengan sisa stok di bawah batas minimum
                </p>
              </div>
              <Link
                href={ROUTES.INVENTORY}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Lihat Semua
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : kritisItems.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <span className="text-4xl"></span>
                <p className="text-sm font-medium text-gray-700 mt-2">Semua Stok Dalam Kondisi Aman</p>
                <p className="text-xs text-gray-400 mt-0.5">Tidak ada SKU yang mencapai batas kritis.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {kritisItems.map((item) => {
                  const isZero = item.stok <= 0;
                  return (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                            {item.sku}
                          </span>
                          <span className="text-xs font-medium text-gray-400 truncate">
                            {item.brand || 'No Brand'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate mt-0.5">
                          {item.namaBarang}
                        </p>
                        <p className="text-xs text-gray-500">
                          Min: {item.stokMinimum ?? 10} pcs
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-sm text-gray-900">
                          {formatStok(item.stok, item.pakaiKarton, item.settingPcs)}
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full mt-1 ${
                            isZero
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isZero ? 'Habis' : 'Kritis'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Link
              href={ROUTES.INVENTORY}
              className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              <span>Cek & Pesan Barang di Inventory</span>
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
