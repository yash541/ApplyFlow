import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Notification

router = APIRouter()


class CreateNotificationRequest(BaseModel):
    type: str = "info"
    title: str
    body: str | None = None
    extra_data: dict | None = None


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    read: bool
    extra_data: dict | None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/", response_model=NotificationOut, status_code=201)
async def create_notification(
    req: CreateNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = Notification(
        user_id=current_user.id,
        type=req.type,
        title=req.title,
        body=req.body,
        extra_data=req.extra_data,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return NotificationOut(
        id=notif.id,
        type=notif.type,
        title=notif.title,
        body=notif.body,
        read=notif.read,
        extra_data=notif.extra_data,
        created_at=notif.created_at.isoformat(),
    )


@router.get("/", response_model=list[NotificationOut])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    rows = result.scalars().all()
    return [
        NotificationOut(
            id=n.id,
            type=n.type,
            title=n.title,
            body=n.body,
            read=n.read,
            extra_data=n.extra_data,
            created_at=n.created_at.isoformat(),
        )
        for n in rows
    ]


@router.patch("/mark-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read == False)  # noqa: E712
        .values(read=True)
    )
    await db.commit()
    return {"ok": True}
