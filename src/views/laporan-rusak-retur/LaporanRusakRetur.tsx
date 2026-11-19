'use client';

// ============================================================
// PAGE: Laporan Barang Terbuang / Rusak / Retur
// Route: /laporan-rusak-retur
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  RotateCcw,
  RefreshCw,
  Printer,
  Search,
  DollarSign,
  TrendingDown,
  Calendar,
} from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';

export default function LaporanRusakReturView() {
  const [data, setData] = useState<{
    summary?: any;
    alasanBreakdown?: { alasan: string; qty: number }[];
    rusakList?: any[];
    returList?: any[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rusak' | 'retur'>('rusak');
  const [search, setSearch] = useState('');

  // Filters
  const [presetDate, setPresetDate] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/laporan/rusak-retur?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch damaged/returned report', err);
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
  }, [startDate, endDate]);

  const filteredRusak = useMemo(() => {
    return (data.rusakList || []).filter(
      (r) =>
        r.namaBarang?.toLowerCase().includes(search.toLowerCase()) ||
        r.sku?.toLowerCase().includes(search.toLowerCase()) ||
        r.keterangan?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data.rusakList, search]);

  const filteredRetur = useMemo(() => {
    return (data.returList || []).filter(
      (rt) =>
        rt.namaBarang?.toLowerCase().includes(search.toLowerCase()) ||
        rt.pelanggan?.toLowerCase().includes(search.toLowerCase()) ||
        rt.alasan?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data.returList, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold mb-1 border border-red-100">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit Kerugian & Kualitas Produk</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Laporan Barang Terbuang, Rusak & Retur
          </h1>
          <p className="text-xs text-gray-500">
            Kompilasi kerugian finansial dari barang rusak, kadaluarsa/afkir, dan barang retur pengembalian pelanggan.
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

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Qty Barang Rusak
          </div>
          <div className="text-xl sm:text-2xl font-bold text-red-600 font-mono">
            {data.summary?.totalQtyRusak || 0}{' '}
            <span className="text-xs text-gray-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Barang pecah / bocor / afkir</div>
        </div>

        <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200 shadow-sm">
          <div className="text-[11px] font-bold text-red-800 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Estimasi Kerugian Modal</span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-red-700 font-mono">
            {formatRupiah(data.summary?.totalKerugianRusak || 0)}
          </div>
          <div className="text-[10px] text-red-700/80 mt-1 font-medium">
            Nilai HPP modal yang hilang
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Qty Retur Pelanggan
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 font-mono">
            {data.summary?.totalQtyRetur || 0}{' '}
            <span className="text-xs text-gray-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {data.summary?.totalKasusRetur || 0} berkas pengembalian
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Status Audit
          </div>
          <div className="text-sm font-bold text-gray-800 flex items-center gap-2 mt-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Tersinkronisasi</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Database gudang live</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
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

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama barang, SKU, pelanggan, atau alasan..."
            className="w-full bg-gray-50/70 border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('rusak')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'rusak'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Barang Rusak & Terbuang ({filteredRusak.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('retur')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'retur'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Barang Retur Pelanggan ({filteredRetur.length})</span>
        </button>
      </div>

      {/* Tab Content: Rusak */}
      {activeTab === 'rusak' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">SKU & Barang</th>
                  <th className="py-3 px-4 text-center">Qty Rusak</th>
                  <th className="py-3 px-4 text-right">Harga Modal (HPP)</th>
                  <th className="py-3 px-4 text-right">Estimasi Kerugian (Rp)</th>
                  <th className="py-3 px-4">Alasan Kerusakan</th>
                  <th className="py-3 px-4">Petugas Gudang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Memuat data barang rusak...
                    </td>
                  </tr>
                ) : filteredRusak.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Tidak ada catatan barang rusak pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredRusak.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 text-gray-500 font-medium whitespace-nowrap">
                        {formatTanggal(row.tanggal)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{row.namaBarang}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-black font-mono text-red-600 text-sm">
                        {row.qty} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {formatRupiah(Number(row.hargaBeli || 0))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-700">
                        {formatRupiah(row.estimasiKerugian)}
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {row.keterangan || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium">
                        {row.createdBy || 'Staff Gudang'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Retur */}
      {activeTab === 'retur' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">No Retur</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4 text-center">Qty Retur</th>
                  <th className="py-3 px-4">Alasan Retur</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Memuat data retur...
                    </td>
                  </tr>
                ) : filteredRetur.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      Tidak ada catatan retur barang pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredRetur.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 text-gray-500 font-medium whitespace-nowrap">
                        {formatTanggal(row.tanggal)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {row.noRetur || '-'}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {row.pelanggan || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{row.namaBarang}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-black font-mono text-amber-600 text-sm">
                        {row.qty} pcs
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {row.alasan || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === 'selesai' || row.status === 'disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
