import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { armada } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';

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
      .update(armada)
      .set({ status })
      .where(eq(armada.id, id))
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
    await db.delete(armada).where(eq(armada.id, id));

    return NextResponse.json({ success: true, message: 'Armada dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
