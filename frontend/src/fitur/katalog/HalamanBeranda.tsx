import {
  ArrowRight,
  BadgeCheck,
  Cake,
  Flower,
  Flower2,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  Palette,
  Sparkles,
  Truck,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'

import { bukaDialogAksesibilitas } from '@/aksesibilitas/dialog'
import { useAcara, useProduk } from '@/api/pelanggan'
import bungaWarnaWarni from '@/assets/gambar/bunga-warna-warni.webp'
import floristTersenyum from '@/assets/gambar/florist-tersenyum.webp'
import garisBunga from '@/assets/gambar/garis-bunga.webp'
import heroKotak from '@/assets/gambar/hero-kotak-bunga.webp'
import katBuket from '@/assets/gambar/kategori-buket.webp'
import katKotak from '@/assets/gambar/kategori-kotak.webp'
import katMeja from '@/assets/gambar/kategori-meja.webp'
import katRangkai from '@/assets/gambar/kategori-rangkai.webp'
import rakBunga from '@/assets/gambar/rak-bunga.webp'
import { Galat, Kerangka } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { kelasTombol, TautanTombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'

import { GridProduk } from './KartuProduk'

const KEUNGGULAN: [LucideIcon, string, string][] = [
  [Truck, 'Tepat Waktu', 'Dikirim sesuai jadwal'],
  [Flower2, 'Bunga Segar', 'Dipilih di hari pengiriman'],
  [BadgeCheck, 'Floris Ahli', 'Dirangkai profesional'],
  [Palette, 'Info Warna', 'Nama dan makna jelas'],
]

const KATEGORI = [
  { judul: 'Buket Bunga', ket: 'Untuk digenggam dan diberikan langsung', gambar: katBuket, ke: '/katalog?cari=buket' },
  { judul: 'Bunga dalam Kotak', ket: 'Rapi, awet, siap dikirim', gambar: katKotak, ke: '/katalog?cari=kotak' },
  { judul: 'Rangkaian Meja', ket: 'Penghias ruang dan acara', gambar: katMeja, ke: '/katalog?cari=meja' },
  { judul: 'Rangkai Sendiri', ket: 'Pilih bunga dan warnamu', gambar: katRangkai, ke: '/rangkai' },
]

const IKON_ACARA: [RegExp, LucideIcon][] = [
  [/ulang\s*tahun|birthday/i, Cake],
  [/hari\s*jadi|anniversary|cinta|valentine/i, Heart],
  [/nikah|wedding/i, Gem],
  [/wisuda|graduation|lulus/i, GraduationCap],
  [/hadiah|kado/i, Gift],
  [/duka|simpati/i, Flower],
]
const ikonAcara = (acara: string) => IKON_ACARA.find(([pola]) => pola.test(acara))?.[1] ?? Sparkles

function JudulBagian({ judul, ke, teksTautan }: { judul: string; ke?: string; teksTautan?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-display text-3xl text-olive-tua md:text-4xl">{judul}</h2>
      {ke && (
        <Link to={ke} className="inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-rose-teks hover:underline">
          {teksTautan ?? 'Lihat semua'} <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  )
}

export function HalamanBeranda() {
  useJudul('')
  const produk = useProduk()
  const acara = useAcara()

  return (
    <>
      {/* Pahlawan */}
      <section className="relative overflow-hidden bg-gradient-to-br from-peach via-blush to-latar">
        <img src={garisBunga} alt="" aria-hidden className="pointer-events-none absolute -start-10 top-0 h-full opacity-20" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pt-8 pb-12 md:grid-cols-2 md:px-6 md:pt-12 md:pb-20">
          <div className="order-2 md:order-1">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-latar/80 px-3 py-1 text-xs font-semibold text-rose-teks">
              <Palette aria-hidden className="size-4" /> Toko bunga ramah buta warna
            </p>
            <h1 className="font-display text-[2.6rem] leading-[1.05] text-olive-tua sm:text-5xl lg:text-6xl">Cerita Dalam Setiap Rangkaian</h1>
            <p className="mt-4 max-w-lg text-lg text-olive">
              Temukan rangkaian bunga dengan <strong>nama warna, kode warna, dan makna</strong> yang jelas untuk setiap momen.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <TautanTombol to="/katalog" ukuran="besar" ikon={<ArrowRight aria-hidden className="order-last size-5" />}>
                Belanja sekarang
              </TautanTombol>
              <TautanTombol to="/rangkai" ukuran="besar" varian="garis">
                Rangkai sendiri
              </TautanTombol>
            </div>
          </div>
          <div className="relative order-1 md:order-2">
            <div aria-hidden className="absolute inset-[8%] rounded-full bg-latar/60 blur-3xl" />
            <img
              src={heroKotak}
              alt="Kotak bunga FlowerBloom berisi mawar merah muda, ranunculus putih, dan baby's breath"
              width={1000}
              height={971}
              fetchPriority="high"
              className="relative mx-auto w-full max-w-md drop-shadow-xl md:max-w-none"
            />
          </div>
        </div>
      </section>

      {/* Keunggulan */}
      <section aria-label="Keunggulan FlowerBloom" className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 md:px-6">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-rose-teks/20 shadow-lg md:grid-cols-4">
          {KEUNGGULAN.map(([Ikon, judul, ket]) => (
            <li key={judul} className="flex items-center gap-3 bg-rose-teks p-4 text-white md:p-6">
              <Ikon aria-hidden className="size-7 shrink-0 md:size-9" />
              <span>
                <span className="block font-display text-lg md:text-xl">{judul}</span>
                <span className="block text-xs text-white/90 md:text-sm">{ket}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pt-14 md:px-6">
        {/* Kategori */}
        <section>
          <JudulBagian judul="Rangkaian Pilihan untukmu" ke="/katalog" teksTautan="Lihat selengkapnya" />
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {KATEGORI.map((k) => (
              <li key={k.judul} className="w-[70%] shrink-0 snap-start sm:w-[45%] md:w-auto">
                <Link to={k.ke} className="group relative block overflow-hidden rounded-3xl bg-peach">
                  <img src={k.gambar} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-rose-tua/90 to-transparent p-4 pt-12 text-white">
                    <span>
                      <span className="block font-display text-xl">{k.judul}</span>
                      <span className="block text-xs text-white/90">{k.ket}</span>
                    </span>
                    <ArrowRight aria-hidden className="size-5 shrink-0" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Produk unggulan */}
        <section aria-labelledby="judul-unggulan">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="judul-unggulan" className="font-display text-3xl text-olive-tua md:text-4xl">
              Paling Dicari
            </h2>
            <Link to="/katalog" className="inline-flex items-center gap-2 text-sm font-semibold text-rose-teks hover:underline">
              Semua produk <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          {produk.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Kerangka key={i} className="aspect-[3/4]" />
              ))}
            </div>
          ) : produk.isError ? (
            <Galat galat={produk.error} ulangi={() => void produk.refetch()} />
          ) : (
            <GridProduk daftar={produk.data.slice(0, 8)} />
          )}
        </section>

        {/* Cerita */}
        <section className="grid overflow-hidden rounded-[2rem] bg-blush md:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col justify-center gap-4 p-7 md:p-12">
            <h2 className="font-display text-3xl text-rose-tua md:text-4xl">Bunga yang Menyampaikan Perasaan</h2>
            <p className="text-olive">
              Setiap rangkaian dibuat dengan bunga segar dan dilengkapi informasi jenis, nama warna, serta maknanya, sehingga Anda yakin
              dengan pilihan Anda.
            </p>
            <TautanTombol to="/tentang" varian="garis" className="self-start" ikon={<ArrowRight aria-hidden className="order-last size-4" />}>
              Tentang kami
            </TautanTombol>
          </div>
          <img src={floristTersenyum} alt="Florist FlowerBloom sedang merangkai bunga" loading="lazy" className="h-64 w-full object-cover md:h-full" />
        </section>

        {/* Momen */}
        {!!acara.data?.length && (
          <section aria-labelledby="judul-momen">
            <h2 id="judul-momen" className="mb-5 font-display text-3xl text-olive-tua md:text-4xl">
              Pilih Berdasarkan Momen
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {acara.data.map((a) => {
                const Ikon = ikonAcara(a)
                return (
                  <li key={a}>
                    <Link
                      to={`/katalog?acara=${encodeURIComponent(a)}`}
                      className="flex h-full flex-col items-center gap-2 rounded-3xl bg-permukaan px-2 py-5 text-center ring-1 ring-garis/60 transition-colors hover:bg-blush"
                    >
                      <Ikon aria-hidden className="size-8 text-rose-teks" />
                      <span className="text-xs font-bold tracking-wide text-olive-tua uppercase">{a}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Rangkai sendiri */}
        <section className="relative grid overflow-hidden rounded-[2rem] bg-latar-2 md:grid-cols-2">
          <img src={rakBunga} alt="Rak penuh bunga segar aneka warna di toko" loading="lazy" className="h-60 w-full object-cover md:h-full" />
          <div className="flex flex-col justify-center gap-4 p-7 md:p-12 md:text-end">
            <h2 className="font-display text-3xl text-rose-teks md:text-4xl">Rangkai Sesukamu</h2>
            <p className="text-olive">
              Pilih jenis bunga, warna, dan jumlah tangkai sesuai keinginanmu. Setiap pilihan menampilkan nama dan kode warnanya.
            </p>
            <ol className="flex flex-wrap gap-2 text-xs font-semibold text-olive-tua md:justify-end">
              {['Pilih bunga', 'Atur jumlah', 'Pesan'].map((l, i) => (
                <li key={l} className="rounded-full bg-latar px-3 py-1">
                  {i + 1}. {l}
                </li>
              ))}
            </ol>
            <TautanTombol to="/rangkai" className="self-start md:self-end" ikon={<ArrowRight aria-hidden className="order-last size-4" />}>
              Mulai merangkai
            </TautanTombol>
          </div>
        </section>

        {/* Aksesibilitas */}
        <section className="grid overflow-hidden rounded-[2rem] bg-rose-teks text-white md:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-5 p-7 md:p-12">
            <h2 className="font-display text-3xl md:text-4xl">Warna Lebih Mudah Dipahami</h2>
            <p className="text-white/95">
              Kenali setiap bunga melalui nama warna, kode warna, makna, dan deskripsi suara, tanpa harus mengandalkan penglihatan warna.
            </p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                [Palette, 'Nama warna', 'Selalu ditampilkan dalam teks'],
                [Volume2, 'Deskripsi suara', 'Informasi bunga dapat didengar'],
                [Sparkles, 'Tampilan adaptif', 'Penajaman sesuai jenis buta warna'],
              ].map(([Ikon, judul, ket]) => {
                const I = Ikon as LucideIcon
                return (
                  <li key={judul as string} className="rounded-2xl bg-latar p-3 text-olive-tua">
                    <I aria-hidden className="mb-1 size-5 text-rose-teks" />
                    <span className="block font-display font-semibold">{judul as string}</span>
                    <span className="block text-xs text-redup">{ket as string}</span>
                  </li>
                )
              })}
            </ul>
            <button type="button" onClick={bukaDialogAksesibilitas} className={cn(kelasTombol('lembut'), 'self-start')}>
              Atur aksesibilitas <ArrowRight aria-hidden className="size-4" />
            </button>
          </div>
          <img src={bungaWarnaWarni} alt="Lili putih, mawar merah, mawar merah muda, gerbera kuning, dan anyelir peach" loading="lazy" className="h-60 w-full object-cover md:h-full" />
        </section>
      </div>
    </>
  )
}
