"""Penjadwal latar belakang: membatalkan pesanan yang lewat batas bayar dan melepas stok tahanannya (AB-02).

Aman dijalankan dari banyak proses sekaligus: ``pesanan.kedaluwarsakan`` mengunci baris dan memeriksa ulang
statusnya, jadi satu pesanan tidak mungkin dibatalkan dua kali. Setiap pesanan diproses di transaksinya sendiri
supaya satu kegagalan tidak menahan yang lain.
"""
import asyncio
import logging

from sqlalchemy.orm import Session, sessionmaker

from app.database import SessionLocal
from app.services import pesanan

log = logging.getLogger("flowerbloom.penjadwal")


def jalankan_sekali(pabrik_sesi: sessionmaker[Session] = SessionLocal) -> int:
    """Memproses semua pesanan yang kedaluwarsa saat ini. Mengembalikan jumlah yang dibatalkan."""
    with pabrik_sesi() as db:
        daftar_id = pesanan.id_pesanan_kedaluwarsa(db)
    dibatalkan = 0
    for id_pesanan in daftar_id:
        with pabrik_sesi() as db:
            try:
                if pesanan.kedaluwarsakan(db, id_pesanan):
                    db.commit()
                    dibatalkan += 1
                else:
                    db.rollback()
            except Exception:  # noqa: BLE001 - satu pesanan bermasalah tidak boleh menghentikan yang lain
                db.rollback()
                log.exception("Gagal mengkedaluwarsakan pesanan %s", id_pesanan)
    if dibatalkan:
        log.info("%d pesanan dibatalkan karena melewati batas bayar", dibatalkan)
    return dibatalkan


async def loop_kedaluwarsa(interval_detik: int) -> None:
    while True:
        await asyncio.sleep(interval_detik)
        try:
            await asyncio.to_thread(jalankan_sekali)
        except Exception:  # noqa: BLE001
            log.exception("Penjadwal kedaluwarsa gagal; akan dicoba lagi pada putaran berikutnya")
