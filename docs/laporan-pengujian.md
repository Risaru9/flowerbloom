# Laporan pengujian FlowerBloom

Periode eksekusi: **26 dan 30 Oktober 2026 (WIB)**. Acuan kode: `4585051`.
Laporan diselesaikan 30 Oktober 2026. Kode aplikasi tidak diperbaiki dalam pekerjaan ini; hasil berikut menggambarkan implementasi sebelum perbaikan.

**Tindak lanjut 30 Oktober 2026:** perbaikan kode F-01–F-10 dan hasil tes regresi dicatat terpisah di [perbaikan temuan](perbaikan-temuan.md). Temuan serta bukti di bawah dipertahankan sebagai kondisi sebelum perbaikan.

## Kesimpulan

**Layak untuk staging dan demonstrasi terkontrol. Belum saya rekomendasikan untuk transaksi publik sebelum temuan prioritas tinggi diperbaiki.**

Build produksi, migrasi, suite MySQL, alur utama browser, penjadwal, backup/restore, dan persistensi berhasil diuji. Namun kasus tambahan membuktikan kesalahan yang belum ditangkap suite existing: stok pindai ganda, pembatas login yang dapat dilewati lewat header, dan persetujuan foto yang terhalang pada salah satu kebijakan toko. Kelulusan suite existing tidak berarti seluruh fitur bebas masalah.

## 1. Lingkungan dan isolasi

- Docker Engine 29.9.2; MySQL 8.4.13. API image produksi memakai Python 3.13; runner Pytest lokal memakai Python 3.14.
- Project Compose khusus: `flowerbloom-audit-20261026`; HTTP hanya di `127.0.0.1:18080`, MySQL di `127.0.0.1:13316`.
- Database browser, suite Pytest, migrasi, dan reproduksi konkurensi dipisahkan. Seluruhnya database audit dengan akhiran `_uji`.
- API browser tetap memakai `LINGKUNGAN=produksi`, `AI_MODE=nonaktif`; hanya perintah seed demo diberi override pengembangan.
- Akun, alamat, rekening, pembayaran, dan komplain merupakan data dummy. Tidak dilakukan transfer uang atau pengiriman pesan ke WhatsApp.
- `.env` asli, database kerja pengguna, dan kode aplikasi tidak diubah. Perubahan repositori berupa dokumentasi serta arsip bukti/reproduksi.
- Docker memiliki 16 CPU dan RAM sekitar 3,68 GiB. Angka performa lokal tidak boleh dianggap jaminan kapasitas VPS 2 CPU.

## 2. Hasil pemeriksaan otomatis dan infrastruktur

| Pemeriksaan | Hasil | Bukti |
| --- | --- | --- |
| Suite backend MySQL | **132 lulus, tanpa skip**, 132,78 detik | [Log](pengujian/2026-10-30/tes-mysql.log) |
| Migrasi MySQL | Upgrade → check → downgrade base → upgrade → check lulus; head `0002` | [Log migrasi](pengujian/2026-10-30/migrasi.log) |
| Ruff backend | Lulus; diperiksa kembali 30 Oktober | `ruff check --no-cache backend` |
| Frontend existing | **38 tes lulus**, lint, TypeScript, format lulus | [Catatan frontend](pengujian/2026-10-30/catatan-frontend.md) |
| Build frontend/PWA | Lulus, 86 entri precache | Catatan frontend |
| Build Docker aktual | Dockerfile backend dan frontend berhasil dibangun; ketiga layanan healthy | Log lengkap lokal pada folder audit infra |
| Tipe API frontend | Hasil regenerasi ke temp identik dengan source | [Bukti kontrak](pengujian/2026-10-30/kontrak-tipe.log) |
| Reproduksi frontend tambahan | 3 tes berjalan: dua mereproduksi masalah, satu kontrol yang benar | [Log](pengujian/2026-10-30/tes-reproduksi-frontend.log) |
| Probe backend tambahan | 10 skenario API terisolasi dan 2 reproduksi konkurensi MySQL | [Hasil API](pengujian/2026-10-30/probe-backend.json), [catatan metode](pengujian/2026-10-30/catatan-probe-backend.md) |
| Dependency runtime backend | 35 paket terkunci, 0 kerentanan yang diketahui pada audit 26 Oktober | [JSON](pengujian/2026-10-30/audit-python-runtime.json) |
| Dependency frontend produksi | 0 advisori pada audit 26 Oktober | Catatan frontend |
| Seluruh dependency frontend | 1 advisori LOW pada dependency build; bukan bukti eksploit aplikasi | [JSON](pengujian/2026-10-30/audit-node.json) |

