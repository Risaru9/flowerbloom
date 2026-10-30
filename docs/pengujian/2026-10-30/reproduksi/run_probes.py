"""Reproducible additional audit; only a new temporary SQLite DB/media are used.

Run: D:\\capstone\\backend\\.venv\\Scripts\\python.exe <this script>
"""
import os
import sys
import json
import asyncio
import logging
from pathlib import Path
from contextlib import contextmanager
from datetime import timedelta

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)  # do not load the real backend/.env
sys.path.insert(0, r"D:\capstone\backend")
os.environ.update({
    "DATABASE_URL": "sqlite:///" + (ROOT / "isolated-audit.sqlite3").as_posix(),
    "DIREKTORI_BERKAS": str(ROOT / "media"),
    "PENJADWAL_AKTIF": "false", "JWT_RAHASIA": "isolated-audit-only-strong-enough-secret-2026",
    "AI_MODE": "nonaktif", "LINGKUNGAN": "pengembangan", "BCRYPT_RONDE": "4",
})
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.database import engine, Base, SessionLocal
from app.models.pesanan import Pesanan
from app.models.stok import Stok
from app.services import penjadwal
from app.core.waktu import sekarang_utc
from app.core.pembatas import reset_semua
from tests.skenario import Toko, API
from tests.bantu import gambar_bytes

logging.getLogger("httpx").setLevel(logging.WARNING)
RESULTS = []

@contextmanager
def world():
    reset_semua()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, raise_server_exceptions=False) as client, SessionLocal() as db:
        yield Toko(client, db).stok_standar(), client, db

def case(name):
    def decorate(fn):
        try:
            result = fn()
            RESULTS.append({"case": name, **result})
        except Exception as exc:
            import traceback
            RESULTS.append({"case": name, "status": "probe_error", "error": repr(exc), "traceback": traceback.format_exc()})
        return fn
    return decorate

def stock_state(toko):
    return {key: (toko.stok(key)["jumlah_tersedia"], toko.stok(key)["jumlah_ditahan"]) for key in toko.id_stok}

def manual_ready(toko, oid):
    order = toko.lihat(oid)
    for d in order["detail"]:
        for k in d["komposisi"]:
            r = toko.client.post(f"{API}/admin/pesanan/{oid}/merangkai/tandai-cocok", headers=toko.admin,
                json={"id_komposisi_pesanan": k["id_komposisi_pesanan"], "jumlah": k["jumlah_tangkai"]})
            assert r.status_code == 200, r.text

@case("checkout_same_request_retry")
def retry_checkout():
    with world() as (t, c, db):
        data = t.isi_checkout()
        headers = {**t.pel, "Idempotency-Key": "same-network-retry-001"}
        a = c.post(f"{API}/pesanan", headers=headers, json=data)
        b = c.post(f"{API}/pesanan", headers=headers, json=data)
        return {"status": "finding", "severity": "P2", "expected": "Repeated request represents one order/one stock reservation",
            "actual": {"http": [a.status_code, b.status_code], "order_ids": [a.json().get("id_pesanan"), b.json().get("id_pesanan")],
            "count": db.scalar(select(func.count()).select_from(Pesanan)), "stock": stock_state(t)},
            "source": ["backend/app/routers/pesanan.py:56", "backend/app/services/pesanan.py:128"]}

@case("catalog_price_and_composition_after_checkout")
def catalog_snapshot():
    with world() as (t, c, db):
        before = t.pesan()
        oid = before["id_pesanan"]
        r = c.patch(f"{API}/admin/produk/{t.id_paket}", headers=t.admin, json={"nama_produk": "Buket Nama Baru", "harga": 999999,
            "komposisi": [{"id_jenis_bunga": t.jenis["Mawar"].id_jenis_bunga, "id_warna": t.warna["Merah muda"].id_warna, "jumlah_tangkai": 5}]})
        assert r.status_code == 200, r.text
        assert c.patch(f"{API}/admin/pengaturan-toko", headers=t.admin, json={"pengaturan": {"ongkos_antar": 99999, "jasa_merangkai": 77777}}).status_code == 200
        after = t.lihat(oid)
        def comp(p):
            return [(k["id_stok"], k["jumlah_tangkai"]) for d in p["detail"] for k in d["komposisi"]]
        cancel = c.post(f"{API}/pesanan/{oid}/batal", headers=t.pel, json={})
        return {"status": "pass_with_observation", "expected": "Committed price and component stock remain unchanged after catalog/settings edit; cancel restores original stocks",
            "actual": {"price": [before["total_harga"], after["total_harga"]], "composition": [comp(before), comp(after)],
                "name": [before["detail"][0]["nama"], after["detail"][0]["nama"]], "cancel_http": cancel.status_code, "stock_after_cancel": stock_state(t)},
            "observation": "Product name remains live; price and quantities are snapshotted",
            "source": ["backend/app/services/penyaji_pesanan.py:37", "backend/app/services/pesanan.py:128"]}

