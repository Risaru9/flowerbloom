import { ArrowRight, Contrast, Eye, Flower2, Palette, ScanLine, Volume2 } from 'lucide-react'
import { useState } from 'react'

import { useInfoToko, useWarna } from '@/api/pelanggan'
import floristBerdua from '@/assets/gambar/florist-berdua.webp'
import floristMerangkai from '@/assets/gambar/florist-merangkai.webp'
import ladang from '@/assets/gambar/ladang-bunga.webp'
import tokoLorong from '@/assets/gambar/toko-lorong.webp'
import { useJudul } from '@/komponen/ui/Lain'
import { TautanTombol } from '@/komponen/ui/Tombol'
import { cn } from '@/lib/cn'
import { formatRupiah } from '@/lib/format'

const NILAI = {
  Visi: 'Menjadi layanan rangkaian bunga yang inklusif dan tepercaya: membantu setiap orang menyampaikan perasaan melalui bunga, dengan pengalaman memilih warna yang mudah, informatif, dan nyaman bagi semua pengguna.',
  Misi: 'Menyajikan setiap warna dengan nama, kode, dan maknanya; menyediakan deskripsi suara dan tampilan yang menyesuaikan jenis buta warna; serta mengirimkan foto hasil rangkaian sebelum bunga diserahkan.',
  Tujuan:
    'Membuat penyandang buta warna dapat memilih dan memastikan warna bunga pesanannya secara mandiri, tanpa harus bertanya kepada orang lain.',
} as const

