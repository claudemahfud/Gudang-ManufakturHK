import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { users } from '@/shared/lib/db/schema';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { errorResponse } from '@/shared/lib/stock';
import { keWebp } from '@/shared/lib/webp';

// ============================================================
// API: /api/profile/foto — foto profil akun yang sedang login
// GET: ambil foto, PUT { foto: dataURL }: simpan, DELETE: hapus
// Foto diperkecil di browser, lalu dikonversi ke WebP 256px di server; disimpan sebagai data URL di users.foto.
// ============================================================

const POLA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAKS = 400 * 1024; // panjang data URL maksimum (~300 KB gambar)

async function pengguna() {
  const r = await requireAuthRole();
  if (!r.authorized) return { galat: r.response, username: '' };
  const username = (r.user as { username?: string })?.username;
  if (!username) return { galat: NextResponse.json({ success: false, message: 'Sesi tidak valid' }, { status: 400 }), username: '' };
  return { galat: null, username };
}

export async function GET() {
  const { galat, username } = await pengguna();
  if (galat) return galat;
  const [u] = await db.select({ foto: users.foto }).from(users).where(eq(users.username, username)).limit(1);
  return NextResponse.json(
    { success: true, foto: u?.foto ?? null },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function PUT(req: Request) {
  const { galat, username } = await pengguna();
  if (galat) return galat;
  const body = await req.json().catch(() => ({}));
  const foto = typeof body?.foto === 'string' ? body.foto : '';
  if (!POLA.test(foto)) {
    return NextResponse.json({ success: false, message: 'Format foto harus JPG, PNG, atau WebP' }, { status: 400 });
  }
  if (foto.length > MAKS) {
    return NextResponse.json({ success: false, message: 'Ukuran foto terlalu besar' }, { status: 413 });
  }
  try {
    const webp = await keWebp(foto, { lebar: 256, tinggi: 256, fit: 'cover', mutu: 85 });
    await db.update(users).set({ foto: webp, updatedAt: new Date() }).where(eq(users.username, username));
    return NextResponse.json({ success: true, message: 'Foto profil disimpan', foto: webp });
  } catch (err) {
    return errorResponse(err, 'FOTO_PROFIL_PUT');
  }
}

export async function DELETE() {
  const { galat, username } = await pengguna();
  if (galat) return galat;
  await db.update(users).set({ foto: null, updatedAt: new Date() }).where(eq(users.username, username));
  return NextResponse.json({ success: true, message: 'Foto profil dihapus' });
}
