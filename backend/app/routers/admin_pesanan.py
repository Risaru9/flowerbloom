"""Admin: pesanan, verifikasi pembayaran, Mode Merangkai, foto hasil, komplain, dasbor, laporan, akun."""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.core.errors import DataTidakValid
from app.core.penyimpanan import baca_unggahan
from app.core.waktu import hari_ini_wib
from app.dependencies import DB, Admin
from app.models.enums import Peran, StatusKomplain, StatusPesanan
from app.schemas.akun import AdminBaruIn, AktifIn, PenggunaOut
from app.schemas.dasar import Halaman
from app.schemas.pesanan import (
    DasborOut,
    HasilMerangkaiOut,
    KomplainAdminOut,
    LaporanOut,
    PenggantiIn,
    PesananAdminOut,
    PesananAdminRingkasOut,
    ProgresMerangkaiOut,
    TandaiCocokIn,
    TanggapiKomplainIn,
    TolakBuktiIn,
)
from app.schemas.referensi import JenisRingkas, WarnaRingkas
from app.services import akun, foto_konfirmasi, komplain, laporan, merangkai, pengaturan_toko, penyaji_pesanan
from app.services import pesanan as layanan

router = APIRouter(prefix="/admin", tags=["Admin - Pesanan"])
router_lain = APIRouter(prefix="/admin", tags=["Admin - Dasbor, Komplain & Akun"])


def _detail(db, id_pesanan: int) -> PesananAdminOut:
    return penyaji_pesanan.admin_out(layanan.ambil_pesanan(db, id_pesanan), pengaturan_toko.ambil(db))


def _progres(db, id_pesanan: int) -> ProgresMerangkaiOut:
    pesanan = layanan.ambil_pesanan(db, id_pesanan)
    terpindai, target, siap = merangkai.progres(pesanan)
    return ProgresMerangkaiOut(
        pesanan=penyaji_pesanan.admin_out(pesanan, pengaturan_toko.ambil(db)), terpindai=terpindai, target=target, siap_foto=siap
    )


# --- Pesanan & pembayaran ---------------------------------------------------------------------------------------


@router.get("/pesanan", response_model=Halaman[PesananAdminRingkasOut], summary="Daftar pesanan: saring status, cari kode/pemesan/rangkaian (F-AD-04)")
def daftar_pesanan(
    db: DB,
    _: Admin,
    status_pesanan: Annotated[StatusPesanan | None, Query(alias="status")] = None,
    cari: str | None = Query(default=None, max_length=100),
    perlu_tindakan: bool = False,
    halaman: int = Query(default=1, ge=1),
    per_halaman: int = Query(default=20, ge=1, le=100),
):
    baris, total = layanan.daftar_pesanan_admin(
        db, status=status_pesanan, cari=cari, perlu_tindakan=perlu_tindakan, halaman=halaman, per_halaman=per_halaman
    )
    pengaturan = pengaturan_toko.ambil(db)
    return Halaman(
        data=[penyaji_pesanan.admin_ringkas_out(p, pengaturan) for p in baris], total=total, halaman=halaman, per_halaman=per_halaman
    )


@router.get("/pesanan/{id_pesanan}", response_model=PesananAdminOut, summary="Detail pesanan lengkap (F-AD-05)")
def detail_pesanan(id_pesanan: int, db: DB, _: Admin):
    return _detail(db, id_pesanan)


@router.post(
    "/pesanan/{id_pesanan}/pembayaran/{id_pembayaran}/sahkan",
    response_model=PesananAdminOut,
    summary="Sahkan pembayaran: pesanan masuk antrean rangkai (F-AD-06)",
)
def sahkan(id_pesanan: int, id_pembayaran: int, db: DB, admin: Admin):
    layanan.sahkan_pembayaran(db, id_pesanan=id_pesanan, id_pembayaran=id_pembayaran, admin=admin)
    db.commit()
    return _detail(db, id_pesanan)


