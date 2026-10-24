"""Alur pesanan dari checkout sampai selesai, validasi checkout, pembayaran, pembatalan, dan kedaluwarsa."""
from datetime import timedelta

from app.core.waktu import hari_ini_wib, sekarang_utc
from app.models.pesanan import Pesanan
from app.services import penjadwal
from tests.skenario import API, Toko


def _toko(client, db) -> Toko:
    return Toko(client, db).stok_standar()


def test_alur_lengkap_ambil_di_toko(client, db, klasifikator):
    toko = _toko(client, db)
    awal = toko.pesan()
    assert awal["rekening_tujuan"] is None  # belum diatur admin: pelanggan diminta menghubungi toko
    assert client.post(f"{API}/pesanan/{awal['id_pesanan']}/batal", headers=toko.pel, json={}).status_code == 200
    rekening = {"pengaturan": {"rekening_tujuan": "Bank Uji 123 a.n. Toko Uji"}}
    assert client.patch(f"{API}/admin/pengaturan-toko", headers=toko.admin, json=rekening).status_code == 200
    pesanan = toko.pesan()
    id_ = pesanan["id_pesanan"]
    assert pesanan["status"]["kode"] == "menunggu_pembayaran"
    assert pesanan["status"]["ikon"] and pesanan["status"]["label"]  # status tidak hanya warna
    assert pesanan["total_harga"] == 150000 and pesanan["ongkos_antar"] == 0
    assert pesanan["kode_pesanan"].startswith("FB-") and pesanan["rekening_tujuan"] == "Bank Uji 123 a.n. Toko Uji"
    assert pesanan["batas_bayar"] is not None and pesanan["bisa_dibatalkan"] is True

    # stok ditahan saat pesanan dibuat (AB-02)
    mawar = toko.stok("Mawar/Merah tua")
    assert (mawar["jumlah_tersedia"], mawar["jumlah_ditahan"]) == (14, 6)

    assert toko.bayar(id_).status_code == 200
    assert toko.status(id_) == "menunggu_verifikasi"
    assert toko.lihat(id_)["rekening_tujuan"] is None  # hanya ditampilkan saat menunggu pembayaran

    r = toko.sahkan(id_)
    assert r.status_code == 200 and r.json()["status"]["kode"] == "sedang_dirangkai"
    mawar = toko.stok("Mawar/Merah tua")
    assert (mawar["jumlah_tersedia"], mawar["jumlah_ditahan"]) == (14, 0)  # tahanan menjadi terpakai

    toko.rangkai_lengkap(id_, klasifikator)
    r = toko.foto_hasil(id_)
    assert r.status_code == 200, r.text
    foto = r.json()["foto"][0]
    assert r.json()["status"]["kode"] == "menunggu_persetujuan_foto"
    assert foto["label_warna"] and foto["label_teks"]  # nama warna tertulis pada foto (prinsip 1)
    assert all(x["nama_warna"] and x["kode_hex"].startswith("#") for x in foto["label_warna"])
    assert client.get(foto["foto_url"]).status_code == 200  # tautan bertanda tangan dapat dibuka tanpa header

    r = toko.tanggapi(id_, keputusan="setuju")
    assert r.status_code == 200 and r.json()["status"]["kode"] == "siap_diambil"
    assert client.post(f"{API}/admin/pesanan/{id_}/selesai", headers=toko.admin).status_code == 200

    akhir = toko.lihat(id_)
    assert [r["kode"] for r in akhir["riwayat"]] == [
        "menunggu_pembayaran", "menunggu_verifikasi", "sedang_dirangkai", "menunggu_persetujuan_foto", "siap_diambil", "selesai",
    ]
    assert [t["keadaan"] for t in akhir["tahap"]] == ["selesai"] * 6
    assert [t["kode"] for t in akhir["tahap"]][-2:] == ["siap_diambil", "selesai"]


def test_alur_diantar_menambah_ongkos_dan_berakhir_di_diantar(client, db, klasifikator):
    toko = _toko(client, db)
    pesanan = toko.pesan(cara_serah_terima="antar", alamat="Jl. Mawar No. 1, Surabaya", kartu_ucapan="Selamat!")
    id_ = pesanan["id_pesanan"]
    assert pesanan["total_harga"] == 165000 and pesanan["ongkos_antar"] == 15000
    toko.bayar(id_, nominal="165000")
    toko.sahkan(id_)
    toko.rangkai_lengkap(id_, klasifikator)
    toko.foto_hasil(id_)
    assert toko.tanggapi(id_, keputusan="setuju").json()["status"]["kode"] == "diantar"
    assert "siap_diambil" not in [t["kode"] for t in toko.lihat(id_)["tahap"]]


