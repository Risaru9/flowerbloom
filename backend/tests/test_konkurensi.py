"""Uji konkurensi tingkat pesanan. Di SQLite hanya membuktikan logika (penulis diserialkan); bukti sesungguhnya
adalah menjalankannya pada MySQL: `UJI_DATABASE_URL=mysql+pymysql://.../flowerbloom_uji pytest tests/test_konkurensi.py`."""
import os
import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.errors import KesalahanAplikasi, StokTidakCukup
from app.core.waktu import hari_ini_wib
from app.models.enums import JenisMutasi, Peran, StatusPesanan
from app.models.pesanan import Pesanan
from app.models.stok import MutasiStok, Stok
from app.schemas.pesanan import CheckoutIn
from app.services import pesanan as layanan
from app.services import stok as layanan_stok
from tests.bantu import buat_pengguna, gambar_bytes, siapkan_referensi

butuh_kunci_baris = pytest.mark.skipif(
    not os.environ.get("UJI_DATABASE_URL"),
    reason="Mengandalkan SELECT ... FOR UPDATE yang diabaikan SQLite; jalankan dengan UJI_DATABASE_URL (MySQL).",
)


def _siapkan(mesin, jumlah_pelanggan: int, stok_mawar=20, stok_anyelir=20):
    """Dua stok, satu admin, N pelanggan, dan satu paket (6 mawar + 6 anyelir). Mengembalikan ids."""
    Sesi = sessionmaker(bind=mesin, autoflush=False, expire_on_commit=False)
    with Sesi() as db:
        w, j = siapkan_referensi(db)
        admin = buat_pengguna(db, "admin@contoh.id", Peran.admin)
        pelanggan = [buat_pengguna(db, f"pel{i}@contoh.id") for i in range(jumlah_pelanggan)]
        s1 = layanan_stok.tambah_stok(db, id_jenis_bunga=j["Mawar"].id_jenis_bunga, id_warna=w["Merah tua"].id_warna,
                                      jumlah=stok_mawar, harga_per_tangkai=8000, jenis=JenisMutasi.masuk_manual, oleh=admin)
        s2 = layanan_stok.tambah_stok(db, id_jenis_bunga=j["Anyelir"].id_jenis_bunga, id_warna=w["Putih"].id_warna,
                                      jumlah=stok_anyelir, harga_per_tangkai=4000, jenis=JenisMutasi.masuk_manual, oleh=admin)
        from app.models.katalog import KomposisiProduk, Produk

        produk = Produk(nama_produk="Buket Cinta", acara="Anniversary", harga=150000, komposisi=[
            KomposisiProduk(id_jenis_bunga=j["Mawar"].id_jenis_bunga, id_warna=w["Merah tua"].id_warna, jumlah_tangkai=6),
            KomposisiProduk(id_jenis_bunga=j["Anyelir"].id_jenis_bunga, id_warna=w["Putih"].id_warna, jumlah_tangkai=6)])
        db.add(produk)
        db.commit()
        return Sesi, [p.id_pengguna for p in pelanggan], admin.id_pengguna, produk.id_produk, s1.id_stok, s2.id_stok


def _checkout_in(id_produk: int) -> CheckoutIn:
    return CheckoutIn(items=[{"jenis_item": "paket", "id_produk": id_produk, "jumlah": 1}], nama_penerima="Budi",
                      tanggal_kirim=hari_ini_wib() + timedelta(days=2), slot_jam="09:00-11:00")


def _serentak(n: int, kerja) -> list:
    """Menjalankan `kerja(i)` di n thread yang dilepas bersamaan; mengembalikan hasil atau galat tiap thread."""
    hasil = [None] * n
    gerbang = threading.Barrier(n)

    def bungkus(i: int):
        gerbang.wait()
        try:
            hasil[i] = kerja(i)
        except Exception as galat:  # noqa: BLE001 - galat apa pun harus terlihat oleh asersi
            hasil[i] = galat

    utas = [threading.Thread(target=bungkus, args=(i,)) for i in range(n)]
    [t.start() for t in utas]
    [t.join(timeout=60) for t in utas]
    assert not any(t.is_alive() for t in utas), "ada thread yang menggantung (kemungkinan deadlock)"
    return hasil


