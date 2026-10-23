"""Mengisi data awal. Jalankan setelah `alembic upgrade head`:

    python -m scripts.seed            # data acuan (warna, 102 jenis bunga) + akun admin bila belum ada
    python -m scripts.seed --demo     # ditambah stok, paket katalog, dan satu akun pelanggan contoh (bukan untuk produksi)

Aman dijalankan berulang: hanya menambah yang belum ada dan tidak menimpa data yang sudah diubah admin.
Kata sandi admin diambil dari ADMIN_PASSWORD; bila kosong dibuat acak dan dicetak SEKALI di layar ini.
"""
import argparse
import secrets
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import ambil_pengaturan
from app.data.jenis_bunga import JENIS_BUNGA_AWAL
from app.data.warna import WARNA_AWAL
from app.database import SessionLocal
from app.models.bunga import JenisBunga, Warna
from app.models.enums import JenisMutasi, Peran
from app.models.katalog import KomposisiProduk, Produk
from app.models.pengguna import Pengguna
from app.services import akun, katalog
from app.services import stok as layanan_stok

# Akun demo khusus pengembangan (dilarang di produksi oleh seed_demo).
EMAIL_PELANGGAN_CONTOH = "pelanggan@example.com"
KATA_SANDI_PELANGGAN_CONTOH = "contoh-flowerbloom-123"

# ---------------------------------------------------------------------------------------------------------------------
# DATA CONTOH (hanya --demo, ditolak di produksi). Nama, harga, dan foto paket diambil dari rancangan Figma tim;
# komposisinya disusun dari jenis bunga yang dikenali model (dataset 102 kelas) sehingga bukan resep florist sungguhan.
# ---------------------------------------------------------------------------------------------------------------------

# (jenis (nama_bunga), warna, jumlah, harga per tangkai)
STOK_CONTOH = [
    ("Mawar", "Merah tua", 60, 9000),
    ("Mawar", "Merah", 60, 9000),
    ("Mawar", "Merah muda", 80, 8500),
    ("Mawar", "Putih", 50, 8500),
    ("Mawar", "Persik", 40, 9000),
    ("Anyelir", "Putih", 60, 5000),
    ("Anyelir", "Merah muda", 50, 5000),
    ("Anyelir", "Merah", 40, 5000),
    ("Bunga matahari", "Kuning", 30, 9500),
    ("Gerbera", "Oranye", 30, 7000),
    ("Gerbera", "Merah muda", 30, 7000),
    ("Gerbera", "Kuning", 30, 7000),
    ("Lili calla putih raksasa", "Putih", 25, 15000),
    ("Alstroemeria", "Merah muda", 40, 6000),
    ("Alstroemeria", "Ungu muda", 30, 6000),
    ("Anggrek bulan", "Putih", 20, 25000),
    ("Anggrek bulan", "Merah muda", 15, 25000),
    ("Kamelia", "Merah muda", 20, 8000),
    ("Iris berjanggut", "Ungu", 20, 8000),
    ("Iris berjanggut", "Biru", 20, 8000),
    ("Daisy mata sapi", "Putih", 40, 4000),
    ("Snapdragon", "Merah muda tua", 20, 6500),
]

