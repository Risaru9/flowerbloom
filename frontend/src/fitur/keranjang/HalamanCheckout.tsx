import { CalendarDays, Clock, MapPin, Store, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import { pesanGalat } from '@/api/client'
import { useAlamat, useCheckout, useInfoToko } from '@/api/pelanggan'
import { useSesi } from '@/auth/sesi'
import { AreaTeks, Bidang, Masukan } from '@/komponen/ui/Bidang'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'
import { formatRupiah, formatTanggalHari, tanggalWibPlus } from '@/lib/format'

import { usePratinjauKeranjang } from './HalamanKeranjang'
import { keItemApi, kosongkanKeranjang } from './keranjang'

type Cara = 'ambil_di_toko' | 'antar'

function KartuPilihan({
  nama,
  nilai,
  dipilih,
  ubah,
  judul,
  ket,
  ikon,
}: {
  nama: string
  nilai: string
  dipilih: boolean
  ubah: () => void
  judul: string
  ket?: string
  ikon?: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-magenta',
        dipilih ? 'border-rose-teks bg-blush' : 'border-garis bg-permukaan hover:bg-blush/50',
      )}
    >
      <input type="radio" name={nama} value={nilai} checked={dipilih} onChange={ubah} className="mt-1 size-4 accent-rose-teks" />
      {ikon && <span aria-hidden className="text-rose-teks">{ikon}</span>}
      <span>
        <span className="block font-semibold text-olive-tua">{judul}</span>
        {ket && <span className="block text-sm text-redup">{ket}</span>}
      </span>
    </label>
  )
}

