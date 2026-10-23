"""Skema stok dan pindai."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.core.tipe import Uang
from app.schemas.dasar import SkemaDasar
from app.schemas.referensi import JenisRingkas, WarnaRingkas


class StokOut(BaseModel):
    """Baris stok untuk admin (F-AD-13): masuk, ditahan, tersedia."""

    id_stok: int
    jenis: JenisRingkas
    warna: WarnaRingkas
    deskripsi: str
    jumlah_masuk: int = Field(description="Total tangkai yang pernah masuk (pindai + manual)")
    jumlah_ditahan: int
    jumlah_tersedia: int
    harga_per_tangkai: Uang
    tanggal_masuk: datetime
    menipis: bool


class OpsiRangkaiOut(BaseModel):
    """Bunga yang bisa dipilih pelanggan pada menu Rangkai Sendiri (F-PL-04)."""

    id_stok: int
    jenis: JenisRingkas
    warna: WarnaRingkas
    deskripsi: str
    harga_per_tangkai: Uang
    sisa: int


class StokManualIn(BaseModel):
    id_jenis_bunga: int
    id_warna: int
    jumlah_tangkai: int = Field(gt=0, le=100000)
    harga_per_tangkai: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class SimpanPindaiIn(BaseModel):
    id_pindai: int
    id_jenis_bunga: int = Field(description="Jenis akhir setelah diperiksa/dikoreksi admin")
    id_warna: int = Field(description="Warna akhir setelah diperiksa/dikoreksi admin")
    jumlah_tangkai: int = Field(gt=0, le=100000)
    harga_per_tangkai: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class KoreksiStokIn(BaseModel):
    jumlah_tersedia: int | None = Field(default=None, ge=0, description="Jumlah tersedia yang benar (hasil hitung fisik)")
    harga_per_tangkai: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    catatan: str = Field(min_length=3, max_length=255, description="Alasan koreksi, mis. 'layu 3 tangkai'")


class HasilPindaiOut(BaseModel):
    id_pindai: int
    dikenali: bool
    jenis: JenisRingkas | None
    warna: WarnaRingkas
    tingkat_keyakinan: float
    jarak_warna: float
    deskripsi: str | None
    peringatan: list[str]
    tiruan: bool = Field(description="True bila jenis bunga berasal dari AI tiruan (model asli belum terpasang)")


class RiwayatPindaiOut(SkemaDasar):
    id_pindai: int
    konteks: str
    id_stok: int | None
    id_pesanan: int | None
    jenis_prediksi: str | None
    warna_prediksi: str | None
    tingkat_keyakinan: float | None
    dikenali: bool
    dikoreksi: bool
    id_jenis_bunga_final: int | None
    id_warna_final: int | None
    waktu_pindai: datetime
    foto_url: str | None = None


class RingkasanAkurasiOut(BaseModel):
    total_disimpan: int
    jenis_benar: int
    warna_benar: int
    akurasi_jenis: float | None
    akurasi_warna: float | None
