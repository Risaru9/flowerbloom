import { buatToko, useToko } from '@/lib/toko-kecil'

/** Event `beforeinstallprompt` (Chrome/Edge/Android) belum ada di lib DOM TypeScript. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface KeadaanPasang {
  /** Peramban menyediakan dialog pemasangan bawaan. */
  bisaDipasang: boolean
  /** Sudah berjalan sebagai aplikasi terpasang (standalone). */
  terpasang: boolean
  /** iPhone/iPad Safari: pemasangan lewat menu Bagikan → Tambahkan ke Layar Utama. */
  perluPanduanIos: boolean
}

let tertunda: BeforeInstallPromptEvent | null = null

const modeMandiri = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)

const iosSafari = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent)

export const tokoPasang = buatToko<KeadaanPasang>({
  bisaDipasang: false,
  terpasang: modeMandiri(),
  perluPanduanIos: iosSafari() && !modeMandiri(),
})

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    tertunda = e as BeforeInstallPromptEvent
    tokoPasang.atur((k) => ({ ...k, bisaDipasang: true }))
  })
  window.addEventListener('appinstalled', () => {
    tertunda = null
    tokoPasang.atur({ bisaDipasang: false, terpasang: true, perluPanduanIos: false })
  })
}

export async function mintaPasang(): Promise<boolean> {
  if (!tertunda) return false
  await tertunda.prompt()
  const { outcome } = await tertunda.userChoice
  tertunda = null
  tokoPasang.atur((k) => ({ ...k, bisaDipasang: false }))
  return outcome === 'accepted'
}

export const usePasang = () => useToko(tokoPasang)
