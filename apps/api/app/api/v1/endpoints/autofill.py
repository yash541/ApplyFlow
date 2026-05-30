import asyncio
import json
import re
from typing import Any

import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, UserProfile, Resume, Application

router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────────

class DetectedFieldIn(BaseModel):
    uid: str
    kind: str
    confidence: float
    input_type: str
    label: str
    selector: str


class MatchRequest(BaseModel):
    fields: list[DetectedFieldIn]
    url: str = ""
    job_context: str = ""   # optional job title / company for cover letter AI


class FieldMatchOut(BaseModel):
    uid: str
    kind: str
    value: str | None
    source: str   # "rules" | "ai" | "none"
    confidence: float


class MatchResponse(BaseModel):
    matches: list[FieldMatchOut]
    resume_id: str | None = None    # tailored resume ID for this URL (has pdf_bytes), if available
    resume_name: str | None = None  # display name for the resume


# ── Location parser ───────────────────────────────────────────────────────────

def _parse_location(location: str) -> dict[str, str]:
    parts = [p.strip() for p in location.split(",")]
    return {
        "city":    parts[0] if len(parts) > 0 else "",
        "state":   parts[1] if len(parts) > 1 else "",
        "country": parts[2] if len(parts) > 2 else "",
    }


# ── Rules matcher ─────────────────────────────────────────────────────────────

def _rules_match(kind: str, profile: dict, name: str, email: str) -> str | None:
    loc = _parse_location(profile.get("location", ""))

    min_s    = profile.get("salary_min")
    max_s    = profile.get("salary_max")
    currency = profile.get("salary_currency", "USD")
    if min_s and max_s:
        salary_val = f"{currency} {int(min_s):,} – {int(max_s):,}"
    elif min_s:
        salary_val = f"{currency} {int(min_s):,}"
    else:
        salary_val = None

    name_parts = name.split() if name else []

    table: dict[str, Any] = {
        "email":       email,
        "full_name":   name or None,
        "first_name":  name_parts[0] if name_parts else None,
        "last_name":   " ".join(name_parts[1:]) if len(name_parts) > 1 else None,
        "phone":       profile.get("phone") or None,
        "location":    profile.get("location") or None,
        "city":        loc["city"] or None,
        "state":       loc["state"] or None,
        "country":     loc["country"] or None,
        "linkedin":    profile.get("linkedin") or None,
        "github":      profile.get("github") or None,
        "website":     profile.get("website") or None,
        "headline":    profile.get("headline") or None,
        "work_auth":   profile.get("work_authorization") or None,
        "requires_sponsorship": "Yes" if profile.get("requires_sponsorship") else "No",
        "salary":      salary_val,
        "years_experience": str(profile["years_experience"]) if profile.get("years_experience") is not None else None,
        "notice_period":     profile.get("notice_period") or None,
        "remote_preference": profile.get("remote_preference") or None,
        "willing_to_relocate": "Yes" if profile.get("willing_to_relocate") else "No",
        "gender":    profile.get("gender") or None,
        "ethnicity": profile.get("ethnicity") or None,
        "disability": profile.get("disability_status") or None,
        "veteran":   profile.get("veteran_status") or None,
        # file upload — no text value, handled by fill engine in Phase 5
        "resume_file": None,
        "zip":     None,   # rarely stored; leave for AI or manual
        "summary": None,   # handled by AI
        "unknown": None,   # handled by AI
    }

    return table.get(kind)


# ── AI matcher ────────────────────────────────────────────────────────────────

