import type { ReactNode } from 'react'
import { Link } from 'react-router'

import fotoMasuk from '@/assets/gambar/foto-masuk.webp'
import garisBunga from '@/assets/gambar/garis-bunga.webp'
import mask from '@/assets/gambar/masker-gelombang.svg'
import bungaKecil from '@/assets/merek/bunga-kecil.svg'
import logo from '@/assets/merek/logo.svg'
import logoPutih from '@/assets/merek/logo-putih.svg'

/** Halaman masuk/daftar: panel foto bergelombang di layar lebar, panel ringkas di ponsel. */
export function TataLetakAuth({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-latar lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0"
          style={{ maskImage: `url("${mask}")`, maskSize: '100% 100%', WebkitMaskImage: `url("${mask}")`, WebkitMaskSize: '100% 100%' }}
        >
          <img src={fotoMasuk} alt="" className="size-full scale-105 object-cover blur-[5px]" />
        </div>
        <Link to="/" className="absolute start-[12%] top-1/2 w-[46%] -translate-y-1/2" aria-label="FlowerBloom, ke beranda">
          <img src={logoPutih} alt="" className="w-full" />
        </Link>
      </div>
      <main id="konten" className="relative flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <img src={garisBunga} alt="" aria-hidden className="pointer-events-none absolute end-0 bottom-0 h-3/4 opacity-15" />
        <Link to="/" className="mb-8 lg:hidden" aria-label="FlowerBloom, ke beranda">
          <img src={logo} alt="" className="h-9 w-auto" />
        </Link>
        <div className="relative w-full max-w-md">
          <img src={bungaKecil} alt="" aria-hidden className="mx-auto mb-3 size-10" />
          <h1 className="mb-8 text-center font-display text-4xl text-rose-teks md:text-5xl">{judul}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
