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
from app.core.usage import check_and_increment_usage
from app.models import User, Resume, Application, UserProfile

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
    score_basis: str = "full_jd"   # "full_jd" | "title_only"
    reasoning: str = ""
    profile_complete: bool = True  # False when profile has no skills/experience


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
async def match_job(
    request: JobMatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Score how well the candidate's profile matches a job.

    Tier 1 — Full JD scoring (description > 150 chars):
      Skills overlap, experience level, role alignment, education — all 4 components.

    Tier 2 — Title-only scoring (no JD or JD too short):
      Claude infers likely requirements from the job title + company name alone.
      Score is marked score_basis="title_only" so the UI can show it as estimated (~68).
    """
    # Gate: check + increment usage for free users
    await check_and_increment_usage(current_user, db, "match_scores")
    await db.commit()

    if not settings.ANTHROPIC_API_KEY:
        return MatchResponse(
            overall_score=70, skill_match=70, experience_match=70,
            missing_keywords=[], matching_keywords=[],
            score_basis="title_only", reasoning="No API key configured",
        )

    # Load profile
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile_row = result.scalar_one_or_none()
    profile_data: dict = profile_row.data or {} if profile_row else {}

    # Build compact candidate snapshot for the prompt
    skills        = ", ".join(profile_data.get("skills", [])[:30]) or "not specified"
    years_exp     = profile_data.get("years_experience") or "not specified"
    exp_list      = profile_data.get("experience", [])
    current_title = exp_list[0].get("title", "") if exp_list else ""
    current_co    = exp_list[0].get("company", "") if exp_list else ""
    edu_list      = profile_data.get("education", [])
    education     = edu_list[0].get("degree", "") + " " + edu_list[0].get("institution", "") if edu_list else "not specified"
    summary       = str(profile_data.get("summary", ""))[:300]

    has_jd    = len(request.description.strip()) > 150
    jd_block  = request.description[:2000] if has_jd else ""
    basis     = "full_jd" if has_jd else "title_only"
    profile_complete = bool(profile_data.get("skills") or profile_data.get("experience"))

    if has_jd:
        prompt = f"""You are a technical recruiter scoring a candidate's fit for a job.

Candidate profile:
- Skills: {skills}
- Years of experience: {years_exp}
- Current/recent role: {current_title} at {current_co}
- Education: {education}
- Summary: {summary}

Job posting:
- Title: {request.job_title}
- Company: {request.company}
- Description: {jd_block}

Score this candidate (0-100 for each):
- skill_match: % of required/preferred skills in the JD that the candidate has
- experience_match: how well their years and seniority level match the JD requirements
- title_match: how closely their recent role aligns with this role
- education_match: how well their education meets the JD requirements

overall_score = skill_match*0.45 + experience_match*0.30 + title_match*0.15 + education_match*0.10

Return ONLY valid JSON, no explanation:
{{
  "overall_score": <int 0-100>,
  "skill_match": <int 0-100>,
  "experience_match": <int 0-100>,
  "matching_skills": ["skill1", "skill2"],
  "missing_skills": ["skill3", "skill4"],
  "reasoning": "<one sentence explaining the score>"
}}"""
    else:
        prompt = f"""You are a technical recruiter scoring a candidate's fit for a role.
You do NOT have the full job description — score based on the job title and company only.

Candidate profile:
- Skills: {skills}
- Years of experience: {years_exp}
- Current/recent role: {current_title} at {current_co}
- Education: {education}

Job: {request.job_title} at {request.company}

Infer typical requirements for this type of role at this company, then score the candidate.
Be honest — if the title/company gives little signal, reflect that with a mid-range score.

Return ONLY valid JSON:
{{
  "overall_score": <int 0-100>,
  "skill_match": <int 0-100>,
  "experience_match": <int 0-100>,
  "matching_skills": ["skill1"],
  "missing_skills": ["skill2"],
  "reasoning": "<one sentence — note this is estimated from title only>"
}}"""

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=settings.FAST_AI_MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if Claude wraps the JSON
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)

        return MatchResponse(
            overall_score=max(0, min(100, int(data.get("overall_score", 65)))),
            skill_match=max(0, min(100, int(data.get("skill_match", 65)))),
            experience_match=max(0, min(100, int(data.get("experience_match", 65)))),
            matching_keywords=data.get("matching_skills", [])[:10],
            missing_keywords=data.get("missing_skills", [])[:10],
            score_basis=basis,
            reasoning=str(data.get("reasoning", ""))[:200],
            profile_complete=profile_complete,
        )
    except Exception as exc:
        # Fallback — never block the page load
        return MatchResponse(
            overall_score=65, skill_match=65, experience_match=65,
            missing_keywords=[], matching_keywords=[],
            score_basis=basis, reasoning=f"Scoring unavailable: {exc}",
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

STEP 1 — ATS PARSER (do this silently before writing anything):
Read the job description and extract every keyword, skill, tool, qualification,
and requirement an ATS will scan for. Group them mentally into:
  • Hard skills / technologies
  • Soft skills / competencies
  • Role-specific verbs and phrases
  • Certifications, degrees, or clearances mentioned
  • Years-of-experience thresholds

STEP 2 — SCORE THE ORIGINAL RESUME:
Count what percentage of those extracted ATS keywords already appear in the
candidate's resume. Record this as ats_score_before (0–100).

STEP 3 — REWRITE:
Rewrite the resume bullets and summary to mirror the JD language naturally,
keeping every real accomplishment intact. Do NOT invent experience.
Mirror exact phrases where they fit; paraphrase where a direct copy would
feel forced. Lead every bullet with a strong action verb. Quantify wherever
the original gives you numbers to work with.

STEP 4 — EXTRA SECTIONS:
If the JD requires skills, certifications, or section types the candidate's
resume is missing AND those gaps could be addressed with content from their
background, add the relevant extra section(s) — e.g. Certifications, Projects,
Languages, Publications, Awards, Volunteer Work. Only add sections that are
genuinely supported by the candidate's experience; never fabricate credentials.

STEP 5 — QUALITY CHECK:
For each keyword you added, ask: would a human recruiter reading this bullet
notice it feels stuffed or unnatural? If yes, add it to keyword_stuffing_flags
so the user knows to review it manually.

STEP 6 — SCORE THE TAILORED RESUME:
Re-count ATS keyword coverage after your rewrites. Record as ats_score (0–100).

Output ONLY valid JSON (no markdown fences, no explanation):
{
  "name": "Full Name from resume",
  "contact": {"email": "...", "phone": "...", "location": "...", "linkedin": "...", "github": "...", "website": "..."},
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
  "ats_score_before": 42,
  "ats_score": 87,
  "keyword_stuffing_flags": ["phrase that felt forced", "another one"],
  "customSections": [
    {
      "id": "custom_1",
      "label": "Certifications",
      "items": [
        {"title": "AWS Solutions Architect – Associate", "subtitle": "Amazon Web Services, 2024", "bullets": []}
      ]
    }
  ]
}

Rules:
- customSections: only include if genuinely needed; use [] if no extra sections required
- keyword_stuffing_flags: list exact phrases you added that a human might find unnatural; [] if none
- ats_score_before and ats_score are integers 0–100
- If a field is absent from the resume use an empty string or empty array
- Never fabricate job titles, companies, dates, degrees, or certifications"""

    captured_resume_text = resume_text
    captured_job_description = job_description

    async def generate():
        try:
            with client.messages.stream(
                model=settings.DEFAULT_AI_MODEL,
                max_tokens=4096,
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


class BulletRewriteRequest(BaseModel):
    bullet: str
    job_description: str = ""
    role: str = ""


@router.post("/rewrite-bullet")
async def rewrite_bullet(
    request: BulletRewriteRequest,
    current_user: User = Depends(get_current_user),
):
    """Rewrite a single resume bullet with stronger language aligned to the JD.
    Returns plain text — the rewritten bullet only, no JSON wrapping."""
    jd_context = f"\nJob description context:\n{request.job_description[:2000]}" if request.job_description else ""
    role_context = f"\nRole: {request.role}" if request.role else ""

    prompt = (
        f"Rewrite this resume bullet to be stronger and more impactful."
        f"{role_context}{jd_context}\n\n"
        f"Current bullet:\n{request.bullet}\n\n"
        "Rules:\n"
        "- Start with a strong action verb\n"
        "- Keep the same core achievement — never fabricate metrics or facts\n"
        "- Quantify naturally if the original gives you numbers to work with\n"
        "- Mirror relevant keywords from the job description without keyword stuffing\n"
        "- Keep it concise — ideally under 200 characters\n"
        "- Output ONLY the rewritten bullet text. No explanation, no bullet symbol, no quotes."
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        msg = client.messages.create(
            model=settings.DEFAULT_AI_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        rewritten = msg.content[0].text.strip().lstrip("•-–").strip()
        return {"bullet": rewritten}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI rewrite failed: {exc}") from exc


class SummaryRewriteRequest(BaseModel):
    summary: str
    headline: str = ""
    experience_titles: list[str] = []


@router.post("/rewrite-summary")
async def rewrite_summary(
    request: SummaryRewriteRequest,
    current_user: User = Depends(get_current_user),
):
    """Rewrite the 'tell us about yourself' summary to be more compelling."""
    headline_ctx = f"\nHeadline: {request.headline}" if request.headline else ""
    exp_ctx = f"\nRoles: {', '.join(request.experience_titles[:3])}" if request.experience_titles else ""

    prompt = (
        f"Rewrite this professional summary to be more compelling and impactful."
        f"{headline_ctx}{exp_ctx}\n\n"
        f"Current summary:\n{request.summary}\n\n"
        "Rules:\n"
        "- Keep it 2–4 sentences, first-person tone\n"
        "- Lead with years of experience and strongest domain\n"
        "- Highlight concrete value the person brings\n"
        "- Keep all factual details — never fabricate\n"
        "- Output ONLY the rewritten summary. No explanation, no quotes."
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        msg = client.messages.create(
            model=settings.DEFAULT_AI_MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"summary": msg.content[0].text.strip()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI rewrite failed: {exc}") from exc


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