Coverage frontend existing: **9,92% baris**, 10,65% statements, 8,33% branches. Angka ini mengungkap keterbatasan cakupan: tes existing berfokus pada utilitas/state/komponen, sementara halaman bisnis, API, routing, dan PWA belum tercakup secara menyeluruh. Tidak dilakukan penambahan tes trivial untuk mengejar persentase.

## 3. Pengujian browser yang benar-benar dilakukan

Browser menggunakan frontend hasil build Docker dan backend/MySQL produksi lokal, bukan mock API.

| Jalur | Observasi aktual |
| --- | --- |
| Katalog dan detail | 17 produk dimuat; pencarian “Pesona” menyisakan satu hasil; nama/kode/makna warna serta komposisi terlihat. Radio Protan dapat dipilih. |
| Keranjang dan autentikasi | Barang masuk keranjang; checkout tamu diarahkan ke masuk dengan tujuan kembali; formulir masuk kosong memberi galat; pendaftaran dummy berhasil kembali ke checkout. |
| Checkout pengantaran | Alamat kosong ditolak dan difokuskan. Paket Rp145.000 + ongkos Rp15.000 menghasilkan tagihan Rp160.000; kartu ucapan dan alamat tersimpan di pesanan. |
| Unggahan pembayaran | Berkas 9 MB ditolak antarmuka. Berkas bukan gambar tidak membuat pembayaran masuk antrean; penggantian dengan gambar valid berhasil. |
| Penolakan/unggah ulang | Admin menolak bukti dengan alasan; pelanggan melihat alasan dan jendela bayar baru; unggah ulang diterima. |
| Pengesahan | Admin mengesahkan bukti; status menjadi sedang dirangkai; tombol pembatalan pelanggan hilang. |
| Mode Merangkai | Merah cocok dengan dua jenis sehingga aplikasi meminta pilihan jenis. Memilih Mawar dan memindai fixture merah menaikkan progres menjadi 9/14. |
| Pengganti dan manual | Satu Mawar merah diganti Anyelir merah; pengganti tercatat. Jalur manual menyelesaikan sisa Anyelir hingga 14/14. |
| Syarat foto | Kontrol unggah foto hasil baru tersedia setelah semua tangkai cocok; unggah memindahkan status ke menunggu persetujuan. |
| Kasus persetujuan gagal | Kebijakan `semua_pengganti`, pengganti warna sama: tidak ada checkbox; klik setuju menghasilkan pesan wajib konfirmasi dan status tetap menunggu. Lihat F-01. |
| Revisi dan penyelesaian | Pelanggan mengirim revisi; admin melihat catatannya dan mengunggah foto kedua. Sebagai kontrol, kebijakan dikembalikan ke bawaan `hanya_warna_berbeda`; persetujuan kemudian berhasil → diantar → admin selesai. **Ini bukan bukti kasus F-01 sudah diperbaiki.** |
| Komplain | Komplain tanpa foto diterima; admin mengirim tanggapan berstatus selesai; pelanggan melihat tanggapan dan status selesai. |
| Rangkai Sendiri | 5 Mawar putih × Rp8.500 + jasa Rp10.000 = Rp52.500; saran warna netral, pratinjau, keranjang, dan pratinjau server tersedia. |
| Ambil di toko/batal | Checkout Rangkai Sendiri tanpa ongkos berhasil. Pembatalan sebelum bayar berhasil; stok putih kembali 50 tersedia/0 ditahan, diverifikasi API. |
| Laporan | Total Rp160.000, 1 pesanan dibayar, 1 revisi, 1 komplain sesuai transaksi; grafik dapat dialihkan ke tabel; CSV berhasil diunduh dan diperiksa isinya. [CSV dummy](pengujian/2026-10-30/laporan-dummy.csv). |
| Responsif admin | Pada override viewport 390×844, lebar konten admin terukur 375 CSS px (gutter scrollbar); laci menu dapat dibuka dan digunakan. Ini bukan uji perangkat fisik. |

Sumber verifikasi status akhir browser: [hasil API lanjutan](pengujian/2026-10-30/penjadwal-dan-status.json). Pesanan pertama selesai, memiliki 1 revisi dan 2 foto; pesanan kedua dibatalkan.

