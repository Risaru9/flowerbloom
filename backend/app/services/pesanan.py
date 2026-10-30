"""Pesanan sisi pelanggan: hitung, checkout, bayar, batal, dan penjadwal kedaluwarsa.

Aturan bisnis yang ditegakkan di sini: AB-01 (bayar penuh di muka), AB-02 (stok ditahan, batal bila lewat batas),
AB-03 (transfer + bukti), AB-04 (paling lambat H-1), AB-08 (batal hanya sebelum dirangkai).
"""
import hashlib
import secrets
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BatasBayarLewat, DataTidakValid, Konflik, StokTidakCukup, TidakDitemukan
from app.core.penyimpanan import ambil_penyimpanan, buka_gambar
from app.core.waktu import hari_ini_wib, sekarang_utc
from app.models.enums import CaraSerahTerima, JenisItem, StatusPesanan, StatusVerifikasi
from app.models.katalog import Produk
from app.models.pengguna import Pengguna
from app.models.pesanan import DetailPesanan, KomposisiPesanan, Pembayaran, Pesanan
from app.models.stok import Stok
from app.schemas.pesanan import CheckoutIn, ItemPaketIn, ItemRangkaiSendiriIn, PratinjauIn
from app.services import alur_pesanan, katalog, pengaturan_toko
from app.services import stok as layanan_stok
from app.services.alur_pesanan import S

HARI_MAKS_KE_DEPAN = 90
ABJAD_KODE = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # tanpa 0/O/1/I agar mudah dibaca/dieja


# --- Perhitungan ----------------------------------------------------------------------------------------------


@dataclass
class ItemHitung:
    jenis_item: JenisItem
    nama: str
    id_produk: int | None
    jumlah: int
    subtotal: Decimal
    baris: list[tuple[int, int]]  # (id_stok, jumlah_tangkai) untuk seluruh item ini

    @property
    def jumlah_tangkai(self) -> int:
        return sum(j for _, j in self.baris)


@dataclass
class Perhitungan:
    items: list[ItemHitung]
    subtotal: Decimal
    ongkos_antar: Decimal
    total: Decimal
    masalah: list[dict] = field(default_factory=list)

    def kebutuhan(self) -> dict[int, int]:
        return layanan_stok.gabung_kebutuhan(b for item in self.items for b in item.baris)


def _nama_stok(stok: Stok) -> str:
    return f"{stok.jenis_bunga.nama_bunga} {stok.warna.nama_warna.lower()}"


def hitung(db: Session, data: PratinjauIn) -> Perhitungan:
    """Menghitung harga di server (harga dari klien tidak pernah dipercaya) dan memeriksa ketersediaan."""
    pengaturan = pengaturan_toko.ambil(db)
    peta = katalog.peta_stok(db)
    items: list[ItemHitung] = []
    masalah: list[dict] = []

    for masukan in data.items:
        if isinstance(masukan, ItemPaketIn):
            produk = katalog.ambil_produk(db, masukan.id_produk)
            baris: list[tuple[int, int]] = []
            for k in produk.komposisi:
                diminta = k.jumlah_tangkai * masukan.jumlah
                stok = peta.get((k.id_jenis_bunga, k.id_warna))
                if stok is None:
                    masalah.append(
                        {"id_stok": None, "bunga": f"{k.jenis_bunga.nama_bunga} {k.warna.nama_warna.lower()}", "diminta": diminta, "tersedia": 0}
                    )
                else:
                    baris.append((stok.id_stok, diminta))
            items.append(
                ItemHitung(JenisItem.paket, produk.nama_produk, produk.id_produk, masukan.jumlah, produk.harga * masukan.jumlah, baris)
            )
        elif isinstance(masukan, ItemRangkaiSendiriIn):
            gabungan = layanan_stok.gabung_kebutuhan((b.id_stok, b.jumlah_tangkai) for b in masukan.bunga)
            total_tangkai = sum(gabungan.values())
            if total_tangkai < pengaturan.minimal_tangkai_rangkai_sendiri:
                raise DataTidakValid(
                    f"Rangkaian buatan sendiri minimal {pengaturan.minimal_tangkai_rangkai_sendiri} tangkai.",
                    kode="tangkai_kurang",
                )
            harga_bunga = Decimal(0)
            for id_stok, jumlah in gabungan.items():
                stok = layanan_stok.ambil_stok(db, id_stok)
                harga_bunga += stok.harga_per_tangkai * jumlah
            subtotal = harga_bunga + Decimal(pengaturan.jasa_merangkai)
            items.append(
                ItemHitung(
                    JenisItem.rangkai_sendiri, f"Rangkaian sendiri ({total_tangkai} tangkai)", None, 1, subtotal, list(gabungan.items())
                )
            )

    ongkos = Decimal(pengaturan.ongkos_antar) if data.cara_serah_terima == CaraSerahTerima.antar else Decimal(0)
    perhitungan = Perhitungan(items, sum((i.subtotal for i in items), Decimal(0)), ongkos, Decimal(0), masalah)
    perhitungan.total = perhitungan.subtotal + ongkos

    for id_stok, diminta in perhitungan.kebutuhan().items():
        stok = layanan_stok.ambil_stok(db, id_stok)
        if stok.jumlah_tersedia < diminta:
            masalah.append({"id_stok": id_stok, "bunga": _nama_stok(stok), "diminta": diminta, "tersedia": stok.jumlah_tersedia})
    return perhitungan


