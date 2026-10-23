"""Mesin status pesanan: SATU-SATUNYA tempat status pesanan boleh diubah.

Diagram dan tabel pemicu ada di docs/alur-kerja.md. Aturan penting:

* Setiap perpindahan divalidasi terhadap ``TRANSISI_SAH`` dan dicatat di ``riwayat_status_pesanan``.
* Pemanggil harus mengunci baris pesanan lebih dulu (``kunci_pesanan``) agar dua permintaan serentak
  (mis. klik ganda "Sahkan", atau pembatalan bersamaan dengan pengunggahan bukti) tidak saling menimpa.
* Efek samping (stok, pembayaran, foto) dilakukan pemanggil di transaksi yang sama.
"""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import TidakDitemukan, TransisiTidakSah
from app.models.enums import CaraSerahTerima, StatusPesanan
from app.models.pengguna import Pengguna
from app.models.pesanan import Pesanan, RiwayatStatusPesanan

S = StatusPesanan


@dataclass(frozen=True)
class InfoStatus:
    label: str
    ikon: str  # pengenal ikon generik; frontend memetakan ke pustaka ikonnya
    keterangan: str


INFO_STATUS: dict[StatusPesanan, InfoStatus] = {
    S.menunggu_pembayaran: InfoStatus(
        "Menunggu pembayaran", "clock", "Transfer sesuai total pesanan lalu unggah bukti sebelum batas waktu."
    ),
    S.menunggu_verifikasi: InfoStatus(
        "Menunggu verifikasi", "file-search", "Admin sedang memeriksa bukti transfer Anda."
    ),
    S.sedang_dirangkai: InfoStatus("Sedang dirangkai", "scissors", "Bunga pesanan Anda sedang dirangkai."),
    S.menunggu_persetujuan_foto: InfoStatus(
        "Menunggu persetujuan foto",
        "camera",
        "Periksa foto rangkaian dan nama warnanya, lalu setujui atau minta revisi.",
    ),
    S.siap_diambil: InfoStatus("Siap diambil", "store", "Pesanan siap diambil di toko sesuai jadwal."),
    S.diantar: InfoStatus("Diantar", "truck", "Pesanan sedang diantar ke alamat penerima."),
    S.selesai: InfoStatus("Selesai", "check-circle", "Pesanan telah diterima."),
    S.dibatalkan: InfoStatus("Dibatalkan", "x-circle", "Pesanan dibatalkan."),
}

TRANSISI_SAH: dict[StatusPesanan, frozenset[StatusPesanan]] = {
    S.menunggu_pembayaran: frozenset({S.menunggu_verifikasi, S.dibatalkan}),
    S.menunggu_verifikasi: frozenset({S.sedang_dirangkai, S.menunggu_pembayaran, S.dibatalkan}),
    S.sedang_dirangkai: frozenset({S.menunggu_persetujuan_foto}),
    S.menunggu_persetujuan_foto: frozenset({S.siap_diambil, S.diantar, S.sedang_dirangkai}),
    S.siap_diambil: frozenset({S.selesai}),
    S.diantar: frozenset({S.selesai}),
    S.selesai: frozenset(),
    S.dibatalkan: frozenset(),
}

STATUS_AKHIR = frozenset({S.selesai, S.dibatalkan})
STATUS_BISA_DIBATALKAN = frozenset({S.menunggu_pembayaran, S.menunggu_verifikasi})  # AB-08
STATUS_AKTIF = frozenset(S) - STATUS_AKHIR
# Pesanan yang pembayarannya sudah sah (dasar laporan penjualan).
STATUS_BERBAYAR = frozenset(
    {S.sedang_dirangkai, S.menunggu_persetujuan_foto, S.siap_diambil, S.diantar, S.selesai}
)

# Yang menunggu tindakan siapa (dasar penanda "perlu tindakan" dan notifikasi F-AD-03).
STATUS_TINDAKAN_PELANGGAN = frozenset({S.menunggu_pembayaran, S.menunggu_persetujuan_foto})
STATUS_TINDAKAN_ADMIN = frozenset({S.menunggu_verifikasi, S.sedang_dirangkai, S.siap_diambil, S.diantar})

_URUTAN_AMBIL = (S.menunggu_pembayaran, S.menunggu_verifikasi, S.sedang_dirangkai, S.menunggu_persetujuan_foto, S.siap_diambil, S.selesai)
_URUTAN_ANTAR = (S.menunggu_pembayaran, S.menunggu_verifikasi, S.sedang_dirangkai, S.menunggu_persetujuan_foto, S.diantar, S.selesai)


def info(status: StatusPesanan) -> InfoStatus:
    return INFO_STATUS[status]


def kunci_pesanan(db: Session, id_pesanan: int) -> Pesanan:
    """Mengambil pesanan dengan ``SELECT ... FOR UPDATE`` dan memaksa data segar dari basis data."""
    pesanan = db.scalar(
        select(Pesanan).where(Pesanan.id_pesanan == id_pesanan).with_for_update().execution_options(populate_existing=True)
    )
    if not pesanan:
        raise TidakDitemukan("Pesanan tidak ditemukan.")
    return pesanan


def pindah_status(db: Session, pesanan: Pesanan, ke: StatusPesanan, *, oleh: Pengguna | None, catatan: str | None = None) -> None:
    """Memindahkan status bila transisinya sah; ``oleh=None`` berarti dilakukan sistem (mis. penjadwal)."""
    lama = pesanan.status
    if ke not in TRANSISI_SAH[lama]:
        raise TransisiTidakSah(
            f"Pesanan berstatus '{info(lama).label}' tidak dapat dipindah ke '{info(ke).label}'.",
            rincian={"dari": lama.value, "ke": ke.value},
        )
    pesanan.status = ke
    db.add(
        RiwayatStatusPesanan(
            id_pesanan=pesanan.id_pesanan,
            status_lama=lama,
            status_baru=ke,
            id_pengguna=oleh.id_pengguna if oleh else None,
            catatan=catatan,
        )
    )
    db.flush()


def catat_status_awal(db: Session, pesanan: Pesanan, oleh: Pengguna) -> None:
    db.add(
        RiwayatStatusPesanan(
            id_pesanan=pesanan.id_pesanan,
            status_lama=None,
            status_baru=pesanan.status,
            id_pengguna=oleh.id_pengguna,
            catatan="Pesanan dibuat",
        )
    )
    db.flush()


def urutan_tahap(cara: CaraSerahTerima) -> tuple[StatusPesanan, ...]:
    return _URUTAN_ANTAR if cara == CaraSerahTerima.antar else _URUTAN_AMBIL


def tahap(pesanan: Pesanan) -> list[dict]:
    """Garis waktu tahap untuk pelanggan (F-PL-12). Pesanan dibatalkan hanya menampilkan tahap yang sempat dilalui."""
    urutan = urutan_tahap(pesanan.cara_serah_terima)
    if pesanan.status == S.dibatalkan:
        dilalui = {r.status_baru for r in pesanan.riwayat_status}
        urutan = tuple(t for t in urutan if t in dilalui) + (S.dibatalkan,)
    posisi = urutan.index(pesanan.status)
    hasil = []
    for indeks, kode in enumerate(urutan):
        keadaan = "selesai" if indeks < posisi else "aktif" if indeks == posisi else "belum"
        if pesanan.status in STATUS_AKHIR and indeks == posisi:
            keadaan = "selesai" if pesanan.status == S.selesai else "aktif"
        i = INFO_STATUS[kode]
        hasil.append({"kode": kode, "label": i.label, "ikon": i.ikon, "keterangan": i.keterangan, "keadaan": keadaan})
    return hasil
