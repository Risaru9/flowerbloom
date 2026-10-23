"""Utilitas waktu. Basis data menyimpan UTC; batas "hari" bisnis mengikuti WIB (UTC+7)."""
from datetime import date, datetime, timedelta, timezone

WIB = timezone(timedelta(hours=7), "WIB")


def sekarang_utc() -> datetime:
    return datetime.now(timezone.utc)


def hari_ini_wib() -> date:
    return datetime.now(WIB).date()
