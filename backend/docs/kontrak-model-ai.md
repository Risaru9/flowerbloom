# Kontrak Model AI (bila kelak ada model pengenal jenis)

**Status (2026-10-25): proyek berjalan TANPA model** (`AI_MODE=nonaktif`, keputusan B.19 di `keputusan-desain.md`). Admin memilih
jenis bunga; warna tetap dibaca dan dicocokkan otomatis. Model yang ada di tim (ViT-GPT2, CNN-GRU, CNN-LSTM) adalah model *image
captioning* untuk penelitian jurnal: keluarannya kalimat, bukan jenis + keyakinan, jadi tidak cocok dengan antarmuka di bawah.

Antarmuka `Klasifikator` (`app/ai/klasifikator.py`) dipertahankan. Dokumen ini menjelaskan apa yang diperlukan bila kelak tim ingin
memasang model **klasifikasi** jenis bunga, dan cara memeriksa bahwa ia layak.

## 1. Yang perlu diserahkan

| # | Butir | Kenapa penting |
|---|---|---|
| 1 | Berkas model + format (`.pt/.pth`, `.h5/.keras`, SavedModel, ONNX, TFLite) dan versi framework | Menentukan cara memuat dan dependensi |
| 2 | Arsitektur dan cara membangunnya (bila hanya *state dict*) | Berkas bobot saja tidak cukup untuk PyTorch |
| 3 | Praproses persis seperti saat pelatihan: ukuran input, urutan kanal (RGB/BGR), rentang nilai, mean/std | Praproses berbeda = akurasi jatuh tanpa galat apa pun |
| 4 | Bentuk keluaran: logit atau probabilitas, jumlah kelas (harus 102) | Keyakinan dipakai untuk ambang F-AI-02 |
| 5 | **Pemetaan indeks keluaran → nomor kelas 1..102** (`label_map.json`) | Lihat peringatan di bawah |
| 6 | Akurasi pada data uji yang tidak dipakai melatih, plus matriks kebingungan kelas yang sering tertukar | Dasar menentukan ambang keyakinan |
| 7 | Waktu inferensi satu gambar pada CPU (bukan GPU) | Target F-NF-02: hasil ≤ 3 detik |
| 8 | 10–20 contoh foto bunga **nyata dari toko/ponsel** beserta jenis yang benar | Oxford 102 berisi foto alam; foto stok toko berbeda |

**Peringatan pemetaan label.** `jenis_bunga.kelas_dataset` menyimpan nomor kelas resmi dataset (1..102). Indeks keluaran model
belum tentu sama: bila model dilatih dari folder (`ImageFolder`), indeks mengikuti urutan *nama folder sebagai teks*
("1", "10", "100", "101", "102", "11", …), sehingga indeks 1 bukan kelas 2. Pemuat dataset di pustaka populer umumnya memakai
label 0–101 (kelas dataset − 1); periksa milik Anda. Salah pemetaan **tidak menimbulkan galat**: sistem akan diam-diam menamai mawar sebagai bunga lain.

## 2. Cara memasang

1. Tambahkan `app/ai/klasifikator_model.py` berisi kelas yang memuat model **sekali** di `__init__` dan memenuhi
   `klasifikasi(gambar: PIL.Image) -> HasilKlasifikasi(kelas_dataset, keyakinan)`.
2. Tambahkan nilai `"model"` ke `ai_mode` di `app/config.py`, lalu di `ambil_klasifikator()` kembalikan kelas itu bila `AI_MODE=model`.
3. Jalankan `pytest`, lalu uji manual lewat `POST /admin/stok/pindai`.

Tidak ada bagian lain yang perlu diubah: pemetaan ke `jenis_bunga`, ambang keyakinan, riwayat pindai, dan Mode Merangkai
semuanya sudah berdiri di atas antarmuka ini.

## 3. Uji kelayakan sebelum dipercaya

Lakukan sebelum model dipakai untuk mengisi stok sungguhan:

1. **Data uji terpisah:** akurasi top-1 dan top-5 pada pembagian uji Oxford (angka ini sekadar batas atas).
2. **Foto nyata:** minimal beberapa foto per jenis yang benar-benar dijual toko, diambil seperti admin memotret (ponsel, satu jenis, latar toko). Catat akurasinya terpisah.
3. **Kalibrasi ambang:** pilih `AMBANG_KEYAKINAN` dari foto nyata (keyakinan jawaban benar vs salah), bukan dari angka bawaan 0,60.
4. **Waktu:** ukur end-to-end `POST /admin/stok/pindai` di mesin target; bagian warna sudah <1 detik.
5. **Bunga di luar 102 kelas:** foto bunga yang tidak ada di dataset; model akan tetap menjawab. Ambang keyakinan yang menolaknya harus terlihat di hasil ini.

Riwayat pindai (`GET /admin/riwayat-pindai/ringkasan`) menghitung akurasi jenis (hanya atas pindai yang jenisnya ditebak) dan warna
di pemakaian nyata sejak model dipasang.

## 4. Cakupan kelas

Dataset memuat 102 kelas yang didominasi bunga taman Eropa. Beberapa bunga yang umum dijual florist di Indonesia kemungkinan
tidak termasuk (belum diperiksa satu per satu terhadap `app/data/jenis_bunga.py`). Untuk bunga seperti itu admin memakai
**input stok manual** (F-AD-12), jadi jalur manual perlu diperlakukan sebagai jalur utama, bukan pengecualian.