# (nama paket, acara, harga, deskripsi, [(jenis, warna, tangkai), ...], berkas foto di scripts/foto_demo)
PAKET_CONTOH = [
    ("Serenade Merah Muda", "Hari Jadi", 125000, "Rangkaian lembut mawar merah muda dan putih dengan sentuhan daisy, cocok untuk hari jadi atau ungkapan sayang.",
     [("Mawar", "Merah muda", 7), ("Mawar", "Putih", 4), ("Daisy mata sapi", "Putih", 5)], "serenade-merah-muda"),
    ("Harmoni Lily", "Hadiah", 165000, "Lili calla putih dipadu mawar merah muda dalam vas keramik untuk meja.",
     [("Lili calla putih raksasa", "Putih", 4), ("Mawar", "Merah muda", 6), ("Anyelir", "Putih", 4)], "harmoni-lily"),
    ("Pesona Merah", "Hari Jadi", 145000, "Buket mawar merah klasik yang tegas dan romantis.",
     [("Mawar", "Merah", 10), ("Anyelir", "Merah", 4)], "pesona-merah"),
    ("Damai Putih", "Dukacita", 200000, "Rangkaian serba putih dalam keranjang sebagai ungkapan simpati.",
     [("Lili calla putih raksasa", "Putih", 5), ("Mawar", "Putih", 6), ("Anyelir", "Putih", 6)], "damai-putih"),
    ("Ceria Matahari", "Wisuda", 135000, "Bunga matahari kuning yang ceria untuk merayakan kelulusan.",
     [("Bunga matahari", "Kuning", 5), ("Gerbera", "Kuning", 3), ("Daisy mata sapi", "Putih", 4)], "ceria-matahari"),
    ("Kotak Kasih", "Hadiah", 175000, "Bunga dalam kotak berisi mawar merah muda dan persik.",
     [("Mawar", "Merah muda", 8), ("Mawar", "Persik", 5), ("Anyelir", "Putih", 4)], "kotak-kasih"),
    ("Anggrek Elegan", "Pernikahan", 250000, "Anggrek bulan putih dan merah muda dalam pot keramik.",
     [("Anggrek bulan", "Putih", 4), ("Anggrek bulan", "Merah muda", 3)], "anggrek-elegan"),
    ("Gerbera Ceria", "Ulang Tahun", 120000, "Gerbera aneka warna yang riang untuk ulang tahun.",
     [("Gerbera", "Merah muda", 4), ("Gerbera", "Kuning", 3), ("Gerbera", "Oranye", 3)], "gerbera-ceria"),
    ("Biru Menawan", "Hadiah", 185000, "Iris biru dan ungu dengan mawar putih yang menenangkan.",
     [("Iris berjanggut", "Biru", 5), ("Iris berjanggut", "Ungu", 3), ("Mawar", "Putih", 5)], "biru-menawan"),
    ("Lavender Dream", "Ulang Tahun", 155000, "Nuansa ungu muda dan merah muda yang lembut.",
     [("Alstroemeria", "Ungu muda", 6), ("Mawar", "Merah muda", 5), ("Daisy mata sapi", "Putih", 4)], "lavender-dream"),
    ("Peach Blossom", "Hadiah", 170000, "Mawar persik dan merah muda dalam vas bergaris.",
     [("Mawar", "Persik", 8), ("Alstroemeria", "Merah muda", 5)], "peach-blossom"),
    ("Tulip Harmony", "Ulang Tahun", 160000, "Buket bernuansa merah muda dan putih yang segar.",
     [("Kamelia", "Merah muda", 6), ("Mawar", "Putih", 5), ("Anyelir", "Merah muda", 4)], "tulip-harmony"),
    ("Ruby Romance", "Hari Jadi", 190000, "Mawar merah tua dan merah muda dalam vas, untuk momen romantis.",
     [("Mawar", "Merah tua", 8), ("Mawar", "Merah muda", 6), ("Anyelir", "Putih", 4)], "ruby-romance"),
    ("Birthday Flower Box", "Ulang Tahun", 250000, "Flower box merah muda dengan ucapan ulang tahun.",
     [("Mawar", "Merah muda", 10), ("Anyelir", "Merah muda", 6), ("Snapdragon", "Merah muda tua", 4)], "birthday-flower-box"),
    ("Graduation Teddy Bouquet", "Wisuda", 185000, "Mawar merah dengan boneka bertoga untuk wisudawan.",
     [("Mawar", "Merah", 9), ("Anyelir", "Merah", 4)], "graduation-teddy"),
    ("Anniversary Romance", "Hari Jadi", 225000, "Mawar merah, anyelir merah muda, dan pita putih.",
     [("Mawar", "Merah", 10), ("Anyelir", "Merah muda", 8), ("Anyelir", "Putih", 4)], "anniversary-romance"),
    ("Papan Bunga Wisuda", "Wisuda", 350000, "Papan bunga elegan untuk merayakan kelulusan.",
     [("Mawar", "Putih", 12), ("Mawar", "Merah muda", 10), ("Gerbera", "Merah muda", 6), ("Anyelir", "Putih", 8)], "papan-bunga-wisuda"),
]

FOLDER_FOTO_DEMO = Path(__file__).resolve().parent / "foto_demo"


def seed_referensi(db: Session) -> tuple[int, int]:
    warna_ada = set(db.scalars(select(Warna.nama_warna)))
    baru_warna = 0
    for nama, kode, makna in WARNA_AWAL:
        if nama not in warna_ada:
            db.add(Warna(nama_warna=nama, kode_hex=kode, makna_warna=makna))
            baru_warna += 1

    kelas_ada = set(db.scalars(select(JenisBunga.kelas_dataset)))
    baru_jenis = 0
    for kelas, nama, ilmiah, bentuk, nama_dataset in JENIS_BUNGA_AWAL:
        if kelas not in kelas_ada:
            db.add(
                JenisBunga(
                    nama_bunga=nama,
                    nama_ilmiah=ilmiah,
                    kelas_dataset=kelas,
                    bentuk_bunga=bentuk,
                    deskripsi=f"Nama pada dataset Oxford Flowers 102: {nama_dataset}.",
                )
            )
            baru_jenis += 1
    db.flush()
    return baru_warna, baru_jenis


