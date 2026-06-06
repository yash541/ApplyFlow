import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
import bcrypt
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.models import User, EmailVerification, PasswordResetToken

router = APIRouter()

_VERIFY_TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.SECRET_KEY, algorithm="HS256")


def _generate_verification_token() -> str:
    return secrets.token_urlsafe(48)


async def _create_and_send_verification(user: User, db: AsyncSession) -> None:
    """Delete any existing token, create a fresh one, send the email."""
    # Remove old tokens for this user
    await db.execute(delete(EmailVerification).where(EmailVerification.user_id == user.id))

    token = _generate_verification_token()
    expires = datetime.now(tz=timezone.utc) + timedelta(hours=_VERIFY_TOKEN_EXPIRE_HOURS)
    ev = EmailVerification(user_id=user.id, token=token, expires_at=expires)
    db.add(ev)
    await db.flush()

    link = f"{settings.WEB_APP_URL}/verify?token={token}"

    from app.core.email import send_verification_email
    send_verification_email(user.email, user.name, link)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "email_verified": user.email_verified,
        },
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        email_verified=False,
    )
    db.add(user)
    await db.flush()

    try:
        await _create_and_send_verification(user, db)
    except Exception:
        pass  # Don't block registration if email fails — user can resend

    await db.commit()
    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "email_verified": False,
        },
    )


@router.get("/verify")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Validate a verification token from the email link."""
    result = await db.execute(
        select(EmailVerification).where(EmailVerification.token == token)
    )
    ev = result.scalar_one_or_none()

    if not ev:
        raise HTTPException(status_code=400, detail="Invalid or already used verification link.")

    if ev.expires_at.replace(tzinfo=timezone.utc) < datetime.now(tz=timezone.utc):
        await db.delete(ev)
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new one.")

    # Mark user as verified
    user_result = await db.execute(select(User).where(User.id == ev.user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.email_verified = True

    await db.delete(ev)
    await db.commit()
    return {"message": "Email verified successfully."}


@router.post("/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend the verification email. Rate-limited to 3 per hour."""
    if current_user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified.")

    try:
        await _create_and_send_verification(current_user, db)
        await db.commit()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {e}")

    return {"message": "Verification email sent."}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "email_verified": current_user.email_verified,
    }


# ── Password Reset ────────────────────────────────────────────────────────────

_RESET_TOKEN_EXPIRE_HOURS = 1


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a password reset email. Always returns 200 to avoid email enumeration."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user:
        # Delete any existing reset token for this user
        await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))

        token = secrets.token_urlsafe(48)
        expires = datetime.now(tz=timezone.utc) + timedelta(hours=_RESET_TOKEN_EXPIRE_HOURS)
        db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires))
        await db.flush()

        reset_link = f"{settings.WEB_APP_URL}/reset-password?token={token}"
        try:
            from app.core.email import send_password_reset_email
            send_password_reset_email(user.email, user.name, reset_link)
        except Exception:
            pass  # Don't reveal email sending failures

        await db.commit()

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Validate reset token and set a new password."""
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    )
    prt = result.scalar_one_or_none()

    if not prt:
        raise HTTPException(status_code=400, detail="Invalid or already used reset link.")

    if prt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(tz=timezone.utc):
        await db.delete(prt)
        await db.commit()
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    user_result = await db.execute(select(User).where(User.id == prt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(body.new_password)
    await db.delete(prt)
    await db.commit()

    return {"message": "Password updated successfully."}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for an authenticated user."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password.")

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    user.hashed_password = hash_password(body.new_password)
    await db.commit()

    return {"message": "Password changed successfully."}
