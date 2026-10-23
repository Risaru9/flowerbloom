import { useQueryClient } from '@tanstack/react-query'
import { Bell, Heart, LogOut, MapPin, Package, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'

import garisBunga from '@/assets/gambar/garis-bunga.webp'
import { hapusSesi, useSesi } from '@/auth/sesi'
import { cn } from '@/lib/cn'

const MENU = [
  { ke: '/akun', label: 'Informasi Profil', Ikon: UserRound, akhir: true },
  { ke: '/akun/pesanan', label: 'Pesanan Saya', Ikon: Package },
  { ke: '/akun/favorit', label: 'Produk Favorit', Ikon: Heart },
  { ke: '/akun/alamat', label: 'Alamat Tersimpan', Ikon: MapPin },
  { ke: '/akun/notifikasi', label: 'Notifikasi', Ikon: Bell },
]

export function useKeluar() {
  const qc = useQueryClient()
  const navigasi = useNavigate()
  return (ke = '/') => {
    hapusSesi()
    qc.clear()
    navigasi(ke, { replace: true })
  }
}

export function TataLetakAkun() {
  const sesi = useSesi()
  const keluar = useKeluar()
  return (
    <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[15rem_1fr] md:px-6 md:py-10">
      <img src={garisBunga} alt="" aria-hidden className="pointer-events-none absolute end-0 top-24 -z-10 hidden h-[28rem] opacity-25 lg:block" />
      <aside aria-label="Menu akun" className="md:sticky md:top-28 md:self-start">
        <div className="mb-3 hidden items-center gap-3 md:flex">
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-rose-teks font-display text-xl text-white">
            {sesi?.pengguna.nama.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-olive-tua">{sesi?.pengguna.nama}</span>
            <span className="block truncate text-xs text-redup">{sesi?.pengguna.email}</span>
          </span>
        </div>
        <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:rounded-3xl md:bg-blush/70 md:p-3 md:px-3">
          <ul className="flex gap-2 md:flex-col md:gap-1">
            {MENU.map(({ ke, label, Ikon, akhir }) => (
              <li key={ke} className="shrink-0">
                <NavLink
                  to={ke}
                  end={akhir}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors md:rounded-2xl',
                      isActive ? 'bg-rose-teks text-white' : 'bg-blush/70 text-olive-tua hover:bg-blush-2 md:bg-transparent',
                    )
                  }
                >
                  <Ikon aria-hidden className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
            <li className="shrink-0 md:mt-6">
              <button
                type="button"
                onClick={() => keluar()}
                className="flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold text-rose-teks hover:bg-blush-2 md:rounded-2xl"
              >
                <LogOut aria-hidden className="size-4" /> Keluar
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  )
}

export function JudulAkun({ judul, keterangan, aksi }: { judul: string; keterangan?: string; aksi?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl bg-blush/70 px-5 py-4">
      <h1 className="font-display text-2xl text-olive-tua md:text-3xl">{judul}</h1>
      {keterangan && (
        <p className="flex items-center gap-3 text-sm italic text-redup">
          <span aria-hidden className="hidden h-px w-8 bg-redup sm:block" />
          {keterangan}
        </p>
      )}
      {aksi && <div className="ms-auto">{aksi}</div>}
    </div>
  )
}
