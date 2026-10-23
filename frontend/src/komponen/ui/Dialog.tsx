import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface PropsDialog {
  terbuka: boolean
  saatTutup: () => void
  judul: ReactNode
  deskripsi?: ReactNode
  children: ReactNode
  kaki?: ReactNode
  gaya?: 'pelanggan' | 'admin'
  lebar?: 'sm' | 'md' | 'lg'
}

/**
 * Dialog modal memakai elemen <dialog> bawaan: perangkap fokus, Esc untuk menutup, dan fokus kembali ke
 * pemicu ditangani peramban. Di layar kecil tampil sebagai lembar bawah (bottom sheet).
 */
export function Dialog({ terbuka, saatTutup, judul, deskripsi, children, kaki, gaya = 'pelanggan', lebar = 'md' }: PropsDialog) {
  const ref = useRef<HTMLDialogElement>(null)
  const idJudul = useId()
  const idDeskripsi = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (terbuka && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    } else if (!terbuka && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [terbuka])

  const admin = gaya === 'admin'
  return (
    // Klik latar hanya kemudahan tetikus; papan ketik menutup lewat Esc (event cancel bawaan <dialog>).
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      aria-describedby={deskripsi ? idDeskripsi : undefined}
      onCancel={(e) => {
        e.preventDefault()
        saatTutup()
      }}
      onClick={(e) => {
        if (e.target === ref.current) saatTutup()
      }}
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-3xl p-0 backdrop:bg-black/45 sm:m-auto sm:rounded-3xl',
        lebar === 'sm' && 'sm:max-w-md',
        lebar === 'md' && 'sm:max-w-lg',
        lebar === 'lg' && 'sm:max-w-2xl',
        admin ? 'bg-ad-permukaan text-ad-teks' : 'bg-latar text-olive',
      )}
    >
      {terbuka && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className={cn('flex items-start gap-3 border-b px-5 pt-5 pb-4', admin ? 'border-ad-garis' : 'border-garis/60')}>
            <div className="min-w-0 flex-1">
              <h2 id={idJudul} className={admin ? 'text-lg font-bold' : 'font-display text-2xl text-rose-teks'}>
                {judul}
              </h2>
              {deskripsi && (
                <p id={idDeskripsi} className={cn('mt-1 text-sm', admin ? 'text-ad-redup' : 'text-redup')}>
                  {deskripsi}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={saatTutup}
              aria-label="Tutup"
              className={cn('-me-2 -mt-1 grid size-11 place-items-center rounded-full', admin ? 'hover:bg-ad-latar' : 'hover:bg-blush')}
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {kaki && (
            <div className={cn('flex flex-wrap justify-end gap-2 border-t px-5 py-4', admin ? 'border-ad-garis' : 'border-garis/60')}>
              {kaki}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
