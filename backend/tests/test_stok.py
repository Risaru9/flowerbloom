import threading

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import sessionmaker

from app.core.errors import DataTidakValid, StokTidakCukup
from app.models.enums import JenisMutasi, Peran
from app.models.stok import MutasiStok, Stok
from app.services import stok as layanan
from tests.bantu import buat_pengguna, siapkan_referensi


@pytest.fixture()
def dunia(db):
    warna, jenis = siapkan_referensi(db)
    admin = buat_pengguna(db, "admin@contoh.id", Peran.admin)
    return warna, jenis, admin


def _stok(db, dunia, jumlah=10, harga=5000, jenis="Mawar", warna="Merah tua"):
    w, j, admin = dunia
    s = layanan.tambah_stok(
        db,
        id_jenis_bunga=j[jenis].id_jenis_bunga,
        id_warna=w[warna].id_warna,
        jumlah=jumlah,
        harga_per_tangkai=harga,
        jenis=JenisMutasi.masuk_manual,
        oleh=admin,
    )
    db.commit()
    return s


def _muat(db, id_stok):
    db.expire_all()
    return db.get(Stok, id_stok)


def test_tambah_stok_membuat_lalu_menambah_baris_yang_sama(db, dunia):
    s = _stok(db, dunia, jumlah=10, harga=5000)
    lagi = _stok(db, dunia, jumlah=5, harga=6000)
    assert lagi.id_stok == s.id_stok  # unik per (jenis, warna)
    s = _muat(db, s.id_stok)
    assert s.jumlah_tersedia == 15 and float(s.harga_per_tangkai) == 6000  # harga terbaru menimpa
    assert layanan.jumlah_masuk_per_stok(db) == {s.id_stok: 15}


def test_tambah_stok_menolak_jumlah_nol(db, dunia):
    w, j, admin = dunia
    with pytest.raises(DataTidakValid):
        layanan.tambah_stok(db, id_jenis_bunga=j["Mawar"].id_jenis_bunga, id_warna=w["Putih"].id_warna, jumlah=0,
                            harga_per_tangkai=1000, jenis=JenisMutasi.masuk_manual, oleh=admin)


def test_siklus_tahan_lepas_pakai(db, dunia):
    s = _stok(db, dunia, jumlah=10)
    layanan.tahan(db, {s.id_stok: 4}, id_pesanan=None)
    db.commit()
    s = _muat(db, s.id_stok)
    assert (s.jumlah_tersedia, s.jumlah_ditahan) == (6, 4)

    layanan.lepas(db, {s.id_stok: 1}, id_pesanan=None)
    db.commit()
    s = _muat(db, s.id_stok)
    assert (s.jumlah_tersedia, s.jumlah_ditahan) == (7, 3)

    layanan.pakai_tahanan(db, {s.id_stok: 3}, id_pesanan=None)
    db.commit()
    s = _muat(db, s.id_stok)
    assert (s.jumlah_tersedia, s.jumlah_ditahan) == (7, 0)

    jenis = [m.jenis for m in db.scalars(select(MutasiStok).order_by(MutasiStok.id_mutasi))]
    assert jenis == [JenisMutasi.masuk_manual, JenisMutasi.tahan, JenisMutasi.lepas, JenisMutasi.pakai]


def test_tahan_melebihi_stok_ditolak_dan_melaporkan_semua_kekurangan(db, dunia):
    a = _stok(db, dunia, jumlah=3, jenis="Mawar", warna="Merah tua")
    b = _stok(db, dunia, jumlah=2, jenis="Anyelir", warna="Putih")
    c = _stok(db, dunia, jumlah=50, jenis="Bunga matahari", warna="Kuning")
    with pytest.raises(StokTidakCukup) as galat:
        layanan.tahan(db, {a.id_stok: 5, b.id_stok: 9, c.id_stok: 1}, id_pesanan=None)
    db.rollback()  # yang dilakukan get_db saat permintaan gagal
    diminta = {r["id_stok"]: (r["diminta"], r["tersedia"]) for r in galat.value.rincian}
    assert diminta == {a.id_stok: (5, 3), b.id_stok: (9, 2)}
    # tidak ada yang ikut tertahan, termasuk stok c yang sebenarnya cukup
    assert [_muat(db, x.id_stok).jumlah_ditahan for x in (a, b, c)] == [0, 0, 0]