Percobaan favorit sudah menekan tombol simpan, tetapi pembuktian daftar favorit dan uji alamat lewat browser belum selesai karena kontrol browser berulang kali gagal. Kegagalan alat ini tidak dikategorikan sebagai bug aplikasi. Pengujian API favorit/alamat termasuk dalam suite existing, tetapi tidak menggantikan verifikasi UI.

## 4. Temuan yang memerlukan perbaikan

Prioritas **P1**: selesaikan sebelum menerima transaksi publik. **P2**: risiko bersyarat/operasional yang perlu diperbaiki atau disepakati penanganannya. Belum ada perbaikan diterapkan.

### F-01 — P1: persetujuan foto terhalang untuk pengganti dengan warna sama

Pemicu: pilih kebijakan `semua_pengganti`, ganti jenis bunga dengan jenis lain berwarna sama, unggah foto hasil, lalu pelanggan memilih setuju.

Aktual: UI tidak merender checkbox, tetapi backend mewajibkan `setuju_pengganti=true`. Permintaan berakhir HTTP409 `perlu_konfirmasi_pengganti`; pelanggan tidak memiliki kontrol untuk menyelesaikannya. Terbukti melalui API, tes komponen, dan browser.

Sumber: [HalamanDetailPesanan.tsx](../frontend/src/fitur/pesanan/HalamanDetailPesanan.tsx), khususnya `penggantiBeda` dan checkbox; [foto_konfirmasi.py](../backend/app/services/foto_konfirmasi.py), aturan `semua_pengganti`.

Arah perbaikan: backend mengirim informasi wajib persetujuan yang mengikuti kebijakan, dan frontend menampilkan kontrol berdasarkan informasi tersebut. Uji pengganti warna sama maupun berbeda pada kedua kebijakan.

### F-02 — P1: satu hasil pindai menambah stok dua kali saat disimpan bersamaan

Pemicu: dua request menyimpan `id_pindai` yang sama, masing-masing 7 tangkai. Aktual MySQL: keduanya HTTP201; stok **20 → 34**, seharusnya 27; satu riwayat pindai menghasilkan dua mutasi masuk.

Pengecekan `id_stok is not None` pada [pindai.py](../backend/app/services/pindai.py) tidak mengunci/mengeklaim riwayat secara atomik sebelum menambah stok. Dampaknya stok fiktif dapat dijual.

[Bukti](pengujian/2026-10-30/race-pindai.json). Reproduksi menggunakan barrier khusus tes setelah dua transaksi membaca riwayat, agar urutan bermasalah dapat diulang; barrier tidak mengganti keputusan bisnis atau hasil pembacaan.

Arah perbaikan: kunci atau klaim atomik riwayat sebelum mutasi, pertahankan urutan penguncian yang konsisten, dan pastikan hanya satu mutasi berhasil.

### F-03 — P1: header IP buatan melewati pembatas percobaan masuk

Pada stack Nginx → Uvicorn aktual, lima percobaan gagal biasa diikuti HTTP429. Mengirim header `X-Forwarded-For` dengan alamat berbeda mengembalikan HTTP401 lagi untuk tujuh percobaan berikutnya, melewati pembatas yang sudah aktif.

Penyebab gabungan: [Nginx](../frontend/docker/nginx.conf.template) menambahkan rantai yang disuplai klien melalui `$proxy_add_x_forwarded_for`, sedangkan [Dockerfile backend](../backend/Dockerfile) memakai `FORWARDED_ALLOW_IPS=*`. Router login menggunakan IP hasil parsing tersebut sebagai kunci pembatas.

[Bukti HTTP](pengujian/2026-10-30/proxy-ip.json). Pengujian memakai akun tidak terdaftar dan alamat dokumentasi, hanya pada server lokal.

Arah perbaikan: tetapkan batas kepercayaan proxy; sanitasi header dari klien dan percayai hanya proxy yang diketahui. Uji ulang melalui susunan proxy hosting sebenarnya, termasuk CDN bila digunakan.

### F-04 — P2: dua admin saling menonaktifkan hingga tidak ada admin aktif

Dua admin aktif menonaktifkan satu sama lain bersamaan. Keduanya HTTP200, jumlah admin aktif menjadi **0**, dan kedua token mendapat HTTP401. Cek jumlah admin pada [akun.py](../backend/app/services/akun.py) tidak dilindungi dari operasi serentak.

[Bukti](pengujian/2026-10-30/race-admin.json). Barrier tes ditempatkan setelah kedua request membaca jumlah admin. Dampak: akses operasional terhenti hingga pemulihan seed/DB. Perlu serialisasi transaksi dan pengecekan ulang sebelum commit.

