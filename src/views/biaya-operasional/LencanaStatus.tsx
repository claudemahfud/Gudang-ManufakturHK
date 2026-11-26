import { labelStatus, type StatusBiaya, type SumberBiaya } from '@/shared/lib/biaya-aturan';

const KELAS: Record<StatusBiaya, string> = {
  menunggu: 'bg-amber-50 text-amber-800',
  disetujui: 'bg-emerald-50 text-emerald-800',
  dibayar: 'bg-emerald-100 text-emerald-900',
  ditolak: 'bg-red-50 text-red-700',
  dibatalkan: 'bg-gray-100 text-gray-600',
};

export default function LencanaStatus({ status, sumber }: { status: StatusBiaya; sumber: SumberBiaya }) {
  const kelas = status === 'disetujui' && sumber === 'pribadi' ? 'bg-blue-50 text-blue-800' : KELAS[status];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${kelas}`}>{labelStatus(status, sumber)}</span>;
}
