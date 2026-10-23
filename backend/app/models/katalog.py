"""Katalog paket rangkaian siap pakai: ``produk`` dan ``komposisi_produk``."""
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.bunga import JenisBunga, Warna


class Produk(Base):
    __tablename__ = "produk"
    __table_args__ = (CheckConstraint("harga >= 0", name="harga_tak_negatif"),)

    id_produk: Mapped[int] = mapped_column(primary_key=True)
    nama_produk: Mapped[str] = mapped_column(String(100))
    acara: Mapped[str | None] = mapped_column(String(50))
    harga: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    foto_produk: Mapped[str | None] = mapped_column(String(255))
    deskripsi: Mapped[str | None] = mapped_column(Text)
    ditampilkan: Mapped[bool] = mapped_column(Boolean, default=True)

    komposisi: Mapped[list["KomposisiProduk"]] = relationship(
        back_populates="produk", cascade="all, delete-orphan", order_by="KomposisiProduk.id_komposisi"
    )


class KomposisiProduk(Base):
    __tablename__ = "komposisi_produk"
    __table_args__ = (CheckConstraint("jumlah_tangkai > 0", name="tangkai_positif"),)

    id_komposisi: Mapped[int] = mapped_column(primary_key=True)
    id_produk: Mapped[int] = mapped_column(ForeignKey("produk.id_produk", ondelete="CASCADE"))
    id_jenis_bunga: Mapped[int] = mapped_column(ForeignKey("jenis_bunga.id_jenis_bunga"))
    id_warna: Mapped[int] = mapped_column(ForeignKey("warna.id_warna"))
    jumlah_tangkai: Mapped[int] = mapped_column(Integer)

    produk: Mapped[Produk] = relationship(back_populates="komposisi")
    jenis_bunga: Mapped[JenisBunga] = relationship()
    warna: Mapped[Warna] = relationship()
