# FlowerBloom Backend

REST API untuk FlowerBloom: toko bunga dengan aksesibilitas warna bagi pelanggan buta warna
(Capstone Project, S1 Sistem Informasi UNESA). FastAPI + SQLAlchemy 2 + Alembic, MySQL 8 (SQLite untuk pengembangan cepat).

| Baca ini | Untuk |
|---|---|
| [docs/alur-kerja.md](docs/alur-kerja.md) | **Alur kerja**: diagram status, tabel transisi, siklus stok, alur pindai/merangkai/foto |
| [docs/pemetaan-fitur.md](docs/pemetaan-fitur.md) | Setiap fitur F-xx dan aturan AB-xx → endpoint dan modul |
| [docs/keputusan-desain.md](docs/keputusan-desain.md) | Perubahan skema vs proposal, asumsi, pertanyaan untuk tim, batasan |
| [docs/kontrak-model-ai.md](docs/kontrak-model-ai.md) | Yang dibutuhkan dari model AI agar bisa dipasang |
| [docs/openapi.json](docs/openapi.json) | Kontrak API untuk frontend (atau `/docs` saat server berjalan) |

## Menjalankan (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements-dev.txt   # versi terkunci (lihat requirements.in)
copy .env.example .env                                   # lalu sesuaikan (JWT_RAHASIA, dsb.)

.\.venv\Scripts\python.exe -m alembic upgrade head       # buat tabel
.\.venv\Scripts\python.exe -m scripts.seed --demo        # 22 warna, 102 jenis bunga, admin, dan data contoh
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Buka <http://127.0.0.1:8000/docs> (Swagger). Klik *Authorize* dan tempel token dari `POST /api/v1/auth/masuk`.
`seed` mencetak kata sandi admin **sekali** bila `ADMIN_PASSWORD` tidak diisi. Akun contoh (hanya `--demo`, dilarang di produksi):
`pelanggan@example.com`.

### MySQL (yang dipakai sungguhan)

```powershell
docker compose up -d db                                  # Docker Desktop harus berjalan
# di .env: DATABASE_URL=mysql+pymysql://flowerbloom:flowerbloom-dev@127.0.0.1:3306/flowerbloom?charset=utf8mb4
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.seed --demo
```

> **Terverifikasi di MySQL 8.4 (2026-10-02):** migrasi `0001` naik bersih, `alembic check` tanpa penyimpangan, seluruh suite
> lulus (114 tes), dan uji asap `uvicorn` → MySQL lulus. Pengujian di MySQL menemukan satu deadlock nyata pada checkout serentak
> yang sudah diperbaiki (lihat [keputusan-desain.md](docs/keputusan-desain.md), bagian D).

## Pengujian

Jalur cepat memakai SQLite di memori:

```powershell
.\.venv\Scripts\python.exe -m pytest              # 125 lulus + 2 dilewati (bergantung pada kunci baris MySQL)
```

Jalur penuh di MySQL (membuktikan kunci baris, isolasi transaksi, dan konkurensi sungguhan). `docker compose up -d db` sudah
menyediakan basis data khusus uji `flowerbloom_uji`; namanya **wajib berakhiran `_uji`** karena isinya dikosongkan setiap tes
(tes menolak berjalan bila tidak).

```powershell
$env:UJI_DATABASE_URL = "mysql+pymysql://flowerbloom:flowerbloom-dev@127.0.0.1:3306/flowerbloom_uji?charset=utf8mb4"
.\.venv\Scripts\python.exe -m pytest              # 127 lulus; ±2 menit
```

Yang diuji: mesin status (setiap transisi sah dan terlarang), siklus stok dan uji rebutan serentak, alur lengkap
checkout→selesai (ambil di toko dan antar), pembayaran ditolak/diulang, pembatalan, kedaluwarsa, Mode Merangkai (cocok, salah warna,
tidak dikenali, manual), bunga pengganti dan persetujuan, revisi, komplain, otorisasi antarpelanggan dan antarperan, validasi
unggahan, modul warna, data seed, konfigurasi, dan konkurensi (checkout serentak, "sahkan" ganda, batal vs sahkan).

## Struktur

```
app/
  main.py            aplikasi, CORS, penjadwal, pemasangan router
  config.py          konfigurasi dari .env
  database.py        engine, sesi, Base
  dependencies.py    pengguna saat ini, pembatasan peran
  models/            tabel (satu berkas per kelompok)
  schemas/           bentuk permintaan/respons (Pydantic)
  services/          ATURAN BISNIS (tanpa FastAPI, tanpa commit)
    alur_pesanan.py  mesin status: satu-satunya pengubah status
    stok.py          penahanan stok atomik + buku mutasi
    pesanan.py       hitung, checkout, bayar, batal, kedaluwarsa
    merangkai.py     Mode Merangkai + bunga pengganti
    foto_konfirmasi.py  foto hasil, persetujuan, revisi
  routers/           lapisan HTTP tipis: validasi → layanan → commit → skema
  ai/                klasifikator (tiruan/model), warna k-means, deskripsi (tanpa DB)
  core/              galat, keamanan, penyimpanan berkas, tipe kolom, waktu
  data/              seed: 102 jenis bunga, daftar warna (DRAF)
migrations/          Alembic
scripts/             seed, ekspor OpenAPI
tests/
```

**Aturan berkode:** router hanya memanggil layanan lalu `db.commit()`; layanan tidak commit (satu permintaan = satu transaksi,
galat = batal seluruhnya); status pesanan hanya diubah lewat `alur_pesanan.pindah_status`; stok hanya lewat `services/stok.py`.

## Alur pengembangan

1. Cabang per fitur dari `main` (`fitur/nama-singkat`); satu PR = satu perubahan yang utuh.
2. Ubah model → `alembic revision --autogenerate -m "pesan"` → **baca hasilnya** → `alembic upgrade head`. Jangan mengedit migrasi yang sudah dipakai orang lain.
3. Aturan bisnis baru → tulis tesnya lebih dulu di `tests/` (contoh pola: `tests/skenario.py`).
4. Sebelum PR: `pytest` hijau; bila API berubah jalankan `python -m scripts.ekspor_openapi` agar frontend melihat kontrak terbaru; perbarui `docs/alur-kerja.md` bila alur berubah.
5. Perubahan skema dikabarkan ke pemegang ERD (lihat bagian A `keputusan-desain.md`).

## Konfigurasi penting

Lihat `.env.example`. Yang paling sering dipakai: `DATABASE_URL`, `JWT_RAHASIA` (wajib ≥ 32 karakter di produksi),
`CORS_ORIGINS` (alamat frontend), `AI_MODE` (`tiruan` sampai model terpasang), `AI_TIRUAN_KELAS=74` (paksa AI tiruan selalu
menjawab mawar agar frontend mudah diuji). Aturan toko (batas bayar, ongkos, slot, revisi gratis, kebijakan pengganti, dsb.)
diubah admin lewat `PATCH /api/v1/admin/pengaturan-toko`, bukan lewat `.env`.
