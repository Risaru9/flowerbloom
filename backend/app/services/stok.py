"""Stok: penambahan, koreksi, dan siklus penahanan tangkai (AB-02, F-NF-05).

Semua perubahan jumlah memakai ``UPDATE ... WHERE`` bersyarat sehingga atomik di tingkat basis data: dua
pelanggan yang berebut tangkai terakhir tidak mungkin sama-sama berhasil, tanpa perlu kunci di aplikasi.
Baris diproses berurutan menurut ``id_stok`` agar tidak terjadi deadlock antarpermintaan.
"""
from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.errors import DataTidakValid, StokTidakCukup, TidakDitemukan
from app.core.waktu import sekarang_utc
from app.models.bunga import JenisBunga, Warna
from app.models.enums import JenisMutasi
from app.models.pengguna import Pengguna
from app.models.stok import MutasiStok, Stok

JENIS_MASUK = (JenisMutasi.masuk_pindai, JenisMutasi.masuk_manual)


def _catat(
    db: Session,
    id_stok: int,
    jenis: JenisMutasi,
    jumlah: int,
    *,
    id_pesanan: int | None = None,
    oleh: Pengguna | None = None,
    catatan: str | None = None,
) -> None:
    db.add(
        MutasiStok(
            id_stok=id_stok,
            jenis=jenis,
            jumlah=jumlah,
            id_pesanan=id_pesanan,
            id_pengguna=oleh.id_pengguna if oleh else None,
            catatan=catatan,
        )
    )


def ambil_stok(db: Session, id_stok: int) -> Stok:
    stok = db.scalar(
        select(Stok)
        .options(joinedload(Stok.jenis_bunga), joinedload(Stok.warna))
        .where(Stok.id_stok == id_stok)
    )
    if not stok:
        raise TidakDitemukan("Stok tidak ditemukan.")
    return stok


def cari_stok(db: Session, id_jenis_bunga: int, id_warna: int) -> Stok | None:
    return db.scalar(select(Stok).where(Stok.id_jenis_bunga == id_jenis_bunga, Stok.id_warna == id_warna))


def daftar_stok(db: Session, *, hanya_tersedia: bool = False) -> list[Stok]:
    kueri = (
        select(Stok)
        .options(joinedload(Stok.jenis_bunga), joinedload(Stok.warna))
        .join(JenisBunga)
        .join(Warna)
        .order_by(JenisBunga.nama_bunga, Warna.nama_warna)
    )
    if hanya_tersedia:
        kueri = kueri.where(Stok.jumlah_tersedia > 0)
    return list(db.scalars(kueri).unique())


def jumlah_masuk_per_stok(db: Session) -> dict[int, int]:
    """Total tangkai yang pernah masuk (pindai + manual) per stok, dari buku mutasi (F-AD-13)."""
    baris = db.execute(
        select(MutasiStok.id_stok, func.sum(MutasiStok.jumlah))
        .where(MutasiStok.jenis.in_(JENIS_MASUK))
        .group_by(MutasiStok.id_stok)
    )
    return {id_stok: int(total) for id_stok, total in baris}


