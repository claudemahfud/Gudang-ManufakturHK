'use client';

// ============================================================
// PAGE: Manajemen Pengguna & Hak Akses
// Route: /users
// Fitur:
// 1. Kelola akun pengguna & 19 tingkatan role
// 2. Penetapan Divisi (MANUFAKTUR vs FNB vs ALL)
// 3. Penempatan Cabang (Pusat vs Cabang Regional)
// 4. Karyawan Cabang terisolasi ke cabangnya masing-masing
// ============================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { formatTanggal } from '@/shared/lib/utils';
import type { UserRole } from '@/shared/types';
import {
  Users as UsersIcon,
  Plus,
  Building2,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Factory,
  Coffee,
  Boxes,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { PENENTU_MULTI_ROLE, punyaRole } from '@/shared/lib/auth/roles';
import AturRoleModal from './AturRoleModal';
import { roleUtamaDi } from '@/shared/lib/auth/roles';
import ResetPasswordModal from './ResetPasswordModal';

interface UserItem {
  id: string;
  username: string;
  namaLengkap: string;
  role: UserRole;
  rolesTambahan?: UserRole[];
  email: string | null;
  aktif: boolean;
  divisiAssigned?: 'ALL' | 'MANUFAKTUR' | 'FNB';
  cabang?: string;
  createdAt: string;
}

interface CabangOption {
  id: number;
  kodeCabang: string;
  namaCabang: string;
}

const ROLES: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Manager Umum',
  'Finance & Accounting',
  'Kepala Gudang',
  'Wakil Gudang',
  'Staff Gudang',
  'Kepala Expedisi',
  'Staff Expedisi',
  'Salesman',
  'Sales Canvas',
  'Sales Motoris',
  'Admin Salesman',
  'Staff Admin Salesman',
  'Agen',
  'Sales Agent',
  'Admin Agen',
  'Staff Admin Agen',
];

