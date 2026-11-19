'use client';

// ============================================================
// PAGE: Laporan Penjualan (Detail Laba / Profit / Harga Jual / Diskon)
// Route: /laporan-penjualan
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Percent,
  Calendar,
  Filter,
  Download,
  Printer,
  Search,
  ArrowUpRight,
  RefreshCw,
  ShoppingBag,
  Factory,
  Coffee,
} from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';

interface PenjualanRow {
  id: string;
  trxId: string;
  tanggal: string;
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaJual: string;
  total: string;
  diskon: string;
  pelanggan: string;
  salesman: string;
  keterangan: string;
  subtotalKotor: number;
  nominalDiskon: number;
  hppTotal: number;
  laba: number;
  marginPct: number;
}

interface LaporanSummary {
  totalOmset: number;
  totalHpp: number;
  totalLaba: number;
  totalDiskonNominal: number;
  marginRataRata: number;
  totalTransaksi: number;
  totalQtyTerjual: number;
}

export default function LaporanPenjualanView() {
  const { division, isManufaktur, isFnb } = useDivision();
  const [data, setData] = useState<PenjualanRow[]>([]);
  const [summary, setSummary] = useState<LaporanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters
  const [presetDate, setPresetDate] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSales, setSelectedSales] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('divisi', division);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedSales && selectedSales !== 'all') params.set('salesman', selectedSales);

      const res = await fetch(`/api/laporan/penjualan?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
        setSummary(json.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch sales report', err);
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
  }, [startDate, endDate, selectedSales, division]);

  const salesmenList = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.salesman).filter(Boolean)));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(
      (d) =>
        d.trxId.toLowerCase().includes(search.toLowerCase()) ||
        d.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
        d.pelanggan?.toLowerCase().includes(search.toLowerCase()) ||
        d.sku.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold mb-1 border border-emerald-100">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analisis Finansial & Profitabilitas</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Laporan Penjualan & Laba Bersih
          </h1>
          <p className="text-xs text-gray-500">
            Detail real-time omset penjualan, HPP (Harga Pokok), potongan diskon, dan margin laba bersih.
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
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* 5 Stat Cards Metric */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Omset */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Penjualan (Netto)
          </div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 font-mono">
            {formatRupiah(summary?.totalOmset || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {summary?.totalTransaksi || 0} transaksi &bull; {summary?.totalQtyTerjual || 0} pcs
          </div>
        </div>

        {/* HPP */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total HPP Modal
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-700 font-mono">
            {formatRupiah(summary?.totalHpp || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Modal beli barang terjual</div>
        </div>

        {/* Laba Bersih */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Laba Kotor</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-700 font-mono">
            {formatRupiah(summary?.totalLaba || 0)}
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-1 font-medium">
            Profit penjualan produk
          </div>
        </div>

        {/* Diskon */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Potongan Diskon
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-600 font-mono">
            {formatRupiah(summary?.totalDiskonNominal || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Akumulasi diskon diberikan</div>
        </div>

        {/* Margin */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm col-span-2 lg:col-span-1">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Rata-rata Margin
          </div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 font-mono">
            {summary?.marginRataRata || 0}%
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Rasio profit terhadap omset</div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400 text-xs mr-1 hidden sm:inline">Periode:</span>
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
          <div className="flex items-center gap-2 text-xs">
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

          {/* Kasir / Sales Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 hidden sm:inline">Kasir/Sales:</span>
            <select
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 font-medium"
            >
              <option value="all">Semua Kasir / Sales</option>
              {salesmenList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor transaksi, nama barang, SKU, atau pelanggan..."
            className="w-full bg-gray-50/70 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Tgl & Trx</th>
                <th className="py-3 px-4">Kasir / Sales</th>
                <th className="py-3 px-4">Barang</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                <th className="py-3 px-4 text-right">Diskon</th>
                <th className="py-3 px-4 text-right">Total Netto</th>
                <th className="py-3 px-4 text-right">HPP</th>
                <th className="py-3 px-4 text-right">Laba Bersih</th>
                <th className="py-3 px-4 text-center">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Memuat data laporan penjualan...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    Tidak ada transaksi penjualan pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 font-mono">{row.trxId}</div>
                      <div className="text-[10px] text-gray-400">
                        {formatTanggal(row.tanggal, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{row.salesman || '-'}</div>
                      <div className="text-[10px] text-gray-400">{row.pelanggan || 'Umum'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{row.namaBarang}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{row.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-gray-800">
                      {row.qty} {row.satuan}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-700">
                      {formatRupiah(Number(row.hargaJual))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-600">
                      {row.nominalDiskon > 0
                        ? `- ${formatRupiah(row.nominalDiskon)} (${row.diskon}%)`
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                      {formatRupiah(Number(row.total))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-500">
                      {formatRupiah(row.hppTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatRupiah(row.laba)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.marginPct >= 20
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.marginPct >= 10
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.marginPct}%
                      </span>
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
