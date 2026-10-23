"""Autentikasi, profil, dan pengaturan aksesibilitas."""
from fastapi import APIRouter, Request, Response, status

from app.core.errors import TidakSah
from app.core.pembatas import pembatas_masuk, pembatas_masuk_ip
from app.dependencies import DB, PenggunaSaatIni
from app.schemas.akun import (
    AksesibilitasOut,
    AksesibilitasUbahIn,
    DaftarIn,
    KataSandiUbahIn,
    MasukIn,
    PenggunaOut,
    ProfilUbahIn,
    TokenOut,
)
from app.services import akun

router = APIRouter(tags=["Autentikasi & Akun"])


@router.post("/auth/daftar", response_model=PenggunaOut, status_code=status.HTTP_201_CREATED, summary="Daftar akun pelanggan")
def daftar(data: DaftarIn, db: DB):
    pengguna = akun.daftar_pelanggan(
        db, nama=data.nama, email=data.email, kata_sandi=data.kata_sandi, no_hp=data.no_hp
    )
    db.commit()
    return pengguna


@router.post(
    "/auth/masuk",
    response_model=TokenOut,
    summary="Masuk (pelanggan maupun admin); dikunci sementara setelah beberapa kali gagal",
)
def masuk(data: MasukIn, db: DB, request: Request):
    ip = request.client.host if request.client else "tanpa-ip"
    kunci_akun = f"{ip}:{akun.normalisasi_email(data.email)}"
    per_akun, per_ip = pembatas_masuk(), pembatas_masuk_ip()
    per_akun.periksa(kunci_akun)
    per_ip.periksa(ip)
    try:
        pengguna, token = akun.masuk(db, email=data.email, kata_sandi=data.kata_sandi)
    except TidakSah:
        per_akun.gagal(kunci_akun)
        per_ip.gagal(ip)
        raise
    per_akun.berhasil(kunci_akun)
    return TokenOut(access_token=token, pengguna=PenggunaOut.model_validate(pengguna))


@router.patch("/auth/kata-sandi", response_model=TokenOut, summary="Ganti kata sandi; sesi di perangkat lain ikut berakhir")
def ganti_kata_sandi(data: KataSandiUbahIn, db: DB, pengguna: PenggunaSaatIni):
    token = akun.ubah_kata_sandi(db, pengguna, lama=data.kata_sandi_lama, baru=data.kata_sandi_baru)
    db.commit()
    return TokenOut(access_token=token, pengguna=PenggunaOut.model_validate(pengguna))


@router.post("/auth/keluar-semua", status_code=status.HTTP_204_NO_CONTENT, summary="Keluar dari semua perangkat")
def keluar_semua(db: DB, pengguna: PenggunaSaatIni):
    akun.cabut_semua_sesi(db, pengguna)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/auth/saya", response_model=PenggunaOut, summary="Profil akun yang sedang masuk")
def profil(pengguna: PenggunaSaatIni):
    return pengguna


@router.patch("/auth/saya", response_model=PenggunaOut, summary="Ubah nama, email, atau nomor telepon (F-PL-19)")
def ubah_profil(data: ProfilUbahIn, db: DB, pengguna: PenggunaSaatIni):
    akun.ubah_profil(db, pengguna, nama=data.nama, email=data.email, no_hp=data.no_hp)
    db.commit()
    return pengguna


@router.get("/aksesibilitas/saya", response_model=AksesibilitasOut, summary="Pengaturan aksesibilitas saya (F-PL-18)")
def lihat_aksesibilitas(db: DB, pengguna: PenggunaSaatIni):
    pengaturan = akun.ambil_pengaturan_aksesibilitas(db, pengguna)
    db.commit()
    return pengaturan


@router.patch("/aksesibilitas/saya", response_model=AksesibilitasOut, summary="Ubah pengaturan aksesibilitas saya")
def ubah_aksesibilitas(data: AksesibilitasUbahIn, db: DB, pengguna: PenggunaSaatIni):
    pengaturan = akun.ubah_pengaturan_aksesibilitas(db, pengguna, data.model_dump(exclude_unset=True, exclude_none=True))
    db.commit()
    return pengaturan
