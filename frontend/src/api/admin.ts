import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ambil, api, buatFormData, sebagaiFormData, type Skema } from './client'

export const kunciAdmin = {
  dasbor: ['admin', 'dasbor'] as const,
  pesanan: (q: Record<string, unknown>) => ['admin', 'pesanan', q] as const,
  pesananDetail: (id: number) => ['admin', 'pesanan', id] as const,
  merangkai: (id: number) => ['admin', 'merangkai', id] as const,
  stok: (menipis?: boolean) => ['admin', 'stok', { menipis }] as const,
  riwayatPindai: (q: Record<string, unknown>) => ['admin', 'riwayat-pindai', q] as const,
  ringkasanAkurasi: ['admin', 'riwayat-pindai', 'ringkasan'] as const,
  produk: ['admin', 'produk'] as const,
  laporan: (dari: string, sampai: string) => ['admin', 'laporan', dari, sampai] as const,
  pengaturan: ['admin', 'pengaturan'] as const,
  komplain: (status?: string) => ['admin', 'komplain', { status }] as const,
  pengguna: (peran?: string) => ['admin', 'pengguna', { peran }] as const,
  jenisBunga: (cari?: string) => ['jenis-bunga', { cari }] as const,
}

/* ---------- Dasbor & pesanan ---------- */

export const useDasbor = () =>
  useQuery({
    queryKey: kunciAdmin.dasbor,
    queryFn: () => ambil(api.GET('/api/v1/admin/dasbor')),
    // Notifikasi tindakan diturunkan dari angka dasbor dan diperbarui lewat polling (F-AD-03).
    refetchInterval: 60_000,
  })

export interface SaringPesanan {
  status?: Skema['StatusPesanan']
  cari?: string
  perlu_tindakan?: boolean
  halaman?: number
  per_halaman?: number
}

export const useAdminPesanan = (q: SaringPesanan) =>
  useQuery({
    queryKey: kunciAdmin.pesanan({ ...q }),
    queryFn: () => ambil(api.GET('/api/v1/admin/pesanan', { params: { query: q } })),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

export const useAdminPesananDetail = (id: number) =>
  useQuery({
    queryKey: kunciAdmin.pesananDetail(id),
    queryFn: () => ambil(api.GET('/api/v1/admin/pesanan/{id_pesanan}', { params: { path: { id_pesanan: id } } })),
    enabled: Number.isFinite(id),
  })

function useMutasiPesananAdmin<V>(id: number, fn: (v: V) => Promise<Skema['PesananAdminOut']>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (pesanan) => {
      qc.setQueryData(kunciAdmin.pesananDetail(id), pesanan)
      void qc.invalidateQueries({ queryKey: ['admin', 'pesanan'] })
      void qc.invalidateQueries({ queryKey: kunciAdmin.dasbor })
      void qc.invalidateQueries({ queryKey: kunciAdmin.merangkai(id) })
    },
  })
}

const jalur = (id: number) => ({ params: { path: { id_pesanan: id } } })

export const useSahkanPembayaran = (id: number) =>
  useMutasiPesananAdmin(id, (idPembayaran: number) =>
    ambil(
      api.POST('/api/v1/admin/pesanan/{id_pesanan}/pembayaran/{id_pembayaran}/sahkan', {
        params: { path: { id_pesanan: id, id_pembayaran: idPembayaran } },
      }),
    ),
  )

export const useTolakPembayaran = (id: number) =>
  useMutasiPesananAdmin(id, (v: { idPembayaran: number; catatan: string }) =>
    ambil(
      api.POST('/api/v1/admin/pesanan/{id_pesanan}/pembayaran/{id_pembayaran}/tolak', {
        params: { path: { id_pesanan: id, id_pembayaran: v.idPembayaran } },
        body: { catatan: v.catatan },
      }),
    ),
  )

export const useTandaiSelesai = (id: number) =>
  useMutasiPesananAdmin(id, () => ambil(api.POST('/api/v1/admin/pesanan/{id_pesanan}/selesai', jalur(id))))

export const usePengembalianDanaSelesai = (id: number) =>
  useMutasiPesananAdmin(id, () => ambil(api.POST('/api/v1/admin/pesanan/{id_pesanan}/pengembalian-dana-selesai', jalur(id))))

