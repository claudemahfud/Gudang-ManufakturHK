// Daftar role untuk fitur Setoran Sales & panel penjualan dashboard (sisi klien; server tetap memeriksa sendiri).
export const SALES = ['Salesman', 'Sales Canvas', 'Sales Motoris', 'Admin Salesman', 'Staff Admin Salesman', 'Agen', 'Sales Agent', 'Admin Agen', 'Staff Admin Agen'];
export const FINANCE = ['Direktur Utama', 'Manager', 'Manager Umum', 'Finance & Accounting'];
export const PIMPINAN = ['Administrator', 'Direktur Utama', 'Manager', 'Manager Umum'];
export const PANEL = [...PIMPINAN, 'Finance & Accounting', ...SALES];
