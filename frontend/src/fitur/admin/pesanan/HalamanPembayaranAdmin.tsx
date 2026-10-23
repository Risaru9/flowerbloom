import { Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useAdminPesanan, useAdminPesananDetail } from '@/api/admin'
import { Galat, Kerangka, Kosong, Memuat } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { cn } from '@/lib/cn'
import { formatRupiah, formatTanggalJam } from '@/lib/format'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

import { VerifikasiBukti } from './HalamanDetailPesananAdmin'

function PanelVerifikasi({ id }: { id: number }) {
  const { data, isPending, isError, error, refetch } = useAdminPesananDetail(id)
  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />
  const bukti = data.pembayaran.at(-1)
  return (
    <Kartu>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          <span className="font-mono">{data.kode_pesanan}</span> · {data.pemesan.nama}
        </h2>
        <Link to={`/admin/pesanan/${id}`} className="text-sm font-semibold text-ad-aksen underline">
          Detail pesanan
        </Link>
      </div>
      <p className="mb-3 text-sm text-ad-redup">{data.ringkasan_item}</p>
      {bukti ? <VerifikasiBukti pesanan={data} bukti={bukti} /> : <p className="text-sm">Belum ada bukti diunggah.</p>}
    </Kartu>
  )
}

export function HalamanPembayaranAdmin() {
  useJudul('Verifikasi Pembayaran')
  const [tab, setTab] = useState<'menunggu_verifikasi' | 'menunggu_pembayaran'>('menunggu_verifikasi')
  const { data, isPending, isError, error, refetch } = useAdminPesanan({ status: tab, per_halaman: 50 })
  const [dipilih, setDipilih] = useState<number | null>(null)
  const aktif = dipilih ?? data?.data[0]?.id_pesanan ?? null

  return (
    <>
      <JudulAdmin judul="Pembayaran" keterangan="Verifikasi bukti transfer agar pesanan masuk antrean rangkai." jejak={[{ ke: '/admin', label: 'Dasbor' }]} />
      <div role="tablist" aria-label="Status pembayaran" className="mb-4 inline-flex rounded-xl border border-ad-garis bg-ad-permukaan p-1">
        {(
          [
            ['menunggu_verifikasi', 'Menunggu verifikasi'],
            ['menunggu_pembayaran', 'Belum dibayar'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            type="button"
            role="tab"
            aria-selected={tab === nilai}
            onClick={() => {
              setTab(nilai)
              setDipilih(null)
            }}
            className={cn('min-h-10 rounded-lg px-4 text-sm font-semibold', tab === nilai ? 'bg-ad-aksen text-white' : 'text-ad-redup hover:bg-ad-latar')}
          >
            {label}
          </button>
        ))}
      </div>
      {isPending ? (
        <Kerangka className="h-40 rounded-2xl bg-ad-garis/60" />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <Kosong ikon={<Wallet className="size-8" />} judul={tab === 'menunggu_verifikasi' ? 'Tidak ada bukti yang menunggu' : 'Tidak ada tagihan tertunda'} pesan="Semua sudah ditangani." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <ul className="flex flex-col gap-2" aria-label="Daftar pesanan">
            {data.data.map((p) => (
              <li key={p.id_pesanan}>
                <button
                  type="button"
                  onClick={() => setDipilih(p.id_pesanan)}
                  aria-current={aktif === p.id_pesanan ? 'true' : undefined}
                  className={cn(
                    'w-full rounded-xl border p-3 text-start transition-colors',
                    aktif === p.id_pesanan ? 'border-ad-aksen bg-ad-aksen-lembut/60' : 'border-ad-garis bg-ad-permukaan hover:bg-ad-latar',
                  )}
                >
                  <span className="flex justify-between gap-2 text-sm">
                    <span className="font-mono font-semibold">{p.kode_pesanan}</span>
                    <span className="font-semibold tabular-nums">{formatRupiah(p.total_harga)}</span>
                  </span>
                  <span className="block text-sm">{p.pemesan.nama}</span>
                  <span className="block text-xs text-ad-redup">
                    {tab === 'menunggu_pembayaran' && p.batas_bayar ? `Batas bayar ${formatTanggalJam(p.batas_bayar)}` : `Dipesan ${formatTanggalJam(p.dibuat_pada)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {aktif !== null && (tab === 'menunggu_verifikasi' ? <PanelVerifikasi id={aktif} /> : (
            <Kartu>
              <p className="text-sm">Pelanggan belum mengunggah bukti. Pesanan otomatis batal bila melewati batas bayar.</p>
              <Link to={`/admin/pesanan/${aktif}`} className="mt-2 inline-block text-sm font-semibold text-ad-aksen underline">
                Lihat detail pesanan
              </Link>
            </Kartu>
          ))}
        </div>
      )}
    </>
  )
}