def _ai_match(
    fields: list[DetectedFieldIn],
    profile: dict,
    name: str,
    job_context: str,
) -> dict[str, str | None]:
    """Single Claude call for summary / unknown fields. Returns uid→value map."""
    if not fields:
        return {}

    exp_lines = "\n".join(
        f"  - {e.get('title', '')} at {e.get('company', '')} ({e.get('duration', '')})"
        for e in profile.get("experience", [])[:3]
    )
    skills_text = ", ".join(profile.get("skills", [])[:20])

    profile_ctx = (
        f"Name: {name}\n"
        f"Headline: {profile.get('headline', '')}\n"
        f"Summary: {profile.get('summary', '')}\n"
        f"Recent experience:\n{exp_lines or '  (none)'}\n"
        f"Skills: {skills_text or '(none)'}\n"
        f"Location: {profile.get('location', '')}\n"
    )
    if job_context:
        profile_ctx += f"Applying for: {job_context}\n"

    field_list = "\n".join(
        f'  - uid: "{f.uid}", label: "{f.label}", kind: "{f.kind}"'
        for f in fields
    )

    prompt = (
        "You are filling out a job application form on behalf of the candidate.\n\n"
        f"Candidate profile:\n{profile_ctx}\n"
        f"Form fields that need values:\n{field_list}\n\n"
        "Rules:\n"
        "- For 'summary' / cover-letter kind: write 2–3 sentences, professional tone, "
        "tailored to the candidate's background. Do NOT address it 'Dear Hiring Manager'.\n"
        "- For 'unknown' kind: infer the best short answer from the profile and field label.\n"
        "- If you truly cannot determine a value, use null.\n\n"
        "Output ONLY a valid JSON object mapping uid to string value (or null). "
        "No markdown, no explanation:\n"
        '{"<uid>": "<value or null>", ...}'
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=settings.DEFAULT_AI_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/match", response_model=MatchResponse)
async def match_fields(
    body: MatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile_row = result.scalar_one_or_none()
    profile = profile_row.data if profile_row else {}

    matches: list[FieldMatchOut] = []
    ai_fields: list[DetectedFieldIn] = []
    learned = profile.get("learned_fields", {})

    # Pass 1: rules
    for field in body.fields:
        value = _rules_match(field.kind, profile, current_user.name, current_user.email)
        if value is not None:
            matches.append(FieldMatchOut(
                uid=field.uid,
                kind=field.kind,
                value=value,
                source="rules",
                confidence=0.95,
            ))
        elif field.kind == "unknown" and field.label not in ("(no label)", ""):
            norm = field.label.strip().lower()
            if norm in learned:
                # Learned answer from a previous fill session
                matches.append(FieldMatchOut(
                    uid=field.uid,
                    kind=field.kind,
                    value=learned[norm],
                    source="rules",
                    confidence=0.8,
                ))
            else:
                ai_fields.append(field)
        elif field.kind == "summary" and field.label not in ("(no label)", ""):
            # Queue for AI
            ai_fields.append(field)
        else:
            # For known-kind fields with no profile value, check learned_fields by label
            # (e.g. website / salary the user saved from a previous manual fill).
            norm = field.label.strip().lower()
            if norm and norm not in ("(no label)",) and norm in learned:
                matches.append(FieldMatchOut(
                    uid=field.uid,
                    kind=field.kind,
                    value=learned[norm],
                    source="rules",
                    confidence=0.8,
                ))
            else:
                matches.append(FieldMatchOut(
                    uid=field.uid,
                    kind=field.kind,
                    value=None,
                    source="none",
                    confidence=0.0,
                ))

    # Pass 2: AI for summary / unknown fields
    # Enrich job_context: prefer stored JD from the tracked application over the
    # caller-supplied string, which is often empty when coming from the ATS form page.
    effective_job_context = body.job_context or ""
    if body.url and not effective_job_context:
        try:
            jd_result = await db.execute(
                select(Application.job_description, Application.company, Application.role).where(
                    Application.user_id == current_user.id,
                    Application.job_url == body.url,
                ).order_by(Application.applied_at.desc()).limit(1)
            )
            jd_row = jd_result.first()
            if jd_row and jd_row.job_description:
                effective_job_context = (
                    f"Role: {jd_row.role} at {jd_row.company}\n\n"
                    f"{jd_row.job_description[:3000]}"
                )
        except Exception:
            pass  # best-effort — proceed without JD

    if ai_fields:
        ai_values: dict[str, str | None] = {}
        if settings.ANTHROPIC_API_KEY:
            try:
                ai_values = _ai_match(ai_fields, profile, current_user.name, effective_job_context)
            except Exception:
                pass  # fall through with empty dict; fields still appear for manual fill
        for field in ai_fields:
            value = ai_values.get(field.uid)
            # json.loads may return Python None instead of the string "null"
            if isinstance(value, str) and value.strip().lower() == "null":
                value = None
            matches.append(FieldMatchOut(
                uid=field.uid,
                kind=field.kind,
                value=value if isinstance(value, str) else None,
                source="ai" if value else "none",
                confidence=0.75 if value else 0.0,
            ))

    # Resolve best resume for file upload — tailored PDF for this URL's application
    best_resume_id = None
    best_resume_name = None
    if body.url:
        app_result = await db.execute(
            select(Application).where(
                Application.user_id == current_user.id,
                Application.job_url == body.url,
            ).order_by(Application.applied_at.desc())
        )
        application = app_result.scalars().first()  # most recent if duplicates exist
        if application:
            resume_result = await db.execute(
                select(Resume).where(
                    Resume.application_id == application.id,
                    Resume.user_id == current_user.id,
                    Resume.type == "tailored",
                    Resume.pdf_bytes.isnot(None),
                ).order_by(Resume.created_at.desc())
            )
            tailored = resume_result.scalars().first()
            if tailored:
                best_resume_id = str(tailored.id)
                best_resume_name = tailored.name

    return MatchResponse(matches=matches, resume_id=best_resume_id, resume_name=best_resume_name)


# ── Single-field regenerate ───────────────────────────────────────────────────

class RegenerateFieldRequest(BaseModel):
    uid: str
    kind: str
    label: str
    current_value: str = ""
    url: str = ""                 # to look up stored JD
    page_text: str = ""           # scraped page text as JD fallback (first 3000 chars)


class RegenerateFieldResponse(BaseModel):
    uid: str
    value: str | None
    confidence: float


@router.post("/regenerate-field", response_model=RegenerateFieldResponse)
async def regenerate_field(
    body: RegenerateFieldRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Re-generate a single AI field with full JD context.
    Priority for JD: stored application.job_description > scraped page_text > none.
    """
    # Load profile
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile_row = profile_result.scalar_one_or_none()
    profile = profile_row.data if profile_row else {}

    # Build job context — prefer stored JD, fall back to page_text scrape
    job_context = ""
    if body.url:
        try:
            jd_result = await db.execute(
                select(Application.job_description, Application.company, Application.role).where(
                    Application.user_id == current_user.id,
                    Application.job_url == body.url,
                ).order_by(Application.applied_at.desc()).limit(1)
            )
            row = jd_result.first()
            if row and row.job_description:
                job_context = f"Role: {row.role} at {row.company}\n\n{row.job_description[:3000]}"
        except Exception:
            pass

    if not job_context and body.page_text:
        job_context = body.page_text[:3000]

    # Build prompt
    exp_lines = "\n".join(
        f"  - {e.get('title','')} at {e.get('company','')} ({e.get('duration','')})"
        for e in profile.get("experience", [])[:3]
    )
    skills_text = ", ".join(profile.get("skills", [])[:20])

    profile_ctx = (
        f"Name: {current_user.name}\n"
        f"Headline: {profile.get('headline','')}\n"
        f"Summary: {profile.get('summary','')}\n"
        f"Experience:\n{exp_lines or '  (none)'}\n"
        f"Skills: {skills_text or '(none)'}\n"
        f"Years experience: {profile.get('years_experience','')}\n"
    )

    field_info = (
        f"Field label: \"{body.label}\"\n"
        f"Field kind: {body.kind}\n"
        f"Current value (may be wrong): \"{body.current_value}\"\n"
    )

    jd_section = f"\nJob description context:\n{job_context}" if job_context else ""

    prompt = (
        "You are filling out a job application form on behalf of the candidate.\n\n"
        f"Candidate profile:\n{profile_ctx}"
        f"{jd_section}\n\n"
        f"Field to fill:\n{field_info}\n"
        "Rules:\n"
        "- Provide the single best answer for this specific field\n"
        "- Use the job description to pick the most appropriate option when relevant\n"
        "- For experience/years dropdowns: pick the option that matches the candidate's actual experience\n"
        "- Output ONLY the answer text, no explanation, no quotes\n"
        "- If you truly cannot determine a value, output null\n\n"
        "Answer:"
    )

    if not settings.ANTHROPIC_API_KEY:
        return RegenerateFieldResponse(uid=body.uid, value=None, confidence=0.0)

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=settings.DEFAULT_AI_MODEL,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.lower() in ("null", "none", ""):
            return RegenerateFieldResponse(uid=body.uid, value=None, confidence=0.0)
        return RegenerateFieldResponse(uid=body.uid, value=raw, confidence=0.85)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI regeneration failed: {exc}") from exc


# ── Smart match ───────────────────────────────────────────────────────────────
# New architecture: field detector scrapes raw questions + options.
# We fire one concurrent Claude call per field (profile + question → answer).
# Total latency = slowest single call, not the sum of all calls.

class ScrapedFieldIn(BaseModel):
    uid: str
    question: str
    field_type: str
    options: list[str] = []
    selector: str


class SmartMatchRequest(BaseModel):
    fields: list[ScrapedFieldIn]
    url: str = ""
    job_context: str = ""


class SmartAnswerOut(BaseModel):
    uid: str
    answer: str
    confidence: str  # "high" | "medium" | "low"
    skipped: bool = False


async def _answer_one_field(
    field: ScrapedFieldIn,
    profile: dict,
    job_context: str,
    client: anthropic.AsyncAnthropic,
    model: str,
) -> SmartAnswerOut:
    """Ask Claude to answer a single form field given the user's profile."""

    # File upload fields — Claude can't fill these, skip immediately
    if field.field_type == "file":
        return SmartAnswerOut(uid=field.uid, answer="", confidence="low", skipped=True)

    # Build the options block for radio/select
    options_block = ""
    if field.options:
        opts = "\n".join(f"  - {o}" for o in field.options)
        options_block = f"\nAvailable options (pick exactly one):\n{opts}"

    job_ctx = f"\nJob context: {job_context[:500]}" if job_context else ""

    prompt = (
        f"You are filling out a job application form on behalf of the candidate.\n"
        f"Use ONLY the information provided in the profile below. Never fabricate facts.\n\n"
        f"Profile:\n{json.dumps(profile, indent=2)[:3000]}\n"
        f"{job_ctx}\n\n"
        f"Form question: {field.question}"
        f"{options_block}\n\n"
        "Rules:\n"
        "- If options are given, respond with EXACTLY one of the option strings and nothing else.\n"
        "- For text/textarea fields, respond with a concise, accurate answer.\n"
        "- If you truly cannot determine the answer from the profile, respond with: null\n\n"
        "Answer:"
    )

    try:
        msg = await client.messages.create(
            model=model,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()

        if raw.lower() in ("null", "none", "n/a", ""):
            return SmartAnswerOut(uid=field.uid, answer="", confidence="low", skipped=True)

        # Validate option match for radio/select fields
        if field.options:
            # Case-insensitive match against provided options
            match = next((o for o in field.options if o.lower() == raw.lower()), None)
            if match:
                return SmartAnswerOut(uid=field.uid, answer=match, confidence="high")
            # Partial match fallback
            partial = next((o for o in field.options if raw.lower() in o.lower() or o.lower() in raw.lower()), None)
            if partial:
                return SmartAnswerOut(uid=field.uid, answer=partial, confidence="medium")
            # Claude returned something outside the options — use as-is but low confidence
            return SmartAnswerOut(uid=field.uid, answer=raw, confidence="low")

        confidence = "high" if len(raw) > 2 else "medium"
        return SmartAnswerOut(uid=field.uid, answer=raw, confidence=confidence)

    except Exception:
        return SmartAnswerOut(uid=field.uid, answer="", confidence="low", skipped=True)


@router.post("/smart-match")
async def smart_match(
    body: SmartMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Answer all scraped form fields concurrently.
    One Claude call per field, all fired in parallel.
    Total latency ≈ slowest single field, not the sum.
    """
    # Load user profile
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile_row = result.scalar_one_or_none()
    profile: dict = {}
    if profile_row:
        profile = profile_row.data or {}
    profile["name"] = current_user.name
    profile["email"] = current_user.email

    if not settings.ANTHROPIC_API_KEY or not body.fields:
        return {"answers": []}

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    model  = settings.DEFAULT_AI_MODEL

    # Fire all fields concurrently
    tasks = [
        _answer_one_field(field, profile, body.job_context, client, model)
        for field in body.fields
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    answers = []
    for res in results:
        if isinstance(res, SmartAnswerOut):
            answers.append(res)

    return {"answers": answers}
