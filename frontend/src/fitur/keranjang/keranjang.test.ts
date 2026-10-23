import { beforeEach, describe, expect, it } from 'vitest'

import type { Skema } from '@/api/client'

import { hapusItem, hargaItem, jumlahBarang, keItemApi, kosongkanKeranjang, tambahPaket, tambahRangkaian, tokoKeranjang, ubahJumlah } from './keranjang'

const merah = { id_warna: 1, nama_warna: 'Merah', kode_hex: '#FF0000' }
const putih = { id_warna: 2, nama_warna: 'Putih', kode_hex: '#FFFFFF' }

const produk = {
  id_produk: 7,
  nama_produk: 'Buket Cinta',
  harga: 150000,
  foto_url: null,
  komposisi: [
    { warna: merah, jenis: { id_jenis_bunga: 1, nama_bunga: 'Mawar', bentuk_bunga: null } },
    { warna: putih, jenis: { id_jenis_bunga: 2, nama_bunga: 'Anyelir', bentuk_bunga: null } },
    { warna: merah, jenis: { id_jenis_bunga: 2, nama_bunga: 'Anyelir', bentuk_bunga: null } },
  ],
} as unknown as Skema['ProdukOut']

describe('keranjang', () => {
  beforeEach(() => kosongkanKeranjang())

  it('menggabungkan paket yang sama dan membatasi jumlah', () => {
    tambahPaket(produk, 2)
    tambahPaket(produk, 25)
    const isi = tokoKeranjang.ambil()
    expect(isi).toHaveLength(1)
    expect(isi[0]).toMatchObject({ jenis_item: 'paket', jumlah: 20, ringkasan_warna: 'Merah • Putih' })
  })

  it('mengubah jumlah tidak pernah di bawah 1', () => {
    tambahPaket(produk)
    const kunci = tokoKeranjang.ambil()[0]!.kunci
    ubahJumlah(kunci, 0)
    expect(tokoKeranjang.ambil()[0]).toMatchObject({ jumlah: 1 })
  })

  it('menghitung harga dan jumlah barang', () => {
    tambahPaket(produk, 2)
    tambahRangkaian([
      { id_stok: 3, jumlah_tangkai: 5, nama: 'Mawar', warna: merah, harga_per_tangkai: 8000 },
      { id_stok: 4, jumlah_tangkai: 2, nama: 'Anyelir', warna: putih, harga_per_tangkai: 4000 },
    ])
    const [paket, rangkai] = tokoKeranjang.ambil()
    expect(hargaItem(paket!)).toBe(300000)
    expect(hargaItem(rangkai!)).toBe(48000)
    expect(jumlahBarang(tokoKeranjang.ambil())).toBe(3)
  })

  it('mengirim hanya data yang dibutuhkan server', () => {
    tambahPaket(produk, 2)
    tambahRangkaian([{ id_stok: 3, jumlah_tangkai: 5, nama: 'Mawar', warna: merah, harga_per_tangkai: 8000 }])
    expect(tokoKeranjang.ambil().map(keItemApi)).toEqual([
      { jenis_item: 'paket', id_produk: 7, jumlah: 2 },
      { jenis_item: 'rangkai_sendiri', bunga: [{ id_stok: 3, jumlah_tangkai: 5 }] },
    ])
  })

  it('tersimpan di localStorage dan bisa dihapus', () => {
    tambahPaket(produk)
    expect(JSON.parse(localStorage.getItem('fb.keranjang.v1') ?? '[]')).toHaveLength(1)
    hapusItem(tokoKeranjang.ambil()[0]!.kunci)
    expect(tokoKeranjang.ambil()).toEqual([])
  })
})
