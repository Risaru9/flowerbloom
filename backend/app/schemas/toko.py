"""Skema pengaturan toko."""
from typing import Any

from pydantic import BaseModel


class InfoTokoOut(BaseModel):
    """Bagian pengaturan yang perlu diketahui pelanggan saat checkout."""

    nama_toko: str
    rekening_tujuan: str
    batas_bayar_menit: int
    ongkos_antar: int
    jasa_merangkai: int
    minimal_tangkai_rangkai_sendiri: int
    slot_pengiriman: list[str]
    minimal_hari_pemesanan: int
    jumlah_revisi_gratis: int


class PengaturanItemOut(BaseModel):
    kunci: str
    nilai: Any
    keterangan: str
    tipe: str


class PengaturanUbahIn(BaseModel):
    """Kirim hanya kunci yang ingin diubah, mis. ``{"ongkos_antar": 20000}``."""

    pengaturan: dict[str, Any]