def seed_admin(db: Session) -> str | None:
    """Membuat admin awal bila belum ada admin sama sekali. Mengembalikan kata sandi yang dibuat acak (bila ada)."""
    if db.scalar(select(Pengguna.id_pengguna).where(Pengguna.peran == Peran.admin).limit(1)):
        return None
    p = ambil_pengaturan()
    kata_sandi = p.admin_password or secrets.token_urlsafe(12)
    akun.buat_akun(db, nama=p.admin_nama, email=p.admin_email, kata_sandi=kata_sandi, no_hp=None, peran=Peran.admin)
    return None if p.admin_password else kata_sandi


def seed_demo(db: Session) -> dict[str, int]:
    if ambil_pengaturan().lingkungan == "produksi":
        raise SystemExit("--demo tidak boleh dijalankan pada lingkungan produksi.")
    admin = db.scalar(select(Pengguna).where(Pengguna.peran == Peran.admin).limit(1))
    jenis = {j.nama_bunga: j for j in db.scalars(select(JenisBunga))}
    warna = {w.nama_warna: w for w in db.scalars(select(Warna))}

    for nama_jenis, nama_warna, jumlah, harga in STOK_CONTOH:
        if layanan_stok.cari_stok(db, jenis[nama_jenis].id_jenis_bunga, warna[nama_warna].id_warna) is None:
            layanan_stok.tambah_stok(
                db,
                id_jenis_bunga=jenis[nama_jenis].id_jenis_bunga,
                id_warna=warna[nama_warna].id_warna,
                jumlah=jumlah,
                harga_per_tangkai=harga,
                jenis=JenisMutasi.masuk_manual,
                oleh=admin,
            )

    paket_baru = 0
    ada = set(db.scalars(select(Produk.nama_produk)))
    for nama, acara, harga, deskripsi, baris, foto in PAKET_CONTOH:
        if nama in ada:
            continue
        produk = Produk(
            nama_produk=nama,
            acara=acara,
            harga=harga,
            deskripsi=deskripsi,
            komposisi=[
                KomposisiProduk(id_jenis_bunga=jenis[j].id_jenis_bunga, id_warna=warna[w].id_warna, jumlah_tangkai=n)
                for j, w, n in baris
            ],
        )
        db.add(produk)
        db.flush()
        berkas = FOLDER_FOTO_DEMO / f"{foto}.webp"
        if berkas.exists():
            katalog.simpan_foto_produk(db, produk.id_produk, berkas.read_bytes())
        paket_baru += 1

    pelanggan_baru = 0
    if akun.cari_berdasarkan_email(db, EMAIL_PELANGGAN_CONTOH) is None:
        akun.daftar_pelanggan(
            db, nama="Pelanggan Contoh", email=EMAIL_PELANGGAN_CONTOH, kata_sandi=KATA_SANDI_PELANGGAN_CONTOH, no_hp=None
        )
        pelanggan_baru = 1
    db.flush()
    return {"paket": paket_baru, "pelanggan": pelanggan_baru}


def main(argumen: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mengisi data awal FlowerBloom.")
    parser.add_argument("--demo", action="store_true", help="tambahkan stok, paket, dan pelanggan contoh (bukan untuk produksi)")
    opsi = parser.parse_args(argumen)

    with SessionLocal() as db:
        warna, jenis = seed_referensi(db)
        print(f"Data acuan: +{warna} warna, +{jenis} jenis bunga.")
        kata_sandi = seed_admin(db)
        p = ambil_pengaturan()
        if kata_sandi:
            print(f"Akun admin dibuat: {p.admin_email}\nKata sandi (catat sekarang, tidak ditampilkan lagi): {kata_sandi}")
        elif db.scalar(select(Pengguna.id_pengguna).where(Pengguna.email == p.admin_email)):
            print(f"Akun admin sudah ada: {p.admin_email}")
        if opsi.demo:
            hasil = seed_demo(db)
            print(f"Demo: +{hasil['paket']} paket katalog, +{hasil['pelanggan']} pelanggan contoh ({EMAIL_PELANGGAN_CONTOH}).")
        db.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
