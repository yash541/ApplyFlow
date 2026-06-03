from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    # Probe each connection before handing it to a request.
    # If Supabase closed it while idle, SQLAlchemy discards it and opens a fresh one.
    pool_pre_ping=True,
    # Recycle connections after 10 minutes regardless — prevents hitting
    # Supabase's server-side idle timeout mid-operation.
    pool_recycle=600,
    pool_size=5,
    max_overflow=10,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
