"""
Multi-provider job search.

Architecture:
  • Fast providers (JSearch, Adzuna) run in parallel — results < 2s
  • Apify runs asynchronously — start a run, poll for results
  • Results are deduplicated by normalised company+title

Storage: profile.data.job_apis = [
    {"provider": "jsearch", "key": "...", "enabled": True},
    {"provider": "adzuna", "key": "...", "app_id": "...", "enabled": True},
    {"provider": "apify",  "key": "...", "actor_id": "...", "enabled": True},
]
"""
import asyncio
import re
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, UserProfile

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class ApifyActor(BaseModel):
    id: str = ""            # internal UUID for list management
    label: str = ""         # user display name e.g. "Google Jobs"
    actor_id: str = ""      # e.g. "johnvc~Google-Jobs-Scraper"
    enabled: bool = True
    # Phase 2: per-actor input mapping and discovered schema
    input_mapping: dict = {}    # e.g. {"query": "queries", "country": "countryCode"}
    schema_fields: list = []    # discovered input field names (for reference)
    # Phase 3: Claude-assisted output mapping
    output_mapping: dict = {}   # e.g. {"title": "title", "company": "companyName", "url": "applyLink"}


class ProviderConfig(BaseModel):
    provider: str           # "jsearch" | "adzuna" | "apify"
    key: str
    app_id: str = ""
    actor_id: str = ""      # legacy single actor — kept for backward compat
    actors: list[ApifyActor] = []  # multi-actor list (Apify only)
    enabled: bool = True


class SaveConfigsRequest(BaseModel):
    configs: list[ProviderConfig]


# ── Profile helpers ───────────────────────────────────────────────────────────

async def _get_profile_data(db: AsyncSession, user_id) -> dict:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    row = result.scalar_one_or_none()
    return dict(row.data) if row else {}


def _migrate_legacy_actor(cfg: dict) -> dict:
    """Migrate old single actor_id → actors list on first read."""
    if cfg.get("provider") == "apify" and cfg.get("actor_id") and not cfg.get("actors"):
        import uuid as _uuid
        cfg["actors"] = [{
            "id": str(_uuid.uuid4()),
            "label": "Default",
            "actor_id": cfg["actor_id"],
            "enabled": True,
        }]
    return cfg


async def _get_configs(db: AsyncSession, user_id) -> list[ProviderConfig]:
    data = await _get_profile_data(db, user_id)
    if "job_apis" in data:
        return [ProviderConfig(**_migrate_legacy_actor(c)) for c in data["job_apis"]]
    if "job_api" in data and data["job_api"].get("key"):
        return [ProviderConfig(**_migrate_legacy_actor(data["job_api"]))]
    return []


# ── Deduplication ─────────────────────────────────────────────────────────────

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _dedup(jobs: list[dict]) -> tuple[list[dict], int]:
    """Returns (deduped_list, duplicates_removed_count)."""
    seen: set[str] = set()
    out: list[dict] = []
    for j in jobs:
        key = _norm(j.get("company", "")) + ":" + _norm(j.get("title", ""))
        url_key = _norm(j.get("url", ""))
        if key in seen or (url_key and url_key in seen):
            continue
        seen.add(key)
        if url_key:
            seen.add(url_key)
        out.append(j)
    return out, len(jobs) - len(out)


# ── JSearch ───────────────────────────────────────────────────────────────────

COUNTRY_NAMES = {
    "in": "India", "us": "United States", "gb": "United Kingdom",
    "au": "Australia", "ca": "Canada", "sg": "Singapore", "de": "Germany",
}

