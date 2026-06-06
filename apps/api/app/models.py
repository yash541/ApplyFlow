import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Email verification
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Billing / plan
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    has_had_pro: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_downloads: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    resumes: Mapped[list["Resume"]] = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    applications: Mapped[list["Application"]] = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    profile: Mapped["UserProfile | None"] = relationship("UserProfile", back_populates="user", cascade="all, delete-orphan", uselist=False)
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    usage: Mapped[list["UserUsage"]] = relationship("UserUsage", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    # All profile data in one JSONB blob — flexible, no migration needed to add new fields
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="profile")


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # 'base' = uploaded by user | 'tailored' = AI-generated for a specific job
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="base")

    # Human-readable label shown in the resume list
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Base resume fields (nullable for tailored resumes)
    filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # raw text from upload

    # Tailored resume fields (null for base resumes)
    tailored_content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # full TailoredContent JSON
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ats_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # base64-encoded PDF — set when user saves a tailored resume from the editor
    pdf_bytes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Number of times this tailored resume has been re-saved after first creation
    edit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # True once the user has downloaded this resume as a PDF at least once
    downloaded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="resumes")
    application: Mapped["Application | None"] = relationship("Application", back_populates="tailored_resume")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    company: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)

    # Raw job page URL — used as legacy lookup key
    job_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # saved → applied → interviewing → offered → rejected
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="saved")

    # Sprint 1 — Canonical fingerprinting fields
    # fingerprint_hash: stable SHA-256 across reposts/URL changes (portal:externalId or portal:company:title:location)
    fingerprint_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    portal: Mapped[str | None] = mapped_column(String(50), nullable=True)
    canonical_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    external_job_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Submission detection metadata — populated by the extension when it auto-detects an apply event
    ats_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_applications_user_id_status', 'user_id', 'status'),
    )

    user: Mapped["User"] = relationship("User", back_populates="applications")
    observations: Mapped[list["JobObservation"]] = relationship(
        "JobObservation", back_populates="application", cascade="all, delete-orphan"
    )
    # One application has at most one tailored resume
    tailored_resume: Mapped["Resume | None"] = relationship(
        "Resume",
        back_populates="application",
        uselist=False,
        foreign_keys="Resume.application_id",
    )


class JobObservation(Base):
    """One row per time the extension sees a tracked job posting.

    Enables: scrape-method analytics, repost detection, and future
    lifecycle tracking (is the job still live?).
    """
    __tablename__ = "job_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Whether the job posting appeared to still be live when observed
    is_live: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # 'dom' | 'ai' | 'json_ld' — which extraction method was used
    extraction_method: Mapped[str] = mapped_column(String(20), nullable=False, default="dom")

    portal: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Flexible signals bag: confidence, attempts, selectors that hit, etc.
    signals: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    application: Mapped["Application"] = relationship("Application", back_populates="observations")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # success | info | warning | error
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Optional extra data (e.g. applicationId, resumeId) for deep-link actions
    extra_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="notifications")


class UserUsage(Base):
    """Monthly usage counters per user. One row per (user_id, month)."""
    __tablename__ = "user_usage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Format: "2026-06" — current calendar month
    month: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    autofill_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    match_scores: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tailor_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("user_id", "month", name="uq_user_usage_user_month"),)

    user: Mapped["User"] = relationship("User", back_populates="usage")


class EmailVerification(Base):
    """Pending email verification tokens. Deleted once verified."""
    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    """Password reset tokens. One active token per user, deleted on use or expiry."""
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
