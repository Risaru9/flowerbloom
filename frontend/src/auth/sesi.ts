import type { components } from '@/api/schema'
import { bacaJson, hapus, tulisJson } from '@/lib/penyimpanan'
import { buatToko, useToko } from '@/lib/toko-kecil'

export type Pengguna = components['schemas']['PenggunaOut']
export interface Sesi {
  token: string
  pengguna: Pengguna
  /** Waktu kedaluwarsa token (ms epoch) dari klaim `exp` JWT. */
  kedaluwarsa: number | null
}

const KUNCI = 'fb.sesi'

/** Membaca klaim `exp` tanpa memverifikasi tanda tangan (verifikasi tetap di server). */
export function bacaKedaluwarsa(token: string): number | null {
  try {
    const muatan = token.split('.')[1]
    if (!muatan) return null
    const json = JSON.parse(atob(muatan.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

function masihBerlaku(s: Sesi | null): s is Sesi {
  return !!s && (s.kedaluwarsa === null || s.kedaluwarsa > Date.now())
}

function muatAwal(): Sesi | null {
  // "Ingat saya" menyimpan di localStorage; selain itu sessionStorage (hilang saat tab ditutup).
  const s = bacaJson<Sesi>(KUNCI, 'session') ?? bacaJson<Sesi>(KUNCI, 'local')
  return masihBerlaku(s) ? s : null
}

export const tokoSesi = buatToko<Sesi | null>(muatAwal())

export function simpanSesi(token: string, pengguna: Pengguna, ingat: boolean): void {
  const sesi: Sesi = { token, pengguna, kedaluwarsa: bacaKedaluwarsa(token) }
  hapus(KUNCI, 'local')
  hapus(KUNCI, 'session')
  tulisJson(KUNCI, sesi, ingat ? 'local' : 'session')
  tokoSesi.atur(sesi)
}

export function perbaruiPengguna(pengguna: Pengguna): void {
  const s = tokoSesi.ambil()
  if (!s) return
  const baru = { ...s, pengguna }
  const diIngat = bacaJson<Sesi>(KUNCI, 'local') !== null
  tulisJson(KUNCI, baru, diIngat ? 'local' : 'session')
  tokoSesi.atur(baru)
}

/** Mengganti token (mis. setelah ganti kata sandi) tanpa mengubah pilihan "ingat saya". */
export function gantiToken(token: string, pengguna: Pengguna): void {
  simpanSesi(token, pengguna, bacaJson<Sesi>(KUNCI, 'local') !== null)
}

export function hapusSesi(): void {
  hapus(KUNCI, 'local')
  hapus(KUNCI, 'session')
  tokoSesi.atur(null)
}

export function ambilToken(): string | null {
  const s = tokoSesi.ambil()
  if (s && !masihBerlaku(s)) {
    hapusSesi()
    return null
  }
  return s?.token ?? null
}

export function useSesi(): Sesi | null {
  return useToko(tokoSesi)
}
