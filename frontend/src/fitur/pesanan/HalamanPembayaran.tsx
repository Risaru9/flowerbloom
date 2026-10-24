import { CircleAlert, Copy, Landmark, Timer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { pesanGalat } from '@/api/client'
import { useInfoToko, usePesanan, useUnggahBukti } from '@/api/pelanggan'
import { Bidang, Masukan } from '@/komponen/ui/Bidang'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { LencanaStatus, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { kelasTombol, TautanTombol, Tombol } from '@/komponen/ui/Tombol'
import { formatRupiah, formatTanggalHari, tautanWa } from '@/lib/format'

import { HitungMundur, UnggahFoto } from './bersama'

export function HalamanPembayaran() {
  useJudul('Pembayaran')
  const id = Number(useParams().id)
  const { data: p, isPending, isError, error, refetch } = usePesanan(id, { pantau: true })
  const { data: info } = useInfoToko()
  const unggah = useUnggahBukti(id)
  const navigasi = useNavigate()
  const [bukti, setBukti] = useState<File | null>(null)
  const [nama, setNama] = useState('')
  const [nominal, setNominal] = useState('')
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [lewat, setLewat] = useState(false)

  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} className="m-6" />

  const ditolak = [...p.pembayaran].reverse().find((b) => b.status_verifikasi === 'ditolak')
  const wa = tautanWa(info?.no_hp_toko, `Halo ${info?.nama_toko ?? 'FlowerBloom'}, saya ingin membayar pesanan ${p.kode_pesanan}.`)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    const g: Record<string, string> = {}
    if (!bukti) g.bukti = 'Unggah foto atau tangkapan layar bukti transfer.'
    if (nama.trim().length < 2) g.nama = 'Isi nama pemilik rekening pengirim.'
    const angka = Number(nominal.replace(/\D/g, '') || p!.total_harga)
    if (!angka) g.nominal = 'Isi nominal yang ditransfer.'
    setGalat(g)
    if (Object.keys(g).length) return
    try {
      await unggah.mutateAsync({ bukti: bukti!, nama_pengirim: nama.trim(), nominal: angka })
      tampilkanToast('Bukti terkirim. Admin akan memverifikasi pembayaran Anda.')
      navigasi(`/akun/pesanan/${id}`, { replace: true })
    } catch (err) {
      tampilkanToast(pesanGalat(err), 'galat', 7000)
    }
  }

  if (p.status.kode !== 'menunggu_pembayaran') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-14 text-center">
        <LencanaStatus status={p.status} />
        <h1 className="font-display text-3xl text-olive-tua">Pesanan {p.kode_pesanan}</h1>
        <p className="text-redup">{p.status.keterangan}</p>
        <TautanTombol to={`/akun/pesanan/${id}`}>Lihat detail pesanan</TautanTombol>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className="font-display text-4xl text-rose-teks">Pembayaran</h1>
      <p className="mt-1 text-redup">
        Pesanan <strong className="font-mono text-olive-tua">{p.kode_pesanan}</strong> · {p.ringkasan_item}
      </p>

      <section aria-label="Tagihan" className="mt-6 grid gap-4 rounded-[2rem] bg-blush/70 p-5 sm:grid-cols-2">
        <div>
          <p className="text-sm text-redup">Total yang harus dibayar</p>
          <p className="text-3xl font-bold text-rose-teks">{formatRupiah(p.total_harga)}</p>
          <p className="mt-1 text-xs text-redup">
            Serah terima {formatTanggalHari(p.tanggal_kirim)}, pukul {p.slot_jam}
          </p>
        </div>
        {p.batas_bayar && (
          <div className="flex items-center gap-3 rounded-2xl bg-latar/80 p-4">
            <Timer aria-hidden className="size-7 shrink-0 text-rose-teks" />
            <p className="text-sm">
              Bayar dalam
              <HitungMundur batas={p.batas_bayar} saatLewat={() => setLewat(true)} className="block text-lg font-bold text-olive-tua" />
            </p>
          </div>
        )}
        {!p.rekening_tujuan && (
          <div role="note" className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#fdf0dc] p-4 text-[#6b3a00] sm:col-span-2">
            <CircleAlert aria-hidden className="size-7 shrink-0" />
            <p className="min-w-0 flex-1 text-sm">Rekening tujuan belum tercantum. Hubungi florist untuk mendapatkan info pembayaran.</p>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={kelasTombol('lembut', 'kecil')}>
                Hubungi florist
              </a>
            )}
          </div>
        )}
        {p.rekening_tujuan && (
          <div className="flex items-center gap-3 rounded-2xl bg-latar/80 p-4 sm:col-span-2">
            <Landmark aria-hidden className="size-7 shrink-0 text-rose-teks" />
            <p className="min-w-0 flex-1 text-sm">
              Transfer ke rekening
              <span className="block font-mono text-base font-semibold break-words text-olive-tua">{p.rekening_tujuan}</span>
            </p>
            <Tombol
              varian="lembut"
              ukuran="kecil"
              ikon={<Copy aria-hidden className="size-4" />}
              onClick={() => {
                void navigator.clipboard?.writeText(p.rekening_tujuan ?? '').then(
                  () => tampilkanToast('Nomor rekening disalin.'),
                  () => tampilkanToast('Gagal menyalin. Salin secara manual.', 'info'),
                )
              }}
            >
              Salin
            </Tombol>
          </div>
        )}
      </section>

      {ditolak && (
        <p role="alert" className="mt-4 rounded-2xl bg-[#fce8e7] p-4 text-sm text-[#7a1814]">
          Bukti sebelumnya ditolak: <strong>{ditolak.catatan_penolakan ?? 'tidak sesuai'}</strong>. Silakan unggah bukti yang benar.
        </p>
      )}

      {lewat ? (
        <div role="alert" className="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-[#fce8e7] p-4 text-sm text-[#7a1814]">
          <p>
            <strong>Batas waktu pembayaran sudah lewat.</strong> Bukti tidak bisa diunggah lagi; pesanan akan dibatalkan otomatis dan
            stoknya dilepas. Silakan buat pesanan baru.
          </p>
          <TautanTombol to={`/akun/pesanan/${id}`} varian="garis" ukuran="kecil">
            Lihat detail pesanan
          </TautanTombol>
        </div>
      ) : (
        <form onSubmit={kirim} noValidate className="mt-6 flex flex-col gap-4">
          <h2 className="font-display text-2xl text-olive-tua">Unggah bukti transfer</h2>
          <UnggahFoto label="Pilih foto bukti transfer" berkas={bukti} ubah={setBukti} galat={galat.bukti} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Nama pemilik rekening pengirim" wajib galat={galat.nama}>
              <Masukan value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" maxLength={100} />
            </Bidang>
            <Bidang label="Nominal transfer" bantuan={`Kosongkan bila sama dengan ${formatRupiah(p.total_harga)}`} galat={galat.nominal}>
              <Masukan
                inputMode="numeric"
                value={nominal}
                onChange={(e) => setNominal(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder={String(p.total_harga)}
              />
            </Bidang>
          </div>
          <Tombol type="submit" ukuran="besar" memuat={unggah.isPending}>
            Kirim bukti pembayaran
          </Tombol>
          <Link to={`/akun/pesanan/${id}`} className="self-center text-sm font-semibold text-rose-teks underline">
            Bayar nanti — lihat detail pesanan
          </Link>
        </form>
      )}
    </div>
  )
}
