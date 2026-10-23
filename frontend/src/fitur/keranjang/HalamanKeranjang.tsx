import { ArrowRight, Flower2, ShoppingBag, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { useInfoToko, usePratinjau } from '@/api/pelanggan'
import { useSesi } from '@/auth/sesi'
import { Kosong } from '@/komponen/ui/Keadaan'
import { FotoBunga, PengaturJumlah, useJudul } from '@/komponen/ui/Lain'
import { TautanTombol, Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { formatRupiah } from '@/lib/format'

import { hapusItem, hargaItem, keItemApi, ubahJumlah, useKeranjang } from './keranjang'

/** Memvalidasi isi keranjang ke server (harga terbaru dan ketersediaan stok) setiap kali isinya berubah. */
export function usePratinjauKeranjang(cara: 'ambil_di_toko' | 'antar' = 'ambil_di_toko') {
  const isi = useKeranjang()
  const pratinjau = usePratinjau()
  const kunciIsi = useMemo(() => JSON.stringify([isi.map(keItemApi), cara]), [isi, cara])
  const { mutate } = pratinjau
  useEffect(() => {
    if (isi.length === 0) return
    const t = window.setTimeout(() => mutate({ items: isi.map(keItemApi), cara_serah_terima: cara }), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kunciIsi mewakili isi dan cara
  }, [kunciIsi, mutate])
  return { isi, pratinjau }
}

export function HalamanKeranjang() {
  useJudul('Keranjang')
  const { isi, pratinjau } = usePratinjauKeranjang()
  const info = useInfoToko()
  const sesi = useSesi()
  const navigasi = useNavigate()

  if (isi.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-4 font-display text-4xl text-rose-teks">Keranjang</h1>
        <Kosong
          ikon={<ShoppingBag className="size-8" />}
          judul="Keranjangmu masih kosong"
          pesan="Yuk pilih rangkaian dari katalog atau rangkai bunga sendiri sesuai warna favoritmu."
          aksi={
            <div className="flex flex-wrap justify-center gap-3">
              <TautanTombol to="/katalog">Lihat katalog</TautanTombol>
              <TautanTombol to="/rangkai" varian="garis">
                Rangkai sendiri
              </TautanTombol>
            </div>
          }
        />
      </div>
    )
  }

  const data = pratinjau.data
  const masalah = data?.masalah ?? []
  const totalLokal = isi.reduce((t, i) => t + hargaItem(i), 0)
  const jasa = info.data?.jasa_merangkai ?? 0
  const lanjut = () => navigasi(sesi?.pengguna.peran === 'pelanggan' ? '/checkout' : `/masuk?kembali=${encodeURIComponent('/checkout')}`)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <h1 className="mb-6 font-display text-4xl text-rose-teks">Keranjang</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Isi keranjang">
          {masalah.length > 0 && (
            <div role="alert" className="mb-4 rounded-2xl bg-[#fce8e7] p-4 text-sm text-[#7a1814]">
              <p className="flex items-center gap-2 font-semibold">
                <TriangleAlert aria-hidden className="size-5" /> Beberapa bunga tidak cukup stoknya hari ini
              </p>
              <ul className="mt-2 list-disc ps-6">
                {masalah.map((m) => (
                  <li key={`${m.bunga}-${m.id_stok}`}>
                    {m.bunga}: diminta {m.diminta}, tersedia {m.tersedia}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="flex flex-col gap-3">
            {isi.map((i) => (
              <li key={i.kunci} className="flex gap-4 rounded-3xl bg-permukaan p-3 ring-1 ring-garis/60 sm:p-4">
                {i.jenis_item === 'paket' ? (
                  <>
                    <Link to={`/produk/${i.id_produk}`} className="shrink-0">
                      <FotoBunga src={i.foto_url} alt={i.nama} className="size-24 rounded-2xl sm:size-28" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link to={`/produk/${i.id_produk}`} className="font-display text-lg text-olive-tua hover:underline">
                        {i.nama}
                      </Link>
                      <p className="text-sm text-redup">{i.ringkasan_warna}</p>
                      <p className="font-bold text-rose-teks">{formatRupiah(i.harga)}</p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                        <PengaturJumlah label={`Jumlah ${i.nama}`} nilai={i.jumlah} maks={20} ubah={(n) => ubahJumlah(i.kunci, n)} />
                        <button
                          type="button"
                          onClick={() => hapusItem(i.kunci)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-rose-teks hover:bg-blush"
                        >
                          <Trash2 aria-hidden className="size-4" /> Hapus
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span aria-hidden className="grid size-24 shrink-0 place-items-center rounded-2xl bg-blush text-rose-teks sm:size-28">
                      <Flower2 className="size-10" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="font-display text-lg text-olive-tua">Rangkaian buatanku</p>
                      <ul className="flex flex-col gap-1 text-sm">
                        {i.bunga.map((b) => (
                          <li key={b.id_stok}>
                            {b.jumlah_tangkai}× {b.nama} · <ChipWarna warna={b.warna} ukuran="kecil" tampilkanKode={false} />
                          </li>
                        ))}
                      </ul>
                      <p className="font-bold text-rose-teks">
                        {formatRupiah(hargaItem(i) + jasa)} <span className="text-xs font-normal text-redup">termasuk jasa merangkai</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => hapusItem(i.kunci)}
                        className="inline-flex min-h-10 items-center gap-1 self-end rounded-full px-3 text-sm font-semibold text-rose-teks hover:bg-blush"
                      >
                        <Trash2 aria-hidden className="size-4" /> Hapus
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        <aside aria-labelledby="judul-ringkasan" className="self-start rounded-[2rem] bg-blush/70 p-5 lg:sticky lg:top-28">
          <h2 id="judul-ringkasan" className="mb-4 font-display text-2xl text-olive-tua">
            Ringkasan belanja
          </h2>
          <dl className="flex flex-col gap-2 text-sm" aria-busy={pratinjau.isPending}>
            {(data?.items ?? []).map((it, idx) => (
              <div key={idx} className="flex justify-between gap-3">
                <dt className="min-w-0 truncate">
                  {it.jumlah}× {it.nama}
                </dt>
                <dd>{formatRupiah(it.subtotal)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-garis/70 pt-3 text-base font-bold text-rose-teks">
              <dt>Subtotal</dt>
              <dd>{formatRupiah(data?.subtotal ?? totalLokal)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-redup">Ongkos antar dihitung saat checkout bila memilih diantar.</p>
          <Tombol
            penuh
            ukuran="besar"
            className="mt-5"
            disabled={masalah.length > 0 || pratinjau.isPending}
            onClick={lanjut}
            ikon={<ArrowRight aria-hidden className="order-last size-5" />}
          >
            Lanjut ke checkout
          </Tombol>
          <TautanTombol to="/katalog" varian="teks" penuh className="mt-2">
            Tambah rangkaian lain
          </TautanTombol>
        </aside>
      </div>
    </div>
  )
}