def test_dua_pelanggan_berebut_tangkai_terakhir(db, dunia):
    s = _stok(db, dunia, jumlah=3)
    layanan.tahan(db, {s.id_stok: 2}, id_pesanan=None)
    db.commit()
    with pytest.raises(StokTidakCukup):
        layanan.tahan(db, {s.id_stok: 2}, id_pesanan=None)
    db.rollback()
    layanan.tahan(db, {s.id_stok: 1}, id_pesanan=None)  # sisa satu masih bisa
    db.commit()
    assert _muat(db, s.id_stok).jumlah_tersedia == 0


def test_kebutuhan_yang_sama_digabung():
    assert layanan.gabung_kebutuhan([(1, 3), (2, 1), (1, 4)]) == {1: 7, 2: 1}


def test_koreksi_stok_dicatat_sebagai_selisih(db, dunia):
    _, _, admin = dunia
    s = _stok(db, dunia, jumlah=10)
    layanan.koreksi_stok(db, s, jumlah_tersedia=7, harga_per_tangkai=None, catatan="layu 3 tangkai", oleh=admin)
    db.commit()
    assert _muat(db, s.id_stok).jumlah_tersedia == 7
    koreksi = db.scalars(select(MutasiStok).where(MutasiStok.jenis == JenisMutasi.koreksi)).one()
    assert koreksi.jumlah == -3 and koreksi.catatan == "layu 3 tangkai"


def test_constraint_basis_data_menolak_stok_negatif(db, dunia):
    """Pagar terakhir. SQLite melapor IntegrityError, MySQL 8 melapor OperationalError 3819 untuk CHECK."""
    s = _stok(db, dunia, jumlah=2)
    s.jumlah_tersedia = -1
    with pytest.raises((IntegrityError, OperationalError)):
        db.commit()
    db.rollback()


def test_tidak_ada_penjualan_berlebih_saat_banyak_permintaan_bersamaan(mesin_konkurensi):
    """12 permintaan serentak (koneksi terpisah) berebut 5 tangkai: tepat 5 yang berhasil."""
    mesin = mesin_konkurensi
    Sesi = sessionmaker(bind=mesin, autoflush=False, expire_on_commit=False)
    with Sesi() as db:
        w, j = siapkan_referensi(db)
        admin = buat_pengguna(db, "admin@contoh.id", Peran.admin)
        s = layanan.tambah_stok(db, id_jenis_bunga=j["Mawar"].id_jenis_bunga, id_warna=w["Merah"].id_warna, jumlah=5,
                                harga_per_tangkai=1000, jenis=JenisMutasi.masuk_manual, oleh=admin)
        db.commit()
        id_stok = s.id_stok

    hasil: list[bool] = []
    kunci = threading.Lock()

    def pesan():
        with Sesi() as sesi:
            try:
                layanan.tahan(sesi, {id_stok: 1}, id_pesanan=None)
                sesi.commit()
                berhasil = True
            except StokTidakCukup:
                sesi.rollback()
                berhasil = False
        with kunci:
            hasil.append(berhasil)

    utas = [threading.Thread(target=pesan) for _ in range(12)]
    [t.start() for t in utas]
    [t.join() for t in utas]

    assert sum(hasil) == 5 and len(hasil) == 12
    with Sesi() as db:
        akhir = db.get(Stok, id_stok)
        assert (akhir.jumlah_tersedia, akhir.jumlah_ditahan) == (0, 5)
