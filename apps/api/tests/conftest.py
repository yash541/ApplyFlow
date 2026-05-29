"""Test fixtures for ApplyFlow API.

Key design decisions:
- Settings are patched via environment BEFORE any app code is imported
- NullPool prevents asyncpg 'another operation in progress' errors
- Tests use unique URLs/fingerprints to avoid inter-test data dependencies
"""
import os
import uuid

# ── Patch DB URL before any app import ───────────────────────────────────────
# Must be set here, at module level, before 'from app...' imports below.
os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://yashwanthreddyavula@localhost:5432/applyflow_test"
)
TEST_DB_URL = os.environ["DATABASE_URL"]

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.database import Base
import app.core.database as _db_module


# ── Patch app engine to use test DB with NullPool ─────────────────────────────

_test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
_TestSession = async_sessionmaker(_test_engine, expire_on_commit=False)

# Replace the app's engine and session factory in-place
_db_module.engine = _test_engine
_db_module.AsyncSessionLocal = _TestSession


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _test_engine.dispose()


@pytest_asyncio.fixture
async def client(setup_test_db):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ── Auth helpers ──────────────────────────────────────────────────────────────

TEST_EMAIL    = "test@applyflow-qa.com"
TEST_PASSWORD = "Test1234!"

_registered: set[str] = set()


async def ensure_user(client: AsyncClient,
                      email: str = TEST_EMAIL,
                      name: str = "Test User") -> str:
    if email not in _registered:
        r = await client.post(
            "/api/v1/auth/register",
            json={"name": name, "email": email, "password": TEST_PASSWORD},
        )
        if r.status_code not in (200, 201, 409):
            raise RuntimeError(f"Register failed {r.status_code}: {r.text}")
        _registered.add(email)

    r = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": TEST_PASSWORD},
    )
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest_asyncio.fixture
async def token(client) -> str:
    return await ensure_user(client)


@pytest_asyncio.fixture
async def auth_headers(token) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Data helpers ──────────────────────────────────────────────────────────────

def unique_fp() -> str:
    return f"fp-{uuid.uuid4().hex}"


def unique_url(path: str = "/jobs") -> str:
    return f"https://test.applyflow-qa.com{path}/{uuid.uuid4().hex}"
