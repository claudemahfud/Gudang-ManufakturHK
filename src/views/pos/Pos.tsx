'use client';

// ============================================================
// PAGE: Fullscreen Point of Sales (POS) — Smartphone & Desktop
// Route: /pos
// Fitur:
// 1. Mobile-first smartphone & tablet checkout
// 2. Setting POS terpisah (Header nota, footer, sound, thermal 58mm)
// 3. Nota Thermal 58mm print layout (@media print)
// 4. Multi-role: Admin, Direktur Utama, Manager, Gudang, Salesman, Agen
// ============================================================

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  Settings,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  User,
  Sliders,
  Receipt,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';
import { ROUTES } from '@/router/routes';
import type { InventoryItem } from '@/shared/types';

// ============================================================
// SECTION: Interfaces & Default Settings
// ============================================================

interface CartItem {
  sku: string;
  namaBarang: string;
  qty: number;
  hargaJual: number;
  stokTersedia: number;
  satuan?: string;
}

interface PosSettings {
  namaToko: string;
  alamatToko: string;
  teleponToko: string;
  pesanFooter: string;
  ukuranKertas: '58mm' | '80mm';
  autoPrint: boolean;
  enableSound: boolean;
  gridMode: 'compact' | 'normal';
  defaultMetode: 'Tunai' | 'Transfer' | 'QRIS';
}

const DEFAULT_POS_SETTINGS: PosSettings = {
  namaToko: 'GUDANG MANUFAKTUR HK',
  alamatToko: 'Pusat Distribusi & Pergudangan Utama',
  teleponToko: '0812-3456-7890',
  pesanFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar.',
  ukuranKertas: '58mm',
  autoPrint: false,
  enableSound: true,
  gridMode: 'normal',
  defaultMetode: 'Tunai',
};

// Web Audio API beep synthesizer (zero dependency)
function playBeep(type: 'add' | 'success' | 'error') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'add') {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'error') {
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Ignore audio errors on un-interacted DOM
  }
}

// ============================================================
// MAIN COMPONENT: Point of Sales (POS)
// ============================================================

