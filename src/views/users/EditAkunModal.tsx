'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import Bingkai from '@/shared/components/ui/Bingkai';
import { SEMUA_ROLE } from '@/shared/lib/auth/roles';

export interface AkunDiedit {
  username: string;
  namaLengkap: string;
  role: string;
  rolesTambahan?: string[];
  email: string | null;
  aktif: boolean;
  divisiAssigned?: 'ALL' | 'MANUFAKTUR' | 'FNB';
  cabang?: string;
}

const PIMPINAN = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting'];
const kelasInput =
  'w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Satu pintu edit akun. Bagian yang tampil mengikuti hak pengguna yang login:
 * Administrator → profil, akses, password, hapus; Direktur Utama → role tambahan.
 */
export default function EditAkunModal({
  pengguna,
  cabangOpsi,
  bolehKelolaAkun,
  bolehAturRole,
  usernameSaya,
  onClose,
  onSelesai,
}: {
  pengguna: AkunDiedit;
  cabangOpsi: { id: number; kodeCabang: string; namaCabang: string }[];
  bolehKelolaAkun: boolean;
  bolehAturRole: boolean;
  usernameSaya?: string;
  onClose: () => void;
  onSelesai: (pesan: string, ok: boolean, muatUlang: boolean) => void;
}) {
  const diriSendiri = usernameSaya === pengguna.username;
  const [form, setForm] = useState({
    namaLengkap: pengguna.namaLengkap,
    username: pengguna.username,
    email: pengguna.email ?? '',
    role: pengguna.role,
    divisiAssigned: pengguna.divisiAssigned ?? 'MANUFAKTUR',
    cabang: pengguna.cabang || 'Pusat',
    aktif: pengguna.aktif,
  });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [lihatPw, setLihatPw] = useState(false);
  const [tambahan, setTambahan] = useState<string[]>(pengguna.rolesTambahan ?? []);
  const [menyimpan, setMenyimpan] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const ubah = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));
  const gantiRole = (role: string) => {
    const exec = PIMPINAN.includes(role);
    setForm((p) => ({ ...p, role, divisiAssigned: exec ? 'ALL' : p.divisiAssigned === 'ALL' ? 'MANUFAKTUR' : p.divisiAssigned, cabang: exec ? 'Pusat' : p.cabang }));
    setTambahan((t) => t.filter((r) => r !== role));
  };
  const toggleTambahan = (r: string) => setTambahan((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));

  const profilBerubah =
    form.namaLengkap !== pengguna.namaLengkap ||
    form.username !== pengguna.username ||
    form.email !== (pengguna.email ?? '') ||
    form.role !== pengguna.role ||
    form.divisiAssigned !== (pengguna.divisiAssigned ?? 'MANUFAKTUR') ||
    form.cabang !== (pengguna.cabang || 'Pusat') ||
    form.aktif !== pengguna.aktif;
  const lamaTambahan = [...(pengguna.rolesTambahan ?? [])].sort().join('|');
  const tambahanBerubah = [...tambahan].sort().join('|') !== lamaTambahan;
  const adaPerubahan = (bolehKelolaAkun && (profilBerubah || pw.length > 0)) || (bolehAturRole && tambahanBerubah);

  const kirim = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || `Gagal (${res.status})`);
    return json;
  };

  const simpan = async () => {
    setGalat(null);
    if (bolehKelolaAkun && pw.length > 0) {
      if (pw.length < 6 || pw.length > 128) return setGalat('Password baru harus 6-128 karakter');
      if (pw !== pw2) return setGalat('Ulangi password tidak sama');
    }
    setMenyimpan(true);
    const selesai: string[] = [];
    let username = pengguna.username;
    try {
      // Urutan penting: ganti username dulu, langkah berikutnya memakai username baru
      if (bolehKelolaAkun && profilBerubah) {
        await kirim(`/api/users/${encodeURIComponent(username)}`, 'PUT', form);
        username = form.username;
        selesai.push('profil & akses');
      }
      if (bolehKelolaAkun && pw.length > 0) {
        await kirim(`/api/users/${encodeURIComponent(username)}/password`, 'PUT', { password: pw });
        selesai.push('password');
      }
      if (bolehAturRole && tambahanBerubah) {
        await kirim(`/api/users/${encodeURIComponent(username)}/roles`, 'PUT', { rolesTambahan: tambahan });
        selesai.push('role tambahan');
      }
      onSelesai(`Akun @${username} diperbarui: ${selesai.join(', ')}. Perubahan akses berlaku setelah ia login ulang.`, true, true);
    } catch (e) {
      const pesan = e instanceof Error ? e.message : 'Gangguan jaringan';
      // Sebagian langkah bisa sudah tersimpan: tampilkan galat di modal dan muat ulang tabel
      setGalat(selesai.length ? `Tersimpan: ${selesai.join(', ')}. Gagal: ${pesan}` : pesan);
      if (selesai.length) onSelesai(`Sebagian tersimpan (${selesai.join(', ')})`, false, true);
    } finally {
      setMenyimpan(false);
    }
  };

  const hapus = async () => {
    setMenyimpan(true);
    setGalat(null);
    try {
      await kirim(`/api/users/${encodeURIComponent(pengguna.username)}`, 'DELETE');
      onSelesai(`Akun @${pengguna.username} dihapus`, true, true);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghapus');
      setKonfirmasiHapus(false);
    } finally {
      setMenyimpan(false);
    }
  };

  const profilKunci = !bolehKelolaAkun;
  return (
    <Bingkai judul="Edit Akun" sub={`${pengguna.namaLengkap} · @${pengguna.username}`} onClose={onClose} lebar="max-w-4xl">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {profilKunci && (
          <p className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
            Profil, akses, dan password dikelola Administrator. Anda dapat mengatur role tambahan akun ini.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Profil */}
          <fieldset className="space-y-3" disabled={profilKunci || menyimpan}>
            <legend className="flex items-center gap-1.5 text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 mb-1 border-b border-gray-100 w-full">
              <UserCog className="w-3.5 h-3.5" aria-hidden="true" /> Profil & Login
            </legend>
            <label className="block text-xs font-semibold text-gray-700">
              Nama Lengkap
              <input className={`${kelasInput} mt-1`} value={form.namaLengkap} onChange={(e) => ubah('namaLengkap', e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Username
              <input
                className={`${kelasInput} mt-1 font-mono`}
                value={form.username}
                disabled={diriSendiri || profilKunci || menyimpan}
                onChange={(e) => ubah('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
              />
              {form.username !== pengguna.username && (
                <span className="block mt-1 text-[11px] font-normal text-amber-700">
                  Pemilik akun harus login dengan username baru. Riwayat transaksinya ikut dipindah.
                </span>
              )}
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Email (untuk OTP lupa password)
              <input type="email" className={`${kelasInput} mt-1`} value={form.email} onChange={(e) => ubah('email', e.target.value)} />
            </label>
          </fieldset>

          {/* Akses */}
          <fieldset className="space-y-3" disabled={profilKunci || menyimpan}>
            <legend className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 mb-1 border-b border-gray-100 w-full">
              Wewenang & Penempatan
            </legend>
            <label className="block text-xs font-semibold text-gray-700">
              Role Utama
              <select className={`${kelasInput} mt-1 font-semibold`} value={form.role} disabled={diriSendiri || profilKunci || menyimpan} onChange={(e) => gantiRole(e.target.value)}>
                {SEMUA_ROLE.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-gray-700">
                Divisi
                <select className={`${kelasInput} mt-1`} value={form.divisiAssigned} onChange={(e) => ubah('divisiAssigned', e.target.value as typeof form.divisiAssigned)}>
                  <option value="MANUFAKTUR">Manufaktur</option>
                  <option value="FNB">F&amp;B</option>
                  <option value="ALL">Semua Divisi</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-700">
                Cabang
                <select className={`${kelasInput} mt-1`} value={form.cabang} onChange={(e) => ubah('cabang', e.target.value)}>
                  <option value="Pusat">Pusat</option>
                  {cabangOpsi.filter((b) => b.namaCabang !== 'Pusat').map((b) => (
                    <option key={b.id} value={b.namaCabang}>{b.namaCabang} ({b.kodeCabang})</option>
                  ))}
                  {form.cabang !== 'Pusat' && !cabangOpsi.some((b) => b.namaCabang === form.cabang) && (
                    <option value={form.cabang}>{form.cabang}</option>
                  )}
                </select>
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700">
              <span>
                Akun aktif
                <span className="block font-normal text-gray-500">Nonaktif = tidak bisa login, data tetap ada</span>
              </span>
              <input type="checkbox" className="w-4 h-4 accent-gray-900" checked={form.aktif} disabled={diriSendiri || profilKunci || menyimpan} onChange={(e) => ubah('aktif', e.target.checked)} />
            </label>
            {diriSendiri && <p className="text-[11px] text-gray-500">Username, role utama, dan status aktif akun Anda sendiri dikunci.</p>}
          </fieldset>
        </div>

        {/* Password */}
        {bolehKelolaAkun && (
          <fieldset className="space-y-2" disabled={menyimpan}>
            <legend className="flex items-center gap-1.5 text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 mb-1 border-b border-gray-100 w-full">
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" /> Ganti Password <span className="normal-case font-normal text-gray-500">(kosongkan bila tidak diganti)</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <input type={lihatPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Password baru (min 6)" aria-label="Password baru" className={`${kelasInput} pr-9`} value={pw} onChange={(e) => setPw(e.target.value)} />
                <button type="button" onClick={() => setLihatPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700" aria-label={lihatPw ? 'Sembunyikan password' : 'Tampilkan password'}>
                  {lihatPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input type={lihatPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Ulangi password baru" aria-label="Ulangi password baru" className={kelasInput} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {pw.length > 0 && <p className="text-[11px] text-amber-700">Password lama langsung tidak berlaku setelah disimpan.</p>}
          </fieldset>
        )}

        {/* Role tambahan */}
        <fieldset disabled={!bolehAturRole || menyimpan}>
          <legend className="flex items-center gap-1.5 text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 mb-2 border-b border-gray-100 w-full">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Role Tambahan (Multi-Role)
            {!bolehAturRole && <span className="normal-case font-normal text-gray-500">diatur Direktur Utama</span>}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {SEMUA_ROLE.filter((r) => r !== form.role).map((r) => (
              <label key={r} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition ${bolehAturRole ? 'cursor-pointer' : 'opacity-60'} ${tambahan.includes(r) ? 'border-slate-900 bg-slate-900/5 font-semibold' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={tambahan.includes(r)} onChange={() => toggleTambahan(r)} className="w-3.5 h-3.5 accent-slate-900" />
                {r}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">Menu & fitur = gabungan role utama + tambahan. Mode dan cabang tetap mengikuti role utama.</p>
        </fieldset>

        {galat && <p role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">{galat}</p>}
      </div>

      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {bolehKelolaAkun && !diriSendiri ? (
          konfirmasiHapus ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-red-700">Hapus permanen @{pengguna.username}?</span>
              <button type="button" onClick={hapus} disabled={menyimpan} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50">Ya, hapus</button>
              <button type="button" onClick={() => setKonfirmasiHapus(false)} disabled={menyimpan} className="px-3 py-1.5 rounded-lg border border-gray-200 font-semibold text-gray-700 hover:bg-gray-100">Batal</button>
            </div>
          ) : (
            <button type="button" onClick={() => setKonfirmasiHapus(true)} disabled={menyimpan} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Hapus Akun
            </button>
          )
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={menyimpan} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100">
            Batal
          </button>
          <button type="button" onClick={simpan} disabled={menyimpan || !adaPerubahan} className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {menyimpan ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </Bingkai>
  );
}