async def _jsearch(q: str, location: str, key: str, filters: dict | None = None) -> list[dict]:
    f = filters or {}
    # JSearch doesn't have a country param — append country name to query
    country_name = COUNTRY_NAMES.get(f.get("country", "in"), "")
    loc_part = location or (country_name if not f.get("remote_only") else "")
    query = f"{q} {loc_part}".strip()
    if f.get("remote_only"):
        query += " remote"

    date_map = {"any": "all", "today": "today", "3days": "3days", "week": "week", "month": "month"}
    params: dict = {
        "query": query, "page": "1", "num_pages": "1",
        "date_posted": date_map.get(f.get("date_posted", "week"), "week"),
    }
    if f.get("job_type"):
        jt_map = {"fulltime": "FULLTIME", "parttime": "PARTTIME", "contract": "CONTRACTOR"}
        et = jt_map.get(f["job_type"].lower())
        if et:
            params["employment_types"] = et
    if f.get("remote_only"):
        params["remote_jobs_only"] = "true"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                "https://jsearch.p.rapidapi.com/search",
                params=params,
                headers={"X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com"},
            )
        if resp.status_code == 401:
            raise HTTPException(400, "JSearch: Invalid API key")
        if resp.status_code == 429:
            raise HTTPException(429, "JSearch: Rate limit reached")
        resp.raise_for_status()
        jobs = []
        for item in resp.json().get("data", []):
            lo, hi = item.get("job_min_salary"), item.get("job_max_salary")
            cur = item.get("job_salary_currency", "")
            period = item.get("job_salary_period", "")
            salary = f"{cur} {int(lo):,} – {int(hi):,} {period}".strip() if lo and hi else ""
            jobs.append({
                "id": item.get("job_id", ""),
                "title": item.get("job_title", ""),
                "company": item.get("employer_name", ""),
                "location": f"{item.get('job_city','')} {item.get('job_country','')}".strip(),
                "url": item.get("job_apply_link") or item.get("job_google_link", ""),
                "description": (item.get("job_description") or "")[:800],
                "salary": salary,
                "posted_at": (item.get("job_posted_at_datetime_utc") or "")[:10],
                "source": item.get("job_publisher", "").lower(),
                "provider": "jsearch",
            })
        return jobs
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"JSearch failed: {exc}") from exc


# ── Adzuna ────────────────────────────────────────────────────────────────────

async def _adzuna(q: str, location: str, app_id: str, app_key: str, filters: dict | None = None) -> list[dict]:
    f = filters or {}
    country_code = f.get("country", "in") or "in"
    days_map = {"today": 1, "3days": 3, "week": 7, "month": 30, "any": 90}
    max_days = days_map.get(f.get("date_posted", "week"), 7)
    loc = "Remote" if f.get("remote_only") else (location or "")
    params: dict = {
        "app_id": app_id, "app_key": app_key, "what": q,
        "results_per_page": 20, "max_days_old": max_days,
        "content-type": "application/json",
    }
    if loc:
        params["where"] = loc
    if f.get("job_type") == "fulltime":
        params["full_time"] = 1
    elif f.get("job_type") == "parttime":
        params["part_time"] = 1
    elif f.get("job_type") == "contract":
        params["contract"] = 1
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(
                f"https://api.adzuna.com/v1/api/jobs/{country_code}/search/1",
                params=params,
            )
        if resp.status_code == 401:
            raise HTTPException(400, "Adzuna: Invalid credentials")
        resp.raise_for_status()
        jobs = []
        for item in resp.json().get("results", []):
            lo, hi = item.get("salary_min"), item.get("salary_max")
            salary = f"₹{int(lo):,} – ₹{int(hi):,}" if lo and hi else ""
            jobs.append({
                "id": str(item.get("id", "")),
                "title": item.get("title", ""),
                "company": item.get("company", {}).get("display_name", ""),
                "location": item.get("location", {}).get("display_name", ""),
                "url": item.get("redirect_url", ""),
                "description": (item.get("description") or "")[:800],
                "salary": salary,
                "posted_at": (item.get("created") or "")[:10],
                "source": "adzuna",
                "provider": "adzuna",
            })
        return jobs
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Adzuna failed: {exc}") from exc


# ── Apify ─────────────────────────────────────────────────────────────────────

def _first(*vals) -> str:
    """Return the first non-empty string value."""
    for v in vals:
        if v and str(v).strip():
            return str(v).strip()
    return ""


