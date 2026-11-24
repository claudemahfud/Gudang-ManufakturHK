'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Bingkai from '@/shared/components/ui/Bingkai';
import { SEMUA_ROLE } from '@/shared/lib/auth/roles';

// Direktur Utama menetapkan role tambahan satu akun. Hak akses = gabungan role utama + tambahan.
export default function AturRoleModal({
  pengguna,
  onClose,
  onTersimpan,
}: {
  pengguna: { username: string; namaLengkap: string; role: string; rolesTambahan?: string[] };
  onClose: () => void;
  onTersimpan: (pesan: string, ok: boolean) => void;
}) {
  const [dipilih, setDipilih] = useState<string[]>(pengguna.rolesTambahan ?? []);
  const [menyimpan, setMenyimpan] = useState(false);

  const toggle = (r: string) => setDipilih((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(pengguna.username)}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolesTambahan: dipilih }),
      });
      const json = await res.json();
      onTersimpan(
        json.success
          ? `Role ${pengguna.namaLengkap} disimpan. Menu baru tampil setelah ia login ulang.`
          : json.message || 'Gagal menyimpan role',
        Boolean(json.success)
      );
    } catch {
      onTersimpan('Gagal menyimpan role (gangguan jaringan)', false);
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Bingkai judul="Atur Multi-Role" sub={`${pengguna.namaLengkap} · @${pengguna.username}`} onClose={onClose} lebar="max-w-2xl">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Role utama <strong>{pengguna.role}</strong> diatur Administrator. Centang role tambahan: akun ini mendapat
            gabungan menu & fitur semua role yang dicentang. Mode (Manufaktur / F&amp;B) dan cabang tetap mengikuti
            role utama dan penempatan akun.
          </p>
        </div>
        <fieldset>
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Role Tambahan</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SEMUA_ROLE.filter((r) => r !== pengguna.role).map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition ${
                  dipilih.includes(r) ? 'border-slate-900 bg-slate-900/5 font-semibold' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input type="checkbox" checked={dipilih.includes(r)} onChange={() => toggle(r)} className="w-4 h-4 accent-slate-900" />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3 shrink-0">
        <span className="text-xs text-gray-500">{dipilih.length} role tambahan</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={menyimpan} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Batal
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={menyimpan}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan Role'}
          </button>
        </div>
      </div>
    </Bingkai>
  );
}
