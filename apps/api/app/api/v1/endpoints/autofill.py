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
from app.core.usage import check_and_increment_usage
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


# ── Profile-first field matching ─────────────────────────────────────────────
# These fields are always answerable directly from the profile — no Claude needed.
# Each entry: (list of question substrings to match, profile key to use)

_PROFILE_RULES: list[tuple[list[str], str]] = [
    (["first name", "given name", "forename"],                             "first_name"),
    (["last name", "surname", "family name"],                              "last_name"),
    (["middle name"],                                                      "middle_name"),
    (["full name", "your name", "applicant name", "legal name"],           "name"),
    (["email"],                                                            "email"),
    (["phone", "mobile", "telephone", "cell", "contact number", "whatsapp"], "phone"),
    (["linkedin"],                                                         "linkedin"),
    (["github"],                                                           "github"),
    (["website", "portfolio", "personal url", "homepage"],                 "website"),
    (["current location", "present location", "location", "city", "address"], "location"),
    (["headline", "current title", "designation"],                         "headline"),
    (["summary", "tell us about", "about yourself", "introduce yourself",
      "cover letter", "anything you would like to convey",
      "additional information", "other comments"],                         "summary"),
]


def _try_profile_match(field: ScrapedFieldIn, profile: dict) -> "SmartAnswerOut | None":
    """Answer a field instantly from the profile, skipping Claude entirely.
    Returns None when Claude is needed (radio/select options, or no match)."""
    # Radio/select: Claude must pick the right option text
    if field.field_type in ("radio", "select") and field.options:
        return None

    q = field.question.lower().strip()
    for patterns, key in _PROFILE_RULES:
        if any(p in q for p in patterns):
            raw = profile.get(key, "")
            if raw:
                value = str(raw)[:500] if key == "summary" else str(raw)
                return SmartAnswerOut(uid=field.uid, answer=value, confidence="high")

    # Derived fields not explicitly in _PROFILE_RULES
    exp = profile.get("experience", [])
    edu = profile.get("education", [])

    if any(p in q for p in ["current organization", "current company", "company name", "employer", "organization name"]):
        val = exp[0].get("company", "") if exp else ""
        if val: return SmartAnswerOut(uid=field.uid, answer=val, confidence="high")

    if any(p in q for p in ["college", "university", "institution", "school"]):
        val = edu[0].get("institution", "") if edu else ""
        if val: return SmartAnswerOut(uid=field.uid, answer=val, confidence="high")

    if any(p in q for p in ["degree", "highest qualification", "qualification"]):
        val = edu[0].get("degree", "") if edu else ""
        if val: return SmartAnswerOut(uid=field.uid, answer=val, confidence="high")

    return None


