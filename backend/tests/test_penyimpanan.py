"""Validasi unggahan gambar dan keamanan jalur berkas."""
import io

import pytest
from PIL import Image

from app.core import penyimpanan
from app.core.errors import DataTidakValid, TidakDitemukan
from app.core.penyimpanan import Penyimpanan, buka_gambar


def _bytes(gambar: Image.Image, format_: str, **kw) -> bytes:
    buf = io.BytesIO()
    gambar.save(buf, format_, **kw)
    return buf.getvalue()


def test_format_yang_didukung_dan_dinormalkan_ke_rgb():
    for format_ in ("JPEG", "PNG", "WEBP"):
        hasil = buka_gambar(_bytes(Image.new("RGB", (40, 30), (10, 20, 30)), format_))
        assert hasil.mode == "RGB" and hasil.size == (40, 30)


def test_png_transparan_diletakkan_di_atas_putih():
    hasil = buka_gambar(_bytes(Image.new("RGBA", (10, 10), (255, 0, 0, 0)), "PNG"))
    assert hasil.getpixel((5, 5)) == (255, 255, 255)


@pytest.mark.parametrize("isi", [b"", b"bukan gambar", b"%PDF-1.4\n", b"GIF89a" + b"\x00" * 20])
def test_bukan_gambar_ditolak(isi):
    with pytest.raises(DataTidakValid):
        buka_gambar(isi)


def test_format_lain_ditolak_walau_gambar_valid():
    with pytest.raises(DataTidakValid) as galat:
        buka_gambar(_bytes(Image.new("RGB", (10, 10)), "GIF"))
    assert galat.value.kode == "format_tidak_didukung"


def test_resolusi_terlalu_besar_ditolak(monkeypatch):
    monkeypatch.setattr(penyimpanan, "PIKSEL_MAKS", 100)
    with pytest.raises(DataTidakValid) as galat:
        buka_gambar(_bytes(Image.new("RGB", (20, 20)), "PNG"))
    assert galat.value.kode == "gambar_terlalu_besar"


def test_bom_dekompresi_ditolak_bukan_500(monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 50)  # gambar 20x20 = 400 piksel > 2 x 50
    with pytest.raises(DataTidakValid) as galat:
        buka_gambar(_bytes(Image.new("RGB", (20, 20)), "PNG"))
    assert galat.value.kode == "gambar_terlalu_besar"


def test_simpan_membuang_metadata_dan_mengecilkan(tmp_path):
    gudang = Penyimpanan(tmp_path)
    gudang.siapkan()
    besar = Image.new("RGB", (4000, 3000), (200, 30, 30))
    exif = Image.Exif()
    exif[0x010F] = "Kamera Rahasia"  # merek kamera
    jalur = gudang.simpan_gambar(buka_gambar(_bytes(besar, "JPEG", exif=exif)), area="privat", kategori="uji")
    assert jalur.startswith("privat/uji/") and jalur.endswith(".jpg")
    with Image.open(gudang.jalur_absolut(jalur)) as hasil:
        assert max(hasil.size) == penyimpanan.SISI_MAKS
        assert not hasil.getexif()  # metadata tidak ikut tersimpan


def test_jalur_di_luar_akar_dan_berkas_hilang_ditolak(tmp_path):
    gudang = Penyimpanan(tmp_path / "akar")
    gudang.siapkan()
    (tmp_path / "rahasia.txt").write_text("jangan bocor")
    for jalur in ("../rahasia.txt", "privat/../../rahasia.txt", "/etc/passwd", "privat/tidak-ada.jpg"):
        with pytest.raises(TidakDitemukan):
            gudang.jalur_absolut(jalur)
    with pytest.raises(ValueError):
        gudang.simpan_gambar(Image.new("RGB", (5, 5)), area="lain", kategori="x")
