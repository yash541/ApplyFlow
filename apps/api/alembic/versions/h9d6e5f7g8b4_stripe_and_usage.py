"""add stripe billing fields and user_usage table

Revision ID: h9d6e5f7g8b4
Revises: g8c5d4e6f7b3
Create Date: 2026-06-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "h9d6e5f7g8b4"
down_revision: Union[str, None] = "g8c5d4e6f7b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add billing columns to users
    op.add_column("users", sa.Column("plan", sa.String(20), nullable=False, server_default="free"))
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("total_downloads", sa.Integer, nullable=False, server_default="0"))

    # Create user_usage table
    op.create_table(
        "user_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("autofill_sessions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("match_scores", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "month", name="uq_user_usage_user_month"),
    )
    op.create_index("ix_user_usage_user_id", "user_usage", ["user_id"])
    op.create_index("ix_user_usage_month", "user_usage", ["month"])


def downgrade() -> None:
    op.drop_index("ix_user_usage_month", "user_usage")
    op.drop_index("ix_user_usage_user_id", "user_usage")
    op.drop_table("user_usage")
    op.drop_column("users", "total_downloads")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "plan")
