import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { buatToko, useToko } from '@/lib/toko-kecil'

type Jenis = 'sukses' | 'galat' | 'info'
interface Toast {
  id: number
  jenis: Jenis
  pesan: string
  aksi?: AksiToast
}
interface AksiToast {
  label: string
  jalankan: () => void
}

const tokoToast = buatToko<Toast[]>([])
let urut = 0

export function tampilkanToast(pesan: string, jenis: Jenis = 'sukses', durasi = 4500, aksi?: AksiToast): void {
  const id = ++urut
  tokoToast.atur((t) => [...t.slice(-2), { id, jenis, pesan, aksi }])
  window.setTimeout(() => tutupToast(id), durasi)
}

export function tutupToast(id: number): void {
  tokoToast.atur((t) => t.filter((x) => x.id !== id))
}

const IKON = { sukses: CircleCheck, galat: CircleAlert, info: Info }
const WARNA: Record<Jenis, string> = {
  sukses: 'border-[#1d6631]/30 bg-[#e6f4ea] text-[#1d4a2a]',
  galat: 'border-[#a01f1a]/30 bg-[#fce8e7] text-[#7a1814]',
  info: 'border-[#1c4c9c]/30 bg-[#e7eefb] text-[#1c3a6e]',
}

/** Wilayah live polite: pembaca layar mengumumkan toast tanpa memindahkan fokus. */
export function PenampungToast() {
  const daftar = useToko(tokoToast)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:end-5 sm:bottom-5 sm:items-end"
    >
      {daftar.map((t) => {
        const Ikon = IKON[t.jenis]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg',
              WARNA[t.jenis],
            )}
          >
            <Ikon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p className="flex-1 font-medium">{t.pesan}</p>
            {t.aksi && (
              <button
                type="button"
                onClick={() => {
                  t.aksi!.jalankan()
                  tutupToast(t.id)
                }}
                className="-my-1 rounded-full px-2 py-1 font-bold underline hover:no-underline"
              >
                {t.aksi.label}
              </button>
            )}
            <button type="button" onClick={() => tutupToast(t.id)} aria-label="Tutup pemberitahuan" className="-m-1 rounded-full p-1">
              <X aria-hidden className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
