"""SQLAlchemy models for research app."""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class TaskStatus(str, Enum):
    """Status of a research task."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Session(Base):
    """Chat session / research project."""
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    conversation: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tasks: Mapped[list["ResearchTask"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    output_files: Mapped[list["OutputFile"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class ResearchTask(Base):
    """Background research task."""
    __tablename__ = "research_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False)

    # Task definition
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), default="research")

    # Status tracking
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.PENDING.value)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    progress_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Execution details
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cost tracking
    total_cost_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    usage_stats: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Live streaming state (for reconnection)
    last_streamed_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    session: Mapped["Session"] = relationship(back_populates="tasks")
    output_files: Mapped[list["OutputFile"]] = relationship(back_populates="task")


class OutputFile(Base):
    """Research output files."""
    __tablename__ = "output_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("research_tasks.id"), nullable=True
    )

    # File info
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), default="markdown")
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Metadata
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    session: Mapped["Session"] = relationship(back_populates="output_files")
    task: Mapped[Optional["ResearchTask"]] = relationship(back_populates="output_files")
