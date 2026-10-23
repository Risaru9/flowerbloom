"""Pengolahan warna (F-AI-04, F-AI-05, F-AI-08). Tanpa pelatihan model.

Alur untuk satu bunga:  gambar -> ambil piksel kelopak -> k-means (ruang CIELAB) -> kelompok terbesar
-> nama warna terdekat pada tabel ``warna``.

Catatan kejujuran: pemisahan kelopak di sini heuristik (potong tengah gambar, buang piksel hijau dan
sangat gelap). Hasilnya kategori nama warna, bukan pengukuran presisi (Batasan Masalah nomor 4 proposal).
Nilai ambang di bawah perlu ditala dengan foto asli toko.
"""
from dataclasses import dataclass

import numpy as np
from PIL import Image

SISI_SAMPEL = 160  # gambar diperkecil dulu agar cepat (target F-NF-02: <= 3 detik)
MAKS_PIKSEL_KMEANS = 3000
SEBARAN_LATAR_POLOS = 8.0  # rata-rata jarak CIELAB piksel tepi ke median tepi; di bawah ini dianggap latar polos
JARAK_LATAR = 15.0  # piksel dalam jarak ini dari warna latar dianggap latar
SISA_MINIMAL_SETELAH_LATAR = 0.15  # bila sisa kurang dari ini, bunga diduga memenuhi bingkai: latar tidak dibuang


@dataclass(frozen=True)
class WarnaDominan:
    rgb: tuple[int, int, int]
    proporsi: float  # 0..1 dari piksel yang dianalisis


@dataclass(frozen=True)
class LabelWarna:
    id_warna: int
    proporsi: float
    jarak: float  # jarak CIELAB antara warna terbaca dan warna acuan (makin kecil makin mirip)
    rgb: tuple[int, int, int]  # warna terukur sebelum dibulatkan ke nama (dipakai pencocokan di Mode Merangkai)


def hex_ke_rgb(kode: str) -> tuple[int, int, int]:
    kode = kode.lstrip("#")
    return int(kode[0:2], 16), int(kode[2:4], 16), int(kode[4:6], 16)