export function HalamanCheckout() {
  useJudul('Checkout')
  const sesi = useSesi()
  const info = useInfoToko()
  const alamatTersimpan = useAlamat()
  const [cara, setCara] = useState<Cara>('ambil_di_toko')
  const { isi, pratinjau } = usePratinjauKeranjang(cara)
  const checkout = useCheckout()
  const navigasi = useNavigate()

  const [nama, setNama] = useState(sesi?.pengguna.nama ?? '')
  const [pilihanAlamat, setIdAlamat] = useState<number | 'baru' | null>(null)
  const [alamatBaru, setAlamatBaru] = useState('')
  const [kartu, setKartu] = useState('')
  const [tanggalDipilih, setTanggal] = useState('')
  const [slotDipilih, setSlot] = useState('')
  const [galat, setGalat] = useState<Record<string, string>>({})

  // Nilai bawaan diturunkan dari data toko/alamat sampai pengguna memilih sendiri.
  const tanggal = tanggalDipilih || (info.data ? tanggalWibPlus(info.data.minimal_hari_pemesanan) : '')
  const slot = slotDipilih || info.data?.slot_pengiriman[0] || ''
  const idAlamat = pilihanAlamat ?? alamatTersimpan.data?.find((a) => a.utama)?.id_alamat ?? 'baru'

  if (isi.length === 0 && !checkout.isSuccess) return <Navigate to="/keranjang" replace />
  if (info.isPending) return <Memuat />
  if (info.isError) return <Galat galat={info.error} ulangi={() => void info.refetch()} className="m-6" />

  const toko = info.data
  const minTanggal = tanggalWibPlus(toko.minimal_hari_pemesanan)
  const maksTanggal = tanggalWibPlus(90)
  const alamatDipilih = alamatTersimpan.data?.find((a) => a.id_alamat === idAlamat)
  const teksAlamat = alamatDipilih
    ? `${alamatDipilih.alamat}${alamatDipilih.catatan ? ` (${alamatDipilih.catatan})` : ''} · ${alamatDipilih.nama_penerima} ${alamatDipilih.no_hp}`
    : alamatBaru.trim()
  const data = pratinjau.data
  const masalah = data?.masalah ?? []

  async function kirim(e: FormEvent) {
    e.preventDefault()
    const g: Record<string, string> = {}
    if (nama.trim().length < 2) g.nama = 'Nama penerima minimal 2 huruf.'
    if (cara === 'antar' && teksAlamat.length < 10) g.alamat = 'Isi alamat pengantaran dengan lengkap.'
    if (!tanggal || tanggal < minTanggal) g.tanggal = `Pilih tanggal mulai ${formatTanggalHari(minTanggal)}.`
    if (!slot) g.slot = 'Pilih slot jam.'
    setGalat(g)
    if (Object.keys(g).length) {
      document.getElementById(`bidang-${Object.keys(g)[0]}`)?.focus()
      return
    }
    try {
      const pesanan = await checkout.mutateAsync({
        items: isi.map(keItemApi),
        cara_serah_terima: cara,
        nama_penerima: nama.trim(),
        alamat: cara === 'antar' ? teksAlamat : null,
        tanggal_kirim: tanggal,
        slot_jam: slot,
        kartu_ucapan: kartu.trim() || null,
      })
      kosongkanKeranjang()
      tampilkanToast(`Pesanan ${pesanan.kode_pesanan} dibuat. Selesaikan pembayaran.`)
      navigasi(`/pesanan/${pesanan.id_pesanan}/bayar`, { replace: true })
    } catch (err) {
      tampilkanToast(pesanGalat(err), 'galat', 7000)
      pratinjau.mutate({ items: isi.map(keItemApi), cara_serah_terima: cara })
    }
  }

  return (
    <form onSubmit={kirim} noValidate className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <h1 className="mb-6 font-display text-4xl text-rose-teks">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <fieldset className="rounded-[2rem] bg-latar-2/60 p-5">
            <legend className="sr-only">Cara serah terima</legend>
            <h2 aria-hidden className="mb-3 font-display text-2xl text-olive-tua">
              1. Cara serah terima
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <KartuPilihan
                nama="cara"
                nilai="ambil_di_toko"
                dipilih={cara === 'ambil_di_toko'}
                ubah={() => setCara('ambil_di_toko')}
                judul="Ambil di toko"
                ket="Gratis, ambil sesuai slot jam"
                ikon={<Store className="size-5" />}
              />
              <KartuPilihan
                nama="cara"
                nilai="antar"
                dipilih={cara === 'antar'}
                ubah={() => setCara('antar')}
                judul="Diantar kurir"
                ket={`Ongkos ${formatRupiah(toko.ongkos_antar)}`}
                ikon={<Truck className="size-5" />}
              />
            </div>
          </fieldset>

          <section aria-labelledby="judul-penerima" className="flex flex-col gap-4 rounded-[2rem] bg-latar-2/60 p-5">
            <h2 id="judul-penerima" className="font-display text-2xl text-olive-tua">
              2. Penerima
            </h2>
            <Bidang label="Nama penerima" wajib galat={galat.nama}>
              <Masukan id="bidang-nama" value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" maxLength={100} />
            </Bidang>
            {cara === 'antar' && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold text-olive-tua">
                  Alamat pengantaran <span className="text-[#a01f1a]">*</span>
                </legend>
                {alamatTersimpan.data?.map((a) => (
                  <KartuPilihan
                    key={a.id_alamat}
                    nama="alamat"
                    nilai={String(a.id_alamat)}
                    dipilih={idAlamat === a.id_alamat}
                    ubah={() => setIdAlamat(a.id_alamat)}
                    judul={`${a.label}${a.utama ? ' · Utama' : ''}`}
                    ket={`${a.nama_penerima} · ${a.no_hp} — ${a.alamat}`}
                    ikon={<MapPin className="size-5" />}
                  />
                ))}
                {!!alamatTersimpan.data?.length && (
                  <KartuPilihan nama="alamat" nilai="baru" dipilih={idAlamat === 'baru'} ubah={() => setIdAlamat('baru')} judul="Gunakan alamat lain" />
                )}
                {(idAlamat === 'baru' || !alamatTersimpan.data?.length) && (
                  <Bidang label="Alamat lengkap" labelTersembunyi={!!alamatTersimpan.data?.length} galat={galat.alamat} bantuan="Sertakan nomor rumah, patokan, dan nomor HP penerima.">
                    <AreaTeks id="bidang-alamat" value={alamatBaru} onChange={(e) => setAlamatBaru(e.target.value)} autoComplete="street-address" maxLength={480} />
                  </Bidang>
                )}
                {galat.alamat && idAlamat !== 'baru' && !!alamatTersimpan.data?.length && (
                  <p role="alert" className="text-xs font-medium text-[#a01f1a]">
                    {galat.alamat}
                  </p>
                )}
                <Link to="/akun/alamat" className="self-start text-sm font-semibold text-rose-teks underline">
                  Kelola alamat tersimpan
                </Link>
              </fieldset>
            )}
            <Bidang label="Kartu ucapan (opsional)" bantuan={`${kartu.length}/500 karakter`}>
              <AreaTeks value={kartu} onChange={(e) => setKartu(e.target.value)} maxLength={500} placeholder="Selamat ulang tahun, semoga…" />
            </Bidang>
          </section>

          <section aria-labelledby="judul-jadwal" className="flex flex-col gap-4 rounded-[2rem] bg-latar-2/60 p-5">
            <h2 id="judul-jadwal" className="font-display text-2xl text-olive-tua">
              3. Jadwal {cara === 'antar' ? 'pengantaran' : 'pengambilan'}
            </h2>
            <Bidang
              label="Tanggal"
              wajib
              galat={galat.tanggal}
              bantuan={`Paling cepat ${formatTanggalHari(minTanggal)} (pemesanan H-${toko.minimal_hari_pemesanan}).`}
            >
              <Masukan id="bidang-tanggal" type="date" min={minTanggal} max={maksTanggal} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </Bidang>
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-olive-tua">
                <Clock aria-hidden className="size-4" /> Slot jam <span className="text-[#a01f1a]">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {toko.slot_pengiriman.map((s, i) => (
                  <label
                    key={s}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border-2 text-sm font-semibold',
                      'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-magenta',
                      slot === s ? 'border-rose-teks bg-rose-teks text-white' : 'border-garis bg-permukaan text-olive-tua',
                    )}
                  >
                    <input id={i === 0 ? 'bidang-slot' : undefined} type="radio" name="slot" className="sr-only" checked={slot === s} onChange={() => setSlot(s)} />
                    {s}
                  </label>
                ))}
              </div>
              {galat.slot && (
                <p role="alert" className="mt-1 text-xs font-medium text-[#a01f1a]">
                  {galat.slot}
                </p>
              )}
            </fieldset>
          </section>
        </div>

        <aside aria-labelledby="judul-ringkasan-co" className="self-start rounded-[2rem] bg-blush/70 p-5 lg:sticky lg:top-28">
          <h2 id="judul-ringkasan-co" className="mb-4 font-display text-2xl text-olive-tua">
            Ringkasan pesanan
          </h2>
          <dl className="flex flex-col gap-2 text-sm" aria-busy={pratinjau.isPending}>
            {(data?.items ?? []).map((it, idx) => (
              <div key={idx} className="flex justify-between gap-3">
                <dt className="min-w-0">
                  {it.jumlah}× {it.nama}
                  <span className="block text-xs text-redup">{it.jumlah_tangkai} tangkai</span>
                </dt>
                <dd>{formatRupiah(it.subtotal)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-garis/70 pt-2">
              <dt>Subtotal</dt>
              <dd>{formatRupiah(data?.subtotal ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Ongkos antar</dt>
              <dd>{formatRupiah(data?.ongkos_antar ?? 0)}</dd>
            </div>
            <div className="flex justify-between text-lg font-bold text-rose-teks">
              <dt>Total</dt>
              <dd>{formatRupiah(data?.total_harga ?? 0)}</dd>
            </div>
          </dl>
          {tanggal && slot && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-latar/70 p-3 text-xs text-olive">
              <CalendarDays aria-hidden className="size-4 shrink-0" />
              {cara === 'antar' ? 'Diantar' : 'Diambil'} {formatTanggalHari(tanggal)}, pukul {slot}
            </p>
          )}
          {masalah.length > 0 && (
            <p role="alert" className="mt-3 rounded-2xl bg-[#fce8e7] p-3 text-xs text-[#7a1814]">
              Stok tidak cukup untuk: {masalah.map((m) => m.bunga).join(', ')}. Ubah keranjang terlebih dahulu.
            </p>
          )}
          <Tombol type="submit" penuh ukuran="besar" className="mt-5" memuat={checkout.isPending} disabled={masalah.length > 0 || !data}>
            Buat pesanan
          </Tombol>
          <p className="mt-3 text-xs text-redup">
            Stok ditahan untuk Anda selama {toko.batas_bayar_menit} menit. Lakukan pembayaran sebelum batas waktu agar pesanan tidak batal otomatis.
          </p>
        </aside>
      </div>
    </form>
  )
}
