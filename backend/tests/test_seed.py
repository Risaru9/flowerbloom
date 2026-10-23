"""Data awal: kelengkapan 102 kelas, kepatuhan panjang kolom, idempotensi, dan data demo yang benar-benar dapat dipesan."""
from datetime import timedelta

from sqlalchemy import func, select

from app.core.waktu import hari_ini_wib
from app.data.jenis_bunga import JENIS_BUNGA_AWAL
from app.data.warna import WARNA_AWAL
from app.models.bunga import JenisBunga, Warna
from app.models.enums import Peran
from app.models.pengguna import Pengguna
from scripts import seed
from tests.bantu import buat_pengguna

API = "/api/v1"


def test_data_awal_lengkap_dan_sesuai_batas_kolom():
    kelas = [k for k, *_ in JENIS_BUNGA_AWAL]
    assert sorted(kelas) == list(range(1, 103))  # tepat 102 kelas, tanpa duplikat/lubang
    for k, nama, ilmiah, bentuk, nama_dataset in JENIS_BUNGA_AWAL:
        assert 2 <= len(nama) <= 100 and (ilmiah is None or len(ilmiah) <= 150) and (bentuk is None or len(bentuk) <= 100)
        assert nama_dataset
    nama_warna = [n for n, _, _ in WARNA_AWAL]
    assert len(set(nama_warna)) == len(nama_warna)
    assert all(len(h) == 7 and h.startswith("#") and int(h[1:], 16) >= 0 for _, h, _ in WARNA_AWAL)
    assert {"Putih", "Merah tua", "Merah muda", "Kuning"} <= set(nama_warna)


def test_seed_referensi_idempoten_dan_tidak_menimpa_perubahan_admin(db):
    assert seed.seed_referensi(db) == (len(WARNA_AWAL), 102)
    db.commit()
    mawar = db.scalar(select(JenisBunga).where(JenisBunga.kelas_dataset == 74))
    assert mawar.nama_bunga == "Mawar" and mawar.bentuk_bunga == "kelopak berlapis"
    mawar.nama_bunga = "Mawar (diubah admin)"
    db.commit()

    assert seed.seed_referensi(db) == (0, 0)
    db.commit()
    assert db.scalar(select(func.count()).select_from(JenisBunga)) == 102
    assert db.scalar(select(JenisBunga.nama_bunga).where(JenisBunga.kelas_dataset == 74)) == "Mawar (diubah admin)"
    assert db.scalar(select(func.count()).select_from(Warna)) == len(WARNA_AWAL)


def test_seed_admin_hanya_bila_belum_ada_admin(db, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "sandi-admin-dari-env-1")
    from app.config import ambil_pengaturan

    ambil_pengaturan.cache_clear()
    try:
        assert seed.seed_admin(db) is None  # kata sandi dari env tidak dikembalikan/dicetak
        db.commit()
        assert db.scalar(select(func.count()).select_from(Pengguna).where(Pengguna.peran == Peran.admin)) == 1
        assert seed.seed_admin(db) is None
        assert db.scalar(select(func.count()).select_from(Pengguna).where(Pengguna.peran == Peran.admin)) == 1
    finally:
        monkeypatch.undo()
        ambil_pengaturan.cache_clear()


def test_seed_admin_membuat_kata_sandi_acak_bila_tidak_diatur(db, client):
    from app.config import ambil_pengaturan

    assert ambil_pengaturan().admin_password is None
    kata_sandi = seed.seed_admin(db)
    db.commit()
    assert kata_sandi and len(kata_sandi) >= 12
    masuk = client.post(f"{API}/auth/masuk", json={"email": ambil_pengaturan().admin_email, "kata_sandi": kata_sandi})
    assert masuk.status_code == 200 and masuk.json()["pengguna"]["peran"] == "admin"


def test_data_demo_dapat_dipesan_sampai_akhir(client, db):
    seed.seed_referensi(db)
    buat_pengguna(db, "admin@contoh.id", Peran.admin)
    hasil = seed.seed_demo(db)
    db.commit()
    assert hasil == {"paket": len(seed.PAKET_CONTOH), "pelanggan": 1}
    assert seed.seed_demo(db) == {"paket": 0, "pelanggan": 0}  # idempoten

    katalog = client.get(f"{API}/produk").json()
    assert len(katalog) == len(seed.PAKET_CONTOH) and all(p["dapat_dipesan"] for p in katalog)
    # Setiap paket demo memakai foto contoh dari rancangan (scripts/foto_demo).
    assert all(p["foto_url"] for p in katalog)
    buket = next(p for p in katalog if p["nama_produk"] == "Pesona Merah")
    assert [k["deskripsi"] for k in buket["komposisi"]] == [
        "Mawar merah dengan kelopak berlapis",
        "Anyelir merah dengan kelopak bergerigi berlapis",
    ]

    masuk = client.post(
        f"{API}/auth/masuk", json={"email": seed.EMAIL_PELANGGAN_CONTOH, "kata_sandi": seed.KATA_SANDI_PELANGGAN_CONTOH}
    )
    assert masuk.status_code == 200
    h = {"Authorization": f"Bearer {masuk.json()['access_token']}"}
    r = client.post(f"{API}/pesanan", headers=h, json={
        "items": [{"jenis_item": "paket", "id_produk": buket["id_produk"], "jumlah": 1}],
        "nama_penerima": "Ibu", "cara_serah_terima": "ambil_di_toko", "slot_jam": "09:00-11:00",
        "tanggal_kirim": (hari_ini_wib() + timedelta(days=1)).isoformat()})
    assert r.status_code == 201, r.text


def test_demo_ditolak_di_produksi(db, monkeypatch):
    import pytest

    from app.config import ambil_pengaturan

    monkeypatch.setenv("LINGKUNGAN", "produksi")
    monkeypatch.setenv("JWT_RAHASIA", "x" * 40)
    ambil_pengaturan.cache_clear()
    try:
        with pytest.raises(SystemExit):
            seed.seed_demo(db)
    finally:
        monkeypatch.undo()
        ambil_pengaturan.cache_clear()