def test_alamat_wajib_untuk_pengantaran(client, db):
    toko = _toko(client, db)
    r = toko.checkout(cara_serah_terima="antar")
    assert r.status_code == 422 and r.json()["kode"] == "validasi_gagal"


def test_harga_dihitung_server_bukan_klien(client, db):
    toko = _toko(client, db)
    pesanan = toko.pesan(total_harga=1, ongkos_antar=0, subtotal=1)
    assert pesanan["total_harga"] == 150000


def test_validasi_tanggal_dan_slot(client, db):
    toko = _toko(client, db)
    hari_ini = hari_ini_wib().isoformat()
    r = toko.checkout(tanggal_kirim=hari_ini)
    assert r.status_code == 422 and r.json()["kode"] == "tanggal_terlalu_dekat"  # AB-04: paling lambat H-1
    r = toko.checkout(tanggal_kirim=(hari_ini_wib() + timedelta(days=200)).isoformat())
    assert r.json()["kode"] == "tanggal_terlalu_jauh"
    r = toko.checkout(slot_jam="01:00-02:00")
    assert r.status_code == 422 and r.json()["kode"] == "slot_tidak_valid"
    besok = (hari_ini_wib() + timedelta(days=1)).isoformat()
    assert toko.checkout(tanggal_kirim=besok).status_code == 201  # H-1 tepat masih boleh


def test_stok_tidak_cukup_ditolak_utuh_dan_tidak_menahan_apa_pun(client, db):
    toko = _toko(client, db)
    r = toko.checkout(items=[{"jenis_item": "paket", "id_produk": toko.id_paket, "jumlah": 4}])  # butuh 24 mawar, ada 20
    assert r.status_code == 409 and r.json()["kode"] == "stok_tidak_cukup"
    rincian = r.json()["rincian"]
    assert rincian[0]["bunga"] == "Mawar merah tua" and rincian[0]["diminta"] == 24 and rincian[0]["tersedia"] == 20
    assert toko.stok("Mawar/Merah tua")["jumlah_ditahan"] == 0
    assert toko.stok("Anyelir/Putih")["jumlah_ditahan"] == 0  # stok yang cukup pun tidak ikut tertahan
    assert client.get(f"{API}/pesanan", headers=toko.pel).json()["total"] == 0


def test_dua_pelanggan_berebut_stok(client, db):
    toko = _toko(client, db)
    toko.pesan(items=[{"jenis_item": "paket", "id_produk": toko.id_paket, "jumlah": 3}])  # 18 mawar tertahan, sisa 2
    r = toko.checkout(headers=toko.pel2)
    assert r.status_code == 409 and r.json()["kode"] == "stok_tidak_cukup"


def test_rangkai_sendiri_harga_minimal_dan_penggabungan(client, db):
    toko = _toko(client, db)
    mawar, anyelir = toko.id_stok["Mawar/Merah tua"], toko.id_stok["Anyelir/Putih"]

    r = toko.checkout(items=[{"jenis_item": "rangkai_sendiri", "bunga": [{"id_stok": mawar, "jumlah_tangkai": 4}]}])
    assert r.status_code == 422 and r.json()["kode"] == "tangkai_kurang"

    pratinjau = client.post(f"{API}/pesanan/pratinjau", json={"items": [
        {"jenis_item": "rangkai_sendiri", "bunga": [{"id_stok": mawar, "jumlah_tangkai": 5}, {"id_stok": anyelir, "jumlah_tangkai": 3}]}
    ]}).json()
    assert pratinjau["subtotal"] == 5 * 8000 + 3 * 4000 + 10000 and pratinjau["dapat_dipesan"] is True  # + jasa merangkai

    # baris ganda untuk stok yang sama digabung: 3 + 3 = 6 tangkai
    pesanan = toko.pesan(items=[{"jenis_item": "rangkai_sendiri", "bunga": [
        {"id_stok": mawar, "jumlah_tangkai": 3}, {"id_stok": mawar, "jumlah_tangkai": 3}]}])
    assert pesanan["total_harga"] == 6 * 8000 + 10000
    assert pesanan["detail"][0]["nama"] == "Rangkaian sendiri (6 tangkai)"
    assert toko.stok("Mawar/Merah tua")["jumlah_ditahan"] == 6

    assert toko.checkout(items=[{"jenis_item": "rangkai_sendiri", "bunga": [{"id_stok": 9999, "jumlah_tangkai": 5}]}]).status_code == 404


def test_pratinjau_melaporkan_masalah_stok_tanpa_menahan(client, db):
    toko = _toko(client, db)
    pratinjau = client.post(f"{API}/pesanan/pratinjau", json={"items": [
        {"jenis_item": "paket", "id_produk": toko.id_paket, "jumlah": 4}]}).json()
    assert pratinjau["dapat_dipesan"] is False and pratinjau["masalah"][0]["bunga"] == "Mawar merah tua"
    assert toko.stok("Mawar/Merah tua")["jumlah_ditahan"] == 0


