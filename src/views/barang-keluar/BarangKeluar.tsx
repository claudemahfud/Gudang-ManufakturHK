'use client';

import { useState, useEffect } from 'react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';
import { Truck, ShoppingBag, Layers, CheckCircle2, AlertCircle, ShieldAlert, Lock, KeyRound, X, Check } from 'lucide-react';

// ============================================================
// PAGE: Barang Keluar & Loading Penjualan
// Route: /barang-keluar
// ============================================================

interface ItemKeluar {
  id: string;
  trxId: string;
  tanggal: string;
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaJual: string | null;
  total: string | null;
  pelanggan: string | null;
  salesman: string | null;
  diskon: string | null;
  channel?: string;
  createdBy: string | null;
}

interface InventoryOption {
  sku: string;
  namaBarang: string;
  stok: number;
  hargaJual: string | null;
}

interface LineItem {
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaJual: number;
  diskon: number;
}

export default function BarangKeluar() {
  // ============================================================
  // SECTION: State & Hooks
  // ============================================================
  const [data, setData] = useState<ItemKeluar[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'GROSIR' | 'POS' | 'ALL'>('GROSIR');

  // Modal Create
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [pelanggan, setPelanggan] = useState('');
  const [salesman, setSalesman] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { sku: '', namaBarang: '', qty: 1, satuan: 'pcs', hargaJual: 0, diskon: 0 },
  ]);

  // Modal Invoice View
  const [invoiceData, setInvoiceData] = useState<any | null>(null);

  // Supervisor PIN Delete Protection (Anti-Fraud)
  const [deleteTarget, setDeleteTarget] = useState<ItemKeluar | null>(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deletePinError, setDeletePinError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
      if (selectedChannel !== 'ALL') params.set('channel', selectedChannel);

      const res = await fetch(`/api/barang-keluar?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      showToast('Gagal memuat data pengeluaran', 'error');
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
  }, [startDate, endDate, selectedChannel]);

  useEffect(() => {
    fetchInventory();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ============================================================
  // SECTION: Line Items Handlers
  // ============================================================
  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { sku: '', namaBarang: '', qty: 1, satuan: 'pcs', hargaJual: 0, diskon: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItemRow = (index: number, field: keyof LineItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'sku') {
        const prod = inventoryList.find((i) => i.sku === value);
        updated[index] = {
          ...updated[index],
          sku: value,
          namaBarang: prod ? prod.namaBarang : '',
          hargaJual: prod?.hargaJual ? parseFloat(prod.hargaJual) : 0,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // ============================================================
  // SECTION: Submit Loading Form
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pelanggan) {
      showToast('Nama pelanggan wajib diisi', 'error');
      return;
    }

    const invalid = items.some((i) => !i.sku || i.qty <= 0);
    if (invalid) {
      showToast('Mohon lengkapi SKU dan kuantitas produk', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/barang-keluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal,
          pelanggan,
          salesman,
          keterangan,
          items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Transaksi berhasil dicatat: ${json.trxId}`, 'success');
        setIsModalOpen(false);
        setPelanggan('');
        setSalesman('');
        setKeterangan('');
        setItems([{ sku: '', namaBarang: '', qty: 1, satuan: 'pcs', hargaJual: 0, diskon: 0 }]);
        fetchData();
      } else {
        showToast(json.message || 'Gagal menyimpan transaksi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDelete = (item: ItemKeluar) => {
    setDeleteTarget(item);
    setDeletePinInput('');
    setDeletePinError(null);
  };

  const handleConfirmDeleteWithPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deleteTarget) return;

    let supervisorPin = '1234';
    try {
      const saved = localStorage.getItem('app_pos_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.supervisorPin) supervisorPin = parsed.supervisorPin;
      }
    } catch {}

    if (deletePinInput.trim() !== supervisorPin.trim()) {
      setDeletePinError('PIN Supervisor tidak sesuai! Otorisasi pembatalan/penghapusan transaksi ditolak.');
      return;
    }

    setIsDeleting(true);
    setDeletePinError(null);
    try {
      const res = await fetch(`/api/barang-keluar/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Transaksi berhasil dihapus & stok telah dikembalikan ke inventory', 'success');
        setDeleteTarget(null);
        setDeletePinInput('');
        fetchData();
      } else {
        setDeletePinError(json.message || 'Gagal menghapus transaksi');
      }
    } catch {
      setDeletePinError('Terjadi kesalahan koneksi saat menghapus');
    } finally {
      setIsDeleting(false);
    }
  };

  const viewInvoice = async (trxId: string) => {
    try {
      const res = await fetch(`/api/barang-keluar/invoice/${trxId}`);
      const json = await res.json();
      if (json.success) {
        setInvoiceData(json.data);
      } else {
        showToast('Faktur tidak ditemukan', 'error');
      }
    } catch {
      showToast('Gagal memuat faktur', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">Barang Keluar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Surat loading barang penjualan, ekspedisi ke pelanggan & mutasi keluar
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Buat Surat Loading / Keluar
        </button>
      </header>

      {/* 2. Channel Switcher Tabs (Semantic <nav>) */}
      <nav aria-label="Tab Saluran Distribusi" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedChannel('GROSIR')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
            selectedChannel === 'GROSIR'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Muatan Gudang & Grosir (B2B)</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedChannel('POS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
            selectedChannel === 'POS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Transaksi Kasir POS</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedChannel('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
            selectedChannel === 'ALL'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Semua Pengeluaran</span>
        </button>
      </nav>

      {/* 3. Filters (F-Pattern Second Row) */}
      <section aria-label="Filter dan Pencarian Muatan" className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Cari No. Trx, Pelanggan, Salesman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-gray-500">Tanggal:</span>
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

      {/* 4. Table (F-Pattern Reading Grid) */}
      <section aria-label="Tabel Data Barang Keluar" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">No. Transaksi</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Jalur Distribusi</th>
                <th className="py-3.5 px-4">Pelanggan / Salesman</th>
                <th className="py-3.5 px-4">Item Barang</th>
                <th className="py-3.5 px-4">Jumlah</th>
                <th className="py-3.5 px-4">Total (Rp)</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Memuat data barang keluar...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Belum ada catatan barang keluar
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-gray-700">
                      <button
                        type="button"
                        onClick={() => viewInvoice(row.trxId)}
                        className="text-left font-mono font-bold text-xs text-emerald-700 hover:text-emerald-900 hover:underline transition"
                        title="Buka Faktur Transaksi"
                      >
                        {row.trxId}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {row.channel === 'POS' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <ShoppingBag className="w-2.5 h-2.5" />
                          <span>Kasir POS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <Truck className="w-2.5 h-2.5" />
                          <span>Gudang / Grosir</span>
                        </span>
                      )}
                    </td>
                    <td
                      className="py-3.5 px-4 cursor-pointer"
                      onClick={() => viewInvoice(row.trxId)}
                      title="Klik untuk membuka faktur transaksi"
                    >
                      <div className="font-semibold text-gray-800 hover:text-emerald-700 transition">{row.pelanggan || '-'}</div>
                      <div className="text-xs text-gray-400">Sales: {row.salesman || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-gray-800 font-medium">{row.namaBarang}</div>
                      <div className="text-xs font-mono text-gray-400">{row.sku}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-amber-700 whitespace-nowrap">
                      -{row.qty} {row.satuan}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800 whitespace-nowrap">
                      {formatRupiah(row.total)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => viewInvoice(row.trxId)}
                        className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 rounded hover:bg-emerald-50 transition mr-1"
                      >
                        Faktur
                      </button>
                      <button
                        onClick={() => handleRequestDelete(row)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                        title="Hapus Transaksi (Perlu PIN Supervisor)"
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

        {/* Semantic table footer summary */}
        <footer className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Menampilkan <strong>{data.length}</strong> transaksi pengeluaran barang</span>
          <span className="text-[11px] text-gray-400">Jalur Grosir (Muatan Bal) & POS Kasir Terpisah Otomatis</span>
        </footer>
      </section>

      {/* Modal Buat Surat Loading */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Buat Surat Loading / Barang Keluar</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pelanggan / Toko *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Toko / Agen"
                    value={pelanggan}
                    onChange={(e) => setPelanggan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Salesman</label>
                  <input
                    type="text"
                    placeholder="Nama Sales"
                    value={salesman}
                    onChange={(e) => setSalesman(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Daftar Barang Loading
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                  >
                    <span>＋</span> Tambah Baris
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((row, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200/60 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-6">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Pilih Produk</label>
                          <select
                            required
                            value={row.sku}
                            onChange={(e) => updateItemRow(idx, 'sku', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none bg-white"
                          >
                            <option value="">-- Pilih Barang --</option>
                            {inventoryList.map((i) => (
                              <option key={i.sku} value={i.sku}>
                                {i.sku} - {i.namaBarang} (Stok: {i.stok})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Qty</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={row.qty}
                            onChange={(e) => updateItemRow(idx, 'qty', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none bg-white font-bold text-gray-800"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[1, 5, 10, 20, 50].map((add) => (
                              <button
                                key={add}
                                type="button"
                                onClick={() => updateItemRow(idx, 'qty', (row.qty || 0) + add)}
                                className="text-[9px] px-1.5 py-0.2 bg-gray-200/80 hover:bg-gray-300 text-gray-700 font-bold rounded"
                              >
                                +{add}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Harga Jual (Rp)</label>
                          <input
                            type="number"
                            value={row.hargaJual}
                            onChange={(e) => updateItemRow(idx, 'hargaJual', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none bg-white"
                          />
                        </div>
                        <div className="sm:col-span-1 flex items-end justify-center pt-4">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                            className="text-red-400 hover:text-red-600 font-bold disabled:opacity-20"
                          >
                            
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Pengiriman</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan bila ada..."
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
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
                  {submitting ? 'Menyimpan...' : 'Simpan Surat Loading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Invoice View */}
      {invoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 p-6 space-y-4">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-800">SURAT JALAN / INVOICE</h3>
                <div className="text-xs font-mono text-gray-500">No. Trx: {invoiceData.trxId}</div>
              </div>
              <button onClick={() => setInvoiceData(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>

            <div className="grid grid-cols-2 text-xs gap-2 text-gray-600">
              <div>Tanggal: <strong>{formatTanggal(invoiceData.tanggal)}</strong></div>
              <div>Pelanggan: <strong>{invoiceData.pelanggan || '-'}</strong></div>
              <div>Salesman: <strong>{invoiceData.salesman || '-'}</strong></div>
              <div>Operator: <strong>{invoiceData.createdBy || '-'}</strong></div>
            </div>

            <div className="border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                  <tr>
                    <th className="p-2">Item Barang</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoiceData.items.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2">
                        <div className="font-semibold text-gray-800">{it.namaBarang}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{it.sku}</div>
                      </td>
                      <td className="p-2 text-center">{it.qty} {it.satuan}</td>
                      <td className="p-2 text-right">{formatRupiah(it.hargaJual)}</td>
                      <td className="p-2 text-right font-semibold">{formatRupiah(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-sm text-gray-800">Total Transaksi:</span>
              <span className="font-bold text-lg text-emerald-600">{formatRupiah(invoiceData.total)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
              >
                Cetak / Print
              </button>
              <button
                onClick={() => setInvoiceData(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================ */}
      {/* 6. MODAL: Otorisasi PIN Supervisor Hapus Transaksi (Anti-Fraud) */}
      {/* ============================================================ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="supervisor-auth-title"
            className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <header className="p-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-red-50/80 via-white to-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                {/* Triple Line: Title, Sub-Title, Sub-Sub-Title */}
                <div>
                  <h3 id="supervisor-auth-title" className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight leading-tight">
                    Otorisasi PIN Supervisor
                  </h3>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">
                    Pengamanan Pembatalan Transaksi Penjualan
                  </p>
                  <p className="text-[11px] text-red-700 font-semibold mt-0.5">
                    Anti-Fraud: Mencegah manipulasi omset tunai & stok
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletePinInput('');
                  setDeletePinError(null);
                }}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-xl transition"
                aria-label="Tutup Dialog Otorisasi"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Target Transaction Summary (List Dual-Line) */}
            <form onSubmit={handleConfirmDeleteWithPin} className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-500">
                  <span>Nomor Referensi:</span>
                  <span className="font-mono font-bold text-gray-900">{deleteTarget.trxId}</span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span>Item & Jumlah:</span>
                  <span className="font-semibold text-gray-900">{deleteTarget.namaBarang} ({deleteTarget.qty} {deleteTarget.satuan})</span>
                </div>
                <div className="flex justify-between items-center text-gray-500 border-t border-gray-200/60 pt-1.5">
                  <span className="font-bold text-gray-700">Total Nilai Penjualan:</span>
                  <span className="font-bold text-red-600 font-mono text-sm">{formatRupiah(deleteTarget.total)}</span>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Menghapus transaksi ini akan <strong>mengembalikan {deleteTarget.qty} {deleteTarget.satuan} ke stok gudang</strong> dan memotong rekaman omset dari laporan penjualan.
                </p>
              </div>

              {/* PIN Input Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-red-600" />
                    <span>Masukkan PIN Supervisor (4-6 Angka):</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">Default: 1234</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value.replace(/\D/g, ''));
                    setDeletePinError(null);
                  }}
                  placeholder="Ketik PIN Supervisor..."
                  className="w-full text-center tracking-[0.5em] font-mono text-lg font-bold bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl px-4 py-2.5 outline-none transition"
                />
              </div>

              {/* Error Alert If Wrong PIN */}
              {deletePinError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{deletePinError}</span>
                </div>
              )}

              {/* Quick On-Screen Number Keypad for POS / Touchscreen */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'C') setDeletePinInput('');
                      else if (k === '⌫') setDeletePinInput((p) => p.slice(0, -1));
                      else if (deletePinInput.length < 6) setDeletePinInput((p) => p + k);
                      setDeletePinError(null);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                      k === 'C'
                        ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                        : k === '⌫'
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                        : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-2xs'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeletePinInput('');
                    setDeletePinError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!deletePinInput || isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Memproses...' : 'Setujui Hapus Transaksi'}</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
