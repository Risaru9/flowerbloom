import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import type { Skema } from '@/api/client'
import { useAcara, useProduk } from '@/api/pelanggan'
import rakBunga from '@/assets/gambar/rak-bunga.webp'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { Paginasi, useJudul } from '@/komponen/ui/Lain'
import { Tombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'

import { GridProduk } from './KartuProduk'

const RENTANG = [
  { nilai: '', label: 'Semua harga', cocok: () => true },
  { nilai: 'murah', label: `Di bawah ${formatRupiah(150000)}`, cocok: (h: number) => h < 150000 },
  { nilai: 'sedang', label: `${formatRupiah(150000)} – ${formatRupiah(250000)}`, cocok: (h: number) => h >= 150000 && h <= 250000 },
  { nilai: 'premium', label: `Di atas ${formatRupiah(250000)}`, cocok: (h: number) => h > 250000 },
]

const URUTAN = [
  { nilai: '', label: 'Rekomendasi' },
  { nilai: 'termurah', label: 'Harga termurah' },
  { nilai: 'termahal', label: 'Harga termahal' },
  { nilai: 'nama', label: 'Nama A–Z' },
]

const PER_HALAMAN = 12
const normal = (s: string) => s.toLocaleLowerCase('id-ID').normalize('NFD').replace(/[̀-ͯ]/g, '')

function Chip({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-full border-2 px-3.5 text-sm font-semibold transition-colors',
        aktif ? 'border-rose-teks bg-rose-teks text-white' : 'border-garis bg-permukaan text-olive-tua hover:bg-blush',
      )}
    >
      {children}
    </button>
  )
}

interface PropsSaring {
  acara: string[]
  warna: Skema['WarnaRingkas'][]
  q: URLSearchParams
  atur: (kunci: string, nilai: string | null) => void
}

