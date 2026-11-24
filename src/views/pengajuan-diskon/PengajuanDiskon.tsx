'use client';

import { useState, useEffect } from 'react';
import { formatTanggal } from '@/shared/lib/utils';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// PAGE: Pengajuan Diskon Khusus
// Route: /pengajuan-diskon
// ============================================================

interface DiskonItem {
  id: string;
  tanggal: string;
  salesman: string;
  pelanggan: string;
  sku: string | null;
  namaBarang: string | null;
  qty: number | null;
  diskonPct: string | null;
  alasan: string | null;
  status: string; // pending | approved | rejected
  approvedBy: string | null;
}

export default function PengajuanDiskon() {
  const [data, setData] = useState<DiskonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    salesman: '',
    pelanggan: '',
    sku: '',
    namaBarang: '',
    qty: '',
    diskonPct: '5',
    alasan: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pengajuan-diskon');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat data pengajuan', 'error');
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
    if (!form.pelanggan || !form.diskonPct) {
      showToast('Pelanggan dan persentase diskon wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pengajuan-diskon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Pengajuan diskon berhasil diajukan ke manager!', 'success');
        setIsModalOpen(false);
        setForm({
          tanggal: new Date().toISOString().split('T')[0],
          salesman: '',
          pelanggan: '',
          sku: '',
          namaBarang: '',
          qty: '',
          diskonPct: '5',
          alasan: '',
        });
        fetchData();
      } else {
        showToast(json.message || 'Gagal mengajukan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/pengajuan-diskon/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(
          status === 'approved' ? 'Pengajuan diskon disetujui!' : 'Pengajuan diskon ditolak.',
          'success'
        );
        fetchData();
      }
    } catch {
      showToast('Gagal memproses aksi', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">Pengajuan Diskon Khusus</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pengajuan potongan harga khusus pelanggan partai besar dari salesman ke pimpinan
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Ajukan Diskon Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Salesman</th>
                <th className="py-3.5 px-4">Pelanggan / Toko</th>
                <th className="py-3.5 px-4">Diskon Diajukan</th>
                <th className="py-3.5 px-4">Alasan Penjualan</th>
                <th className="py-3.5 px-4">Status & Otorisasi</th>
                <th className="py-3.5 px-4 text-center">Aksi Pimpinan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <MemuatProgres teks="Memuat data pengajuan..." />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada pengajuan diskon aktif
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">{row.salesman}</td>
                    <td className="py-3.5 px-4 text-gray-800">{row.pelanggan}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap">
                      {row.diskonPct}%
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 text-xs">{row.alasan || '-'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          row.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                      {row.approvedBy && (
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          oleh {row.approvedBy}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {row.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleAction(row.id, 'approved')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition"
                          >
                             Terima
                          </button>
                          <button
                            onClick={() => handleAction(row.id, 'rejected')}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition"
                          >
                             Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">- Selesai -</span>
                      )}
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
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Ajukan Diskon Khusus</h2>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                        <input
                          type="date"
                          required
                          value={form.tanggal}
                          onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Salesman</label>
                        <input
                          type="text"
                          placeholder="Nama Sales"
                          value={form.salesman}
                          onChange={(e) => setForm({ ...form, salesman: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Pelanggan / Toko *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nama Toko / Agen Tujuan"
                        value={form.pelanggan}
                        onChange={(e) => setForm({ ...form, pelanggan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Diskon Diajukan (%) *</label>
                      <input
                        type="number"
                        required
                        min="0.5"
                        max="50"
                        step="0.5"
                        value={form.diskonPct}
                        onChange={(e) => setForm({ ...form, diskonPct: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none font-semibold text-emerald-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Pengajuan</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Order volume besar 100 karton, promo kompetitor..."
                        value={form.alasan}
                        onChange={(e) => setForm({ ...form, alasan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none"
                      />
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
