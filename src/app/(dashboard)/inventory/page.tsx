import Inventory from '@/views/inventory';

// ============================================================
// APP PAGE: Inventory
// Route: /inventory
// ============================================================

export const metadata = {
  title: 'Master Barang | Gudang Manufaktur HK',
  description: 'Katalog stok barang dan manajemen master SKU inventaris',
};

export default function InventoryPage() {
  return <Inventory />;
}

