"""Dependensi FastAPI: sesi basis data, pengguna saat ini, dan pembatasan peran."""
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import Dilarang, TidakSah
from app.core.security import baca_klaim_akses
from app.database import get_db
from app.models.enums import Peran
from app.models.pengguna import Pengguna

skema_bearer = HTTPBearer(auto_error=False, description="Token dari POST /auth/masuk")

DB = Annotated[Session, Depends(get_db)]


def pengguna_saat_ini(
    db: DB, kredensial: Annotated[HTTPAuthorizationCredentials | None, Depends(skema_bearer)]
) -> Pengguna:
    if kredensial is None:
        raise TidakSah("Silakan masuk terlebih dahulu.")
    id_pengguna, versi = baca_klaim_akses(kredensial.credentials)
    pengguna = db.get(Pengguna, id_pengguna)
    if pengguna is None or not pengguna.aktif:
        raise TidakSah("Akun tidak ditemukan atau dinonaktifkan.")
    if versi != (pengguna.versi_sesi or 0):
        raise TidakSah("Sesi sudah berakhir. Silakan masuk kembali.", kode="sesi_dicabut")
    return pengguna


def wajib_admin(pengguna: Annotated[Pengguna, Depends(pengguna_saat_ini)]) -> Pengguna:
    if pengguna.peran != Peran.admin:
        raise Dilarang("Fitur ini hanya untuk admin toko.")
    return pengguna


def wajib_pelanggan(pengguna: Annotated[Pengguna, Depends(pengguna_saat_ini)]) -> Pengguna:
    if pengguna.peran != Peran.pelanggan:
        raise Dilarang("Fitur ini hanya untuk pelanggan.")
    return pengguna


PenggunaSaatIni = Annotated[Pengguna, Depends(pengguna_saat_ini)]
Admin = Annotated[Pengguna, Depends(wajib_admin)]
Pelanggan = Annotated[Pengguna, Depends(wajib_pelanggan)]
