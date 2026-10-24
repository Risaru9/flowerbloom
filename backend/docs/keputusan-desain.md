# Keputusan Desain dan Pertanyaan Terbuka

Dokumen fitur dan proposal memberi kerangka yang baik, tetapi ada celah dan beberapa pertentangan kecil yang harus ditutup
agar backend bisa dibangun. Bagian A dan B mencatat apa yang **sudah diputuskan di kode** (dengan alasannya) supaya tim dapat
menyetujui atau menolaknya; bagian C daftar keputusan yang **memang milik tim**; bagian D batasan yang jujur.

## A. Perubahan skema terhadap proposal (bahan ERD final)

Proposal: 13 tabel. Implementasi: **19 tabel**. Semua nama tabel/kolom proposal dipertahankan; yang berubah hanya berikut.

| Tabel | Perubahan | Alasan |
|---|---|---|
| `pengguna` | + `aktif`, `dibuat_pada` | Menonaktifkan akun admin (F-AD-17) |
| `stok` | `UNIQUE(id_jenis_bunga, id_warna)`; CHECK `jumlah_tersedia >= 0`, `jumlah_ditahan >= 0`; `tanggal_masuk` = saat stok terakhir dicatat | Satu baris per pasangan (sesuai relasi "satu stok dari beberapa pindai"); pagar terakhir dari kelebihan jual |
| `riwayat_pindai` | `id_stok` boleh kosong; + `konteks` (stok_masuk / mode_rangkai), `id_pesanan`, `dikenali`, `id_jenis_bunga_prediksi`, `id_warna_prediksi`, `id_jenis_bunga_final`, `id_warna_final` | Pindai di Mode Merangkai tidak menghasilkan stok; evaluasi akurasi (F-AD-18) butuh nilai prediksi **dan** nilai akhir |
| `pesanan` | `status` + nilai `dibatalkan`; + `batas_bayar`, `alasan_batal`, `perlu_pengembalian_dana`, `dibuat_pada`, `diselesaikan_pada` | AB-02 (kedaluwarsa), F-PL-15 (batal), AB-09 (batas komplain dihitung dari diterima) |
| `komposisi_pesanan` | Diisi **saat checkout**; + `jumlah_terpindai`, `ditandai_manual`, `id_komposisi_diganti` | Baris ini sekaligus catatan tangkai yang ditahan; Mode Merangkai butuh penghitung; bunga pengganti perlu menunjuk baris asal |
| `pembayaran` | + `catatan_penolakan`, `diunggah_pada` | Pelanggan perlu tahu alasan bukti ditolak |
| `foto_konfirmasi` | + `ditanggapi_pada`, `ringkasan_pengganti`; `label_warna` tetap bertipe TEXT tetapi berisi JSON | Bukti utuh bila data berubah kemudian |
| **`pengaturan_toko`** (baru) | kunci–nilai | F-AD-16 tidak punya tempat penyimpanan di ERD |
| **`komplain`** (baru) | | F-PL-16, AB-09 |
| **`mutasi_stok`** (baru) | buku mutasi | Angka "jumlah masuk" F-AD-13 tidak tersimpan di mana pun; audit stok |
| **`riwayat_status_pesanan`** (baru) | jejak transisi | Garis waktu F-PL-12; bukti bila sengketa |
| **`favorit`** (baru, migrasi 0002) | `UNIQUE(id_pengguna, id_produk)` | Halaman Produk Favorit pada rancangan UI |
| **`alamat`** (baru, migrasi 0002) | label, penerima, no HP, alamat, catatan, `utama` | Halaman Alamat Tersimpan; satu alamat utama per pelanggan, maks. 10 |
| `pengguna` (migrasi 0002) | + `versi_sesi` | Ganti kata sandi / "keluar dari semua perangkat" mencabut semua token lama (klaim `ver` pada JWT) |

Tidak ada tabel keranjang dan notifikasi: keranjang disimpan di klien (server memvalidasi lewat `POST /pesanan/pratinjau`),
notifikasi diturunkan dari status (`perlu_tindakan_*`, angka pada dasbor).

## B. Keputusan yang sudah diambil (asumsi)

