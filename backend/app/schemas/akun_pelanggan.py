"""Skema alamat tersimpan pelanggan."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.dasar import SkemaDasar


def _rapikan(nilai: str | None) -> str | None:
    if nilai is None:
        return None
    nilai = " ".join(nilai.split())
    return nilai or None


class AlamatIn(BaseModel):
    label: str = Field(min_length=1, max_length=50, description="Mis. 'Rumah' atau 'Kantor'")
    nama_penerima: str = Field(min_length=2, max_length=100)
    no_hp: str = Field(min_length=8, max_length=20, pattern=r"^\+?[0-9 ()-]{8,20}$")
    alamat: str = Field(min_length=10, max_length=500)
    catatan: str | None = Field(default=None, max_length=255, description="Patokan untuk kurir")
    utama: bool = False

    @field_validator("label", "nama_penerima", "catatan")
    @classmethod
    def _spasi(cls, v: str | None) -> str | None:
        return _rapikan(v)


class AlamatUbahIn(BaseModel):
    """Semua bidang opsional: hanya yang dikirim yang diubah."""

    label: str | None = Field(default=None, min_length=1, max_length=50)
    nama_penerima: str | None = Field(default=None, min_length=2, max_length=100)
    no_hp: str | None = Field(default=None, min_length=8, max_length=20, pattern=r"^\+?[0-9 ()-]{8,20}$")
    alamat: str | None = Field(default=None, min_length=10, max_length=500)
    catatan: str | None = Field(default=None, max_length=255)
    utama: bool | None = None

    @field_validator("label", "nama_penerima", "catatan")
    @classmethod
    def _spasi(cls, v: str | None) -> str | None:
        return _rapikan(v)


class AlamatOut(SkemaDasar):
    id_alamat: int
    label: str
    nama_penerima: str
    no_hp: str
    alamat: str
    catatan: str | None
    utama: bool
    dibuat_pada: datetime
