'use client';

import { useState, useEffect } from 'react';
import { Download, Lock, Plus } from 'lucide-react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';
import { exportToCsv } from '@/shared/lib/export';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { useDivision } from '@/shared/context/DivisionContext';
import { AKUN_KAS, ambil, KotakTerlarang, TIPE_AKUN, type Akun } from '@/views/laporan-keuangan/util';

// ============================================================
// PAGE: Kas & Bank
// Route: /keuangan
// Catatan manual (punya akunKode) dijurnal ke akun lawan; baris otomatis dari transaksi terkunci.
// ============================================================

interface ItemKeuangan {
  id: string;
  tanggal: string;
  jenis: string; // masuk | keluar
  kategori: string;
  akunKode: string | null;
  jumlah: string;
  keterangan: string | null;
  createdBy: string | null;
}

const KODE_KAS = AKUN_KAS.map((a) => a.kode);
// Akun lawan yang boleh dipilih per jenis transaksi kas
const TIPE_LAWAN: Record<string, Akun['tipe'][]> = {
  masuk: ['PENDAPATAN', 'EKUITAS', 'KEWAJIBAN', 'ASET'],
  keluar: ['BEBAN', 'ASET', 'KEWAJIBAN', 'EKUITAS'],
};
const LABEL_TIPE: Record<Akun['tipe'], string> = {
  ASET: 'Aset (non-kas)',
  KEWAJIBAN: 'Kewajiban',
  EKUITAS: 'Ekuitas',
  PENDAPATAN: 'Pendapatan',
  BEBAN: 'Beban',
};

const formAwal = () => ({
  tanggal: new Date().toISOString().split('T')[0],
  jenis: 'masuk',
  akunKode: '',
  akunKas: '1-1100',
  jumlah: '',
  keterangan: '',
});

export default function Keuangan() {
  const { division, cabang } = useDivision();
  const [akun, setAkun] = useState<Akun[]>([]);
  const [terlarang, setTerlarang] = useState(false);
  const [data, setData] = useState<ItemKeuangan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(formAwal);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/keuangan?divisi=${division}`);
      if (res.status === 401 || res.status === 403) return setTerlarang(true);
      const json = await res.json();
      if (json.success) setData(json.data);
      else showToast(json.message || 'Gagal memuat data keuangan', 'error');
    } catch {
      showToast('Gagal memuat data keuangan', 'error');
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
      if (h.ok) setAkun(h.data);
    });
  }, []);

  const pilihanAkun = TIPE_AKUN.filter((t) => TIPE_LAWAN[form.jenis].includes(t)).map((t) => ({
    tipe: t,
    akun: akun.filter((a) => a.posting && a.tipe === t && !KODE_KAS.includes(a.kode)),
  }));

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
    if (submitting) return;
    if (!form.jumlah || !form.akunKode) {
      showToast('Akun dan nominal wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/keuangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, jumlah: Number(form.jumlah), divisi: division, cabang }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Transaksi keuangan berhasil dicatat!', 'success');
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
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      const res = await fetch(`/api/keuangan/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Transaksi dihapus', 'success');
        fetchData();
      } else showToast(json.message || 'Transaksi ini tidak bisa dihapus', 'error');
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  const handleExportExcel = () => {
    exportToCsv({
      filename: 'Kas_dan_Bank',
      data,
      columns: [
        { header: 'Tanggal', accessor: (r) => formatTanggal(r.tanggal) },
        { header: 'Jenis', accessor: (r) => r.jenis === 'masuk' ? 'Pemasukan (Masuk)' : 'Pengeluaran (Keluar)' },
        { header: 'Kategori', accessor: (r) => r.kategori },
        { header: 'Nominal (Rp)', accessor: (r) => Number(r.jumlah || 0) },
        { header: 'Keterangan', accessor: (r) => r.keterangan || '-' },
        { header: 'Dicatat Oleh', accessor: (r) => r.createdBy || '-' },
      ],
    });
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
          <h1 className="text-2xl font-bold text-gray-800">Kas & Bank</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mutasi kas tunai, bank & QRIS. Transaksi penjualan, pembelian & biaya tercatat otomatis; pemasukan/pengeluaran lain dicatat di sini.
          </p>
        </div>
        <AksiHeader>
          <GrupIkon>
            <TombolIkon ikon={Download} label="Ekspor Excel" onClick={handleExportExcel} warna="hijau" />
          </GrupIkon>
          <TombolUtama ikon={Plus} onClick={() => setIsModalOpen(true)}>
            Catat Transaksi Kas
          </TombolUtama>
        </AksiHeader>
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
                    <MemuatProgres teks="Memuat arus kas..." />
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
                      {row.akunKode ? (
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Hapus
                        </button>
                      ) : (
                        <span
                          title="Dicatat otomatis dari transaksi"
                          aria-label="Dicatat otomatis dari transaksi"
                          className="inline-flex text-gray-400"
                        >
                          <Lock className="w-4 h-4" aria-hidden="true" />
                        </span>
                      )}
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
              <h2 className="font-bold text-gray-800 text-base lg:text-lg">Catat Transaksi Keuangan</h2>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          onChange={(e) => setForm({ ...form, jenis: e.target.value, akunKode: '' })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                        >
                          <option value="masuk">Uang Masuk (Debit)</option>
                          <option value="keluar">Uang Keluar (Kredit)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {form.jenis === 'masuk' ? 'Sumber Dana (Akun) *' : 'Keperluan (Akun) *'}
                      </label>
                      <select
                        required
                        value={form.akunKode}
                        onChange={(e) => setForm({ ...form, akunKode: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                      >
                        <option value="">— Pilih akun —</option>
                        {pilihanAkun.map((g) =>
                          g.akun.length ? (
                            <optgroup key={g.tipe} label={LABEL_TIPE[g.tipe]}>
                              {g.akun.map((a) => (
                                <option key={a.kode} value={a.kode}>
                                  {a.kode} · {a.nama}
                                </option>
                              ))}
                            </optgroup>
                          ) : null
                        )}
                      </select>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Pembayaran faktur penjualan dicatat lewat menu Piutang Pelanggan, pembayaran suplier lewat Hutang Suplier.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {form.jenis === 'masuk' ? 'Diterima ke *' : 'Dibayar dari *'}
                      </label>
                      <select
                        value={form.akunKas}
                        onChange={(e) => setForm({ ...form, akunKas: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                      >
                        {AKUN_KAS.map((k) => (
                          <option key={k.kode} value={k.kode}>
                            {k.kode} · {k.nama}
                          </option>
                        ))}
                      </select>
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
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none font-semibold text-emerald-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan / Bukti Transfer</label>
                      <textarea
                        rows={2}
                        placeholder="Keterangan tambahan..."
                        value={form.keterangan}
                        onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none"
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
