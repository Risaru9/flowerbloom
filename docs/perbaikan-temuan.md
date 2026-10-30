# Perbaikan temuan audit FlowerBloom

Tanggal: **30 Oktober 2026**. Dasar: [laporan pengujian sebelum perbaikan](laporan-pengujian.md), temuan F-01–F-10. Perubahan berada di working tree; belum dipublikasikan ke server.

## Perubahan dan bukti

| Temuan | Perbaikan | Verifikasi |
| --- | --- | --- |
| F-01: persetujuan pengganti warna sama terhalang | API mengirim `perlu_persetujuan_pengganti` memakai aturan yang sama dengan validasi persetujuan. UI mengikuti flag tersebut; foto revisi baru mengosongkan persetujuan sebelumnya. | Tes API kebijakan pengganti; tes halaman asli untuk warna sama/berbeda, flag false, payload persetujuan, serta foto revisi. |
| F-02: pindai stok ganda | Kunci baris riwayat pindai sebelum memeriksa status dan menulis mutasi; segarkan objek ORM. | Enam transaksi MySQL serentak: satu berhasil, lima konflik; stok 20 → 27, tepat satu mutasi tujuh tangkai. |
| F-03: pemalsuan IP melewati pembatas login | Nginx mengganti `X-Forwarded-For` dengan alamat koneksi yang diterimanya. API tetap hanya di jaringan internal Compose. | Probe HTTP melalui Nginx/Uvicorn pada image hasil perbaikan; hasil dicatat di folder bukti. |
| F-04: dua admin saling menonaktifkan | Kunci seluruh akun admin dengan urutan ID tetap, baca ulang status pemanggil, lalu periksa admin aktif sebelum perubahan. | Dua transaksi MySQL bersamaan: satu berhasil, satu ditolak; satu admin tetap aktif. |
| F-05: retry checkout membuat dua pesanan | `Idempotency-Key` dibatasi per pelanggan dan dibandingkan dengan SHA-256 payload. Kunci pelanggan diserialkan; indeks unik menjadi penjaga tambahan. UI menyimpan hash/kunci retry di sessionStorage, menghapusnya setelah sukses. | Tes API retry, payload berbeda dan pemilik berbeda; enam transaksi MySQL menghasilkan satu ID pesanan dan satu penahanan stok. Tes frontend mencakup retry/reload/perubahan payload/sukses. |
| F-06: dana parsial luput saat pembatalan | Admin dapat menandai `dana_diterima` saat menolak bukti setelah memeriksa rekening. Pembatalan maupun penjadwal memakai catatan tersebut untuk menandai refund. Pengesahan pembayaran otomatis mencatat dana diterima. | Tes API penolakan dengan/tanpa dana, pembatalan dan penanda refund; tes UI meneruskan kedua keputusan admin. |
| F-07: JWT placeholder produksi | Tolak placeholder berawalan `ganti-`, rahasia bawaan, terlalu pendek, dan karakter tunggal berulang. | Tes konfigurasi negatif dan startup Docker dengan rahasia dummy khusus audit. Validasi ini bukan pengukur entropi; operator tetap harus membuat rahasia acak. |
| F-08: sandi MySQL merusak URL | Compose mengirim komponen `MYSQL_*`; aplikasi menyusun URL melalui `sqlalchemy.URL.create`, termasuk encoding sandi. `DATABASE_URL` tetap didukung untuk dev/integrasi. | Roundtrip sandi `abc@123:/?#%`; container API aktual berhasil terhubung ke MySQL dengan sandi audit berisi `@:/?#%`. |
| F-09: preferensi akun tidak disinkronkan saat login ulang | Reset penanda sinkronisasi ketika sesi kosong. | Tes komponen: login tema gelap → logout → tema tamu terang → login akun sama → kembali gelap. |
| F-10: identitas warna riwayat berubah | Nama/kode hex warna yang sudah digunakan stok atau komposisi katalog tidak dapat diubah; API mengembalikan 409 dan menyarankan warna baru. Makna warna masih dapat diperbarui. | Tes API mengubah identitas warna terpakai ditolak dan warna pesanan lama tetap; perubahan makna diterima. |

Sumber tes: [`test_regresi_audit.py`](../backend/tests/test_regresi_audit.py), [`test_konkurensi.py`](../backend/tests/test_konkurensi.py), [`regresi-audit.test.tsx`](../frontend/src/fitur/pesanan/regresi-audit.test.tsx), dan [`kunci-checkout.test.ts`](../frontend/src/lib/kunci-checkout.test.ts).

## Verifikasi akhir

