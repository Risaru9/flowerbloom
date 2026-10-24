import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { usePengaturanToko, useUbahPengaturan } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { Bidang, Masukan, Pilihan } from '@/komponen/ui/Bidang'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

const JUDUL: Record<string, string> = {
  nama_toko: 'Nama toko',
  rekening_tujuan: 'Rekening tujuan transfer',
  batas_bayar_menit: 'Batas waktu bayar (menit)',
  ongkos_antar: 'Ongkos antar (Rp)',
  jasa_merangkai: 'Jasa merangkai (Rp)',
  jumlah_revisi_gratis: 'Revisi foto gratis',
  minimal_tangkai_rangkai_sendiri: 'Minimal tangkai rangkai sendiri',
  slot_pengiriman: 'Slot jam serah terima',
  kebijakan_pengganti: 'Kebijakan bunga pengganti',
  ambang_stok_menipis: 'Ambang stok menipis',
  minimal_hari_pemesanan: 'Minimal hari pemesanan (H-n)',
  batas_tanggapan_foto_jam: 'Batas tanggapan foto (jam)',
  batas_komplain_jam: 'Batas pengajuan komplain (jam)',
}

const PILIHAN: Record<string, [string, string][]> = {
  kebijakan_pengganti: [
    ['hanya_warna_berbeda', 'Persetujuan hanya bila warnanya berbeda'],
    ['semua_pengganti', 'Semua bunga pengganti wajib disetujui'],
  ],
}

const KELOMPOK: [string, string[]][] = [
  ['Toko & pembayaran', ['nama_toko', 'rekening_tujuan', 'batas_bayar_menit']],
  [
    'Harga & pengiriman',
    ['ongkos_antar', 'jasa_merangkai', 'minimal_tangkai_rangkai_sendiri', 'minimal_hari_pemesanan', 'slot_pengiriman'],
  ],
  [
    'Aturan pesanan',
    ['jumlah_revisi_gratis', 'kebijakan_pengganti', 'batas_tanggapan_foto_jam', 'batas_komplain_jam', 'ambang_stok_menipis'],
  ],
]

export function HalamanPengaturan() {
  useJudul('Pengaturan Toko')
  const { data, isPending, isError, error, refetch, dataUpdatedAt } = usePengaturanToko()
  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />
  // Formulir dipasang ulang setiap data dari server berubah (mis. setelah disimpan) sehingga draf ikut segar.
  return <FormPengaturan key={dataUpdatedAt} data={data} />
}

