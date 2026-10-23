"""Membuat tautan ke berkas untuk klien.

* ``publik/...`` -> ``/media/...`` (berkas statis, mis. foto produk).
* ``privat/...`` -> ``/api/v1/berkas/<token>``: tautan bertanda tangan yang berlaku beberapa menit. Token
  hanya dibuat SESUDAH pemanggil lolos otorisasi (pemilik pesanan atau admin), sehingga tag ``<img>``
  yang tidak bisa mengirim header Authorization tetap dapat menampilkan bukti transfer dan foto hasil
  (F-NF-07).
"""
from app.core.security import buat_token_berkas

PREFIX_API = "/api/v1"


def tautan_berkas(jalur_relatif: str | None) -> str | None:
    if not jalur_relatif:
        return None
    if jalur_relatif.startswith("publik/"):
        return "/media/" + jalur_relatif.removeprefix("publik/")
    return f"{PREFIX_API}/berkas/{buat_token_berkas(jalur_relatif)}"