def _norm_apify_item(item: dict, actor: str, output_mapping: dict | None = None) -> dict:
    """Use stored Claude-generated output_mapping (Phase 3) or fall back to generic aliases."""
    if output_mapping:
        def _get(field: str) -> str:
            src = output_mapping.get(field)
            if src and src in item:
                val = item[src]
                return str(val).strip() if val is not None else ""
            return ""

        source = _get("source") or actor.split("~")[-1].replace("-scraper","").replace("-jobs","")
        return {
            "id":         _get("id") or _get("url") or "",
            "title":      _get("title"),
            "company":    _get("company"),
            "location":   _get("location"),
            "url":        _get("url"),
            "description": _get("description")[:800] if _get("description") else "",
            "salary":     _get("salary"),
            "posted_at":  _get("posted_at")[:10] if len(_get("posted_at")) >= 10 else _get("posted_at"),
            "source":     source.lower(),
            "provider":   "apify",
        }
    # Fall back to 20+ alias generic normaliser
    return _norm_apify_item_generic(item, actor)


def _norm_apify_item_generic(item: dict, actor: str) -> dict:
    """
    Normalise across 20+ Apify job-scraper output schemas.
    Covers: johnvc~Google-Jobs-Scraper, misceres~indeed-scraper,
    bebity~linkedin-jobs-scraper, vaclavrut~google-jobs-scraper,
    lhotse~job-search, epctex~indeed-scraper, and many more.
    """
    title = _first(
        item.get("title"), item.get("jobTitle"), item.get("job_title"),
        item.get("position"), item.get("role"), item.get("name"),
        item.get("positionName"), item.get("jobName"),
    )
    company = _first(
        item.get("companyName"), item.get("company"), item.get("company_name"),
        item.get("employer"), item.get("employerName"), item.get("employer_name"),
        item.get("hiringOrganization"), item.get("organization"),
        item.get("organizationName"),
        # Freelancer/gig actors — poster info
        item.get("clientName"), item.get("posterName"), item.get("poster"),
        item.get("ownerName"), item.get("username"),
    )
    location = _first(
        item.get("location"), item.get("jobLocation"), item.get("job_location"),
        item.get("place"), item.get("city"), item.get("address"),
        item.get("locationName"), item.get("jobCity"),
        # nested location objects
        (item.get("location") or {}).get("displayName") if isinstance(item.get("location"), dict) else None,
    )
    url = _first(
        item.get("applyLink"), item.get("applyUrl"), item.get("apply_link"),
        item.get("apply_url"), item.get("applicationUrl"),
        item.get("url"), item.get("jobUrl"), item.get("job_url"),
        item.get("link"), item.get("jobLink"), item.get("redirect_url"),
        item.get("externalApplyLink"),
    )
    description = _first(
        item.get("description"), item.get("jobDescription"), item.get("job_description"),
        item.get("jobSummary"), item.get("summary"), item.get("details"),
        item.get("snippet"), item.get("jobDetails"), item.get("body"),
        item.get("content"),
    )
    salary = _first(
        item.get("salary"), item.get("salaryRange"), item.get("salary_range"),
        item.get("compensation"), item.get("wages"), item.get("pay"),
        item.get("salaryText"), item.get("salary_text"),
        # Freelancer / gig-style actors
        item.get("price"), item.get("budget"), item.get("budget_fixed"),
        item.get("hourly_rate"), item.get("rate"),
    )
    posted_at = _first(
        item.get("datePosted"), item.get("date_posted"), item.get("publishedAt"),
        item.get("published_at"), item.get("postedAt"), item.get("posted_at"),
        item.get("date"), item.get("createdAt"), item.get("created_at"),
        item.get("listingDate"),
        # Freelancer — derive from days_left if no explicit date
        f"{item.get('days_left', '')} remaining" if item.get("days_left") else None,
    )

    # Freelancer/gig actors have no location — mark as remote
    is_gig_actor = bool(item.get("price") or item.get("budget") or item.get("bids"))
    source = _first(
        item.get("source"), item.get("platform"), item.get("portal"),
        item.get("via"), item.get("jobSource"),
    ) or actor.split("~")[-1].replace("-scraper","").replace("-jobs","").replace("-search","")

    # Build extra info from gig-specific fields
    bids_info = f"{item.get('bids')} bids" if item.get("bids") else ""
    tags_info = ", ".join(item.get("tags", [])[:4]) if item.get("tags") else ""

    return {
        "id": _first(item.get("id"), item.get("jobId"), item.get("job_id"), url),
        "title": title,
        "company": company,
        "location": location or ("Remote / Online" if is_gig_actor else ""),
        "url": url,
        "description": description[:800] if description else (tags_info or ""),
        "salary": salary,
        "posted_at": posted_at[:10] if (posted_at and len(posted_at) >= 10) else (posted_at or ""),
        "source": source.lower(),
        "provider": "apify",
    }


