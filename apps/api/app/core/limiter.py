"""Rate limiter setup.

Uses slowapi (in-memory storage) — works perfectly for a single Railway
instance. To scale to multiple instances later, swap storage_uri to your
Redis URL — no other code changes needed:
    Limiter(key_func=..., storage_uri=settings.REDIS_URL)
"""
from fastapi import Request
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def _user_or_ip(request: Request) -> str:
    """Rate-limit key: user ID for authenticated requests, IP for everything else.

    Using user ID is fairer than IP — the same user is counted once even
    across different IPs (mobile → wifi), and VPN users aren't penalised
    for sharing an exit node with other clients.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = jwt.decode(
                auth[7:], settings.SECRET_KEY, algorithms=["HS256"]
            )
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except JWTError:
            pass
    return get_remote_address(request)


# Single limiter instance — imported by main.py and every endpoint module.
limiter = Limiter(key_func=_user_or_ip, default_limits=[])
