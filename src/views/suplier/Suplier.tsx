'use client';

// ============================================================
// VIEW: Daftar Suplier & Pemasok
// Mode: Manufaktur & F&B (Terintegrasi ke Kas & Neraca)
// ============================================================

import { useState, useEffect } from 'react';
import {
  Factory,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Package,
  CreditCard,
  Trash2,
  Edit2,
  RefreshCw,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { ToastFloater, ToastData } from '@/shared/components/ui/ToastFloater';

interface SupplierData {
  id: string;
  nama: string;
  tipe: string;
  telepon: string | null;
  alamat: string | null;
  email: string | null;
  keterangan: string | null;
  aktif: boolean;
  totalHutangAktif: number;
  jumlahProduk: number;
  createdAt?: string;
}

interface FormState {
  nama: string;
  telepon: string;
  alamat: string;
  email: string;
  keterangan: string;
}

const initialForm: FormState = {
  nama: '',
  telepon: '',
  alamat: '',
  email: '',
  keterangan: '',
};

export default function SuplierView() {
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<SupplierData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    penyebab?: string,
    title?: string
  ) => {
    setToast({ type, message, penyebab, title });
    setTimeout(() => setToast(null), 6000);
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal mengambil data suplier');
      }
      setSuppliers(json.data || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat daftar suplier', err.message, 'Koneksi Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedId(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (item: SupplierData) => {
    setModalMode('edit');
    setSelectedId(item.id);
    setForm({
      nama: item.nama || '',
      telepon: item.telepon || '',
      alamat: item.alamat || '',
      email: item.email || '',
      keterangan: item.keterangan || '',
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      showToast(
        'error',
        'Nama suplier wajib diisi',
        'Field nama suplier merupakan identitas utama asal barang masuk dan tidak boleh kosong.',
        'Validasi Formulir'
      );
      return;
    }

    try {
      setSubmitting(true);
      const url = modalMode === 'create' ? '/api/suppliers' : `/api/suppliers/${selectedId}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast('error', json.message || 'Gagal menyimpan suplier', json.penyebab, 'Eksekusi Gagal');
        return;
      }

      showToast(
        'success',
        modalMode === 'create'
          ? `Suplier "${form.nama}" berhasil didaftarkan!`
          : `Data suplier "${form.nama}" berhasil diperbarui!`,
        undefined,
        'Berhasil'
      );

      setModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      showToast('error', 'Terjadi kesalahan sistem', err.message, 'Gangguan Server');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/suppliers/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast(
          'error',
          json.message || `Gagal menghapus suplier "${deleteTarget.nama}"`,
          json.penyebab || 'Sistem menolak penghapusan suplier.',
          'Hapus Suplier Ditolak'
        );
        return;
      }

      showToast('success', `Suplier "${deleteTarget.nama}" berhasil dihapus.`);
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err: any) {
      showToast('error', 'Gagal memproses penghapusan suplier', err.message, 'Gangguan Koneksi');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered List
  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.nama.toLowerCase().includes(q) ||
      (s.telepon && s.telepon.toLowerCase().includes(q)) ||
      (s.alamat && s.alamat.toLowerCase().includes(q)) ||
      (s.keterangan && s.keterangan.toLowerCase().includes(q))
    );
  });

  const totalHutangKeseluruhan = suppliers.reduce((acc, s) => acc + (s.totalHutangAktif || 0), 0);
  const totalBarangDisuplai = suppliers.reduce((acc, s) => acc + (s.jumlahProduk || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <ToastFloater toast={toast} onClose={() => setToast(null)} />

      {/* 1. Header Halaman */}
      <header className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full mb-2 border border-emerald-200">
            <Factory className="w-3.5 h-3.5 text-emerald-700" />
            <span>Pemasok Hulu & Asal Barang Masuk</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Daftar Suplier & Rekap Hutang
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Data sumber pemasok barang masuk, asal pabrik/vendor, dan monitoring hutang pembelian kredit (Accounts Payable).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSuppliers}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Daftarkan Suplier Baru</span>
          </button>
        </div>
      </header>

      {/* 2. Kartu Ringkasan & Dampak Neraca */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Suplier Terdaftar
            </div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">
              {suppliers.length} <span className="text-xs text-gray-400 font-normal">Pemasok</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Memasok {totalBarangDisuplai} SKU produk aktif
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Hutang Usaha Belum Lunas
            </div>
            <div className="text-2xl font-black text-amber-700 font-mono mt-0.5">
              {formatRupiah(totalHutangKeseluruhan)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Tercatat sebagai Liabilitas di Neraca
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              SOP Barang Baru
            </div>
            <div className="text-sm font-bold text-emerald-800 mt-0.5">
              Wajib Pilih Suplier
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Harga Beli = bayar ke suplier, Harga Jual = jual ke pasar
            </div>
          </div>
        </div>
      </section>

      {/* 3. Tabel Daftar Suplier */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama suplier, telepon, atau alamat..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <span className="text-xs text-gray-500">
            Menampilkan <strong>{filtered.length}</strong> suplier
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nama Suplier / Pabrik</th>
                <th className="py-3.5 px-4">Kontak & Telepon</th>
                <th className="py-3.5 px-4">Alamat Gudang / Kantor</th>
                <th className="py-3.5 px-4 text-center">Produk Disuplai</th>
                <th className="py-3.5 px-4 text-right">Sisa Hutang Kredit</th>
                <th className="py-3.5 px-4">Catatan / Spesialisasi</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-gray-500">Memuat data suplier...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Factory className="w-10 h-10 text-gray-300" />
                      <p className="font-semibold text-gray-600 text-base">Belum Ada Suplier</p>
                      <p className="text-xs text-gray-400 max-w-sm">
                        {search
                          ? `Tidak ditemukan suplier yang cocok dengan "${search}"`
                          : 'Daftarkan suplier pertama Anda agar sistem dapat memproses penambahan master barang baru dan barang masuk.'}
                      </p>
                      {!search && (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
                        >
                          + Tambah Suplier Sekarang
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-emerald-50/20 transition-colors">
                    {/* Nama Suplier */}
                    <td className="py-3.5 px-4 font-semibold text-gray-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          {item.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{item.nama}</span>
                          <span className="block text-[10px] text-gray-400 font-normal">Pemasok Resmi</span>
                        </div>
                      </div>
                    </td>

                    {/* Kontak & Telepon */}
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      {item.telepon ? (
                        <div className="flex items-center gap-1.5 text-gray-800 font-mono">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{item.telepon}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {item.email && (
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px] mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{item.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Alamat */}
                    <td className="py-3.5 px-4 text-xs max-w-xs truncate text-gray-600" title={item.alamat || ''}>
                      {item.alamat ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{item.alamat}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* Jumlah Produk */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        <Package className="w-3 h-3 text-gray-500" />
                        <span>{item.jumlahProduk} SKU</span>
                      </span>
                    </td>

                    {/* Sisa Hutang */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {item.totalHutangAktif > 0 ? (
                        <div className="inline-block text-right">
                          <span className="font-mono font-bold text-xs text-amber-700 block">
                            {formatRupiah(item.totalHutangAktif)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Kredit Belum Lunas</span>
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Lunas (Rp 0)</span>
                        </span>
                      )}
                    </td>

                    {/* Catatan */}
                    <td className="py-3.5 px-4 text-xs text-gray-500 max-w-xs truncate" title={item.keterangan || ''}>
                      {item.keterangan || '-'}
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                          title="Edit Suplier"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-600 rounded-lg transition"
                          title="Hapus Suplier"
                          aria-label={`Hapus ${item.nama}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. MODAL: Tambah / Edit Suplier — Desktop Landscape Layout */}
      {/* ============================================================ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl lg:max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Fixed Header */}
            <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-gray-900 text-base sm:text-lg">
                  {modalMode === 'create' ? 'Daftarkan Suplier Pemasok Baru' : `Edit Suplier: ${form.nama}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            {/* Landscape 2-Column Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                  {/* Kolom Kiri: Identitas & Kontak */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100">
                      1. Identitas & Kontak Suplier
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nama Suplier / Perusahaan / PT / CV <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.nama}
                        onChange={(e) => setForm({ ...form, nama: e.target.value })}
                        placeholder="Contoh: PT. Gandum Mas Perkasa / CV. Pangan Unggul"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none font-semibold text-gray-900"
                      />
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Nama suplier akan muncul pada pilihan asal barang masuk & pembelian.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Nomor Telepon / WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={form.telepon}
                          onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                          placeholder="08123456789 atau (021) 555-xxx"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Email Order / Faktur
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="order@suplier.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan: Alamat Gudang & Catatan */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100">
                      2. Alamat Gudang & Keterangan Pengadaan
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Alamat Pabrik / Gudang Pemasok
                      </label>
                      <textarea
                        rows={2}
                        value={form.alamat}
                        onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                        placeholder="Alamat kantor atau lokasi depo pengiriman suplier..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Keterangan Tambahan / Spesialisasi Barang
                      </label>
                      <textarea
                        rows={2}
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                        placeholder="Contoh: Pemasok tepung terigu premium, kemasan kardus, waktu antar 2 hari..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 sm:px-8 py-3.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs sm:text-sm hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {submitting && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{modalMode === 'create' ? 'Daftarkan Suplier' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL: Konfirmasi Hapus Suplier */}
      {/* ============================================================ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-center space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hapus Suplier Ini?</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus suplier{' '}
                <strong className="text-gray-900">{deleteTarget.nama}</strong>?
              </p>
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Suplier hanya dapat dihapus jika tidak ada hutang yang belum lunas dan semua barang dari suplier ini sudah habis (stok 0).
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition flex items-center gap-2 shadow-md shadow-red-600/20"
              >
                {deleting && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Ya, Hapus Suplier</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