export const useUnggahFotoHasil = (id: number) =>
  useMutasiPesananAdmin(id, (foto: File) =>
    ambil(
      api.POST('/api/v1/admin/pesanan/{id_pesanan}/foto-hasil', {
        ...jalur(id),
        // @ts-expect-error -- berkas dikirim sebagai FormData
        body: buatFormData({ foto }),
        ...sebagaiFormData,
      }),
    ),
  )

/* ---------- Mode merangkai ---------- */

export const useMerangkai = (id: number) =>
  useQuery({
    queryKey: kunciAdmin.merangkai(id),
    queryFn: () => ambil(api.GET('/api/v1/admin/pesanan/{id_pesanan}/merangkai', jalur(id))),
    enabled: Number.isFinite(id),
  })

function useMutasiMerangkai<V, H extends { progres?: Skema['ProgresMerangkaiOut'] } | Skema['ProgresMerangkaiOut']>(
  id: number,
  fn: (v: V) => Promise<H>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (hasil) => {
      const progres = 'progres' in hasil && hasil.progres ? hasil.progres : (hasil as Skema['ProgresMerangkaiOut'])
      qc.setQueryData(kunciAdmin.merangkai(id), progres)
      qc.setQueryData(kunciAdmin.pesananDetail(id), progres.pesanan)
    },
  })
}

export const usePindaiMerangkai = (id: number) =>
  useMutasiMerangkai(id, (v: { foto: File; jumlah: number }) =>
    ambil(
      api.POST('/api/v1/admin/pesanan/{id_pesanan}/merangkai/pindai', {
        ...jalur(id),
        // @ts-expect-error -- berkas dikirim sebagai FormData
        body: buatFormData(v),
        ...sebagaiFormData,
      }),
    ),
  )

export const useTandaiCocok = (id: number) =>
  useMutasiMerangkai(id, (isian: Skema['TandaiCocokIn']) =>
    ambil(api.POST('/api/v1/admin/pesanan/{id_pesanan}/merangkai/tandai-cocok', { ...jalur(id), body: isian })),
  )

export const useCatatPengganti = (id: number) =>
  useMutasiMerangkai(id, (isian: Skema['PenggantiIn']) =>
    ambil(api.POST('/api/v1/admin/pesanan/{id_pesanan}/merangkai/pengganti', { ...jalur(id), body: isian })),
  )

/* ---------- Stok & pindai ---------- */

export const useStok = (menipis?: boolean) =>
  useQuery({
    queryKey: kunciAdmin.stok(menipis),
    queryFn: () => ambil(api.GET('/api/v1/admin/stok', { params: { query: { menipis } } })),
  })

function useMutasiStok<V, H>(fn: (v: V) => Promise<H>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'stok'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'riwayat-pindai'] })
      void qc.invalidateQueries({ queryKey: kunciAdmin.dasbor })
    },
  })
}

export const useStokManual = () =>
  useMutasiStok((isian: Skema['StokManualIn']) => ambil(api.POST('/api/v1/admin/stok/manual', { body: isian })))

export const usePindaiStok = () =>
  useMutation({
    mutationFn: (foto: File) =>
      ambil(
        api.POST('/api/v1/admin/stok/pindai', {
          // @ts-expect-error -- berkas dikirim sebagai FormData
          body: buatFormData({ foto }),
          ...sebagaiFormData,
        }),
      ),
  })

export const useSimpanPindai = () =>
  useMutasiStok((isian: Skema['SimpanPindaiIn']) => ambil(api.POST('/api/v1/admin/stok/simpan-pindai', { body: isian })))

export const useKoreksiStok = () =>
  useMutasiStok((v: { id: number; isian: Skema['KoreksiStokIn'] }) =>
    ambil(api.PATCH('/api/v1/admin/stok/{id_stok}', { params: { path: { id_stok: v.id } }, body: v.isian })),
  )

export const useRiwayatPindai = (q: { halaman?: number; per_halaman?: number; hanya_dikoreksi?: boolean }) =>
  useQuery({
    queryKey: kunciAdmin.riwayatPindai({ ...q }),
    queryFn: () => ambil(api.GET('/api/v1/admin/riwayat-pindai', { params: { query: q } })),
    placeholderData: keepPreviousData,
  })

