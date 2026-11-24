'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatTanggal, formatTanggalWaktu } from '@/shared/lib/utils';
import { FileText, Download, Plus, Trash2, Search, RefreshCw } from 'lucide-react';
import DocumentModalViewer, { DocumentData } from '@/shared/components/documents/DocumentModalViewer';
import { exportToCsv, exportRekapToPdfA4Landscape } from '@/shared/lib/exportDoc';
import DateTimeFilterBar from '@/shared/components/ui/DateTimeFilterBar';
import { isPoTerbuka, PO_STATUS, PO_STATUS_LABEL } from '@/shared/lib/po-status';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

const statusBadge = (status: string) =>
  status === PO_STATUS.SELESAI
    ? 'bg-emerald-100 text-emerald-800'
    : status === PO_STATUS.BATAL
      ? 'bg-gray-100 text-gray-600'
      : status === PO_STATUS.SEBAGIAN
        ? 'bg-sky-100 text-sky-800'
        : 'bg-amber-100 text-amber-800';

// ============================================================
// PAGE: PO & Loading Sheet
// Route: /po-loading
// ============================================================

interface PoHeader {
  id: string;
  noPo: string;
  tanggal: string;
  supplier: string | null;
  armada: string | null;
  status: string;
  catatan: string | null;
  createdBy: string | null;
}

interface InventoryOption {
  sku: string;
  namaBarang: string;
}

interface ItemRow {
  sku: string;
  namaBarang: string;
  qtyOrder: number;
  satuan: string;
}