@case("reference_color_edit_changes_existing_order")
def color_snapshot():
    with world() as (t, c, db):
        before = t.pesan()
        oid = before["id_pesanan"]
        color_id = t.warna["Merah tua"].id_warna
        edit = c.patch(f"{API}/admin/warna/{color_id}", headers=t.admin, json={"nama_warna": "Biru laut", "kode_hex": "#0000FF"})
        after = t.lihat(oid)
        def colors(p):
            return [k["warna"] for d in p["detail"] for k in d["komposisi"]]
        return {"status": "finding", "severity": "P2", "expected": "Purchased color remains available as an order snapshot or reference edit is constrained",
            "actual": {"edit_http": edit.status_code, "order_color_before": colors(before), "order_color_after": colors(after)},
            "source": ["backend/app/services/referensi.py:70", "backend/app/services/penyaji_pesanan.py:53", "backend/app/models/pesanan.py:96"]}

@case("color_replacement_revision_return_to_original")
def replacement_revision():
    with world() as (t, c, db):
        p = t.pesan()
        oid = p["id_pesanan"]
        assert t.bayar(oid).status_code == 200
        assert t.sahkan(oid).status_code == 200
        original = t.lihat(oid)["detail"][0]["komposisi"][0]
        r = c.post(f"{API}/admin/pesanan/{oid}/merangkai/pengganti", headers=t.admin, json={
            "id_komposisi_asal": original["id_komposisi_pesanan"], "id_stok_pengganti": t.id_stok["Mawar/Merah muda"], "jumlah": 6, "alasan": "Bunga asal rusak"})
        assert r.status_code == 200, r.text
        manual_ready(t, oid)
        assert t.foto_hasil(oid).status_code == 200
        no_consent = t.tanggapi(oid, keputusan="setuju")
        revision = t.tanggapi(oid, keputusan="revisi", catatan_revisi="Kembalikan warna merah tua")
        assert revision.status_code == 200, revision.text
        rep = next(k for d in t.lihat(oid)["detail"] for k in d["komposisi"] if k["is_pengganti"])
        r = c.post(f"{API}/admin/pesanan/{oid}/merangkai/pengganti", headers=t.admin, json={
            "id_komposisi_asal": rep["id_komposisi_pesanan"], "id_stok_pengganti": t.id_stok["Mawar/Merah tua"], "jumlah": 6, "alasan": "Sesuai revisi pelanggan"})
        assert r.status_code == 200, r.text
        foto = t.foto_hasil(oid)
        assert foto.status_code == 200, foto.text
        latest = foto.json()["foto"][-1]
        consent = t.tanggapi(oid, keputusan="setuju", setuju_pengganti=True)
        return {"status": "pass_with_observation", "expected": "Different-color replacement needs consent; revision can restore original color and approve",
            "actual": {"without_consent_http": no_consent.status_code, "revisi": revision.status_code,
                "latest_replacement_summary": latest["pengganti"], "final_consent_http": consent.status_code,
                "final_status": consent.json()["status"]["kode"], "total": consent.json()["total_harga"]},
            "observation": "Latest replacement summary includes a superseded zero-quantity intermediate replacement",
            "source": ["backend/app/services/foto_konfirmasi.py:27", "backend/app/services/merangkai.py:159"]}

@case("rejected_partial_payment_then_cancel")
def rejected_cancel():
    with world() as (t, c, db):
        oid = t.pesan()["id_pesanan"]
        assert t.bayar(oid, nominal="100000").status_code == 200
        rejected = t.tolak(oid, "Dana masuk kurang Rp50.000")
        assert rejected.status_code == 200, rejected.text
        cancel = c.post(f"{API}/pesanan/{oid}/batal", headers=t.pel, json={})
        admin_after = c.get(f"{API}/admin/pesanan/{oid}", headers=t.admin).json()
        db.expire_all()
        return {"status": "finding", "severity": "P2", "expected": "Cancellation after admin records partial funds received remains visible for manual refund review",
            "actual": {"cancel_http": cancel.status_code, "status": cancel.json()["status"]["kode"],
                "perlu_pengembalian_dana_admin": admin_after.get("perlu_pengembalian_dana"),
                "perlu_pengembalian_dana_db": db.get(Pesanan, oid).perlu_pengembalian_dana,
                "payment_history": [{k: v for k,v in row.items() if k in ["nominal", "nominal_sesuai", "status_verifikasi", "catatan_penolakan"]} for row in cancel.json().get("pembayaran", [])]},
            "source": ["backend/app/services/pesanan.py:296", "backend/app/services/pesanan.py:346"]}

@case("foreign_order_upload_does_not_create_media")
def foreign_upload():
    with world() as (t, c, db):
        oid = t.pesan()["id_pesanan"]
        before = len(list((ROOT / "media").rglob("*.jpg")))
        denied = t.bayar(oid, headers=t.pel2)
        after = len(list((ROOT / "media").rglob("*.jpg")))
        own = t.bayar(oid)
        assert own.status_code == 200, own.text
        assert denied.status_code == 404 and before == after
        return {"status": "pass", "expected": "Other customer cannot upload to order or create an orphan file",
            "actual": {"foreign_http": denied.status_code, "new_media_count": after - before, "owner_http": own.status_code}}

