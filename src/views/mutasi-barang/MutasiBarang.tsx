'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatTanggal, formatTanggalWaktu } from '@/shared/lib/utils';
import { FileText, Download, ArrowLeftRight, Search, RefreshCw } from 'lucide-react';
import DocumentModalViewer, { DocumentData } from '@/shared/components/documents/DocumentModalViewer';
import { exportToCsv, exportRekapToPdfA4Landscape } from '@/shared/lib/exportDoc';
import DateTimeFilterBar from '@/shared/components/ui/DateTimeFilterBar';

// ============================================================
// PAGE: Mutasi Barang
// Route: /mutasi-barang
// ============================================================

interface ItemMutasi {
  id: string;
  tanggal: string;
  sku: string;
  namaBarang: string;
  qty: number;
  dari: string;
  ke: string;
  keterangan: string | null;
  createdBy: string | null;
}

interface InventoryOption {
  sku: string;
  namaBarang: string;
  stok: number;
}

export default function MutasiBarang() {
  const [data, setData] = useState<ItemMutasi[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterLabel, setFilterLabel] = useState('Semua Waktu');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    sku: '',
    namaBarang: '',
    qty: '',
    dari: '',
    ke: '',
    keterangan: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);

  // Client-side precise filter by datetime and search
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Datetime precision filter
      const itemTime = new Date(item.tanggal).getTime();
      if (startDate && itemTime < new Date(startDate).getTime()) return false;
      if (endDate && itemTime > new Date(endDate).getTime()) return false;

      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchNama = item.namaBarang.toLowerCase().includes(q);
        const matchDari = (item.dari || '').toLowerCase().includes(q);
        const matchKe = (item.ke || '').toLowerCase().includes(q);
        const matchKet = (item.keterangan || '').toLowerCase().includes(q);
        if (!matchSku && !matchNama && !matchDari && !matchKe && !matchKet) return false;
      }

      return true;
    });
  }, [data, startDate, endDate, search]);

  const handleViewFakturMutasi = (row: ItemMutasi) => {
    setSelectedDocument({
      type: 'faktur_mutasi',
      nomor: `MUT-${row.id.substring(0, 8).toUpperCase()}`,
      tanggal: row.tanggal,
      pihakTerkaitLabel: 'Cabang Tujuan:',
      pihakTerkaitNama: row.ke || 'Cabang Tujuan',
      kontakInfo: `Asal Pengiriman: ${row.dari || 'Gudang Pusat'}`,
      petugasLabel: 'Operator Pengirim:',
      petugasNama: row.createdBy || 'Petugas Mutasi',
      items: [
        {
          sku: row.sku,
          namaBarang: row.namaBarang,
          qty: row.qty,
          satuan: 'pcs',
          keterangan: `Mutasi dari ${row.dari} ke ${row.ke}`,
        },
      ],
      catatan: row.keterangan || 'Surat Jalan / Faktur Mutasi resmi perpindahan stok antar unit cabang.',
    });
  };

  const handleExportExcel = () => {
    exportToCsv({
      filename: `Rekap_Mutasi_Barang_${new Date().toISOString().slice(0, 10)}`,
      data: filteredData,
      columns: [
        { header: 'Tanggal & Jam', accessor: (r) => formatTanggalWaktu(r.tanggal) },
        { header: 'SKU', accessor: (r) => r.sku },
        { header: 'Nama Barang', accessor: (r) => r.namaBarang },
        { header: 'Jumlah (Qty)', accessor: (r) => r.qty },
        { header: 'Dari Lokasi', accessor: (r) => r.dari },
        { header: 'Ke Lokasi', accessor: (r) => r.ke },
        { header: 'Keterangan', accessor: (r) => r.keterangan || '-' },
        { header: 'Operator', accessor: (r) => r.createdBy || '-' },
      ],
    });
  };

  const handleExportPdfA4 = async () => {
    let totalQty = 0;

    const rows = filteredData.map((item, idx) => {
      totalQty += Number(item.qty || 0);
      return [
        String(idx + 1),
        formatTanggalWaktu(item.tanggal),
        `${item.namaBarang} (${item.sku})`,
        `${item.qty} pcs`,
        item.dari,
        item.ke,
        item.keterangan || '-',
        item.createdBy || 'Staff Gudang',
      ];
    });

    const summaryFooter = [
      'TOTAL MUTASI',
      '',
      `${filteredData.length} Mutasi Terpilih`,
      `${totalQty.toLocaleString('id-ID')} pcs`,
      '',
      '',
      '',
      '',
    ];

    await exportRekapToPdfA4Landscape({
      title: 'Rekapitulasi Mutasi Stok Barang Antar Gudang & Cabang',
      divisi: 'Divisi Manufaktur & Distribusi',
      cabang: 'Gudang Pusat',
      periodeFilter: filterLabel || 'Semua Waktu',
      operator: 'Super Administrator',
      columns: [
        'No',
        'Tanggal & Jam',
        'Item Barang (SKU)',
        'Qty Mutasi',
        'Dari Lokasi (Asal)',
        'Ke Lokasi (Tujuan)',
        'Keterangan / Alasan',
        'Operator',
      ],
      rows,
      summaryFooter,
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 32 },
        2: { fontStyle: 'bold', cellWidth: 55 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
        4: { cellWidth: 32 },
        5: { cellWidth: 32 },
        6: { cellWidth: 56 },
        7: { cellWidth: 30 },
      },
      filename: `Rekap_Mutasi_Barang_${new Date().toISOString().slice(0, 10)}_A4_Landscape`,
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mutasi-barang');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat data', 'error');
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

  const handleSkuChange = (sku: string) => {
    const selected = inventoryList.find((i) => i.sku === sku);
    setForm((prev) => ({
      ...prev,
      sku,
      namaBarang: selected ? selected.namaBarang : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.sku || !form.qty || !form.dari || !form.ke) {
      showToast('Mohon lengkapi semua kolom wajib', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/mutasi-barang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Mutasi barang berhasil dicatat!', 'success');
        setIsModalOpen(false);
        setForm({
          tanggal: new Date().toISOString().split('T')[0],
          sku: '',
          namaBarang: '',
          qty: '',
          dari: '',
          ke: '',
          keterangan: '',
        });
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

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus catatan mutasi ini?')) return;
    try {
      const res = await fetch(`/api/mutasi-barang/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Data berhasil dihapus', 'success');
        fetchData();
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
          <h1 className="text-2xl font-bold text-gray-800">Mutasi Barang</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan perpindahan stok antar gudang, rak simpan, atau cabang
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 transition"
            title="Export Rekapitulasi Data Mutasi ke Excel CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rekap Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdfA4}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
            title="Export Rekapitulasi Laporan PDF Kertas A4 Landscape"
          >
            <FileText className="w-3.5 h-3.5 text-slate-300" />
            <span>PDF (A4 Landscape)</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition"
          >
            <span>＋</span> Catat Mutasi
          </button>
        </div>
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
            placeholder="Cari SKU, nama produk, lokasi asal/tujuan, keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-gray-50/50"
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
        id="rekap-mutasi-barang-table-container"
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal & Jam</th>
                <th className="py-3.5 px-4">SKU / Nama Barang</th>
                <th className="py-3.5 px-4">Jumlah</th>
                <th className="py-3.5 px-4">Dari Lokasi</th>
                <th className="py-3.5 px-4">Ke Lokasi</th>
                <th className="py-3.5 px-4">Keterangan</th>
                <th className="py-3.5 px-4">Dicatat Oleh</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Belum ada riwayat mutasi barang pada periode ini
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {formatTanggalWaktu(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{row.namaBarang}</div>
                      <div className="text-xs font-mono text-gray-400">{row.sku}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-600 whitespace-nowrap">
                      {row.qty} pcs
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-1 rounded bg-gray-100 text-xs font-medium text-gray-700">
                        {row.dari}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-1 rounded bg-blue-50 text-xs font-medium text-blue-700">
                        {row.ke}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{row.keterangan || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">{row.createdBy || '-'}</td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewFakturMutasi(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold border border-blue-200 transition"
                          title="Buka Formulir Faktur Mutasi (Export PDF / PNG A5)"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Faktur Mutasi</span>
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold p-1.5 rounded hover:bg-red-50 transition"
                          title="Hapus riwayat mutasi"
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md lg:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Catat Mutasi Barang</h2>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Kolom Kiri */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Produk *</label>
                      <select
                        required
                        value={form.sku}
                        onChange={(e) => handleSkuChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none"
                      >
                        <option value="">-- Pilih Barang --</option>
                        {inventoryList.map((i) => (
                          <option key={i.sku} value={i.sku}>
                            {i.sku} - {i.namaBarang} (Stok: {i.stok})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                        <input
                          type="date"
                          required
                          value={form.tanggal}
                          onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Mutasi *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="0"
                          value={form.qty}
                          onChange={(e) => setForm({ ...form, qty: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none font-semibold text-blue-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Dari Lokasi / Rak *</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Gudang A / Rak 1"
                          value={form.dari}
                          onChange={(e) => setForm({ ...form, dari: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Ke Lokasi / Rak *</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Gudang B / Display"
                          value={form.ke}
                          onChange={(e) => setForm({ ...form, ke: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan / Alasan Mutasi</label>
                      <textarea
                        rows={2}
                        placeholder="Catatan tambahan bila ada..."
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulir Faktur Mutasi Antar Cabang Modal Viewer (Export PDF & PNG Kertas A5) */}
      <DocumentModalViewer
        data={selectedDocument}
        isOpen={Boolean(selectedDocument)}
        onClose={() => setSelectedDocument(null)}
      />
    </div>
  );
}
