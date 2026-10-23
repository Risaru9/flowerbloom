import { BadgeCheck, CircleAlert, ExternalLink, Flower2, MessageCircle, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { useAdminPesananDetail, usePengembalianDanaSelesai, useSahkanPembayaran, useTandaiSelesai, useTolakPembayaran } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { LABEL_SERAH, Linimasa } from '@/fitur/pesanan/bersama'
import { AreaTeks, Bidang } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { FotoBunga, LencanaStatus, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { kelasTombol, Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { formatRupiah, formatTanggalHari, formatTanggalJam } from '@/lib/format'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

import { BenderaPesanan, tautanWa } from './bersama-admin'

/** Kartu verifikasi satu bukti transfer: dipakai di detail pesanan dan halaman Pembayaran. */
export function VerifikasiBukti({ pesanan, bukti }: { pesanan: Skema['PesananAdminOut']; bukti: Skema['PembayaranOut'] }) {
  const sahkan = useSahkanPembayaran(pesanan.id_pesanan)
  const tolak = useTolakPembayaran(pesanan.id_pesanan)
  const [dialog, setDialog] = useState<'sahkan' | 'tolak' | null>(null)
  const [catatan, setCatatan] = useState('')
  const menunggu = bukti.status_verifikasi === 'menunggu' && pesanan.status.kode === 'menunggu_verifikasi'
  return (
    <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
      {bukti.bukti_url ? (
        <a href={bukti.bukti_url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl border border-ad-garis">
          <img src={bukti.bukti_url} alt={`Bukti transfer dari ${bukti.nama_pengirim}`} className="aspect-[3/4] w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-xs text-white">
            Buka ukuran penuh <ExternalLink aria-hidden className="size-3" />
          </span>
        </a>
      ) : (
        <div className="grid aspect-[3/4] place-items-center rounded-xl bg-ad-latar text-xs text-ad-redup">Tautan bukti kedaluwarsa, muat ulang halaman</div>
      )}
      <div className="flex flex-col gap-2 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-ad-redup">Pengirim</dt>
          <dd className="font-semibold">{bukti.nama_pengirim}</dd>
          <dt className="text-ad-redup">Nominal</dt>
          <dd className="font-semibold tabular-nums">
            {formatRupiah(bukti.nominal)}{' '}
            {bukti.nominal_sesuai ? (
              <span className="ms-1 rounded-md bg-ad-sukses-lembut px-1.5 text-xs font-bold text-ad-sukses">✓ sesuai tagihan</span>
            ) : (
              <span className="ms-1 rounded-md bg-ad-peringatan-lembut px-1.5 text-xs font-bold text-ad-peringatan">
                ✕ tagihan {formatRupiah(pesanan.total_harga)}
              </span>
            )}
          </dd>
          <dt className="text-ad-redup">Diunggah</dt>
          <dd>{formatTanggalJam(bukti.diunggah_pada)}</dd>
          <dt className="text-ad-redup">Status</dt>
          <dd className="font-semibold">
            {bukti.status_verifikasi === 'sah' ? 'Sah' : bukti.status_verifikasi === 'ditolak' ? `Ditolak — ${bukti.catatan_penolakan ?? ''}` : 'Menunggu verifikasi'}
          </dd>
        </dl>
        {menunggu && (
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Tombol varian="admin" className="rounded-xl" ikon={<BadgeCheck aria-hidden className="size-4" />} onClick={() => setDialog('sahkan')}>
              Sahkan pembayaran
            </Tombol>
            <Tombol varian="admin-garis" className="rounded-xl" ikon={<XCircle aria-hidden className="size-4" />} onClick={() => setDialog('tolak')}>
              Tolak bukti
            </Tombol>
          </div>
        )}
      </div>
      <Dialog
        gaya="admin"
        lebar="sm"
        terbuka={dialog === 'sahkan'}
        saatTutup={() => setDialog(null)}
        judul="Sahkan pembayaran?"
        deskripsi={`Pastikan dana ${formatRupiah(bukti.nominal)} sudah masuk ke rekening toko. Pesanan akan masuk antrean rangkai.`}
        kaki={
          <>
            <Tombol varian="admin-garis" className="rounded-xl" onClick={() => setDialog(null)}>
              Batal
            </Tombol>
            <Tombol
              varian="admin"
              className="rounded-xl"
              memuat={sahkan.isPending}
              onClick={() =>
                sahkan.mutate(bukti.id_pembayaran, {
                  onSuccess: () => {
                    setDialog(null)
                    tampilkanToast(`Pembayaran ${pesanan.kode_pesanan} disahkan.`)
                  },
                  onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                })
              }
            >
              Ya, sahkan
            </Tombol>
          </>
        }
      >
        <p className="text-sm text-ad-redup">Tindakan ini tercatat di riwayat pesanan.</p>
      </Dialog>
      <Dialog
        gaya="admin"
        terbuka={dialog === 'tolak'}
        saatTutup={() => setDialog(null)}
        judul="Tolak bukti transfer"
        deskripsi="Alasan ditampilkan kepada pelanggan agar mereka dapat mengunggah ulang."
        kaki={
          <>
            <Tombol varian="admin-garis" className="rounded-xl" onClick={() => setDialog(null)}>
              Batal
            </Tombol>
            <Tombol
              varian="bahaya"
              className="rounded-xl"
              disabled={catatan.trim().length < 3}
              memuat={tolak.isPending}
              onClick={() =>
                tolak.mutate(
                  { idPembayaran: bukti.id_pembayaran, catatan: catatan.trim() },
                  {
                    onSuccess: () => {
                      setDialog(null)
                      setCatatan('')
                      tampilkanToast('Bukti ditolak. Pelanggan diminta mengunggah ulang.')
                    },
                    onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                  },
                )
              }
            >
              Tolak bukti
            </Tombol>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {['Nominal tidak sesuai', 'Bukti tidak terbaca', 'Dana belum masuk'].map((a) => (
              <button key={a} type="button" onClick={() => setCatatan(a)} className="rounded-full border border-ad-garis px-3 py-1 text-xs font-semibold hover:bg-ad-latar">
                {a}
              </button>
            ))}
          </div>
          <Bidang label="Alasan penolakan" gaya="admin" wajib>
            <AreaTeks gaya="admin" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={255} />
          </Bidang>
        </div>
      </Dialog>
    </div>
  )
}

export function HalamanDetailPesananAdmin() {
  const id = Number(useParams().id)
  const { data: p, isPending, isError, error, refetch } = useAdminPesananDetail(id)
  const selesai = useTandaiSelesai(id)
  const danaKembali = usePengembalianDanaSelesai(id)
  useJudul(p ? `Pesanan ${p.kode_pesanan}` : 'Detail pesanan')

  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />

  const wa = tautanWa(p.pemesan.no_hp)
  const buktiTerbaru = p.pembayaran.at(-1)
  const fotoTerbaru = p.foto.at(-1)

  return (
    <>
      <JudulAdmin
        judul={`Pesanan ${p.kode_pesanan}`}
        keterangan={`Dibuat ${formatTanggalJam(p.dibuat_pada)} oleh ${p.pemesan.nama}`}
        jejak={[
          { ke: '/admin', label: 'Dasbor' },
          { ke: '/admin/pesanan', label: 'Pesanan' },
        ]}
        aksi={
          <>
            {p.status.kode === 'sedang_dirangkai' && (
              <Link to={`/admin/pesanan/${p.id_pesanan}/merangkai`} className={cn(kelasTombol('admin'), 'rounded-xl')}>
                <Flower2 aria-hidden className="size-4" /> Mode merangkai
              </Link>
            )}
            {(p.status.kode === 'siap_diambil' || p.status.kode === 'diantar') && (
              <Tombol
                varian="admin"
                className="rounded-xl"
                memuat={selesai.isPending}
                onClick={() =>
                  selesai.mutate(undefined, {
                    onSuccess: () => tampilkanToast('Pesanan ditandai selesai.'),
                    onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                  })
                }
              >
                Tandai selesai (sudah diterima)
              </Tombol>
            )}
            {p.perlu_pengembalian_dana && (
              <Tombol
                varian="admin-garis"
                className="rounded-xl"
                ikon={<RotateCcw aria-hidden className="size-4" />}
                memuat={danaKembali.isPending}
                onClick={() =>
                  danaKembali.mutate(undefined, {
                    onSuccess: () => tampilkanToast('Pengembalian dana dicatat selesai.'),
                    onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                  })
                }
              >
                Dana sudah dikembalikan
              </Tombol>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LencanaStatus status={p.status} className="text-sm" />
        <BenderaPesanan p={p} />
        {p.revisi_berbayar && <span className="rounded-md bg-ad-ungu-lembut px-1.5 py-0.5 text-xs font-bold text-ad-ungu">Revisi melebihi jatah gratis</span>}
      </div>

      {p.status.kode !== 'dibatalkan' ? (
        <Kartu className="mb-4">
          <Linimasa tahap={p.tahap} gaya="admin" />
        </Kartu>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-ad-latar p-4 text-sm">
          <CircleAlert aria-hidden className="size-5" /> Dibatalkan{p.alasan_batal ? `: ${p.alasan_batal}` : ''}.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {buktiTerbaru && (
            <Kartu>
              <h2 className="mb-3 text-lg font-bold">Bukti pembayaran {p.pembayaran.length > 1 && <span className="text-sm font-normal text-ad-redup">(unggahan ke-{p.pembayaran.length})</span>}</h2>
              <VerifikasiBukti pesanan={p} bukti={buktiTerbaru} />
            </Kartu>
          )}
          <Kartu>
            <h2 className="mb-3 text-lg font-bold">Rangkaian dipesan</h2>
            <ul className="flex flex-col gap-4">
              {p.detail.map((d) => (
                <li key={d.id_detail} className="border-b border-ad-garis pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold">
                      {d.jumlah}× {d.nama} <span className="text-xs font-normal text-ad-redup">({d.jenis_item === 'paket' ? 'paket' : 'rangkai sendiri'})</span>
                    </p>
                    <p className="font-semibold tabular-nums">{formatRupiah(d.subtotal)}</p>
                  </div>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {d.komposisi.map((k) => (
                      <li key={k.id_komposisi_pesanan} className="flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold tabular-nums">{k.jumlah_tangkai}×</span> {k.jenis.nama_bunga} <ChipWarna warna={k.warna} ukuran="kecil" />
                        {k.is_pengganti && <span className="rounded bg-ad-peringatan-lembut px-1 text-xs font-bold text-ad-peringatan">pengganti</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Kartu>
          {fotoTerbaru && (
            <Kartu>
              <h2 className="mb-3 text-lg font-bold">Foto hasil terakhir</h2>
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <FotoBunga src={fotoTerbaru.foto_url} alt={`Foto hasil. ${fotoTerbaru.label_teks}`} className="aspect-square w-full rounded-xl" />
                <div className="text-sm">
                  <p className="mb-2 font-semibold">Warna terbaca: {fotoTerbaru.label_teks}</p>
                  <p>
                    Persetujuan pelanggan:{' '}
                    <strong>{fotoTerbaru.status_persetujuan === 'disetujui' ? 'Disetujui' : fotoTerbaru.status_persetujuan === 'revisi' ? 'Minta revisi' : 'Menunggu'}</strong>
                  </p>
                  {fotoTerbaru.catatan_revisi && <p className="mt-1 rounded-lg bg-ad-latar p-2">“{fotoTerbaru.catatan_revisi}”</p>}
                  <p className="mt-1 text-ad-redup">Revisi: {p.jumlah_revisi} · sisa revisi gratis {p.revisi_gratis_tersisa}</p>
                </div>
              </div>
            </Kartu>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Kartu>
            <h2 className="mb-2 text-lg font-bold">Pemesan</h2>
            <p className="font-semibold">{p.pemesan.nama}</p>
            <p className="text-sm text-ad-redup">{p.pemesan.email}</p>
            {p.pemesan.no_hp && <p className="text-sm">{p.pemesan.no_hp}</p>}
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(kelasTombol('admin-lembut', 'kecil'), 'mt-3 rounded-xl')}>
                <MessageCircle aria-hidden className="size-4" /> Hubungi via WhatsApp
              </a>
            )}
          </Kartu>
          <Kartu>
            <h2 className="mb-2 text-lg font-bold">{LABEL_SERAH[p.cara_serah_terima]}</h2>
            <p className="text-sm">
              <strong>{formatTanggalHari(p.tanggal_kirim)}</strong>, pukul {p.slot_jam}
            </p>
            <p className="mt-2 text-sm">Penerima: {p.nama_penerima}</p>
            {p.alamat && <p className="text-sm text-ad-redup">{p.alamat}</p>}
            {p.kartu_ucapan && <p className="mt-2 rounded-lg bg-ad-latar p-2 text-sm italic">Kartu ucapan: “{p.kartu_ucapan}”</p>}
          </Kartu>
          <Kartu>
            <h2 className="mb-2 text-lg font-bold">Pembayaran</h2>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt>Ongkos antar</dt>
                <dd className="tabular-nums">{formatRupiah(p.ongkos_antar)}</dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatRupiah(p.total_harga)}</dd>
              </div>
            </dl>
          </Kartu>
          <Kartu>
            <h2 className="mb-2 text-lg font-bold">Riwayat status</h2>
            <ol className="flex flex-col gap-2 border-s-2 border-ad-garis ps-3 text-sm">
              {p.riwayat.map((r, i) => (
                <li key={i}>
                  <span className="font-semibold">{r.label}</span>
                  <span className="block text-xs text-ad-redup">
                    {formatTanggalJam(r.waktu)} · {r.oleh_sistem ? 'otomatis' : 'manual'}
                  </span>
                  {r.catatan && <span className="block text-xs">{r.catatan}</span>}
                </li>
              ))}
            </ol>
          </Kartu>
        </div>
      </div>
    </>
  )
}