# --- Checkout -------------------------------------------------------------------------------------------------


def _kode_baru(db: Session) -> str:
    for _ in range(10):
        kode = f"FB-{sekarang_utc().strftime('%y%m%d')}-{''.join(secrets.choice(ABJAD_KODE) for _ in range(4))}"
        if not db.scalar(select(Pesanan.id_pesanan).where(Pesanan.kode_pesanan == kode)):
            return kode
    raise RuntimeError("Gagal membuat kode pesanan unik.")  # pragma: no cover


def checkout(db: Session, pelanggan: Pengguna, data: CheckoutIn, *, kunci: str | None = None) -> Pesanan:
    sidik = hashlib.sha256(data.model_dump_json().encode()).hexdigest()
    if kunci is not None:
        # Serialisasi retry pelanggan sebelum membuat pesanan/menahan stok.
        db.execute(select(Pengguna).where(Pengguna.id_pengguna == pelanggan.id_pengguna).with_for_update())
        lama = db.scalar(select(Pesanan).where(Pesanan.id_pengguna == pelanggan.id_pengguna,
                                             Pesanan.kunci_checkout == kunci).with_for_update())
        if lama:
            if lama.sidik_checkout != sidik:
                raise Konflik("Kunci checkout sudah digunakan untuk pesanan berbeda.", kode="kunci_checkout_berbeda")
            return lama
    pengaturan = pengaturan_toko.ambil(db)

    if data.slot_jam not in pengaturan.slot_pengiriman:
        raise DataTidakValid("Slot jam tidak tersedia.", kode="slot_tidak_valid", rincian=pengaturan.slot_pengiriman)
    paling_awal = hari_ini_wib() + timedelta(days=pengaturan.minimal_hari_pemesanan)  # AB-04
    if data.tanggal_kirim < paling_awal:
        raise DataTidakValid(
            f"Pesanan paling lambat {pengaturan.minimal_hari_pemesanan} hari sebelum tanggal serah terima.",
            kode="tanggal_terlalu_dekat",
            rincian={"tanggal_paling_awal": paling_awal.isoformat()},
        )
    if data.tanggal_kirim > hari_ini_wib() + timedelta(days=HARI_MAKS_KE_DEPAN):
        raise DataTidakValid(f"Tanggal serah terima maksimal {HARI_MAKS_KE_DEPAN} hari ke depan.", kode="tanggal_terlalu_jauh")

    perhitungan = hitung(db, data)
    if perhitungan.masalah:
        raise StokTidakCukup("Stok sebagian bunga tidak mencukupi.", rincian=perhitungan.masalah)

    pesanan = Pesanan(
        id_pengguna=pelanggan.id_pengguna,
        kode_pesanan=_kode_baru(db),
        kunci_checkout=kunci,
        sidik_checkout=sidik if kunci else None,
        nama_penerima=data.nama_penerima,
        alamat=data.alamat.strip() if data.alamat else None,
        tanggal_kirim=data.tanggal_kirim,
        slot_jam=data.slot_jam,
        cara_serah_terima=data.cara_serah_terima,
        kartu_ucapan=data.kartu_ucapan.strip() if data.kartu_ucapan else None,
        ongkos_antar=perhitungan.ongkos_antar,
        total_harga=perhitungan.total,
        status=S.menunggu_pembayaran,
        batas_bayar=sekarang_utc() + timedelta(minutes=pengaturan.batas_bayar_menit),
    )
    db.add(pesanan)
    db.flush()
    alur_pesanan.catat_status_awal(db, pesanan, pelanggan)
    # URUTAN PENTING (terbukti lewat deadlock 1213 di MySQL): kunci exclusive pada baris stok harus diambil lewat
    # UPDATE lebih dulu. Bila baris yang mereferensikan stok (komposisi_pesanan) disisipkan duluan, InnoDB mengambil
    # kunci shared untuk cek foreign key, dan dua transaksi yang sama-sama menaikkannya ke exclusive saling menunggu.
    # Menahan stok memakai UPDATE bersyarat; bila ada yang kalah berebut, permintaan gagal dan semuanya dibatalkan.
    layanan_stok.tahan(db, perhitungan.kebutuhan(), id_pesanan=pesanan.id_pesanan)
    for item in perhitungan.items:
        db.add(
            DetailPesanan(
                id_pesanan=pesanan.id_pesanan,
                id_produk=item.id_produk,
                jenis_item=item.jenis_item,
                jumlah=item.jumlah,
                subtotal=item.subtotal,
                komposisi=[KomposisiPesanan(id_stok=id_stok, jumlah_tangkai=jumlah) for id_stok, jumlah in item.baris],
            )
        )
    db.flush()
    return pesanan


