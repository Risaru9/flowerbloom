# Probe tambahan backend — 26 Oktober 2026

Script `run_probes.py` menjalankan 10 skenario tambahan melalui TestClient/API sebenarnya dengan SQLite dan gambar/media sementara. Tidak mengubah kode aplikasi, `.env`, atau database pengguna. CWD dipindahkan ke folder probe sebelum modul konfigurasi diimpor. `DATABASE_URL` dan `DIREKTORI_BERKAS` diarahkan secara eksplisit ke folder ini.

Jalankan kembali dari PowerShell:

```powershell
& 'D:\capstone\backend\.venv\Scripts\python.exe' 'C:\Users\USER\AppData\Local\Temp\flowerbloom-audit-20261026-211117\backend-probes\run_probes.py'
```

Script mengosongkan hanya tabel database SQLite `isolated-audit.sqlite3` milik probe ini pada awal setiap skenario. Gambar sintetis tersimpan dalam `media/`. Hasil akhir: `results.json`; log eksekusi: `stdout.log`, `stderr.log`. Tidak ada tes dengan status `probe_error` pada eksekusi final.

## Bukti tambahan yang paling relevan

| Skenario | Hasil aktual | Makna |
| --- | --- | --- |
| `all_replacements_policy_same_color_different_species` | Kebijakan `semua_pengganti`, Anyelir putih diganti Mawar putih; consent false → HTTP 409 `perlu_konfirmasi_pengganti`, true → 200 `siap_diambil` | Backend benar menuntut persetujuan untuk semua pengganti. UI perlu menyediakan checkbox meski `warna_berbeda=false`. Root menguji UI terpisah. |
| `checkout_same_request_retry` | Payload dan header `Idempotency-Key` identik dikirim dua kali → HTTP 201/201, dua ID pesanan, stok masing-masing ditahan dua kali | Ketiadaan idempotensi backend dapat menggandakan pesanan setelah pengiriman ulang akibat respons terputus. UI sudah menonaktifkan tombol saat pending; hasil ini bukan klaim bahwa semua klik ganda lolos. |
| `rejected_partial_payment_then_cancel` | Bukti Rp100.000 untuk total Rp150.000 ditolak dengan catatan dana kurang, lalu pelanggan batal → flag refund false di API admin dan DB | Keterbatasan pelacakan dana parsial/ditolak. Admin perlu peninjauan pengembalian dana berdasarkan riwayat; flag otomatis hanya muncul jika batal saat masih menunggu verifikasi. Ini mengasumsikan uang parsial benar-benar diterima admin, bukan bukti palsu. |
| `reference_color_edit_changes_existing_order` | Admin mengubah referensi Merah tua menjadi Biru laut; pesanan yang sudah dibuat ikut berubah menjadi Biru laut | Komposisi menyimpan ID stok, tidak membekukan nama/hex warna. Dampak pada riwayat warna perlu dipertimbangkan bila endpoint edit referensi dipakai untuk perubahan substansial. Ini tidak dipicu transaksi biasa. |
| `invalid_shipping_slot_range` | Pengaturan slot `17:00-09:00` diterima (200), checkout juga diterima (201) | Validasi saat ini hanya format. Perlu keputusan apakah slot lintas tengah malam memang didukung; jangan menganggap bug pasti tanpa definisi produk. |

## Alur yang tetap benar pada probe

- Mengubah harga dan komposisi katalog/pengaturan setelah checkout tidak mengubah total dan jumlah/ID stok komposisi lama. Pembatalan mengembalikan stok asal. Nama produk masih mengikuti nama katalog terkini.
- Pengganti berbeda warna ditolak jika tidak disetujui; revisi dan penggantian kembali ke warna semula bisa diselesaikan sampai `siap_diambil`. Ringkasan terbaru masih menyertakan baris pengganti lama dengan kuantitas nol (observasi tampilan, bukan blocker).
- Pelanggan lain tidak bisa mengunggah bukti ke pesanan (404), dan tidak ada berkas baru yang dibuat oleh percobaan tersebut.
- Logout semua perangkat mencabut akses token (401). Signed URL media tetap berlaku sampai kedaluwarsa (200 setelah logout), sesuai desain bearer capability; bukan bukti kebocoran token atau bypass otorisasi akun.
- Loop async scheduler sebenarnya berjalan pada database sementara, membatalkan pesanan lewat waktu, dan mengembalikan seluruh tahanan stok. Ini menguji loop/thread, belum membuktikan konfigurasi lifespan pada server produksi.

Pengujian ini melengkapi suite otomatis, bukan menggantikannya. Tidak membuktikan transaksi/isolasi MySQL, pengalaman browser, atau akurasi warna foto nyata.

## Dua probe konkurensi MySQL tambahan

Setelah batch SQLite, agen verifikasi menyediakan basis data khusus `flowerbloom_race_uji` pada MySQL 8.4.13 di container audit (port 13316). Basis data suite penuh, migrasi, dan browser tidak disentuh. Kedua script berikut memerlukan `AUDIT_MYSQL_RACE_URL` yang secara eksplisit menunjuk `flowerbloom_race_uji`; masing-masing membuat ulang tabel **hanya dalam database audit tersebut**. Kredensial tidak ditanam dalam script.

```powershell
$env:AUDIT_MYSQL_RACE_URL = '<URL MySQL database audit flowerbloom_race_uji>'
& 'D:\capstone\backend\.venv\Scripts\python.exe' '<folder ini>\mysql_scan_race.py'
& 'D:\capstone\backend\.venv\Scripts\python.exe' '<folder ini>\mysql_admin_race.py'
```

Kedua probe memakai dua TestClient independen/dua transaksi sungguhan dan penghalang sinkronisasi khusus tes untuk membuka urutan baca sebelum tulis secara deterministik. Penghalang hanya menunda eksekusi, tidak mengubah hasil pembacaan atau keputusan aplikasi.

| Kasus | Aktual | Dampak dan sumber |
| --- | --- | --- |
| Satu hasil pindai disimpan dua admin bersamaan | Satu `id_pindai`, masing-masing qty7; HTTP201/201, stok awal20→34, satu riwayat pindai tetapi dua mutasi masuk+7 | Stok fiktif bertambah dua kali dan dapat dijual. `backend/app/services/pindai.py:124` memeriksa `id_stok` tanpa mengunci/mengeklaim riwayat secara atomik sebelum `tambah_stok`. Bukti `mysql-scan-race-results.json`. |
| Dua admin aktif saling menonaktifkan bersamaan | Awal2; HTTP200/200, akhir0admin aktif, akses kedua token menjadi401 | Seluruh admin terkunci; pemulihan perlu intervensi seed/DB. `backend/app/services/akun.py:117` membaca jumlah admin tanpa perlindungan transaksi terhadap operasi bersama; assignment pada123. Bukti `mysql-admin-race-results.json`. |

Kedua reproduksi selesai dengan exit code0. Script dan hasil ini merupakan reproduksi tambahan, tidak ditambahkan ke suite repositori karena permintaan hanya pengujian/analisis.