# ── Phase 2: Schema discovery ─────────────────────────────────────────────────

# Our standard filter names → possible actor field name aliases
_FIELD_HINTS: dict[str, list[str]] = {
    "query":       ["query", "queries", "searchterms", "keywords", "searchquery",
                    "terms", "what", "q", "search", "jobquery", "jobtitle"],
    "location":    ["location", "locations", "where", "city", "region", "place",
                    "jobslocation", "joblocation", "locationname"],
    "country":     ["country", "countrycode", "geo", "countryiso", "locale",
                    "nation", "territory"],
    "date_posted": ["dateposted", "date_posted", "postedsince", "maxdaysold",
                    "freshness", "recency", "publishedafter", "daysold"],
    "max_results": ["maxresults", "rows", "limit", "count", "resultsperpage",
                    "maxitems", "maxcrawledplaces", "pagesperquery",
                    "maxpagesperquery", "numresults"],
    "remote_only": ["remoteonly", "remote", "isremote", "worktype",
                    "worklocation", "jobtype", "remotejobs"],
}


def _suggest_mappings(fields: list[dict]) -> dict[str, str | None]:
    """Heuristically match our standard filter keys to actor input field names."""
    lower_to_real = {f["name"].lower(): f["name"] for f in fields}
    result: dict[str, str | None] = {}

    for our_key, hints in _FIELD_HINTS.items():
        matched: str | None = None
        # 1. Exact name match (case-insensitive)
        for hint in hints:
            if hint in lower_to_real:
                matched = lower_to_real[hint]
                break
        # 2. Partial match in field name or description
        if not matched:
            for f in fields:
                fname_lower = f["name"].lower()
                desc_lower = (f.get("description") or "").lower()
                if any(h in fname_lower or h in desc_lower for h in hints):
                    matched = f["name"]
                    break
        result[our_key] = matched

    return result


async def _apify_start_all_runs(q: str, location: str, token: str,
                                 actors: list[ApifyActor], country: str = "in") -> list[dict]:
    """Start one Apify run per enabled actor, in parallel."""
    enabled = [a for a in actors if a.enabled and a.actor_id.strip()]
    if not enabled:
        return []
    tasks = [_apify_start_run(q, location, token, a.actor_id, country,
                              actor_mapping=a.input_mapping or None) for a in enabled]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    runs = []
    for actor, result in zip(enabled, results):
        if isinstance(result, Exception):
            runs.append({"error": str(result), "label": actor.label, "actor_id": actor.actor_id})
        else:
            runs.append({**result, "label": actor.label})
    return runs


def _build_actor_input(q: str, location: str, country: str,
                        actor_mapping: dict | None = None) -> dict:
    """Build actor input using stored field mapping (Phase 2) or generic fallback."""
    query = f"{q} {location}".strip() if location else q

    if actor_mapping:
        inp: dict = {}
        def _set(our_key: str, value: object) -> None:
            field = actor_mapping.get(our_key)
            if field:
                # Some fields expect arrays (e.g. queries[], searchTerms[])
                if field.lower() in ("queries", "searchterms"):
                    inp[field] = [value]
                else:
                    inp[field] = value

        _set("query",       query)
        _set("location",    location or COUNTRY_NAMES.get(country, "India"))
        _set("country",     country)
        _set("max_results", 30)
        return inp or _generic_actor_input(query, location, country)

    return _generic_actor_input(query, location, country)


def _generic_actor_input(query: str, location: str, country: str) -> dict:
    """Fallback input that covers the most common actor schemas."""
    return {
        # johnvc~Google-Jobs-Scraper + most Google Jobs actors
        "queries":          [query],
        "countryCode":      country,
        "languageCode":     "en",
        "maxPagesPerQuery": 2,
        # Generic fallbacks
        "query":       query,
        "country":     country,
        "maxResults":  30,
        "searchTerms": [query],
        "location":    location or COUNTRY_NAMES.get(country, "India"),
        "rows":        20,
    }


