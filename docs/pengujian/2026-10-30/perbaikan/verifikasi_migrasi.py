"""Regresi migrasi 0003. HANYA untuk database audit terpisah berakhiran _uji.

Jalankan dari backend dengan .venv dan UJI_MIGRASI_DATABASE_URL terisi.
Menurunkan ke 0002 akan membuang kolom baru; jangan arahkan ke database aplikasi.
"""
import os
import subprocess
import sys
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa

url = os.environ["UJI_MIGRASI_DATABASE_URL"]
assert sa.engine.make_url(url).database.endswith("_uji"), "Wajib database audit _uji"
env = {**os.environ, "DATABASE_URL": url}
engine = sa.create_engine(url)


def alembic(*args):
    subprocess.run([sys.executable, "-m", "alembic", *args], env=env, check=True)


alembic("upgrade", "head")
alembic("downgrade", "0002")
metadata = sa.MetaData()
metadata.reflect(engine)
now = datetime.now(UTC).replace(tzinfo=None)
with engine.begin() as c:
    pengguna = c.execute(metadata.tables["pengguna"].insert().values(
        nama="Regresi Migrasi", email=f"migrasi-{uuid4().hex[:12]}@example.com", password="dummy-no-login",
        peran="pelanggan", aktif=True, versi_sesi=0, dibuat_pada=now)).inserted_primary_key[0]
    pesanan = c.execute(metadata.tables["pesanan"].insert().values(
        id_pengguna=pengguna, kode_pesanan=f"MIG-{uuid4().hex[:12]}", nama_penerima="Penerima dummy",
        tanggal_kirim=now.date(), slot_jam="09:00-11:00", cara_serah_terima="ambil_di_toko",
        ongkos_antar=0, total_harga=150000, status="dibatalkan", jumlah_revisi=0,
        perlu_pengembalian_dana=False, dibuat_pada=now)).inserted_primary_key[0]
    for status in ["menunggu", "sah", "ditolak"]:
        c.execute(metadata.tables["pembayaran"].insert().values(
            id_pesanan=pesanan, bukti_transfer="uji-migrasi.jpg", nama_pengirim="Dummy", nominal=100000,
            status_verifikasi=status, diunggah_pada=now))

alembic("upgrade", "head")
alembic("check")
with engine.connect() as c:
    rows = dict(c.execute(sa.text("SELECT status_verifikasi, dana_diterima FROM pembayaran WHERE id_pesanan=:p"),
                          {"p": pesanan}).all())
    assert rows == {"menunggu": 0, "sah": 1, "ditolak": 0}, rows
    assert c.scalar(sa.text("SELECT COUNT(*) FROM pesanan WHERE id_pesanan=:p"), {"p": pesanan}) == 1
print("PASS: tiga pembayaran lama tetap ada; hanya pembayaran sah ditandai dana diterima", flush=True)
alembic("downgrade", "0002")
alembic("upgrade", "head")
alembic("check")
with engine.connect() as c:
    assert c.scalar(sa.text("SELECT COUNT(*) FROM pembayaran WHERE id_pesanan=:p"), {"p": pesanan}) == 3
    if engine.dialect.name == "sqlite":
        assert c.exec_driver_sql("PRAGMA foreign_key_check").first() is None
print("PASS: rollback/upgrade 0003 dan pemeriksaan skema", flush=True)
