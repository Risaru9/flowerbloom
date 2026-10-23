"""Persediaan: ``stok``, ``riwayat_pindai``, dan buku mutasi ``mutasi_stok``.

Model stok (keputusan desain, lihat docs/keputusan-desain.md):

* Satu baris ``stok`` per pasangan (jenis bunga, warna) - dijaga unique constraint.
* ``jumlah_tersedia`` = tangkai yang masih bisa dipesan (sudah dikurangi yang ditahan).
* ``jumlah_ditahan``  = tangkai yang dicadangkan pesanan yang belum dibayar/diverifikasi.
* Pesanan dibuat : tersedia -= n, ditahan += n   (atomik, hanya bila tersedia >= n)
* Batal/kedaluwarsa : ditahan -= n, tersedia += n
* Pembayaran sah    : ditahan -= n              (tangkai resmi terpakai)
* Setiap perubahan dicatat di ``mutasi_stok`` (audit dan angka "jumlah masuk" F-AD-13).
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.tipe import UTCDateTime
from app.core.waktu import sekarang_utc
from app.database import Base
from app.models.bunga import JenisBunga, Warna
from app.models.enums import JenisMutasi, KonteksPindai, kolom_enum


class Stok(Base):
    __tablename__ = "stok"
    __table_args__ = (
        UniqueConstraint("id_jenis_bunga", "id_warna", name="uq_stok_jenis_warna"),
        CheckConstraint("jumlah_tersedia >= 0", name="tersedia_tak_negatif"),
        CheckConstraint("jumlah_ditahan >= 0", name="ditahan_tak_negatif"),
        CheckConstraint("harga_per_tangkai >= 0", name="harga_tak_negatif"),
    )

    id_stok: Mapped[int] = mapped_column(primary_key=True)
    id_jenis_bunga: Mapped[int] = mapped_column(ForeignKey("jenis_bunga.id_jenis_bunga"))
    id_warna: Mapped[int] = mapped_column(ForeignKey("warna.id_warna"))
    jumlah_tersedia: Mapped[int] = mapped_column(Integer, default=0)
    jumlah_ditahan: Mapped[int] = mapped_column(Integer, default=0)
    harga_per_tangkai: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    tanggal_masuk: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)  # stok terakhir dicatat

    jenis_bunga: Mapped[JenisBunga] = relationship()
    warna: Mapped[Warna] = relationship()


class RiwayatPindai(Base):
    """Hasil model dan koreksi admin (F-AI-09, F-AD-18). Dipakai oleh pindai stok masuk maupun Mode Merangkai."""

    __tablename__ = "riwayat_pindai"

    id_pindai: Mapped[int] = mapped_column(primary_key=True)
    id_stok: Mapped[int | None] = mapped_column(ForeignKey("stok.id_stok"))  # terisi setelah disimpan sebagai stok
    id_pengguna: Mapped[int] = mapped_column(ForeignKey("pengguna.id_pengguna"))
    id_pesanan: Mapped[int | None] = mapped_column(ForeignKey("pesanan.id_pesanan"))  # untuk konteks mode_rangkai
    konteks: Mapped[KonteksPindai] = mapped_column(kolom_enum(KonteksPindai), default=KonteksPindai.stok_masuk)
    foto_pindai: Mapped[str] = mapped_column(String(255))
    jenis_prediksi: Mapped[str | None] = mapped_column(String(100))
    warna_prediksi: Mapped[str | None] = mapped_column(String(50))
    id_jenis_bunga_prediksi: Mapped[int | None] = mapped_column(ForeignKey("jenis_bunga.id_jenis_bunga"))
    id_warna_prediksi: Mapped[int | None] = mapped_column(ForeignKey("warna.id_warna"))
    tingkat_keyakinan: Mapped[float | None] = mapped_column(Float)
    dikenali: Mapped[bool] = mapped_column(Boolean, default=False)  # keyakinan >= ambang saat dipindai
    dikoreksi: Mapped[bool] = mapped_column(Boolean, default=False)
    id_jenis_bunga_final: Mapped[int | None] = mapped_column(ForeignKey("jenis_bunga.id_jenis_bunga"))
    id_warna_final: Mapped[int | None] = mapped_column(ForeignKey("warna.id_warna"))
    waktu_pindai: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)


class MutasiStok(Base):
    __tablename__ = "mutasi_stok"

    id_mutasi: Mapped[int] = mapped_column(primary_key=True)
    id_stok: Mapped[int] = mapped_column(ForeignKey("stok.id_stok"))
    jenis: Mapped[JenisMutasi] = mapped_column(kolom_enum(JenisMutasi))
    jumlah: Mapped[int] = mapped_column(Integer)  # selalu positif, kecuali 'koreksi' (selisih bertanda)
    id_pesanan: Mapped[int | None] = mapped_column(ForeignKey("pesanan.id_pesanan"))
    id_pengguna: Mapped[int | None] = mapped_column(ForeignKey("pengguna.id_pengguna"))  # kosong = sistem
    catatan: Mapped[str | None] = mapped_column(Text)
    waktu: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)
