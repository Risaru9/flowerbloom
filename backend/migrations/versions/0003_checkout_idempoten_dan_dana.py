"""Kunci checkout per pelanggan dan pencatatan dana parsial oleh admin."""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    # DDL native menghindari rebuild tabel pesanan di SQLite: DROP tabel parent pada
    # mode batch dapat menghapus pembayaran/detail lama melalui ON DELETE CASCADE.
    op.add_column("pesanan", sa.Column("kunci_checkout", sa.String(128), nullable=True))
    op.add_column("pesanan", sa.Column("sidik_checkout", sa.String(64), nullable=True))
    op.create_index("uq_pesanan_kunci_checkout", "pesanan", ["id_pengguna", "kunci_checkout"], unique=True)
    op.add_column("pembayaran", sa.Column("dana_diterima", sa.Boolean(), server_default="0", nullable=False))
    op.execute("UPDATE pembayaran SET dana_diterima = 1 WHERE status_verifikasi = 'sah'")


def downgrade():
    if op.get_bind().dialect.name == "mysql":
        # InnoDB dapat mengganti indeks FK otomatis dengan unique gabungan di atas.
        # Pulihkan indeks FK sebelum unique dihapus agar rollback tidak gagal 1553.
        indeks = sa.inspect(op.get_bind()).get_indexes("pesanan")
        if not any(i["name"] != "uq_pesanan_kunci_checkout" and i["column_names"][0] == "id_pengguna"
                   for i in indeks):
            op.create_index("id_pengguna", "pesanan", ["id_pengguna"])
    op.drop_column("pembayaran", "dana_diterima")
    op.drop_index("uq_pesanan_kunci_checkout", table_name="pesanan")
    op.drop_column("pesanan", "sidik_checkout")
    op.drop_column("pesanan", "kunci_checkout")
