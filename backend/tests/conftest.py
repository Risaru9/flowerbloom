"""Fixture uji. Lingkungan diatur SEBELUM aplikasi diimpor: basis data SQLite di memori, folder berkas sementara,
penjadwal mati, pengenalan jenis otomatis nonaktif (seperti produksi; tes yang butuh klasifikator memakai fixture
``klasifikator``)."""
import os
import tempfile

_FOLDER_UJI = tempfile.mkdtemp(prefix="flowerbloom-uji-")
os.environ.update(
    {
        "DATABASE_URL": "sqlite://",
        "DIREKTORI_BERKAS": _FOLDER_UJI,
        "PENJADWAL_AKTIF": "false",
        "JWT_RAHASIA": "rahasia-khusus-uji-yang-cukup-panjang-32-byte",
        "AI_MODE": "nonaktif",
        "LINGKUNGAN": "pengembangan",
        "BCRYPT_RONDE": "4",  # minimum bcrypt; mempercepat pengujian
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

import app.models  # noqa: E402,F401  (mendaftarkan semua tabel)
from app.database import Base, buat_engine, get_db  # noqa: E402
from app.main import app  # noqa: E402

# Basis data eksternal (mis. MySQL) untuk membuktikan perilaku yang tidak dapat diuji di SQLite, terutama kunci baris
# dan benturan transaksi sungguhan. Isinya DIKOSONGKAN setiap tes, jadi namanya wajib berakhiran "_uji".
URL_UJI_EKSTERNAL = os.environ.get("UJI_DATABASE_URL")


def _kosongkan(mesin) -> None:
    """Mengosongkan tabel yang berisi dan mengembalikan penghitung ID ke awal (MySQL)."""
    with mesin.begin() as koneksi:
        koneksi.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for tabel in reversed(Base.metadata.sorted_tables):
            # Nama tabel berasal dari metadata model, bukan dari masukan pengguna.
            if koneksi.execute(text(f"SELECT 1 FROM `{tabel.name}` LIMIT 1")).first() is not None:  # noqa: S608
                koneksi.execute(text(f"TRUNCATE TABLE `{tabel.name}`"))
        koneksi.execute(text("SET FOREIGN_KEY_CHECKS=1"))


@pytest.fixture(scope="session")
def _mesin_eksternal():
    if not URL_UJI_EKSTERNAL:
        yield None
        return
    nama = make_url(URL_UJI_EKSTERNAL).database or ""
    assert nama.endswith("_uji"), (
        f"UJI_DATABASE_URL menunjuk '{nama}'. Nama basis data uji harus berakhiran '_uji' karena isinya dikosongkan "
        "setiap tes; tolak agar data sungguhan tidak terhapus."
    )
    mesin = buat_engine(URL_UJI_EKSTERNAL)
    Base.metadata.drop_all(mesin)
    Base.metadata.create_all(mesin)
    yield mesin
    mesin.dispose()


@pytest.fixture()
def engine(_mesin_eksternal):
    if _mesin_eksternal is not None:
        _kosongkan(_mesin_eksternal)
        yield _mesin_eksternal
        return
    mesin = buat_engine("sqlite://")
    Base.metadata.create_all(mesin)
    yield mesin
    mesin.dispose()


@pytest.fixture()
def mesin_konkurensi(engine, tmp_path):
    """Mesin dengan banyak koneksi sungguhan untuk uji serentak. Di SQLite memakai berkas sementara
    (penulis diserialkan, jadi hanya membuktikan logika); di basis data eksternal memakai mesin yang sama
    sehingga kunci baris dan isolasi transaksi yang sebenarnya ikut terbukti."""
    if URL_UJI_EKSTERNAL:
        yield engine
        return
    mesin = buat_engine(f"sqlite:///{tmp_path / 'konkurensi.db'}")
    Base.metadata.create_all(mesin)
    yield mesin
    mesin.dispose()


@pytest.fixture(autouse=True)
def _reset_pembatas():
    """Pembatas percobaan masuk menyimpan keadaan di memori proses; kosongkan agar tes tidak saling memengaruhi."""
    from app.core.pembatas import reset_semua

    reset_semua()
    yield
    reset_semua()


@pytest.fixture()
def pabrik_sesi(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db(pabrik_sesi):
    with pabrik_sesi() as sesi:
        yield sesi


class KlasifikatorUji:
    """Klasifikator terkendali: tes menentukan kelas dan keyakinan yang dijawab."""

    def __init__(self):
        self.kelas = 74
        self.keyakinan = 0.95

    def klasifikasi(self, gambar):
        from app.ai.klasifikator import HasilKlasifikasi

        return HasilKlasifikasi(self.kelas, self.keyakinan)


@pytest.fixture()
def klasifikator(monkeypatch):
    from app.services import pindai

    uji = KlasifikatorUji()
    monkeypatch.setattr(pindai, "ambil_klasifikator", lambda: uji)
    return uji


@pytest.fixture()
def client(pabrik_sesi):
    def _ganti_db():
        with pabrik_sesi() as sesi:
            yield sesi

    app.dependency_overrides[get_db] = _ganti_db
    with TestClient(app) as klien:
        yield klien
    app.dependency_overrides.clear()
