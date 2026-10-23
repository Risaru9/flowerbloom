"""Katalog paket rangkaian siap pakai (F-PL-02, F-PL-03, F-AD-14)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import Konflik, TidakDitemukan
from app.core.penyimpanan import ambil_penyimpanan, buka_gambar
from app.models.bunga import JenisBunga, Warna
from app.models.katalog import KomposisiProduk, Produk
from app.models.stok import Stok
from app.schemas.katalog import KomposisiIn


def _kueri_produk():
    return select(Produk).options(
        selectinload(Produk.komposisi).selectinload(KomposisiProduk.jenis_bunga),
        selectinload(Produk.komposisi).selectinload(KomposisiProduk.warna),
    )


def daftar_produk(db: Session, *, acara: str | None = None, hanya_ditampilkan: bool = True) -> list[Produk]:
    kueri = _kueri_produk().order_by(Produk.id_produk)
    if hanya_ditampilkan:
        kueri = kueri.where(Produk.ditampilkan.is_(True))
    if acara:
        kueri = kueri.where(func.lower(Produk.acara) == acara.strip().lower())
    return list(db.scalars(kueri))


def daftar_acara(db: Session) -> list[str]:
    baris = db.scalars(
        select(Produk.acara)
        .where(Produk.ditampilkan.is_(True), Produk.acara.is_not(None))
        .distinct()
        .order_by(Produk.acara)
    )
    return [a for a in baris if a]


def ambil_produk(db: Session, id_produk: int, *, hanya_ditampilkan: bool = True) -> Produk:
    produk = db.scalar(_kueri_produk().where(Produk.id_produk == id_produk))
    if not produk or (hanya_ditampilkan and not produk.ditampilkan):
        raise TidakDitemukan("Paket tidak ditemukan.")
    return produk


def peta_stok(db: Session) -> dict[tuple[int, int], Stok]:
    """Stok per pasangan (id_jenis_bunga, id_warna)."""
    return {(s.id_jenis_bunga, s.id_warna): s for s in db.scalars(select(Stok))}


def _validasi_komposisi(db: Session, komposisi: list) -> None:
    pasangan = [(k.id_jenis_bunga, k.id_warna) for k in komposisi]
    if len(set(pasangan)) != len(pasangan):
        raise Konflik("Ada pasangan jenis dan warna yang muncul lebih dari sekali dalam komposisi.", kode="komposisi_ganda")
    for id_jenis, id_warna in pasangan:
        if not db.get(JenisBunga, id_jenis):
            raise TidakDitemukan(f"Jenis bunga {id_jenis} tidak ditemukan.")
        if not db.get(Warna, id_warna):
            raise TidakDitemukan(f"Warna {id_warna} tidak ditemukan.")


def buat_produk(db: Session, data) -> Produk:
    _validasi_komposisi(db, data.komposisi)
    produk = Produk(
        nama_produk=data.nama_produk.strip(),
        acara=data.acara.strip() if data.acara else None,
        harga=data.harga,
        deskripsi=data.deskripsi,
        ditampilkan=data.ditampilkan,
        komposisi=[
            KomposisiProduk(id_jenis_bunga=k.id_jenis_bunga, id_warna=k.id_warna, jumlah_tangkai=k.jumlah_tangkai)
            for k in data.komposisi
        ],
    )
    db.add(produk)
    db.flush()
    return ambil_produk(db, produk.id_produk, hanya_ditampilkan=False)


def ubah_produk(db: Session, id_produk: int, perubahan: dict) -> Produk:
    produk = ambil_produk(db, id_produk, hanya_ditampilkan=False)
    komposisi = perubahan.pop("komposisi", None)
    for kunci, nilai in perubahan.items():
        setattr(produk, kunci, nilai.strip() if isinstance(nilai, str) and kunci in ("nama_produk", "acara") else nilai)
    if komposisi is not None:
        baru = [KomposisiIn.model_validate(k) for k in komposisi]
        _validasi_komposisi(db, baru)
        produk.komposisi.clear()
        db.flush()
        produk.komposisi.extend(
            KomposisiProduk(id_jenis_bunga=k.id_jenis_bunga, id_warna=k.id_warna, jumlah_tangkai=k.jumlah_tangkai)
            for k in baru
        )
    db.flush()
    db.expire(produk)
    return ambil_produk(db, id_produk, hanya_ditampilkan=False)


def simpan_foto_produk(db: Session, id_produk: int, data: bytes) -> Produk:
    produk = ambil_produk(db, id_produk, hanya_ditampilkan=False)
    penyimpanan = ambil_penyimpanan()
    lama = produk.foto_produk
    produk.foto_produk = penyimpanan.simpan_gambar(buka_gambar(data), area="publik", kategori="produk")
    db.flush()
    penyimpanan.hapus(lama)
    return produk
