"""Pemindaian gambar oleh admin: warna (+ jenis bila klasifikator aktif) bunga (F-AD-11, F-AI-01..07, F-AI-09).

Alur pindai stok masuk (Gambar 4.3 proposal):
1. ``analisis_bunga``       : simpan foto, hitung warna dominan, tebak jenis bila klasifikator aktif, catat ``riwayat_pindai``.
   Bawaannya klasifikator TIDAK aktif (``AI_MODE=nonaktif``): admin memilih jenis, warna tetap otomatis.
2. admin memilih jenis dan memeriksa/mengoreksi hasil (F-AI-03) di antarmuka.
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
    keyakinan: float | None  # None bila jenis tidak ditebak otomatis (klasifikator tidak aktif)
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

    label = label_warna_bunga(gambar, katalog)
    warna = db.get(Warna, label.id_warna)

    jenis: JenisBunga | None = None
    keyakinan: float | None = None
    dikenali = False
    peringatan: list[str] = []
    klasifikator = ambil_klasifikator()
    if klasifikator is not None:
        klasifikasi = klasifikator.klasifikasi(gambar)
        keyakinan = klasifikasi.keyakinan
        jenis = db.scalar(select(JenisBunga).where(JenisBunga.kelas_dataset == klasifikasi.kelas_dataset))
        dikenali = keyakinan >= pengaturan.ambang_keyakinan
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
        tingkat_keyakinan=keyakinan,
        dikenali=dikenali,
    )
    db.add(riwayat)
    db.flush()

    return HasilPindai(
        riwayat=riwayat,
        jenis=jenis,
        warna=warna,
        keyakinan=keyakinan,
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
    # Locking read juga menyegarkan objek yang mungkin sudah ada di identity map.
    riwayat = db.scalar(select(RiwayatPindai).where(RiwayatPindai.id_pindai == id_pindai)
                        .with_for_update().execution_options(populate_existing=True))
    if riwayat is None:
        raise TidakDitemukan("Riwayat pindai tidak ditemukan.")
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
    # Jenis hanya dinilai bila memang ditebak otomatis (ada keyakinan); tanpa klasifikator admin memilihnya sendiri.
    jenis_dikoreksi = riwayat.tingkat_keyakinan is not None and riwayat.id_jenis_bunga_prediksi != id_jenis_bunga
    riwayat.dikoreksi = jenis_dikoreksi or riwayat.id_warna_prediksi != id_warna
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
    """Akurasi pembacaan di pemakaian nyata: hanya pindai stok yang sudah disimpan (ada nilai akhir dari admin).

    Akurasi jenis hanya dihitung atas pindai yang jenisnya memang ditebak otomatis (``tingkat_keyakinan`` terisi).
    """
    baris = list(
        db.scalars(
            select(RiwayatPindai).where(
                RiwayatPindai.konteks == KonteksPindai.stok_masuk, RiwayatPindai.id_stok.is_not(None)
            )
        )
    )
    total = len(baris)
    ditebak = [b for b in baris if b.tingkat_keyakinan is not None]
    jenis_benar = sum(1 for b in ditebak if b.id_jenis_bunga_prediksi == b.id_jenis_bunga_final)
    warna_benar = sum(1 for b in baris if b.id_warna_prediksi == b.id_warna_final)
    return {
        "total_disimpan": total,
        "total_jenis_ditebak": len(ditebak),
        "jenis_benar": jenis_benar,
        "warna_benar": warna_benar,
        "akurasi_jenis": round(jenis_benar / len(ditebak), 4) if ditebak else None,
        "akurasi_warna": round(warna_benar / total, 4) if total else None,
    }
