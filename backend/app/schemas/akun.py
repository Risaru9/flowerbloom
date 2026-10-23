"""Skema akun, autentikasi, dan aksesibilitas."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import JenisButaWarna, Peran, Tema
from app.schemas.dasar import SkemaDasar


class DaftarIn(BaseModel):
    """Peran tidak ada di sini dengan sengaja: pendaftaran publik selalu menghasilkan pelanggan."""

    nama: str = Field(min_length=2, max_length=100)
    email: EmailStr
    no_hp: str | None = Field(default=None, max_length=20)
    kata_sandi: str = Field(min_length=8, max_length=128)

    @field_validator("nama")
    @classmethod
    def _nama_tidak_kosong(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("nama kosong")
        return v.strip()


class MasukIn(BaseModel):
    email: EmailStr
    kata_sandi: str = Field(min_length=1, max_length=128)


class PenggunaOut(SkemaDasar):
    id_pengguna: int
    nama: str
    email: str
    no_hp: str | None
    peran: Peran
    aktif: bool
    dibuat_pada: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    pengguna: PenggunaOut


class ProfilUbahIn(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    no_hp: str | None = Field(default=None, max_length=20)


class KataSandiUbahIn(BaseModel):
    kata_sandi_lama: str = Field(min_length=1, max_length=128)
    kata_sandi_baru: str = Field(min_length=8, max_length=128)


class AdminBaruIn(DaftarIn):
    """Pembuatan akun admin oleh admin lain (F-AD-17)."""


class AktifIn(BaseModel):
    aktif: bool


class AksesibilitasOut(SkemaDasar):
    jenis_buta_warna: JenisButaWarna
    penajaman_warna: bool
    ukuran_teks: int
    kecepatan_suara: float
    tema: Tema


class AksesibilitasUbahIn(BaseModel):
    """Semua bidang opsional: hanya yang dikirim yang diubah."""

    jenis_buta_warna: JenisButaWarna | None = None
    penajaman_warna: bool | None = None
    ukuran_teks: int | None = Field(default=None, ge=80, le=200, description="Persen dari ukuran dasar")
    kecepatan_suara: float | None = Field(default=None, ge=0.5, le=2.0)
    tema: Tema | None = None
