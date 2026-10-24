"""Konfigurasi aplikasi.

Nilai dibaca dari variabel lingkungan atau berkas ``.env`` (lihat ``.env.example``).
"""
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

RAHASIA_BAWAAN = "ganti-rahasia-ini-sebelum-produksi"


class Pengaturan(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    lingkungan: str = "pengembangan"  # pengembangan | produksi
    database_url: str = "sqlite:///./flowerbloom.db"

    # Autentikasi
    jwt_rahasia: str = RAHASIA_BAWAAN
    jwt_algoritma: str = "HS256"
    jwt_berlaku_menit: int = 480
    tautan_berkas_berlaku_menit: int = 10
    bcrypt_ronde: int = 12  # biaya hash kata sandi; hanya diturunkan pada pengujian
    login_maks_gagal: int = 5  # percobaan masuk gagal per email+IP sebelum dikunci sementara
    login_jendela_menit: int = 15

    # Penyimpanan berkas
    direktori_berkas: Path = Path("./penyimpanan")
    ukuran_maks_unggah_mb: int = 8

    # Swagger/ReDoc (/docs, /redoc, /openapi.json). Bawaan: aktif kecuali di produksi.
    dokumentasi_api: bool | None = None

    # CORS untuk frontend
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5500"]

    # Layanan AI (F-AI-*)
    ai_mode: str = "tiruan"  # tiruan | model
    ai_tiruan_kelas: int | None = None  # paksa AI tiruan selalu menjawab kelas ini (untuk uji frontend)
    ambang_keyakinan: float = 0.60  # F-AI-02
    ambang_kecocokan_warna: float = 20.0  # batas jarak warna (CIELAB) agar dianggap "cocok" di Mode Merangkai

    # Penjadwal pesanan kedaluwarsa (AB-02)
    penjadwal_aktif: bool = True
    penjadwal_interval_detik: int = 60

    # Akun admin awal (dipakai scripts/seed.py)
    admin_nama: str = "Admin FlowerBloom"
    admin_email: str = "admin@example.com"  # ganti lewat ADMIN_EMAIL; domain .test/.local ditolak validator email
    admin_password: str | None = None

    @model_validator(mode="after")
    def _tolak_rahasia_lemah_di_produksi(self) -> "Pengaturan":
        if self.lingkungan == "produksi" and (self.jwt_rahasia == RAHASIA_BAWAAN or len(self.jwt_rahasia) < 32):
            raise ValueError("JWT_RAHASIA harus diganti dan minimal 32 karakter pada lingkungan produksi.")
        return self

    @property
    def tampilkan_dokumentasi(self) -> bool:
        return self.dokumentasi_api if self.dokumentasi_api is not None else self.lingkungan != "produksi"

    @property
    def batas_unggah_byte(self) -> int:
        return self.ukuran_maks_unggah_mb * 1024 * 1024


@lru_cache
def ambil_pengaturan() -> Pengaturan:
    return Pengaturan()