@router.post(
    "/pesanan/{id_pesanan}/pembayaran/{id_pembayaran}/tolak",
    response_model=PesananAdminOut,
    summary="Tolak bukti transfer: pelanggan diminta mengunggah ulang",
)
def tolak(id_pesanan: int, id_pembayaran: int, data: TolakBuktiIn, db: DB, admin: Admin):
    layanan.tolak_pembayaran(db, id_pesanan=id_pesanan, id_pembayaran=id_pembayaran, admin=admin, catatan=data.catatan)
    db.commit()
    return _detail(db, id_pesanan)


@router.post("/pesanan/{id_pesanan}/selesai", response_model=PesananAdminOut, summary="Tandai pesanan selesai (sudah diterima)")
def selesai(id_pesanan: int, db: DB, admin: Admin):
    layanan.tandai_selesai(db, id_pesanan=id_pesanan, admin=admin)
    db.commit()
    return _detail(db, id_pesanan)


@router.post(
    "/pesanan/{id_pesanan}/pengembalian-dana-selesai",
    response_model=PesananAdminOut,
    summary="Tandai pengembalian dana pesanan batal sudah dilakukan",
)
def pengembalian_selesai(id_pesanan: int, db: DB, _: Admin):
    layanan.selesaikan_pengembalian_dana(db, id_pesanan=id_pesanan)
    db.commit()
    return _detail(db, id_pesanan)


# --- Mode Merangkai ---------------------------------------------------------------------------------------------


@router.get("/pesanan/{id_pesanan}/merangkai", response_model=ProgresMerangkaiOut, summary="Komposisi dan progres pencocokan (F-AD-07)")
def lihat_merangkai(id_pesanan: int, db: DB, _: Admin):
    return _progres(db, id_pesanan)


@router.post(
    "/pesanan/{id_pesanan}/merangkai/pindai",
    response_model=HasilMerangkaiOut,
    summary="Pindai bunga yang diambil; warnanya dicocokkan otomatis dengan pesanan",
)
def pindai_merangkai(
    id_pesanan: int,
    db: DB,
    admin: Admin,
    foto: Annotated[UploadFile, File()],
    jumlah: Annotated[int, Form(ge=1, le=500, description="Jumlah tangkai sejenis dalam foto")] = 1,
    id_jenis_bunga: Annotated[
        int | None,
        Form(description="Jenis bunga yang diambil (dipilih admin). Kosongkan agar jenis ditentukan dari warna bila tidak ambigu"),
    ] = None,
):
    hasil = merangkai.pindai_bunga(
        db, id_pesanan=id_pesanan, admin=admin, data=baca_unggahan(foto), jumlah=jumlah, id_jenis_bunga=id_jenis_bunga
    )
    db.commit()
    return HasilMerangkaiOut(
        dikenali=hasil.dikenali,
        cocok=hasil.cocok,
        alasan=hasil.alasan,
        jenis=JenisRingkas.model_validate(hasil.jenis) if hasil.jenis else None,
        warna=WarnaRingkas.model_validate(hasil.warna) if hasil.warna else None,
        id_komposisi_cocok=hasil.id_komposisi_cocok,
        id_komposisi_kandidat=hasil.id_komposisi_kandidat,
        progres=_progres(db, id_pesanan),
    )


@router.post("/pesanan/{id_pesanan}/merangkai/tandai-cocok", response_model=ProgresMerangkaiOut, summary="Tandai cocok secara manual (bila pemindaian meleset)")
def tandai_cocok(id_pesanan: int, data: TandaiCocokIn, db: DB, _: Admin):
    merangkai.tandai_cocok(db, id_pesanan=id_pesanan, id_komposisi_pesanan=data.id_komposisi_pesanan, jumlah=data.jumlah)
    db.commit()
    return _progres(db, id_pesanan)


