"""add ats_metadata jsonb to applications

Revision ID: f7b2c3d4e5a1
Revises: e6f4a3b1d2c8
Create Date: 2026-05-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "f7b2c3d4e5a1"
down_revision: Union[str, None] = "e6f4a3b1d2c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("ats_metadata", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "ats_metadata")
