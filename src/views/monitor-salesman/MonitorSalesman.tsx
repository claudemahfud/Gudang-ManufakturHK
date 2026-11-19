'use client';

import { useState, useEffect } from 'react';
import { formatRupiah } from '@/shared/lib/utils';

// ============================================================
// PAGE: Monitor Performa Salesman
// Route: /monitor-salesman
// ============================================================

interface SalesPerformance {
  salesman: string;
  totalTrx: number;
  totalQty: number;
  totalOmzet: number;
  target: number;
  pctTarget: number;
}

export default function MonitorSalesman() {
  const [data, setData] = useState<SalesPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Ambil transaksi keluar dan target komisi
      const [resKeluar, resTarget] = await Promise.all([
        fetch('/api/barang-keluar'),
        fetch('/api/target-komisi'),
      ]);

      const jsonKeluar = await resKeluar.json();
      const jsonTarget = await resTarget.json();

      const itemsKeluar = jsonKeluar.data || [];
      const itemsTarget = jsonTarget.data || [];

      // Kelompokkan per salesman
      const map: Record<string, { totalTrx: Set<string>; totalQty: number; totalOmzet: number }> = {};

      itemsKeluar.forEach((row: any) => {
        const sales = row.salesman || 'Tanpa Sales';
        if (!map[sales]) {
          map[sales] = { totalTrx: new Set(), totalQty: 0, totalOmzet: 0 };
        }
        map[sales].totalTrx.add(row.trxId);
        map[sales].totalQty += row.qty;
        map[sales].totalOmzet += parseFloat(row.total || '0');
      });

      const result: SalesPerformance[] = Object.keys(map).map((sales) => {
        const targetRow = itemsTarget.find((t: any) => t.salesman === sales);
        const targetVal = targetRow ? parseFloat(targetRow.target || '0') : 0;
        const omzet = map[sales].totalOmzet;
        const pct = targetVal > 0 ? (omzet / targetVal) * 100 : 0;

        return {
          salesman: sales,
          totalTrx: map[sales].totalTrx.size,
          totalQty: map[sales].totalQty,
          totalOmzet: omzet,
          target: targetVal,
          pctTarget: pct,
        };
      });

      result.sort((a, b) => b.totalOmzet - a.totalOmzet);
      setData(result);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalOmzetAll = data.reduce((acc, curr) => acc + curr.totalOmzet, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monitor Salesman</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tracking transaksi riil, kontribusi omzet penjualan, dan performa tim sales di lapangan
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Omzet Sales</div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">{formatRupiah(totalOmzetAll)}</div>
          <div className="text-xs text-gray-500 mt-2">Akumulasi seluruh tim sales lapangan</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenaga Sales Aktif</div>
          <div className="text-3xl font-extrabold text-gray-800 mt-1">{data.length} Orang</div>
          <div className="text-xs text-gray-500 mt-2">Berdasarkan data penjualan berjalan</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Peringkat</th>
                <th className="py-3.5 px-4">Nama Salesman</th>
                <th className="py-3.5 px-4 text-center">Jumlah Nota</th>
                <th className="py-3.5 px-4 text-center">Volume Produk</th>
                <th className="py-3.5 px-4">Total Omzet Penjualan</th>
                <th className="py-3.5 px-4">Target Terpasang</th>
                <th className="py-3.5 px-4">Pencapaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Menganalisis performa salesman...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada data transaksi penjualan
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={row.salesman} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-500">
                      {idx === 0 ? '#1' : idx === 1 ? '#2' : idx === 2 ? '#3' : `#${idx + 1}`}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-800">{row.salesman}</td>
                    <td className="py-3.5 px-4 text-center font-medium text-gray-700">
                      {row.totalTrx} transaksi
                    </td>
                    <td className="py-3.5 px-4 text-center text-gray-700 font-medium">
                      {row.totalQty} pcs
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap">
                      {formatRupiah(row.totalOmzet)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap">
                      {row.target > 0 ? formatRupiah(row.target) : <span className="text-xs text-gray-400">Belum diset</span>}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {row.target > 0 ? (
                        <div className="w-32">
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{row.pctTarget.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${row.pctTarget >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(row.pctTarget, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
