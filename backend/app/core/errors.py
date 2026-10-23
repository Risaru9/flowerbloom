"""Galat aplikasi dan format respons galat yang seragam.

Semua galat dikirim ke klien sebagai ``{"kode": ..., "pesan": ..., "rincian": ...}`` sehingga
frontend cukup satu penanganan. ``kode`` stabil (untuk logika), ``pesan`` untuk ditampilkan.
"""
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

log = logging.getLogger("flowerbloom")


class KesalahanAplikasi(Exception):
    status = 400
    kode = "kesalahan"

    def __init__(self, pesan: str, *, kode: str | None = None, rincian: Any = None):
        super().__init__(pesan)
        self.pesan = pesan
        if kode:
            self.kode = kode
        self.rincian = rincian


class TidakDitemukan(KesalahanAplikasi):
    status = 404
    kode = "tidak_ditemukan"


class TidakSah(KesalahanAplikasi):
    status = 401
    kode = "tidak_terautentikasi"


class Dilarang(KesalahanAplikasi):
    status = 403
    kode = "dilarang"


class TerlaluBanyak(KesalahanAplikasi):
    status = 429
    kode = "terlalu_banyak_percobaan"


class Konflik(KesalahanAplikasi):
    status = 409
    kode = "konflik"


class DataTidakValid(KesalahanAplikasi):
    status = 422
    kode = "data_tidak_valid"


class StokTidakCukup(Konflik):
    kode = "stok_tidak_cukup"


class TransisiTidakSah(Konflik):
    kode = "transisi_status_tidak_sah"


class BatasBayarLewat(Konflik):
    """Dilempar SETELAH pesanan dibatalkan otomatis di transaksi berjalan; router harus commit sebelum meneruskan."""

    kode = "batas_bayar_lewat"


_TERJEMAH_TIPE = {
    "missing": "Wajib diisi.",
    "string_too_short": "Terlalu pendek.",
    "string_too_long": "Terlalu panjang.",
    "too_short": "Jumlah isian kurang.",
    "too_long": "Jumlah isian berlebih.",
    "int_parsing": "Harus berupa bilangan bulat.",
    "float_parsing": "Harus berupa angka.",
    "bool_parsing": "Harus berupa benar/salah.",
    "date_from_datetime_parsing": "Format tanggal tidak valid (gunakan YYYY-MM-DD).",
    "date_parsing": "Format tanggal tidak valid (gunakan YYYY-MM-DD).",
    "datetime_parsing": "Format tanggal-waktu tidak valid.",
    "enum": "Nilai tidak dikenal.",
    "literal_error": "Nilai tidak dikenal.",
    "greater_than_equal": "Nilai terlalu kecil.",
    "less_than_equal": "Nilai terlalu besar.",
    "greater_than": "Nilai terlalu kecil.",
    "less_than": "Nilai terlalu besar.",
    "value_error": "Format tidak valid.",
    "json_invalid": "JSON tidak valid.",
}


def _terjemahkan(galat: dict) -> dict:
    lokasi = [str(bagian) for bagian in galat.get("loc", ()) if bagian not in ("body", "query", "path")]
    pesan = _TERJEMAH_TIPE.get(galat.get("type", ""), galat.get("msg", "Tidak valid."))
    return {"bidang": ".".join(lokasi), "pesan": pesan}


def pasang_penanganan_galat(app: FastAPI) -> None:
    @app.exception_handler(KesalahanAplikasi)
    async def _galat_aplikasi(_: Request, galat: KesalahanAplikasi):
        isi = {"kode": galat.kode, "pesan": galat.pesan, "rincian": galat.rincian}
        return JSONResponse(status_code=galat.status, content=isi)

    @app.exception_handler(RequestValidationError)
    async def _galat_validasi(_: Request, galat: RequestValidationError):
        rincian = [_terjemahkan(g) for g in galat.errors()]
        return JSONResponse(
            status_code=422,
            content={"kode": "validasi_gagal", "pesan": "Data yang dikirim tidak valid.", "rincian": rincian},
        )

    @app.exception_handler(IntegrityError)
    async def _galat_integritas(_: Request, galat: IntegrityError):
        log.warning("IntegrityError: %s", galat.orig)
        return JSONResponse(
            status_code=409,
            content={
                "kode": "konflik_data",
                "pesan": "Data bentrok dengan data lain (mungkin sudah ada atau masih dipakai).",
                "rincian": None,
            },
        )

    @app.exception_handler(Exception)
    async def _galat_tak_terduga(_: Request, galat: Exception):
        log.exception("Galat tak terduga", exc_info=galat)
        return JSONResponse(
            status_code=500,
            content={"kode": "kesalahan_server", "pesan": "Terjadi kesalahan pada server.", "rincian": None},
        )
