"""Pembatas percobaan (rate limit) sederhana di memori untuk menahan tebak-tebakan kata sandi.

Disimpan per proses: cukup untuk satu instans server (skala capstone). Bila backend dijalankan dengan banyak
worker/instans, pindahkan penyimpanannya ke Redis agar batas berlaku bersama.
"""
import math
import threading
import time
from collections import deque

from app.core.errors import TerlaluBanyak


class PembatasPercobaan:
    def __init__(self, maks: int, jendela_detik: int, *, jam=time.monotonic):
        self.maks = maks
        self.jendela = jendela_detik
        self._jam = jam
        self._catatan: dict[str, deque[float]] = {}
        self._kunci = threading.Lock()

    def _bersihkan(self, kunci: str, sekarang: float) -> deque[float]:
        antrean = self._catatan.setdefault(kunci, deque())
        while antrean and sekarang - antrean[0] >= self.jendela:
            antrean.popleft()
        return antrean

    def periksa(self, *kunci: str) -> None:
        """Melempar TerlaluBanyak bila salah satu kunci sudah mencapai batas dalam jendela waktu."""
        sekarang = self._jam()
        with self._kunci:
            for k in kunci:
                antrean = self._bersihkan(k, sekarang)
                if len(antrean) >= self.maks:
                    sisa = math.ceil((self.jendela - (sekarang - antrean[0])) / 60)
                    raise TerlaluBanyak(
                        f"Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam {max(sisa, 1)} menit.",
                        rincian={"coba_lagi_menit": max(sisa, 1)},
                    )

    def gagal(self, *kunci: str) -> None:
        sekarang = self._jam()
        with self._kunci:
            for k in kunci:
                self._bersihkan(k, sekarang).append(sekarang)
            if len(self._catatan) > 10_000:  # cegah memori tumbuh tanpa batas oleh banyak kunci unik
                for k in [k for k, a in self._catatan.items() if not a or sekarang - a[-1] >= self.jendela]:
                    del self._catatan[k]

    def berhasil(self, kunci: str) -> None:
        with self._kunci:
            self._catatan.pop(kunci, None)

    def reset(self) -> None:
        with self._kunci:
            self._catatan.clear()


_pembatas: dict[str, PembatasPercobaan] = {}


def _ambil(nama: str, kali: int) -> PembatasPercobaan:
    if nama not in _pembatas:
        from app.config import ambil_pengaturan

        p = ambil_pengaturan()
        _pembatas[nama] = PembatasPercobaan(p.login_maks_gagal * kali, p.login_jendela_menit * 60)
    return _pembatas[nama]


def pembatas_masuk() -> PembatasPercobaan:
    """Per email + IP: menahan tebak kata sandi pada satu akun."""
    return _ambil("akun", 1)


def pembatas_masuk_ip() -> PembatasPercobaan:
    """Per IP, empat kali lebih longgar: menahan percobaan ke banyak akun dari satu sumber."""
    return _ambil("ip", 4)


def reset_semua() -> None:
    for p in _pembatas.values():
        p.reset()
