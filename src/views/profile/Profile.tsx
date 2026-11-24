'use client';

// ============================================================
// PAGE: Setting Profil Akun & Ganti Mode Operasional
// Route: /profile
// Standar: WCAG Compliant, Title/Sub-Title/Sub-Sub-Title,
// Single Line, Dual Line, Triple Line, List Dual-Line, List Triple-Line
// ============================================================

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useDivision, DivisionMode } from '@/shared/context/DivisionContext';
import { formatTanggal } from '@/shared/lib/utils';
import {
  User,
  Shield,
  Building2,
  Factory,
  Coffee,
  KeyRound,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Calendar,
  LogOut,
  Save,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface UserProfileData {
  id: string;
  username: string;
  namaLengkap: string;
  role: string;
  email: string | null;
  divisiAssigned: string;
  cabang: string;
  aktif: boolean;
  createdAt: string;
}

export default function Profile() {
  const { data: session, update } = useSession();
  const {
    division,
    isManufaktur,
    isFnb,
    cabang,
    canSwitchDivision,
    isCabangLocked,
    logoutAndSwitchMode,
  } = useDivision();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form Profile State
  const [namaLengkap, setNamaLengkap] = useState('');
  const [email, setEmail] = useState('');

  // Form Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile');
      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
        setNamaLengkap(json.data.namaLengkap || '');
        setEmail(json.data.email || '');
      } else {
        showToast(json.message || 'Gagal memuat profil', 'error');
      }
    } catch {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showToast('Konfirmasi password baru tidak cocok', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        namaLengkap,
        email,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Profil berhasil disimpan', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchProfile();
        if (update) await update({ name: (json.data?.namaLengkap ?? namaLengkap).trim() });
      } else {
        showToast(json.message || 'Gagal menyimpan perubahan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Floater */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header (Triple Line Archetype) */}
      <header className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-2xl shadow-md shrink-0">
            {profile?.namaLengkap?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="space-y-1">
            {/* Line 1: Overline */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full">
                Akun Terverifikasi
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                @{profile?.username || 'user'}
              </span>
            </div>
            {/* Line 2: Title */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight leading-tight">
              {profile?.namaLengkap || 'Nama Pengguna'}
            </h1>
            {/* Line 3: Subtitle */}
            <p className="text-xs sm:text-sm text-slate-600 leading-normal">
              Kelola informasi identitas akun, kredensial login, dan pengaturan jalur operasional
            </p>
          </div>
        </div>

        {/* Status Chip (Single Line Archetype) */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
            <Shield className="w-4 h-4 text-slate-700" />
            <span>Role: <strong>{profile?.role || 'User'}</strong></span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
            <Building2 className="w-4 h-4 text-slate-700" />
            <span>Cabang: <strong>{cabang}</strong></span>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. SECTION: GANTI MODE OPERASIONAL (Permintaan Khusus User) */}
      {/* ============================================================ */}
      <section aria-labelledby="heading-ganti-mode" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
        {/* Triple Line Section Header */}
        <div className="border-b border-slate-100 pb-4 space-y-1">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Pusat Kendali Jalur
            </span>
          </div>
          <h2 id="heading-ganti-mode" className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight leading-tight">
            Ganti Mode Operasional (Manufaktur vs F&B)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
            Sistem mengisolasi penuh data inventaris, kasir POS, dan laporan finansial antar mode.
            Perpindahan mode operasional <strong>wajib melakukan Logout terlebih dahulu</strong> demi menjaga keamanan integritas data.
          </p>
        </div>

        {/* Mode Selector Cards (Split Screen / Dual Card Archetype) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Manufaktur */}
          <article
            className={`p-5 rounded-2xl border transition-all ${
              isManufaktur
                ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-sm'
                : 'bg-slate-50/60 border-slate-200 opacity-75'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Factory className="w-5 h-5" />
              </div>
              {isManufaktur ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>Sedang Aktif</span>
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500">Tidak Aktif</span>
              )}
            </div>

            {/* Dual Line Card Info */}
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Divisi Manufaktur (Pabrik & Grosir)
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-normal">
              Manajemen stok bal/karton, surat jalan ekspedisi, PO loading gudang, dan POS toko grosir.
            </p>
          </article>

          {/* Card 2: Food & Beverages */}
          <article
            className={`p-5 rounded-2xl border transition-all ${
              isFnb
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-slate-50/60 border-slate-200 opacity-75'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Coffee className="w-5 h-5" />
              </div>
              {isFnb ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  <Check className="w-3 h-3" />
                  <span>Sedang Aktif</span>
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500">Tidak Aktif</span>
              )}
            </div>

            {/* Dual Line Card Info */}
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Divisi Food & Beverages (Cafe & Resto)
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-normal">
              Bahan baku resep (gram/ml), kalkulator HPP otomatis (BOM), kasir POS cafe, dan cash opname laci.
            </p>
          </article>
        </div>

        {/* Action Button for Switching Mode */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-900">
              {canSwitchDivision
                ? 'Ingin berpindah ke domain operasional lain?'
                : 'Hak Akses Mode Operasional Dibatasi'}
            </div>
            <div className="text-[11px] text-slate-600">
              {canSwitchDivision
                ? 'Klik tombol di samping untuk logout otomatis dan memilih mode yang dituju.'
                : 'Akun Anda ditetapkan untuk mode tertentu oleh Administrator.'}
            </div>
          </div>

          {canSwitchDivision ? (
            <button
              type="button"
              onClick={logoutAndSwitchMode}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition shrink-0"
              title="Logout dan Ganti Mode Operasional"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Logout & Ganti Mode</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-500 bg-slate-200/70 px-3 py-1.5 rounded-xl">
              Mode Terkunci
            </span>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. SECTION: FORM PROFIL & GANTI PASSWORD */}
      {/* ============================================================ */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        <section aria-labelledby="heading-identitas" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          {/* Dual Line Section Header */}
          <div className="border-b border-slate-100 pb-4 space-y-0.5">
            <h2 id="heading-identitas" className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight leading-tight">
              Informasi Akun & Kontak
            </h2>
            <p className="text-xs text-slate-600 leading-normal">
              Perbarui nama tampilan dan alamat email yang terkait dengan akun ini
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Username (Read Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username (ID Login)
              </label>
              <input
                type="text"
                disabled
                value={profile?.username || ''}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Username bersifat permanen dan tidak dapat diubah</span>
            </div>

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Lengkap *
              </label>
              <input
                type="text"
                required
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            {/* Role & Cabang Penempatan (List Dual-Line) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Penempatan Cabang
              </label>
              <input
                type="text"
                disabled
                value={`${cabang} ${isCabangLocked ? '(Akses Terkunci)' : '(Dapat Berpindah)'}`}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-medium cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        {/* Keamanan & Ganti Password */}
        <section aria-labelledby="heading-keamanan" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 space-y-0.5">
            <h2 id="heading-keamanan" className="text-base sm:text-lg font-extrabold text-slate-950 tracking-tight leading-tight">
              Keamanan & Kata Sandi
            </h2>
            <p className="text-xs text-slate-600 leading-normal">
              Kosongkan bagian ini jika Anda tidak ingin mengubah kata sandi akun
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password Saat Ini
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Verifikasi password lama"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password Baru
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>
          </div>
        </section>

        {/* Submit Actions Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold shadow-md shadow-slate-900/20 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan Perubahan...' : 'Simpan Pengaturan Profil'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
