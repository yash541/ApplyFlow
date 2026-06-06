"""Transactional email via Resend."""
from app.core.config import settings


def send_verification_email(to_email: str, name: str, verification_link: str) -> None:
    """Send the email verification link. Raises on delivery failure."""
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    import resend
    resend.api_key = settings.RESEND_API_KEY

    first_name = name.split()[0] if name else "there"

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0f0f1f;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 36px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;background:rgba(99,102,241,0.2);border-radius:8px;border:1px solid rgba(99,102,241,0.3);display:inline-block;text-align:center;line-height:32px;">
                &#9889;
              </div>
              <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">ApplyFlow</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">
              Verify your email
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
              Hi {first_name}, click the button below to verify your email address and activate your ApplyFlow account.
            </p>

            <a href="{verification_link}"
               style="display:inline-block;padding:13px 28px;background:#6366f1;color:#fff;text-decoration:none;
                      border-radius:10px;font-size:15px;font-weight:600;letter-spacing:-0.1px;">
              Verify email address
            </a>

            <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.6;">
              This link expires in <strong style="color:rgba(255,255,255,0.45);">24 hours</strong>.
              If you didn&rsquo;t create an account, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);">
              Or copy this link: <span style="color:rgba(255,255,255,0.35);">{verification_link}</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    resend.Emails.send({
        "from": settings.FROM_EMAIL,
        "to": to_email,
        "subject": "Verify your ApplyFlow account",
        "html": html,
    })