def test_paket_tersembunyi_tidak_bisa_dipesan(client, db):
    toko = _toko(client, db)
    client.patch(f"{API}/admin/produk/{toko.id_paket}", headers=toko.admin, json={"ditampilkan": False})
    assert toko.checkout().status_code == 404


# --- Pembayaran -----------------------------------------------------------------------------------------------


def test_bukti_ditolak_lalu_diunggah_ulang(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_, nominal="100000")
    admin_lihat = client.get(f"{API}/admin/pesanan/{id_}", headers=toko.admin).json()
    assert admin_lihat["pembayaran"][0]["nominal_sesuai"] is False  # petunjuk untuk admin
    assert admin_lihat["perlu_tindakan_admin"] is True

    r = toko.tolak(id_, "Nominal kurang 50.000")
    assert r.status_code == 200 and r.json()["status"]["kode"] == "menunggu_pembayaran"
    pelanggan_lihat = toko.lihat(id_)
    assert pelanggan_lihat["pembayaran"][0]["status_verifikasi"] == "ditolak"
    assert pelanggan_lihat["pembayaran"][0]["catatan_penolakan"] == "Nominal kurang 50.000"
    assert pelanggan_lihat["batas_bayar"] is not None
    assert toko.stok("Mawar/Merah tua")["jumlah_ditahan"] == 6  # stok tetap ditahan selama menunggu unggah ulang

    assert toko.bayar(id_, nominal="150000").status_code == 200
    assert toko.sahkan(id_).status_code == 200
    assert len(toko.lihat(id_)["pembayaran"]) == 2


def test_unggah_bukti_hanya_saat_menunggu_pembayaran(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_)
    r = toko.bayar(id_)  # sudah menunggu verifikasi
    assert r.status_code == 409 and r.json()["kode"] == "tidak_menunggu_pembayaran"
    assert toko.bayar(id_, nominal="0").status_code == 422


