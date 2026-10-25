"""Akun pengguna, autentikasi, dan pengaturan aksesibilitas (F-PL-01, F-PL-18, F-PL-19, F-AD-01, F-AD-17)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import DataTidakValid, Dilarang, Konflik, TidakDitemukan, TidakSah
from app.core.security import HASH_TIRUAN, buat_token_akses, cocok_kata_sandi, hash_kata_sandi
from app.models.enums import Peran
from app.models.pengguna import PengaturanAksesibilitas, Pengguna


def normalisasi_email(email: str) -> str:
    return email.strip().lower()


def cari_berdasarkan_email(db: Session, email: str) -> Pengguna | None:
    return db.scalar(select(Pengguna).where(Pengguna.email == normalisasi_email(email)))


def buat_akun(
    db: Session, *, nama: str, email: str, kata_sandi: str, no_hp: str | None, peran: Peran = Peran.pelanggan
) -> Pengguna:
    if cari_berdasarkan_email(db, email):
        raise Konflik("Email sudah terdaftar.", kode="email_sudah_terdaftar")
    pengguna = Pengguna(
        nama=nama.strip(),
        email=normalisasi_email(email),
        no_hp=no_hp.strip() if no_hp else None,
        password=hash_kata_sandi(kata_sandi),
        peran=peran,
        pengaturan_aksesibilitas=PengaturanAksesibilitas(),
    )
    db.add(pengguna)
    db.flush()
    return pengguna


def daftar_pelanggan(db: Session, *, nama: str, email: str, kata_sandi: str, no_hp: str | None) -> Pengguna:
    """Pendaftaran publik: peran SELALU pelanggan, tidak pernah berasal dari input klien."""
    return buat_akun(db, nama=nama, email=email, kata_sandi=kata_sandi, no_hp=no_hp, peran=Peran.pelanggan)


def masuk(db: Session, *, email: str, kata_sandi: str) -> tuple[Pengguna, str]:
    pengguna = cari_berdasarkan_email(db, email)
    # Selalu memverifikasi hash (tiruan bila akun tak ada) agar waktu respons tidak membocorkan keberadaan email.
    sah = cocok_kata_sandi(kata_sandi, pengguna.password if pengguna else HASH_TIRUAN)
    if not pengguna or not sah:
        raise TidakSah("Email atau kata sandi salah.", kode="kredensial_salah")
    if not pengguna.aktif:
        raise Dilarang("Akun ini dinonaktifkan. Hubungi admin toko.", kode="akun_nonaktif")
    return pengguna, buat_token_akses(pengguna.id_pengguna, pengguna.peran.value, pengguna.versi_sesi or 0)


def ubah_kata_sandi(db: Session, pengguna: Pengguna, *, lama: str, baru: str) -> str:
    """Mengganti kata sandi, mencabut semua sesi lama, dan mengembalikan token baru untuk perangkat ini."""
    if not cocok_kata_sandi(lama, pengguna.password):
        raise DataTidakValid("Kata sandi lama tidak sesuai.", kode="kata_sandi_lama_salah")
    if cocok_kata_sandi(baru, pengguna.password):
        raise DataTidakValid("Kata sandi baru harus berbeda dari kata sandi lama.", kode="kata_sandi_sama")
    pengguna.password = hash_kata_sandi(baru)
    pengguna.versi_sesi = (pengguna.versi_sesi or 0) + 1
    db.flush()
    return buat_token_akses(pengguna.id_pengguna, pengguna.peran.value, pengguna.versi_sesi)


def cabut_semua_sesi(db: Session, pengguna: Pengguna) -> None:
    """Keluar dari semua perangkat: setiap token yang sudah terbit tidak berlaku lagi."""
    pengguna.versi_sesi = (pengguna.versi_sesi or 0) + 1
    db.flush()


def ubah_profil(db: Session, pengguna: Pengguna, *, nama: str | None, email: str | None, no_hp: str | None) -> Pengguna:
    if nama is not None:
        pengguna.nama = nama.strip()
    if no_hp is not None:
        pengguna.no_hp = no_hp.strip() or None
    if email is not None and normalisasi_email(email) != pengguna.email:
        if cari_berdasarkan_email(db, email):
            raise Konflik("Email sudah dipakai akun lain.", kode="email_sudah_terdaftar")
        pengguna.email = normalisasi_email(email)
    db.flush()
    return pengguna


def ambil_pengaturan_aksesibilitas(db: Session, pengguna: Pengguna) -> PengaturanAksesibilitas:
    if pengguna.pengaturan_aksesibilitas is None:  # akun lama tanpa baris pengaturan
        pengguna.pengaturan_aksesibilitas = PengaturanAksesibilitas()
        db.flush()
    return pengguna.pengaturan_aksesibilitas


def ubah_pengaturan_aksesibilitas(db: Session, pengguna: Pengguna, perubahan: dict) -> PengaturanAksesibilitas:
    pengaturan = ambil_pengaturan_aksesibilitas(db, pengguna)
    for kunci, nilai in perubahan.items():
        setattr(pengaturan, kunci, nilai)
    db.flush()
    return pengaturan


# --- Kelola akun admin (F-AD-17) -------------------------------------------------------------------------------


def daftar_pengguna(db: Session, peran: Peran | None = None) -> list[Pengguna]:
    kueri = select(Pengguna).order_by(Pengguna.id_pengguna)
    if peran:
        kueri = kueri.where(Pengguna.peran == peran)
    return list(db.scalars(kueri))


def atur_aktif(db: Session, *, id_pengguna: int, aktif: bool, oleh: Pengguna) -> Pengguna:
    target = db.get(Pengguna, id_pengguna)
    if not target:
        raise TidakDitemukan("Pengguna tidak ditemukan.")
    if not aktif:
        if target.id_pengguna == oleh.id_pengguna:
            raise Konflik("Anda tidak dapat menonaktifkan akun sendiri.", kode="tidak_bisa_nonaktifkan_diri")
        if target.peran == Peran.admin:
            admin_aktif = db.scalar(
                select(func.count()).select_from(Pengguna).where(Pengguna.peran == Peran.admin, Pengguna.aktif.is_(True))
            )
            if admin_aktif <= 1:
                raise Konflik("Minimal harus ada satu akun admin aktif.", kode="admin_terakhir")
        target.versi_sesi = (target.versi_sesi or 0) + 1  # token lama tidak hidup lagi saat akun diaktifkan kembali
    target.aktif = aktif
    db.flush()
    return target
