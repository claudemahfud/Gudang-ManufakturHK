import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { biayaOperasional } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { eq } from 'drizzle-orm';

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
    await db.delete(biayaOperasional).where(eq(biayaOperasional.id, id));

    return NextResponse.json({ success: true, message: 'Biaya operasional dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
