import { useEffect, useRef } from 'react'

import { useAksesibilitasSaya } from '@/api/pelanggan'
import { useSesi } from '@/auth/sesi'

import { aturAksesibilitas, terapkan, tokoAksesibilitas } from './pengaturan'

/** Menerapkan pengaturan saat aplikasi dibuka dan menarik pengaturan akun setelah pelanggan masuk. */
export function SinkronAksesibilitas() {
  const sesi = useSesi()
  const pelanggan = sesi?.pengguna.peran === 'pelanggan'
  const { data } = useAksesibilitasSaya(pelanggan)
  const sudah = useRef<number | null>(null)

  useEffect(() => {
    terapkan(tokoAksesibilitas.ambil())
  }, [])

  useEffect(() => {
    if (!sesi) {
      sudah.current = null
      return
    }
    if (!data) return
    if (sudah.current === sesi.pengguna.id_pengguna) return
    sudah.current = sesi.pengguna.id_pengguna
    aturAksesibilitas(data)
  }, [data, sesi])

  return null
}
