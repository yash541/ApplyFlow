"""add tailor_sessions to user_usage

Revision ID: k3g9h0i1j2c7
Revises: j2f8g9h0i1b6
Create Date: 2026-06-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k3g9h0i1j2c7"
down_revision: Union[str, None] = "j2f8g9h0i1b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_usage",
        sa.Column("tailor_sessions", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("user_usage", "tailor_sessions")