def rgb_ke_lab(rgb) -> np.ndarray:
    """sRGB (0..255, bentuk (...,3)) -> CIELAB (D65)."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    linier = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    matriks = np.array(
        [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]]
    )
    xyz = (linier @ matriks.T) / np.array([0.95047, 1.0, 1.08883])
    eps, kappa = 216 / 24389, 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kappa * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def jarak_warna(rgb_a, rgb_b) -> float:
    """Jarak CIE76 (Euclid di CIELAB) antara dua warna RGB."""
    return float(np.linalg.norm(rgb_ke_lab(rgb_a) - rgb_ke_lab(rgb_b)))


def kmeans(titik: np.ndarray, k: int, *, iterasi: int = 25, benih: int = 7) -> tuple[np.ndarray, np.ndarray]:
    """K-means dengan inisialisasi k-means++ (deterministik lewat ``benih``). Mengembalikan (pusat, label)."""
    n = len(titik)
    k = max(1, min(k, n))
    acak = np.random.default_rng(benih)
    pusat = [titik[acak.integers(n)]]
    for _ in range(1, k):
        jarak2 = np.min(((titik[:, None, :] - np.array(pusat)[None, :, :]) ** 2).sum(-1), axis=1)
        total = jarak2.sum()
        if total <= 0:
            break
        pusat.append(titik[acak.choice(n, p=jarak2 / total)])
    pusat = np.array(pusat)
    for _ in range(iterasi):
        label = ((titik[:, None, :] - pusat[None, :, :]) ** 2).sum(-1).argmin(axis=1)
        baru = np.array([titik[label == j].mean(axis=0) if np.any(label == j) else pusat[j] for j in range(len(pusat))])
        selesai = np.allclose(baru, pusat, atol=1e-3)
        pusat = baru
        if selesai:
            break
    label = ((titik[:, None, :] - pusat[None, :, :]) ** 2).sum(-1).argmin(axis=1)
    return pusat, label


def _piksel_analisis(gambar: Image.Image, *, potong: float, buang_hijau: bool) -> np.ndarray:
    """Piksel yang layak dianalisis: bagian tengah gambar tanpa latar polos (dan tanpa daun bila diminta).

    Setiap penyaringan dibatalkan bila terlalu banyak piksel terbuang, agar bunga yang memenuhi bingkai
    tidak ikut terbuang.
    """
    kecil = gambar.convert("RGB")
    kecil.thumbnail((SISI_SAMPEL, SISI_SAMPEL))
    semua = np.asarray(kecil)
    tinggi, lebar = semua.shape[:2]
    my, mx = int(tinggi * (1 - potong) / 2), int(lebar * (1 - potong) / 2)
    tengah = semua[my : tinggi - my, mx : lebar - mx]
    rgb = tengah.reshape(-1, 3)
    simpan = np.ones(len(rgb), dtype=bool)

    # 1. Latar polos: bila tepi foto hampir seragam, buang piksel yang mirip warna tepi tersebut.
    tebal = max(2, int(min(tinggi, lebar) * 0.08))
    tepi = np.ones((tinggi, lebar), dtype=bool)
    tepi[tebal:-tebal, tebal:-tebal] = False
    lab_tepi = rgb_ke_lab(semua[tepi])
    median = np.median(lab_tepi, axis=0)
    if np.linalg.norm(lab_tepi - median, axis=1).mean() < SEBARAN_LATAR_POLOS:
        mirip_latar = np.linalg.norm(rgb_ke_lab(rgb) - median, axis=1) < JARAK_LATAR
        if (~mirip_latar).mean() >= SISA_MINIMAL_SETELAH_LATAR:
            simpan &= ~mirip_latar

    # 2. Daun (hijau jenuh) dan piksel sangat gelap.
    if buang_hijau:
        hsv = np.asarray(Image.fromarray(tengah).convert("HSV")).reshape(-1, 3).astype(np.float64)
        derajat, jenuh, nilai = hsv[:, 0] * 360 / 255, hsv[:, 1] / 255, hsv[:, 2] / 255
        daun = (derajat >= 85) & (derajat <= 165) & (jenuh > 0.25) & (nilai > 0.15)
        gelap = nilai < 0.10
        kandidat = simpan & ~daun & ~gelap
        if kandidat.mean() >= 0.05:
            simpan = kandidat
    return rgb[simpan]


def _kelompok_warna(rgb: np.ndarray, k: int) -> list[WarnaDominan]:
    if len(rgb) > MAKS_PIKSEL_KMEANS:
        pilih = np.random.default_rng(1).choice(len(rgb), MAKS_PIKSEL_KMEANS, replace=False)
        rgb = rgb[pilih]
    lab = rgb_ke_lab(rgb)
    _, label = kmeans(lab, k)
    hasil = []
    for j in np.unique(label):
        anggota = rgb[label == j]
        rata = anggota.mean(axis=0)
        hasil.append(WarnaDominan(tuple(int(round(v)) for v in rata), len(anggota) / len(rgb)))
    return sorted(hasil, key=lambda w: w.proporsi, reverse=True)


def warna_dominan_bunga(gambar: Image.Image, *, k: int = 3) -> list[WarnaDominan]:
    """Warna dominan satu bunga: bagian tengah gambar, tanpa piksel daun/gelap."""
    return _kelompok_warna(_piksel_analisis(gambar, potong=0.8, buang_hijau=True), k)


def nama_terdekat(rgb, katalog: list[tuple[int, tuple[int, int, int]]]) -> tuple[int, float]:
    """(id_warna, jarak) warna acuan paling mirip. ``katalog`` = [(id_warna, rgb), ...] tidak boleh kosong."""
    lab_katalog = rgb_ke_lab(np.array([w for _, w in katalog]))
    jarak = np.linalg.norm(lab_katalog - rgb_ke_lab(rgb), axis=1)
    terdekat = int(jarak.argmin())
    return katalog[terdekat][0], float(jarak[terdekat])


def label_warna_bunga(gambar: Image.Image, katalog: list[tuple[int, tuple[int, int, int]]]) -> LabelWarna:
    """Nama warna dominan satu bunga (kelompok terbesar)."""
    utama = warna_dominan_bunga(gambar)[0]
    id_warna, jarak = nama_terdekat(utama.rgb, katalog)
    return LabelWarna(id_warna, utama.proporsi, jarak, utama.rgb)


def label_warna_rangkaian(
    gambar: Image.Image,
    katalog: list[tuple[int, tuple[int, int, int]]],
    *,
    maksimal: int = 4,
    minimal_proporsi: float = 0.05,
) -> list[LabelWarna]:
    """Beberapa warna dominan pada foto rangkaian (F-AI-08).

    Seluruh warna dihitung (daun/pita/kertas ikut terbaca) supaya bunga hijau tidak hilang; kelompok yang
    memetakan ke nama warna sama digabung. Bagian tepi foto dibuang untuk mengurangi latar.
    """
    kelompok = _kelompok_warna(_piksel_analisis(gambar, potong=0.9, buang_hijau=False), 6)
    # id_warna -> [total proporsi, jarak terkecil, rgb kelompok terbesar, proporsi kelompok terbesar]
    gabung: dict[int, list] = {}
    for warna in kelompok:
        id_warna, jarak = nama_terdekat(warna.rgb, katalog)
        entri = gabung.setdefault(id_warna, [0.0, jarak, warna.rgb, warna.proporsi])
        entri[0] += warna.proporsi
        entri[1] = min(entri[1], jarak)
        if warna.proporsi > entri[3]:
            entri[2], entri[3] = warna.rgb, warna.proporsi
    urut = sorted(gabung.items(), key=lambda kv: kv[1][0], reverse=True)
    terpilih = [LabelWarna(i, e[0], e[1], e[2]) for i, e in urut if e[0] >= minimal_proporsi][:maksimal]
    if not terpilih:  # selalu ada minimal satu label
        i, e = urut[0]
        terpilih = [LabelWarna(i, e[0], e[1], e[2])]
    return terpilih
