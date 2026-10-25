"""Uji HTTP: pindai stok -> simpan -> katalog -> rangkai sendiri, serta pembatasan peran."""
from app.models.enums import Peran
from tests.bantu import buat_pengguna, gambar_bytes, header_masuk, siapkan_referensi

API = "/api/v1"


def _admin(client, db):
    buat_pengguna(db, "admin@contoh.id", Peran.admin)
    return header_masuk(client, "admin@contoh.id")


def test_rute_admin_menolak_pelanggan_dan_tamu(client, db):
    buat_pengguna(db, "pel@contoh.id")
    h = header_masuk(client, "pel@contoh.id")
    for metode, url in [("get", "/admin/stok"), ("get", "/admin/pengaturan-toko"), ("get", "/admin/riwayat-pindai")]:
        assert getattr(client, metode)(API + url).status_code == 401
        assert getattr(client, metode)(API + url, headers=h).status_code == 403
    r = client.post(API + "/admin/stok/pindai", headers=h, files={"foto": ("a.jpg", gambar_bytes(), "image/jpeg")})
    assert r.status_code == 403


def test_alur_pindai_stok_lengkap(client, db):
    warna, jenis = siapkan_referensi(db)
    h = _admin(client, db)

    r = client.post(API + "/admin/stok/pindai", headers=h, files={"foto": ("bunga.jpg", gambar_bytes((139, 10, 10)), "image/jpeg")})
    assert r.status_code == 200, r.text
    hasil = r.json()
    assert hasil["warna"]["nama_warna"] == "Merah tua" and hasil["warna"]["kode_hex"] == "#8B0000"
    # bawaan AI_MODE=nonaktif: warna dibaca, jenis TIDAK ditebak (bukan "tidak dikenali")
    assert (hasil["jenis_otomatis"], hasil["jenis"], hasil["tingkat_keyakinan"], hasil["dikenali"]) == (False, None, None, False)
    assert hasil["tiruan"] is False and hasil["peringatan"] == []
    id_pindai = hasil["id_pindai"]

    # admin memilih jenis (Mawar) dan menerima warna terbaca
    r = client.post(
        API + "/admin/stok/simpan-pindai",
        headers=h,
        json={"id_pindai": id_pindai, "id_jenis_bunga": jenis["Mawar"].id_jenis_bunga,
              "id_warna": warna["Merah tua"].id_warna, "jumlah_tangkai": 24, "harga_per_tangkai": 8500},
    )
    assert r.status_code == 201, r.text
    stok = r.json()
    assert (stok["jumlah_masuk"], stok["jumlah_tersedia"], stok["jumlah_ditahan"]) == (24, 24, 0)
    assert stok["deskripsi"] == "Mawar merah tua dengan kelopak berlapis"
    assert stok["harga_per_tangkai"] == 8500

    # tidak bisa menyimpan hasil pindai yang sama dua kali
    lagi = client.post(
        API + "/admin/stok/simpan-pindai",
        headers=h,
        json={"id_pindai": id_pindai, "id_jenis_bunga": jenis["Mawar"].id_jenis_bunga,
              "id_warna": warna["Merah tua"].id_warna, "jumlah_tangkai": 1, "harga_per_tangkai": 1},
    )
    assert lagi.status_code == 409 and lagi.json()["kode"] == "pindai_sudah_disimpan"

    riwayat = client.get(API + "/admin/riwayat-pindai", headers=h).json()
    assert riwayat["total"] == 1 and riwayat["data"][0]["id_stok"] == stok["id_stok"]
    assert riwayat["data"][0]["foto_url"].startswith("/api/v1/berkas/")
    assert riwayat["data"][0]["dikoreksi"] is False  # memilih jenis sendiri bukan koreksi; warnanya diterima

    ringkas = client.get(API + "/admin/riwayat-pindai/ringkasan", headers=h).json()
    assert (ringkas["total_disimpan"], ringkas["total_jenis_ditebak"]) == (1, 0)
    assert ringkas["akurasi_jenis"] is None and ringkas["akurasi_warna"] == 1.0


