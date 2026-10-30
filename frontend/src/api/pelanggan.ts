import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { gantiToken, perbaruiPengguna, simpanSesi, useSesi } from '@/auth/sesi'
import { kunciCheckout, selesaiCheckout } from '@/lib/kunci-checkout'

import { ambil, api, buatFormData, sebagaiFormData, type Skema } from './client'

export const kunci = {
  produk: (acara?: string) => ['produk', { acara }] as const,
  produkDetail: (id: number) => ['produk', id] as const,
  acara: ['produk', 'acara'] as const,
  warna: ['warna'] as const,
  opsiRangkai: ['rangkai', 'opsi'] as const,
  infoToko: ['toko', 'info'] as const,
  saya: ['auth', 'saya'] as const,
  aksesibilitas: ['aksesibilitas', 'saya'] as const,
  pesananSaya: (status?: string, halaman?: number) => ['pesanan', 'saya', { status, halaman }] as const,
  pesanan: (id: number) => ['pesanan', id] as const,
  komplainSaya: ['komplain', 'saya'] as const,
}

/* ---------- Katalog & referensi ---------- */

export const useProduk = (acara?: string) =>
  useQuery({
    queryKey: kunci.produk(acara),
    queryFn: () => ambil(api.GET('/api/v1/produk', { params: { query: { acara: acara || undefined } } })),
  })

export const useProdukDetail = (id: number) =>
  useQuery({
    queryKey: kunci.produkDetail(id),
    queryFn: () => ambil(api.GET('/api/v1/produk/{id_produk}', { params: { path: { id_produk: id } } })),
    enabled: Number.isFinite(id),
  })

export const useAcara = () =>
  useQuery({
    queryKey: kunci.acara,
    queryFn: () => ambil(api.GET('/api/v1/produk/acara')) as Promise<string[]>,
    staleTime: 5 * 60_000,
  })

export const useWarna = () => useQuery({ queryKey: kunci.warna, queryFn: () => ambil(api.GET('/api/v1/warna')), staleTime: 10 * 60_000 })

export const useOpsiRangkai = () => useQuery({ queryKey: kunci.opsiRangkai, queryFn: () => ambil(api.GET('/api/v1/rangkai/opsi')) })

export const useInfoToko = () =>
  useQuery({ queryKey: kunci.infoToko, queryFn: () => ambil(api.GET('/api/v1/toko/info')), staleTime: 5 * 60_000 })

/* ---------- Akun ---------- */

export function useMasuk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ingat, ...isian }: Skema['MasukIn'] & { ingat: boolean }) => {
      const hasil = await ambil(api.POST('/api/v1/auth/masuk', { body: isian }))
      return { hasil, ingat }
    },
    onSuccess: ({ hasil, ingat }) => {
      qc.clear()
      simpanSesi(hasil.access_token, hasil.pengguna, ingat)
    },
  })
}

export const useDaftar = () =>
  useMutation({ mutationFn: (isian: Skema['DaftarIn']) => ambil(api.POST('/api/v1/auth/daftar', { body: isian })) })

export const useSaya = (aktif = true) =>
  useQuery({ queryKey: kunci.saya, queryFn: () => ambil(api.GET('/api/v1/auth/saya')), enabled: aktif })

export function useUbahProfil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isian: Skema['ProfilUbahIn']) => ambil(api.PATCH('/api/v1/auth/saya', { body: isian })),
    onSuccess: (pengguna) => {
      perbaruiPengguna(pengguna)
      qc.setQueryData(kunci.saya, pengguna)
    },
  })
}

export const useGantiKataSandi = () =>
  useMutation({
    mutationFn: (isian: Skema['KataSandiUbahIn']) => ambil(api.PATCH('/api/v1/auth/kata-sandi', { body: isian })),
    onSuccess: (hasil) => gantiToken(hasil.access_token, hasil.pengguna),
  })

export const useKeluarSemua = () => useMutation({ mutationFn: () => ambil(api.POST('/api/v1/auth/keluar-semua')) })

export const useAksesibilitasSaya = (aktif: boolean) =>
  useQuery({
    queryKey: kunci.aksesibilitas,
    queryFn: () => ambil(api.GET('/api/v1/aksesibilitas/saya')),
    enabled: aktif,
  })

export function useUbahAksesibilitas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isian: Skema['AksesibilitasUbahIn']) => ambil(api.PATCH('/api/v1/aksesibilitas/saya', { body: isian })),
    onSuccess: (data) => qc.setQueryData(kunci.aksesibilitas, data),
  })
}

/* ---------- Pesanan ---------- */

export const usePratinjau = () =>
  useMutation({
    mutationFn: (isian: Skema['PratinjauIn']) => ambil(api.POST('/api/v1/pesanan/pratinjau', { body: isian })),
  })

export function useCheckout() {
  const qc = useQueryClient()
  const sesi = useSesi()
  return useMutation({
    mutationFn: async (isian: Skema['CheckoutIn']) => {
      if (!sesi) throw new Error('Silakan masuk terlebih dahulu.')
      const idempotensi = await kunciCheckout(sesi.pengguna.id_pengguna, isian)
      const pesanan = await ambil(
        api.POST('/api/v1/pesanan', {
          body: isian,
          params: { header: { 'Idempotency-Key': idempotensi } },
        }),
      )
      selesaiCheckout(sesi.pengguna.id_pengguna)
      return pesanan
    },
    onSuccess: (pesanan) => {
      qc.setQueryData(kunci.pesanan(pesanan.id_pesanan), pesanan)
      void qc.invalidateQueries({ queryKey: ['pesanan', 'saya'] })
      void qc.invalidateQueries({ queryKey: kunci.opsiRangkai })
      void qc.invalidateQueries({ queryKey: ['produk'] })
    },
  })
}

