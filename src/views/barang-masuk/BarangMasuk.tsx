'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Camera, Calendar, DollarSign, Building2, CreditCard, CheckCircle2, AlertCircle, Trash2, Sparkles, FileText, Download, Search, RefreshCw, Plus } from 'lucide-react';
import { formatTanggal, formatTanggalWaktu, formatRupiah } from '@/shared/lib/utils';
import { useBarcodeScanner } from '@/shared/hooks/useBarcodeScanner';
import CameraBarcodeScanner from '@/shared/components/ui/CameraBarcodeScanner';
import { ToastFloater, ToastData } from '@/shared/components/ui/ToastFloater';
import DocumentModalViewer, { DocumentData } from '@/shared/components/documents/DocumentModalViewer';
import { exportToCsv, exportRekapToPdfA4Landscape } from '@/shared/lib/exportDoc';
import DateTimeFilterBar from '@/shared/components/ui/DateTimeFilterBar';
import PoDalamProses from './PoDalamProses';
import FormReturPelanggan from './FormReturPelanggan';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';

// ============================================================
// PAGE: Barang Masuk (Purchasing & Penerimaan Stok)
// Route: /barang-masuk
// ============================================================

interface ItemMasuk {
  id: string;
  tanggal: string;
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli: string | number | null;
  totalBeli?: string | number | null;
  supplier: string | null;
  skemaBayar?: 'lunas' | 'hutang' | 'retur' | null;
  jenis?: 'PEMBELIAN' | 'RETUR_PELANGGAN';
  jatuhTempo?: string | null;
  noFaktur: string | null;
  keterangan: string | null;
  createdBy: string | null;
}

interface InventoryOption {
  sku: string;
  namaBarang: string;
  hargaBeli: string | number | null;
  hargaJual?: string | number | null;
  stok?: string | number | null;
  supplier?: string | null;
}

interface SupplierOption {
  id: number;
  nama: string;
  kode?: string;
  telepon?: string;
}

