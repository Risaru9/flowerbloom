import createClient, { type Middleware } from 'openapi-fetch'

import { ambilToken, hapusSesi } from '@/auth/sesi'

import type { components, paths } from './schema'

export type Skema = components['schemas']

/** Galat dari API dalam bentuk seragam backend: {kode, pesan, rincian}. */
export class GalatApi extends Error {
  readonly status: number
  readonly kode: string
  readonly rincian: unknown

  constructor(status: number, kode: string, pesan: string, rincian?: unknown) {
    super(pesan)
    this.name = 'GalatApi'
    this.status = status
    this.kode = kode
    this.rincian = rincian
  }
}

const pasangToken: Middleware = {
  onRequest({ request }) {
    const token = ambilToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ response, request }) {
    // Token kedaluwarsa atau akun dinonaktifkan: sesi lokal dihapus agar UI kembali ke halaman masuk.
    if (response.status === 401 && request.headers.has('Authorization')) hapusSesi()
    return response
  },
}

export const api = createClient<paths>({ baseUrl: '' })
api.use(pasangToken)

const PESAN_UMUM: Record<number, string> = {
  401: 'Sesi berakhir. Silakan masuk kembali.',
  403: 'Anda tidak memiliki akses untuk tindakan ini.',
  404: 'Data tidak ditemukan.',
  413: 'Berkas terlalu besar.',
  429: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
}

export function keGalat(status: number, isi: unknown): GalatApi {
  if (isi && typeof isi === 'object') {
    const o = isi as Record<string, unknown>
    if (typeof o.pesan === 'string') {
      return new GalatApi(status, typeof o.kode === 'string' ? o.kode : 'kesalahan', o.pesan, o.rincian)
    }
    if (Array.isArray(o.detail)) {
      const pertama = o.detail[0] as { msg?: string } | undefined
      return new GalatApi(status, 'data_tidak_valid', pertama?.msg ?? 'Data tidak valid.', o.detail)
    }
  }
  return new GalatApi(status, 'kesalahan', PESAN_UMUM[status] ?? 'Terjadi kesalahan. Silakan coba lagi.')
}

/**
 * Membuka hasil openapi-fetch: mengembalikan `data` atau melempar GalatApi.
 * Dipakai di queryFn/mutationFn React Query agar status galat ditangani di satu tempat.
 */
export async function ambil<T>(janji: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let hasil: { data?: T; error?: unknown; response: Response }
  try {
    hasil = await janji
  } catch {
    throw new GalatApi(0, 'jaringan', 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.')
  }
  if (hasil.error !== undefined || !hasil.response.ok) throw keGalat(hasil.response.status, hasil.error)
  return hasil.data as T
}

export function pesanGalat(galat: unknown): string {
  if (galat instanceof GalatApi) return galat.message
  if (galat instanceof Error) return galat.message
  return 'Terjadi kesalahan. Silakan coba lagi.'
}

/** Mengirim FormData apa adanya (openapi-fetch menyerialkan JSON secara bawaan). */
export const sebagaiFormData = { bodySerializer: (isi: unknown) => isi as FormData }

export function buatFormData(isian: Record<string, string | number | Blob | null | undefined>): FormData {
  const fd = new FormData()
  for (const [kunci, nilai] of Object.entries(isian)) {
    if (nilai === null || nilai === undefined) continue
    fd.append(kunci, typeof nilai === 'number' ? String(nilai) : nilai)
  }
  return fd
}
