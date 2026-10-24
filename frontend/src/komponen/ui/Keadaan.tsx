import { CircleAlert, Flower2, LoaderCircle, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { pesanGalat } from '@/api/client'
import { cn } from '@/lib/cn'

import { Tombol } from './Tombol'

export function Memuat({ teks = 'Memuat…', className }: { teks?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-3 py-12 text-redup', className)}>
      <LoaderCircle aria-hidden className="size-6 animate-spin" />
      <span>{teks}</span>
    </div>
  )
}

export function Kosong({
  judul,
  pesan,
  aksi,
  ikon,
  className,
}: {
  judul: string
  pesan?: ReactNode
  aksi?: ReactNode
  ikon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center', className)}>
      <span aria-hidden className="grid size-16 place-items-center rounded-full bg-blush text-rose-teks">
        {ikon ?? <Flower2 className="size-8" />}
      </span>
      <h2 className="font-display text-xl text-olive-tua">{judul}</h2>
      {pesan && <p className="max-w-md text-sm text-redup">{pesan}</p>}
      {aksi}
    </div>
  )
}

export function Galat({ galat, ulangi, className }: { galat: unknown; ulangi?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 rounded-3xl bg-[#fce8e7] px-6 py-10 text-center text-[#7a1814]', className)}
    >
      <CircleAlert aria-hidden className="size-8" />
      <p className="font-medium">{pesanGalat(galat)}</p>
      {ulangi && (
        <Tombol varian="garis" ukuran="kecil" onClick={ulangi} ikon={<RotateCw aria-hidden className="size-4" />}>
          Coba lagi
        </Tombol>
      )}
    </div>
  )
}

export function Kerangka({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-2xl bg-blush/70', className)} />
}
