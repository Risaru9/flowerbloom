import { describe, expect, it } from 'vitest'

import { formatRupiah, sisaWaktu, tanggalWibPlus, tautanWa } from './format'

describe('formatRupiah', () => {
  it('menulis rupiah tanpa spasi dan tanpa desimal', () => {
    expect(formatRupiah(125000)).toBe('Rp125.000')
    expect(formatRupiah(0)).toBe('Rp0')
    expect(formatRupiah(4850000)).toBe('Rp4.850.000')
  })
})

describe('tanggalWibPlus', () => {
  it('memakai kalender WIB, bukan UTC', () => {
    // 2026-10-23 18:30 UTC = 2026-10-24 01:30 WIB
    const malam = new Date('2026-10-23T18:30:00Z')
    expect(tanggalWibPlus(0, malam)).toBe('2026-10-24')
    expect(tanggalWibPlus(1, malam)).toBe('2026-10-25')
    expect(tanggalWibPlus(-1, malam)).toBe('2026-10-23')
  })

  it('melewati pergantian bulan dan tahun', () => {
    expect(tanggalWibPlus(1, new Date('2026-12-31T05:00:00Z'))).toBe('2027-01-01')
  })
})

describe('sisaWaktu', () => {
  const sekarang = Date.parse('2026-10-23T10:00:00Z')
  it('menampilkan jam dan menit bila lebih dari satu jam', () => {
    expect(sisaWaktu('2026-10-23T11:05:30Z', sekarang)).toBe('1 jam 05 menit')
  })
  it('menampilkan menit dan detik bila kurang dari satu jam', () => {
    expect(sisaWaktu('2026-10-23T10:04:09Z', sekarang)).toBe('4 menit 09 detik')
  })
  it('mengembalikan null bila batas sudah lewat', () => {
    expect(sisaWaktu('2026-10-23T09:59:59Z', sekarang)).toBeNull()
  })
})

describe('tautanWa', () => {
  it('mengubah nomor lokal menjadi format internasional dan menyandikan pesan', () => {
    expect(tautanWa('0812-3456 7890')).toBe('https://wa.me/6281234567890')
    expect(tautanWa('+62 812 3456 7890', 'Halo, pesanan FB-1')).toBe('https://wa.me/6281234567890?text=Halo%2C%20pesanan%20FB-1')
  })
  it('mengembalikan null untuk nomor kosong atau terlalu pendek', () => {
    expect(tautanWa('')).toBeNull()
    expect(tautanWa(null)).toBeNull()
    expect(tautanWa('0812')).toBeNull()
  })
})
