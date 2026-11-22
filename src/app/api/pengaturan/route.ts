import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { logs, pengaturanPerusahaan } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_COMPANY_SETTINGS } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { getPengaturan, hashPin, isValidPinFormat, publicPengaturan } from '@/shared/lib/pengaturan';

// ============================================================
// API: /api/pengaturan — Pengaturan Perusahaan
// GET: semua pengguna login (tanpa hash PIN)
// PUT: hanya Direktur Utama
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;
    return NextResponse.json({ success: true, data: publicPengaturan(await getPengaturan()) });
  } catch (err) {
    return errorResponse(err, 'PENGATURAN_GET');
  }
}

export async function PUT(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_COMPANY_SETTINGS);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const wajibPin = Boolean(body?.wajibPin);
    const pinVoidCart = Boolean(body?.pinVoidCart);
    const pinHapusTransaksi = Boolean(body?.pinHapusTransaksi);
    const maxDiskonTanpaPin = Number(body?.maxDiskonTanpaPin);
    const pinBaru = body?.pinBaru ? String(body.pinBaru) : '';

    if (!Number.isInteger(maxDiskonTanpaPin) || maxDiskonTanpaPin < 0 || maxDiskonTanpaPin > 100) {
      return NextResponse.json({ success: false, message: 'Batas diskon tanpa PIN harus 0-100' }, { status: 400 });
    }
    if (pinBaru && !isValidPinFormat(pinBaru)) {
      return NextResponse.json({ success: false, message: 'PIN harus 4-6 digit angka' }, { status: 400 });
    }

    const current = await getPengaturan();
    if (wajibPin && !pinBaru && !current.pinHash) {
      return NextResponse.json(
        { success: false, message: 'Isi PIN supervisor dulu sebelum mewajibkan PIN.' },
        { status: 400 }
      );
    }

    const actor = authResult.user?.username || 'System';
    const values = {
      wajibPin,
      maxDiskonTanpaPin,
      pinVoidCart,
      pinHapusTransaksi,
      ...(pinBaru && { pinHash: hashPin(pinBaru) }),
      updatedBy: actor,
      updatedAt: new Date(),
    };

    const [saved] = await db
      .insert(pengaturanPerusahaan)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: pengaturanPerusahaan.id, set: values })
      .returning();

    await db.insert(logs).values({
      user: actor,
      aksi: 'UBAH_PENGATURAN_PIN',
      detail: `PIN supervisor ${wajibPin ? 'WAJIB' : 'TIDAK wajib'}; diskon tanpa PIN maks ${maxDiskonTanpaPin}%; void keranjang ${pinVoidCart ? 'pakai' : 'tanpa'} PIN; hapus transaksi ${pinHapusTransaksi ? 'pakai' : 'tanpa'} PIN${pinBaru ? '; PIN diganti' : ''}`,
    });

    return NextResponse.json({ success: true, data: publicPengaturan(saved), message: 'Pengaturan disimpan' });
  } catch (err) {
    return errorResponse(err, 'PENGATURAN_PUT');
  }
}
