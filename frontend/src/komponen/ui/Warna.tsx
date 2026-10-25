import { Palette } from 'lucide-react'

import type { Skema } from '@/api/client'
import { cn } from '@/lib/cn'
import { teksPerpaduan } from '@/lib/perpaduan'

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

/** Ringkasan warna sebagai teks bernama dan berkode (F-AK-01), mis. "Merah muda #FFC0CB • Putih #FFFFFF". */
export function teksWarna(daftar: WarnaRingkas[]): string {
  return [...new Set(daftar.map((w) => `${w.nama_warna} ${w.kode_hex.toUpperCase()}`))].join(' • ')
}

export function DeretTitikWarna({ daftar, className }: { daftar: WarnaRingkas[]; className?: string }) {
  const unik = daftar.filter((w, i, a) => a.findIndex((x) => x.kode_hex === w.kode_hex) === i)
  return (
    <span aria-hidden className={cn('inline-flex -space-x-1', className)}>
      {unik.slice(0, 5).map((w) => (
        <span
          key={w.kode_hex}
          className="size-4 rounded-full border border-white/80 ring-1 ring-black/10"
          style={{ backgroundColor: w.kode_hex }}
        />
      ))}
    </span>
  )
}

/** Saran perpaduan warna (F-PL-06); ``tersedia`` diisi bila pelanggan masih bisa menambah bunga. */
export function SaranPerpaduan({ daftar, tersedia, className }: { daftar: WarnaRingkas[]; tersedia?: WarnaRingkas[]; className?: string }) {
  const hasil = teksPerpaduan(daftar, tersedia)
  if (!hasil) return null
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-2xl px-3 py-2 text-sm',
        hasil.saran ? 'bg-[#fdf0dc] text-[#6b3a00]' : 'bg-[#e6f4ea] text-[#1d4a2a]',
        className,
      )}
    >
      <Palette aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong>Perpaduan warna:</strong> {hasil.teks}
      </span>
    </p>
  )
}
