import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { masterCabang, logs } from '@/shared/lib/db/schema';
import { auth } from '@/shared/lib/auth/config';
import { requireAuthRole, ROLES_EXECUTIVE } from '@/shared/lib/auth/rbac';
import { desc, eq, and, or } from 'drizzle-orm';

// ============================================================
// API: /api/cabang
// GET: Ambil daftar cabang (default: hanya 'Pusat' kecuali ada cabang baru)
// POST: Tambah cabang baru (Hanya Administrator / Direktur Utama / Manager)
// ============================================================

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const userRole = user?.role;
    const userCabang = user?.cabang || 'Pusat';
    const isExecutive = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum'].includes(userRole);

    const { searchParams } = new URL(req.url);
    const divisiParam = searchParams.get('divisi');

    // Query semua cabang aktif
    let query = db
      .select({
        id: masterCabang.id,
        kodeCabang: masterCabang.kodeCabang,
        namaCabang: masterCabang.namaCabang,
        divisi: masterCabang.divisi,
        alamat: masterCabang.alamat,
        telepon: masterCabang.telepon,
        isPusat: masterCabang.isPusat,
        tipe: masterCabang.tipe,
        status: masterCabang.status,
      })
      .from(masterCabang)
      .where(eq(masterCabang.status, 'ACTIVE'))
      .orderBy(desc(masterCabang.isPusat), masterCabang.namaCabang);

    let list = await query;

    // Filter berdasarkan divisi jika diminta
    if (divisiParam && divisiParam !== 'ALL') {
      list = list.filter((c) => c.divisi === 'ALL' || c.divisi === divisiParam);
    }

    // Jika karyawan cabang (bukan eksekutif dan bukan di Pusat / ALL), hanya kembalikan cabang tempat dia ditempatkan
    if (!isExecutive && userCabang !== 'ALL' && userCabang !== 'Pusat') {
      list = list.filter((c) => c.namaCabang === userCabang);
      if (list.length === 0) {
        list = [{
          id: 0,
          kodeCabang: 'CBG',
          namaCabang: userCabang,
          divisi: 'ALL',
          alamat: null,
          telepon: null,
          isPusat: false,
          tipe: 'CABANG',
          status: 'ACTIVE',
        }];
      }
    }

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_EXECUTIVE);
    if (!authResult.authorized) return authResult.response;

    const user = authResult.user;

    const body = await req.json();
    const { kodeCabang, namaCabang, divisi = 'ALL', alamat, telepon } = body;
    // Franchise = outlet F&B milik mitra yang membeli produk dari Dapur Pusat
    const tipe = body?.tipe === 'FRANCHISE' ? 'FRANCHISE' : 'CABANG';

    if (!kodeCabang || !namaCabang) {
      return NextResponse.json(
        { success: false, message: 'Kode Cabang dan Nama Cabang wajib diisi' },
        { status: 400 }
      );
    }

    const cleanKode = kodeCabang.trim().toUpperCase();
    const cleanNama = namaCabang.trim();

    // Cek duplikasi
    const existing = await db
      .select({ id: masterCabang.id })
      .from(masterCabang)
      .where(or(eq(masterCabang.kodeCabang, cleanKode), eq(masterCabang.namaCabang, cleanNama)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Kode Cabang atau Nama Cabang sudah digunakan' },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(masterCabang)
      .values({
        kodeCabang: cleanKode,
        namaCabang: cleanNama,
        divisi: tipe === 'FRANCHISE' ? 'FNB' : divisi || 'ALL',
        tipe,
        alamat: alamat || null,
        telepon: telepon || null,
        isPusat: false,
        status: 'ACTIVE',
      })
      .returning();

    // Catat log
    await db.insert(logs).values({
      user: user?.username || 'admin',
      aksi: 'TAMBAH_CABANG',
      detail: `Tambah ${tipe === 'FRANCHISE' ? 'Outlet Franchise' : 'Cabang'} Baru: ${cleanNama} (${cleanKode}) oleh ${user?.namaLengkap || user?.username}`,
    });

    return NextResponse.json({ success: true, data: created, message: 'Cabang berhasil ditambahkan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
