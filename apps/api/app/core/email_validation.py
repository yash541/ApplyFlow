"""Email domain MX record validation.

Checks that the email's domain has mail server (MX) records.
This catches:
  - Completely fake domains (test@notreal123.xyz)
  - Typo domains (test@gmail.co, test@yahooo.com)

It does NOT detect fake mailboxes on real domains (test1@gmail.com)
because major providers deliberately obscure this for privacy reasons.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)


async def has_mx_record(email: str) -> bool:
    """Return True if the email's domain has at least one MX record.

    Runs the DNS lookup in a thread pool so it doesn't block the event loop.
    Defaults to True on any unexpected error — we prefer false negatives
    (letting a bad email through) over false positives (blocking real users).
    """
    try:
        domain = email.strip().rsplit("@", 1)[-1].lower()
        if not domain:
            return False
        return await asyncio.get_event_loop().run_in_executor(None, _check_mx, domain)
    except Exception as exc:
        logger.warning("MX check error for %s: %s — allowing through", email, exc)
        return True  # fail open


def _check_mx(domain: str) -> bool:
    """Synchronous MX lookup (runs in thread pool)."""
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return len(answers) > 0
    except Exception:
        return False
