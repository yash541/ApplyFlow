"""Add has_had_pro flag to users

Revision ID: j2f8g9h0i1b6
Revises: i1e7f8g9h0b5
Create Date: 2026-06-05

Once a user upgrades to Pro, this flag is set permanently (never unset).
When their subscription expires and plan drops back to "free", has_had_pro=True
identifies them as expired rather than new-free users, so they don't get
fresh monthly trial credits — they must resubscribe.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "j2f8g9h0i1b6"
down_revision: Union[str, None] = "i1e7f8g9h0b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("has_had_pro", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "has_had_pro")
