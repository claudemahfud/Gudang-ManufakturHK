import { NextResponse } from 'next/server';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { assertSupervisorPin, getPengaturan } from '@/shared/lib/pengaturan';

// ============================================================
// API: /api/pengaturan/verifikasi-pin
// POST { pin, aksi } — cek PIN supervisor untuk aksi yang hanya ada
// di browser (mis. kosongkan keranjang POS). Diskon & hapus transaksi
// tetap diverifikasi ulang di endpoint masing-masing.
// ============================================================

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const { pin, aksi } = await req.json();
    const actor = authResult.user?.username || 'unknown';
    await assertSupervisorPin(await getPengaturan(), pin, actor, String(aksi || 'verifikasi'));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, 'VERIFIKASI_PIN');
  }
}