def test_checkout_serentak_tidak_menjual_berlebih_dan_tanpa_deadlock(mesin_konkurensi):
    """8 pelanggan serentak membeli paket (6+6) dari stok 20+20: paling banyak 3 yang bisa terlayani."""
    Sesi, pelanggan, _, id_produk, id_mawar, id_anyelir = _siapkan(mesin_konkurensi, jumlah_pelanggan=8)

    def pesan(i: int):
        with Sesi() as db:
            from app.models.pengguna import Pengguna

            p = layanan.checkout(db, db.get(Pengguna, pelanggan[i]), _checkout_in(id_produk))
            db.commit()
            return p.id_pesanan

    hasil = _serentak(8, pesan)
    berhasil = [h for h in hasil if isinstance(h, int)]
    gagal = [h for h in hasil if isinstance(h, StokTidakCukup)]
    lain = [h for h in hasil if not isinstance(h, (int, StokTidakCukup))]
    assert not lain, f"galat tak terduga (mis. deadlock): {lain}"
    assert len(berhasil) == 3 and len(gagal) == 5

    with Sesi() as db:
        mawar, anyelir = db.get(Stok, id_mawar), db.get(Stok, id_anyelir)
        assert (mawar.jumlah_tersedia, mawar.jumlah_ditahan) == (2, 18)
        assert (anyelir.jumlah_tersedia, anyelir.jumlah_ditahan) == (2, 18)
        assert db.scalars(select(Pesanan)).all().__len__() == 3  # pesanan yang kalah tidak meninggalkan sisa
        tahan = sum(m.jumlah for m in db.scalars(select(MutasiStok).where(MutasiStok.jenis == JenisMutasi.tahan)))
        assert tahan == 36  # buku mutasi cocok dengan angka stok


@butuh_kunci_baris
def test_sahkan_serentak_pada_pembayaran_yang_sama_hanya_satu_berhasil(mesin_konkurensi):
    """Klik ganda / dua admin menyahkan bukti yang sama: stok hanya terpotong sekali."""
    Sesi, pelanggan, id_admin, id_produk, id_mawar, _ = _siapkan(mesin_konkurensi, jumlah_pelanggan=1)
    from app.models.pengguna import Pengguna

    with Sesi() as db:
        p = layanan.checkout(db, db.get(Pengguna, pelanggan[0]), _checkout_in(id_produk))
        layanan.unggah_bukti(db, id_pesanan=p.id_pesanan, pelanggan=db.get(Pengguna, pelanggan[0]),
                             data=gambar_bytes(), nama_pengirim="Budi", nominal=Decimal("150000"))
        db.commit()
        id_pesanan, id_pembayaran = p.id_pesanan, p.pembayaran[0].id_pembayaran

    def sahkan(i: int):
        with Sesi() as db:
            layanan.sahkan_pembayaran(db, id_pesanan=id_pesanan, id_pembayaran=id_pembayaran, admin=db.get(Pengguna, id_admin))
            db.commit()
            return "sah"

    hasil = _serentak(6, sahkan)
    assert hasil.count("sah") == 1, hasil
    assert all(isinstance(h, KesalahanAplikasi) for h in hasil if h != "sah"), hasil

    with Sesi() as db:
        mawar = db.get(Stok, id_mawar)
        assert (mawar.jumlah_tersedia, mawar.jumlah_ditahan) == (14, 0)  # 20 - 6, tahanan habis TEPAT sekali
        assert db.get(Pesanan, id_pesanan).status == StatusPesanan.sedang_dirangkai
        pakai = list(db.scalars(select(MutasiStok).where(MutasiStok.jenis == JenisMutasi.pakai, MutasiStok.id_stok == id_mawar)))
        assert len(pakai) == 1


@butuh_kunci_baris
def test_batal_dan_sahkan_serentak_berakhir_konsisten(mesin_konkurensi):
    """Pelanggan membatalkan pada saat yang sama admin mengesahkan: salah satu menang, stok tetap konsisten."""
    Sesi, pelanggan, id_admin, id_produk, id_mawar, id_anyelir = _siapkan(mesin_konkurensi, jumlah_pelanggan=1)
    from app.models.pengguna import Pengguna

    with Sesi() as db:
        pel = db.get(Pengguna, pelanggan[0])
        p = layanan.checkout(db, pel, _checkout_in(id_produk))
        layanan.unggah_bukti(db, id_pesanan=p.id_pesanan, pelanggan=pel, data=gambar_bytes(), nama_pengirim="Budi", nominal=Decimal("150000"))
        db.commit()
        id_pesanan, id_pembayaran = p.id_pesanan, p.pembayaran[0].id_pembayaran

    def aksi(i: int):
        with Sesi() as db:
            if i % 2 == 0:
                layanan.sahkan_pembayaran(db, id_pesanan=id_pesanan, id_pembayaran=id_pembayaran, admin=db.get(Pengguna, id_admin))
            else:
                layanan.batalkan_oleh_pelanggan(db, id_pesanan=id_pesanan, pelanggan=db.get(Pengguna, pelanggan[0]), alasan=None)
            db.commit()
            return "ok"

    hasil = _serentak(4, aksi)
    assert hasil.count("ok") == 1, hasil
    assert all(isinstance(h, KesalahanAplikasi) for h in hasil if h != "ok"), hasil

    with Sesi() as db:
        status = db.get(Pesanan, id_pesanan).status
        mawar, anyelir = db.get(Stok, id_mawar), db.get(Stok, id_anyelir)
        if status == StatusPesanan.dibatalkan:
            assert [(s.jumlah_tersedia, s.jumlah_ditahan) for s in (mawar, anyelir)] == [(20, 0), (20, 0)]
        else:
            assert status == StatusPesanan.sedang_dirangkai
            assert [(s.jumlah_tersedia, s.jumlah_ditahan) for s in (mawar, anyelir)] == [(14, 0), (14, 0)]


