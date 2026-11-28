import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { logs, users } from '@/shared/lib/db/schema';
import { hashPassword, verifyPassword } from '@/shared/lib/auth/password';
import { BATAS_GAGAL, JENDELA_MS, POLA_PIN, superuserSaja, terkunci } from '@/shared/lib/keamanan-superuser';
import { ambilJatah, kembalikanJatah } from '@/shared/lib/auth/percobaan';

// ============================================================
// API: /api/profile/pin-reset — PIN Reset Total milik Superuser
// GET : { adaPin } (PIN tidak pernah dikirim)
// PUT : { password, pin } — wajib password akun; PIN 6 digit disimpan ter-hash (scrypt)
// ============================================================

const GAGAL = 'PIN_RESET_ATUR_GAGAL';

export async function GET() {
  const { galat, user } = await superuserSaja();
  if (galat) return galat;
  return NextResponse.json({ success: true, adaPin: Boolean(user.pinResetHash) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  const { galat, user } = await superuserSaja();
  if (galat) return galat;
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const pin = typeof body?.pin === 'string' ? body.pin : '';
  if (!POLA_PIN.test(pin)) {
    return NextResponse.json({ success: false, message: 'PIN harus tepat 6 angka' }, { status: 400 });
  }
  if (/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    return NextResponse.json({ success: false, message: 'PIN terlalu mudah ditebak (angka sama / berurutan)' }, { status: 400 });
  }
  const jatah = await ambilJatah(user.username, GAGAL, BATAS_GAGAL, JENDELA_MS, 'Password salah saat mengatur PIN Reset Total');
  if (!jatah) return terkunci();
  const { ok } = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ success: false, message: 'Password akun salah' }, { status: 401 });
  }

  await kembalikanJatah(jatah.id);

  await db.update(users).set({ pinResetHash: await hashPassword(pin), updatedAt: new Date() }).where(eq(users.id, user.id));
  await db.insert(logs).values({ user: user.username, aksi: 'PIN_RESET_DIATUR', detail: 'Superuser mengatur / mengganti PIN Reset Total' });
  return NextResponse.json({ success: true, message: 'PIN Reset Total disimpan' });
}
