/**
 * Filter SVG "penajaman warna" (daltonisasi) untuk foto bunga. Matriks = I + M_geser · (I − S), dengan S matriks
 * simulasi Machado dkk. (2009) keparahan 1,0 dan M_geser pergeseran galat Fidaner dkk. Dihitung di ruang linearRGB.
 * Dipakai lewat CSS `filter: url(#fb-penajaman-…)` pada img[data-foto-bunga].
 */
const MATRIKS = {
  protan: '1 0 0 0 0 0.4789 0.4769 0.0442 0 0 0.5973 -0.6887 1.0914 0 0 0 0 0 1 0',
  deutan: '1 0 0 0 0 0.1628 0.7250 0.1122 0 0 0.4547 -0.6454 1.1907 0 0 0 0 0 1 0',
  tritan: '0.7412 -0.4072 0.6660 0 0 0.0751 0.5852 0.3397 0 0 0 0 1 0 0 0 0 0 1 0',
} as const

export function FilterPenajaman() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {Object.entries(MATRIKS).map(([jenis, nilai]) => (
          <filter key={jenis} id={`fb-penajaman-${jenis}`} colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values={nilai} />
          </filter>
        ))}
      </defs>
    </svg>
  )
}
