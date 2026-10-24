"""Katalog paket, menu Rangkai Sendiri, dan informasi toko (dibaca publik; dikelola admin)."""
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.core.penyimpanan import baca_unggahan
from app.dependencies import DB, Admin
from app.schemas.katalog import ProdukIn, ProdukOut, ProdukUbahIn
from app.schemas.stok import OpsiRangkaiOut
from app.schemas.toko import InfoTokoOut, PengaturanItemOut, PengaturanUbahIn
from app.services import katalog, pengaturan_toko, penyaji
from app.services import stok as layanan_stok

router = APIRouter(tags=["Katalog"])
router_admin = APIRouter(prefix="/admin", tags=["Admin - Katalog & Toko"])


@router.get("/produk", response_model=list[ProdukOut], summary="Katalog paket siap pakai (filter acara: F-PL-02)")
def daftar_produk(db: DB, acara: str | None = Query(default=None, max_length=50)):
    peta = katalog.peta_stok(db)
    return [penyaji.produk_ke_out(p, peta) for p in katalog.daftar_produk(db, acara=acara)]


@router.get("/produk/acara", response_model=list[str], summary="Daftar acara untuk penyaring katalog")
def daftar_acara(db: DB):
    return katalog.daftar_acara(db)


@router.get("/produk/{id_produk}", response_model=ProdukOut, summary="Detail paket: komposisi, nama+kode warna, makna (F-PL-03)")
def detail_produk(id_produk: int, db: DB):
    return penyaji.produk_ke_out(katalog.ambil_produk(db, id_produk), katalog.peta_stok(db))


@router.get("/rangkai/opsi", response_model=list[OpsiRangkaiOut], summary="Bunga yang tersedia hari ini untuk Rangkai Sendiri")
def opsi_rangkai(db: DB):
    return [penyaji.stok_ke_opsi_rangkai(s) for s in layanan_stok.daftar_stok(db, hanya_tersedia=True)]


@router.get("/toko/info", response_model=InfoTokoOut, summary="Ongkos, slot jam, rekening tujuan, dan aturan checkout")
def info_toko(db: DB):
    return pengaturan_toko.ambil(db)


# --- Admin -----------------------------------------------------------------------------------------------------


@router_admin.get("/produk", response_model=list[ProdukOut], summary="Seluruh paket termasuk yang disembunyikan")
def admin_daftar_produk(db: DB, _: Admin):
    peta = katalog.peta_stok(db)
    return [penyaji.produk_ke_out(p, peta) for p in katalog.daftar_produk(db, hanya_ditampilkan=False)]


@router_admin.post("/produk", response_model=ProdukOut, status_code=status.HTTP_201_CREATED, summary="Tambah paket")
def admin_buat_produk(data: ProdukIn, db: DB, _: Admin):
    produk = katalog.buat_produk(db, data)
    db.commit()
    return penyaji.produk_ke_out(produk, katalog.peta_stok(db))


@router_admin.patch("/produk/{id_produk}", response_model=ProdukOut, summary="Ubah harga, komposisi, atau tampilkan/sembunyikan paket")
def admin_ubah_produk(id_produk: int, data: ProdukUbahIn, db: DB, _: Admin):
    produk = katalog.ubah_produk(db, id_produk, data.model_dump(exclude_unset=True))
    db.commit()
    return penyaji.produk_ke_out(produk, katalog.peta_stok(db))


@router_admin.put("/produk/{id_produk}/foto", response_model=ProdukOut, summary="Unggah foto paket")
def admin_foto_produk(id_produk: int, foto: Annotated[UploadFile, File()], db: DB, _: Admin):
    produk = katalog.simpan_foto_produk(db, id_produk, baca_unggahan(foto))
    db.commit()
    return penyaji.produk_ke_out(produk, katalog.peta_stok(db))


@router_admin.get("/pengaturan-toko", response_model=list[PengaturanItemOut], summary="Semua pengaturan toko (F-AD-16)")
def admin_pengaturan(db: DB, _: Admin):
    return pengaturan_toko.daftar_lengkap(db)


@router_admin.patch("/pengaturan-toko", response_model=list[PengaturanItemOut], summary="Ubah sebagian pengaturan toko")
def admin_ubah_pengaturan(data: PengaturanUbahIn, db: DB, _: Admin):
    pengaturan_toko.perbarui(db, data.pengaturan)
    db.commit()
    return pengaturan_toko.daftar_lengkap(db)
