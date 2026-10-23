"""Pembantu uji: membuat akun, data acuan, dan gambar."""
import io

from PIL import Image, ImageDraw

from app.models.bunga import JenisBunga, Warna
from app.models.enums import Peran
from app.services import akun

KATA_SANDI = "sandi-uji-123"


def buat_pengguna(db, email: str, peran: Peran = Peran.pelanggan, nama: str = "Uji"):
    pengguna = akun.buat_akun(db, nama=nama, email=email, kata_sandi=KATA_SANDI, no_hp=None, peran=peran)
    db.commit()
    return pengguna


def header_masuk(client, email: str) -> dict:
    respons = client.post("/api/v1/auth/masuk", json={"email": email, "kata_sandi": KATA_SANDI})
    assert respons.status_code == 200, respons.text
    return {"Authorization": f"Bearer {respons.json()['access_token']}"}


def siapkan_referensi(db):
    """Warna dan jenis bunga secukupnya untuk uji. Mengembalikan (warna_per_nama, jenis_per_nama)."""
    warna = {
        nama: Warna(nama_warna=nama, kode_hex=hex_, makna_warna=f"makna {nama}")
        for nama, hex_ in {
            "Putih": "#FFFFFF",
            "Merah": "#FF0000",
            "Merah tua": "#8B0000",
            "Merah muda": "#FFC0CB",
            "Kuning": "#FFD700",
            "Hijau": "#228B22",
        }.items()
    }
    jenis = {
        "Mawar": JenisBunga(nama_bunga="Mawar", kelas_dataset=74, bentuk_bunga="kelopak berlapis"),
        "Anyelir": JenisBunga(nama_bunga="Anyelir", kelas_dataset=31, bentuk_bunga="kelopak bergerigi"),
        "Bunga matahari": JenisBunga(nama_bunga="Bunga matahari", kelas_dataset=54, bentuk_bunga=None),
    }
    db.add_all([*warna.values(), *jenis.values()])
    db.commit()
    return warna, jenis


def gambar_bytes(warna=(139, 10, 10), latar=(30, 120, 40), ukuran=(320, 240), format_="JPEG") -> bytes:
    gambar = Image.new("RGB", ukuran, latar)
    ImageDraw.Draw(gambar).ellipse(
        (ukuran[0] * 0.25, ukuran[1] * 0.15, ukuran[0] * 0.75, ukuran[1] * 0.85), fill=warna
    )
    buf = io.BytesIO()
    gambar.save(buf, format=format_)
    return buf.getvalue()
