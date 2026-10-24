import { Eye, EyeOff, Flower, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useAdminProduk, useUbahProduk } from '@/api/admin'
import { pesanGalat } from '@/api/client'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { FotoBunga, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { kelasTombol, Tombol } from '@/komponen/ui/Tombol'
import { DeretTitikWarna, teksWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'
import { JudulAdmin } from '@/tata-letak/TataLetakAdmin'

export function HalamanKatalogAdmin() {
  useJudul('Katalog Produk')
  const { data, isPending, isError, error, refetch } = useAdminProduk()
  const ubah = useUbahProduk()
  const [cari, setCari] = useState('')
  const daftar = (data ?? []).filter((p) => `${p.nama_produk} ${p.acara ?? ''}`.toLowerCase().includes(cari.toLowerCase()))

  return (
    <>
      <JudulAdmin
        judul="Katalog Produk"
        keterangan="Paket rangkaian siap pakai yang tampil di katalog pelanggan."
        jejak={[{ ke: '/admin', label: 'Dasbor' }]}
        aksi={
          <Link to="/admin/katalog/baru" className={cn(kelasTombol('admin'), 'rounded-xl')}>
            <Plus aria-hidden className="size-4" /> Tambah produk
          </Link>
        }
      />
      <label htmlFor="cari-produk" className="sr-only">
        Cari produk
      </label>
      <input
        id="cari-produk"
        type="search"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari nama produk atau acara…"
        className="mb-4 h-11 w-full max-w-md rounded-xl border border-ad-garis bg-ad-permukaan px-3 text-sm focus:border-ad-aksen focus:outline-none"
      />
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Kerangka key={i} className="h-32 rounded-2xl bg-ad-garis/60" />
          ))}
        </div>
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : daftar.length === 0 ? (
        <Kosong ikon={<Flower className="size-8" />} judul="Belum ada produk" pesan="Tambahkan paket rangkaian pertama Anda." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {daftar.map((p) => (
            <li
              key={p.id_produk}
              className={cn(
                'flex gap-3 rounded-2xl border bg-ad-permukaan p-3',
                p.ditampilkan ? 'border-ad-garis' : 'border-dashed border-ad-redup/50',
              )}
            >
              <FotoBunga
                src={p.foto_url}
                alt={p.nama_produk}
                className={cn('size-24 shrink-0 rounded-xl', !p.ditampilkan && 'opacity-50')}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate font-semibold">{p.nama_produk}</p>
                <p className="text-xs text-ad-redup">
                  {p.acara ?? 'Tanpa acara'} · {p.total_tangkai} tangkai
                </p>
                <p className="flex items-center gap-1.5 text-xs text-ad-redup">
                  <DeretTitikWarna daftar={p.komposisi.map((k) => k.warna)} />
                  <span className="truncate">{teksWarna(p.komposisi.map((k) => k.warna))}</span>
                </p>
                <p className="font-bold tabular-nums">{formatRupiah(p.harga)}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Link to={`/admin/katalog/${p.id_produk}`} className={cn(kelasTombol('admin-garis', 'kecil'), 'rounded-lg')}>
                    <Pencil aria-hidden className="size-3.5" /> Ubah<span className="sr-only"> {p.nama_produk}</span>
                  </Link>
                  <Tombol
                    varian="admin-garis"
                    ukuran="kecil"
                    className="rounded-lg"
                    aria-pressed={p.ditampilkan}
                    ikon={p.ditampilkan ? <Eye aria-hidden className="size-3.5" /> : <EyeOff aria-hidden className="size-3.5" />}
                    memuat={ubah.isPending && ubah.variables?.id === p.id_produk}
                    onClick={() =>
                      ubah.mutate(
                        { id: p.id_produk, isian: { ditampilkan: !p.ditampilkan } },
                        {
                          onSuccess: () =>
                            tampilkanToast(
                              p.ditampilkan ? `${p.nama_produk} disembunyikan dari katalog.` : `${p.nama_produk} ditampilkan di katalog.`,
                            ),
                          onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                        },
                      )
                    }
                  >
                    {p.ditampilkan ? 'Tampil' : 'Tersembunyi'}
                  </Tombol>
                  {!p.dapat_dipesan && p.ditampilkan && (
                    <span className="self-center rounded-md bg-ad-peringatan-lembut px-1.5 py-0.5 text-xs font-bold text-ad-peringatan">
                      Stok kurang
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
