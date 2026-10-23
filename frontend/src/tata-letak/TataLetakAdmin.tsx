import {
  Bell,
  Boxes,
  ChartColumn,
  CircleUserRound,
  ClipboardList,
  Flower,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  ScanLine,
  ScanSearch,
  Search,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'

import { useDasbor } from '@/api/admin'
import bungaKecil from '@/assets/merek/bunga-kecil.svg'
import { useSesi } from '@/auth/sesi'
import { Memuat } from '@/komponen/ui/Keadaan'
import { cn } from '@/lib/cn'
import { StatusJaringan, TombolPasang } from '@/pwa/KomponenPwa'

import { useKeluar } from './TataLetakAkun'

interface ItemMenu {
  ke: string
  label: string
  Ikon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  akhir?: boolean
  lencana?: number
}

function useMenuAdmin(): { judul: string; item: ItemMenu[] }[] {
  const { data } = useDasbor()
  return [
    {
      judul: 'Operasional',
      item: [
        { ke: '/admin', label: 'Dasbor', Ikon: LayoutDashboard, akhir: true },
        { ke: '/admin/pesanan', label: 'Pesanan', Ikon: ClipboardList, lencana: data ? data.perlu_dirangkai : 0 },
        { ke: '/admin/pembayaran', label: 'Pembayaran', Ikon: Wallet, lencana: data?.perlu_verifikasi ?? 0 },
        { ke: '/admin/komplain', label: 'Komplain', Ikon: MessageSquareWarning, lencana: data?.komplain_baru ?? 0 },
      ],
    },
    {
      judul: 'Stok & katalog',
      item: [
        { ke: '/admin/stok', label: 'Daftar Stok', Ikon: Boxes, akhir: true, lencana: data?.stok_menipis.length ?? 0 },
        { ke: '/admin/stok/pindai', label: 'Pindai Stok Masuk', Ikon: ScanLine },
        { ke: '/admin/stok/riwayat', label: 'Riwayat Pindai', Ikon: ScanSearch },
        { ke: '/admin/katalog', label: 'Katalog Produk', Ikon: Flower },
      ],
    },
    {
      judul: 'Toko',
      item: [
        { ke: '/admin/laporan', label: 'Laporan', Ikon: ChartColumn },
        { ke: '/admin/pengaturan', label: 'Pengaturan Toko', Ikon: Settings },
        { ke: '/admin/akun', label: 'Akun Admin', Ikon: Users },
        { ke: '/admin/profil', label: 'Profil Saya', Ikon: CircleUserRound },
      ],
    },
  ]
}

function IsiSidebar({ saatPilih }: { saatPilih?: () => void }) {
  const menu = useMenuAdmin()
  const keluar = useKeluar()
  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" onClick={saatPilih} className="flex items-center gap-2.5 px-5 py-5">
        <img src={bungaKecil} alt="" className="size-8" />
        <span className="font-display text-xl font-bold text-ad-teks">
          FlowerBloom <span className="block font-admin text-xs font-medium text-ad-redup">Panel Admin</span>
        </span>
      </Link>
      <nav aria-label="Menu admin" className="flex-1 overflow-y-auto px-3 pb-4">
        {menu.map((grup) => (
          <div key={grup.judul} className="mb-4">
            <p className="px-3 pb-1.5 text-[0.7rem] font-bold tracking-wider text-ad-redup uppercase">{grup.judul}</p>
            <ul className="flex flex-col gap-0.5">
              {grup.item.map(({ ke, label, Ikon, akhir, lencana }) => (
                <li key={ke}>
                  <NavLink
                    to={ke}
                    end={akhir}
                    onClick={saatPilih}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
                        isActive ? 'bg-ad-aksen text-white' : 'text-ad-teks hover:bg-ad-aksen-lembut',
                      )
                    }
                  >
                    <Ikon aria-hidden className="size-[1.15rem]" />
                    <span className="flex-1">{label}</span>
                    {!!lencana && (
                      <span className="rounded-full bg-ad-peringatan-lembut px-2 py-0.5 text-xs font-bold text-ad-peringatan">
                        {lencana}
                        <span className="sr-only"> perlu tindakan</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-ad-garis p-3">
        <TombolPasang varian="admin-lembut" className="w-full" />
        <button
          type="button"
          onClick={() => keluar('/admin/masuk')}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ad-bahaya hover:bg-ad-bahaya-lembut"
        >
          <LogOut aria-hidden className="size-[1.15rem]" /> Keluar
        </button>
      </div>
    </div>
  )
}

function LaciMenu({ terbuka, tutup }: { terbuka: boolean; tutup: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (terbuka && !d.open) d.showModal?.()
    if (!terbuka && d.open) d.close?.()
  }, [terbuka])
  return (
    // Klik latar hanya kemudahan tetikus; papan ketik menutup lewat Esc (event cancel bawaan <dialog>).
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label="Menu admin"
      onCancel={(e) => {
        e.preventDefault()
        tutup()
      }}
      onClick={(e) => e.target === ref.current && tutup()}
      className="m-0 h-dvh max-h-none w-[min(20rem,86vw)] bg-ad-permukaan p-0 backdrop:bg-black/40"
    >
      {terbuka && (
        <>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup menu"
            className="absolute end-2 top-3 grid size-11 place-items-center rounded-full text-ad-teks hover:bg-ad-latar"
          >
            <X aria-hidden className="size-5" />
          </button>
          <IsiSidebar saatPilih={tutup} />
        </>
      )}
    </dialog>
  )
}

function Notifikasi() {
  const { data } = useDasbor()
  const [buka, setBuka] = useState(false)
  const item = data
    ? [
        { n: data.perlu_verifikasi, teks: 'pembayaran menunggu verifikasi', ke: '/admin/pembayaran' },
        { n: data.perlu_dirangkai, teks: 'pesanan siap dirangkai', ke: '/admin/pesanan?status=sedang_dirangkai' },
        { n: data.menunggu_persetujuan_foto, teks: 'foto menunggu persetujuan pelanggan', ke: '/admin/pesanan?status=menunggu_persetujuan_foto' },
        { n: data.perlu_pengembalian_dana, teks: 'pengembalian dana perlu diproses', ke: '/admin/pesanan?status=dibatalkan' },
        { n: data.komplain_baru, teks: 'komplain baru', ke: '/admin/komplain' },
        { n: data.stok_menipis.length, teks: 'jenis stok menipis', ke: '/admin/stok?menipis=1' },
      ].filter((i) => i.n > 0)
    : []
  const total = item.reduce((t, i) => t + i.n, 0)
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={buka}
        aria-label={`Notifikasi, ${total} perlu tindakan`}
        onClick={() => setBuka((b) => !b)}
        className="relative grid size-11 place-items-center rounded-full text-ad-teks hover:bg-ad-latar"
      >
        <Bell aria-hidden className="size-5" />
        {total > 0 && (
          <span aria-hidden className="absolute end-1 top-1 grid min-w-5 place-items-center rounded-full bg-ad-aksen px-1 text-[0.65rem] font-bold leading-5 text-white">
            {total}
          </span>
        )}
      </button>
      {buka && (
        <div className="absolute end-0 z-50 mt-2 w-80 rounded-2xl border border-ad-garis bg-ad-permukaan p-2 shadow-xl">
          <p className="px-3 py-2 text-sm font-bold">Perlu tindakan</p>
          {item.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-ad-redup">Semua beres. Tidak ada yang perlu ditindaklanjuti.</p>
          ) : (
            <ul>
              {item.map((i) => (
                <li key={i.teks}>
                  <Link to={i.ke} onClick={() => setBuka(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-ad-latar">
                    <span className="grid min-w-8 place-items-center rounded-lg bg-ad-aksen-lembut px-1.5 py-1 font-bold text-ad-aksen">{i.n}</span>
                    {i.teks}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function TataLetakAdmin() {
  const [laci, setLaci] = useState(false)
  const [cari, setCari] = useState('')
  const sesi = useSesi()
  const navigasi = useNavigate()
  const lokasi = useLocation()
  // Tutup laci saat pindah halaman (termasuk tombol kembali) tanpa efek: pola "simpan nilai sebelumnya".
  const [jalur, setJalur] = useState(lokasi.pathname)
  if (jalur !== lokasi.pathname) {
    setJalur(lokasi.pathname)
    setLaci(false)
  }
  return (
    <div data-area="admin" className="min-h-dvh bg-ad-latar font-admin text-ad-teks">
      <a href="#konten" className="sr-only-fokus fixed start-3 top-3 z-[80] rounded-lg bg-ad-teks px-4 py-2 text-sm font-semibold text-ad-permukaan">
        Lewati ke konten utama
      </a>
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-ad-garis bg-ad-permukaan lg:block">
        <IsiSidebar />
      </aside>
      <LaciMenu terbuka={laci} tutup={() => setLaci(false)} />
      <div className="lg:ps-64">
        <StatusJaringan />
        <header className="sticky top-0 z-20 border-b border-ad-garis bg-ad-permukaan/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-6">
            <button
              type="button"
              onClick={() => setLaci(true)}
              aria-label="Buka menu"
              className="grid size-11 place-items-center rounded-full hover:bg-ad-latar lg:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </button>
            <form
              role="search"
              className="relative max-w-md flex-1"
              onSubmit={(e) => {
                e.preventDefault()
                navigasi(`/admin/pesanan?cari=${encodeURIComponent(cari.trim())}`)
              }}
            >
              <label htmlFor="cari-admin" className="sr-only">
                Cari pesanan, pelanggan, atau produk
              </label>
              <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-redup" />
              <input
                id="cari-admin"
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari kode pesanan atau nama pelanggan…"
                className="h-11 w-full rounded-xl border border-ad-garis bg-ad-latar ps-9 pe-3 text-sm placeholder:text-ad-redup focus:border-ad-aksen focus:outline-none"
              />
            </form>
            <div className="ms-auto flex items-center gap-1">
              <Notifikasi />
              <Link to="/admin/profil" className="hidden items-center gap-2 rounded-full py-1 ps-1 pe-3 hover:bg-ad-latar sm:flex">
                <span aria-hidden className="grid size-9 place-items-center rounded-full bg-ad-aksen text-sm font-bold text-white">
                  {sesi?.pengguna.nama.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-semibold">{sesi?.pengguna.nama}</span>
              </Link>
            </div>
          </div>
        </header>
        <main id="konten" tabIndex={-1} className="mx-auto max-w-7xl px-3 py-6 outline-none sm:px-6 lg:py-8">
          <Suspense fallback={<Memuat />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export function JudulAdmin({ judul, keterangan, jejak, aksi }: { judul: string; keterangan?: string; jejak?: { ke: string; label: string }[]; aksi?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        {jejak && (
          <nav aria-label="Jejak navigasi" className="mb-1 text-xs text-ad-redup">
            <ol className="flex flex-wrap items-center gap-1">
              {jejak.map((j) => (
                <li key={j.ke} className="after:ms-1 after:content-['/']">
                  <Link to={j.ke} className="hover:underline">
                    {j.label}
                  </Link>
                </li>
              ))}
              <li aria-current="page" className="font-semibold text-ad-teks">
                {judul}
              </li>
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{judul}</h1>
        {keterangan && <p className="mt-1 text-sm text-ad-redup">{keterangan}</p>}
      </div>
      {aksi && <div className="flex flex-wrap gap-2">{aksi}</div>}
    </div>
  )
}

export function Kartu({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-ad-garis bg-ad-permukaan p-4 sm:p-5', className)}>{children}</section>
}