- Backend MySQL 8.4: **144 lulus, tanpa skip**. [Log](pengujian/2026-10-30/perbaikan/tes-mysql.log).
- Tes cepat SQLite: **139 lulus, 5 skip**. Lima tes memerlukan penguncian baris MySQL dan sudah dijalankan pada suite MySQL di atas. [Log](pengujian/2026-10-30/perbaikan/tes-sqlite.log).
- Migrasi MySQL `0003`: upgrade, downgrade `0002`, upgrade ulang, `alembic check`, dan backfill tiga status pembayaran lama lulus. Hanya status `sah` otomatis menjadi dana diterima; seluruh pembayaran lama tetap ada. [Log](pengujian/2026-10-30/perbaikan/migrasi-mysql.log), [harness audit](pengujian/2026-10-30/perbaikan/verifikasi_migrasi.py).
- Migrasi SQLite juga lulus dengan data pembayaran lama, rollback/upgrade, dan `foreign_key_check`. Migrasi memakai DDL native dan indeks unik agar tabel parent tidak dibangun ulang dan memicu penghapusan cascade. [Log](pengujian/2026-10-30/perbaikan/migrasi-sqlite.log).
- Frontend: **47 tes lulus** di tujuh file. [Log](pengujian/2026-10-30/perbaikan/tes-frontend.log).
- Ruff backend, oxlint frontend, TypeScript, Prettier, dan `git diff --check` lulus. OpenAPI sama dengan aplikasi; tipe frontend identik dengan hasil regenerasi kontrak.
- Dockerfile produksi backend dan frontend berhasil dibangun penuh. Ketiga layanan healthy; startup API menjalankan migrasi ke `0003`. [Build final](pengujian/2026-10-30/perbaikan/docker-final.log), [startup](pengujian/2026-10-30/perbaikan/docker-start.log).
- Probe Nginx → Uvicorn: lima login salah mendapat 401, berikutnya 429; **ketujuh request dengan IP palsu tetap 429**. [Hasil](pengujian/2026-10-30/perbaikan/proxy-ip.json).
- Konfigurasi `MYSQL_*` dengan sandi karakter khusus berhasil dipakai oleh API container untuk koneksi nyata; head database `0003`. [Hasil tanpa sandi](pengujian/2026-10-30/perbaikan/konfigurasi-runtime.json).
- Smoke HTTP image final: frontend, katalog, login admin, pembacaan pesanan lama selesai dengan dua foto, kontrak foto baru, dan backfill pembayaran sah lulus. [Hasil](pengujian/2026-10-30/perbaikan/http.json).

Database pengujian, volume media, dan kredensial audit terpisah dari data kerja. `.env` asli tidak diubah. Bukti audit lama dipertahankan sebagai catatan sebelum perbaikan.

## Penerapan dan konsekuensi operasional

1. Backup database dan media sebelum memperbarui server. Build/pilih image yang memuat perubahan ini; image `latest` yang sudah terbit sebelumnya belum tentu memuatnya.
2. Terapkan migrasi **`0003`** sebelum melayani API baru. Entrypoint Docker menjalankan `alembic upgrade head` secara otomatis. Untuk instalasi non-Docker, jalankan `python -m alembic upgrade head` di direktori backend dengan konfigurasi database yang benar.
3. Gunakan frontend dan backend versi yang sama karena kontrak foto, pembayaran, dan checkout berubah. OpenAPI dan tipe TypeScript sudah diregenerasi.
4. Admin harus memeriksa rekening sebelum mencentang dana diterima. Bukti ditolak historis tidak otomatis dianggap dana masuk; telaah manual kasus lama yang benar-benar menerima dana parsial, terutama pesanan yang sudah dibatalkan. Refund tetap dilaksanakan manual di luar aplikasi.
5. API eksternal yang ingin retry aman harus mengirim `Idempotency-Key` yang sama untuk satu upaya checkout. Tanpa header, kontrak lama tetap berlaku: setiap request membuat pesanan baru. Payload berbeda dengan kunci sama mendapat 409; setelah checkout berhasil, pembelian baru memakai kunci baru.
6. Untuk mengganti identitas warna yang sudah dipakai, buat referensi baru dan gunakan untuk stok/katalog berikutnya. Kebijakan ini menjaga referensi riwayat tanpa migrasi snapshot seluruh pesanan.
7. Publikasikan hanya web/proxy; jangan membuka port API atau MySQL ke internet. Nginx menganggap alamat koneksi sebagai IP pemanggil. Jika menambah proxy HTTPS/CDN di depannya, konfigurasi real-IP hanya untuk proxy tepercaya dan uji ulang pembatas login. Tanpa itu, beberapa pengguna dapat berbagi batas IP proxy.

Rollback skema membuang kunci checkout dan penanda dana baru. Untuk pemulihan operasional utamakan backup yang sesuai versi; pengujian downgrade hanya dilakukan di database audit.

## Batas kesimpulan

Perbaikan ini menangani temuan yang direproduksi pada audit. Kelulusan tes tidak menjamin semua skenario atau konfigurasi hosting benar. HTTPS/domain tujuan, backup terjadwal di luar server, perangkat fisik/kamera, UAT toko, dan perilaku PWA penuh tetap perlu diverifikasi pada lingkungan tujuan sebagaimana batas laporan audit.

Observasi non-bug pada laporan awal tidak diubah menjadi aturan baru: slot lintas tengah malam masih membutuhkan keputusan bisnis. Advisori LOW dependency build yang dicatat pada audit awal tidak diperbarui dalam perbaikan F-01–F-10 ini.
