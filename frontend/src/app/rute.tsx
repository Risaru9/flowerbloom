import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'

import { WajibMasuk } from '@/auth/Penjaga'
import { TataLetakAdmin } from '@/tata-letak/TataLetakAdmin'
import { TataLetakAkun } from '@/tata-letak/TataLetakAkun'
import { TataLetakPelanggan } from '@/tata-letak/TataLetakPelanggan'

import { Halaman404, Halaman404Admin, HalamanGalatRute } from './HalamanGalat'

/** Setiap halaman dimuat terpisah (code splitting) agar unduhan awal di ponsel tetap kecil. */
function malas<M extends Record<string, unknown>>(muat: () => Promise<M>, nama: keyof M) {
  const Komponen = lazy(async () => ({ default: (await muat())[nama] as ComponentType }))
  return <Komponen />
}

const p = {
  beranda: () => import('@/fitur/katalog/HalamanBeranda'),
  katalog: () => import('@/fitur/katalog/HalamanKatalog'),
  produk: () => import('@/fitur/katalog/HalamanProduk'),
  tentang: () => import('@/fitur/katalog/HalamanTentang'),
  rangkai: () => import('@/fitur/rangkai/HalamanRangkai'),
  keranjang: () => import('@/fitur/keranjang/HalamanKeranjang'),
  checkout: () => import('@/fitur/keranjang/HalamanCheckout'),
  pembayaran: () => import('@/fitur/pesanan/HalamanPembayaran'),
  pesananSaya: () => import('@/fitur/pesanan/HalamanPesananSaya'),
  detailPesanan: () => import('@/fitur/pesanan/HalamanDetailPesanan'),
  auth: () => import('@/fitur/akun/HalamanAuth'),
  akun: () => import('@/fitur/akun/HalamanAkun'),
  aDasbor: () => import('@/fitur/admin/HalamanDasbor'),
  aMasuk: () => import('@/fitur/admin/HalamanMasukAdmin'),
  aPesanan: () => import('@/fitur/admin/pesanan/HalamanDaftarPesanan'),
  aDetail: () => import('@/fitur/admin/pesanan/HalamanDetailPesananAdmin'),
  aMerangkai: () => import('@/fitur/admin/pesanan/HalamanMerangkai'),
  aPembayaran: () => import('@/fitur/admin/pesanan/HalamanPembayaranAdmin'),
  aKomplain: () => import('@/fitur/admin/pesanan/HalamanKomplain'),
  aStok: () => import('@/fitur/admin/stok/HalamanStok'),
  aPindai: () => import('@/fitur/admin/stok/HalamanPindaiStok'),
  aRiwayat: () => import('@/fitur/admin/stok/HalamanRiwayatPindai'),
  aKatalog: () => import('@/fitur/admin/katalog/HalamanKatalogAdmin'),
  aProduk: () => import('@/fitur/admin/katalog/HalamanFormProduk'),
  aLaporan: () => import('@/fitur/admin/HalamanLaporan'),
  aPengaturan: () => import('@/fitur/admin/HalamanPengaturan'),
  aAkun: () => import('@/fitur/admin/HalamanAkunAdmin'),
}

export const router = createBrowserRouter([
  {
    errorElement: <HalamanGalatRute />,
    children: [
      { path: '/masuk', element: malas(p.auth, 'HalamanMasuk') },
      { path: '/daftar', element: malas(p.auth, 'HalamanDaftar') },
      { path: '/admin/masuk', element: malas(p.aMasuk, 'HalamanMasukAdmin') },
      { path: '/admin/lupa-sandi', element: malas(p.aMasuk, 'HalamanLupaSandi') },
      {
        element: <TataLetakPelanggan />,
        children: [
          { index: true, element: malas(p.beranda, 'HalamanBeranda') },
          { path: 'katalog', element: malas(p.katalog, 'HalamanKatalog') },
          { path: 'produk/:id', element: malas(p.produk, 'HalamanProduk') },
          { path: 'tentang', element: malas(p.tentang, 'HalamanTentang') },
          { path: 'rangkai', element: malas(p.rangkai, 'HalamanRangkai') },
          { path: 'keranjang', element: malas(p.keranjang, 'HalamanKeranjang') },
          {
            element: (
              <WajibMasuk peran="pelanggan">
                <Outlet />
              </WajibMasuk>
            ),
            children: [
              { path: 'checkout', element: malas(p.checkout, 'HalamanCheckout') },
              { path: 'pesanan/:id/bayar', element: malas(p.pembayaran, 'HalamanPembayaran') },
              {
                path: 'akun',
                element: <TataLetakAkun />,
                children: [
                  { index: true, element: malas(p.akun, 'HalamanProfil') },
                  { path: 'pesanan', element: malas(p.pesananSaya, 'HalamanPesananSaya') },
                  { path: 'pesanan/:id', element: malas(p.detailPesanan, 'HalamanDetailPesanan') },
                  { path: 'favorit', element: malas(p.akun, 'HalamanFavorit') },
                  { path: 'alamat', element: malas(p.akun, 'HalamanAlamat') },
                  { path: 'notifikasi', element: malas(p.akun, 'HalamanNotifikasi') },
                ],
              },
            ],
          },
          { path: '*', element: <Halaman404 /> },
        ],
      },
      {
        path: '/admin',
        element: (
          <WajibMasuk peran="admin">
            <TataLetakAdmin />
          </WajibMasuk>
        ),
        children: [
          { index: true, element: malas(p.aDasbor, 'HalamanDasbor') },
          { path: 'pesanan', element: malas(p.aPesanan, 'HalamanDaftarPesanan') },
          { path: 'pesanan/:id', element: malas(p.aDetail, 'HalamanDetailPesananAdmin') },
          { path: 'pesanan/:id/merangkai', element: malas(p.aMerangkai, 'HalamanMerangkai') },
          { path: 'pembayaran', element: malas(p.aPembayaran, 'HalamanPembayaranAdmin') },
          { path: 'komplain', element: malas(p.aKomplain, 'HalamanKomplain') },
          { path: 'stok', element: malas(p.aStok, 'HalamanStok') },
          { path: 'stok/pindai', element: malas(p.aPindai, 'HalamanPindaiStok') },
          { path: 'stok/riwayat', element: malas(p.aRiwayat, 'HalamanRiwayatPindai') },
          { path: 'katalog', element: malas(p.aKatalog, 'HalamanKatalogAdmin') },
          { path: 'katalog/baru', element: malas(p.aProduk, 'HalamanFormProduk') },
          { path: 'katalog/:id', element: malas(p.aProduk, 'HalamanFormProduk') },
          { path: 'laporan', element: malas(p.aLaporan, 'HalamanLaporan') },
          { path: 'pengaturan', element: malas(p.aPengaturan, 'HalamanPengaturan') },
          { path: 'akun', element: malas(p.aAkun, 'HalamanAkunAdmin') },
          { path: 'profil', element: malas(p.aAkun, 'HalamanProfilAdmin') },
          { path: '*', element: <Halaman404Admin /> },
        ],
      },
    ],
  },
])
