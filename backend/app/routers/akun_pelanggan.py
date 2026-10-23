"""Produk favorit dan alamat tersimpan milik pelanggan yang sedang masuk."""
from fastapi import APIRouter, Response, status

from app.dependencies import DB, Pelanggan
from app.schemas.akun_pelanggan import AlamatIn, AlamatOut, AlamatUbahIn
from app.schemas.katalog import ProdukOut
from app.services import akun_pelanggan, katalog, penyaji

router = APIRouter(tags=["Pelanggan - Favorit & Alamat"])


@router.get("/favorit", response_model=list[ProdukOut], summary="Produk favorit saya")
def daftar_favorit(db: DB, pengguna: Pelanggan):
    peta = katalog.peta_stok(db)
    return [penyaji.produk_ke_out(p, peta) for p in akun_pelanggan.daftar_favorit(db, pengguna)]


@router.put("/favorit/{id_produk}", status_code=status.HTTP_204_NO_CONTENT, summary="Simpan produk ke favorit")
def simpan_favorit(id_produk: int, db: DB, pengguna: Pelanggan):
    akun_pelanggan.simpan_favorit(db, pengguna, id_produk)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/favorit/{id_produk}", status_code=status.HTTP_204_NO_CONTENT, summary="Hapus produk dari favorit")
def hapus_favorit(id_produk: int, db: DB, pengguna: Pelanggan):
    akun_pelanggan.hapus_favorit(db, pengguna, id_produk)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/alamat", response_model=list[AlamatOut], summary="Alamat tersimpan saya (utama lebih dulu)")
def daftar_alamat(db: DB, pengguna: Pelanggan):
    return akun_pelanggan.daftar_alamat(db, pengguna)


@router.post("/alamat", response_model=AlamatOut, status_code=status.HTTP_201_CREATED, summary="Tambah alamat")
def buat_alamat(data: AlamatIn, db: DB, pengguna: Pelanggan):
    alamat = akun_pelanggan.buat_alamat(db, pengguna, data.model_dump())
    db.commit()
    return alamat


@router.patch("/alamat/{id_alamat}", response_model=AlamatOut, summary="Ubah alamat atau jadikan alamat utama")
def ubah_alamat(id_alamat: int, data: AlamatUbahIn, db: DB, pengguna: Pelanggan):
    alamat = akun_pelanggan.ubah_alamat(db, pengguna, id_alamat, data.model_dump(exclude_unset=True))
    db.commit()
    return alamat


@router.delete("/alamat/{id_alamat}", status_code=status.HTTP_204_NO_CONTENT, summary="Hapus alamat")
def hapus_alamat(id_alamat: int, db: DB, pengguna: Pelanggan):
    akun_pelanggan.hapus_alamat(db, pengguna, id_alamat)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
