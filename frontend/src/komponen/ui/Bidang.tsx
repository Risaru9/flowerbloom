import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/cn'

type Gaya = 'pelanggan' | 'admin'

const KONTROL: Record<Gaya, string> = {
  pelanggan:
    'w-full rounded-2xl border-2 border-garis bg-permukaan px-4 py-2.5 text-olive-tua placeholder:text-redup ' +
    'focus:border-rose-teks focus:outline-none aria-[invalid=true]:border-[#a01f1a] disabled:opacity-60',
  admin:
    'w-full rounded-xl border border-ad-garis bg-ad-permukaan px-3.5 py-2.5 text-sm text-ad-teks placeholder:text-ad-redup ' +
    'focus:border-ad-aksen focus:outline-none aria-[invalid=true]:border-ad-bahaya disabled:opacity-60',
}

export const kelasKontrol = (gaya: Gaya = 'pelanggan') => KONTROL[gaya]

interface PropsBidang {
  label: ReactNode
  /** Satu elemen kontrol (Masukan, AreaTeks, Pilihan). id, aria-describedby, aria-invalid dipasang otomatis. */
  children: ReactElement<Record<string, unknown>>
  bantuan?: ReactNode
  galat?: string
  wajib?: boolean
  gaya?: Gaya
  className?: string
  labelTersembunyi?: boolean
}

/** Label, kontrol, teks bantuan, dan pesan galat yang terhubung lewat ARIA (WCAG 1.3.1, 3.3.1, 3.3.2). */
export function Bidang({ label, children, bantuan, galat, wajib, gaya = 'pelanggan', className, labelTersembunyi }: PropsBidang) {
  const idOtomatis = useId()
  const idAnak = isValidElement(children) ? (children.props as { id?: unknown }).id : undefined
  const id = typeof idAnak === 'string' && idAnak ? idAnak : idOtomatis
  const idBantuan = bantuan ? `${id}-bantuan` : undefined
  const idGalat = galat ? `${id}-galat` : undefined
  const deskripsi = [idBantuan, idGalat].filter(Boolean).join(' ') || undefined
  const kontrol = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': deskripsi,
        'aria-invalid': galat ? true : undefined,
        'aria-required': wajib || undefined,
      })
    : children
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className={cn(
          labelTersembunyi && 'sr-only',
          gaya === 'admin' ? 'text-sm font-semibold text-ad-teks' : 'text-sm font-semibold text-olive-tua',
        )}
      >
        {label}
        {wajib && (
          <span aria-hidden className="ms-0.5 text-[#a01f1a]">
            *
          </span>
        )}
      </label>
      {kontrol}
      {bantuan && (
        <p id={idBantuan} className={gaya === 'admin' ? 'text-xs text-ad-redup' : 'text-xs text-redup'}>
          {bantuan}
        </p>
      )}
      {galat && (
        <p id={idGalat} role="alert" className={gaya === 'admin' ? 'text-xs font-medium text-ad-bahaya' : 'text-xs font-medium text-[#a01f1a]'}>
          {galat}
        </p>
      )}
    </div>
  )
}

type PropsMasukan = InputHTMLAttributes<HTMLInputElement> & { gaya?: Gaya }
export const Masukan = forwardRef<HTMLInputElement, PropsMasukan>(function Masukan({ gaya, className, ...sisa }, ref) {
  return <input ref={ref} className={cn(kelasKontrol(gaya), className)} {...sisa} />
})

type PropsArea = TextareaHTMLAttributes<HTMLTextAreaElement> & { gaya?: Gaya }
export const AreaTeks = forwardRef<HTMLTextAreaElement, PropsArea>(function AreaTeks({ gaya, className, ...sisa }, ref) {
  return <textarea ref={ref} className={cn(kelasKontrol(gaya), 'min-h-24 resize-y', className)} {...sisa} />
})

type PropsPilihan = SelectHTMLAttributes<HTMLSelectElement> & { gaya?: Gaya }
export const Pilihan = forwardRef<HTMLSelectElement, PropsPilihan>(function Pilihan({ gaya, className, ...sisa }, ref) {
  return <select ref={ref} className={cn(kelasKontrol(gaya), 'appearance-auto pe-8', className)} {...sisa} />
})
