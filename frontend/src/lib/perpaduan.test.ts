import { describe, expect, it } from 'vitest'

import { lch, nilaiPerpaduan, teksPerpaduan } from './perpaduan'

// Kode hex sama dengan data warna bawaan backend (app/data/warna.py).
const w = (nama_warna: string, kode_hex: string) => ({ nama_warna, kode_hex })
const PUTIH = w('Putih', '#FFFFFF')
const KREM = w('Krem', '#FFFDD0')
const MERAH = w('Merah', '#FF0000')
const MERAH_MUDA = w('Merah muda', '#FFC0CB')
const UNGU_MUDA = w('Ungu muda', '#B57EDC')
const BIRU = w('Biru', '#1E90FF')
const BIRU_MUDA = w('Biru muda', '#87CEEB')
const KUNING = w('Kuning', '#FFD700')

describe('lch', () => {
  it('menghitung terang, kroma, dan rona CIELAB', () => {
    expect(lch('#FFFFFF').L).toBeCloseTo(100, 0)
    expect(lch('#FFFFFF').C).toBeLessThan(1)
    const merah = lch('#FF0000')
    expect(merah.L).toBeCloseTo(53.2, 0)
    expect(merah.C).toBeCloseTo(104.6, 0)
    expect(merah.h).toBeCloseTo(40, 0)
  })
})

describe('nilaiPerpaduan', () => {
  it('kosong menghasilkan null; warna netral dan satu warna dianggap serasi', () => {
    expect(nilaiPerpaduan([])).toBeNull()
    expect(nilaiPerpaduan([PUTIH, KREM])?.jenis).toBe('netral')
    expect(nilaiPerpaduan([MERAH, PUTIH, MERAH])).toEqual({ jenis: 'satu_warna', netral: [PUTIH] })
  })

  it('membedakan analog, pastel, dan kontras', () => {
    expect(nilaiPerpaduan([MERAH_MUDA, UNGU_MUDA])?.jenis).toBe('analog')
    expect(nilaiPerpaduan([MERAH, KUNING])?.jenis).toBe('analog')
    expect(nilaiPerpaduan([MERAH_MUDA, BIRU_MUDA])?.jenis).toBe('pastel')
    expect(nilaiPerpaduan([MERAH, KUNING, BIRU])).toEqual({ jenis: 'kontras', pasangan: [KUNING, BIRU], netral: [] })
  })
})

describe('teksPerpaduan', () => {
  it('menyarankan warna netral yang tersedia bila kontras tanpa penyeimbang', () => {
    const hasil = teksPerpaduan([MERAH, BIRU], [MERAH, BIRU, PUTIH, KREM])
    expect(hasil).toEqual({
      teks: 'Merah dan Biru sangat kontras. Tambahkan warna netral seperti Putih atau Krem sebagai penyeimbang agar lebih menyatu.',
      saran: true,
    })
    expect(teksPerpaduan([MERAH, BIRU], [MERAH, BIRU])?.teks).toContain('ronanya lebih berdekatan')
  })

  it('tidak menyarankan apa pun bila sudah ada warna netral atau untuk paket jadi', () => {
    expect(teksPerpaduan([MERAH, BIRU, PUTIH], [PUTIH])).toEqual({
      teks: 'Merah dan Biru kontras, dan sudah ada Putih sebagai warna netral penyeimbang.',
      saran: false,
    })
    expect(teksPerpaduan([MERAH, BIRU])?.saran).toBe(false)
  })
})
