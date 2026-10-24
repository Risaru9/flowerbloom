import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Flower2,
  ImageUp,
  MessageSquareWarning,
  RotateCcw,
  ScanLine,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useDasbor } from '@/api/admin'
import { useSesi } from '@/auth/sesi'
import { GrafikBatang } from '@/komponen/GrafikBatang'
import { Galat, Kerangka } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { cn } from '@/lib/cn'
import { formatRupiah, formatTanggal, formatTanggalHari } from '@/lib/format'
import { Kartu } from '@/tata-letak/TataLetakAdmin'

function KartuAngka({
  judul,
  nilai,
  ket,
  Ikon,
  nada,
  ke,
}: {
  judul: string
  nilai: string
  ket: string
  Ikon: LucideIcon
  nada: string
  ke: string
}) {
  return (
    <Link to={ke} className="group rounded-2xl border border-ad-garis bg-ad-permukaan p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ad-redup">{judul}</p>
        <span aria-hidden className={cn('grid size-10 place-items-center rounded-xl', nada)}>
          <Ikon className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{nilai}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-ad-redup">
        {ket} <ArrowRight aria-hidden className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
    </Link>
  )
}

export function HalamanDasbor() {
  useJudul('Dasbor Admin')
  const sesi = useSesi()
  const { data, isPending, isError, error, refetch } = useDasbor()
  const [hariIni] = useState(() => new Date())

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Kerangka key={i} className="h-32 rounded-2xl bg-ad-garis/60" />
        ))}
      </div>
    )
  }
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />

  const tindakan: { n: number; teks: string; ke: string; Ikon: LucideIcon }[] = [
    { n: data.perlu_verifikasi, teks: 'Pembayaran menunggu verifikasi', ke: '/admin/pembayaran', Ikon: Wallet },
    { n: data.perlu_dirangkai, teks: 'Pesanan siap dirangkai', ke: '/admin/pesanan?status=sedang_dirangkai', Ikon: Flower2 },
    {
      n: data.menunggu_persetujuan_foto,
      teks: 'Foto menunggu persetujuan pelanggan',
      ke: '/admin/pesanan?status=menunggu_persetujuan_foto',
      Ikon: ImageUp,
    },
    { n: data.perlu_pengembalian_dana, teks: 'Pengembalian dana perlu diproses', ke: '/admin/pesanan?status=dibatalkan', Ikon: RotateCcw },
    { n: data.komplain_baru, teks: 'Komplain baru dari pelanggan', ke: '/admin/komplain', Ikon: MessageSquareWarning },
  ]
  const grafik = data.grafik_pesanan_mingguan.map((t) => ({
    label: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(`${t.tanggal}T12:00:00+07:00`)),
    labelPanjang: formatTanggalHari(t.tanggal),
    nilai: t.jumlah,
  }))
  const total7 = grafik.reduce((t, g) => t + g.nilai, 0)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Selamat datang, {sesi?.pengguna.nama.split(' ')[0]}!</h1>
          <p className="mt-1 text-sm text-ad-redup">Berikut ringkasan operasional toko hari ini.</p>
        </div>
        <p className="flex items-center gap-2 rounded-xl border border-ad-garis bg-ad-permukaan px-3 py-2 text-sm font-semibold">
          <CalendarDays aria-hidden className="size-4 text-ad-aksen" /> {formatTanggalHari(hariIni)}
        </p>
      </div>

      <section aria-label="Ringkasan angka" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuAngka
          judul="Pesanan aktif"
          nilai={String(data.pesanan_aktif)}
          ket="Sedang berjalan"
          Ikon={ClipboardList}
          nada="bg-ad-info-lembut text-ad-info"
          ke="/admin/pesanan"
        />
        <KartuAngka
          judul="Penjualan hari ini"
          nilai={formatRupiah(data.penjualan_hari_ini)}
          ket="Pembayaran sah hari ini"
          Ikon={CircleDollarSign}
          nada="bg-ad-sukses-lembut text-ad-sukses"
          ke="/admin/laporan"
        />
        <KartuAngka
          judul="Penjualan minggu ini"
          nilai={formatRupiah(data.penjualan_minggu_ini)}
          ket="Sejak Senin"
          Ikon={CircleDollarSign}
          nada="bg-ad-ungu-lembut text-ad-ungu"
          ke="/admin/laporan"
        />
        <KartuAngka
          judul="Stok menipis"
          nilai={String(data.stok_menipis.length)}
          ket={data.stok_menipis.length ? data.stok_menipis.slice(0, 2).join(', ') : 'Semua stok aman'}
          Ikon={Boxes}
          nada="bg-ad-peringatan-lembut text-ad-peringatan"
          ke="/admin/stok?menipis=1"
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Kartu>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Pesanan masuk 7 hari terakhir</h2>
            <p className="text-sm text-ad-redup">
              Total <strong className="text-ad-teks tabular-nums">{total7}</strong> pesanan
            </p>
          </div>
          <GrafikBatang data={grafik} namaNilai="Jumlah pesanan" />
        </Kartu>
        <Kartu>
          <h2 className="mb-3 text-lg font-bold">Perlu tindakan</h2>
          <ul className="flex flex-col gap-2">
            {tindakan.map(({ n, teks, ke, Ikon }) => (
              <li key={teks}>
                <Link
                  to={ke}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-xl border px-3 transition-colors hover:bg-ad-latar',
                    n > 0 ? 'border-ad-aksen/40 bg-ad-aksen-lembut/50' : 'border-ad-garis',
                  )}
                >
                  <Ikon aria-hidden className={cn('size-5 shrink-0', n > 0 ? 'text-ad-aksen' : 'text-ad-redup')} />
                  <span className="flex-1 text-sm font-semibold">{teks}</span>
                  <span
                    className={cn(
                      'min-w-8 rounded-lg px-2 py-1 text-center text-sm font-bold tabular-nums',
                      n > 0 ? 'bg-ad-aksen text-white' : 'bg-ad-latar text-ad-redup',
                    )}
                  >
                    {n}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>
      </div>

      <section aria-label="Aksi cepat" className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { ke: '/admin/pesanan', teks: 'Lihat pesanan', Ikon: ClipboardList },
          { ke: '/admin/pembayaran', teks: 'Verifikasi pembayaran', Ikon: Wallet },
          { ke: '/admin/stok/pindai', teks: 'Pindai stok masuk', Ikon: ScanLine },
        ].map(({ ke, teks, Ikon }) => (
          <Link
            key={ke}
            to={ke}
            className="flex min-h-16 items-center gap-3 rounded-2xl bg-ad-aksen px-5 font-semibold text-white shadow-sm hover:opacity-90"
          >
            <Ikon aria-hidden className="size-6" /> {teks}
          </Link>
        ))}
      </section>
      {data.stok_menipis.length > 0 && (
        <p className="mt-4 text-xs text-ad-redup">
          Stok menipis per {formatTanggal(hariIni)}: {data.stok_menipis.join(', ')}.
        </p>
      )}
    </>
  )
}
