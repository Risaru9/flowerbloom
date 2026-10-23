"""Produk favorit dan alamat tersimpan: idempotensi, kepemilikan, aturan alamat utama, dan pembatasan peran."""
from tests.skenario import API, Toko

ALAMAT = {
    "label": "Rumah",
    "nama_penerima": "Alya Putri",
    "no_hp": "0813 6724 9105",
    "alamat": "Jl. Ketintang Baru No. 18, Surabaya",
}


def test_favorit_idempoten_dan_terurut(client, db):
    toko = Toko(client, db).stok_standar()
    assert client.get(f"{API}/favorit", headers=toko.pel).json() == []

    for _ in range(2):  # simpan dua kali tetap satu baris
        r = client.put(f"{API}/favorit/{toko.id_paket}", headers=toko.pel)
        assert r.status_code == 204, r.text
    daftar = client.get(f"{API}/favorit", headers=toko.pel).json()
    assert [p["id_produk"] for p in daftar] == [toko.id_paket]
    assert daftar[0]["komposisi"] and daftar[0]["narasi"]

    # Favorit milik pelanggan lain tidak terlihat.
    assert client.get(f"{API}/favorit", headers=toko.pel2).json() == []

    for _ in range(2):  # hapus dua kali tidak galat
        assert client.delete(f"{API}/favorit/{toko.id_paket}", headers=toko.pel).status_code == 204
    assert client.get(f"{API}/favorit", headers=toko.pel).json() == []


def test_favorit_produk_tidak_ada_atau_disembunyikan(client, db):
    toko = Toko(client, db).stok_standar()
    assert client.put(f"{API}/favorit/9999", headers=toko.pel).status_code == 404

    client.put(f"{API}/favorit/{toko.id_paket}", headers=toko.pel)
    r = client.patch(f"{API}/admin/produk/{toko.id_paket}", headers=toko.admin, json={"ditampilkan": False})
    assert r.status_code == 200
    # Produk yang disembunyikan admin tidak muncul di daftar favorit, tetapi barisnya tidak hilang.
    assert client.get(f"{API}/favorit", headers=toko.pel).json() == []
    client.patch(f"{API}/admin/produk/{toko.id_paket}", headers=toko.admin, json={"ditampilkan": True})
    assert len(client.get(f"{API}/favorit", headers=toko.pel).json()) == 1


def test_favorit_dan_alamat_hanya_untuk_pelanggan(client, db):
    toko = Toko(client, db)
    assert client.get(f"{API}/favorit").status_code == 401
    assert client.get(f"{API}/alamat").status_code == 401
    assert client.get(f"{API}/favorit", headers=toko.admin).status_code == 403
    assert client.post(f"{API}/alamat", headers=toko.admin, json=ALAMAT).status_code == 403


def test_alamat_pertama_otomatis_utama_dan_hanya_satu_utama(client, db):
    toko = Toko(client, db)
    a = client.post(f"{API}/alamat", headers=toko.pel, json=ALAMAT)
    assert a.status_code == 201, a.text
    assert a.json()["utama"] is True

    b = client.post(f"{API}/alamat", headers=toko.pel, json={**ALAMAT, "label": "Kantor", "utama": True}).json()
    daftar = client.get(f"{API}/alamat", headers=toko.pel).json()
    assert [x["id_alamat"] for x in daftar if x["utama"]] == [b["id_alamat"]]
    assert daftar[0]["id_alamat"] == b["id_alamat"]  # utama lebih dulu

    # Jadikan yang pertama utama lagi lewat PATCH.
    r = client.patch(f"{API}/alamat/{a.json()['id_alamat']}", headers=toko.pel, json={"utama": True})
    assert r.status_code == 200 and r.json()["utama"] is True
    daftar = client.get(f"{API}/alamat", headers=toko.pel).json()
    assert sum(x["utama"] for x in daftar) == 1

    # Mencabut status utama tanpa memilih pengganti ditolak.
    r = client.patch(f"{API}/alamat/{a.json()['id_alamat']}", headers=toko.pel, json={"utama": False})
    assert r.status_code == 422 and r.json()["kode"] == "data_tidak_valid"


def test_hapus_alamat_utama_mengangkat_alamat_lain(client, db):
    toko = Toko(client, db)
    a = client.post(f"{API}/alamat", headers=toko.pel, json=ALAMAT).json()
    b = client.post(f"{API}/alamat", headers=toko.pel, json={**ALAMAT, "label": "Kantor"}).json()
    assert client.delete(f"{API}/alamat/{a['id_alamat']}", headers=toko.pel).status_code == 204
    daftar = client.get(f"{API}/alamat", headers=toko.pel).json()
    assert [(x["id_alamat"], x["utama"]) for x in daftar] == [(b["id_alamat"], True)]


def test_alamat_milik_orang_lain_tidak_terjangkau(client, db):
    toko = Toko(client, db)
    a = client.post(f"{API}/alamat", headers=toko.pel, json=ALAMAT).json()
    jalur = f"{API}/alamat/{a['id_alamat']}"
    assert client.patch(jalur, headers=toko.pel2, json={"label": "Curian"}).status_code == 404
    assert client.delete(jalur, headers=toko.pel2).status_code == 404
    assert client.get(f"{API}/alamat", headers=toko.pel2).json() == []
    assert client.get(f"{API}/alamat", headers=toko.pel).json()[0]["label"] == "Rumah"


def test_validasi_dan_batas_alamat(client, db):
    toko = Toko(client, db)
    for salah in ({**ALAMAT, "no_hp": "abc"}, {**ALAMAT, "alamat": "pendek"}, {**ALAMAT, "label": ""}):
        r = client.post(f"{API}/alamat", headers=toko.pel, json=salah)
        assert r.status_code == 422, salah

    for i in range(10):
        assert client.post(f"{API}/alamat", headers=toko.pel, json={**ALAMAT, "label": f"A{i}"}).status_code == 201
    r = client.post(f"{API}/alamat", headers=toko.pel, json={**ALAMAT, "label": "Kesebelas"})
    assert r.status_code == 422 and "Maksimal" in r.json()["pesan"]

    # Spasi berlebih dirapikan; catatan boleh dikosongkan lewat PATCH.
    a = client.get(f"{API}/alamat", headers=toko.pel).json()[0]
    r = client.patch(f"{API}/alamat/{a['id_alamat']}", headers=toko.pel, json={"label": "  Rumah   Ibu ", "catatan": None})
    assert r.status_code == 200 and r.json()["label"] == "Rumah Ibu" and r.json()["catatan"] is None
