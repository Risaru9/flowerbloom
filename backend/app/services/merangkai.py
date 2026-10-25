"""Mode Merangkai (F-AD-07) dan pencatatan bunga pengganti (F-AD-08).

Setiap bunga yang diambil dipindai lalu dicocokkan dengan baris ``komposisi_pesanan`` yang belum penuh:
* jenis harus sama persis. Sumbernya, berurutan: pilihan admin -> tebakan klasifikator (bila aktif dan yakin) ->
  warna saja, asalkan warna itu hanya cocok dengan SATU jenis di sisa pesanan (bila lebih, admin diminta memilih).
  Membedakan jenis mudah bagi manusia, termasuk penyandang buta warna; yang sulit adalah warnanya;
* warna SELALU dicocokkan otomatis dengan TOLERANSI memakai warna terukur (bukan nama terdekat), karena hasil
  k-means yang dibulatkan ke nama bisa meleset satu nama dari yang tercatat di stok. Ambangnya ``AMBANG_KECOCOKAN_WARNA``;
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
    id_komposisi_kandidat: list[int]


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


def pindai_bunga(
    db: Session,
    *,
    id_pesanan: int,
    admin: Pengguna,
    data: bytes,
    jumlah: int = 1,
    id_jenis_bunga: int | None = None,
) -> HasilMerangkai:
    pesanan = _kunci_dirangkai(db, id_pesanan)
    dipilih = None
    if id_jenis_bunga is not None:
        dipilih = db.get(JenisBunga, id_jenis_bunga)
        if dipilih is None:
            raise TidakDitemukan("Jenis bunga tidak ditemukan.")
    hasil = pindai.analisis_bunga(db, data=data, admin=admin, konteks=KonteksPindai.mode_rangkai, id_pesanan=id_pesanan)
    jenis = dipilih or (hasil.jenis if hasil.dikenali else None)

    def keluaran(
        cocok: bool, alasan: str | None, id_baris: int | None = None, kandidat_warna: list[KomposisiPesanan] | None = None
    ) -> HasilMerangkai:
        id_kandidat = [k.id_komposisi_pesanan for k in kandidat_warna or []]
        return HasilMerangkai(pesanan, hasil.dikenali, cocok, alasan, jenis, hasil.warna, id_baris, id_kandidat)

    kandidat = [k for k in baris_aktif(pesanan) if k.jumlah_terpindai < k.jumlah_tangkai]
    if not kandidat:
        return keluaran(False, "Semua bunga pada pesanan ini sudah cocok.")

    # Hitung jarak sekali; tangkai dibagikan ke baris terdekat dulu, lalu ke baris sejenis lain yang warnanya masih cocok.
    ambang = ambil_pengaturan().ambang_kecocokan_warna
    berjarak = sorted(((jarak_warna(hasil.rgb_terbaca, hex_ke_rgb(k.stok.warna.kode_hex)), k) for k in kandidat), key=lambda x: x[0])
    sisa_dicari = ", ".join(sorted({_nama(k) for k in kandidat}))

    if jenis is None:
        # Tanpa jenis dari admin maupun klasifikator: tentukan dari warna, asalkan hanya satu jenis yang warnanya cocok.
        cocok_warna = [k for j, k in berjarak if j <= ambang]
        if not cocok_warna:
            return keluaran(
                False, f"Warna terbaca '{hasil.warna.nama_warna}' tidak cocok dengan sisa pesanan. Sisa yang dicari: {sisa_dicari}."
            )
        if len({k.stok.id_jenis_bunga for k in cocok_warna}) > 1:
            pilihan = ", ".join(sorted({_nama(k) for k in cocok_warna}))
            return keluaran(
                False,
                f"Warna '{hasil.warna.nama_warna}' cocok untuk lebih dari satu bunga: {pilihan}. Pilih jenis bunganya lalu pindai lagi.",
                kandidat_warna=cocok_warna,
            )
        jenis = cocok_warna[0].stok.jenis_bunga

    berjarak = [(j, k) for j, k in berjarak if k.stok.id_jenis_bunga == jenis.id_jenis_bunga]
    if not berjarak:
        return keluaran(False, f"{jenis.nama_bunga} tidak ada dalam sisa pesanan. Sisa yang dicari: {sisa_dicari}.")
    jarak, terdekat = berjarak[0]
    if jarak > ambang:
        return keluaran(
            False,
            f"Warna terbaca '{hasil.warna.nama_warna}' berbeda dengan pesanan '{terdekat.stok.warna.nama_warna}'. "
            "Ambil bunga lain, catat sebagai pengganti, atau 'Tandai cocok' bila warnanya sebenarnya sesuai.",
            terdekat.id_komposisi_pesanan,
        )

    sisa = jumlah
    for j, k in berjarak:
        if j > ambang or not sisa:
            break
        tambah = min(sisa, k.jumlah_tangkai - k.jumlah_terpindai)
        k.jumlah_terpindai += tambah
        sisa -= tambah
    db.flush()
    alasan = f"{sisa} tangkai melebihi kebutuhan pesanan dan tidak dihitung." if sisa else None
    return keluaran(True, alasan, terdekat.id_komposisi_pesanan)


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
