"""Mengekspor kontrak API ke docs/openapi.json agar frontend dapat mengembangkan klien tanpa menjalankan server.

    python -m scripts.ekspor_openapi
"""
import json
import os
import tempfile
from pathlib import Path

# Mengimpor aplikasi menyiapkan folder berkas; arahkan ke folder sementara agar tidak mengotori proyek.
os.environ.setdefault("DIREKTORI_BERKAS", tempfile.mkdtemp(prefix="flowerbloom-openapi-"))

from app.main import app  # noqa: E402


def main() -> None:
    tujuan = Path(__file__).resolve().parent.parent / "docs" / "openapi.json"
    tujuan.parent.mkdir(exist_ok=True)
    skema = app.openapi()
    # newline="\n": hasil di Windows harus identik dengan CI (Linux) agar cek kontrak tidak gagal karena CRLF.
    tujuan.write_text(json.dumps(skema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    operasi = sum(len(v) for v in skema["paths"].values())
    print(f"{tujuan} ditulis: {len(skema['paths'])} path, {operasi} operasi.")


if __name__ == "__main__":
    main()
