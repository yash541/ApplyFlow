"""Rename stripe_customer_id and stripe_subscription_id to razorpay_*

Revision ID: q9m5n6o7p8i3
Revises: p8l4m5n6o7h2
Create Date: 2026-06-08
"""
from alembic import op

revision = 'q9m5n6o7p8i3'
down_revision = 'p8l4m5n6o7h2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('users', 'stripe_customer_id', new_column_name='razorpay_customer_id')
    op.alter_column('users', 'stripe_subscription_id', new_column_name='razorpay_subscription_id')


def downgrade() -> None:
    op.alter_column('users', 'razorpay_customer_id', new_column_name='stripe_customer_id')
    op.alter_column('users', 'razorpay_subscription_id', new_column_name='stripe_subscription_id')
