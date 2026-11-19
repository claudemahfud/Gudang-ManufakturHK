'use client';

// ============================================================
// PAGE: Kalkulator HPP & Resep (BOM) — F&B & Manufaktur Terpadu
// Route: /kalkulator-hpp
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Package,
  Layers,
  ChevronRight,
  Sparkles,
  Info,
  X,
  Utensils,
  Factory,
} from 'lucide-react';
import { formatRupiah } from '@/shared/lib/utils';

export default function KalkulatorHppView() {
  const [items, setItems] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDivisi, setSelectedDivisi] = useState<'ALL' | 'FNB' | 'MANUFAKTUR'>('ALL');

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);

  // New Recipe Form
  const [selectedBahanSku, setSelectedBahanSku] = useState('');
  const [takaran, setTakaran] = useState('');
  const [satuan, setSatuan] = useState('gram');
  const [jenisKomponen, setJenisKomponen] = useState<'bahan' | 'kemasan'>('bahan');
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fnb/hpp');
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        setRawMaterials(json.rawMaterials || []);
      }
    } catch (err) {
      console.error('Failed to load HPP calculator data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddRecipeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedBahanSku || !takaran) return;

    const bahan = rawMaterials.find((r) => r.sku === selectedBahanSku);
    if (!bahan) return;

    setIsSavingRecipe(true);
    try {
      const res = await fetch('/api/fnb/hpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuSku: selectedItem.sku,
          bahanSku: bahan.sku,
          namaBahan: bahan.namaBarang,
          takaran: Number(takaran),
          satuan,
          jenis: jenisKomponen,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsAddRecipeOpen(false);
        setTakaran('');
        fetchData(); // refresh calculations
      }
    } catch (err) {
      console.error('Failed to add recipe item', err);
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchDivisi =
        selectedDivisi === 'ALL' || item.divisi === selectedDivisi;
      const matchSearch =
        item.namaBarang.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      return matchDivisi && matchSearch;
    });
  }, [items, selectedDivisi, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-semibold mb-1 border border-amber-200">
            <Calculator className="w-3.5 h-3.5" />
            <span>Harmonisasi Plafon Gudang: Resep & HPP Terpadu</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Kalkulator HPP & Resep (BOM)
          </h1>
          <p className="text-xs text-gray-500">
            Hitung harga pokok penjualan otomatis dari komposisi bahan baku (BOM), kemasan, susut (waste), dan utilitas untuk menu F&B serta olahan manufaktur.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Division Selector & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Divisi Tabs */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 mr-1 hidden sm:inline">Plafon Divisi:</span>
          <button
            onClick={() => setSelectedDivisi('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              selectedDivisi === 'ALL'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>Semua Plafon</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
              {items.length}
            </span>
          </button>
          <button
            onClick={() => setSelectedDivisi('FNB')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              selectedDivisi === 'FNB'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>F&B / Cafe / Resto</span>
          </button>
          <button
            onClick={() => setSelectedDivisi('MANUFAKTUR')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              selectedDivisi === 'MANUFAKTUR'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Pabrik Manufaktur</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu, produk, atau SKU..."
            className="w-full bg-gray-50/70 border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs">
            Memuat kalkulasi HPP dan resep...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 text-xs">
            Tidak ada produk ditemukan.
          </div>
        ) : (
          filteredItems.map((item) => {
            const hasRecipe = item.resepCount > 0;
            const evalHpp = item.evaluasi;
            const isFnb = item.divisi === 'FNB';

            return (
              <div
                key={item.sku}
                className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm flex flex-col justify-between hover:border-gray-300 transition"
              >
                <div>
                  {/* Division Tag & SKU */}
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                        isFnb
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.divisi}
                    </span>
                    <span className="font-mono text-gray-400">{item.sku}</span>
                  </div>

                  {/* Product Title */}
                  <h3 className="font-bold text-gray-900 text-sm mb-1 leading-snug">
                    {item.namaBarang}
                  </h3>
                  <div className="text-[11px] text-gray-400 mb-3">
                    Brand: <strong className="text-gray-600">{item.brand || '-'}</strong> &bull; Satuan: {item.gramasi || 'pcs'}
                  </div>

                  {/* HPP & Margin Breakdown Box */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5 text-xs mb-3 font-mono">
                    <div className="flex justify-between text-gray-600">
                      <span>Harga Jual:</span>
                      <strong className="text-gray-900 font-bold">
                        {formatRupiah(evalHpp.hargaJual)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>HPP Total:</span>
                      <strong className="text-amber-700 font-bold">
                        {formatRupiah(evalHpp.hppTotal)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-gray-600 pt-1 border-t border-gray-200">
                      <span>Gross Margin:</span>
                      <span className="text-emerald-700 font-bold">
                        {formatRupiah(evalHpp.marginRupiah)} ({evalHpp.marginPersen}%)
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Food Cost %:</span>
                      <span
                        className={`font-bold ${
                          evalHpp.marginTipis ? 'text-red-600' : 'text-gray-700'
                        }`}
                      >
                        {evalHpp.foodCostPersen}%
                      </span>
                    </div>
                  </div>

                  {/* Recipe Items Counter */}
                  <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      {hasRecipe
                        ? `${item.resepCount} Komponen Resep (BOM) Terpasang`
                        : 'Belum ada resep bahan (HPP Dasar)'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  {evalHpp.marginTipis ? (
                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Margin Tipis (&gt;40%)</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      <span>Margin Sehat</span>
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setIsAddRecipeOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold transition"
                  >
                    <span>Kelola Resep</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Kelola Resep / BOM */}
      {isAddRecipeOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Resep & Bill of Materials (BOM)
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedItem.namaBarang} ({selectedItem.sku})
                </p>
              </div>
              <button
                onClick={() => setIsAddRecipeOpen(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Existing Recipes */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Komponen Bahan & Kemasan Saat Ini
                </h4>
                {selectedItem.recipes?.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                    Belum ada bahan baku atau kemasan yang dihubungkan ke produk ini.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {selectedItem.recipes?.map((r: any) => (
                      <div
                        key={r.id}
                        className="p-3 bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{r.namaBahan}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            SKU: {r.bahanSku} &bull; Jenis: {r.jenis}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-gray-800">
                          {r.takaran} {r.satuan}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Tambah Bahan ke Resep */}
              <form
                onSubmit={handleAddRecipeItem}
                className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Plus className="w-4 h-4" />
                  <span>Tambah Bahan / Kemasan Baru ke Resep</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-gray-600 block mb-1 font-medium">Pilih Bahan Baku / Kemasan</label>
                    <select
                      value={selectedBahanSku}
                      onChange={(e) => setSelectedBahanSku(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
                      required
                    >
                      <option value="">-- Pilih Bahan --</option>
                      {rawMaterials.map((rm) => (
                        <option key={rm.sku} value={rm.sku}>
                          {rm.namaBarang} ({rm.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-600 block mb-1 font-medium">Jenis Komponen</label>
                    <select
                      value={jenisKomponen}
                      onChange={(e) => setJenisKomponen(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="bahan">Bahan Baku (Makanan/Minuman)</option>
                      <option value="kemasan">Kemasan (Cup/Plastik/Dus)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-600 block mb-1 font-medium">Takaran (Per 1 Porsi)</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={takaran}
                      onChange={(e) => setTakaran(e.target.value)}
                      placeholder="e.g. 15 (gram) / 1 (pcs)"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-gray-600 block mb-1 font-medium">Satuan</label>
                    <select
                      value={satuan}
                      onChange={(e) => setSatuan(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="gram">gram (g)</option>
                      <option value="ml">milliliter (ml)</option>
                      <option value="pcs">pcs / butir</option>
                      <option value="lembar">lembar</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingRecipe}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                  >
                    {isSavingRecipe ? 'Menyimpan...' : 'Tambahkan ke Resep'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
