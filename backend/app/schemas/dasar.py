"""Komponen skema yang dipakai banyak modul."""
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class SkemaDasar(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Halaman(BaseModel, Generic[T]):
    """Pembungkus daftar berhalaman."""

    data: list[T]
    total: int
    halaman: int
    per_halaman: int


class GalatOut(BaseModel):
    kode: str
    pesan: str
    rincian: object | None = None


class PesanOut(BaseModel):
    pesan: str
