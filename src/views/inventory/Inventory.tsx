'use client';

// ============================================================
// PAGE: Inventory (Master Barang)
// Route: /inventory
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { formatRupiah, formatStok } from '@/shared/lib/utils';
import type { InventoryItem } from '@/shared/types';

// ============================================================
// SECTION: Interfaces & Initial State
// ============================================================

interface FormState {
  sku: string;
  namaBarang: string;
  brand: string;
  gramasi: string;
  varian: string;
  stok: number | string;
  hargaBeli: number | string;
  hargaJual: number | string;
  settingPcs: number | string;
  pakaiKarton: boolean;
  stokMinimum: number | string;
  keterangan: string;
}

const initialForm: FormState = {
  sku: '',
  namaBarang: '',
  brand: '',
  gramasi: '',
  varian: '',
  stok: 0,
  hargaBeli: 0,
  hargaJual: 0,
  settingPcs: 1,
  pakaiKarton: true,
  stokMinimum: 10,
  keterangan: '',
};

interface ToastNotification {
  type: 'success' | 'error';
  message: string;
}

// ============================================================
// SECTION: Main Component
// ============================================================

export default function Inventory() {
  // State Data & Query
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // State UI
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // State Modal Form
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // State Modal Konfirmasi Hapus
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // SECTION: Helper Toast
  // ============================================================

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // ============================================================
  // SECTION: Data Fetching
  // ============================================================

  useEffect(() => {
    let isCancelled = false;

    async function loadInventory() {
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(searchQuery && { search: searchQuery }),
        });

        const res = await fetch(`/api/inventory?${params.toString()}`);
        const json = await res.json();

        if (isCancelled) return;

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Gagal mengambil data inventory');
        }

        setItems(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
        setError(null);
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Terjadi gangguan koneksi';
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      isCancelled = true;
    };
  }, [page, limit, searchQuery, refreshKey]);

  // Handle Search Input dengan Debounce Timer Ref
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setLoading(true);
      setSearchQuery(val.trim());
      setPage(1);
    }, 400);
  };

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  // ============================================================
  // SECTION: Modal Handlers (Open/Close)
  // ============================================================

  const openCreateModal = () => {
    setModalMode('create');
    setForm(initialForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setModalMode('edit');
    setForm({
      sku: item.sku,
      namaBarang: item.namaBarang,
      brand: item.brand || '',
      gramasi: item.gramasi || '',
      varian: item.varian || '',
      stok: item.stok,
      hargaBeli: item.hargaBeli || 0,
      hargaJual: item.hargaJual || 0,
      settingPcs: item.settingPcs || 1,
      pakaiKarton: item.pakaiKarton ?? true,
      stokMinimum: item.stokMinimum ?? 10,
      keterangan: item.keterangan || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setFormError(null);
  };

  // ============================================================
  // SECTION: Submit Create / Edit Item
  // ============================================================

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validasi sederhana
    if (!form.sku.trim()) {
      setFormError('Kode SKU wajib diisi');
      return;
    }
    if (!form.namaBarang.trim()) {
      setFormError('Nama Barang wajib diisi');
      return;
    }

    try {
      setSubmitting(true);

      const endpoint =
        modalMode === 'create'
          ? '/api/inventory'
          : `/api/inventory/${encodeURIComponent(form.sku.trim())}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const payload = {
        sku: form.sku.trim().toUpperCase(),
        namaBarang: form.namaBarang.trim(),
        brand: form.brand.trim() || null,
        gramasi: form.gramasi.trim() || null,
        varian: form.varian.trim() || null,
        stok: Number(form.stok) || 0,
        hargaBeli: Number(form.hargaBeli) || 0,
        hargaJual: Number(form.hargaJual) || 0,
        settingPcs: Math.max(1, Number(form.settingPcs) || 1),
        pakaiKarton: Boolean(form.pakaiKarton),
        stokMinimum: Number(form.stokMinimum) || 0,
        keterangan: form.keterangan.trim() || null,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menyimpan data barang');
      }

      showToast(
        'success',
        modalMode === 'create'
          ? `Barang ${payload.sku} berhasil ditambahkan!`
          : `Barang ${payload.sku} berhasil diperbarui!`
      );

      setModalOpen(false);
      handleManualRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // SECTION: Delete Item Handler
  // ============================================================

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);

      const res = await fetch(`/api/inventory/${encodeURIComponent(deleteTarget.sku)}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menghapus barang');
      }

      showToast('success', `Barang ${deleteTarget.sku} berhasil dihapus.`);
      setDeleteTarget(null);
      handleManualRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses penghapusan';
      showToast('error', msg);
    } finally {
      setDeleting(false);
    }
  };

  // ============================================================
  // SECTION: Helper Badge Status Stok
  // ============================================================

  const renderStockBadge = (stok: number, stokMinimum: number | null | undefined) => {
    const min = stokMinimum ?? 10;
    if (stok <= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Habis
        </span>
      );
    }
    if (stok <= min) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Kritis
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Aman
      </span>
    );
  };

  // ============================================================
  // SECTION: Render View
  // ============================================================

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert Floater */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce transition-all">
          <div
            className={`px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            <span>{toast.type === 'success' ? '' : ''}</span>
            <span className="text-sm font-semibold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white/80 hover:text-white text-xs font-bold"
            >
              
            </button>
          </div>
        </div>
      )}

      {/* Header Halaman & Action Button */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <span>Manajemen Pergudangan</span>
            <span>&bull;</span>
            <span>Master Data</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Katalog Inventory & Stok
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Kelola master SKU, stok fisik, konversi karton, serta harga jual/beli barang.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-md transition"
        >
          <span className="text-lg leading-none">+</span>
          <span>Tambah Barang Baru</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            </span>
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Cari berdasarkan SKU, Nama Barang, atau Brand..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setLoading(true);
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 text-xs"
            >
              
            </button>
          )}
        </div>

        {/* Info Total Data & Tombol Refresh */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-gray-500">
            Menampilkan <strong className="text-gray-800">{items.length}</strong> dari{' '}
            <strong className="text-gray-800">{total}</strong> SKU
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            title="Refresh tabel"
            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition"
          >
            <span className={`inline-block ${loading ? 'animate-spin' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center justify-between">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={handleManualRefresh}
            className="text-xs font-semibold px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION: Tabel Inventory */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">Nama Barang</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Gramasi / Varian</th>
                <th className="py-3.5 px-4">Stok Fisik</th>
                <th className="py-3.5 px-4">Harga Jual</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-gray-500">
                        Memuat data inventory...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl"></span>
                      <p className="font-semibold text-gray-600 text-base">Tidak ada data barang</p>
                      <p className="text-xs text-gray-400">
                        {searchQuery
                          ? `Tidak ditemukan barang yang cocok dengan kata kunci "${searchQuery}"`
                          : 'Belum ada barang di inventory. Silakan tambah barang baru.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-emerald-50/30 transition-colors group"
                  >
                    {/* SKU */}
                    <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-700 whitespace-nowrap">
                      {item.sku}
                    </td>

                    {/* Nama Barang */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                        {item.namaBarang}
                      </div>
                      {item.keterangan && (
                        <div className="text-xs text-gray-400 truncate max-w-xs">
                          {item.keterangan}
                        </div>
                      )}
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                      {item.brand ? (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-md font-medium text-gray-700">
                          {item.brand}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </td>

                    {/* Gramasi / Varian */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                      {item.gramasi || item.varian ? (
                        <span>
                          {item.gramasi}
                          {item.gramasi && item.varian ? ' &bull; ' : ''}
                          {item.varian}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </td>

                    {/* Stok (karton/pcs) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">
                        {formatStok(item.stok, item.pakaiKarton, item.settingPcs)}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Total {item.stok.toLocaleString('id-ID')} pcs
                        {item.pakaiKarton && item.settingPcs > 1 && (
                          <span> (@{item.settingPcs}/krt)</span>
                        )}
                      </div>
                    </td>

                    {/* Harga Jual */}
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-gray-800">
                      {formatRupiah(item.hargaJual)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStockBadge(item.stok, item.stokMinimum)}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-700 rounded-lg text-xs font-semibold transition"
                          title="Edit Barang"
                        >
                          ️ Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-700 rounded-lg text-xs font-semibold transition"
                          title="Hapus Barang"
                        >
                          </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ============================================================ */}
        {/* SECTION: Pagination */}
        {/* ============================================================ */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50/50">
          <div>
            Halaman <strong className="text-gray-900">{page}</strong> dari{' '}
            <strong className="text-gray-900">{totalPages}</strong> (Total {total} data)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              &larr; Sebelumnya
            </button>

            <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              {page}
            </span>

            <button
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.min(totalPages, p + 1));
              }}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Berikutnya &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION: Modal Form (Tambah / Edit Barang) */}
      {/* ============================================================ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-8 relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {modalMode === 'create' ? 'Tambah Master Barang Baru' : `Edit Barang: ${form.sku}`}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Lengkapi data atribut produk, stok fisik awal, dan pengaturan karton.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 text-lg p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                
              </button>
            </div>

            {/* Error in modal */}
            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                {formError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              {/* Row 1: SKU & Nama Barang */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Kode SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit' || submitting}
                    value={form.sku}
                    onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value.toUpperCase() }))}
                    placeholder="Contoh: SKU-001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm disabled:bg-gray-100 font-mono"
                  />
                  {modalMode === 'edit' && (
                    <p className="text-[10px] text-gray-400 mt-0.5">SKU adalah identitas unik dan tidak dapat diubah.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Nama Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    value={form.namaBarang}
                    onChange={(e) => setForm((p) => ({ ...p, namaBarang: e.target.value }))}
                    placeholder="Contoh: Minyak Goreng 2L"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>
              </div>

              {/* Row 2: Brand, Gramasi, Varian */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Brand / Merek
                  </label>
                  <input
                    type="text"
                    disabled={submitting}
                    value={form.brand}
                    onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                    placeholder="Contoh: Bimoli"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Gramasi / Ukuran
                  </label>
                  <input
                    type="text"
                    disabled={submitting}
                    value={form.gramasi}
                    onChange={(e) => setForm((p) => ({ ...p, gramasi: e.target.value }))}
                    placeholder="Contoh: 2000 ml / 500 gr"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Varian / Rasa
                  </label>
                  <input
                    type="text"
                    disabled={submitting}
                    value={form.varian}
                    onChange={(e) => setForm((p) => ({ ...p, varian: e.target.value }))}
                    placeholder="Contoh: Original"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>
              </div>

              {/* Row 3: Stok Fisik & Stok Minimum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Stok Fisik (pcs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={submitting}
                    value={form.stok}
                    onChange={(e) => setForm((p) => ({ ...p, stok: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Batas Stok Minimum (pcs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={submitting}
                    value={form.stokMinimum}
                    onChange={(e) => setForm((p) => ({ ...p, stokMinimum: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Sistem akan menandai status &quot;Kritis&quot; jika stok &le; nilai ini.</p>
                </div>
              </div>

              {/* Row 4: Harga Beli & Harga Jual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Harga Beli (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={submitting}
                    value={form.hargaBeli}
                    onChange={(e) => setForm((p) => ({ ...p, hargaBeli: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={submitting}
                    value={form.hargaJual}
                    onChange={(e) => setForm((p) => ({ ...p, hargaJual: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                  />
                </div>
              </div>

              {/* Row 5: Pengaturan Karton (Setting Pcs & Pakai Karton) */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="pakaiKarton"
                    checked={form.pakaiKarton}
                    onChange={(e) => setForm((p) => ({ ...p, pakaiKarton: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="pakaiKarton" className="text-sm font-semibold text-gray-800 cursor-pointer">
                    Gunakan Satuan Karton untuk Barang Ini
                  </label>
                </div>

                {form.pakaiKarton && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Isi per Karton (Setting Pcs)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        value={form.settingPcs}
                        onChange={(e) => setForm((p) => ({ ...p, settingPcs: e.target.value }))}
                        className="w-32 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-gray-500">pcs per 1 karton</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 6: Keterangan */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Keterangan Tambahan
                </label>
                <textarea
                  rows={2}
                  disabled={submitting}
                  value={form.keterangan}
                  onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))}
                  placeholder="Catatan lokasi rak, spesifikasi, atau info supplier..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold text-sm rounded-xl transition flex items-center gap-2 shadow-md"
                >
                  {submitting && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{modalMode === 'create' ? 'Simpan Barang' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION: Modal Konfirmasi Hapus */}
      {/* ============================================================ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto">
              </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hapus Barang Ini?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Apakah Anda yakin ingin menghapus{' '}
                <strong className="text-gray-800">
                  {deleteTarget.namaBarang} ({deleteTarget.sku})
                </strong>
                ? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition flex items-center gap-2"
              >
                {deleting && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