### F-05 — P2: pengiriman ulang checkout menggandakan pesanan

Payload dan header `Idempotency-Key` sama dikirim dua kali menghasilkan HTTP201/201, dua ID pesanan, dan penahanan stok dua kali. Tombol UI sudah dinonaktifkan saat pending; celah terjadi pada pengiriman ulang setelah respons hilang/gangguan jaringan. POST saat ini belum menawarkan kontrak idempotensi.

Sumber: [pesanan.py router](../backend/app/routers/pesanan.py) dan [layanan checkout](../backend/app/services/pesanan.py). [Bukti](pengujian/2026-10-30/probe-backend.json), kasus `checkout_same_request_retry`.

### F-06 — P2 bersyarat: dana parsial tidak masuk penanda refund setelah bukti ditolak

Bukti Rp100.000 dari tagihan Rp150.000 ditolak karena nominal kurang, lalu pelanggan membatalkan. Flag pengembalian dana tetap false, diverifikasi di respons admin dan DB. Bila dana parsial benar-benar masuk, kewajiban pengembalian tidak ditandai otomatis.

Ini bukan bukti transfer bank benar-benar terjadi: aplikasi hanya menyimpan bukti dan keputusan admin. Perlu membedakan bukti palsu/tidak ada dana dari dana parsial yang sudah diterima; jangan menganggap semua bukti ditolak harus otomatis direfund. Bukti: `rejected_partial_payment_then_cancel` pada JSON probe backend.

### F-07 — P1 bersyarat konfigurasi: rahasia contoh diterima di produksi

Konfigurasi produksi menerima JWT placeholder persis dari `.env.example`; Compose juga menerima contoh tersebut. Validator [config.py](../backend/app/config.py) hanya menolak default internal tertentu atau panjang kurang dari 32 karakter. Jika operator memakai placeholder, rahasia penandatanganan menjadi diketahui publik.

[Bukti konfigurasi](pengujian/2026-10-30/konfigurasi-placeholder.json). Secret audit berbeda dari contoh tersebut. Arah perbaikan: tolak placeholder yang dikenal dan verifikasi konfigurasi deployment; validasi panjang saja bukan bukti kekuatan rahasia.

### F-08 — P2 konfigurasi: karakter `@` pada sandi MySQL dapat menggagalkan koneksi

[docker-compose.yml](../docker-compose.yml) merangkai `MYSQL_PASSWORD` langsung ke `DATABASE_URL`. Dummy `abc@123` diparse menjadi sandi `abc` dan host `123@db`. Gunakan encoding URL yang benar atau susun objek URL secara aman. Token URL-safe yang dianjurkan contoh menghindari kasus ini, tetapi tidak memperbaiki perangkaian untuk semua input.

### F-09 — P2: preferensi aksesibilitas tidak disinkronkan lagi saat masuk akun sama

Masuk dengan tema akun gelap → keluar tanpa reload → ubah tema lokal sebagai tamu → masuk lagi akun sama. Ref `sudah.current` pada [SinkronAksesibilitas.tsx](../frontend/src/aksesibilitas/SinkronAksesibilitas.tsx) tidak direset ketika sesi kosong, sehingga sinkronisasi kedua dilewati. Direproduksi dengan komponen sebenarnya; perlu reset penanda saat logout dan uji masuk ulang.

### F-10 — P2 bersyarat: perubahan master warna mengubah informasi pesanan lama

Mengedit referensi Merah tua menjadi nama/hex Biru laut turut mengubah warna komposisi pesanan yang sudah dibuat. Jumlah dan ID stok tetap, tetapi informasi warna diturunkan dari master terbaru. Untuk produk yang berfokus pada persetujuan warna, tim perlu memutuskan snapshot identitas warna atau melarang perubahan substansial referensi yang sudah digunakan.

Ini membutuhkan tindakan admin pada endpoint referensi dan tidak dipicu checkout biasa. Harga/subtotal serta jumlah komposisi lama tetap benar saat katalog berubah, sebagaimana probe kontrol.

## 5. Observasi yang bukan bug terkonfirmasi

