import { Accessibility, Flower2, House, LayoutGrid, Mail, MapPin, MessageCircle, Package, Phone, Search, ShoppingBag, UserRound } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'

import { bukaDialogAksesibilitas, tutupDialogAksesibilitas, useDialogAksesibilitasTerbuka } from '@/aksesibilitas/dialog'
import { DialogAksesibilitas } from '@/aksesibilitas/DialogAksesibilitas'
import garisBunga from '@/assets/gambar/garis-bunga.webp'
import logo from '@/assets/merek/logo.svg'
import logoFooter from '@/assets/merek/logo-footer.svg'
import { useSesi } from '@/auth/sesi'
import { jumlahBarang, useKeranjang } from '@/fitur/keranjang/keranjang'
import { Memuat } from '@/komponen/ui/Keadaan'
import { cn } from '@/lib/cn'
import { SpandukPasang, StatusJaringan, TombolPasang } from '@/pwa/KomponenPwa'

const TAHUN = new Date().getFullYear()

const MENU = [
  { ke: '/', label: 'Beranda', akhir: true },
  { ke: '/katalog', label: 'Katalog' },
  { ke: '/rangkai', label: 'Rangkai Sendiri' },
  { ke: '/tentang', label: 'Tentang Kami' },
]

function TombolIkon({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-rose-teks transition-colors hover:bg-blush"
    >
      {children}
    </button>
  )
}

