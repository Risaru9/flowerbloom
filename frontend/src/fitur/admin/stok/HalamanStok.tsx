import { Boxes, PackagePlus, Pencil, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useKoreksiStok, useStok, useStokManual } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { AreaTeks, Bidang, Masukan } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { kelasTombol, Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { formatRupiah, formatTanggal } from '@/lib/format'
import { JudulAdmin } from '@/tata-letak/TataLetakAdmin'

import { PilihJenis, PilihWarna } from './PilihBunga'

/** Tangkai yang sudah keluar dari stok: terpakai pesanan, dipakai sebagai pengganti, atau dikoreksi turun. */
const keluar = (s: Skema['StokOut']) => Math.max(0, s.jumlah_masuk - s.jumlah_ditahan - s.jumlah_tersedia)

function DialogStokManual({ terbuka, tutup }: { terbuka: boolean; tutup: () => void }) {
  const simpan = useStokManual()
  const [jenis, setJenis] = useState<number | ''>('')
  const [warna, setWarna] = useState<number | ''>('')
  const [jumlah, setJumlah] = useState('')
  const [harga, setHarga] = useState('')
  const [galat, setGalat] = useState<Record<string, string>>({})
  return (
    <Dialog
      gaya="admin"
      terbuka={terbuka}
      saatTutup={tutup}
      judul="Input stok manual"
      deskripsi="Untuk bunga yang tidak dapat dipindai. Bila pasangan jenis+warna sudah ada, jumlahnya ditambahkan dan harganya diperbarui."
      kaki={
        <>
          <Tombol varian="admin-garis" className="rounded-xl" onClick={tutup}>
            Batal
          </Tombol>
          <Tombol
            varian="admin"
            className="rounded-xl"
            memuat={simpan.isPending}
            onClick={() => {
              const g: Record<string, string> = {}
              if (!jenis) g.jenis = 'Pilih jenis bunga.'
              if (!warna) g.warna = 'Pilih warna.'
              if (!(Number(jumlah) > 0)) g.jumlah = 'Isi jumlah tangkai lebih dari 0.'
              if (!(Number(harga) >= 0) || harga === '') g.harga = 'Isi harga per tangkai.'
              setGalat(g)
              if (Object.keys(g).length) return
              simpan.mutate(
                {
                  id_jenis_bunga: Number(jenis),
                  id_warna: Number(warna),
                  jumlah_tangkai: Number(jumlah),
                  harga_per_tangkai: Number(harga),
                },
                {
                  onSuccess: (s) => {
                    tampilkanToast(`Stok ${s.jenis.nama_bunga} ${s.warna.nama_warna} kini ${s.jumlah_tersedia} tangkai.`)
                    setJumlah('')
                    tutup()
                  },
                  onError: (e) => setGalat({ umum: pesanGalat(e) }),
                },
              )
            }}
          >
            Simpan stok
          </Tombol>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {galat.umum && (
          <p role="alert" className="rounded-xl bg-ad-bahaya-lembut p-3 text-sm text-ad-bahaya sm:col-span-2">
            {galat.umum}
          </p>
        )}
        <PilihJenis nilai={jenis} ubah={setJenis} galat={galat.jenis} />
        <PilihWarna nilai={warna} ubah={setWarna} galat={galat.warna} />
        <Bidang label="Jumlah tangkai" gaya="admin" wajib galat={galat.jumlah}>
          <Masukan gaya="admin" type="number" inputMode="numeric" min={1} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
        </Bidang>
        <Bidang label="Harga per tangkai (Rp)" gaya="admin" wajib galat={galat.harga}>
          <Masukan
            gaya="admin"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            value={harga}
            onChange={(e) => setHarga(e.target.value)}
          />
        </Bidang>
      </div>
    </Dialog>
  )
}

function DialogKoreksi({ stok, tutup }: { stok: Skema['StokOut'] | null; tutup: () => void }) {
  const koreksi = useKoreksiStok()
  const [tersedia, setTersedia] = useState('')
  const [harga, setHarga] = useState('')
  const [catatan, setCatatan] = useState('')
  const [terakhir, setTerakhir] = useState<number | null>(null)
  if (stok && stok.id_stok !== terakhir) {
    setTerakhir(stok.id_stok)
    setTersedia(String(stok.jumlah_tersedia))
    setHarga(String(stok.harga_per_tangkai))
    setCatatan('')
  }
  return (
    <Dialog
      gaya="admin"
      terbuka={!!stok}
      saatTutup={() => {
        setTerakhir(null)
        tutup()
      }}
      judul="Koreksi stok"
      deskripsi={stok ? `${stok.jenis.nama_bunga} — ${stok.warna.nama_warna}. Perubahan dicatat di buku mutasi.` : undefined}
      kaki={
        <>
          <Tombol varian="admin-garis" className="rounded-xl" onClick={tutup}>
            Batal
          </Tombol>
          <Tombol
            varian="admin"
            className="rounded-xl"
            disabled={catatan.trim().length < 3}
            memuat={koreksi.isPending}
            onClick={() =>
              stok &&
              koreksi.mutate(
                {
                  id: stok.id_stok,
                  isian: {
                    jumlah_tersedia: Number(tersedia) !== stok.jumlah_tersedia ? Number(tersedia) : null,
                    harga_per_tangkai: Number(harga) !== stok.harga_per_tangkai ? Number(harga) : null,
                    catatan: catatan.trim(),
                  },
                },
                {
                  onSuccess: () => {
                    tampilkanToast('Stok dikoreksi.')
                    setTerakhir(null)
                    tutup()
                  },
                  onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                },
              )
            }
          >
            Simpan koreksi
          </Tombol>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Bidang label="Jumlah tersedia (hitung fisik)" gaya="admin">
          <Masukan gaya="admin" type="number" min={0} value={tersedia} onChange={(e) => setTersedia(e.target.value)} />
        </Bidang>
        <Bidang label="Harga per tangkai (Rp)" gaya="admin">
          <Masukan gaya="admin" type="number" min={0} step={500} value={harga} onChange={(e) => setHarga(e.target.value)} />
        </Bidang>
        <Bidang label="Alasan koreksi" gaya="admin" wajib className="sm:col-span-2">
          <AreaTeks
            gaya="admin"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Layu 3 tangkai"
            maxLength={255}
          />
        </Bidang>
      </div>
    </Dialog>
  )
}

export function HalamanStok() {
  useJudul('Daftar Stok Bunga')
  const [q, setQ] = useSearchParams()
  const menipis = q.get('menipis') === '1'
  const { data, isPending, isError, error, refetch } = useStok(menipis || undefined)
  const [manual, setManual] = useState(false)
  const [koreksi, setKoreksi] = useState<Skema['StokOut'] | null>(null)
  const [cari, setCari] = useState('')
  const daftar = (data ?? []).filter((s) => `${s.jenis.nama_bunga} ${s.warna.nama_warna}`.toLowerCase().includes(cari.toLowerCase()))

  return (
    <>
      <JudulAdmin
        judul="Daftar Stok Bunga"
        keterangan="Jumlah masuk, keluar (terpakai pesanan, pengganti, atau koreksi), ditahan pesanan belum dibayar, dan yang tersedia."
        jejak={[{ ke: '/admin', label: 'Dasbor' }]}
        aksi={
          <>
            <Link to="/admin/stok/pindai" className={cn(kelasTombol('admin'), 'rounded-xl')}>
              <ScanLine aria-hidden className="size-4" /> Pindai stok masuk
            </Link>
            <Tombol
              varian="admin-garis"
              className="rounded-xl"
              ikon={<PackagePlus aria-hidden className="size-4" />}
              onClick={() => setManual(true)}
            >
              Input manual
            </Tombol>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="cari-stok" className="sr-only">
          Cari stok
        </label>
        <input
          id="cari-stok"
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari jenis atau warna…"
          className="h-11 min-w-0 flex-1 basis-56 rounded-xl border border-ad-garis bg-ad-permukaan px-3 text-sm focus:border-ad-aksen focus:outline-none"
        />
        <label className="flex h-11 items-center gap-2 rounded-xl border border-ad-garis bg-ad-permukaan px-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={menipis}
            onChange={(e) => setQ(e.target.checked ? { menipis: '1' } : {})}
            className="size-4 accent-ad-aksen"
          />
          Menipis saja
        </label>
      </div>
      {isPending ? (
        <Kerangka className="h-48 rounded-2xl bg-ad-garis/60" />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : daftar.length === 0 ? (
        <Kosong
          ikon={<Boxes className="size-8" />}
          judul={menipis ? 'Tidak ada stok yang menipis' : 'Belum ada stok'}
          pesan={menipis ? 'Semua stok masih di atas ambang menipis.' : 'Pindai bunga yang baru datang atau input secara manual.'}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-ad-garis bg-ad-permukaan md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Daftar stok bunga</caption>
              <thead className="bg-ad-latar text-xs text-ad-redup uppercase">
                <tr>
                  {['Bunga', 'Warna', 'Masuk', 'Keluar', 'Ditahan', 'Tersedia', 'Harga/tangkai', 'Terakhir masuk', ''].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        'px-4 py-3 font-semibold',
                        ['Masuk', 'Keluar', 'Ditahan', 'Tersedia', 'Harga/tangkai'].includes(h) ? 'text-end' : 'text-start',
                      )}
                    >
                      {h || <span className="sr-only">Aksi</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daftar.map((s) => (
                  <tr key={s.id_stok} className="border-t border-ad-garis">
                    <td className="px-4 py-3 font-semibold">{s.jenis.nama_bunga}</td>
                    <td className="px-4 py-3">
                      <ChipWarna warna={s.warna} ukuran="kecil" />
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{s.jumlah_masuk}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{keluar(s)}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{s.jumlah_ditahan}</td>
                    <td className="px-4 py-3 text-end font-bold tabular-nums">
                      {s.jumlah_tersedia}
                      {s.menipis && (
                        <span className="ms-2 rounded-md bg-ad-peringatan-lembut px-1.5 py-0.5 text-xs text-ad-peringatan">Menipis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatRupiah(s.harga_per_tangkai)}</td>
                    <td className="px-4 py-3 text-ad-redup">{formatTanggal(s.tanggal_masuk)}</td>
                    <td className="px-4 py-3">
                      <Tombol
                        varian="admin-garis"
                        ukuran="kecil"
                        className="rounded-lg"
                        ikon={<Pencil aria-hidden className="size-3.5" />}
                        onClick={() => setKoreksi(s)}
                      >
                        Koreksi
                        <span className="sr-only">
                          {' '}
                          {s.jenis.nama_bunga} {s.warna.nama_warna}
                        </span>
                      </Tombol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {daftar.map((s) => (
              <li key={s.id_stok} className="rounded-2xl border border-ad-garis bg-ad-permukaan p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.jenis.nama_bunga}</p>
                    <ChipWarna warna={s.warna} ukuran="kecil" className="text-sm" />
                  </div>
                  <p className="text-end">
                    <span className="block text-2xl font-bold tabular-nums">{s.jumlah_tersedia}</span>
                    <span className="text-xs text-ad-redup">tersedia</span>
                  </p>
                </div>
                <p className="mt-2 text-xs text-ad-redup">
                  Masuk {s.jumlah_masuk} · keluar {keluar(s)} · ditahan {s.jumlah_ditahan} · {formatRupiah(s.harga_per_tangkai)}/tangkai
                </p>
                <div className="mt-2 flex items-center justify-between">
                  {s.menipis ? (
                    <span className="rounded-md bg-ad-peringatan-lembut px-1.5 py-0.5 text-xs font-bold text-ad-peringatan">Menipis</span>
                  ) : (
                    <span />
                  )}
                  <Tombol varian="admin-garis" ukuran="kecil" className="rounded-lg" onClick={() => setKoreksi(s)}>
                    Koreksi
                  </Tombol>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <DialogStokManual terbuka={manual} tutup={() => setManual(false)} />
      <DialogKoreksi stok={koreksi} tutup={() => setKoreksi(null)} />
    </>
  )
}
