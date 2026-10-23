import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { FilterPenajaman } from '@/aksesibilitas/FilterPenajaman'
import { SinkronAksesibilitas } from '@/aksesibilitas/SinkronAksesibilitas'
import { GalatApi } from '@/api/client'
import { PenampungToast } from '@/komponen/ui/Toast'
import { PembaruanAplikasi } from '@/pwa/KomponenPwa'

import { router } from './rute'

export const klienKueri = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Galat 4xx (tidak ada akses, tidak ditemukan) tidak akan berubah bila diulang.
      retry: (jumlah, galat) => !(galat instanceof GalatApi && galat.status >= 400 && galat.status < 500) && jumlah < 2,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})

export function Aplikasi() {
  return (
    <QueryClientProvider client={klienKueri}>
      <FilterPenajaman />
      <SinkronAksesibilitas />
      <RouterProvider router={router} />
      <PenampungToast />
      <PembaruanAplikasi />
    </QueryClientProvider>
  )
}
