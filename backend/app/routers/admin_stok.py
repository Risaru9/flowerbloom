"""Stok dan pemindaian oleh admin (F-AD-11, F-AD-12, F-AD-13, F-AD-18)."""
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.core.penyimpanan import baca_unggahan
from app.dependencies import DB, Admin
from app.models.enums import JenisMutasi, KonteksPindai
from app.schemas.dasar import Halaman
from app.schemas.stok import (
    HasilPindaiOut,
    KoreksiStokIn,
    RingkasanAkurasiOut,
    RiwayatPindaiOut,
    SimpanPindaiIn,
    StokManualIn,
    StokOut,
)
from app.services import pengaturan_toko, penyaji, pindai
from app.services import stok as layanan

router = APIRouter(prefix="/admin", tags=["Admin - Stok & Pindai"])


def _keluaran(db, stok) -> StokOut:
    ambang = pengaturan_toko.ambil(db).ambang_stok_menipis
    masuk = layanan.jumlah_masuk_per_stok(db).get(stok.id_stok, 0)
    return penyaji.stok_ke_out(layanan.ambil_stok(db, stok.id_stok), masuk, ambang)


@router.get("/stok", response_model=list[StokOut], summary="Daftar stok: masuk, ditahan, tersedia, penanda menipis")
def daftar_stok(db: DB, _: Admin, menipis: bool = Query(default=False, description="Hanya stok yang menipis")):
    ambang = pengaturan_toko.ambil(db).ambang_stok_menipis
    masuk = layanan.jumlah_masuk_per_stok(db)
    hasil = [penyaji.stok_ke_out(s, masuk.get(s.id_stok, 0), ambang) for s in layanan.daftar_stok(db)]
    return [h for h in hasil if h.menipis] if menipis else hasil


@router.post("/stok/manual", response_model=StokOut, status_code=status.HTTP_201_CREATED, summary="Input stok manual (F-AD-12)")
def stok_manual(data: StokManualIn, db: DB, admin: Admin):
    stok = layanan.tambah_stok(
        db,
        id_jenis_bunga=data.id_jenis_bunga,
        id_warna=data.id_warna,
        jumlah=data.jumlah_tangkai,
        harga_per_tangkai=data.harga_per_tangkai,
        jenis=JenisMutasi.masuk_manual,
        oleh=admin,
    )
    db.commit()
    return _keluaran(db, stok)


@router.post("/stok/pindai", response_model=HasilPindaiOut, summary="Pindai satu bunga: jenis, warna, keyakinan (F-AD-11)")
def pindai_stok(foto: Annotated[UploadFile, File(description="Satu foto untuk satu jenis bunga")], db: DB, admin: Admin):
    hasil = pindai.analisis_bunga(db, data=baca_unggahan(foto), admin=admin, konteks=KonteksPindai.stok_masuk)
    db.commit()
    return penyaji.hasil_pindai_ke_out(hasil)


@router.post(
    "/stok/simpan-pindai",
    response_model=StokOut,
    status_code=status.HTTP_201_CREATED,
    summary="Simpan hasil pindai yang sudah diperiksa/dikoreksi admin sebagai stok",
)
def simpan_pindai(data: SimpanPindaiIn, db: DB, admin: Admin):
    stok = pindai.simpan_pindai_ke_stok(
        db,
        id_pindai=data.id_pindai,
        id_jenis_bunga=data.id_jenis_bunga,
        id_warna=data.id_warna,
        jumlah_tangkai=data.jumlah_tangkai,
        harga_per_tangkai=data.harga_per_tangkai,
        admin=admin,
    )
    db.commit()
    return _keluaran(db, stok)


@router.patch("/stok/{id_stok}", response_model=StokOut, summary="Koreksi jumlah tersedia atau harga (dicatat di buku mutasi)")
def koreksi_stok(id_stok: int, data: KoreksiStokIn, db: DB, admin: Admin):
    stok = layanan.ambil_stok(db, id_stok)
    layanan.koreksi_stok(
        db,
        stok,
        jumlah_tersedia=data.jumlah_tersedia,
        harga_per_tangkai=data.harga_per_tangkai,
        catatan=data.catatan,
        oleh=admin,
    )
    db.commit()
    return _keluaran(db, stok)


@router.get("/riwayat-pindai", response_model=Halaman[RiwayatPindaiOut], summary="Riwayat pindai dan koreksi (F-AD-18)")
def riwayat_pindai(
    db: DB,
    _: Admin,
    halaman: int = Query(default=1, ge=1),
    per_halaman: int = Query(default=20, ge=1, le=100),
    hanya_dikoreksi: bool = False,
):
    baris, total = pindai.daftar_riwayat(db, halaman=halaman, per_halaman=per_halaman, hanya_dikoreksi=hanya_dikoreksi)
    return Halaman(
        data=[penyaji.riwayat_pindai_ke_out(b) for b in baris], total=total, halaman=halaman, per_halaman=per_halaman
    )


@router.get("/riwayat-pindai/ringkasan", response_model=RingkasanAkurasiOut, summary="Akurasi model di pemakaian nyata")
def ringkasan_akurasi(db: DB, _: Admin):
    return pindai.ringkasan_akurasi(db)
