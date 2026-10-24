import type { Skema } from '@/api/client'
import { teksWarna } from '@/komponen/ui/Warna'
import { bacaJson, tulisJson } from '@/lib/penyimpanan'
import { buatToko, useToko } from '@/lib/toko-kecil'

/**
 * Keranjang disimpan di klien (keputusan desain backend: tidak ada tabel keranjang). Harga di sini hanya untuk
 * tampilan; harga dan stok yang berlaku selalu dihitung ulang server lewat POST /pesanan/pratinjau.
 */
export interface ItemPaket {
  jenis_item: 'paket'
  kunci: string
  id_produk: number
  jumlah: number
  nama: string
  harga: number
  foto_url: string | null
  ringkasan_warna: string
}

export interface BungaTerpilih {
  id_stok: number
  jumlah_tangkai: number
  nama: string
  warna: Skema['WarnaRingkas']
  harga_per_tangkai: number
}

export interface ItemRangkai {
  jenis_item: 'rangkai_sendiri'
  kunci: string
  bunga: BungaTerpilih[]
}

export type ItemKeranjang = ItemPaket | ItemRangkai

const KUNCI = 'fb.keranjang.v1'

function muat(): ItemKeranjang[] {
  const isi = bacaJson<unknown>(KUNCI)
  return Array.isArray(isi) ? (isi as ItemKeranjang[]) : []
}

export const tokoKeranjang = buatToko<ItemKeranjang[]>(muat(), (isi) => tulisJson(KUNCI, isi))

// Sinkron antartab: keranjang yang diubah di tab lain ikut diperbarui.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KUNCI) tokoKeranjang.atur(muat())
  })
}

const idAcak = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()))

export function tambahPaket(produk: Skema['ProdukOut'], jumlah = 1): void {
  tokoKeranjang.atur((isi) => {
    const ada = isi.find((i): i is ItemPaket => i.jenis_item === 'paket' && i.id_produk === produk.id_produk)
    if (ada) return isi.map((i) => (i === ada ? { ...ada, jumlah: Math.min(ada.jumlah + jumlah, 20) } : i))
    return [
      ...isi,
      {
        jenis_item: 'paket',
        kunci: idAcak(),
        id_produk: produk.id_produk,
        jumlah,
        nama: produk.nama_produk,
        harga: produk.harga,
        foto_url: produk.foto_url,
        ringkasan_warna: teksWarna(produk.komposisi.map((k) => k.warna)),
      },
    ]
  })
}

export function tambahRangkaian(bunga: BungaTerpilih[]): void {
  tokoKeranjang.atur((isi) => [...isi, { jenis_item: 'rangkai_sendiri', kunci: idAcak(), bunga }])
}

export function ubahJumlah(kunci: string, jumlah: number): void {
  tokoKeranjang.atur((isi) =>
    isi.map((i) => (i.kunci === kunci && i.jenis_item === 'paket' ? { ...i, jumlah: Math.max(1, Math.min(jumlah, 20)) } : i)),
  )
}

/** Menghapus item; fungsi yang dikembalikan mengurungkannya (item kembali ke posisi semula). */
export function hapusItem(kunci: string): () => void {
  const isi = tokoKeranjang.ambil()
  const posisi = isi.findIndex((i) => i.kunci === kunci)
  const item = isi[posisi]
  if (!item) return () => {}
  tokoKeranjang.atur(isi.filter((i) => i.kunci !== kunci))
  return () =>
    tokoKeranjang.atur((kini) => (kini.some((i) => i.kunci === kunci) ? kini : [...kini.slice(0, posisi), item, ...kini.slice(posisi)]))
}

export function kosongkanKeranjang(): void {
  tokoKeranjang.atur([])
}

export function keItemApi(i: ItemKeranjang): Skema['ItemPaketIn'] | Skema['ItemRangkaiSendiriIn'] {
  return i.jenis_item === 'paket'
    ? { jenis_item: 'paket', id_produk: i.id_produk, jumlah: i.jumlah }
    : {
        jenis_item: 'rangkai_sendiri',
        bunga: i.bunga.map((b) => ({ id_stok: b.id_stok, jumlah_tangkai: b.jumlah_tangkai })),
      }
}

export function hargaItem(i: ItemKeranjang): number {
  return i.jenis_item === 'paket' ? i.harga * i.jumlah : i.bunga.reduce((t, b) => t + b.harga_per_tangkai * b.jumlah_tangkai, 0)
}

export const useKeranjang = () => useToko(tokoKeranjang)

export const jumlahBarang = (isi: ItemKeranjang[]) => isi.reduce((t, i) => t + (i.jenis_item === 'paket' ? i.jumlah : 1), 0)
