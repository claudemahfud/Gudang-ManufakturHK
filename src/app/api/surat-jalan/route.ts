import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { suratJalan, suratJalanItems, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { generateTrxId } from '@/shared/lib/utils';
import { desc, eq } from 'drizzle-orm';

// ============================================================
// API: /api/surat-jalan
// GET (list surat jalan) + POST (buat surat jalan beserta items)
// ============================================================

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

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
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tanggal, pelanggan, alamat, ekspedisi, armada, catatan, items } = body;

    if (!pelanggan || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Pelanggan dan daftar barang wajib diisi' },
        { status: 400 }
      );
    }

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    const noSj = generateTrxId('SJ');

    const [header] = await db
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

    for (const it of items) {
      await db.insert(suratJalanItems).values({
        suratJalanId: header.id,
        sku: it.sku,
        namaBarang: it.namaBarang,
        qty: parseInt(it.qty, 10) || 1,
        satuan: it.satuan || 'pcs',
        keterangan: it.keterangan || null,
      });
    }

    await db.insert(logs).values({
      user,
      aksi: 'BUAT_SURAT_JALAN',
      detail: `Membuat Surat Jalan ${noSj} untuk ${pelanggan} (${items.length} item)`,
    });

    return NextResponse.json(
      { success: true, data: header, message: 'Surat jalan berhasil dibuat' },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
