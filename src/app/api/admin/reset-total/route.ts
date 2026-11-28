import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/lib/db';
import { verifyPassword } from '@/shared/lib/auth/password';
import { BATAS_GAGAL, JENDELA_MS, superuserSaja, terkunci } from '@/shared/lib/keamanan-superuser';
import { ambilJatah, kembalikanJatah } from '@/shared/lib/auth/percobaan';

// ============================================================
// API: POST /api/admin/reset-total  { pin, konfirmasi: 'RESET TOTAL' }
// Menghapus SELURUH data aplikasi. Yang tersisa hanya:
//   - akun Superuser yang menjalankan (akun lain ikut terhapus)
//   - bagan akun (struktur COA, bila ada)
//   - cabang Pusat
//   - satu baris log RESET_TOTAL
// Syarat: Administrator sebagai role utama, PIN Reset Total (diatur di Profil),
// ketik konfirmasi persis. Salah PIN 5x dalam 15 menit = dikunci.
// ============================================================

const GAGAL = 'RESET_TOTAL_GAGAL';
const KONFIRMASI = 'RESET TOTAL';
// Tabel yang tidak dikosongkan seluruhnya (ditangani khusus di bawah)
const DIKECUALIKAN = new Set(['users', 'akun', 'master_cabang']);

export async function POST(req: Request) {
  const { galat, user } = await superuserSaja();
  if (galat) return galat;
  const body = await req.json().catch(() => ({}));
  if (body?.konfirmasi !== KONFIRMASI) {
    return NextResponse.json({ success: false, message: `Ketik "${KONFIRMASI}" untuk konfirmasi` }, { status: 400 });
  }
  if (!user.pinResetHash) {
    return NextResponse.json({ success: false, message: 'PIN Reset Total belum diatur. Atur di Setting Akun & Profil.' }, { status: 400 });
  }
  const pin = typeof body?.pin === 'string' ? body.pin : '';
  const jatah = await ambilJatah(user.username, GAGAL, BATAS_GAGAL, JENDELA_MS, 'PIN salah saat Reset Total');
  if (!jatah) return terkunci();
  const { ok } = await verifyPassword(pin, user.pinResetHash);
  if (!ok) {
    const { sisa } = jatah;
    return NextResponse.json(
      { success: false, message: sisa > 0 ? `PIN salah. Sisa ${sisa} percobaan.` : 'PIN salah. Reset Total dikunci 15 menit.' },
      { status: 401 }
    );
  }

  await kembalikanJatah(jatah.id);

  const tabel = (await db.execute(sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `)) as unknown as { tablename: string }[];
  const kosongkan = tabel.map((t) => t.tablename).filter((t) => !DIKECUALIKAN.has(t));

  await db.transaction(async (tx) => {
    if (kosongkan.length) {
      await tx.execute(sql.raw(`TRUNCATE ${kosongkan.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`));
    }
    await tx.execute(sql`DELETE FROM users WHERE id <> ${user.id}`);
    await tx.execute(sql`DELETE FROM master_cabang WHERE nama_cabang <> 'Pusat'`);
    await tx.execute(sql`
      INSERT INTO master_cabang (kode_cabang, nama_cabang, divisi, is_pusat, tipe, alamat)
      SELECT 'PST', 'Pusat', 'ALL', true, 'PUSAT', 'Kantor & Gudang Pusat' WHERE NOT EXISTS (SELECT 1 FROM master_cabang WHERE nama_cabang = 'Pusat')
    `);
    await tx.execute(sql`
      INSERT INTO logs ("user", aksi, detail)
      VALUES (${user.username}, 'RESET_TOTAL', ${`Reset Total oleh ${user.namaLengkap}: ${kosongkan.length} tabel dikosongkan, akun lain dihapus`})
    `);
  });

  return NextResponse.json({ success: true, message: 'Reset Total selesai. Semua data telah dihapus.', tabel: kosongkan.length });
}