def _build_compact_profile(profile: dict) -> str:
    """
    Build a compact, flat profile string with the most answerable fields first.
    Avoids the 3000-char truncation swallowing critical fields like name/email
    that we add after the large profile.data blob.
    """
    # Critical identity fields — always first, always present
    lines = [
        f"full_name: {profile.get('name', '')}",
        f"first_name: {profile.get('first_name', '')}",
        f"last_name: {profile.get('last_name', '')}",
        f"middle_name: {profile.get('middle_name', '')}",
        f"email: {profile.get('email', '')}",
        f"phone: {profile.get('phone', profile.get('phone_number', ''))}",
        f"location: {profile.get('location', '')}",
        f"linkedin_url: {profile.get('linkedin', '')}",
        f"github_url: {profile.get('github', '')}",
        f"website: {profile.get('website', '')}",
        f"headline: {profile.get('headline', '')}",
        f"work_authorization: {profile.get('work_authorization', '')}",
        f"requires_sponsorship: {profile.get('requires_sponsorship', '')}",
        f"years_experience: {profile.get('years_experience', '')}",
        f"notice_period: {profile.get('notice_period', '')}",
        f"salary_min: {profile.get('salary_min', '')}",
        f"salary_max: {profile.get('salary_max', '')}",
        f"salary_currency: {profile.get('salary_currency', 'USD')}",
        f"remote_preference: {profile.get('remote_preference', '')}",
        f"willing_to_relocate: {profile.get('willing_to_relocate', '')}",
        f"gender: {profile.get('gender', '')}",
        f"ethnicity: {profile.get('ethnicity', '')}",
        f"disability_status: {profile.get('disability_status', '')}",
        f"veteran_status: {profile.get('veteran_status', '')}",
        f"summary: {str(profile.get('summary', ''))[:300]}",
        f"skills: {', '.join(profile.get('skills', [])[:20])}",
    ]

    # Current job — most relevant experience entry
    exp = profile.get("experience", [])
    if exp:
        j = exp[0]
        lines.append(f"current_company: {j.get('company', '')}")
        lines.append(f"current_title: {j.get('title', '')}")
        lines.append(f"current_duration: {j.get('duration', '')}")

    # Education
    edu = profile.get("education", [])
    if edu:
        e = edu[0]
        lines.append(f"degree: {e.get('degree', '')}")
        lines.append(f"institution: {e.get('institution', '')}")
        lines.append(f"graduation_year: {e.get('year', '')}")

    return "\n".join(l for l in lines if not l.endswith(": "))


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

    job_ctx = f"\nJob context: {job_context[:400]}" if job_context else ""

    compact_profile = _build_compact_profile(profile)

    prompt = (
        f"Fill in this job application field for the candidate. "
        f"Output ONLY the answer value — no explanation, no reasoning, no extra text.\n\n"
        f"Candidate profile:\n{compact_profile}\n"
        f"{job_ctx}\n\n"
        f"Field: {field.question}"
        f"{options_block}\n\n"
        "Output rules:\n"
        "- Output ONLY the raw answer. Nothing else. No sentences, no quotes, no explanation.\n"
        "- If options are listed, output EXACTLY one option string, verbatim.\n"
        "- For URL fields: output the full URL (e.g. https://linkedin.com/in/...).\n"
        "- If the profile has no relevant data at all, output exactly: null\n\n"
        "Answer:"
    )

    try:
        msg = await client.messages.create(
            model=model,
            max_tokens=150,
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
    # Gate: check + increment usage for free users
    await check_and_increment_usage(current_user, db, "autofill_sessions")
    await db.commit()

    # Load user profile
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile_row = result.scalar_one_or_none()
    profile: dict = {}
    if profile_row:
        profile = profile_row.data or {}
    # Always use authoritative values from the user record — never trust stale profile data
    profile["name"]  = current_user.name
    profile["email"] = current_user.email

    # Always derive first / last name from the authoritative full name
    if current_user.name:
        parts = current_user.name.strip().split()
        profile["first_name"] = parts[0] if parts else ""
        profile["last_name"]  = parts[-1] if len(parts) > 1 else ""
        profile["middle_name"] = " ".join(parts[1:-1]) if len(parts) > 2 else ""

    # Mirror phone so Claude sees it regardless of which key it looks for
    if profile.get("phone"):
        profile["phone_number"] = profile["phone"]

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


# Maps form label text (lower-cased) → profile dict key.
# Used to promote saved learned_fields back to the top-level profile.
_LABEL_TO_KEY: dict[str, str] = {
    "first name": "first_name",    "given name": "first_name",
    "last name":  "last_name",     "surname":    "last_name",
    "middle name":"middle_name",
    "full name":  "name",          "your name":  "name",
    "email":      "email",         "email address": "email",
    "phone":      "phone",         "phone number": "phone",
    "mobile":     "phone",         "mobile phone number": "phone",
    "linkedin":   "linkedin",      "linkedin url": "linkedin",
    "github":     "github",        "github url":   "github",
    "website":    "website",       "portfolio":    "website",
    "location":   "location",      "current location": "location",
    "city":       "city",
    "headline":   "headline",      "current title": "headline",
    "summary":    "summary",       "about yourself": "summary",
}


def _prepare_profile(current_user: "User", profile_data: dict) -> dict:
    """
    Build the profile dict that Claude and profile-first matching will use.

    Priority order for each field:
      1. learned_fields saved by the user (they explicitly corrected a value)
      2. Explicit profile fields set in the Profile page
      3. Values derived from current_user.name / email (authoritative DB fields)
    """
    profile = dict(profile_data)

    # Promote learned_fields into the top-level profile so matching finds them.
    # learned_fields are keyed by the raw form label (lower-cased), e.g. "first name".
    learned: dict[str, str] = profile.pop("learned_fields", {}) or {}
    for label, value in learned.items():
        key = _LABEL_TO_KEY.get(label.strip().lower())
        if key and value:
            profile[key] = value  # user-confirmed correction takes priority

    # Always set authoritative values from the DB user record
    profile["name"]  = current_user.name
    profile["email"] = current_user.email

    # Derive first/last name only if not already set by learned_fields or explicit profile.
    # Validate: the stored value must be a substring of the current full name.
    # If not (e.g. stale test data "Karthik"), fall back to the derived split.
    if current_user.name:
        parts = current_user.name.strip().split()
        full_lower = current_user.name.lower()

        stored_first = profile.get("first_name", "")
        if not stored_first or stored_first.lower() not in full_lower:
            profile["first_name"] = parts[0] if parts else ""

        stored_last = profile.get("last_name", "")
        if not stored_last or stored_last.lower() not in full_lower:
            profile["last_name"] = parts[-1] if len(parts) > 1 else ""

        if not profile.get("middle_name"):
            profile["middle_name"] = " ".join(parts[1:-1]) if len(parts) > 2 else ""

    if profile.get("phone"):
        profile["phone_number"] = profile["phone"]
    return profile


@router.post("/smart-match-stream")
async def smart_match_stream(
    body: SmartMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream field answers as SSE.

    Tier 1 — Profile-first: matched fields emit instantly  (<10ms)
    Tier 2 — Claude Haiku:  remaining fields fire concurrently, each emits as it completes (~400ms)

    Total perceived latency = time for first answer to appear, not time for all answers.
    """
    # Gate: check + increment usage for free users
    await check_and_increment_usage(current_user, db, "autofill_sessions")
    await db.commit()

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    profile_row = result.scalar_one_or_none()
    profile = _prepare_profile(current_user, profile_row.data or {} if profile_row else {})

    # Haiku — 5× faster than Sonnet for short answers, more than capable for form filling
    haiku = settings.FAST_AI_MODEL
    client = (
        anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        if settings.ANTHROPIC_API_KEY else None
    )

    async def generate():
        remaining: list[ScrapedFieldIn] = []

        # Tier 1: answer from profile instantly
        for field in body.fields:
            matched = _try_profile_match(field, profile)
            if matched:
                yield f"data: {matched.model_dump_json()}\n\n"
            else:
                remaining.append(field)

        if not remaining or not client:
            yield "data: [DONE]\n\n"
            return

        # Tier 2: concurrent Haiku calls — yield each as it completes
        loop = asyncio.get_event_loop()
        tasks = [
            loop.create_task(
                _answer_one_field(field, profile, body.job_context, client, haiku)
            )
            for field in remaining
        ]
        for coro in asyncio.as_completed(tasks):
            try:
                res = await coro
                yield f"data: {res.model_dump_json()}\n\n"
            except Exception:
                pass

        yield "data: [DONE]\n\n"

    from fastapi.responses import StreamingResponse as SR
    return SR(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
