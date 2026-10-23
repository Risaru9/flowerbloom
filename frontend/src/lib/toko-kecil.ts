import { useSyncExternalStore } from 'react'

/** Penyimpan keadaan global minimal (tanpa pustaka tambahan) yang bisa dipakai lewat useSyncExternalStore. */
export interface TokoKecil<T> {
  ambil: () => T
  atur: (berikut: T | ((sebelum: T) => T)) => void
  langgan: (pendengar: () => void) => () => void
}

export function buatToko<T>(awal: T, saatBerubah?: (nilai: T) => void): TokoKecil<T> {
  let nilai = awal
  const pendengar = new Set<() => void>()
  return {
    ambil: () => nilai,
    atur(berikut) {
      const baru = typeof berikut === 'function' ? (berikut as (s: T) => T)(nilai) : berikut
      if (Object.is(baru, nilai)) return
      nilai = baru
      saatBerubah?.(nilai)
      pendengar.forEach((p) => p())
    },
    langgan(p) {
      pendengar.add(p)
      return () => pendengar.delete(p)
    },
  }
}

export function useToko<T>(toko: TokoKecil<T>): T {
  return useSyncExternalStore(toko.langgan, toko.ambil, toko.ambil)
}
