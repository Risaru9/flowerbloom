import { Download, Share, SquarePlus, WifiOff, X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { Dialog } from '@/komponen/ui/Dialog'
import { Tombol } from '@/komponen/ui/Tombol'
import { bacaJson, tulisJson } from '@/lib/penyimpanan'

import { mintaPasang, usePasang } from './pasang'

/** Tombol "Pasang aplikasi": dialog bawaan peramban, atau panduan langkah untuk iPhone/iPad. */
export function TombolPasang({ varian = 'lembut', className }: { varian?: 'lembut' | 'garis' | 'admin-lembut'; className?: string }) {
  const { bisaDipasang, terpasang, perluPanduanIos } = usePasang()
  const [panduan, setPanduan] = useState(false)
  if (terpasang || (!bisaDipasang && !perluPanduanIos)) return null
  return (
    <>
      <Tombol
        varian={varian}
        ukuran="kecil"
        className={className}
        ikon={<Download aria-hidden className="size-4" />}
        onClick={() => (bisaDipasang ? void mintaPasang() : setPanduan(true))}
      >
        Pasang aplikasi
      </Tombol>
      <PanduanIos terbuka={panduan} saatTutup={() => setPanduan(false)} />
    </>
  )
}

function PanduanIos({ terbuka, saatTutup }: { terbuka: boolean; saatTutup: () => void }) {
  return (
    <Dialog terbuka={terbuka} saatTutup={saatTutup} judul="Pasang FlowerBloom di iPhone" lebar="sm">
      <ol className="flex list-decimal flex-col gap-3 ps-5 text-olive-tua">
        <li>
          Ketuk tombol <Share aria-label="Bagikan" className="inline size-5 align-text-bottom" /> <strong>Bagikan</strong> di bilah Safari.
        </li>
        <li>
          Pilih <SquarePlus aria-hidden className="inline size-5 align-text-bottom" /> <strong>Tambahkan ke Layar Utama</strong>.
        </li>
        <li>
          Ketuk <strong>Tambah</strong>. Ikon FlowerBloom akan muncul seperti aplikasi lain.
        </li>
      </ol>
    </Dialog>
  )
}

const KUNCI_SPANDUK = 'fb.spanduk-pasang.ditutup'

/** Spanduk ajakan memasang di ponsel; muncul sekali, bisa ditutup. */
export function SpandukPasang() {
  const { bisaDipasang, terpasang, perluPanduanIos } = usePasang()
  const [ditutup, setDitutup] = useState(() => bacaJson<boolean>(KUNCI_SPANDUK) === true)
  if (terpasang || ditutup || (!bisaDipasang && !perluPanduanIos)) return null
  const tutup = () => {
    tulisJson(KUNCI_SPANDUK, true)
    setDitutup(true)
  }
  return (
    <aside
      aria-label="Pasang aplikasi"
      className="mx-3 mb-3 flex items-center gap-3 rounded-2xl border-2 border-garis bg-permukaan p-3 shadow-sm md:hidden"
    >
      <img src="/pwa-64x64.png" alt="" className="size-10 rounded-xl" />
      <p className="flex-1 text-sm text-olive-tua">
        <strong>Pasang FlowerBloom</strong>
        <span className="block text-xs text-redup">Buka lebih cepat dari layar utama, seperti aplikasi.</span>
      </p>
      <TombolPasang />
      <button
        type="button"
        onClick={tutup}
        aria-label="Tutup ajakan pasang"
        className="grid size-9 place-items-center rounded-full hover:bg-blush"
      >
        <X aria-hidden className="size-4" />
      </button>
    </aside>
  )
}

/** Pemberitahuan versi baru: pengguna memilih kapan memuat ulang agar isian yang sedang diketik tidak hilang. */
export function PembaruanAplikasi() {
  const {
    needRefresh: [perluMuatUlang, setPerluMuatUlang],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Periksa versi baru tiap jam selama aplikasi terbuka.
      if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000)
    },
  })
  if (!perluMuatUlang) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-olive-tua px-4 py-3 text-sm text-latar shadow-xl"
    >
      <p className="flex-1">Versi baru FlowerBloom tersedia.</p>
      <button type="button" className="rounded-full px-3 py-1.5 font-semibold underline" onClick={() => setPerluMuatUlang(false)}>
        Nanti
      </button>
      <button
        type="button"
        className="rounded-full bg-latar px-3 py-1.5 font-semibold text-olive-tua"
        onClick={() => void updateServiceWorker(true)}
      >
        Muat ulang
      </button>
    </div>
  )
}

function langganJaringan(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useDaring(): boolean {
  return useSyncExternalStore(
    langganJaringan,
    () => navigator.onLine,
    () => true,
  )
}

export function StatusJaringan() {
  const daring = useDaring()
  if (daring) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[#4f474b] px-4 py-2 text-center text-sm text-white"
    >
      <WifiOff aria-hidden className="size-4" />
      Anda sedang offline. Katalog yang pernah dibuka tetap bisa dilihat; memesan dan membayar butuh koneksi.
    </div>
  )
}
