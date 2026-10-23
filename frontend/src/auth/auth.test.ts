import { afterEach, describe, expect, it } from 'vitest'

import { tujuanAman } from './Penjaga'
import { ambilToken, bacaKedaluwarsa, hapusSesi, simpanSesi, tokoSesi, type Pengguna } from './sesi'

const pengguna: Pengguna = {
  id_pengguna: 1,
  nama: 'Rani',
  email: 'rani@contoh.id',
  no_hp: null,
  peran: 'pelanggan',
  aktif: true,
  dibuat_pada: '2026-10-01T00:00:00Z',
}

const base64url = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const token = (exp: number) => `${base64url({ alg: 'HS256' })}.${base64url({ sub: '1', exp })}.tandatangan`

describe('tujuanAman (cegah open redirect setelah masuk)', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['%2Fakun%2Fpesanan%3Fstatus%3Dselesai', '/akun/pesanan?status=selesai'],
    ['https://jahat.example/curi', '/'],
    ['//jahat.example', '/'],
    ['/\\jahat.example', '/'],
    ['javascript:alert(1)', '/'],
    [null, '/'],
    ['%E0%A4%A', '/'],
  ])('%s → %s', (masuk, hasil) => {
    expect(tujuanAman(masuk, '/')).toBe(hasil)
  })
})

describe('sesi', () => {
  afterEach(() => hapusSesi())

  it('membaca klaim exp tanpa memverifikasi tanda tangan', () => {
    expect(bacaKedaluwarsa(token(2_000_000_000))).toBe(2_000_000_000_000)
    expect(bacaKedaluwarsa('bukan-token')).toBeNull()
  })

  it('"ingat saya" memilih localStorage, selain itu sessionStorage', () => {
    simpanSesi(token(4_000_000_000), pengguna, true)
    expect(localStorage.getItem('fb.sesi')).not.toBeNull()
    expect(sessionStorage.getItem('fb.sesi')).toBeNull()
    simpanSesi(token(4_000_000_000), pengguna, false)
    expect(localStorage.getItem('fb.sesi')).toBeNull()
    expect(sessionStorage.getItem('fb.sesi')).not.toBeNull()
  })

  it('token kedaluwarsa dibuang saat diambil', () => {
    simpanSesi(token(Math.floor(Date.now() / 1000) - 10), pengguna, true)
    expect(ambilToken()).toBeNull()
    expect(tokoSesi.ambil()).toBeNull()
  })
})
