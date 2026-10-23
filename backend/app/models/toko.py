"""Pengaturan toko (F-AD-16) sebagai pasangan kunci-nilai. Daftar kunci dan nilai bawaan ada di
``app/services/pengaturan_toko.py``; nilai disimpan sebagai JSON agar tipe (angka/daftar/teks) terjaga."""
from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.tipe import UTCDateTime
from app.core.waktu import sekarang_utc
from app.database import Base


class PengaturanToko(Base):
    __tablename__ = "pengaturan_toko"

    kunci: Mapped[str] = mapped_column(String(50), primary_key=True)
    nilai: Mapped[str] = mapped_column(Text)
    diperbarui_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc, onupdate=sekarang_utc)
