'use client';

import { useState, useEffect } from 'react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';

// ============================================================
// PAGE: Retur Barang
// Route: /retur-barang
// ============================================================

interface ItemRetur {
  id: string;
  tanggal: string;
  sku: string;
  namaBarang: string;
  qty: number;
  alasan: string | null;
  pelanggan: string | null;
  status: string;
  createdBy: string | null;
  noFaktur?: string | null;
  kondisi?: 'layak' | 'rusak';
  nilai?: string | null;
  potongPiutang?: string | null;
  refund?: string | null;
  barangMasukId?: string | null;
  barangRusakId?: string | null;
}

/** Retur yang dicatat lewat Barang Masuk: final, hapus = batalkan stok/piutang/refund. */
const dariBarangMasuk = (r: ItemRetur) => Boolean(r.barangMasukId || r.barangRusakId);

interface InventoryOption {
  sku: string;
  namaBarang: string;
}

export default function ReturBarang() {
  const [data, setData] = useState<ItemRetur[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    sku: '',
    namaBarang: '',
    qty: '',
    pelanggan: '',
    alasan: '',
    kembaliKeStok: true,
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/retur-barang');
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
    if (!form.sku || !form.qty) {
      showToast('Mohon lengkapi produk dan jumlah retur', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/retur-barang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Retur berhasil dicatat!', 'success');
        setIsModalOpen(false);
        setForm({
          tanggal: new Date().toISOString().split('T')[0],
          sku: '',
          namaBarang: '',
          qty: '',
          pelanggan: '',
          alasan: '',
          kembaliKeStok: true,
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

  const handleApprove = async (id: string) => {
    if (!confirm('Setujui retur ini dan masukkan kembali barang ke stok gudang?')) return;
    try {
      const res = await fetch(`/api/retur-barang/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disetujui', tambahKeStok: true }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Retur disetujui & stok berhasil ditambahkan!', 'success');
        fetchData();
      }
    } catch {
      showToast('Gagal memproses persetujuan', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const row = data.find((d) => d.id === id);
    const pesan =
      row && dariBarangMasuk(row)
        ? 'Batalkan retur pelanggan ini? Stok/catatan rusak, potongan piutang, dan refund ikut dibalik.'
        : 'Hapus data retur ini?';
    if (!confirm(pesan)) return;
    try {
      const res = await fetch(`/api/retur-barang/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Data retur dihapus', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal menghapus', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">Retur Barang</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan pengembalian barang dari pelanggan / agen beserta penyesuaian stok
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Catat Retur Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Pelanggan</th>
                <th className="py-3.5 px-4">SKU / Nama Barang</th>
                <th className="py-3.5 px-4">Jumlah Retur</th>
                <th className="py-3.5 px-4">Alasan Retur</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Memuat data retur...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada riwayat retur barang
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{row.pelanggan || '-'}</div>
                      {row.noFaktur && <div className="text-[11px] font-mono text-gray-400">{row.noFaktur}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{row.namaBarang}</div>
                      <div className="text-xs font-mono text-gray-400">{row.sku}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-amber-700">{row.qty} pcs</div>
                      {dariBarangMasuk(row) && (
                        <div className="text-[11px] text-gray-500">
                          {row.kondisi === 'rusak' ? 'Rusak, tidak masuk stok' : 'Layak, masuk stok'}
                          {Number(row.nilai) > 0 ? ` · ${formatRupiah(row.nilai)}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{row.alasan || '-'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          row.status === 'disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                      {dariBarangMasuk(row) && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          via Barang Masuk
                          {Number(row.potongPiutang) > 0 ? ` · piutang −${formatRupiah(row.potongPiutang)}` : ''}
                          {Number(row.refund) > 0 ? ` · refund ${formatRupiah(row.refund)}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {row.status !== 'disetujui' && !dariBarangMasuk(row) && (
                        <button
                          onClick={() => handleApprove(row.id)}
                          className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 rounded hover:bg-emerald-50 transition mr-1"
                        >
                           Setujui
                        </button>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Catat Retur Barang</h2>
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
              <div className="flex-1 overflow-y-auto p-6 sm:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Kolom Kiri */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Pilih Produk *</label>
                      <select
                        required
                        value={form.sku}
                        onChange={(e) => handleSkuChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none"
                      >
                        <option value="">-- Pilih Barang --</option>
                        {inventoryList.map((i) => (
                          <option key={i.sku} value={i.sku}>
                            {i.sku} - {i.namaBarang}
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
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Retur (pcs) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="0"
                          value={form.qty}
                          onChange={(e) => setForm({ ...form, qty: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none font-semibold text-amber-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Dari Pelanggan / Toko</label>
                      <input
                        type="text"
                        placeholder="Nama Pelanggan"
                        value={form.pelanggan}
                        onChange={(e) => setForm({ ...form, pelanggan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Retur</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Salah kirim, kemasan penyok, tukar varian..."
                        value={form.alasan}
                        onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="kembaliKeStok"
                        checked={form.kembaliKeStok}
                        onChange={(e) => setForm({ ...form, kembaliKeStok: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                      />
                      <label htmlFor="kembaliKeStok" className="text-xs text-gray-700 font-medium cursor-pointer">
                        Langsung tambahkan kembali ke stok inventory
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="px-6 sm:px-8 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-2 shrink-0">
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Retur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
