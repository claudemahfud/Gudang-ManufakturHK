'use client';

// ============================================================
// PAGE: Cash Opname Laci Kasir (Harmonisasi F&B & Retail POS)
// Route: /cash-opname
// ============================================================

import { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  RefreshCw,
  Printer,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Calendar,
  X,
  TrendingUp,
} from 'lucide-react';
import { formatRupiah, formatTanggal } from '@/shared/lib/utils';

export default function CashOpnameView() {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    shift: 'Shift 1 (Pagi)',
    kasir: '',
    kasAwal: '100000',
    omsetTunai: '',
    kasKeluar: '0',
    kasFisik: '',
    catatan: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fnb/cash-opname');
      const json = await res.json();
      if (json.success) {
        setData(json.data || []);
        setSummary(json.summary || null);
      }
    } catch (err) {
      console.error('Failed to load cash opname', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live calculations in modal
  const kasSeharusnya =
    Number(form.kasAwal || 0) + Number(form.omsetTunai || 0) - Number(form.kasKeluar || 0);
  const selisih = Number(form.kasFisik || 0) - kasSeharusnya;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.kasFisik || Number(form.kasFisik) < 0) {
      alert('Masukkan jumlah uang fisik di laci dengan benar');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/fnb/cash-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        setForm({
          shift: 'Shift 1 (Pagi)',
          kasir: '',
          kasAwal: '100000',
          omsetTunai: '',
          kasKeluar: '0',
          kasFisik: '',
          catatan: '',
        });
        fetchData();
      } else {
        alert(json.message || 'Gagal menyimpan cash opname');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-semibold mb-1 border border-amber-200">
            <Coins className="w-3.5 h-3.5" />
            <span>Plafon Kasir POS & Rekonsiliasi Kas Laci</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Cash Opname Laci Kasir Harian
          </h1>
          <p className="text-xs text-gray-500">
            Pencocokan saldo uang fisik di laci kasir saat tutup shift vs perhitungan sistem (kas awal + omset tunai − pengeluaran operasional).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Buka Form Cash Opname</span>
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 3 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Total Sesi Opname Hari Ini
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">
            {summary?.totalSesiHariIni || 0}{' '}
            <span className="text-xs text-gray-400 font-normal">sesi shift</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Audit shift kasir harian</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Akumulasi Selisih Kas Hari Ini
          </div>
          <div
            className={`text-xl sm:text-2xl font-extrabold font-mono ${
              (summary?.totalSelisihHariIni || 0) < 0
                ? 'text-red-600'
                : (summary?.totalSelisihHariIni || 0) > 0
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}
          >
            {formatRupiah(summary?.totalSelisihHariIni || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {(summary?.totalSelisihHariIni || 0) === 0
              ? 'Seluruh kasir setor pas'
              : (summary?.totalSelisihHariIni || 0) < 0
              ? 'Ada kekurangan fisik kasir'
              : 'Ada kelebihan kas di laci'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Status Rekonsiliasi
          </div>
          <div className="text-sm font-bold text-gray-800 flex items-center gap-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tersinkronisasi ke Kas Pusat</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Otomatis mencatat log audit</div>
        </div>
      </div>

      {/* Table of Cash Opname History */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-900">Riwayat Cash Opname Shift Kasir</h3>
          <span className="text-xs text-gray-400 font-mono">{data.length} sesi tercatat</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Tanggal & Shift</th>
                <th className="py-3 px-4">Kasir / Petugas</th>
                <th className="py-3 px-4 text-right">Kas Awal</th>
                <th className="py-3 px-4 text-right">Omset Tunai</th>
                <th className="py-3 px-4 text-right">Kas Keluar</th>
                <th className="py-3 px-4 text-right">Kas Seharusnya</th>
                <th className="py-3 px-4 text-right">Kas Fisik Laci</th>
                <th className="py-3 px-4 text-right">Selisih</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Memuat riwayat cash opname...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    Belum ada riwayat cash opname. Silakan buka form untuk mencatat.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{row.shift}</div>
                      <div className="text-[10px] text-gray-400">{formatTanggal(row.tanggal)}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-800">{row.kasir}</td>
                    <td className="py-3 px-4 text-right font-mono text-gray-600">
                      {formatRupiah(Number(row.kasAwal))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                      {formatRupiah(Number(row.omsetTunai))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-600">
                      {formatRupiah(Number(row.kasKeluar))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                      {formatRupiah(Number(row.kasSeharusnya))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                      {formatRupiah(Number(row.kasFisik))}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        Number(row.selisih) < 0
                          ? 'text-red-600'
                          : Number(row.selisih) > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatRupiah(Number(row.selisih))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          row.status === 'pas'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'lebih'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Input Cash Opname — Desktop Landscape */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl lg:rounded-3xl w-full max-w-lg lg:max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-amber-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-gray-900">Form Cash Opname Tutup Shift</h3>
                  <p className="text-xs text-gray-500">Rekonsiliasi uang fisik di laci kasir</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-amber-100/50 transition"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Kolom Kiri: Kas Sistem */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider pb-1 border-b border-amber-100">
                      1. Shift & Kas Sistem
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Shift Kasir</label>
                        <select
                          value={form.shift}
                          onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500 font-medium"
                        >
                          <option value="Shift 1 (Pagi)">Shift 1 (Pagi)</option>
                          <option value="Shift 2 (Sore)">Shift 2 (Sore)</option>
                          <option value="Full Day (Harian)">Full Day (Harian)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">Nama Kasir *</label>
                        <input
                          type="text"
                          value={form.kasir}
                          onChange={(e) => setForm((p) => ({ ...p, kasir: e.target.value }))}
                          placeholder="Nama petugas kasir..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-1">Kas Awal (Rp)</label>
                        <input
                          type="number"
                          value={form.kasAwal}
                          onChange={(e) => setForm((p) => ({ ...p, kasAwal: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-amber-500 font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-1">Omset Tunai (Rp)</label>
                        <input
                          type="number"
                          value={form.omsetTunai}
                          onChange={(e) => setForm((p) => ({ ...p, omsetTunai: e.target.value }))}
                          placeholder="0"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-amber-500 font-mono font-bold text-emerald-700"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-1">Kas Keluar Ops (Rp)</label>
                        <input
                          type="number"
                          value={form.kasKeluar}
                          onChange={(e) => setForm((p) => ({ ...p, kasKeluar: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-amber-500 font-mono text-red-600"
                        />
                      </div>
                    </div>

                    {/* Kas Seharusnya */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Kas Seharusnya Disetor:</span>
                      <span className="font-mono font-bold text-gray-900 text-sm">
                        {formatRupiah(kasSeharusnya)}
                      </span>
                    </div>
                  </div>

                  {/* Kolom Kanan: Fisik Laci & Selisih */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider pb-1 border-b border-amber-100">
                      2. Fisik Laci & Selisih
                    </div>
                    {/* Kas Fisik Input */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-800 block">
                        Uang Fisik Aktual di Laci (Rp) *
                      </label>
                      <input
                        type="number"
                        value={form.kasFisik}
                        onChange={(e) => setForm((p) => ({ ...p, kasFisik: e.target.value }))}
                        placeholder="Total hitungan uang laci..."
                        className="w-full bg-amber-50/50 border-2 border-amber-300 rounded-xl px-3 py-2 text-base font-mono font-bold text-gray-900 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    {/* Selisih Result */}
                    {form.kasFisik !== '' && (
                      <div
                        className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                          selisih === 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : selisih < 0
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        <span className="font-semibold">
                          {selisih === 0
                            ? 'Status: PAS (Sempurna)'
                            : selisih < 0
                            ? 'Status: KURANG (Tanggungan Kasir)'
                            : 'Status: LEBIH (Surplus Kas)'}
                        </span>
                        <span className="font-mono font-black text-sm">
                          {selisih > 0 ? `+${formatRupiah(selisih)}` : formatRupiah(selisih)}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Catatan / Alasan Selisih</label>
                      <textarea
                        rows={2}
                        value={form.catatan}
                        onChange={(e) => setForm((p) => ({ ...p, catatan: e.target.value }))}
                        placeholder="e.g. Pembelian es batu darurat / uang kembalian receh..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-800 transition hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Cash Opname'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