function PanelSaring({ acara, warna, q, atur }: PropsSaring) {
  const warnaDipilih = new Set((q.get('warna') ?? '').split(',').filter(Boolean))
  const toggleWarna = (nama: string) => {
    const s = new Set(warnaDipilih)
    if (s.has(nama)) s.delete(nama)
    else s.add(nama)
    atur('warna', [...s].join(',') || null)
  }
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 font-display text-lg font-bold text-olive-tua">Momen</legend>
        <div className="flex flex-wrap gap-2">
          <Chip aktif={!q.get('acara')} onClick={() => atur('acara', null)}>
            Semua
          </Chip>
          {acara.map((a) => (
            <Chip key={a} aktif={q.get('acara') === a} onClick={() => atur('acara', a)}>
              {a}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 font-display text-lg font-bold text-olive-tua">Warna</legend>
        <p className="mb-2 text-xs text-redup">Pilih satu atau lebih; nama dan kode warna selalu ditampilkan.</p>
        <div className="flex flex-wrap gap-2">
          {warna.map((w) => (
            <Chip key={w.id_warna} aktif={warnaDipilih.has(w.nama_warna)} onClick={() => toggleWarna(w.nama_warna)}>
              <span aria-hidden className="size-4 rounded-full border border-black/20" style={{ backgroundColor: w.kode_hex }} />
              {w.nama_warna}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-display text-lg font-bold text-olive-tua">Rentang harga</legend>
        <div className="flex flex-col gap-1">
          {RENTANG.map((r) => (
            <label key={r.nilai} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-blush/60">
              <input
                type="radio"
                name="rentang-harga"
                checked={(q.get('harga') ?? '') === r.nilai}
                onChange={() => atur('harga', r.nilai || null)}
                className="size-4 accent-rose-teks"
              />
              <span className="text-sm text-olive-tua">{r.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function HalamanKatalog() {
  useJudul('Katalog Bunga')
  const [q, setQ] = useSearchParams()
  const [saringTerbuka, setSaringTerbuka] = useState(false)
  const acaraDipilih = q.get('acara') ?? undefined
  const produk = useProduk(acaraDipilih)
  const acara = useAcara()
  const cari = q.get('cari') ?? ''
  const cariTertunda = useDeferredValue(cari)

  const atur = (kunci: string, nilai: string | null) => {
    setQ(
      (lama) => {
        const baru = new URLSearchParams(lama)
        if (nilai === null || nilai === '') baru.delete(kunci)
        else baru.set(kunci, nilai)
        if (kunci !== 'hal') baru.delete('hal')
        return baru
      },
      { replace: kunci === 'cari', preventScrollReset: true },
    )
  }

  const semuaWarna = useMemo(() => {
    const peta = new Map<number, Skema['WarnaRingkas']>()
    produk.data?.forEach((p) => p.komposisi.forEach((k) => peta.set(k.warna.id_warna, k.warna)))
    return [...peta.values()].sort((a, b) => a.nama_warna.localeCompare(b.nama_warna, 'id'))
  }, [produk.data])

  const hasil = useMemo(() => {
    if (!produk.data) return []
    const kata = normal(cariTertunda.trim())
    const warna = new Set((q.get('warna') ?? '').split(',').filter(Boolean))
    const rentang = RENTANG.find((r) => r.nilai === (q.get('harga') ?? '')) ?? RENTANG[0]!
    const daftar = produk.data.filter((p) => {
      if (kata) {
        const teks = normal([p.nama_produk, p.deskripsi, p.acara, ...p.komposisi.map((k) => `${k.jenis.nama_bunga} ${k.warna.nama_warna}`)].join(' '))
        if (!kata.split(/\s+/).every((k) => teks.includes(k))) return false
      }
      if (warna.size && !p.komposisi.some((k) => warna.has(k.warna.nama_warna))) return false
      return rentang.cocok(p.harga)
    })
    const urut = q.get('urut')
    if (urut === 'termurah') daftar.sort((a, b) => a.harga - b.harga)
    else if (urut === 'termahal') daftar.sort((a, b) => b.harga - a.harga)
    else if (urut === 'nama') daftar.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk, 'id'))
    else daftar.sort((a, b) => Number(b.dapat_dipesan) - Number(a.dapat_dipesan))
    return daftar
  }, [produk.data, cariTertunda, q])

  const halaman = Math.max(1, Number(q.get('hal')) || 1)
  const tampil = hasil.slice((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN)
  const jumlahSaring = ['acara', 'warna', 'harga'].filter((k) => q.get(k)).length
  const panel = <PanelSaring acara={acara.data ?? []} warna={semuaWarna} q={q} atur={atur} />

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img src={rakBunga} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-rose-tua/55 to-rose-tua/75" />
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-white md:py-20">
          <h1 className="font-display text-4xl md:text-6xl">Katalog Bunga</h1>
          <p className="mx-auto mt-3 max-w-xl text-white/95">Temukan rangkaian bunga yang tepat untuk setiap cerita dan momen berharga.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <div className="sticky top-16 z-20 -mx-4 mb-5 flex flex-wrap items-center gap-2 bg-latar/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
          <form role="search" onSubmit={(e) => e.preventDefault()} className="relative min-w-0 flex-1 basis-60">
            <label htmlFor="cari-katalog" className="sr-only">
              Cari bunga atau rangkaian
            </label>
            <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-redup" />
            <input
              id="cari-katalog"
              type="search"
              value={cari}
              onChange={(e) => atur('cari', e.target.value)}
              placeholder="Cari mawar, putih, wisuda…"
              autoFocus={q.has('cari') && !cari}
              className="h-12 w-full rounded-full border-2 border-garis bg-permukaan ps-12 pe-4 text-olive-tua placeholder:text-redup focus:border-rose-teks focus:outline-none"
            />
          </form>
          <label className="sr-only" htmlFor="urutan">
            Urutkan
          </label>
          <select
            id="urutan"
            value={q.get('urut') ?? ''}
            onChange={(e) => atur('urut', e.target.value || null)}
            className="h-12 rounded-full border-2 border-garis bg-permukaan px-4 text-sm font-semibold text-olive-tua focus:border-rose-teks focus:outline-none"
          >
            {URUTAN.map((u) => (
              <option key={u.nilai} value={u.nilai}>
                {u.label}
              </option>
            ))}
          </select>
          <Tombol
            varian="garis"
            className="lg:hidden"
            onClick={() => setSaringTerbuka(true)}
            ikon={<SlidersHorizontal aria-hidden className="size-4" />}
          >
            Filter{jumlahSaring ? ` (${jumlahSaring})` : ''}
          </Tombol>
        </div>

        <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
          <aside aria-label="Filter katalog" className="hidden self-start rounded-3xl bg-blush/60 p-5 lg:sticky lg:top-28 lg:block">
            {panel}
          </aside>
          <section aria-labelledby="judul-hasil" aria-busy={produk.isFetching}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 id="judul-hasil" className="me-auto text-sm text-redup" aria-live="polite">
                {produk.data ? `${hasil.length} rangkaian ditemukan` : 'Memuat rangkaian…'}
              </h2>
              {jumlahSaring > 0 && (
                <button
                  type="button"
                  onClick={() => setQ(cari ? { cari } : {}, { replace: true })}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rose-teks hover:bg-blush"
                >
                  <X aria-hidden className="size-4" /> Hapus filter
                </button>
              )}
            </div>
            {produk.isPending ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Kerangka key={i} className="aspect-[3/4]" />
                ))}
              </div>
            ) : produk.isError ? (
              <Galat galat={produk.error} ulangi={() => void produk.refetch()} />
            ) : hasil.length === 0 ? (
              <Kosong
                judul="Belum ada yang cocok"
                pesan="Coba kata kunci lain atau kurangi filter. Anda juga bisa merangkai bunga sendiri."
                aksi={
                  <Tombol varian="garis" onClick={() => setQ({}, { replace: true })}>
                    Tampilkan semua
                  </Tombol>
                }
              />
            ) : (
              <>
                <GridProduk daftar={tampil} className="lg:grid-cols-3" />
                <Paginasi halaman={halaman} total={hasil.length} perHalaman={PER_HALAMAN} ubah={(h) => atur('hal', String(h))} />
              </>
            )}
          </section>
        </div>
      </div>

      <Dialog
        terbuka={saringTerbuka}
        saatTutup={() => setSaringTerbuka(false)}
        judul="Filter katalog"
        kaki={<Tombol onClick={() => setSaringTerbuka(false)}>Lihat {hasil.length} rangkaian</Tombol>}
      >
        {panel}
      </Dialog>
    </>
  )
}
