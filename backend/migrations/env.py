"""Lingkungan Alembic. URL basis data dari DATABASE_URL (sama dengan aplikasi)."""
from logging.config import fileConfig

from alembic import context

import app.models  # noqa: F401  (mendaftarkan semua tabel pada metadata)
from app.config import ambil_pengaturan
from app.core.tipe import JSONTeks, UTCDateTime
from app.database import Base, buat_engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def render_item(tipe, obj, autogen_context):
    """Menulis tipe kolom khusus proyek sebagai tipe SQLAlchemy biasa agar berkas migrasi mandiri."""
    if tipe == "type":
        if isinstance(obj, UTCDateTime):
            return "sa.DateTime()"
        if isinstance(obj, JSONTeks):
            return "sa.Text()"
    return False


def jalankan_offline() -> None:
    context.configure(
        url=ambil_pengaturan().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_item=render_item,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def jalankan_online() -> None:
    engine = buat_engine(ambil_pengaturan().database_url)
    with engine.connect() as koneksi:
        context.configure(
            connection=koneksi,
            target_metadata=target_metadata,
            render_item=render_item,
            compare_type=True,
            render_as_batch=koneksi.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    jalankan_offline()
else:
    jalankan_online()
