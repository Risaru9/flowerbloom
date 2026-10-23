"""Penyimpanan berkas gambar.

Struktur di bawah ``direktori_berkas``:

* ``publik/``  -> disajikan lewat ``/media`` (foto produk katalog).
* ``privat/``  -> hanya dapat dibuka lewat tautan bertanda tangan (bukti transfer, foto pindai,
                  foto hasil rangkaian, foto komplain). Tidak pernah dilayani sebagai berkas statis.

Setiap unggahan divalidasi sebagai gambar, diputar sesuai EXIF, lalu disimpan ulang sebagai JPEG
sehingga metadata (mis. lokasi GPS) hilang dan ukuran berkas terkendali.
"""
import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import ambil_pengaturan
from app.core.errors import DataTidakValid, TidakDitemukan
from app.core.waktu import sekarang_utc

FORMAT_DIIZINKAN = {"JPEG", "PNG", "WEBP"}
PIKSEL_MAKS = 40_000_000
SISI_MAKS = 1600


def baca_unggahan(berkas: UploadFile) -> bytes:
    """Membaca isi unggahan dengan batas ukuran (tanpa memuat berkas raksasa ke memori)."""
    batas = ambil_pengaturan().batas_unggah_byte
    data = berkas.file.read(batas + 1)
    if not data:
        raise DataTidakValid("Berkas kosong.", kode="berkas_kosong")
    if len(data) > batas:
        raise DataTidakValid(
            f"Ukuran berkas melebihi {ambil_pengaturan().ukuran_maks_unggah_mb} MB.", kode="berkas_terlalu_besar"
        )
    return data


def buka_gambar(data: bytes) -> Image.Image:
    """Memvalidasi dan membuka gambar sebagai RGB. Menolak berkas yang bukan JPEG/PNG/WEBP."""
    try:
        with Image.open(io.BytesIO(data)) as uji:
            format_gambar = uji.format
            lebar, tinggi = uji.size
            uji.verify()
    except Image.DecompressionBombError:
        raise DataTidakValid("Resolusi gambar terlalu besar.", kode="gambar_terlalu_besar") from None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise DataTidakValid("Berkas bukan gambar yang valid.", kode="bukan_gambar") from None
    if format_gambar not in FORMAT_DIIZINKAN:
        raise DataTidakValid("Format gambar harus JPEG, PNG, atau WEBP.", kode="format_tidak_didukung")
    if lebar * tinggi > PIKSEL_MAKS:
        raise DataTidakValid("Resolusi gambar terlalu besar.", kode="gambar_terlalu_besar")

    gambar = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    if gambar.mode in ("RGBA", "LA", "P"):
        gambar = gambar.convert("RGBA")
        latar = Image.new("RGB", gambar.size, (255, 255, 255))
        latar.paste(gambar, mask=gambar.getchannel("A"))
        return latar
    return gambar.convert("RGB")


class Penyimpanan:
    def __init__(self, akar: Path):
        self.akar = akar.resolve()

    def siapkan(self) -> None:
        (self.akar / "publik").mkdir(parents=True, exist_ok=True)
        (self.akar / "privat").mkdir(parents=True, exist_ok=True)

    def simpan_gambar(self, gambar: Image.Image, *, area: str, kategori: str) -> str:
        """Menyimpan gambar sebagai JPEG dan mengembalikan jalur relatif (disimpan di kolom VARCHAR(255))."""
        if area not in ("publik", "privat"):
            raise ValueError("area harus 'publik' atau 'privat'")
        gambar = gambar.copy()
        gambar.thumbnail((SISI_MAKS, SISI_MAKS))
        bulan = sekarang_utc().strftime("%Y-%m")
        relatif = f"{area}/{kategori}/{bulan}/{uuid.uuid4().hex}.jpg"
        tujuan = self.akar / relatif
        tujuan.parent.mkdir(parents=True, exist_ok=True)
        gambar.save(tujuan, format="JPEG", quality=85, optimize=True)
        return relatif

    def jalur_absolut(self, relatif: str) -> Path:
        tujuan = (self.akar / relatif).resolve()
        if self.akar not in tujuan.parents:  # cegah path traversal
            raise TidakDitemukan("Berkas tidak ditemukan.")
        if not tujuan.is_file():
            raise TidakDitemukan("Berkas tidak ditemukan.")
        return tujuan

    def hapus(self, relatif: str | None) -> None:
        if not relatif:
            return
        try:
            self.jalur_absolut(relatif).unlink(missing_ok=True)
        except TidakDitemukan:
            pass


def ambil_penyimpanan() -> Penyimpanan:
    return Penyimpanan(ambil_pengaturan().direktori_berkas)
