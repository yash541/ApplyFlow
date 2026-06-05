"""add edit_count to resumes

Revision ID: l4h0i1j2k3d8
Revises: k3g9h0i1j2c7
Create Date: 2026-06-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l4h0i1j2k3d8"
down_revision: Union[str, None] = "k3g9h0i1j2c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "resumes",
        sa.Column("edit_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("resumes", "edit_count")
