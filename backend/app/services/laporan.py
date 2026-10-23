"""Dasbor dan laporan admin (F-AD-02, F-AD-03, F-AD-15).

Penjualan dihitung dari pesanan yang pembayarannya sudah sah (``STATUS_BERBAYAR``). Pengelompokan per hari/minggu
dilakukan di Python (bukan SQL) agar sama di MySQL maupun SQLite; volume toko tunggal cukup kecil untuk ini.
"""
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.waktu import WIB, hari_ini_wib
from app.models.enums import JenisItem, StatusKomplain, StatusPesanan
from app.models.komplain import Komplain
from app.models.pesanan import DetailPesanan, Pesanan
from app.models.stok import Stok
from app.services import alur_pesanan, pengaturan_toko
from app.services.alur_pesanan import S


def _tanggal_wib(waktu: datetime) -> date:
    return waktu.astimezone(WIB).date()


def _awal_minggu(hari: date) -> date:
    return hari - timedelta(days=hari.weekday())  # Senin


def _pesanan_berbayar(db: Session, dari: date, sampai: date) -> list[Pesanan]:
    """Pesanan berbayar yang dibuat pada rentang tanggal WIB [dari, sampai]."""
    awal = datetime.combine(dari, datetime.min.time(), tzinfo=WIB)
    akhir = datetime.combine(sampai + timedelta(days=1), datetime.min.time(), tzinfo=WIB)
    return list(
        db.scalars(
            select(Pesanan)
            .options(selectinload(Pesanan.detail).selectinload(DetailPesanan.produk))
            .where(
                Pesanan.status.in_(alur_pesanan.STATUS_BERBAYAR),
                Pesanan.dibuat_pada >= awal,
                Pesanan.dibuat_pada < akhir,
            )
        )
    )


def dasbor(db: Session) -> dict:
    hari_ini = hari_ini_wib()
    jumlah = dict(db.execute(select(Pesanan.status, func.count()).group_by(Pesanan.status)).all())
    ambang = pengaturan_toko.ambil(db).ambang_stok_menipis

    menipis = [
        f"{s.jenis_bunga.nama_bunga} {s.warna.nama_warna.lower()} (sisa {s.jumlah_tersedia})"
        for s in db.scalars(
            select(Stok)
            .options(selectinload(Stok.jenis_bunga), selectinload(Stok.warna))
            .where(Stok.jumlah_tersedia <= ambang)
            .order_by(Stok.jumlah_tersedia)
        )
    ]
    minggu = _pesanan_berbayar(db, _awal_minggu(hari_ini), hari_ini)
    hari_ini_total = sum((p.total_harga for p in minggu if _tanggal_wib(p.dibuat_pada) == hari_ini), Decimal(0))

    # grafik 7 hari terakhir: jumlah pesanan masuk per hari (semua status kecuali dibatalkan)
    tujuh_hari = [hari_ini - timedelta(days=i) for i in range(6, -1, -1)]
    awal = datetime.combine(tujuh_hari[0], datetime.min.time(), tzinfo=WIB)
    per_hari = Counter(
        _tanggal_wib(p.dibuat_pada)
        for p in db.scalars(select(Pesanan).where(Pesanan.dibuat_pada >= awal, Pesanan.status != S.dibatalkan))
    )
    return {
        "pesanan_aktif": sum(jumlah.get(s, 0) for s in alur_pesanan.STATUS_AKTIF),
        "perlu_verifikasi": jumlah.get(S.menunggu_verifikasi, 0),
        "perlu_dirangkai": jumlah.get(S.sedang_dirangkai, 0),
        "menunggu_persetujuan_foto": jumlah.get(S.menunggu_persetujuan_foto, 0),
        "perlu_pengembalian_dana": db.scalar(select(func.count()).select_from(Pesanan).where(Pesanan.perlu_pengembalian_dana.is_(True))),
        "komplain_baru": db.scalar(select(func.count()).select_from(Komplain).where(Komplain.status == StatusKomplain.baru)),
        "stok_menipis": menipis,
        "penjualan_hari_ini": hari_ini_total,
        "penjualan_minggu_ini": sum((p.total_harga for p in minggu), Decimal(0)),
        "grafik_pesanan_mingguan": [{"tanggal": h.isoformat(), "jumlah": per_hari.get(h, 0)} for h in tujuh_hari],
    }


def laporan(db: Session, dari: date, sampai: date) -> dict:
    berbayar = _pesanan_berbayar(db, dari, sampai)

    per_minggu: dict[date, list] = defaultdict(lambda: [Decimal(0), 0])
    terlaris: Counter[str] = Counter()
    for p in berbayar:
        entri = per_minggu[_awal_minggu(_tanggal_wib(p.dibuat_pada))]
        entri[0] += p.total_harga
        entri[1] += 1
        for d in p.detail:
            nama = d.produk.nama_produk if d.jenis_item == JenisItem.paket and d.produk else "Rangkaian sendiri"
            terlaris[nama] += d.jumlah

    awal = datetime.combine(dari, datetime.min.time(), tzinfo=WIB)
    akhir = datetime.combine(sampai + timedelta(days=1), datetime.min.time(), tzinfo=WIB)
    dalam_rentang = (Pesanan.dibuat_pada >= awal, Pesanan.dibuat_pada < akhir)
    return {
        "dari": dari,
        "sampai": sampai,
        "total_penjualan": sum((p.total_harga for p in berbayar), Decimal(0)),
        "jumlah_pesanan_berbayar": len(berbayar),
        "penjualan_per_minggu": [
            {"awal_minggu": minggu.isoformat(), "total": total, "jumlah_pesanan": n}
            for minggu, (total, n) in sorted(per_minggu.items())
        ],
        "terlaris": [{"nama": nama, "terjual": n} for nama, n in terlaris.most_common(10)],
        "jumlah_revisi": int(db.scalar(select(func.coalesce(func.sum(Pesanan.jumlah_revisi), 0)).where(*dalam_rentang))),
        "jumlah_komplain": db.scalar(
            select(func.count()).select_from(Komplain).where(Komplain.dibuat_pada >= awal, Komplain.dibuat_pada < akhir)
        ),
        "jumlah_dibatalkan": db.scalar(
            select(func.count()).select_from(Pesanan).where(Pesanan.status == StatusPesanan.dibatalkan, *dalam_rentang)
        ),
    }
