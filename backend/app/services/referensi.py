"""Data acuan: warna dan jenis bunga."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.warna import hex_ke_rgb
from app.core.errors import Konflik, TidakDitemukan
from app.models.bunga import JenisBunga, Warna
from app.models.katalog import KomposisiProduk
from app.models.stok import Stok


def daftar_warna(db: Session) -> list[Warna]:
    return list(db.scalars(select(Warna).order_by(Warna.nama_warna)))


def daftar_jenis_bunga(db: Session, cari: str | None = None) -> list[JenisBunga]:
    kueri = select(JenisBunga).order_by(JenisBunga.nama_bunga)
    if cari:
        kueri = kueri.where(JenisBunga.nama_bunga.ilike(f"%{cari.strip()}%"))
    return list(db.scalars(kueri))


def ambil_warna(db: Session, id_warna: int) -> Warna:
    warna = db.get(Warna, id_warna)
    if not warna:
        raise TidakDitemukan("Warna tidak ditemukan.")
    return warna


def ambil_jenis_bunga(db: Session, id_jenis_bunga: int) -> JenisBunga:
    jenis = db.get(JenisBunga, id_jenis_bunga)
    if not jenis:
        raise TidakDitemukan("Jenis bunga tidak ditemukan.")
    return jenis


def katalog_warna_rgb(db: Session) -> list[tuple[int, tuple[int, int, int]]]:
    """Daftar (id_warna, rgb) untuk pencocokan nama warna oleh modul AI."""
    katalog = [(w.id_warna, hex_ke_rgb(w.kode_hex)) for w in db.scalars(select(Warna))]
    if not katalog:
        raise Konflik(
            "Daftar warna masih kosong. Jalankan `python -m scripts.seed` atau tambahkan warna terlebih dahulu.",
            kode="warna_belum_diisi",
        )
    return katalog


def buat_warna(db: Session, *, nama_warna: str, kode_hex: str, makna_warna: str | None) -> Warna:
    if db.scalar(select(Warna).where(Warna.nama_warna == nama_warna.strip())):
        raise Konflik("Nama warna sudah ada.", kode="warna_ganda")
    warna = Warna(nama_warna=nama_warna.strip(), kode_hex=kode_hex, makna_warna=makna_warna)
    db.add(warna)
    db.flush()
    return warna


def ubah_warna(db: Session, id_warna: int, perubahan: dict) -> Warna:
    warna = ambil_warna(db, id_warna)
    identitas_berubah = any(
        k in perubahan and str(perubahan[k]).strip().lower() != str(getattr(warna, k)).lower()
        for k in ("nama_warna", "kode_hex")
    )
    if identitas_berubah and (
        db.scalar(select(Stok.id_stok).where(Stok.id_warna == id_warna).limit(1)) is not None
        or db.scalar(select(KomposisiProduk.id_komposisi).where(KomposisiProduk.id_warna == id_warna).limit(1)) is not None
    ):
        raise Konflik("Warna sudah dipakai stok/katalog. Buat warna baru agar riwayat pesanan tetap utuh.",
                      kode="warna_sudah_digunakan")
    nama_baru = perubahan.get("nama_warna")
    if (
        nama_baru
        and nama_baru.strip() != warna.nama_warna
        and db.scalar(select(Warna).where(Warna.nama_warna == nama_baru.strip()))
    ):
        raise Konflik("Nama warna sudah ada.", kode="warna_ganda")
    for kunci, nilai in perubahan.items():
        setattr(warna, kunci, nilai.strip() if isinstance(nilai, str) and kunci == "nama_warna" else nilai)
    db.flush()
    return warna


def ubah_jenis_bunga(db: Session, id_jenis_bunga: int, perubahan: dict) -> JenisBunga:
    jenis = ambil_jenis_bunga(db, id_jenis_bunga)
    for kunci, nilai in perubahan.items():
        setattr(jenis, kunci, nilai)
    db.flush()
    return jenis
