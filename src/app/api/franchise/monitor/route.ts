import { NextResponse } from 'next/server';
import { requireAuthRole, ROLES_FINANCE } from '@/shared/lib/auth/rbac';
import { BusinessError, errorResponse } from '@/shared/lib/stock';
import { monitorFranchise } from '@/shared/lib/monitor-franchise';

// ============================================================
// API: /api/franchise/monitor?dari=YYYY-MM-DD&sampai=YYYY-MM-DD (sampai inklusif)
// Ringkasan per outlet franchise untuk manajemen pusat.
// ============================================================

export async function GET(req: Request) {
  try {
    const auth = await requireAuthRole(ROLES_FINANCE);
    if (!auth.authorized) return auth.response;

    const sp = new URL(req.url).searchParams;
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    const dari = sp.get('dari') ? new Date(`${sp.get('dari')}T00:00:00`) : new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
    const akhir = sp.get('sampai') ? new Date(`${sp.get('sampai')}T00:00:00`) : hariIni;
    if (Number.isNaN(dari.getTime()) || Number.isNaN(akhir.getTime()) || akhir < dari)
      throw new BusinessError('Rentang tanggal tidak valid');
    const sampai = new Date(akhir.getTime() + 24 * 60 * 60 * 1000);

    return NextResponse.json({ success: true, data: await monitorFranchise(dari, sampai) });
  } catch (err) {
    return errorResponse(err, 'MONITOR_FRANCHISE');
  }
}
