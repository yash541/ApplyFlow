import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Application, JobObservation

router = APIRouter()


# ── Request bodies ────────────────────────────────────────────────────────────

class RecordObservationRequest(BaseModel):
    extraction_method: str = "dom"   # 'dom' | 'ai' | 'json_ld'
    portal: str | None = None
    is_live: bool = True
    signals: dict | None = None      # confidence, attempts, etc.


# ── Observations ──────────────────────────────────────────────────────────────

@router.post("/{application_id}", status_code=201)
async def record_observation(
    application_id: str,
    request: RecordObservationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record that the extension saw this job posting. Fire-and-forget from the extension."""
    result = await db.execute(
        select(Application).where(
            Application.id == uuid.UUID(application_id),
            Application.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Application not found")

    obs = JobObservation(
        application_id=uuid.UUID(application_id),
        user_id=current_user.id,
        extraction_method=request.extraction_method,
        portal=request.portal,
        is_live=request.is_live,
        signals=request.signals,
    )
    db.add(obs)
    return {"ok": True}


@router.get("/{application_id}")
async def get_observations(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return observation history for one application."""
    result = await db.execute(
        select(Application).where(
            Application.id == uuid.UUID(application_id),
            Application.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Application not found")

    obs_result = await db.execute(
        select(JobObservation)
        .where(JobObservation.application_id == uuid.UUID(application_id))
        .order_by(JobObservation.observed_at.desc())
        .limit(50)
    )
    rows = obs_result.scalars().all()
    return {
        "observations": [
            {
                "id": str(o.id),
                "observed_at": o.observed_at.isoformat(),
                "is_live": o.is_live,
                "extraction_method": o.extraction_method,
                "portal": o.portal,
                "signals": o.signals,
            }
            for o in rows
        ]
    }


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/overview")
async def analytics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate job-search stats for the current user."""
    # Applications by status
    status_rows = await db.execute(
        select(Application.status, func.count().label("n"))
        .where(Application.user_id == current_user.id)
        .group_by(Application.status)
    )
    by_status = {row.status: row.n for row in status_rows}

    # Applications by portal
    portal_rows = await db.execute(
        select(Application.portal, func.count().label("n"))
        .where(
            Application.user_id == current_user.id,
            Application.portal.isnot(None),
        )
        .group_by(Application.portal)
    )
    by_portal = {row.portal: row.n for row in portal_rows}

    # Total + last-7-days count
    total_result = await db.execute(
        select(func.count()).where(Application.user_id == current_user.id)
    )
    total = total_result.scalar() or 0

    recent_result = await db.execute(
        select(func.count()).where(
            Application.user_id == current_user.id,
            Application.applied_at >= text("now() - interval '7 days'"),
        )
    )
    recent_7d = recent_result.scalar() or 0

    # Observation-derived stats (extraction method breakdown)
    obs_rows = await db.execute(
        select(JobObservation.extraction_method, func.count().label("n"))
        .where(JobObservation.user_id == current_user.id)
        .group_by(JobObservation.extraction_method)
    )
    by_extraction = {row.extraction_method: row.n for row in obs_rows}
    total_obs = sum(by_extraction.values())
    ai_extractions = by_extraction.get("ai", 0)
    dom_extractions = by_extraction.get("dom", 0) + by_extraction.get("json_ld", 0)
    success_rate = round(dom_extractions / total_obs, 3) if total_obs else 1.0

    return {
        "total": total,
        "by_status": by_status,
        "by_portal": by_portal,
        "recent_7d": recent_7d,
        "observations": {
            "total": total_obs,
            "ai_extractions": ai_extractions,
            "dom_extractions": dom_extractions,
            "dom_success_rate": success_rate,
        },
    }
