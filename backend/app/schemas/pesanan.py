"""Skema pesanan: permintaan checkout dan bentuk respons untuk pelanggan maupun admin."""
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.tipe import Uang
from app.models.enums import CaraSerahTerima, JenisItem, StatusKomplain, StatusPersetujuan, StatusPesanan, StatusVerifikasi
from app.schemas.referensi import JenisRingkas, WarnaRingkas

# --- Masukan --------------------------------------------------------------------------------------------------


class ItemPaketIn(BaseModel):
    jenis_item: Literal["paket"]
    id_produk: int
    jumlah: int = Field(default=1, ge=1, le=20)


class BungaRangkaiIn(BaseModel):
    id_stok: int
    jumlah_tangkai: int = Field(ge=1, le=500)


class ItemRangkaiSendiriIn(BaseModel):
    jenis_item: Literal["rangkai_sendiri"]
    bunga: list[BungaRangkaiIn] = Field(min_length=1, max_length=30)


ItemIn = Annotated[ItemPaketIn | ItemRangkaiSendiriIn, Field(discriminator="jenis_item")]


class PratinjauIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1, max_length=10)
    cara_serah_terima: CaraSerahTerima = CaraSerahTerima.ambil_di_toko


class CheckoutIn(PratinjauIn):
    nama_penerima: str = Field(min_length=2, max_length=100)
    alamat: str | None = Field(default=None, max_length=500)
    tanggal_kirim: date
    slot_jam: str = Field(max_length=20)
    kartu_ucapan: str | None = Field(default=None, max_length=500)

    @field_validator("nama_penerima")
    @classmethod
    def _rapikan_nama(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("nama terlalu pendek")
        return v

    @model_validator(mode="after")
    def _alamat_wajib_bila_diantar(self) -> "CheckoutIn":
        if self.cara_serah_terima == CaraSerahTerima.antar and not (self.alamat and self.alamat.strip()):
            raise ValueError("alamat wajib diisi untuk pengantaran")
        return self


class TanggapanFotoIn(BaseModel):
    keputusan: Literal["setuju", "revisi"]
    catatan_revisi: str | None = Field(default=None, max_length=500)
    setuju_pengganti: bool = Field(
        default=False, description="Pelanggan sudah membaca dan menyetujui bunga pengganti (AB-07)"
    )


class BatalIn(BaseModel):
    alasan: str | None = Field(default=None, max_length=255)


class TolakBuktiIn(BaseModel):
    catatan: str = Field(min_length=3, max_length=255, description="Alasan penolakan, ditampilkan ke pelanggan")


# --- Keluaran: hitungan ----------------------------------------------------------------------------------------


class MasalahStokOut(BaseModel):
    id_stok: int | None = None
    bunga: str
    diminta: int
    tersedia: int


class ItemHitungOut(BaseModel):
    jenis_item: JenisItem
    nama: str
    jumlah: int
    jumlah_tangkai: int
    subtotal: Uang


class PratinjauOut(BaseModel):
    items: list[ItemHitungOut]
    subtotal: Uang
    ongkos_antar: Uang
    total_harga: Uang
    dapat_dipesan: bool
    masalah: list[MasalahStokOut]


# --- Keluaran: pesanan -----------------------------------------------------------------------------------------


class StatusInfoOut(BaseModel):
    """Status selalu punya ikon dan teks, tidak hanya warna (F-AK-02)."""

    kode: StatusPesanan
    label: str
    ikon: str
    keterangan: str


class TahapOut(BaseModel):
    kode: StatusPesanan
    label: str
    ikon: str
    keterangan: str
    keadaan: Literal["selesai", "aktif", "belum"]


class KomposisiPesananOut(BaseModel):
    id_komposisi_pesanan: int
    id_stok: int
    jenis: JenisRingkas
    warna: WarnaRingkas
    deskripsi: str
    jumlah_tangkai: int
    jumlah_terpindai: int
    is_pengganti: bool
    alasan_pengganti: str | None
    ditandai_manual: bool


class DetailPesananOut(BaseModel):
    id_detail: int
    jenis_item: JenisItem
    id_produk: int | None
    nama: str
    jumlah: int
    subtotal: Uang
    komposisi: list[KomposisiPesananOut]
    narasi: str


class PembayaranOut(BaseModel):
    id_pembayaran: int
    nama_pengirim: str
    nominal: Uang
    nominal_sesuai: bool
    status_verifikasi: StatusVerifikasi
    catatan_penolakan: str | None
    diunggah_pada: datetime
    waktu_verifikasi: datetime | None
    bukti_url: str | None


class LabelWarnaOut(BaseModel):
    id_warna: int
    nama_warna: str
    kode_hex: str
    persen: int


class PenggantiOut(BaseModel):
    dari: str
    menjadi: str
    jumlah: int
    alasan: str | None
    warna_berbeda: bool


class FotoKonfirmasiOut(BaseModel):
    id_foto: int
    foto_url: str | None
    label_warna: list[LabelWarnaOut]
    label_teks: str = Field(description="Label warna sebagai kalimat, mis. 'Merah tua 55%, Merah muda 30%'")
    pengganti: list[PenggantiOut]
    status_persetujuan: StatusPersetujuan
    catatan_revisi: str | None
    diunggah_pada: datetime
    ditanggapi_pada: datetime | None


class RiwayatStatusOut(BaseModel):
    kode: StatusPesanan
    label: str
    waktu: datetime
    catatan: str | None
    oleh_sistem: bool
    oleh: Literal["sistem", "pelanggan", "admin"]


class PesananRingkasOut(BaseModel):
    id_pesanan: int
    kode_pesanan: str
    status: StatusInfoOut
    ringkasan_item: str
    tanggal_kirim: date
    slot_jam: str
    cara_serah_terima: CaraSerahTerima
    total_harga: Uang
    dibuat_pada: datetime
    batas_bayar: datetime | None
    perlu_tindakan_pelanggan: bool


class PesananOut(PesananRingkasOut):
    nama_penerima: str
    alamat: str | None
    kartu_ucapan: str | None
    ongkos_antar: Uang
    jumlah_revisi: int
    revisi_gratis_tersisa: int
    alasan_batal: str | None
    detail: list[DetailPesananOut]
    pembayaran: list[PembayaranOut]
    foto: list[FotoKonfirmasiOut]
    riwayat: list[RiwayatStatusOut]
    tahap: list[TahapOut]
    rekening_tujuan: str | None = Field(description="Terisi hanya saat pesanan menunggu pembayaran dan rekening sudah diatur admin")
    bisa_dibatalkan: bool
    ada_pengganti: bool


class PemesanOut(BaseModel):
    id_pengguna: int
    nama: str
    email: str
    no_hp: str | None


class PesananAdminRingkasOut(PesananRingkasOut):
    pemesan: PemesanOut
    nama_penerima: str
    perlu_tindakan_admin: bool
    perlu_pengembalian_dana: bool
    terlambat_ditanggapi: bool


class PesananAdminOut(PesananOut):
    pemesan: PemesanOut
    perlu_tindakan_admin: bool
    perlu_pengembalian_dana: bool
    revisi_berbayar: bool = Field(description="Jumlah revisi melebihi jatah gratis; keputusan tagihan ada di admin")
    terlambat_ditanggapi: bool = Field(description="Foto belum ditanggapi melewati batas wajar (AB-10)")


# --- Komplain ---------------------------------------------------------------------------------------------------


class KomplainOut(BaseModel):
    id_komplain: int
    id_pesanan: int
    kode_pesanan: str
    isi: str
    foto_url: str | None
    status: StatusKomplain
    tanggapan_admin: str | None
    dibuat_pada: datetime
    ditanggapi_pada: datetime | None


class KomplainAdminOut(KomplainOut):
    pemesan: PemesanOut


class TanggapiKomplainIn(BaseModel):
    tanggapan: str = Field(min_length=3, max_length=1000)
    status: StatusKomplain = StatusKomplain.selesai


# --- Mode merangkai ----------------------------------------------------------------------------------------------


class ProgresMerangkaiOut(BaseModel):
    pesanan: PesananAdminOut
    terpindai: int
    target: int
    siap_foto: bool


class HasilMerangkaiOut(BaseModel):
    dikenali: bool
    cocok: bool
    alasan: str | None
    jenis: JenisRingkas | None
    warna: WarnaRingkas | None
    id_komposisi_cocok: int | None
    progres: ProgresMerangkaiOut


class TandaiCocokIn(BaseModel):
    id_komposisi_pesanan: int
    jumlah: int = Field(default=1, ge=1, le=500)


class PenggantiIn(BaseModel):
    id_komposisi_asal: int
    id_stok_pengganti: int
    jumlah: int = Field(ge=1, le=500)
    alasan: str = Field(min_length=3, max_length=255, description="Mis. 'mawar merah habis' atau 'tangkai rusak'")


# --- Dasbor dan laporan ---------------------------------------------------------------------------------------------


class TitikGrafikOut(BaseModel):
    tanggal: date
    jumlah: int


class DasborOut(BaseModel):
    pesanan_aktif: int
    perlu_verifikasi: int
    perlu_dirangkai: int
    menunggu_persetujuan_foto: int
    perlu_pengembalian_dana: int
    komplain_baru: int
    stok_menipis: list[str]
    penjualan_hari_ini: Uang
    penjualan_minggu_ini: Uang
    grafik_pesanan_mingguan: list[TitikGrafikOut]


class PenjualanMingguOut(BaseModel):
    awal_minggu: date = Field(description="Hari Senin minggu tersebut")
    total: Uang
    jumlah_pesanan: int


class TerlarisOut(BaseModel):
    nama: str
    terjual: int


class LaporanOut(BaseModel):
    dari: date
    sampai: date
    total_penjualan: Uang
    jumlah_pesanan_berbayar: int
    penjualan_per_minggu: list[PenjualanMingguOut]
    terlaris: list[TerlarisOut]
    jumlah_revisi: int
    jumlah_komplain: int
    jumlah_dibatalkan: int
