# Keputusan aksesibilitas antarmuka

FlowerBloom ditujukan bagi pelanggan dengan defisiensi penglihatan warna (protan, deutan, tritan). Antarmuka menargetkan
**WCAG 2.2 tingkat AA**. Dokumen ini mencatat keputusan yang menyimpang dari rancangan Figma beserta alasannya.

## 1. Warna dari Figma yang digelapkan untuk teks dan tombol

Rancangan Figma memakai rose `#C97D87` untuk teks dan tombol. Kontrasnya terhadap latar krem `#FDF4EB` hanya **2,85 : 1**
(teks putih di atasnya 3,1 : 1), di bawah syarat WCAG 1.4.3 (4,5 : 1 untuk teks biasa, 3 : 1 untuk teks besar).

| Peran | Figma | Dipakai | Kontras |
|---|---|---|---|
| Teks & tombol utama | `#C97D87` | `#B44B59` | 4,72 : 1 di atas krem; putih di atasnya 5,13 : 1 |
| Teks redup | `#7B776F` | `#67635B` | ≥ 4,5 : 1 |
| Aksen admin | `#E0356F` | `#C71F58` | 5,58 : 1 di atas putih |

Warna asli Figma **tetap dipakai** untuk dekorasi, garis, dan bidang isian, sehingga nuansa merek tidak berubah.

## 2. Warna tidak pernah menjadi satu-satunya penyampai informasi (WCAG 1.4.1, F-AK-01, F-AK-02)

- Setiap warna bunga ditampilkan dengan **nama dan kode heksadesimal** (`ChipWarna`), plus maknanya bila ada.
- Status pesanan selalu berupa **ikon + label teks**, bukan hanya warna lencana.
- Penanda stok, verifikasi nominal, dan hasil pencocokan Mode Merangkai juga memakai teks.

## 3. Penajaman warna (daltonisasi) per jenis buta warna

Foto bunga (`img[data-foto-bunga]`) dapat diberi filter SVG `feColorMatrix`:

```
M = I + M_geser · (I − S)
```

- `S` adalah matriks simulasi Machado, Oliveira & Fernandes (2009) dengan keparahan 1,0.
- `M_geser` adalah pergeseran galat (error shift) dari Fidaner, Lin & Ozguven.
- Perhitungannya dilakukan di ruang linearRGB (`color-interpolation-filters="linearRGB"`).

Filter **hanya** diterapkan pada foto, bukan pada teks atau antarmuka, karena antarmuka sudah dirancang tidak bergantung pada warna.
Di halaman detail produk, pelanggan bisa membandingkan mode Normal, Protan, Deutan, dan Tritan pada satu foto.

## 4. Kontrol lain

- **Deskripsi suara**: memakai Web Speech API milik peramban. Teks tidak dikirim ke layanan pihak ketiga, dan kecepatan suara bisa diatur.
- **Ukuran teks**: 90–150%. Semua ukuran memakai `rem`, jadi tata letak ikut berskala tanpa terpotong.
- **Kontras tinggi**: teks dan garis dibuat lebih gelap atau tegas, dan tautan bergaris bawah.
- **Tema gelap**: menyimpan nilai `tema` di akun.
- **Papan ketik**: semua fungsi bisa dijangkau dengan papan ketik, ada fokus terlihat (outline 3 px), tautan "Lewati ke konten utama", dan dialog `<dialog>` modal dengan Esc.
- **Formulir**: label terhubung, galat diumumkan (`role="alert"`) dan ditautkan lewat `aria-describedby`.
- **Gerak**: `prefers-reduced-motion` mematikan animasi.
- **Target sentuh**: minimal 44 × 44 px untuk tombol utama dan navigasi bawah.
- **Grafik admin**: setiap batang bisa difokus dan memiliki label. Tersedia juga tampilan tabel. Warna grafik lolos validasi
  kontras ≥ 3 : 1 terhadap latar terang maupun gelap.

## 5. Pengaturan yang disinkronkan

| Pengaturan | Disimpan di |
|---|---|
| `jenis_buta_warna`, `penajaman_warna`, `ukuran_teks`, `kecepatan_suara`, `tema` | Akun (backend `/aksesibilitas/saya`) dan perangkat |
| `kontras_tinggi`, `suara_aktif` | Perangkat saja (belum ada kolom di backend) |
