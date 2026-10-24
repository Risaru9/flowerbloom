import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

import { cn } from '@/lib/cn'

type Varian = 'utama' | 'garis' | 'lembut' | 'teks' | 'bahaya' | 'admin' | 'admin-garis' | 'admin-lembut'
type Ukuran = 'kecil' | 'sedang' | 'besar' | 'ikon'

const VARIAN: Record<Varian, string> = {
  utama: 'bg-rose-teks text-atas-isian hover:bg-rose-tua shadow-sm',
  garis: 'border-2 border-rose-teks text-rose-teks hover:bg-blush bg-transparent',
  lembut: 'bg-blush text-rose-tua hover:bg-blush-2',
  teks: 'text-rose-teks hover:bg-blush/60 underline-offset-4 hover:underline',
  bahaya: 'bg-[#a01f1a] text-white hover:bg-[#7a1814]',
  admin: 'bg-ad-aksen text-white hover:opacity-90 shadow-sm',
  'admin-garis': 'border border-ad-garis bg-ad-permukaan text-ad-teks hover:bg-ad-latar',
  'admin-lembut': 'bg-ad-aksen-lembut text-ad-aksen hover:opacity-90',
}

const UKURAN: Record<Ukuran, string> = {
  kecil: 'min-h-9 px-3.5 text-sm gap-1.5',
  sedang: 'min-h-11 px-5 text-[0.95rem] gap-2',
  besar: 'min-h-12 px-7 text-base gap-2.5',
  ikon: 'size-11 justify-center p-0',
}

/** Target sentuh minimal 44×44 px (WCAG 2.5.5) untuk ukuran sedang ke atas. */
export function kelasTombol(varian: Varian = 'utama', ukuran: Ukuran = 'sedang', penuh = false) {
  return cn(
    'inline-flex items-center justify-center rounded-full font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
    VARIAN[varian],
    UKURAN[ukuran],
    penuh && 'w-full',
  )
}

interface PropsTombol extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: Varian
  ukuran?: Ukuran
  penuh?: boolean
  memuat?: boolean
  ikon?: ReactNode
}

export function Tombol({ varian, ukuran, penuh, memuat, ikon, className, children, disabled, type = 'button', ...sisa }: PropsTombol) {
  return (
    <button
      type={type}
      className={cn(kelasTombol(varian, ukuran, penuh), className)}
      disabled={disabled || memuat}
      aria-busy={memuat || undefined}
      {...sisa}
    >
      {memuat ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : ikon}
      {children}
    </button>
  )
}

interface PropsTautan extends LinkProps {
  varian?: Varian
  ukuran?: Ukuran
  penuh?: boolean
  ikon?: ReactNode
}

export function TautanTombol({ varian, ukuran, penuh, ikon, className, children, ...sisa }: PropsTautan) {
  return (
    <Link className={cn(kelasTombol(varian, ukuran, penuh), className)} {...sisa}>
      {ikon}
      {children}
    </Link>
  )
}
