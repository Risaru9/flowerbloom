import type { Skema } from '@/api/client'
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HalamanDetailPesanan } from '@/fitur/pesanan/HalamanDetailPesanan'
import { VerifikasiBukti } from '@/fitur/admin/pesanan/HalamanDetailPesananAdmin'
import { SinkronAksesibilitas } from '@/aksesibilitas/SinkronAksesibilitas'
import { tokoAksesibilitas, BAWAAN } from '@/aksesibilitas/pengaturan'

const state = vi.hoisted(() => ({
  pesanan: null as Skema['PesananOut'] | null,
  sesi: { pengguna: { id_pengguna: 1, peran: 'pelanggan' } } as { pengguna: { id_pengguna: number; peran: string } } | null,
  prefs: { jenis_buta_warna: 'normal', penajaman_warna: false, ukuran_teks: 100, kecepatan_suara: 1, tema: 'gelap' },
  mutateAsync: vi.fn().mockResolvedValue({}),
  tolak: vi.fn(),
}))
vi.mock('@/api/pelanggan', () => ({
  usePesanan: () => ({ data: state.pesanan, isPending: false, isError: false }),
  useTanggapiFoto: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
  useBatalkanPesanan: () => ({ isPending: false }),
  useAjukanKomplain: () => ({ isPending: false }),
  useInfoToko: () => ({ data: undefined }),
  useKomplainSaya: () => ({ data: [] }),
  useAksesibilitasSaya: () => ({ data: state.prefs }),
}))
vi.mock('@/auth/sesi', () => ({ useSesi: () => state.sesi }))
vi.mock('@/tata-letak/TataLetakAdmin', () => ({ JudulAdmin: () => null, Kartu: () => null }))
vi.mock('@/api/admin', () => ({
  useAdminPesananDetail: vi.fn(),
  usePengembalianDanaSelesai: vi.fn(),
  useSahkanPembayaran: () => ({ mutate: vi.fn(), isPending: false }),
  useTandaiSelesai: vi.fn(),
  useTolakPembayaran: () => ({ mutate: state.tolak, isPending: false }),
}))

function pesananDenganPengganti(warnaBerbeda: boolean, wajib = true) {
  return {
    id_pesanan: 1,
    kode_pesanan: 'AUDIT-1',
    tanggal_kirim: '2026-10-27',
    slot_jam: '09:00–11:00',
    status: { kode: 'menunggu_persetujuan_foto', label: 'Menunggu persetujuan foto', keterangan: 'Periksa foto', ikon: 'camera' },
    dibuat_pada: '2026-10-26T00:00:00Z',
    nama_penerima: 'Audit',
    cara_serah_terima: 'ambil_di_toko',
    alamat: null,
    kartu_ucapan: null,
    ongkos_antar: 0,
    total_harga: 10000,
    bisa_dibatalkan: false,
    revisi_gratis_tersisa: 1,
    tahap: [],
    detail: [],
    pembayaran: [],
    riwayat: [],
    foto: [
      {
        perlu_persetujuan_pengganti: wajib,
        id_foto: 1,
        foto_url: null,
        label_warna: [],
        label_teks: 'Merah',
        status_persetujuan: 'menunggu',
        pengganti: [{ jumlah: 1, dari: 'Mawar merah', menjadi: 'Gerbera merah', warna_berbeda: warnaBerbeda, alasan: 'Stok pengganti' }],
      },
    ],
  } as unknown as Skema['PesananOut']
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  tokoAksesibilitas.atur(BAWAAN)
})

it('pengganti warna sama tetap meminta persetujuan bila backend mewajibkan', async () => {
  state.pesanan = pesananDenganPengganti(false)
  render(
    <MemoryRouter>
      <HalamanDetailPesanan />
    </MemoryRouter>,
  )
  expect(screen.getByText('Ada bunga pengganti')).toBeTruthy()
  expect(screen.getByRole('checkbox')).toBeTruthy()
  const button = screen.getByRole('button', { name: 'Setujui rangkaian' })
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(button).not.toBeDisabled()
  await act(async () => {
    fireEvent.click(button)
  })
  expect(state.mutateAsync).toHaveBeenCalledWith({ keputusan: 'setuju', catatan_revisi: null, setuju_pengganti: true })
})