| # | Keputusan | Alasan | Bila tim memilih lain |
|---|---|---|---|
| 1 | Stok = `tersedia` (sudah net) + `ditahan`; tahanan menjadi terpakai saat **pembayaran sah** | Sesuai teks kolom di proposal ("ditahan pesanan belum dibayar"); cukup dua kolom | Menunda pengurangan sampai foto diunggah butuh kolom tambahan |
| 2 | Harga per tangkai melekat pada stok (satu harga per jenis+warna); pindai/manual berikutnya **menimpa** harga | Sederhana; sesuai skema | Harga per lot membutuhkan tabel lot |
| 3 | Batas bayar bawaan **120 menit**, dapat diubah admin. Bukti ditolak → batas diperbarui | Proposal tidak menyebut angka | Cukup ubah pengaturan |
| 4 | Pesanan `menunggu_verifikasi` **tidak** kedaluwarsa | Kelambatan admin tidak boleh membatalkan pesanan yang sudah dibayar | — |
| 5 | Pelanggan dapat membatalkan di `menunggu_pembayaran` dan `menunggu_verifikasi`; yang kedua ditandai **perlu pengembalian dana** (manual) | AB-08 + tidak ada keadaan "sudah bayar, belum dirangkai" pada 7 status | Perlu status/kebijakan pengembalian dana |
| 6 | Revisi boleh berkali-kali; melebihi jatah gratis hanya menandai `revisi_berbayar`, tanpa tagihan | Membatasi revisi merugikan tujuan utama (pelanggan memastikan warna) | Perlu mekanisme biaya tambahan |
| 7 | AB-10: hanya menandai `terlambat_ditanggapi` untuk admin; tidak ada tindakan otomatis | Nilai dan akibatnya belum diputuskan | Penjadwal dapat menambah setuju otomatis/batal |
| 8 | F-AD-10 "mulai dirangkai" tidak berupa tombol: status berubah **otomatis** saat pembayaran disahkan; `siap_diambil`/`diantar` otomatis saat pelanggan setuju; admin hanya menandai `selesai` | Diagram aktivitas (Gambar 4.4) demikian | Tambah endpoint manual bila ingin |
| 9 | Kebijakan pengganti bawaan `hanya_warna_berbeda` (AB-07) | "Warna pengganti wajib disetujui" | Ganti ke `semua_pengganti` di pengaturan |
| 10 | Bunga pengganti tidak mengubah total harga dan tidak mengembalikan stok bunga asal | Pelanggan membeli rangkaian, bukan tangkai satuan; bunga asal habis/rusak | Perlu aturan selisih harga |
| 11 | Pencocokan Mode Merangkai: jenis persis, warna toleransi CIELAB ≤ 20 | Hasil k-means dibulatkan ke nama, mudah meleset satu nama | Ubah `AMBANG_KECOCOKAN_WARNA` |
| 12 | Komplain diizinkan sejak pesanan `siap_diambil`/`diantar` | "Setelah diterima" tidak selalu bertepatan dengan admin menandai selesai | Batasi ke `selesai` |
| 13 | Jasa merangkai Rp10.000, ongkos antar Rp15.000, minimal 5 tangkai, slot 4 × 2 jam, stok menipis ≤ 10 | **Angka sementara** agar sistem berjalan | Ubah lewat `PATCH /admin/pengaturan-toko` |
| 14 | Uang: `DECIMAL(10,2)` di basis data, angka JSON di API; harga pesanan dibekukan di `detail_pesanan.subtotal` | Perubahan harga stok/paket tidak memengaruhi pesanan lama | — |
| 15 | Waktu disimpan UTC; "hari" bisnis (H-1, laporan harian) memakai WIB | | — |
| 16 | JWT akses 8 jam tanpa refresh token; akun dinonaktifkan langsung berhenti berlaku | Sederhana untuk skala capstone | Tambah refresh token |
| 17 | Kode pesanan `FB-YYMMDD-XXXX` (tanpa 0/O/1/I) | Mudah dieja lewat telepon | — |
| 18 | Penamaan Indonesia untuk tabel, kolom, dan endpoint | Satu lawan satu dengan dokumen (permintaan Anda) | — |

