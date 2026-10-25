import { Camera, CheckCheck, CheckCircle2, Hand, MessageSquareText, Replace, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { useCatatPengganti, useMerangkai, usePindaiMerangkai, useStok, useTandaiCocok, useUnggahFotoHasil } from '@/api/admin'
import { pesanGalat, type Skema } from '@/api/client'
import { UnggahFoto } from '@/fitur/pesanan/bersama'
import { AreaTeks, Bidang, Masukan, Pilihan } from '@/komponen/ui/Bidang'
import { Dialog } from '@/komponen/ui/Dialog'
import { Galat, Memuat } from '@/komponen/ui/Keadaan'
import { useJudul } from '@/komponen/ui/Lain'
import { tampilkanToast } from '@/komponen/ui/Toast'
import { Tombol } from '@/komponen/ui/Tombol'
import { ChipWarna } from '@/komponen/ui/Warna'
import { cn } from '@/lib/cn'
import { JudulAdmin, Kartu } from '@/tata-letak/TataLetakAdmin'

type Komposisi = Skema['KomposisiPesananOut']

function DialogPengganti({ id, asal, saatTutup }: { id: number; asal: Komposisi | null; saatTutup: () => void }) {
  const stok = useStok()
  const catat = useCatatPengganti(id)
  const [idStok, setIdStok] = useState('')
  const [jumlah, setJumlah] = useState(1)
  const [alasan, setAlasan] = useState('')
  const sisa = asal ? asal.jumlah_tangkai - asal.jumlah_terpindai : 0
  const pilihan = (stok.data ?? []).filter((s) => s.jumlah_tersedia > 0 && !(asal && s.id_stok === asal.id_stok))
  const terpilih = pilihan.find((s) => String(s.id_stok) === idStok)
  return (
    <Dialog
      gaya="admin"
      terbuka={!!asal}
      saatTutup={saatTutup}
      judul="Catat bunga pengganti"
      deskripsi={
        asal ? `Mengganti ${asal.jenis.nama_bunga} ${asal.warna.nama_warna}. Pengganti berwarna lain wajib disetujui pelanggan.` : undefined
      }
      kaki={
        <>
          <Tombol varian="admin-garis" className="rounded-xl" onClick={saatTutup}>
            Batal
          </Tombol>
          <Tombol
            varian="admin"
            className="rounded-xl"
            memuat={catat.isPending}
            disabled={!asal || !idStok || alasan.trim().length < 3 || jumlah < 1}
            onClick={() =>
              asal &&
              catat.mutate(
                { id_komposisi_asal: asal.id_komposisi_pesanan, id_stok_pengganti: Number(idStok), jumlah, alasan: alasan.trim() },
                {
                  onSuccess: () => {
                    tampilkanToast('Bunga pengganti dicatat.')
                    setIdStok('')
                    setAlasan('')
                    saatTutup()
                  },
                  onError: (e) => tampilkanToast(pesanGalat(e), 'galat', 7000),
                },
              )
            }
          >
            Simpan pengganti
          </Tombol>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Bidang label="Bunga pengganti dari stok" gaya="admin" wajib>
          <Pilihan gaya="admin" value={idStok} onChange={(e) => setIdStok(e.target.value)}>
            <option value="">Pilih stok…</option>
            {pilihan.map((s) => (
              <option key={s.id_stok} value={s.id_stok}>
                {s.jenis.nama_bunga} — {s.warna.nama_warna} ({s.warna.kode_hex}) · tersedia {s.jumlah_tersedia}
              </option>
            ))}
          </Pilihan>
        </Bidang>
        {terpilih && asal && terpilih.warna.id_warna !== asal.warna.id_warna && (
          <p className="rounded-xl bg-ad-peringatan-lembut p-3 text-sm text-ad-peringatan">
            Warna berbeda: {asal.warna.nama_warna} → {terpilih.warna.nama_warna}. Pelanggan akan diminta menyetujui.
          </p>
        )}
        <Bidang label="Jumlah tangkai" gaya="admin" bantuan={`Sisa yang belum terpenuhi: ${sisa}`}>
          <Masukan
            gaya="admin"
            type="number"
            min={1}
            max={Math.max(1, sisa)}
            value={jumlah}
            onChange={(e) => setJumlah(Number(e.target.value))}
          />
        </Bidang>
        <Bidang label="Alasan" gaya="admin" wajib>
          <AreaTeks
            gaya="admin"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Mawar merah habis / tangkai rusak"
            maxLength={255}
          />
        </Bidang>
      </div>
    </Dialog>
  )
}

export function HalamanMerangkai() {
  const id = Number(useParams().id)
  const { data, isPending, isError, error, refetch } = useMerangkai(id)
  const pindai = usePindaiMerangkai(id)
  const tandai = useTandaiCocok(id)
  const unggahFoto = useUnggahFotoHasil(id)
  const navigasi = useNavigate()
  const [foto, setFoto] = useState<File | null>(null)
  const [jumlah, setJumlah] = useState(1)
  const [hasil, setHasil] = useState<Skema['HasilMerangkaiOut'] | null>(null)
  const [jenisDipilih, setJenisDipilih] = useState('')
  const [fotoHasil, setFotoHasil] = useState<File | null>(null)
  const [pengganti, setPengganti] = useState<Komposisi | null>(null)
  useJudul('Mode Merangkai')

  if (isPending) return <Memuat />
  if (isError) return <Galat galat={error} ulangi={() => void refetch()} />
  const p = data.pesanan
  const komposisi = p.detail.flatMap((d) => d.komposisi.map((k) => ({ ...k, nama: d.nama })))
  const persen = data.target ? Math.round((data.terpindai / data.target) * 100) : 0
  // Jenis yang masih dicari: admin memilih jenis (mudah dikenali dari bentuk), warnanya dicocokkan otomatis.
  const jenisTersisa = [
    ...new Map(komposisi.filter((k) => k.jumlah_terpindai < k.jumlah_tangkai).map((k) => [k.jenis.id_jenis_bunga, k.jenis.nama_bunga])),
  ]
  const kandidat = hasil?.id_komposisi_kandidat ?? []
  const fotoTerakhir = p.foto.at(-1)
  const tandaiCocok = (k: Komposisi, n: number) =>
    tandai.mutate({ id_komposisi_pesanan: k.id_komposisi_pesanan, jumlah: n }, { onError: (e) => tampilkanToast(pesanGalat(e), 'galat') })

  if (p.status.kode !== 'sedang_dirangkai') {
    return (
      <Kartu>
        <p className="mb-3">Pesanan ini tidak sedang dirangkai (status: {p.status.label}).</p>
        <Link to={`/admin/pesanan/${id}`} className="font-semibold text-ad-aksen underline">
          Kembali ke detail pesanan
        </Link>
      </Kartu>
    )
  }

  return (
    <>
      <JudulAdmin
        judul="Mode Merangkai"
        keterangan={`Pesanan ${p.kode_pesanan} · ${p.ringkasan_item}`}
        jejak={[
          { ke: '/admin/pesanan', label: 'Pesanan' },
          { ke: `/admin/pesanan/${id}`, label: p.kode_pesanan },
        ]}
      />

      <Kartu className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-semibold">Progres pencocokan</p>
          <p className="text-sm tabular-nums">
            <strong>{data.terpindai}</strong> / {data.target} tangkai
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={data.target}
          aria-valuenow={data.terpindai}
          aria-label="Tangkai yang sudah cocok"
          className="h-3 overflow-hidden rounded-full bg-ad-latar"
        >
          <div className="h-full rounded-full bg-ad-aksen transition-all" style={{ width: `${persen}%` }} />
        </div>
      </Kartu>

      {fotoTerakhir?.status_persetujuan === 'revisi' && (
        <Kartu className="mb-4 border-ad-peringatan/40 bg-ad-peringatan-lembut">
          <p className="flex items-center gap-2 font-semibold text-ad-peringatan">
            <MessageSquareText aria-hidden className="size-5" /> Pelanggan meminta revisi
          </p>
          <p className="mt-1 text-sm">{fotoTerakhir.catatan_revisi || 'Tanpa catatan.'}</p>
        </Kartu>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Kartu>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Camera aria-hidden className="size-5 text-ad-aksen" /> Pindai bunga yang diambil
          </h2>
          <p className="mb-3 text-sm text-ad-redup">Foto satu jenis bunga; warnanya dibaca lalu dicocokkan otomatis dengan pesanan.</p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!foto) return
              pindai.mutate(
                { foto, jumlah, id_jenis_bunga: jenisDipilih ? Number(jenisDipilih) : undefined },
                {
                  onSuccess: (h) => {
                    const r = h as Skema['HasilMerangkaiOut']
                    setHasil(r)
                    // Warna cocok untuk beberapa jenis: foto dipertahankan agar admin cukup memilih jenis lalu memindai lagi.
                    if (r.id_komposisi_kandidat.length === 0) {
                      setFoto(null)
                      setJumlah(1)
                      setJenisDipilih('')
                    }
                  },
                  onError: (er) => tampilkanToast(pesanGalat(er), 'galat'),
                },
              )
            }}
          >
            <UnggahFoto gaya="admin" kamera label="Ambil foto bunga" berkas={foto} ubah={setFoto} />
            <Bidang
              label="Jenis bunga yang diambil"
              gaya="admin"
              bantuan="Warna selalu dicocokkan otomatis. Pilih jenis bila diminta, yaitu saat beberapa bunga di pesanan berwarna sama."
            >
              <Pilihan gaya="admin" value={jenisDipilih} onChange={(e) => setJenisDipilih(e.target.value)}>
                <option value="">Tentukan dari warna</option>
                {jenisTersisa.map(([idJenis, nama]) => (
                  <option key={idJenis} value={idJenis}>
                    {nama}
                  </option>
                ))}
              </Pilihan>
            </Bidang>
            <Bidang label="Jumlah tangkai sejenis dalam foto" gaya="admin">
              <Masukan
                gaya="admin"
                type="number"
                min={1}
                max={100}
                value={jumlah}
                onChange={(e) => setJumlah(Math.max(1, Number(e.target.value)))}
              />
            </Bidang>
            <Tombol type="submit" varian="admin" className="rounded-xl" disabled={!foto} memuat={pindai.isPending}>
              Pindai & cocokkan
            </Tombol>
          </form>
          {hasil && (
            <div
              role="status"
              className={cn(
                'mt-4 rounded-xl p-4 text-sm',
                hasil.cocok
                  ? 'bg-ad-sukses-lembut text-ad-sukses'
                  : kandidat.length
                    ? 'bg-ad-peringatan-lembut text-ad-peringatan'
                    : 'bg-ad-bahaya-lembut text-ad-bahaya',
              )}
            >
              <p className="flex items-center gap-2 font-bold">
                {hasil.cocok ? <CheckCircle2 aria-hidden className="size-5" /> : <XCircle aria-hidden className="size-5" />}
                {hasil.cocok ? 'Cocok dengan pesanan' : kandidat.length ? 'Pilih jenis bunganya' : 'Tidak cocok'}
              </p>
              <p className="mt-1 text-ad-teks">
                {hasil.jenis && `${hasil.jenis.nama_bunga} · `}
                Warna terbaca: {hasil.warna ? <ChipWarna warna={hasil.warna} ukuran="kecil" /> : '—'}
              </p>
              {hasil.alasan && <p className="mt-1 text-ad-teks">{hasil.alasan}</p>}
            </div>
          )}
        </Kartu>

        <Kartu>
          <h2 className="mb-3 text-lg font-bold">Komposisi pesanan</h2>
          <ul className="flex flex-col gap-2">
            {komposisi.map((k) => {
              const sisa = k.jumlah_tangkai - k.jumlah_terpindai
              const selesai = sisa <= 0
              return (
                <li
                  key={k.id_komposisi_pesanan}
                  className={cn(
                    'rounded-xl border p-3',
                    selesai ? 'border-ad-sukses/40 bg-ad-sukses-lembut/40' : 'border-ad-garis',
                    (hasil?.id_komposisi_cocok === k.id_komposisi_pesanan || kandidat.includes(k.id_komposisi_pesanan)) &&
                      'ring-2 ring-ad-aksen',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {k.jenis.nama_bunga}
                        {k.is_pengganti && (
                          <span className="ms-2 rounded bg-ad-peringatan-lembut px-1 text-xs font-bold text-ad-peringatan">pengganti</span>
                        )}
                      </p>
                      <ChipWarna warna={k.warna} ukuran="kecil" />
                      <p className="text-xs text-ad-redup">{k.nama}</p>
                    </div>
                    <p
                      className={cn(
                        'rounded-lg px-2 py-1 text-sm font-bold tabular-nums',
                        selesai ? 'bg-ad-sukses text-white' : 'bg-ad-latar',
                      )}
                    >
                      {k.jumlah_terpindai}/{k.jumlah_tangkai}
                      <span className="sr-only">{selesai ? ' lengkap' : ' tangkai cocok'}</span>
                    </p>
                  </div>
                  {!selesai && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Tombol
                        varian="admin-garis"
                        ukuran="kecil"
                        className="rounded-lg"
                        ikon={<Hand aria-hidden className="size-4" />}
                        memuat={
                          tandai.isPending &&
                          tandai.variables?.id_komposisi_pesanan === k.id_komposisi_pesanan &&
                          tandai.variables.jumlah === 1
                        }
                        onClick={() => tandaiCocok(k, 1)}
                      >
                        Tandai 1 cocok manual
                      </Tombol>
                      {sisa > 1 && (
                        <Tombol
                          varian="admin-garis"
                          ukuran="kecil"
                          className="rounded-lg"
                          ikon={<CheckCheck aria-hidden className="size-4" />}
                          memuat={
                            tandai.isPending &&
                            tandai.variables?.id_komposisi_pesanan === k.id_komposisi_pesanan &&
                            tandai.variables.jumlah > 1
                          }
                          onClick={() => tandaiCocok(k, sisa)}
                        >
                          Tandai semua cocok ({sisa})
                        </Tombol>
                      )}
                      <Tombol
                        varian="admin-garis"
                        ukuran="kecil"
                        className="rounded-lg"
                        ikon={<Replace aria-hidden className="size-4" />}
                        onClick={() => setPengganti(k)}
                      >
                        Ganti bunga
                      </Tombol>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Kartu>
      </div>

      <Kartu className={cn('mt-4', !data.siap_foto && 'opacity-70')}>
        <h2 className="mb-1 text-lg font-bold">Foto hasil rangkaian</h2>
        <p className="mb-3 text-sm text-ad-redup">
          {data.siap_foto
            ? 'Semua bunga sudah cocok. Foto rangkaian jadi agar warna dibaca otomatis dan dikirim ke pelanggan.'
            : 'Tersedia setelah semua bunga dipindai atau ditandai cocok.'}
        </p>
        {data.siap_foto && (
          <div className="flex flex-col gap-3 sm:max-w-md">
            <UnggahFoto gaya="admin" kamera label="Foto rangkaian jadi" berkas={fotoHasil} ubah={setFotoHasil} />
            <Tombol
              varian="admin"
              className="rounded-xl"
              disabled={!fotoHasil}
              memuat={unggahFoto.isPending}
              onClick={() =>
                fotoHasil &&
                unggahFoto.mutate(fotoHasil, {
                  onSuccess: () => {
                    tampilkanToast('Foto hasil terkirim ke pelanggan untuk disetujui.')
                    navigasi(`/admin/pesanan/${id}`)
                  },
                  onError: (e) => tampilkanToast(pesanGalat(e), 'galat'),
                })
              }
            >
              Kirim foto ke pelanggan
            </Tombol>
          </div>
        )}
      </Kartu>
      <DialogPengganti id={id} asal={pengganti} saatTutup={() => setPengganti(null)} />
    </>
  )
}
