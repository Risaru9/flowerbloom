import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { useAdminPengguna, useAturAktif, useTambahAdmin } from '@/api/admin'
import { pesanGalat } from '@/api/client'
import { useGantiKataSandi, useKeluarSemua, useSaya, useUbahProfil } from '@/api/pelanggan'
import { hapusSesi, useSesi } from '@/auth/sesi'
import { Bidang, Masukan } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'
import { formatTanggal } from '@/lib/format'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

export function HalamanAkunAdmin() {
  useJudul('Akun Admin')
  const sesi = useSesi()
  const { data, isPending, isError, error, refetch } = useAdminPengguna('admin')
  const aturAktif = useAturAktif()
  const tambah = useTambahAdmin()
  const [buka, setBuka] = useState(false)
  const [isian, setIsian] = useState({ nama: '', email: '', no_hp: '', kata_sandi: '' })
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat(null)
    if (isian.kata_sandi.length < 8) return setGalat('Kata sandi minimal 8 karakter.')
    try {
      await tambah.mutateAsync({ ...isian, nama: isian.nama.trim(), email: isian.email.trim(), no_hp: isian.no_hp.trim() || null })
      tampilkanToast('Akun admin dibuat. Minta pemiliknya mengganti kata sandi setelah masuk.')
      setIsian({ nama: '', email: '', no_hp: '', kata_sandi: '' })
      setBuka(false)
    } catch (err) {
      setGalat(pesanGalat(err))
    }
  }

  return (
    <>
      <JudulAdmin
        judul="Akun Admin"
        keterangan="Kelola siapa saja yang dapat masuk ke panel admin."
        jejak={[{ ke: '/admin', label: 'Dasbor' }]}
        aksi={
          <Tombol varian="admin" className="rounded-xl" ikon={<Plus aria-hidden className="size-4" />} onClick={() => setBuka(true)}>
            Tambah admin
          </Tombol>
        }
      />
      {isPending ? (
        <Memuat />
      ) : isError ? (
        <Galat galat={error} ulangi={() => void refetch()} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((u) => {
            const saya = u.id_pengguna === sesi?.pengguna.id_pengguna
            return (
              <li key={u.id_pengguna} className={cn('flex items-center gap-3 rounded-2xl border bg-ad-permukaan p-4', u.aktif ? 'border-ad-garis' : 'border-dashed border-ad-redup/60 opacity-75')}>
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-ad-aksen-lembut font-bold text-ad-aksen">
                  {u.nama.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {u.nama} {saya && <span className="text-xs font-normal text-ad-redup">(Anda)</span>}
                  </p>
                  <p className="truncate text-sm text-ad-redup">{u.email}</p>
                  <p className="text-xs text-ad-redup">
                    {u.aktif ? 'Aktif' : 'Nonaktif'} · sejak {formatTanggal(u.dibuat_pada)}
                  </p>
                </div>
                {!saya && (
                  <Tombol
                    varian={u.aktif ? 'admin-garis' : 'admin-lembut'}
                    ukuran="kecil"
                    className="rounded-lg"
                    memuat={aturAktif.isPending && aturAktif.variables?.id === u.id_pengguna}
                    onClick={() =>
                      aturAktif.mutate(
                        { id: u.id_pengguna, aktif: !u.aktif },
                        {
                          onSuccess: () => tampilkanToast(u.aktif ? `${u.nama} dinonaktifkan.` : `${u.nama} diaktifkan kembali.`),
                          onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                        },
                      )
                    }
                  >
                    {u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </Tombol>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Dialog
        gaya="admin"
        terbuka={buka}
        saatTutup={() => setBuka(false)}
        judul="Tambah akun admin"
        kaki={
          <>
            <Tombol varian="admin-garis" className="rounded-xl" onClick={() => setBuka(false)}>
              Batal
            </Tombol>
            <Tombol type="submit" form="form-admin" varian="admin" className="rounded-xl" memuat={tambah.isPending}>
              Buat akun
            </Tombol>
          </>
        }
      >
        <form id="form-admin" onSubmit={kirim} className="grid gap-4 sm:grid-cols-2">
          {galat && <p role="alert" className="rounded-xl bg-ad-bahaya-lembut p-3 text-sm text-ad-bahaya sm:col-span-2">{galat}</p>}
          <Bidang label="Nama" gaya="admin" wajib>
            <Masukan gaya="admin" value={isian.nama} onChange={(e) => setIsian({ ...isian, nama: e.target.value })} required minLength={2} />
          </Bidang>
          <Bidang label="Email" gaya="admin" wajib>
            <Masukan gaya="admin" type="email" value={isian.email} onChange={(e) => setIsian({ ...isian, email: e.target.value })} required />
          </Bidang>
          <Bidang label="Nomor HP" gaya="admin">
            <Masukan gaya="admin" type="tel" value={isian.no_hp} onChange={(e) => setIsian({ ...isian, no_hp: e.target.value })} />
          </Bidang>
          <Bidang label="Kata sandi sementara" gaya="admin" wajib bantuan="Minimal 8 karakter.">
            <Masukan gaya="admin" type="password" autoComplete="new-password" value={isian.kata_sandi} onChange={(e) => setIsian({ ...isian, kata_sandi: e.target.value })} required />
          </Bidang>
        </form>
      </Dialog>
    </>
  )
}

export function HalamanProfilAdmin() {
  useJudul('Profil Saya')
  const { data: saya, isPending, isError, error, refetch } = useSaya()
  const ubah = useUbahProfil()
  const ganti = useGantiKataSandi()
  const keluarSemua = useKeluarSemua()
  const qc = useQueryClient()
  const navigasi = useNavigate()
  const [isian, setIsian] = useState<{ nama: string; email: string; no_hp: string } | null>(null)
  const [sandi, setSandi] = useState({ lama: '', baru: '', ulang: '' })
  const [galatSandi, setGalatSandi] = useState<string | null>(null)

  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />
  const nilai = isian ?? { nama: saya.nama, email: saya.email, no_hp: saya.no_hp ?? '' }

  return (
    <>
      <JudulAdmin judul="Profil Saya" jejak={[{ ke: '/admin', label: 'Dasbor' }]} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Kartu>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <UserRound aria-hidden className="size-5 text-ad-aksen" /> Data diri
          </h2>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await ubah.mutateAsync({ nama: nilai.nama.trim(), email: nilai.email.trim(), no_hp: nilai.no_hp.trim() })
                setIsian(null)
                tampilkanToast('Profil diperbarui.')
              } catch (err) {
                tampilkanToast(pesanGalat(err), 'galat')
              }
            }}
          >
            <Bidang label="Nama" gaya="admin">
              <Masukan gaya="admin" value={nilai.nama} onChange={(e) => setIsian({ ...nilai, nama: e.target.value })} />
            </Bidang>
            <Bidang label="Email" gaya="admin">
              <Masukan gaya="admin" type="email" value={nilai.email} onChange={(e) => setIsian({ ...nilai, email: e.target.value })} />
            </Bidang>
            <Bidang label="Nomor HP" gaya="admin">
              <Masukan gaya="admin" type="tel" value={nilai.no_hp} onChange={(e) => setIsian({ ...nilai, no_hp: e.target.value })} />
            </Bidang>
            <Tombol type="submit" varian="admin" className="self-start rounded-xl" disabled={!isian} memuat={ubah.isPending}>
              Simpan
            </Tombol>
          </form>
        </Kartu>
        <Kartu>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <ShieldCheck aria-hidden className="size-5 text-ad-aksen" /> Keamanan
          </h2>
          <p className="mb-4 text-sm text-ad-redup">Mengganti kata sandi mengakhiri sesi Anda di perangkat lain.</p>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setGalatSandi(null)
              if (sandi.baru.length < 8) return setGalatSandi('Kata sandi baru minimal 8 karakter.')
              if (sandi.baru !== sandi.ulang) return setGalatSandi('Ulangi kata sandi baru dengan sama persis.')
              try {
                await ganti.mutateAsync({ kata_sandi_lama: sandi.lama, kata_sandi_baru: sandi.baru })
                setSandi({ lama: '', baru: '', ulang: '' })
                tampilkanToast('Kata sandi diganti.')
              } catch (err) {
                setGalatSandi(pesanGalat(err))
              }
            }}
          >
            {galatSandi && <p role="alert" className="rounded-xl bg-ad-bahaya-lembut p-3 text-sm text-ad-bahaya">{galatSandi}</p>}
            <Bidang label="Kata sandi lama" gaya="admin">
              <Masukan gaya="admin" type="password" autoComplete="current-password" value={sandi.lama} onChange={(e) => setSandi({ ...sandi, lama: e.target.value })} />
            </Bidang>
            <Bidang label="Kata sandi baru" gaya="admin">
              <Masukan gaya="admin" type="password" autoComplete="new-password" value={sandi.baru} onChange={(e) => setSandi({ ...sandi, baru: e.target.value })} />
            </Bidang>
            <Bidang label="Ulangi kata sandi baru" gaya="admin">
              <Masukan gaya="admin" type="password" autoComplete="new-password" value={sandi.ulang} onChange={(e) => setSandi({ ...sandi, ulang: e.target.value })} />
            </Bidang>
            <div className="flex flex-wrap gap-2">
              <Tombol type="submit" varian="admin" className="rounded-xl" disabled={!sandi.lama || !sandi.baru} memuat={ganti.isPending}>
                Ganti kata sandi
              </Tombol>
              <Tombol
                varian="admin-garis"
                className="rounded-xl"
                ikon={<LogOut aria-hidden className="size-4" />}
                memuat={keluarSemua.isPending}
                onClick={async () => {
                  try {
                    await keluarSemua.mutateAsync()
                    hapusSesi()
                    qc.clear()
                    navigasi('/admin/masuk', { replace: true })
                  } catch (err) {
                    tampilkanToast(pesanGalat(err), 'galat')
                  }
                }}
              >
                Keluar dari semua perangkat
              </Tombol>
            </div>
          </form>
        </Kartu>
      </div>
    </>
  )
}
