import type { Skema } from '@/api/client'
import { cn } from '@/lib/cn'

type WarnaRingkas = Pick<Skema['WarnaRingkas'], 'nama_warna' | 'kode_hex'>

/**
 * Warna tidak pernah disampaikan lewat warna saja (F-AK-01, WCAG 1.4.1): selalu ada nama dan kode heksadesimal.
 * Kotak warna diberi garis tepi agar warna terang (putih, krem) tetap terlihat.
 */
export function ChipWarna({
  warna,
  makna,
  ukuran = 'sedang',
  tampilkanKode = true,
  className,
}: {
  warna: WarnaRingkas
  makna?: string | null
  ukuran?: 'kecil' | 'sedang'
  tampilkanKode?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-start gap-2', className)}>
      <span
        aria-hidden
        className={cn('mt-0.5 shrink-0 rounded-full border border-black/15', ukuran === 'kecil' ? 'size-4' : 'size-6')}
        style={{ backgroundColor: warna.kode_hex }}
      />
      <span className="leading-tight">
        <span className="font-semibold">{warna.nama_warna}</span>
        {tampilkanKode && <span className="ms-1 font-mono text-[0.8em] opacity-80">{warna.kode_hex.toUpperCase()}</span>}
        {makna && <span className="block text-[0.85em] italic opacity-85">{makna}</span>}
      </span>
    </span>
  )
}

/** Ringkasan warna sebagai teks, mis. "Merah muda • Putih • Hijau". */
export function teksWarna(daftar: WarnaRingkas[]): string {
  return [...new Set(daftar.map((w) => w.nama_warna))].join(' • ')
}

export function DeretTitikWarna({ daftar, className }: { daftar: WarnaRingkas[]; className?: string }) {
  const unik = daftar.filter((w, i, a) => a.findIndex((x) => x.kode_hex === w.kode_hex) === i)
  return (
    <span aria-hidden className={cn('inline-flex -space-x-1', className)}>
      {unik.slice(0, 5).map((w) => (
        <span key={w.kode_hex} className="size-4 rounded-full border border-white/80 ring-1 ring-black/10" style={{ backgroundColor: w.kode_hex }} />
      ))}
    </span>
  )
}
