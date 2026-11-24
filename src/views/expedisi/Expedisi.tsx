'use client';

import { useState, useEffect } from 'react';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// PAGE: Manajemen Expedisi & Armada
// Route: /expedisi
// ============================================================

interface ArmadaItem {
  id: string;
  nopol: string;
  jenis: string | null;
  kapasitas: string | null;
  status: string; // aktif | servis | nonaktif
  keterangan: string | null;
}

export default function Expedisi() {
  const [data, setData] = useState<ArmadaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    nopol: '',
    jenis: 'Truk Box CDD',
    kapasitas: '4 Ton',
    status: 'aktif',
    keterangan: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/armada');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat data armada', 'error');
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
    if (!form.nopol) {
      showToast('Nomor Polisi wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/armada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Armada berhasil ditambahkan!', 'success');
        setIsModalOpen(false);
        setForm({
          nopol: '',
          jenis: 'Truk Box CDD',
          kapasitas: '4 Ton',
          status: 'aktif',
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

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/armada/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Status armada diperbarui', 'success');
        fetchData();
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kendaraan ini?')) return;
    try {
      const res = await fetch(`/api/armada/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Armada dihapus', 'success');
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
          <h1 className="text-2xl font-bold text-gray-800">Expedisi & Armada Pengiriman</h1>
          <p className="text-sm text-gray-500 mt-1">
            Data kendaraan logistik pengangkut barang, truk box, pickup, dan jadwal pemeliharaan
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Tambah Armada Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">No. Polisi</th>
                <th className="py-3.5 px-4">Jenis Kendaraan</th>
                <th className="py-3.5 px-4">Kapasitas Muatan</th>
                <th className="py-3.5 px-4">Keterangan / Driver</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <MemuatProgres teks="Memuat armada..." />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Belum ada armada yang terdaftar
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-sm text-gray-800">
                      {row.nopol}
                    </td>
                    <td className="py-3.5 px-4 text-gray-800 font-medium">{row.jenis || '-'}</td>
                    <td className="py-3.5 px-4 text-gray-600">{row.kapasitas || '-'}</td>
                    <td className="py-3.5 px-4 text-gray-500">{row.keterangan || '-'}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        value={row.status}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                        className={`text-xs font-bold rounded-lg px-2.5 py-1 border outline-none ${
                          row.status === 'aktif'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : row.status === 'servis'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        <option value="aktif">● AKTIF</option>
                        <option value="servis">▲ SERVIS</option>
                        <option value="nonaktif"> NON-AKTIF</option>
                      </select>
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
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Daftarkan Armada Baru</h2>
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Polisi (Plat) *</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: B 1234 XYZ"
                        value={form.nopol}
                        onChange={(e) => setForm({ ...form, nopol: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none uppercase font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe / Jenis Kendaraan *</label>
                      <select
                        value={form.jenis}
                        onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                      >
                        <option value="Truk Box CDD">Truk Box CDD (Canter 6 Roda)</option>
                        <option value="Truk Box CDE">Truk Box CDE (Engkel 4 Roda)</option>
                        <option value="Grand Max Blind Van">Grand Max / Blind Van</option>
                        <option value="Pickup L300">Pickup L300 / Traga</option>
                        <option value="Fuso Wingbox">Fuso Wingbox / Tronton</option>
                      </select>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Kapasitas Maksimal</label>
                      <input
                        type="text"
                        placeholder="Contoh: 4 Ton / 250 Karton"
                        value={form.kapasitas}
                        onChange={(e) => setForm({ ...form, kapasitas: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Driver Utama / Keterangan</label>
                      <textarea
                        rows={2}
                        placeholder="Nama sopir penanggung jawab..."
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
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
                  {submitting ? 'Menyimpan...' : 'Simpan Armada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
