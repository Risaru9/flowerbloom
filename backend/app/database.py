"""Koneksi basis data dan kelas dasar model."""
from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import ambil_pengaturan

# Penamaan constraint yang konsisten agar migrasi Alembic dapat diprediksi.
KONVENSI_NAMA = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=KONVENSI_NAMA)


def buat_engine(url: str) -> Engine:
    """Membuat engine. SQLite (pengembangan/uji) mengaktifkan foreign key secara eksplisit."""
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)

    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _aktifkan_foreign_key(dbapi_connection, _catatan):  # pragma: no cover - dipanggil driver
            kursor = dbapi_connection.cursor()
            kursor.execute("PRAGMA foreign_keys=ON")
            kursor.close()

    return engine


engine = buat_engine(ambil_pengaturan().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Satu sesi per permintaan. Commit dilakukan eksplisit oleh router setelah layanan berhasil;
    bila terjadi galat, sesi ditutup tanpa commit sehingga seluruh perubahan dibatalkan."""
    with SessionLocal() as db:
        yield db
