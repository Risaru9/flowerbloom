import { Search, ShoppingBag, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import type { Skema } from '@/api/client'
import { useInfoToko, useOpsiRangkai } from '@/api/pelanggan'
import { tambahRangkaian, type BungaTerpilih } from '@/fitur/keranjang/keranjang'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { PengaturJumlah, TombolDengarkan, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'

type Opsi = Skema['OpsiRangkaiOut']

/** Pratinjau visual sederhana: lingkaran-lingkaran berwarna disusun melingkar seperti buket (F-PL-05). */
function PratinjauBuket({ pilihan, opsi }: { pilihan: Map<number, number>; opsi: Opsi[] }) {
  const titik: string[] = []
  for (const o of opsi) for (let i = 0; i < (pilihan.get(o.id_stok) ?? 0); i++) titik.push(o.warna.kode_hex)
  const maks = Math.min(titik.length, 60)
  return (
    <svg viewBox="0 0 200 220" role="img" aria-label="Pratinjau susunan warna rangkaian" className="mx-auto w-full max-w-64">
      <path d="M70 150 L100 215 L130 150 Z" fill="#f5e0d0" stroke="#e5bcaa" />
      <path d="M86 175 Q100 168 114 175 L108 186 Q100 182 92 186 Z" fill="#c97d87" />
      {maks === 0 && <circle cx="100" cy="95" r="70" fill="none" stroke="#e5bcaa" strokeDasharray="6 6" strokeWidth="2" />}
      {Array.from({ length: maks }, (_, i) => {
        // Spiral Fermat: titik tersebar merata dalam lingkaran
        const sudut = i * 2.39996
        const r = 68 * Math.sqrt((i + 0.5) / maks)
        return (
          <circle
            key={i}
            cx={100 + r * Math.cos(sudut)}
            cy={95 + r * Math.sin(sudut)}
            r={maks > 30 ? 9 : 12}
            fill={titik[i]}
            stroke="rgba(0,0,0,0.18)"
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}

export function HalamanRangkai() {
  useJudul('Rangkai Sendiri')
  const opsi = useOpsiRangkai()
  const info = useInfoToko()
  const [pilihan, setPilihan] = useState<Map<number, number>>(new Map())
  const [cari, setCari] = useState('')
  const navigasi = useNavigate()

  const daftar = useMemo(() => opsi.data ?? [], [opsi.data])
  const disaring = useMemo(() => {
    const k = cari.trim().toLowerCase()
    return k ? daftar.filter((o) => `${o.jenis.nama_bunga} ${o.warna.nama_warna}`.toLowerCase().includes(k)) : daftar
  }, [daftar, cari])

  const terpilih = daftar.filter((o) => (pilihan.get(o.id_stok) ?? 0) > 0)
  const totalTangkai = terpilih.reduce((t, o) => t + (pilihan.get(o.id_stok) ?? 0), 0)
  const subtotal = terpilih.reduce((t, o) => t + o.harga_per_tangkai * (pilihan.get(o.id_stok) ?? 0), 0)
  const minimal = info.data?.minimal_tangkai_rangkai_sendiri ?? 5
  const jasa = info.data?.jasa_merangkai ?? 0
  const kurang = Math.max(0, minimal - totalTangkai)
  const narasi = terpilih.length
    ? `Rangkaian Anda berisi ${totalTangkai} tangkai: ${terpilih
        .map((o) => `${pilihan.get(o.id_stok)} ${o.jenis.nama_bunga} warna ${o.warna.nama_warna}`)
        .join(', ')}. Total ${formatRupiah(subtotal + jasa)}.`
    : 'Belum ada bunga yang dipilih.'

  const atur = (id: number, n: number) =>
    setPilihan((m) => {
      const baru = new Map(m)
      if (n <= 0) baru.delete(id)
      else baru.set(id, n)
      return baru
    })

  function simpan() {
    const bunga: BungaTerpilih[] = terpilih.map((o) => ({
      id_stok: o.id_stok,
      jumlah_tangkai: pilihan.get(o.id_stok) ?? 0,
      nama: o.jenis.nama_bunga,
      warna: o.warna,
      harga_per_tangkai: o.harga_per_tangkai,
    }))
    tambahRangkaian(bunga)
    setPilihan(new Map())
    tampilkanToast('Rangkaianmu masuk ke keranjang.')
    navigasi('/keranjang')
  }

  const ringkasan = (
    <div className="flex flex-col gap-4">
      <PratinjauBuket pilihan={pilihan} opsi={daftar} />
      {terpilih.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {terpilih.map((o) => (
            <li key={o.id_stok} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-olive-tua">{pilihan.get(o.id_stok)}× {o.jenis.nama_bunga}</span>{' '}
                <ChipWarna warna={o.warna} ukuran="kecil" tampilkanKode={false} />
              </span>
              <button
                type="button"
                onClick={() => atur(o.id_stok, 0)}
                aria-label={`Hapus ${o.jenis.nama_bunga} ${o.warna.nama_warna}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-rose-teks hover:bg-blush"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-redup">Pilih bunga di sebelah kiri untuk mulai merangkai.</p>
      )}
      <dl className="flex flex-col gap-1 border-t border-garis/70 pt-3 text-sm">
        <div className="flex justify-between">
          <dt>Bunga ({totalTangkai} tangkai)</dt>
          <dd>{formatRupiah(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Jasa merangkai</dt>
          <dd>{formatRupiah(jasa)}</dd>
        </div>
        <div className="flex justify-between text-base font-bold text-rose-teks">
          <dt>Total</dt>
          <dd>{formatRupiah(subtotal + jasa)}</dd>
        </div>
      </dl>
      {kurang > 0 && (
        <p className="rounded-2xl bg-[#fdf0dc] px-3 py-2 text-xs font-medium text-[#6b3a00]" role="status">
          Tambahkan {kurang} tangkai lagi (minimal {minimal} tangkai per rangkaian).
        </p>
      )}
      <TombolDengarkan teks={narasi} label="Dengarkan rangkaianku" />
      <Tombol ukuran="besar" disabled={kurang > 0} onClick={simpan} ikon={<ShoppingBag aria-hidden className="size-5" />}>
        Masukkan ke keranjang
      </Tombol>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <h1 className="font-display text-4xl text-rose-teks md:text-5xl">Rangkai Sendiri</h1>
        <ol className="mt-3 flex flex-wrap gap-2 text-sm">
          {['Pilih bunga & warna', 'Atur jumlah tangkai', 'Masukkan ke keranjang'].map((l, i) => (
            <li key={l} className="flex items-center gap-2 rounded-full bg-blush px-3 py-1 font-semibold text-olive-tua">
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-rose-teks text-xs text-white">
                {i + 1}
              </span>
              {l}
            </li>
          ))}
        </ol>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="judul-pilih-bunga">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 id="judul-pilih-bunga" className="me-auto font-display text-2xl text-olive-tua">
              Bunga tersedia hari ini
            </h2>
            <div className="relative w-full sm:w-72">
              <label htmlFor="cari-bunga" className="sr-only">
                Cari jenis atau warna bunga
              </label>
              <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-redup" />
              <input
                id="cari-bunga"
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari mawar, kuning…"
                className="h-11 w-full rounded-full border-2 border-garis bg-permukaan ps-9 pe-3 text-sm focus:border-rose-teks focus:outline-none"
              />
            </div>
          </div>
          {opsi.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Kerangka key={i} className="h-36" />
              ))}
            </div>
          ) : opsi.isError ? (
            <Galat galat={opsi.error} ulangi={() => void opsi.refetch()} />
          ) : daftar.length === 0 ? (
            <Kosong judul="Stok bunga sedang kosong" pesan="Florist kami sedang menyiapkan bunga segar. Coba lagi nanti atau pilih paket di katalog." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {disaring.map((o) => {
                const n = pilihan.get(o.id_stok) ?? 0
                return (
                  <li
                    key={o.id_stok}
                    className={cn(
                      'flex flex-col gap-3 rounded-3xl bg-permukaan p-4 ring-2 transition-colors',
                      n > 0 ? 'ring-rose-teks' : 'ring-garis/50',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="grid size-14 shrink-0 place-items-center rounded-full border border-black/10 shadow-inner"
                        style={{ backgroundColor: o.warna.kode_hex }}
                      />
                      <div className="min-w-0">
                        <h3 className="font-display text-lg text-olive-tua">{o.jenis.nama_bunga}</h3>
                        <ChipWarna warna={o.warna} ukuran="kecil" />
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-redup">{o.deskripsi}</p>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <span className="text-sm">
                        <span className="block font-bold text-rose-teks">{formatRupiah(o.harga_per_tangkai)}/tangkai</span>
                        <span className="text-xs text-redup">Sisa {o.sisa}</span>
                      </span>
                      <PengaturJumlah
                        label={`Jumlah ${o.jenis.nama_bunga} ${o.warna.nama_warna}`}
                        nilai={n}
                        min={0}
                        maks={o.sisa}
                        ubah={(v) => atur(o.id_stok, v)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside
          id="rangkaianku"
          aria-labelledby="judul-rangkaianku"
          className="scroll-mt-24 self-start rounded-[2rem] bg-blush/70 p-5 lg:sticky lg:top-28"
        >
          <h2 id="judul-rangkaianku" className="mb-3 text-center font-display text-2xl text-rose-tua">
            Rangkaianku
          </h2>
          {ringkasan}
        </aside>
      </div>

      {totalTangkai > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl bg-olive-tua px-4 py-3 text-latar shadow-xl lg:hidden">
          <span className="flex-1 text-sm">
            <strong>{totalTangkai} tangkai</strong> · {formatRupiah(subtotal + jasa)}
          </span>
          <a href="#rangkaianku" className="rounded-full bg-latar px-4 py-2 text-sm font-semibold text-olive-tua">
            Lihat rangkaian
          </a>
        </div>
      )}
    </div>
  )
}
