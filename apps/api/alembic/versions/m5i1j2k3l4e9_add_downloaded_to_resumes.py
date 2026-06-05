"""add downloaded to resumes

Revision ID: m5i1j2k3l4e9
Revises: l4h0i1j2k3d8
Create Date: 2026-06-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m5i1j2k3l4e9"
down_revision: Union[str, None] = "l4h0i1j2k3d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column("downloaded", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("resumes", "downloaded")
