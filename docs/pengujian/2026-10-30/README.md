# Arsip bukti pengujian

Lihat [laporan utama](../../laporan-pengujian.md) untuk keputusan kesiapan, prioritas, langkah reproduksi, dan batas pengujian.

Hasil berasal dari eksekusi 26 dan 30 Oktober 2026. Semua akun, pesanan, pembayaran, stok, dan komplain pada bukti adalah fixture/data dummy dalam lingkungan terpisah.

## Membaca hasil

- `tes-mysql.log`: suite existing 132 lulus. Tidak mencakup kasus tambahan yang kemudian menemukan bug.
- `tes-frontend-coverage.log`: 38 tes existing dan cakupan; `tes-reproduksi-frontend.log`: 3 tes reproduksi tambahan.
- `probe-backend.json`: 10 kasus tambahan, termasuk hasil gagal terhadap perilaku yang diharapkan.
- `race-pindai.json` dan `race-admin.json`: dua transaksi MySQL dengan interleaving terkontrol khusus tes.
- `proxy-ip.json`: perbandingan login yang dibatasi dan percobaan dengan header IP buatan pada Nginx aktual.
- `http-performa-ipv4.json`: smoke HTTP dan pengukuran beban terbatas.
- `penjadwal-dan-status.json`: status pesanan browser dan penjadwal API produksi aktual.
- `backup-restore.json` dan `persistensi.json`: hasil perbandingan hash data/berkas, bukan sekadar proses backup selesai tanpa galat.
- `laporan-dummy.csv`: hasil ekspor melalui tombol UI, diverifikasi sesuai transaksi dummy.

Tes reproduksi yang berstatus lulus dapat berarti **bug berhasil direproduksi**, bukan sudah diperbaiki. Prioritas yang ditetapkan laporan utama merupakan penilaian dampak, bukan skor otomatis alat.

## Harness reproduksi

Folder `reproduksi/` menyimpan salinan script yang digunakan saat audit. Ini arsip, bukan suite regresi yang otomatis dijalankan CI. Tidak mengubah hasil default tes aplikasi.

Script masih merujuk direktori audit/checkout lokal saat dijalankan. Jangan menjalankannya langsung pada layanan atau database sungguhan. Untuk pengulangan:

1. Salin harness ke folder sementara khusus, periksa URL, path, dan kredensial dummy di script.
2. Gunakan server/container baru khusus uji. Script MySQL mensyaratkan `AUDIT_MYSQL_RACE_URL` ke database audit dan dapat membuat ulang tabel di database tersebut. Jangan menunjuk database kerja.
3. Untuk probe backend, gunakan interpreter `.venv` backend; script membuat database SQLite tersendiri. Untuk probe HTTP, nyalakan stack audit dengan port dan fixture yang diharapkan script.
4. Harness frontend memerlukan konfigurasi Vitest dan dependensi proyek. Konfigurasi serta cara eksekusi asal tercatat di `catatan-frontend.md`; beberapa path cache perlu disesuaikan.

Konfigurasi Compose lengkap, log build, backup SQL/media, dan alat audit sementara dipertahankan pada `C:\Users\USER\AppData\Local\Temp\flowerbloom-audit-20261026-211117`. Berkas ini tidak ikut Git. JSON pada arsip menyamarkan token JWT bila ditemukan.

Setelah pengujian, layanan project audit dihentikan tanpa menghapus volume, image, dan backup. Docker Desktop tidak dimatikan agar tidak mengganggu layanan pengguna lain.

Pada `persistensi.json`, nama dan ID kontainer dipisahkan menjadi atribut agar ID kontainer tidak terbaca sebagai kunci API oleh pemindai rahasia. Nilai ID serta hasil verifikasi tetap sama.
