from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import RAHASIA_BAWAAN, Pengaturan

RAHASIA_KUAT = "r" * 40


def test_env_example_dapat_dibaca_apa_adanya(monkeypatch):
    """Pengguna cukup menyalin .env.example -> .env; isinya (komentar sebaris, daftar JSON) harus valid."""
    for kunci in Pengaturan.model_fields:  # variabel lingkungan pengujian mengalahkan isi berkas, jadi disingkirkan
        monkeypatch.delenv(kunci.upper(), raising=False)
    p = Pengaturan(_env_file=Path(__file__).parent.parent / ".env.example")
    assert p.lingkungan == "pengembangan"
    assert p.cors_origins == ["http://localhost:5173", "http://localhost:3000"]
    assert p.ai_mode == "nonaktif" and p.penjadwal_aktif is True
    assert p.admin_password is None and p.admin_email == "admin@example.com"
    assert p.database_url.startswith("sqlite:///")


def test_produksi_menolak_rahasia_bawaan_atau_pendek():
    for buruk in (RAHASIA_BAWAAN, "pendek"):
        with pytest.raises(ValidationError):
            Pengaturan(lingkungan="produksi", jwt_rahasia=buruk, _env_file=None)
    assert Pengaturan(lingkungan="produksi", jwt_rahasia=RAHASIA_KUAT, _env_file=None).lingkungan == "produksi"
    assert Pengaturan(lingkungan="pengembangan", jwt_rahasia=RAHASIA_BAWAAN, _env_file=None)  # dev boleh


def test_ai_tiruan_ditolak_di_produksi_dan_mode_tak_dikenal_ditolak():
    with pytest.raises(ValidationError, match="AI_MODE=tiruan"):
        Pengaturan(lingkungan="produksi", jwt_rahasia=RAHASIA_KUAT, ai_mode="tiruan", _env_file=None)
    assert Pengaturan(lingkungan="produksi", jwt_rahasia=RAHASIA_KUAT, ai_mode="nonaktif", _env_file=None)
    assert Pengaturan(lingkungan="pengembangan", ai_mode="tiruan", _env_file=None).ai_mode == "tiruan"
    with pytest.raises(ValidationError):
        Pengaturan(ai_mode="model", _env_file=None)  # tidak ada model terpasang; jangan diam-diam diterima


def test_batas_unggah_dalam_byte():
    assert Pengaturan(ukuran_maks_unggah_mb=8, _env_file=None).batas_unggah_byte == 8 * 1024 * 1024


def test_dokumentasi_api_mati_di_produksi_kecuali_diaktifkan(monkeypatch):
    from app.config import Pengaturan

    rahasia = "x" * 40
    assert Pengaturan(lingkungan="pengembangan").tampilkan_dokumentasi is True
    assert Pengaturan(lingkungan="produksi", jwt_rahasia=rahasia).tampilkan_dokumentasi is False
    assert Pengaturan(lingkungan="produksi", jwt_rahasia=rahasia, dokumentasi_api=True).tampilkan_dokumentasi is True