export default function PosView() {
  const { data: session } = useSession();
  const user = session?.user as any;

  // Master Data
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('Semua');

  // Cart & Transaction
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pelanggan, setPelanggan] = useState('Umum (Cash)');
  const [diskonPct, setDiskonPct] = useState<number>(0);
  const [metodePembayaran, setMetodePembayaran] = useState<'Tunai' | 'Transfer' | 'QRIS'>('Tunai');
  const [uangDiterima, setUangDiterima] = useState<number>(0);
  const [catatan, setCatatan] = useState('');

  // UI Modals & Views
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // POS Settings State (Local to device / independent from backoffice)
  const [posSettings, setPosSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS);

  // Load POS settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gudang_pos_settings_v1');
      if (saved) {
        setPosSettings({ ...DEFAULT_POS_SETTINGS, ...JSON.parse(saved) });
      }
    } catch {
      // Fallback to default
    }
  }, []);

  const saveSettings = (newSettings: PosSettings) => {
    setPosSettings(newSettings);
    try {
      localStorage.setItem('gudang_pos_settings_v1', JSON.stringify(newSettings));
    } catch {
      // Storage error fallback
    }
    setIsSettingsModalOpen(false);
  };

  // Fetch Inventory items
  useEffect(() => {
    let isCancelled = false;
    async function fetchInventory() {
      setLoadingItems(true);
      try {
        const res = await fetch('/api/inventory');
        const json = await res.json();
        if (json.success && !isCancelled) {
          setInventoryList(json.data || []);
        }
      } catch (err) {
        console.error('Failed to load inventory for POS', err);
      } finally {
        if (!isCancelled) setLoadingItems(false);
      }
    }
    fetchInventory();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Filtered Inventory
  const brands = useMemo(() => {
    const list = Array.from(new Set(inventoryList.map((i) => i.brand).filter(Boolean))) as string[];
    return ['Semua', ...list];
  }, [inventoryList]);

  const filteredItems = useMemo(() => {
    return inventoryList.filter((item) => {
      const matchBrand = selectedBrand === 'Semua' || item.brand === selectedBrand;
      const matchSearch =
        item.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBrand && matchSearch;
    });
  }, [inventoryList, selectedBrand, searchQuery]);

  // Cart Calculations
  const totalItemCount = useMemo(() => cart.reduce((acc, c) => acc + c.qty, 0), [cart]);
  const subtotal = useMemo(() => cart.reduce((acc, c) => acc + c.hargaJual * c.qty, 0), [cart]);
  const nominalDiskon = useMemo(() => (subtotal * Number(diskonPct || 0)) / 100, [subtotal, diskonPct]);
  const grandTotal = useMemo(() => Math.max(0, subtotal - nominalDiskon), [subtotal, nominalDiskon]);
  const kembalian = useMemo(
    () => (metodePembayaran === 'Tunai' ? Math.max(0, uangDiterima - grandTotal) : 0),
    [metodePembayaran, uangDiterima, grandTotal]
  );

  // Cart Actions
  const addToCart = (item: InventoryItem) => {
    if (item.stok <= 0) {
      if (posSettings.enableSound) playBeep('error');
      alert(`Stok "${item.namaBarang}" habis!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.sku === item.sku);
      if (existing) {
        if (existing.qty >= item.stok) {
          if (posSettings.enableSound) playBeep('error');
          alert(`Maksimal stok tercapai (${item.stok} pcs)`);
          return prev;
        }
        if (posSettings.enableSound) playBeep('add');
        return prev.map((c) => (c.sku === item.sku ? { ...c, qty: c.qty + 1 } : c));
      } else {
        if (posSettings.enableSound) playBeep('add');
        return [
          ...prev,
          {
            sku: item.sku,
            namaBarang: item.namaBarang,
            qty: 1,
            hargaJual: Number(item.hargaJual || 0),
            stokTersedia: item.stok,
            satuan: 'pcs',
          },
        ];
      }
    });
  };

  const updateCartQty = (sku: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.sku === sku) {
            const nextQty = c.qty + delta;
            if (nextQty <= 0) return null;
            if (nextQty > c.stokTersedia) {
              alert(`Maksimal stok tersedia hanya ${c.stokTersedia} pcs`);
              return c;
            }
            return { ...c, qty: nextQty };
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (sku: string) => {
    setCart((prev) => prev.filter((c) => c.sku !== sku));
  };

  const clearCart = () => {
    if (cart.length > 0 && confirm('Kosongkan keranjang belanja?')) {
      setCart([]);
    }
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Open Checkout Modal
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setUangDiterima(grandTotal);
    setCheckoutError(null);
    setIsCheckoutModalOpen(true);
  };

  // Process Checkout
  const handleProcessCheckout = async () => {
    if (metodePembayaran === 'Tunai' && uangDiterima < grandTotal) {
      setCheckoutError('Uang yang diterima kurang dari total pembayaran');
      if (posSettings.enableSound) playBeep('error');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          pelanggan,
          metodePembayaran,
          diskonPct,
          uangDiterima: metodePembayaran === 'Tunai' ? uangDiterima : grandTotal,
          catatan,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memproses checkout POS');
      }

      if (posSettings.enableSound) playBeep('success');
      setLastReceipt(json.data);
      setIsCheckoutModalOpen(false);
      setIsReceiptModalOpen(true);
      setCart([]); // Clear cart
      setCatatan('');

      // Auto print if enabled
      if (posSettings.autoPrint) {
        setTimeout(() => {
          window.print();
        }, 500);
      }

      // Refresh stock locally
      setInventoryList((prev) =>
        prev.map((item) => {
          const bought = cart.find((c) => c.sku === item.sku);
          if (bought) {
            return { ...item, stok: item.stok - bought.qty };
          }
          return item;
        })
      );
    } catch (err: any) {
      setCheckoutError(err.message || 'Terjadi kesalahan sistem');
      if (posSettings.enableSound) playBeep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Native 58mm Thermal Print
  const handlePrintThermal = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* ============================================================ */}
      {/* 1. TOP HEADER: Mobile & Desktop POS Bar */}
      {/* ============================================================ */}
      <header className="h-14 sm:h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.DASHBOARD}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                POS Kasir Mobile
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                {posSettings.ukuranKertas}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Kasir: <strong className="text-slate-200">{user?.name || 'Administrator'}</strong> ({user?.role || 'Staff'})
            </p>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() =>
              setPosSettings((p) => ({ ...p, enableSound: !p.enableSound }))
            }
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title={posSettings.enableSound ? 'Suara Aktif' : 'Suara Senyap'}
          >
            {posSettings.enableSound ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Mode Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Setting POS Button */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition border border-slate-700/60"
            title="Pengaturan Khusus POS"
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span className="hidden md:inline">Setting POS</span>
          </button>

          {/* Mobile Cart Floating Badge Button (di layar HP) */}
          <button
            onClick={() => setMobileCartOpen(true)}
            className="lg:hidden relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{cart.length > 0 ? formatRupiah(grandTotal) : 'Keranjang'}</span>
            {totalItemCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white text-emerald-950 text-[10px] font-black">
                {totalItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. MAIN BODY: Catalog Grid (Left) + Cart Drawer (Right) */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* CATALOG VIEW (Left / Full on Mobile) */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-900/60 p-3 sm:p-4 md:p-6">
          {/* Search & Brand Filter Bar */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SKU, nama barang, atau scan barcode..."
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Brand Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition ${
                    selectedBrand === brand
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loadingItems ? (
              <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                Memuat katalog produk inventory...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-sm gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <p>Tidak ada produk ditemukan</p>
              </div>
            ) : (
              <div
                className={`grid gap-2.5 sm:gap-3 ${
                  posSettings.gridMode === 'compact'
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4'
                }`}
              >
                {filteredItems.map((item) => {
                  const inCart = cart.find((c) => c.sku === item.sku);
                  const isOutOfStock = item.stok <= 0;

                  return (
                    <button
                      key={item.sku}
                      onClick={() => addToCart(item)}
                      disabled={isOutOfStock}
                      className={`relative flex flex-col text-left p-3 rounded-2xl border transition-all duration-150 active:scale-95 group ${
                        isOutOfStock
                          ? 'bg-slate-950/40 border-slate-800/40 opacity-50 cursor-not-allowed'
                          : inCart
                          ? 'bg-slate-800 border-emerald-500/70 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-950/80 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* In-Cart Badge */}
                      {inCart && (
                        <span className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-md">
                          {inCart.qty}
                        </span>
                      )}

                      {/* Brand & SKU */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-semibold uppercase truncate">{item.brand || 'Duta Pangan'}</span>
                        <span className="font-mono text-slate-500">{item.sku}</span>
                      </div>

                      {/* Name */}
                      <h3 className="font-semibold text-slate-100 text-xs sm:text-sm line-clamp-2 leading-snug mb-2 group-hover:text-emerald-300 transition">
                        {item.namaBarang}
                      </h3>

                      <div className="mt-auto pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-emerald-400 sm:text-xs">
                            {formatRupiah(Number(item.hargaJual || 0))}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Stok: <strong className={item.stok <= 5 ? 'text-amber-400' : 'text-slate-300'}>{item.stok}</strong>
                          </div>
                        </div>

                        <div className="w-7 h-7 rounded-xl bg-slate-800 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center text-slate-400 transition">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* ============================================================ */}
        {/* 3. CART DRAWER: Desktop Sidebar & Mobile Slide-Over */}
        {/* ============================================================ */}
        <aside
          className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 lg:static lg:w-96 bg-slate-950 border-l border-slate-800 flex flex-col transition-transform duration-300 ${
            mobileCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">Keranjang POS</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold font-mono">
                {totalItemCount} pcs
              </span>
            </div>

            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition"
                  title="Hapus Semua"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setMobileCartOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cart Customer Select / Quick Input */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/40">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
              Nama Pelanggan
            </label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={pelanggan}
                onChange={(e) => setPelanggan(e.target.value)}
                placeholder="Pelanggan umum..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs gap-2 py-12">
                <ShoppingCart className="w-10 h-10 stroke-[1.5]" />
                <p>Keranjang masih kosong</p>
                <p className="text-[11px] text-slate-500">Pilih produk di katalog untuk ditambahkan</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.sku}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-200 truncate">{item.namaBarang}</h4>
                    <div className="text-[11px] text-emerald-400 font-mono font-medium">
                      {formatRupiah(item.hargaJual)} &times; {item.qty} ={' '}
                      <strong className="text-slate-100">{formatRupiah(item.hargaJual * item.qty)}</strong>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                    <button
                      onClick={() => updateCartQty(item.sku, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold font-mono text-white">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.sku, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.sku)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Checkout CTA */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
            {/* Diskon Input */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Diskon Transaksi (%)</span>
              <div className="flex items-center gap-1.5 w-24">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={diskonPct}
                  onChange={(e) => setDiskonPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-500 font-mono">%</span>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 pt-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({totalItemCount} pcs)</span>
                <span className="font-mono text-slate-200">{formatRupiah(subtotal)}</span>
              </div>
              {nominalDiskon > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Potongan Diskon</span>
                  <span className="font-mono">- {formatRupiah(nominalDiskon)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                <span>Grand Total</span>
                <span className="text-emerald-400 font-mono">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm transition shadow-xl shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Bayar & Cetak Nota</span>
              <span className="font-mono">({formatRupiah(grandTotal)})</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ============================================================ */}
      {/* 4. MODAL: Checkout & Pembayaran (Tunai / Transfer / QRIS) */}
      {/* ============================================================ */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Pembayaran Kasir POS</h3>
                <p className="text-xs text-slate-400">Pilih metode bayar dan input nominal uang</p>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Grand Total Display */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Total Tagihan
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1">
                  {formatRupiah(grandTotal)}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Tunai', 'Transfer', 'QRIS'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodePembayaran(m)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition ${
                        metodePembayaran === m
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m === 'Tunai' && <Banknote className="w-5 h-5" />}
                      {m === 'Transfer' && <CreditCard className="w-5 h-5" />}
                      {m === 'QRIS' && <QrCode className="w-5 h-5" />}
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Tendered Input (jika Tunai) */}
              {metodePembayaran === 'Tunai' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Uang Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={uangDiterima || ''}
                    onChange={(e) => setUangDiterima(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                  />

                  {/* Quick Cash Suggestions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setUangDiterima(grandTotal)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 text-xs font-bold hover:bg-slate-700"
                    >
                      Uang Pas
                    </button>
                    {[10000, 20000, 50000, 100000].map((nominal) => (
                      <button
                        key={nominal}
                        type="button"
                        onClick={() => setUangDiterima((prev) => (prev || 0) + nominal)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                      >
                        +{formatRupiah(nominal)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian Calculation */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-sm">
                    <span className="text-slate-400">Kembalian:</span>
                    <span
                      className={`font-mono font-black ${
                        kembalian >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatRupiah(kembalian)}
                    </span>
                  </div>
                </div>
              )}

              {/* Catatan / Keterangan Optional */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="e.g. Pembelian take away / meja 4..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {checkoutError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProcessCheckout}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konfirmasi Pembayaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL: Nota Thermal 58mm & Print Preview */}
      {/* ============================================================ */}
      {isReceiptModalOpen && lastReceipt && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col my-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Transaksi Selesai</span>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Receipt Container (Styled strictly for 58mm printer) */}
            <div className="p-4 sm:p-6 bg-slate-950/60 overflow-y-auto max-h-[65vh]">
              <div
                id="thermal-receipt-58mm"
                className="bg-white text-black p-4 rounded-xl shadow-lg font-mono text-[11px] leading-tight max-w-[280px] sm:max-w-[300px] mx-auto border border-gray-200"
              >
                {/* Header Nota */}
                <div className="text-center pb-2 border-b border-dashed border-gray-400">
                  <div className="font-black text-sm uppercase tracking-wide">
                    {posSettings.namaToko}
                  </div>
                  <div className="text-[10px] text-gray-700 whitespace-pre-line mt-0.5">
                    {posSettings.alamatToko}
                  </div>
                  <div className="text-[10px] text-gray-700 mt-0.5">
                    Telp: {posSettings.teleponToko}
                  </div>
                </div>

                {/* Metadata Trx */}
                <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>No Trx:</span>
                    <strong className="font-bold">{lastReceipt.trxId}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>
                      {new Date(lastReceipt.tanggal).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{lastReceipt.kasir}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span>{lastReceipt.pelanggan}</span>
                  </div>
                </div>

                {/* Itemized List */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-1.5">
                  {lastReceipt.items?.map((it: any, idx: number) => (
                    <div key={idx}>
                      <div className="font-semibold truncate">{it.namaBarang}</div>
                      <div className="flex justify-between text-[10px] text-gray-700">
                        <span>
                          {it.qty} x {it.hargaJual?.toLocaleString('id-ID')}
                        </span>
                        <span>{(it.qty * it.hargaJual)?.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rp {lastReceipt.subtotal?.toLocaleString('id-ID')}</span>
                  </div>
                  {lastReceipt.nominalDiskon > 0 && (
                    <div className="flex justify-between">
                      <span>Diskon ({lastReceipt.diskonPct}%):</span>
                      <span>- Rp {lastReceipt.nominalDiskon?.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-gray-300">
                    <span>TOTAL:</span>
                    <span>Rp {lastReceipt.grandTotal?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Bayar ({lastReceipt.metodePembayaran}):</span>
                    <span>Rp {lastReceipt.uangDiterima?.toLocaleString('id-ID')}</span>
                  </div>
                  {lastReceipt.metodePembayaran === 'Tunai' && (
                    <div className="flex justify-between font-bold">
                      <span>Kembali:</span>
                      <span>Rp {lastReceipt.kembalian?.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>

                {/* Footer Greeting */}
                <div className="text-center pt-3 text-[9px] text-gray-600 whitespace-pre-line leading-snug">
                  {posSettings.pesanFooter}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-2 bg-slate-950">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Transaksi Baru
              </button>

              <button
                type="button"
                onClick={handlePrintThermal}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Nota (58mm)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL: Setting POS (Terpisah dari BackOffice Gudang) */}
      {/* ============================================================ */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Pengaturan Khusus POS</h3>
                  <p className="text-xs text-slate-400">
                    Konfigurasi printer thermal 58mm, nota, dan audio kasir
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                saveSettings({
                  namaToko: String(fd.get('namaToko') || DEFAULT_POS_SETTINGS.namaToko),
                  alamatToko: String(fd.get('alamatToko') || DEFAULT_POS_SETTINGS.alamatToko),
                  teleponToko: String(fd.get('teleponToko') || DEFAULT_POS_SETTINGS.teleponToko),
                  pesanFooter: String(fd.get('pesanFooter') || DEFAULT_POS_SETTINGS.pesanFooter),
                  ukuranKertas: (fd.get('ukuranKertas') as any) || '58mm',
                  autoPrint: fd.get('autoPrint') === 'on',
                  enableSound: fd.get('enableSound') === 'on',
                  gridMode: (fd.get('gridMode') as any) || 'normal',
                  defaultMetode: (fd.get('defaultMetode') as any) || 'Tunai',
                });
              }}
              className="p-5 space-y-4 overflow-y-auto max-h-[70vh]"
            >
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Header & Kontak Nota Kasir
                </h4>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nama Toko / Usaha
                  </label>
                  <input
                    type="text"
                    name="namaToko"
                    defaultValue={posSettings.namaToko}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Alamat pada Nota
                  </label>
                  <textarea
                    name="alamatToko"
                    rows={2}
                    defaultValue={posSettings.alamatToko}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nomor WhatsApp / Telp
                  </label>
                  <input
                    type="text"
                    name="teleponToko"
                    defaultValue={posSettings.teleponToko}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Printer Thermal & Kertas
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Ukuran Kertas Thermal
                    </label>
                    <select
                      name="ukuranKertas"
                      defaultValue={posSettings.ukuranKertas}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="58mm">58mm (Kecil / Mobile POS)</option>
                      <option value="80mm">80mm (Standar Kasir Besar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Tata Letak Produk
                    </label>
                    <select
                      name="gridMode"
                      defaultValue={posSettings.gridMode}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="normal">Normal (Katalog Standar)</option>
                      <option value="compact">Kompak (Banyak Produk di Layar HP)</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      name="autoPrint"
                      defaultChecked={posSettings.autoPrint}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-200">Auto Print Nota</div>
                      <div className="text-[10px] text-slate-400">
                        Otomatis buka dialog cetak thermal begitu checkout sukses
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      name="enableSound"
                      defaultChecked={posSettings.enableSound}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-200">Suara Beep Kasir</div>
                      <div className="text-[10px] text-slate-400">
                        Mainkan audio efek saat tambah item dan transaksi berhasil
                      </div>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Pesan Footer Nota
                  </label>
                  <textarea
                    name="pesanFooter"
                    rows={2}
                    defaultValue={posSettings.pesanFooter}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950 -mx-5 -mb-5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20"
                >
                  Simpan Setting POS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. DEDICATED PRINT STYLES FOR 58mm THERMAL PRINTER */}
      {/* ============================================================ */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt-58mm,
          #thermal-receipt-58mm * {
            visibility: visible;
          }
          #thermal-receipt-58mm {
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 9.5px !important;
            color: black !important;
            background: white !important;
          }
          @page {
            size: 58mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
