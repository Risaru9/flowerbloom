import { Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react'
import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'

import { pesanGalat } from '@/api/client'
import { useDaftar, useMasuk } from '@/api/pelanggan'
import { tujuanAman } from '@/auth/Penjaga'
import { useSesi } from '@/auth/sesi'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { TataLetakAuth } from '@/tata-letak/TataLetakAuth'

/** Isian bergaris bawah dengan ikon, sesuai nuansa desain halaman masuk. */
export function IsianAuth({
  label,
  ikon,
  galat,
  bantuan,
  sandi,
  ...sisa
}: InputHTMLAttributes<HTMLInputElement> & { label: string; ikon: ReactNode; galat?: string; bantuan?: string; sandi?: boolean }) {
  const id = useId()
  const [lihat, setLihat] = useState(false)
  const idKet = `${id}-ket`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-olive-tua">
        {label}
      </label>
      <div className="flex items-center gap-3 border-b-2 border-rose pb-1 focus-within:border-rose-teks">
        <span aria-hidden className="text-rose-teks">
          {ikon}
        </span>
        <input
          id={id}
          type={sandi && !lihat ? 'password' : sisa.type}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat || bantuan ? idKet : undefined}
          className="h-11 min-w-0 flex-1 bg-transparent font-display text-lg text-olive-tua placeholder:text-redup/80 focus:outline-none"
          {...sisa}
        />
        {sandi && (
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            aria-pressed={lihat}
            className="grid size-10 place-items-center rounded-full text-redup hover:bg-blush"
          >
            {lihat ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        )}
      </div>
      {(galat || bantuan) && (
        <p id={idKet} role={galat ? 'alert' : undefined} className={galat ? 'mt-1 text-xs font-medium text-[#a01f1a]' : 'mt-1 text-xs text-redup'}>
          {galat ?? bantuan}
        </p>
      )}
    </div>
  )
}

export function HalamanMasuk() {
  useJudul('Masuk')
  const sesi = useSesi()
  const [q] = useSearchParams()
  const navigasi = useNavigate()
  const masuk = useMasuk()
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [ingat, setIngat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const kembali = tujuanAman(q.get('kembali'), '/')

  if (sesi && !masuk.isPending) return <Navigate to={sesi.pengguna.peran === 'admin' ? '/admin' : kembali} replace />

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setGalat(null)
    if (!email.trim() || !sandi) {
      setGalat('Isi email dan kata sandi.')
      return
    }
    try {
      const { hasil } = await masuk.mutateAsync({ email: email.trim(), kata_sandi: sandi, ingat })
      tampilkanToast(`Selamat datang, ${hasil.pengguna.nama}!`)
      navigasi(hasil.pengguna.peran === 'admin' ? '/admin' : kembali, { replace: true })
    } catch (err) {
      setGalat(pesanGalat(err))
    }
  }

  return (
    <TataLetakAuth judul="Masuk akun">
      <form onSubmit={kirim} noValidate className="flex flex-col gap-6">
        {galat && (
          <p role="alert" className="rounded-2xl bg-[#fce8e7] px-4 py-3 text-sm font-medium text-[#7a1814]">
            {galat}
          </p>
        )}
        <IsianAuth label="Email" ikon={<Mail className="size-5" />} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" required />
        <IsianAuth label="Kata sandi" ikon={<Lock className="size-5" />} sandi autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} required />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-olive-tua">
            <input type="checkbox" checked={ingat} onChange={(e) => setIngat(e.target.checked)} className="size-4 accent-rose-teks" />
            Ingat saya di perangkat ini
          </label>
          <Link to="/tentang#kontak" className="font-semibold text-rose-teks underline">
            Lupa kata sandi?
          </Link>
        </div>
        <Tombol type="submit" ukuran="besar" memuat={masuk.isPending}>
          Masuk
        </Tombol>
        <p className="text-center text-olive">
          Belum memiliki akun?{' '}
          <Link to={`/daftar${q.get('kembali') ? `?kembali=${encodeURIComponent(kembali)}` : ''}`} className="font-display font-semibold text-rose-teks italic underline">
            Daftar sekarang
          </Link>
        </p>
      </form>
    </TataLetakAuth>
  )
}

