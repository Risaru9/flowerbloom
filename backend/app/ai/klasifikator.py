"""Klasifikasi jenis bunga (F-AI-01): antarmuka cadangan, bawaannya TIDAK aktif.

Keputusan proyek (docs/keputusan-desain.md, B.19): website berjalan TANPA model pengenal jenis. Model yang ada di tim
adalah model image captioning untuk penelitian, bukan klasifikasi, dan tidak dirancang untuk produksi. Dengan
``AI_MODE=nonaktif`` admin memilih jenis bunga (hal yang mudah bagi manusia, termasuk penyandang buta warna), sedangkan
warna (hal yang sulit bagi mereka) tetap dibaca otomatis oleh ``app.ai.warna``.

Antarmuka ``Klasifikator`` dipertahankan agar model dapat dipasang kelak tanpa mengubah alur lain. Syarat implementasinya
(rincian di docs/kontrak-model-ai.md):
* mengembalikan ``kelas_dataset`` = nomor kelas di tabel ``jenis_bunga``, BUKAN indeks keluaran mentah model;
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
    """Pengganti untuk pengembangan: memilih kelas secara deterministik dari isi gambar (gambar sama -> jawaban sama).

    Jenis bunga hasilnya TIDAK bermakna dan ditolak di produksi (lihat ``Pengaturan``). Warna tetap dihitung nyata.
    """

    def __init__(self, kelas_tetap: int | None = None):
        self.kelas_tetap = kelas_tetap

    def klasifikasi(self, gambar: Image.Image) -> HasilKlasifikasi:
        ringkas = hashlib.sha256(gambar.convert("RGB").resize((16, 16)).tobytes()).digest()
        kelas = self.kelas_tetap or int.from_bytes(ringkas[:4], "big") % JUMLAH_KELAS + 1
        keyakinan = 0.75 + (ringkas[4] / 255) * 0.24
        return HasilKlasifikasi(kelas_dataset=kelas, keyakinan=round(keyakinan, 4))


@lru_cache
def ambil_klasifikator() -> Klasifikator | None:
    """``None`` berarti jenis tidak ditebak otomatis: admin memilihnya, warna tetap dibaca otomatis."""
    p = ambil_pengaturan()
    if p.ai_mode == "tiruan":
        log.warning("AI_MODE=tiruan: jenis bunga hasil pindai adalah TIRUAN (acak), hanya untuk pengembangan.")
        return KlasifikatorTiruan(kelas_tetap=p.ai_tiruan_kelas)
    return None
