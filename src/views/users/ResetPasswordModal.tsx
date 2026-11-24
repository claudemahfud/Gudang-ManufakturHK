'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import Bingkai from '@/shared/components/ui/Bingkai';

// Administrator mengganti password akun lain. Password diketik admin sendiri, tidak disimpan di klien.
export default function ResetPasswordModal({
  pengguna,
  onClose,
  onSelesai,
}: {
  pengguna: { username: string; namaLengkap: string };
  onClose: () => void;
  onSelesai: (pesan: string, ok: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const [ulang, setUlang] = useState('');
  const [lihat, setLihat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const cocok = password === ulang;
  const valid = password.length >= 6 && cocok;

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (menyimpan || !valid) return;
    setMenyimpan(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(pengguna.username)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      onSelesai(json.message || (json.success ? 'Password diganti' : 'Gagal mengganti password'), Boolean(json.success));
    } catch {
      onSelesai('Gagal mengganti password (gangguan jaringan)', false);
    } finally {
      setMenyimpan(false);
    }
  };

  const input =
    'w-full px-3 py-2.5 pr-10 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900';

  return (
    <Bingkai judul="Reset Password" sub={`${pengguna.namaLengkap} · @${pengguna.username}`} onClose={onClose}>
      <form onSubmit={simpan} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <KeyRound className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>Password lama langsung tidak berlaku. Sampaikan password baru ke pemilik akun secara langsung.</p>
          </div>
          <div>
            <label htmlFor="pw-baru" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Password Baru
            </label>
            <div className="relative">
              <input
                id="pw-baru"
                type={lihat ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                className={input}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setLihat((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700"
                aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {lihat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="pw-ulang" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Ulangi Password Baru
            </label>
            <input
              id="pw-ulang"
              type={lihat ? 'text' : 'password'}
              autoComplete="new-password"
              value={ulang}
              onChange={(e) => setUlang(e.target.value)}
              className={input}
            />
            {ulang && !cocok && <p className="text-xs text-red-600 mt-1">Password tidak sama.</p>}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} disabled={menyimpan} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Batal
          </button>
          <button
            type="submit"
            disabled={!valid || menyimpan}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {menyimpan ? 'Menyimpan…' : 'Ganti Password'}
          </button>
        </div>
      </form>
    </Bingkai>
  );
}
