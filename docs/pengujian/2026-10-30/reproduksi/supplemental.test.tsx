import { cleanup, render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HalamanDetailPesanan } from '@/fitur/pesanan/HalamanDetailPesanan'
import { SinkronAksesibilitas } from '@/aksesibilitas/SinkronAksesibilitas'
import { tokoAksesibilitas, BAWAAN } from '@/aksesibilitas/pengaturan'

const state = vi.hoisted(() => ({
  pesanan: null as any,
  sesi: { pengguna: { id_pengguna: 1, peran: 'pelanggan' } } as any,
  prefs: { jenis_buta_warna: 'normal', penajaman_warna: false, ukuran_teks: 100, kecepatan_suara: 1, tema: 'gelap' },
  mutateAsync: vi.fn().mockResolvedValue({}),
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

function pesananDenganPengganti(warnaBerbeda: boolean) {
  return {
    id_pesanan: 1, kode_pesanan: 'AUDIT-1', tanggal_kirim: '2026-10-27', slot_jam: '09:00–11:00',
    status: { kode: 'menunggu_persetujuan_foto', label: 'Menunggu persetujuan foto', keterangan: 'Periksa foto', ikon: 'camera' },
    dibuat_pada: '2026-10-26T00:00:00Z', nama_penerima: 'Audit', cara_serah_terima: 'ambil_di_toko',
    alamat: null, kartu_ucapan: null, ongkos_antar: 0, total_harga: 10000, bisa_dibatalkan: false,
    revisi_gratis_tersisa: 1, tahap: [], detail: [], pembayaran: [], riwayat: [],
    foto: [{ id_foto: 1, foto_url: null, label_warna: [], label_teks: 'Merah', status_persetujuan: 'menunggu',
      pengganti: [{ jumlah: 1, dari: 'Mawar merah', menjadi: 'Gerbera merah', warna_berbeda: warnaBerbeda, alasan: 'Stok pengganti' }],
    }],
  }
}

afterEach(() => { cleanup(); vi.clearAllMocks(); tokoAksesibilitas.atur(BAWAAN) })

it('reproduces same-color substitution approval payload: no consent control and false value', async () => {
  state.pesanan = pesananDenganPengganti(false)
  render(<MemoryRouter><HalamanDetailPesanan /></MemoryRouter>)
  expect(screen.getByText('Ada bunga pengganti')).toBeTruthy()
  expect(screen.queryByRole('checkbox')).toBeNull()
  const button = screen.getByRole('button', { name: 'Setujui rangkaian' })
  expect(button).not.toBeDisabled()
  await act(async () => { fireEvent.click(button) })
  expect(state.mutateAsync).toHaveBeenCalledWith({ keputusan: 'setuju', catatan_revisi: null, setuju_pengganti: false })
})

it('control: different-color substitution exposes required consent and submits true', async () => {
  state.pesanan = pesananDenganPengganti(true)
  render(<MemoryRouter><HalamanDetailPesanan /></MemoryRouter>)
  const button = screen.getByRole('button', { name: 'Setujui rangkaian' })
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(button).not.toBeDisabled()
  await act(async () => { fireEvent.click(button) })
  expect(state.mutateAsync).toHaveBeenCalledWith({ keputusan: 'setuju', catatan_revisi: null, setuju_pengganti: true })
})

it('reproduces missing accessibility resync when same account signs in again without reload', () => {
  state.sesi = { pengguna: { id_pengguna: 1, peran: 'pelanggan' } }
  state.prefs = { ...state.prefs, tema: 'gelap' }
  const view = render(<SinkronAksesibilitas />)
  expect(tokoAksesibilitas.ambil().tema).toBe('gelap')
  state.sesi = null
  view.rerender(<SinkronAksesibilitas />)
  act(() => { tokoAksesibilitas.atur({ ...BAWAAN, tema: 'terang' }) })
  state.sesi = { pengguna: { id_pengguna: 1, peran: 'pelanggan' } }
  view.rerender(<SinkronAksesibilitas />)
  expect(tokoAksesibilitas.ambil().tema).toBe('terang')
  // Server still says gelap, but sudah.current is still the same account id.
})