# --- Akses ----------------------------------------------------------------------------------------------------


def _kueri_lengkap():
    return select(Pesanan).options(
        selectinload(Pesanan.detail).selectinload(DetailPesanan.produk),
        selectinload(Pesanan.detail)
        .selectinload(DetailPesanan.komposisi)
        .selectinload(KomposisiPesanan.stok)
        .selectinload(Stok.jenis_bunga),
        selectinload(Pesanan.detail)
        .selectinload(DetailPesanan.komposisi)
        .selectinload(KomposisiPesanan.stok)
        .selectinload(Stok.warna),
        selectinload(Pesanan.pembayaran),
        selectinload(Pesanan.foto),
        selectinload(Pesanan.riwayat_status),
        selectinload(Pesanan.pelanggan),
    )


def ambil_pesanan(db: Session, id_pesanan: int, *, pelanggan: Pengguna | None = None) -> Pesanan:
    """Pesanan lengkap. Bila ``pelanggan`` diberikan, hanya pemiliknya yang boleh; selain itu 404 (bukan 403)
    supaya keberadaan pesanan orang lain tidak bocor."""
    pesanan = db.scalar(_kueri_lengkap().where(Pesanan.id_pesanan == id_pesanan).execution_options(populate_existing=True))
    if not pesanan or (pelanggan is not None and pesanan.id_pengguna != pelanggan.id_pengguna):
        raise TidakDitemukan("Pesanan tidak ditemukan.")
    return pesanan


def _kunci_milik(db: Session, id_pesanan: int, pelanggan: Pengguna) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if pesanan.id_pengguna != pelanggan.id_pengguna:
        raise TidakDitemukan("Pesanan tidak ditemukan.")
    return pesanan


def daftar_pesanan_admin(
    db: Session,
    *,
    status: StatusPesanan | None,
    cari: str | None,
    perlu_tindakan: bool,
    halaman: int,
    per_halaman: int,
) -> tuple[list[Pesanan], int]:
    """Daftar pesanan untuk admin dengan penyaring status dan pencarian kode/pemesan/penerima/rangkaian (F-AD-04)."""
    kueri = select(Pesanan).join(Pengguna, Pesanan.id_pengguna == Pengguna.id_pengguna)
    if status:
        kueri = kueri.where(Pesanan.status == status)
    if perlu_tindakan:
        kueri = kueri.where(
            or_(Pesanan.status.in_(alur_pesanan.STATUS_TINDAKAN_ADMIN), Pesanan.perlu_pengembalian_dana.is_(True))
        )
    if cari and cari.strip():
        pola = f"%{cari.strip()}%"
        kueri = kueri.where(
            or_(
                Pesanan.kode_pesanan.ilike(pola),
                Pengguna.nama.ilike(pola),
                Pesanan.nama_penerima.ilike(pola),
                exists(
                    select(1)
                    .select_from(DetailPesanan)
                    .join(Produk, DetailPesanan.id_produk == Produk.id_produk)
                    .where(DetailPesanan.id_pesanan == Pesanan.id_pesanan, Produk.nama_produk.ilike(pola))
                ),
            )
        )
    total = db.scalar(select(func.count()).select_from(kueri.subquery()))
    baris = db.scalars(
        kueri.options(
            selectinload(Pesanan.detail).selectinload(DetailPesanan.produk),
            selectinload(Pesanan.detail).selectinload(DetailPesanan.komposisi),
            selectinload(Pesanan.pelanggan),
            selectinload(Pesanan.foto),
        )
        .order_by(Pesanan.id_pesanan.desc())
        .limit(per_halaman)
        .offset((halaman - 1) * per_halaman)
    )
    return list(baris), int(total)


