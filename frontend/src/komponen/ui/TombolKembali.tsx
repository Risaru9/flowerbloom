import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

import { cn } from '@/lib/cn'

/**
 * Jalan keluar dari halaman masuk/daftar bagi pengunjung yang hanya ingin melihat-lihat.
 * Kembali ke halaman sebelumnya di aplikasi ini; bila halaman dibuka langsung (tidak ada riwayat
 * di aplikasi), menuju `cadangan` agar pengunjung tidak terlempar keluar situs.
 */
export function TombolKembali({ cadangan = '/', className }: { cadangan?: string; className?: string }) {
  const navigasi = useNavigate()
  function kembali() {
    // React Router menyimpan urutan entri riwayatnya di history.state.idx; 0 berarti entri pertama aplikasi.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) void navigasi(-1)
    else void navigasi(cadangan)
  }
  return (
    <button
      type="button"
      onClick={kembali}
      className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold', className)}
    >
      <ArrowLeft aria-hidden className="size-5" />
      Kembali
    </button>
  )
}
