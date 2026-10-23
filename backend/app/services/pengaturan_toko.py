"""Pengaturan toko (F-AD-16).

Daftar kunci, nilai bawaan, dan aturan validasinya didefinisikan di ``DEFINISI``. Nilai bawaan di bawah
adalah ASUMSI PENGEMBANGAN (proposal tidak menyebut angkanya) dan dapat diubah admin lewat API.
"""
import json
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DataTidakValid
from app.models.toko import PengaturanToko as BarisPengaturan

POLA_SLOT = re.compile(r"^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$")
KEBIJAKAN_PENGGANTI = ("hanya_warna_berbeda", "semua_pengganti")


@dataclass(frozen=True)
class Definisi:
    bawaan: Any
    tipe: str  # 'int' | 'teks' | 'daftar_slot' | 'pilihan'
    keterangan: str
    minimal: int = 0
    pilihan: tuple[str, ...] = ()


DEFINISI: dict[str, Definisi] = {
    "nama_toko": Definisi("FlowerBloom", "teks", "Nama toko yang ditampilkan."),
    "rekening_tujuan": Definisi(
        "(belum diatur)", "teks", "Rekening tujuan transfer yang ditampilkan kepada pelanggan (AB-03)."
    ),
    "batas_bayar_menit": Definisi(
        120, "int", "Batas waktu bayar sejak pesanan dibuat, dalam menit (AB-02).", minimal=5
    ),
    "ongkos_antar": Definisi(15000, "int", "Ongkos antar dalam kota (rupiah).", minimal=0),
    "jasa_merangkai": Definisi(10000, "int", "Jasa merangkai untuk rangkaian buatan sendiri (rupiah).", minimal=0),
    "jumlah_revisi_gratis": Definisi(1, "int", "Jumlah revisi foto yang gratis (AB-06).", minimal=0),
    "minimal_tangkai_rangkai_sendiri": Definisi(5, "int", "Jumlah tangkai minimal untuk rangkai sendiri.", minimal=1),
    "slot_pengiriman": Definisi(
        ["09:00-11:00", "11:00-13:00", "13:00-15:00", "15:00-17:00"],
        "daftar_slot",
        "Slot jam serah terima, format HH:MM-HH:MM.",
    ),
    "kebijakan_pengganti": Definisi(
        "hanya_warna_berbeda",
        "pilihan",
        "Kapan bunga pengganti wajib disetujui pelanggan (AB-07): hanya bila warnanya berbeda, atau semua pengganti.",
        pilihan=KEBIJAKAN_PENGGANTI,
    ),
    "ambang_stok_menipis": Definisi(10, "int", "Stok tersedia <= angka ini ditandai menipis.", minimal=0),
    "minimal_hari_pemesanan": Definisi(1, "int", "Pesanan paling lambat H-n dari tanggal serah terima (AB-04).", minimal=0),
    "batas_tanggapan_foto_jam": Definisi(
        24,
        "int",
        "Batas wajar pelanggan menanggapi foto, dalam jam (AB-10). Saat ini hanya menandai pesanan terlambat "
        "untuk admin; belum ada tindakan otomatis (menunggu keputusan tim).",
        minimal=1,
    ),
    "batas_komplain_jam": Definisi(24, "int", "Batas pengajuan komplain sejak pesanan selesai (AB-09).", minimal=1),
}


@dataclass(frozen=True)
class PengaturanTerkini:
    """Potret bertipe dari semua pengaturan, dipakai layanan lain agar tidak membaca string mentah."""

    nama_toko: str
    rekening_tujuan: str
    batas_bayar_menit: int
    ongkos_antar: int
    jasa_merangkai: int
    jumlah_revisi_gratis: int
    minimal_tangkai_rangkai_sendiri: int
    slot_pengiriman: list[str]
    kebijakan_pengganti: str
    ambang_stok_menipis: int
    minimal_hari_pemesanan: int
    batas_tanggapan_foto_jam: int
    batas_komplain_jam: int


def _nilai_tersimpan(db: Session) -> dict[str, Any]:
    tersimpan = {}
    for baris in db.scalars(select(BarisPengaturan)):
        if baris.kunci in DEFINISI:
            tersimpan[baris.kunci] = json.loads(baris.nilai)
    return tersimpan


def ambil(db: Session) -> PengaturanTerkini:
    tersimpan = _nilai_tersimpan(db)
    return PengaturanTerkini(**{kunci: tersimpan.get(kunci, d.bawaan) for kunci, d in DEFINISI.items()})


def daftar_lengkap(db: Session) -> list[dict[str, Any]]:
    tersimpan = _nilai_tersimpan(db)
    return [
        {"kunci": kunci, "nilai": tersimpan.get(kunci, d.bawaan), "keterangan": d.keterangan, "tipe": d.tipe}
        for kunci, d in DEFINISI.items()
    ]


def _validasi(kunci: str, nilai: Any) -> Any:
    d = DEFINISI[kunci]
    if d.tipe == "int":
        if isinstance(nilai, bool) or not isinstance(nilai, int):
            raise DataTidakValid(f"'{kunci}' harus berupa bilangan bulat.")
        if nilai < d.minimal:
            raise DataTidakValid(f"'{kunci}' minimal {d.minimal}.")
    elif d.tipe == "teks":
        if not isinstance(nilai, str) or not nilai.strip():
            raise DataTidakValid(f"'{kunci}' harus berupa teks tidak kosong.")
        nilai = nilai.strip()
    elif d.tipe == "pilihan":
        if nilai not in d.pilihan:
            raise DataTidakValid(f"'{kunci}' harus salah satu dari: {', '.join(d.pilihan)}.")
    elif d.tipe == "daftar_slot":
        if not isinstance(nilai, list) or not nilai or not all(isinstance(s, str) and POLA_SLOT.match(s) for s in nilai):
            raise DataTidakValid(f"'{kunci}' harus daftar slot berformat HH:MM-HH:MM.")
        if len(set(nilai)) != len(nilai):
            raise DataTidakValid(f"'{kunci}' memuat slot ganda.")
    return nilai


def perbarui(db: Session, perubahan: dict[str, Any]) -> PengaturanTerkini:
    """Memperbarui sebagian pengaturan. Kunci tak dikenal ditolak; seluruh perubahan gagal bila satu tidak valid."""
    tak_dikenal = sorted(set(perubahan) - set(DEFINISI))
    if tak_dikenal:
        raise DataTidakValid(f"Pengaturan tidak dikenal: {', '.join(tak_dikenal)}.", kode="pengaturan_tidak_dikenal")
    bersih = {kunci: _validasi(kunci, nilai) for kunci, nilai in perubahan.items()}
    for kunci, nilai in bersih.items():
        baris = db.get(BarisPengaturan, kunci)
        teks = json.dumps(nilai, ensure_ascii=False)
        if baris is None:
            db.add(BarisPengaturan(kunci=kunci, nilai=teks))
        else:
            baris.nilai = teks
    db.flush()
    return ambil(db)
