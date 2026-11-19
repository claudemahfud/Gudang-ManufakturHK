'use client';

// ============================================================
// PAGE: Produk Detile Terjual
// Route: /produk-terjual
// Fitur: Rekap Qty Terjual / Terbuang / Rusak by Qty Per Produk
// Filter fleksibel: per hari, per jam, rentang custom
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  Printer,
  Package,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatRupiah } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';

interface ProductRow {
  sku: string;
  namaBarang: string;
  brand: string;
  stokSisa: number;
  qtyTerjual: number;
  nominalTerjual: number;
  qtyRusak: number;
  qtyRetur: number;
}

interface HourlyItem {
  hour: string;
  qty: number;
  nominal: number;
}

export default function ProdukTerjualView() {
  const { division, isManufaktur, isFnb } = useDivision();
  const [data, setData] = useState<ProductRow[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters
  const [presetDate, setPresetDate] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('divisi', division);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (startHour !== '') params.set('startHour', startHour);
      if (endHour !== '') params.set('endHour', endHour);
      if (selectedBrand && selectedBrand !== 'all') params.set('brand', selectedBrand);

      const res = await fetch(`/api/laporan/produk-terjual?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
        setHourlyData(json.hourlyData || []);
        setSummary(json.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch product sales report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    if (presetDate === 'today') {
      const d = now.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
    } else if (presetDate === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (presetDate === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else {
      setStartDate('');
      setEndDate('');
    }
  }, [presetDate]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, startHour, endHour, selectedBrand, division]);

  const brands = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.brand).filter(Boolean)));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(
      (d) =>
        d.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
        d.sku.toLowerCase().includes(search.toLowerCase()) ||
        d.brand.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold mb-1 border border-blue-100">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Rekapitulasi Fisik & Penjualan Produk</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Produk Detile Terjual, Rusak & Retur
          </h1>
          <p className="text-xs text-gray-500">
            Monitor perputaran kuantitas produk: barang terjual, terbuang/rusak, dan retur by qty dengan filter per hari dan per jam transaksi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Qty Terjual
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">
            {summary?.totalTerjual?.toLocaleString('id-ID') || 0}{' '}
            <span className="text-xs text-gray-400 font-normal">pcs</span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {formatRupiah(summary?.totalNominal || 0)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Qty Terbuang / Rusak
          </div>
          <div className="text-xl sm:text-2xl font-bold text-red-600 font-mono">
            {summary?.totalRusak?.toLocaleString('id-ID') || 0}{' '}
            <span className="text-xs text-gray-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Barang afkir / pecah / cacat</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Qty Retur Masuk
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 font-mono">
            {summary?.totalRetur?.toLocaleString('id-ID') || 0}{' '}
            <span className="text-xs text-gray-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Pengembalian dari customer</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Efisiensi Penjualan
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">
            {summary?.totalTerjual + summary?.totalRusak > 0
              ? (
                  (summary.totalTerjual / (summary.totalTerjual + summary.totalRusak)) *
                  100
                ).toFixed(1)
              : 100}
            %
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Rasio barang lolos jual vs rusak</div>
        </div>
      </div>

      {/* Filter Bar with Per Hour selection */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 mr-1 hidden sm:inline">Periode:</span>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetDate(p.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                  presetDate === p.id
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Custom */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPresetDate('all');
              }}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700"
            />
            <span className="text-gray-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPresetDate('all');
              }}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700"
            />
          </div>

          {/* Filter Per Jam (00:00 - 23:00) */}
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-500 font-medium">Jam:</span>
            <select
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 font-mono"
            >
              <option value="">Semua Jam (00:00)</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span className="text-gray-400">-</span>
            <select
              value={endHour}
              onChange={(e) => setEndHour(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 font-mono"
            >
              <option value="">(23:59)</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:59
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 hidden sm:inline">Brand:</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 font-medium"
            >
              <option value="all">Semua Brand</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk, SKU, atau brand..."
            className="w-full bg-gray-50/70 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Hourly Sales Distribution Chart */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Distribusi Transaksi Per Jam (Peak Hour)</h3>
            <p className="text-xs text-gray-400">Analisis jam paling ramai / intensitas transaksi harian</p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg font-mono font-medium">
            24 Jam Monitor
          </span>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="hour" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-900 text-white p-2 rounded-xl text-xs shadow-lg">
                        <div className="font-bold">{label}</div>
                        <div className="text-emerald-400">{payload[0].value} pcs terjual</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="qty" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Products Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-800">
            Tabel Rekapitulasi Produk (Terjual vs Rusak vs Retur)
          </h3>
          <span className="text-xs text-gray-400">{filteredData.length} varian produk</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">SKU & Nama Produk</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4 text-center">Qty Terjual</th>
                <th className="py-3 px-4 text-right">Nilai Terjual (Rp)</th>
                <th className="py-3 px-4 text-center">Qty Rusak</th>
                <th className="py-3 px-4 text-center">Qty Retur</th>
                <th className="py-3 px-4 text-center">Sisa Stok</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Memuat data rekap produk...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Tidak ada produk yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.sku} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{row.namaBarang}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{row.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{row.brand}</td>
                    <td className="py-3 px-4 text-center font-black font-mono text-emerald-600 text-sm">
                      {row.qtyTerjual}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                      {formatRupiah(row.nominalTerjual)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono">
                      {row.qtyRusak > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px]">
                          {row.qtyRusak}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono">
                      {row.qtyRetur > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px]">
                          {row.qtyRetur}
                        </span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-gray-800">
                      {row.stokSisa}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.stokSisa <= 5 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold">
                          Kritis
                        </span>
                      ) : row.qtyTerjual > 20 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Fast Moving
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
