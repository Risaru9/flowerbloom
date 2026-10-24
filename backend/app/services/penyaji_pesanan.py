"""Penyaji pesanan dan komplain: objek ORM -> skema respons untuk pelanggan dan admin."""
from datetime import timedelta

from app.ai.deskripsi import deskripsi_bunga, narasi_rangkaian
from app.core.tautan import tautan_berkas
from app.core.waktu import sekarang_utc
from app.models.enums import JenisItem, StatusPesanan
from app.models.komplain import Komplain
from app.models.pesanan import DetailPesanan, FotoKonfirmasi, KomposisiPesanan, Pembayaran, Pesanan, RiwayatStatusPesanan
from app.schemas.pesanan import (
    DetailPesananOut,
    FotoKonfirmasiOut,
    KomplainAdminOut,
    KomplainOut,
    KomposisiPesananOut,
    LabelWarnaOut,
    PembayaranOut,
    PemesanOut,
    PenggantiOut,
    PesananAdminOut,
    PesananAdminRingkasOut,
    PesananOut,
    PesananRingkasOut,
    RiwayatStatusOut,
    StatusInfoOut,
    TahapOut,
)
from app.schemas.referensi import JenisRingkas, WarnaRingkas
from app.services import alur_pesanan, foto_konfirmasi
from app.services.alur_pesanan import S
from app.services.pengaturan_toko import PengaturanTerkini


def status_info(status: StatusPesanan) -> StatusInfoOut:
    i = alur_pesanan.info(status)
    return StatusInfoOut(kode=status, label=i.label, ikon=i.ikon, keterangan=i.keterangan)


def _nama_detail(d: DetailPesanan) -> str:
    if d.jenis_item == JenisItem.paket and d.produk:
        return d.produk.nama_produk
    jumlah = sum(k.jumlah_tangkai for k in d.komposisi)
    return f"Rangkaian sendiri ({jumlah} tangkai)"


def _ringkasan_item(pesanan: Pesanan) -> str:
    return ", ".join(
        f"{_nama_detail(d)} ×{d.jumlah}" if d.jenis_item == JenisItem.paket else _nama_detail(d) for d in pesanan.detail
    )


def _komposisi_out(k: KomposisiPesanan) -> KomposisiPesananOut:
    return KomposisiPesananOut(
        id_komposisi_pesanan=k.id_komposisi_pesanan,
        id_stok=k.id_stok,
        jenis=JenisRingkas.model_validate(k.stok.jenis_bunga),
        warna=WarnaRingkas.model_validate(k.stok.warna),
        deskripsi=deskripsi_bunga(k.stok.jenis_bunga.nama_bunga, k.stok.warna.nama_warna, k.stok.jenis_bunga.bentuk_bunga),
        jumlah_tangkai=k.jumlah_tangkai,
        jumlah_terpindai=k.jumlah_terpindai,
        is_pengganti=k.is_pengganti,
        alasan_pengganti=k.alasan_pengganti,
        ditandai_manual=k.ditandai_manual,
    )


def _detail_out(d: DetailPesanan) -> DetailPesananOut:
    baris = [_komposisi_out(k) for k in d.komposisi if k.jumlah_tangkai > 0]
    nama = _nama_detail(d)
    return DetailPesananOut(
        id_detail=d.id_detail,
        jenis_item=d.jenis_item,
        id_produk=d.id_produk,
        nama=nama,
        jumlah=d.jumlah,
        subtotal=d.subtotal,
        komposisi=baris,
        narasi=narasi_rangkaian(nama, ((b.jumlah_tangkai, b.jenis.nama_bunga, b.warna.nama_warna) for b in baris)),
    )


def _pembayaran_out(p: Pembayaran, pesanan: Pesanan) -> PembayaranOut:
    return PembayaranOut(
        id_pembayaran=p.id_pembayaran,
        nama_pengirim=p.nama_pengirim,
        nominal=p.nominal,
        nominal_sesuai=p.nominal == pesanan.total_harga,
        status_verifikasi=p.status_verifikasi,
        catatan_penolakan=p.catatan_penolakan,
        diunggah_pada=p.diunggah_pada,
        waktu_verifikasi=p.waktu_verifikasi,
        bukti_url=tautan_berkas(p.bukti_transfer),
    )


def _foto_out(f: FotoKonfirmasi) -> FotoKonfirmasiOut:
    label = [LabelWarnaOut(**x) for x in (f.label_warna or [])]
    return FotoKonfirmasiOut(
        id_foto=f.id_foto,
        foto_url=tautan_berkas(f.file_foto),
        label_warna=label,
        label_teks=", ".join(f"{x.nama_warna} {x.persen}%" for x in label),
        pengganti=[PenggantiOut(**x) for x in (f.ringkasan_pengganti or [])],
        status_persetujuan=f.status_persetujuan,
        catatan_revisi=f.catatan_revisi,
        diunggah_pada=f.diunggah_pada,
        ditanggapi_pada=f.ditanggapi_pada,
    )


