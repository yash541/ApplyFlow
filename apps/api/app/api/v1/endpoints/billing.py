"""Razorpay billing endpoints.

Handles checkout sessions, webhooks, plan sync, cancellation, and usage reporting.
"""
import hashlib
import hmac
import json
import uuid as _uuid
from datetime import datetime, timezone

import razorpay
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from app.core.limiter import limiter
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.usage import FREE_DOWNLOAD_LIMIT, FREE_LIMITS, _current_month, _get_or_create_usage
from app.models import User, UserUsage

router = APIRouter()

# ── Request / Response models ─────────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    plan: str  # "monthly" | "annual"


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class UsageResponse(BaseModel):
    plan: str
    autofill_used: int
    autofill_limit: int | None   # None = unlimited (pro)
    score_used: int
    score_limit: int | None
    tailor_used: int
    tailor_limit: int | None
    downloads_used: int
    downloads_limit: int | None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _rzp_client() -> razorpay.Client:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Payment system is not configured.")
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


async def _get_or_create_customer(user: User, client: razorpay.Client, db: AsyncSession) -> str:
    """Return (or lazily create) the Razorpay customer ID for this user."""
    if user.razorpay_customer_id:
        return user.razorpay_customer_id

    customer = client.customer.create({
        "name": user.name,
        "email": user.email,
        "notes": {"user_id": str(user.id)},
    })
    user.razorpay_customer_id = customer["id"]
    await db.flush()
    return customer["id"]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/checkout")
@limiter.limit("10/hour")
async def create_checkout_session(
    request: Request,
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Razorpay subscription and return subscription_id + key_id for the frontend checkout."""
    client = _rzp_client()

    if body.plan not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="Invalid plan. Must be 'monthly' or 'annual'.")

    plan_id = (
        settings.RAZORPAY_MONTHLY_PLAN_ID
        if body.plan == "monthly"
        else settings.RAZORPAY_ANNUAL_PLAN_ID
    )
    if not plan_id:
        raise HTTPException(status_code=503, detail=f"Razorpay {body.plan} plan ID is not configured.")

    customer_id = await _get_or_create_customer(current_user, client, db)
    await db.commit()

    # total_count = max billing cycles; large number = effectively indefinite
    total_count = 120 if body.plan == "monthly" else 10

    subscription = client.subscription.create({
        "plan_id": plan_id,
        "customer_id": customer_id,
        "customer_notify": 1,
        "quantity": 1,
        "total_count": total_count,
        "notes": {"user_id": str(current_user.id)},
    })

    return {
        "subscription_id": subscription["id"],
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify Razorpay payment signature after checkout and immediately activate Pro."""
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{body.razorpay_payment_id}|{body.razorpay_subscription_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    current_user.plan = "pro"
    current_user.has_had_pro = True
    current_user.razorpay_subscription_id = body.razorpay_subscription_id
    await db.commit()
    return {"plan": "pro"}


@router.post("/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the user's active subscription at the end of the current billing cycle."""
    client = _rzp_client()

    if not current_user.razorpay_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found.")

    # cancel_at_cycle_end=1 keeps access until the period ends
    client.subscription.cancel(
        current_user.razorpay_subscription_id,
        {"cancel_at_cycle_end": 1},
    )
    return {"cancelled": True}


@router.post("/sync-plan")
@limiter.limit("20/hour")
async def sync_plan(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually sync the user's plan from Razorpay. Safe to call at any time — idempotent."""
    client = _rzp_client()

    if not current_user.razorpay_subscription_id:
        return {"plan": current_user.plan, "synced": False, "reason": "no_subscription"}

    sub = client.subscription.fetch(current_user.razorpay_subscription_id)
    # Razorpay statuses: created | authenticated | active | paused | halted | cancelled | completed | expired
    status = sub.get("status", "")

    new_plan = "pro" if status == "active" else "free"
    changed = current_user.plan != new_plan
    if changed:
        current_user.plan = new_plan
        await db.commit()

    return {"plan": new_plan, "synced": changed}


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
):
    """Handle Razorpay webhook events.

    This endpoint has NO authentication — Razorpay calls it directly.
    Signature is verified with the webhook secret.
    """
    payload = await request.body()

    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, x_razorpay_signature or ""):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type: str = event.get("event", "")

    # ── subscription.charged ─────────────────────────────────────────────────
    if event_type == "subscription.charged":
        sub = event.get("payload", {}).get("subscription", {}).get("entity", {})
        sub_id = sub.get("id")
        notes = sub.get("notes", {})
        user_id_str = notes.get("user_id")

        if user_id_str:
            try:
                user_uuid = _uuid.UUID(user_id_str)
            except ValueError:
                return {"received": True}
            result = await db.execute(select(User).where(User.id == user_uuid))
            user = result.scalar_one_or_none()
            if user:
                user.plan = "pro"
                user.has_had_pro = True
                if sub_id:
                    user.razorpay_subscription_id = sub_id
                await db.commit()

    # ── subscription.cancelled / completed / expired ──────────────────────────
    elif event_type in ("subscription.cancelled", "subscription.completed", "subscription.expired"):
        sub = event.get("payload", {}).get("subscription", {}).get("entity", {})
        sub_id = sub.get("id")

        if sub_id:
            result = await db.execute(
                select(User).where(User.razorpay_subscription_id == sub_id)
            )
            user = result.scalar_one_or_none()
            if user:
                user.plan = "free"
                await db.commit()

    return {"received": True}


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current plan and monthly usage counters."""
    month = _current_month()
    usage_row = await _get_or_create_usage(current_user.id, month, db)
    await db.flush()

    is_pro     = current_user.plan == "pro"
    is_expired = not is_pro and getattr(current_user, "has_had_pro", False)

    if is_expired:
        return UsageResponse(
            plan="expired",
            autofill_used=0,
            autofill_limit=0,
            score_used=0,
            score_limit=0,
            tailor_used=0,
            tailor_limit=0,
            downloads_used=current_user.total_downloads,
            downloads_limit=0,
        )

    return UsageResponse(
        plan=current_user.plan,
        autofill_used=usage_row.autofill_sessions,
        autofill_limit=None if is_pro else FREE_LIMITS["autofill_sessions"],
        score_used=usage_row.match_scores,
        score_limit=None if is_pro else FREE_LIMITS["match_scores"],
        tailor_used=usage_row.tailor_sessions,
        tailor_limit=None if is_pro else FREE_LIMITS["tailor_sessions"],
        downloads_used=current_user.total_downloads,
        downloads_limit=None if is_pro else FREE_DOWNLOAD_LIMIT,
    )
