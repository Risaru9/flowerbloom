import { CalendarClock, ChevronLeft, CircleAlert, Clock, MapPin, MessageSquareWarning, Receipt, ScrollText, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { pesanGalat, type Skema } from '@/api/client'
import { useAjukanKomplain, useBatalkanPesanan, useInfoToko, useKomplainSaya, usePesanan, useTanggapiFoto } from '@/api/pelanggan'
import { AreaTeks, Bidang } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { FotoBunga, LencanaStatus, TombolDengarkan, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { kelasTombol, TautanTombol, Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { formatRupiah, formatTanggal, formatTanggalHari, formatTanggalJam, tautanWa } from '@/lib/format'

import { HitungMundur, LABEL_SERAH, Linimasa, UnggahFoto } from './bersama'

const BOLEH_KOMPLAIN: Skema['StatusPesanan'][] = ['siap_diambil', 'diantar', 'selesai']
const STATUS_KOMPLAIN: Record<Skema['StatusKomplain'], string> = { baru: 'Terkirim', diproses: 'Sedang ditangani', selesai: 'Selesai' }

function Kotak({ judul, ikon, children }: { judul: string; ikon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-olive-tua">
        <span aria-hidden className="text-rose-teks">
          {ikon}
        </span>
        {judul}
      </h2>
      <div className="text-sm text-olive">{children}</div>
    </section>
  )
}

function PersetujuanFoto({ pesanan }: { pesanan: Skema['PesananOut'] }) {
  const foto = pesanan.foto.at(-1)
  const tanggapi = useTanggapiFoto(pesanan.id_pesanan)
  const [revisi, setRevisi] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [setujuPengganti, setSetujuPengganti] = useState(false)
  if (!foto) return null
  const menunggu = foto.status_persetujuan === 'menunggu' && pesanan.status.kode === 'menunggu_persetujuan_foto'
  const penggantiBeda = foto.pengganti.some((g) => g.warna_berbeda)

  async function kirim(keputusan: 'setuju' | 'revisi') {
    try {
      await tanggapi.mutateAsync({
        keputusan,
        catatan_revisi: keputusan === 'revisi' ? catatan.trim() || null : null,
        setuju_pengganti: setujuPengganti,
      })
      tampilkanToast(keputusan === 'setuju' ? 'Terima kasih! Rangkaian disetujui.' : 'Permintaan revisi terkirim ke florist.')
      setRevisi(false)
    } catch (e) {
      tampilkanToast(pesanGalat(e), 'galat', 7000)
    }
  }

  return (
    <section aria-labelledby="judul-foto" className="rounded-[2rem] bg-blush/70 p-5">
      <h2 id="judul-foto" className="mb-3 font-display text-2xl text-olive-tua">
        Foto hasil rangkaian
      </h2>
      <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
        <FotoBunga
          src={foto.foto_url}
          alt={`Foto hasil rangkaian. Warna terbaca: ${foto.label_teks}`}
          className="aspect-square w-full rounded-3xl"
        />
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-olive-tua">Warna yang terbaca dari foto</p>
            <ul className="flex flex-col gap-2">
              {foto.label_warna.map((w) => (
                <li key={w.id_warna} className="flex items-center gap-3">
                  <ChipWarna warna={w} ukuran="kecil" className="flex-1" />
                  <span className="text-sm font-bold">{Math.round(w.persen)}%</span>
                </li>
              ))}
            </ul>
            <TombolDengarkan teks={`Warna pada foto hasil rangkaian: ${foto.label_teks}`} label="Dengarkan warna foto" className="mt-3" />
          </div>
          {foto.pengganti.length > 0 && (
            <div className="rounded-2xl bg-[#fdf0dc] p-3 text-sm text-[#6b3a00]">
              <p className="flex items-center gap-2 font-semibold">
                <CircleAlert aria-hidden className="size-4" /> Ada bunga pengganti
              </p>
              <ul className="mt-1 list-disc ps-5">
                {foto.pengganti.map((g, i) => (
                  <li key={i}>
                    {g.jumlah}× {g.dari} → <strong>{g.menjadi}</strong>
                    {g.warna_berbeda && ' (warna berbeda)'}
                    {g.alasan && ` — ${g.alasan}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {menunggu ? (
            <>
              {penggantiBeda && (
                <label className="flex items-start gap-3 rounded-2xl bg-latar/80 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={setujuPengganti}
                    onChange={(e) => setSetujuPengganti(e.target.checked)}
                    className="mt-0.5 size-5 accent-rose-teks"
                  />
                  Saya sudah membaca dan menyetujui bunga pengganti dengan warna berbeda.
                </label>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Tombol
                  onClick={() => void kirim('setuju')}
                  memuat={tanggapi.isPending && !revisi}
                  disabled={penggantiBeda && !setujuPengganti}
                >
                  Setujui rangkaian
                </Tombol>
                <Tombol varian="garis" onClick={() => setRevisi(true)}>
                  Minta revisi
                </Tombol>
              </div>
              {pesanan.revisi_gratis_tersisa >= 0 && (
                <p className="text-xs text-redup">Sisa revisi gratis: {pesanan.revisi_gratis_tersisa}.</p>
              )}
            </>
          ) : (
            <p className="rounded-2xl bg-latar/80 p-3 text-sm">
              Status:{' '}
              <strong>
                {foto.status_persetujuan === 'disetujui'
                  ? 'Disetujui'
                  : foto.status_persetujuan === 'revisi'
                    ? 'Diminta revisi'
                    : 'Menunggu'}
              </strong>
              {foto.catatan_revisi && ` — “${foto.catatan_revisi}”`}
            </p>
          )}
        </div>
      </div>
      <Dialog
        terbuka={revisi}
        saatTutup={() => setRevisi(false)}
        judul="Minta revisi rangkaian"
        deskripsi="Jelaskan bagian yang ingin diubah, misalnya warna atau susunan bunga."
        kaki={
          <>
            <Tombol varian="garis" onClick={() => setRevisi(false)}>
              Batal
            </Tombol>
            <Tombol onClick={() => void kirim('revisi')} memuat={tanggapi.isPending} disabled={catatan.trim().length < 3}>
              Kirim permintaan
            </Tombol>
          </>
        }
      >
        {pesanan.revisi_gratis_tersisa === 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl bg-[#fdf0dc] p-3 text-sm text-[#6b3a00]">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Revisi gratis Anda sudah habis. Revisi berikutnya dapat dikenai biaya tambahan sesuai kebijakan toko; tanyakan biayanya ke
            florist bila perlu.
          </p>
        )}
        <Bidang label="Catatan revisi" wajib bantuan={`${catatan.length}/500`}>
          <AreaTeks value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={500} />
        </Bidang>
      </Dialog>
    </section>
  )
}

export function HalamanDetailPesanan() {
  const id = Number(useParams().id)
  const { data: p, isPending, isError, error, refetch } = usePesanan(id, { pantau: true })
  const batal = useBatalkanPesanan(id)
  const komplain = useAjukanKomplain(id)
  const { data: info } = useInfoToko()
  const komplainIni = useKomplainSaya().data?.find((k) => k.id_pesanan === id)
  const [dialog, setDialog] = useState<'batal' | 'komplain' | null>(null)
  const [alasan, setAlasan] = useState('')
  const [isiKomplain, setIsiKomplain] = useState('')
  const [fotoKomplain, setFotoKomplain] = useState<File | null>(null)
  useJudul(p ? `Pesanan ${p.kode_pesanan}` : 'Detail pesanan')

  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />

  const pembayaranTerakhir = p.pembayaran.at(-1)
  const wa = tautanWa(info?.no_hp_toko, `Halo ${info?.nama_toko ?? 'FlowerBloom'}, saya ingin bertanya tentang pesanan ${p.kode_pesanan}.`)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/akun/pesanan"
        className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-rose-teks hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" /> Semua pesanan
      </Link>

      <header className="flex flex-wrap items-center gap-3 rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
        <div className="me-auto">
          <p className="text-xs text-redup">Nomor pesanan</p>
          <h1 className="font-mono text-xl font-bold text-rose-tua">{p.kode_pesanan}</h1>
        </div>
        <div>
          <p className="text-xs text-redup">Tanggal pesan</p>
          <p className="text-sm font-semibold">{formatTanggal(p.dibuat_pada)}</p>
        </div>
        <LencanaStatus status={p.status} className="text-sm" />
      </header>

      {p.status.kode !== 'dibatalkan' && (
        <section aria-label="Tahap pesanan" className="rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
          <Linimasa tahap={p.tahap} />
        </section>
      )}

      {p.status.kode === 'menunggu_pembayaran' && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-[#fdf0dc] p-4 text-[#6b3a00]">
          <Clock aria-hidden className="size-6" />
          <p className="flex-1 text-sm">
            Selesaikan pembayaran {formatRupiah(p.total_harga)}
            {p.batas_bayar && (
              <>
                {' '}
                dalam <HitungMundur batas={p.batas_bayar} className="font-bold" />
              </>
            )}
            .
            {pembayaranTerakhir?.status_verifikasi === 'ditolak' && (
              <span className="block font-semibold">Bukti sebelumnya ditolak: {pembayaranTerakhir.catatan_penolakan}</span>
            )}
          </p>
          <TautanTombol to={`/pesanan/${p.id_pesanan}/bayar`}>Bayar sekarang</TautanTombol>
        </div>
      )}

      {p.status.kode === 'dibatalkan' && (
        <p role="status" className="flex items-center gap-2 rounded-3xl bg-[#f1ecee] p-4 text-sm text-[#4f474b]">
          <XCircle aria-hidden className="size-5" /> Pesanan dibatalkan{p.alasan_batal ? `: ${p.alasan_batal}` : '.'}
        </p>
      )}

      {p.foto.length > 0 && <PersetujuanFoto pesanan={p} />}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="judul-produk" className="rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
          <h2 id="judul-produk" className="mb-3 font-display text-xl text-olive-tua">
            Produk pesanan
          </h2>
          <ul className="flex flex-col gap-4">
            {p.detail.map((d) => (
              <li key={d.id_detail} className="border-b border-garis/50 pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between gap-3">
                  <p className="font-display text-lg text-olive-tua">
                    {d.jumlah}× {d.nama}
                  </p>
                  <p className="font-bold text-rose-teks">{formatRupiah(d.subtotal)}</p>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {d.komposisi.map((k) => (
                    <li key={k.id_komposisi_pesanan}>
                      {k.jumlah_tangkai}× {k.jenis.nama_bunga} · <ChipWarna warna={k.warna} ukuran="kecil" />
                      {k.is_pengganti && (
                        <span className="ms-2 rounded-full bg-[#fdf0dc] px-2 text-xs font-semibold text-[#6b3a00]">pengganti</span>
                      )}
                    </li>
                  ))}
                </ul>
                <TombolDengarkan teks={d.narasi} className="mt-2" />
              </li>
            ))}
          </ul>
        </section>
        <div className="flex flex-col gap-3">
          <Kotak judul={LABEL_SERAH[p.cara_serah_terima]} ikon={<MapPin className="size-4" />}>
            <p className="font-semibold">{p.nama_penerima}</p>
            {p.alamat && <p>{p.alamat}</p>}
          </Kotak>
          <Kotak judul="Waktu serah terima" ikon={<CalendarClock className="size-4" />}>
            {formatTanggalHari(p.tanggal_kirim)} · {p.slot_jam}
          </Kotak>
          {p.kartu_ucapan && (
            <Kotak judul="Kartu ucapan" ikon={<ScrollText className="size-4" />}>
              <p className="italic">“{p.kartu_ucapan}”</p>
            </Kotak>
          )}
          <Kotak judul="Ringkasan pembayaran" ikon={<Receipt className="size-4" />}>
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between">
                <dt>Ongkos antar</dt>
                <dd>{formatRupiah(p.ongkos_antar)}</dd>
              </div>
              <div className="flex justify-between font-bold text-rose-teks">
                <dt>Total</dt>
                <dd>{formatRupiah(p.total_harga)}</dd>
              </div>
              {pembayaranTerakhir && (
                <div className="flex justify-between text-xs text-redup">
                  <dt>Bukti terakhir</dt>
                  <dd>
                    {pembayaranTerakhir.status_verifikasi === 'sah'
                      ? 'Terverifikasi'
                      : pembayaranTerakhir.status_verifikasi === 'ditolak'
                        ? 'Ditolak'
                        : 'Menunggu verifikasi'}
                  </dd>
                </div>
              )}
            </dl>
          </Kotak>
          {komplainIni && (
            <Kotak judul="Komplain Anda" ikon={<MessageSquareWarning className="size-4" />}>
              <p className="font-semibold">
                {STATUS_KOMPLAIN[komplainIni.status]}{' '}
                <span className="font-normal text-redup">· {formatTanggalJam(komplainIni.dibuat_pada)}</span>
              </p>
              <p className="mt-1">“{komplainIni.isi}”</p>
              <p className="mt-2">
                {komplainIni.tanggapan_admin ? (
                  <>
                    <strong>Tanggapan toko:</strong> {komplainIni.tanggapan_admin}
                  </>
                ) : (
                  <span className="text-redup">Belum ada tanggapan dari toko.</span>
                )}
              </p>
            </Kotak>
          )}
          <div className="flex flex-wrap gap-2">
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={kelasTombol('lembut', 'kecil')}>
                Hubungi florist
              </a>
            ) : (
              <TautanTombol to="/tentang#kontak" varian="lembut" ukuran="kecil">
                Hubungi florist
              </TautanTombol>
            )}
            {p.bisa_dibatalkan && (
              <Tombol varian="garis" ukuran="kecil" onClick={() => setDialog('batal')}>
                Batalkan pesanan
              </Tombol>
            )}
            {BOLEH_KOMPLAIN.includes(p.status.kode) && !komplainIni && (
              <Tombol
                varian="garis"
                ukuran="kecil"
                ikon={<MessageSquareWarning aria-hidden className="size-4" />}
                onClick={() => setDialog('komplain')}
              >
                Ajukan komplain
              </Tombol>
            )}
          </div>
        </div>
      </div>

      <details className="rounded-3xl bg-permukaan p-4 ring-1 ring-garis/60">
        <summary className="cursor-pointer font-semibold text-olive-tua">Riwayat status ({p.riwayat.length})</summary>
        <ol className="mt-3 flex flex-col gap-2 border-s-2 border-garis ps-4 text-sm">
          {p.riwayat.map((r, i) => (
            <li key={i}>
              <span className="font-semibold">{r.label}</span> <span className="text-redup">· {formatTanggalJam(r.waktu)}</span>
              {r.catatan && <span className="block text-redup">{r.catatan}</span>}
            </li>
          ))}
        </ol>
      </details>

      <Dialog
        terbuka={dialog === 'batal'}
        saatTutup={() => setDialog(null)}
        judul="Batalkan pesanan?"
        deskripsi={
          p.status.kode === 'menunggu_verifikasi'
            ? 'Anda sudah mengunggah bukti bayar. Pengembalian dana akan diproses admin secara manual.'
            : 'Stok yang ditahan untuk pesanan ini akan dilepas.'
        }
        kaki={
          <>
            <Tombol varian="garis" onClick={() => setDialog(null)}>
              Tidak jadi
            </Tombol>
            <Tombol
              varian="bahaya"
              memuat={batal.isPending}
              onClick={async () => {
                try {
                  await batal.mutateAsync(alasan.trim() || null)
                  setDialog(null)
                  tampilkanToast('Pesanan dibatalkan.')
                } catch (e) {
                  tampilkanToast(pesanGalat(e), 'galat')
                }
              }}
            >
              Ya, batalkan
            </Tombol>
          </>
        }
      >
        <Bidang label="Alasan (opsional)">
          <AreaTeks value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={300} />
        </Bidang>
      </Dialog>

      <Dialog
        terbuka={dialog === 'komplain'}
        saatTutup={() => setDialog(null)}
        judul="Ajukan komplain"
        deskripsi="Komplain dapat diajukan paling lambat 1×24 jam setelah pesanan diterima. Sertakan foto agar lebih cepat ditangani."
        kaki={
          <>
            <Tombol varian="garis" onClick={() => setDialog(null)}>
              Batal
            </Tombol>
            <Tombol
              memuat={komplain.isPending}
              disabled={isiKomplain.trim().length < 10}
              onClick={async () => {
                try {
                  await komplain.mutateAsync({ isi: isiKomplain.trim(), foto: fotoKomplain })
                  setDialog(null)
                  setIsiKomplain('')
                  setFotoKomplain(null)
                  tampilkanToast('Komplain terkirim. Kami akan segera menanggapinya.')
                } catch (e) {
                  tampilkanToast(pesanGalat(e), 'galat', 7000)
                }
              }}
            >
              Kirim komplain
            </Tombol>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Bidang label="Ceritakan masalahnya" wajib bantuan="Minimal 10 karakter.">
            <AreaTeks value={isiKomplain} onChange={(e) => setIsiKomplain(e.target.value)} maxLength={1000} />
          </Bidang>
          <UnggahFoto label="Tambahkan foto (disarankan)" berkas={fotoKomplain} ubah={setFotoKomplain} kamera />
        </div>
      </Dialog>
    </div>
  )
}
