import MemuatProgres from '@/shared/components/ui/MemuatProgres';

// Tampil saat berpindah halaman di area dashboard
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <MemuatProgres teks="Memuat halaman..." />
    </div>
  );
}
