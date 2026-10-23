"""Pembantu skenario end-to-end: satu toko kecil dengan admin, dua pelanggan, stok, dan satu paket."""
from datetime import timedelta

from app.core.waktu import hari_ini_wib
from app.models.enums import Peran
from tests.bantu import buat_pengguna, gambar_bytes, header_masuk, siapkan_referensi

API = "/api/v1"

MERAH_TUA = (139, 10, 10)
MERAH_MUDA = (255, 192, 203)
PUTIH = (250, 250, 250)


class Toko:
    def __init__(self, client, db):
        self.client, self.db = client, db
        self.warna, self.jenis = siapkan_referensi(db)
        buat_pengguna(db, "admin@contoh.id", Peran.admin, "Admin")
        buat_pengguna(db, "pel@contoh.id", nama="Pelanggan Satu")
        buat_pengguna(db, "pel2@contoh.id", nama="Pelanggan Dua")
        self.admin = header_masuk(client, "admin@contoh.id")
        self.pel = header_masuk(client, "pel@contoh.id")
        self.pel2 = header_masuk(client, "pel2@contoh.id")
        self.id_stok: dict[str, int] = {}
        self.id_paket: int | None = None

    # --- penyiapan -----------------------------------------------------------------------------------------
    def isi_stok(self, jenis: str, warna: str, jumlah: int, harga: int = 5000) -> int:
        r = self.client.post(
            f"{API}/admin/stok/manual",
            headers=self.admin,
            json={
                "id_jenis_bunga": self.jenis[jenis].id_jenis_bunga,
                "id_warna": self.warna[warna].id_warna,
                "jumlah_tangkai": jumlah,
                "harga_per_tangkai": harga,
            },
        )
        assert r.status_code == 201, r.text
        self.id_stok[f"{jenis}/{warna}"] = r.json()["id_stok"]
        return r.json()["id_stok"]

    def stok_standar(self):
        """Mawar merah tua 20, Anyelir putih 20, Mawar merah muda 10, plus paket 'Buket Cinta' (6+6) seharga 150.000."""
        self.isi_stok("Mawar", "Merah tua", 20, 8000)
        self.isi_stok("Anyelir", "Putih", 20, 4000)
        self.isi_stok("Mawar", "Merah muda", 10, 7000)
        r = self.client.post(
            f"{API}/admin/produk",
            headers=self.admin,
            json={
                "nama_produk": "Buket Cinta",
                "acara": "Anniversary",
                "harga": 150000,
                "komposisi": [
                    {"id_jenis_bunga": self.jenis["Mawar"].id_jenis_bunga, "id_warna": self.warna["Merah tua"].id_warna, "jumlah_tangkai": 6},
                    {"id_jenis_bunga": self.jenis["Anyelir"].id_jenis_bunga, "id_warna": self.warna["Putih"].id_warna, "jumlah_tangkai": 6},
                ],
            },
        )
        assert r.status_code == 201, r.text
        self.id_paket = r.json()["id_produk"]
        return self

    # --- pelanggan ---------------------------------------------------------------------------------------------
    def isi_checkout(self, items=None, **ganti) -> dict:
        data = {
            "items": items if items is not None else [{"jenis_item": "paket", "id_produk": self.id_paket, "jumlah": 1}],
            "nama_penerima": "Budi",
            "cara_serah_terima": "ambil_di_toko",
            "tanggal_kirim": (hari_ini_wib() + timedelta(days=2)).isoformat(),
            "slot_jam": "09:00-11:00",
        }
        data.update(ganti)
        return data

    def checkout(self, headers=None, **kw):
        return self.client.post(f"{API}/pesanan", headers=headers or self.pel, json=self.isi_checkout(**kw))

    def pesan(self, headers=None, **kw) -> dict:
        r = self.checkout(headers, **kw)
        assert r.status_code == 201, r.text
        return r.json()

    def bayar(self, id_pesanan: int, headers=None, nominal="150000", nama="Budi"):
        return self.client.post(
            f"{API}/pesanan/{id_pesanan}/pembayaran",
            headers=headers or self.pel,
            files={"bukti": ("bukti.jpg", gambar_bytes(), "image/jpeg")},
            data={"nama_pengirim": nama, "nominal": nominal},
        )

    def lihat(self, id_pesanan: int, headers=None) -> dict:
        r = self.client.get(f"{API}/pesanan/{id_pesanan}", headers=headers or self.pel)
        assert r.status_code == 200, r.text
        return r.json()

    def status(self, id_pesanan: int, headers=None) -> str:
        return self.lihat(id_pesanan, headers)["status"]["kode"]

    def tanggapi(self, id_pesanan: int, headers=None, **isi):
        return self.client.post(f"{API}/pesanan/{id_pesanan}/persetujuan-foto", headers=headers or self.pel, json=isi)

    # --- admin -------------------------------------------------------------------------------------------------
    def _id_pembayaran_terakhir(self, id_pesanan: int) -> int:
        detail = self.client.get(f"{API}/admin/pesanan/{id_pesanan}", headers=self.admin).json()
        return detail["pembayaran"][-1]["id_pembayaran"]

    def sahkan(self, id_pesanan: int):
        id_pembayaran = self._id_pembayaran_terakhir(id_pesanan)
        return self.client.post(f"{API}/admin/pesanan/{id_pesanan}/pembayaran/{id_pembayaran}/sahkan", headers=self.admin)

    def tolak(self, id_pesanan: int, catatan="Nominal tidak sesuai"):
        id_pembayaran = self._id_pembayaran_terakhir(id_pesanan)
        return self.client.post(
            f"{API}/admin/pesanan/{id_pesanan}/pembayaran/{id_pembayaran}/tolak", headers=self.admin, json={"catatan": catatan}
        )

    def pindai_rangkai(self, id_pesanan: int, warna=MERAH_TUA, jumlah=1, latar=(30, 120, 40)):
        return self.client.post(
            f"{API}/admin/pesanan/{id_pesanan}/merangkai/pindai",
            headers=self.admin,
            files={"foto": ("bunga.jpg", gambar_bytes(warna, latar), "image/jpeg")},
            data={"jumlah": str(jumlah)},
        )

    def foto_hasil(self, id_pesanan: int):
        return self.client.post(
            f"{API}/admin/pesanan/{id_pesanan}/foto-hasil",
            headers=self.admin,
            files={"foto": ("hasil.jpg", gambar_bytes(MERAH_TUA, (240, 240, 240)), "image/jpeg")},
        )

    def merangkai(self, id_pesanan: int) -> dict:
        r = self.client.get(f"{API}/admin/pesanan/{id_pesanan}/merangkai", headers=self.admin)
        assert r.status_code == 200, r.text
        return r.json()

    def stok(self, kunci: str) -> dict:
        daftar = self.client.get(f"{API}/admin/stok", headers=self.admin).json()
        return next(s for s in daftar if s["id_stok"] == self.id_stok[kunci])

    def rangkai_lengkap(self, id_pesanan: int, klasifikator):
        """Memindai semua bunga paket 'Buket Cinta' sampai progres penuh."""
        klasifikator.kelas = 74  # Mawar
        r = self.pindai_rangkai(id_pesanan, MERAH_TUA, jumlah=6)
        assert r.json()["cocok"] is True, r.text
        klasifikator.kelas = 31  # Anyelir
        r = self.pindai_rangkai(id_pesanan, PUTIH, jumlah=6)
        assert r.json()["cocok"] is True, r.text
        assert r.json()["progres"]["siap_foto"] is True
