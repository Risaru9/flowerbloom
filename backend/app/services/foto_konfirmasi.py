"""Foto hasil rangkaian dan persetujuan pelanggan (F-AD-09, F-PL-13, F-PL-14).

Ini titik konfirmasi warna bagi pelanggan buta warna: mereka membaca NAMA warna yang terbaca dari foto dan
daftar bunga pengganti, lalu menyetujui atau meminta revisi. Foto berlabel disimpan sebagai bukti (AB-05).
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.warna import label_warna_rangkaian
from app.core.errors import Konflik, TidakDitemukan
from app.core.penyimpanan import ambil_penyimpanan, buka_gambar
from app.core.waktu import sekarang_utc
from app.models.bunga import Warna
from app.models.enums import CaraSerahTerima, StatusPersetujuan
from app.models.pengguna import Pengguna
from app.models.pesanan import FotoKonfirmasi, Pesanan
from app.schemas.pesanan import TanggapanFotoIn
from app.services import alur_pesanan, merangkai, pengaturan_toko, referensi
from app.services.alur_pesanan import S

MAKS_LABEL = 4


def ringkasan_pengganti(pesanan: Pesanan) -> list[dict]:
    """Daftar bunga pengganti pada pesanan, dalam bentuk kalimat siap tampil."""
    semua = {k.id_komposisi_pesanan: k for d in pesanan.detail for k in d.komposisi}
    hasil = []
    for k in semua.values():
        if not k.is_pengganti:
            continue
        asal = semua.get(k.id_komposisi_diganti)
        hasil.append(
            {
                "dari": f"{asal.stok.jenis_bunga.nama_bunga} {asal.stok.warna.nama_warna.lower()}" if asal else "(tidak diketahui)",
                "menjadi": f"{k.stok.jenis_bunga.nama_bunga} {k.stok.warna.nama_warna.lower()}",
                "jumlah": k.jumlah_tangkai,
                "alasan": k.alasan_pengganti,
                "warna_berbeda": bool(asal and asal.stok.id_warna != k.stok.id_warna),
            }
        )
    return hasil


def unggah_foto_hasil(db: Session, *, id_pesanan: int, admin: Pengguna, data: bytes) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if pesanan.status != S.sedang_dirangkai:
        raise Konflik("Foto hasil hanya dapat diunggah saat pesanan 'Sedang dirangkai'.", kode="tidak_sedang_dirangkai")
    if not merangkai.siap_foto(pesanan):
        sisa = [
            {"id_komposisi_pesanan": k.id_komposisi_pesanan, "bunga": f"{k.stok.jenis_bunga.nama_bunga} {k.stok.warna.nama_warna.lower()}",
             "kurang": k.jumlah_tangkai - k.jumlah_terpindai}
            for k in merangkai.baris_aktif(pesanan)
            if k.jumlah_terpindai < k.jumlah_tangkai
        ]
        raise Konflik("Masih ada bunga yang belum dicocokkan.", kode="belum_semua_cocok", rincian=sisa)

    gambar = buka_gambar(data)
    label = label_warna_rangkaian(gambar, referensi.katalog_warna_rgb(db), maksimal=MAKS_LABEL)
    nama_warna = {
        w.id_warna: w for w in db.scalars(select(Warna).where(Warna.id_warna.in_([x.id_warna for x in label])))
    }
    label_json = [
        {
            "id_warna": x.id_warna,
            "nama_warna": nama_warna[x.id_warna].nama_warna,
            "kode_hex": nama_warna[x.id_warna].kode_hex,
            "persen": round(x.proporsi * 100),
        }
        for x in label
    ]
    file_foto = ambil_penyimpanan().simpan_gambar(gambar, area="privat", kategori="foto-hasil")
    pesanan.foto.append(
        FotoKonfirmasi(file_foto=file_foto, label_warna=label_json, ringkasan_pengganti=ringkasan_pengganti(pesanan))
    )
    alur_pesanan.pindah_status(db, pesanan, S.menunggu_persetujuan_foto, oleh=admin, catatan="Foto hasil diunggah")
    return pesanan


def foto_terbaru(pesanan: Pesanan) -> FotoKonfirmasi | None:
    return pesanan.foto[-1] if pesanan.foto else None


def pengganti_wajib_disetujui(db: Session, ringkasan: list[dict]) -> bool:
    """AB-07 menurut kebijakan toko (F-AD-16)."""
    if not ringkasan:
        return False
    if pengaturan_toko.ambil(db).kebijakan_pengganti == "semua_pengganti":
        return True
    return any(p["warna_berbeda"] for p in ringkasan)


def tanggapi_foto(db: Session, *, id_pesanan: int, pelanggan: Pengguna, data: TanggapanFotoIn) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if pesanan.id_pengguna != pelanggan.id_pengguna:
        raise TidakDitemukan("Pesanan tidak ditemukan.")
    foto = foto_terbaru(pesanan)
    if pesanan.status != S.menunggu_persetujuan_foto or foto is None or foto.status_persetujuan != StatusPersetujuan.menunggu:
        raise Konflik("Tidak ada foto yang sedang menunggu tanggapan Anda.", kode="tidak_menunggu_persetujuan")

    if data.keputusan == "setuju":
        ringkasan = foto.ringkasan_pengganti or []
        if pengganti_wajib_disetujui(db, ringkasan) and not data.setuju_pengganti:
            raise Konflik(
                "Ada bunga pengganti. Baca keterangannya lalu konfirmasi persetujuan Anda.",
                kode="perlu_konfirmasi_pengganti",
                rincian=ringkasan,
            )
        foto.status_persetujuan = StatusPersetujuan.disetujui
        foto.ditanggapi_pada = sekarang_utc()
        tujuan = S.diantar if pesanan.cara_serah_terima == CaraSerahTerima.antar else S.siap_diambil
        alur_pesanan.pindah_status(db, pesanan, tujuan, oleh=pelanggan, catatan="Foto hasil disetujui pelanggan")
    else:
        catatan = (data.catatan_revisi or "").strip()
        if len(catatan) < 3:
            raise Konflik("Tuliskan catatan revisi agar admin tahu yang perlu diperbaiki.", kode="catatan_revisi_wajib")
        foto.status_persetujuan = StatusPersetujuan.revisi
        foto.catatan_revisi = catatan
        foto.ditanggapi_pada = sekarang_utc()
        pesanan.jumlah_revisi += 1
        alur_pesanan.pindah_status(db, pesanan, S.sedang_dirangkai, oleh=pelanggan, catatan=f"Minta revisi: {catatan}")
    return pesanan
