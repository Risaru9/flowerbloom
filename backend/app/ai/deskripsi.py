"""Deskripsi otomatis berbasis templat tetap, tanpa model bahasa (F-AI-07).

Contoh: ``deskripsi_bunga("Mawar", "Merah tua", "kelopak berlapis")`` -> "Mawar merah tua dengan kelopak berlapis".
"""
from collections.abc import Iterable


def deskripsi_bunga(nama_bunga: str, nama_warna: str, bentuk: str | None = None) -> str:
    dasar = f"{nama_bunga} {nama_warna.lower()}"
    return f"{dasar} dengan {bentuk}" if bentuk else dasar


def narasi_rangkaian(nama: str, baris: Iterable[tuple[int, str, str]]) -> str:
    """Kalimat untuk dibacakan Text-to-Speech (F-PL-08). ``baris`` = (jumlah tangkai, nama bunga, nama warna)."""
    baris = list(baris)
    total = sum(jumlah for jumlah, _, _ in baris)
    rincian = ", ".join(f"{jumlah} tangkai {bunga.lower()} {warna.lower()}" for jumlah, bunga, warna in baris)
    if not rincian:
        return nama
    return f"{nama}. Berisi {total} tangkai: {rincian}."
