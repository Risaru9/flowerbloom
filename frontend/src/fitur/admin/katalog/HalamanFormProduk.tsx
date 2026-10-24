import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useAdminProduk, useFotoProduk, useJenisBunga, useTambahProduk, useUbahProduk } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { useAcara, useWarna } from '@/api/pelanggan'
import { UnggahFoto } from '@/fitur/pesanan/bersama'
import { AreaTeks, Bidang, Masukan, Pilihan } from '@/komponen/ui/Bidang'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { FotoBunga, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { formatRupiah } from '@/lib/format'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

interface Baris {
  kunci: number
  id_jenis_bunga: number | ''
  id_warna: number | ''
  jumlah_tangkai: number
}

let nomor = 0
const barisBaru = (b: Partial<Baris> = {}): Baris => ({ kunci: ++nomor, id_jenis_bunga: '', id_warna: '', jumlah_tangkai: 3, ...b })

export function HalamanFormProduk() {
  const { id } = useParams()
  const daftar = useAdminProduk()
  useJudul(id ? 'Ubah Produk' : 'Tambah Produk')
  if (!id) return <FormProduk />
  if (daftar.isPending) return <Memuat />
  if (daftar.isError) return <Galat galat={daftar.error} ulangi={() => void daftar.refetch()} />
  const produk = daftar.data.find((p) => p.id_produk === Number(id))
  if (!produk) return <Galat galat={new Error('Produk tidak ditemukan.')} />
  return <FormProduk key={produk.id_produk} produk={produk} />
}

/** Formulir produk; nilai awal diambil dari `produk` saat dipasang (key per produk). */
function FormProduk({ produk }: { produk?: Skema['ProdukOut'] }) {
  const baru = !produk
  const jenis = useJenisBunga()
  const warna = useWarna()
  const acara = useAcara()
  const tambah = useTambahProduk()
  const ubah = useUbahProduk()
  const unggah = useFotoProduk()
  const navigasi = useNavigate()

  const [nama, setNama] = useState(produk?.nama_produk ?? '')
  const [acaraIsi, setAcaraIsi] = useState(produk?.acara ?? '')
  const [harga, setHarga] = useState(produk ? String(produk.harga) : '')
  const [deskripsi, setDeskripsi] = useState(produk?.deskripsi ?? '')
  const [tampil, setTampil] = useState(produk?.ditampilkan ?? true)
  const [komposisi, setKomposisi] = useState<Baris[]>(() =>
    produk?.komposisi.length
      ? produk.komposisi.map((k) =>
          barisBaru({ id_jenis_bunga: k.id_jenis_bunga, id_warna: k.warna.id_warna, jumlah_tangkai: k.jumlah_tangkai }),
        )
      : [barisBaru()],
  )
  const [foto, setFoto] = useState<File | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const ubahBaris = (kunci: number, sebagian: Partial<Baris>) =>
    setKomposisi((ks) => ks.map((k) => (k.kunci === kunci ? { ...k, ...sebagian } : k)))
  const totalTangkai = komposisi.reduce((t, k) => t + (Number(k.jumlah_tangkai) || 0), 0)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat(null)
    if (nama.trim().length < 2) return setGalat('Nama produk minimal 2 huruf.')
    if (harga === '' || Number(harga) < 0) return setGalat('Isi harga produk.')
    const lengkap = komposisi.filter((k) => k.id_jenis_bunga && k.id_warna && k.jumlah_tangkai > 0)
    if (!lengkap.length) return setGalat('Tambahkan minimal satu bunga pada komposisi.')
    const isian: Skema['ProdukIn'] = {
      nama_produk: nama.trim(),
      acara: acaraIsi.trim() || null,
      harga: Number(harga),
      deskripsi: deskripsi.trim() || null,
      ditampilkan: tampil,
      komposisi: lengkap.map((k) => ({
        id_jenis_bunga: Number(k.id_jenis_bunga),
        id_warna: Number(k.id_warna),
        jumlah_tangkai: Number(k.jumlah_tangkai),
      })),
    }
    try {
      const hasil = produk ? await ubah.mutateAsync({ id: produk.id_produk, isian }) : await tambah.mutateAsync(isian)
      if (foto) await unggah.mutateAsync({ id: hasil.id_produk, foto })
      tampilkanToast(baru ? 'Produk ditambahkan.' : 'Perubahan produk disimpan.')
      navigasi('/admin/katalog')
    } catch (err) {
      setGalat(pesanGalat(err))
    }
  }

  const menyimpan = tambah.isPending || ubah.isPending || unggah.isPending

  return (
    <form onSubmit={kirim} noValidate>
      <JudulAdmin
        judul={baru ? 'Tambah Produk' : `Ubah: ${produk?.nama_produk}`}
        jejak={[
          { ke: '/admin', label: 'Dasbor' },
          { ke: '/admin/katalog', label: 'Katalog' },
        ]}
        aksi={
          <Tombol type="submit" varian="admin" className="rounded-xl" memuat={menyimpan}>
            Simpan produk
          </Tombol>
        }
      />
      {galat && (
        <p role="alert" className="mb-4 rounded-xl bg-ad-bahaya-lembut p-3 text-sm font-medium text-ad-bahaya">
          {galat}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Kartu>
            <h2 className="mb-3 text-lg font-bold">Informasi produk</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Bidang label="Nama produk" gaya="admin" wajib className="sm:col-span-2">
                <Masukan gaya="admin" value={nama} onChange={(e) => setNama(e.target.value)} maxLength={100} />
              </Bidang>
              <Bidang label="Acara / momen" gaya="admin" bantuan="Pilih yang ada atau ketik baru.">
                <Masukan gaya="admin" list="daftar-acara" value={acaraIsi} onChange={(e) => setAcaraIsi(e.target.value)} maxLength={50} />
              </Bidang>
              <datalist id="daftar-acara">
                {acara.data?.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </datalist>
              <Bidang label="Harga (Rp)" gaya="admin" wajib bantuan={harga ? formatRupiah(Number(harga)) : undefined}>
                <Masukan
                  gaya="admin"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={harga}
                  onChange={(e) => setHarga(e.target.value)}
                />
              </Bidang>
              <Bidang label="Deskripsi" gaya="admin" className="sm:col-span-2">
                <AreaTeks gaya="admin" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} maxLength={2000} />
              </Bidang>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <input type="checkbox" checked={tampil} onChange={(e) => setTampil(e.target.checked)} className="size-4 accent-ad-aksen" />
                Tampilkan di katalog pelanggan
              </label>
            </div>
          </Kartu>
          <Kartu>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Komposisi bunga</h2>
              <p className="text-sm text-ad-redup">{totalTangkai} tangkai</p>
            </div>
            <ul className="flex flex-col gap-3">
              {komposisi.map((k, i) => {
                const w = warna.data?.find((x) => x.id_warna === k.id_warna)
                return (
                  <li
                    key={k.kunci}
                    className="grid gap-2 rounded-xl border border-ad-garis p-3 sm:grid-cols-[1.3fr_1.3fr_6rem_auto] sm:items-end"
                  >
                    <Bidang label={`Jenis bunga ${i + 1}`} gaya="admin">
                      <Pilihan
                        gaya="admin"
                        value={k.id_jenis_bunga}
                        onChange={(e) => ubahBaris(k.kunci, { id_jenis_bunga: e.target.value ? Number(e.target.value) : '' })}
                      >
                        <option value="">Pilih jenis…</option>
                        {jenis.data?.map((j) => (
                          <option key={j.id_jenis_bunga} value={j.id_jenis_bunga}>
                            {j.nama_bunga}
                          </option>
                        ))}
                      </Pilihan>
                    </Bidang>
                    <Bidang label={`Warna ${i + 1}`} gaya="admin">
                      <Pilihan
                        gaya="admin"
                        value={k.id_warna}
                        onChange={(e) => ubahBaris(k.kunci, { id_warna: e.target.value ? Number(e.target.value) : '' })}
                        style={w ? { borderInlineStartWidth: 8, borderInlineStartColor: w.kode_hex } : undefined}
                      >
                        <option value="">Pilih warna…</option>
                        {warna.data?.map((x) => (
                          <option key={x.id_warna} value={x.id_warna}>
                            {x.nama_warna} — {x.kode_hex.toUpperCase()}
                          </option>
                        ))}
                      </Pilihan>
                    </Bidang>
                    <Bidang label="Tangkai" gaya="admin">
                      <Masukan
                        gaya="admin"
                        type="number"
                        min={1}
                        max={1000}
                        value={k.jumlah_tangkai}
                        onChange={(e) => ubahBaris(k.kunci, { jumlah_tangkai: Number(e.target.value) })}
                      />
                    </Bidang>
                    <Tombol
                      varian="admin-garis"
                      ukuran="ikon"
                      className="rounded-xl"
                      aria-label={`Hapus baris ${i + 1}`}
                      disabled={komposisi.length === 1}
                      onClick={() => setKomposisi((ks) => ks.filter((x) => x.kunci !== k.kunci))}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Tombol>
                  </li>
                )
              })}
            </ul>
            <Tombol
              varian="admin-lembut"
              ukuran="kecil"
              className="mt-3 rounded-lg"
              ikon={<Plus aria-hidden className="size-4" />}
              onClick={() => setKomposisi((ks) => [...ks, barisBaru()])}
            >
              Tambah bunga
            </Tombol>
          </Kartu>
        </div>
        <Kartu className="self-start">
          <h2 className="mb-3 text-lg font-bold">Foto produk</h2>
          {produk?.foto_url && !foto && (
            <FotoBunga src={produk.foto_url} alt={`Foto ${produk.nama_produk} saat ini`} className="mb-3 aspect-square w-full rounded-xl" />
          )}
          <UnggahFoto gaya="admin" label={produk?.foto_url ? 'Ganti foto' : 'Pilih foto produk'} berkas={foto} ubah={setFoto} />
          <p className="mt-2 text-xs text-ad-redup">Gunakan foto persegi dengan latar polos agar katalog tampak rapi.</p>
        </Kartu>
      </div>
    </form>
  )
}
