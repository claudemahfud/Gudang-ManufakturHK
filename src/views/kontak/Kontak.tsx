'use client';

import { useState, useEffect } from 'react';

// ============================================================
// PAGE: Manajemen Kontak Mitra & Pelanggan
// Route: /kontak
// ============================================================

interface KontakItem {
  id: string;
  nama: string;
  tipe: string; // pelanggan | supplier | keduanya
  telepon: string | null;
  alamat: string | null;
  email: string | null;
  keterangan: string | null;
  aktif: boolean;
}

export default function Kontak() {
  const [data, setData] = useState<KontakItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipe, setFilterTipe] = useState('semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    nama: '',
    tipe: 'pelanggan',
    telepon: '',
    alamat: '',
    email: '',
    keterangan: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kontak');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat kontak', 'error');
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

  const filteredData = data.filter((item) => {
    const matchSearch =
      item.nama.toLowerCase().includes(search.toLowerCase()) ||
      (item.telepon && item.telepon.includes(search)) ||
      (item.alamat && item.alamat.toLowerCase().includes(search.toLowerCase()));

    const matchTipe = filterTipe === 'semua' || item.tipe === filterTipe;
    return matchSearch && matchTipe;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.nama) {
      showToast('Nama kontak wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/kontak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Kontak berhasil ditambahkan!', 'success');
        setIsModalOpen(false);
        setForm({
          nama: '',
          tipe: 'pelanggan',
          telepon: '',
          alamat: '',
          email: '',
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
    if (!confirm('Hapus kontak ini?')) return;
    try {
      const res = await fetch(`/api/kontak/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Kontak dihapus', 'success');
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
          <h1 className="text-2xl font-bold text-gray-800">Kontak Mitra & Pelanggan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Buku telepon dan direktori mitra bisnis (Pelanggan, Toko Grosir, dan Pabrik Supplier)
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Tambah Kontak Baru
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Cari nama, telepon, alamat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Kategori:</span>
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 outline-none"
          >
            <option value="semua">Semua Kategori</option>
            <option value="pelanggan">Pelanggan / Toko</option>
            <option value="supplier">Supplier Pabrik</option>
            <option value="keduanya">Keduanya</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Nama Mitra</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Nomor Kontak</th>
                <th className="py-3.5 px-4">Alamat Lengkap</th>
                <th className="py-3.5 px-4">Keterangan</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Memuat kontak...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Tidak ada kontak yang cocok
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-800">{row.nama}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          row.tipe === 'supplier'
                            ? 'bg-purple-100 text-purple-800'
                            : row.tipe === 'pelanggan'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {row.tipe.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-700">
                      {row.telepon ? (
                        <a href={`tel:${row.telepon}`} className="hover:text-emerald-600 hover:underline">
                          {row.telepon}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 text-xs max-w-xs">{row.alamat || '-'}</td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs">{row.keterangan || '-'}</td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md lg:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Tambah Kontak Baru</h2>
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Mitra / Toko *</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Toko Berkah / PT. Pangan Inti"
                        value={form.nama}
                        onChange={(e) => setForm({ ...form, nama: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe Kontak *</label>
                        <select
                          value={form.tipe}
                          onChange={(e) => setForm({ ...form, tipe: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                        >
                          <option value="pelanggan">Pelanggan / Toko</option>
                          <option value="supplier">Supplier Pabrik</option>
                          <option value="keduanya">Keduanya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Telepon / WA</label>
                        <input
                          type="tel"
                          placeholder="08123456789"
                          value={form.telepon}
                          onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat Lengkap</label>
                      <textarea
                        rows={2}
                        placeholder="Alamat toko atau gudang..."
                        value={form.alamat}
                        onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Tambahan</label>
                      <input
                        type="text"
                        placeholder="PIC toko, jadwal buka tutup..."
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Kontak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
