import uuid
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Application

router = APIRouter()


# ── Request bodies ────────────────────────────────────────────────────────────

class CreateApplicationRequest(BaseModel):
    company: str
    role: str
    job_url: str | None = None
    job_description: str | None = None
    notes: str | None = None
    status: str = "saved"
    # Sprint 1 fingerprint fields — sent by extension, stored for dedup
    fingerprint_hash: str | None = None
    portal: str | None = None
    canonical_url: str | None = None
    external_job_id: str | None = None


class UpdateApplicationRequest(BaseModel):
    company: str | None = None
    role: str | None = None
    status: str | None = None
    job_url: str | None = None
    job_description: str | None = None
    notes: str | None = None
    ats_metadata: dict | None = None


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize(a: Application, *, detail: bool = False) -> dict:
    resume = a.tailored_resume
    out = {
        "id": str(a.id),
        "company": a.company,
        "role": a.role,
        "job_url": a.job_url,
        "status": a.status,
        "notes": a.notes,
        "has_resume": resume is not None,
        "resume_id": str(resume.id) if resume else None,
        "ats_score": resume.ats_score if resume else None,
        "applied_at": a.applied_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
        # Sprint 1 fingerprint fields
        "fingerprint_hash": a.fingerprint_hash,
        "portal": a.portal,
        "canonical_url": a.canonical_url,
        "external_job_id": a.external_job_id,
        "ats_metadata": a.ats_metadata,
    }
    if detail:
        out["job_description"] = a.job_description
    return out


def _with_resume(q):
    """Eagerly load the tailored_resume relationship so _serialize can access it."""
    return q.options(selectinload(Application.tailored_resume))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lookup")
async def lookup_by_url(
    url: str = Query(..., description="Job page URL to match"),
    fingerprint_hash: str | None = Query(None, description="SHA-256 fingerprint hash (preferred)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Find an application by fingerprint hash (preferred) or raw job URL (legacy fallback)."""
    app = None

    # 1. Fingerprint lookup — survives URL changes, reposts, and redirects
    if fingerprint_hash:
        result = await db.execute(
            _with_resume(
                select(Application).where(
                    Application.user_id == current_user.id,
                    Application.fingerprint_hash == fingerprint_hash,
                )
            )
        )
        app = result.scalar_one_or_none()

    # 2. Raw URL fallback — for records saved before fingerprinting was added
    if app is None:
        result = await db.execute(
            _with_resume(
                select(Application).where(
                    Application.user_id == current_user.id,
                    Application.job_url == url,
                )
            )
        )
        app = result.scalar_one_or_none()

    return _serialize(app, detail=True) if app else None


@router.get("/check")
async def check_application(
    company: str = Query(...),
    role: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check whether an application exists for a company+role pair."""
    result = await db.execute(
        _with_resume(
            select(Application).where(
                Application.user_id == current_user.id,
                func.lower(Application.company) == company.lower(),
                func.lower(Application.role) == role.lower(),
            )
        )
    )
    app = result.scalar_one_or_none()
    return _serialize(app) if app else None


@router.get("/")
async def list_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all applications for the current user, ordered newest first."""
    result = await db.execute(
        _with_resume(
            select(Application)
            .where(Application.user_id == current_user.id)
            .order_by(Application.applied_at.desc())
        )
    )
    return {"applications": [_serialize(a) for a in result.scalars().all()]}


@router.post("/", status_code=201)
async def create_application(
    request: CreateApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Repost detection: if we already have a record with this fingerprint,
    # return it rather than creating a duplicate. Sprint 5 safety net — the
    # primary dedup path is the fingerprint lookup in the extension overlay.
    if request.fingerprint_hash:
        existing_result = await db.execute(
            _with_resume(
                select(Application).where(
                    Application.user_id == current_user.id,
                    Application.fingerprint_hash == request.fingerprint_hash,
                )
            )
        )
        existing_app = existing_result.scalar_one_or_none()
        if existing_app:
            serialized = _serialize(existing_app, detail=True)
            serialized["reposted"] = True
            return serialized

    app = Application(
        user_id=current_user.id,
        company=request.company,
        role=request.role,
        job_url=request.job_url,
        job_description=request.job_description,
        notes=request.notes,
        status=request.status,
        fingerprint_hash=request.fingerprint_hash,
        portal=request.portal,
        canonical_url=request.canonical_url,
        external_job_id=request.external_job_id,
    )
    db.add(app)
    await db.flush()
    await db.refresh(app)
    # No tailored_resume yet — safe to serialize without eager load
    app.tailored_resume = None  # type: ignore[assignment]
    return _serialize(app, detail=True)


@router.get("/{application_id}")
async def get_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return full application details including job_description."""
    result = await db.execute(
        _with_resume(
            select(Application).where(
                Application.id == uuid.UUID(application_id),
                Application.user_id == current_user.id,
            )
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return _serialize(app, detail=True)


@router.patch("/{application_id}")
async def update_application(
    application_id: str,
    request: UpdateApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partial update — any combination of status, notes, job_url, job_description, company, role."""
    result = await db.execute(
        _with_resume(
            select(Application).where(
                Application.id == uuid.UUID(application_id),
                Application.user_id == current_user.id,
            )
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if request.company is not None:
        app.company = request.company
    if request.role is not None:
        app.role = request.role
    if request.status is not None:
        app.status = request.status
    if request.job_url is not None:
        app.job_url = request.job_url
    if request.job_description is not None:
        app.job_description = request.job_description
    if request.notes is not None:
        app.notes = request.notes
    if request.ats_metadata is not None:
        app.ats_metadata = request.ats_metadata

    await db.flush()
    await db.refresh(app)
    return _serialize(app, detail=True)


@router.delete("/{application_id}")
async def delete_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application).where(
            Application.id == uuid.UUID(application_id),
            Application.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    await db.delete(app)
    return {"deleted": application_id}
