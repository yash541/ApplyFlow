"""add canonical fingerprint fields to applications

Revision ID: e6f4a3b1d2c8
Revises: d5f3a2b8e1c9
Create Date: 2026-05-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f4a3b1d2c8"
down_revision: Union[str, None] = "d5f3a2b8e1c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("fingerprint_hash", sa.String(64), nullable=True))
    op.add_column("applications", sa.Column("portal", sa.String(50), nullable=True))
    op.add_column("applications", sa.Column("canonical_url", sa.String(2048), nullable=True))
    op.add_column("applications", sa.Column("external_job_id", sa.String(255), nullable=True))
    op.create_index(
        "ix_applications_fingerprint_hash",
        "applications",
        ["fingerprint_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_applications_fingerprint_hash", table_name="applications")
    op.drop_column("applications", "external_job_id")
    op.drop_column("applications", "canonical_url")
    op.drop_column("applications", "portal")
    op.drop_column("applications", "fingerprint_hash")
