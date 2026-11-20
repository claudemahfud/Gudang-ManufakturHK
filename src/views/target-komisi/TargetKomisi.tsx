'use client';

import { useState, useEffect } from 'react';
import { formatRupiah } from '@/shared/lib/utils';

// ============================================================
// PAGE: Target & Komisi Salesman
// Route: /target-komisi
// ============================================================

interface ItemTarget {
  id: string;
  salesman: string;
  periode: string; // YYYY-MM
  target: string;
  realisasi: string;
  pctKomisi: string;
}

export default function TargetKomisi() {
  const [data, setData] = useState<ItemTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    salesman: '',
    periode: new Date().toISOString().slice(0, 7),
    target: '',
    realisasi: '0',
    pctKomisi: '2.5',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/target-komisi');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat target', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.salesman || !form.target) {
      showToast('Salesman dan target penjualan wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/target-komisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Target penjualan berhasil ditetapkan!', 'success');
        setIsModalOpen(false);
        setForm({
          salesman: '',
          periode: new Date().toISOString().slice(0, 7),
          target: '',
          realisasi: '0',
          pctKomisi: '2.5',
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
    if (!confirm('Hapus target ini?')) return;
    try {
      const res = await fetch(`/api/target-komisi/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Target dihapus', 'success');
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
          <h1 className="text-2xl font-bold text-gray-800">Target & Komisi Salesman</h1>
          <p className="text-sm text-gray-500 mt-1">
            Penetapan target omzet bulanan, persentase reward, dan perhitungan komisi penjualan
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Tetapkan Target Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Periode</th>
                <th className="py-3.5 px-4">Salesman</th>
                <th className="py-3.5 px-4">Target Penjualan</th>
                <th className="py-3.5 px-4">Realisasi Omzet</th>
                <th className="py-3.5 px-4">Pencapaian (%)</th>
                <th className="py-3.5 px-4">Estimasi Komisi</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Memuat target...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada target yang dibuat
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const targetNum = parseFloat(row.target || '1');
                  const realisasiNum = parseFloat(row.realisasi || '0');
                  const pct = targetNum > 0 ? ((realisasiNum / targetNum) * 100).toFixed(1) : '0';
                  const komisiNum = (realisasiNum * parseFloat(row.pctKomisi || '0')) / 100;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-gray-700">
                        {row.periode}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-800">{row.salesman}</td>
                      <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap">
                        {formatRupiah(row.target)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700 whitespace-nowrap">
                        {formatRupiah(row.realisasi)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            parseFloat(pct) >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-700 whitespace-nowrap">
                        {formatRupiah(komisiNum)} ({row.pctKomisi}%)
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Tetapkan Target Komisi</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Periode (Bulan & Tahun) *</label>
                <input
                  type="month"
                  required
                  value={form.periode}
                  onChange={(e) => setForm({ ...form, periode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Salesman *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Sales"
                  value={form.salesman}
                  onChange={(e) => setForm({ ...form, salesman: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Omzet (Rp) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Contoh: 100000000"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Realisasi Awal (Rp)</label>
                  <input
                    type="number"
                    value={form.realisasi}
                    onChange={(e) => setForm({ ...form, realisasi: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Komisi (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.pctKomisi}
                    onChange={(e) => setForm({ ...form, pctKomisi: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
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
                  {submitting ? 'Menyimpan...' : 'Simpan Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
