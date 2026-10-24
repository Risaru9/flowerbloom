"""Titik masuk aplikasi FastAPI."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import ambil_pengaturan
from app.core.errors import pasang_penanganan_galat
from app.core.penyimpanan import ambil_penyimpanan
from app.core.tautan import PREFIX_API
from app.routers import admin_pesanan, admin_stok, akun_pelanggan, auth, berkas, katalog, pesanan, referensi
from app.services import penjadwal

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def siklus_hidup(app: FastAPI):
    p = ambil_pengaturan()
    tugas = asyncio.create_task(penjadwal.loop_kedaluwarsa(p.penjadwal_interval_detik)) if p.penjadwal_aktif else None
    try:
        yield
    finally:
        if tugas:
            tugas.cancel()


def buat_aplikasi() -> FastAPI:
    pengaturan = ambil_pengaturan()
    penyimpanan = ambil_penyimpanan()
    penyimpanan.siapkan()

    app = FastAPI(
        title="FlowerBloom API",
        version="0.1.0",
        description="Backend toko bunga dengan aksesibilitas warna bagi pengguna buta warna. "
        "Alur kerja lengkap: docs/alur-kerja.md.",
        lifespan=siklus_hidup,
        docs_url="/docs" if pengaturan.tampilkan_dokumentasi else None,
        redoc_url="/redoc" if pengaturan.tampilkan_dokumentasi else None,
        openapi_url="/openapi.json" if pengaturan.tampilkan_dokumentasi else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=pengaturan.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    pasang_penanganan_galat(app)

    for router in (
        auth.router,
        akun_pelanggan.router,
        referensi.router,
        katalog.router,
        katalog.router_admin,
        admin_stok.router,
        pesanan.router,
        admin_pesanan.router,
        admin_pesanan.router_lain,
        berkas.router,
    ):
        app.include_router(router, prefix=PREFIX_API)
    # Hanya area publik yang disajikan sebagai berkas statis; area privat lewat tautan bertanda tangan.
    app.mount("/media", StaticFiles(directory=penyimpanan.akar / "publik"), name="media")

    @app.get("/kesehatan", tags=["Sistem"], summary="Pemeriksaan hidup")
    def kesehatan():
        return {"status": "ok"}

    return app


app = buat_aplikasi()
