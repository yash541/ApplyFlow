"""Tests for /api/v1/applications"""
import uuid
import pytest
from httpx import AsyncClient

from tests.conftest import ensure_user, unique_fp, unique_url


@pytest.mark.asyncio
async def test_create_application_basic(client, auth_headers):
    resp = await client.post(
        "/api/v1/applications/",
        json={"company": "Acme", "role": "Engineer", "status": "saved"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["company"] == "Acme"
    assert data["status"] == "saved"


@pytest.mark.asyncio
async def test_create_stores_fingerprint_fields(client, auth_headers):
    fp = unique_fp()
    resp = await client.post(
        "/api/v1/applications/",
        json={"company": "Acme", "role": "Eng", "status": "saved",
              "fingerprint_hash": fp, "portal": "linkedin", "external_job_id": "123"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["fingerprint_hash"] == fp
    assert resp.json()["portal"] == "linkedin"


@pytest.mark.asyncio
async def test_duplicate_fingerprint_returns_reposted(client, auth_headers):
    fp = unique_fp()
    r1 = await client.post("/api/v1/applications/",
                           json={"company": "A", "role": "E", "status": "saved",
                                 "fingerprint_hash": fp},
                           headers=auth_headers)
    assert r1.status_code == 201
    first_id = r1.json()["id"]

    r2 = await client.post("/api/v1/applications/",
                           json={"company": "B", "role": "E2", "status": "saved",
                                 "fingerprint_hash": fp},
                           headers=auth_headers)
    assert r2.status_code == 201
    assert r2.json()["id"] == first_id
    assert r2.json().get("reposted") is True


@pytest.mark.asyncio
async def test_lookup_by_fingerprint_preferred(client, auth_headers):
    fp = unique_fp()
    job_url = unique_url()
    r = await client.post("/api/v1/applications/",
                          json={"company": "A", "role": "E", "status": "saved",
                                "job_url": job_url + "?utm=linkedin",
                                "fingerprint_hash": fp},
                          headers=auth_headers)
    app_id = r.json()["id"]

    lookup = await client.get("/api/v1/applications/lookup",
                              params={"url": job_url, "fingerprint_hash": fp},
                              headers=auth_headers)
    assert lookup.status_code == 200
    assert lookup.json()["id"] == app_id


@pytest.mark.asyncio
async def test_lookup_falls_back_to_url(client, auth_headers):
    job_url = unique_url()
    await client.post("/api/v1/applications/",
                      json={"company": "A", "role": "E", "status": "saved",
                            "job_url": job_url},
                      headers=auth_headers)
    lookup = await client.get("/api/v1/applications/lookup",
                              params={"url": job_url},
                              headers=auth_headers)
    assert lookup.status_code == 200
    assert lookup.json()["company"] == "A"


@pytest.mark.asyncio
async def test_lookup_null_for_unknown_url(client, auth_headers):
    lookup = await client.get("/api/v1/applications/lookup",
                              params={"url": unique_url("/never-tracked")},
                              headers=auth_headers)
    assert lookup.status_code == 200
    assert lookup.json() is None


@pytest.mark.asyncio
async def test_patch_status(client, auth_headers):
    r = await client.post("/api/v1/applications/",
                          json={"company": "A", "role": "E", "status": "saved"},
                          headers=auth_headers)
    app_id = r.json()["id"]
    patch = await client.patch(f"/api/v1/applications/{app_id}",
                               json={"status": "applied"},
                               headers=auth_headers)
    assert patch.status_code == 200
    assert patch.json()["status"] == "applied"


@pytest.mark.asyncio
async def test_patch_stores_ats_metadata(client, auth_headers):
    r = await client.post("/api/v1/applications/",
                          json={"company": "A", "role": "E", "status": "saved"},
                          headers=auth_headers)
    app_id = r.json()["id"]
    patch = await client.patch(
        f"/api/v1/applications/{app_id}",
        json={"status": "applied",
              "ats_metadata": {"confidence": 0.95, "domSignalKind": "dom_element"}},
        headers=auth_headers)
    assert patch.status_code == 200
    assert patch.json()["ats_metadata"]["confidence"] == 0.95


@pytest.mark.asyncio
async def test_cannot_access_other_users_app(client):
    tok_a = await ensure_user(client, "qa_a@applyflow-qa.com", "QA User A")
    tok_b = await ensure_user(client, "qa_b@applyflow-qa.com", "QA User B")

    r = await client.post("/api/v1/applications/",
                          json={"company": "Secret", "role": "E", "status": "saved"},
                          headers={"Authorization": f"Bearer {tok_b}"})
    app_id = r.json()["id"]

    resp = await client.get(f"/api/v1/applications/{app_id}",
                            headers={"Authorization": f"Bearer {tok_a}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_requires_auth(client):
    assert (await client.get("/api/v1/applications/")).status_code == 401
