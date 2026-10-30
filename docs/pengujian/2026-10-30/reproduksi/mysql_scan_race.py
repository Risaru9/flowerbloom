"""Reproduce same-scan save race against explicitly assigned, isolated MySQL audit DB."""
import os
import sys
import json
import threading
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
sys.path.insert(0, r"D:\capstone\backend")
url = os.environ.get("AUDIT_MYSQL_RACE_URL", "")
assert "/flowerbloom_race_uji?" in url, "Explicit isolated audit DB is required"
os.environ.update({
    "DATABASE_URL": url, "DIREKTORI_BERKAS": str(ROOT / "mysql-media"),
    "PENJADWAL_AKTIF": "false", "JWT_RAHASIA": "isolated-audit-only-strong-enough-secret-2026",
    "AI_MODE": "nonaktif", "LINGKUNGAN": "pengembangan", "BCRYPT_RONDE": "4",
})
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.database import engine, Base, SessionLocal
from app.services import pindai
from app.models.stok import RiwayatPindai, MutasiStok
from tests.skenario import Toko, API
from tests.bantu import gambar_bytes

logging.getLogger("httpx").setLevel(logging.WARNING)
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
with TestClient(app, raise_server_exceptions=False) as client, SessionLocal() as db:
    t = Toko(client, db).stok_standar()
    scan = client.post(f"{API}/admin/stok/pindai", headers=t.admin,
        files={"foto": ("flower.jpg", gambar_bytes(), "image/jpeg")})
    assert scan.status_code == 200, scan.text
    scan_id = scan.json()["id_pindai"]
    stock_id = t.id_stok["Mawar/Merah tua"]
    before = t.stok("Mawar/Merah tua")["jumlah_tersedia"]
    barrier = threading.Barrier(2)
    original = pindai.ambil_pindai
    def synchronized_read(session, id_pindai):
        result = original(session, id_pindai)
        if id_pindai == scan_id:
            barrier.wait(timeout=20)
        return result
    pindai.ambil_pindai = synchronized_read
    payload = {"id_pindai": scan_id, "id_jenis_bunga": t.jenis["Mawar"].id_jenis_bunga,
        "id_warna": t.warna["Merah tua"].id_warna,
        "jumlah_tangkai": 7, "harga_per_tangkai": 8000}
    def save_one(_):
        with TestClient(app, raise_server_exceptions=False) as independent_client:
            response = independent_client.post(f"{API}/admin/stok/simpan-pindai", headers=t.admin, json=payload)
            return {"http": response.status_code, "body": response.json()}
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(save_one, range(2)))
    finally:
        pindai.ambil_pindai = original
    after = t.stok("Mawar/Merah tua")["jumlah_tersedia"]
    scan_count = db.scalar(select(func.count()).select_from(RiwayatPindai))
    save_mutations = db.scalar(select(func.count()).select_from(MutasiStok).where(
        MutasiStok.id_stok == stock_id, MutasiStok.jumlah == 7))
    evidence = {"case": "same_scan_concurrent_save", "db": "isolated flowerbloom_race_uji MySQL",
        "expected": "One scan can increment inventory only once; one request rejects duplicate",
        "synchronization": "Test-only barrier after both read same scan, before writing inventory; no application logic changed",
        "requests": responses, "before_available": before, "after_available": after,
        "increment": after - before, "quantity_per_save": 7, "scan_row_count": scan_count,
        "matching_mutation_count": save_mutations}
    (ROOT / "mysql-scan-race-results.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
