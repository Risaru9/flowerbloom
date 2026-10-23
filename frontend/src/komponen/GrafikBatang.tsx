import { useId, useState } from 'react'

import { cn } from '@/lib/cn'

export interface TitikBatang {
  label: string
  /** Label lengkap untuk tooltip, pembaca layar, dan tabel (mis. tanggal panjang). */
  labelPanjang: string
  nilai: number
}

/**
 * Grafik batang satu seri: batang tipis bersudut atas 4px dari garis dasar, celah antarbatang, kisi samar,
 * label langsung hanya pada nilai tertinggi, tooltip saat disorot/difokus, dan tampilan tabel sebagai alternatif.
 * Satu seri tidak memakai legenda; judul bagian yang menamai serinya.
 */
export function GrafikBatang({
  data,
  format = (n) => String(n),
  tinggi = 220,
  namaNilai,
}: {
  data: TitikBatang[]
  format?: (n: number) => string
  tinggi?: number
  namaNilai: string
}) {
  const [aktif, setAktif] = useState<number | null>(null)
  const [tabel, setTabel] = useState(false)
  const idTabel = useId()
  const maks = Math.max(1, ...data.map((d) => d.nilai))
  const langkah = Math.max(1, skalaRapi(maks)) // data kita bilangan bulat (jumlah pesanan, rupiah)
  const atas = langkah * Math.ceil(maks / langkah)
  const kisi = Array.from({ length: Math.round(atas / langkah) + 1 }, (_, i) => i * langkah)
  const W = 640
  const kiri = 56
  const bawah = 28
  const H = tinggi
  const lebarArea = W - kiri - 8
  const lebarSlot = lebarArea / Math.max(1, data.length)
  const lebarBatang = Math.min(40, Math.max(6, lebarSlot - 6))
  const y = (n: number) => H - bawah - ((H - bawah - 12) * n) / atas
  const iMaks = data.reduce((im, d, i) => (d.nilai > (data[im]?.nilai ?? -1) ? i : im), 0)

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setTabel((t) => !t)}
          aria-expanded={tabel}
          aria-controls={idTabel}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-ad-aksen underline-offset-2 hover:underline"
        >
          {tabel ? 'Tampilkan grafik' : 'Lihat sebagai tabel'}
        </button>
      </div>
      {tabel ? (
        <table id={idTabel} className="w-full text-sm">
          <thead>
            <tr className="border-b border-ad-garis text-start text-ad-redup">
              <th scope="col" className="py-2 text-start font-semibold">
                Periode
              </th>
              <th scope="col" className="py-2 text-end font-semibold">
                {namaNilai}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.labelPanjang} className="border-b border-ad-garis/60">
                <th scope="row" className="py-2 text-start font-normal">
                  {d.labelPanjang}
                </th>
                <td className="py-2 text-end tabular-nums">{format(d.nilai)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={`Grafik batang ${namaNilai}`}>
            {kisi.map((n) => (
              <g key={n}>
                <line x1={kiri} x2={W - 4} y1={y(n)} y2={y(n)} className="stroke-ad-garis" strokeWidth={n === 0 ? 1.5 : 1} />
                <text x={kiri - 8} y={y(n) + 4} textAnchor="end" className="fill-ad-redup text-[11px] tabular-nums">
                  {format(n)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = kiri + i * lebarSlot + (lebarSlot - lebarBatang) / 2
              const yy = y(d.nilai)
              const h = Math.max(0, H - bawah - yy)
              const r = Math.min(4, h / 2, lebarBatang / 2)
              return (
                <g
                  key={d.labelPanjang}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.labelPanjang}: ${format(d.nilai)}`}
                  onMouseEnter={() => setAktif(i)}
                  onMouseLeave={() => setAktif(null)}
                  onFocus={() => setAktif(i)}
                  onBlur={() => setAktif(null)}
                  className="outline-none"
                >
                  {/* area sentuh lebih besar dari batang */}
                  <rect x={kiri + i * lebarSlot} y={8} width={lebarSlot} height={H - bawah - 8} fill="transparent" />
                  {h > 0 && (
                    <path
                      d={`M${x},${H - bawah} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + lebarBatang - r} Q${x + lebarBatang},${yy} ${x + lebarBatang},${yy + r} V${H - bawah} Z`}
                      className={cn('fill-ad-grafik transition-opacity', aktif !== null && aktif !== i && 'opacity-45')}
                    />
                  )}
                  {aktif === i && <rect x={x - 2} y={yy - 2} width={lebarBatang + 4} height={h + 4} rx={6} fill="none" className="stroke-ad-teks" strokeWidth={1.5} />}
                  {i === iMaks && d.nilai > 0 && aktif === null && (
                    <text x={x + lebarBatang / 2} y={yy - 6} textAnchor="middle" className="fill-ad-teks text-[11px] font-semibold tabular-nums">
                      {format(d.nilai)}
                    </text>
                  )}
                  <text x={kiri + i * lebarSlot + lebarSlot / 2} y={H - 8} textAnchor="middle" className="fill-ad-redup text-[11px]">
                    {d.label}
                  </text>
                </g>
              )
            })}
          </svg>
          {aktif !== null && data[aktif] && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 rounded-xl border border-ad-garis bg-ad-permukaan px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((kiri + aktif * lebarSlot + lebarSlot / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
            >
              <p className="text-ad-redup">{data[aktif].labelPanjang}</p>
              <p className="font-bold text-ad-teks tabular-nums">
                {namaNilai}: {format(data[aktif].nilai)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Langkah sumbu yang "rapi" (1, 2, 5 × 10^n) agar kisi tidak lebih dari ±5 garis. */
function skalaRapi(maks: number): number {
  const kasar = maks / 4
  const pangkat = 10 ** Math.floor(Math.log10(kasar))
  const n = kasar / pangkat
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pangkat
}
