'use client';

import { useState, useEffect } from 'react';
import { formatTanggal } from '@/shared/lib/utils';

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
          <h1 className="text-2xl font-bold text-gray-800">🔄 Mutasi Barang</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan perpindahan stok antar gudang, rak simpan, atau cabang
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Catat Mutasi
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
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
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Belum ada riwayat mutasi barang
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">🔄 Catat Mutasi Barang</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-500 outline-none"
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
