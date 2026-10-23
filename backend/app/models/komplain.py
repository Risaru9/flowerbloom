"""Komplain pelanggan (F-PL-16, AB-09)."""
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.tipe import UTCDateTime
from app.core.waktu import sekarang_utc
from app.database import Base
from app.models.enums import StatusKomplain, kolom_enum
from app.models.pesanan import Pesanan


class Komplain(Base):
    __tablename__ = "komplain"

    id_komplain: Mapped[int] = mapped_column(primary_key=True)
    id_pesanan: Mapped[int] = mapped_column(ForeignKey("pesanan.id_pesanan"))
    id_pengguna: Mapped[int] = mapped_column(ForeignKey("pengguna.id_pengguna"))
    isi: Mapped[str] = mapped_column(Text)
    foto_komplain: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[StatusKomplain] = mapped_column(kolom_enum(StatusKomplain), default=StatusKomplain.baru)
    tanggapan_admin: Mapped[str | None] = mapped_column(Text)
    id_admin: Mapped[int | None] = mapped_column(ForeignKey("pengguna.id_pengguna"))
    dibuat_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)
    ditanggapi_pada: Mapped[datetime | None] = mapped_column(UTCDateTime)

    pesanan: Mapped[Pesanan] = relationship()
