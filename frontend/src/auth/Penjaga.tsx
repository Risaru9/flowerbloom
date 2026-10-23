import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import type { Skema } from '@/api/client'

import { useSesi } from './sesi'

/**
 * Penjaga rute di sisi klien. Ini hanya kenyamanan tampilan: otorisasi yang sebenarnya ditegakkan backend
 * (setiap rute /admin/* menolak token non-admin).
 */
export function WajibMasuk({ peran, children }: { peran: Skema['Peran']; children: ReactNode }) {
  const sesi = useSesi()
  const lokasi = useLocation()
  const kembali = encodeURIComponent(lokasi.pathname + lokasi.search)
  if (!sesi) return <Navigate to={peran === 'admin' ? `/admin/masuk?kembali=${kembali}` : `/masuk?kembali=${kembali}`} replace />
  if (sesi.pengguna.peran !== peran) return <Navigate to={sesi.pengguna.peran === 'admin' ? '/admin' : '/'} replace />
  return <>{children}</>
}

/** Mengambil tujuan setelah masuk; hanya jalur internal yang diterima (cegah open redirect). */
export function tujuanAman(mentah: string | null, cadangan: string): string {
  if (!mentah) return cadangan
  try {
    const jalur = decodeURIComponent(mentah)
    return jalur.startsWith('/') && !jalur.startsWith('//') && !jalur.includes('\\') ? jalur : cadangan
  } catch {
    return cadangan
  }
}
