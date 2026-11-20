import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { inventory, resepItems, logs } from '@/shared/lib/db/schema';
import { requireAuthRole, ROLES_RECIPE_BOM } from '@/shared/lib/auth/rbac';
import { eq } from 'drizzle-orm';

// ============================================================
// API: /api/fnb/hpp
// Kalkulator HPP & Resep (BOM) — F&B & Manufaktur Terpadu
// Hak Akses: Administrator, Direktur Utama, Manager, Kepala Gudang
// ============================================================

export async function GET() {
  try {
    const authResult = await requireAuthRole(ROLES_RECIPE_BOM);
    if (!authResult.authorized) return authResult.response;

    // Ambil semua menu olahan atau produk yang memiliki resep
    const items = await db.select().from(inventory);
    const allResep = await db.select().from(resepItems);

    // Hitung HPP untuk tiap item berdasarkan resepnya
    const calculated = items.map((item) => {
      const itemRecipes = allResep.filter((r) => r.menuSku === item.sku);

      let hppBahan = 0;
      let biayaKemasan = 0;

      for (const r of itemRecipes) {
        // Cari harga beli per satuan dari bahan baku
        const bahanMaster = items.find((i) => i.sku === r.bahanSku);
        const hargaBeliPerUnit = Number(bahanMaster?.hargaBeli || 0);
        const biayaKomponen = Number(r.takaran) * hargaBeliPerUnit;

        if (r.jenis === 'kemasan') {
          biayaKemasan += biayaKomponen;
        } else {
          hppBahan += biayaKomponen;
        }
      }

      // Overhead standar F&B / Manufaktur
      const persenSusut = 0.03;      // 3% waste
      const persenUtilitas = 0.05;   // 5% listrik/air/gas
      const persenTenagaKerja = 0.07;// 7% upah produksi
      
      const biayaSusut = hppBahan * persenSusut;
      const biayaUtilitas = hppBahan * persenUtilitas;
      const biayaTenagaKerja = hppBahan * persenTenagaKerja;

      // Jika item tidak punya resep, gunakan hargaBeli langsung sebagai HPP dasar
      const hppTotal =
        itemRecipes.length > 0
          ? hppBahan + biayaKemasan + biayaSusut + biayaUtilitas + biayaTenagaKerja
          : Number(item.hargaBeli || 0);

      const hargaJual = Number(item.hargaJual || 0);
      const marginRupiah = hargaJual - hppTotal;
      const marginPersen = hargaJual > 0 ? (marginRupiah / hargaJual) * 100 : 0;
      const foodCostPersen = hargaJual > 0 ? (hppTotal / hargaJual) * 100 : 0;

      // Rekomendasi harga ideal
      // Target Food Cost 35% -> Harga = HPP / 0.35
      const hargaIdealMargin65 = hppTotal > 0 ? Math.round(hppTotal / 0.35) : 0;
      // Markup 150% -> Harga = HPP * 2.5
      const hargaIdealMarkup = hppTotal > 0 ? Math.round(hppTotal * 2.5) : 0;

      return {
        ...item,
        resepCount: itemRecipes.length,
        recipes: itemRecipes,
        breakdown: {
          hppBahan,
          biayaKemasan,
          biayaSusut,
          biayaUtilitas,
          biayaTenagaKerja,
          hppTotal,
        },
        evaluasi: {
          hargaJual,
          hppTotal,
          marginRupiah,
          marginPersen: Number(marginPersen.toFixed(1)),
          foodCostPersen: Number(foodCostPersen.toFixed(1)),
          marginTipis: foodCostPersen > 40, // Warning jika modal > 40%
        },
        rekomendasi: {
          hargaIdealMargin65,
          hargaIdealMarkup,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: calculated,
      rawMaterials: items.filter((i) => i.tipeItem === 'bahan_baku' || i.tipeItem === 'kemasan' || i.divisi === 'FNB'),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_RECIPE_BOM);
    if (!authResult.authorized) return authResult.response;

    const body = await req.json();
    const { menuSku, bahanSku, namaBahan, takaran, satuan, jenis } = body;

    if (!menuSku || !bahanSku || !takaran) {
      return NextResponse.json(
        { success: false, message: 'Menu SKU, Bahan SKU, dan Takaran wajib diisi' },
        { status: 400 }
      );
    }

    const [row] = await db
      .insert(resepItems)
      .values({
        menuSku,
        bahanSku,
        namaBahan,
        takaran: String(takaran),
        satuan: satuan || 'gram',
        jenis: jenis || 'bahan',
      })
      .returning();

    return NextResponse.json({ success: true, data: row });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuthRole(ROLES_RECIPE_BOM);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID komponen resep wajib disertakan' }, { status: 400 });
    }

    await db.delete(resepItems).where(eq(resepItems.id, id));

    const user = authResult.user?.name || authResult.user?.username || 'System';
    await db.insert(logs).values({
      user,
      aksi: 'HAPUS_KOMPONEN_RESEP',
      detail: `Menghapus komponen resep ID: ${id}`,
    });

    return NextResponse.json({ success: true, message: 'Komponen resep berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
