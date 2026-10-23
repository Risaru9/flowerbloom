"""Uji unit mesin status pesanan (tanpa HTTP)."""
import pytest

from app.core.errors import TransisiTidakSah
from app.models.enums import CaraSerahTerima, Peran, StatusPesanan
from app.models.pesanan import Pesanan, RiwayatStatusPesanan
from app.services import alur_pesanan
from tests.bantu import buat_pengguna

S = StatusPesanan


def _pesanan(db, status=S.menunggu_pembayaran, cara=CaraSerahTerima.ambil_di_toko) -> Pesanan:
    from datetime import date

    pel = buat_pengguna(db, "pel@contoh.id")
    p = Pesanan(id_pengguna=pel.id_pengguna, kode_pesanan="FB-UJI", nama_penerima="X", tanggal_kirim=date(2026, 10, 1),
                slot_jam="09:00-11:00", cara_serah_terima=cara, total_harga=1, status=status)
    db.add(p)
    db.commit()
    return p


def test_setiap_status_terdaftar_dan_akhir_tak_punya_jalan_keluar():
    assert set(alur_pesanan.TRANSISI_SAH) == set(StatusPesanan) == set(alur_pesanan.INFO_STATUS)
    assert alur_pesanan.TRANSISI_SAH[S.selesai] == frozenset()
    assert alur_pesanan.TRANSISI_SAH[S.dibatalkan] == frozenset()


def test_semua_status_dapat_dicapai_dari_awal():
    dicapai, antre = {S.menunggu_pembayaran}, [S.menunggu_pembayaran]
    while antre:
        for tujuan in alur_pesanan.TRANSISI_SAH[antre.pop()]:
            if tujuan not in dicapai:
                dicapai.add(tujuan)
                antre.append(tujuan)
    assert dicapai == set(StatusPesanan)


@pytest.mark.parametrize(
    "dari, ke",
    [
        (S.menunggu_pembayaran, S.sedang_dirangkai),  # tidak boleh melompati verifikasi
        (S.menunggu_pembayaran, S.selesai),
        (S.sedang_dirangkai, S.selesai),  # foto wajib untuk semua pesanan (AB-05)
        (S.sedang_dirangkai, S.dibatalkan),  # AB-08
        (S.sedang_dirangkai, S.menunggu_pembayaran),
        (S.menunggu_persetujuan_foto, S.selesai),
        (S.siap_diambil, S.diantar),
        (S.selesai, S.sedang_dirangkai),
        (S.dibatalkan, S.menunggu_pembayaran),
    ],
)
def test_transisi_terlarang_ditolak_tanpa_jejak(db, dari, ke):
    p = _pesanan(db, dari)
    with pytest.raises(TransisiTidakSah):
        alur_pesanan.pindah_status(db, p, ke, oleh=None)
    db.rollback()
    assert p.status == dari
    assert db.query(RiwayatStatusPesanan).count() == 0


def test_transisi_sah_tercatat_dengan_pelaku(db):
    admin = buat_pengguna(db, "admin@contoh.id", Peran.admin)
    p = _pesanan(db, S.menunggu_verifikasi)
    alur_pesanan.pindah_status(db, p, S.sedang_dirangkai, oleh=admin, catatan="ok")
    alur_pesanan.pindah_status(db, p, S.menunggu_persetujuan_foto, oleh=None)
    db.commit()
    riwayat = db.query(RiwayatStatusPesanan).order_by(RiwayatStatusPesanan.id_riwayat).all()
    assert [(r.status_lama, r.status_baru, r.id_pengguna) for r in riwayat] == [
        (S.menunggu_verifikasi, S.sedang_dirangkai, admin.id_pengguna),
        (S.sedang_dirangkai, S.menunggu_persetujuan_foto, None),
    ]


def test_tahap_menyesuaikan_cara_serah_terima(db):
    ambil = alur_pesanan.tahap(_pesanan(db, S.sedang_dirangkai))
    assert [t["kode"] for t in ambil][-2:] == [S.siap_diambil, S.selesai]
    assert [t["keadaan"] for t in ambil] == ["selesai", "selesai", "aktif", "belum", "belum", "belum"]
    assert all(t["ikon"] and t["label"] for t in ambil)  # ikon dan teks selalu ada (F-AK-02)


def test_tahap_antar_dan_dibatalkan(db):
    antar = alur_pesanan.tahap(_pesanan(db, S.diantar, CaraSerahTerima.antar))
    assert S.diantar in [t["kode"] for t in antar] and S.siap_diambil not in [t["kode"] for t in antar]
