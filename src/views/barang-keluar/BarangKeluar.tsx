'use client';

import { useState, useEffect } from 'react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';

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
    fetchInventory();
  }, [startDate, endDate]);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus item pengeluaran ini? Stok akan dikembalikan.')) return;
    try {
      const res = await fetch(`/api/barang-keluar/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Data berhasil dihapus', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal menghapus', 'error');
      }
    } catch {
      showToast('Gagal menghapus', 'error');
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">No. Transaksi</th>
                <th className="py-3.5 px-4">Tanggal</th>
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
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Memuat data barang keluar...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada catatan barang keluar
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-gray-700">
                      {row.trxId}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{row.pelanggan || '-'}</div>
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
      </div>

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
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none bg-white"
                          />
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
    </div>
  );
}
