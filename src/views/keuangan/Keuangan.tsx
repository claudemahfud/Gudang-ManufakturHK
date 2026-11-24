'use client';

import { useState, useEffect } from 'react';
import { Download, Lock, Plus } from 'lucide-react';
import { formatTanggal, formatRupiah } from '@/shared/lib/utils';
import { exportToCsv } from '@/shared/lib/export';
import { AksiHeader, GrupIkon, TombolIkon, TombolUtama } from '@/shared/components/ui/AksiHeader';
import MemuatProgres from '@/shared/components/ui/MemuatProgres';
import { useDivision } from '@/shared/context/DivisionContext';
import { ambil, KotakTerlarang, type Akun } from '@/views/laporan-keuangan/util';
import CatatTransaksi from './CatatTransaksi';

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

export default function Keuangan() {
  const { division, cabang } = useDivision();
  const [akun, setAkun] = useState<Akun[]>([]);
  const [terlarang, setTerlarang] = useState(false);
  const [data, setData] = useState<ItemKeuangan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
            Catat Transaksi
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
        <CatatTransaksi
          akun={akun}
          division={division === 'FNB' ? 'FNB' : 'MANUFAKTUR'}
          cabang={cabang}
          onTutup={() => setIsModalOpen(false)}
          onSelesai={(pesan) => {
            setIsModalOpen(false);
            showToast(pesan, 'success');
            fetchData();
          }}
        />
      )}
    </div>
  );
}
