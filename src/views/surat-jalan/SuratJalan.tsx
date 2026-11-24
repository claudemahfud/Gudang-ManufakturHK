'use client';

import { Plus } from 'lucide-react';

import { useState, useEffect } from 'react';
import { formatTanggal } from '@/shared/lib/utils';
import { AksiHeader, TombolUtama } from '@/shared/components/ui/AksiHeader';

// ============================================================
// PAGE: Surat Jalan
// Route: /surat-jalan
// ============================================================

interface SuratJalanHeader {
  id: string;
  noSj: string;
  tanggal: string;
  pelanggan: string;
  alamat: string | null;
  ekspedisi: string | null;
  armada: string | null;
  status: string;
  catatan: string | null;
  createdBy: string | null;
}

interface InventoryOption {
  sku: string;
  namaBarang: string;
  stok: number;
}

interface ItemRow {
  sku: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  keterangan: string;
}

export default function SuratJalan() {
  const [data, setData] = useState<SuratJalanHeader[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Header
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [pelanggan, setPelanggan] = useState('');
  const [alamat, setAlamat] = useState('');
  const [ekspedisi, setEkspedisi] = useState('');
  const [armada, setArmada] = useState('');
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { sku: '', namaBarang: '', qty: 1, satuan: 'pcs', keterangan: '' },
  ]);

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/surat-jalan');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory?limit=500');
      const json = await res.json();
      if (json.success) setInventoryList(json.data);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchInventory();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { sku: '', namaBarang: '', qty: 1, satuan: 'pcs', keterangan: '' }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemRow = (idx: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === 'sku') {
        const prod = inventoryList.find((i) => i.sku === value);
        copy[idx] = {
          ...copy[idx],
          sku: value,
          namaBarang: prod ? prod.namaBarang : '',
        };
      } else {
        copy[idx] = { ...copy[idx], [field]: value };
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!pelanggan) {
      showToast('Nama pelanggan wajib diisi', 'error');
      return;
    }

    const invalid = items.some((i) => !i.sku || i.qty <= 0);
    if (invalid) {
      showToast('Lengkapi semua item barang dan kuantitas', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/surat-jalan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal,
          pelanggan,
          alamat,
          ekspedisi,
          armada,
          catatan,
          items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Surat jalan berhasil dibuat!', 'success');
        setIsModalOpen(false);
        setPelanggan('');
        setAlamat('');
        setEkspedisi('');
        setArmada('');
        setCatatan('');
        setItems([{ sku: '', namaBarang: '', qty: 1, satuan: 'pcs', keterangan: '' }]);
        fetchData();
      } else {
        showToast(json.message || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const viewDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/surat-jalan/${id}`);
      const json = await res.json();
      if (json.success) setSelectedDetail(json.data);
    } catch {
      showToast('Gagal memuat detail', 'error');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/surat-jalan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Status berhasil diubah', 'success');
        if (selectedDetail) setSelectedDetail((p: any) => ({ ...p, status }));
        fetchData();
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus Surat Jalan ini?')) return;
    try {
      const res = await fetch(`/api/surat-jalan/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Surat Jalan dihapus', 'success');
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
          <h1 className="text-2xl font-bold text-gray-800">Dokumen Surat Jalan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manajemen dokumen legal pengiriman barang, ekspedisi pengantaran, dan bukti serah terima
          </p>
        </div>
        <AksiHeader>
          <TombolUtama ikon={Plus} onClick={() => setIsModalOpen(true)}>
            Buat Surat Jalan Baru
          </TombolUtama>
        </AksiHeader>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">No. Surat Jalan</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Penerima / Pelanggan</th>
                <th className="py-3.5 px-4">Ekspedisi / Armada</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Memuat data surat jalan...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Belum ada surat jalan yang diterbitkan
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-gray-800">
                      <button
                        type="button"
                        onClick={() => viewDetail(row.id)}
                        className="text-left font-mono font-bold text-xs text-emerald-700 hover:text-emerald-900 hover:underline transition"
                        title="Buka Dokumen Surat Jalan"
                      >
                        {row.noSj}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      {formatTanggal(row.tanggal)}
                    </td>
                    <td
                      className="py-3.5 px-4 cursor-pointer"
                      onClick={() => viewDetail(row.id)}
                      title="Klik untuk membuka dokumen surat jalan"
                    >
                      <div className="font-semibold text-gray-800 hover:text-emerald-700 transition">{row.pelanggan}</div>
                      <div className="text-xs text-gray-400 truncate max-w-xs">{row.alamat || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-700">
                      <div>{row.ekspedisi || 'Internal'}</div>
                      <div className="font-mono text-gray-400">{row.armada || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          row.status === 'selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'dikirim'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => viewDetail(row.id)}
                        className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold px-2 py-1 rounded hover:bg-emerald-50 transition mr-1"
                      >
                        Lihat & Cetak
                      </button>
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

      {/* Modal Buat Surat Jalan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Terbitkan Surat Jalan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:px-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pelanggan / Penerima *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Toko / Penerima"
                    value={pelanggan}
                    onChange={(e) => setPelanggan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat Pengiriman</label>
                <input
                  type="text"
                  placeholder="Jl. Raya No. 123, Kota..."
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ekspedisi / Driver</label>
                  <input
                    type="text"
                    placeholder="Armada Toko / Nama Ekspedisi"
                    value={ekspedisi}
                    onChange={(e) => setEkspedisi(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">No. Polisi Kendaraan</label>
                  <input
                    type="text"
                    placeholder="B 1234 XYZ"
                    value={armada}
                    onChange={(e) => setArmada(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Daftar Muatan Barang
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    ＋ Tambah Barang
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        required
                        value={row.sku}
                        onChange={(e) => updateItemRow(idx, 'sku', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none"
                      >
                        <option value="">-- Pilih Barang --</option>
                        {inventoryList.map((i) => (
                          <option key={i.sku} value={i.sku}>
                            {i.sku} - {i.namaBarang}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={row.qty}
                        onChange={(e) => updateItemRow(idx, 'qty', parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Satuan"
                        value={row.satuan}
                        onChange={(e) => updateItemRow(idx, 'satuan', e.target.value)}
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-emerald-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-20 px-1 font-bold"
                      >
                        
                      </button>
                    </div>
                  ))}
                </div>
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
                  {submitting ? 'Menyimpan...' : 'Terbitkan Surat Jalan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail / Cetak */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-800">SURAT JALAN PENGIRIMAN</h3>
                <div className="text-xs font-mono text-gray-500">No: {selectedDetail.noSj}</div>
              </div>
              <button onClick={() => setSelectedDetail(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                
              </button>
            </div>

            <div className="grid grid-cols-2 text-xs gap-3 text-gray-600">
              <div>Tanggal: <strong>{formatTanggal(selectedDetail.tanggal)}</strong></div>
              <div>Penerima: <strong>{selectedDetail.pelanggan}</strong></div>
              <div>Alamat: <strong>{selectedDetail.alamat || '-'}</strong></div>
              <div>Armada / NoPol: <strong>{selectedDetail.armada || '-'}</strong></div>
              <div>Status: <span className="font-bold uppercase text-emerald-700">{selectedDetail.status}</span></div>
              <div>Petugas: <strong>{selectedDetail.createdBy || '-'}</strong></div>
            </div>

            <div className="border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Barang</th>
                    <th className="p-2 text-center">Jumlah</th>
                    <th className="p-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedDetail.items?.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 text-gray-400">{i + 1}</td>
                      <td className="p-2">
                        <div className="font-semibold text-gray-800">{it.namaBarang}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{it.sku}</div>
                      </td>
                      <td className="p-2 text-center font-bold text-gray-700">{it.qty} {it.satuan}</td>
                      <td className="p-2 text-gray-500">{it.keterangan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 text-center text-xs text-gray-500 pt-6 border-t">
              <div>
                <p>Penerima,</p>
                <div className="h-14"></div>
                <p className="font-bold">( ............................ )</p>
              </div>
              <div>
                <p>Driver / Ekspedisi,</p>
                <div className="h-14"></div>
                <p className="font-bold">( ............................ )</p>
              </div>
              <div>
                <p>Kepala Gudang,</p>
                <div className="h-14"></div>
                <p className="font-bold">( ............................ )</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <div className="flex gap-1">
                {selectedDetail.status !== 'selesai' && (
                  <button
                    onClick={() => updateStatus(selectedDetail.id, 'selesai')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition"
                  >
                     Tandai Selesai
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
                >
                  Cetak Surat Jalan
                </button>
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