async def _apify_start_run(q: str, location: str, token: str, actor_id: str,
                            country: str = "in", actor_mapping: dict | None = None) -> dict:
    if not actor_id.strip():
        raise HTTPException(400,
            "Apify Actor ID required. Go to apify.com/store → find a free job scraper → "
            "click 'Save & Try' → copy its slug into Settings → Job Search → Actor ID.")
    # Apify API uses "~" as separator; accept both "user/actor" and "user~actor"
    actor = actor_id.strip().replace("/", "~")
    actor_input = _build_actor_input(q, location, country, actor_mapping)
    # Apify has two distinct resource types that users may paste:
    #   Actor:       https://api.apify.com/v2/acts/{id}/runs
    #   Actor Task:  https://api.apify.com/v2/actor-tasks/{id}/runs
    # We try the actor endpoint first; on 404 fall back to actor-task.
    auth = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.apify.com/v2/acts/{actor}/runs",
            params={"memory": 512}, headers=auth, json=actor_input,
        )

    if resp.status_code == 404:
        # Not an actor — try as an actor-task (pre-saved configuration)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://api.apify.com/v2/actor-tasks/{actor}/runs",
                params={"memory": 512}, headers=auth, json=actor_input,
            )
        if resp.status_code == 404:
            raise HTTPException(404,
                f"'{actor}' not found as an actor or actor-task. "
                "Copy the ID from the Apify console URL (after /actors/ or /actor-tasks/).")

    if resp.status_code == 401:
        raise HTTPException(401, "Invalid Apify API token — check Settings → Job Search.")
    if resp.status_code == 403:
        raise HTTPException(403,
            f"Access denied for '{actor}'. Open it on apify.com and click 'Save & Try'.")
    resp.raise_for_status()
    run = resp.json().get("data", {})
    return {"run_id": run["id"], "dataset_id": run["defaultDatasetId"], "actor": actor}


async def _apify_poll(run_id: str, dataset_id: str, actor: str, token: str,
                       output_mapping: dict | None = None) -> dict:
    """Check run status. Returns {status, jobs} — jobs only when SUCCEEDED."""
    async with httpx.AsyncClient(timeout=15) as client:
        status_resp = await client.get(
            f"https://api.apify.com/v2/actor-runs/{run_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    status_resp.raise_for_status()
    run_status = status_resp.json().get("data", {}).get("status", "RUNNING")

    if run_status == "SUCCEEDED":
        async with httpx.AsyncClient(timeout=15) as client:
            items_resp = await client.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"limit": 50, "clean": True},
                headers={"Authorization": f"Bearer {token}"},
            )
        items_resp.raise_for_status()
        raw = items_resp.json()
        items = raw if isinstance(raw, list) else raw.get("items", [])
        normalized = [_norm_apify_item(i, actor, output_mapping) for i in items]
        return {"status": "SUCCEEDED", "jobs": normalized,
                "raw_count": len(items), "raw_items": items}

    if run_status in ("FAILED", "ABORTED", "TIMED-OUT"):
        return {"status": run_status, "jobs": [], "raw_count": 0}

    return {"status": "RUNNING", "jobs": [], "raw_count": 0}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/search/fast")
