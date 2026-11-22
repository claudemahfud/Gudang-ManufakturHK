'use client';

// ============================================================
// PAGE: Pengaturan Perusahaan
// Route: /pengaturan-perusahaan — hanya Direktur Utama yang bisa mengubah.
// Direktur menentukan apakah diskon besar, kosongkan keranjang POS, dan
// hapus transaksi wajib PIN supervisor. PIN disimpan ter-hash di server.
// ============================================================

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ShieldAlert, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

interface PengaturanPin {
  wajibPin: boolean;
  maxDiskonTanpaPin: number;
  pinVoidCart: boolean;
  pinHapusTransaksi: boolean;
  pinSudahDiatur: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export default function PengaturanPerusahaanView() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const bolehUbah = role === 'Direktur Utama';

  const [data, setData] = useState<PengaturanPin | null>(null);
  const [pinBaru, setPinBaru] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/pengaturan')
      .then((r) => r.json())
      .then((j) => (j.success ? setData(j.data) : setMessage({ type: 'error', text: j.message })))
      .catch(() => setMessage({ type: 'error', text: 'Gagal memuat pengaturan' }));
  }, []);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, pinBaru: pinBaru || undefined }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'Gagal menyimpan');
      setData(j.data);
      setPinBaru('');
      setMessage({ type: 'success', text: 'Pengaturan disimpan' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof PengaturanPin>(key: K, value: PengaturanPin[K]) =>
    setData((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Pengaturan Perusahaan</h1>
          <p className="text-xs text-gray-600">PIN supervisor untuk aksi kasir & transaksi yang sensitif</p>
        </div>
      </header>

      {!bolehUbah && (
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Hanya Direktur Utama yang dapat mengubah pengaturan ini.
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {data && (
        <form onSubmit={simpan} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <fieldset disabled={!bolehUbah || saving} className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.wajibPin}
                onChange={(e) => set('wajibPin', e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">Wajibkan PIN supervisor</span>
                <span className="block text-xs text-gray-500">
                  Bila tidak dicentang, semua aksi di bawah berjalan tanpa PIN.
                </span>
              </span>
            </label>

            {data.wajibPin && (
              <div className="pl-6 space-y-3">
                <label className="block text-sm">
                  <span className="font-semibold text-gray-800">Diskon POS tanpa PIN maksimal (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={data.maxDiskonTanpaPin}
                    onChange={(e) => set('maxDiskonTanpaPin', Number(e.target.value))}
                    className="mt-1 w-32 border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.pinVoidCart}
                    onChange={(e) => set('pinVoidCart', e.target.checked)}
                  />
                  PIN saat kasir mengosongkan keranjang POS
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.pinHapusTransaksi}
                    onChange={(e) => set('pinHapusTransaksi', e.target.checked)}
                  />
                  PIN saat menghapus transaksi barang keluar / penjualan
                </label>
              </div>
            )}

            <label className="block text-sm">
              <span className="font-semibold text-gray-800">
                {data.pinSudahDiatur ? 'Ganti PIN supervisor' : 'Buat PIN supervisor'} (4-6 angka)
              </span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pinBaru}
                onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, ''))}
                placeholder={data.pinSudahDiatur ? 'Kosongkan bila tidak diganti' : 'Wajib bila PIN diaktifkan'}
                className="mt-1 w-48 border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono tracking-widest"
              />
            </label>
          </fieldset>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              {data.updatedBy ? `Terakhir diubah oleh ${data.updatedBy}` : 'Belum pernah diatur'}
            </span>
            {bolehUbah && (
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
