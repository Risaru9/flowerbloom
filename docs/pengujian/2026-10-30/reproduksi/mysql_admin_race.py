"""Isolated MySQL reproduction: two admins disabling each other concurrently."""
import os
import sys
import json
import threading
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
from sqlalchemy.orm import Session
from app.main import app
from app.database import engine, Base, SessionLocal
from app.models.pengguna import Pengguna
from app.models.enums import Peran
from tests.bantu import buat_pengguna, header_masuk

Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
with TestClient(app, raise_server_exceptions=False) as client, SessionLocal() as db:
    first = buat_pengguna(db, "first-admin@contoh.id", Peran.admin, "Admin Satu")
    second = buat_pengguna(db, "second-admin@contoh.id", Peran.admin, "Admin Dua")
    first_id, second_id = first.id_pengguna, second.id_pengguna
    first_headers = header_masuk(client, "first-admin@contoh.id")
    second_headers = header_masuk(client, "second-admin@contoh.id")
    barrier = threading.Barrier(2)
    original_scalar = Session.scalar
    def synchronized_count(session, statement, *args, **kwargs):
        result = original_scalar(session, statement, *args, **kwargs)
        sql = str(statement).lower()
        if "count(" in sql and "pengguna" in sql and "aktif" in sql and "peran" in sql:
            barrier.wait(timeout=20)
        return result
    Session.scalar = synchronized_count
    jobs = [(second_id, first_headers), (first_id, second_headers)]
    def disable_one(job):
        target_id, headers = job
        with TestClient(app, raise_server_exceptions=False) as independent_client:
            r = independent_client.patch(f"/api/v1/admin/pengguna/{target_id}/aktif", headers=headers, json={"aktif": False})
            return {"target": target_id, "http": r.status_code, "body": r.json()}
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(disable_one, jobs))
    finally:
        Session.scalar = original_scalar
    with SessionLocal() as fresh:
        active = fresh.scalar(select(func.count()).select_from(Pengguna).where(Pengguna.peran == Peran.admin, Pengguna.aktif.is_(True)))
    denied_first = client.get("/api/v1/admin/pengguna", headers=first_headers)
    denied_second = client.get("/api/v1/admin/pengguna", headers=second_headers)
    evidence = {"case": "two_admins_disable_each_other", "db": "isolated flowerbloom_race_uji MySQL",
        "expected": "At least one active admin remains; one request is rejected",
        "synchronization": "Test-only barrier after each request reads active-admin count; no application decision changed",
        "initial_active_admins": 2, "requests": responses, "final_active_admins": active,
        "old_admin_access_http": [denied_first.status_code, denied_second.status_code]}
    (ROOT / "mysql-admin-race-results.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
