import { useCallback, useEffect, useState } from 'react'

import { tokoAksesibilitas } from './pengaturan'

/** Text-to-Speech peramban (F-PL-08, F-AK-03). Tidak mengirim teks ke layanan pihak ketiga. */
export const suaraTersedia = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function pilihSuara(): SpeechSynthesisVoice | undefined {
  const semua = window.speechSynthesis.getVoices()
  return semua.find((v) => v.lang === 'id-ID') ?? semua.find((v) => v.lang.toLowerCase().startsWith('id'))
}

export function bacakan(teks: string, saatSelesai?: () => void): void {
  if (!suaraTersedia() || !teks.trim()) return
  const ss = window.speechSynthesis
  ss.cancel()
  const u = new SpeechSynthesisUtterance(teks)
  u.lang = 'id-ID'
  u.rate = tokoAksesibilitas.ambil().kecepatan_suara
  const v = pilihSuara()
  if (v) u.voice = v
  u.addEventListener('end', () => saatSelesai?.())
  u.addEventListener('error', () => saatSelesai?.())
  ss.speak(u)
}

export function hentikanSuara(): void {
  if (suaraTersedia()) window.speechSynthesis.cancel()
}

export function useBacakan() {
  const [berbicara, setBerbicara] = useState(false)
  useEffect(() => () => hentikanSuara(), [])
  const mulai = useCallback((teks: string) => {
    setBerbicara(true)
    bacakan(teks, () => setBerbicara(false))
  }, [])
  const berhenti = useCallback(() => {
    hentikanSuara()
    setBerbicara(false)
  }, [])
  return { berbicara, mulai, berhenti, tersedia: suaraTersedia() }
}