it('pengganti beda warna meminta persetujuan dan mengirim konfirmasi', async () => {
  state.pesanan = pesananDenganPengganti(true)
  render(
    <MemoryRouter>
      <HalamanDetailPesanan />
    </MemoryRouter>,
  )
  const button = screen.getByRole('button', { name: 'Setujui rangkaian' })
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(button).not.toBeDisabled()
  await act(async () => {
    fireEvent.click(button)
  })
  expect(state.mutateAsync).toHaveBeenCalledWith({ keputusan: 'setuju', catatan_revisi: null, setuju_pengganti: true })
})

it('pengganti tanpa persetujuan wajib dapat disetujui tanpa checkbox', async () => {
  state.pesanan = pesananDenganPengganti(false, false)
  render(
    <MemoryRouter>
      <HalamanDetailPesanan />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('checkbox')).toBeNull()
  const button = screen.getByRole('button', { name: 'Setujui rangkaian' })
  expect(button).not.toBeDisabled()
  await act(async () => {
    fireEvent.click(button)
  })
  expect(state.mutateAsync).toHaveBeenCalledWith({ keputusan: 'setuju', catatan_revisi: null, setuju_pengganti: false })
})

it('foto revisi baru meminta persetujuan baru', () => {
  state.pesanan = pesananDenganPengganti(false)
  const view = render(
    <MemoryRouter>
      <HalamanDetailPesanan />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('checkbox'))
  expect(screen.getByRole('button', { name: 'Setujui rangkaian' })).not.toBeDisabled()
  state.pesanan = pesananDenganPengganti(false)
  state.pesanan.foto[0]!.id_foto = 2
  view.rerender(
    <MemoryRouter>
      <HalamanDetailPesanan />
    </MemoryRouter>,
  )
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Setujui rangkaian' })).toBeDisabled()
})

it.each([false, true])('penolakan bukti mencatat keputusan admin tentang dana diterima: %s', (diterima) => {
  const p = {
    id_pesanan: 1,
    kode_pesanan: 'AUDIT-1',
    total_harga: 150000,
    status: { kode: 'menunggu_verifikasi' },
  } as unknown as Skema['PesananAdminOut']
  const bukti = {
    id_pembayaran: 3,
    nama_pengirim: 'Dummy',
    nominal: 100000,
    nominal_sesuai: false,
    dana_diterima: false,
    status_verifikasi: 'menunggu',
    diunggah_pada: '2026-10-30T00:00:00Z',
  } as unknown as Skema['PembayaranOut']
  render(<VerifikasiBukti pesanan={p} bukti={bukti} />)
  fireEvent.click(screen.getByRole('button', { name: 'Tolak bukti' }))
  fireEvent.click(screen.getByRole('button', { name: 'Nominal tidak sesuai' }))
  const kotak = screen.getByRole('checkbox')
  expect(kotak).not.toBeChecked()
  if (diterima) fireEvent.click(kotak)
  fireEvent.click(screen.getAllByRole('button', { name: 'Tolak bukti' }).at(-1)!)
  expect(state.tolak).toHaveBeenCalledWith({ idPembayaran: 3, catatan: 'Nominal tidak sesuai', danaDiterima: diterima }, expect.any(Object))
})

it('sinkronisasi preferensi kembali setelah logout dan masuk akun yang sama', () => {
  state.sesi = { pengguna: { id_pengguna: 1, peran: 'pelanggan' } }
  state.prefs = { ...state.prefs, tema: 'gelap' }
  const view = render(<SinkronAksesibilitas />)
  expect(tokoAksesibilitas.ambil().tema).toBe('gelap')
  state.sesi = null
  view.rerender(<SinkronAksesibilitas />)
  act(() => {
    tokoAksesibilitas.atur({ ...BAWAAN, tema: 'terang' })
  })
  state.sesi = { pengguna: { id_pengguna: 1, peran: 'pelanggan' } }
  view.rerender(<SinkronAksesibilitas />)
  expect(tokoAksesibilitas.ambil().tema).toBe('gelap')
})