@butuh_kunci_baris
def test_satu_pindai_disimpan_serentak_hanya_satu_mutasi(mesin_konkurensi):
    from app.core.errors import Konflik
    from app.models.enums import KonteksPindai
    from app.models.pengguna import Pengguna
    from app.models.stok import RiwayatPindai
    from app.services.pindai import simpan_pindai_ke_stok

    Sesi, _, admin, _, id_mawar, _ = _siapkan(mesin_konkurensi, 1)
    with Sesi() as db:
        stok = db.get(Stok, id_mawar)
        jenis, warna = stok.id_jenis_bunga, stok.id_warna
        pindai = RiwayatPindai(id_pengguna=admin, konteks=KonteksPindai.stok_masuk, foto_pindai="uji.jpg")
        db.add(pindai)
        db.commit()
        id_pindai = pindai.id_pindai

    def simpan(_):
        with Sesi() as db:
            # Simulasikan objek yang sudah dibaca sebelum request lain melakukan commit.
            db.get(RiwayatPindai, id_pindai)
            simpan_pindai_ke_stok(db, id_pindai=id_pindai, id_jenis_bunga=jenis, id_warna=warna,
                                 jumlah_tangkai=7, harga_per_tangkai=8000, admin=db.get(Pengguna, admin))
            db.commit()
            return "ok"

    hasil = _serentak(6, simpan)
    assert hasil.count("ok") == 1, hasil
    assert all(isinstance(h, Konflik) for h in hasil if h != "ok"), hasil
    with Sesi() as db:
        assert db.get(Stok, id_mawar).jumlah_tersedia == 27
        mutasi = list(db.scalars(select(MutasiStok).where(MutasiStok.jenis == JenisMutasi.masuk_pindai)))
        assert len(mutasi) == 1 and mutasi[0].jumlah == 7


@butuh_kunci_baris
def test_dua_admin_saling_nonaktifkan_menyisakan_satu_aktif(mesin_konkurensi):
    from app.core.errors import Dilarang
    from app.models.pengguna import Pengguna
    from app.services.akun import atur_aktif

    Sesi, _, admin, _, _, _ = _siapkan(mesin_konkurensi, 1)
    with Sesi() as db:
        kedua = buat_pengguna(db, "admin-kedua@contoh.id", Peran.admin)
        db.commit()
        admins = [admin, kedua.id_pengguna]

    def nonaktifkan(i):
        with Sesi() as db:
            atur_aktif(db, id_pengguna=admins[1 - i], aktif=False, oleh=db.get(Pengguna, admins[i]))
            db.commit()
            return "ok"

    hasil = _serentak(2, nonaktifkan)
    assert hasil.count("ok") == 1 and sum(isinstance(h, Dilarang) for h in hasil) == 1, hasil
    with Sesi() as db:
        assert sum(a.aktif for a in db.scalars(select(Pengguna).where(Pengguna.peran == Peran.admin))) == 1


@butuh_kunci_baris
def test_retry_checkout_serentak_satu_pesanan_satu_tahanan(mesin_konkurensi):
    from app.models.pengguna import Pengguna

    Sesi, pelanggan, _, produk, id_mawar, id_anyelir = _siapkan(mesin_konkurensi, 1)

    def pesan(_):
        with Sesi() as db:
            p = layanan.checkout(db, db.get(Pengguna, pelanggan[0]), _checkout_in(produk), kunci="retry-serentak-123")
            db.commit()
            return p.id_pesanan

    hasil = _serentak(6, pesan)
    assert all(isinstance(h, int) for h in hasil) and len(set(hasil)) == 1, hasil
    with Sesi() as db:
        assert len(list(db.scalars(select(Pesanan)))) == 1
        assert [(db.get(Stok, i).jumlah_tersedia, db.get(Stok, i).jumlah_ditahan)
                for i in (id_mawar, id_anyelir)] == [(14, 6), (14, 6)]