export const usePesananSaya = (status?: Skema['StatusPesanan'], halaman = 1, perHalaman = 10) =>
  useQuery({
    queryKey: [...kunci.pesananSaya(status, halaman), perHalaman],
    queryFn: () => ambil(api.GET('/api/v1/pesanan', { params: { query: { status, halaman, per_halaman: perHalaman } } })),
    placeholderData: keepPreviousData,
  })

/** Status yang menunggu tindakan pihak lain (admin/pelanggan); selama itu detail pesanan dipantau berkala. */
export const STATUS_BERJALAN: Skema['StatusPesanan'][] = [
  'menunggu_pembayaran',
  'menunggu_verifikasi',
  'sedang_dirangkai',
  'menunggu_persetujuan_foto',
]

export const usePesanan = (id: number, opsi: { pantau?: boolean } = {}) =>
  useQuery({
    queryKey: kunci.pesanan(id),
    queryFn: () => ambil(api.GET('/api/v1/pesanan/{id_pesanan}', { params: { path: { id_pesanan: id } } })),
    enabled: Number.isFinite(id),
    refetchInterval: opsi.pantau ? (q) => (q.state.data && STATUS_BERJALAN.includes(q.state.data.status.kode) ? 30_000 : false) : undefined,
  })

function useMutasiPesanan<V>(fn: (v: V) => Promise<Skema['PesananOut']>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (pesanan) => {
      qc.setQueryData(kunci.pesanan(pesanan.id_pesanan), pesanan)
      void qc.invalidateQueries({ queryKey: ['pesanan', 'saya'] })
    },
  })
}

export const useUnggahBukti = (id: number) =>
  useMutasiPesanan((v: { bukti: File; nama_pengirim: string; nominal: number }) =>
    ambil(
      api.POST('/api/v1/pesanan/{id_pesanan}/pembayaran', {
        params: { path: { id_pesanan: id } },
        // @ts-expect-error -- skema menulis `bukti: string` untuk berkas; yang dikirim adalah FormData
        body: buatFormData(v),
        ...sebagaiFormData,
      }),
    ),
  )

export const useBatalkanPesanan = (id: number) =>
  useMutasiPesanan((alasan: string | null) =>
    ambil(api.POST('/api/v1/pesanan/{id_pesanan}/batal', { params: { path: { id_pesanan: id } }, body: { alasan } })),
  )

export const useTanggapiFoto = (id: number) =>
  useMutasiPesanan((isian: Skema['TanggapanFotoIn']) =>
    ambil(
      api.POST('/api/v1/pesanan/{id_pesanan}/persetujuan-foto', {
        params: { path: { id_pesanan: id } },
        body: isian,
      }),
    ),
  )

export function useAjukanKomplain(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { isi: string; foto?: File | null }) =>
      ambil(
        api.POST('/api/v1/pesanan/{id_pesanan}/komplain', {
          params: { path: { id_pesanan: id } },
          // @ts-expect-error -- berkas dikirim sebagai FormData
          body: buatFormData(v),
          ...sebagaiFormData,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunci.komplainSaya }),
  })
}

export const useKomplainSaya = () => useQuery({ queryKey: kunci.komplainSaya, queryFn: () => ambil(api.GET('/api/v1/komplain/saya')) })

/* ---------- Favorit & alamat ---------- */

export const kunciFavorit = ['favorit'] as const
export const kunciAlamat = ['alamat'] as const

export const useFavorit = (aktif = true) =>
  useQuery({ queryKey: kunciFavorit, queryFn: () => ambil(api.GET('/api/v1/favorit')), enabled: aktif })

/** Simpan/hapus favorit dengan pembaruan optimistis: ikon hati langsung berubah, dibatalkan bila gagal. */
export function useUbahFavorit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ produk, simpan }: { produk: Skema['ProdukOut']; simpan: boolean }) => {
      const opsi = { params: { path: { id_produk: produk.id_produk } } }
      await ambil(simpan ? api.PUT('/api/v1/favorit/{id_produk}', opsi) : api.DELETE('/api/v1/favorit/{id_produk}', opsi))
    },
    onMutate: async ({ produk, simpan }) => {
      await qc.cancelQueries({ queryKey: kunciFavorit })
      const sebelum = qc.getQueryData<Skema['ProdukOut'][]>(kunciFavorit)
      qc.setQueryData<Skema['ProdukOut'][]>(kunciFavorit, (lama = []) =>
        simpan ? [produk, ...lama.filter((p) => p.id_produk !== produk.id_produk)] : lama.filter((p) => p.id_produk !== produk.id_produk),
      )
      return { sebelum }
    },
    onError: (_g, _v, konteks) => qc.setQueryData(kunciFavorit, konteks?.sebelum),
    onSettled: () => void qc.invalidateQueries({ queryKey: kunciFavorit }),
  })
}

export const useAlamat = (aktif = true) =>
  useQuery({ queryKey: kunciAlamat, queryFn: () => ambil(api.GET('/api/v1/alamat')), enabled: aktif })

export function useSimpanAlamat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: number; isian: Skema['AlamatIn'] }) =>
      v.id
        ? ambil(api.PATCH('/api/v1/alamat/{id_alamat}', { params: { path: { id_alamat: v.id } }, body: v.isian }))
        : ambil(api.POST('/api/v1/alamat', { body: v.isian })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunciAlamat }),
  })
}

export function useJadikanUtama() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      ambil(api.PATCH('/api/v1/alamat/{id_alamat}', { params: { path: { id_alamat: id } }, body: { utama: true } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunciAlamat }),
  })
}

export function useHapusAlamat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => ambil(api.DELETE('/api/v1/alamat/{id_alamat}', { params: { path: { id_alamat: id } } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: kunciAlamat }),
  })
}