async def search_fast(
    q: str = Query(...),
    location: str = Query(""),
    date_posted: str = Query("week"),       # any / today / 3days / week / month
    job_type: str = Query(""),              # fulltime / parttime / contract / "" (any)
    remote_only: bool = Query(False),
    country: str = Query("in"),             # ISO country code
    providers: str = Query(""),          # comma-separated subset e.g. "jsearch,adzuna" — blank = all enabled
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run fast providers in parallel. Pass `providers` to restrict which ones are called."""
    configs = await _get_configs(db, current_user.id)
    requested = {p.strip() for p in providers.split(",") if p.strip()} if providers else None
    enabled = [
        c for c in configs
        if c.enabled and c.provider in ("jsearch", "adzuna")
        and (requested is None or c.provider in requested)
    ]

    if not enabled:
        raise HTTPException(400,
            "No fast providers configured. Add a JSearch or Adzuna API key in Settings → Job Search.")

    filters = {"date_posted": date_posted, "job_type": job_type,
               "remote_only": remote_only, "country": country}
    tasks = []
    for cfg in enabled:
        if cfg.provider == "jsearch":
            tasks.append(_jsearch(q, location, cfg.key, filters))
        elif cfg.provider == "adzuna":
            tasks.append(_adzuna(q, location, cfg.app_id, cfg.key, filters))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_jobs: list[dict] = []
    provider_stats: dict[str, dict] = {}

    for cfg, result in zip(enabled, results):
        if isinstance(result, Exception):
            provider_stats[cfg.provider] = {
                "status": "error",
                "count": 0,
                "error": str(result),
            }
        else:
            provider_stats[cfg.provider] = {
                "status": "ok",
                "count": len(result),
                "error": None,
            }
            all_jobs.extend(result)

    deduped, dupes_removed = _dedup(all_jobs)

    return {
        "jobs": deduped,
        "provider_stats": provider_stats,
        "duplicates_removed": dupes_removed,
        "total_before_dedup": len(all_jobs),
        "providers": [c.provider for c in enabled],
    }


@router.post("/search/apify/start")
async def apify_start(
    q: str = Query(...),
    location: str = Query(""),
    remote_only: bool = Query(False),
    country: str = Query("in"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an Apify run and return run_id + dataset_id for polling."""
    configs = await _get_configs(db, current_user.id)
    apify_cfg = next((c for c in configs if c.provider == "apify" and c.enabled), None)
    if not apify_cfg:
        raise HTTPException(400, "Apify not configured or disabled")

    effective_q = (q + " remote") if remote_only else q

    # Use multi-actor list if available; fall back to legacy single actor_id
    actors = apify_cfg.actors
    if not actors and apify_cfg.actor_id:
        actors = [ApifyActor(id="legacy", label="Default", actor_id=apify_cfg.actor_id, enabled=True)]

    runs = await _apify_start_all_runs(effective_q, location, apify_cfg.key, actors, country)
    return {"runs": runs}


@router.get("/search/apify/results")
async def apify_results(
    run_id: str = Query(...),
    dataset_id: str = Query(...),
    actor: str = Query(...),
    label: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the status of one Apify run. Call every 5s until status != RUNNING."""
    configs = await _get_configs(db, current_user.id)
    apify_cfg = next((c for c in configs if c.provider == "apify" and c.enabled), None)
    if not apify_cfg:
        raise HTTPException(400, "Apify not configured")

    # Find output_mapping for this specific actor slug
    actor_cfg = next(
        (a for a in apify_cfg.actors if a.actor_id.replace("/","~") == actor.replace("/","~")),
        None,
    )
    out_map = actor_cfg.output_mapping if actor_cfg else None
    result = await _apify_poll(run_id, dataset_id, actor, apify_cfg.key, out_map)
    result["label"] = label
    if result["status"] == "SUCCEEDED":
        deduped, dupes = _dedup(result["jobs"])
        result["jobs"] = deduped
        result["duplicates_removed"] = dupes
        result["raw_count"] = result.get("raw_count", len(deduped))
    return result


@router.get("/apify/schema")
async def get_apify_schema(
    actor_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch an Apify actor's input schema and return heuristic field-mapping suggestions.
    Actor tasks return their stored input values instead of a schema.
    """
    configs = await _get_configs(db, current_user.id)
    apify_cfg = next((c for c in configs if c.provider == "apify"), None)
    if not apify_cfg or not apify_cfg.key:
        raise HTTPException(400, "Apify token not configured")

    actor = actor_id.strip().replace("/", "~")
    auth = {"Authorization": f"Bearer {apify_cfg.key}"}

    # Try as actor first, then actor-task
    is_task = False
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"https://api.apify.com/v2/acts/{actor}", headers=auth)
    if resp.status_code == 404:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"https://api.apify.com/v2/actor-tasks/{actor}", headers=auth)
        is_task = True

    if resp.status_code == 401:
        raise HTTPException(401, "Invalid Apify token")
    if resp.status_code == 404:
        raise HTTPException(404, f"'{actor}' not found as actor or actor-task")
    resp.raise_for_status()

    data = resp.json().get("data", {})
    input_fields: list[dict] = []

    if is_task:
        # Tasks store a pre-configured input dict, not a schema
        task_input = data.get("input", {}) or {}
        input_fields = [
            {"name": k, "type": type(v).__name__, "description": "", "default": v, "required": False}
            for k, v in task_input.items()
        ]
    else:
        # Actors expose inputSchema as a JSON-Schema string in their latest version
        versions = data.get("versions") or []
        schema_raw = versions[0].get("inputSchema", "{}") if versions else "{}"
        try:
            schema = json.loads(schema_raw) if isinstance(schema_raw, str) else (schema_raw or {})
            props = schema.get("properties", {})
            required_list = schema.get("required", [])
            for name, prop in props.items():
                input_fields.append({
                    "name":        name,
                    "type":        prop.get("type", "string"),
                    "description": prop.get("description") or prop.get("title") or "",
                    "default":     prop.get("default"),
                    "required":    name in required_list,
                    "enum":        prop.get("enum", []),
                })
        except (json.JSONDecodeError, AttributeError, TypeError):
            pass  # return empty fields — user can map manually

    suggested = _suggest_mappings(input_fields)

    return {
        "actor":              actor,
        "is_task":            is_task,
        "actor_name":         data.get("name") or data.get("actName") or actor.split("~")[-1],
        "description":        (data.get("description") or data.get("title") or "")[:300],
        "input_fields":       input_fields,
        "suggested_mappings": suggested,
    }


