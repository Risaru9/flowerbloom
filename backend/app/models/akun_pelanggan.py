"""Data milik pelanggan di luar pesanan: ``favorit`` (produk yang disimpan) dan ``alamat`` (alamat pengiriman tersimpan).

Keduanya tidak ada di ERD proposal; ditambahkan karena rancangan antarmuka (Figma) memiliki halaman Produk Favorit dan
Alamat Tersimpan. Lihat docs/keputusan-desain.md bagian A.
"""
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.tipe import UTCDateTime
from app.core.waktu import sekarang_utc
from app.database import Base
from app.models.katalog import Produk


class Favorit(Base):
    __tablename__ = "favorit"
    __table_args__ = (UniqueConstraint("id_pengguna", "id_produk", name="favorit_unik"),)

    id_favorit: Mapped[int] = mapped_column(primary_key=True)
    id_pengguna: Mapped[int] = mapped_column(ForeignKey("pengguna.id_pengguna", ondelete="CASCADE"), index=True)
    id_produk: Mapped[int] = mapped_column(ForeignKey("produk.id_produk", ondelete="CASCADE"))
    dibuat_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)

    produk: Mapped[Produk] = relationship()


class Alamat(Base):
    __tablename__ = "alamat"

    id_alamat: Mapped[int] = mapped_column(primary_key=True)
    id_pengguna: Mapped[int] = mapped_column(ForeignKey("pengguna.id_pengguna", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(50))  # mis. "Rumah", "Kantor"
    nama_penerima: Mapped[str] = mapped_column(String(100))
    no_hp: Mapped[str] = mapped_column(String(20))
    alamat: Mapped[str] = mapped_column(Text)
    catatan: Mapped[str | None] = mapped_column(String(255))  # patokan untuk kurir
    utama: Mapped[bool] = mapped_column(Boolean, default=False)
    dibuat_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)
