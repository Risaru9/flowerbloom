import { Download } from 'lucide-react'
import { useState } from 'react'

import { useLaporan } from '@/api/admin'
import { GrafikBatang } from '@/komponen/GrafikBatang'
import { Bidang, Masukan } from '@/komponen/ui/Bidang'
import { Galat, Kerangka } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { Tombol } from '@/komponen/ui/Tombol'
import { formatRupiah, formatTanggal, tanggalWibPlus } from '@/lib/format'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

const PRESET = [
  { label: '7 hari', hari: 7 },
  { label: '30 hari', hari: 30 },
  { label: '90 hari', hari: 90 },
]

/** Rupiah ringkas untuk sumbu grafik: 1,5 jt, 250 rb. */
const singkat = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : n >= 1000
      ? `${Math.round(n / 1000)} rb`
      : String(n)

function unduhCsv(nama: string, baris: (string | number)[][]) {
  const isi = baris.map((b) => b.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nama })
  a.click()
  URL.revokeObjectURL(url)
}

export function HalamanLaporan() {
  useJudul('Laporan Penjualan')
  const [dari, setDari] = useState(tanggalWibPlus(-29))
  const [sampai, setSampai] = useState(tanggalWibPlus(0))
  const { data, isPending, isError, error, refetch } = useLaporan(dari, sampai)

  const grafik = (data?.penjualan_per_minggu ?? []).map((m) => ({
    label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(
      new Date(`${m.awal_minggu}T12:00:00+07:00`),
    ),
    labelPanjang: `Minggu mulai ${formatTanggal(m.awal_minggu)} (${m.jumlah_pesanan} pesanan)`,
    nilai: m.total,
  }))

  return (
    <>
      <JudulAdmin
        judul="Laporan Penjualan"
        keterangan="Penjualan dari pembayaran yang sah, produk terlaris, revisi, komplain, dan pembatalan."
        jejak={[{ ke: '/admin', label: 'Dasbor' }]}
        aksi={
          data && (
            <Tombol
              varian="admin-garis"
              className="rounded-xl"
              ikon={<Download aria-hidden className="size-4" />}
              onClick={() =>
                unduhCsv(`laporan-flowerbloom-${dari}-${sampai}.csv`, [
                  ['Ringkasan', `${dari} s.d. ${sampai}`],
                  ['Total penjualan', data.total_penjualan],
                  ['Pesanan dibayar', data.jumlah_pesanan_berbayar],
                  ['Revisi foto', data.jumlah_revisi],
                  ['Komplain', data.jumlah_komplain],
                  ['Dibatalkan', data.jumlah_dibatalkan],
                  [],
                  ['Awal minggu', 'Jumlah pesanan', 'Total penjualan'],
                  ...data.penjualan_per_minggu.map((m) => [m.awal_minggu, m.jumlah_pesanan, m.total]),
                  [],
                  ['Produk terlaris', 'Terjual'],
                  ...data.terlaris.map((t) => [t.nama, t.terjual]),
                ])
              }
            >
              Unduh CSV
            </Tombol>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-ad-garis bg-ad-permukaan p-3">
        <Bidang label="Dari" gaya="admin">
          <Masukan gaya="admin" type="date" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)} />
        </Bidang>
        <Bidang label="Sampai" gaya="admin">
          <Masukan gaya="admin" type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} />
        </Bidang>
        <div role="group" aria-label="Rentang cepat" className="flex gap-1">
          {PRESET.map((p) => (
            <button
              key={p.hari}
              type="button"
              onClick={() => {
                setDari(tanggalWibPlus(-(p.hari - 1)))
                setSampai(tanggalWibPlus(0))
              }}
              className="h-11 rounded-xl border border-ad-garis px-3 text-sm font-semibold hover:bg-ad-latar"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {isPending ? (
        <Kerangka className="h-64 rounded-2xl bg-ad-garis/60" />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : (
        <>
          <section aria-label="Ringkasan" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Total penjualan', formatRupiah(data.total_penjualan)],
              ['Pesanan dibayar', String(data.jumlah_pesanan_berbayar)],
              ['Revisi foto', String(data.jumlah_revisi)],
              ['Komplain', String(data.jumlah_komplain)],
              ['Dibatalkan', String(data.jumlah_dibatalkan)],
            ].map(([j, n]) => (
              <Kartu key={j}>
                <p className="text-sm font-semibold text-ad-redup">{j}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{n}</p>
              </Kartu>
            ))}
          </section>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Kartu>
              <h2 className="mb-2 text-lg font-bold">Penjualan per minggu</h2>
              {grafik.length ? (
                <GrafikBatang data={grafik} namaNilai="Penjualan" format={singkat} />
              ) : (
                <p className="text-sm text-ad-redup">Belum ada penjualan pada rentang ini.</p>
              )}
            </Kartu>
            <Kartu>
              <h2 className="mb-3 text-lg font-bold">Produk terlaris</h2>
              {data.terlaris.length === 0 ? (
                <p className="text-sm text-ad-redup">Belum ada data.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.terlaris.map((t, i) => {
                    const maks = data.terlaris[0]?.terjual || 1
                    return (
                      <li key={t.nama} className="text-sm">
                        <div className="flex justify-between gap-2">
                          <span>
                            <span className="me-2 font-bold text-ad-redup tabular-nums">{i + 1}.</span>
                            {t.nama}
                          </span>
                          <span className="font-semibold tabular-nums">{t.terjual}</span>
                        </div>
                        <div aria-hidden className="mt-1 h-1.5 rounded-full bg-ad-latar">
                          <div className="h-full rounded-full bg-ad-grafik" style={{ width: `${(t.terjual / maks) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Kartu>
          </div>
        </>
      )}
    </>
  )
}
