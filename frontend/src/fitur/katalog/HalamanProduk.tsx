import { CalendarClock, Camera, ChevronLeft, Leaf, ShoppingBag, Truck } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PILIHAN_MODE, useAksesibilitas, type PengaturanAksesibilitas } from '@/aksesibilitas/pengaturan'
import { useProduk, useProdukDetail } from '@/api/pelanggan'
import { tambahPaket } from '@/fitur/keranjang/keranjang'
import { Galat, Kerangka } from '@/komponen/ui/Keadaan'
import { FotoBunga, PengaturJumlah, TombolDengarkan, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna, SaranPerpaduan } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'

import { GridProduk, TombolFavorit } from './KartuProduk'

type Mode = PengaturanAksesibilitas['jenis_buta_warna']

const TAB = ['Isi rangkaian', 'Makna warna', 'Perawatan'] as const

const PERAWATAN = [
  'Potong ujung tangkai miring 1–2 cm sebelum dimasukkan ke vas.',
  'Ganti air vas setiap dua hari dan buang daun yang terendam.',
  'Letakkan jauh dari sinar matahari langsung dan buah yang matang.',
  'Untuk bunga dalam kotak, semprotkan sedikit air pada spons setiap hari.',
]

export function HalamanProduk() {
  const { id } = useParams()
  const idProduk = Number(id)
  const { data: produk, isPending, isError, error, refetch } = useProdukDetail(idProduk)
  const semua = useProduk(produk?.acara ?? undefined)
  const pengaturan = useAksesibilitas()
  const [mode, setMode] = useState<Mode | null>(null)
  const [jumlah, setJumlah] = useState(1)
  const [tab, setTab] = useState<(typeof TAB)[number]>('Isi rangkaian')
  const navigasi = useNavigate()
  const idTab = useId()
  useJudul(produk?.nama_produk ?? 'Detail produk')

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-2 md:px-6">
        <Kerangka className="aspect-square" />
        <div className="flex flex-col gap-4">
          <Kerangka className="h-10 w-2/3" />
          <Kerangka className="h-6 w-1/3" />
          <Kerangka className="h-40" />
        </div>
      </div>
    )
  }
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} className="mx-4 my-10" />

  const modeAktif: Mode = mode ?? (pengaturan.penajaman_warna ? pengaturan.jenis_buta_warna : 'normal')
  const makna = new Map(produk.makna_warna.map((m) => [m.nama_warna, m.makna]))
  const warnaUnik = produk.komposisi.filter((k, i, a) => a.findIndex((x) => x.warna.id_warna === k.warna.id_warna) === i)
  const serupa = (semua.data ?? []).filter((p) => p.id_produk !== produk.id_produk).slice(0, 4)

  function keKeranjang(langsung: boolean) {
    if (!produk) return
    tambahPaket(produk, jumlah)
    if (langsung) navigasi('/keranjang')
    else tampilkanToast(`${produk.nama_produk} ditambahkan ke keranjang.`)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <Link
        to="/katalog"
        className="mb-4 inline-flex min-h-10 items-center gap-1 rounded-full pe-3 text-sm font-semibold text-rose-teks hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" /> Kembali ke katalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        {/* Foto */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="overflow-hidden rounded-[2rem] border-2 border-rose/60 bg-blush p-2">
            <div data-pratinjau={modeAktif} className="overflow-hidden rounded-[1.6rem]">
              <FotoBunga
                src={produk.foto_url}
                alt={`Foto ${produk.nama_produk}. ${produk.narasi}`}
                loading="eager"
                className="aspect-square w-full"
              />
            </div>
          </div>
          <fieldset className="mt-4 rounded-3xl bg-blush/60 p-4">
            <legend className="sr-only">Sesuaikan tampilan warna foto</legend>
            <p aria-hidden className="mb-2 font-display text-lg font-semibold text-olive-tua">
              Sesuaikan tampilan warna
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PILIHAN_MODE.map((m) => (
                <label
                  key={m.nilai}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 px-3 text-sm font-semibold',
                    'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-magenta',
                    modeAktif === m.nilai ? 'border-olive bg-olive text-latar' : 'border-garis bg-permukaan text-olive-tua',
                  )}
                >
                  <input
                    type="radio"
                    name="pratinjau"
                    className="sr-only"
                    checked={modeAktif === m.nilai}
                    onChange={() => setMode(m.nilai)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-redup">
              Hanya mengubah tampilan foto ini. Atur untuk semua halaman lewat ikon aksesibilitas di atas.
            </p>
          </fieldset>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div>
            {produk.acara && <p className="text-sm font-semibold tracking-wide text-redup uppercase">{produk.acara}</p>}
            <h1 className="font-display text-4xl leading-tight text-olive-tua md:text-5xl">{produk.nama_produk}</h1>
            <p className="mt-2 text-3xl font-bold text-rose-teks">{formatRupiah(produk.harga)}</p>
            <p className="mt-1 text-sm text-redup">{produk.total_tangkai} tangkai bunga</p>
          </div>
          {produk.deskripsi && <p className="text-olive">{produk.deskripsi}</p>}

          <section aria-labelledby="judul-warna" className="rounded-3xl bg-blush/60 p-5">
            <h2 id="judul-warna" className="mb-3 font-display text-xl font-semibold text-olive-tua">
              Warna dalam rangkaian
            </h2>
            <ul className="flex flex-col gap-3">
              {warnaUnik.map((k) => (
                <li key={k.warna.id_warna}>
                  <ChipWarna warna={k.warna} makna={makna.get(k.warna.nama_warna)} />
                </li>
              ))}
            </ul>
            <TombolDengarkan teks={produk.narasi} className="mt-4" />
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <PengaturJumlah label="Jumlah paket" nilai={jumlah} ubah={setJumlah} maks={20} />
            <p className={cn('text-sm font-semibold', produk.dapat_dipesan ? 'text-[#1d6631]' : 'text-[#a01f1a]')}>
              {produk.dapat_dipesan ? '✓ Tersedia untuk dipesan' : '✕ Bunga penyusun habis hari ini'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tombol ukuran="besar" disabled={!produk.dapat_dipesan} onClick={() => keKeranjang(true)}>
              Beli sekarang
            </Tombol>
            <Tombol
              ukuran="besar"
              varian="garis"
              disabled={!produk.dapat_dipesan}
              onClick={() => keKeranjang(false)}
              ikon={<ShoppingBag aria-hidden className="size-5" />}
            >
              Tambah ke keranjang
            </Tombol>
          </div>
          <TombolFavorit produk={produk} denganTeks className="self-start" />

          <ul className="grid gap-3 rounded-3xl border-2 border-garis/70 p-4 sm:grid-cols-3">
            {[
              [Leaf, 'Bunga segar', 'Dipilih pada hari pengiriman'],
              [Truck, 'Pengiriman terjadwal', 'Sesuai tanggal dan jam pilihan'],
              [Camera, 'Konfirmasi foto', 'Foto hasil dikirim sebelum diantar'],
            ].map(([Ikon, judul, ket]) => {
              const I = Ikon as typeof Leaf
              return (
                <li key={judul as string} className="flex items-start gap-2">
                  <I aria-hidden className="mt-0.5 size-5 shrink-0 text-rose-teks" />
                  <span className="text-sm">
                    <span className="block font-semibold text-olive-tua">{judul as string}</span>
                    <span className="text-xs text-redup">{ket as string}</span>
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Tab */}
          <div>
            <div role="tablist" aria-label="Informasi produk" className="flex gap-1 overflow-x-auto border-b-2 border-garis/60">
              {TAB.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`${idTab}-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`${idTab}-panel`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    const i = TAB.indexOf(t)
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      const n = TAB[(i + (e.key === 'ArrowRight' ? 1 : TAB.length - 1)) % TAB.length]!
                      setTab(n)
                      document.getElementById(`${idTab}-${n}`)?.focus()
                    }
                  }}
                  className={cn(
                    '-mb-0.5 min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold',
                    tab === t ? 'border-rose-teks text-rose-tua' : 'border-transparent text-redup hover:text-olive-tua',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`${idTab}-panel`} aria-labelledby={`${idTab}-${tab}`} tabIndex={0} className="pt-4 text-sm text-olive">
              {tab === 'Isi rangkaian' && (
                <ul className="flex flex-col gap-3">
                  {produk.komposisi.map((k) => (
                    <li
                      key={`${k.id_jenis_bunga}-${k.warna.id_warna}`}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-permukaan p-3 ring-1 ring-garis/50"
                    >
                      <span>
                        <span className="block font-semibold text-olive-tua">
                          {k.jenis.nama_bunga} · <ChipWarna warna={k.warna} ukuran="kecil" />
                        </span>
                        <span className="block text-xs text-redup">{k.deskripsi}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-blush px-3 py-1 text-xs font-bold text-rose-tua">
                        {k.jumlah_tangkai} tangkai
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {tab === 'Makna warna' && (
                <ul className="flex flex-col gap-3">
                  {produk.makna_warna.map((m) => (
                    <li key={m.nama_warna}>
                      <ChipWarna warna={m} makna={m.makna ?? 'Belum ada keterangan makna.'} />
                    </li>
                  ))}
                  <li>
                    <SaranPerpaduan daftar={produk.makna_warna} />
                  </li>
                </ul>
              )}
              {tab === 'Perawatan' && (
                <ol className="flex list-decimal flex-col gap-2 ps-5">
                  {PERAWATAN.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-redup">
            <CalendarClock aria-hidden className="size-4" /> Pemesanan paling lambat sehari sebelum tanggal kirim.
          </p>
        </div>
      </div>

      {serupa.length > 0 && (
        <section aria-labelledby="judul-serupa" className="mt-16">
          <h2 id="judul-serupa" className="mb-5 font-display text-3xl text-rose-teks">
            Mungkin Kamu Suka
          </h2>
          <GridProduk daftar={serupa} />
        </section>
      )}
    </div>
  )
}