## C. Pertanyaan terbuka untuk tim

1. **AB-10.** Bila pelanggan tidak menanggapi foto dalam N jam: setuju otomatis, dibatalkan, atau hanya pengingat? Berapa N?
2. **Revisi berbayar.** Berapa biayanya dan kapan ditagih?
3. **Pembatalan/pengembalian dana** setelah pembayaran sah, dan siapa yang mencairkan pengembalian dana.
4. **Bunga pengganti berharga berbeda**: harga pesanan disesuaikan atau tetap?
5. **Kapasitas slot.** Berapa pesanan per slot jam? Saat ini slot tidak dibatasi.
6. **F-NF-03 (pemindaian tanpa internet)** bertentangan dengan proposal (web, model di server): dicoret dari dokumen fitur?
7. **Jadwal.** Proposal (sudah disahkan): 16 minggu, 4 sprint. Dokumen fitur Tabel 6: 6 bulan, 12 sprint. Backend mengikuti proposal.
8. **Data acuan.** Daftar warna (22 nama) dan makna, nama Indonesia dan bentuk 102 jenis bunga masih **draf** (`app/data/`); siapa yang meninjau?
9. **Cakupan 102 kelas.** Apakah bunga yang dijual toko semuanya ada di dataset? Bila tidak, input manual menjadi jalur utama.
10. **Pernyataan proposal.** "Warna dominan dihitung untuk kelopak" – metode pemisahan kelopak di kode adalah heuristik (potong tengah, buang latar polos dan daun); perlu ditala dengan foto asli.

## D. Batasan yang diketahui / belum dikerjakan

* **MySQL: terverifikasi 2026-10-02 (MySQL 8.4.11, InnoDB, REPEATABLE-READ).** Migrasi `0001` naik bersih dan `alembic check`
  tanpa penyimpangan; ENUM asli dan CHECK constraint aktif; seluruh suite (114 tes) lulus; tes konkurensi diulang 15 kali tanpa
  satu pun gagal; uji asap `uvicorn` → MySQL lulus. Yang ditemukan dan sudah diperbaiki:
  * **Deadlock 1213 pada checkout serentak** (5 dari 8 permintaan gagal). Penyebab: menyisipkan `komposisi_pesanan` lebih dulu
    membuat InnoDB mengambil kunci *shared* pada baris `stok` (cek foreign key), lalu `UPDATE stok` menaikkannya ke *exclusive*;
    dua transaksi yang sama-sama memegang shared saling menunggu. Perbaikan: `UPDATE stok` (kunci exclusive) dijalankan **sebelum**
    menyisipkan baris yang mereferensikan stok. SQLite tidak bisa memperlihatkan bug ini.
  * Pelanggaran CHECK di MySQL dilaporkan sebagai `OperationalError 3819`, bukan `IntegrityError`; handler galat hanya memetakan
    `IntegrityError` ke 409. Itu disengaja: CHECK yang terlanggar berarti bug logika dan sepantasnya 500.
  * SQLite mengabaikan `SELECT ... FOR UPDATE`, sehingga dua permintaan serentak pada pesanan yang sama tidak diserialkan
    (yang kalah menerima 500 dari jaring pengaman stok, bukan 409; stok tetap benar). Dua tes yang bergantung pada ini dilewati
    di SQLite dan lulus di MySQL. **Gunakan MySQL, bukan SQLite, untuk apa pun yang menyerupai produksi.**
* **Model AI asli belum terpasang**; `AI_MODE=tiruan` mengembalikan jenis bunga acak-deterministik (warna tetap sungguhan).
* **Sudah ditambahkan (2026-10-23):** pembatas percobaan masuk (per email+IP dan per IP, di memori proses: pindahkan ke
  Redis bila memakai banyak worker), ganti kata sandi, keluar dari semua perangkat, Swagger mati di produksi.
* **Belum ada:** pembatas laju pindai, kunci idempotensi checkout (klik ganda membuat dua pesanan), notifikasi email/push
  (frontend perlu polling), saran perpaduan warna F-PL-06, pembersihan berkas lama.
* **Metode warna belum diuji dengan foto asli toko.** Uji otomatis memakai gambar sintetis.
