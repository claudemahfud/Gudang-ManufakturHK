import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { suratJalan, suratJalanItems, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/surat-jalan/[id]
// GET detail (dengan items), PUT (update status), DELETE
// ============================================================

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [header] = await db
      .select()
      .from(suratJalan)
      .where(eq(suratJalan.id, id))
      .limit(1);

    if (!header) {
      return NextResponse.json({ success: false, message: 'Surat jalan tidak ditemukan' }, { status: 404 });
    }

    const items = await db
      .select()
      .from(suratJalanItems)
      .where(eq(suratJalanItems.suratJalanId, id));

    return NextResponse.json({
      success: true,
      data: {
        ...header,
        items,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();

    const [updated] = await db
      .update(suratJalan)
      .set({ status, updatedAt: new Date() })
      .where(eq(suratJalan.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await db.delete(suratJalan).where(eq(suratJalan.id, id));

    const user = (session.user as any)?.name || (session.user as any)?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_SURAT_JALAN',
      detail: `Menghapus surat jalan ID: ${id}`,
    });

    return NextResponse.json({ success: true, message: 'Surat jalan berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
