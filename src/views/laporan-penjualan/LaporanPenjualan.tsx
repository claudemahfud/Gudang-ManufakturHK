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
  FileText,
} from 'lucide-react';
import { formatRupiah, formatTanggal, formatTanggalWaktu } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import { exportToCsv } from '@/shared/lib/export';
import { exportRekapToPdfA4Landscape } from '@/shared/lib/exportDoc';
import DateTimeFilterBar from '@/shared/components/ui/DateTimeFilterBar';
import { AksiHeader, GrupIkon, TombolIkon } from '@/shared/components/ui/AksiHeader';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterLabel, setFilterLabel] = useState('Semua Waktu');
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
    fetchData();
  }, [startDate, endDate, selectedSales, division]);

  const salesmenList = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.salesman).filter(Boolean)));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((d) => {
      // Datetime precision filter
      const itemTime = new Date(d.tanggal).getTime();
      if (startDate && itemTime < new Date(startDate).getTime()) return false;
      if (endDate && itemTime > new Date(endDate).getTime()) return false;

      // Search keyword filter
      if (search) {
        const q = search.toLowerCase();
        const matchTrx = d.trxId.toLowerCase().includes(q);
        const matchNama = d.namaBarang.toLowerCase().includes(q);
        const matchPel = (d.pelanggan || '').toLowerCase().includes(q);
        const matchSku = d.sku.toLowerCase().includes(q);
        if (!matchTrx && !matchNama && !matchPel && !matchSku) return false;
      }

      return true;
    });
  }, [data, startDate, endDate, search]);

  const handleExportExcel = () => {
    exportToCsv({
      filename: `Laporan_Penjualan_${division}_${new Date().toISOString().slice(0, 10)}`,
      data: filteredData,
      columns: [
        { header: 'No. Transaksi', accessor: (r) => r.trxId },
        { header: 'Tanggal & Jam', accessor: (r) => formatTanggalWaktu(r.tanggal) },
        { header: 'Pelanggan', accessor: (r) => r.pelanggan || '-' },
        { header: 'Salesman / Kasir', accessor: (r) => r.salesman || '-' },
        { header: 'SKU', accessor: (r) => r.sku },
        { header: 'Nama Produk', accessor: (r) => r.namaBarang },
        { header: 'Qty', accessor: (r) => r.qty },
        { header: 'Satuan', accessor: (r) => r.satuan },
        { header: 'Harga Satuan (Rp)', accessor: (r) => Number(r.hargaJual || 0) },
        { header: 'Diskon (%)', accessor: (r) => Number(r.diskon || 0) },
        { header: 'Total Netto (Rp)', accessor: (r) => Number(r.total || 0) },
        { header: 'Estimasi HPP (Rp)', accessor: (r) => r.hppTotal },
        { header: 'Laba Kotor (Rp)', accessor: (r) => r.laba },
        { header: 'Margin (%)', accessor: (r) => `${r.marginPct}%` },
      ],
    });
  };

  const handleExportPdfA4Landscape = async () => {
    let totalQty = 0;
    let totalNetto = 0;
    let totalHpp = 0;
    let totalLaba = 0;

    const rows = filteredData.map((r, idx) => {
      totalQty += Number(r.qty || 0);
      totalNetto += Number(r.total || 0);
      totalHpp += Number(r.hppTotal || 0);
      totalLaba += Number(r.laba || 0);

      return [
        String(idx + 1),
        formatTanggalWaktu(r.tanggal),
        r.trxId,
        r.pelanggan ? `${r.pelanggan}${r.salesman ? ` (${r.salesman})` : ''}` : r.salesman || '-',
        `${r.namaBarang} (${r.sku})`,
        `${r.qty} ${r.satuan}`,
        formatRupiah(Number(r.hargaJual || 0)),
        r.diskon && Number(r.diskon) > 0 ? `${r.diskon}%` : '-',
        formatRupiah(Number(r.total || 0)),
        formatRupiah(Number(r.hppTotal || 0)),
        formatRupiah(Number(r.laba || 0)),
        `${r.marginPct}%`,
      ];
    });

    const avgMargin = totalNetto > 0 ? ((totalLaba / totalNetto) * 100).toFixed(1) : '0';

    const summaryFooter = [
      'TOTAL REKAPITULASI',
      '',
      '',
      '',
      `${filteredData.length} Transaksi`,
      `${totalQty.toLocaleString('id-ID')} pcs`,
      '',
      '',
      formatRupiah(totalNetto),
      formatRupiah(totalHpp),
      formatRupiah(totalLaba),
      `${avgMargin}%`,
    ];

    await exportRekapToPdfA4Landscape({
      title: 'Rekapitulasi Laporan Penjualan, HPP Modal & Laba Bersih',
      divisi: isManufaktur ? 'Divisi Manufaktur (Pabrik)' : 'Divisi F&B Hub',
      cabang: 'Gudang Pusat',
      periodeFilter: filterLabel || 'Semua Waktu',
      operator: 'Super Administrator',
      columns: [
        'No',
        'Tanggal & Jam',
        'No. Trx',
        'Pelanggan / Sales',
        'Item Barang (SKU)',
        'Qty',
        'Harga (Rp)',
        'Diskon',
        'Netto (Rp)',
        'HPP (Rp)',
        'Laba (Rp)',
        'Margin',
      ],
      rows,
      summaryFooter,
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'center', cellWidth: 24 },
        3: { cellWidth: 32 },
        4: { fontStyle: 'bold', cellWidth: 46 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'center', cellWidth: 14 },
        8: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        9: { halign: 'right', cellWidth: 22 },
        10: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        11: { halign: 'center', fontStyle: 'bold', cellWidth: 17 },
      },
      filename: `Laporan_Penjualan_${division}_${new Date().toISOString().slice(0, 10)}_A4_Landscape`,
    });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* 1. Header (F-Pattern Top Row — Tata Letak Proporsional & Rapi) */}
      <header className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold mb-1 border border-emerald-100">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analisis Finansial &amp; Profitabilitas</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Laporan Penjualan &amp; Laba Bersih
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Detail real-time omset penjualan, HPP (Harga Pokok), potongan diskon, dan margin laba bersih.
          </p>
        </div>

        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={Download} label="Rekap Excel" onClick={handleExportExcel} warna="hijau" />
            <TombolIkon ikon={FileText} label="Ekspor PDF (A4 Landscape)" onClick={handleExportPdfA4Landscape} warna="slate" />
            <TombolIkon ikon={Printer} label="Cetak laporan" onClick={() => window.print()} />
          </GrupIkon>
        </AksiHeader>
      </header>

      {/* 2. Filter Periode Custom Fleksibel: Jam, Hari, Minggu, Bulan, Tahun */}
      <DateTimeFilterBar
        initialPreset="THIS_MONTH"
        onFilterChange={(sIso, eIso, lbl) => {
          setStartDate(sIso);
          setEndDate(eIso);
          setFilterLabel(lbl);
        }}
      />

      {/* 2. Stat Cards Metric (Grid Layout Archetype) */}
      <section aria-label="Ringkasan Metrik Laba" className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Omset */}
        <article className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Penjualan (Netto)
          </div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 font-mono">
            {formatRupiah(summary?.totalOmset || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {summary?.totalTransaksi || 0} transaksi &bull; {summary?.totalQtyTerjual || 0} pcs
          </div>
        </article>

        {/* HPP */}
        <article className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total HPP Modal
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-700 font-mono">
            {formatRupiah(summary?.totalHpp || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Modal beli barang terjual</div>
        </article>

        {/* Laba Bersih */}
        <article className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
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
        </article>

        {/* Diskon */}
        <article className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Potongan Diskon
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-600 font-mono">
            {formatRupiah(summary?.totalDiskonNominal || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Akumulasi diskon diberikan</div>
        </article>

        {/* Margin */}
        <article className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm col-span-2 lg:col-span-1">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Rata-rata Margin
          </div>
          <div className="text-lg sm:text-xl font-bold text-gray-900 font-mono">
            {summary?.marginRataRata || 0}%
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Rasio profit terhadap omset</div>
        </article>
      </section>

      {/* 3. Filter Sales & Pencarian (F-Pattern Second Row) */}
      <section aria-label="Filter Kasir dan Pencarian" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor transaksi, nama barang, SKU, atau pelanggan..."
            className="w-full bg-gray-50/70 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Kasir / Sales Filter & Info */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-semibold hidden sm:inline">Kasir/Sales:</span>
            <select
              value={selectedSales}
              onChange={(e) => setSelectedSales(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 font-semibold outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Kasir &amp; Sales</option>
              {salesmenList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <span className="text-gray-500">
            Menampilkan <strong className="text-gray-900">{filteredData.length}</strong> data
          </span>
        </div>
      </section>

      {/* 4. Data Table (F-Pattern Reading Grid) */}
      <section id="rekap-penjualan-table-container" aria-label="Tabel Laporan Penjualan" className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
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
                    <MemuatProgres teks="Memuat data laporan penjualan..." />
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

        {/* Semantic Table Footer */}
        <footer className="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Menampilkan <strong>{filteredData.length}</strong> baris transaksi penjualan</span>
          <span className="text-[11px] text-gray-400">Nilai HPP dan laba otomatis disanitasi dari akun bawahan</span>
        </footer>
      </section>
    </div>
  );
}
