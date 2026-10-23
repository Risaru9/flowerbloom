import { Camera, Circle, CircleCheck, CircleX, Clock, FileSearch, Scissors, Store, Truck, type LucideIcon } from 'lucide-react'

/** Backend mengirim pengenal ikon generik (StatusInfoOut.ikon); di sini dipetakan ke pustaka ikon frontend. */
const PETA: Record<string, LucideIcon> = {
  clock: Clock,
  'file-search': FileSearch,
  scissors: Scissors,
  camera: Camera,
  store: Store,
  truck: Truck,
  'check-circle': CircleCheck,
  'x-circle': CircleX,
}

export function IkonStatus({ nama, className }: { nama: string; className?: string }) {
  const Ikon = PETA[nama] ?? Circle
  return <Ikon aria-hidden className={className ?? 'size-4'} />
}