def test_pindai_dengan_klasifikator_menebak_jenis_dan_akurasinya_dihitung(client, db, klasifikator):
    warna, jenis = siapkan_referensi(db)
    h = _admin(client, db)
    klasifikator.kelas = 74  # Mawar
    simpan = []
    for id_jenis_akhir in (jenis["Mawar"].id_jenis_bunga, jenis["Anyelir"].id_jenis_bunga):
        r = client.post(API + "/admin/stok/pindai", headers=h, files={"foto": ("b.jpg", gambar_bytes((139, 10, 10)), "image/jpeg")})
        hasil = r.json()
        assert hasil["jenis_otomatis"] is True and hasil["dikenali"] is True and hasil["jenis"]["nama_bunga"] == "Mawar"
        assert hasil["tingkat_keyakinan"] == 0.95
        simpan.append(client.post(API + "/admin/stok/simpan-pindai", headers=h, json={
            "id_pindai": hasil["id_pindai"], "id_jenis_bunga": id_jenis_akhir, "id_warna": warna["Merah tua"].id_warna,
            "jumlah_tangkai": 5, "harga_per_tangkai": 5000}).status_code)
    assert simpan == [201, 201]
    assert [r["dikoreksi"] for r in client.get(API + "/admin/riwayat-pindai", headers=h).json()["data"]] == [True, False]
    ringkas = client.get(API + "/admin/riwayat-pindai/ringkasan", headers=h).json()
    assert (ringkas["total_jenis_ditebak"], ringkas["jenis_benar"], ringkas["akurasi_jenis"]) == (2, 1, 0.5)


def test_foto_pindai_privat_dibuka_lewat_tautan_bertanda_tangan(client, db):
    siapkan_referensi(db)
    h = _admin(client, db)
    client.post(API + "/admin/stok/pindai", headers=h, files={"foto": ("b.jpg", gambar_bytes(), "image/jpeg")})
    url = client.get(API + "/admin/riwayat-pindai", headers=h).json()["data"][0]["foto_url"]
    buka = client.get(url)  # tanpa header Authorization, seperti tag <img>
    assert buka.status_code == 200 and buka.headers["content-type"] == "image/jpeg"
    assert client.get(API + "/berkas/token-palsu").status_code == 401
    assert client.get("/media/../privat/x.jpg").status_code in (404, 400)


def test_unggahan_bukan_gambar_ditolak(client, db):
    siapkan_referensi(db)
    h = _admin(client, db)
    r = client.post(API + "/admin/stok/pindai", headers=h, files={"foto": ("x.jpg", b"ini bukan gambar", "image/jpeg")})
    assert r.status_code == 422 and r.json()["kode"] == "bukan_gambar"
    r = client.post(API + "/admin/stok/pindai", headers=h, files={"foto": ("x.jpg", b"", "image/jpeg")})
    assert r.status_code == 422


def test_stok_manual_koreksi_dan_penanda_menipis(client, db):
    warna, jenis = siapkan_referensi(db)
    h = _admin(client, db)
    r = client.post(API + "/admin/stok/manual", headers=h,
                    json={"id_jenis_bunga": jenis["Anyelir"].id_jenis_bunga, "id_warna": warna["Putih"].id_warna,
                          "jumlah_tangkai": 6, "harga_per_tangkai": 4000})
    assert r.status_code == 201 and r.json()["menipis"] is True  # 6 <= ambang bawaan 10
    id_stok = r.json()["id_stok"]

    r = client.patch(f"{API}/admin/stok/{id_stok}", headers=h, json={"jumlah_tersedia": 30, "catatan": "hitung ulang fisik"})
    assert r.status_code == 200 and r.json()["jumlah_tersedia"] == 30 and r.json()["menipis"] is False
    assert r.json()["jumlah_masuk"] == 6  # koreksi bukan "masuk"
    assert client.get(API + "/admin/stok?menipis=true", headers=h).json() == []
    assert client.patch(f"{API}/admin/stok/{id_stok}", headers=h, json={"jumlah_tersedia": 5}).status_code == 422  # catatan wajib


