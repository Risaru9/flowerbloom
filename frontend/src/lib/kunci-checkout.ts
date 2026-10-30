import { bacaJson, hapus, tulisJson } from './penyimpanan'

interface Catatan {
  sidik: string
  kunci: string
}
const memori = new Map<number, Catatan>()

/** Simpan hanya hash payload dan kunci, bukan alamat/nama penerima; bertahan saat reload tab. */
export async function kunciCheckout(id: number, payload: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
  const sidik = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
  const nama = `fb.checkout.${id}`
  const lama = memori.get(id) ?? bacaJson<Catatan>(nama, 'session')
  const catatan = lama?.sidik === sidik ? lama : { sidik, kunci: crypto.randomUUID() }
  memori.set(id, catatan)
  tulisJson(nama, catatan, 'session')
  return catatan.kunci
}

export function selesaiCheckout(id: number): void {
  memori.delete(id)
  hapus(`fb.checkout.${id}`, 'session')
}
