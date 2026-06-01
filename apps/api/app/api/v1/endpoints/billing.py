"""Stripe billing endpoints.

Handles checkout sessions, customer portal, webhooks, and usage reporting.
"""
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
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
    price_id: str
    success_url: str
    cancel_url: str


class PortalResponse(BaseModel):
    url: str


class UsageResponse(BaseModel):
    plan: str
    autofill_used: int
    autofill_limit: int | None   # None = unlimited (pro)
    score_used: int
    score_limit: int | None
    downloads_used: int
    downloads_limit: int | None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _stripe_client() -> stripe.Stripe:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _ensure_stripe() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")
    stripe.api_key = settings.STRIPE_SECRET_KEY


async def _get_or_create_customer(user: User, db: AsyncSession) -> str:
    """Return (or lazily create) the Stripe customer ID for this user."""
    _ensure_stripe()
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = customer.id
    await db.flush()
    return customer.id


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session and return the redirect URL."""
    _ensure_stripe()
    customer_id = await _get_or_create_customer(current_user, db)
    await db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": body.price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": str(current_user.id)},
    )
    return {"url": session.url}


@router.post("/portal", response_model=PortalResponse)
async def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session."""
    _ensure_stripe()
    customer_id = await _get_or_create_customer(current_user, db)
    await db.commit()

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.WEB_APP_URL}/settings/billing",
    )
    return PortalResponse(url=session.url)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """Handle Stripe webhook events.

    This endpoint has NO authentication — Stripe calls it directly.
    Signature is verified with the webhook secret.
    """
    payload = await request.body()

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook error: {exc}")

    event_type: str = event["type"]

    # ── checkout.session.completed ────────────────────────────────────────────
    if event_type == "checkout.session.completed":
        session_obj = event["data"]["object"]
        user_id = session_obj.get("metadata", {}).get("user_id")
        subscription_id = session_obj.get("subscription")

        if user_id:
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if user:
                user.plan = "pro"
                if subscription_id:
                    user.stripe_subscription_id = subscription_id
                await db.commit()

    # ── customer.subscription.updated ────────────────────────────────────────
    elif event_type == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        status = sub.get("status")  # active | past_due | canceled | unpaid | trialing

        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        user = result.scalar_one_or_none()
        if user:
            if status in ("active", "trialing"):
                user.plan = "pro"
            else:
                user.plan = "free"
            user.stripe_subscription_id = sub.get("id")
            await db.commit()

    # ── customer.subscription.deleted ────────────────────────────────────────
    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")

        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        user = result.scalar_one_or_none()
        if user:
            user.plan = "free"
            user.stripe_subscription_id = None
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

    is_pro = current_user.plan == "pro"

    return UsageResponse(
        plan=current_user.plan,
        autofill_used=usage_row.autofill_sessions,
        autofill_limit=None if is_pro else FREE_LIMITS["autofill_sessions"],
        score_used=usage_row.match_scores,
        score_limit=None if is_pro else FREE_LIMITS["match_scores"],
        downloads_used=current_user.total_downloads,
        downloads_limit=None if is_pro else FREE_DOWNLOAD_LIMIT,
    )
