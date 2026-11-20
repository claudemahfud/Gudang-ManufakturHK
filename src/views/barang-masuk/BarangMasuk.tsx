'use client';

import { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';
import { useBarcodeScanner } from '@/shared/hooks/useBarcodeScanner';
import CameraBarcodeScanner from '@/shared/components/ui/CameraBarcodeScanner';

// ============================================================
// PAGE: Barang Masuk
// Route: /barang-masuk
// ============================================================

interface ItemMasuk {
  id: string;
  tanggal: string;
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli: string | null;
  supplier: string | null;
  noFaktur: string | null;
  keterangan: string | null;
  createdBy: string | null;
}

interface InventoryOption {
  sku: string;
  namaBarang: string;
  hargaBeli: string | null;
}

export default function BarangMasuk() {
  // ============================================================
  // SECTION: State & Hooks
  // ============================================================
  const [data, setData] = useState<ItemMasuk[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    sku: '',
    namaBarang: '',
    qty: '',
    satuan: 'pcs',
    hargaBeli: '',
    supplier: '',
    noFaktur: '',
    keterangan: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const matched = inventoryList.find(
      (i) =>
        i.sku.toLowerCase() === clean ||
        i.sku.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')
    );
    if (matched) {
      handleSkuChange(matched.sku);
      showToast(`SKU ${matched.sku} berhasil dipindai`, 'success');
    } else {
      setForm((prev) => ({
        ...prev,
        sku: scannedCode.toUpperCase().trim(),
        namaBarang: prev.namaBarang || scannedCode.toUpperCase().trim(),
      }));
      showToast(`Barcode ${scannedCode} dipindai (Barang baru)`, 'success');
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
        setData(json.data);
      }
    } catch {
      showToast('Gagal memuat data barang masuk', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory?limit=500');
      const json = await res.json();
      if (json.success) {
        setInventoryList(json.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchInventory();
  }, [startDate, endDate]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.sku || !form.qty) {
      showToast('Mohon lengkapi SKU dan Jumlah', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/barang-masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Barang masuk berhasil dicatat!', 'success');
        setIsModalOpen(false);
        setForm({
          tanggal: new Date().toISOString().split('T')[0],
          sku: '',
          namaBarang: '',
          qty: '',
          satuan: 'pcs',
          hargaBeli: '',
          supplier: '',
          noFaktur: '',
          keterangan: '',
        });
        fetchData();
      } else {
        showToast(json.message || 'Gagal menyimpan data', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data ini? Stok inventory akan dikurangi kembali.')) return;

    try {
      const res = await fetch(`/api/barang-masuk/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Data barang masuk berhasil dihapus', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal menghapus', 'error');
      }
    } catch {
      showToast('Gagal menghapus data', 'error');
    }
  };

  // ============================================================
  // SECTION: Render
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
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

      {/* 1. Header (F-Pattern Top Row) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Barang Masuk</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan penerimaan stok barang dari supplier atau gudang pusat
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Catat Barang Masuk
        </button>
      </header>

      {/* 2. Filters (F-Pattern Second Row) */}
      <section aria-label="Filter dan Pencarian" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Cari SKU, Nama Barang, Supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-gray-500">Filter Tanggal:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600"
          />
          <span className="text-xs text-gray-400">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600"
          />
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition"
          >
            Terapkan
          </button>
        </div>
      </section>

      {/* 3. Table Section (F-Pattern Reading Grid) */}
      <section aria-label="Daftar Riwayat Barang Masuk" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">SKU / Nama Barang</th>
                <th className="py-3.5 px-4">Jumlah</th>
                <th className="py-3.5 px-4">Harga Beli</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">No. Faktur</th>
                <th className="py-3.5 px-4">Dicatat Oleh</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Memuat data barang masuk...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Belum ada riwayat barang masuk
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{row.namaBarang}</div>
                      <div className="text-xs font-mono text-gray-400">{row.sku}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap">
                      +{row.qty} {row.satuan}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-700">
                      {formatRupiah(row.hargaBeli)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{row.supplier || '-'}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-gray-500">
                      {row.noFaktur || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">{row.createdBy || '-'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Semantic footer for table summary */}
        <footer className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Menampilkan total <strong>{data.length}</strong> transaksi barang masuk</span>
          <span className="text-[11px] text-gray-400">Pembaruan stok otomatis terhubung ke Master Inventory</span>
        </footer>
      </section>

      {/* Modal Tambah Barang Masuk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Catat Barang Masuk</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Pilih Produk / SKU *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                    title="Scan Barcode menggunakan Kamera HP"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan Barcode</span>
                  </button>
                </div>
                <select
                  required
                  value={form.sku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="">-- Pilih Barang dari Inventory --</option>
                  {inventoryList.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.sku} - {item.namaBarang}
                    </option>
                  ))}
                </select>
                {form.sku && !inventoryList.some((i) => i.sku === form.sku) && (
                  <div className="text-[11px] text-amber-600 mt-1">
                    * SKU baru terdeteksi: {form.sku} (akan otomatis dibuatkan di master inventory)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tanggal Masuk *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Jumlah (Qty) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="0"
                      value={form.qty}
                      onChange={(e) => setForm({ ...form, qty: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                    />
                    <select
                      value={form.satuan}
                      onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                      className="w-24 px-2 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                    >
                      <option value="pcs">pcs</option>
                      <option value="karton">karton</option>
                      <option value="pack">pack</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Harga Beli Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.hargaBeli}
                    onChange={(e) => setForm({ ...form, hargaBeli: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Supplier / Sumber
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Supplier"
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nomor Faktur / Surat Jalan Supplier
                </label>
                <input
                  type="text"
                  placeholder="Contoh: INV/2026/001"
                  value={form.noFaktur}
                  onChange={(e) => setForm({ ...form, noFaktur: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catatan / Keterangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan bila ada..."
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
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
                  {submitting ? 'Menyimpan...' : 'Simpan Barang Masuk'}
                </button>
              </div>
            </form>
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
    </div>
  );
}
