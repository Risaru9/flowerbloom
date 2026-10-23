import { MessageSquareWarning } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useAdminKomplain, useTanggapiKomplain } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { AreaTeks, Bidang, Pilihan } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Kerangka, Kosong } from '@/komponen/ui/Keadaan'
import { FotoBunga, useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'
import { formatTanggalJam } from '@/lib/format'
import { JudulAdmin } from '@/tata-letak/TataLetakAdmin'

const LABEL: Record<Skema['StatusKomplain'], string> = { baru: 'Baru', diproses: 'Diproses', selesai: 'Selesai' }
const NADA: Record<Skema['StatusKomplain'], string> = {
  baru: 'bg-ad-aksen-lembut text-ad-aksen',
  diproses: 'bg-ad-info-lembut text-ad-info',
  selesai: 'bg-ad-sukses-lembut text-ad-sukses',
}

export function HalamanKomplain() {
  useJudul('Komplain Pelanggan')
  const [status, setStatus] = useState<Skema['StatusKomplain'] | ''>('baru')
  const { data, isPending, isError, error, refetch } = useAdminKomplain(status || undefined)
  const tanggapi = useTanggapiKomplain()
  const [aktif, setAktif] = useState<Skema['KomplainAdminOut'] | null>(null)
  const [isi, setIsi] = useState('')
  const [statusBaru, setStatusBaru] = useState<Skema['StatusKomplain']>('selesai')

  return (
    <>
      <JudulAdmin judul="Komplain" keterangan="Tanggapi keluhan pelanggan; batas pengajuan 1×24 jam setelah pesanan diterima." jejak={[{ ke: '/admin', label: 'Dasbor' }]} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['baru', 'diproses', 'selesai', ''] as const).map((s) => (
          <button
            key={s || 'semua'}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn('min-h-10 rounded-full border px-4 text-sm font-semibold', status === s ? 'border-ad-aksen bg-ad-aksen text-white' : 'border-ad-garis bg-ad-permukaan')}
          >
            {s ? LABEL[s] : 'Semua'}
          </button>
        ))}
      </div>
      {isPending ? (
        <Kerangka className="h-32 rounded-2xl bg-ad-garis/60" />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : data.length === 0 ? (
        <Kosong ikon={<MessageSquareWarning className="size-8" />} judul="Tidak ada komplain" pesan="Belum ada keluhan dengan status ini." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((k) => (
            <li key={k.id_komplain} className="flex flex-col gap-3 rounded-2xl border border-ad-garis bg-ad-permukaan p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', NADA[k.status])}>{LABEL[k.status]}</span>
                <Link to={`/admin/pesanan/${k.id_pesanan}`} className="font-mono text-sm font-semibold text-ad-aksen underline">
                  {k.kode_pesanan}
                </Link>
                <span className="ms-auto text-xs text-ad-redup">{formatTanggalJam(k.dibuat_pada)}</span>
              </div>
              <p className="text-sm font-semibold">{k.pemesan.nama}</p>
              <div className="flex gap-3">
                {k.foto_url && <FotoBunga src={k.foto_url} alt="Foto keluhan pelanggan" className="size-24 shrink-0 rounded-xl" />}
                <p className="text-sm">{k.isi}</p>
              </div>
              {k.tanggapan_admin && <p className="rounded-xl bg-ad-latar p-3 text-sm">Tanggapan: {k.tanggapan_admin}</p>}
              <Tombol
                varian={k.status === 'selesai' ? 'admin-garis' : 'admin'}
                ukuran="kecil"
                className="self-start rounded-lg"
                onClick={() => {
                  setAktif(k)
                  setIsi(k.tanggapan_admin ?? '')
                  setStatusBaru(k.status === 'baru' ? 'diproses' : 'selesai')
                }}
              >
                {k.tanggapan_admin ? 'Ubah tanggapan' : 'Tanggapi'}
              </Tombol>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        gaya="admin"
        terbuka={!!aktif}
        saatTutup={() => setAktif(null)}
        judul="Tanggapi komplain"
        deskripsi={aktif ? `Pesanan ${aktif.kode_pesanan} — ${aktif.pemesan.nama}` : undefined}
        kaki={
          <>
            <Tombol varian="admin-garis" className="rounded-xl" onClick={() => setAktif(null)}>
              Batal
            </Tombol>
            <Tombol
              varian="admin"
              className="rounded-xl"
              disabled={isi.trim().length < 3}
              memuat={tanggapi.isPending}
              onClick={() =>
                aktif &&
                tanggapi.mutate(
                  { id: aktif.id_komplain, isian: { tanggapan: isi.trim(), status: statusBaru } },
                  {
                    onSuccess: () => {
                      setAktif(null)
                      tampilkanToast('Tanggapan terkirim ke pelanggan.')
                    },
                    onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                  },
                )
              }
            >
              Kirim tanggapan
            </Tombol>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Bidang label="Tanggapan untuk pelanggan" gaya="admin" wajib>
            <AreaTeks gaya="admin" value={isi} onChange={(e) => setIsi(e.target.value)} maxLength={1000} />
          </Bidang>
          <Bidang label="Status" gaya="admin">
            <Pilihan gaya="admin" value={statusBaru} onChange={(e) => setStatusBaru(e.target.value as Skema['StatusKomplain'])}>
              <option value="diproses">Diproses</option>
              <option value="selesai">Selesai</option>
            </Pilihan>
          </Bidang>
        </div>
      </Dialog>
    </>
  )
}
