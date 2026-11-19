'use client';

import { useState, useEffect } from 'react';
import { formatTanggal } from '@/shared/lib/utils';

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
  const [submitting, setSubmitting] = useState(false);

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [armada, setArmada] = useState('');
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { sku: '', namaBarang: '', qtyOrder: 1, satuan: 'pcs' },
  ]);

  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  const viewDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/po-loading/${id}`);
      const json = await res.json();
      if (json.success) setSelectedDetail(json.data);
    } catch {
      showToast('Gagal memuat detail', 'error');
    }
  };

  const receiveAllItems = async (id: string) => {
    if (!confirm('Terima semua barang pada PO ini? Stok akan otomatis ditambahkan ke inventory.')) return;
    try {
      const res = await fetch(`/api/po-loading/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'selesai', receiveAll: true }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Semua barang diterima dan stok diperbarui!', 'success');
        setSelectedDetail(null);
        fetchData();
      }
    } catch {
      showToast('Gagal memproses penerimaan', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">PO & Loading Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Purchase Order ke pabrik produsen dan daftar loading muatan masuk
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Buat PO Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">No. PO</th>
                <th className="py-3.5 px-4">Tanggal</th>
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
                    Memuat daftar PO...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Belum ada Purchase Order aktif
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-gray-800">
                      {row.noPo}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">{row.supplier}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-600">{row.armada || '-'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          row.status === 'selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => viewDetail(row.id)}
                        className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 rounded hover:bg-emerald-50 transition mr-1"
                      >
                        Detail & Muat
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

      {/* Modal Buat PO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Terbitkan Purchase Order</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal PO *</label>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
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
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Armada / NoPol Pengangkut</label>
                <input
                  type="text"
                  placeholder="Truk Ekspedisi / B 9999 XX"
                  value={armada}
                  onChange={(e) => setArmada(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Daftar Pesanan Produk
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    ＋ Tambah Barang
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        required
                        value={row.sku}
                        onChange={(e) => updateItemRow(idx, 'sku', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none"
                      >
                        <option value="">-- Pilih Produk --</option>
                        {inventoryList.map((i) => (
                          <option key={i.sku} value={i.sku}>
                            {i.sku} - {i.namaBarang}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty Order"
                        value={row.qtyOrder}
                        onChange={(e) => updateItemRow(idx, 'qtyOrder', parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Satuan"
                        value={row.satuan}
                        onChange={(e) => updateItemRow(idx, 'satuan', e.target.value)}
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-20 px-1 font-bold"
                      >
                        
                      </button>
                    </div>
                  ))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 p-6 space-y-4">
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
              <div>Status: <span className="font-bold uppercase text-emerald-700">{selectedDetail.status}</span></div>
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

            <div className="flex justify-between items-center pt-3 border-t">
              <div>
                {selectedDetail.status !== 'selesai' && (
                  <button
                    onClick={() => receiveAllItems(selectedDetail.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
                  >
                     Terima Barang & Tambah Stok
                  </button>
                )}
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
    </div>
  );
}
