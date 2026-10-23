"""Nilai-nilai ENUM. Nilai string sama persis dengan yang tertulis di proposal (Bab 4.3.3)."""
from enum import Enum

from sqlalchemy import Enum as SAEnum


def kolom_enum(kelas: type[Enum]) -> SAEnum:
    """ENUM basis data yang menyimpan *nilai* (bukan nama) anggota enum Python."""
    return SAEnum(
        kelas,
        name=kelas.__name__.lower(),
        values_callable=lambda e: [anggota.value for anggota in e],
        validate_strings=True,
    )


class Peran(str, Enum):
    pelanggan = "pelanggan"
    admin = "admin"


class JenisButaWarna(str, Enum):
    normal = "normal"
    protan = "protan"
    deutan = "deutan"
    tritan = "tritan"


class Tema(str, Enum):
    terang = "terang"
    gelap = "gelap"


class KonteksPindai(str, Enum):
    stok_masuk = "stok_masuk"
    mode_rangkai = "mode_rangkai"


class JenisItem(str, Enum):
    paket = "paket"
    rangkai_sendiri = "rangkai_sendiri"


class CaraSerahTerima(str, Enum):
    ambil_di_toko = "ambil_di_toko"
    antar = "antar"


class StatusPesanan(str, Enum):
    """Tujuh tahap dari proposal ditambah ``dibatalkan`` (dibutuhkan AB-02 dan F-PL-15)."""

    menunggu_pembayaran = "menunggu_pembayaran"
    menunggu_verifikasi = "menunggu_verifikasi"
    sedang_dirangkai = "sedang_dirangkai"
    menunggu_persetujuan_foto = "menunggu_persetujuan_foto"
    siap_diambil = "siap_diambil"
    diantar = "diantar"
    selesai = "selesai"
    dibatalkan = "dibatalkan"


class StatusVerifikasi(str, Enum):
    menunggu = "menunggu"
    sah = "sah"
    ditolak = "ditolak"


class StatusPersetujuan(str, Enum):
    menunggu = "menunggu"
    disetujui = "disetujui"
    revisi = "revisi"


class StatusKomplain(str, Enum):
    baru = "baru"
    diproses = "diproses"
    selesai = "selesai"


class JenisMutasi(str, Enum):
    masuk_pindai = "masuk_pindai"
    masuk_manual = "masuk_manual"
    tahan = "tahan"
    lepas = "lepas"
    pakai = "pakai"
    koreksi = "koreksi"
