"""Penyajian berkas privat lewat tautan bertanda tangan berumur pendek (lihat app/core/tautan.py)."""
from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.penyimpanan import ambil_penyimpanan
from app.core.security import baca_token_berkas

router = APIRouter(tags=["Berkas"])


@router.get("/berkas/{token}", summary="Membuka berkas privat dengan tautan bertanda tangan", include_in_schema=False)
def buka_berkas(token: str):
    jalur = ambil_penyimpanan().jalur_absolut(baca_token_berkas(token))
    return FileResponse(jalur, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=300"})
