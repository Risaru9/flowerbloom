"""Dijalankan lewat stdin Python pada container API audit, tanpa menampilkan sandi."""
import json

from sqlalchemy import make_url, text

from app.config import ambil_pengaturan
from app.database import engine

p = ambil_pengaturan()
url = make_url(p.database_url)
assert url.database == "flowerbloom_browser_uji" and url.username == "flowerbloom_sandi_uji"
assert url.password == p.mysql_password
assert all(karakter in url.password for karakter in "@:/?#%")
with engine.connect() as koneksi:
    assert koneksi.scalar(text("SELECT 1")) == 1
    assert koneksi.scalar(text("SELECT version_num FROM alembic_version")) == "0003"
print(json.dumps({"mysql_karakter_khusus": "PASS", "host": url.host, "database": url.database, "migrasi": "0003"}))
