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
  Plus,
  X,
  AlertCircle,
  Download,
  FileText,
} from 'lucide-react';
import { formatRupiah, formatTanggal, formatTanggalWaktu } from '@/shared/lib/utils';
import { useDivision } from '@/shared/context/DivisionContext';
import { exportToCsv } from '@/shared/lib/export';
import DocumentModalViewer, { DocumentData } from '@/shared/components/documents/DocumentModalViewer';
import { exportRekapToPdfA4Landscape } from '@/shared/lib/exportDoc';
import DateTimeFilterBar from '@/shared/components/ui/DateTimeFilterBar';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';

export default function LaporanRusakReturView() {
  const { division, isManufaktur, isFnb } = useDivision();
  const [data, setData] = useState<{
    summary?: any;
    alasanBreakdown?: { alasan: string; qty: number }[];
    rusakList?: any[];
    returList?: any[];
  }>({});
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rusak' | 'retur'>('rusak');
  const [search, setSearch] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);

  // Input modal state
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    sku: '',
    namaBarang: '',
    qty: '',
    keterangan: '',
  });

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterLabel, setFilterLabel] = useState('Semua Waktu');

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/inventory?divisi=${division}&limit=500`);
      const json = await res.json();
      if (json.success) setInventoryList(json.data || []);
    } catch {}
  };

  const handleOpenInputModal = () => {
    fetchInventory();
    setIsInputModalOpen(true);
  };

  const handleSkuChange = (sku: string) => {
    const selected = inventoryList.find((i) => i.sku === sku);
    setForm((prev) => ({
      ...prev,
      sku,
      namaBarang: selected ? selected.namaBarang : '',
    }));
  };

  // Dari Faktur Pembelian (Barang Masuk > Barang Datang): "Ada barang cacat/rusak? Ya"
  // -> buka formulir Return terisi suplier & faktur, barang pertama dari faktur terpilih.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const faktur = p.get('returFaktur');
    if (!faktur) return;
    const supplier = p.get('supplier') || '-';
    const skus = (p.get('skus') || '').split(',').filter(Boolean);
    window.history.replaceState(null, '', window.location.pathname);
    fetch(`/api/inventory?divisi=${division}&limit=500`)
      .then((r) => r.json())
      .then((json) => {
        const list = json.success ? json.data || [] : [];
        setInventoryList(list);
        const first = list.find((i: { sku: string }) => i.sku === skus[0]);
        setActiveTab('rusak');
        setForm((prev) => ({
          ...prev,
          sku: first ? first.sku : '',
          namaBarang: first ? first.namaBarang : '',
          qty: '',
          keterangan: `Return ke suplier ${supplier}, faktur ${faktur}: barang cacat/rusak saat diterima.`,
        }));
        setIsInputModalOpen(true);
      })
      .catch(() => setIsInputModalOpen(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat halaman dibuka dari faktur
  }, []);

  const handleSubmitRusak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.qty || parseInt(form.qty, 10) <= 0) {
      alert('Pilih barang dan isi jumlah rusak dengan benar');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/barang-rusak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: form.tanggal,
          sku: form.sku,
          namaBarang: form.namaBarang,
          qty: parseInt(form.qty, 10),
          divisi: division,
          keterangan: form.keterangan,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsInputModalOpen(false);
        setForm({
          tanggal: new Date().toISOString().split('T')[0],
          sku: '',
          namaBarang: '',
          qty: '',
          keterangan: '',
        });
        fetchData();
      } else {
        alert(json.message || 'Gagal menyimpan barang rusak');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('divisi', division);
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
    fetchData();
  }, [startDate, endDate, division]);

  const filteredRusak = useMemo(() => {
    return (data.rusakList || []).filter((r) => {
      const itemTime = new Date(r.tanggal).getTime();
      if (startDate && itemTime < new Date(startDate).getTime()) return false;
      if (endDate && itemTime > new Date(endDate).getTime()) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchNama = (r.namaBarang || '').toLowerCase().includes(q);
        const matchSku = (r.sku || '').toLowerCase().includes(q);
        const matchKet = (r.keterangan || '').toLowerCase().includes(q);
        if (!matchNama && !matchSku && !matchKet) return false;
      }
      return true;
    });
  }, [data.rusakList, search, startDate, endDate]);

  const filteredRetur = useMemo(() => {
    return (data.returList || []).filter((rt) => {
      const itemTime = new Date(rt.tanggal).getTime();
      if (startDate && itemTime < new Date(startDate).getTime()) return false;
      if (endDate && itemTime > new Date(endDate).getTime()) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchNama = (rt.namaBarang || '').toLowerCase().includes(q);
        const matchPel = (rt.pelanggan || '').toLowerCase().includes(q);
        const matchAlasan = (rt.alasan || '').toLowerCase().includes(q);
        const matchSku = (rt.sku || '').toLowerCase().includes(q);
        if (!matchNama && !matchPel && !matchAlasan && !matchSku) return false;
      }
      return true;
    });
  }, [data.returList, search, startDate, endDate]);

  const handleExportExcel = () => {
    if (activeTab === 'rusak') {
      exportToCsv({
        filename: `Laporan_Barang_Rusak_${division}`,
        data: filteredRusak,
        columns: [
          { header: 'Tanggal & Jam', accessor: (r) => formatTanggalWaktu(r.tanggal) },
          { header: 'SKU', accessor: (r) => r.sku },
          { header: 'Nama Produk', accessor: (r) => r.namaBarang },
          { header: 'Jumlah Rusak (Qty)', accessor: (r) => r.qty },
          { header: 'Estimasi Modal Rugi (Rp)', accessor: (r) => Number(r.rugiModal || 0) },
          { header: 'Penyebab / Keterangan', accessor: (r) => r.keterangan || '-' },
          { header: 'Dicatat Oleh', accessor: (r) => r.createdBy || '-' },
        ],
      });
    } else {
      exportToCsv({
        filename: `Laporan_Barang_Retur_${division}`,
        data: filteredRetur,
        columns: [
          { header: 'Tanggal & Jam', accessor: (r) => formatTanggalWaktu(r.tanggal) },
          { header: 'Pelanggan', accessor: (r) => r.pelanggan || '-' },
          { header: 'SKU', accessor: (r) => r.sku },
          { header: 'Nama Produk', accessor: (r) => r.namaBarang },
          { header: 'Jumlah Retur (Qty)', accessor: (r) => r.qty },
          { header: 'Alasan Retur', accessor: (r) => r.alasan || '-' },
          { header: 'Status Persetujuan', accessor: (r) => r.status || '-' },
          { header: 'Dicatat Oleh', accessor: (r) => r.createdBy || '-' },
        ],
      });
    }
  };

  const handleExportPdfA4 = async () => {
    if (activeTab === 'rusak') {
      let totalQty = 0;
      let totalRugi = 0;

      const rows = filteredRusak.map((item, idx) => {
        totalQty += Number(item.qty || 0);
        totalRugi += Number(item.rugiModal || item.estimasiKerugian || 0);
        return [
          String(idx + 1),
          formatTanggalWaktu(item.tanggal),
          `${item.namaBarang} (${item.sku})`,
          `${item.qty} pcs`,
          formatRupiah(item.rugiModal || item.estimasiKerugian || 0),
          item.keterangan || '-',
          item.createdBy || 'Staff Gudang',
        ];
      });

      const summaryFooter = [
        'TOTAL KERUGIAN',
        '',
        `${filteredRusak.length} Item Rusak`,
        `${totalQty.toLocaleString('id-ID')} pcs`,
        formatRupiah(totalRugi),
        '',
        '',
      ];

      await exportRekapToPdfA4Landscape({
        title: 'Rekapitulasi Laporan Barang Terbuang & Rusak',
        divisi: isFnb ? 'Divisi Food & Beverage (F&B)' : 'Divisi Manufaktur & Distribusi',
        cabang: 'Gudang Pusat',
        periodeFilter: filterLabel || 'Semua Waktu',
        operator: 'Super Administrator',
        columns: [
          'No',
          'Tanggal & Jam',
          'Item Barang (SKU)',
          'Jumlah Rusak',
          'Estimasi Rugi',
          'Penyebab / Keterangan',
          'Dicatat Oleh',
        ],
        rows,
        summaryFooter,
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 32 },
          2: { fontStyle: 'bold', cellWidth: 60 },
          3: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
          4: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
          5: { cellWidth: 70 },
          6: { cellWidth: 30 },
        },
        filename: `Rekap_Barang_Rusak_${division}_${new Date().toISOString().slice(0, 10)}_A4_Landscape`,
      });
    } else {
      let totalQtyRetur = 0;

      const rows = filteredRetur.map((item, idx) => {
        totalQtyRetur += Number(item.qty || 0);
        return [
          String(idx + 1),
          formatTanggalWaktu(item.tanggal),
          item.noRetur || `RET-${String(item.id).substring(0, 8).toUpperCase()}`,
          item.pelanggan || '-',
          `${item.namaBarang} (${item.sku})`,
          `${item.qty} pcs`,
          item.alasan || '-',
          item.status || 'Diterima',
          item.createdBy || 'Petugas Gudang',
        ];
      });

      const summaryFooter = [
        'TOTAL RETUR',
        '',
        '',
        '',
        `${filteredRetur.length} Berkas Retur`,
        `${totalQtyRetur.toLocaleString('id-ID')} pcs`,
        '',
        '',
        '',
      ];

      await exportRekapToPdfA4Landscape({
        title: 'Rekapitulasi Laporan Pengembalian Barang Retur Pelanggan',
        divisi: isFnb ? 'Divisi Food & Beverage (F&B)' : 'Divisi Manufaktur & Distribusi',
        cabang: 'Gudang Pusat',
        periodeFilter: filterLabel || 'Semua Waktu',
        operator: 'Super Administrator',
        columns: [
          'No',
          'Tanggal & Jam',
          'No. Retur',
          'Pelanggan / Toko',
          'Item Produk (SKU)',
          'Qty Retur',
          'Alasan Retur',
          'Status',
          'Penerima',
        ],
        rows,
        summaryFooter,
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 30 },
          2: { fontStyle: 'bold', cellWidth: 30 },
          3: { cellWidth: 35 },
          4: { fontStyle: 'bold', cellWidth: 50 },
          5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
          6: { cellWidth: 45 },
          7: { halign: 'center', cellWidth: 22 },
          8: { cellWidth: 25 },
        },
        filename: `Rekap_Barang_Retur_${division}_${new Date().toISOString().slice(0, 10)}_A4_Landscape`,
      });
    }
  };

  const handleViewFormulirReturn = (row: any, isRetur: boolean) => {
    if (isRetur) {
      setSelectedDocument({
        type: 'formulir_return',
        nomor: row.noRetur || `RET-${String(row.id).substring(0, 8).toUpperCase()}`,
        tanggal: row.tanggal,
        pihakTerkaitLabel: 'Pelanggan / Toko:',
        pihakTerkaitNama: row.pelanggan || 'Pelanggan Retur',
        petugasLabel: 'Petugas Penerima:',
        petugasNama: row.createdBy || 'Petugas Gudang',
        items: [
          {
            sku: row.sku,
            namaBarang: row.namaBarang,
            qty: row.qty,
            satuan: 'pcs',
            keterangan: row.alasan || 'Pengembalian barang retur',
          },
        ],
        alasanReturn: row.alasan || 'Pengembalian barang retur dari pelanggan',
        tindakanReturn: `Status: ${row.status || 'Diterima'}`,
        catatan: 'Formulir slip tanda terima retur barang resmi.',
      });
    } else {
      setSelectedDocument({
        type: 'formulir_return',
        nomor: `BA-RSK-${String(row.id).substring(0, 8).toUpperCase()}`,
        tanggal: row.tanggal,
        pihakTerkaitLabel: 'Kategori Kerusakan:',
        pihakTerkaitNama: 'Barang Rusak / Afkir Gudang',
        petugasLabel: 'Pelapor / PIC Gudang:',
        petugasNama: row.createdBy || 'Staff Gudang',
        items: [
          {
            sku: row.sku,
            namaBarang: row.namaBarang,
            qty: row.qty,
            satuan: 'pcs',
            harga: Number(row.hargaBeli || 0),
            total: Number(row.estimasiKerugian || 0),
            keterangan: row.keterangan || 'Barang rusak / kadaluarsa',
          },
        ],
        totalNilai: Number(row.estimasiKerugian || 0),
        alasanReturn: row.keterangan || 'Kerusakan fisik / kadaluarsa',
        tindakanReturn: 'Penyesuaian stok persediaan (stok dikeluarkan dari sistem)',
        catatan: 'Berita acara resmi penghapusan barang rusak dari inventaris gudang.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold mb-1 border border-red-100">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit Kerugian &amp; Kualitas Produk</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Laporan Barang Terbuang, Rusak &amp; Retur
          </h1>
          <p className="text-xs text-gray-500">
            Kompilasi kerugian finansial dari barang rusak, kadaluarsa/afkir, dan barang retur pengembalian pelanggan.
          </p>
        </div>

        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={RefreshCw} label="Segarkan data" onClick={fetchData} putar={loading} />
            <TombolIkon ikon={Download} label="Ekspor Excel" onClick={handleExportExcel} warna="hijau" />
            <TombolIkon ikon={FileText} label="Ekspor PDF (A4 Landscape)" onClick={handleExportPdfA4} warna="slate" />
            <TombolIkon ikon={Printer} label="Cetak laporan" onClick={() => window.print()} />
          </GrupIkon>
          <TombolUtama ikon={Plus} onClick={handleOpenInputModal} warna="merah">
            Catat Barang Rusak
          </TombolUtama>
        </AksiHeader>
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
      <DateTimeFilterBar
        onFilterChange={(sIso, eIso, lbl) => {
          setStartDate(sIso);
          setEndDate(eIso);
          setFilterLabel(lbl);
        }}
      />

      <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama barang, SKU, pelanggan, keterangan, atau alasan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none bg-gray-50/50"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs text-gray-500">
          <span>
            Menampilkan <strong className="text-gray-900">{activeTab === 'rusak' ? filteredRusak.length : filteredRetur.length}</strong> data
          </span>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            title="Refresh Data"
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
          <span>Barang Rusak &amp; Terbuang ({filteredRusak.length})</span>
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

      {/* Container Rekap Laporan untuk Export PDF A4 Landscape */}
      <div id="rekap-rusak-retur-table-container">
        {/* Tab Content: Rusak */}
        {activeTab === 'rusak' && (
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">SKU &amp; Barang</th>
                    <th className="py-3 px-4 text-center">Qty Rusak</th>
                    <th className="py-3 px-4 text-right">Harga Modal (HPP)</th>
                    <th className="py-3 px-4 text-right">Estimasi Kerugian (Rp)</th>
                    <th className="py-3 px-4">Alasan Kerusakan</th>
                    <th className="py-3 px-4">Petugas Gudang</th>
                    <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        Memuat data barang rusak...
                      </td>
                    </tr>
                  ) : filteredRusak.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
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
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewFormulirReturn(row, false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-semibold border border-red-200 transition"
                            title="Buka Berita Acara &amp; Formulir Barang Rusak Kertas A5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>📄 Berita Acara (A5)</span>
                          </button>
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
                    <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        Memuat data retur...
                      </td>
                    </tr>
                  ) : filteredRetur.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
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
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewFormulirReturn(row, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold border border-amber-200 transition"
                            title="Buka Formulir Slip Retur Barang Kertas A5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>📄 Formulir Return (A5)</span>
                          </button>
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

      {/* Modal Input Catat Barang Rusak Baru — Desktop Landscape */}
      {isInputModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl lg:rounded-3xl w-full max-w-lg lg:max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-gray-900">Catat Barang Rusak / Afkir</h3>
                  <p className="text-xs text-gray-500">Stok barang di gudang akan otomatis terpotong</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInputModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-red-100 text-gray-400 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRusak} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Tanggal Kejadian</label>
                      <input
                        type="date"
                        value={form.tanggal}
                        onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-red-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Pilih Barang Rusak <span className="text-red-500">*</span></label>
                      <select
                        value={form.sku}
                        onChange={(e) => handleSkuChange(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-red-500"
                        required
                      >
                        <option value="">-- Pilih Barang dari Inventory --</option>
                        {inventoryList.map((item) => (
                          <option key={item.sku} value={item.sku}>
                            {item.sku} - {item.namaBarang} (Stok: {item.stok} pcs)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Jumlah Rusak (Pcs) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="1"
                        value={form.qty}
                        onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                        placeholder="e.g. 5"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-red-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1">Alasan Kerusakan / Detail Kejadian <span className="text-red-500">*</span></label>
                      <textarea
                        rows={2}
                        value={form.keterangan}
                        onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))}
                        placeholder="e.g. Kemasan bocor saat unloading dari truk / kadaluarsa..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-red-500 resize-none"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsInputModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-800 transition hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Barang Rusak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Modal Viewer Kertas A5 */}
      <DocumentModalViewer
        data={selectedDocument}
        isOpen={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
      />
    </div>
  );
}