def test_bukti_bukan_gambar_ditolak(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    r = client.post(f"{API}/pesanan/{id_}/pembayaran", headers=toko.pel,
                    files={"bukti": ("x.pdf", b"%PDF-1.4 bukan gambar", "application/pdf")},
                    data={"nama_pengirim": "Budi", "nominal": "150000"})
    assert r.status_code == 422 and r.json()["kode"] == "bukan_gambar"
    assert toko.status(id_) == "menunggu_pembayaran"


def test_sahkan_dua_kali_ditolak(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_)
    assert toko.sahkan(id_).status_code == 200
    r = toko.sahkan(id_)
    assert r.status_code == 409 and r.json()["kode"] == "tidak_menunggu_verifikasi"
    assert toko.stok("Mawar/Merah tua")["jumlah_tersedia"] == 14  # stok tidak terpotong dua kali


# --- Pembatalan -------------------------------------------------------------------------------------------------


def test_batal_saat_menunggu_pembayaran_mengembalikan_stok(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    r = client.post(f"{API}/pesanan/{id_}/batal", headers=toko.pel, json={"alasan": "Salah pilih"})
    assert r.status_code == 200 and r.json()["status"]["kode"] == "dibatalkan" and r.json()["alasan_batal"] == "Salah pilih"
    mawar = toko.stok("Mawar/Merah tua")
    assert (mawar["jumlah_tersedia"], mawar["jumlah_ditahan"]) == (20, 0)
    assert toko.lihat(id_)["tahap"][-1]["kode"] == "dibatalkan"
    again = client.post(f"{API}/pesanan/{id_}/batal", headers=toko.pel, json={})
    assert again.status_code == 409 and again.json()["kode"] == "tidak_bisa_dibatalkan"


def test_batal_saat_menunggu_verifikasi_menandai_pengembalian_dana(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_)
    assert client.post(f"{API}/pesanan/{id_}/batal", headers=toko.pel, json={}).status_code == 200
    admin = client.get(f"{API}/admin/pesanan/{id_}", headers=toko.admin).json()
    assert admin["perlu_pengembalian_dana"] is True and admin["pembayaran"][0]["status_verifikasi"] == "ditolak"
    assert client.get(f"{API}/admin/dasbor", headers=toko.admin).json()["perlu_pengembalian_dana"] == 1
    assert toko.stok("Mawar/Merah tua")["jumlah_tersedia"] == 20

    r = client.post(f"{API}/admin/pesanan/{id_}/pengembalian-dana-selesai", headers=toko.admin)
    assert r.status_code == 200 and r.json()["perlu_pengembalian_dana"] is False
    assert client.post(f"{API}/admin/pesanan/{id_}/pengembalian-dana-selesai", headers=toko.admin).status_code == 409


def test_tidak_bisa_batal_setelah_dirangkai(client, db):
    """AB-08: pembatalan hanya sebelum 'Sedang dirangkai'."""
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_)
    toko.sahkan(id_)
    r = client.post(f"{API}/pesanan/{id_}/batal", headers=toko.pel, json={})
    assert r.status_code == 409 and r.json()["kode"] == "tidak_bisa_dibatalkan"
    assert toko.status(id_) == "sedang_dirangkai"
    assert toko.lihat(id_)["bisa_dibatalkan"] is False


# --- Kedaluwarsa --------------------------------------------------------------------------------------------------


def _mundurkan_batas_bayar(db, id_pesanan: int, menit: int = 5):
    db.expire_all()
    pesanan = db.get(Pesanan, id_pesanan)
    pesanan.batas_bayar = sekarang_utc() - timedelta(minutes=menit)
    db.commit()


def test_penjadwal_membatalkan_pesanan_lewat_batas_dan_melepas_stok(client, db, pabrik_sesi):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    aman = toko.pesan(headers=toko.pel2)["id_pesanan"]  # batas bayarnya masih lama
    _mundurkan_batas_bayar(db, id_)

    assert penjadwal.jalankan_sekali(pabrik_sesi) == 1
    assert penjadwal.jalankan_sekali(pabrik_sesi) == 0  # idempoten

    dibatalkan = toko.lihat(id_)
    assert dibatalkan["status"]["kode"] == "dibatalkan" and "Kedaluwarsa" in dibatalkan["alasan_batal"]
    assert dibatalkan["riwayat"][-1]["oleh_sistem"] is True
    assert toko.status(aman, toko.pel2) == "menunggu_pembayaran"
    mawar = toko.stok("Mawar/Merah tua")
    assert (mawar["jumlah_tersedia"], mawar["jumlah_ditahan"]) == (14, 6)  # hanya milik pesanan yang aman yang masih tertahan


def test_pesanan_menunggu_verifikasi_tidak_ikut_kedaluwarsa(client, db, pabrik_sesi):
    """Kelambatan admin tidak boleh membatalkan pesanan yang sudah dibayar pelanggan."""
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    toko.bayar(id_)
    _mundurkan_batas_bayar(db, id_, menit=600)
    assert penjadwal.jalankan_sekali(pabrik_sesi) == 0
    assert toko.status(id_) == "menunggu_verifikasi"


def test_unggah_bukti_setelah_batas_membatalkan_dan_menyimpannya(client, db):
    toko = _toko(client, db)
    id_ = toko.pesan()["id_pesanan"]
    _mundurkan_batas_bayar(db, id_)
    r = toko.bayar(id_)
    assert r.status_code == 409 and r.json()["kode"] == "batas_bayar_lewat"
    assert toko.status(id_) == "dibatalkan"  # pembatalan tersimpan walau permintaannya dijawab galat
    assert toko.stok("Mawar/Merah tua")["jumlah_tersedia"] == 20


# --- Daftar & pencarian admin -----------------------------------------------------------------------------------


def test_daftar_pesanan_admin_saring_dan_cari(client, db):
    toko = _toko(client, db)
    a = toko.pesan(nama_penerima="Ratna")
    b = toko.pesan(headers=toko.pel2, nama_penerima="Sinta")
    toko.bayar(a["id_pesanan"])

    def cari(**params):
        return client.get(f"{API}/admin/pesanan", headers=toko.admin, params=params).json()

    assert cari()["total"] == 2
    assert [p["kode_pesanan"] for p in cari(status="menunggu_verifikasi")["data"]] == [a["kode_pesanan"]]
    assert cari(cari=b["kode_pesanan"].lower())["total"] == 1
    assert cari(cari="ratna")["data"][0]["kode_pesanan"] == a["kode_pesanan"]
    assert cari(cari="Pelanggan Dua")["data"][0]["kode_pesanan"] == b["kode_pesanan"]
    assert cari(cari="buket cinta")["total"] == 2  # cari berdasarkan nama rangkaian
    assert cari(cari="tidak-ada")["total"] == 0
    tindakan = cari(perlu_tindakan="true")
    assert [p["kode_pesanan"] for p in tindakan["data"]] == [a["kode_pesanan"]]  # b masih menunggu pelanggan membayar
    assert tindakan["data"][0]["pemesan"]["nama"] == "Pelanggan Satu"
    assert cari(per_halaman=1)["total"] == 2 and len(cari(per_halaman=1)["data"]) == 1
