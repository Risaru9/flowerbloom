# Pemetaan Fitur → Backend

Menelusuri setiap fitur pada dokumen fitur v1.0 ke endpoint/modul yang mengerjakannya. Kolom *Status*: **Selesai** = ada di backend
dan diuji; **Klien** = dikerjakan frontend, backend hanya menyediakan data; **Sebagian/Belum** = lihat catatan.
Prefiks endpoint: `/api/v1`. Kontrak lengkap: `docs/openapi.json` atau `/docs` saat server berjalan.

## Pelanggan (F-PL)

| Kode | Fitur | Endpoint / modul | Status |
|---|---|---|---|
| F-PL-01 | Daftar dan masuk | `POST /auth/daftar`, `POST /auth/masuk` | Selesai |
| F-PL-02 | Katalog paket + saring acara | `GET /produk?acara=`, `GET /produk/acara` | Selesai |
| F-PL-03 | Detail paket | `GET /produk/{id}` (komposisi, nama+kode warna, `makna_warna`, `narasi`, `dapat_dipesan`) | Selesai |
| F-PL-04 | Rangkai sendiri | `GET /rangkai/opsi`; item `rangkai_sendiri` pada `/pesanan/pratinjau` dan `/pesanan` | Selesai |
| F-PL-05 | Pratinjau rangkaian | Visual di frontend; data warna (nama+hex) dari `/rangkai/opsi` | Klien |
| F-PL-06 | Saran perpaduan warna | – | **Belum** (Sebaiknya) |
| F-PL-07 | Makna warna | `makna_warna` pada `GET /warna` dan `GET /produk/{id}` | Selesai |
| F-PL-08 | Dengarkan keterangan | Suara di frontend (Text-to-Speech); backend menyediakan `narasi` dan `deskripsi` | Klien |
| F-PL-09 | Keranjang | Disimpan di klien; `POST /pesanan/pratinjau` memvalidasi harga dan stok | Klien |
| F-PL-10 | Checkout | `POST /pesanan` | Selesai |
| F-PL-11 | Pembayaran + unggah bukti | `POST /pesanan/{id}/pembayaran` | Selesai |
| F-PL-12 | Pantau status | `GET /pesanan/{id}` (`status`, `tahap`, `riwayat`, `batas_bayar`) | Selesai |
| F-PL-13 | Persetujuan foto hasil | `POST /pesanan/{id}/persetujuan-foto` | Selesai |
| F-PL-14 | Penanda bunga pengganti | `foto[].pengganti`, `detail[].komposisi[].is_pengganti` | Selesai |
| F-PL-15 | Pembatalan | `POST /pesanan/{id}/batal` | Selesai |
| F-PL-16 | Komplain | `POST /pesanan/{id}/komplain`, `GET /komplain/saya` | Selesai |
| F-PL-17 | Riwayat pesanan | `GET /pesanan` (berhalaman, filter `status`) | Selesai |
| F-PL-18 | Pengaturan aksesibilitas | `GET/PATCH /aksesibilitas/saya` (disimpan); penerapan penajaman warna/ukuran teks/tema di frontend | Selesai + Klien |
| F-PL-19 | Profil | `GET/PATCH /auth/saya`, `PATCH /auth/kata-sandi`, `POST /auth/keluar-semua` | Selesai |
| (UI) | Produk favorit | `GET /favorit`, `PUT/DELETE /favorit/{id_produk}` | Selesai |
| (UI) | Alamat tersimpan | `GET/POST /alamat`, `PATCH/DELETE /alamat/{id_alamat}` | Selesai |

## Admin (F-AD)

