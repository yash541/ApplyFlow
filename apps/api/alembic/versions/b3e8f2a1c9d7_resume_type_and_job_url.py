"""resume type, tailored content, job url

Revision ID: b3e8f2a1c9d7
Revises: 73f1526e6c2c
Create Date: 2026-05-26

Changes:
  resumes  — add type, name, tailored_content, application_id, ats_score, updated_at
           — make filename + content nullable (tailored resumes are not file uploads)
  applications — add job_url, notes
               — change status default from 'applied' to 'saved'
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3e8f2a1c9d7"
down_revision: Union[str, None] = "73f1526e6c2c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── resumes ───────────────────────────────────────────────────────────────

    # type: 'base' (uploaded) | 'tailored' (AI-generated, linked to a job)
    op.add_column("resumes", sa.Column("type", sa.String(20), nullable=False, server_default="base"))

    # Human-readable label shown in the resume list
    op.add_column("resumes", sa.Column("name", sa.String(255), nullable=True))

    # Structured TailoredContent JSON — only populated for type='tailored'
    op.add_column("resumes", sa.Column("tailored_content", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # FK to the job application this resume was tailored for
    op.add_column("resumes", sa.Column("application_id", sa.UUID(), nullable=True))
    op.create_index("ix_resumes_application_id", "resumes", ["application_id"])
    op.create_foreign_key(
        "fk_resumes_application_id",
        "resumes", "applications",
        ["application_id"], ["id"],
        ondelete="SET NULL",
    )

    # ATS score from the tailoring step
    op.add_column("resumes", sa.Column("ats_score", sa.Integer(), nullable=True))

    # Track last edit time
    op.add_column(
        "resumes",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
    )

    # Base resumes have filename + content; tailored resumes don't — make nullable
    op.alter_column("resumes", "filename", existing_type=sa.String(255), nullable=True)
    op.alter_column("resumes", "content", existing_type=sa.Text(), nullable=True)

    # ── applications ──────────────────────────────────────────────────────────

    # Job page URL stored by extension — used to match extension ↔ application
    op.add_column("applications", sa.Column("job_url", sa.String(2048), nullable=True))

    # Free-form user notes per application
    op.add_column("applications", sa.Column("notes", sa.Text(), nullable=True))

    # New default: 'saved' (first state when extension saves a job)
    # Existing rows keep their current value; only new rows default to 'saved'
    op.alter_column("applications", "status", server_default="saved")


def downgrade() -> None:
    # ── applications ──────────────────────────────────────────────────────────
    op.alter_column("applications", "status", server_default="applied")
    op.drop_column("applications", "notes")
    op.drop_column("applications", "job_url")

    # ── resumes ───────────────────────────────────────────────────────────────
    op.alter_column("resumes", "content", existing_type=sa.Text(), nullable=False)
    op.alter_column("resumes", "filename", existing_type=sa.String(255), nullable=False)
    op.drop_column("resumes", "updated_at")
    op.drop_column("resumes", "ats_score")
    op.drop_constraint("fk_resumes_application_id", "resumes", type_="foreignkey")
    op.drop_index("ix_resumes_application_id", table_name="resumes")
    op.drop_column("resumes", "application_id")
    op.drop_column("resumes", "tailored_content")
    op.drop_column("resumes", "name")
    op.drop_column("resumes", "type")