@router.post("/pesanan/{id_pesanan}/merangkai/pengganti", response_model=ProgresMerangkaiOut, summary="Catat bunga pengganti beserta alasannya (F-AD-08)")
def catat_pengganti(id_pesanan: int, data: PenggantiIn, db: DB, admin: Admin):
    merangkai.catat_pengganti(
        db,
        id_pesanan=id_pesanan,
        admin=admin,
        id_komposisi_asal=data.id_komposisi_asal,
        id_stok_pengganti=data.id_stok_pengganti,
        jumlah=data.jumlah,
        alasan=data.alasan,
    )
    db.commit()
    return _progres(db, id_pesanan)


@router.post("/pesanan/{id_pesanan}/foto-hasil", response_model=PesananAdminOut, summary="Unggah foto hasil rangkaian; warna dibaca otomatis (F-AD-09, AB-05)")
def foto_hasil(id_pesanan: int, db: DB, admin: Admin, foto: Annotated[UploadFile, File()]):
    foto_konfirmasi.unggah_foto_hasil(db, id_pesanan=id_pesanan, admin=admin, data=baca_unggahan(foto))
    db.commit()
    return _detail(db, id_pesanan)


# --- Dasbor, laporan, komplain, akun ------------------------------------------------------------------------------


@router_lain.get("/dasbor", response_model=DasborOut, summary="Dasbor: pekerjaan yang perlu tindakan, stok menipis, penjualan (F-AD-02/03)")
def dasbor(db: DB, _: Admin):
    return laporan.dasbor(db)


@router_lain.get("/laporan", response_model=LaporanOut, summary="Laporan penjualan, terlaris, revisi, komplain (F-AD-15)")
def lihat_laporan(
    db: DB,
    _: Admin,
    dari: date | None = Query(default=None, description="Bawaan: 28 hari sebelum 'sampai'"),
    sampai: date | None = Query(default=None, description="Bawaan: hari ini (WIB)"),
):
    akhir = sampai or hari_ini_wib()
    awal = dari or akhir - timedelta(days=27)
    if awal > akhir:
        raise DataTidakValid("Tanggal 'dari' tidak boleh setelah 'sampai'.")
    return laporan.laporan(db, awal, akhir)


@router_lain.get("/komplain", response_model=list[KomplainAdminOut], summary="Daftar komplain pelanggan")
def daftar_komplain(db: DB, _: Admin, status_komplain: Annotated[StatusKomplain | None, Query(alias="status")] = None):
    return [penyaji_pesanan.komplain_admin_out(k) for k in komplain.daftar_admin(db, status_komplain)]


@router_lain.patch("/komplain/{id_komplain}", response_model=KomplainAdminOut, summary="Tanggapi komplain")
def tanggapi_komplain(id_komplain: int, data: TanggapiKomplainIn, db: DB, admin: Admin):
    komplain.tanggapi(db, id_komplain=id_komplain, admin=admin, tanggapan=data.tanggapan, status=data.status)
    db.commit()
    return penyaji_pesanan.komplain_admin_out(komplain.ambil(db, id_komplain))


@router_lain.get("/pengguna", response_model=list[PenggunaOut], summary="Daftar akun (F-AD-17)")
def daftar_pengguna(db: DB, _: Admin, peran: Peran | None = None):
    return akun.daftar_pengguna(db, peran)


@router_lain.post("/pengguna", response_model=PenggunaOut, status_code=status.HTTP_201_CREATED, summary="Tambah akun admin (F-AD-17)")
def tambah_admin(data: AdminBaruIn, db: DB, _: Admin):
    pengguna = akun.buat_akun(db, nama=data.nama, email=data.email, kata_sandi=data.kata_sandi, no_hp=data.no_hp, peran=Peran.admin)
    db.commit()
    return pengguna


@router_lain.patch("/pengguna/{id_pengguna}/aktif", response_model=PenggunaOut, summary="Aktifkan atau nonaktifkan akun")
def atur_aktif(id_pengguna: int, data: AktifIn, db: DB, admin: Admin):
    pengguna = akun.atur_aktif(db, id_pengguna=id_pengguna, aktif=data.aktif, oleh=admin)
    db.commit()
    return pengguna
