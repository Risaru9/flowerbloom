import { ChevronLeft, ChevronRight, Flower2, Minus, Pause, Plus, Volume2 } from 'lucide-react'
import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'

import type { Skema } from '@/api/client'
import { useAksesibilitas } from '@/aksesibilitas/pengaturan'
import { useBacakan } from '@/aksesibilitas/suara'
import { cn } from '@/lib/cn'

/** Mengatur <title> dokumen agar pembaca layar mengumumkan halaman baru (WCAG 2.4.2). */
export function useJudul(judul: string): void {
  useEffect(() => {
    document.title = judul ? `${judul} · FlowerBloom` : 'FlowerBloom'
  }, [judul])
}

export function TombolDengarkan({ teks, label = 'Dengarkan deskripsi', className }: { teks: string; label?: string; className?: string }) {
  const { berbicara, mulai, berhenti, tersedia } = useBacakan()
  const { suara_aktif } = useAksesibilitas()
  if (!tersedia || !suara_aktif) return null
  return (
    <button
      type="button"
      onClick={() => (berbicara ? berhenti() : mulai(teks))}
      aria-pressed={berbicara}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full bg-olive px-4 text-sm font-semibold text-latar hover:bg-olive-tua',
        className,
      )}
    >
      {berbicara ? <Pause aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
      {berbicara ? 'Hentikan suara' : label}
    </button>
  )
}

const NADA_STATUS: Record<Skema['StatusPesanan'], string> = {
  menunggu_pembayaran: 'bg-[#fdf0dc] text-[#6b3a00] border-[#8a4b00]/30',
  menunggu_verifikasi: 'bg-[#e7eefb] text-[#1c3a6e] border-[#1c4c9c]/30',
  sedang_dirangkai: 'bg-[#efe7fa] text-[#3f1d70] border-[#5a2b9c]/30',
  menunggu_persetujuan_foto: 'bg-[#fde7ee] text-[#9c1f4e] border-[#c71f58]/30',
  siap_diambil: 'bg-[#e6f4ea] text-[#1d4a2a] border-[#1d6631]/30',
  diantar: 'bg-[#e6f4ea] text-[#1d4a2a] border-[#1d6631]/30',
  selesai: 'bg-[#e6f4ea] text-[#1d4a2a] border-[#1d6631]/30',
  dibatalkan: 'bg-[#f1ecee] text-[#4f474b] border-[#4f474b]/30',
}

/** Status selalu tampil sebagai ikon + teks, tidak hanya warna (F-AK-02). */
export function LencanaStatus({ status, className }: { status: Skema['StatusInfoOut']; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', NADA_STATUS[status.kode], className)}
      title={status.keterangan}
    >
      <span aria-hidden>{status.ikon}</span>
      {status.label}
    </span>
  )
}

export function Paginasi({
  halaman,
  total,
  perHalaman,
  ubah,
  gaya = 'pelanggan',
}: {
  halaman: number
  total: number
  perHalaman: number
  ubah: (h: number) => void
  gaya?: 'pelanggan' | 'admin'
}) {
  const jumlah = Math.max(1, Math.ceil(total / perHalaman))
  if (jumlah <= 1) return null
  const kelas =
    gaya === 'admin'
      ? 'grid size-10 place-items-center rounded-xl border border-ad-garis bg-ad-permukaan disabled:opacity-40'
      : 'grid size-11 place-items-center rounded-full bg-blush text-rose-tua disabled:opacity-40'
  return (
    <nav aria-label="Navigasi halaman" className="flex items-center justify-center gap-3 py-4">
      <button type="button" className={kelas} disabled={halaman <= 1} onClick={() => ubah(halaman - 1)} aria-label="Halaman sebelumnya">
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <span className="text-sm" aria-live="polite">
        Halaman <strong>{halaman}</strong> dari {jumlah}
      </span>
      <button type="button" className={kelas} disabled={halaman >= jumlah} onClick={() => ubah(halaman + 1)} aria-label="Halaman berikutnya">
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </nav>
  )
}

export function PengaturJumlah({
  nilai,
  ubah,
  min = 1,
  maks = 99,
  label,
}: {
  nilai: number
  ubah: (n: number) => void
  min?: number
  maks?: number
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-full bg-blush p-1">
      <button
        type="button"
        onClick={() => ubah(Math.max(min, nilai - 1))}
        disabled={nilai <= min}
        aria-label={`Kurangi ${label.toLowerCase()}`}
        className="grid size-9 place-items-center rounded-full text-rose-tua hover:bg-blush-2 disabled:opacity-40"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <output aria-live="polite" className="min-w-8 text-center font-semibold text-olive-tua">
        {nilai}
      </output>
      <button
        type="button"
        onClick={() => ubah(Math.min(maks, nilai + 1))}
        disabled={nilai >= maks}
        aria-label={`Tambah ${label.toLowerCase()}`}
        className="grid size-9 place-items-center rounded-full text-rose-tua hover:bg-blush-2 disabled:opacity-40"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  )
}

/** Foto bunga: diberi data-foto-bunga agar filter penajaman warna berlaku, dimuat lambat, ada cadangan bila kosong/gagal. */
export function FotoBunga({
  src,
  alt,
  className,
  ...sisa
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null }) {
  const [gagal, setGagal] = useState(false)
  if (!src || gagal) {
    return (
      <div role="img" aria-label={alt} className={cn('grid place-items-center bg-blush text-rose', className)}>
        <Flower2 aria-hidden className="size-1/3 max-h-16 max-w-16" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      data-foto-bunga=""
      loading="lazy"
      decoding="async"
      onError={() => setGagal(true)}
      className={cn('object-cover', className)}
      {...sisa}
    />
  )
}

export function Sakelar({
  nyala,
  ubah,
  label,
  keterangan,
  ikon,
}: {
  nyala: boolean
  ubah: (v: boolean) => void
  label: string
  keterangan?: string
  ikon?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-garis bg-permukaan px-4 py-3">
      {ikon && <span aria-hidden className="text-rose-teks">{ikon}</span>}
      <span className="flex-1">
        <span className="block font-semibold text-olive-tua">{label}</span>
        {keterangan && <span className="block text-xs text-redup">{keterangan}</span>}
      </span>
      <input type="checkbox" role="switch" aria-checked={nyala} checked={nyala} onChange={(e) => ubah(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-garis transition-colors peer-checked:bg-rose-teks peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-magenta after:absolute after:start-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  )
}
