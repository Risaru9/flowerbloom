"""Regresi temuan audit, melalui kontrak API pelanggan/admin."""
import pytest
from sqlalchemy.engine import make_url

from app.config import Pengaturan
from tests.skenario import API, Toko


def test_checkout_retry_dan_kunci_berbeda_payload(client, db):
    toko = Toko(client, db).stok_standar()
    headers = {**toko.pel, "Idempotency-Key": "checkout-uji-1234"}
    data = toko.isi_checkout()
    pertama = client.post(f"{API}/pesanan", headers=headers, json=data)
    ulang = client.post(f"{API}/pesanan", headers=headers, json=data)
    assert pertama.status_code == ulang.status_code == 201
    assert pertama.json()["id_pesanan"] == ulang.json()["id_pesanan"]
    assert toko.stok("Mawar/Merah tua")["jumlah_ditahan"] == 6
    data["nama_penerima"] = "Penerima berbeda"
    assert client.post(f"{API}/pesanan", headers=headers, json=data).status_code == 409
    assert toko.stok("Mawar/Merah tua")["jumlah_ditahan"] == 6
    # Kunci milik pelanggan pertama tidak boleh mengungkap pesanannya ke pelanggan lain.
    lain = client.post(f"{API}/pesanan", headers={**toko.pel2, "Idempotency-Key": "checkout-uji-1234"}, json=data)
    assert lain.status_code == 201 and lain.json()["id_pesanan"] != pertama.json()["id_pesanan"]


@pytest.mark.parametrize("kebijakan,wajib", [("semua_pengganti", True), ("hanya_warna_berbeda", False)])
def test_persetujuan_pengganti_warna_sama_mengikuti_kebijakan(client, db, kebijakan, wajib):
    toko = Toko(client, db).stok_standar()
    putih = toko.isi_stok("Mawar", "Putih", 10)
    client.patch(f"{API}/admin/pengaturan-toko", headers=toko.admin,
                 json={"pengaturan": {"kebijakan_pengganti": kebijakan}})
    p = toko.pesan()["id_pesanan"]
    toko.bayar(p)
    toko.sahkan(p)
    baris = toko.merangkai(p)["pesanan"]["detail"][0]["komposisi"]
    asal = next(k for k in baris if k["id_stok"] == toko.id_stok["Anyelir/Putih"])
    r = client.post(f"{API}/admin/pesanan/{p}/merangkai/pengganti", headers=toko.admin, json={
        "id_komposisi_asal": asal["id_komposisi_pesanan"], "id_stok_pengganti": putih,
        "jumlah": 6, "alasan": "Tangkai anyelir rusak"})
    assert r.status_code == 200
    for k in toko.merangkai(p)["pesanan"]["detail"][0]["komposisi"]:
        sisa = k["jumlah_tangkai"] - k["jumlah_terpindai"]
        if sisa > 0:
            assert client.post(f"{API}/admin/pesanan/{p}/merangkai/tandai-cocok", headers=toko.admin,
                               json={"id_komposisi_pesanan": k["id_komposisi_pesanan"], "jumlah": sisa}).status_code == 200
    assert toko.foto_hasil(p).status_code == 200
    foto = toko.lihat(p)["foto"][-1]
    assert foto["perlu_persetujuan_pengganti"] is wajib
    assert foto["pengganti"][0]["warna_berbeda"] is False
    r = toko.tanggapi(p, keputusan="setuju")
    assert r.status_code == (409 if wajib else 200)
    if wajib:
        assert toko.tanggapi(p, keputusan="setuju", setuju_pengganti=True).status_code == 200


@pytest.mark.parametrize("diterima", [False, True])
def test_dana_parsial_yang_dikonfirmasi_ditandai_saat_batal(client, db, diterima):
    toko = Toko(client, db).stok_standar()
    p = toko.pesan()["id_pesanan"]
    toko.bayar(p, nominal="100000")
    b = toko._id_pembayaran_terakhir(p)
    r = client.post(f"{API}/admin/pesanan/{p}/pembayaran/{b}/tolak", headers=toko.admin,
                    json={"catatan": "Dana kurang", "dana_diterima": diterima})
    assert r.status_code == 200 and r.json()["pembayaran"][-1]["dana_diterima"] is diterima
    assert client.post(f"{API}/pesanan/{p}/batal", headers=toko.pel, json={}).status_code == 200
    detail = client.get(f"{API}/admin/pesanan/{p}", headers=toko.admin).json()
    assert detail["perlu_pengembalian_dana"] is diterima


def test_identitas_warna_terpakai_tetap_utuh(client, db):
    toko = Toko(client, db).stok_standar()
    p = toko.pesan()["id_pesanan"]
    wid = toko.warna["Merah tua"].id_warna
    r = client.patch(f"{API}/admin/warna/{wid}", headers=toko.admin,
                     json={"nama_warna": "Biru laut", "kode_hex": "#0000FF"})
    assert r.status_code == 409 and r.json()["kode"] == "warna_sudah_digunakan"
    assert toko.lihat(p)["detail"][0]["komposisi"][0]["warna"]["nama_warna"] == "Merah tua"
    assert client.patch(f"{API}/admin/warna/{wid}", headers=toko.admin, json={"makna_warna": "Makna diperbarui"}).status_code == 200


def test_url_mysql_karakter_khusus_tidak_merusak_host():
    p = Pengaturan(_env_file=None, mysql_host="db", mysql_password="abc@123:/?#%", mysql_user="florist")
    url = make_url(p.database_url)
    assert url.host == "db" and url.password == "abc@123:/?#%" and url.username == "florist"


@pytest.mark.parametrize("rahasia", ["ganti-dengan-string-acak-minimal-32-karakter", "a" * 40])
def test_secret_placeholder_ditolak(rahasia):
    with pytest.raises(ValueError):
        Pengaturan(_env_file=None, lingkungan="produksi", jwt_rahasia=rahasia)
