import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { users, logs } from '@/shared/lib/db/schema';
import { and, eq, ne, sql } from 'drizzle-orm';
import { hashPassword } from '@/shared/lib/auth/password';
import { requireAuthRole } from '@/shared/lib/auth/rbac';
import { SEMUA_ROLE } from '@/shared/lib/auth/roles';
import { punyaRiwayatKas } from '@/shared/lib/setoran';

const POLA_USERNAME = /^[a-z0-9._-]{3,50}$/;
const DIVISI = ['ALL', 'MANUFAKTUR', 'FNB'];

// Kolom teks yang menyimpan username pelaku/salesman (tanpa foreign key). Saat username diganti,
// nilai yang sama persis ikut diganti agar riwayat & filter "data sendiri" tetap tersambung.
// logs.user sengaja tidak diubah: jejak audit tetap seperti saat kejadian.
const KOLOM_USERNAME: Array<[string, string]> = [
  ['barang_keluar', 'created_by'], ['barang_keluar', 'salesman'], ['barang_masuk', 'created_by'],
  ['barang_rusak', 'created_by'], ['biaya_operasional', 'created_by'], ['biaya_operasional', 'username'], ['cash_opname', 'kasir'],
  ['cash_opname', 'created_by'], ['diskon_request', 'salesman'], ['diskon_request', 'approved_by'],
  ['faktur_penjualan', 'salesman'], ['faktur_penjualan', 'created_by'], ['keuangan', 'created_by'],
  ['mutasi_barang', 'created_by'], ['order_franchise', 'diterima_by'], ['order_franchise', 'dikirim_by'],
  ['order_franchise', 'created_by'], ['pengaturan_perusahaan', 'updated_by'], ['piutang_mutasi', 'created_by'],
  ['po_loading', 'created_by'], ['produksi', 'created_by'], ['resep_header', 'updated_by'],
  ['retur_barang', 'created_by'], ['stok_fisik_sesi', 'created_by'], ['surat_jalan', 'created_by'],
  ['target_komisi', 'salesman'],
];

