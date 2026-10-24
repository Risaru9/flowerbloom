import { ChevronRight, ClipboardList, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useAdminPesanan } from '@/api/admin'
import type { Skema } from '@/api/client'
import { LABEL_SERAH } from '@/fitur/pesanan/bersama'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { LencanaStatus, Paginasi, useJudul } from '@/komponen/ui/Lain'
import { formatRupiah, formatTanggal } from '@/lib/format'
import { JudulAdmin } from '@/tata-letak/TataLetakAdmin'

import { BenderaPesanan, LABEL_STATUS } from './bersama-admin'

export function HalamanDaftarPesanan() {
  useJudul('Daftar Pesanan')
  const [q, setQ] = useSearchParams()
  const status = (q.get('status') || undefined) as Skema['StatusPesanan'] | undefined
  const cari = q.get('cari') ?? ''
  const perlu = q.get('perlu') === '1'
  const halaman = Math.max(1, Number(q.get('hal')) || 1)
  const [ketik, setKetik] = useState(cari)
  const [cariSebelum, setCariSebelum] = useState(cari)
  if (cariSebelum !== cari) {
    // Kata kunci di URL berubah dari luar (mis. kotak cari di bilah atas): samakan isian.
    setCariSebelum(cari)
    setKetik(cari)
  }

  const { data, isPending, isError, error, refetch, isFetching } = useAdminPesanan({
    status,
    cari: cari || undefined,
    perlu_tindakan: perlu || undefined,
    halaman,
    per_halaman: 20,
  })

  const atur = (kunci: string, nilai: string | null) =>
    setQ((l) => {
      const b = new URLSearchParams(l)
      if (nilai) b.set(kunci, nilai)
      else b.delete(kunci)
      if (kunci !== 'hal') b.delete('hal')
      return b
    })

  return (
    <>
      <JudulAdmin
        judul="Daftar Pesanan"
        keterangan="Pantau seluruh pesanan pelanggan dan tahap pengerjaannya."
        jejak={[{ ke: '/admin', label: 'Dasbor' }]}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-ad-garis bg-ad-permukaan p-3">
        <form
          role="search"
          className="relative min-w-0 flex-1 basis-60"
          onSubmit={(e) => {
            e.preventDefault()
            atur('cari', ketik.trim() || null)
          }}
        >
          <label htmlFor="cari-pesanan" className="sr-only">
            Cari kode, pemesan, atau rangkaian
          </label>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-redup" />
          <input
            id="cari-pesanan"
            type="search"
            value={ketik}
            onChange={(e) => setKetik(e.target.value)}
            placeholder="Cari kode, pemesan, atau rangkaian… (Enter)"
            className="h-11 w-full rounded-xl border border-ad-garis bg-ad-latar ps-9 pe-3 text-sm focus:border-ad-aksen focus:outline-none"
          />
        </form>
        <div className="flex flex-col gap-1">
          <label htmlFor="saring-status" className="text-xs font-semibold text-ad-redup">
            Status
          </label>
          <select
            id="saring-status"
            value={status ?? ''}
            onChange={(e) => atur('status', e.target.value || null)}
            className="h-11 rounded-xl border border-ad-garis bg-ad-latar px-3 text-sm focus:border-ad-aksen focus:outline-none"
          >
            <option value="">Semua status</option>
            {Object.entries(LABEL_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-ad-garis px-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={perlu}
            onChange={(e) => atur('perlu', e.target.checked ? '1' : null)}
            className="size-4 accent-ad-aksen"
          />
          Perlu tindakan saja
        </label>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Kerangka key={i} className="h-16 rounded-xl bg-ad-garis/60" />
          ))}
        </div>
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <Kosong ikon={<ClipboardList className="size-8" />} judul="Tidak ada pesanan" pesan="Coba ubah kata kunci atau saringan status." />
      ) : (
        <div aria-busy={isFetching}>
          <p className="mb-2 text-sm text-ad-redup" aria-live="polite">
            {data.total} pesanan
          </p>
          {/* Tabel untuk layar lebar */}
          <div className="hidden overflow-x-auto rounded-2xl border border-ad-garis bg-ad-permukaan md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Daftar pesanan</caption>
              <thead className="bg-ad-latar text-xs text-ad-redup uppercase">
                <tr>
                  {['Kode', 'Pemesan', 'Rangkaian', 'Serah terima', 'Total', 'Status', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 text-start font-semibold">
                      {h || <span className="sr-only">Aksi</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id_pesanan} className="border-t border-ad-garis align-top hover:bg-ad-latar/60">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold">{p.kode_pesanan}</span>
                      <span className="block text-xs text-ad-redup">{formatTanggal(p.dibuat_pada)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.pemesan.nama}
                      <span className="block text-xs text-ad-redup">untuk {p.nama_penerima}</span>
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <span className="line-clamp-2">{p.ringkasan_item}</span>
                      <BenderaPesanan p={p} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatTanggal(p.tanggal_kirim)}
                      <span className="block text-xs text-ad-redup">
                        {p.slot_jam} · {LABEL_SERAH[p.cara_serah_terima]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">{formatRupiah(p.total_harga)}</td>
                    <td className="px-4 py-3">
                      <LencanaStatus status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/pesanan/${p.id_pesanan}`}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-ad-aksen hover:bg-ad-aksen-lembut"
                      >
                        Detail <ChevronRight aria-hidden className="size-4" />
                        <span className="sr-only">pesanan {p.kode_pesanan}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Kartu untuk ponsel */}
          <ul className="flex flex-col gap-2 md:hidden">
            {data.data.map((p) => (
              <li key={p.id_pesanan}>
                <Link to={`/admin/pesanan/${p.id_pesanan}`} className="block rounded-2xl border border-ad-garis bg-ad-permukaan p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-semibold">{p.kode_pesanan}</span>
                    <span className="font-semibold tabular-nums">{formatRupiah(p.total_harga)}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm">{p.ringkasan_item}</p>
                  <p className="text-xs text-ad-redup">
                    {p.pemesan.nama} · {formatTanggal(p.tanggal_kirim)} {p.slot_jam}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <LencanaStatus status={p.status} />
                    <BenderaPesanan p={p} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Paginasi gaya="admin" halaman={halaman} total={data.total} perHalaman={data.per_halaman} ubah={(h) => atur('hal', String(h))} />
        </div>
      )}
    </>
  )
}
