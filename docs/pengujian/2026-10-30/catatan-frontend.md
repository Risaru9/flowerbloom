# Audit frontend dan dependensi — 26 Oktober 2026

Acuan kode: checkout proyek D:\capstone. Tidak ada kode aplikasi, .env, lockfile, dist, atau source tipe API diubah oleh pemeriksaan ini.

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| pnpm lint | Lulus, exit 0 |
| pnpm typecheck | Lulus, exit 0 |
| pnpm format:check | Lulus, exit 0 |
| Vitest existing + coverage | 38 tes lulus, exit 0 |
| Vite production build + PWA ke temp | Lulus, exit 0; 86 precache entries, 1123.50 KiB |
| Regenerasi tipe OpenAPI ke temp | Lulus; hash identik dengan source schema.d.ts |
| pnpm audit --prod | 0 advisori; 28 dependensi production |
| pnpm audit seluruh dependency | 1 LOW pada transitive dev dependency |
| pip-audit runtime requirements terkunci | 0 known vulnerabilities; 35 paket runtime diaudit |
| Supplemental jsdom reproductions | 3 lulus: 2 mereproduksi bug, 1 kontrol perilaku yang benar |

Hash SHA-256 kedua berkas schema.d.ts: E382467DF467025E3B4BBAEF6D1C958DF53F6EDF673B5B8F419275D36DC4C6C0.

## Cakupan tes existing

Statements 10.65% (258/2422); branches 8.33% (158/1895); functions 8.38% (87/1038); lines 9.92% (205/2066).

Angka ini dipakai mengidentifikasi bagian yang belum diuji, bukan sebagai target. Tes existing memeriksa utilitas, state keranjang/sesi, perpaduan warna, ARIA pada komponen, grafik/tabel, dan tombol kembali. API/hooks, router/layout, halaman bisnis pelanggan/admin, dialog bisnis, serta PWA tercatat 0% cakupan. Suite existing yang lulus belum membuktikan alur bisnis browser ujung ke ujung.

## Temuan UI terverifikasi

### Persetujuan semua pengganti terhalang untuk pengganti warna sama

Trigger: kebijakan toko semua_pengganti, rangkaian memakai pengganti jenis lain dengan warna sama, pelanggan membuka foto hasil.

Frontend HalamanDetailPesanan.tsx:43 hanya menghitung penggantiBeda berdasarkan warna_berbeda. Checkbox consent di :100 tidak dirender untuk pengganti warna sama, tombol di :116 tetap aktif, dan payload :50 selalu mengirim setuju_pengganti=false. Backend foto_konfirmasi.py:83-89 mewajibkan consent pada kebijakan semua_pengganti; :102-107 menolak HTTP409 dengan kode perlu_konfirmasi_pengganti.

Tidak ada boolean wajib-persetujuan atau kebijakan pada FotoKonfirmasiOut/PesananOut maupun InfoTokoOut. perlu_konfirmasi_pengganti adalah kode galat, bukan flag respons saat ini. Akibatnya pelanggan tidak punya kontrol UI untuk menyetujui kasus tersebut. Repro jsdom menguji tombol/payload nyata; kontrol pengganti beda warna menghasilkan checkbox dan payload true.

### Preferensi aksesibilitas tidak disinkronkan kembali untuk akun yang sama

Trigger: pelanggan masuk dengan tema server gelap, keluar tanpa reload, mengubah tema lokal sebagai pengunjung ke terang, lalu masuk kembali dengan akun yang sama.

SinkronAksesibilitas.tsx:20-22 menyimpan id pengguna di sudah.current dan tidak meresetnya ketika sesi menjadi null. Login kedua dengan id sama dilewatkan meskipun data preferensi server berhasil ditarik. Repro jsdom membuktikan tema tetap terang sementara data server tetap gelap. Dampak lebih kecil daripada alur persetujuan foto.

## Audit dependency

Frontend full audit menemukan serialize-javascript 7.1.2, patch >=7.1.3, LOW GHSA-m5mm-p8h7-m29v / CVE-2026-115897. Jalur: workbox-build -> @rollup/plugin-terser -> serialize-javascript, termasuk lewat vite-plugin-pwa. Audit menandainya dev dependency.

Advisori resmi: https://github.com/advisories/GHSA-m5mm-p8h7-m29v

Eksploit memerlukan kontrol attacker terhadap source fungsi/toString yang diserialisasi lalu disematkan ke HTML. Belum ditemukan jalur runtime aplikasi yang memenuhi syarat tersebut. Ini tindak lanjut pemeliharaan dependensi build, bukan bukti XSS aplikasi. Tidak menjalankan audit-fix atau mengubah lockfile.

Backend pip-audit dijalankan melalui uvx isolated dengan cache di direktori audit; venv/requirements aplikasi tidak diubah. Input backend/requirements.txt runtime terkunci; --no-deps --disable-pip digunakan agar audit membaca paket yang sudah dipin tanpa memasang dependency aplikasi. JSON menyimpan hasil 35 paket runtime, tanpa kerentanan yang diketahui saat pemeriksaan. Hasil ini tidak mencakup seluruh dev dependency Python atau menjamin ketiadaan celah yang belum diketahui.

## Perintah dan artefak

Dari frontend:

- pnpm lint
- pnpm typecheck
- pnpm format:check
- pnpm exec vitest run --coverage --coverage.reportsDirectory=<temp>/frontend/coverage --coverage.reporter=text --coverage.reporter=json-summary --coverage.reporter=lcov
- pnpm exec vite build --outDir=<temp>/frontend/build
- pnpm exec openapi-typescript ../backend/docs/openapi.json -o <temp>/frontend/schema.d.ts
- pnpm audit --json
- pnpm audit --prod --json
- pnpm exec vitest run --config <temp>/frontend/vitest.config.mts

Dari root:

uvx --isolated --cache-dir <temp>/frontend/uv-cache --python D:\capstone\backend\.venv\Scripts\python.exe pip-audit --no-deps --disable-pip -r D:\capstone\backend\requirements.txt --format json --output <temp>/frontend/pip-audit-runtime.json

Log lengkap tersedia di direktori laporan ini. Coverage JSON/LCOV berada di coverage/. Build berada di build/. Supplemental tests disimpan di supplemental.test.tsx. Karena resolver Vitest bermasalah untuk tes eksternal lintas drive, eksekusinya memakai salinan dalam frontend/node_modules/.tmp/flowerbloom-audit-20261026-211117, direktori cache yang diabaikan Git; source aplikasi tidak diubah.

Harness supplemental menguji perilaku yang ditemukan, sehingga status lulus berarti reproduksi berhasil, bukan berarti kedua bug sudah diperbaiki. Root menjalankan pemeriksaan browser secara terpisah.