def daftar_pesanan_pelanggan(
    db: Session, pelanggan: Pengguna, *, status: StatusPesanan | None, halaman: int, per_halaman: int
) -> tuple[list[Pesanan], int]:
    kueri = select(Pesanan).where(Pesanan.id_pengguna == pelanggan.id_pengguna)
    if status:
        kueri = kueri.where(Pesanan.status == status)
    total = db.scalar(select(func.count()).select_from(kueri.subquery()))
    baris = db.scalars(
        kueri.options(
            selectinload(Pesanan.detail).selectinload(DetailPesanan.produk),
            selectinload(Pesanan.detail).selectinload(DetailPesanan.komposisi),
        )
        .order_by(Pesanan.id_pesanan.desc())
        .limit(per_halaman)
        .offset((halaman - 1) * per_halaman)
    )
    return list(baris), int(total)


# --- Pembayaran -----------------------------------------------------------------------------------------------


def _kebutuhan_pesanan(pesanan: Pesanan) -> dict[int, int]:
    return layanan_stok.gabung_kebutuhan(
        (k.id_stok, k.jumlah_tangkai) for d in pesanan.detail for k in d.komposisi if k.jumlah_tangkai > 0
    )


def _batalkan_di_dalam(db: Session, pesanan: Pesanan, *, oleh: Pengguna | None, alasan: str) -> None:
    """Membatalkan pesanan yang sudah terkunci: stok tahanan dilepas, status dan alasan dicatat."""
    layanan_stok.lepas(db, _kebutuhan_pesanan(pesanan), id_pesanan=pesanan.id_pesanan, oleh=oleh, catatan=alasan)
    if any(b.dana_diterima for b in pesanan.pembayaran):
        pesanan.perlu_pengembalian_dana = True
    if pesanan.status == S.menunggu_verifikasi:
        # pelanggan sudah sempat mengunggah bukti: tandai agar admin mengembalikan dananya secara manual
        pesanan.perlu_pengembalian_dana = True
        for bayar in pesanan.pembayaran:
            if bayar.status_verifikasi == StatusVerifikasi.menunggu:
                bayar.status_verifikasi = StatusVerifikasi.ditolak
                bayar.catatan_penolakan = "Pesanan dibatalkan."
                bayar.waktu_verifikasi = sekarang_utc()
    pesanan.alasan_batal = alasan
    alur_pesanan.pindah_status(db, pesanan, S.dibatalkan, oleh=oleh, catatan=alasan)


def unggah_bukti(
    db: Session, *, id_pesanan: int, pelanggan: Pengguna, data: bytes, nama_pengirim: str, nominal: Decimal
) -> Pesanan:
    pesanan = _kunci_milik(db, id_pesanan, pelanggan)
    if pesanan.status != S.menunggu_pembayaran:
        raise Konflik(
            f"Pesanan berstatus '{alur_pesanan.info(pesanan.status).label}', bukan menunggu pembayaran.",
            kode="tidak_menunggu_pembayaran",
        )
    if pesanan.batas_bayar and pesanan.batas_bayar < sekarang_utc():
        _batalkan_di_dalam(db, pesanan, oleh=None, alasan="Kedaluwarsa: melewati batas waktu bayar")
        raise BatasBayarLewat("Batas waktu pembayaran sudah lewat; pesanan dibatalkan dan stok dilepas.")
    if nominal <= 0:
        raise DataTidakValid("Nominal harus lebih dari nol.")

    bukti = ambil_penyimpanan().simpan_gambar(buka_gambar(data), area="privat", kategori="bukti")
    pesanan.pembayaran.append(
        Pembayaran(bukti_transfer=bukti, nama_pengirim=nama_pengirim.strip(), nominal=nominal)
    )
    alur_pesanan.pindah_status(db, pesanan, S.menunggu_verifikasi, oleh=pelanggan, catatan="Bukti transfer diunggah")
    return pesanan


def sahkan_pembayaran(db: Session, *, id_pesanan: int, id_pembayaran: int, admin: Pengguna) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    bayar = _pembayaran_menunggu(pesanan, id_pembayaran)
    bayar.status_verifikasi = StatusVerifikasi.sah
    bayar.dana_diterima = True
    bayar.id_admin = admin.id_pengguna
    bayar.waktu_verifikasi = sekarang_utc()
    # Tahanan menjadi terpakai; setelah ini pesanan tidak lagi bisa dibatalkan (AB-08).
    layanan_stok.pakai_tahanan(db, _kebutuhan_pesanan(pesanan), id_pesanan=pesanan.id_pesanan, oleh=admin)
    alur_pesanan.pindah_status(db, pesanan, S.sedang_dirangkai, oleh=admin, catatan="Pembayaran disahkan")
    return pesanan


