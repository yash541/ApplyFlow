"""Add ON DELETE CASCADE to all foreign keys referencing users.id

Revision ID: i1e7f8g9h0b5
Revises: h9d6e5f7g8b4
Create Date: 2026-06-04

Previously, deleting a user row via raw SQL (e.g. Supabase editor) would
fail with a FK constraint error because child tables had no ON DELETE CASCADE.
SQLAlchemy's cascade="all, delete-orphan" only works when deletion goes
through a SQLAlchemy session — it has no effect on direct DB deletions.

This migration drops and re-creates all user_id FKs with ON DELETE CASCADE
so a deleted user automatically removes all their data at the DB level.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "i1e7f8g9h0b5"
down_revision: Union[str, None] = "h9d6e5f7g8b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_profiles
    op.drop_constraint("user_profiles_user_id_fkey", "user_profiles", type_="foreignkey")
    op.create_foreign_key(
        "user_profiles_user_id_fkey", "user_profiles", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # resumes
    op.drop_constraint("resumes_user_id_fkey", "resumes", type_="foreignkey")
    op.create_foreign_key(
        "resumes_user_id_fkey", "resumes", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # applications
    op.drop_constraint("applications_user_id_fkey", "applications", type_="foreignkey")
    op.create_foreign_key(
        "applications_user_id_fkey", "applications", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # job_observations — user_id FK (application_id FK already has CASCADE)
    op.drop_constraint("job_observations_user_id_fkey", "job_observations", type_="foreignkey")
    op.create_foreign_key(
        "job_observations_user_id_fkey", "job_observations", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # notifications
    op.drop_constraint("notifications_user_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_user_id_fkey", "notifications", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # user_usage
    op.drop_constraint("user_usage_user_id_fkey", "user_usage", type_="foreignkey")
    op.create_foreign_key(
        "user_usage_user_id_fkey", "user_usage", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )


def downgrade() -> None:
    # Restore FKs without CASCADE
    op.drop_constraint("user_profiles_user_id_fkey", "user_profiles", type_="foreignkey")
    op.create_foreign_key(
        "user_profiles_user_id_fkey", "user_profiles", "users", ["user_id"], ["id"],
    )

    op.drop_constraint("resumes_user_id_fkey", "resumes", type_="foreignkey")
    op.create_foreign_key(
        "resumes_user_id_fkey", "resumes", "users", ["user_id"], ["id"],
    )

    op.drop_constraint("applications_user_id_fkey", "applications", type_="foreignkey")
    op.create_foreign_key(
        "applications_user_id_fkey", "applications", "users", ["user_id"], ["id"],
    )

    op.drop_constraint("job_observations_user_id_fkey", "job_observations", type_="foreignkey")
    op.create_foreign_key(
        "job_observations_user_id_fkey", "job_observations", "users", ["user_id"], ["id"],
    )

    op.drop_constraint("notifications_user_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_user_id_fkey", "notifications", "users", ["user_id"], ["id"],
    )

    op.drop_constraint("user_usage_user_id_fkey", "user_usage", type_="foreignkey")
    op.create_foreign_key(
        "user_usage_user_id_fkey", "user_usage", "users", ["user_id"], ["id"],
    )
