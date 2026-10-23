import { Check, ImageUp } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import type { Skema } from '@/api/client'
import { cn } from '@/lib/cn'
import { sisaWaktu } from '@/lib/format'

export const UKURAN_MAKS_MB = 8

/** Garis waktu tahap pesanan; tahap aktif diumumkan sebagai langkah saat ini (aria-current="step"). */
export function Linimasa({ tahap, gaya = 'pelanggan' }: { tahap: Skema['TahapOut'][]; gaya?: 'pelanggan' | 'admin' }) {
  const admin = gaya === 'admin'
  return (
    <ol className="grid gap-3 sm:flex sm:gap-0">
      {tahap.map((t, i) => {
        const selesai = t.keadaan === 'selesai'
        const aktif = t.keadaan === 'aktif'
        return (
          <li key={t.kode} aria-current={aktif ? 'step' : undefined} className="relative flex items-start gap-3 sm:flex-1 sm:flex-col sm:items-center sm:text-center">
            {i < tahap.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute hidden h-0.5 sm:start-[calc(50%+1.25rem)] sm:end-[calc(-50%+1.25rem)] sm:top-5 sm:block',
                  selesai ? (admin ? 'bg-ad-aksen' : 'bg-rose-teks') : admin ? 'bg-ad-garis' : 'bg-garis',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-bold',
                selesai && (admin ? 'border-ad-aksen bg-ad-aksen text-white' : 'border-rose-teks bg-rose-teks text-white'),
                aktif && (admin ? 'border-ad-aksen bg-ad-aksen-lembut text-ad-aksen' : 'border-rose-teks bg-blush text-rose-tua'),
                !selesai && !aktif && (admin ? 'border-ad-garis bg-ad-permukaan text-ad-redup' : 'border-garis bg-permukaan text-redup'),
              )}
            >
              {selesai ? <Check className="size-5" /> : <span>{t.ikon}</span>}
            </span>
            <span className="sm:mt-2 sm:px-1">
              <span className={cn('block text-sm font-semibold', aktif ? (admin ? 'text-ad-aksen' : 'text-rose-tua') : '')}>
                {t.label}
                <span className="sr-only">{selesai ? ' (selesai)' : aktif ? ' (sedang berlangsung)' : ' (belum)'}</span>
              </span>
              {aktif && <span className={cn('block text-xs', admin ? 'text-ad-redup' : 'text-redup')}>{t.keterangan}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function HitungMundur({ batas, className }: { batas: string; className?: string }) {
  const [sekarang, setSekarang] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setSekarang(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const sisa = sisaWaktu(batas, sekarang)
  return (
    <span className={className} role="timer" aria-live="off">
      {sisa ?? 'Batas waktu sudah lewat'}
    </span>
  )
}

/** Unggah foto dengan pratinjau; di ponsel bisa langsung memotret (capture). */
export function UnggahFoto({
  label,
  berkas,
  ubah,
  galat,
  kamera = false,
  gaya = 'pelanggan',
}: {
  label: string
  berkas: File | null
  ubah: (f: File | null) => void
  galat?: string
  kamera?: boolean
  gaya?: 'pelanggan' | 'admin'
}) {
  const id = useId()
  const url = useMemo(() => (berkas ? URL.createObjectURL(berkas) : null), [berkas])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  const [galatLokal, setGalatLokal] = useState<string | null>(null)
  const admin = gaya === 'admin'
  const pesan = galat ?? galatLokal
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center',
          'focus-within:outline-3 focus-within:outline-offset-2',
          admin ? 'border-ad-garis bg-ad-latar focus-within:outline-ad-aksen' : 'border-garis bg-permukaan focus-within:outline-magenta',
        )}
      >
        {url ? (
          <img src={url} alt="Pratinjau foto yang dipilih" className="max-h-64 rounded-xl object-contain" />
        ) : (
          <ImageUp aria-hidden className={cn('size-9', admin ? 'text-ad-redup' : 'text-rose-teks')} />
        )}
        <span className="text-sm font-semibold">{berkas ? 'Ganti foto' : label}</span>
        <span className={cn('text-xs', admin ? 'text-ad-redup' : 'text-redup')}>JPG, PNG, atau WEBP, maksimal {UKURAN_MAKS_MB} MB</span>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture={kamera ? 'environment' : undefined}
          aria-invalid={pesan ? true : undefined}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            if (f && f.size > UKURAN_MAKS_MB * 1024 * 1024) {
              setGalatLokal(`Ukuran foto ${(f.size / 1048576).toFixed(1)} MB melebihi batas ${UKURAN_MAKS_MB} MB.`)
              ubah(null)
              return
            }
            setGalatLokal(null)
            ubah(f)
          }}
        />
      </label>
      {pesan && (
        <p role="alert" className={cn('text-xs font-medium', admin ? 'text-ad-bahaya' : 'text-[#a01f1a]')}>
          {pesan}
        </p>
      )}
    </div>
  )
}

export const LABEL_SERAH: Record<Skema['CaraSerahTerima'], string> = {
  ambil_di_toko: 'Ambil di toko',
  antar: 'Diantar kurir',
}
