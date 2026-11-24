'use client';

import { useState, useEffect } from 'react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { useDivision } from '@/shared/context/DivisionContext';
import { ambil, KotakTerlarang, type Akun } from '@/views/laporan-keuangan/util';
import { sarankanAkunBiaya } from '@/shared/lib/pemetaan-akuntansi';

// ============================================================
// PAGE: Biaya Operasional
// Route: /biaya-operasional
// Tiap biaya dijurnal: Debit akun beban (6-xxxx), Kredit kas/bank sesuai metode.
// ============================================================

interface ItemOps {
  id: string;
  tanggal: string;
  kategori: string; // nama akun beban
  akunKode: string | null;
  divisi: string;
  jumlah: string;
  keterangan: string | null;
  createdBy: string | null;
}

const formAwal = () => ({
  tanggal: new Date().toISOString().split('T')[0],
  akunKode: '',
  metode: 'tunai' as 'tunai' | 'transfer',
  jumlah: '',
  keterangan: '',
});

export default function BiayaOperasional() {
  const { division, cabang } = useDivision();
  const [akunBeban, setAkunBeban] = useState<Akun[]>([]);
  const [terlarang, setTerlarang] = useState(false);
  const [data, setData] = useState<ItemOps[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(formAwal);
  // Akun beban dipilih otomatis dari rincian (pengguna tetap bisa menggantinya)
  const [akunOtomatis, setAkunOtomatis] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/biaya-operasional?divisi=${division}`);
      if (res.status === 401 || res.status === 403) return setTerlarang(true);
      const json = await res.json();
      if (json.success) setData(json.data);
      else showToast(json.message || 'Gagal memuat data', 'error');
    } catch {
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [division]);

  useEffect(() => {
    ambil<Akun[]>('/api/akuntansi/akun').then((h) => {
      if (h.ok) setAkunBeban(h.data.filter((a) => a.posting && a.tipe === 'BEBAN' && a.kode.startsWith('6-')));
    });
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalBiaya = data.reduce((acc, curr) => acc + parseFloat(curr.jumlah || '0'), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.jumlah || !form.akunKode) {
      showToast('Akun biaya dan nominal wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/biaya-operasional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, jumlah: Number(form.jumlah), divisi: division, cabang }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Biaya operasional berhasil dicatat!', 'success');
        setIsModalOpen(false);
        setForm(formAwal());
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
    if (!confirm('Hapus pencatatan biaya ini?')) return;
    try {
      const res = await fetch(`/api/biaya-operasional/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Data dihapus', 'success');
        fetchData();
      } else showToast(json.message || 'Gagal menghapus', 'error');
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  if (terlarang) return <KotakTerlarang />;

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
          <h1 className="text-2xl font-bold text-gray-800">Biaya Operasional</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pencatatan pengeluaran rutin operasional: BBM, servis kendaraan, gaji, listrik, dan logistik
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Catat Biaya Operasional
        </button>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Total Pengeluaran Operasional
            </div>
            <div className="text-3xl font-extrabold text-red-800 mt-1">{formatRupiah(totalBiaya)}</div>
          </div>
          <span className="text-4xl"></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Kategori (Akun)</th>
                <th className="py-3.5 px-4">Jumlah (Rp)</th>
                <th className="py-3.5 px-4">Keterangan</th>
                <th className="py-3.5 px-4">Petugas</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <MemuatProgres teks="Memuat data biaya..." />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Belum ada pengeluaran operasional
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">
                      {row.kategori}
                      {row.akunKode && <span className="block font-mono text-[11px] font-normal text-gray-400">{row.akunKode}</span>}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-red-600 whitespace-nowrap">
                      {formatRupiah(row.jumlah)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Catat Biaya Operasional</h2>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Kolom Kiri */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                      <input
                        type="date"
                        required
                        value={form.tanggal}
                        onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-red-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori Biaya (Akun) *</label>
                      <select
                        required
                        value={form.akunKode}
                        onChange={(e) => {
                          setAkunOtomatis(false);
                          setForm({ ...form, akunKode: e.target.value });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-red-500 outline-none"
                      >
                        <option value="">— Pilih akun beban —</option>
                        {akunBeban.map((a) => (
                          <option key={a.kode} value={a.kode}>
                            {a.kode} · {a.nama}
                          </option>
                        ))}
                      </select>
                      {akunOtomatis && form.akunKode && (
                        <p className="mt-1 text-[11px] text-emerald-700">Dipilih otomatis dari rincian. Ganti bila kurang tepat.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Dibayar dengan *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['tunai', 'transfer'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={form.metode === m}
                            onClick={() => setForm({ ...form, metode: m })}
                            className={`h-9 rounded-xl border text-sm font-semibold transition ${
                              form.metode === m ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {m === 'tunai' ? 'Kas Tunai' : 'Transfer Bank'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal (Rp) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="0"
                        value={form.jumlah}
                        onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-red-500 outline-none font-semibold text-red-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Rincian / Nota Pembelian</label>
                      <textarea
                        rows={2}
                        placeholder="Isi rincian, mis. bayar listrik PLN (akun dipilih otomatis)"
                        value={form.keterangan}
                        onChange={(e) => {
                          const teks = e.target.value;
                          const saran = sarankanAkunBiaya(teks);
                          const boleh = !form.akunKode || akunOtomatis;
                          if (saran && boleh && akunBeban.some((a) => a.kode === saran)) {
                            setAkunOtomatis(true);
                            setForm({ ...form, keterangan: teks, akunKode: saran });
                          } else {
                            setForm({ ...form, keterangan: teks });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-red-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="px-6 sm:px-8 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Biaya'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
