"""Data acuan: daftar warna dan jenis bunga (publik untuk dibaca; admin untuk mengubah)."""
from fastapi import APIRouter, Query, status

from app.dependencies import DB, Admin
from app.schemas.referensi import JenisBungaOut, JenisBungaUbahIn, WarnaIn, WarnaOut, WarnaUbahIn
from app.services import referensi

router = APIRouter(tags=["Data Acuan"])


@router.get("/warna", response_model=list[WarnaOut], summary="Daftar nama warna beserta kode dan maknanya")
def daftar_warna(db: DB):
    return referensi.daftar_warna(db)


@router.get("/jenis-bunga", response_model=list[JenisBungaOut], summary="Daftar jenis bunga yang dikenali sistem")
def daftar_jenis_bunga(db: DB, cari: str | None = Query(default=None, max_length=100)):
    return referensi.daftar_jenis_bunga(db, cari)


@router.post("/admin/warna", response_model=WarnaOut, status_code=status.HTTP_201_CREATED, summary="Tambah warna")
def tambah_warna(data: WarnaIn, db: DB, _: Admin):
    warna = referensi.buat_warna(db, nama_warna=data.nama_warna, kode_hex=data.kode_hex, makna_warna=data.makna_warna)
    db.commit()
    return warna


@router.patch("/admin/warna/{id_warna}", response_model=WarnaOut, summary="Ubah nama, kode, atau makna warna")
def ubah_warna(id_warna: int, data: WarnaUbahIn, db: DB, _: Admin):
    warna = referensi.ubah_warna(db, id_warna, data.model_dump(exclude_unset=True))
    db.commit()
    return warna


@router.patch("/admin/jenis-bunga/{id_jenis_bunga}", response_model=JenisBungaOut, summary="Ubah keterangan jenis bunga")
def ubah_jenis_bunga(id_jenis_bunga: int, data: JenisBungaUbahIn, db: DB, _: Admin):
    jenis = referensi.ubah_jenis_bunga(db, id_jenis_bunga, data.model_dump(exclude_unset=True))
    db.commit()
    return jenis