function LencanaJumlah({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden
      className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-magenta px-1 text-[0.65rem] font-bold leading-5 text-white"
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function KepalaSitus() {
  const sesi = useSesi()
  const n = jumlahBarang(useKeranjang())
  return (
    <header className="sticky top-0 z-40 border-b border-garis/50 bg-latar/90 backdrop-blur supports-[backdrop-filter]:bg-latar/75 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:h-20 md:px-6">
        <Link to="/" className="shrink-0 rounded-lg" aria-label="FlowerBloom, ke beranda">
          <img src={logo} alt="" width={176} height={30} className="h-7 w-auto md:h-9" />
        </Link>
        <nav aria-label="Menu utama" className="mx-auto hidden md:block">
          <ul className="flex items-center gap-1 lg:gap-3">
            {MENU.map((m) => (
              <li key={m.ke}>
                <NavLink
                  to={m.ke}
                  end={m.akhir}
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-4 py-2 font-display text-lg transition-colors hover:bg-blush',
                      isActive ? 'font-bold text-rose-tua' : 'text-rose-teks',
                    )
                  }
                >
                  {m.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-0.5 md:ms-0">
          <Link to="/katalog?cari=" aria-label="Cari bunga" className="hidden size-11 place-items-center rounded-full text-rose-teks hover:bg-blush sm:grid">
            <Search aria-hidden className="size-6" />
          </Link>
          <TombolIkon label="Pengaturan aksesibilitas" onClick={bukaDialogAksesibilitas}>
            <Accessibility aria-hidden className="size-6" />
          </TombolIkon>
          <Link
            to="/keranjang"
            aria-label={`Keranjang, ${n} barang`}
            className="relative grid size-11 place-items-center rounded-full text-rose-teks hover:bg-blush"
          >
            <ShoppingBag aria-hidden className="size-6" />
            <LencanaJumlah n={n} />
          </Link>
          <Link
            to={sesi ? (sesi.pengguna.peran === 'admin' ? '/admin' : '/akun') : '/masuk'}
            aria-label={sesi ? `Akun ${sesi.pengguna.nama}` : 'Masuk'}
            className="hidden size-11 place-items-center rounded-full text-rose-teks hover:bg-blush md:grid"
          >
            <UserRound aria-hidden className="size-6" />
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Navigasi bawah untuk ponsel: target sentuh besar dan dekat jempol. */
function NavigasiBawah() {
  const sesi = useSesi()
  const item = [
    { ke: '/', label: 'Beranda', Ikon: House, akhir: true },
    { ke: '/katalog', label: 'Katalog', Ikon: LayoutGrid },
    { ke: '/rangkai', label: 'Rangkai', Ikon: Flower2 },
    { ke: '/akun/pesanan', label: 'Pesanan', Ikon: Package },
    { ke: sesi ? '/akun' : '/masuk', label: sesi ? 'Akun' : 'Masuk', Ikon: UserRound, akhir: true },
  ]
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-garis/60 bg-latar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {item.map(({ ke, label, Ikon, akhir }) => (
          <li key={label}>
            <NavLink
              to={ke}
              end={akhir}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition-colors',
                  isActive ? 'text-rose-tua' : 'text-redup',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', isActive && 'bg-blush')}>
                    <Ikon aria-hidden className="size-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function KakiSitus() {
  const kolom = [
    {
      judul: 'Jelajahi',
      tautan: [
        ['/', 'Beranda'],
        ['/katalog', 'Katalog'],
        ['/rangkai', 'Rangkai Sendiri'],
        ['/tentang', 'Tentang Kami'],
      ],
    },
    {
      judul: 'Bantuan',
      tautan: [
        ['/tentang#cara-pesan', 'Cara Pemesanan'],
        ['/akun/pesanan', 'Pesanan Saya'],
        ['/tentang#pertanyaan', 'Pertanyaan Umum'],
        ['/tentang#kontak', 'Hubungi Kami'],
      ],
    },
  ]
  return (
    <footer className="relative mt-16 overflow-hidden rounded-t-[2rem] bg-gradient-to-b from-peach from-40% to-garis text-olive">
      <img src={garisBunga} alt="" aria-hidden className="pointer-events-none absolute -end-6 bottom-0 h-72 opacity-20" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <div className="flex flex-col items-start gap-3">
          <img src={logoFooter} alt="FlowerBloom" width={180} height={134} className="h-28 w-auto" />
          <p className="max-w-60 font-display text-sm italic">Bunga penuh warna untuk setiap cerita dan momen berharga.</p>
          <TombolPasang varian="garis" />
        </div>
        {kolom.map((k) => (
          <nav key={k.judul} aria-label={k.judul}>
            <h2 className="font-display text-xl font-bold">{k.judul}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {k.tautan.map(([ke, label]) => (
                <li key={label}>
                  <Link to={ke!} className="rounded hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div id="kontak">
          <h2 className="font-display text-xl font-bold">Kontak</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <MapPin aria-hidden className="size-4" /> Surabaya, Indonesia
            </li>
            <li className="flex items-center gap-2">
              <Phone aria-hidden className="size-4" /> 08xx-xxxx-xxxx
            </li>
            <li className="flex items-center gap-2">
              <Mail aria-hidden className="size-4" />
              <a href="mailto:halo@flowerbloom.id" className="underline">
                halo@flowerbloom.id
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle aria-hidden className="size-4" /> WhatsApp: 08xx-xxxx-xxxx
            </li>
          </ul>
        </div>
      </div>
      <p className="relative bg-rose-teks/90 py-4 pb-[calc(1rem+4rem+env(safe-area-inset-bottom))] text-center text-sm text-white md:pb-4">
        © {TAHUN} FlowerBloom. Seluruh hak dilindungi.
      </p>
    </footer>
  )
}

export function TautanLewati() {
  return (
    <a
      href="#konten"
      className="sr-only-fokus fixed start-3 top-3 z-[80] rounded-full bg-olive-tua px-4 py-2 font-semibold text-latar"
    >
      Lewati ke konten utama
    </a>
  )
}

export function TataLetakPelanggan() {
  const aksesibilitas = useDialogAksesibilitasTerbuka()
  return (
    <div className="flex min-h-dvh flex-col">
      <TautanLewati />
      <StatusJaringan />
      <KepalaSitus />
      <main id="konten" tabIndex={-1} className="flex-1 pb-20 outline-none md:pb-0">
        <Suspense fallback={<Memuat />}>
          <Outlet />
        </Suspense>
      </main>
      <SpandukPasang />
      <KakiSitus />
      <NavigasiBawah />
      <DialogAksesibilitas terbuka={aksesibilitas} saatTutup={tutupDialogAksesibilitas} />
      <ScrollRestoration />
    </div>
  )
}
