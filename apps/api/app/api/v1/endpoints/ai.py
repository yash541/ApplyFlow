import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Resume, Application

router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────────

class JobMatchRequest(BaseModel):
    job_title: str
    company: str
    description: str
    url: str
    resume_id: str | None = None


class MatchResponse(BaseModel):
    overall_score: int
    skill_match: int
    experience_match: int
    missing_keywords: list[str]
    matching_keywords: list[str]


class TailorRequest(BaseModel):
    # Pass either DB IDs (preferred) or raw text as fallback
    resume_id: str | None = None          # fetch base resume text from DB
    application_id: str | None = None     # fetch job description from DB

    resume_text: str | None = None        # fallback if resume_id not provided
    job_description: str | None = None    # fallback if application_id not provided


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    context: str | None = None


class JobExtractionRequest(BaseModel):
    page_text: str           # raw innerText from the page (truncated by caller)
    url: str
    portal: str | None = None


class JobExtractionResponse(BaseModel):
    title: str | None = None
    company: str | None = None
    location: str | None = None
    description: str | None = None
    confidence: float = 0.0
    extracted_by: str = "ai"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/match", response_model=MatchResponse)
async def match_job(request: JobMatchRequest):
    """Analyze how well a resume matches a job description."""
    score = 75
    return MatchResponse(
        overall_score=score,
        skill_match=score + 5,
        experience_match=score - 3,
        missing_keywords=["TypeScript", "System Design"],
        matching_keywords=["React", "Python", "FastAPI", "PostgreSQL"],
    )


@router.post("/tailor")
async def tailor_resume(
    request: TailorRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream AI-tailored resume JSON.

    Resolves inputs in priority order:
      1. resume_id  → fetch content from DB (base resume)
      2. resume_text → use as-is (legacy / extension path)
      3. Neither → 400

    Same for job description:
      1. application_id → fetch job_description from applications table
      2. job_description → use as-is
      3. Neither → 400
    """
    # ── Resolve resume text ───────────────────────────────────────────────────
    resume_text = request.resume_text

    if request.resume_id:
        result = await db.execute(
            select(Resume).where(
                Resume.id == uuid.UUID(request.resume_id),
                Resume.user_id == current_user.id,
            )
        )
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        resume_text = resume.content or ""

    if not resume_text:
        raise HTTPException(status_code=400, detail="Provide resume_id or resume_text")

    # ── Resolve job description ───────────────────────────────────────────────
    job_description = request.job_description

    if request.application_id:
        result = await db.execute(
            select(Application).where(
                Application.id == uuid.UUID(request.application_id),
                Application.user_id == current_user.id,
            )
        )
        application = result.scalar_one_or_none()
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        job_description = application.job_description or ""

    if not job_description:
        raise HTTPException(status_code=400, detail="Provide application_id or job_description")

    # ── Stream AI response ────────────────────────────────────────────────────
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    system_prompt = """You are an expert resume writer and ATS optimization specialist.
Given a resume and a job description, parse the resume and rewrite it with tailored content.

Output ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{
  "name": "Full Name from resume",
  "contact": {"email": "...", "phone": "...", "location": "...", "linkedin": "..."},
  "summary": "2-3 sentence professional summary tailored to the role",
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "duration": "Jan 2022 – Present",
      "bullets": ["Led X to achieve Y, resulting in Z%", "bullet 2", "bullet 3"]
    }
  ],
  "education": [
    {"institution": "University Name", "degree": "BS Computer Science", "year": "2020"}
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "keywords_added": ["keyword1", "keyword2"],
  "ats_score": 85
}

Rules:
- Lead bullets with strong action verbs
- Quantify achievements where possible (use % or numbers)
- Naturally weave in keywords from the job description
- Keep each bullet concise (under 2 lines)
- If a field is absent from the resume, use an empty string or empty array
- ats_score is 0-100 reflecting how well this tailored resume matches the job"""

    captured_resume_text = resume_text
    captured_job_description = job_description

    async def generate():
        try:
            with client.messages.stream(
                model=settings.DEFAULT_AI_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": f"RESUME:\n{captured_resume_text}\n\nJOB DESCRIPTION:\n{captured_job_description}",
                    }
                ],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'chunk': f'⚠️ AI error: {e}'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/extract-job", response_model=JobExtractionResponse)
async def extract_job(
    request: JobExtractionRequest,
    current_user: User = Depends(get_current_user),
):
    """AI fallback extraction — called when DOM selectors fail on a portal.

    Parses raw page text and returns structured job fields. Used by the
    extension's runtime-manager after scrapeWithRetries exhausts all attempts.
    """
    text = request.page_text[:8000]  # hard cap — model context is not free
    if not text.strip():
        raise HTTPException(status_code=422, detail="page_text is empty")

    portal_hint = f"Portal: {request.portal}\n" if request.portal else ""
    prompt = (
        f"{portal_hint}"
        f"URL: {request.url}\n\n"
        f"Extract the job posting from the page text below. "
        f"Return ONLY valid JSON — no markdown fences, no explanation:\n"
        f"{{\n"
        f'  "title": "exact job title or null",\n'
        f'  "company": "company name or null",\n'
        f'  "location": "city/state/Remote or null",\n'
        f'  "description": "first 400 chars of responsibilities/requirements or null",\n'
        f'  "confidence": 0.0\n'
        f"}}\n\n"
        f"confidence is 0.0–1.0 based on certainty. "
        f"Return confidence < 0.4 if title or company cannot be found.\n\n"
        f"PAGE TEXT:\n{text}"
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        msg = client.messages.create(
            model=settings.DEFAULT_AI_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return JobExtractionResponse(
            title=data.get("title") or None,
            company=data.get("company") or None,
            location=data.get("location") or None,
            description=data.get("description") or None,
            confidence=float(data.get("confidence", 0.0)),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {exc}") from exc


@router.post("/chat")
async def chat(request: ChatRequest):
    """Stream AI career copilot response."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    system_prompt = """You are an expert career coach and job search strategist with deep knowledge of:
    - Resume writing and ATS optimization
    - Interview preparation (behavioral, technical, system design)
    - Salary negotiation tactics
    - LinkedIn profile optimization
    - Job search strategy and networking
    Be concise, actionable, and specific. Format responses in markdown."""

    async def generate():
        try:
            with client.messages.stream(
                model=settings.DEFAULT_AI_MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": request.message}],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'chunk': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'chunk': f'⚠️ AI error: {e}'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