def tambah_stok(
    db: Session,
    *,
    id_jenis_bunga: int,
    id_warna: int,
    jumlah: int,
    harga_per_tangkai,
    jenis: JenisMutasi,
    oleh: Pengguna,
) -> Stok:
    """Menambah stok pasangan (jenis, warna); membuat barisnya bila belum ada. Harga terbaru menimpa harga lama."""
    if jenis not in JENIS_MASUK:
        raise ValueError("jenis harus masuk_pindai atau masuk_manual")
    if jumlah <= 0:
        raise DataTidakValid("Jumlah tangkai harus lebih dari nol.")
    if not db.get(JenisBunga, id_jenis_bunga):
        raise TidakDitemukan("Jenis bunga tidak ditemukan.")
    if not db.get(Warna, id_warna):
        raise TidakDitemukan("Warna tidak ditemukan.")

    for _ in range(2):  # percobaan kedua bila dua admin membuat baris yang sama bersamaan
        stok = cari_stok(db, id_jenis_bunga, id_warna)
        if stok is None:
            try:
                with db.begin_nested():
                    stok = Stok(
                        id_jenis_bunga=id_jenis_bunga,
                        id_warna=id_warna,
                        jumlah_tersedia=jumlah,
                        jumlah_ditahan=0,
                        harga_per_tangkai=harga_per_tangkai,
                        tanggal_masuk=sekarang_utc(),
                    )
                    db.add(stok)
                    db.flush()
            except IntegrityError:
                continue
        else:
            db.execute(
                update(Stok)
                .where(Stok.id_stok == stok.id_stok)
                .values(
                    jumlah_tersedia=Stok.jumlah_tersedia + jumlah,
                    harga_per_tangkai=harga_per_tangkai,
                    tanggal_masuk=sekarang_utc(),
                )
                .execution_options(synchronize_session=False)
            )
            db.expire(stok)
        _catat(db, stok.id_stok, jenis, jumlah, oleh=oleh)
        db.flush()
        return stok
    raise RuntimeError("Gagal menambah stok akibat benturan berulang.")  # pragma: no cover


def koreksi_stok(
    db: Session,
    stok: Stok,
    *,
    jumlah_tersedia: int | None,
    harga_per_tangkai,
    catatan: str,
    oleh: Pengguna,
) -> Stok:
    """Koreksi manual (mis. hasil hitung fisik, bunga layu). Selisih tercatat di buku mutasi."""
    if jumlah_tersedia is not None:
        if jumlah_tersedia < 0:
            raise DataTidakValid("Jumlah tersedia tidak boleh negatif.")
        selisih = jumlah_tersedia - stok.jumlah_tersedia
        if selisih:
            hasil = db.execute(
                update(Stok)
                .where(Stok.id_stok == stok.id_stok, Stok.jumlah_tersedia + selisih >= 0)
                .values(jumlah_tersedia=Stok.jumlah_tersedia + selisih)
                .execution_options(synchronize_session=False)
            )
            if hasil.rowcount != 1:
                raise DataTidakValid("Koreksi membuat stok negatif; muat ulang lalu coba lagi.")
            _catat(db, stok.id_stok, JenisMutasi.koreksi, selisih, oleh=oleh, catatan=catatan)
    if harga_per_tangkai is not None:
        stok.harga_per_tangkai = harga_per_tangkai
    db.flush()
    db.expire(stok)
    return stok


# --- Siklus penahanan ---------------------------------------------------------------------------------------


def gabung_kebutuhan(pasangan: Iterable[tuple[int, int]]) -> dict[int, int]:
    """Menjumlahkan kebutuhan per id_stok (satu stok bisa muncul di beberapa baris pesanan)."""
    total: dict[int, int] = defaultdict(int)
    for id_stok, jumlah in pasangan:
        total[id_stok] += jumlah
    return dict(total)


def tahan(db: Session, kebutuhan: dict[int, int], *, id_pesanan: int) -> None:
    """tersedia -> ditahan, atomik dan hanya bila cukup. Bila ada yang kurang, semua kekurangan dilaporkan sekaligus.

    Pemanggil wajib membatalkan transaksi (tidak commit) bila melempar ``StokTidakCukup``.
    """
    db.flush()  # expire_all() di bawah membuang perubahan ORM yang belum di-flush
    kurang: list[int] = []
    for id_stok in sorted(kebutuhan):
        jumlah = kebutuhan[id_stok]
        hasil = db.execute(
            update(Stok)
            .where(Stok.id_stok == id_stok, Stok.jumlah_tersedia >= jumlah)
            .values(jumlah_tersedia=Stok.jumlah_tersedia - jumlah, jumlah_ditahan=Stok.jumlah_ditahan + jumlah)
            .execution_options(synchronize_session=False)
        )
        if hasil.rowcount == 1:
            _catat(db, id_stok, JenisMutasi.tahan, jumlah, id_pesanan=id_pesanan)
        else:
            kurang.append(id_stok)
    if kurang:
        db.expire_all()
        rincian = []
        for id_stok in kurang:
            stok = db.get(Stok, id_stok)
            rincian.append(
                {
                    "id_stok": id_stok,
                    "bunga": f"{stok.jenis_bunga.nama_bunga} {stok.warna.nama_warna.lower()}" if stok else "(tidak ada)",
                    "diminta": kebutuhan[id_stok],
                    "tersedia": stok.jumlah_tersedia if stok else 0,
                }
            )
        raise StokTidakCukup("Stok sebagian bunga tidak mencukupi.", rincian=rincian)
    db.expire_all()


