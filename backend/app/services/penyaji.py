"""Penyaji: mengubah objek ORM menjadi skema respons, termasuk kalimat deskripsi otomatis dan tautan berkas.

Dipisahkan dari router agar bentuk respons konsisten di semua tempat yang menampilkannya.
"""
from app.ai.deskripsi import deskripsi_bunga, narasi_rangkaian
from app.config import ambil_pengaturan
from app.core.tautan import tautan_berkas
from app.models.katalog import Produk
from app.models.stok import RiwayatPindai, Stok
from app.schemas.katalog import KomposisiProdukOut, MaknaWarnaOut, ProdukOut
from app.schemas.referensi import JenisRingkas, WarnaOut, WarnaRingkas
from app.schemas.stok import HasilPindaiOut, OpsiRangkaiOut, RiwayatPindaiOut, StokOut
from app.services.pindai import HasilPindai


def deskripsi_stok(stok: Stok) -> str:
    return deskripsi_bunga(stok.jenis_bunga.nama_bunga, stok.warna.nama_warna, stok.jenis_bunga.bentuk_bunga)


def stok_ke_out(stok: Stok, jumlah_masuk: int, ambang_menipis: int) -> StokOut:
    return StokOut(
        id_stok=stok.id_stok,
        jenis=JenisRingkas.model_validate(stok.jenis_bunga),
        warna=WarnaOut.model_validate(stok.warna),
        deskripsi=deskripsi_stok(stok),
        jumlah_masuk=jumlah_masuk,
        jumlah_ditahan=stok.jumlah_ditahan,
        jumlah_tersedia=stok.jumlah_tersedia,
        harga_per_tangkai=stok.harga_per_tangkai,
        tanggal_masuk=stok.tanggal_masuk,
        menipis=stok.jumlah_tersedia <= ambang_menipis,
    )


def stok_ke_opsi_rangkai(stok: Stok) -> OpsiRangkaiOut:
    return OpsiRangkaiOut(
        id_stok=stok.id_stok,
        jenis=JenisRingkas.model_validate(stok.jenis_bunga),
        warna=WarnaOut.model_validate(stok.warna),
        deskripsi=deskripsi_stok(stok),
        harga_per_tangkai=stok.harga_per_tangkai,
        sisa=stok.jumlah_tersedia,
    )


def produk_ke_out(produk: Produk, peta_stok: dict[tuple[int, int], Stok]) -> ProdukOut:
    baris: list[KomposisiProdukOut] = []
    for k in produk.komposisi:
        stok = peta_stok.get((k.id_jenis_bunga, k.id_warna))
        baris.append(
            KomposisiProdukOut(
                id_jenis_bunga=k.id_jenis_bunga,
                jenis=JenisRingkas.model_validate(k.jenis_bunga),
                warna=WarnaRingkas.model_validate(k.warna),
                jumlah_tangkai=k.jumlah_tangkai,
                deskripsi=deskripsi_bunga(k.jenis_bunga.nama_bunga, k.warna.nama_warna, k.jenis_bunga.bentuk_bunga),
                stok_cukup=bool(stok and stok.jumlah_tersedia >= k.jumlah_tangkai),
            )
        )
    makna = {
        k.warna.id_warna: MaknaWarnaOut(nama_warna=k.warna.nama_warna, kode_hex=k.warna.kode_hex, makna=k.warna.makna_warna)
        for k in produk.komposisi
    }
    return ProdukOut(
        id_produk=produk.id_produk,
        nama_produk=produk.nama_produk,
        acara=produk.acara,
        harga=produk.harga,
        foto_url=tautan_berkas(produk.foto_produk),
        deskripsi=produk.deskripsi,
        ditampilkan=produk.ditampilkan,
        komposisi=baris,
        total_tangkai=sum(b.jumlah_tangkai for b in baris),
        dapat_dipesan=bool(baris) and all(b.stok_cukup for b in baris),
        narasi=narasi_rangkaian(
            produk.nama_produk, ((b.jumlah_tangkai, b.jenis.nama_bunga, b.warna.nama_warna) for b in baris)
        ),
        makna_warna=list(makna.values()),
    )


def hasil_pindai_ke_out(hasil: HasilPindai) -> HasilPindaiOut:
    return HasilPindaiOut(
        id_pindai=hasil.riwayat.id_pindai,
        dikenali=hasil.dikenali,
        jenis=JenisRingkas.model_validate(hasil.jenis) if hasil.jenis else None,
        warna=WarnaRingkas.model_validate(hasil.warna),
        tingkat_keyakinan=hasil.keyakinan,
        jarak_warna=round(hasil.jarak_warna, 2),
        deskripsi=hasil.deskripsi,
        peringatan=hasil.peringatan,
        tiruan=ambil_pengaturan().ai_mode == "tiruan",
    )


def riwayat_pindai_ke_out(riwayat: RiwayatPindai) -> RiwayatPindaiOut:
    keluaran = RiwayatPindaiOut.model_validate(riwayat)
    keluaran.konteks = riwayat.konteks.value
    keluaran.foto_url = tautan_berkas(riwayat.foto_pindai)
    return keluaran
