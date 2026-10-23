"""Skema katalog paket."""
from decimal import Decimal

from pydantic import BaseModel, Field

from app.core.tipe import Uang
from app.schemas.referensi import JenisRingkas, WarnaRingkas


class KomposisiProdukOut(BaseModel):
    id_jenis_bunga: int
    jenis: JenisRingkas
    warna: WarnaRingkas
    jumlah_tangkai: int
    deskripsi: str
    stok_cukup: bool = Field(description="Stok hari ini cukup untuk satu paket")


class MaknaWarnaOut(BaseModel):
    nama_warna: str
    kode_hex: str
    makna: str | None


class ProdukOut(BaseModel):
    id_produk: int
    nama_produk: str
    acara: str | None
    harga: Uang
    foto_url: str | None
    deskripsi: str | None
    ditampilkan: bool
    komposisi: list[KomposisiProdukOut]
    total_tangkai: int
    dapat_dipesan: bool = Field(description="Semua bunga penyusun paket masih tersedia hari ini")
    narasi: str = Field(description="Kalimat lengkap untuk dibacakan Text-to-Speech (F-PL-08)")
    makna_warna: list[MaknaWarnaOut]


class KomposisiIn(BaseModel):
    id_jenis_bunga: int
    id_warna: int
    jumlah_tangkai: int = Field(gt=0, le=1000)


class ProdukIn(BaseModel):
    nama_produk: str = Field(min_length=2, max_length=100)
    acara: str | None = Field(default=None, max_length=50)
    harga: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    deskripsi: str | None = None
    ditampilkan: bool = True
    komposisi: list[KomposisiIn] = Field(min_length=1, max_length=30)


class ProdukUbahIn(BaseModel):
    nama_produk: str | None = Field(default=None, min_length=2, max_length=100)
    acara: str | None = Field(default=None, max_length=50)
    harga: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    deskripsi: str | None = None
    ditampilkan: bool | None = None
    komposisi: list[KomposisiIn] | None = Field(default=None, min_length=1, max_length=30)
