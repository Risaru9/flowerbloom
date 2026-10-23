"""Pesanan sisi pelanggan: pratinjau, checkout, pembayaran, pembatalan, persetujuan foto, komplain."""
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.core.errors import BatasBayarLewat
from app.core.penyimpanan import baca_unggahan
from app.dependencies import DB, Pelanggan
from app.models.enums import StatusPesanan
from app.schemas.dasar import Halaman
from app.schemas.pesanan import (
    BatalIn,
    CheckoutIn,
    ItemHitungOut,
    KomplainOut,
    MasalahStokOut,
    PesananOut,
    PesananRingkasOut,
    PratinjauIn,
    PratinjauOut,
    TanggapanFotoIn,
)
from app.services import foto_konfirmasi, komplain, pengaturan_toko, penyaji_pesanan
from app.services import pesanan as layanan

router = APIRouter(tags=["Pesanan Pelanggan"])


def _keluaran(db, id_pesanan: int, pelanggan) -> PesananOut:
    return penyaji_pesanan.pesanan_out(layanan.ambil_pesanan(db, id_pesanan, pelanggan=pelanggan), pengaturan_toko.ambil(db))


@router.post("/pesanan/pratinjau", response_model=PratinjauOut, summary="Hitung total dan cek stok tanpa membuat pesanan")
def pratinjau(data: PratinjauIn, db: DB):
    h = layanan.hitung(db, data)
    return PratinjauOut(
        items=[
            ItemHitungOut(jenis_item=i.jenis_item, nama=i.nama, jumlah=i.jumlah, jumlah_tangkai=i.jumlah_tangkai, subtotal=i.subtotal)
            for i in h.items
        ],
        subtotal=h.subtotal,
        ongkos_antar=h.ongkos_antar,
        total_harga=h.total,
        dapat_dipesan=not h.masalah,
        masalah=[MasalahStokOut(**m) for m in h.masalah],
    )


@router.post(
    "/pesanan",
    response_model=PesananOut,
    status_code=status.HTTP_201_CREATED,
    summary="Checkout: buat pesanan dan tahan stok (AB-01, AB-02, AB-04)",
)
def checkout(data: CheckoutIn, db: DB, pelanggan: Pelanggan):
    pesanan = layanan.checkout(db, pelanggan, data)
    db.commit()
    return _keluaran(db, pesanan.id_pesanan, pelanggan)


@router.get("/pesanan", response_model=Halaman[PesananRingkasOut], summary="Riwayat pesanan saya (F-PL-17)")
def riwayat(
    db: DB,
    pelanggan: Pelanggan,
    status_pesanan: Annotated[StatusPesanan | None, Query(alias="status")] = None,
    halaman: int = Query(default=1, ge=1),
    per_halaman: int = Query(default=10, ge=1, le=50),
):
    baris, total = layanan.daftar_pesanan_pelanggan(db, pelanggan, status=status_pesanan, halaman=halaman, per_halaman=per_halaman)
    return Halaman(data=[penyaji_pesanan.ringkas_out(p) for p in baris], total=total, halaman=halaman, per_halaman=per_halaman)


@router.get("/pesanan/{id_pesanan}", response_model=PesananOut, summary="Detail dan status pesanan (F-PL-12)")
def detail(id_pesanan: int, db: DB, pelanggan: Pelanggan):
    return _keluaran(db, id_pesanan, pelanggan)


@router.post("/pesanan/{id_pesanan}/pembayaran", response_model=PesananOut, summary="Unggah bukti transfer (F-PL-11)")
def unggah_bukti(
    id_pesanan: int,
    db: DB,
    pelanggan: Pelanggan,
    bukti: Annotated[UploadFile, File(description="Foto/tangkapan layar bukti transfer")],
    nama_pengirim: Annotated[str, Form(min_length=2, max_length=100)],
    nominal: Annotated[Decimal, Form(gt=0, max_digits=10, decimal_places=2)],
):
    try:
        layanan.unggah_bukti(
            db, id_pesanan=id_pesanan, pelanggan=pelanggan, data=baca_unggahan(bukti), nama_pengirim=nama_pengirim, nominal=nominal
        )
    except BatasBayarLewat:
        db.commit()  # pembatalan otomatis harus tersimpan walau permintaan ini dijawab dengan galat
        raise
    db.commit()
    return _keluaran(db, id_pesanan, pelanggan)


@router.post("/pesanan/{id_pesanan}/batal", response_model=PesananOut, summary="Batalkan pesanan sebelum dirangkai (F-PL-15, AB-08)")
def batalkan(id_pesanan: int, data: BatalIn, db: DB, pelanggan: Pelanggan):
    layanan.batalkan_oleh_pelanggan(db, id_pesanan=id_pesanan, pelanggan=pelanggan, alasan=data.alasan)
    db.commit()
    return _keluaran(db, id_pesanan, pelanggan)


@router.post(
    "/pesanan/{id_pesanan}/persetujuan-foto",
    response_model=PesananOut,
    summary="Setujui atau minta revisi foto hasil (F-PL-13, AB-05..07)",
)
def tanggapi_foto(id_pesanan: int, data: TanggapanFotoIn, db: DB, pelanggan: Pelanggan):
    foto_konfirmasi.tanggapi_foto(db, id_pesanan=id_pesanan, pelanggan=pelanggan, data=data)
    db.commit()
    return _keluaran(db, id_pesanan, pelanggan)


@router.post(
    "/pesanan/{id_pesanan}/komplain",
    response_model=KomplainOut,
    status_code=status.HTTP_201_CREATED,
    summary="Ajukan komplain maksimal 1x24 jam setelah pesanan diterima (F-PL-16, AB-09)",
)
def ajukan_komplain(
    id_pesanan: int,
    db: DB,
    pelanggan: Pelanggan,
    isi: Annotated[str, Form(min_length=5, max_length=1000)],
    foto: Annotated[UploadFile | None, File(description="Foto keluhan (disarankan)")] = None,
):
    data_foto = baca_unggahan(foto) if foto is not None and foto.filename else None
    baru = komplain.ajukan(db, id_pesanan=id_pesanan, pelanggan=pelanggan, isi=isi, foto=data_foto)
    db.commit()
    return penyaji_pesanan.komplain_out(komplain.ambil(db, baru.id_komplain))


@router.get("/komplain/saya", response_model=list[KomplainOut], summary="Komplain yang pernah saya ajukan")
def komplain_saya(db: DB, pelanggan: Pelanggan):
    return [penyaji_pesanan.komplain_out(k) for k in komplain.daftar_pelanggan(db, pelanggan)]