def test_katalog_publik_dan_ketersediaan(client, db):
    warna, jenis = siapkan_referensi(db)
    h = _admin(client, db)
    for j, w, n in [("Mawar", "Merah tua", 10), ("Anyelir", "Putih", 3)]:
        client.post(API + "/admin/stok/manual", headers=h,
                    json={"id_jenis_bunga": jenis[j].id_jenis_bunga, "id_warna": warna[w].id_warna,
                          "jumlah_tangkai": n, "harga_per_tangkai": 5000})
    r = client.post(API + "/admin/produk", headers=h, json={
        "nama_produk": "Buket Cinta", "acara": "Anniversary", "harga": 150000, "deskripsi": "Buket romantis",
        "komposisi": [
            {"id_jenis_bunga": jenis["Mawar"].id_jenis_bunga, "id_warna": warna["Merah tua"].id_warna, "jumlah_tangkai": 6},
            {"id_jenis_bunga": jenis["Anyelir"].id_jenis_bunga, "id_warna": warna["Putih"].id_warna, "jumlah_tangkai": 6},
        ]})
    assert r.status_code == 201, r.text
    id_produk = r.json()["id_produk"]

    detail = client.get(f"{API}/produk/{id_produk}").json()  # publik, tanpa login
    assert detail["dapat_dipesan"] is False  # anyelir putih hanya 3 dari 6 yang dibutuhkan
    assert [k["stok_cukup"] for k in detail["komposisi"]] == [True, False]
    assert detail["komposisi"][0]["warna"] == {"id_warna": warna["Merah tua"].id_warna, "nama_warna": "Merah tua", "kode_hex": "#8B0000"}
    assert detail["narasi"].startswith("Buket Cinta. Berisi 12 tangkai:")

    client.post(API + "/admin/stok/manual", headers=h,
                json={"id_jenis_bunga": jenis["Anyelir"].id_jenis_bunga, "id_warna": warna["Putih"].id_warna,
                      "jumlah_tangkai": 10, "harga_per_tangkai": 5000})
    assert client.get(f"{API}/produk/{id_produk}").json()["dapat_dipesan"] is True

    assert client.get(f"{API}/produk?acara=anniversary").json()[0]["nama_produk"] == "Buket Cinta"
    assert client.get(f"{API}/produk?acara=duka").json() == []
    assert client.get(f"{API}/produk/acara").json() == ["Anniversary"]

    # disembunyikan -> hilang dari publik, tetap terlihat admin
    client.patch(f"{API}/admin/produk/{id_produk}", headers=h, json={"ditampilkan": False})
    assert client.get(f"{API}/produk").json() == []
    assert client.get(f"{API}/produk/{id_produk}").status_code == 404
    assert len(client.get(f"{API}/admin/produk", headers=h).json()) == 1


def test_komposisi_ganda_dan_tak_dikenal_ditolak(client, db):
    warna, jenis = siapkan_referensi(db)
    h = _admin(client, db)
    baris = {"id_jenis_bunga": jenis["Mawar"].id_jenis_bunga, "id_warna": warna["Merah"].id_warna, "jumlah_tangkai": 3}
    r = client.post(API + "/admin/produk", headers=h, json={"nama_produk": "Ganda", "harga": 1, "komposisi": [baris, baris]})
    assert r.status_code == 409 and r.json()["kode"] == "komposisi_ganda"
    r = client.post(API + "/admin/produk", headers=h,
                    json={"nama_produk": "Hantu", "harga": 1, "komposisi": [{**baris, "id_warna": 9999}]})
    assert r.status_code == 404


def test_rangkai_opsi_hanya_yang_tersedia_dan_info_toko(client, db):
    warna, jenis = siapkan_referensi(db)
    h = _admin(client, db)
    client.post(API + "/admin/stok/manual", headers=h,
                json={"id_jenis_bunga": jenis["Mawar"].id_jenis_bunga, "id_warna": warna["Merah"].id_warna,
                      "jumlah_tangkai": 4, "harga_per_tangkai": 7000})
    opsi = client.get(API + "/rangkai/opsi").json()
    assert len(opsi) == 1 and opsi[0]["sisa"] == 4 and opsi[0]["warna"]["kode_hex"] == "#FF0000"
    info = client.get(API + "/toko/info").json()
    assert info["ongkos_antar"] == 15000 and len(info["slot_pengiriman"]) == 4


def test_pengaturan_toko_validasi(client, db):
    h = _admin(client, db)
    r = client.patch(API + "/admin/pengaturan-toko", headers=h, json={"pengaturan": {"ongkos_antar": 20000, "slot_pengiriman": ["08:00-10:00"]}})
    assert r.status_code == 200
    assert client.get(API + "/toko/info").json()["slot_pengiriman"] == ["08:00-10:00"]
    for buruk in ({"ongkos_antar": -1}, {"slot_pengiriman": ["pagi"]}, {"kebijakan_pengganti": "asal"}, {"tidak_ada": 1}, {"ongkos_antar": "20000"}):
        assert client.patch(API + "/admin/pengaturan-toko", headers=h, json={"pengaturan": buruk}).status_code == 422, buruk
    assert client.get(API + "/toko/info").json()["ongkos_antar"] == 20000  # perubahan yang gagal tidak menimpa

    galat = client.patch(API + "/admin/pengaturan-toko", headers=h, json={"pengaturan": {"no_hp_toko": "08abc"}}).json()
    assert galat["pesan"].startswith("Nomor HP/WhatsApp toko")  # pesan memakai label, bukan kunci mentah
    kontak = {"no_hp_toko": " 0812-3456-7890 ", "email_toko": "", "rekening_tujuan": ""}
    assert client.patch(API + "/admin/pengaturan-toko", headers=h, json={"pengaturan": kontak}).status_code == 200
    info = client.get(API + "/toko/info").json()
    assert (info["no_hp_toko"], info["email_toko"], info["rekening_tujuan"]) == ("0812-3456-7890", "", "")
    assert client.patch(API + "/admin/pengaturan-toko", headers=h, json={"pengaturan": {"nama_toko": " "}}).status_code == 422