def lepas(db: Session, kebutuhan: dict[int, int], *, id_pesanan: int, oleh: Pengguna | None = None, catatan: str | None = None) -> None:
    """ditahan -> tersedia (pesanan batal atau kedaluwarsa)."""
    db.flush()
    for id_stok in sorted(kebutuhan):
        jumlah = kebutuhan[id_stok]
        hasil = db.execute(
            update(Stok)
            .where(Stok.id_stok == id_stok, Stok.jumlah_ditahan >= jumlah)
            .values(jumlah_tersedia=Stok.jumlah_tersedia + jumlah, jumlah_ditahan=Stok.jumlah_ditahan - jumlah)
            .execution_options(synchronize_session=False)
        )
        if hasil.rowcount != 1:  # data tidak konsisten; jangan diam-diam menutupinya
            raise RuntimeError(f"Tahanan stok {id_stok} kurang dari {jumlah} saat dilepas (pesanan {id_pesanan}).")
        _catat(db, id_stok, JenisMutasi.lepas, jumlah, id_pesanan=id_pesanan, oleh=oleh, catatan=catatan)
    db.expire_all()


def pakai_tahanan(db: Session, kebutuhan: dict[int, int], *, id_pesanan: int, oleh: Pengguna | None = None) -> None:
    """ditahan -> terpakai (pembayaran disahkan)."""
    db.flush()
    for id_stok in sorted(kebutuhan):
        jumlah = kebutuhan[id_stok]
        hasil = db.execute(
            update(Stok)
            .where(Stok.id_stok == id_stok, Stok.jumlah_ditahan >= jumlah)
            .values(jumlah_ditahan=Stok.jumlah_ditahan - jumlah)
            .execution_options(synchronize_session=False)
        )
        if hasil.rowcount != 1:
            raise RuntimeError(f"Tahanan stok {id_stok} kurang dari {jumlah} saat dipakai (pesanan {id_pesanan}).")
        _catat(db, id_stok, JenisMutasi.pakai, jumlah, id_pesanan=id_pesanan, oleh=oleh)
    db.expire_all()


def pakai_dari_tersedia(
    db: Session, id_stok: int, jumlah: int, *, id_pesanan: int, oleh: Pengguna, catatan: str | None = None
) -> None:
    """tersedia -> terpakai, untuk bunga pengganti yang diambil langsung dari rak (setelah pembayaran sah)."""
    db.flush()
    hasil = db.execute(
        update(Stok)
        .where(Stok.id_stok == id_stok, Stok.jumlah_tersedia >= jumlah)
        .values(jumlah_tersedia=Stok.jumlah_tersedia - jumlah)
        .execution_options(synchronize_session=False)
    )
    if hasil.rowcount != 1:
        db.expire_all()
        stok = ambil_stok(db, id_stok)
        raise StokTidakCukup(
            "Stok bunga pengganti tidak mencukupi.",
            rincian=[
                {
                    "id_stok": id_stok,
                    "bunga": f"{stok.jenis_bunga.nama_bunga} {stok.warna.nama_warna.lower()}",
                    "diminta": jumlah,
                    "tersedia": stok.jumlah_tersedia,
                }
            ],
        )
    _catat(db, id_stok, JenisMutasi.pakai, jumlah, id_pesanan=id_pesanan, oleh=oleh, catatan=catatan)
    db.expire_all()
