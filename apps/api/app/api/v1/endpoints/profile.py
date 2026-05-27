import json
import re
import uuid

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, UserProfile, Resume

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    data: dict


class LearnedFieldsRequest(BaseModel):
    fields: dict[str, str]


def _default_profile() -> dict:
    return {
        "phone": "",
        "location": "",
        "linkedin": "",
        "github": "",
        "website": "",
        "headline": "",
        "summary": "",
        "experience": [],
        "education": [],
        "skills": [],
        "work_authorization": "",
        "requires_sponsorship": False,
        "salary_min": None,
        "salary_max": None,
        "salary_currency": "USD",
        "willing_to_relocate": False,
        "relocation_details": "",
        "remote_preference": "flexible",
        "notice_period": "2 weeks",
        "years_experience": None,
        "gender": "",
        "ethnicity": "",
        "disability_status": "",
        "veteran_status": "",
    }


@router.get("/")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    data = {**_default_profile(), **(profile.data if profile else {})}
    return {
        "name": current_user.name,
        "email": current_user.email,
        "data": data,
    }


@router.put("/")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    merged = {**_default_profile(), **body.data}
    if profile is None:
        profile = UserProfile(user_id=current_user.id, data=merged)
        db.add(profile)
    else:
        profile.data = merged
    await db.flush()
    return {
        "name": current_user.name,
        "email": current_user.email,
        "data": profile.data,
    }


@router.post("/import-resume")
async def import_from_resume(
    body: dict = {},
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parse the user's base resume and return extracted profile fields."""
    # Resolve resume — use explicit resume_id or fall back to base resume
    resume_id = body.get("resume_id")
    if resume_id:
        result = await db.execute(
            select(Resume).where(
                Resume.id == uuid.UUID(resume_id),
                Resume.user_id == current_user.id,
            )
        )
    else:
        result = await db.execute(
            select(Resume).where(
                Resume.user_id == current_user.id,
                Resume.type == "base",
            )
        )
    resume = result.scalar_one_or_none()
    if not resume or not resume.content:
        raise HTTPException(status_code=404, detail="No base resume found. Please upload a resume first.")

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt = f"""Extract structured profile information from this resume.
Output ONLY valid JSON (no markdown fences, no explanation) with this exact structure:

{{
  "phone": "",
  "location": "City, State, Country",
  "linkedin": "",
  "github": "",
  "website": "",
  "headline": "Current job title or professional headline",
  "summary": "2-3 sentence professional summary",
  "experience": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Jan 2022 – Present",
      "current": false,
      "bullets": ["Achievement or responsibility"]
    }}
  ],
  "education": [
    {{
      "degree": "BS Computer Science",
      "institution": "University Name",
      "year": "2020"
    }}
  ],
  "skills": ["skill1", "skill2"],
  "years_experience": 5
}}

Rules:
- Extract phone numbers exactly as written
- For location use "City, State" or "City, Country" format
- For linkedin/github/website only include if explicitly present in the resume
- For years_experience calculate from earliest job start to present
- For current: true only if the job says "Present" or "Current"
- Skills should be a flat list of individual skills/technologies
- If a field is not found in the resume, use "" for strings, [] for arrays, null for numbers

RESUME:
{resume.content}"""

    response = client.messages.create(
        model=settings.DEFAULT_AI_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to parse resume — AI response was malformed.")

    try:
        extracted = json.loads(match.group())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse resume — JSON decode error.")

    # Merge extracted data with defaults so we never return missing keys
    defaults = _default_profile()
    merged = {**defaults, **extracted}
    # Preserve non-resume fields (salary, EEO, etc.) as defaults
    for key in ("work_authorization", "requires_sponsorship", "salary_min", "salary_max",
                "salary_currency", "willing_to_relocate", "relocation_details",
                "remote_preference", "notice_period", "gender", "ethnicity",
                "disability_status", "veteran_status"):
        merged[key] = defaults[key]

    return {"data": merged, "resume_name": resume.name}


@router.patch("/learned-fields")
async def save_learned_fields(
    body: LearnedFieldsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    normalized = {k.strip().lower(): v for k, v in body.fields.items() if k.strip() and v.strip()}
    if profile is None:
        profile = UserProfile(
            user_id=current_user.id,
            data={**_default_profile(), "learned_fields": normalized},
        )
        db.add(profile)
    else:
        existing = profile.data.get("learned_fields", {})
        profile.data = {**profile.data, "learned_fields": {**existing, **normalized}}
    await db.flush()
    return {"ok": True, "learned_count": len(normalized)}


@router.put("/name")
async def update_name(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name cannot be empty")
    current_user.name = name
    await db.flush()
    return {"name": current_user.name}
