"""Task lifecycle management for background research tasks."""

import asyncio
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import select

from agent_server.db import get_db_session, ResearchTask, Session, TaskStatus
from agent_server.config import logger

# In-memory registry of running tasks and their update queues
_running_tasks: dict[str, asyncio.Task] = {}
_task_streams: dict[str, asyncio.Queue] = {}


class TaskManager:
    """Manages background research task lifecycle."""

    @staticmethod
    async def create_task(
        session_id: str,
        prompt: str,
        task_type: str = "research",
    ) -> ResearchTask:
        """Create a new research task."""
        async with get_db_session() as db:
            # Ensure session exists
            session = await db.get(Session, session_id)
            if not session:
                session = Session(id=session_id)
                db.add(session)
                await db.flush()

            task = ResearchTask(
                id=str(uuid4()),
                session_id=session_id,
                prompt=prompt,
                task_type=task_type,
                status=TaskStatus.PENDING.value,
            )
            db.add(task)
            await db.commit()
            await db.refresh(task)
            return task

    @staticmethod
    async def start_task(task_id: str) -> asyncio.Task:
        """Start a task running in the background."""
        from .runner import run_research_task

        async_task = asyncio.create_task(run_research_task(task_id))
        _running_tasks[task_id] = async_task
        _task_streams[task_id] = asyncio.Queue()

        return async_task

    @staticmethod
    async def get_task(task_id: str) -> Optional[ResearchTask]:
        """Get task by ID."""
        async with get_db_session() as db:
            return await db.get(ResearchTask, task_id)

    @staticmethod
    async def get_session_tasks(session_id: str) -> list[ResearchTask]:
        """Get all tasks for a session."""
        async with get_db_session() as db:
            result = await db.execute(
                select(ResearchTask)
                .where(ResearchTask.session_id == session_id)
                .order_by(ResearchTask.created_at.desc())
            )
            return list(result.scalars().all())

    @staticmethod
    async def update_task_progress(
        task_id: str,
        progress: float,
        message: Optional[str] = None,
    ) -> None:
        """Update task progress."""
        async with get_db_session() as db:
            task = await db.get(ResearchTask, task_id)
            if task:
                task.progress = progress
                task.progress_message = message
                task.updated_at = datetime.utcnow()

        # Push to live stream if connected
        if task_id in _task_streams:
            await _task_streams[task_id].put({
                "type": "progress",
                "progress": progress,
                "message": message,
            })

    @staticmethod
    async def update_task_content(task_id: str, content: str) -> None:
        """Update task's accumulated content."""
        async with get_db_session() as db:
            task = await db.get(ResearchTask, task_id)
            if task:
                task.last_streamed_content = content
                task.updated_at = datetime.utcnow()

    @staticmethod
    async def complete_task(
        task_id: str,
        content: str,
        usage: Optional[dict] = None,
        cost_usd: Optional[float] = None,
    ) -> None:
        """Mark task as completed."""
        async with get_db_session() as db:
            task = await db.get(ResearchTask, task_id)
            if task:
                task.status = TaskStatus.COMPLETED.value
                task.progress = 1.0
                task.progress_message = "Research complete"
                task.completed_at = datetime.utcnow()
                task.last_streamed_content = content
                task.usage_stats = usage
                task.total_cost_usd = cost_usd

        # Notify stream subscribers
        if task_id in _task_streams:
            await _task_streams[task_id].put({
                "type": "done",
                "status": "completed",
            })

        # Cleanup
        _running_tasks.pop(task_id, None)

    @staticmethod
    async def fail_task(task_id: str, error_message: str) -> None:
        """Mark task as failed."""
        async with get_db_session() as db:
            task = await db.get(ResearchTask, task_id)
            if task:
                task.status = TaskStatus.FAILED.value
                task.error_message = error_message
                task.completed_at = datetime.utcnow()

        # Notify stream subscribers
        if task_id in _task_streams:
            await _task_streams[task_id].put({
                "type": "error",
                "message": error_message,
            })

        # Cleanup
        _running_tasks.pop(task_id, None)

    @staticmethod
    async def subscribe_to_task(task_id: str) -> asyncio.Queue:
        """Subscribe to live task updates."""
        if task_id not in _task_streams:
            _task_streams[task_id] = asyncio.Queue()
        return _task_streams[task_id]

    @staticmethod
    async def cancel_task(task_id: str) -> bool:
        """Cancel a running task."""
        if task_id in _running_tasks:
            _running_tasks[task_id].cancel()
            async with get_db_session() as db:
                task = await db.get(ResearchTask, task_id)
                if task:
                    task.status = TaskStatus.CANCELLED.value
                    task.completed_at = datetime.utcnow()

            # Notify stream subscribers
            if task_id in _task_streams:
                await _task_streams[task_id].put({
                    "type": "done",
                    "status": "cancelled",
                })

            _running_tasks.pop(task_id, None)
            return True
        return False

    @staticmethod
    def is_task_running(task_id: str) -> bool:
        """Check if a task is currently running."""
        return task_id in _running_tasks

    @staticmethod
    def cleanup_stream(task_id: str) -> None:
        """Clean up stream queue after client disconnects."""
        _task_streams.pop(task_id, None)
