// Daftar role fitur Setoran & panel penjualan dashboard (sisi klien; server tetap memeriksa sendiri).
export const SALES = ['Salesman', 'Sales Canvas', 'Sales Motoris', 'Admin Salesman', 'Staff Admin Salesman', 'Agen', 'Sales Agent', 'Admin Agen', 'Staff Admin Agen'];
export const PIMPINAN = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum'];
export const PANEL = [...PIMPINAN, 'Finance & Accounting', ...SALES];
/** Yang bisa menjual wajib setor ke Finance Pusat (= ROLES_POS). */
export const PENYETOR = [...PIMPINAN, 'Kepala Gudang', 'Wakil Gudang', 'Staff Gudang', ...SALES];
export const AKSES_SETORAN = [...PENYETOR, 'Finance & Accounting'];
