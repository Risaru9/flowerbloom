from tests.bantu import KATA_SANDI, buat_pengguna, header_masuk

API = "/api/v1"


def test_daftar_lalu_masuk(client):
    r = client.post(f"{API}/auth/daftar", json={"nama": "Sari", "email": "Sari@Contoh.id", "kata_sandi": KATA_SANDI})
    assert r.status_code == 201, r.text
    assert r.json()["email"] == "sari@contoh.id"  # dinormalisasi
    assert r.json()["peran"] == "pelanggan"
    assert "password" not in r.json()

    r = client.post(f"{API}/auth/masuk", json={"email": "sari@contoh.id", "kata_sandi": KATA_SANDI})
    assert r.status_code == 200
    token = r.json()["access_token"]
    saya = client.get(f"{API}/auth/saya", headers={"Authorization": f"Bearer {token}"})
    assert saya.status_code == 200 and saya.json()["nama"] == "Sari"


def test_pendaftaran_tidak_bisa_menyetel_peran(client):
    r = client.post(
        f"{API}/auth/daftar",
        json={"nama": "Nakal", "email": "nakal@contoh.id", "kata_sandi": KATA_SANDI, "peran": "admin"},
    )
    assert r.status_code == 201
    assert r.json()["peran"] == "pelanggan"


def test_email_ganda_ditolak(client):
    data = {"nama": "Sari", "email": "sari@contoh.id", "kata_sandi": KATA_SANDI}
    assert client.post(f"{API}/auth/daftar", json=data).status_code == 201
    r = client.post(f"{API}/auth/daftar", json=data)
    assert r.status_code == 409 and r.json()["kode"] == "email_sudah_terdaftar"


def test_kata_sandi_terlalu_pendek_ditolak(client):
    r = client.post(f"{API}/auth/daftar", json={"nama": "Sari", "email": "s@contoh.id", "kata_sandi": "pendek"})
    assert r.status_code == 422 and r.json()["kode"] == "validasi_gagal"
    assert r.json()["rincian"][0]["bidang"] == "kata_sandi"


def test_kredensial_salah(client, db):
    buat_pengguna(db, "a@contoh.id")
    salah = client.post(f"{API}/auth/masuk", json={"email": "a@contoh.id", "kata_sandi": "salah-salah"})
    tak_ada = client.post(f"{API}/auth/masuk", json={"email": "tidakada@contoh.id", "kata_sandi": KATA_SANDI})
    assert salah.status_code == tak_ada.status_code == 401
    assert salah.json()["pesan"] == tak_ada.json()["pesan"]  # tidak membocorkan keberadaan email


def test_akun_nonaktif_tidak_bisa_masuk(client, db):
    pengguna = buat_pengguna(db, "mati@contoh.id")
    pengguna.aktif = False
    db.commit()
    r = client.post(f"{API}/auth/masuk", json={"email": "mati@contoh.id", "kata_sandi": KATA_SANDI})
    assert r.status_code == 403 and r.json()["kode"] == "akun_nonaktif"


def test_tanpa_token_ditolak(client):
    assert client.get(f"{API}/auth/saya").status_code == 401
    assert client.get(f"{API}/auth/saya", headers={"Authorization": "Bearer palsu"}).status_code == 401


def test_pengaturan_aksesibilitas_bawaan_dan_ubah(client, db):
    buat_pengguna(db, "a@contoh.id")
    h = header_masuk(client, "a@contoh.id")
    awal = client.get(f"{API}/aksesibilitas/saya", headers=h).json()
    assert awal == {
        "jenis_buta_warna": "normal",
        "penajaman_warna": False,
        "ukuran_teks": 100,
        "kecepatan_suara": 1.0,
        "tema": "terang",
    }
    r = client.patch(f"{API}/aksesibilitas/saya", headers=h, json={"jenis_buta_warna": "deutan", "ukuran_teks": 130})
    assert r.status_code == 200 and r.json()["jenis_buta_warna"] == "deutan" and r.json()["ukuran_teks"] == 130
    assert r.json()["tema"] == "terang"  # yang tidak dikirim tidak berubah
    assert client.patch(f"{API}/aksesibilitas/saya", headers=h, json={"ukuran_teks": 500}).status_code == 422
