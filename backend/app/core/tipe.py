"""Tipe kolom dan tipe serialisasi khusus."""
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Any

from pydantic import PlainSerializer
from sqlalchemy import DateTime, Text
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """DATETIME yang disimpan sebagai UTC tanpa zona dan dibaca kembali sebagai datetime UTC berzona.

    Tanpa ini MySQL/SQLite mengembalikan datetime "naif" sehingga klien tidak tahu zonanya.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


class JSONTeks(TypeDecorator):
    """Kolom TEXT yang menyimpan struktur JSON (sesuai rancangan proposal: label_warna bertipe TEXT)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect):
        return None if value is None else json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value: str | None, dialect):
        return None if value is None else json.loads(value)


# DECIMAL disimpan tepat di basis data, tetapi dikirim ke klien sebagai angka JSON (bukan string).
Uang = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]
