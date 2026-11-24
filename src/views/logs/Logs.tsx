'use client';

import { useState, useEffect } from 'react';
import { formatTanggal } from '@/shared/lib/utils';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// ============================================================
// PAGE: Log Aktivitas & Audit Trail
// Route: /logs
// ============================================================

interface LogItem {
  id: string;
  tanggal: string;
  user: string | null;
  aksi: string;
  detail: string | null;
}

export default function Logs() {
  const [data, setData] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat log aktivitas', 'error');
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

  const handleClear = async () => {
    if (!confirm('Yakin ingin membersihkan seluruh log audit trail? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Log aktivitas berhasil dibersihkan', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal membersihkan log', 'error');
      }
    } catch {
      showToast('Gagal membersihkan log', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">Log Aktivitas & Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-1">
            Rekaman jejak digital seluruh tindakan operasional, perubahan data gudang, dan otorisasi sistem
          </p>
        </div>
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-semibold transition border border-red-200"
        >
          <span></span> Bersihkan Log
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Waktu Kejadian</th>
                <th className="py-3.5 px-4">Pengguna / Aktor</th>
                <th className="py-3.5 px-4">Aksi Sistem</th>
                <th className="py-3.5 px-4">Rincian Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">
                    <MemuatProgres teks="Memuat log aktivitas..." />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">
                    Belum ada riwayat aktivitas sistem
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-mono text-gray-500 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-800 whitespace-nowrap">
                      {row.user || 'System'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-gray-100 text-gray-700">
                        {row.aksi}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 text-xs">{row.detail || '-'}</td>
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