const gagal = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    // Administrator sebagai role utama atau role tambahan (dibaca segar dari DB)
    const authResult = await requireAuthRole(['Administrator']);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const { username } = await params;
    const body = await req.json().catch(() => ({}));

    const [lama] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!lama) return gagal('Pengguna tidak ditemukan', 404);

    const namaLengkap = String(body.namaLengkap ?? lama.namaLengkap).trim();
    const usernameBaru = String(body.username ?? lama.username).trim().toLowerCase();
    const role = String(body.role ?? lama.role);
    const aktif = typeof body.aktif === 'boolean' ? body.aktif : lama.aktif;
    const divisi = String(body.divisiAssigned ?? lama.divisiAssigned ?? 'MANUFAKTUR');
    const cabang = String(body.cabang ?? lama.cabang ?? 'Pusat').trim() || 'Pusat';
    const email = body.email === undefined ? lama.email : String(body.email || '').trim() || null;

    if (!namaLengkap) return gagal('Nama lengkap wajib diisi');
    if (!POLA_USERNAME.test(usernameBaru)) return gagal('Username 3-50 karakter: huruf kecil, angka, titik, minus, garis bawah');
    if (!(SEMUA_ROLE as string[]).includes(role)) return gagal('Role tidak dikenal');
    if (!DIVISI.includes(divisi)) return gagal('Divisi tidak dikenal');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return gagal('Format email tidak valid');

    // Akun sendiri: jangan sampai Administrator mengunci dirinya keluar
    const diriSendiri = authResult.user?.username === lama.username;
    if (diriSendiri && (role !== lama.role || !aktif || usernameBaru !== lama.username)) {
      return gagal('Username, role utama, dan status aktif akun Anda sendiri tidak bisa diubah dari sini');
    }

    const gantiUsername = usernameBaru !== lama.username;
    if (gantiUsername) {
      const [bentrok] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.username, usernameBaru), ne(users.id, lama.id))).limit(1);
      if (bentrok) return gagal(`Username @${usernameBaru} sudah dipakai akun lain`, 409);
      if (await punyaRiwayatKas(db, lama.username)) {
        return gagal(`Username @${lama.username} sudah punya riwayat kas penjualan, tidak bisa diganti. Nama lengkap tetap bisa diubah.`, 409);
      }
      if (await punyaRiwayatKas(db, usernameBaru, true)) {
        return gagal(`Username @${usernameBaru} pernah dipakai dan masih punya riwayat kas. Pilih username lain.`, 409);
      }
    }

    const updateData: any = {
      username: usernameBaru,
      namaLengkap,
      role,
      // Role utama yang baru tidak perlu tercatat lagi sebagai role tambahan
      rolesTambahan: sql`array_remove(${users.rolesTambahan}, ${role})`,
      email,
      aktif,
      divisiAssigned: divisi,
      cabang,
      updatedAt: new Date(),
    };

    // Kompatibilitas lama: password masih bisa dikirim lewat endpoint ini
    if (typeof body.password === 'string' && body.password.trim().length > 0) {
      if (body.password.length < 6 || body.password.length > 128) return gagal('Password baru harus 6-128 karakter');
      updateData.passwordHash = await hashPassword(body.password);
    }

    const updated = await db.transaction(async (tx) => {
      const [u] = await tx.update(users).set(updateData).where(eq(users.id, lama.id)).returning({
        id: users.id, username: users.username, namaLengkap: users.namaLengkap, role: users.role,
        rolesTambahan: users.rolesTambahan, email: users.email, aktif: users.aktif,
        divisiAssigned: users.divisiAssigned, cabang: users.cabang,
      });
      if (gantiUsername) {
        for (const [tabel, kolom] of KOLOM_USERNAME) {
          await tx.execute(sql`UPDATE ${sql.identifier(tabel)} SET ${sql.identifier(kolom)} = ${usernameBaru} WHERE ${sql.identifier(kolom)} = ${lama.username}`);
        }
      }
      return u;
    });

    const berubah: string[] = [];
    if (gantiUsername) berubah.push(`username @${lama.username} -> @${usernameBaru}`);
    if (namaLengkap !== lama.namaLengkap) berubah.push(`nama "${namaLengkap}"`);
    if (role !== lama.role) berubah.push(`role ${lama.role} -> ${role}`);
    if (email !== lama.email) berubah.push(`email ${email ?? '-'}`);
    if (divisi !== lama.divisiAssigned) berubah.push(`divisi ${divisi}`);
    if (cabang !== lama.cabang) berubah.push(`cabang ${cabang}`);
    if (aktif !== lama.aktif) berubah.push(aktif ? 'diaktifkan' : 'dinonaktifkan');
    if (updateData.passwordHash) berubah.push('password diganti');

    const currentUser = (session.user as any)?.name || (session.user as any)?.username || 'Admin';
    await db.insert(logs).values({
      user: currentUser,
      aksi: 'UPDATE_USER',
      detail: `Mengubah akun @${lama.username}: ${berubah.length ? berubah.join(', ') : 'tidak ada perubahan'}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    // Administrator sebagai role utama atau role tambahan (dibaca segar dari DB)
    const authResult = await requireAuthRole(['Administrator']);
    if (!authResult.authorized) return authResult.response;
    const session = { user: authResult.user };

    const { username } = await params;

    // Jangan izinkan hapus akun sendiri
    if ((session.user as any)?.username === username) {
      return NextResponse.json(
        { success: false, message: 'Tidak dapat menghapus akun Anda sendiri' },
        { status: 400 }
      );
    }

    await db.delete(users).where(eq(users.username, username));

    const currentUser = (session.user as any)?.name || (session.user as any)?.username || 'Admin';
    await db.insert(logs).values({
      user: currentUser,
      aksi: 'HAPUS_USER',
      detail: `Menghapus pengguna: ${username}`,
    });

    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
