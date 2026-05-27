import io
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import pypdf
from docx import Document

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Resume

router = APIRouter()


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_list(r: Resume) -> dict:
    """Lightweight — used in list views (no raw content)."""
    return {
        "id": str(r.id),
        "type": r.type,
        "name": r.name or r.filename or "Untitled",
        "filename": r.filename,
        "ats_score": r.ats_score,
        "application_id": str(r.application_id) if r.application_id else None,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat() if r.updated_at else r.created_at.isoformat(),
    }


def _serialize_detail(r: Resume) -> dict:
    """Full — used in detail/editor views (includes content)."""
    return {
        **_serialize_list(r),
        "content": r.content,
        "tailored_content": r.tailored_content,
    }


# ── Request bodies ────────────────────────────────────────────────────────────

class SaveTailoredRequest(BaseModel):
    application_id: str
    tailored_content: dict          # full TailoredContent JSON from the editor
    name: str | None = None         # auto-generated from company/role if omitted
    pdf_bytes: str | None = None    # base64-encoded PDF for extension file upload


class UpdateResumeRequest(BaseModel):
    tailored_content: dict | None = None
    name: str | None = None
    pdf_bytes: str | None = None    # base64-encoded PDF for extension file upload


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all resumes for the current user (base + tailored)."""
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
    )
    return {"resumes": [_serialize_list(r) for r in result.scalars().all()]}


@router.get("/base")
async def get_base_resume(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's most recent base resume (used as input to AI tailoring)."""
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == current_user.id, Resume.type == "base")
        .order_by(Resume.created_at.desc())
    )
    resume = result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="No base resume found — please upload one first")
    return _serialize_detail(resume)


@router.post("/upload", status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a base resume (PDF / DOCX / TXT). Extracts text for AI tailoring."""
    if not file.filename or not file.filename.lower().endswith((".pdf", ".docx", ".txt")):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, or TXT files are supported")

    raw = await file.read()
    fname = file.filename.lower()
    text = ""

    if fname.endswith(".pdf"):
        reader = pypdf.PdfReader(io.BytesIO(raw))
        text = " ".join(page.extract_text() or "" for page in reader.pages)
    elif fname.endswith(".txt"):
        text = raw.decode("utf-8", errors="ignore")
    elif fname.endswith(".docx"):
        doc = Document(io.BytesIO(raw))
        text = " ".join(p.text for p in doc.paragraphs)

    resume = Resume(
        user_id=current_user.id,
        type="base",
        filename=file.filename,
        content=text,
    )
    db.add(resume)
    await db.flush()
    return _serialize_detail(resume)


@router.post("/tailored", status_code=201)
async def save_tailored_resume(
    request: SaveTailoredRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Save (or update) the tailored resume for a job application.
    Idempotent: if one already exists for this application_id, it is updated in place.
    """
    app_id = uuid.UUID(request.application_id)

    # Check ownership of the application
    from app.models import Application
    app_result = await db.execute(
        select(Application).where(
            Application.id == app_id,
            Application.user_id == current_user.id,
        )
    )
    application = app_result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Auto-generate name from company + role if not provided
    name = request.name or f"{application.company} – {application.role}"

    # Upsert: update existing tailored resume or create a new one
    existing_result = await db.execute(
        select(Resume).where(
            Resume.application_id == app_id,
            Resume.user_id == current_user.id,
            Resume.type == "tailored",
        )
    )
    resume = existing_result.scalar_one_or_none()

    ats = request.tailored_content.get("ats_score")

    if resume:
        resume.tailored_content = request.tailored_content
        resume.name = name
        resume.ats_score = ats
        if request.pdf_bytes is not None:
            resume.pdf_bytes = request.pdf_bytes
    else:
        resume = Resume(
            user_id=current_user.id,
            type="tailored",
            name=name,
            tailored_content=request.tailored_content,
            application_id=app_id,
            ats_score=ats,
            pdf_bytes=request.pdf_bytes,
        )
        db.add(resume)

    await db.flush()
    await db.refresh(resume)
    return _serialize_detail(resume)


@router.put("/{resume_id}")
async def update_resume(
    resume_id: str,
    request: UpdateResumeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a resume's tailored_content and/or name (called by the editor Save button)."""
    result = await db.execute(
        select(Resume).where(
            Resume.id == uuid.UUID(resume_id),
            Resume.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if request.tailored_content is not None:
        resume.tailored_content = request.tailored_content
        ats = request.tailored_content.get("ats_score")
        if ats is not None:
            resume.ats_score = ats
    if request.name is not None:
        resume.name = request.name
    if request.pdf_bytes is not None:
        resume.pdf_bytes = request.pdf_bytes

    await db.flush()
    await db.refresh(resume)
    return _serialize_detail(resume)


@router.get("/{resume_id}/pdf-bytes")
async def get_resume_pdf_bytes(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the base64-encoded PDF bytes for a tailored resume (used by the extension)."""
    result = await db.execute(
        select(Resume).where(
            Resume.id == uuid.UUID(resume_id),
            Resume.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {"pdf_bytes": resume.pdf_bytes}


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return full resume details including content/tailored_content."""
    result = await db.execute(
        select(Resume).where(
            Resume.id == uuid.UUID(resume_id),
            Resume.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return _serialize_detail(resume)


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(
            Resume.id == uuid.UUID(resume_id),
            Resume.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    await db.delete(resume)
    return {"deleted": resume_id}
