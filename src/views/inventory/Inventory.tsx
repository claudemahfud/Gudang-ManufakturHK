'use client';

// ============================================================
// PAGE: Inventory (Master Barang)
// Route: /inventory
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { formatRupiah, formatStok } from '@/shared/lib/utils';
import type { InventoryItem } from '@/shared/types';
import { useDivision } from '@/shared/context/DivisionContext';
import { Factory, Coffee, Download, Trash2, AlertCircle, Sparkles, Info, Plus } from 'lucide-react';
import { exportToCsv } from '@/shared/lib/export';
import { ToastFloater, ToastData } from '@/shared/components/ui/ToastFloater';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';

// ============================================================
// SECTION: Interfaces & Initial State
// ============================================================

interface FormState {
  sku: string;
  namaBarang: string;
  supplier: string;
  brand: string;
  gramasi: string;
  varian: string;
  stok: number | string;
  hargaBeli: number | string;
  hargaBeliKarton: number | string;
  hargaJual: number | string;
  settingPcs: number | string;
  pakaiKarton: boolean;
  stokMinimum: number | string;
  keterangan: string;
}

const initialForm: FormState = {
  sku: '',
  namaBarang: '',
  supplier: '',
  brand: '',
  gramasi: '',
  varian: '',
  stok: 0,
  hargaBeli: 0,
  hargaBeliKarton: 0,
  hargaJual: 0,
  settingPcs: 1,
  pakaiKarton: true,
  stokMinimum: 10,
  keterangan: '',
};

// ============================================================
// SECTION: Main Component
// ============================================================

