// ============================================================
// PAGE: Login (Monochrome Clean)
// Route: /login
// ============================================================
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import { Boxes, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || ROUTES.DASHBOARD;

  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Username atau password salah. Silakan coba lagi.');
      } else {
        // Ambil info session untuk mendeteksi apakah akun Bawahan (mode sudah ditentukan) atau Pimpinan
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        const loggedUser = sessionData?.user;

        if (loggedUser?.divisiAssigned && loggedUser.divisiAssigned !== 'ALL') {
          // Akun Bawahan: Langsung masuk Dashboard mode divisinya tanpa perlu halaman Pilih Mode
          const assignedMode = loggedUser.divisiAssigned;
          localStorage.setItem('app_active_division', assignedMode);
          document.cookie = `app_active_division=${assignedMode}; path=/; max-age=31536000`;
          router.push(ROUTES.DASHBOARD);
        } else {
          // Akun Pimpinan (Admin, Direktur Utama, Manager): Masuk halaman Pilih Mode
          router.push(ROUTES.SELECT_MODE);
        }
        router.refresh();
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200/80 p-8">
        {/* Minimal Monochrome Brand Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 text-white rounded-2xl mb-4 shadow-sm">
            <Boxes className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Gudang Manufaktur</h1>
          <p className="text-xs text-gray-500 mt-1">Sistem Inventory & Manajemen Pergudangan</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Masukkan username"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Masukkan password"
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition text-sm bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <a
              href={ROUTES.FORGOT_PASSWORD}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium transition"
            >
              Lupa password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-semibold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              'Masuk ke Sistem'
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          Gudang Manufaktur &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
