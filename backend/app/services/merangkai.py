"""Mode Merangkai (F-AD-07) dan pencatatan bunga pengganti (F-AD-08).

Setiap bunga yang diambil dipindai lalu dicocokkan dengan baris ``komposisi_pesanan`` yang belum penuh:
* jenis harus sama persis;
* warna dicocokkan dengan TOLERANSI memakai warna terukur (bukan nama terdekat), karena hasil k-means yang
  dibulatkan ke nama bisa meleset satu nama dari yang tercatat di stok. Ambangnya ``AMBANG_KECOCOKAN_WARNA``;
* bila pemindaian gagal/meleset, admin dapat "Tandai cocok" manual per baris.

Foto hasil baru boleh diunggah setelah semua baris cocok (lihat ``siap_foto``).
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.warna import hex_ke_rgb, jarak_warna
from app.config import ambil_pengaturan
from app.core.errors import Konflik, TidakDitemukan
from app.models.bunga import JenisBunga, Warna
from app.models.enums import KonteksPindai
from app.models.pengguna import Pengguna
from app.models.pesanan import KomposisiPesanan, Pesanan
from app.services import alur_pesanan, pindai
from app.services import stok as layanan_stok
from app.services.alur_pesanan import S


@dataclass
class HasilMerangkai:
    pesanan: Pesanan
    dikenali: bool
    cocok: bool
    alasan: str | None
    jenis: JenisBunga | None
    warna: Warna | None
    id_komposisi_cocok: int | None


def baris_aktif(pesanan: Pesanan) -> list[KomposisiPesanan]:
    return [k for d in pesanan.detail for k in d.komposisi if k.jumlah_tangkai > 0]


def progres(pesanan: Pesanan) -> tuple[int, int, bool]:
    """(tangkai terpindai, tangkai target, siap difoto)."""
    aktif = baris_aktif(pesanan)
    target = sum(k.jumlah_tangkai for k in aktif)
    terpindai = sum(min(k.jumlah_terpindai, k.jumlah_tangkai) for k in aktif)
    return terpindai, target, terpindai >= target


def siap_foto(pesanan: Pesanan) -> bool:
    return progres(pesanan)[2]


def _kunci_dirangkai(db: Session, id_pesanan: int) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if pesanan.status != S.sedang_dirangkai:
        raise Konflik(
            "Mode merangkai hanya untuk pesanan berstatus 'Sedang dirangkai'.", kode="tidak_sedang_dirangkai"
        )
    return pesanan


def _nama(k: KomposisiPesanan) -> str:
    return f"{k.stok.jenis_bunga.nama_bunga} {k.stok.warna.nama_warna.lower()}"


def pindai_bunga(db: Session, *, id_pesanan: int, admin: Pengguna, data: bytes, jumlah: int = 1) -> HasilMerangkai:
    pesanan = _kunci_dirangkai(db, id_pesanan)
    hasil = pindai.analisis_bunga(db, data=data, admin=admin, konteks=KonteksPindai.mode_rangkai, id_pesanan=id_pesanan)

    def keluaran(cocok: bool, alasan: str | None, id_baris: int | None = None) -> HasilMerangkai:
        return HasilMerangkai(pesanan, hasil.dikenali, cocok, alasan, hasil.jenis, hasil.warna, id_baris)

    kandidat = [k for k in baris_aktif(pesanan) if k.jumlah_terpindai < k.jumlah_tangkai]
    if not kandidat:
        return keluaran(False, "Semua bunga pada pesanan ini sudah cocok.")
    if not hasil.dikenali or hasil.jenis is None:
        return keluaran(False, "Bunga tidak dikenali. Gunakan 'Tandai cocok' bila Anda yakin bunganya sesuai.")

    sejenis = [k for k in kandidat if k.stok.id_jenis_bunga == hasil.jenis.id_jenis_bunga]
    if not sejenis:
        sisa = ", ".join(sorted({_nama(k) for k in kandidat}))
        return keluaran(False, f"{hasil.jenis.nama_bunga} tidak ada dalam sisa pesanan. Sisa yang dicari: {sisa}.")

    terbaca = hasil.rgb_terbaca
    terdekat = min(sejenis, key=lambda k: jarak_warna(terbaca, hex_ke_rgb(k.stok.warna.kode_hex)))
    jarak = jarak_warna(terbaca, hex_ke_rgb(terdekat.stok.warna.kode_hex))
    if jarak > ambil_pengaturan().ambang_kecocokan_warna:
        return keluaran(
            False,
            f"Warna terbaca '{hasil.warna.nama_warna}' berbeda dengan pesanan '{terdekat.stok.warna.nama_warna}'. "
            "Ambil bunga lain, catat sebagai pengganti, atau 'Tandai cocok' bila warnanya sebenarnya sesuai.",
            terdekat.id_komposisi_pesanan,
        )

    terdekat.jumlah_terpindai += min(jumlah, terdekat.jumlah_tangkai - terdekat.jumlah_terpindai)
    db.flush()
    return keluaran(True, None, terdekat.id_komposisi_pesanan)


def _ambil_baris(pesanan: Pesanan, id_komposisi: int) -> KomposisiPesanan:
    baris = next((k for d in pesanan.detail for k in d.komposisi if k.id_komposisi_pesanan == id_komposisi), None)
    if baris is None:
        raise TidakDitemukan("Baris komposisi tidak ditemukan pada pesanan ini.")
    return baris


def tandai_cocok(db: Session, *, id_pesanan: int, id_komposisi_pesanan: int, jumlah: int = 1) -> Pesanan:
    pesanan = _kunci_dirangkai(db, id_pesanan)
    baris = _ambil_baris(pesanan, id_komposisi_pesanan)
    baris.jumlah_terpindai = min(baris.jumlah_tangkai, baris.jumlah_terpindai + jumlah)
    baris.ditandai_manual = True
    db.flush()
    return pesanan


def catat_pengganti(
    db: Session,
    *,
    id_pesanan: int,
    admin: Pengguna,
    id_komposisi_asal: int,
    id_stok_pengganti: int,
    jumlah: int,
    alasan: str,
) -> Pesanan:
    """Mengganti sebagian/seluruh tangkai suatu baris dengan bunga lain dari rak.

    * Tangkai pengganti diambil dari ``jumlah_tersedia`` (tahanan bunga asal sudah terpakai saat pembayaran sah).
    * Stok bunga asal TIDAK dikembalikan otomatis (bunga habis/rusak); koreksi stok manual bila perlu.
    * Total harga pesanan tidak berubah.
    * Baris pengganti dianggap sudah cocok: admin memilihnya secara sadar.
    * Pelanggan wajib mengetahuinya lewat foto konfirmasi (AB-07); lihat services/foto_konfirmasi.py.
    """
    pesanan = _kunci_dirangkai(db, id_pesanan)
    asal = _ambil_baris(pesanan, id_komposisi_asal)
    if jumlah > asal.jumlah_tangkai:
        raise Konflik(f"Baris asal hanya berisi {asal.jumlah_tangkai} tangkai.", kode="jumlah_melebihi_baris")
    if asal.id_stok == id_stok_pengganti:
        raise Konflik("Bunga pengganti harus berbeda dari bunga asal.", kode="pengganti_sama_dengan_asal")
    stok_pengganti = layanan_stok.ambil_stok(db, id_stok_pengganti)

    layanan_stok.pakai_dari_tersedia(
        db, id_stok_pengganti, jumlah, id_pesanan=id_pesanan, oleh=admin, catatan=f"Pengganti: {alasan.strip()}"
    )
    asal.jumlah_tangkai -= jumlah
    asal.jumlah_terpindai = min(asal.jumlah_terpindai, asal.jumlah_tangkai)
    asal.detail.komposisi.append(
        KomposisiPesanan(
            id_stok=stok_pengganti.id_stok,
            jumlah_tangkai=jumlah,
            jumlah_terpindai=jumlah,
            is_pengganti=True,
            alasan_pengganti=alasan.strip(),
            ditandai_manual=True,
            id_komposisi_diganti=asal.id_komposisi_pesanan,
        )
    )
    db.flush()
    return pesanan
