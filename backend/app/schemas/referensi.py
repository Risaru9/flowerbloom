"""Skema data acuan: warna dan jenis bunga."""
import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.dasar import SkemaDasar

POLA_HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class WarnaRingkas(SkemaDasar):
    """Nama warna SELALU disertai kode heksadesimalnya (F-AK-01)."""

    id_warna: int
    nama_warna: str
    kode_hex: str


class WarnaOut(WarnaRingkas):
    makna_warna: str | None


class WarnaIn(BaseModel):
    nama_warna: str = Field(min_length=2, max_length=50)
    kode_hex: str
    makna_warna: str | None = None

    @field_validator("kode_hex")
    @classmethod
    def _hex(cls, v: str) -> str:
        if not POLA_HEX.match(v):
            raise ValueError("format kode hex harus #RRGGBB")
        return v.upper()


class WarnaUbahIn(BaseModel):
    nama_warna: str | None = Field(default=None, min_length=2, max_length=50)
    kode_hex: str | None = None
    makna_warna: str | None = None

    @field_validator("kode_hex")
    @classmethod
    def _hex(cls, v: str | None) -> str | None:
        if v is not None and not POLA_HEX.match(v):
            raise ValueError("format kode hex harus #RRGGBB")
        return v.upper() if v else v


class JenisRingkas(SkemaDasar):
    id_jenis_bunga: int
    nama_bunga: str
    bentuk_bunga: str | None


class JenisBungaOut(JenisRingkas):
    nama_ilmiah: str | None
    kelas_dataset: int | None
    deskripsi: str | None


class JenisBungaUbahIn(BaseModel):
    nama_bunga: str | None = Field(default=None, min_length=2, max_length=100)
    nama_ilmiah: str | None = Field(default=None, max_length=150)
    bentuk_bunga: str | None = Field(default=None, max_length=100)
    deskripsi: str | None = None
