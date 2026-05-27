"""add job_observations table

Revision ID: a1b2c3d4e5f6
Revises: f7b2c3d4e5a1
Create Date: 2026-05-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7b2c3d4e5a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_live", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("extraction_method", sa.String(20), nullable=False, server_default="dom"),
        sa.Column("portal", sa.String(50), nullable=True),
        sa.Column("signals", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_job_observations_application_id", "job_observations", ["application_id"])
    op.create_index("ix_job_observations_user_id", "job_observations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_job_observations_user_id", table_name="job_observations")
    op.drop_index("ix_job_observations_application_id", table_name="job_observations")
    op.drop_table("job_observations")
