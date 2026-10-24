const ZONA = 'Asia/Jakarta'

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

/** 125000 → "Rp125.000" (tanpa spasi, mengikuti desain). */
export function formatRupiah(nilai: number): string {
  return rupiah.format(nilai).replace(/\s/g, '')
}

const tanggalPanjang = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: ZONA })
const tanggalHari = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA,
})
const tanggalJam = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: ZONA,
})
const jamSaja = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: ZONA })

/** Tanggal "YYYY-MM-DD" dari API diperlakukan sebagai tanggal kalender, bukan waktu UTC. */
function keDate(nilai: string | Date): Date {
  if (nilai instanceof Date) return nilai
  return /^\d{4}-\d{2}-\d{2}$/.test(nilai) ? new Date(`${nilai}T12:00:00+07:00`) : new Date(nilai)
}

export const formatTanggal = (nilai: string | Date) => tanggalPanjang.format(keDate(nilai))
export const formatTanggalHari = (nilai: string | Date) => tanggalHari.format(keDate(nilai))
export const formatTanggalJam = (nilai: string | Date) => tanggalJam.format(keDate(nilai))
export const formatJam = (nilai: string | Date) => jamSaja.format(keDate(nilai))

/** Tanggal hari ini (WIB) ditambah n hari, dalam format "YYYY-MM-DD" untuk input bertipe date. */
export function tanggalWibPlus(hari: number, dari: Date = new Date()): string {
  const bagian = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(dari)
  const d = new Date(`${bagian}T12:00:00+07:00`)
  d.setUTCDate(d.getUTCDate() + hari)
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d)
}

/** Sisa waktu "1 jam 05 menit" untuk batas bayar; null bila sudah lewat. */
export function sisaWaktu(batas: string, sekarang: number = Date.now()): string | null {
  const ms = new Date(batas).getTime() - sekarang
  if (ms <= 0) return null
  const menit = Math.floor(ms / 60000)
  const jam = Math.floor(menit / 60)
  const detik = Math.floor((ms % 60000) / 1000)
  if (jam > 0) return `${jam} jam ${String(menit % 60).padStart(2, '0')} menit`
  return `${menit} menit ${String(detik).padStart(2, '0')} detik`
}

/** Tautan wa.me dari nomor lokal (08xx → 628xx), opsional dengan pesan awal; null bila nomornya tidak layak. */
export function tautanWa(noHp: string | null | undefined, pesan?: string): string | null {
  if (!noHp) return null
  const angka = noHp.replace(/\D/g, '').replace(/^0/, '62')
  if (angka.length < 9) return null
  return `https://wa.me/${angka}${pesan ? `?text=${encodeURIComponent(pesan)}` : ''}`
}
