import type { Skema } from '@/api/client'

export const LABEL_STATUS: Record<Skema['StatusPesanan'], string> = {
  menunggu_pembayaran: 'Menunggu pembayaran',
  menunggu_verifikasi: 'Menunggu verifikasi',
  sedang_dirangkai: 'Sedang dirangkai',
  menunggu_persetujuan_foto: 'Menunggu persetujuan foto',
  siap_diambil: 'Siap diambil',
  diantar: 'Diantar',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

/** Bendera tindak lanjut selalu berupa teks (bukan hanya warna). */
export function BenderaPesanan({ p }: { p: Pick<Skema['PesananAdminRingkasOut'], 'perlu_tindakan_admin' | 'perlu_pengembalian_dana' | 'terlambat_ditanggapi'> }) {
  return (
    <span className="flex flex-wrap gap-1">
      {p.perlu_tindakan_admin && <span className="rounded-md bg-ad-aksen-lembut px-1.5 py-0.5 text-[0.7rem] font-bold text-ad-aksen">Perlu tindakan</span>}
      {p.perlu_pengembalian_dana && (
        <span className="rounded-md bg-ad-peringatan-lembut px-1.5 py-0.5 text-[0.7rem] font-bold text-ad-peringatan">Kembalikan dana</span>
      )}
      {p.terlambat_ditanggapi && (
        <span className="rounded-md bg-ad-bahaya-lembut px-1.5 py-0.5 text-[0.7rem] font-bold text-ad-bahaya">Foto belum ditanggapi</span>
      )}
    </span>
  )
}

export const tautanWa = (noHp: string | null) => {
  if (!noHp) return null
  const angka = noHp.replace(/\D/g, '').replace(/^0/, '62')
  return angka.length >= 9 ? `https://wa.me/${angka}` : null
}
