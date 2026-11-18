'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/router/routes';

// ============================================================
// PAGE: Lupa Password (OTP via email)
// Route: /forgot-password
// ============================================================

type Step = 'email' | 'otp' | 'newpass' | 'done';

export default function ForgotPassword() {
  // ============================================================
  // SECTION: State & Hooks
  // ============================================================
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // ============================================================
  // SECTION: Handler — Kirim OTP
  // ============================================================
  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Gagal mengirim OTP');
      setMessage('Kode OTP telah dikirim ke email Anda. Berlaku 10 menit.');
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // SECTION: Handler — Verifikasi OTP
  // ============================================================
  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'OTP tidak valid atau sudah kadaluarsa');
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // SECTION: Render
  // ============================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-teal-50 to-emerald-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Lupa Password</h1>
          <p className="text-sm text-gray-500 mt-1">Reset password via email OTP</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-5">
            {message}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email terdaftar" required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition text-sm"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl transition text-sm">
              {loading ? 'Mengirim...' : 'Kirim OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kode OTP</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                placeholder="6 digit kode OTP" required maxLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition text-sm text-center tracking-widest text-lg font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password Baru</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 karakter" required minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition text-sm"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl transition text-sm">
              {loading ? 'Memverifikasi...' : 'Reset Password'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-green-700 font-semibold mb-2">Password berhasil direset!</p>
            <p className="text-sm text-gray-500 mb-6">Silakan masuk dengan password baru Anda.</p>
            <button onClick={() => router.push(ROUTES.LOGIN)}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition text-sm">
              Ke Halaman Login
            </button>
          </div>
        )}

        <a href={ROUTES.LOGIN} className="block text-center text-xs text-gray-400 hover:text-green-600 mt-6">
          ← Kembali ke Login
        </a>
      </div>
    </div>
  );
}
