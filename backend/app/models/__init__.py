"""Mengimpor semua model agar terdaftar pada ``Base.metadata`` (dipakai Alembic dan pembuatan tabel uji)."""
from app.models.akun_pelanggan import Alamat, Favorit
from app.models.bunga import JenisBunga, Warna
from app.models.katalog import KomposisiProduk, Produk
from app.models.komplain import Komplain
from app.models.pengguna import PengaturanAksesibilitas, Pengguna
from app.models.pesanan import (
    DetailPesanan,
    FotoKonfirmasi,
    KomposisiPesanan,
    Pembayaran,
    Pesanan,
    RiwayatStatusPesanan,
)
from app.models.stok import MutasiStok, RiwayatPindai, Stok
from app.models.toko import PengaturanToko

__all__ = [
    "Alamat",
    "DetailPesanan",
    "Favorit",
    "FotoKonfirmasi",
    "JenisBunga",
    "Komplain",
    "KomposisiPesanan",
    "KomposisiProduk",
    "MutasiStok",
    "PengaturanAksesibilitas",
    "PengaturanToko",
    "Pembayaran",
    "Pengguna",
    "Pesanan",
    "Produk",
    "RiwayatPindai",
    "RiwayatStatusPesanan",
    "Stok",
    "Warna",
]
