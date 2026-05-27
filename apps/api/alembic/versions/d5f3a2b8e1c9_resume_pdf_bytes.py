"""add pdf_bytes to resumes for extension file upload

Revision ID: d5f3a2b8e1c9
Revises: c4a7d1e8f302
Create Date: 2026-05-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d5f3a2b8e1c9"
down_revision: Union[str, None] = "c4a7d1e8f302"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # base64-encoded PDF blob — populated when user saves a tailored resume from the editor
    op.add_column("resumes", sa.Column("pdf_bytes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("resumes", "pdf_bytes")
