"""Aturan produk favorit dan alamat tersimpan. Layanan tidak melakukan commit (router yang commit)."""
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.errors import DataTidakValid, TidakDitemukan
from app.models.akun_pelanggan import Alamat, Favorit
from app.models.katalog import Produk
from app.models.pengguna import Pengguna
from app.services import katalog

MAKS_ALAMAT = 10

# --- Favorit ------------------------------------------------------------------------------------------------------


def daftar_favorit(db: Session, pengguna: Pengguna) -> list[Produk]:
    """Produk favorit yang masih ditampilkan, terbaru lebih dulu."""
    id_produk = db.scalars(
        select(Favorit.id_produk)
        .join(Produk, Produk.id_produk == Favorit.id_produk)
        .where(Favorit.id_pengguna == pengguna.id_pengguna, Produk.ditampilkan.is_(True))
        .order_by(Favorit.dibuat_pada.desc(), Favorit.id_favorit.desc())
    ).all()
    return [katalog.ambil_produk(db, i) for i in id_produk]


def simpan_favorit(db: Session, pengguna: Pengguna, id_produk: int) -> None:
    """Idempoten: menyimpan produk yang sudah favorit tidak dianggap galat."""
    katalog.ambil_produk(db, id_produk)  # 404 bila tidak ada atau disembunyikan
    ada = db.scalar(
        select(Favorit).where(Favorit.id_pengguna == pengguna.id_pengguna, Favorit.id_produk == id_produk)
    )
    if ada is None:
        db.add(Favorit(id_pengguna=pengguna.id_pengguna, id_produk=id_produk))
        db.flush()


def hapus_favorit(db: Session, pengguna: Pengguna, id_produk: int) -> None:
    """Idempoten: menghapus produk yang bukan favorit tidak dianggap galat."""
    ada = db.scalar(
        select(Favorit).where(Favorit.id_pengguna == pengguna.id_pengguna, Favorit.id_produk == id_produk)
    )
    if ada is not None:
        db.delete(ada)
        db.flush()


# --- Alamat -------------------------------------------------------------------------------------------------------


def daftar_alamat(db: Session, pengguna: Pengguna) -> list[Alamat]:
    return list(
        db.scalars(
            select(Alamat)
            .where(Alamat.id_pengguna == pengguna.id_pengguna)
            .order_by(Alamat.utama.desc(), Alamat.dibuat_pada.desc(), Alamat.id_alamat.desc())
        )
    )


def _ambil_milik(db: Session, pengguna: Pengguna, id_alamat: int) -> Alamat:
    alamat = db.get(Alamat, id_alamat)
    # Alamat milik orang lain dilaporkan "tidak ditemukan", bukan "dilarang", agar keberadaannya tidak bocor.
    if alamat is None or alamat.id_pengguna != pengguna.id_pengguna:
        raise TidakDitemukan("Alamat tidak ditemukan.")
    return alamat


def _lepas_utama(db: Session, pengguna: Pengguna, kecuali: int | None = None) -> None:
    kueri = update(Alamat).where(Alamat.id_pengguna == pengguna.id_pengguna, Alamat.utama.is_(True))
    if kecuali is not None:
        kueri = kueri.where(Alamat.id_alamat != kecuali)
    db.execute(kueri.values(utama=False))


def buat_alamat(db: Session, pengguna: Pengguna, data: dict) -> Alamat:
    jumlah = db.scalar(select(func.count()).select_from(Alamat).where(Alamat.id_pengguna == pengguna.id_pengguna)) or 0
    if jumlah >= MAKS_ALAMAT:
        raise DataTidakValid(f"Maksimal {MAKS_ALAMAT} alamat tersimpan. Hapus alamat yang tidak dipakai.")
    utama = bool(data.get("utama")) or jumlah == 0  # alamat pertama otomatis menjadi utama
    if utama:
        _lepas_utama(db, pengguna)
    alamat = Alamat(id_pengguna=pengguna.id_pengguna, **{**data, "utama": utama})
    db.add(alamat)
    db.flush()
    return alamat


def ubah_alamat(db: Session, pengguna: Pengguna, id_alamat: int, data: dict) -> Alamat:
    alamat = _ambil_milik(db, pengguna, id_alamat)
    utama = data.pop("utama", None)
    for kunci, nilai in data.items():
        if nilai is None and kunci != "catatan":
            continue  # bidang wajib tidak boleh dikosongkan lewat PATCH
        setattr(alamat, kunci, nilai)
    if utama is True and not alamat.utama:
        _lepas_utama(db, pengguna, kecuali=alamat.id_alamat)
        alamat.utama = True
    elif utama is False and alamat.utama:
        raise DataTidakValid("Pilih alamat lain sebagai utama; satu alamat harus tetap menjadi utama.")
    db.flush()
    return alamat


def hapus_alamat(db: Session, pengguna: Pengguna, id_alamat: int) -> None:
    alamat = _ambil_milik(db, pengguna, id_alamat)
    tadinya_utama = alamat.utama
    db.delete(alamat)
    db.flush()
    if tadinya_utama:
        pengganti = db.scalar(
            select(Alamat)
            .where(Alamat.id_pengguna == pengguna.id_pengguna)
            .order_by(Alamat.dibuat_pada.desc(), Alamat.id_alamat.desc())
            .limit(1)
        )
        if pengganti is not None:
            pengganti.utama = True
            db.flush()
