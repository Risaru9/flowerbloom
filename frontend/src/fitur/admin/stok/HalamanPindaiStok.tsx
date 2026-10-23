import { CircleAlert, ScanLine, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { usePindaiStok, useSimpanPindai } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { UnggahFoto } from '@/fitur/pesanan/bersama'
import { Bidang, Masukan } from '@/komponen/ui/Bidang'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

import { PilihJenis, PilihWarna } from './PilihBunga'

/** Pindai stok masuk (F-AD-11): AI mengenali jenis dan warna, admin memeriksa/mengoreksi sebelum disimpan (F-AI-03). */
export function HalamanPindaiStok() {
  useJudul('Pindai Stok Masuk')
  const pindai = usePindaiStok()
  const simpan = useSimpanPindai()
  const [foto, setFoto] = useState<File | null>(null)
  const [hasil, setHasil] = useState<Skema['HasilPindaiOut'] | null>(null)
  const [jenis, setJenis] = useState<number | ''>('')
  const [warna, setWarna] = useState<number | ''>('')
  const [jumlah, setJumlah] = useState('')
  const [harga, setHarga] = useState('')

  function mulaiPindai() {
    if (!foto) return
    pindai.mutate(foto, {
      onSuccess: (h) => {
        setHasil(h)
        setJenis(h.jenis?.id_jenis_bunga ?? '')
        setWarna(h.warna.id_warna)
      },
      onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
    })
  }

  function ulang() {
    setHasil(null)
    setFoto(null)
    setJumlah('')
  }

  const persen = hasil ? Math.round(hasil.tingkat_keyakinan * 100) : 0

  return (
    <>
      <JudulAdmin
        judul="Pindai Stok Masuk"
        keterangan="Foto satu jenis bunga yang baru datang. Periksa hasil AI, koreksi bila perlu, lalu simpan sebagai stok."
        jejak={[
          { ke: '/admin', label: 'Dasbor' },
          { ke: '/admin/stok', label: 'Stok' },
        ]}
        aksi={
          <Link to="/admin/stok/riwayat" className="text-sm font-semibold text-ad-aksen underline">
            Riwayat pindai
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Kartu>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <ScanLine aria-hidden className="size-5 text-ad-aksen" /> 1. Ambil foto
          </h2>
          <UnggahFoto gaya="admin" kamera label="Foto bunga (satu jenis per foto)" berkas={foto} ubah={(f) => { setFoto(f); setHasil(null) }} />
          <p className="mt-2 text-xs text-ad-redup">Tips: latar polos, cahaya cukup, bunga memenuhi sebagian besar bingkai.</p>
          <Tombol varian="admin" className="mt-3 w-full rounded-xl" disabled={!foto} memuat={pindai.isPending} onClick={mulaiPindai} ikon={<Sparkles aria-hidden className="size-4" />}>
            Kenali dengan AI
          </Tombol>
        </Kartu>

        <Kartu className={cn(!hasil && 'opacity-60')}>
          <h2 className="mb-3 text-lg font-bold">2. Periksa & simpan</h2>
          {!hasil ? (
            <p className="text-sm text-ad-redup">Hasil pengenalan akan muncul di sini.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div role="status" className={cn('rounded-xl p-4', hasil.dikenali ? 'bg-ad-sukses-lembut' : 'bg-ad-peringatan-lembut')}>
                <p className="text-sm font-semibold">{hasil.dikenali ? 'Bunga dikenali' : 'Keyakinan rendah — periksa jenisnya'}</p>
                <p className="mt-1 text-xl font-bold">{hasil.jenis?.nama_bunga ?? 'Jenis tidak dikenali'}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div role="meter" aria-label="Tingkat keyakinan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={persen} className="h-2 flex-1 overflow-hidden rounded-full bg-ad-permukaan">
                    <div className={cn('h-full rounded-full', hasil.dikenali ? 'bg-ad-sukses' : 'bg-ad-peringatan')} style={{ width: `${persen}%` }} />
                  </div>
                  <span className="text-sm font-bold tabular-nums">{persen}% yakin</span>
                </div>
                <p className="mt-2 text-sm">
                  Warna dominan: <ChipWarna warna={hasil.warna} ukuran="kecil" />
                </p>
                {hasil.deskripsi && <p className="mt-1 text-sm text-ad-redup">{hasil.deskripsi}</p>}
                {hasil.tiruan && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-ad-peringatan">
                    <CircleAlert aria-hidden className="size-4 shrink-0" /> Mode uji: jenis bunga dari AI tiruan karena model asli belum dipasang. Warna dibaca sungguhan.
                  </p>
                )}
                {hasil.peringatan.map((p) => (
                  <p key={p} className="mt-1 text-xs text-ad-peringatan">
                    • {p}
                  </p>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <PilihJenis nilai={jenis} ubah={setJenis} />
                <PilihWarna nilai={warna} ubah={setWarna} />
                <Bidang label="Jumlah tangkai" gaya="admin" wajib>
                  <Masukan gaya="admin" type="number" inputMode="numeric" min={1} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
                </Bidang>
                <Bidang label="Harga per tangkai (Rp)" gaya="admin" wajib>
                  <Masukan gaya="admin" type="number" inputMode="numeric" min={0} step={500} value={harga} onChange={(e) => setHarga(e.target.value)} />
                </Bidang>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tombol
                  varian="admin"
                  className="rounded-xl"
                  disabled={!jenis || !warna || !(Number(jumlah) > 0) || harga === ''}
                  memuat={simpan.isPending}
                  onClick={() =>
                    simpan.mutate(
                      { id_pindai: hasil.id_pindai, id_jenis_bunga: Number(jenis), id_warna: Number(warna), jumlah_tangkai: Number(jumlah), harga_per_tangkai: Number(harga) },
                      {
                        onSuccess: (s) => {
                          tampilkanToast(`Tersimpan: ${s.jenis.nama_bunga} ${s.warna.nama_warna}, tersedia ${s.jumlah_tersedia} tangkai.`)
                          ulang()
                        },
                        onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                      },
                    )
                  }
                >
                  Simpan ke stok
                </Tombol>
                <Tombol varian="admin-garis" className="rounded-xl" onClick={ulang}>
                  Pindai ulang
                </Tombol>
              </div>
            </div>
          )}
        </Kartu>
      </div>
    </>
  )
}
