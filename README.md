# FlowerBloom 🌸

Toko bunga daring dengan **fitur aksesibilitas warna bagi penyandang buta warna** — Capstone Project S1 Sistem Informasi UNESA
(topik *Vision Disability*).

Setiap warna bunga selalu ditampilkan dengan **nama, kode heksadesimal, dan maknanya**; informasi produk bisa **didengarkan**;
foto bunga dapat **ditajamkan sesuai jenis buta warna** (protan, deutan, tritan); dan pelanggan **menyetujui foto hasil rangkaian**
(lengkap dengan label warna yang dibaca otomatis) sebelum bunga dikirim.

[![CI](https://github.com/Risaru9/flowerbloom/actions/workflows/ci.yml/badge.svg)](https://github.com/Risaru9/flowerbloom/actions/workflows/ci.yml)
[![Keamanan](https://github.com/Risaru9/flowerbloom/actions/workflows/keamanan.yml/badge.svg)](https://github.com/Risaru9/flowerbloom/actions/workflows/keamanan.yml)
[![CD](https://github.com/Risaru9/flowerbloom/actions/workflows/cd.yml/badge.svg)](https://github.com/Risaru9/flowerbloom/actions/workflows/cd.yml)

## Isi repositori

| Folder | Isi |
|---|---|
| [`frontend/`](frontend/) | PWA React 19 + Vite + TypeScript (strict) + Tailwind CSS 4. Mobile-first, bisa dipasang di ponsel & desktop. |
| [`backend/`](backend/) | REST API FastAPI + SQLAlchemy 2 + Alembic, MySQL 8. Aturan bisnis, mesin status pesanan, AI pengenal bunga & warna. |
| [`.github/`](.github/) | CI/CD GitHub Actions, Dependabot, templat isu & PR. |
| [`docs/`](docs/) | Catatan lintas bagian (keputusan aksesibilitas). Dokumentasi backend ada di [`backend/docs/`](backend/docs/). |

```
Pelanggan / Admin ──► Nginx (web: PWA statis, header keamanan) ──/api, /media──► FastAPI (api) ──► MySQL (db)
                                                                                     └── penyimpanan berkas (volume)
```

## Fitur utama

**Pelanggan** — katalog dengan saringan momen, warna, dan harga · detail produk (komposisi, nama + kode + makna warna, deskripsi
suara, pratinjau mode warna) · **Rangkai Sendiri** dari stok hari ini dengan pratinjau visual · keranjang & checkout (ambil di toko /
diantar, alamat tersimpan, kartu ucapan, slot jam) · pembayaran transfer + unggah bukti (bisa langsung memotret) · pantau status
pesanan · setujui/minta revisi foto hasil · komplain · favorit · notifikasi · pengaturan aksesibilitas · keamanan akun.

**Admin** — dasbor & notifikasi tindakan · verifikasi pembayaran · **Mode Merangkai** (pindai bunga dengan kamera, cocokkan dengan
pesanan, catat bunga pengganti) · unggah foto hasil · stok (pindai stok masuk dengan AI, input manual, koreksi, riwayat & akurasi
pindai) · katalog produk · laporan penjualan (grafik, CSV) · pengaturan toko · kelola akun admin.

**Aksesibilitas** (WCAG 2.2 AA sebagai target) — warna tidak pernah satu-satunya penyampai informasi, kontras teks ≥ 4.5:1, navigasi
papan ketik dengan fokus terlihat, label & pesan galat terhubung ARIA, target sentuh ≥ 44 px, mode kontras tinggi, ukuran teks,
tema gelap, `prefers-reduced-motion`. Lihat [docs/aksesibilitas.md](docs/aksesibilitas.md).

**PWA** — dapat dipasang (Android, iOS, Windows/macOS), ikon & shortcut aplikasi, katalog yang pernah dibuka tetap tampil saat offline,
pemberitahuan versi baru. Data pribadi (pesanan, akun, admin) **tidak pernah** disimpan di cache service worker.

## Menjalankan

### Cara cepat: Docker Compose (semua layanan)

```bash
cp .env.example .env        # isi MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, JWT_RAHASIA dengan nilai acak
docker compose up -d --build
docker compose exec api python -m scripts.seed      # data acuan + akun admin (kata sandi dicetak sekali)
```

Buka <http://localhost:8080>. Panel admin: <http://localhost:8080/admin>.

### Pengembangan (tanpa Docker)

Prasyarat: Python ≥ 3.13, Node ≥ 22.12 (dengan `corepack`), opsional Docker untuk MySQL.

```bash
# Backend (terminal 1)
cd backend
python -m venv .venv && .venv/Scripts/python -m pip install --require-hashes -r requirements-dev.txt   # Linux/macOS: .venv/bin/python
copy .env.example .env                          # Linux/macOS: cp
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m scripts.seed --demo     # data contoh: 17 paket berfoto, stok, akun pelanggan contoh
.venv/Scripts/python -m uvicorn app.main:app --reload
```

```bash
# Frontend (terminal 2)
cd frontend
corepack enable
pnpm install
pnpm dev                                        # http://localhost:5173 (/api diteruskan ke :8000)
```

> **Data contoh** (`--demo`): nama, harga, dan foto paket diambil dari rancangan Figma tim; komposisinya disusun dari jenis bunga yang
> dikenali model. Akun pelanggan contoh: lihat `backend/scripts/seed.py`. Jangan dipakai di produksi (perintah ini menolak berjalan bila
> `LINGKUNGAN=produksi`).

## Kualitas & pengujian

| Perintah | Isi |
|---|---|
| `cd backend && python -m pytest` | 125 tes: mesin status, stok & konkurensi, alur pesanan, keamanan akun, favorit & alamat, dll. |
| `cd backend && ruff check .` | Gaya kode + aturan keamanan (bandit). |
| `cd frontend && pnpm lint && pnpm typecheck && pnpm test` | oxlint (termasuk jsx-a11y), TypeScript strict, Vitest + Testing Library. |
| `cd frontend && pnpm api:types` | Membuat ulang tipe klien dari `backend/docs/openapi.json` (kontrak API tunggal). |

## CI/CD & keamanan

| Workflow | Kapan | Isi |
|---|---|---|
| [CI](.github/workflows/ci.yml) | setiap push & PR | Ruff + tes backend (Python 3.13 & 3.14), migrasi + tes penuh di **MySQL 8.4**, cek kontrak OpenAPI, frontend (format, lint, tipe, tes + cakupan, build), build image Docker |
| [Keamanan](.github/workflows/keamanan.yml) | push, PR, mingguan | **CodeQL** (Python & TS), **gitleaks** (kebocoran rahasia), **pip-audit** & **pnpm audit**, review dependensi PR |
| [CD](.github/workflows/cd.yml) | merge ke `main`, tag `vX.Y.Z` | Image backend & frontend ke **GHCR** dengan SBOM, atestasi asal-usul build, pindai **Trivy** (gagal bila ada CVE kritis yang sudah ada perbaikannya); tag → GitHub Release |
| [Dependabot](.github/dependabot.yml) | mingguan | Pembaruan pip, npm, GitHub Actions, dan image dasar Docker |

Praktik lain: semua action dipin ke commit SHA; token CI berizin minimum; dependensi Python terkunci dengan hash; image berjalan
sebagai pengguna non-root; CSP ketat & header keamanan di Nginx; JWT dengan pencabutan sesi (ganti kata sandi / keluar dari semua
perangkat); pembatas percobaan masuk; berkas privat (bukti transfer, foto pesanan) hanya lewat tautan bertanda tangan berumur pendek;
Swagger mati di produksi. Melaporkan celah keamanan: lihat [SECURITY.md](SECURITY.md).

## Deploy

Image siap pakai diterbitkan ke `ghcr.io/risaru9/flowerbloom-backend` dan `ghcr.io/risaru9/flowerbloom-frontend` setiap merge ke
`main`. Di server (VPS/hosting dengan Docker):

```bash
git clone https://github.com/Risaru9/flowerbloom.git && cd flowerbloom
cp .env.example .env            # isi rahasia, URL_PUBLIK, dan TAG (mis. sha-1a2b3c4 atau v1.0.0)
docker compose pull && docker compose up -d
```

Pasang TLS (HTTPS) di depan port web — misalnya Caddy, Traefik, atau Nginx dengan Let's Encrypt — karena PWA dan kamera
membutuhkan HTTPS.

## Tim

Capstone Project S1 Sistem Informasi UNESA 2026 — topik *Vision Disability*. Alur kerja tim: [CONTRIBUTING.md](CONTRIBUTING.md).
