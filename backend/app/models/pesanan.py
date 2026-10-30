"""Transaksi: ``pesanan``, ``detail_pesanan``, ``komposisi_pesanan``, ``pembayaran``,
``foto_konfirmasi``, dan ``riwayat_status_pesanan``."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.tipe import JSONTeks, UTCDateTime
from app.core.waktu import sekarang_utc
from app.database import Base
from app.models.enums import (
    CaraSerahTerima,
    JenisItem,
    StatusPersetujuan,
    StatusPesanan,
    StatusVerifikasi,
    kolom_enum,
)
from app.models.katalog import Produk
from app.models.pengguna import Pengguna
from app.models.stok import Stok


class Pesanan(Base):
    __tablename__ = "pesanan"
    __table_args__ = (Index("uq_pesanan_kunci_checkout", "id_pengguna", "kunci_checkout", unique=True),)

    id_pesanan: Mapped[int] = mapped_column(primary_key=True)
    id_pengguna: Mapped[int] = mapped_column(ForeignKey("pengguna.id_pengguna"))
    kode_pesanan: Mapped[str] = mapped_column(String(20), unique=True)
    kunci_checkout: Mapped[str | None] = mapped_column(String(128))
    sidik_checkout: Mapped[str | None] = mapped_column(String(64))
    nama_penerima: Mapped[str] = mapped_column(String(100))
    alamat: Mapped[str | None] = mapped_column(Text)  # kosong bila diambil di toko
    tanggal_kirim: Mapped[date] = mapped_column(Date)
    slot_jam: Mapped[str] = mapped_column(String(20))
    cara_serah_terima: Mapped[CaraSerahTerima] = mapped_column(kolom_enum(CaraSerahTerima))
    kartu_ucapan: Mapped[str | None] = mapped_column(Text)
    ongkos_antar: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_harga: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[StatusPesanan] = mapped_column(
        kolom_enum(StatusPesanan), default=StatusPesanan.menunggu_pembayaran
    )
    jumlah_revisi: Mapped[int] = mapped_column(Integer, default=0)

    # Tambahan atas rancangan proposal (lihat docs/keputusan-desain.md)
    batas_bayar: Mapped[datetime | None] = mapped_column(UTCDateTime)  # AB-02
    alasan_batal: Mapped[str | None] = mapped_column(Text)
    perlu_pengembalian_dana: Mapped[bool] = mapped_column(Boolean, default=False)
    dibuat_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)
    diselesaikan_pada: Mapped[datetime | None] = mapped_column(UTCDateTime)  # dasar batas komplain 1x24 jam (AB-09)

    pelanggan: Mapped[Pengguna] = relationship()
    detail: Mapped[list["DetailPesanan"]] = relationship(
        back_populates="pesanan", cascade="all, delete-orphan", order_by="DetailPesanan.id_detail"
    )
    pembayaran: Mapped[list["Pembayaran"]] = relationship(
        back_populates="pesanan", cascade="all, delete-orphan", order_by="Pembayaran.id_pembayaran"
    )
    foto: Mapped[list["FotoKonfirmasi"]] = relationship(
        back_populates="pesanan", cascade="all, delete-orphan", order_by="FotoKonfirmasi.id_foto"
    )
    riwayat_status: Mapped[list["RiwayatStatusPesanan"]] = relationship(
        back_populates="pesanan", cascade="all, delete-orphan", order_by="RiwayatStatusPesanan.id_riwayat"
    )


class DetailPesanan(Base):
    __tablename__ = "detail_pesanan"

    id_detail: Mapped[int] = mapped_column(primary_key=True)
    id_pesanan: Mapped[int] = mapped_column(ForeignKey("pesanan.id_pesanan", ondelete="CASCADE"))
    id_produk: Mapped[int | None] = mapped_column(ForeignKey("produk.id_produk"))  # kosong bila rangkai sendiri
    jenis_item: Mapped[JenisItem] = mapped_column(kolom_enum(JenisItem))
    jumlah: Mapped[int] = mapped_column(Integer, default=1)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))  # harga saat dipesan (snapshot)

    pesanan: Mapped[Pesanan] = relationship(back_populates="detail")
    produk: Mapped[Produk | None] = relationship()
    komposisi: Mapped[list["KomposisiPesanan"]] = relationship(
        back_populates="detail", cascade="all, delete-orphan", order_by="KomposisiPesanan.id_komposisi_pesanan"
    )


class KomposisiPesanan(Base):
    """Bunga dari stok yang dipakai suatu rangkaian.

    Baris dibuat saat checkout (sekaligus menjadi catatan tangkai yang ditahan), lalu dipakai Mode
    Merangkai: ``jumlah_terpindai`` naik setiap bunga cocok. Bunga pengganti berupa baris baru
    (``is_pengganti``) yang menunjuk baris asal lewat ``id_komposisi_diganti``; jumlah baris asal dikurangi.
    """

    __tablename__ = "komposisi_pesanan"
    __table_args__ = (
        CheckConstraint("jumlah_tangkai >= 0", name="tangkai_tak_negatif"),
        CheckConstraint("jumlah_terpindai >= 0", name="terpindai_tak_negatif"),
    )

    id_komposisi_pesanan: Mapped[int] = mapped_column(primary_key=True)
    id_detail: Mapped[int] = mapped_column(ForeignKey("detail_pesanan.id_detail", ondelete="CASCADE"))
    id_stok: Mapped[int] = mapped_column(ForeignKey("stok.id_stok"))
    jumlah_tangkai: Mapped[int] = mapped_column(Integer)
    is_pengganti: Mapped[bool] = mapped_column(Boolean, default=False)
    alasan_pengganti: Mapped[str | None] = mapped_column(Text)
    # Tambahan atas rancangan proposal
    jumlah_terpindai: Mapped[int] = mapped_column(Integer, default=0)
    ditandai_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    id_komposisi_diganti: Mapped[int | None] = mapped_column(ForeignKey("komposisi_pesanan.id_komposisi_pesanan"))

    detail: Mapped[DetailPesanan] = relationship(back_populates="komposisi")
    stok: Mapped[Stok] = relationship()


class Pembayaran(Base):
    __tablename__ = "pembayaran"
    dana_diterima: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    id_pembayaran: Mapped[int] = mapped_column(primary_key=True)
    id_pesanan: Mapped[int] = mapped_column(ForeignKey("pesanan.id_pesanan", ondelete="CASCADE"))
    id_admin: Mapped[int | None] = mapped_column(ForeignKey("pengguna.id_pengguna"))
    bukti_transfer: Mapped[str] = mapped_column(String(255))
    nama_pengirim: Mapped[str] = mapped_column(String(100))
    nominal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status_verifikasi: Mapped[StatusVerifikasi] = mapped_column(
        kolom_enum(StatusVerifikasi), default=StatusVerifikasi.menunggu
    )
    waktu_verifikasi: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Tambahan atas rancangan proposal
    catatan_penolakan: Mapped[str | None] = mapped_column(Text)
    diunggah_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)

    pesanan: Mapped[Pesanan] = relationship(back_populates="pembayaran")


class FotoKonfirmasi(Base):
    __tablename__ = "foto_konfirmasi"

    id_foto: Mapped[int] = mapped_column(primary_key=True)
    id_pesanan: Mapped[int] = mapped_column(ForeignKey("pesanan.id_pesanan", ondelete="CASCADE"))
    file_foto: Mapped[str] = mapped_column(String(255))
    # Daftar {id_warna, nama_warna, kode_hex, persen}; kolom bertipe TEXT sesuai proposal, isinya JSON.
    label_warna: Mapped[list | None] = mapped_column(JSONTeks)
    status_persetujuan: Mapped[StatusPersetujuan] = mapped_column(
        kolom_enum(StatusPersetujuan), default=StatusPersetujuan.menunggu
    )
    catatan_revisi: Mapped[str | None] = mapped_column(Text)
    diunggah_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)
    ditanggapi_pada: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Ringkasan bunga pengganti saat foto diunggah (agar bukti tetap utuh walau data berubah kemudian)
    ringkasan_pengganti: Mapped[list | None] = mapped_column(JSONTeks)

    pesanan: Mapped[Pesanan] = relationship(back_populates="foto")


class RiwayatStatusPesanan(Base):
    """Jejak setiap perpindahan status: sumber garis waktu F-PL-12 dan bukti bila terjadi sengketa."""

    __tablename__ = "riwayat_status_pesanan"

    id_riwayat: Mapped[int] = mapped_column(primary_key=True)
    id_pesanan: Mapped[int] = mapped_column(ForeignKey("pesanan.id_pesanan", ondelete="CASCADE"))
    status_lama: Mapped[StatusPesanan | None] = mapped_column(kolom_enum(StatusPesanan))
    status_baru: Mapped[StatusPesanan] = mapped_column(kolom_enum(StatusPesanan))
    id_pengguna: Mapped[int | None] = mapped_column(ForeignKey("pengguna.id_pengguna"))  # kosong = sistem
    catatan: Mapped[str | None] = mapped_column(Text)
    waktu: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)

    pesanan: Mapped[Pesanan] = relationship(back_populates="riwayat_status")
