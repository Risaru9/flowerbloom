import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { GrafikBatang } from './GrafikBatang'
import { Bidang, Masukan } from './ui/Bidang'
import { LencanaStatus } from './ui/Lain'
import { TombolKembali } from './ui/TombolKembali'
import { ChipWarna } from './ui/Warna'

describe('ChipWarna', () => {
  it('selalu menuliskan nama dan kode warna, tidak hanya kotak warna (F-AK-01)', () => {
    render(<ChipWarna warna={{ nama_warna: 'Merah muda', kode_hex: '#e9a6b2' }} makna="Kasih sayang" />)
    expect(screen.getByText('Merah muda')).toBeInTheDocument()
    expect(screen.getByText('#E9A6B2')).toBeInTheDocument()
    expect(screen.getByText('Kasih sayang')).toBeInTheDocument()
  })
})

describe('LencanaStatus', () => {
  it('menampilkan ikon dan label, bukan hanya warna (F-AK-02)', () => {
    const { container } = render(
      <LencanaStatus
        status={{ kode: 'sedang_dirangkai', label: 'Sedang dirangkai', ikon: 'scissors', keterangan: 'Florist sedang merangkai' }}
      />,
    )
    expect(screen.getByText('Sedang dirangkai')).toBeInTheDocument()
    // Pengenal ikon dari backend dipetakan ke ikon SVG dekoratif, bukan ditulis sebagai teks.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByText('scissors')).toBeNull()
  })
})

describe('Bidang', () => {
  it('menghubungkan label, bantuan, dan galat ke kontrol lewat ARIA', () => {
    render(
      <Bidang label="Email" bantuan="Untuk notifikasi" galat="Format email salah" wajib>
        <Masukan type="email" />
      </Bidang>,
    )
    const isian = screen.getByLabelText(/Email/)
    expect(isian).toHaveAttribute('aria-invalid', 'true')
    expect(isian).toHaveAttribute('aria-required', 'true')
    expect(isian).toHaveAccessibleDescription('Untuk notifikasi Format email salah')
    expect(screen.getByRole('alert')).toHaveTextContent('Format email salah')
  })

  it('mempertahankan id milik kontrol', () => {
    render(
      <Bidang label="Nama">
        <Masukan id="bidang-nama" />
      </Bidang>,
    )
    expect(screen.getByLabelText('Nama')).toHaveAttribute('id', 'bidang-nama')
  })
})

describe('GrafikBatang', () => {
  const data = [
    { label: 'Sen', labelPanjang: 'Senin, 19 Oktober 2026', nilai: 3 },
    { label: 'Sel', labelPanjang: 'Selasa, 20 Oktober 2026', nilai: 7 },
  ]

  it('setiap batang punya label yang bisa dibaca dan bisa difokus', () => {
    render(<GrafikBatang data={data} namaNilai="Jumlah pesanan" />)
    const batang = screen.getByRole('img', { name: 'Selasa, 20 Oktober 2026: 7' })
    expect(batang).toHaveAttribute('tabindex', '0')
  })

  it('menyediakan tampilan tabel sebagai alternatif', async () => {
    render(<GrafikBatang data={data} namaNilai="Jumlah pesanan" />)
    await userEvent.click(screen.getByRole('button', { name: 'Lihat sebagai tabel' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Senin, 19 Oktober 2026' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '7' })).toBeInTheDocument()
  })
})

function pasangHalamanMasuk(entri: string[]) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Beranda</p> },
      { path: '/katalog', element: <p>Katalog</p> },
      { path: '/masuk', element: <TombolKembali /> },
    ],
    { initialEntries: entri, initialIndex: entri.length - 1 },
  )
  render(<RouterProvider router={router} />)
}

describe('TombolKembali', () => {
  afterEach(() => window.history.replaceState(null, ''))

  it('kembali ke halaman sebelumnya di aplikasi', async () => {
    window.history.replaceState({ idx: 1 }, '')
    pasangHalamanMasuk(['/katalog', '/masuk'])
    await userEvent.click(screen.getByRole('button', { name: 'Kembali' }))
    expect(await screen.findByText('Katalog')).toBeInTheDocument()
  })

  it('menuju beranda bila halaman masuk dibuka langsung, tidak keluar situs', async () => {
    pasangHalamanMasuk(['/masuk'])
    await userEvent.click(screen.getByRole('button', { name: 'Kembali' }))
    expect(await screen.findByText('Beranda')).toBeInTheDocument()
  })
})
