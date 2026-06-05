"""Usage tracking and gating helpers.

Checks monthly limits for free users and increments counters atomically.
"""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserUsage

# ── Plan limits ───────────────────────────────────────────────────────────────

FREE_LIMITS = {
    "autofill_sessions": 10,
    "match_scores": 10,
    "tailor_sessions": 5,
}

# Resume downloads: 1 lifetime (stored as total_downloads on User)
FREE_DOWNLOAD_LIMIT = 1

# Max re-saves (edits) per tailored resume for free users
FREE_EDIT_LIMIT = 3


def _current_month() -> str:
    """Return the current month key in 'YYYY-MM' format (UTC)."""
    return datetime.now(tz=timezone.utc).strftime("%Y-%m")


async def _get_or_create_usage(user_id: uuid.UUID, month: str, db: AsyncSession) -> UserUsage:
    """Return the UserUsage row for the given user+month, creating it if absent."""
    result = await db.execute(
        select(UserUsage).where(
            UserUsage.user_id == user_id,
            UserUsage.month == month,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row

    row = UserUsage(user_id=user_id, month=month)
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        result2 = await db.execute(
            select(UserUsage).where(
                UserUsage.user_id == user_id,
                UserUsage.month == month,
            )
        )
        row = result2.scalar_one()
    return row


async def check_and_increment_usage(
    user: User,
    db: AsyncSession,
    usage_type: str,
) -> None:
    """Gate and increment a usage counter for the given user.

    - Pro users: always passes (no limit).
    - Free users: raises HTTP 402 if the monthly limit is exceeded, then increments.

    usage_type must be one of: "autofill_sessions", "match_scores".
    """
    if user.plan == "pro":
        return  # unlimited

    # Expired Pro: had a paid subscription before, now on free plan.
    # They've already consumed their one-time free trial — block AI features
    # until they resubscribe. Free tier is an onboarding trial, not a permanent right.
    if getattr(user, "has_had_pro", False):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "subscription_expired",
                "usage_type": usage_type,
                "message": "Your Pro subscription has ended. Upgrade to continue using AI features.",
            },
        )

    month = _current_month()
    usage_row = await _get_or_create_usage(user.id, month, db)

    limit = FREE_LIMITS.get(usage_type)
    if limit is None:
        raise ValueError(f"Unknown usage_type: {usage_type!r}")

    current = getattr(usage_row, usage_type)
    if current >= limit:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "usage_limit_exceeded",
                "usage_type": usage_type,
                "used": current,
                "limit": limit,
                "message": f"You have used all {limit} free {usage_type.replace('_', ' ')} this month. Upgrade to Pro for unlimited access.",
            },
        )

    # Increment
    setattr(usage_row, usage_type, current + 1)
    await db.flush()


async def check_and_increment_download(user: User, db: AsyncSession) -> None:
    """Gate and increment lifetime resume download count for free users."""
    if user.plan == "pro":
        return

    if user.total_downloads >= FREE_DOWNLOAD_LIMIT:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "download_limit_exceeded",
                "usage_type": "resume_downloads",
                "used": user.total_downloads,
                "limit": FREE_DOWNLOAD_LIMIT,
                "message": f"Free accounts are limited to {FREE_DOWNLOAD_LIMIT} resume download. Upgrade to Pro for unlimited downloads.",
            },
        )

    user.total_downloads += 1
    await db.flush()
