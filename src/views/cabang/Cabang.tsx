'use client';

// ============================================================
// PAGE: Manajemen Cabang & Isolasi Multi-Lokasi
// Route: /cabang
// Aturan:
// 1. Default sistem HANYA ada 'Pusat' tanpa cabang tambahan
// 2. Jika Tambah Cabang, karyawan cabang HANYA BISA akses data & menu di cabang tempat mereka ditempatkan
// 3. Pimpinan (Admin, Direktur Utama, Manager) dapat mengelola & berpindah cabang di dalam aplikasi
// ============================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useDivision, CabangItem } from '@/shared/context/DivisionContext';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Factory,
  Coffee,
  Boxes,
  Users,
  Search,
  Lock,
} from 'lucide-react';

export default function CabangView() {
  const { data: session } = useSession();
  const { refetchCabang, cabang: activeCabang, setCabang } = useDivision();
  const user = session?.user as any;
  const isExecutive = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum'].includes(user?.role);

  const [branches, setBranches] = useState<CabangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [form, setForm] = useState({
    kodeCabang: '',
    namaCabang: '',
    divisi: 'ALL',
    alamat: '',
    telepon: '',
  });

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cabang');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBranches(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.kodeCabang.trim() || !form.namaCabang.trim()) {
      setErrorMsg('Kode Cabang dan Nama Cabang wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cabang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menambahkan cabang baru');
      }

      setSuccessMsg(`Cabang "${form.namaCabang}" berhasil didaftarkan!`);
      setForm({
        kodeCabang: '',
        namaCabang: '',
        divisi: 'ALL',
        alamat: '',
        telepon: '',
      });
      setIsModalOpen(false);

      // Refresh data lokal dan sync context Header
      await fetchBranches();
      await refetchCabang();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBranches = branches.filter((b) =>
    b.namaCabang.toLowerCase().includes(search.toLowerCase()) ||
    b.kodeCabang.toLowerCase().includes(search.toLowerCase()) ||
    (b.alamat && b.alamat.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Alert Notifikasi */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm font-medium">{successMsg}</div>
          <button onClick={() => setSuccessMsg('')} className="ml-auto text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header (F-Pattern Top Row) */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Manajemen Cabang & Isolasi Multi-Lokasi
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Default sistem hanya ada PUSAT. Jika cabang baru ditambahkan, karyawan cabang hanya dapat mengakses data di cabang mereka.
              </p>
            </div>
          </div>
        </div>

        {isExecutive && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cabang Baru</span>
          </button>
        )}
      </header>

      {/* 2. Info Cards (Grid Layout Archetype) */}
      <section aria-label="Kebijakan Isolasi Multi-Cabang" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-blue-900">Default: Hanya Kantor Pusat</div>
            <div className="text-[11px] text-blue-700 mt-1 leading-relaxed">
              Jika belum ada penambahan cabang, seluruh aktivitas pergudangan, kasir, dan keuangan berpusat di lokasi PUSAT.
            </div>
          </div>
        </article>

        <article className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-950">Isolasi Karyawan Cabang</div>
            <div className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
              Karyawan yang ditempatkan di cabang terkunci 100%. Mereka tidak bisa melihat stok, kasir, atau laporan cabang lain.
            </div>
          </div>
        </article>

        <article className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-purple-950">Fleksibilitas Pimpinan</div>
            <div className="text-[11px] text-purple-800 mt-1 leading-relaxed">
              Pimpinan (Admin/Direktur/Manager) dapat memilih dan berpindah cabang operasional langsung di Header tanpa logout.
            </div>
          </div>
        </article>
      </section>

      {/* 3. Filter & Daftar Cabang (F-Pattern Table Section) */}
      <section aria-label="Tabel Cabang Operasional" className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-900">Daftar Lokasi Operasional</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
              {branches.length} Lokasi
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau nama cabang..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Kode</th>
                <th className="py-3 px-4">Nama Cabang</th>
                <th className="py-3 px-4">Divisi Operasional</th>
                <th className="py-3 px-4">Tipe Lokasi</th>
                <th className="py-3 px-4">Alamat & Kontak</th>
                <th className="py-3 px-4">Status Isolasi Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Memuat data cabang...
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Tidak ada cabang yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((item) => {
                  const isActive = activeCabang === item.namaCabang;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isActive ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {item.kodeCabang}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{item.namaCabang}</span>
                          {isActive && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                              Aktif di Sesi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            item.divisi === 'MANUFAKTUR'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : item.divisi === 'FNB'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {item.divisi === 'MANUFAKTUR' && <Factory className="w-2.5 h-2.5" />}
                          {item.divisi === 'FNB' && <Coffee className="w-2.5 h-2.5" />}
                          {item.divisi === 'ALL' && <Boxes className="w-2.5 h-2.5" />}
                          <span>{item.divisi}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isPusat ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Kantor & Gudang Pusat
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[11px]">
                            Cabang Regional Tambahan
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">
                        <div>{item.alamat || '-'}</div>
                        {item.telepon && (
                          <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{item.telepon}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Terisolasi Khusus Karyawan Cabang</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Semantic Table Footer */}
        <footer className="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Menampilkan <strong>{filteredBranches.length}</strong> unit cabang operasional</span>
          <span className="text-[11px] text-gray-400">Proteksi RLS otomatis aktif per cabang</span>
        </footer>
      </section>

      {/* Modal Tambah Cabang Baru — Desktop Landscape */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gray-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl border border-gray-200 w-full max-w-md lg:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-900" />
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">Tambah Cabang Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Kolom Kiri */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Kode Cabang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Misal: BDG, SBY, CKR, BALI"
                        value={form.kodeCabang}
                        onChange={(e) => setForm({ ...form, kodeCabang: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nama Cabang / Lokasi <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Misal: Cabang Bandung, Depo Surabaya"
                        value={form.namaCabang}
                        onChange={(e) => setForm({ ...form, namaCabang: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Divisi Operasional
                      </label>
                      <select
                        value={form.divisi}
                        onChange={(e) => setForm({ ...form, divisi: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                      >
                        <option value="ALL">Semua Divisi (Manufaktur & F&B)</option>
                        <option value="MANUFAKTUR">Khusus Divisi Manufaktur (Pabrik & Grosir)</option>
                        <option value="FNB">Khusus Divisi Food & Beverages (Resto & Cafe)</option>
                      </select>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nomor Telepon / Kontak
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: (022) 1234567 atau 08123456789"
                        value={form.telepon}
                        onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Alamat Lengkap Cabang
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Alamat jalan, kota, dan lokasi gudang/outlet"
                        value={form.alamat}
                        onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
