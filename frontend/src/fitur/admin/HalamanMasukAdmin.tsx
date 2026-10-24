import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { pesanGalat } from '@/api/client'
import { useMasuk } from '@/api/pelanggan'
import garisBunga from '@/assets/gambar/garis-bunga.webp'
import heroKotak from '@/assets/gambar/hero-kotak-bunga.webp'
import logoPutih from '@/assets/merek/logo-putih.svg'
import { hapusSesi, useSesi } from '@/auth/sesi'
import { tujuanAman } from '@/auth/Penjaga'
import { Masukan } from '@/komponen/ui/Bidang'
import { useJudul } from '@/komponen/ui/Lain'
import { Tombol } from '@/komponen/ui/Tombol'
import { TombolKembali } from '@/komponen/ui/TombolKembali'

function KerangkaAuthAdmin({ judul, keterangan, children }: { judul: string; keterangan: string; children: React.ReactNode }) {
  return (
    <div data-area="admin" className="grid min-h-dvh bg-ad-latar font-admin text-ad-teks lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#b44b59] to-[#7e343e] lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-6 lg:p-12">
        <img src={garisBunga} alt="" aria-hidden className="absolute -end-10 bottom-0 h-3/4 opacity-20 invert" />
        <img src={logoPutih} alt="FlowerBloom" className="relative w-72" />
        <p className="relative font-display text-2xl text-white/95 italic">Bunga terbaik, untuk setiap cerita</p>
        <img src={heroKotak} alt="" aria-hidden className="relative w-80 drop-shadow-2xl" />
      </div>
      <main id="konten" className="relative flex items-center justify-center px-5 pt-16 pb-10">
        <TombolKembali className="absolute start-3 top-3 text-ad-aksen hover:bg-ad-permukaan sm:start-6 sm:top-6" />
        <div className="w-full max-w-md rounded-3xl border border-ad-garis bg-ad-permukaan p-6 shadow-sm sm:p-8">
          <p className="mb-1 text-xs font-bold tracking-widest text-ad-aksen uppercase">Panel Admin FlowerBloom</p>
          <h1 className="text-3xl font-bold tracking-tight">{judul}</h1>
          <p className="mt-1 mb-6 text-sm text-ad-redup">{keterangan}</p>
          {children}
        </div>
      </main>
    </div>
  )
}

export function HalamanMasukAdmin() {
  useJudul('Masuk Admin')
  const sesi = useSesi()
  const [q] = useSearchParams()
  const navigasi = useNavigate()
  const masuk = useMasuk()
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [ingat, setIngat] = useState(false)
  const [lihat, setLihat] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const kembali = tujuanAman(q.get('kembali'), '/admin')

  if (sesi?.pengguna.peran === 'admin' && !masuk.isPending) return <Navigate to={kembali} replace />

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat(null)
    try {
      const { hasil } = await masuk.mutateAsync({ email: email.trim(), kata_sandi: sandi, ingat })
      if (hasil.pengguna.peran !== 'admin') {
        hapusSesi()
        setGalat('Akun ini bukan akun admin. Gunakan halaman masuk pelanggan.')
        return
      }
      navigasi(kembali, { replace: true })
    } catch (err) {
      setGalat(pesanGalat(err))
    }
  }

  return (
    <KerangkaAuthAdmin judul="Masuk Admin" keterangan="Masuk untuk melanjutkan ke sistem admin.">
      <form onSubmit={kirim} className="flex flex-col gap-4">
        {galat && (
          <p role="alert" className="rounded-xl bg-ad-bahaya-lembut px-4 py-3 text-sm font-medium text-ad-bahaya">
            {galat}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email-admin" className="text-sm font-semibold">
            Email
          </label>
          <div className="relative">
            <Mail aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-redup" />
            <Masukan
              id="email-admin"
              gaya="admin"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="ps-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sandi-admin" className="text-sm font-semibold">
            Kata sandi
          </label>
          <div className="relative">
            <LockKeyhole aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-redup" />
            <Masukan
              id="sandi-admin"
              gaya="admin"
              type={lihat ? 'text' : 'password'}
              autoComplete="current-password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              required
              className="ps-9 pe-11"
            />
            <button
              type="button"
              onClick={() => setLihat((v) => !v)}
              aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              aria-pressed={lihat}
              className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ad-redup hover:bg-ad-latar"
            >
              {lihat ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" checked={ingat} onChange={(e) => setIngat(e.target.checked)} className="size-4 accent-ad-aksen" />
            Ingat saya
          </label>
          <Link to="/admin/lupa-sandi" className="font-semibold text-ad-aksen hover:underline">
            Lupa kata sandi?
          </Link>
        </div>
        <Tombol type="submit" varian="admin" ukuran="besar" memuat={masuk.isPending} className="rounded-xl">
          Masuk
        </Tombol>
        <p className="text-center text-xs text-ad-redup">
          Hanya untuk staf toko. Pelanggan?{' '}
          <Link to="/masuk" className="font-semibold text-ad-aksen underline">
            Masuk di sini
          </Link>
        </p>
      </form>
    </KerangkaAuthAdmin>
  )
}

export function HalamanLupaSandi() {
  useJudul('Lupa Kata Sandi')
  return (
    <KerangkaAuthAdmin judul="Lupa kata sandi" keterangan="Demi keamanan, kata sandi admin tidak diatur ulang lewat email.">
      <ol className="flex list-decimal flex-col gap-3 ps-5 text-sm">
        <li>Hubungi admin lain atau pemilik toko.</li>
        <li>
          Admin lain dapat <strong>menonaktifkan akun lama</strong> Anda dan <strong>membuatkan akun admin baru</strong> dari menu Akun
          Admin.
        </li>
        <li>Setelah masuk, segera ganti kata sandi dari menu Profil Saya.</li>
      </ol>
      <p className="mt-4 rounded-xl bg-ad-info-lembut p-3 text-xs text-ad-info">
        Bila tidak ada admin lain, pengelola server dapat membuat akun admin lewat perintah{' '}
        <code className="font-mono">python -m scripts.seed</code>.
      </p>
      <Link to="/admin/masuk" className="mt-6 inline-flex font-semibold text-ad-aksen hover:underline">
        ← Kembali ke halaman masuk
      </Link>
    </KerangkaAuthAdmin>
  )
}