- Slot `17:00-09:00` diterima oleh pengaturan dan checkout. Validasi hanya memeriksa format. Perlu keputusan apakah slot lintas tengah malam memang didukung sebelum menyebutnya kesalahan.
- Signed URL gambar tetap berlaku sampai kedaluwarsa setelah logout semua perangkat. Ini sesuai desain tautan bearer sementara; tidak diklaim sebagai bypass otorisasi akun.
- Analisis warna foto contoh rangkaian juga menghasilkan warna pembungkus/latar. Tanpa label ground truth foto toko, ini belum dapat dinyatakan sebagai angka akurasi atau salah klasifikasi terukur.
- Satu advisori LOW: `serialize-javascript@7.1.2` melalui dependency build Workbox/terser, perbaikan `>=7.1.3`; tidak ditemukan jalur eksploit runtime aplikasi. [Advisori resmi](https://github.com/advisories/GHSA-m5mm-p8h7-m29v). Hasil audit berlaku saat pemeriksaan, bukan jaminan bebas kerentanan.

## 6. Performa, penjadwal, dan pemulihan

| Pengukuran | Hasil |
| --- | --- |
| 50 pembacaan publik, konkurensi 5 | 50 HTTP200; median 0,0474 detik; p95 0,5517 detik; maksimum 0,5788 detik. |
| Pindai foto 1 MP, 3 sampel | Median 0,0922 detik; maksimum 0,301 detik. |
| Pindai foto 12 MP, 3 sampel | Median 1,323 detik; maksimum 2,1352 detik. |
| Penjadwal API produksi | Deadline satu pesanan dummy baru diatur ke masa lalu di DB audit; proses latar aktual membatalkannya dalam polling 9,19 detik dan mengembalikan stok. |
| Backup/restore | Dump dan media dipulihkan ke DB/volume baru; seluruh hash isi 20 tabel (19 tabel aplikasi + `alembic_version`), 297 baris, 35 berkas identik. |
| Recreate container | Ketiga ID container berubah; seluruh hash database/media tetap identik; `/sehat`, katalog, dan warna kembali HTTP200. |

[Performa HTTP](pengujian/2026-10-30/http-performa-ipv4.json), [penjadwal](pengujian/2026-10-30/penjadwal-dan-status.json), [backup](pengujian/2026-10-30/backup-restore.json), [persistensi](pengujian/2026-10-30/persistensi.json).

Angka performa memakai `127.0.0.1`, termasuk Nginx/API/DB lokal. Pengukuran awal melalui hostname `localhost` memiliki overhead koneksi sekitar dua detik bahkan untuk berkas statis; tidak digunakan untuk menyimpulkan kelambatan aplikasi. Foto 12 MP merupakan pembesaran gambar contoh, untuk pengujian beban pemrosesan, bukan validasi akurasi. Beban terbatas ini tidak menentukan jumlah pengguna maksimum atau SLA hosting.

Backup ini membuktikan prosedur pemulihan lokal bekerja. Belum ada jadwal backup, penyimpanan di luar server, atau pemulihan bencana hosting publik yang dikonfigurasi.

## 7. Batas dan langkah sesudah laporan

Belum dinyatakan lulus: HTTPS/domain hosting nyata, perangkat Android/iOS fisik, pengambilan kamera langsung, keluaran suara yang benar-benar terdengar, pemasangan/offline/pembaruan PWA secara penuh, audit WCAG menyeluruh, akurasi foto toko berlabel, dan kapasitas di VPS tujuan.

Pemeriksaan UI tambahan terhenti karena kontrol browser beberapa kali tidak tersedia meskipun halaman/API tetap hidup. Percobaan pemulihan sesi berhasil sementara lalu masalah alat berulang. Favorit, alamat, seluruh formulir admin, serta responsivitas pelanggan di ukuran ponsel belum diverifikasi lengkap lewat browser; jangan menyamakan cakupan API dengan cakupan UI tersebut.

Urutan tindak lanjut: perbaiki F-01/F-02/F-03 dan pastikan secret produksi aman, tambahkan regresi yang membuktikan kasus gagal sekarang ditolak/ditangani benar, lalu lanjutkan UAT di hosting tujuan. Tinjau F-04–F-10 sesuai kebijakan operasional. **Tidak ada perbaikan yang dianggap selesai hanya karena temuan sudah didokumentasikan.**

## 8. Bukti dan reproduksi

[Folder bukti](pengujian/2026-10-30/) memuat JSON hasil, log, CSV dummy, dan salinan harness reproduksi. [Petunjuk arsip](pengujian/2026-10-30/README.md) menjelaskan batas penggunaan script.

Log build Docker, salinan database/media untuk pemulihan, dan konfigurasi dummy lengkap tetap berada di folder lokal `C:\Users\USER\AppData\Local\Temp\flowerbloom-audit-20261026-211117`. Dump data, foto, kredensial konfigurasi, dan cache dependency tidak disalin ke Git.
