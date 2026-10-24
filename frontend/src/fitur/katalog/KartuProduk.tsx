import { Heart } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'

import type { Skema } from '@/api/client'
import { pesanGalat } from '@/api/client'
import { useFavorit, useUbahFavorit } from '@/api/pelanggan'
import { useSesi } from '@/auth/sesi'
import { FotoBunga } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { DeretTitikWarna, teksWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'

type Produk = Skema['ProdukOut']

export const warnaProduk = (p: Produk) => p.komposisi.map((k) => k.warna)

export function TombolFavorit({ produk, className, denganTeks }: { produk: Produk; className?: string; denganTeks?: boolean }) {
  const sesi = useSesi()
  const pelanggan = sesi?.pengguna.peran === 'pelanggan'
  const { data: favorit } = useFavorit(pelanggan)
  const ubah = useUbahFavorit()
  const navigasi = useNavigate()
  const lokasi = useLocation()
  const disimpan = !!favorit?.some((f) => f.id_produk === produk.id_produk)

  function klik() {
    if (!pelanggan) {
      tampilkanToast('Masuk dulu untuk menyimpan produk favorit.', 'info')
      navigasi(`/masuk?kembali=${encodeURIComponent(lokasi.pathname)}`)
      return
    }
    ubah.mutate(
      { produk, simpan: !disimpan },
      {
        onSuccess: () => tampilkanToast(disimpan ? 'Dihapus dari favorit.' : 'Disimpan ke favorit.'),
        onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
      },
    )
  }

  return (
    <button
      type="button"
      onClick={klik}
      aria-pressed={disimpan}
      aria-label={
        denganTeks ? undefined : disimpan ? `Hapus ${produk.nama_produk} dari favorit` : `Simpan ${produk.nama_produk} ke favorit`
      }
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition-colors',
        denganTeks
          ? 'min-h-11 border-2 border-rose-teks px-5 font-semibold text-rose-teks hover:bg-blush'
          : 'size-11 bg-latar/90 text-rose-teks shadow-sm backdrop-blur hover:bg-latar',
        className,
      )}
    >
      <Heart aria-hidden className={cn('size-5', disimpan && 'fill-current')} />
      {denganTeks && (disimpan ? 'Tersimpan di favorit' : 'Simpan ke favorit')}
    </button>
  )
}

export function KartuProduk({ produk, prioritas }: { produk: Produk; prioritas?: boolean }) {
  const warna = warnaProduk(produk)
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl bg-permukaan shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-garis/50 transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-blush">
        <FotoBunga
          src={produk.foto_url}
          alt={`Foto ${produk.nama_produk}`}
          loading={prioritas ? 'eager' : 'lazy'}
          className="size-full transition-transform duration-300 group-hover:scale-105"
        />
        {!produk.dapat_dipesan && (
          <span className="absolute start-3 top-3 rounded-full bg-[#4f474b]/90 px-3 py-1 text-xs font-semibold text-white">
            Stok habis hari ini
          </span>
        )}
        <TombolFavorit produk={produk} className="absolute end-3 top-3 z-10" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {produk.acara && <p className="text-xs font-semibold tracking-wide text-redup uppercase">{produk.acara}</p>}
        <h3 className="font-display text-lg leading-snug text-olive-tua">
          <Link to={`/produk/${produk.id_produk}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {produk.nama_produk}
          </Link>
        </h3>
        <p className="flex items-center gap-2 text-sm text-redup">
          <DeretTitikWarna daftar={warna} />
          <span className="line-clamp-2">{teksWarna(warna)}</span>
        </p>
        <p className="mt-auto pt-1 text-base font-bold text-rose-teks">{formatRupiah(produk.harga)}</p>
      </div>
    </article>
  )
}

export function GridProduk({ daftar, className }: { daftar: Produk[]; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {daftar.map((p, i) => (
        <li
          key={p.id_produk}
          className="has-[:focus-visible]:rounded-3xl has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-magenta"
        >
          <KartuProduk produk={p} prioritas={i < 4} />
        </li>
      ))}
    </ul>
  )
}
