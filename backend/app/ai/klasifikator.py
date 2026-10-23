"""Klasifikasi jenis bunga (F-AI-01).

Backend hanya bergantung pada antarmuka ``Klasifikator``. Model hasil pelatihan (Oxford Flowers 102) dipasang
dengan menambahkan implementasi baru dan menyalakannya lewat ``AI_MODE=model``. Sampai model teruji, dipakai
``KlasifikatorTiruan`` sehingga seluruh alur (pindai stok, Mode Merangkai) tetap dapat dikembangkan dan diuji.

Yang harus dipenuhi implementasi model (rinciannya di docs/kontrak-model-ai.md):
* mengembalikan ``kelas_dataset`` = nomor kelas Oxford Flowers 102 (1..102), BUKAN indeks keluaran mentah model
  (pemetaan indeks -> nomor kelas menjadi tanggung jawab implementasi);
* keyakinan berupa probabilitas 0..1 dari softmax;
* dimuat sekali saat aplikasi mulai, bukan per permintaan (target F-NF-02: <= 3 detik).
"""
import hashlib
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from PIL import Image

from app.config import ambil_pengaturan

log = logging.getLogger("flowerbloom.ai")

JUMLAH_KELAS = 102


@dataclass(frozen=True)
class HasilKlasifikasi:
    kelas_dataset: int
    keyakinan: float


class Klasifikator(Protocol):
    def klasifikasi(self, gambar: Image.Image) -> HasilKlasifikasi: ...


class KlasifikatorTiruan:
    """Pengganti sementara: memilih kelas secara deterministik dari isi gambar (gambar sama -> jawaban sama).

    Jenis bunga hasilnya TIDAK bermakna. Hanya untuk mengembangkan alur; jangan dipakai untuk menilai akurasi.
    Warna yang dihitung modul warna tetap nyata.
    """

    def __init__(self, kelas_tetap: int | None = None):
        self.kelas_tetap = kelas_tetap

    def klasifikasi(self, gambar: Image.Image) -> HasilKlasifikasi:
        ringkas = hashlib.sha256(gambar.convert("RGB").resize((16, 16)).tobytes()).digest()
        kelas = self.kelas_tetap or int.from_bytes(ringkas[:4], "big") % JUMLAH_KELAS + 1
        keyakinan = 0.75 + (ringkas[4] / 255) * 0.24
        return HasilKlasifikasi(kelas_dataset=kelas, keyakinan=round(keyakinan, 4))


@lru_cache
def ambil_klasifikator() -> Klasifikator:
    p = ambil_pengaturan()
    if p.ai_mode == "tiruan":
        log.warning("AI_MODE=tiruan: jenis bunga hasil pindai adalah TIRUAN (bukan model asli).")
        return KlasifikatorTiruan(kelas_tetap=p.ai_tiruan_kelas)
    raise RuntimeError(
        "AI_MODE=model belum diimplementasikan. Menunggu format model dan pemetaan label dari anggota tim yang "
        "melatihnya (lihat docs/kontrak-model-ai.md)."
    )