def tolak_pembayaran(db: Session, *, id_pesanan: int, id_pembayaran: int, admin: Pengguna, catatan: str,
                    dana_diterima: bool = False) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    bayar = _pembayaran_menunggu(pesanan, id_pembayaran)
    bayar.status_verifikasi = StatusVerifikasi.ditolak
    bayar.id_admin = admin.id_pengguna
    bayar.waktu_verifikasi = sekarang_utc()
    bayar.catatan_penolakan = catatan.strip()
    bayar.dana_diterima = dana_diterima
    # Pelanggan diberi waktu bayar baru; stok tetap ditahan selama jendela itu.
    pesanan.batas_bayar = sekarang_utc() + timedelta(minutes=pengaturan_toko.ambil(db).batas_bayar_menit)
    alur_pesanan.pindah_status(db, pesanan, S.menunggu_pembayaran, oleh=admin, catatan=f"Bukti ditolak: {catatan.strip()}")
    return pesanan


def _pembayaran_menunggu(pesanan: Pesanan, id_pembayaran: int) -> Pembayaran:
    bayar = next((b for b in pesanan.pembayaran if b.id_pembayaran == id_pembayaran), None)
    if not bayar:
        raise TidakDitemukan("Pembayaran tidak ditemukan pada pesanan ini.")
    if pesanan.status != S.menunggu_verifikasi or bayar.status_verifikasi != StatusVerifikasi.menunggu:
        raise Konflik("Pembayaran ini tidak sedang menunggu verifikasi.", kode="tidak_menunggu_verifikasi")
    return bayar


# --- Batal, selesai, kedaluwarsa ------------------------------------------------------------------------------


def batalkan_oleh_pelanggan(db: Session, *, id_pesanan: int, pelanggan: Pengguna, alasan: str | None) -> Pesanan:
    pesanan = _kunci_milik(db, id_pesanan, pelanggan)
    if pesanan.status not in alur_pesanan.STATUS_BISA_DIBATALKAN:
        raise Konflik(
            "Pesanan yang sudah dibayar dan mulai dirangkai tidak dapat dibatalkan.", kode="tidak_bisa_dibatalkan"
        )
    _batalkan_di_dalam(db, pesanan, oleh=pelanggan, alasan=(alasan or "Dibatalkan oleh pelanggan").strip())
    return pesanan


def tandai_selesai(db: Session, *, id_pesanan: int, admin: Pengguna) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    alur_pesanan.pindah_status(db, pesanan, S.selesai, oleh=admin, catatan="Pesanan diterima")
    pesanan.diselesaikan_pada = sekarang_utc()
    return pesanan


def selesaikan_pengembalian_dana(db: Session, *, id_pesanan: int) -> Pesanan:
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if not pesanan.perlu_pengembalian_dana:
        raise Konflik("Pesanan ini tidak menunggu pengembalian dana.", kode="tidak_perlu_pengembalian")
    pesanan.perlu_pengembalian_dana = False
    return pesanan


def id_pesanan_kedaluwarsa(db: Session, batas: int = 100) -> list[int]:
    return list(
        db.scalars(
            select(Pesanan.id_pesanan)
            .where(Pesanan.status == S.menunggu_pembayaran, Pesanan.batas_bayar < sekarang_utc())
            .order_by(Pesanan.batas_bayar)
            .limit(batas)
        )
    )


def kedaluwarsakan(db: Session, id_pesanan: int) -> bool:
    """Membatalkan satu pesanan yang lewat batas bayar (AB-02). Idempoten: aman dipanggil bersamaan dari banyak proses.

    Hanya pesanan ``menunggu_pembayaran``; pesanan yang sedang menunggu verifikasi admin TIDAK ikut kedaluwarsa,
    supaya kelambatan admin tidak membatalkan pesanan yang sudah dibayar."""
    pesanan = alur_pesanan.kunci_pesanan(db, id_pesanan)
    if pesanan.status != S.menunggu_pembayaran or not pesanan.batas_bayar or pesanan.batas_bayar >= sekarang_utc():
        return False
    _batalkan_di_dalam(db, pesanan, oleh=None, alasan="Kedaluwarsa: melewati batas waktu bayar")
    return True
