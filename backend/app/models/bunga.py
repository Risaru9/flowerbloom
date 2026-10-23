"""Data acuan bunga: ``jenis_bunga`` dan ``warna``."""
from sqlalchemy import CHAR, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class JenisBunga(Base):
    __tablename__ = "jenis_bunga"

    id_jenis_bunga: Mapped[int] = mapped_column(primary_key=True)
    nama_bunga: Mapped[str] = mapped_column(String(100))
    nama_ilmiah: Mapped[str | None] = mapped_column(String(150))
    # Nomor kelas 1..102 pada Oxford Flowers 102 (bukan indeks keluaran model; pemetaannya ada di ai/).
    kelas_dataset: Mapped[int | None] = mapped_column(unique=True)
    bentuk_bunga: Mapped[str | None] = mapped_column(String(100))
    deskripsi: Mapped[str | None] = mapped_column(Text)


class Warna(Base):
    """Satu-satunya sumber nama warna. Katalog, stok, komposisi pesanan, dan foto konfirmasi
    merujuk ke sini sehingga nama warna yang dilihat pelanggan selalu sama (prinsip 1 proposal)."""

    __tablename__ = "warna"

    id_warna: Mapped[int] = mapped_column(primary_key=True)
    nama_warna: Mapped[str] = mapped_column(String(50), unique=True)
    kode_hex: Mapped[str] = mapped_column(CHAR(7))
    makna_warna: Mapped[str | None] = mapped_column(Text)
