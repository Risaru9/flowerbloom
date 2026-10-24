"""Komplain pelanggan (F-PL-16, AB-09): maksimal 1x24 jam setelah pesanan diterima, disertai foto."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import Konflik, TidakDitemukan
from app.core.penyimpanan import ambil_penyimpanan, buka_gambar
from app.core.waktu import sekarang_utc
from app.models.enums import StatusKomplain
from app.models.komplain import Komplain
from app.models.pengguna import Pengguna
from app.models.pesanan import Pesanan
from app.services import alur_pesanan, pengaturan_toko
from app.services.alur_pesanan import S

# Komplain diterima sejak pesanan sampai ke pelanggan, walau admin belum sempat menandai "Selesai".
STATUS_BOLEH_KOMPLAIN = frozenset({S.siap_diambil, S.diantar, S.selesai})


def _waktu_diterima(pesanan: Pesanan):
    if pesanan.diselesaikan_pada:
        return pesanan.diselesaikan_pada
    return max((r.waktu for r in pesanan.riwayat_status if r.status_baru == pesanan.status), default=pesanan.dibuat_pada)


def ajukan(db: Session, *, id_pesanan: int, pelanggan: Pengguna, isi: str, foto: bytes | None) -> Komplain:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if pesanan.id_pengguna != pelanggan.id_pengguna:
        raise TidakDitemukan("Pesanan tidak ditemukan.")
    if pesanan.status not in STATUS_BOLEH_KOMPLAIN:
        raise Konflik("Komplain hanya dapat diajukan untuk pesanan yang sudah diterima.", kode="komplain_belum_boleh")
    batas = timedelta(hours=pengaturan_toko.ambil(db).batas_komplain_jam)
    if sekarang_utc() - _waktu_diterima(pesanan) > batas:
        raise Konflik(
            f"Batas pengajuan komplain ({int(batas.total_seconds() // 3600)} jam setelah diterima) sudah lewat.",
            kode="komplain_lewat_batas",
        )
    if db.scalar(select(Komplain.id_komplain).where(Komplain.id_pesanan == pesanan.id_pesanan)):
        raise Konflik(
            "Komplain untuk pesanan ini sudah diajukan. Pantau tanggapannya di halaman pesanan.", kode="komplain_sudah_ada"
        )
    jalur = ambil_penyimpanan().simpan_gambar(buka_gambar(foto), area="privat", kategori="komplain") if foto else None
    komplain = Komplain(id_pesanan=pesanan.id_pesanan, id_pengguna=pelanggan.id_pengguna, isi=isi.strip(), foto_komplain=jalur)
    db.add(komplain)
    db.flush()
    return komplain


def _kueri():
    return select(Komplain).options(selectinload(Komplain.pesanan))


def ambil(db: Session, id_komplain: int) -> Komplain:
    komplain = db.scalar(_kueri().where(Komplain.id_komplain == id_komplain))
    if not komplain:
        raise TidakDitemukan("Komplain tidak ditemukan.")
    return komplain


def daftar_pelanggan(db: Session, pelanggan: Pengguna) -> list[Komplain]:
    return list(
        db.scalars(_kueri().where(Komplain.id_pengguna == pelanggan.id_pengguna).order_by(Komplain.id_komplain.desc()))
    )


def daftar_admin(db: Session, status: StatusKomplain | None = None) -> list[Komplain]:
    kueri = _kueri().order_by(Komplain.id_komplain.desc())
    if status:
        kueri = kueri.where(Komplain.status == status)
    return list(db.scalars(kueri))


def tanggapi(db: Session, *, id_komplain: int, admin: Pengguna, tanggapan: str, status: StatusKomplain) -> Komplain:
    komplain = ambil(db, id_komplain)
    komplain.tanggapan_admin = tanggapan.strip()
    komplain.status = status
    komplain.id_admin = admin.id_pengguna
    komplain.ditanggapi_pada = sekarang_utc()
    db.flush()
    return komplain
