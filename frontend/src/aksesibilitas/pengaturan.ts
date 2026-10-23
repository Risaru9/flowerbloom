import type { Skema } from '@/api/client'
import { bacaJson, tulisJson } from '@/lib/penyimpanan'
import { buatToko, useToko } from '@/lib/toko-kecil'

/**
 * Pengaturan aksesibilitas (F-PL-18). Bidang dari backend disinkronkan ke akun saat masuk; `kontras_tinggi` dan
 * `suara_aktif` hanya disimpan di perangkat karena belum ada kolomnya di server.
 */
export type PengaturanAksesibilitas = Skema['AksesibilitasOut'] & {
  kontras_tinggi: boolean
  suara_aktif: boolean
}

export const BAWAAN: PengaturanAksesibilitas = {
  jenis_buta_warna: 'normal',
  penajaman_warna: false,
  ukuran_teks: 100,
  kecepatan_suara: 1,
  tema: 'terang',
  kontras_tinggi: false,
  suara_aktif: true,
}

export const LANGKAH_TEKS = [90, 100, 115, 130, 150] as const

const KUNCI = 'fb.aksesibilitas.v1'

function muat(): PengaturanAksesibilitas {
  const tersimpan = bacaJson<Partial<PengaturanAksesibilitas>>(KUNCI)
  return { ...BAWAAN, ...tersimpan }
}

/** Menerapkan pengaturan ke <html>: tema, kontras, skala teks, dan filter penajaman warna pada foto bunga. */
export function terapkan(p: PengaturanAksesibilitas, akar: HTMLElement = document.documentElement): void {
  akar.dataset.tema = p.tema
  if (p.kontras_tinggi) akar.dataset.kontras = 'tinggi'
  else delete akar.dataset.kontras
  akar.style.setProperty('--skala-teks', String(Math.min(Math.max(p.ukuran_teks, 80), 200) / 100))
  if (p.penajaman_warna && p.jenis_buta_warna !== 'normal') akar.dataset.penajaman = p.jenis_buta_warna
  else delete akar.dataset.penajaman
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.tema === 'gelap' ? '#1d1719' : '#b44b59')
}

export const tokoAksesibilitas = buatToko<PengaturanAksesibilitas>(muat(), (p) => {
  tulisJson(KUNCI, p)
  terapkan(p)
})

export function aturAksesibilitas(sebagian: Partial<PengaturanAksesibilitas>): PengaturanAksesibilitas {
  tokoAksesibilitas.atur((p) => ({ ...p, ...sebagian }))
  return tokoAksesibilitas.ambil()
}

export const useAksesibilitas = () => useToko(tokoAksesibilitas)

/** Hanya bidang yang dikenal server. */
export function keServer(p: PengaturanAksesibilitas): Skema['AksesibilitasUbahIn'] {
  const { jenis_buta_warna, penajaman_warna, ukuran_teks, kecepatan_suara, tema } = p
  return { jenis_buta_warna, penajaman_warna, ukuran_teks, kecepatan_suara, tema }
}

export const PILIHAN_MODE: {
  nilai: PengaturanAksesibilitas['jenis_buta_warna']
  label: string
  keterangan: string
  contoh: string[]
}[] = [
  { nilai: 'normal', label: 'Normal', keterangan: 'Warna asli tanpa penyesuaian', contoh: ['#f2b8c6', '#c97d87', '#6b7455'] },
  { nilai: 'protan', label: 'Protan', keterangan: 'Sulit membedakan merah', contoh: ['#e2c35a', '#5f6fa3', '#6b7455'] },
  { nilai: 'deutan', label: 'Deutan', keterangan: 'Sulit membedakan hijau', contoh: ['#f2b8c6', '#c9a77d', '#6680b0'] },
  { nilai: 'tritan', label: 'Tritan', keterangan: 'Sulit membedakan biru–kuning', contoh: ['#ef7f86', '#5fb3b0', '#9b7fa8'] },
]