export const useRingkasanAkurasi = () =>
  useQuery({
    queryKey: kunciAdmin.ringkasanAkurasi,
    queryFn: () => ambil(api.GET('/api/v1/admin/riwayat-pindai/ringkasan')),
  })

export const useJenisBunga = (cari?: string) =>
  useQuery({
    queryKey: kunciAdmin.jenisBunga(cari),
    queryFn: () => ambil(api.GET('/api/v1/jenis-bunga', { params: { query: { cari: cari || undefined } } })),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  })

/* ---------- Katalog ---------- */

export const useAdminProduk = () => useQuery({ queryKey: kunciAdmin.produk, queryFn: () => ambil(api.GET('/api/v1/admin/produk')) })

function useMutasiProduk<V>(fn: (v: V) => Promise<Skema['ProdukOut']>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kunciAdmin.produk })
      void qc.invalidateQueries({ queryKey: ['produk'] })
    },
  })
}

export const useTambahProduk = () => useMutasiProduk((isian: Skema['ProdukIn']) => ambil(api.POST('/api/v1/admin/produk', { body: isian })))

export const useUbahProduk = () =>
  useMutasiProduk((v: { id: number; isian: Skema['ProdukUbahIn'] }) =>
    ambil(api.PATCH('/api/v1/admin/produk/{id_produk}', { params: { path: { id_produk: v.id } }, body: v.isian })),
  )

export const useFotoProduk = () =>
  useMutasiProduk((v: { id: number; foto: File }) =>
    ambil(
      api.PUT('/api/v1/admin/produk/{id_produk}/foto', {
        params: { path: { id_produk: v.id } },
        // @ts-expect-error -- berkas dikirim sebagai FormData
        body: buatFormData({ foto: v.foto }),
        ...sebagaiFormData,
      }),
    ),
  )

/* ---------- Laporan, pengaturan, komplain, akun ---------- */

export const useLaporan = (dari: string, sampai: string) =>
  useQuery({
    queryKey: kunciAdmin.laporan(dari, sampai),
    queryFn: () => ambil(api.GET('/api/v1/admin/laporan', { params: { query: { dari, sampai } } })),
    enabled: !!dari && !!sampai,
  })

export const usePengaturanToko = () =>
  useQuery({ queryKey: kunciAdmin.pengaturan, queryFn: () => ambil(api.GET('/api/v1/admin/pengaturan-toko')) })

export function useUbahPengaturan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pengaturan: Record<string, unknown>) => ambil(api.PATCH('/api/v1/admin/pengaturan-toko', { body: { pengaturan } })),
    onSuccess: (data) => {
      qc.setQueryData(kunciAdmin.pengaturan, data)
      void qc.invalidateQueries({ queryKey: ['toko'] })
    },
  })
}

export const useAdminKomplain = (status?: Skema['StatusKomplain']) =>
  useQuery({
    queryKey: kunciAdmin.komplain(status),
    queryFn: () => ambil(api.GET('/api/v1/admin/komplain', { params: { query: { status } } })),
  })

export function useTanggapiKomplain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; isian: Skema['TanggapiKomplainIn'] }) =>
      ambil(api.PATCH('/api/v1/admin/komplain/{id_komplain}', { params: { path: { id_komplain: v.id } }, body: v.isian })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'komplain'] })
      void qc.invalidateQueries({ queryKey: kunciAdmin.dasbor })
    },
  })
}

export const useAdminPengguna = (peran?: Skema['Peran']) =>
  useQuery({
    queryKey: kunciAdmin.pengguna(peran),
    queryFn: () => ambil(api.GET('/api/v1/admin/pengguna', { params: { query: { peran } } })),
  })

export function useTambahAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (isian: Skema['AdminBaruIn']) => ambil(api.POST('/api/v1/admin/pengguna', { body: isian })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'pengguna'] }),
  })
}

export function useAturAktif() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; aktif: boolean }) =>
      ambil(
        api.PATCH('/api/v1/admin/pengguna/{id_pengguna}/aktif', {
          params: { path: { id_pengguna: v.id } },
          body: { aktif: v.aktif },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'pengguna'] }),
  })
}
