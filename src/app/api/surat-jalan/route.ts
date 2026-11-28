import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { suratJalan, suratJalanItems, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_EXPEDISI } from '@/shared/lib/auth/rbac';
import { desc, eq } from 'drizzle-orm';
import { nomorUrut } from '@/shared/lib/nomor-urut';
import { normalizeSatuan } from '@/shared/lib/satuan';

// ============================================================
// API: /api/surat-jalan
// GET (list surat jalan) + POST (buat surat jalan beserta items)
// ============================================================

export async function GET() {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole();
    if (!authResult.authorized) return authResult.response;

    const list = await db
      .select()
      .from(suratJalan)
      .orderBy(desc(suratJalan.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Dibaca segar dari DB: akun nonaktif/dihapus langsung ditolak walau token masih berlaku
    const authResult = await requireAuthRole(ROLES_EXPEDISI);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const body = await req.json();
    const { tanggal, pelanggan, alamat, ekspedisi, armada, catatan, items } = body;

    if (!pelanggan || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Pelanggan dan daftar barang wajib diisi' },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    let noSj = '';
    let headerResult: any;

    await db.transaction(async (tx) => {
      noSj = await nomorUrut(tx, 'SJ');
      const [header] = await tx
        .insert(suratJalan)
        .values({
          noSj,
          tanggal: tanggal ? new Date(tanggal) : new Date(),
          pelanggan,
          alamat: alamat || null,
          ekspedisi: ekspedisi || null,
          armada: armada || null,
          status: 'dikirim',
          catatan: catatan || null,
          createdBy: user,
        })
        .returning();

      headerResult = header;

      for (const it of items) {
        await tx.insert(suratJalanItems).values({
          suratJalanId: header.id,
          sku: it.sku,
          namaBarang: it.namaBarang,
          qty: parseInt(it.qty, 10) || 1,
          satuan: normalizeSatuan(it.satuan),
          keterangan: it.keterangan || null,
        });
      }

      await tx.insert(logs).values({
        user,
        aksi: 'BUAT_SURAT_JALAN',
        detail: `Membuat Surat Jalan ${noSj} untuk ${pelanggan} (${items.length} item)`,
      });
    });

    return NextResponse.json(
      { success: true, data: headerResult, message: 'Surat jalan berhasil dibuat' },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
