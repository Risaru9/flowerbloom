"""Mode Merangkai, bunga pengganti, foto konfirmasi (setuju/revisi), dan komplain."""
from datetime import timedelta

from app.core.waktu import sekarang_utc
from app.models.pesanan import Pesanan
from tests.bantu import gambar_bytes
from tests.skenario import API, MERAH_MUDA, MERAH_TUA, PUTIH, Toko


def _dirangkai(client, db) -> tuple[Toko, int]:
    """Pesanan 'Buket Cinta' yang sudah dibayar dan disahkan (status Sedang dirangkai)."""
    toko = Toko(client, db).stok_standar()
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_)
    assert toko.sahkan(id_).status_code == 200
    return toko, id_


def _baris(toko: Toko, id_: int, kunci: str) -> dict:
    """Baris komposisi (bukan pengganti) untuk stok tertentu."""
    return next(k for k in toko.merangkai(id_)["pesanan"]["detail"][0]["komposisi"]
                if k["id_stok"] == toko.id_stok[kunci] and not k["is_pengganti"])


# --- Mode Merangkai -----------------------------------------------------------------------------------------------


def test_pindai_cocok_menaikkan_progres_dan_dibatasi_sisa(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    awal = toko.merangkai(id_)
    assert (awal["terpindai"], awal["target"], awal["siap_foto"]) == (0, 12, False)

    klasifikator.kelas = 74
    r = toko.pindai_rangkai(id_, MERAH_TUA, jumlah=2).json()
    assert r["dikenali"] and r["cocok"] is True and r["jenis"]["nama_bunga"] == "Mawar"
    assert r["warna"]["nama_warna"] == "Merah tua" and r["warna"]["kode_hex"] == "#8B0000"
    assert r["progres"]["terpindai"] == 2

    r = toko.pindai_rangkai(id_, MERAH_TUA, jumlah=50).json()  # melebihi sisa: dibatasi 4 (6 - 2)
    assert r["cocok"] is True and r["progres"]["terpindai"] == 6
    assert r["alasan"] == "46 tangkai melebihi kebutuhan pesanan dan tidak dihitung."
    r = toko.pindai_rangkai(id_, MERAH_TUA).json()  # baris mawar sudah penuh
    assert r["cocok"] is False and "sudah" in r["alasan"].lower() or "tidak ada" in r["alasan"].lower()


def test_pindai_warna_atau_jenis_salah_tidak_menaikkan_progres(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    klasifikator.kelas = 74
    r = toko.pindai_rangkai(id_, MERAH_MUDA).json()  # mawar merah muda, pesanan minta merah tua
    assert r["cocok"] is False and "Merah tua" in r["alasan"] and r["progres"]["terpindai"] == 0

    klasifikator.kelas = 54  # bunga matahari tidak ada di pesanan
    r = toko.pindai_rangkai(id_, MERAH_TUA).json()
    assert r["cocok"] is False and "tidak ada dalam sisa pesanan" in r["alasan"]
    assert toko.merangkai(id_)["terpindai"] == 0


def test_bunga_tidak_dikenali_tidak_mencocokkan(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    klasifikator.keyakinan = 0.3  # di bawah ambang (F-AI-02)
    r = toko.pindai_rangkai(id_, MERAH_TUA).json()
    assert r["dikenali"] is False and r["cocok"] is False and "tidak dikenali" in r["alasan"].lower()
    klasifikator.keyakinan, klasifikator.kelas = 0.95, 99  # kelas yang belum ada di tabel jenis_bunga
    r = toko.pindai_rangkai(id_, MERAH_TUA).json()
    assert r["dikenali"] is False and r["jenis"] is None
    assert toko.merangkai(id_)["terpindai"] == 0


def test_tandai_cocok_manual_dan_foto_baru_boleh_setelah_semua_cocok(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    r = toko.foto_hasil(id_)  # belum ada yang cocok
    assert r.status_code == 409 and r.json()["kode"] == "belum_semua_cocok"
    assert {x["kurang"] for x in r.json()["rincian"]} == {6}

    for kunci in ("Mawar/Merah tua", "Anyelir/Putih"):
        baris = _baris(toko, id_, kunci)
        p = client.post(f"{API}/admin/pesanan/{id_}/merangkai/tandai-cocok", headers=toko.admin,
                        json={"id_komposisi_pesanan": baris["id_komposisi_pesanan"], "jumlah": 6})
        assert p.status_code == 200
    assert p.json()["siap_foto"] is True
    assert _baris(toko, id_, "Mawar/Merah tua")["ditandai_manual"] is True
    assert toko.foto_hasil(id_).status_code == 200


def test_mode_merangkai_hanya_saat_sedang_dirangkai(client, db, klasifikator):
    toko = Toko(client, db).stok_standar()
    id_ = toko.pesan()["id_pesanan"]  # masih menunggu pembayaran
    r = toko.pindai_rangkai(id_)
    assert r.status_code == 409 and r.json()["kode"] == "tidak_sedang_dirangkai"
    assert toko.foto_hasil(id_).status_code == 409


# --- Bunga pengganti ------------------------------------------------------------------------------------------------


def _ganti(toko, id_, kunci_asal, kunci_pengganti, jumlah=2, alasan="mawar merah tua rusak"):
    return client_post(toko, id_, {
        "id_komposisi_asal": _baris(toko, id_, kunci_asal)["id_komposisi_pesanan"],
        "id_stok_pengganti": toko.id_stok[kunci_pengganti], "jumlah": jumlah, "alasan": alasan})


def client_post(toko, id_, isi):
    return toko.client.post(f"{API}/admin/pesanan/{id_}/merangkai/pengganti", headers=toko.admin, json=isi)


def _selesaikan_rangkaian(toko, id_, klasifikator, mawar_tersisa=4):
    klasifikator.kelas = 74
    assert toko.pindai_rangkai(id_, MERAH_TUA, jumlah=mawar_tersisa).json()["cocok"] is True
    klasifikator.kelas = 31
    assert toko.pindai_rangkai(id_, PUTIH, jumlah=6).json()["cocok"] is True


def test_bunga_pengganti_beda_warna_wajib_dikonfirmasi_pelanggan(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    r = _ganti(toko, id_, "Mawar/Merah tua", "Mawar/Merah muda", jumlah=2)
    assert r.status_code == 200, r.text
    detail = r.json()["pesanan"]["detail"][0]["komposisi"]
    aktif = {(k["warna"]["nama_warna"], k["is_pengganti"]): k["jumlah_tangkai"] for k in detail}
    assert aktif == {("Merah tua", False): 4, ("Merah muda", True): 2, ("Putih", False): 6}
    assert r.json()["target"] == 12  # total tangkai tetap
    muda = toko.stok("Mawar/Merah muda")
    assert muda["jumlah_tersedia"] == 8  # pengganti diambil dari rak
    assert toko.stok("Mawar/Merah tua")["jumlah_tersedia"] == 14  # stok bunga asal tidak dikembalikan otomatis

    _selesaikan_rangkaian(toko, id_, klasifikator, mawar_tersisa=4)
    foto = toko.foto_hasil(id_).json()["foto"][0]
    assert foto["pengganti"] == [{"dari": "Mawar merah tua", "menjadi": "Mawar merah muda", "jumlah": 2,
                                  "alasan": "mawar merah tua rusak", "warna_berbeda": True}]

    # AB-07: menyetujui tanpa konfirmasi pengganti ditolak
    r = toko.tanggapi(id_, keputusan="setuju")
    assert r.status_code == 409 and r.json()["kode"] == "perlu_konfirmasi_pengganti"
    assert r.json()["rincian"][0]["menjadi"] == "Mawar merah muda"
    assert toko.status(id_) == "menunggu_persetujuan_foto"

    r = toko.tanggapi(id_, keputusan="setuju", setuju_pengganti=True)
    assert r.status_code == 200 and r.json()["status"]["kode"] == "siap_diambil"
    akhir = toko.lihat(id_)
    assert akhir["ada_pengganti"] is True and akhir["total_harga"] == 150000  # harga tidak berubah


def test_pengganti_warna_sama_tidak_perlu_konfirmasi_kecuali_kebijakan_ketat(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    toko.isi_stok("Anyelir", "Merah tua", 5, 4000)  # jenis beda, warna sama
    assert _ganti(toko, id_, "Mawar/Merah tua", "Anyelir/Merah tua", jumlah=1, alasan="mawar habis").status_code == 200
    _selesaikan_rangkaian(toko, id_, klasifikator, mawar_tersisa=5)
    toko.foto_hasil(id_)
    r = toko.tanggapi(id_, keputusan="setuju")  # kebijakan bawaan: hanya warna berbeda
    assert r.status_code == 200 and r.json()["status"]["kode"] == "siap_diambil"

    # kebijakan 'semua_pengganti': pesanan kedua dengan penggantian serupa wajib dikonfirmasi
    client.patch(f"{API}/admin/pengaturan-toko", headers=toko.admin, json={"pengaturan": {"kebijakan_pengganti": "semua_pengganti"}})
    id2 = toko.pesan(headers=toko.pel2)["id_pesanan"]
    toko.bayar(id2, headers=toko.pel2)
    toko.sahkan(id2)
    assert _ganti(toko, id2, "Mawar/Merah tua", "Anyelir/Merah tua", jumlah=1, alasan="mawar habis").status_code == 200
    _selesaikan_rangkaian(toko, id2, klasifikator, mawar_tersisa=5)
    toko.foto_hasil(id2)
    assert toko.tanggapi(id2, headers=toko.pel2, keputusan="setuju").json()["kode"] == "perlu_konfirmasi_pengganti"


def test_pengganti_validasi(client, db):
    toko, id_ = _dirangkai(client, db)
    assert _ganti(toko, id_, "Mawar/Merah tua", "Mawar/Merah muda", jumlah=7).json()["kode"] == "jumlah_melebihi_baris"
    assert _ganti(toko, id_, "Mawar/Merah tua", "Mawar/Merah tua", jumlah=1).json()["kode"] == "pengganti_sama_dengan_asal"
    toko.isi_stok("Bunga matahari", "Kuning", 1, 6000)
    r = _ganti(toko, id_, "Mawar/Merah tua", "Bunga matahari/Kuning", jumlah=2)
    assert r.status_code == 409 and r.json()["kode"] == "stok_tidak_cukup"
    assert toko.merangkai(id_)["target"] == 12  # gagal -> tidak ada perubahan setengah jalan
    assert _ganti(toko, id_, "Mawar/Merah tua", "Mawar/Merah muda", jumlah=1, alasan="x").status_code == 422  # alasan terlalu pendek


# --- Persetujuan & revisi -------------------------------------------------------------------------------------------


def _siap_disetujui(client, db, klasifikator):
    toko, id_ = _dirangkai(client, db)
    toko.rangkai_lengkap(id_, klasifikator)
    assert toko.foto_hasil(id_).status_code == 200
    return toko, id_


def test_revisi_mengembalikan_ke_dirangkai_dan_foto_baru_menambah_riwayat(client, db, klasifikator):
    toko, id_ = _siap_disetujui(client, db, klasifikator)
    r = toko.tanggapi(id_, keputusan="revisi")
    assert r.status_code == 409 and r.json()["kode"] == "catatan_revisi_wajib"

    r = toko.tanggapi(id_, keputusan="revisi", catatan_revisi="Pita terlalu kecil")
    assert r.status_code == 200 and r.json()["status"]["kode"] == "sedang_dirangkai"
    assert r.json()["jumlah_revisi"] == 1 and r.json()["revisi_gratis_tersisa"] == 0
    assert r.json()["foto"][0]["status_persetujuan"] == "revisi" and r.json()["foto"][0]["catatan_revisi"] == "Pita terlalu kecil"
    admin = client.get(f"{API}/admin/pesanan/{id_}", headers=toko.admin).json()
    assert admin["revisi_berbayar"] is False  # revisi pertama gratis (AB-06)

    assert toko.foto_hasil(id_).status_code == 200  # baris sudah cocok; tidak perlu memindai ulang
    lihat = toko.lihat(id_)
    assert [f["status_persetujuan"] for f in lihat["foto"]] == ["revisi", "menunggu"]

    toko.tanggapi(id_, keputusan="revisi", catatan_revisi="Masih kurang rapi")
    assert client.get(f"{API}/admin/pesanan/{id_}", headers=toko.admin).json()["revisi_berbayar"] is True
    assert toko.foto_hasil(id_).status_code == 200
    assert toko.tanggapi(id_, keputusan="setuju").json()["status"]["kode"] == "siap_diambil"


def test_tanggapan_hanya_untuk_foto_yang_menunggu(client, db, klasifikator):
    toko, id_ = _siap_disetujui(client, db, klasifikator)
    toko.tanggapi(id_, keputusan="setuju")
    r = toko.tanggapi(id_, keputusan="revisi", catatan_revisi="terlambat")
    assert r.status_code == 409 and r.json()["kode"] == "tidak_menunggu_persetujuan"


def test_foto_terlambat_ditanggapi_ditandai_untuk_admin(client, db, klasifikator):
    toko, id_ = _siap_disetujui(client, db, klasifikator)
    assert client.get(f"{API}/admin/pesanan/{id_}", headers=toko.admin).json()["terlambat_ditanggapi"] is False
    from app.models.pesanan import FotoKonfirmasi

    db.expire_all()
    db.query(FotoKonfirmasi).one().diunggah_pada = sekarang_utc() - timedelta(hours=30)
    db.commit()
    assert client.get(f"{API}/admin/pesanan/{id_}", headers=toko.admin).json()["terlambat_ditanggapi"] is True
    assert toko.status(id_) == "menunggu_persetujuan_foto"  # hanya penanda; tidak ada tindakan otomatis


# --- Komplain ---------------------------------------------------------------------------------------------------------


def _selesai(client, db, klasifikator):
    toko, id_ = _siap_disetujui(client, db, klasifikator)
    toko.tanggapi(id_, keputusan="setuju")
    client.post(f"{API}/admin/pesanan/{id_}/selesai", headers=toko.admin)
    return toko, id_


def test_komplain_dalam_batas_waktu_dengan_foto(client, db, klasifikator):
    toko, id_ = _selesai(client, db, klasifikator)
    r = client.post(f"{API}/pesanan/{id_}/komplain", headers=toko.pel, data={"isi": "Warnanya berbeda dari foto"},
                    files={"foto": ("k.jpg", gambar_bytes(), "image/jpeg")})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "baru" and r.json()["foto_url"].startswith("/api/v1/berkas/")
    ulang = client.post(f"{API}/pesanan/{id_}/komplain", headers=toko.pel, data={"isi": "Komplain kedua untuk pesanan sama"})
    assert ulang.status_code == 409 and ulang.json()["kode"] == "komplain_sudah_ada"

    saya = client.get(f"{API}/komplain/saya", headers=toko.pel).json()
    assert len(saya) == 1 and saya[0]["kode_pesanan"]
    assert client.get(f"{API}/komplain/saya", headers=toko.pel2).json() == []

    admin = client.get(f"{API}/admin/komplain", headers=toko.admin).json()
    assert admin[0]["pemesan"]["nama"] == "Pelanggan Satu"
    t = client.patch(f"{API}/admin/komplain/{admin[0]['id_komplain']}", headers=toko.admin,
                     json={"tanggapan": "Kami kirim ulang.", "status": "selesai"})
    assert t.status_code == 200 and t.json()["tanggapan_admin"] == "Kami kirim ulang."
    assert client.get(f"{API}/admin/dasbor", headers=toko.admin).json()["komplain_baru"] == 0


def test_komplain_tanpa_foto_boleh_tetapi_setelah_batas_ditolak(client, db, klasifikator):
    toko, id_ = _selesai(client, db, klasifikator)
    db.expire_all()
    db.get(Pesanan, id_).diselesaikan_pada = sekarang_utc() - timedelta(hours=25)
    db.commit()
    r = client.post(f"{API}/pesanan/{id_}/komplain", headers=toko.pel, data={"isi": "Terlambat mengeluh"})
    assert r.status_code == 409 and r.json()["kode"] == "komplain_lewat_batas"  # AB-09

    db.expire_all()
    db.get(Pesanan, id_).diselesaikan_pada = sekarang_utc() - timedelta(hours=2)
    db.commit()
    assert client.post(f"{API}/pesanan/{id_}/komplain", headers=toko.pel, data={"isi": "Tepat waktu tanpa foto"}).status_code == 201


def test_komplain_hanya_setelah_pesanan_diterima(client, db):
    toko, id_ = _dirangkai(client, db)
    r = client.post(f"{API}/pesanan/{id_}/komplain", headers=toko.pel, data={"isi": "Belum sampai kok komplain"})
    assert r.status_code == 409 and r.json()["kode"] == "komplain_belum_boleh"


# --- Otorisasi ----------------------------------------------------------------------------------------------------------


def test_pelanggan_lain_tidak_bisa_menyentuh_pesanan_orang(client, db, klasifikator):
    toko, id_ = _siap_disetujui(client, db, klasifikator)
    orang = toko.pel2
    assert client.get(f"{API}/pesanan/{id_}", headers=orang).status_code == 404
    assert client.post(f"{API}/pesanan/{id_}/batal", headers=orang, json={}).status_code == 404
    assert toko.tanggapi(id_, headers=orang, keputusan="setuju").status_code == 404
    assert toko.bayar(id_, headers=orang).status_code == 404
    assert client.post(f"{API}/pesanan/{id_}/komplain", headers=orang, data={"isi": "bukan pesanan saya"}).status_code == 404
    assert client.get(f"{API}/pesanan", headers=orang).json()["total"] == 0
    assert toko.status(id_) == "menunggu_persetujuan_foto"  # tidak berubah


def test_batas_peran(client, db):
    toko = Toko(client, db).stok_standar()
    id_ = toko.pesan()["id_pesanan"]
    for metode, url in [("get", "/admin/pesanan"), ("get", f"/admin/pesanan/{id_}"), ("get", "/admin/dasbor"),
                        ("post", f"/admin/pesanan/{id_}/selesai"), ("get", "/admin/pengguna")]:
        assert getattr(client, metode)(API + url, headers=toko.pel).status_code == 403, url
        assert getattr(client, metode)(API + url).status_code == 401, url
    assert toko.checkout(headers=toko.admin).status_code == 403  # admin bukan pelanggan
    assert client.get(f"{API}/pesanan").status_code == 401


def test_admin_menambah_dan_menonaktifkan_akun(client, db):
    toko = Toko(client, db)
    baru = client.post(f"{API}/admin/pengguna", headers=toko.admin,
                       json={"nama": "Staf Baru", "email": "staf@contoh.id", "kata_sandi": "sandi-staf-123"})
    assert baru.status_code == 201 and baru.json()["peran"] == "admin"
    masuk = client.post(f"{API}/auth/masuk", json={"email": "staf@contoh.id", "kata_sandi": "sandi-staf-123"})
    assert masuk.status_code == 200

    id_staf = baru.json()["id_pengguna"]
    assert client.patch(f"{API}/admin/pengguna/{id_staf}/aktif", headers=toko.admin, json={"aktif": False}).status_code == 200
    assert client.post(f"{API}/auth/masuk", json={"email": "staf@contoh.id", "kata_sandi": "sandi-staf-123"}).status_code == 403
    # token yang sudah terbit pun berhenti berlaku setelah akun dinonaktifkan
    token = {"Authorization": f"Bearer {masuk.json()['access_token']}"}
    assert client.get(f"{API}/admin/dasbor", headers=token).status_code == 401
    assert client.patch(f"{API}/admin/pengguna/{id_staf}/aktif", headers=toko.admin, json={"aktif": True}).status_code == 200
    assert client.get(f"{API}/admin/dasbor", headers=token).status_code == 401  # diaktifkan lagi: token lama tetap mati

    id_admin = client.get(f"{API}/auth/saya", headers=toko.admin).json()["id_pengguna"]
    r = client.patch(f"{API}/admin/pengguna/{id_admin}/aktif", headers=toko.admin, json={"aktif": False})
    assert r.status_code == 409 and r.json()["kode"] == "tidak_bisa_nonaktifkan_diri"


# --- Dasbor & laporan ---------------------------------------------------------------------------------------------------


def test_dasbor_dan_laporan(client, db, klasifikator):
    toko, id_ = _selesai(client, db, klasifikator)
    b = toko.pesan(headers=toko.pel2)["id_pesanan"]  # masih menunggu pembayaran
    toko.bayar(b, headers=toko.pel2)

    d = client.get(f"{API}/admin/dasbor", headers=toko.admin).json()
    assert d["perlu_verifikasi"] == 1 and d["pesanan_aktif"] == 1
    assert d["penjualan_hari_ini"] == 150000 and d["penjualan_minggu_ini"] == 150000  # hanya pesanan yang sudah sah
    assert len(d["grafik_pesanan_mingguan"]) == 7 and d["grafik_pesanan_mingguan"][-1]["jumlah"] == 2
    # ambang bawaan 10: dua pesanan sudah mengurangi mawar merah tua dan anyelir putih (20 - 12 = 8)
    assert set(d["stok_menipis"]) == {"Mawar merah muda (sisa 10)", "Mawar merah tua (sisa 8)", "Anyelir putih (sisa 8)"}

    lap = client.get(f"{API}/admin/laporan", headers=toko.admin).json()
    assert lap["total_penjualan"] == 150000 and lap["jumlah_pesanan_berbayar"] == 1
    assert lap["terlaris"] == [{"nama": "Buket Cinta", "terjual": 1}]
    assert len(lap["penjualan_per_minggu"]) == 1 and lap["penjualan_per_minggu"][0]["total"] == 150000
    assert client.get(f"{API}/admin/laporan?dari=2026-10-01&sampai=2026-09-01", headers=toko.admin).status_code == 422