export function HalamanTentang() {
  useJudul('Tentang Kami')
  const [nilai, setNilai] = useState<keyof typeof NILAI>('Visi')
  const warna = useWarna()
  const info = useInfoToko()

  const FAKTA = [
    { Ikon: Palette, angka: warna.data ? String(warna.data.length) : '—', label: 'Nama warna dengan kode & makna' },
    { Ikon: Eye, angka: '4', label: 'Mode tampilan warna' },
    { Ikon: ScanLine, angka: 'AI', label: 'Pengenalan jenis & warna bunga' },
    { Ikon: Flower2, angka: info.data ? `H-${info.data.minimal_hari_pemesanan}` : 'H-1', label: 'Pesan paling lambat' },
  ]

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img src={floristBerdua} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-olive-tua/45 to-rose-tua/70" />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-white md:py-28">
          <h1 className="font-display text-4xl md:text-6xl">Tentang Kami</h1>
          <p className="mx-auto mt-3 max-w-xl text-white/95">Toko bunga yang dirancang agar warna dapat dipahami oleh semua orang.</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-12 md:px-6">
        <section className="grid items-center gap-8 md:grid-cols-2">
          <div className="relative">
            <img
              src={floristMerangkai}
              alt="Florist FlowerBloom merangkai buket mawar"
              loading="lazy"
              className="w-4/5 rounded-[2rem] object-cover"
            />
            <img
              src={tokoLorong}
              alt="Lorong toko FlowerBloom dengan rak bunga segar"
              loading="lazy"
              className="absolute end-0 -bottom-6 w-1/2 rounded-[1.6rem] border-4 border-latar object-cover shadow-xl"
            />
            <span className="absolute start-4 top-4 rounded-2xl bg-rose-teks px-4 py-2 font-display text-sm text-white shadow">
              Cerita kami
            </span>
          </div>
          <div className="pt-6 md:pt-0">
            <h2 className="font-display text-4xl text-olive-tua">Bunga untuk Setiap Cerita</h2>
            <p className="mt-4 text-olive">
              FlowerBloom hadir untuk membantu setiap orang menyampaikan perasaan melalui rangkaian bunga yang indah, bermakna, dan mudah
              dipahami, termasuk oleh penyandang buta warna.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {['Bunga segar pilihan', 'Ramah bagi semua pengguna', 'Informasi warna lengkap', 'Dirangkai floris ahli'].map((t) => (
                <li key={t} className="rounded-full bg-rose-teks px-4 py-1.5 text-sm text-white">
                  {t}
                </li>
              ))}
            </ul>
            <TautanTombol to="/katalog" varian="garis" className="mt-6" ikon={<ArrowRight aria-hidden className="order-last size-4" />}>
              Lihat koleksi
            </TautanTombol>
          </div>
        </section>

        <section aria-label="Fakta FlowerBloom">
          <ul className="grid grid-cols-2 gap-3 rounded-[2rem] bg-peach p-4 md:grid-cols-4 md:p-6">
            {FAKTA.map(({ Ikon, angka, label }) => (
              <li key={label} className="flex items-center gap-3 rounded-2xl bg-latar/60 p-3">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-latar text-rose-teks">
                  <Ikon className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-2xl text-olive-tua">{angka}</span>
                  <span className="block text-xs text-olive">{label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-widest text-redup uppercase">Tentang FlowerBloom</p>
            <h2 className="font-display text-4xl text-rose-teks">Tumbuh Bersama</h2>
            <p className="font-display text-xl text-rose-teks italic">Setiap cerita dan warna</p>
            <div role="tablist" aria-label="Nilai FlowerBloom" className="mt-5 flex flex-wrap gap-2">
              {(Object.keys(NILAI) as (keyof typeof NILAI)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={nilai === k}
                  onClick={() => setNilai(k)}
                  className={cn(
                    'min-h-11 rounded-full border-2 px-5 font-display',
                    nilai === k ? 'border-rose-teks bg-rose-teks text-white' : 'border-rose-teks text-rose-teks hover:bg-blush',
                  )}
                >
                  {k} kami
                </button>
              ))}
            </div>
            <div role="tabpanel" className="mt-4 rounded-3xl bg-blush p-5">
              <h3 className="font-display text-xl text-rose-tua italic">{nilai} FlowerBloom</h3>
              <p className="mt-2 text-olive">{NILAI[nilai]}</p>
            </div>
          </div>
          <div id="cara-pesan" className="scroll-mt-28 rounded-3xl bg-permukaan p-6 ring-1 ring-garis/60">
            <h2 className="font-display text-3xl text-olive-tua">Cara Pemesanan</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {[
                ['Pilih rangkaian', 'Dari katalog, atau rangkai sendiri bunga dan warnanya.'],
                [
                  'Atur pengiriman',
                  `Pilih tanggal dan slot jam. Ambil di toko atau diantar${info.data ? ` (ongkos ${formatRupiah(info.data.ongkos_antar)})` : ''}.`,
                ],
                [
                  'Bayar & unggah bukti',
                  `Transfer${info.data ? ` dalam ${info.data.batas_bayar_menit} menit` : ''}, lalu unggah bukti agar diverifikasi admin.`,
                ],
                ['Setujui foto hasil', 'Kami mengirim foto rangkaian beserta label warnanya. Setujui atau minta revisi.'],
              ].map(([judul, ket], i) => (
                <li key={judul} className="flex gap-3">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-teks font-bold text-white">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-olive-tua">{judul}</span>
                    <span className="text-sm text-redup">{ket}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative isolate grid gap-6 overflow-hidden rounded-[2rem] p-6 md:grid-cols-2 md:p-12">
          <img src={ladang} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover opacity-50" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-latar/70" />
          <ul className="flex flex-col gap-3">
            {[
              [Contrast, 'Tampilan adaptif', 'Mode Protan, Deutan, dan Tritan menajamkan perbedaan warna pada foto.'],
              [Palette, 'Informasi warna', 'Setiap bunga dilengkapi nama, kode, dan makna warna.'],
              [Volume2, 'Deskripsi suara', 'Informasi bunga dapat didengarkan dengan satu ketukan.'],
            ].map(([Ikon, judul, ket]) => {
              const I = Ikon as typeof Contrast
              return (
                <li key={judul as string} className="flex gap-3 rounded-3xl bg-peach/90 p-4">
                  <I aria-hidden className="mt-0.5 size-5 shrink-0 text-rose-tua" />
                  <span>
                    <span className="block font-display font-bold text-olive-tua">{judul as string}</span>
                    <span className="text-sm text-olive">{ket as string}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-widest text-olive uppercase">Komitmen aksesibilitas</p>
            <h2 className="font-display text-4xl text-olive-tua md:text-5xl">Bunga yang Ramah untuk Semua</h2>
            <p className="mt-3 text-olive">
              Informasi disajikan secara jelas agar pengalaman berbelanja terasa mudah dan nyaman, tanpa hanya mengandalkan warna. Antarmuka
              mengikuti pedoman WCAG 2.2.
            </p>
          </div>
        </section>

        <section id="pertanyaan" aria-labelledby="judul-faq" className="scroll-mt-28">
          <h2 id="judul-faq" className="mb-5 font-display text-3xl text-olive-tua">
            Pertanyaan Umum
          </h2>
          <div className="flex flex-col gap-3">
            {[
              [
                'Bagaimana saya tahu warna bunga yang saya terima sesuai?',
                'Sebelum dikirim, kami mengunggah foto hasil rangkaian. Sistem membaca warna dominannya dan menampilkan nama serta persentasenya. Anda bisa menyetujui atau meminta revisi.',
              ],
              [
                'Apa yang terjadi bila bunga pilihan saya habis?',
                'Florist dapat mengganti dengan bunga setara. Penggantian warna yang berbeda selalu meminta persetujuan Anda terlebih dahulu.',
              ],
              [
                'Kapan paling lambat saya memesan?',
                `Pemesanan paling lambat ${info.data?.minimal_hari_pemesanan ?? 1} hari sebelum tanggal kirim.`,
              ],
              [
                'Bisakah aplikasi ini dipasang di ponsel?',
                'Bisa. Di Android/Chrome pilih "Pasang aplikasi"; di iPhone buka menu Bagikan lalu "Tambahkan ke Layar Utama".',
              ],
              [
                'Bagaimana bila pesanan bermasalah?',
                'Anda dapat mengajukan komplain dari halaman detail pesanan paling lambat 1×24 jam setelah pesanan diterima.',
              ],
            ].map(([t, j]) => (
              <details key={t} className="group rounded-2xl bg-permukaan p-4 ring-1 ring-garis/60 open:bg-blush/50">
                <summary className="cursor-pointer list-none font-semibold text-olive-tua marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {t}
                    <span aria-hidden className="text-xl text-rose-teks transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-olive">{j}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