export default function PoLoading() {
  const [data, setData] = useState<PoHeader[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dari dropdown Barang Masuk (/po-loading?baru=1): langsung buka form PO baru
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('baru') !== '1') return;
    url.searchParams.delete('baru');
    window.history.replaceState(null, '', url.pathname + url.search);
    requestAnimationFrame(() => setIsModalOpen(true));
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterLabel, setFilterLabel] = useState('Semua Waktu');

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [armada, setArmada] = useState('');
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { sku: '', namaBarang: '', qtyOrder: 1, satuan: 'pcs' },
  ]);

  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const itemTime = new Date(item.tanggal).getTime();
      if (startDate && itemTime < new Date(startDate).getTime()) return false;
      if (endDate && itemTime > new Date(endDate).getTime()) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchPo = (item.noPo || '').toLowerCase().includes(q);
        const matchSup = (item.supplier || '').toLowerCase().includes(q);
        const matchArmada = (item.armada || '').toLowerCase().includes(q);
        const matchStatus = (item.status || '').toLowerCase().includes(q);
        if (!matchPo && !matchSup && !matchArmada && !matchStatus) return false;
      }
      return true;
    });
  }, [data, startDate, endDate, search]);

  const handleExportExcel = () => {
    exportToCsv({
      filename: `Rekap_PO_Loading_${new Date().toISOString().slice(0, 10)}`,
      data: filteredData,
      columns: [
        { header: 'No. PO', accessor: (r) => r.noPo },
        { header: 'Tanggal & Jam', accessor: (r) => formatTanggalWaktu(r.tanggal) },
        { header: 'Suplier', accessor: (r) => r.supplier || '-' },
        { header: 'Armada', accessor: (r) => r.armada || '-' },
        { header: 'Status', accessor: (r) => r.status.toUpperCase() },
        { header: 'Catatan', accessor: (r) => r.catatan || '-' },
        { header: 'Petugas', accessor: (r) => r.createdBy || '-' },
      ],
    });
  };

  const handleExportPdfA4 = async () => {
    const rows = filteredData.map((item, idx) => {
      return [
        String(idx + 1),
        formatTanggalWaktu(item.tanggal),
        item.noPo,
        item.supplier || '-',
        item.armada || '-',
        item.status.toUpperCase(),
        item.catatan || '-',
        item.createdBy || 'Petugas PO',
      ];
    });

    const summaryFooter = [
      'TOTAL PURCHASE ORDER',
      '',
      `${filteredData.length} Berkas PO`,
      '',
      '',
      '',
      '',
      '',
    ];

    await exportRekapToPdfA4Landscape({
      title: 'Rekapitulasi Purchase Order (PO) & Loading Sheet Pengadaan',
      divisi: 'Divisi Manufaktur & Distribusi',
      cabang: 'Gudang Pusat',
      periodeFilter: filterLabel || 'Semua Waktu',
      operator: 'Super Administrator',
      columns: [
        'No',
        'Tanggal & Jam',
        'No. PO',
        'Supplier / Produsen',
        'Armada Angkut',
        'Status',
        'Catatan',
        'Dibuat Oleh',
      ],
      rows,
      summaryFooter,
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 32 },
        2: { fontStyle: 'bold', cellWidth: 35 },
        3: { fontStyle: 'bold', cellWidth: 55 },
        4: { cellWidth: 35 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
        6: { cellWidth: 55 },
        7: { cellWidth: 30 },
      },
      filename: `Rekap_PO_Loading_${new Date().toISOString().slice(0, 10)}_A4_Landscape`,
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/po-loading');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat data PO', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory?limit=500');
      const json = await res.json();
      if (json.success) setInventoryList(json.data);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchInventory();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { sku: '', namaBarang: '', qtyOrder: 1, satuan: 'pcs' }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === 'sku') {
        const prod = inventoryList.find((i) => i.sku === value);
        copy[idx] = {
          ...copy[idx],
          sku: value,
          namaBarang: prod ? prod.namaBarang : '',
        };
      } else {
        copy[idx] = { ...copy[idx], [field]: value };
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!supplier) {
      showToast('Nama supplier wajib diisi', 'error');
      return;
    }

    const invalid = items.some((i) => !i.sku || i.qtyOrder <= 0);
    if (invalid) {
      showToast('Lengkapi semua barang dan jumlah order', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/po-loading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal, supplier, armada, catatan, items }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('PO Loading berhasil dibuat!', 'success');
        setIsModalOpen(false);
        setSupplier('');
        setArmada('');
        setCatatan('');
        setItems([{ sku: '', namaBarang: '', qtyOrder: 1, satuan: 'pcs' }]);
        fetchData();
      } else {
        showToast(json.message || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openPoDocument = (detail: any) => {
    setSelectedDocument({
      type: 'po_loading',
      nomor: detail.noPo,
      tanggal: detail.tanggal,
      pihakTerkaitLabel: 'Suplier / Produsen:',
      pihakTerkaitNama: detail.supplier || 'Pabrik Produsen',
      petugasLabel: 'Armada / Ekspedisi:',
      petugasNama: detail.armada || 'Ekspedisi Pengangkut',
      items: (detail.items || []).map((it: any) => ({
        sku: it.sku,
        namaBarang: it.namaBarang,
        qty: it.qtyOrder,
        satuan: it.satuan || 'pcs',
        keterangan: `Diterima: ${it.qtyTerima || 0} ${it.satuan || 'pcs'}`,
      })),
      catatan: detail.catatan || 'Surat Jalan / PO Loading resmi penerimaan barang.',
    });
  };

  const viewDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/po-loading/${id}`);
      const json = await res.json();
      if (json.success) setSelectedDetail(json.data);
    } catch {
      showToast('Gagal memuat detail', 'error');
    }
  };

  // Cetak formulir PO dengan daftar barang asli (detail diambil dari server)
  const printPo = async (id: string) => {
    try {
      const res = await fetch(`/api/po-loading/${id}`);
      const json = await res.json();
      if (json.success) openPoDocument(json.data);
      else showToast(json.message || 'Gagal memuat PO', 'error');
    } catch {
      showToast('Gagal memuat PO', 'error');
    }
  };

  // PO hanya dokumen pemesanan: penerimaan barang lewat Barang Masuk > Barang Datang
  const cancelPo = async (id: string) => {
    if (!confirm('Batalkan PO ini? Sisa barang yang belum datang tidak akan ditunggu lagi.')) return;
    try {
      const res = await fetch(`/api/po-loading/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: PO_STATUS.BATAL }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('PO dibatalkan', 'success');
        setSelectedDetail(null);
        fetchData();
      } else {
        showToast(json.message || 'Gagal membatalkan PO', 'error');
      }
    } catch {
      showToast('Gagal membatalkan PO', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus PO ini?')) return;
    try {
      const res = await fetch(`/api/po-loading/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('PO dihapus', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal menghapus PO', 'error');
      }
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">PO &amp; Loading Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Purchase Order ke pabrik produsen dan daftar loading muatan masuk
          </p>
        </div>
        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={Download} label="Rekap Excel" onClick={handleExportExcel} warna="hijau" />
            <TombolIkon ikon={FileText} label="Ekspor PDF (A4 Landscape)" onClick={handleExportPdfA4} warna="slate" />
          </GrupIkon>
          <TombolUtama ikon={Plus} onClick={() => setIsModalOpen(true)}>
            Buat PO Baru
          </TombolUtama>
        </AksiHeader>
      </div>

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
            placeholder="Cari No. PO, nama supplier, armada angkut, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-gray-50/50"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs text-gray-500">
          <span>
            Menampilkan <strong className="text-gray-900">{filteredData.length}</strong> data
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

      <div
        id="rekap-po-loading-table-container"
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">No. PO</th>
                <th className="py-3.5 px-4">Tanggal & Jam</th>
                <th className="py-3.5 px-4">Supplier / Produsen</th>
                <th className="py-3.5 px-4">Armada Angkut</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <MemuatProgres teks="Memuat daftar PO..." />
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Belum ada Purchase Order aktif pada periode ini
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-gray-800">
                      <button
                        type="button"
                        onClick={() => viewDetail(row.id)}
                        className="text-left font-mono font-bold text-xs text-emerald-700 hover:text-emerald-900 hover:underline transition"
                        title="Buka Dokumen PO & Loading"
                      >
                        {row.noPo}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      {formatTanggalWaktu(row.tanggal)}
                    </td>
                    <td
                      className="py-3.5 px-4 cursor-pointer font-semibold text-gray-800 hover:text-emerald-700 transition"
                      onClick={() => viewDetail(row.id)}
                      title="Klik untuk membuka dokumen PO"
                    >
                      {row.supplier}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600">{row.armada || '-'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(row.status)}`}>
                        {PO_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => printPo(row.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition"
                          title="Buka Formulir PO Loading (Export PDF / PNG A5)"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Cetak A5</span>
                        </button>
                        <button
                          onClick={() => viewDetail(row.id)}
                          className="text-gray-700 hover:text-emerald-800 text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100 transition"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold px-1.5 py-1 rounded hover:bg-red-50 transition"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat PO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl lg:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="font-bold text-gray-800 text-base">Terbitkan Purchase Order (PO Loading)</h2>
                <p className="text-xs text-gray-500">Formulir pesanan stok pengadaan ke produsen / supplier</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 font-bold transition"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:px-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal PO *</label>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Supplier / Pabrik *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT. Sumber Makmur"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Armada / NoPol Pengangkut</label>
                  <input
                    type="text"
                    placeholder="Truk Ekspedisi / B 9999 XX"
                    value={armada}
                    onChange={(e) => setArmada(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Daftar Pesanan Produk Loading
                    </span>
                    <p className="text-[11px] text-gray-400">Pastikan seluruh item dan kuantitas order sesuai kebutuhan gudang</p>
                  </div>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Barang</span>
                  </button>
                </div>

                <div className="bg-slate-50/75 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-2 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-6">Pilih Produk *</div>
                    <div className="col-span-3">Jumlah Order (Qty) *</div>
                    <div className="col-span-2">Satuan</div>
                    <div className="col-span-1 text-center">Aksi</div>
                  </div>

                  <div className="space-y-2">
                    {items.map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-sm"
                      >
                        <div className="col-span-1 sm:col-span-6">
                          <label className="sm:hidden block text-[11px] font-semibold text-gray-600 mb-1">
                            Pilih Produk *
                          </label>
                          <select
                            required
                            value={row.sku}
                            onChange={(e) => updateItemRow(idx, 'sku', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white font-medium"
                          >
                            <option value="">-- Pilih Produk --</option>
                            {inventoryList.map((i) => (
                              <option key={i.sku} value={i.sku}>
                                {i.sku} - {i.namaBarang}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-1 sm:col-span-3">
                          <label className="sm:hidden block text-[11px] font-semibold text-gray-600 mb-1">
                            Jumlah Order (Qty) *
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="Qty Order"
                            value={row.qtyOrder}
                            onChange={(e) => updateItemRow(idx, 'qtyOrder', parseInt(e.target.value) || 0)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="col-span-1 sm:col-span-2">
                          <label className="sm:hidden block text-[11px] font-semibold text-gray-600 mb-1">
                            Satuan
                          </label>
                          <input
                            type="text"
                            placeholder="Satuan"
                            value={row.satuan}
                            onChange={(e) => updateItemRow(idx, 'satuan', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </div>

                        <div className="col-span-1 sm:col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 transition"
                            title="Hapus baris barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan PO..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Terbitkan PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-800">PURCHASE ORDER</h3>
                <div className="text-xs font-mono text-gray-500">No: {selectedDetail.noPo}</div>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>

            <div className="grid grid-cols-2 text-xs gap-3 text-gray-600">
              <div>Tanggal: <strong>{formatTanggal(selectedDetail.tanggal)}</strong></div>
              <div>Supplier: <strong>{selectedDetail.supplier}</strong></div>
              <div>Armada: <strong>{selectedDetail.armada || '-'}</strong></div>
              <div>
                Status:{' '}
                <span className={`px-2 py-0.5 rounded-full font-semibold ${statusBadge(selectedDetail.status)}`}>
                  {PO_STATUS_LABEL[selectedDetail.status] ?? selectedDetail.status}
                </span>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                  <tr>
                    <th className="p-2">Produk</th>
                    <th className="p-2 text-center">Qty Dipesan</th>
                    <th className="p-2 text-center">Qty Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedDetail.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-semibold text-gray-800">{it.namaBarang}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{it.sku}</div>
                      </td>
                      <td className="p-2 text-center font-bold text-gray-700">{it.qtyOrder} {it.satuan}</td>
                      <td className="p-2 text-center text-emerald-600 font-bold">{it.qtyTerima} {it.satuan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isPoTerbuka(selectedDetail.status) && (
              <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                Saat barang tiba, terima lewat menu <strong>Barang Masuk &gt; PO Dalam Proses &gt; Barang Datang</strong>.
                PO otomatis menjadi Faktur Pembelian dan stok bertambah sesuai barang yang diterima.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
              <div className="flex items-center gap-2">
                {isPoTerbuka(selectedDetail.status) && (
                  <button
                    type="button"
                    onClick={() => cancelPo(selectedDetail.id)}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl transition"
                  >
                    Batalkan PO
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openPoDocument(selectedDetail)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  title="Buka Formulir PO Loading resmi ukuran A5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Formulir PO Loading (A5)</span>
                </button>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulir PO Loading Modal Viewer (Export PDF & PNG Kertas A5) */}
      <DocumentModalViewer
        data={selectedDocument}
        isOpen={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
      />
    </div>
  );
}
