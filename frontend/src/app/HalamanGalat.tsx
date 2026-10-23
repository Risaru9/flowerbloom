import { Flower2, RotateCw } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { useJudul } from '@/komponen/ui/Lain'
import { kelasTombol, TautanTombol } from '@/komponen/ui/Tombol'

export function Halaman404() {
  useJudul('Halaman tidak ditemukan')
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-20 text-center">
      <span aria-hidden className="grid size-20 place-items-center rounded-full bg-blush text-rose-teks">
        <Flower2 className="size-10" />
      </span>
      <h1 className="font-display text-4xl text-rose-teks">Halaman tidak ditemukan</h1>
      <p className="text-redup">Tautan yang Anda buka mungkin sudah berubah. Yuk kembali melihat rangkaian bunga kami.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <TautanTombol to="/">Ke beranda</TautanTombol>
        <TautanTombol to="/katalog" varian="garis">
          Lihat katalog
        </TautanTombol>
      </div>
    </div>
  )
}

export function Halaman404Admin() {
  useJudul('Halaman tidak ditemukan')
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <Link to="/admin" className={kelasTombol('admin')}>
        Kembali ke dasbor
      </Link>
    </div>
  )
}

/** Batas galat rute: tampil bila sebuah halaman gagal dimuat (mis. potongan kode lama setelah pembaruan). */
export function HalamanGalatRute() {
  const galat = useRouteError()
  const pesan = isRouteErrorResponse(galat)
    ? `${galat.status} ${galat.statusText}`
    : galat instanceof Error
      ? galat.message
      : 'Terjadi kesalahan yang tidak terduga.'
  const potonganLama = /dynamically imported module|Failed to fetch|Importing a module script/i.test(pesan)
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-latar px-6 text-center">
      <h1 className="font-display text-3xl text-rose-teks">Ups, halaman gagal dimuat</h1>
      <p className="max-w-md text-redup">
        {potonganLama ? 'Aplikasi baru saja diperbarui. Muat ulang untuk memakai versi terbaru.' : pesan}
      </p>
      <button type="button" className={kelasTombol()} onClick={() => window.location.reload()}>
        <RotateCw aria-hidden className="size-4" /> Muat ulang
      </button>
    </main>
  )
}
