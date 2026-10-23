"""Daftar nama warna berbahasa Indonesia (tabel ``warna``): (nama, kode hex, makna dalam konteks acara).

DRAF untuk ditinjau tim. Nama warna adalah kosa kata yang akan dibacakan dan dibaca pelanggan buta warna,
jadi pilih nama yang lazim dikenal. Menambah/mengubah warna dapat dilakukan lewat API admin tanpa migrasi.
Modul warna mencocokkan warna terbaca ke NAMA TERDEKAT pada daftar ini, jadi rapatnya daftar memengaruhi
ketelitian: terlalu jarang -> nama kasar; terlalu rapat -> mudah tertukar.
"""

WARNA_AWAL: list[tuple[str, str, str]] = [
    ("Putih", "#FFFFFF", "Kesucian dan ketulusan; lazim untuk pernikahan, wisuda, dan ungkapan duka cita."),
    ("Krem", "#FFFDD0", "Kelembutan dan kehangatan; netral dan cocok untuk banyak acara."),
    ("Kuning muda", "#FFF59D", "Keceriaan dan harapan baru."),
    ("Kuning", "#FFD700", "Persahabatan, kebahagiaan, dan semangat; cocok untuk ulang tahun."),
    ("Oranye", "#FFA500", "Antusiasme, semangat, dan rasa syukur."),
    ("Persik", "#FFCBA4", "Kesopanan, penghargaan, dan rasa terima kasih."),
    ("Merah muda", "#FFC0CB", "Kasih sayang yang lembut, kekaguman, dan rasa syukur."),
    ("Merah muda tua", "#FF69B4", "Apresiasi yang hangat dan penuh semangat."),
    ("Merah", "#FF0000", "Cinta, gairah, dan keberanian; lazim untuk anniversary dan hari kasih sayang."),
    ("Merah tua", "#8B0000", "Cinta yang mendalam, kerinduan, dan penghormatan."),
    ("Ungu muda", "#B57EDC", "Kekaguman dan keanggunan yang lembut."),
    ("Ungu", "#800080", "Keanggunan, kemewahan, dan kebijaksanaan."),
    ("Ungu tua", "#4B0082", "Kemegahan dan penghormatan yang dalam."),
    ("Biru muda", "#87CEEB", "Ketenangan dan kedamaian."),
    ("Biru", "#1E90FF", "Kepercayaan dan ketenangan."),
    ("Biru tua", "#00008B", "Kesetiaan dan penghormatan."),
    ("Hijau muda", "#90EE90", "Kesegaran dan awal yang baru."),
    ("Hijau", "#228B22", "Kesuburan, kesegaran, dan harapan."),
    ("Hijau tua", "#006400", "Kestabilan dan kemakmuran."),
    ("Cokelat", "#8B4513", "Kehangatan dan kesederhanaan."),
    ("Abu-abu", "#808080", "Netral dan tenang."),
    ("Hitam", "#000000", "Keseriusan dan duka cita; sangat jarang pada bunga alami."),
]