def _riwayat_out(r: RiwayatStatusPesanan) -> RiwayatStatusOut:
    return RiwayatStatusOut(
        kode=r.status_baru,
        label=alur_pesanan.info(r.status_baru).label,
        waktu=r.waktu,
        catatan=r.catatan,
        oleh_sistem=r.id_pengguna is None,
    )


def ringkas_out(p: Pesanan) -> PesananRingkasOut:
    return PesananRingkasOut(
        id_pesanan=p.id_pesanan,
        kode_pesanan=p.kode_pesanan,
        status=status_info(p.status),
        ringkasan_item=_ringkasan_item(p),
        tanggal_kirim=p.tanggal_kirim,
        slot_jam=p.slot_jam,
        cara_serah_terima=p.cara_serah_terima,
        total_harga=p.total_harga,
        dibuat_pada=p.dibuat_pada,
        batas_bayar=p.batas_bayar if p.status == S.menunggu_pembayaran else None,
        perlu_tindakan_pelanggan=p.status in alur_pesanan.STATUS_TINDAKAN_PELANGGAN,
    )


def pesanan_out(p: Pesanan, pengaturan: PengaturanTerkini) -> PesananOut:
    return PesananOut(
        **ringkas_out(p).model_dump(),
        nama_penerima=p.nama_penerima,
        alamat=p.alamat,
        kartu_ucapan=p.kartu_ucapan,
        ongkos_antar=p.ongkos_antar,
        jumlah_revisi=p.jumlah_revisi,
        revisi_gratis_tersisa=max(0, pengaturan.jumlah_revisi_gratis - p.jumlah_revisi),
        alasan_batal=p.alasan_batal,
        detail=[_detail_out(d) for d in p.detail],
        pembayaran=[_pembayaran_out(b, p) for b in p.pembayaran],
        foto=[_foto_out(f) for f in p.foto],
        riwayat=[_riwayat_out(r) for r in p.riwayat_status],
        tahap=[TahapOut(**t) for t in alur_pesanan.tahap(p)],
        rekening_tujuan=pengaturan.rekening_tujuan if p.status == S.menunggu_pembayaran else None,
        bisa_dibatalkan=p.status in alur_pesanan.STATUS_BISA_DIBATALKAN,
        ada_pengganti=any(k.is_pengganti for d in p.detail for k in d.komposisi),
    )


def _pemesan(p: Pesanan) -> PemesanOut:
    return PemesanOut(id_pengguna=p.pelanggan.id_pengguna, nama=p.pelanggan.nama, email=p.pelanggan.email, no_hp=p.pelanggan.no_hp)


def _terlambat(p: Pesanan, pengaturan: PengaturanTerkini) -> bool:
    foto = foto_konfirmasi.foto_terbaru(p)
    if p.status != S.menunggu_persetujuan_foto or foto is None:
        return False
    return sekarang_utc() - foto.diunggah_pada > timedelta(hours=pengaturan.batas_tanggapan_foto_jam)


def _perlu_admin(p: Pesanan) -> bool:
    return p.status in alur_pesanan.STATUS_TINDAKAN_ADMIN or p.perlu_pengembalian_dana


def admin_ringkas_out(p: Pesanan, pengaturan: PengaturanTerkini) -> PesananAdminRingkasOut:
    return PesananAdminRingkasOut(
        **ringkas_out(p).model_dump(),
        pemesan=_pemesan(p),
        nama_penerima=p.nama_penerima,
        perlu_tindakan_admin=_perlu_admin(p),
        perlu_pengembalian_dana=p.perlu_pengembalian_dana,
        terlambat_ditanggapi=_terlambat(p, pengaturan),
    )


def admin_out(p: Pesanan, pengaturan: PengaturanTerkini) -> PesananAdminOut:
    return PesananAdminOut(
        **pesanan_out(p, pengaturan).model_dump(),
        pemesan=_pemesan(p),
        perlu_tindakan_admin=_perlu_admin(p),
        perlu_pengembalian_dana=p.perlu_pengembalian_dana,
        revisi_berbayar=p.jumlah_revisi > pengaturan.jumlah_revisi_gratis,
        terlambat_ditanggapi=_terlambat(p, pengaturan),
    )


def komplain_out(k: Komplain) -> KomplainOut:
    return KomplainOut(
        id_komplain=k.id_komplain,
        id_pesanan=k.id_pesanan,
        kode_pesanan=k.pesanan.kode_pesanan,
        isi=k.isi,
        foto_url=tautan_berkas(k.foto_komplain),
        status=k.status,
        tanggapan_admin=k.tanggapan_admin,
        dibuat_pada=k.dibuat_pada,
        ditanggapi_pada=k.ditanggapi_pada,
    )


def komplain_admin_out(k: Komplain) -> KomplainAdminOut:
    return KomplainAdminOut(**komplain_out(k).model_dump(), pemesan=_pemesan(k.pesanan))
