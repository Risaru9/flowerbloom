import { ScanSearch } from 'lucide-react'
import { useState } from 'react'

import { useRingkasanAkurasi, useRiwayatPindai } from '@/api/admin'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { FotoBunga, Paginasi, useJudul } from '@/komponen/ui/Lain'
import { cn } from '@/lib/cn'
import { formatTanggalJam } from '@/lib/format'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

const persen = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)

export function HalamanRiwayatPindai() {
  useJudul('Riwayat Pindai')
  const [halaman, setHalaman] = useState(1)
  const [koreksi, setKoreksi] = useState(false)
  const ringkas = useRingkasanAkurasi()
  const { data, isPending, isError, error, refetch } = useRiwayatPindai({ halaman, per_halaman: 20, hanya_dikoreksi: koreksi || undefined })

  return (
    <>
      <JudulAdmin
        judul="Riwayat Pindai"
        keterangan="Setiap pemindaian dan koreksi admin; dipakai untuk menilai akurasi model di pemakaian nyata."
        jejak={[
          { ke: '/admin', label: 'Dasbor' },
          { ke: '/admin/stok', label: 'Stok' },
        ]}
      />
      <section aria-label="Akurasi model" className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Pindai disimpan', ringkas.data ? String(ringkas.data.total_disimpan) : '—', 'hasil yang diperiksa admin'],
          ['Akurasi jenis', persen(ringkas.data?.akurasi_jenis ?? null), `${ringkas.data?.jenis_benar ?? 0} benar tanpa koreksi`],
          ['Akurasi warna', persen(ringkas.data?.akurasi_warna ?? null), `${ringkas.data?.warna_benar ?? 0} benar tanpa koreksi`],
        ].map(([judul, nilai, ket]) => (
          <Kartu key={judul}>
            <p className="text-sm font-semibold text-ad-redup">{judul}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{nilai}</p>
            <p className="text-xs text-ad-redup">{ket}</p>
          </Kartu>
        ))}
      </section>
      <label className="mb-3 inline-flex h-11 items-center gap-2 rounded-xl border border-ad-garis bg-ad-permukaan px-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={koreksi}
          onChange={(e) => {
            setKoreksi(e.target.checked)
            setHalaman(1)
          }}
          className="size-4 accent-ad-aksen"
        />
        Hanya yang dikoreksi admin
      </label>
      {isPending ? (
        <Kerangka className="h-48 rounded-2xl bg-ad-garis/60" />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <Kosong ikon={<ScanSearch className="size-8" />} judul="Belum ada riwayat" pesan="Hasil pemindaian akan tercatat di sini." />
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((r) => (
              <li key={r.id_pindai} className="flex gap-3 rounded-2xl border border-ad-garis bg-ad-permukaan p-3">
                <FotoBunga src={r.foto_url} alt="Foto pindai" className="size-20 shrink-0 rounded-xl" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{r.jenis_prediksi ?? 'Tidak dikenali'}</p>
                  <p className="text-ad-redup">Warna: {r.warna_prediksi ?? '—'}</p>
                  <p className="text-xs text-ad-redup">
                    {r.konteks === 'mode_rangkai' ? 'Mode merangkai' : 'Stok masuk'} · {formatTanggalJam(r.waktu_pindai)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {r.tingkat_keyakinan !== null && (
                      <span className="rounded-md bg-ad-latar px-1.5 text-xs font-semibold tabular-nums">
                        {Math.round(r.tingkat_keyakinan * 100)}% yakin
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-md px-1.5 text-xs font-bold',
                        r.dikoreksi ? 'bg-ad-peringatan-lembut text-ad-peringatan' : 'bg-ad-sukses-lembut text-ad-sukses',
                      )}
                    >
                      {r.dikoreksi ? 'Dikoreksi admin' : 'Sesuai AI'}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Paginasi gaya="admin" halaman={halaman} total={data.total} perHalaman={data.per_halaman} ubah={setHalaman} />
        </>
      )}
    </>
  )
}
