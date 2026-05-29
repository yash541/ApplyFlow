"""Tests for POST /api/v1/autofill/match"""
import pytest
from tests.conftest import TEST_EMAIL, unique_url


@pytest.mark.asyncio
async def test_email_matched_from_profile(client, auth_headers):
    resp = await client.post(
        "/api/v1/autofill/match",
        json={"fields": [
            {"uid": "u1", "kind": "email", "confidence": 1.0,
             "input_type": "email", "label": "Email*", "selector": "input#email"},
        ], "url": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    m = resp.json()["matches"][0]
    assert m["source"] == "rules"
    assert m["value"] == TEST_EMAIL
    assert m["confidence"] == 0.95


@pytest.mark.asyncio
async def test_unknown_no_label_returns_none(client, auth_headers):
    resp = await client.post(
        "/api/v1/autofill/match",
        json={"fields": [
            {"uid": "u2", "kind": "unknown", "confidence": 0.5,
             "input_type": "text", "label": "(no label)", "selector": "input#x"},
        ], "url": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    m = resp.json()["matches"][0]
    assert m["source"] == "none"
    assert m["value"] is None


@pytest.mark.asyncio
async def test_learned_field_returns_rules(client, auth_headers):
    """Unknown field in learned_fields → source: rules, confidence 0.8."""
    await client.patch(
        "/api/v1/profile/learned-fields",
        json={"fields": {"react experience years": "4"}},
        headers=auth_headers,
    )
    resp = await client.post(
        "/api/v1/autofill/match",
        json={"fields": [
            {"uid": "u3", "kind": "unknown", "confidence": 0.5,
             "input_type": "text",
             "label": "React experience years",
             "selector": "input#exp"},
        ], "url": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    m = resp.json()["matches"][0]
    assert m["source"] == "rules"
    assert m["value"] == "4"
    assert m["confidence"] == 0.8


@pytest.mark.asyncio
async def test_multiple_apps_same_url_no_crash(client, auth_headers):
    """T-FI-003: MultipleResultsFound regression — two apps same URL must not 500."""
    job_url = unique_url("/greenhouse-multi")
    for _ in range(2):
        await client.post("/api/v1/applications/",
                          json={"company": "Acme", "role": "E", "status": "saved",
                                "job_url": job_url},
                          headers=auth_headers)

    resp = await client.post(
        "/api/v1/autofill/match",
        json={"fields": [
            {"uid": "u4", "kind": "email", "confidence": 1.0,
             "input_type": "email", "label": "Email", "selector": "input#email"},
        ], "url": job_url},
        headers=auth_headers,
    )
    assert resp.status_code == 200, (
        f"MultipleResultsFound regression! Got {resp.status_code}: {resp.text}"
    )
    # resume_id is null (no PDF linked) — that's correct
    assert resp.json()["resume_id"] is None


@pytest.mark.asyncio
async def test_empty_fields_returns_empty(client, auth_headers):
    resp = await client.post("/api/v1/autofill/match",
                             json={"fields": [], "url": ""},
                             headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["matches"] == []


@pytest.mark.asyncio
async def test_autofill_requires_auth(client):
    resp = await client.post("/api/v1/autofill/match",
                             json={"fields": [], "url": ""})
    assert resp.status_code == 401
