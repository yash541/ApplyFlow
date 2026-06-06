"""Add composite index on applications(user_id, status)

Revision ID: p8l4m5n6o7h2
Revises: o7k3l4m5n6g1
Create Date: 2026-06-06
"""
from alembic import op

revision = 'p8l4m5n6o7h2'
down_revision = 'o7k3l4m5n6g1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index speeds up Kanban queries that filter by user_id + status
    op.create_index(
        'ix_applications_user_id_status',
        'applications',
        ['user_id', 'status'],
    )


def downgrade() -> None:
    op.drop_index('ix_applications_user_id_status', table_name='applications')