export default function BarangMasuk() {
  // ============================================================
  // SECTION: State & Hooks
  // ============================================================
  const [data, setData] = useState<ItemMasuk[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterLabel, setFilterLabel] = useState('Semua Waktu');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jenisMasuk, setJenisMasuk] = useState<'PEMBELIAN' | 'RETUR'>('PEMBELIAN');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);

  // Form State
  const defaultJatuhTempo = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const initialForm = {
    tanggal: new Date().toISOString().split('T')[0],
    sku: '',
    namaBarang: '',
    qty: '',
    satuan: 'pcs',
    hargaBeli: '',
    supplier: '',
    skemaBayar: 'lunas' as 'lunas' | 'hutang',
    jatuhTempo: defaultJatuhTempo(),
    noFaktur: '',
    keterangan: '',
  };

  const [form, setForm] = useState(initialForm);
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    penyebab?: string,
    title?: string
  ) => {
    setToast({ type, message, penyebab, title });
    setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const matched = inventoryList.find(
      (i) =>
        i.sku.toLowerCase() === clean ||
        i.sku.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')
    );
    if (matched) {
      handleSkuChange(matched.sku);
      showToast('success', `SKU ${matched.sku} terdeteksi`, undefined, 'Scan Barcode Berhasil');
    } else {
      setForm((prev) => ({
        ...prev,
        sku: scannedCode.toUpperCase().trim(),
        namaBarang: prev.namaBarang || scannedCode.toUpperCase().trim(),
      }));
      showToast('info', `Barcode ${scannedCode} dipindai (Barang baru)`, undefined, 'Barcode Baru');
    }
  };

  useBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: isModalOpen,
  });

  // ============================================================
  // SECTION: Fetch Data
  // ============================================================
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);

      const res = await fetch(`/api/barang-masuk?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
      } else {
        showToast('error', 'Gagal memuat riwayat barang masuk', json.error, 'Kesalahan Data');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gangguan jaringan';
      showToast('error', 'Gagal memuat data barang masuk', msg, 'Koneksi Gagal');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory?limit=500');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setInventoryList(json.data);
      }
    } catch {}
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSuppliers(json.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchInventory();
    fetchSuppliers();
  }, [startDate, endDate]);

  // ============================================================
  // SECTION: Handlers
  // ============================================================
  const handleSkuChange = (sku: string) => {
    const selected = inventoryList.find((i) => i.sku === sku);
    setForm((prev) => ({
      ...prev,
      sku,
      namaBarang: selected ? selected.namaBarang : '',
      hargaBeli: selected?.hargaBeli ? String(selected.hargaBeli) : prev.hargaBeli,
      supplier: selected?.supplier || prev.supplier || (suppliers[0]?.nama || ''),
    }));
  };

  const openModal = () => {
    if (suppliers.length === 0) {
      showToast(
        'warning',
        'Belum Ada Suplier Terdaftar!',
        'Aturan bisnis mewajibkan pencatatan barang masuk terhubung dengan Suplier resmi. Daftarkan minimal 1 Suplier di menu "Daftar Suplier" terlebih dahulu.',
        'Pendaftaran Suplier Diperlukan'
      );
      return;
    }

    setForm({
      ...initialForm,
      supplier: suppliers[0]?.nama || '',
    });
    setJenisMasuk('PEMBELIAN');
    setIsModalOpen(true);
  };

  const calculatedTotalBeli = Math.max(0, (Number(form.qty) || 0) * (Number(form.hargaBeli) || 0));

  // Perhitungan Moving Average HPP Real-time
  const selectedInv = inventoryList.find((i) => i.sku === form.sku);
  const curStock = Number(selectedInv?.stok) || 0;
  const curPrice = Number(selectedInv?.hargaBeli) || 0;
  const qtyIn = Number(form.qty) || 0;
  const priceIn = Number(form.hargaBeli) || 0;
  const newStock = curStock + qtyIn;
  const isPriceDifferent = Boolean(
    selectedInv &&
      curPrice > 0 &&
      priceIn > 0 &&
      priceIn !== curPrice
  );
  const estimatedAvg =
    newStock > 0 && curStock > 0
      ? Math.round((curStock * curPrice + qtyIn * priceIn) / newStock)
      : priceIn;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!form.sku.trim() || !form.qty) {
      showToast('warning', 'Formulir belum lengkap', 'Kode SKU dan Jumlah (Qty) barang masuk wajib diisi.', 'Validasi Form');
      return;
    }

    if (!form.supplier?.trim()) {
      showToast('warning', 'Pilih Suplier!', 'Barang masuk wajib mencantumkan asal suplier pemasok.', 'Validasi Form');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tanggal: form.tanggal,
        sku: form.sku.trim().toUpperCase(),
        namaBarang: form.namaBarang.trim(),
        qty: Number(form.qty),
        satuan: form.satuan,
        hargaBeli: Number(form.hargaBeli) || 0,
        totalBeli: calculatedTotalBeli,
        supplier: form.supplier.trim(),
        skemaBayar: form.skemaBayar,
        jatuhTempo: form.skemaBayar === 'hutang' ? form.jatuhTempo : null,
        noFaktur: form.noFaktur.trim() || null,
        keterangan: form.keterangan.trim() || null,
      };

      const res = await fetch('/api/barang-masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        showToast(
          'success',
          `Penerimaan barang ${payload.sku} (${payload.qty} ${payload.satuan}) berhasil dicatat!`,
          payload.skemaBayar === 'lunas'
            ? 'Pengeluaran kas otomatis tercatat di Buku Kas.'
            : `Hutang dagang ke ${payload.supplier} otomatis tercatat di Neraca Liabilitas (Jatuh tempo: ${payload.jatuhTempo}).`,
          'Barang Masuk Berhasil'
        );
        setIsModalOpen(false);
        setForm(initialForm);
        fetchData();
        fetchInventory();
      } else {
        showToast(
          'error',
          json.error || 'Gagal menyimpan barang masuk',
          json.penyebab || 'Server menolak transaksi. Periksa kembali kelengkapan data.',
          'Pencatatan Gagal'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi gangguan jaringan';
      showToast('error', 'Gagal memproses transaksi barang masuk', msg, 'Koneksi Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const row = data.find((d) => d.id === id);
    const pesan =
      row?.jenis === 'RETUR_PELANGGAN'
        ? 'Batalkan retur pelanggan ini? Stok dikurangi kembali, potongan piutang dan refund ikut dibalik.'
        : 'Yakin ingin membatalkan/menghapus data barang masuk ini? Stok inventory akan dikurangi kembali.';
    if (!confirm(pesan)) return;

    try {
      const res = await fetch(`/api/barang-masuk/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Riwayat barang masuk berhasil dihapus dan stok dikembalikan.', undefined, 'Berhasil Dihapus');
        fetchData();
        fetchInventory();
      } else {
        showToast('error', json.message || json.error || 'Gagal menghapus', json.penyebab || 'Data tidak dapat dihapus', 'Hapus Gagal');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gangguan jaringan';
      showToast('error', 'Gagal menghapus data', msg, 'Koneksi Gagal');
    }
  };

  const handleViewPoLoadingDoc = (row: ItemMasuk) => {
    const total = Number(row.totalBeli) || Number(row.qty) * (Number(row.hargaBeli) || 0);
    setSelectedDocument({
      type: 'po_loading',
      nomor: row.noFaktur || `PO-${row.id.substring(0, 8).toUpperCase()}`,
      tanggal: row.tanggal,
      pihakTerkaitLabel: 'Suplier Pemasok:',
      pihakTerkaitNama: row.supplier || 'Suplier Resmi',
      noFakturRef: row.noFaktur,
      skemaBayar: row.skemaBayar || 'lunas',
      jatuhTempo: row.jatuhTempo,
      petugasLabel: 'Petugas Penerima:',
      petugasNama: row.createdBy || 'Petugas Gudang',
      items: [
        {
          sku: row.sku,
          namaBarang: row.namaBarang,
          qty: row.qty,
          satuan: row.satuan,
          harga: Number(row.hargaBeli) || 0,
          total: total,
          keterangan: row.keterangan,
        },
      ],
      totalNilai: total,
      catatan: row.keterangan || 'Muatan barang masuk telah diverifikasi fisik dan dimasukkan ke stok.',
    });
  };

  // Client-side precise filter by datetime and search
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Datetime precision filter
      const itemTime = new Date(item.tanggal).getTime();
      if (startDate && itemTime < new Date(startDate).getTime()) return false;
      if (endDate && itemTime > new Date(endDate).getTime()) return false;

      // Search keyword filter
      if (search) {
        const q = search.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchNama = item.namaBarang.toLowerCase().includes(q);
        const matchSup = (item.supplier || '').toLowerCase().includes(q);
        const matchFaktur = (item.noFaktur || '').toLowerCase().includes(q);
        if (!matchSku && !matchNama && !matchSup && !matchFaktur) return false;
      }

      return true;
    });
  }, [data, startDate, endDate, search]);

  const handleExportExcel = () => {
    exportToCsv({
      filename: `Rekap_Barang_Masuk_${new Date().toISOString().slice(0, 10)}`,
      data: filteredData,
      columns: [
        { header: 'Tanggal & Jam', accessor: (r) => formatTanggalWaktu(r.tanggal) },
        { header: 'No. Faktur / Ref', accessor: (r) => r.noFaktur || '-' },
        { header: 'SKU', accessor: (r) => r.sku },
        { header: 'Nama Barang', accessor: (r) => r.namaBarang },
        { header: 'Jumlah (Qty)', accessor: (r) => r.qty },
        { header: 'Satuan', accessor: (r) => r.satuan },
        { header: 'Harga Beli (Rp)', accessor: (r) => Number(r.hargaBeli || 0) },
        {
          header: 'Total Pembelian (Rp)',
          accessor: (r) => Number(r.totalBeli || Number(r.qty) * Number(r.hargaBeli || 0)),
        },
        { header: 'Suplier Pemasok', accessor: (r) => r.supplier || '-' },
        {
          header: 'Skema Bayar',
          accessor: (r) => (r.skemaBayar === 'hutang' ? 'Hutang (Tempo)' : 'Bayar Lunas (Kas)'),
        },
        {
          header: 'Jatuh Tempo',
          accessor: (r) => (r.jatuhTempo ? formatTanggal(r.jatuhTempo) : '-'),
        },
        { header: 'Petugas Penerima', accessor: (r) => r.createdBy || '-' },
      ],
    });
  };

  const handleExportPdfA4 = async () => {
    let totalQty = 0;
    let totalBeli = 0;

    const rows = filteredData.map((item, idx) => {
      totalQty += Number(item.qty || 0);
      const subtotal = Number(item.totalBeli || Number(item.qty) * Number(item.hargaBeli || 0));
      totalBeli += subtotal;

      return [
        String(idx + 1),
        formatTanggalWaktu(item.tanggal),
        item.noFaktur || '-',
        item.supplier || 'Suplier Resmi',
        `${item.namaBarang} (${item.sku})`,
        `${item.qty} ${item.satuan || 'pcs'}`,
        formatRupiah(Number(item.hargaBeli || 0)),
        formatRupiah(subtotal),
        item.skemaBayar === 'hutang' ? 'Hutang (Tempo)' : 'Lunas (Kas)',
      ];
    });

    const summaryFooter = [
      'TOTAL REKAPITULASI',
      '',
      '',
      '',
      `${filteredData.length} Penerimaan`,
      `${totalQty.toLocaleString('id-ID')} pcs`,
      '',
      formatRupiah(totalBeli),
      '',
    ];

    await exportRekapToPdfA4Landscape({
      title: 'Rekapitulasi Barang Masuk, Pembelian & PO Loading Suplier',
      divisi: 'Divisi Manufaktur (Pabrik & Distribusi)',
      cabang: 'Gudang Pusat',
      periodeFilter: filterLabel || 'Semua Waktu',
      operator: 'Super Administrator',
      columns: [
        'No',
        'Tanggal & Jam',
        'No. Faktur / Ref',
        'Suplier Pemasok',
        'Item Barang (SKU)',
        'Qty Masuk',
        'Harga Beli (Rp)',
        'Total Beli (Rp)',
        'Skema Bayar',
      ],
      rows,
      summaryFooter,
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 26 },
        3: { cellWidth: 38 },
        4: { fontStyle: 'bold', cellWidth: 55 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 28 },
        7: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
        8: { halign: 'center', cellWidth: 30 },
      },
      filename: `Rekap_Barang_Masuk_${new Date().toISOString().slice(0, 10)}_A4_Landscape`,
    });
  };

  // ============================================================
  // SECTION: Render
  // ============================================================
  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Toast Alert Floater dengan Keterangan & Penyebab */}
      <ToastFloater toast={toast} onClose={() => setToast(null)} />

      {/* 1. Header (F-Pattern Top Row — Tata Letak Proporsional & Rapi) */}
      <header className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Purchasing &amp; Inbound
            </span>
            <span className="text-xs text-gray-400">&bull; Integrasi Kas &amp; Neraca Otomatis</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Barang Masuk &amp; PO Loading</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Pencatatan stok masuk dari Suplier resmi dengan skema bayar Tunai Lunas (Kas) atau Hutang Dagang (Credit).
          </p>
        </div>

        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={Download} label="Rekap Excel" onClick={handleExportExcel} warna="hijau" />
            <TombolIkon ikon={FileText} label="Ekspor PDF (A4 Landscape)" onClick={handleExportPdfA4} warna="slate" />
            <TombolIkon ikon={Building2} label={`Data suplier (${suppliers.length})`} href="/suplier" />
          </GrupIkon>
          <TombolUtama ikon={Plus} onClick={openModal}>
            Catat Barang Masuk
          </TombolUtama>
        </AksiHeader>
      </header>

      {/* PO Dalam Proses: "Barang Datang" -> Faktur Pembelian -> stok masuk */}
      <PoDalamProses
        onReceived={fetchData}
        notify={(type, message, penyebab) => showToast(type, message, penyebab)}
      />

      {/* 2. Filter Periode Custom Fleksibel: Jam, Hari, Minggu, Bulan, Tahun */}
      <DateTimeFilterBar
        initialPreset="ALL"
        onFilterChange={(sIso, eIso, lbl) => {
          setStartDate(sIso);
          setEndDate(eIso);
          setFilterLabel(lbl);
        }}
      />

      {/* 3. Pencarian Cepat & Info Total Data */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari SKU, Nama Barang, Suplier, No Faktur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-gray-50/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs text-gray-500">
          <span>
            Menampilkan <strong className="text-gray-900">{filteredData.length}</strong> dari{' '}
            <strong className="text-gray-900">{data.length}</strong> transaksi masuk
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

      {/* 4. Table Section (F-Pattern Reading Grid) */}
      <section
        id="rekap-barang-masuk-table-container"
        aria-label="Daftar Riwayat Barang Masuk"
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal &amp; Waktu</th>
                <th className="py-3.5 px-4">SKU / Nama Barang</th>
                <th className="py-3.5 px-4">Jumlah</th>
                <th className="py-3.5 px-4">Harga Beli &amp; Total</th>
                <th className="py-3.5 px-4">Suplier Pemasok</th>
                <th className="py-3.5 px-4">Skema Bayar</th>
                <th className="py-3.5 px-4">No. Faktur</th>
                <th className="py-3.5 px-4">Petugas</th>
                <th className="py-3.5 px-4 text-center">Aksi &amp; Dokumen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-gray-500">Memuat data barang masuk...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <p className="font-semibold text-gray-600 text-base">Belum ada riwayat barang masuk</p>
                    <p className="text-xs text-gray-400 mt-1">Belum ada transaksi barang masuk pada rentang waktu yang dipilih.</p>
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => {
                  const total = Number(row.totalBeli) || (Number(row.qty) * (Number(row.hargaBeli) || 0));
                  return (
                    <tr key={row.id} className="hover:bg-emerald-50/30 transition group">
                      <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                        {formatTanggal(row.tanggal)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {row.namaBarang}
                        </div>
                        <div className="text-xs font-mono text-emerald-700">{row.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap">
                        +{row.qty} {row.satuan}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{formatRupiah(total)}</div>
                        <div className="text-[11px] text-gray-400">@{formatRupiah(row.hargaBeli)}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-800">
                        {row.supplier && row.jenis === 'RETUR_PELANGGAN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-medium border border-amber-200">
                            👤 {row.supplier}
                          </span>
                        ) : row.supplier ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 font-medium border border-blue-200">
                            🏢 {row.supplier}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.jenis === 'RETUR_PELANGGAN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Retur Pelanggan
                          </span>
                        ) : row.skemaBayar === 'hutang' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Hutang (Tempo)
                            </span>
                            {row.jatuhTempo && (
                              <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
                                Tempo: {formatTanggal(row.jatuhTempo)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Lunas (Kas)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-gray-600 whitespace-nowrap">
                        {row.noFaktur || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">{row.createdBy || '-'}</td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewPoLoadingDoc(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition"
                            title="Buka Formulir PO Loading (Export PDF / PNG A5)"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Formulir PO</span>
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg text-xs font-semibold transition"
                            title="Hapus riwayat barang masuk"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <footer className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Menampilkan <strong>{data.length}</strong> transaksi barang masuk</span>
          <span className="text-[11px] text-gray-400">Semua transaksi terintegrasi dengan Kas, Neraca, dan Master Stok</span>
        </footer>
      </section>

      {/* ============================================================ */}
      {/* SECTION: Modal Tambah Barang Masuk (Desktop Landscape 2 Kolom) */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg lg:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header (Fixed Top) */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-900 text-base lg:text-lg">
                  Catat Barang Masuk ({jenisMasuk === 'RETUR' ? 'Retur Pelanggan' : 'Purchasing'})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {jenisMasuk === 'RETUR'
                    ? 'Barang dikembalikan pelanggan: stok, piutang, kas, dan menu Retur Barang diperbarui sekaligus.'
                    : 'Input muatan masuk dari Suplier, tentukan harga beli dan skema pembayaran (Kas / Hutang).'}
                </p>
                <div className="mt-3 inline-flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Jenis barang masuk">
                  {([
                    ['PEMBELIAN', '1. Purchasing'],
                    ['RETUR', '2. Retur dari Pelanggan'],
                  ] as const).map(([v, t]) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={jenisMasuk === v}
                      onClick={() => setJenisMasuk(v)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                        jenisMasuk === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Landscape 2 Columns on Desktop) */}
            {jenisMasuk === 'RETUR' ? (
              <FormReturPelanggan
                inventoryList={inventoryList}
                showToast={showToast}
                onBatal={() => setIsModalOpen(false)}
                onTersimpan={() => {
                  setIsModalOpen(false);
                  fetchData();
                  fetchInventory();
                }}
              />
            ) : (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                  {/* Kolom Kiri: Produk, Tanggal & Jumlah */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Informasi Barang &amp; Qty</span>
                    </div>

                    {/* Pilih Produk / SKU */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Pilih Produk / SKU <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCameraOpen(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                          title="Scan Barcode menggunakan Kamera HP / Web"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Scan Barcode</span>
                        </button>
                      </div>
                      <select
                        required
                        value={form.sku}
                        onChange={(e) => handleSkuChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition bg-white font-medium text-gray-800"
                      >
                        <option value="">-- Pilih Barang dari Master Inventory --</option>
                        {inventoryList.map((item) => (
                          <option key={item.sku} value={item.sku}>
                            {item.sku} - {item.namaBarang}
                          </option>
                        ))}
                      </select>
                      {form.sku && !inventoryList.some((i) => i.sku === form.sku) && (
                        <div className="text-[11px] text-amber-600 mt-1 font-medium">
                          * SKU baru: {form.sku} (akan otomatis didaftarkan ke inventory)
                        </div>
                      )}
                    </div>

                    {/* Tanggal & Jumlah Qty */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Tanggal Masuk <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={form.tanggal}
                          onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Jumlah (Qty) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="0"
                            value={form.qty}
                            onChange={(e) => setForm({ ...form, qty: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition font-bold text-gray-800"
                          />
                          <select
                            value={form.satuan}
                            onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                            className="w-24 px-2 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none bg-white font-medium"
                          >
                            <option value="pcs">pcs</option>
                            <option value="karton">karton</option>
                            <option value="pack">pack</option>
                            <option value="kg">kg</option>
                            <option value="liter">liter</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Harga Beli Satuan (Modal ke Suplier) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Harga Beli Satuan (Rp) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Harga beli modal per satuan"
                        value={form.hargaBeli}
                        onChange={(e) => setForm({ ...form, hargaBeli: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition font-semibold"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Harga yang <strong>dibayar kepada Suplier</strong> untuk 1 {form.satuan}.
                      </p>
                    </div>

                    {/* Banner Strategi Penerapan: Moving Weighted Average Costing */}
                    {isPriceDifferent && (
                      <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1.5 text-blue-900 animate-in fade-in shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold text-blue-950">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Penerapan Strategi: Moving Average HPP</span>
                        </div>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          Harga beli muatan ini (<strong>{formatRupiah(priceIn)}</strong>) berbeda dengan HPP Master saat ini (<strong>{formatRupiah(curPrice)}</strong>).
                          Sistem akan otomatis menghitung HPP rata-rata tertimbang agar nilai neraca persediaan gudang akurat.
                        </p>
                        {qtyIn > 0 && (
                          <div className="pt-1.5 border-t border-blue-200/80 flex items-center justify-between text-[11px]">
                            <span className="text-blue-700">Estimasi HPP Rata-Rata Baru:</span>
                            <span className="font-bold text-blue-950 text-xs">
                              {formatRupiah(estimatedAvg)} / {form.satuan}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Highlight Total Nilai Pembelian */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          Total Nilai Pembelian
                        </div>
                        <div className="text-[10px] text-emerald-600 mt-0.5">
                          {form.qty || 0} {form.satuan} &times; {formatRupiah(form.hargaBeli || 0)}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-emerald-800">
                        {formatRupiah(calculatedTotalBeli)}
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan: Suplier, Skema Bayar & Catatan */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Suplier &amp; Skema Pembayaran</span>
                    </div>

                    {/* Pilih Suplier Resmi */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Suplier Pemasok <span className="text-red-500">*</span>
                        </label>
                        <Link
                          href="/suplier"
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                        >
                          + Kelola Suplier
                        </Link>
                      </div>
                      <select
                        required
                        value={form.supplier}
                        onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition bg-white font-medium text-gray-800"
                      >
                        <option value="">-- Pilih Suplier Resmi --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.nama}>
                            {s.nama} {s.kode ? `(${s.kode})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pilihan Skema Pembayaran: LUNAS vs HUTANG */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Skema Bayar ke Suplier <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Option 1: Bayar Lunas (Kas) */}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, skemaBayar: 'lunas' })}
                          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                            form.skemaBayar === 'lunas'
                              ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-200'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-gray-900">Bayar Lunas</span>
                            {form.skemaBayar === 'lunas' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-300" />
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Kas / Bank berkurang otomatis
                          </p>
                        </button>

                        {/* Option 2: Hutang / Credit */}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, skemaBayar: 'hutang' })}
                          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                            form.skemaBayar === 'hutang'
                              ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-200'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-gray-900">Hutang / Credit</span>
                            {form.skemaBayar === 'hutang' ? (
                              <CheckCircle2 className="w-4 h-4 text-amber-600" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-300" />
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Masuk Hutang Dagang &amp; Neraca
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Jika Skema Hutang: Input Tanggal Jatuh Tempo */}
                    {form.skemaBayar === 'hutang' && (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                        <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                          Tanggal Jatuh Tempo Pembayaran <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={form.jatuhTempo}
                          onChange={(e) => setForm({ ...form, jatuhTempo: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-amber-300 text-sm focus:border-amber-500 outline-none bg-white font-medium"
                        />
                        <p className="text-[10px] text-amber-700">
                          Batas akhir pelunasan hutang pembelian barang ke suplier.
                        </p>
                      </div>
                    )}

                    {/* No Faktur & Catatan */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Nomor Faktur / Surat Jalan Suplier
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: INV/2026/001 atau SJ-998"
                        value={form.noFaktur}
                        onChange={(e) => setForm({ ...form, noFaktur: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                        Catatan / Keterangan
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Catatan kondisi muatan, lokasi penerimaan, dll..."
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm focus:border-emerald-500 outline-none transition resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition disabled:opacity-50 shadow-md shadow-emerald-600/20 flex items-center gap-2"
                >
                  {submitting && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Simpan Barang Masuk</span>
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleBarcodeScanned}
        title="Pindai Barcode Barang Masuk"
      />

      {/* Formulir PO Loading Modal Viewer (Export PDF & PNG Kertas A5) */}
      <DocumentModalViewer
        data={selectedDocument}
        isOpen={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
      />
    </div>
  );
}
