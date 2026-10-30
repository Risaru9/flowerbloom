/// <reference types="node" />
import { webcrypto } from 'node:crypto'
import { kunciCheckout, selesaiCheckout } from './kunci-checkout'

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  selesaiCheckout(7)
  sessionStorage.clear()
})

afterEach(() => vi.unstubAllGlobals())

it('memakai kembali kunci setelah respons gagal, memisahkan payload, dan mengakhiri retry setelah sukses', async () => {
  const payload = { nama_penerima: 'Penerima privat', jumlah: 1 }
  const pertama = await kunciCheckout(7, payload)
  expect(await kunciCheckout(7, payload)).toBe(pertama)
  expect(sessionStorage.getItem('fb.checkout.7')).not.toContain('Penerima privat')

  const berubah = await kunciCheckout(7, { ...payload, jumlah: 2 })
  expect(berubah).not.toBe(pertama)
  selesaiCheckout(7)
  expect(await kunciCheckout(7, { ...payload, jumlah: 2 })).not.toBe(berubah)
})

it('retry setelah reload tab menggunakan kunci tersimpan milik pelanggan yang sama', async () => {
  const pertama = await kunciCheckout(7, { jumlah: 1 })
  vi.resetModules()
  const modulBaru = await import('./kunci-checkout')
  expect(await modulBaru.kunciCheckout(7, { jumlah: 1 })).toBe(pertama)
  expect(await modulBaru.kunciCheckout(8, { jumlah: 1 })).not.toBe(pertama)
  modulBaru.selesaiCheckout(7)
  modulBaru.selesaiCheckout(8)
})
