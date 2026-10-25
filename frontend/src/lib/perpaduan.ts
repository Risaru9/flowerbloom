/**
 * Saran perpaduan warna (F-PL-06) dengan aturan sederhana di ruang warna CIELAB (L* terang, C* kroma, h rona):
 * - warna netral (kroma rendah: putih, krem, abu-abu, hitam) menjadi penyeimbang;
 * - warna pastel (terang dan kroma sedang) mudah berpadu satu sama lain;
 * - rona yang berdekatan (analog, rentang ≤ 75°) terlihat menyatu, rona yang berjauhan terlihat kontras.
 * Ini aturan bantu untuk pelanggan, bukan penilaian estetika mutlak.
 */
export interface WarnaHex {
  nama_warna: string
  kode_hex: string
}

export type Perpaduan =
  | { jenis: 'netral' | 'satu_warna' | 'analog' | 'pastel'; netral: WarnaHex[] }
  | { jenis: 'kontras'; pasangan: [WarnaHex, WarnaHex]; netral: WarnaHex[] }

const KROMA_NETRAL = 23
const RENTANG_ANALOG = 75

const keLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)

/** Kode hex #RRGGBB ke L*C*h (sRGB, titik putih D65). */
export function lch(hex: string): { L: number; C: number; h: number } {
  const n = parseInt(hex.slice(1, 7), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => keLinear(c / 255)) as [number, number, number]
  const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  const a = 500 * (fx - fy)
  const bb = 200 * (fy - fz)
  return { L: 116 * fy - 16, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 }
}

export const adalahNetral = (w: WarnaHex) => lch(w.kode_hex).C < KROMA_NETRAL

const jarakRona = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

export function nilaiPerpaduan(daftar: WarnaHex[]): Perpaduan | null {
  const unik = daftar.filter((w, i) => daftar.findIndex((x) => x.kode_hex.toUpperCase() === w.kode_hex.toUpperCase()) === i)
  if (!unik.length) return null
  const netral = unik.filter(adalahNetral)
  const berwarna = unik.filter((w) => !adalahNetral(w)).map((w) => ({ w, ...lch(w.kode_hex) }))
  if (!berwarna.length) return { jenis: 'netral', netral }
  if (berwarna.length === 1) return { jenis: 'satu_warna', netral }

  // Rentang rona = 360° dikurangi celah terbesar di lingkaran rona.
  const rona = berwarna.map((x) => x.h).sort((a, b) => a - b)
  const celah = Math.max(360 - rona.at(-1)! + rona[0]!, ...rona.slice(1).map((h, i) => h - rona[i]!))
  if (360 - celah <= RENTANG_ANALOG) return { jenis: 'analog', netral }
  if (berwarna.every((x) => x.L >= 75 && x.C < 50)) return { jenis: 'pastel', netral }

  let pasangan: [WarnaHex, WarnaHex] = [berwarna[0]!.w, berwarna[1]!.w]
  let terjauh = -1
  for (const [i, a] of berwarna.entries())
    for (const b of berwarna.slice(i + 1)) {
      const d = jarakRona(a.h, b.h)
      if (d > terjauh) [terjauh, pasangan] = [d, [a.w, b.w]]
    }
  return { jenis: 'kontras', pasangan, netral }
}

function gabung(nama: string[], kata = 'dan') {
  return nama.length < 2 ? (nama[0] ?? '') : `${nama.slice(0, -1).join(', ')} ${kata} ${nama.at(-1)}`
}

/**
 * Kalimat saran untuk ditampilkan dan dibacakan. ``tersedia`` diisi pada Rangkai Sendiri (pelanggan masih bisa
 * menambah bunga, jadi warna netral yang ada di stok disarankan); kosong pada paket jadi yang hanya dijelaskan.
 */
export function teksPerpaduan(daftar: WarnaHex[], tersedia?: WarnaHex[]): { teks: string; saran: boolean } | null {
  const p = nilaiPerpaduan(daftar)
  if (!p) return null
  const namaNetral = gabung(p.netral.map((w) => w.nama_warna))
  switch (p.jenis) {
    case 'netral':
      return { teks: 'Warna netral memberi kesan bersih dan elegan.', saran: false }
    case 'satu_warna':
      return {
        teks: namaNetral
          ? `Dipadukan dengan ${namaNetral}, warnanya tampak bersih dan serasi.`
          : 'Satu warna memberi kesan rapi dan tegas.',
        saran: false,
      }
    case 'analog':
      return { teks: 'Ronanya berdekatan (warna analog), jadi rangkaian terlihat menyatu.', saran: false }
    case 'pastel':
      return { teks: 'Semua warnanya lembut (pastel), jadi mudah berpadu.', saran: false }
  }
  const [a, b] = p.pasangan.map((w) => w.nama_warna)
  if (namaNetral) return { teks: `${a} dan ${b} kontras, dan sudah ada ${namaNetral} sebagai warna netral penyeimbang.`, saran: false }
  if (!tersedia) return { teks: `Paduan kontras ${a} dan ${b} membuat rangkaian tampak mencolok.`, saran: false }
  const usulan = [...new Set(tersedia.filter(adalahNetral).map((w) => w.nama_warna))]
  return {
    teks: usulan.length
      ? `${a} dan ${b} sangat kontras. Tambahkan warna netral seperti ${gabung(usulan, 'atau')} sebagai penyeimbang agar lebih menyatu.`
      : `${a} dan ${b} sangat kontras. Pilih warna yang ronanya lebih berdekatan agar lebih menyatu.`,
    saran: true,
  }
}
