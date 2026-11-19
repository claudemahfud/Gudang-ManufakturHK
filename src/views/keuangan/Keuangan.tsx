'use client';

import { useState, useEffect } from 'react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';

// ============================================================
// PAGE: Arus Kas & Keuangan
// Route: /keuangan
// ============================================================

interface ItemKeuangan {
  id: string;
  tanggal: string;
  jenis: string; // masuk | keluar
  kategori: string;
  jumlah: string;
  keterangan: string | null;
  createdBy: string | null;
}

export default function Keuangan() {
  const [data, setData] = useState<ItemKeuangan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenis: 'masuk',
    kategori: 'Pelunasan Piutang',
    jumlah: '',
    keterangan: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keuangan');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat data keuangan', 'error');
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

  const totalMasuk = data
    .filter((d) => d.jenis === 'masuk')
    .reduce((acc, curr) => acc + parseFloat(curr.jumlah || '0'), 0);

  const totalKeluar = data
    .filter((d) => d.jenis === 'keluar')
    .reduce((acc, curr) => acc + parseFloat(curr.jumlah || '0'), 0);

  const saldo = totalMasuk - totalKeluar;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jumlah) {
      showToast('Jumlah nominal wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Transaksi keuangan berhasil dicatat!', 'success');
        setIsModalOpen(false);
        setForm({
          tanggal: new Date().toISOString().split('T')[0],
          jenis: 'masuk',
          kategori: 'Pelunasan Piutang',
          jumlah: '',
          keterangan: '',
        });
        fetchData();
      } else {
        showToast(json.message || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      const res = await fetch(`/api/keuangan/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Transaksi dihapus', 'success');
        fetchData();
      }
    } catch {
      showToast('Gagal menghapus', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">Arus Kas & Keuangan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitoring pemasukan penjualan distributor, pembayaran supplier, dan arus kas harian
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Catat Transaksi Kas
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Kas Masuk</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{formatRupiah(totalMasuk)}</div>
          <div className="text-xs text-gray-400 mt-2">Penerimaan piutang & setoran tunai</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-red-500 uppercase tracking-wider">Total Kas Keluar</div>
          <div className="text-2xl font-extrabold text-red-600 mt-1">{formatRupiah(totalKeluar)}</div>
          <div className="text-xs text-gray-400 mt-2">Pembelian supplier & pengeluaran lain</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Saldo Kas Berjalan</div>
          <div className={`text-2xl font-extrabold mt-1 ${saldo >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {formatRupiah(saldo)}
          </div>
          <div className="text-xs text-gray-400 mt-2">Selisih kas masuk vs kas keluar</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Jenis</th>
                <th className="py-3.5 px-4">Kategori Transaksi</th>
                <th className="py-3.5 px-4">Nominal (Rp)</th>
                <th className="py-3.5 px-4">Keterangan</th>
                <th className="py-3.5 px-4">Operator</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Memuat arus kas...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Belum ada riwayat transaksi keuangan
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          row.jenis === 'masuk'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.jenis === 'masuk' ? '↓ MASUK' : '↑ KELUAR'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">{row.kategori}</td>
                    <td
                      className={`py-3.5 px-4 font-bold whitespace-nowrap ${
                        row.jenis === 'masuk' ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {row.jenis === 'masuk' ? '+' : '-'} {formatRupiah(row.jumlah)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{row.keterangan || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">{row.createdBy || '-'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Catat Transaksi Keuangan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe Arus Kas *</label>
                  <select
                    value={form.jenis}
                    onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  >
                    <option value="masuk">Uang Masuk (Debit)</option>
                    <option value="keluar">Uang Keluar (Kredit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori Transaksi *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pelunasan Nota #01, Pembayaran Supplier, dll"
                  value={form.kategori}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={form.jumlah}
                  onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan / Bukti Transfer</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan tambahan..."
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
