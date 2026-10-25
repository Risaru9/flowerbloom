"""Skema pengaturan toko."""
from typing import Any

from pydantic import BaseModel, Field


class InfoTokoOut(BaseModel):
    """Bagian pengaturan yang perlu diketahui pelanggan saat checkout."""

    nama_toko: str
    rekening_tujuan: str = Field(description="Kosong bila belum diatur admin")
    no_hp_toko: str = Field(description="Nomor HP/WhatsApp toko; kosong berarti disembunyikan")
    alamat_toko: str
    email_toko: str
    batas_bayar_menit: int
    ongkos_antar: int
    jasa_merangkai: int
    minimal_tangkai_rangkai_sendiri: int
    slot_pengiriman: list[str]
    minimal_hari_pemesanan: int
    jumlah_revisi_gratis: int


class PengaturanItemOut(BaseModel):
    kunci: str
    label: str
    nilai: Any
    keterangan: str
    tipe: str


class PengaturanUbahIn(BaseModel):
    """Kirim hanya kunci yang ingin diubah, mis. ``{"ongkos_antar": 20000}``."""

    pengaturan: dict[str, Any]
