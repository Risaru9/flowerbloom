/**
 * Akses localStorage/sessionStorage yang aman: penyimpanan bisa dimatikan peramban (mode privat, kebijakan
 * perusahaan) dan isinya bisa rusak, sehingga setiap baca/tulis dibungkus try/catch.
 */
type Jenis = 'local' | 'session'

function wadah(jenis: Jenis): Storage | null {
  try {
    return jenis === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function bacaJson<T>(kunci: string, jenis: Jenis = 'local'): T | null {
  try {
    const mentah = wadah(jenis)?.getItem(kunci)
    return mentah ? (JSON.parse(mentah) as T) : null
  } catch {
    return null
  }
}

export function tulisJson(kunci: string, nilai: unknown, jenis: Jenis = 'local'): void {
  try {
    wadah(jenis)?.setItem(kunci, JSON.stringify(nilai))
  } catch {
    /* penyimpanan penuh atau dimatikan: abaikan, data tetap ada di memori */
  }
}

export function hapus(kunci: string, jenis: Jenis = 'local'): void {
  try {
    wadah(jenis)?.removeItem(kunci)
  } catch {
    /* abaikan */
  }
}
