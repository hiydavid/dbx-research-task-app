"""Database connection and session management."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from agent_server.config import get_database_url, logger
from .models import Base

# Global engine and session factory
_engine = None
_async_session_factory = None


async def init_db() -> None:
    """Initialize database connection and create tables."""
    global _engine, _async_session_factory

    database_url = get_database_url()

    # Convert to async driver URLs
    if database_url.startswith("sqlite://"):
        async_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
    elif database_url.startswith("postgresql://"):
        async_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    else:
        async_url = database_url

    logger.info(f"Initializing database: {database_url.split('/')[-1]}")

    _engine = create_async_engine(async_url, echo=False)
    _async_session_factory = async_sessionmaker(
        _engine, class_=AsyncSession, expire_on_commit=False
    )

    # Create tables
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialized successfully")


async def close_db() -> None:
    """Close database connection."""
    global _engine
    if _engine:
        await _engine.dispose()
        logger.info("Database connection closed")


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for operations."""
    if _async_session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with _async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
