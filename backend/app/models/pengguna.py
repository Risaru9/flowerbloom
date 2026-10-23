"""Data pengguna: tabel ``pengguna`` dan ``pengaturan_aksesibilitas``."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.tipe import UTCDateTime
from app.core.waktu import sekarang_utc
from app.database import Base
from app.models.enums import JenisButaWarna, Peran, Tema, kolom_enum


class Pengguna(Base):
    __tablename__ = "pengguna"

    id_pengguna: Mapped[int] = mapped_column(primary_key=True)
    nama: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100), unique=True)
    no_hp: Mapped[str | None] = mapped_column(String(20))
    password: Mapped[str] = mapped_column(String(255))  # hash bcrypt, bukan kata sandi asli
    peran: Mapped[Peran] = mapped_column(kolom_enum(Peran), default=Peran.pelanggan)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)  # F-AD-17: akun admin dapat dinonaktifkan
    dibuat_pada: Mapped[datetime] = mapped_column(UTCDateTime, default=sekarang_utc)
    # Versi sesi ikut tertulis di token; dinaikkan saat ganti kata sandi atau "keluar dari semua perangkat" sehingga
    # semua token lama langsung ditolak (tidak bergantung pada presisi jam).
    versi_sesi: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    pengaturan_aksesibilitas: Mapped["PengaturanAksesibilitas"] = relationship(
        back_populates="pengguna", uselist=False, cascade="all, delete-orphan"
    )


class PengaturanAksesibilitas(Base):
    __tablename__ = "pengaturan_aksesibilitas"
    __table_args__ = (
        CheckConstraint("ukuran_teks BETWEEN 80 AND 200", name="ukuran_teks_wajar"),
        CheckConstraint("kecepatan_suara BETWEEN 0.5 AND 2.0", name="kecepatan_suara_wajar"),
    )

    id_pengaturan: Mapped[int] = mapped_column(primary_key=True)
    id_pengguna: Mapped[int] = mapped_column(ForeignKey("pengguna.id_pengguna", ondelete="CASCADE"), unique=True)
    jenis_buta_warna: Mapped[JenisButaWarna] = mapped_column(kolom_enum(JenisButaWarna), default=JenisButaWarna.normal)
    penajaman_warna: Mapped[bool] = mapped_column(Boolean, default=False)
    ukuran_teks: Mapped[int] = mapped_column(Integer, default=100)  # persen dari ukuran dasar
    kecepatan_suara: Mapped[float] = mapped_column(Float, default=1.0)
    tema: Mapped[Tema] = mapped_column(kolom_enum(Tema), default=Tema.terang)

    pengguna: Mapped[Pengguna] = relationship(back_populates="pengaturan_aksesibilitas")
