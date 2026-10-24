import { useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, Heart, LogOut, MapPin, MessageSquareReply, Pencil, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { pesanGalat, type Skema } from '@/api/client'
import {
  useAlamat,
  useFavorit,
  useGantiKataSandi,
  useHapusAlamat,
  useJadikanUtama,
  useKeluarSemua,
  useKomplainSaya,
  usePesananSaya,
  useSaya,
  useSimpanAlamat,
  useUbahProfil,
} from '@/api/pelanggan'
import { hapusSesi } from '@/auth/sesi'
import { GridProduk } from '@/fitur/katalog/KartuProduk'
import { AreaTeks, Bidang, Masukan } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Kerangka, Kosong, Memuat } from '@/komponen/ui/Keadaan'
import { LencanaStatus, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { TautanTombol, Tombol } from '@/komponen/ui/Tombol'
import { formatTanggal, formatTanggalJam } from '@/lib/format'
import { TombolPasang } from '@/pwa/KomponenPwa'
import { JudulAkun } from '@/tata-letak/TataLetakAkun'
import { IkonStatus } from '@/komponen/ui/IkonStatus'

/* ---------------- Profil ---------------- */

export function HalamanProfil() {
  useJudul('Profil Saya')
  const { data: saya, isPending, isError, error, refetch } = useSaya()
  const ubah = useUbahProfil()
  const gantiSandi = useGantiKataSandi()
  const keluarSemua = useKeluarSemua()
  const qc = useQueryClient()
  const navigasi = useNavigate()
  const [isian, setIsian] = useState<{ nama: string; email: string; no_hp: string } | null>(null)
  const [sandi, setSandi] = useState({ lama: '', baru: '', ulang: '' })
  const [galatSandi, setGalatSandi] = useState<string | null>(null)

  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />
  const nilai = isian ?? { nama: saya.nama, email: saya.email, no_hp: saya.no_hp ?? '' }
  const berubah = nilai.nama !== saya.nama || nilai.email !== saya.email || nilai.no_hp !== (saya.no_hp ?? '')

  async function simpan(e: FormEvent) {
    e.preventDefault()
    try {
      await ubah.mutateAsync({ nama: nilai.nama.trim(), email: nilai.email.trim(), no_hp: nilai.no_hp.trim() })
      setIsian(null)
      tampilkanToast('Profil diperbarui.')
    } catch (err) {
      tampilkanToast(pesanGalat(err), 'galat')
    }
  }

  async function simpanSandi(e: FormEvent) {
    e.preventDefault()
    setGalatSandi(null)
    if (sandi.baru.length < 8) return setGalatSandi('Kata sandi baru minimal 8 karakter.')
    if (sandi.baru !== sandi.ulang) return setGalatSandi('Ulangi kata sandi baru dengan sama persis.')
    try {
      await gantiSandi.mutateAsync({ kata_sandi_lama: sandi.lama, kata_sandi_baru: sandi.baru })
      setSandi({ lama: '', baru: '', ulang: '' })
      tampilkanToast('Kata sandi diganti. Sesi di perangkat lain telah diakhiri.')
    } catch (err) {
      setGalatSandi(pesanGalat(err))
    }
  }

  return (
    <>
      <JudulAkun judul="Profil Saya" keterangan="Kelola informasi pribadi dan kontakmu." />
      <div className="flex flex-col gap-6">
        <form onSubmit={simpan} className="rounded-3xl bg-permukaan p-5 ring-1 ring-garis/60">
          <div className="mb-5 flex items-center gap-4">
            <span aria-hidden className="grid size-16 place-items-center rounded-full bg-rose-teks font-display text-2xl text-white">
              {saya.nama.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-display text-xl text-rose-tua">{saya.nama}</p>
              <p className="text-sm text-redup">Pelanggan sejak {formatTanggal(saya.dibuat_pada)}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Nama">
              <Masukan
                value={nilai.nama}
                onChange={(e) => setIsian({ ...nilai, nama: e.target.value })}
                autoComplete="name"
                maxLength={100}
              />
            </Bidang>
            <Bidang label="Email">
              <Masukan
                type="email"
                value={nilai.email}
                onChange={(e) => setIsian({ ...nilai, email: e.target.value })}
                autoComplete="email"
              />
            </Bidang>
            <Bidang label="Nomor WhatsApp" bantuan="Dipakai florist untuk menghubungi Anda bila perlu.">
              <Masukan
                type="tel"
                inputMode="tel"
                value={nilai.no_hp}
                onChange={(e) => setIsian({ ...nilai, no_hp: e.target.value })}
                autoComplete="tel"
                maxLength={20}
              />
            </Bidang>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tombol type="submit" memuat={ubah.isPending} disabled={!berubah}>
              Simpan perubahan
            </Tombol>
            {berubah && (
              <Tombol varian="teks" onClick={() => setIsian(null)}>
                Batal
              </Tombol>
            )}
          </div>
        </form>

        <form onSubmit={simpanSandi} className="rounded-3xl bg-permukaan p-5 ring-1 ring-garis/60">
          <h2 className="mb-1 flex items-center gap-2 font-display text-xl text-olive-tua">
            <ShieldCheck aria-hidden className="size-5 text-rose-teks" /> Keamanan akun
          </h2>
          <p className="mb-4 text-sm text-redup">Mengganti kata sandi akan mengakhiri sesi di perangkat lain.</p>
          {galatSandi && (
            <p role="alert" className="mb-3 rounded-2xl bg-[#fce8e7] px-4 py-2 text-sm text-[#7a1814]">
              {galatSandi}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Bidang label="Kata sandi lama">
              <Masukan
                type="password"
                autoComplete="current-password"
                value={sandi.lama}
                onChange={(e) => setSandi({ ...sandi, lama: e.target.value })}
              />
            </Bidang>
            <Bidang label="Kata sandi baru">
              <Masukan
                type="password"
                autoComplete="new-password"
                value={sandi.baru}
                onChange={(e) => setSandi({ ...sandi, baru: e.target.value })}
              />
            </Bidang>
            <Bidang label="Ulangi kata sandi baru">
              <Masukan
                type="password"
                autoComplete="new-password"
                value={sandi.ulang}
                onChange={(e) => setSandi({ ...sandi, ulang: e.target.value })}
              />
            </Bidang>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tombol type="submit" varian="garis" memuat={gantiSandi.isPending} disabled={!sandi.lama || !sandi.baru}>
              Ganti kata sandi
            </Tombol>
            <Tombol
              varian="teks"
              ikon={<LogOut aria-hidden className="size-4" />}
              memuat={keluarSemua.isPending}
              onClick={async () => {
                try {
                  await keluarSemua.mutateAsync()
                  hapusSesi()
                  qc.clear()
                  tampilkanToast('Anda telah keluar dari semua perangkat.')
                  navigasi('/masuk', { replace: true })
                } catch (err) {
                  tampilkanToast(pesanGalat(err), 'galat')
                }
              }}
            >
              Keluar dari semua perangkat
            </Tombol>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-blush/60 p-5">
          <p className="flex-1 text-sm text-olive">
            <strong className="block font-display text-lg text-olive-tua">Pasang FlowerBloom</strong>
            Akses lebih cepat dari layar utama ponsel atau desktop Anda.
          </p>
          <TombolPasang varian="garis" />
        </div>
      </div>
    </>
  )
}

/* ---------------- Favorit ---------------- */

export function HalamanFavorit() {
  useJudul('Produk Favorit')
  const { data, isPending, isError, error, refetch } = useFavorit()
  return (
    <>
      <JudulAkun judul="Produk Favorit" keterangan="Rangkaian yang kamu simpan untuk nanti." />
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Kerangka key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.length === 0 ? (
        <Kosong
          ikon={<Heart className="size-8" />}
          judul="Belum ada favorit"
          pesan="Ketuk ikon hati pada rangkaian yang kamu suka untuk menyimpannya di sini."
          aksi={<TautanTombol to="/katalog">Jelajahi katalog</TautanTombol>}
        />
      ) : (
        <GridProduk daftar={data} className="lg:grid-cols-3 xl:grid-cols-3" />
      )}
    </>
  )
}

/* ---------------- Alamat ---------------- */

const ALAMAT_KOSONG: Skema['AlamatIn'] = { label: '', nama_penerima: '', no_hp: '', alamat: '', catatan: '', utama: false }

function DialogAlamat({ awal, saatTutup }: { awal: Skema['AlamatOut'] | 'baru' | null; saatTutup: () => void }) {
  const simpan = useSimpanAlamat()
  const [isian, setIsian] = useState<Skema['AlamatIn']>(ALAMAT_KOSONG)
  const [terakhir, setTerakhir] = useState<typeof awal>(null)
  const [galat, setGalat] = useState<Record<string, string>>({})
  if (awal !== terakhir) {
    setTerakhir(awal)
    setGalat({})
    setIsian(awal && awal !== 'baru' ? { ...awal, catatan: awal.catatan ?? '' } : ALAMAT_KOSONG)
  }
  const ubah = (k: keyof Skema['AlamatIn']) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setIsian((s) => ({ ...s, [k]: e.target.value }))

  async function kirim(e: FormEvent) {
    e.preventDefault()
    const g: Record<string, string> = {}
    if (!isian.label.trim()) g.label = 'Beri nama, mis. Rumah atau Kantor.'
    if (isian.nama_penerima.trim().length < 2) g.nama_penerima = 'Nama penerima minimal 2 huruf.'
    if (!/^\+?[0-9 ()-]{8,20}$/.test(isian.no_hp)) g.no_hp = 'Nomor HP 8–20 digit.'
    if (isian.alamat.trim().length < 10) g.alamat = 'Alamat minimal 10 karakter.'
    setGalat(g)
    if (Object.keys(g).length) return
    try {
      await simpan.mutateAsync({
        id: awal && awal !== 'baru' ? awal.id_alamat : undefined,
        isian: { ...isian, catatan: isian.catatan?.trim() || null },
      })
      tampilkanToast('Alamat disimpan.')
      saatTutup()
    } catch (err) {
      setGalat({ umum: pesanGalat(err) })
    }
  }

  return (
    <Dialog
      terbuka={awal !== null}
      saatTutup={saatTutup}
      judul={awal === 'baru' ? 'Tambah alamat' : 'Ubah alamat'}
      kaki={
        <>
          <Tombol varian="garis" onClick={saatTutup}>
            Batal
          </Tombol>
          <Tombol type="submit" form="form-alamat" memuat={simpan.isPending}>
            Simpan alamat
          </Tombol>
        </>
      }
    >
      <form id="form-alamat" onSubmit={kirim} noValidate className="grid gap-4 sm:grid-cols-2">
        {galat.umum && (
          <p role="alert" className="rounded-2xl bg-[#fce8e7] px-4 py-2 text-sm text-[#7a1814] sm:col-span-2">
            {galat.umum}
          </p>
        )}
        <Bidang label="Label" wajib galat={galat.label}>
          <Masukan value={isian.label} onChange={ubah('label')} placeholder="Rumah" maxLength={50} />
        </Bidang>
        <Bidang label="Nama penerima" wajib galat={galat.nama_penerima}>
          <Masukan value={isian.nama_penerima} onChange={ubah('nama_penerima')} autoComplete="name" maxLength={100} />
        </Bidang>
        <Bidang label="Nomor HP penerima" wajib galat={galat.no_hp} className="sm:col-span-2">
          <Masukan type="tel" inputMode="tel" value={isian.no_hp} onChange={ubah('no_hp')} autoComplete="tel" maxLength={20} />
        </Bidang>
        <Bidang label="Alamat lengkap" wajib galat={galat.alamat} className="sm:col-span-2">
          <AreaTeks value={isian.alamat} onChange={ubah('alamat')} autoComplete="street-address" maxLength={500} />
        </Bidang>
        <Bidang label="Patokan / catatan kurir (opsional)" className="sm:col-span-2">
          <Masukan value={isian.catatan ?? ''} onChange={ubah('catatan')} maxLength={255} placeholder="Pagar hijau, sebelah masjid" />
        </Bidang>
        <label className="flex items-center gap-2 text-sm text-olive-tua sm:col-span-2">
          <input
            type="checkbox"
            checked={!!isian.utama}
            onChange={(e) => setIsian((s) => ({ ...s, utama: e.target.checked }))}
            className="size-4 accent-rose-teks"
          />
          Jadikan alamat utama
        </label>
      </form>
    </Dialog>
  )
}

export function HalamanAlamat() {
  useJudul('Alamat Tersimpan')
  const { data, isPending, isError, error, refetch } = useAlamat()
  const utama = useJadikanUtama()
  const hapus = useHapusAlamat()
  const [sunting, setSunting] = useState<Skema['AlamatOut'] | 'baru' | null>(null)
  const [akanHapus, setAkanHapus] = useState<Skema['AlamatOut'] | null>(null)

  return (
    <>
      <JudulAkun
        judul="Alamat Tersimpan"
        keterangan="Pilih cepat saat checkout."
        aksi={
          <Tombol ukuran="kecil" ikon={<Plus aria-hidden className="size-4" />} onClick={() => setSunting('baru')}>
            Tambah alamat
          </Tombol>
        }
      />
      {isPending ? (
        <Kerangka className="h-32" />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.length === 0 ? (
        <Kosong
          ikon={<MapPin className="size-8" />}
          judul="Belum ada alamat"
          pesan="Simpan alamat agar checkout pengantaran lebih cepat."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((a) => (
            <li key={a.id_alamat} className="rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
              <div className="flex flex-wrap items-start gap-3">
                <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-rose-teks" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-display text-lg text-olive-tua">
                    {a.label}
                    {a.utama && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-teks px-2 py-0.5 font-sans text-xs font-bold text-white">
                        <Star aria-hidden className="size-3" /> Utama
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-semibold">
                    {a.nama_penerima} · {a.no_hp}
                  </p>
                  <p className="text-sm text-olive">{a.alamat}</p>
                  {a.catatan && <p className="text-xs text-redup">Patokan: {a.catatan}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:ps-8">
                {!a.utama && (
                  <Tombol
                    varian="lembut"
                    ukuran="kecil"
                    memuat={utama.isPending && utama.variables === a.id_alamat}
                    onClick={() => utama.mutate(a.id_alamat, { onError: (e) => tampilkanToast(pesanGalat(e), 'galat') })}
                  >
                    Jadikan utama
                  </Tombol>
                )}
                <Tombol varian="garis" ukuran="kecil" ikon={<Pencil aria-hidden className="size-4" />} onClick={() => setSunting(a)}>
                  Ubah
                </Tombol>
                <Tombol varian="teks" ukuran="kecil" ikon={<Trash2 aria-hidden className="size-4" />} onClick={() => setAkanHapus(a)}>
                  Hapus
                </Tombol>
              </div>
            </li>
          ))}
        </ul>
      )}
      <DialogAlamat awal={sunting} saatTutup={() => setSunting(null)} />
      <Dialog
        terbuka={!!akanHapus}
        saatTutup={() => setAkanHapus(null)}
        judul="Hapus alamat?"
        deskripsi={akanHapus ? `Alamat “${akanHapus.label}” akan dihapus.` : undefined}
        lebar="sm"
        kaki={
          <>
            <Tombol varian="garis" onClick={() => setAkanHapus(null)}>
              Batal
            </Tombol>
            <Tombol
              varian="bahaya"
              memuat={hapus.isPending}
              onClick={async () => {
                if (!akanHapus) return
                try {
                  await hapus.mutateAsync(akanHapus.id_alamat)
                  tampilkanToast('Alamat dihapus.')
                  setAkanHapus(null)
                } catch (e) {
                  tampilkanToast(pesanGalat(e), 'galat')
                }
              }}
            >
              Hapus
            </Tombol>
          </>
        }
      >
        <p className="text-sm text-olive">Pesanan yang sudah dibuat tidak terpengaruh.</p>
      </Dialog>
    </>
  )
}

/* ---------------- Notifikasi ---------------- */

/** Notifikasi diturunkan dari status pesanan dan tanggapan komplain (backend tidak menyimpan tabel notifikasi). */
export function HalamanNotifikasi() {
  useJudul('Notifikasi')
  const pesanan = usePesananSaya(undefined, 1, 30)
  const komplain = useKomplainSaya()
  if (pesanan.isPending || komplain.isPending) return <Memuat />
  if (pesanan.isError) return <Galat galat={pesanan.error} ulangi={() => void pesanan.refetch()} />

  const perlu = pesanan.data.data.filter((p) => p.perlu_tindakan_pelanggan)
  const terbaru = pesanan.data.data.filter((p) => !p.perlu_tindakan_pelanggan).slice(0, 10)
  const ditanggapi = (komplain.data ?? []).filter((k) => k.tanggapan_admin)

  return (
    <>
      <JudulAkun judul="Notifikasi" keterangan="Hal yang perlu kamu tindak lanjuti dan kabar terbaru pesananmu." />
      {perlu.length === 0 && terbaru.length === 0 && ditanggapi.length === 0 ? (
        <Kosong ikon={<Bell className="size-8" />} judul="Belum ada notifikasi" pesan="Kabar tentang pesananmu akan muncul di sini." />
      ) : (
        <div className="flex flex-col gap-6">
          {perlu.length > 0 && (
            <section aria-labelledby="judul-perlu">
              <h2 id="judul-perlu" className="mb-2 font-display text-xl text-olive-tua">
                Perlu tindakanmu
              </h2>
              <ul className="flex flex-col gap-2">
                {perlu.map((p) => (
                  <li key={p.id_pesanan}>
                    <Link
                      to={`/akun/pesanan/${p.id_pesanan}`}
                      className="flex items-start gap-3 rounded-3xl bg-blush p-4 ring-2 ring-magenta/60"
                    >
                      <IkonStatus nama={p.status.ikon} className="mt-0.5 size-5 shrink-0 text-rose-tua" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-olive-tua">
                          {p.status.label} · <span className="font-mono">{p.kode_pesanan}</span>
                        </span>
                        <span className="block text-sm text-olive">{p.status.keterangan}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {ditanggapi.length > 0 && (
            <section aria-labelledby="judul-komplain">
              <h2 id="judul-komplain" className="mb-2 font-display text-xl text-olive-tua">
                Tanggapan komplain
              </h2>
              <ul className="flex flex-col gap-2">
                {ditanggapi.map((k) => (
                  <li key={k.id_komplain} className="flex items-start gap-3 rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
                    <MessageSquareReply aria-hidden className="mt-0.5 size-5 shrink-0 text-rose-teks" />
                    <span className="text-sm">
                      <span className="block font-semibold">
                        Pesanan <span className="font-mono">{k.kode_pesanan}</span>
                      </span>
                      {k.tanggapan_admin}
                      {k.ditanggapi_pada && <span className="block text-xs text-redup">{formatTanggalJam(k.ditanggapi_pada)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {terbaru.length > 0 && (
            <section aria-labelledby="judul-terbaru">
              <h2 id="judul-terbaru" className="mb-2 font-display text-xl text-olive-tua">
                Kabar pesanan
              </h2>
              <ul className="flex flex-col gap-2">
                {terbaru.map((p) => (
                  <li key={p.id_pesanan}>
                    <Link
                      to={`/akun/pesanan/${p.id_pesanan}`}
                      className="flex flex-wrap items-center gap-3 rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60 hover:bg-blush/40"
                    >
                      <CheckCircle2 aria-hidden className="size-5 text-rose-teks" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-semibold">{p.ringkasan_item}</span>
                        <span className="font-mono text-xs text-redup">{p.kode_pesanan}</span>
                      </span>
                      <LencanaStatus status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}