export default function Users() {
  const { data: session } = useSession();
  const sesi = session?.user as { role?: string; roles?: string[] } | undefined;
  // Administrator kelola akun; Direktur Utama tetapkan role tambahan (multi-role)
  const bolehKelolaAkun = punyaRole(sesi, ['Administrator']);
  const bolehAturRole = punyaRole(sesi, [PENENTU_MULTI_ROLE]);
  const [aturRole, setAturRole] = useState<UserItem | null>(null);
  const [resetPw, setResetPw] = useState<UserItem | null>(null);
  const [data, setData] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<CabangOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Default menutup ciut hingga di klik Button
  const [isUserCardCollapsed, setIsUserCardCollapsed] = useState(true);

  const [form, setForm] = useState({
    username: '',
    namaLengkap: '',
    role: 'Staff Gudang' as UserRole,
    email: '',
    password: '',
    divisiAssigned: 'MANUFAKTUR' as 'ALL' | 'MANUFAKTUR' | 'FNB',
    cabang: 'Pusat',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resCabang] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/cabang'),
      ]);

      const jsonUsers = await resUsers.json();
      if (jsonUsers.success) setData(jsonUsers.data);

      const jsonCabang = await resCabang.json();
      if (jsonCabang.success && Array.isArray(jsonCabang.data)) {
        setBranches(jsonCabang.data);
      }
    } catch {
      showToast('Gagal memuat data pengguna', 'error');
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

  const handleRoleChange = (selectedRole: UserRole) => {
    const isExec = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting'].includes(selectedRole);
    setForm((prev) => ({
      ...prev,
      role: selectedRole,
      divisiAssigned: isExec ? 'ALL' : 'MANUFAKTUR',
      cabang: isExec ? 'Pusat' : prev.cabang || 'Pusat',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.username || !form.password) {
      showToast('Username dan password wajib diisi', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Pengguna baru berhasil dibuat!', 'success');
        setIsModalOpen(false);
        setForm({
          username: '',
          namaLengkap: '',
          role: 'Staff Gudang',
          email: '',
          password: '',
          divisiAssigned: 'MANUFAKTUR',
          cabang: 'Pusat',
        });
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

  const handleDelete = async (username: string) => {
    if (!confirm(`Yakin ingin menonaktifkan pengguna @${username}?`)) return;

    try {
      const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Pengguna berhasil dihapus', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal menghapus', 'error');
      }
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header (F-Pattern Top Row) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white shadow-sm">
              <UsersIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Manajemen Pengguna & Penempatan Cabang
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Atur 19 tingkatan role akses, penugasan divisi operasional, dan lokasi cabang penempatan karyawan.
              </p>
            </div>
          </div>
        </div>

        {bolehKelolaAkun && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
        </button>
        )}
      </header>

      {/* 2. Info Card Isolasi Penempatan */}
      <section aria-label="Aturan Isolasi Penempatan" className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
        <Lock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Aturan Keamanan Isolasi Cabang:</span> Karyawan yang ditempatkan di cabang regional selain Pusat hanya dapat melihat stok, barang masuk/keluar, dan transaksi POS pada cabangnya sendiri. Menu ganti cabang di Header mereka akan otomatis terkunci.
        </div>
      </section>

      {/* 3. Kartu Data Pengguna (Collapsible / Minimize Card) */}
      <section aria-label="Tabel Daftar Pengguna" className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden transition-all duration-200">
        {/* Card Header with Minimize / Expand Button */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/50">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UsersIcon className="w-5 h-5 text-emerald-400" />
            </div>
            {/* Typography: Title, Sub-Title, Sub-Sub-Title (Triple Line) */}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  Tabel Data Pengguna & Hak Akses
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {data.length} Akun
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                Daftar lengkap akun operator, pimpinan, salesman, dan karyawan cabang
              </p>
              <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                <span>Status Kartu: <strong className={isUserCardCollapsed ? "text-amber-700" : "text-emerald-700"}>{isUserCardCollapsed ? "Terciut (Minimized)" : "Terbuka (Expanded)"}</strong></span>
                <span>•</span>
                <span>RBAC 19 Level Role</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Toggle Ciutkan / Minimize */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsUserCardCollapsed((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 border ${
                isUserCardCollapsed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
              }`}
              title={isUserCardCollapsed ? "Klik untuk Menampilkan / Buka Data User" : "Klik untuk Menciutkan / Minimize Kartu"}
            >
              {isUserCardCollapsed ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Buka Data User</span>
                  <ChevronDown className="w-4 h-4 ml-0.5" />
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Ciutkan / Minimize</span>
                  <ChevronUp className="w-4 h-4 ml-0.5 text-gray-500" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsed State Preview Banner (When Card is Minimized / Ciut by Default) */}
        {isUserCardCollapsed ? (
          <div className="p-6 bg-gray-50/40 text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600 font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Data Pengguna tertutup ciut secara default. Klik tombol untuk melihat rincian tabel.</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600 pt-1">
              <div>Total Pengguna: <strong className="text-gray-900 font-bold">{data.length} Akun</strong></div>
              <div>Cabang Terdaftar: <strong className="text-gray-900 font-bold">{branches.length} Cabang</strong></div>
              <div>Isolasi Keamanan: <strong className="text-emerald-700 font-bold">Aktif (RLS RBAC)</strong></div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setIsUserCardCollapsed(false)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 shadow-2xs transition active:scale-95"
              >
                <span>Tampilkan Tabel Pengguna</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50/75 border-b border-gray-200/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Role Akses</th>
                <th className="py-3.5 px-4">Divisi Ditugaskan</th>
                <th className="py-3.5 px-4">Cabang Penempatan</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Terdaftar</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Belum ada pengguna terdaftar
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const isExec = roleUtamaDi(row, ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting']);
                  const isLocked = !isExec && row.cabang && row.cabang !== 'Pusat' && row.cabang !== 'ALL';

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900">{row.namaLengkap}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">@{row.username}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                          {row.role}
                        </span>
                        {(row.rolesTambahan ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-[220px] whitespace-normal">
                            {(row.rolesTambahan ?? []).map((r) => (
                              <span key={r} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                + {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            row.divisiAssigned === 'MANUFAKTUR'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : row.divisiAssigned === 'FNB'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {row.divisiAssigned === 'MANUFAKTUR' && <Factory className="w-2.5 h-2.5" />}
                          {row.divisiAssigned === 'FNB' && <Coffee className="w-2.5 h-2.5" />}
                          {row.divisiAssigned === 'ALL' && <Boxes className="w-2.5 h-2.5" />}
                          <span>{row.divisiAssigned || 'ALL'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-800">{row.cabang || 'Pusat'}</span>
                          {isLocked && (
                            <span className="text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                              Terkunci
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">{row.email || '-'}</td>
                      <td className="py-3.5 px-4 text-[11px] text-gray-500 whitespace-nowrap">
                        {formatTanggal(row.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {bolehAturRole && (
                          <button
                            onClick={() => setAturRole(row)}
                            className="text-indigo-700 hover:text-indigo-900 text-xs font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition"
                          >
                            Atur Role
                          </button>
                        )}
                        {bolehKelolaAkun && (
                          <button
                            onClick={() => setResetPw(row)}
                            className="text-slate-700 hover:text-slate-950 text-xs font-semibold px-2 py-1 rounded hover:bg-slate-100 transition"
                          >
                            Reset Password
                          </button>
                        )}
                        {bolehKelolaAkun && (
                          <button
                            onClick={() => handleDelete(row.username)}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50 transition"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

            {/* Semantic Table Footer */}
            <footer className="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <span>Menampilkan <strong>{data.length}</strong> akun pengguna terdaftar</span>
              <button
                type="button"
                onClick={() => setIsUserCardCollapsed(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition"
              >
                <Minimize2 className="w-3 h-3" />
                <span>Ciutkan Kembali</span>
              </button>
            </footer>
          </>
        )}
      </section>

      {/* Modal Tambah Pengguna Baru — Desktop Landscape */}
      {resetPw && (
        <ResetPasswordModal
          pengguna={resetPw}
          onClose={() => setResetPw(null)}
          onSelesai={(pesan, ok) => {
            setToast({ message: pesan, type: ok ? 'success' : 'error' });
            setTimeout(() => setToast(null), 5000);
            if (ok) setResetPw(null);
          }}
        />
      )}

      {aturRole && (
        <AturRoleModal
          pengguna={aturRole}
          onClose={() => setAturRole(null)}
          onTersimpan={(pesan, ok) => {
            setToast({ message: pesan, type: ok ? 'success' : 'error' });
            setTimeout(() => setToast(null), 5000);
            if (ok) {
              setAturRole(null);
              fetchData();
            }
          }}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gray-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl border border-gray-200 w-full max-w-lg lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-gray-900" />
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">Tambah Pengguna Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Kolom Kiri: Akun & Login */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b border-gray-100">
                      Informasi Akun
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nama Lengkap Staf"
                        value={form.namaLengkap}
                        onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Username <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="username"
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Min 6 karakter"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Alamat Email (opsional untuk OTP)
                      </label>
                      <input
                        type="email"
                        placeholder="staf@dutapangan.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* Kolom Kanan: Akses & Penempatan */}
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-gray-900 uppercase tracking-wider pb-1 border-b border-gray-100">
                      Wewenang & Penempatan
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Role / Tingkat Akses <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.role}
                        onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none font-semibold text-gray-900"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Divisi Operasional
                        </label>
                        <select
                          value={form.divisiAssigned}
                          onChange={(e) => setForm({ ...form, divisiAssigned: e.target.value as any })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none"
                        >
                          <option value="MANUFAKTUR">Divisi Manufaktur</option>
                          <option value="FNB">Divisi F&B</option>
                          <option value="ALL">Pimpinan (Semua Divisi)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Penempatan Cabang <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.cabang}
                          onChange={(e) => setForm({ ...form, cabang: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 outline-none font-semibold"
                        >
                          <option value="Pusat">Pusat (Default)</option>
                          {branches
                            .filter((b) => b.namaCabang !== 'Pusat')
                            .map((b) => (
                              <option key={b.id} value={b.namaCabang}>
                                {b.namaCabang} ({b.kodeCabang})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Fixed Footer) */}
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
