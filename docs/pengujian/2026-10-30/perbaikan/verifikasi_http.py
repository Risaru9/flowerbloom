"""Smoke test HTTP stack audit lokal; akun dan pesanan dummy dari audit sebelumnya."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:18080"


def ambil(path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(BASE + path, headers=headers, data=json.dumps(data).encode() if data else None)
    with urlopen(req, timeout=15) as r:
        assert r.status == 200
        raw = r.read()
        return json.loads(raw) if "json" in r.headers.get("Content-Type", "") else raw.decode()


assert ambil("/sehat") == "ok"
assert "<html" in ambil("/")
katalog = ambil("/api/v1/produk")
assert katalog
token = ambil("/api/v1/auth/masuk", {"email": "admin-audit@example.com", "kata_sandi": "AuditAdmin-20261026-LocalOnly"})["access_token"]
pesanan = ambil("/api/v1/admin/pesanan/1", token=token)
assert pesanan["status"]["kode"] == "selesai"
assert pesanan["foto"] and pesanan["pembayaran"]
assert all(isinstance(f["perlu_persetujuan_pengganti"], bool) for f in pesanan["foto"])
assert all(b["dana_diterima"] for b in pesanan["pembayaran"] if b["status_verifikasi"] == "sah")
hasil = {"web": "PASS", "katalog": "PASS", "login_admin": "PASS", "pesanan_lama": "selesai",
         "foto_lama": len(pesanan["foto"]), "kontrak_foto_baru": "PASS", "backfill_pembayaran_sah": "PASS"}
Path(__file__).with_name("http.json").write_text(json.dumps(hasil, indent=2), encoding="utf-8")
print(json.dumps(hasil, indent=2))
