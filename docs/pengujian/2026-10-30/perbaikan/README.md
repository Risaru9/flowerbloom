# Bukti verifikasi setelah perbaikan

Ringkasan dan konsekuensi penerapan ada di [perbaikan temuan](../../../perbaikan-temuan.md).

- `tes-mysql.log`: 144 tes, tanpa skip, database audit MySQL terpisah.
- `tes-sqlite.log`: 139 lulus, 5 skip khusus penguncian MySQL.
- `tes-frontend.log`: 47 tes pada utilitas, komponen, dan regresi bisnis.
- `migrasi-mysql.log` / `migrasi-sqlite.log`: upgrade, data lama/backfill, rollback, upgrade ulang, pemeriksaan skema.
- `docker-build.log`: build penuh pertama, termasuk unduhan dependency yang sempat terputus lalu berhasil dilanjutkan.
- `docker-final.log`: build Dockerfile produksi dengan source final setelah semua perbaikan.
- `docker-start.log`, `konfigurasi-runtime.json`, `http.json`: stack final healthy, koneksi sandi karakter khusus, dan smoke HTTP.
- `proxy-ip.json` / `proxy-ip.log`: hasil uji pemalsuan header pada stack final.
- `docker-runtime-audit.log` dan `docker-web-final.log`: verifikasi antara menggunakan image audit sebelumnya/source baru ketika menunggu unduhan build penuh. Kesimpulan akhir memakai image dari `docker-final.log`.

Script `verifikasi_*.py` adalah harness audit untuk lingkungan lokal dummy, bukan perintah deployment. Script migrasi **menurunkan skema dan menulis data dummy**; wajib diarahkan ke database audit berakhiran `_uji`, tidak boleh ke data kerja. Script HTTP/proxy hanya menuju `127.0.0.1:18080`; akun yang tertulis merupakan akun dummy audit. `verifikasi_koneksi.py` dijalankan lewat stdin pada container API audit dengan konfigurasi `MYSQL_*` khusus pengujian.

Stack audit dihentikan setelah pemeriksaan. Volume audit dipertahankan; `.env` dan database kerja asli tidak diubah.

Saat diarsipkan ke Git, akhir baris log dinormalisasi ke LF dan spasi terminal di ujung baris dibuang; hasil, angka, dan pesan pengujian dipertahankan.