@case("private_file_url_session_revocation_behavior")
def private_file_revocation():
    with world() as (t, c, db):
        oid = t.pesan()["id_pesanan"]
        assert t.bayar(oid).status_code == 200
        url = t.lihat(oid)["pembayaran"][-1]["bukti_url"]
        assert c.post(f"{API}/auth/keluar-semua", headers=t.pel).status_code == 204
        old_token = c.get(f"{API}/pesanan/{oid}", headers=t.pel)
        shared_url = c.get(url)
        assert old_token.status_code == 401
        return {"status": "documented_behavior", "expected": "Access token revoked immediately; signed media URL remains a bearer capability until expiry",
            "actual": {"revoked_access_http": old_token.status_code, "signed_media_http_after_logout": shared_url.status_code,
                "cache_control": shared_url.headers.get("cache-control")},
            "note": "No URL/token is included in this output", "source": ["backend/app/core/security.py:85", "backend/app/routers/berkas.py:12"]}

@case("invalid_shipping_slot_range")
def invalid_slot():
    with world() as (t, c, db):
        invalid = "17:00-09:00"
        config = c.patch(f"{API}/admin/pengaturan-toko", headers=t.admin, json={"pengaturan": {"slot_pengiriman": [invalid]}})
        checkout = t.checkout(slot_jam=invalid)
        return {"status": "finding", "severity": "P2", "expected": "Slot ending before start is rejected before publishing/checkout",
            "actual": {"configuration_http": config.status_code, "checkout_http": checkout.status_code,
                "slot_in_created_order": checkout.json().get("slot_jam")}, "source": ["backend/app/services/pengaturan_toko.py:183"]}

@case("scheduler_real_async_loop")
def scheduler_loop():
    with world() as (t, c, db):
        oid = t.pesan()["id_pesanan"]
        p = db.get(Pesanan, oid)
        p.batas_bayar = sekarang_utc() - timedelta(seconds=2)
        db.commit()
        async def run():
            task = asyncio.create_task(penjadwal.loop_kedaluwarsa(0.05))
            for _ in range(80):
                await asyncio.sleep(0.05)
                with SessionLocal() as check:
                    if check.get(Pesanan, oid).status.value == "dibatalkan":
                        break
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        asyncio.run(run())
        after = t.lihat(oid)
        assert after["status"]["kode"] == "dibatalkan"
        return {"status": "pass", "expected": "Async loop calls threaded expiration and releases held stock",
            "actual": {"order_status": after["status"]["kode"], "stock": stock_state(t)},
            "note": "Loop ran against isolated temporary DB, short test interval; production lifespan/config/network not exercised"}

@case("all_replacements_policy_same_color_different_species")
def strict_same_color_replacement():
    with world() as (t, c, db):
        t.isi_stok("Mawar", "Putih", 10, 9000)
        assert c.patch(f"{API}/admin/pengaturan-toko", headers=t.admin,
            json={"pengaturan": {"kebijakan_pengganti": "semua_pengganti"}}).status_code == 200
        oid = t.pesan()["id_pesanan"]
        assert t.bayar(oid).status_code == 200
        assert t.sahkan(oid).status_code == 200
        original = next(k for d in t.lihat(oid)["detail"] for k in d["komposisi"] if k["jenis"]["nama_bunga"] == "Anyelir")
        r = c.post(f"{API}/admin/pesanan/{oid}/merangkai/pengganti", headers=t.admin, json={
            "id_komposisi_asal": original["id_komposisi_pesanan"], "id_stok_pengganti": t.id_stok["Mawar/Putih"],
            "jumlah": 6, "alasan": "Stok anyelir layu, pengganti tetap putih"})
        assert r.status_code == 200, r.text
        manual_ready(t, oid)
        foto = t.foto_hasil(oid)
        assert foto.status_code == 200, foto.text
        false_consent = t.tanggapi(oid, keputusan="setuju", setuju_pengganti=False)
        false_status = t.status(oid)
        true_consent = t.tanggapi(oid, keputusan="setuju", setuju_pengganti=True)
        assert false_consent.status_code == 409 and true_consent.status_code == 200
        return {"status": "backend_pass_ui_contract_risk", "expected": "Policy semua_pengganti requires explicit consent also for same-color replacements",
            "actual": {"replacement_summary": foto.json()["foto"][-1]["pengganti"],
                "false_consent_http": false_consent.status_code, "false_consent_body": false_consent.json(),
                "status_after_false": false_status, "true_consent_http": true_consent.status_code,
                "final_status": true_consent.json()["status"]["kode"]},
            "source": ["backend/app/services/foto_konfirmasi.py:95", "frontend/src/fitur/pesanan/HalamanDetailPesanan.tsx"]}

out = ROOT / "results.json"
out.write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(RESULTS, ensure_ascii=False, indent=2))
print(f"Results saved: {out}")