export function HalamanDaftar() {
  useJudul('Daftar')
  const sesi = useSesi()
  const [q] = useSearchParams()
  const navigasi = useNavigate()
  const daftar = useDaftar()
  const masuk = useMasuk()
  const [isian, setIsian] = useState({ nama: '', email: '', no_hp: '', kata_sandi: '' })
  const [galat, setGalat] = useState<Record<string, string>>({})
  const kembali = tujuanAman(q.get('kembali'), '/')

  if (sesi && !masuk.isPending && !daftar.isPending) return <Navigate to={kembali} replace />

  const ubah = (k: keyof typeof isian) => (e: React.ChangeEvent<HTMLInputElement>) => setIsian((s) => ({ ...s, [k]: e.target.value }))

  async function kirim(e: FormEvent) {
    e.preventDefault()
    const g: Record<string, string> = {}
    if (isian.nama.trim().length < 2) g.nama = 'Nama minimal 2 huruf.'
    if (!/^\S+@\S+\.\S+$/.test(isian.email.trim())) g.email = 'Format email belum benar.'
    if (isian.no_hp && !/^\+?[0-9 ()-]{8,20}$/.test(isian.no_hp)) g.no_hp = 'Nomor HP 8–20 digit.'
    if (isian.kata_sandi.length < 8) g.kata_sandi = 'Kata sandi minimal 8 karakter.'
    setGalat(g)
    if (Object.keys(g).length) return
    try {
      await daftar.mutateAsync({
        nama: isian.nama.trim(),
        email: isian.email.trim(),
        no_hp: isian.no_hp.trim() || null,
        kata_sandi: isian.kata_sandi,
      })
      await masuk.mutateAsync({ email: isian.email.trim(), kata_sandi: isian.kata_sandi, ingat: true })
      tampilkanToast('Akun berhasil dibuat. Selamat datang di FlowerBloom!')
      navigasi(kembali, { replace: true })
    } catch (err) {
      setGalat({ umum: pesanGalat(err) })
    }
  }

  return (
    <TataLetakAuth judul="Daftar akun">
      <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
        {galat.umum && (
          <p role="alert" className="rounded-2xl bg-[#fce8e7] px-4 py-3 text-sm font-medium text-[#7a1814]">
            {galat.umum}
          </p>
        )}
        <IsianAuth label="Nama lengkap" ikon={<UserRound className="size-5" />} autoComplete="name" value={isian.nama} onChange={ubah('nama')} galat={galat.nama} required />
        <IsianAuth label="Email" ikon={<Mail className="size-5" />} type="email" inputMode="email" autoComplete="email" value={isian.email} onChange={ubah('email')} galat={galat.email} required />
        <IsianAuth label="Nomor HP (opsional)" ikon={<Phone className="size-5" />} type="tel" inputMode="tel" autoComplete="tel" value={isian.no_hp} onChange={ubah('no_hp')} galat={galat.no_hp} />
        <IsianAuth
          label="Kata sandi"
          ikon={<Lock className="size-5" />}
          sandi
          autoComplete="new-password"
          value={isian.kata_sandi}
          onChange={ubah('kata_sandi')}
          galat={galat.kata_sandi}
          bantuan="Minimal 8 karakter. Gunakan gabungan huruf dan angka."
          required
        />
        <Tombol type="submit" ukuran="besar" memuat={daftar.isPending || masuk.isPending}>
          Daftar
        </Tombol>
        <p className="text-center text-olive">
          Sudah punya akun?{' '}
          <Link to={`/masuk${q.get('kembali') ? `?kembali=${encodeURIComponent(kembali)}` : ''}`} className="font-display font-semibold text-rose-teks italic underline">
            Masuk
          </Link>
        </p>
      </form>
    </TataLetakAuth>
  )
}
