import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requireAuthRole, ROLES_RECIPE_BOM } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { buatProduksi, daftarProduksi } from '@/shared/lib/dapur-pusat';
import { isTimPusat } from '@/shared/lib/order-franchise';

// ============================================================
// API: /api/fnb/produksi — Produksi Dapur Pusat
// GET  = riwayat produksi (100 terakhir)
// POST = { menuSku, jumlahBatch, catatan? }: potong bahan, tambah produk jadi
// ============================================================

async function izin() {
  const auth = await requireAuthRole(ROLES_RECIPE_BOM);
  if (!auth.authorized) return { auth, tolak: auth.response };
  if (!isTimPusat(auth.user)) {
    return {
      auth,
      tolak: NextResponse.json({ success: false, message: 'Produksi hanya untuk tim Dapur Pusat' }, { status: 403 }),
    };
  }
  return { auth, tolak: null };
}

export async function GET() {
  try {
    const { tolak } = await izin();
    if (tolak) return tolak;
    return NextResponse.json({ success: true, data: await daftarProduksi() });
  } catch (err) {
    return errorResponse(err, 'PRODUKSI_GET');
  }
}

export async function POST(req: Request) {
  try {
    const { auth, tolak } = await izin();
    if (tolak) return tolak;
    const body = await req.json();
    const hasil = await db.transaction((tx) =>
      buatProduksi(
        tx,
        {
          menuSku: String(body?.menuSku ?? ''),
          jumlahBatch: Number(body?.jumlahBatch),
          catatan: typeof body?.catatan === 'string' && body.catatan.trim() ? body.catatan.trim() : null,
        },
        auth.user.username
      )
    );
    return NextResponse.json({
      success: true,
      data: hasil,
      message: `Produksi ${hasil.noProduksi} tersimpan: ${hasil.hasilQty} unit ${hasil.namaBarang}`,
    });
  } catch (err) {
    return errorResponse(err, 'PRODUKSI_POST');
  }
}
