'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/router/routes';
import { KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';

// ============================================================
// PAGE: Lupa Password (Monochrome Clean)
// Route: /forgot-password
// ============================================================

type Step = 'email' | 'otp' | 'newpass' | 'done';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200/80 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 text-white rounded-2xl mb-4 shadow-sm">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Atur Ulang Password</h1>
          <p className="text-xs text-gray-500 mt-1">Reset password aman menggunakan kode verifikasi</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs mb-5">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs mb-5">
            {message}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Alamat Email Terdaftar</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com" required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition text-sm bg-white"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-semibold rounded-xl transition text-sm">
              {loading ? 'Mengirim...' : 'Kirim Kode Verifikasi'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kode Verifikasi (OTP)</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                placeholder="6 Digit" required maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition text-sm text-center tracking-widest text-lg font-bold font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password Baru</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 karakter" required minLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition text-sm bg-white"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-semibold rounded-xl transition text-sm">
              {loading ? 'Memverifikasi...' : 'Simpan Password Baru'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold mb-1 text-sm">Password Berhasil Diperbarui</p>
            <p className="text-xs text-gray-500 mb-6">Silakan kembali masuk menggunakan kredensial baru Anda.</p>
            <button onClick={() => router.push(ROUTES.LOGIN)}
              className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition text-sm">
              Ke Halaman Login
            </button>
          </div>
        )}

        <a href={ROUTES.LOGIN} className="flex items-center justify-center text-xs text-gray-500 hover:text-gray-900 mt-6 transition">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Kembali ke Login
        </a>
      </div>
    </div>
  );
}
