import { ChevronRight, Package } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import type { Skema } from '@/api/client'
import { usePesananSaya } from '@/api/pelanggan'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { LencanaStatus, Paginasi, useJudul } from '@/komponen/ui/Lain'
import { TautanTombol } from '@/komponen/ui/Tombol'
import { JudulAkun } from '@/tata-letak/TataLetakAkun'
import { cn } from '@/lib/cn'
import { formatRupiah, formatTanggal } from '@/lib/format'

import { LABEL_SERAH } from './bersama'

const SARING: { nilai: Skema['StatusPesanan'] | ''; label: string }[] = [
  { nilai: '', label: 'Semua' },
  { nilai: 'menunggu_pembayaran', label: 'Belum dibayar' },
  { nilai: 'menunggu_verifikasi', label: 'Diverifikasi' },
  { nilai: 'sedang_dirangkai', label: 'Dirangkai' },
  { nilai: 'menunggu_persetujuan_foto', label: 'Perlu persetujuan' },
  { nilai: 'siap_diambil', label: 'Siap diambil' },
  { nilai: 'diantar', label: 'Diantar' },
  { nilai: 'selesai', label: 'Selesai' },
  { nilai: 'dibatalkan', label: 'Dibatalkan' },
]

export function HalamanPesananSaya() {
  useJudul('Pesanan Saya')
  const [q, setQ] = useSearchParams()
  const status = (q.get('status') || undefined) as Skema['StatusPesanan'] | undefined
  const halaman = Math.max(1, Number(q.get('hal')) || 1)
  const { data, isPending, isError, error, refetch } = usePesananSaya(status, halaman)

  return (
    <>
      <JudulAkun judul="Pesanan Saya" keterangan="Pantau proses dan riwayat pesananmu." />
      <div role="group" aria-label="Saring status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {SARING.map((s) => (
          <button
            key={s.nilai}
            type="button"
            aria-pressed={(status ?? '') === s.nilai}
            onClick={() => setQ(s.nilai ? { status: s.nilai } : {})}
            className={cn(
              'min-h-10 shrink-0 rounded-full border-2 px-4 text-sm font-semibold',
              (status ?? '') === s.nilai ? 'border-rose-teks bg-rose-teks text-white' : 'border-garis bg-permukaan text-olive-tua hover:bg-blush',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Kerangka key={i} className="h-28" />
          ))}
        </div>
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <Kosong
          ikon={<Package className="size-8" />}
          judul={status ? 'Tidak ada pesanan dengan status ini' : 'Belum ada pesanan'}
          pesan="Pesanan yang Anda buat akan muncul di sini beserta tahap pengerjaannya."
          aksi={<TautanTombol to="/katalog">Mulai belanja</TautanTombol>}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.data.map((p) => (
              <li key={p.id_pesanan}>
                <Link
                  to={`/akun/pesanan/${p.id_pesanan}`}
                  className={cn(
                    'flex items-center gap-4 rounded-3xl bg-permukaan p-4 ring-1 transition-shadow hover:shadow-md',
                    p.perlu_tindakan_pelanggan ? 'ring-2 ring-magenta' : 'ring-garis/60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-olive-tua">{p.kode_pesanan}</span>
                      <LencanaStatus status={p.status} />
                      {p.perlu_tindakan_pelanggan && <span className="rounded-full bg-magenta px-2 py-0.5 text-xs font-bold text-white">Perlu tindakanmu</span>}
                    </div>
                    <p className="mt-1 line-clamp-1 font-display text-lg text-olive-tua">{p.ringkasan_item}</p>
                    <p className="text-sm text-redup">
                      {LABEL_SERAH[p.cara_serah_terima]} · {formatTanggal(p.tanggal_kirim)}, {p.slot_jam}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-bold text-rose-teks">{formatRupiah(p.total_harga)}</p>
                    <ChevronRight aria-hidden className="ms-auto mt-2 size-5 text-redup" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Paginasi
            halaman={halaman}
            total={data.total}
            perHalaman={data.per_halaman}
            ubah={(h) => setQ((l) => {
              const b = new URLSearchParams(l)
              b.set('hal', String(h))
              return b
            })}
          />
        </>
      )}
    </>
  )
}
