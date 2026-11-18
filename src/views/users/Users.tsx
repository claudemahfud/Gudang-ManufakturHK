'use client';

import { useState, useEffect } from 'react';
import { formatTanggal } from '@/shared/lib/utils';
import type { UserRole } from '@/shared/types';

// ============================================================
// PAGE: Manajemen Pengguna & Hak Akses
// Route: /users
// ============================================================

interface UserItem {
  id: string;
  username: string;
  namaLengkap: string;
  role: UserRole;
  email: string | null;
  aktif: boolean;
  createdAt: string;
}

const ROLES: UserRole[] = [
  'Administrator',
  'Direktur Utama',
  'Manager',
  'Kepala Gudang',
  'Wakil Gudang',
  'Staff Gudang',
  'Kepala Expedisi',
  'Staff Expedisi',
  'Salesman',
  'Admin Salesman',
  'Staff Admin Salesman',
  'Agen',
  'Admin Agen',
  'Staff Admin Agen',
];

export default function Users() {
  const [data, setData] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    username: '',
    namaLengkap: '',
    role: 'Staff Gudang' as UserRole,
    email: '',
    password: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      showToast('Gagal memuat pengguna', 'error');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        });
        fetchData();
      } else {
        showToast(json.message || 'Gagal membuat pengguna', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Hapus pengguna @${username}?`)) return;
    try {
      const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('Pengguna dihapus', 'success');
        fetchData();
      } else {
        showToast(json.message || 'Gagal menghapus', 'error');
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
          <h1 className="text-2xl font-bold text-gray-800">👥 Manajemen Pengguna & Hak Akses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pengaturan akun staf gudang, sales, administrasi, dan 14 tingkatan hak akses role
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
        >
          <span>＋</span> Tambah Pengguna Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Role Akses</th>
                <th className="py-3.5 px-4">Email Terdaftar</th>
                <th className="py-3.5 px-4">Terdaftar Sejak</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Memuat daftar pengguna...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Belum ada pengguna
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-800">{row.namaLengkap}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-600">@{row.username}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {row.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 text-xs">{row.email || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                      {formatTanggal(row.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDelete(row.username)}
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
              <h2 className="font-bold text-gray-800">👥 Tambah Pengguna Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Staf"
                  value={form.namaLengkap}
                  onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none lowercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 karakter"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role / Tingkat Akses *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alamat Email (untuk OTP)</label>
                <input
                  type="email"
                  placeholder="staf@dutapangan.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
