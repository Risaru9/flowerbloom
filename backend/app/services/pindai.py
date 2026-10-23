"""Pemindaian gambar oleh admin: jenis + warna bunga (F-AD-11, F-AI-01..07, F-AI-09).

Alur pindai stok masuk (Gambar 4.3 proposal):
1. ``analisis_bunga``       : simpan foto, klasifikasi jenis, hitung warna dominan, catat ``riwayat_pindai``.
2. admin memeriksa/mengoreksi hasil (F-AI-03) di antarmuka.
3. ``simpan_pindai_ke_stok``: stok bertambah, riwayat ditautkan ke stok beserta nilai akhirnya.
"""
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.deskripsi import deskripsi_bunga
from app.ai.klasifikator import ambil_klasifikator
from app.ai.warna import label_warna_bunga
from app.config import ambil_pengaturan
from app.core.errors import Konflik, TidakDitemukan
from app.core.penyimpanan import ambil_penyimpanan, buka_gambar
from app.models.bunga import JenisBunga, Warna
from app.models.enums import JenisMutasi, KonteksPindai
from app.models.pengguna import Pengguna
from app.models.stok import RiwayatPindai, Stok
from app.services import referensi
from app.services import stok as layanan_stok


@dataclass
class HasilPindai:
    riwayat: RiwayatPindai
    jenis: JenisBunga | None
    warna: Warna
    keyakinan: float
    jarak_warna: float
    rgb_terbaca: tuple[int, int, int]
    dikenali: bool
    deskripsi: str | None
    peringatan: list[str]


def analisis_bunga(
    db: Session,
    *,
    data: bytes,
    admin: Pengguna,
    konteks: KonteksPindai,
    id_pesanan: int | None = None,
) -> HasilPindai:
    gambar = buka_gambar(data)
    pengaturan = ambil_pengaturan()
    katalog = referensi.katalog_warna_rgb(db)

    klasifikasi = ambil_klasifikator().klasifikasi(gambar)
    jenis = db.scalar(select(JenisBunga).where(JenisBunga.kelas_dataset == klasifikasi.kelas_dataset))
    label = label_warna_bunga(gambar, katalog)
    warna = db.get(Warna, label.id_warna)

    peringatan: list[str] = []
    dikenali = klasifikasi.keyakinan >= pengaturan.ambang_keyakinan
    if jenis is None:
        dikenali = False
        peringatan.append(
            f"Kelas {klasifikasi.kelas_dataset} belum ada di tabel jenis_bunga; pilih jenis secara manual."
        )
    elif not dikenali:
        peringatan.append("Bunga tidak dikenali (keyakinan di bawah ambang). Pilih jenis dan warna secara manual.")

    foto = ambil_penyimpanan().simpan_gambar(gambar, area="privat", kategori="pindai")
    riwayat = RiwayatPindai(
        id_pengguna=admin.id_pengguna,
        id_pesanan=id_pesanan,
        konteks=konteks,
        foto_pindai=foto,
        jenis_prediksi=jenis.nama_bunga if jenis else None,
        warna_prediksi=warna.nama_warna,
        id_jenis_bunga_prediksi=jenis.id_jenis_bunga if jenis else None,
        id_warna_prediksi=warna.id_warna,
        tingkat_keyakinan=klasifikasi.keyakinan,
        dikenali=dikenali,
    )
    db.add(riwayat)
    db.flush()

    return HasilPindai(
        riwayat=riwayat,
        jenis=jenis,
        warna=warna,
        keyakinan=klasifikasi.keyakinan,
        jarak_warna=label.jarak,
        rgb_terbaca=label.rgb,
        dikenali=dikenali,
        deskripsi=deskripsi_bunga(jenis.nama_bunga, warna.nama_warna, jenis.bentuk_bunga) if jenis else None,
        peringatan=peringatan,
    )


def ambil_pindai(db: Session, id_pindai: int) -> RiwayatPindai:
    riwayat = db.get(RiwayatPindai, id_pindai)
    if not riwayat:
        raise TidakDitemukan("Riwayat pindai tidak ditemukan.")
    return riwayat


def simpan_pindai_ke_stok(
    db: Session,
    *,
    id_pindai: int,
    id_jenis_bunga: int,
    id_warna: int,
    jumlah_tangkai: int,
    harga_per_tangkai,
    admin: Pengguna,
) -> Stok:
    """Menyimpan hasil pindai (yang sudah diperiksa/dikoreksi admin) sebagai stok. AB-11."""
    riwayat = ambil_pindai(db, id_pindai)
    if riwayat.konteks != KonteksPindai.stok_masuk:
        raise Konflik("Pindai ini bukan pindai stok masuk.", kode="pindai_bukan_stok_masuk")
    if riwayat.id_stok is not None:
        raise Konflik("Hasil pindai ini sudah disimpan sebagai stok.", kode="pindai_sudah_disimpan")

    stok = layanan_stok.tambah_stok(
        db,
        id_jenis_bunga=id_jenis_bunga,
        id_warna=id_warna,
        jumlah=jumlah_tangkai,
        harga_per_tangkai=harga_per_tangkai,
        jenis=JenisMutasi.masuk_pindai,
        oleh=admin,
    )
    riwayat.id_stok = stok.id_stok
    riwayat.id_jenis_bunga_final = id_jenis_bunga
    riwayat.id_warna_final = id_warna
    riwayat.dikoreksi = (
        riwayat.id_jenis_bunga_prediksi != id_jenis_bunga or riwayat.id_warna_prediksi != id_warna
    )
    db.flush()
    return stok


# --- Riwayat dan akurasi (F-AD-18) --------------------------------------------------------------------------


def daftar_riwayat(
    db: Session, *, halaman: int, per_halaman: int, hanya_dikoreksi: bool = False
) -> tuple[list[RiwayatPindai], int]:
    kueri = select(RiwayatPindai)
    if hanya_dikoreksi:
        kueri = kueri.where(RiwayatPindai.dikoreksi.is_(True))
    total = db.scalar(select(func.count()).select_from(kueri.subquery()))
    baris = db.scalars(
        kueri.order_by(RiwayatPindai.id_pindai.desc()).limit(per_halaman).offset((halaman - 1) * per_halaman)
    )
    return list(baris), int(total)


def ringkasan_akurasi(db: Session) -> dict:
    """Akurasi model di pemakaian nyata: hanya pindai stok yang sudah disimpan (ada nilai akhir dari admin)."""
    baris = list(
        db.scalars(
            select(RiwayatPindai).where(
                RiwayatPindai.konteks == KonteksPindai.stok_masuk, RiwayatPindai.id_stok.is_not(None)
            )
        )
    )
    total = len(baris)
    if not total:
        return {"total_disimpan": 0, "jenis_benar": 0, "warna_benar": 0, "akurasi_jenis": None, "akurasi_warna": None}
    jenis_benar = sum(1 for b in baris if b.id_jenis_bunga_prediksi == b.id_jenis_bunga_final)
    warna_benar = sum(1 for b in baris if b.id_warna_prediksi == b.id_warna_final)
    return {
        "total_disimpan": total,
        "jenis_benar": jenis_benar,
        "warna_benar": warna_benar,
        "akurasi_jenis": round(jenis_benar / total, 4),
        "akurasi_warna": round(warna_benar / total, 4),
    }
