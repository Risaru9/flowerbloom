# FlowerBloom — Frontend (PWA)

React 19 + Vite 8 + TypeScript (strict) + Tailwind CSS 4, React Router, TanStack Query, klien API bertipe dari OpenAPI backend.

```bash
corepack enable
pnpm install
pnpm dev            # http://localhost:5173 — /api & /media diteruskan ke backend :8000 (ubah lewat VITE_BACKEND_URL)
```

| Perintah                            | Fungsi                                                            |
| ----------------------------------- | ----------------------------------------------------------------- |
| `pnpm build` / `pnpm preview`       | Build produksi (+ service worker) dan menjalankannya secara lokal |
| `pnpm lint`                         | oxlint (react, react-hooks, jsx-a11y, import, unicorn)            |
| `pnpm typecheck`                    | TypeScript strict                                                 |
| `pnpm test` / `pnpm test:coverage`  | Vitest + Testing Library (jsdom)                                  |
| `pnpm format` / `pnpm format:check` | Prettier (+ urutan kelas Tailwind)                                |
| `pnpm api:types`                    | Membuat `src/api/schema.d.ts` dari `../backend/docs/openapi.json` |
| `pnpm ikon`                         | Membuat ulang ikon PWA dari `public/ikon-aplikasi.svg`            |

## Struktur

```
src/
  app/            router (code splitting per halaman), provider, halaman galat
  api/            klien openapi-fetch bertipe + hook React Query (pelanggan, admin)
  auth/           sesi (token di session/localStorage), penjaga rute
  aksesibilitas/  pengaturan, dialog, filter penajaman warna, suara (Web Speech API)
  pwa/            ajakan pasang (termasuk panduan iOS), pembaruan versi, status offline
  komponen/       UI dasar (Tombol, Bidang, Dialog, Toast, ChipWarna, GrafikBatang, ...)
  tata-letak/     pelanggan (navigasi bawah di ponsel), akun, admin (laci di ponsel), auth
  fitur/          halaman per domain: katalog, rangkai, keranjang, pesanan, akun, admin/*
  styles/         token desain (warna merek + varian lolos kontras WCAG), mode gelap & kontras tinggi
```

Keputusan aksesibilitas dan perbedaan dengan Figma: [../docs/aksesibilitas.md](../docs/aksesibilitas.md).
