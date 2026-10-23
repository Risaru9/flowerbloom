import { useState } from 'react'

import { useJenisBunga } from '@/api/admin'
import { useWarna } from '@/api/pelanggan'
import { Bidang, Masukan, Pilihan } from '@/komponen/ui/Bidang'
import { ChipWarna } from '@/komponen/ui/Warna'

/** Pemilih jenis bunga (dengan pencarian di antara ±100 jenis) dan warna (nama + kode hex). */
export function PilihJenis({ nilai, ubah, galat }: { nilai: number | ''; ubah: (id: number | '') => void; galat?: string }) {
  const [cari, setCari] = useState('')
  const { data } = useJenisBunga(cari.trim() || undefined)
  const daftar = data ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <Bidang label="Cari jenis bunga" gaya="admin" labelTersembunyi>
        <Masukan gaya="admin" type="search" placeholder="Cari jenis, mis. mawar…" value={cari} onChange={(e) => setCari(e.target.value)} />
      </Bidang>
      <Bidang label="Jenis bunga" gaya="admin" wajib galat={galat}>
        <Pilihan gaya="admin" value={nilai} onChange={(e) => ubah(e.target.value ? Number(e.target.value) : '')}>
          <option value="">{daftar.length ? `Pilih dari ${daftar.length} jenis…` : 'Tidak ada yang cocok'}</option>
          {daftar.map((j) => (
            <option key={j.id_jenis_bunga} value={j.id_jenis_bunga}>
              {j.nama_bunga}
              {j.nama_ilmiah ? ` (${j.nama_ilmiah})` : ''}
            </option>
          ))}
        </Pilihan>
      </Bidang>
    </div>
  )
}

export function PilihWarna({ nilai, ubah, galat }: { nilai: number | ''; ubah: (id: number | '') => void; galat?: string }) {
  const { data } = useWarna()
  const terpilih = data?.find((w) => w.id_warna === nilai)
  return (
    <div className="flex flex-col gap-1.5">
      <Bidang label="Warna" gaya="admin" wajib galat={galat}>
        <Pilihan gaya="admin" value={nilai} onChange={(e) => ubah(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Pilih warna…</option>
          {data?.map((w) => (
            <option key={w.id_warna} value={w.id_warna}>
              {w.nama_warna} — {w.kode_hex.toUpperCase()}
            </option>
          ))}
        </Pilihan>
      </Bidang>
      {terpilih && <ChipWarna warna={terpilih} makna={terpilih.makna_warna} ukuran="kecil" className="text-sm" />}
    </div>
  )
}
