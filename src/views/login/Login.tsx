// ============================================================
// PAGE: Login (Split Screen Layout Archetype - Reference Image 2 & 3)
// Route: /login
// Semantic HTML: <main>, <aside>, <section>, <header>, <footer>
// ============================================================
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import {
  Boxes,
  Eye,
  EyeOff,
  Factory,
  Coffee,
  Building2,
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

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
        // Ambil info session untuk mendeteksi apakah akun Bawahan atau Pimpinan
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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50">
      {/* 1. Left Section: Split Screen Visual Brand Showcase (lg:col-span-6 or 7) */}
      <aside aria-label="Brand Overview" className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Logo & App Title */}
        <header className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md">
            <Boxes className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              Gudang Manufaktur & F&B Hub
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Dual-Domain Integrated Enterprise Cloud
            </p>
          </div>
        </header>

        {/* Middle Feature Highlights */}
        <section aria-label="Fitur Unggulan" className="relative z-10 my-auto py-8 space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Cabang & RLS Strict Isolation</span>
            </span>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Satu Akun, Dua Jalur Operasional Terpisah Sempurna.
            </h2>
            <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
              Pemisahan ketat antara stok barang grosir pabrik manufaktur dan kafe/resto F&B tanpa resiko kebocoran data antar sesama cabang.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            {/* Feature 1 */}
            <article className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Factory className="w-6 h-6 text-blue-400 mb-2" />
              <h3 className="text-sm font-bold text-white">Divisi Manufaktur</h3>
              <p className="text-xs text-slate-400 mt-1">
                Grosir, muatan bal, PO loading & surat jalan pengiriman resmi.
              </p>
            </article>

            {/* Feature 2 */}
            <article className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Coffee className="w-6 h-6 text-emerald-400 mb-2" />
              <h3 className="text-sm font-bold text-white">Food & Beverages</h3>
              <p className="text-xs text-slate-400 mt-1">
                POS kasir kilat, cetak nota thermal, kalkulator HPP resep & cash opname.
              </p>
            </article>
          </div>
        </section>

        {/* Bottom Security Note */}
        <footer className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Hak Akses RBAC & Proteksi HPP Bawahan</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">v2.2 Production</span>
        </footer>
      </aside>

      {/* 2. Right Section: Split Screen Form Area (lg:col-span-6 or 5) */}
      <section aria-label="Formulir Otentikasi" className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white min-h-screen">
        <div className="w-full max-w-md mx-auto my-auto space-y-8">
          {/* Header Mobile / Title */}
          <header className="space-y-2">
            <div className="lg:hidden inline-flex items-center justify-center w-12 h-12 bg-slate-900 text-white rounded-2xl mb-2 shadow-sm">
              <Boxes className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Selamat Datang Kembali
            </h2>
            <p className="text-sm text-slate-500">
              Masukkan kredensial akun untuk mengakses sistem operasional
            </p>
          </header>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="Masukkan username"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Masukkan password"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-2xl border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none transition text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                  title={showPass ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Default Cabang: PUSAT</span>
              <a
                href={ROUTES.FORGOT_PASSWORD}
                className="text-slate-600 hover:text-slate-900 font-semibold transition"
              >
                Lupa password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white font-bold rounded-2xl transition text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 active:scale-98"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400">©Hikimori 2026</p>
          </form>
        </div>

        {/* Semantic Footer on Right Section */}
        <footer className="text-center text-xs text-slate-400 pt-8">
          Gudang Manufaktur & F&B Hub &copy; {new Date().getFullYear()} &bull; Keamanan Multi-Cabang Terjamin
        </footer>
      </section>
    </main>
  );
}
