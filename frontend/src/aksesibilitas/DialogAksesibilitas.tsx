import { Contrast, Moon, Volume2 } from 'lucide-react'
import { useState } from 'react'

import { pesanGalat } from '@/api/client'
import { useUbahAksesibilitas } from '@/api/pelanggan'
import { useSesi } from '@/auth/sesi'
import { Dialog } from '@/komponen/ui/Dialog'
import { Sakelar } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'

import {
  aturAksesibilitas,
  BAWAAN,
  keServer,
  LANGKAH_TEKS,
  PILIHAN_MODE,
  useAksesibilitas,
  type PengaturanAksesibilitas,
} from './pengaturan'

export function DialogAksesibilitas({ terbuka, saatTutup }: { terbuka: boolean; saatTutup: () => void }) {
  const tersimpan = useAksesibilitas()
  const [draf, setDraf] = useState<PengaturanAksesibilitas>(tersimpan)
  const sesi = useSesi()
  const ubahServer = useUbahAksesibilitas()

  // Draf disegarkan setiap kali dialog dibuka.
  const [terakhirBuka, setTerakhirBuka] = useState(false)
  if (terbuka !== terakhirBuka) {
    setTerakhirBuka(terbuka)
    if (terbuka) setDraf(tersimpan)
  }

  const ubah = (sebagian: Partial<PengaturanAksesibilitas>) => setDraf((d) => ({ ...d, ...sebagian }))
  const idxTeks = Math.max(
    0,
    LANGKAH_TEKS.findIndex((n) => n >= draf.ukuran_teks),
  )

  async function terapkanPengaturan() {
    const hasil = aturAksesibilitas(draf)
    saatTutup()
    if (sesi?.pengguna.peran === 'pelanggan') {
      try {
        await ubahServer.mutateAsync(keServer(hasil))
      } catch (e) {
        tampilkanToast(`Pengaturan diterapkan di perangkat ini, tetapi gagal disimpan ke akun: ${pesanGalat(e)}`, 'info')
        return
      }
    }
    tampilkanToast('Pengaturan aksesibilitas diterapkan.')
  }

  return (
    <Dialog
      terbuka={terbuka}
      saatTutup={saatTutup}
      judul="Pengaturan Aksesibilitas"
      deskripsi="Sesuaikan tampilan sesuai kebutuhanmu. Pengaturan tersimpan di perangkat ini dan di akunmu."
      kaki={
        <>
          <Tombol varian="garis" onClick={() => setDraf(BAWAAN)}>
            Atur ulang
          </Tombol>
          <Tombol onClick={terapkanPengaturan} memuat={ubahServer.isPending}>
            Terapkan
          </Tombol>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="rounded-2xl border-2 border-garis p-4">
          <legend className="px-1 font-display text-lg text-rose-teks">Mode tampilan warna</legend>
          <p className="mb-3 text-xs text-redup">
            Foto bunga diberi penajaman warna agar perbedaan warna lebih mudah dikenali sesuai jenis buta warna.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PILIHAN_MODE.map((m) => {
              const dipilih = draf.jenis_buta_warna === m.nilai
              return (
                <label
                  key={m.nilai}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 text-center transition-colors',
                    'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-magenta',
                    dipilih ? 'border-rose-teks bg-blush' : 'border-garis bg-permukaan hover:bg-blush/50',
                  )}
                >
                  <input
                    type="radio"
                    name="mode-warna"
                    value={m.nilai}
                    checked={dipilih}
                    onChange={() => ubah({ jenis_buta_warna: m.nilai, penajaman_warna: m.nilai !== 'normal' })}
                    className="sr-only"
                  />
                  <span aria-hidden className="flex -space-x-1.5">
                    {m.contoh.map((c) => (
                      <span key={c} className="size-5 rounded-full border-2 border-permukaan" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <span className="text-sm font-semibold text-olive-tua">{m.label}</span>
                  <span className="text-[0.7rem] leading-tight text-redup">{m.keterangan}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <Sakelar
          nyala={draf.suara_aktif}
          ubah={(v) => ubah({ suara_aktif: v })}
          label="Deskripsi suara"
          keterangan="Tampilkan tombol untuk mendengarkan informasi bunga dan warna."
          ikon={<Volume2 className="size-5" />}
        />
        <Sakelar
          nyala={draf.kontras_tinggi}
          ubah={(v) => ubah({ kontras_tinggi: v })}
          label="Kontras tinggi"
          keterangan="Teks dan garis lebih tegas agar mudah dibaca."
          ikon={<Contrast className="size-5" />}
        />
        <Sakelar
          nyala={draf.tema === 'gelap'}
          ubah={(v) => ubah({ tema: v ? 'gelap' : 'terang' })}
          label="Tema gelap"
          keterangan="Latar gelap yang lebih nyaman di malam hari."
          ikon={<Moon className="size-5" />}
        />

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-garis bg-permukaan px-4 py-3">
          <span className="flex-1">
            <span className="block font-semibold text-olive-tua">Ukuran teks</span>
            <span className="block text-xs text-redup">Saat ini {draf.ukuran_teks}% dari ukuran standar.</span>
          </span>
          <div role="group" aria-label="Ukuran teks" className="inline-flex items-center rounded-full bg-blush p-1">
            <button
              type="button"
              aria-label="Perkecil teks"
              disabled={idxTeks <= 0}
              onClick={() => ubah({ ukuran_teks: LANGKAH_TEKS[Math.max(0, idxTeks - 1)] ?? 100 })}
              className="grid size-10 place-items-center rounded-full font-bold text-rose-tua disabled:opacity-40"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() => ubah({ ukuran_teks: 100 })}
              className="min-h-10 rounded-full bg-blush-2 px-3 text-xs font-semibold text-rose-tua"
            >
              Standar
            </button>
            <button
              type="button"
              aria-label="Perbesar teks"
              disabled={idxTeks >= LANGKAH_TEKS.length - 1}
              onClick={() => ubah({ ukuran_teks: LANGKAH_TEKS[Math.min(LANGKAH_TEKS.length - 1, idxTeks + 1)] ?? 100 })}
              className="grid size-10 place-items-center rounded-full font-bold text-rose-tua disabled:opacity-40"
            >
              A+
            </button>
          </div>
        </div>

        {draf.suara_aktif && (
          <label className="flex flex-col gap-1 rounded-2xl border-2 border-garis bg-permukaan px-4 py-3">
            <span className="font-semibold text-olive-tua">Kecepatan suara: {draf.kecepatan_suara.toFixed(1)}×</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={draf.kecepatan_suara}
              onChange={(e) => ubah({ kecepatan_suara: Number(e.target.value) })}
              className="accent-rose-teks"
            />
          </label>
        )}
      </div>
    </Dialog>
  )
}
