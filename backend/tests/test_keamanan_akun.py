"""Ganti kata sandi, pencabutan sesi, dan pembatas percobaan masuk."""
from app.core.pembatas import PembatasPercobaan
from app.core.errors import TerlaluBanyak
from app.models.enums import Peran
from tests.bantu import KATA_SANDI, buat_pengguna, header_masuk

API = "/api/v1"


def test_ganti_kata_sandi_mencabut_sesi_lama(client, db):
    buat_pengguna(db, "rani@contoh.id")
    lama_hp = header_masuk(client, "rani@contoh.id")  # sesi di perangkat lain
    lama = header_masuk(client, "rani@contoh.id")

    r = client.patch(f"{API}/auth/kata-sandi", headers=lama, json={"kata_sandi_lama": "salah-total", "kata_sandi_baru": "sandi-baru-456"})
    assert r.status_code == 422 and r.json()["kode"] == "kata_sandi_lama_salah"
    r = client.patch(f"{API}/auth/kata-sandi", headers=lama, json={"kata_sandi_lama": KATA_SANDI, "kata_sandi_baru": KATA_SANDI})
    assert r.status_code == 422 and r.json()["kode"] == "kata_sandi_sama"
    r = client.patch(f"{API}/auth/kata-sandi", headers=lama, json={"kata_sandi_lama": KATA_SANDI, "kata_sandi_baru": "pendek"})
    assert r.status_code == 422

    r = client.patch(f"{API}/auth/kata-sandi", headers=lama, json={"kata_sandi_lama": KATA_SANDI, "kata_sandi_baru": "sandi-baru-456"})
    assert r.status_code == 200, r.text
    baru = {"Authorization": f"Bearer {r.json()['access_token']}"}

    # Token baru tetap berlaku; semua token yang terbit sebelumnya dicabut.
    assert client.get(f"{API}/auth/saya", headers=baru).status_code == 200
    for h in (lama, lama_hp):
        r = client.get(f"{API}/auth/saya", headers=h)
        assert r.status_code == 401 and r.json()["kode"] == "sesi_dicabut"

    # Kata sandi lama tidak bisa dipakai masuk, yang baru bisa.
    assert client.post(f"{API}/auth/masuk", json={"email": "rani@contoh.id", "kata_sandi": KATA_SANDI}).status_code == 401
    assert client.post(f"{API}/auth/masuk", json={"email": "rani@contoh.id", "kata_sandi": "sandi-baru-456"}).status_code == 200


def test_keluar_dari_semua_perangkat(client, db):
    buat_pengguna(db, "admin@contoh.id", Peran.admin)
    h = header_masuk(client, "admin@contoh.id")
    assert client.post(f"{API}/auth/keluar-semua", headers=h).status_code == 204
    assert client.get(f"{API}/auth/saya", headers=h).status_code == 401
    assert client.get(f"{API}/admin/dasbor", headers=h).status_code == 401
    # Masuk lagi menghasilkan sesi baru yang sah.
    assert client.get(f"{API}/auth/saya", headers=header_masuk(client, "admin@contoh.id")).status_code == 200


def test_masuk_dikunci_setelah_terlalu_banyak_gagal(client, db):
    buat_pengguna(db, "budi@contoh.id")
    salah = {"email": "budi@contoh.id", "kata_sandi": "tebakan"}
    for _ in range(5):
        assert client.post(f"{API}/auth/masuk", json=salah).status_code == 401
    r = client.post(f"{API}/auth/masuk", json=salah)
    assert r.status_code == 429 and r.json()["kode"] == "terlalu_banyak_percobaan"
    # Kata sandi benar pun ditahan selama terkunci, agar penebak tidak bisa memastikan tebakannya.
    r = client.post(f"{API}/auth/masuk", json={"email": "budi@contoh.id", "kata_sandi": KATA_SANDI})
    assert r.status_code == 429
    # Akun lain dari IP yang sama belum terdampak (batas per IP lebih longgar).
    buat_pengguna(db, "citra@contoh.id")
    assert client.post(f"{API}/auth/masuk", json={"email": "citra@contoh.id", "kata_sandi": KATA_SANDI}).status_code == 200


def test_masuk_berhasil_mengosongkan_hitungan_gagal(client, db):
    buat_pengguna(db, "dewi@contoh.id")
    for _ in range(4):
        client.post(f"{API}/auth/masuk", json={"email": "dewi@contoh.id", "kata_sandi": "tebakan"})
    assert client.post(f"{API}/auth/masuk", json={"email": "dewi@contoh.id", "kata_sandi": KATA_SANDI}).status_code == 200
    for _ in range(4):
        assert client.post(f"{API}/auth/masuk", json={"email": "dewi@contoh.id", "kata_sandi": "tebakan"}).status_code == 401


def test_pembatas_membuka_kembali_setelah_jendela_lewat():
    waktu = [1000.0]
    pembatas = PembatasPercobaan(2, 60, jam=lambda: waktu[0])
    pembatas.gagal("k")
    pembatas.gagal("k")
    try:
        pembatas.periksa("k")
        raise AssertionError("seharusnya terkunci")
    except TerlaluBanyak as e:
        assert e.rincian == {"coba_lagi_menit": 1}
    waktu[0] += 61
    pembatas.periksa("k")  # tidak melempar lagi
