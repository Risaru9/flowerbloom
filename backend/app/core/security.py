"""Kata sandi dan token.

* Kata sandi: bcrypt atas hasil SHA-256 (base64) agar batas 72 byte bcrypt tidak memotong kata sandi panjang.
* Token akses: JWT untuk API.
* Token berkas: JWT berumur pendek untuk membuka berkas privat (bukti transfer, foto hasil) dari tag <img>
  yang tidak dapat mengirim header Authorization. Token hanya dibuat setelah otorisasi lolos.
"""
import base64
import hashlib
from datetime import timedelta

import bcrypt
import jwt

from app.config import ambil_pengaturan
from app.core.errors import TidakSah
from app.core.waktu import sekarang_utc


def _pra_hash(kata_sandi: str) -> bytes:
    return base64.b64encode(hashlib.sha256(kata_sandi.encode("utf-8")).digest())


def hash_kata_sandi(kata_sandi: str) -> str:
    return bcrypt.hashpw(_pra_hash(kata_sandi), bcrypt.gensalt(rounds=ambil_pengaturan().bcrypt_ronde)).decode("ascii")


def cocok_kata_sandi(kata_sandi: str, hash_tersimpan: str) -> bool:
    try:
        return bcrypt.checkpw(_pra_hash(kata_sandi), hash_tersimpan.encode("ascii"))
    except ValueError:
        return False


# Hash tiruan untuk menyamakan waktu respons saat email tidak terdaftar (mencegah enumerasi akun).
HASH_TIRUAN = hash_kata_sandi("tiruan-untuk-menyamakan-waktu")


def buat_token_akses(id_pengguna: int, peran: str, versi_sesi: int = 0) -> str:
    p = ambil_pengaturan()
    sekarang = sekarang_utc()
    kedaluwarsa = sekarang + timedelta(minutes=p.jwt_berlaku_menit)
    return jwt.encode(
        {"sub": str(id_pengguna), "peran": peran, "jenis": "akses", "ver": versi_sesi, "iat": sekarang, "exp": kedaluwarsa},
        p.jwt_rahasia,
        algorithm=p.jwt_algoritma,
    )


def baca_token_akses(token: str) -> int:
    return baca_klaim_akses(token)[0]


def baca_klaim_akses(token: str) -> tuple[int, int]:
    """Mengembalikan (id_pengguna, versi_sesi). Token lama tanpa klaim ``ver`` dianggap versi 0."""
    p = ambil_pengaturan()
    try:
        isi = jwt.decode(token, p.jwt_rahasia, algorithms=[p.jwt_algoritma])
        if isi.get("jenis") != "akses":
            raise TidakSah("Token tidak valid.")
        return int(isi["sub"]), int(isi.get("ver", 0))
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise TidakSah("Token tidak valid atau sudah kedaluwarsa.") from None


def buat_token_berkas(jalur_relatif: str) -> str:
    p = ambil_pengaturan()
    kedaluwarsa = sekarang_utc() + timedelta(minutes=p.tautan_berkas_berlaku_menit)
    return jwt.encode(
        {"jalur": jalur_relatif, "jenis": "berkas", "exp": kedaluwarsa},
        p.jwt_rahasia,
        algorithm=p.jwt_algoritma,
    )


def baca_token_berkas(token: str) -> str:
    p = ambil_pengaturan()
    try:
        isi = jwt.decode(token, p.jwt_rahasia, algorithms=[p.jwt_algoritma])
        if isi.get("jenis") != "berkas":
            raise TidakSah("Tautan berkas tidak valid.")
        return str(isi["jalur"])
    except (jwt.PyJWTError, KeyError):
        raise TidakSah("Tautan berkas tidak valid atau sudah kedaluwarsa.") from None
