"""Uji modul warna dengan gambar sintetis (bukan pengganti uji dengan foto bunga asli)."""
import time

import pytest
from PIL import Image, ImageDraw

from app.ai.deskripsi import deskripsi_bunga, narasi_rangkaian
from app.ai.klasifikator import KlasifikatorTiruan
from app.ai.warna import (
    hex_ke_rgb,
    jarak_warna,
    label_warna_bunga,
    label_warna_rangkaian,
    nama_terdekat,
)

NAMA = {1: "putih", 2: "merah", 3: "merah tua", 4: "merah muda", 5: "kuning", 6: "hijau", 7: "ungu"}
KATALOG = [
    (i, hex_ke_rgb(h))
    for i, h in {1: "#FFFFFF", 2: "#FF0000", 3: "#8B0000", 4: "#FFC0CB", 5: "#FFD700", 6: "#228B22", 7: "#6A0DAD"}.items()
]


def bunga(warna, latar=(30, 120, 40), ukuran=(640, 480)):
    gambar = Image.new("RGB", ukuran, latar)
    ImageDraw.Draw(gambar).ellipse(
        (ukuran[0] * 0.25, ukuran[1] * 0.15, ukuran[0] * 0.75, ukuran[1] * 0.85), fill=warna
    )
    return gambar


@pytest.mark.parametrize(
    "warna, latar, harapan",
    [
        ((139, 10, 10), (30, 120, 40), "merah tua"),
        ((250, 250, 250), (30, 120, 40), "putih"),  # bunga putih di antara daun tidak boleh ikut terbuang
        ((255, 210, 0), (30, 120, 40), "kuning"),
        ((106, 13, 173), (255, 255, 255), "ungu"),
        ((255, 192, 203), (60, 60, 60), "merah muda"),
    ],
)
def test_warna_bunga_dinamai_benar(warna, latar, harapan):
    hasil = label_warna_bunga(bunga(warna, latar), KATALOG)
    assert NAMA[hasil.id_warna] == harapan
    assert hasil.jarak < 15


def test_bunga_memenuhi_bingkai_tidak_terbaca_sebagai_putiknya():
    """Tepi foto seragam merah tua (kelopak), hanya ada putik kuning kecil di tengah: jawabannya tetap merah tua."""
    gambar = Image.new("RGB", (640, 480), (139, 10, 10))
    ImageDraw.Draw(gambar).ellipse((280, 200, 360, 280), fill=(255, 210, 0))
    assert NAMA[label_warna_bunga(gambar, KATALOG).id_warna] == "merah tua"


def test_warna_bunga_cukup_cepat():
    besar = bunga((139, 10, 10), ukuran=(4000, 3000))
    mulai = time.perf_counter()
    label_warna_bunga(besar, KATALOG)
    assert time.perf_counter() - mulai < 1.0  # target F-NF-02 keseluruhan 3 detik, jatah warna maks 1 detik


def test_rangkaian_memberi_beberapa_label_berurut():
    buket = Image.new("RGB", (800, 600), (240, 240, 240))
    gambar = ImageDraw.Draw(buket)
    gambar.ellipse((150, 100, 450, 400), fill=(139, 10, 10))
    gambar.ellipse((350, 150, 650, 450), fill=(255, 192, 203))
    gambar.rectangle((300, 400, 500, 600), fill=(34, 139, 34))
    label = label_warna_rangkaian(buket, KATALOG)
    nama = [NAMA[x.id_warna] for x in label]
    assert {"merah tua", "merah muda"} <= set(nama)
    assert 1 <= len(label) <= 4
    proporsi = [x.proporsi for x in label]
    assert proporsi == sorted(proporsi, reverse=True)


def test_gambar_satu_warna_tetap_menghasilkan_label():
    label = label_warna_rangkaian(Image.new("RGB", (100, 100), (255, 255, 255)), KATALOG)
    assert [NAMA[x.id_warna] for x in label] == ["putih"]


def test_nama_terdekat_dan_jarak():
    id_warna, jarak = nama_terdekat((250, 5, 5), KATALOG)
    assert NAMA[id_warna] == "merah" and jarak < 10
    assert jarak_warna((255, 0, 0), (255, 0, 0)) == 0
    assert jarak_warna((255, 0, 0), (0, 0, 255)) > 50


def test_klasifikator_tiruan_deterministik_dan_dalam_rentang():
    klasifikator = KlasifikatorTiruan()
    gambar = bunga((139, 10, 10))
    a, b = klasifikator.klasifikasi(gambar), klasifikator.klasifikasi(gambar)
    assert a == b
    assert 1 <= a.kelas_dataset <= 102 and 0.75 <= a.keyakinan <= 0.99
    assert KlasifikatorTiruan(kelas_tetap=74).klasifikasi(gambar).kelas_dataset == 74


def test_deskripsi_templat():
    assert deskripsi_bunga("Mawar", "Merah tua", "kelopak berlapis") == "Mawar merah tua dengan kelopak berlapis"
    assert deskripsi_bunga("Bunga matahari", "Kuning") == "Bunga matahari kuning"
    kalimat = narasi_rangkaian("Buket Cinta", [(6, "Mawar", "Merah tua"), (6, "Anyelir", "Putih")])
    assert kalimat == "Buket Cinta. Berisi 12 tangkai: 6 tangkai mawar merah tua, 6 tangkai anyelir putih."
