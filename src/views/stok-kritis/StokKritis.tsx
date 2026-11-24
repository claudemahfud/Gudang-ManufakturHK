'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatRupiah, formatStok } from '@/shared/lib/utils';
import { ROUTES } from '@/router/routes';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// PAGE: Monitor Stok Kritis
// Route: /stok-kritis
// ============================================================

interface ItemKritis {
  id: string;
  sku: string;
  namaBarang: string;
  brand: string | null;
  stok: number;
  stokMinimum: number | null;
  settingPcs: number;
  pakaiKarton: boolean;
  hargaBeli: string | null;
}

export default function StokKritis() {
  const [items, setItems] = useState<ItemKritis[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory?limit=500');
      const json = await res.json();
      if (json.success) {
        // Filter stok <= stokMinimum (default 10)
        const filtered = json.data.filter(
          (item: ItemKritis) => item.stok <= (item.stokMinimum ?? 10)
        );
        // Urutkan dari stok paling sedikit
        filtered.sort((a: ItemKritis, b: ItemKritis) => a.stok - b.stok);
        setItems(filtered);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalHabis = items.filter((i) => i.stok <= 0).length;
  const totalKritis = items.filter((i) => i.stok > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monitor Stok Kritis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Peringatan dini barang yang habis atau mendekati batas minimum stok gudang
          </p>
        </div>
        <Link
          href={ROUTES.BARANG_MASUK}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Buat Pesanan Masuk (Restock)
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-red-600 uppercase tracking-wider">
                Stok Habis (0 Pcs)
              </div>
              <div className="text-3xl font-extrabold text-red-800 mt-1">{totalHabis} SKU</div>
            </div>
            <span className="text-3xl"></span>
          </div>
          <div className="text-xs text-red-600 mt-2 font-medium">
            Perlu restock darurat dari supplier
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                Mendekati Batas Minimum
              </div>
              <div className="text-3xl font-extrabold text-amber-800 mt-1">{totalKritis} SKU</div>
            </div>
            <span className="text-3xl"></span>
          </div>
          <div className="text-xs text-amber-600 mt-2 font-medium">
            Stok masih ada namun di bawah batas aman
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Total Perlu Perhatian
              </div>
              <div className="text-3xl font-extrabold text-gray-800 mt-1">{items.length} SKU</div>
            </div>
            <span className="text-3xl"></span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Segera buat Purchase Order ke produsen
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">SKU / Nama Barang</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Sisa Stok</th>
                <th className="py-3.5 px-4">Batas Minimal</th>
                <th className="py-3.5 px-4">Est. Harga Beli</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <MemuatProgres teks="Memuat barang stok kritis..." />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-emerald-600 font-semibold">
                    Luar biasa! Semua stok barang berada dalam batas aman.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isOut = row.stok <= 0;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            isOut
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isOut ? '● HABIS' : '▲ KRITIS'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-800">{row.namaBarang}</div>
                        <div className="text-xs font-mono text-gray-400">{row.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">{row.brand || '-'}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`font-bold ${isOut ? 'text-red-600' : 'text-amber-600'}`}>
                          {formatStok(row.stok, row.pakaiKarton, row.settingPcs)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {row.stokMinimum ?? 10} pcs
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap">
                        {formatRupiah(row.hargaBeli)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Link
                          href={ROUTES.BARANG_MASUK}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition inline-block"
                        >
                          Restock
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