| Kode | Fitur | Endpoint / modul | Status |
|---|---|---|---|
| F-AD-01 | Masuk admin | `POST /auth/masuk` (menu ditentukan `peran`); rute `/admin/*` menolak non-admin | Selesai |
| F-AD-02 | Dasbor | `GET /admin/dasbor` | Selesai |
| F-AD-03 | Notifikasi tindakan | Angka pada dasbor + `GET /admin/pesanan?perlu_tindakan=true` (frontend melakukan polling) | Selesai (polling) |
| F-AD-04 | Daftar pesanan | `GET /admin/pesanan?status=&cari=&perlu_tindakan=` | Selesai |
| F-AD-05 | Detail pesanan | `GET /admin/pesanan/{id}` | Selesai |
| F-AD-06 | Verifikasi pembayaran | `.../pembayaran/{idb}/sahkan`, `.../tolak` | Selesai |
| F-AD-07 | Mode merangkai | `GET .../merangkai`, `POST .../merangkai/pindai`, `.../tandai-cocok` | Selesai |
| F-AD-08 | Catat bunga pengganti | `POST .../merangkai/pengganti` | Selesai |
| F-AD-09 | Unggah foto hasil | `POST .../foto-hasil` | Selesai |
| F-AD-10 | Perbarui status | Otomatis mengikuti alur; manual hanya `POST .../selesai` (lihat keputusan #8) | Selesai |
| F-AD-11 | Pindai stok masuk | `POST /admin/stok/pindai`, `POST /admin/stok/simpan-pindai` | Selesai (warna otomatis, jenis dipilih admin) |
| F-AD-12 | Input stok manual | `POST /admin/stok/manual` | Selesai |
| F-AD-13 | Kelola stok | `GET /admin/stok`, `PATCH /admin/stok/{id}` | Selesai |
| F-AD-14 | Kelola katalog | `GET/POST /admin/produk`, `PATCH /admin/produk/{id}`, `PUT .../foto` | Selesai |
| F-AD-15 | Laporan | `GET /admin/laporan?dari=&sampai=` | Selesai |
| F-AD-16 | Pengaturan toko | `GET/PATCH /admin/pengaturan-toko` | Selesai |
| F-AD-17 | Kelola akun | `GET/POST /admin/pengguna`, `PATCH .../aktif` | Selesai |
| F-AD-18 | Riwayat pindai | `GET /admin/riwayat-pindai`, `.../ringkasan` | Selesai |

## AI dan pengolahan citra (F-AI)

| Kode | Fitur | Modul | Status |
|---|---|---|---|
| F-AI-01 | Pengenalan jenis bunga | `app/ai/klasifikator.py` | **Tidak dipakai** (keputusan B.19): admin memilih jenis; antarmuka disiapkan bila kelak ada model (`kontrak-model-ai.md`) |
| F-AI-02 | Ambang keyakinan | `AMBANG_KEYAKINAN` → `dikenali` | Siap, hanya berlaku bila ada klasifikator |
| F-AI-03 | Pemeriksaan admin | Pindai dan simpan dipisah dua langkah | Selesai |
| F-AI-04 | Warna dominan (k-means) | `app/ai/warna.py` | Selesai (heuristik, belum diuji foto asli) |
| F-AI-05 | Penamaan warna | Warna terdekat pada tabel `warna` (CIELAB) | Selesai |
| F-AI-06 | Bentuk bunga | `jenis_bunga.bentuk_bunga` (data draf) | Selesai |
| F-AI-07 | Deskripsi otomatis | `app/ai/deskripsi.py` (templat tetap) | Selesai |
| F-AI-08 | Warna pada foto hasil | `label_warna_rangkaian` → `foto.label_warna` | Selesai |
| F-AI-09 | Riwayat pindai | Tabel `riwayat_pindai` | Selesai |

## Aksesibilitas (F-AK) dan non-fungsional (F-NF)

| Kode | Butir | Cara dipenuhi di backend |
|---|---|---|
| F-AK-01 | Nama warna tertulis | Setiap objek warna membawa `nama_warna` + `kode_hex` |
| F-AK-02 | Status tidak hanya warna | `status.label`, `status.ikon`, `status.keterangan` |
| F-AK-03..08 | Suara, penajaman, ukuran teks, tema, papan ketik, responsif | Frontend; pengaturan pengguna disimpan (`/aksesibilitas/saya`) |
| F-AK-09 | Penggantian warna disetujui | `perlu_konfirmasi_pengganti` (AB-07) |
| F-NF-02 | Pemindaian ≤ 3 detik | Bagian warna diuji <1 detik pada gambar 12 MP; tanpa model, itulah seluruh pemindaian |
| F-NF-03 | Pemindaian tanpa internet | **Tidak berlaku** pada arsitektur web + model di server (lihat keputusan C.6) |
| F-NF-04 | Keamanan akun | bcrypt (SHA-256 pra-hash), JWT dengan versi sesi (pencabutan), pembatas percobaan masuk, pembatasan peran diuji |
| F-NF-05 | Stok akurat | `UPDATE` bersyarat atomik + CHECK constraint; uji 12 permintaan serentak |
| F-NF-06 | Bahasa Indonesia | Pesan galat dan validasi berbahasa Indonesia |
| F-NF-07 | Kerahasiaan bukti bayar | Berkas privat hanya lewat tautan bertanda tangan berumur pendek |

## Aturan bisnis (AB)

| Kode | Aturan | Ditegakkan di |
|---|---|---|
| AB-01 | Bayar penuh di muka | `mesin status`: dirangkai hanya setelah pembayaran sah |
| AB-02 | Stok ditahan; batal bila lewat batas | `services/stok.tahan`, `services/penjadwal` |
| AB-03 | Transfer + bukti, diverifikasi admin | `services/pesanan.unggah_bukti/sahkan/tolak` |
| AB-04 | Paling lambat H-1 | `services/pesanan.checkout` |
| AB-05 | Foto hasil wajib | Transisi ke persetujuan hanya lewat `unggah_foto_hasil` |
| AB-06 | Revisi pertama gratis | `jumlah_revisi`, `revisi_berbayar` (tanpa penagihan) |
| AB-07 | Warna pengganti wajib disetujui | `services/foto_konfirmasi.tanggapi_foto` |
| AB-08 | Batal hanya sebelum dirangkai | `STATUS_BISA_DIBATALKAN` |
| AB-09 | Komplain maks. 1×24 jam | `services/komplain.ajukan` |
| AB-10 | Batas waktu tanggapan foto | Hanya penanda `terlambat_ditanggapi` (menunggu keputusan) |
| AB-11 | Hasil pindai diperiksa admin | Pindai dan simpan dipisah |