@router.post("/apify/test")
async def test_apify_actor(
    actor_id: str = Query(...),
    q: str = Query(default="software engineer"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run a minimal test (max 3 results) for a single actor.
    Returns: { raw: first_item, mapped: normalised_item, total: count, error? }
    """
    configs = await _get_configs(db, current_user.id)
    apify_cfg = next((c for c in configs if c.provider == "apify"), None)
    if not apify_cfg or not apify_cfg.key:
        raise HTTPException(400, "Apify API token not configured")

    actor = actor_id.strip().replace("/", "~")
    if not actor:
        raise HTTPException(400, "actor_id is required")

    # Start a minimal run
    try:
        run_info = await _apify_start_run(q, "", apify_cfg.key, actor, "in")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Failed to start actor: {exc}") from exc

    # Poll up to 18 × 5s = 90s
    for _ in range(18):
        await asyncio.sleep(5)
        try:
            result = await _apify_poll(run_info["run_id"], run_info["dataset_id"], actor, apify_cfg.key)
        except Exception:
            continue

        if result["status"] == "SUCCEEDED":
            raw_items = result.get("raw_items", result.get("jobs", []))
            if raw_items:
                # Return first raw item + its normalised form
                first_raw = raw_items[0] if isinstance(raw_items[0], dict) else {}
                mapped = _norm_apify_item(first_raw, actor)
                return {
                    "ok": True,
                    "raw": first_raw,
                    "mapped": mapped,
                    "total": len(raw_items),
                    "actor": actor,
                }
            return {"ok": True, "raw": {}, "mapped": {}, "total": 0, "actor": actor,
                    "warning": "Actor ran successfully but returned 0 results for this test query"}

        if result["status"] in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise HTTPException(502, f"Actor run {result['status'].lower()}")

    raise HTTPException(504, "Test timed out after 90s — actor may be slow or misconfigured")


@router.put("/api-configs")
async def save_api_configs(
    body: SaveConfigsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    row = result.scalar_one_or_none()
    data = dict(row.data) if row else {}
    data["job_apis"] = [c.model_dump() for c in body.configs]
    if row:
        row.data = data
    else:
        import uuid
        row = UserProfile(id=uuid.uuid4(), user_id=current_user.id, data=data)
        db.add(row)
    await db.flush()
    return {"ok": True}


@router.get("/api-configs")
async def get_api_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    configs = await _get_configs(db, current_user.id)
    return {
        "configs": [
            {
                "provider": c.provider,
                "enabled": c.enabled,
                "configured": bool(c.key),
                "key_preview": (c.key[:6] + "…" + c.key[-4:]) if len(c.key) > 10 else ("****" if c.key else ""),
                "app_id": c.app_id,
                "actor_id": c.actor_id,
                "actors": [a.model_dump() for a in c.actors],  # ← was missing!
            }
            for c in configs
        ]
    }


# Legacy single-provider search (kept for backward compat)
class MapOutputRequest(BaseModel):
    actor_id: str
    sample_item: dict           # raw output item from the actor


@router.post("/apify/map-output")
async def map_output_with_claude(
    body: MapOutputRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Phase 3: Send a raw actor output sample to Claude and get back suggested
    output field mappings.  Works even when no API key is configured because
    we only need the sample item itself, not a live run.
    """
    from app.core.config import settings
    import anthropic as _anthropic

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(400, "ANTHROPIC_API_KEY not configured")
    if not body.sample_item:
        raise HTTPException(400, "sample_item is empty — paste a raw JSON item from the actor's dataset")

    # Truncate very large items so the prompt stays small
    sample_str = json.dumps(body.sample_item, indent=2)[:3000]

    prompt = (
        "You are mapping the output fields of a job-scraper actor to a standard schema.\n\n"
        "Standard schema fields and what they mean:\n"
        "  title       — job title / position name\n"
        "  company     — employer / company name\n"
        "  location    — city, country, or 'Remote'\n"
        "  url         — link to apply / job posting URL\n"
        "  description — job description text\n"
        "  salary      — salary or budget information\n"
        "  posted_at   — date posted (any format)\n"
        "  id          — unique identifier for the job\n\n"
        f"Raw output sample from actor '{body.actor_id}':\n{sample_str}\n\n"
        "For each standard field, return the EXACT key name from the sample that best matches it.\n"
        "If no field matches, use null.\n"
        "Output ONLY valid JSON, no explanation:\n"
        '{"title": "key_or_null", "company": "key_or_null", "location": "key_or_null", '
        '"url": "key_or_null", "description": "key_or_null", "salary": "key_or_null", '
        '"posted_at": "key_or_null", "id": "key_or_null"}'
    )

    client = _anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=settings.FAST_AI_MODEL,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    # Strip accidental markdown
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        mapping = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(502, f"Claude returned invalid JSON: {raw[:200]}") from exc

    # Validate — only keep keys that exist in the sample
    sample_keys = set(body.sample_item.keys())
    clean = {k: (v if v in sample_keys else None) for k, v in mapping.items()}

    return {
        "mapping":    clean,
        "confidence": {k: ("high" if v else "none") for k, v in clean.items()},
    }


@router.get("/search")
async def search_legacy(
    q: str = Query(...),
    location: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await search_fast(q=q, location=location, current_user=current_user, db=db)


# Legacy config endpoint — UPSERTS a single provider without touching others
@router.put("/api-config")
async def save_single_config(
    config: ProviderConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save one provider config, preserving all other providers already stored."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user.id))
    row = result.scalar_one_or_none()
    data = dict(row.data) if row else {}

    # Migrate legacy single-config format
    existing: list[dict] = data.get("job_apis", [])
    if not existing and data.get("job_api", {}).get("key"):
        existing = [data["job_api"]]

    # If key is __KEEP__ (frontend sentinel), preserve the existing key
    cfg_dict = config.model_dump()
    if cfg_dict.get("key") == "__KEEP__":
        old = next((c for c in existing if c.get("provider") == config.provider), {})
        cfg_dict["key"] = old.get("key", "")

    # Upsert: replace this provider if it already exists, else append
    updated = [c for c in existing if c.get("provider") != config.provider]
    updated.append({**cfg_dict, "enabled": True})
    data["job_apis"] = updated

    if row:
        row.data = data
    else:
        import uuid
        row = UserProfile(id=uuid.uuid4(), user_id=current_user.id, data=data)
        db.add(row)
    await db.flush()
    return {"ok": True}


@router.get("/api-config")
async def get_single_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    configs = await _get_configs(db, current_user.id)
    if not configs:
        return {"configured": False}
    c = configs[0]
    return {
        "configured": bool(c.key),
        "provider": c.provider,
        "key_preview": (c.key[:6] + "…" + c.key[-4:]) if len(c.key) > 10 else "****",
        "app_id": c.app_id,
        "actor_id": c.actor_id,
    }
