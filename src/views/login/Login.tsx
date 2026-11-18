// ============================================================
// PAGE: Login
// Route: /login
// ============================================================
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/router/routes';

export default function Login() {
  // ============================================================
  // SECTION: State & Hooks
  // ============================================================
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || ROUTES.DASHBOARD;

  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // ============================================================
  // SECTION: Handler — Submit Login
  // ============================================================
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
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // SECTION: Render
  // ============================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-teal-50 to-emerald-100 p-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <span className="text-3xl">🏭</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Gudang Manufaktur</h1>
          <p className="text-sm text-gray-500 mt-1">Sistem Inventory & Manajemen</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Masukkan username"
              required
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Masukkan password"
                required
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <a
              href={ROUTES.FORGOT_PASSWORD}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Lupa password?
            </a>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl transition text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Masuk...
              </>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Gudang Manufaktur &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