export default function Inventory() {
  const { division, isManufaktur, isFnb } = useDivision();

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
  const [toast, setToast] = useState<ToastData | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: number; nama: string; kode?: string }[]>([]);

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
  // SECTION: Helper Toast Mengambang (Menyertakan Keterangan & Penyebab)
  // ============================================================

  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    penyebab?: string,
    title?: string
  ) => {
    setToast({ type, message, penyebab, title });
    setTimeout(() => {
      setToast(null);
    }, 6000);
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
          divisi: division,
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
  }, [page, limit, searchQuery, refreshKey, division]);

  // Load Daftar Supplier untuk dropdown dan validasi bisnis
  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await fetch('/api/suppliers');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSuppliers(json.data);
        }
      } catch (err) {
        console.error('Gagal mengambil data suplier:', err);
      }
    }
    loadSuppliers();
  }, [refreshKey]);

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
    if (suppliers.length === 0) {
      showToast(
        'warning',
        'Belum Ada Suplier Terdaftar!',
        'Aturan bisnis mewajibkan setiap barang baru terhubung dengan Suplier resmi sebagai sumber asal barang masuk. Silakan daftarkan minimal 1 Suplier di menu "Daftar Suplier" terlebih dahulu.',
        'Pendaftaran Suplier Diperlukan'
      );
      return;
    }
    setModalMode('create');
    setForm({
      ...initialForm,
      supplier: suppliers[0]?.nama || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setModalMode('edit');
    setForm({
      sku: item.sku,
      namaBarang: item.namaBarang,
      supplier: item.supplier || suppliers[0]?.nama || '',
      brand: item.brand || '',
      gramasi: item.gramasi || '',
      varian: item.varian || '',
      stok: item.stok,
      hargaBeli: item.hargaBeli || 0,
      hargaBeliKarton: item.hargaBeliKarton || 0,
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
    if (!form.supplier?.trim()) {
      setFormError('Suplier wajib dipilih sebagai sumber asal barang');
      return;
    }

    // Aturan Wajib: Nama item sama dengan Suplier beda -> Wajib isi Brand
    const duplicateNameItem = items.find(
      (it) =>
        it.sku !== form.sku &&
        it.namaBarang.trim().toLowerCase() === form.namaBarang.trim().toLowerCase()
    );

    if (
      duplicateNameItem &&
      duplicateNameItem.supplier &&
      form.supplier &&
      duplicateNameItem.supplier.trim().toLowerCase() !== form.supplier.trim().toLowerCase()
    ) {
      if (!form.brand.trim()) {
        const errorMsg = `Brand / Merek wajib diisi! Ditemukan barang bernama "${duplicateNameItem.namaBarang}" dari Suplier lain ("${duplicateNameItem.supplier}"). Cantumkan Brand agar tidak tertukar.`;
        setFormError(errorMsg);
        showToast(
          'warning',
          'Wajib Menambahkan Brand / Merek!',
          `Barang dengan nama serupa sudah ada dari Suplier "${duplicateNameItem.supplier}". Anda wajib mencantumkan Brand/Merek untuk membedakan produk.`,
          'Validasi Brand Produk'
        );
        return;
      }
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
        supplier: form.supplier.trim(),
        brand: form.brand.trim() || null,
        gramasi: form.gramasi.trim() || null,
        varian: form.varian.trim() || null,
        // Stok tidak dikirim: hanya berubah lewat Barang Masuk / Barang Keluar
        hargaBeli: Number(form.hargaBeli) || 0,
        hargaBeliKarton: form.pakaiKarton ? Number(form.hargaBeliKarton) || 0 : 0,
        hargaJual: Number(form.hargaJual) || 0,
        settingPcs: Math.max(1, Number(form.settingPcs) || 1),
        pakaiKarton: Boolean(form.pakaiKarton),
        stokMinimum: Number(form.stokMinimum) || 0,
        divisi: division,
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
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data';
      setFormError(msg);
      showToast('error', `Gagal menyimpan data barang ${form.sku}`, msg, 'Eksekusi Form Gagal');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // SECTION: Delete Item Handler & Stock Validation Rules
  // Aturan SOP: Barang hanya boleh dihapus jika stok fisik = 0 (habis)
  // ============================================================

  // Trigger validasi hapus dari tombol di dalam Pop-up Edit Modal
  const handleInitiateDeleteFromModal = () => {
    const currentStock = Number(form.stok) || 0;
    if (currentStock > 0) {
      showToast(
        'error',
        `Barang "${form.namaBarang}" (${form.sku}) tidak dapat dihapus!`,
        `Sisa stok fisik masih ${currentStock} pcs. Stok barang harus 0 / habis terlebih dahulu (dikeluarkan via penjualan kasir POS, pengeluaran barang keluar, atau dicatat sebagai barang rusak / retur) untuk menjaga integritas dan audit alur inventaris.`,
        'Aksi Hapus Barang Ditolak'
      );
      return;
    }

    // Stok sudah 0, buka modal konfirmasi hapus permanen
    const targetItem =
      items.find((i) => i.sku === form.sku) ||
      ({
        id: 0,
        sku: form.sku,
        namaBarang: form.namaBarang,
        stok: 0,
        settingPcs: 1,
        pakaiKarton: false,
      } as unknown as InventoryItem);

    setDeleteTarget(targetItem);
  };

  // Trigger validasi hapus dari tombol di tabel list
  const handleInitiateDeleteFromTable = (item: InventoryItem) => {
    const currentStock = Number(item.stok) || 0;
    if (currentStock > 0) {
      showToast(
        'error',
        `Barang "${item.namaBarang}" (${item.sku}) tidak dapat dihapus!`,
        `Sisa stok fisik masih tercatat ${currentStock} pcs. Stok barang harus 0 / habis terlebih dahulu (dikeluarkan via penjualan kasir POS, barang keluar, atau dicatat sebagai barang rusak / retur) untuk menjaga kesehatan alur inventaris gudang.`,
        'Aksi Hapus Barang Ditolak'
      );
      return;
    }

    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);

      const res = await fetch(`/api/inventory/${encodeURIComponent(deleteTarget.sku)}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast(
          'error',
          json.error || `Gagal menghapus barang ${deleteTarget.sku}`,
          json.penyebab || 'Validasi server menolak penghapusan barang.',
          'Penghapusan Barang Gagal'
        );
        return;
      }

      showToast(
        'success',
        `Barang ${deleteTarget.sku} (${deleteTarget.namaBarang}) berhasil dihapus dari inventory.`,
        undefined,
        'Barang Berhasil Dihapus'
      );
      setDeleteTarget(null);
      setModalOpen(false); // Tutup modal edit jika sedang terbuka
      handleManualRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi gangguan koneksi ke server';
      showToast(
        'error',
        `Gagal memproses penghapusan barang ${deleteTarget.sku}`,
        msg,
        'Gangguan Jaringan'
      );
    } finally {
      setDeleting(false);
    }
  };

  // ============================================================
  // SECTION: Helper Badge Status Stok
  // ============================================================

  // Status stok ditandai lewat warna latar baris: merah = habis, kuning = kritis, putih = aman
  const kelasBarisStok = (stok: number, stokMinimum: number | null | undefined) => {
    const min = stokMinimum ?? 10;
    if (stok <= 0) return { kelas: 'bg-red-50 hover:bg-red-100/70', status: 'Stok habis' };
    if (stok <= min) return { kelas: 'bg-amber-50 hover:bg-amber-100/70', status: 'Stok kritis' };
    return { kelas: 'hover:bg-emerald-50/30', status: 'Stok aman' };
  };

  // ============================================================
  // SECTION: Render View
  // ============================================================

  const handleExportExcel = () => {
    exportToCsv({
      filename: `Master_Inventory_${division}`,
      data: items,
      columns: [
        { header: 'SKU', accessor: (i) => i.sku },
        { header: 'Nama Barang', accessor: (i) => i.namaBarang },
        { header: 'Brand / Merk', accessor: (i) => i.brand || '-' },
        { header: 'Gramasi', accessor: (i) => i.gramasi || '-' },
        { header: 'Varian', accessor: (i) => i.varian || '-' },
        { header: 'Stok Fisik (Pcs)', accessor: (i) => i.stok },
        {
          header: 'Kemasan / Konversi',
          accessor: (i) =>
            i.pakaiKarton
              ? formatStok(i.stok, Boolean(i.pakaiKarton), Number(i.settingPcs || 1))
              : `${i.stok} pcs`,
        },
        { header: 'Harga Beli Modal (Rp)', accessor: (i) => Number(i.hargaBeli || 0) },
        { header: 'Harga Beli / Karton (Rp)', accessor: (i) => Number(i.hargaBeliKarton || 0) },
        { header: 'Harga Jual (Rp)', accessor: (i) => Number(i.hargaJual || 0) },
        { header: 'Stok Minimum Alert', accessor: (i) => i.stokMinimum || 10 },
        { header: 'Tipe Item', accessor: (i) => i.tipeItem || 'barang_jadi' },
        { header: 'Divisi', accessor: (i) => i.divisi || 'MANUFAKTUR' },
        { header: 'Cabang', accessor: (i) => (i as any).cabang || 'Pusat' },
      ],
    });
  };

  // Deteksi Duplikasi & Strategi Multi-Suplier
  const duplicateNameExisting = form.namaBarang.trim()
    ? items.find(
        (it) =>
          it.sku !== form.sku &&
          it.namaBarang.trim().toLowerCase() === form.namaBarang.trim().toLowerCase()
      )
    : null;

  // Kasus 1: Nama sama, Suplier beda, Brand masih KOSONG -> Wajib minta user menambahkan brand
  const isDifferentSupplierMissingBrand = Boolean(
    duplicateNameExisting &&
      duplicateNameExisting.supplier &&
      form.supplier &&
      duplicateNameExisting.supplier.trim().toLowerCase() !== form.supplier.trim().toLowerCase() &&
      !form.brand.trim()
  );

  // Kasus 2: Nama sama, Brand sama, Suplier beda, dan Harga Beli beda -> Atur strategi penerapannya
  const isSameBrandDifferentSupplierAndPrice = Boolean(
    duplicateNameExisting &&
      duplicateNameExisting.supplier &&
      form.supplier &&
      duplicateNameExisting.supplier.trim().toLowerCase() !== form.supplier.trim().toLowerCase() &&
      form.brand.trim() &&
      duplicateNameExisting.brand &&
      form.brand.trim().toLowerCase() === duplicateNameExisting.brand.trim().toLowerCase() &&
      Number(form.hargaBeli) > 0 &&
      Number(duplicateNameExisting.hargaBeli) > 0 &&
      Number(form.hargaBeli) !== Number(duplicateNameExisting.hargaBeli)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert Floater dengan Keterangan & Penyebab */}
      <ToastFloater toast={toast} onClose={() => setToast(null)} />

      {/* 1. Header Halaman & Action Button (F-Pattern Top Row) */}
      <header className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium mb-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold ${
                isManufaktur
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isManufaktur ? <Factory className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
              {isManufaktur ? 'Divisi Manufaktur' : 'Divisi Food & Beverages'}
            </span>
            <span className="text-gray-400">&bull;</span>
            <span className="text-gray-500">Warehouse Terisolasi</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {isManufaktur ? 'Master Barang & Stok Pabrik' : 'Master Barang: Bahan Baku & Menu F&B'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isManufaktur
              ? 'Kelola master SKU barang manufaktur, stok fisik karton/bal, dan konversi packing.'
              : 'Kelola stok bahan mentah cafe/resto (gram, ml, pcs, cup) dan menu siap jual.'}
          </p>
        </div>

        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={Download} label="Ekspor Excel" onClick={handleExportExcel} warna="hijau" />
          </GrupIkon>
          <TombolUtama ikon={Plus} onClick={openCreateModal}>
            Tambah Barang Baru
          </TombolUtama>
        </AksiHeader>
      </header>

      {/* 2. Filter & Search Bar (F-Pattern Second Row) */}
      <section aria-label="Pencarian dan Filter Stok" className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
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
      </section>

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
      {/* 3. SECTION: Tabel Inventory (F-Pattern Reading Grid) */}
      {/* ============================================================ */}
      <section aria-label="Tabel Master Barang" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-b border-gray-100 text-[11px] text-gray-500">
          <span className="font-semibold text-gray-600">Warna baris:</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" />Stok habis</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />Stok kritis (&le; stok minimum)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-gray-200" />Aman</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">Nama Barang</th>
                <th className="py-3.5 px-4">Suplier / Brand</th>
                <th className="py-3.5 px-4">Gramasi / Varian</th>
                <th className="py-3.5 px-4">Stok Fisik</th>
                <th className="py-3.5 px-4">Harga Jual</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
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
                  <td colSpan={7} className="py-16 text-center text-gray-400">
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
                items.map((item) => {
                  const baris = kelasBarisStok(item.stok, item.stokMinimum);
                  return (
                  <tr
                    key={item.id}
                    title={baris.status}
                    className={`${baris.kelas} transition-colors group`}
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

                    {/* Suplier / Brand (2 baris) */}
                    <td className="py-3 px-4 text-xs">
                      <div className={item.supplier ? 'font-semibold text-blue-800' : 'italic text-gray-400'}>
                        {item.supplier || 'Suplier belum diatur'}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{item.brand || '-'}</div>
                    </td>

                    {/* Gramasi / Varian (2 baris) */}
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <div className="font-medium text-gray-800">{item.gramasi || '-'}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{item.varian || '-'}</div>
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

                    {/* Aksi */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-700 rounded-lg text-xs font-semibold transition"
                          title="Edit Barang"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInitiateDeleteFromTable(item)}
                          className="p-1.5 bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-600 rounded-lg transition"
                          title="Hapus Barang (Stok harus 0)"
                          aria-label={`Hapus ${item.namaBarang}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ============================================================ */}
        {/* SECTION: Pagination */}
        {/* ============================================================ */}
        {/* Semantic Pagination Footer */}
        <footer className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 bg-gray-50/50">
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
        </footer>
      </section>

      {/* ============================================================ */}
      {/* SECTION: Modal Form (Tambah / Edit Barang — Desktop Landscape) */}
      {/* ============================================================ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl lg:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden relative border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed Top) */}
            <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-gray-100 shrink-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {modalMode === 'create' ? 'Tambah Master Barang Baru' : `Edit Barang: ${form.sku}`}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Lengkapi data atribut produk, harga, dan pengaturan karton. Stok diisi lewat Barang Masuk.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 text-lg p-1.5 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            {/* Error in modal */}
            {formError && (
              <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold shrink-0">
                {formError}
              </div>
            )}

            {/* Form Body (Landscape 2 Columns on Desktop) */}
            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                  {/* Kolom Kiri: Identitas Produk & Spesifikasi */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100 flex items-center gap-1.5">
                      <span>Identitas Produk &amp; Suplier</span>
                    </div>

                    {/* Pilih Suplier (Wajib) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Suplier Asal Barang <span className="text-red-500">*</span>
                        </label>
                        <a
                          href="/suplier"
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                        >
                          + Kelola Suplier
                        </a>
                      </div>
                      <select
                        required
                        disabled={submitting}
                        value={form.supplier}
                        onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm bg-white font-medium text-gray-800"
                      >
                        <option value="">-- Pilih Suplier Resmi --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.nama}>
                            {s.nama} {s.kode ? `(${s.kode})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Sumber asal barang masuk yang mensuplai stok produk ini.
                      </p>
                    </div>

                    {/* SKU & Nama Barang */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                          <p className="text-[10px] text-gray-400 mt-0.5">SKU unik tidak dapat diubah.</p>
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
                          placeholder="Contoh: Kulit Pangsit Renyah"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                        />
                      </div>
                    </div>

                    {/* Brand, Gramasi, Varian */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Brand / Merek {isDifferentSupplierMissingBrand && <span className="text-red-600 font-bold">* WAJIB</span>}
                        </label>
                        <input
                          type="text"
                          disabled={submitting}
                          value={form.brand}
                          onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                          placeholder={isDifferentSupplierMissingBrand ? 'Wajib isi merek...' : 'Merek'}
                          className={`w-full px-3 py-2 rounded-xl border outline-none transition text-xs sm:text-sm ${
                            isDifferentSupplierMissingBrand
                              ? 'border-red-400 ring-2 ring-red-100 bg-red-50/30 text-red-900 placeholder-red-400'
                              : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Gramasi
                        </label>
                        <input
                          type="text"
                          disabled={submitting}
                          value={form.gramasi}
                          onChange={(e) => setForm((p) => ({ ...p, gramasi: e.target.value }))}
                          placeholder="500g"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-xs sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Varian
                        </label>
                        <input
                          type="text"
                          disabled={submitting}
                          value={form.varian}
                          onChange={(e) => setForm((p) => ({ ...p, varian: e.target.value }))}
                          placeholder="Original"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-xs sm:text-sm"
                        />
                      </div>
                    </div>

                    {/* Alert 1: Nama Item Sama, Suplier Beda -> Wajib Tambahkan Brand */}
                    {isDifferentSupplierMissingBrand && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong className="block font-bold text-amber-950 mb-0.5">
                            Wajib Tambahkan Brand / Merek!
                          </strong>
                          Ditemukan barang dengan nama &quot;<strong>{duplicateNameExisting?.namaBarang}</strong>&quot; yang sudah ada dari Suplier lain (&quot;<strong>{duplicateNameExisting?.supplier}</strong>&quot;). 
                          Untuk mencegah salah ambil fisik barang dan tertukar di gudang maupun kasir POS, Anda <strong>wajib mengisi kolom Brand</strong> di atas.
                        </div>
                      </div>
                    )}

                    {/* Alert 2: Kondisi Brand Sama, Suplier Beda, Harga Beli Beda -> Atur Strategi Penerapannya */}
                    {isSameBrandDifferentSupplierAndPrice && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-xs space-y-2.5 animate-in fade-in shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span>Strategi Multi-Suplier &amp; Perbedaan Harga Beli</span>
                        </div>
                        <p className="text-amber-800 leading-relaxed text-[11px]">
                          Produk <strong>{form.namaBarang} ({form.brand})</strong> sudah terdaftar dari Suplier <strong>{duplicateNameExisting?.supplier}</strong> seharga <strong>{formatRupiah(duplicateNameExisting?.hargaBeli)}</strong>. 
                          Saat ini Anda memasukkan dari Suplier <strong>{form.supplier}</strong> seharga <strong>{formatRupiah(form.hargaBeli)}</strong>. 
                          Pilih strategi pengelolaan yang diinginkan:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {/* Strategi A: Varian SKU Terpisah */}
                          <div className="p-2.5 rounded-lg bg-white border border-amber-300 flex flex-col justify-between">
                            <div>
                              <div className="font-bold text-gray-900 text-[11px] mb-0.5">
                                Strategi 1: SKU Varian Terpisah
                              </div>
                              <p className="text-[10px] text-gray-500 mb-2 leading-tight">
                                Stok &amp; retur terisolasi per suplier. Otomatis tambahkan kode suplier pada SKU.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const suplierSuffix = (form.supplier || 'SUP')
                                  .replace(/[^a-zA-Z0-9]/g, '')
                                  .substring(0, 4)
                                  .toUpperCase();
                                setForm((prev) => ({
                                  ...prev,
                                  sku: `${duplicateNameExisting?.sku || 'SKU'}-${suplierSuffix}`,
                                }));
                                showToast(
                                  'info',
                                  'SKU Varian Dibuat',
                                  `Kode SKU disesuaikan menjadi ${duplicateNameExisting?.sku || 'SKU'}-${suplierSuffix}`
                                );
                              }}
                              className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition"
                            >
                              Terapkan SKU ({duplicateNameExisting?.sku || 'SKU'}-{(form.supplier || 'SUP').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()})
                            </button>
                          </div>

                          {/* Strategi B: Moving Average HPP via Barang Masuk */}
                          <div className="p-2.5 rounded-lg bg-white border border-emerald-300 flex flex-col justify-between">
                            <div>
                              <div className="font-bold text-emerald-900 text-[11px] mb-0.5">
                                Strategi 2: Moving Average HPP
                              </div>
                              <p className="text-[10px] text-gray-600 mb-2 leading-tight">
                                Jika fisik barang &amp; barcode kasir sama, catat muatan via menu Barang Masuk untuk kalkulasi HPP rata-rata.
                              </p>
                            </div>
                            <a
                              href="/barang-masuk"
                              className="block text-center py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition"
                            >
                              Buka Form Barang Masuk
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Keterangan */}
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
                        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-xs sm:text-sm resize-none"
                      />
                    </div>
                  </div>

                  {/* Kolom Kanan: Stok, Harga & Pengaturan Kemasan */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider pb-1 border-b border-emerald-100 flex items-center gap-1.5">
                      <span>Stok &amp; Finansial</span>
                    </div>

                    {/* Stok Fisik & Stok Minimum */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Stok Fisik (pcs)
                        </label>
                        <input
                          type="number"
                          readOnly
                          value={modalMode === 'create' ? 0 : form.stok}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed outline-none text-sm font-semibold"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Hanya berubah lewat Barang Masuk / Keluar.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Batas Stok Minimum
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={submitting}
                          value={form.stokMinimum}
                          onChange={(e) => setForm((p) => ({ ...p, stokMinimum: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Alert Kritis jika stok &le; nilai ini.</p>
                      </div>
                    </div>

                    {/* Harga Beli & Harga Jual dengan Penjelasan Bisnis */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                          Harga Beli per Pcs (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={submitting}
                          value={form.hargaBeli}
                          onChange={(e) => setForm((p) => ({ ...p, hargaBeli: e.target.value }))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm font-semibold"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Dibayar kepada <strong>Suplier</strong>
                        </p>
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
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition text-sm font-semibold text-emerald-800"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Dijual kembali ke <strong>Pelanggan / Pasar</strong>
                        </p>
                      </div>
                    </div>

                    {/* Preview Estimasi Margin */}
                    {Number(form.hargaJual) > 0 && (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">Estimasi Margin Laba:</span>
                        <span
                          className={`font-bold ${
                            Number(form.hargaJual) >= Number(form.hargaBeli)
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {formatRupiah(Number(form.hargaJual) - Number(form.hargaBeli))}
                          {Number(form.hargaBeli) > 0 && (
                            <span className="text-[10px] ml-1 font-normal text-gray-500">
                              (
                              {(
                                ((Number(form.hargaJual) - Number(form.hargaBeli)) /
                                  Number(form.hargaBeli)) *
                                100
                              ).toFixed(1)}
                              %)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Pengaturan Karton (Setting Pcs & Pakai Karton) */}
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="pakaiKarton"
                          checked={form.pakaiKarton}
                          onChange={(e) => setForm((p) => ({ ...p, pakaiKarton: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <label htmlFor="pakaiKarton" className="text-xs sm:text-sm font-semibold text-gray-800 cursor-pointer">
                          Gunakan Satuan Karton untuk Barang Ini
                        </label>
                      </div>

                      {form.pakaiKarton && (
                        <div className="pt-1">
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">
                            Isi per Karton (Setting Pcs)
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={1}
                              value={form.settingPcs}
                              onChange={(e) => setForm((p) => ({ ...p, settingPcs: e.target.value }))}
                              className="w-28 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                            />
                            <span className="text-xs text-gray-500">pcs per 1 karton</span>
                          </div>
                          <label className="block text-[11px] font-medium text-gray-600 mt-2.5 mb-1">
                            Harga Beli per Karton (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            disabled={submitting}
                            value={form.hargaBeliKarton}
                            onChange={(e) => setForm((p) => ({ ...p, hargaBeliKarton: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            Harga 1 karton dari Suplier (bisa beda dari harga pcs × isi).
                            {Number(form.hargaBeliKarton) > 0 && Number(form.settingPcs) > 1 && (
                              <> Setara <strong>{formatRupiah(Number(form.hargaBeliKarton) / Number(form.settingPcs))}</strong> per pcs.</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Bottom Footer) */}
              <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-3.5 border-t border-gray-100 shrink-0 bg-gray-50/80">
                {modalMode === 'edit' ? (
                  <button
                    type="button"
                    onClick={handleInitiateDeleteFromModal}
                    disabled={submitting || deleting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 font-semibold text-xs sm:text-sm transition disabled:opacity-50"
                    title="Hapus barang (stok harus 0)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Barang</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting || deleting}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs sm:text-sm hover:bg-gray-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || deleting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 shadow-md"
                  >
                    {submitting && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    <span>{modalMode === 'create' ? 'Simpan Barang' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION: Modal Konfirmasi Hapus (Aturan Stok = 0) */}
      {/* ============================================================ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-center space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hapus Barang Permanen?</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus produk{' '}
                <strong className="text-gray-900">
                  {deleteTarget.namaBarang} ({deleteTarget.sku})
                </strong>
                ? Sisa stok barang ini sudah terverifikasi <strong>0 pcs (habis)</strong>.
              </p>
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Tindakan ini tidak dapat dibatalkan. Riwayat transaksi sebelumnya tetap tersimpan di database audit.
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
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