function FormPengaturan({ data }: { data: Skema['PengaturanItemOut'][] }) {
  const ubah = useUbahPengaturan()
  const [nilai, setNilai] = useState<Record<string, unknown>>(() => Object.fromEntries(data.map((d) => [d.kunci, d.nilai])))
  const [slotBaru, setSlotBaru] = useState('')

  const peta = new Map(data.map((d) => [d.kunci, d]))
  const berubah = data.filter((d) => JSON.stringify(nilai[d.kunci]) !== JSON.stringify(d.nilai))
  const kelompokLain = data.map((d) => d.kunci).filter((k) => !KELOMPOK.some(([, ks]) => ks.includes(k)))

  function simpan() {
    const perubahan = Object.fromEntries(berubah.map((d) => [d.kunci, nilai[d.kunci]]))
    ubah.mutate(perubahan, {
      onSuccess: () => tampilkanToast(`${berubah.length} pengaturan disimpan.`),
      onError: (e) => tampilkanToast(pesanGalat(e), 'galat', 7000),
    })
  }

  function kontrol(kunci: string) {
    const d = peta.get(kunci)
    if (!d) return null
    const label = JUDUL[kunci] ?? kunci
    if (d.tipe === 'int') {
      return (
        <Bidang key={kunci} label={label} gaya="admin" bantuan={d.keterangan}>
          <Masukan
            gaya="admin"
            type="number"
            inputMode="numeric"
            min={0}
            value={String(nilai[kunci] ?? '')}
            onChange={(e) => setNilai((n) => ({ ...n, [kunci]: e.target.value === '' ? '' : Math.trunc(Number(e.target.value)) }))}
          />
        </Bidang>
      )
    }
    if (d.tipe === 'pilihan') {
      return (
        <Bidang key={kunci} label={label} gaya="admin" bantuan={d.keterangan}>
          <Pilihan gaya="admin" value={String(nilai[kunci] ?? '')} onChange={(e) => setNilai((n) => ({ ...n, [kunci]: e.target.value }))}>
            {(PILIHAN[kunci] ?? []).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Pilihan>
        </Bidang>
      )
    }
    if (d.tipe === 'daftar_slot') {
      const slot = Array.isArray(nilai[kunci]) ? (nilai[kunci] as string[]) : []
      const sah = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(slotBaru)
      return (
        <fieldset key={kunci} className="flex flex-col gap-2 sm:col-span-2">
          <legend className="text-sm font-semibold">{label}</legend>
          <p className="text-xs text-ad-redup">{d.keterangan}</p>
          <ul className="flex flex-wrap gap-2">
            {slot.map((s) => (
              <li
                key={s}
                className="flex items-center gap-1 rounded-lg border border-ad-garis bg-ad-latar py-1 ps-3 pe-1 text-sm font-semibold tabular-nums"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Hapus slot ${s}`}
                  onClick={() => setNilai((n) => ({ ...n, [kunci]: slot.filter((x) => x !== s) }))}
                  className="grid size-7 place-items-center rounded-md hover:bg-ad-bahaya-lembut"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <Bidang label="Slot baru" gaya="admin" bantuan="Format HH:MM-HH:MM, mis. 17:00-19:00">
              <Masukan
                gaya="admin"
                value={slotBaru}
                onChange={(e) => setSlotBaru(e.target.value.trim())}
                placeholder="17:00-19:00"
                className="w-40"
              />
            </Bidang>
            <Tombol
              varian="admin-lembut"
              className="mb-6 rounded-xl"
              disabled={!sah || slot.includes(slotBaru)}
              ikon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setNilai((n) => ({ ...n, [kunci]: [...slot, slotBaru].sort() }))
                setSlotBaru('')
              }}
            >
              Tambah slot
            </Tombol>
          </div>
        </fieldset>
      )
    }
    return (
      <Bidang
        key={kunci}
        label={label}
        gaya="admin"
        bantuan={d.keterangan}
        className={kunci === 'rekening_tujuan' ? 'sm:col-span-2' : undefined}
      >
        <Masukan gaya="admin" value={String(nilai[kunci] ?? '')} onChange={(e) => setNilai((n) => ({ ...n, [kunci]: e.target.value }))} />
      </Bidang>
    )
  }

  return (
    <>
      <JudulAdmin
        judul="Pengaturan Toko"
        keterangan="Aturan toko yang langsung berlaku untuk pesanan baru."
        jejak={[{ ke: '/admin', label: 'Dasbor' }]}
        aksi={
          <Tombol varian="admin" className="rounded-xl" disabled={!berubah.length} memuat={ubah.isPending} onClick={simpan}>
            Simpan {berubah.length ? `(${berubah.length})` : ''}
          </Tombol>
        }
      />
      <div className="flex flex-col gap-4">
        {[...KELOMPOK, ...(kelompokLain.length ? ([['Lainnya', kelompokLain]] as [string, string[]][]) : [])].map(([judul, kunci]) => (
          <Kartu key={judul}>
            <h2 className="mb-4 text-lg font-bold">{judul}</h2>
            <div className="grid gap-5 sm:grid-cols-2">{kunci.map(kontrol)}</div>
          </Kartu>
        ))}
      </div>
      {berubah.length > 0 && (
        <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-ad-garis bg-ad-permukaan p-3 shadow-lg">
          <p className="text-sm">{berubah.length} perubahan belum disimpan.</p>
          <div className="flex gap-2">
            <Tombol
              varian="admin-garis"
              ukuran="kecil"
              className="rounded-lg"
              onClick={() => setNilai(Object.fromEntries(data.map((d) => [d.kunci, d.nilai])))}
            >
              Batalkan
            </Tombol>
            <Tombol varian="admin" ukuran="kecil" className="rounded-lg" memuat={ubah.isPending} onClick={simpan}>
              Simpan
            </Tombol>
          </div>
        </div>
      )}
    </>
  )
}
