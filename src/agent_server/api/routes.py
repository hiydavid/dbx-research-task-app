"""API route handlers."""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, FileResponse
from sse_starlette.sse import EventSourceResponse

from agent_server.db import get_db_session, Session, ResearchTask, OutputFile, TaskStatus
from agent_server.tasks import TaskManager
from agent_server.core.agent import stream_agent_response, AgentRole
from agent_server.config import CONFIG, logger
from .schemas import ChatRequest


async def health(request: Request) -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse({"status": "ok"})


# =============================================================================
# Chat Endpoints
# =============================================================================


async def chat_stream(request: Request) -> EventSourceResponse:
    """
    SSE endpoint for streaming chat responses.

    Uses the PLANNER agent role for conversational research planning.
    Injects current task status so planner can answer progress questions.

    Request body:
    {
        "message": "user message",
        "session_id": "optional-session-id",
        "conversation_history": [...]  # Optional for resuming
    }

    SSE Events:
    - event: token, data: {"text": "..."}
    - event: tool_use, data: {"name": "...", "id": "..."}
    - event: system, data: {"session_id": "..."}
    - event: done, data: {"session_id": "...", "usage": {...}}
    - event: error, data: {"message": "..."}
    """
    body = await request.json()
    chat_request = ChatRequest(**body)

    # Build task context to inject into message
    task_context = ""
    if chat_request.session_id:
        tasks = await TaskManager.get_session_tasks(chat_request.session_id)
        if tasks:
            task_context = "[CURRENT RESEARCH TASKS]\n"
            for t in tasks:
                prompt_preview = t.prompt[:80] + "..." if len(t.prompt) > 80 else t.prompt
                task_context += f"- Task {t.id[:8]}: {t.status} ({t.progress:.0%})"
                if t.progress_message:
                    task_context += f" - {t.progress_message}"
                task_context += f"\n  Prompt: {prompt_preview}\n"
            task_context += "\n"

    async def event_generator():
        session_id = chat_request.session_id

        # Prepend task context to message so planner can see current state
        enhanced_message = task_context + chat_request.message if task_context else chat_request.message

        async for event in stream_agent_response(
            message=enhanced_message,
            session_id=session_id,
            conversation_history=chat_request.conversation_history or [],
            role=AgentRole.PLANNER,  # Use planner agent for chat
        ):
            # Capture session_id from system init event
            if event["type"] == "system" and "session_id" in event.get("data", {}):
                session_id = event["data"]["session_id"]
                # Ensure session exists in database
                await _ensure_session_exists(session_id)

            yield {"event": event["type"], "data": json.dumps(event["data"])}

    return EventSourceResponse(event_generator())


async def _ensure_session_exists(session_id: str) -> None:
    """Ensure a session exists in the database."""
    async with get_db_session() as db:
        session = await db.get(Session, session_id)
        if not session:
            session = Session(id=session_id)
            db.add(session)


# =============================================================================
# Session Endpoints
# =============================================================================


async def sessions_list(request: Request) -> JSONResponse:
    """List all saved sessions."""
    async with get_db_session() as db:
        result = await db.execute(
            select(Session).order_by(Session.updated_at.desc()).limit(20)
        )
        sessions = result.scalars().all()

    return JSONResponse({
        "sessions": [
            {
                "id": s.id,
                "title": s.title,
                "modified": s.updated_at.timestamp() if s.updated_at else s.created_at.timestamp(),
            }
            for s in sessions
        ]
    })


async def sessions_get(request: Request) -> JSONResponse:
    """Get a specific session with its conversation history."""
    session_id = request.path_params["session_id"]

    async with get_db_session() as db:
        session = await db.get(Session, session_id)
        if not session:
            return JSONResponse({"error": "Session not found"}, status_code=404)

        return JSONResponse({
            "id": session.id,
            "title": session.title,
            "conversation": session.conversation or [],
        })


async def sessions_delete(request: Request) -> JSONResponse:
    """Delete a session and its associated data."""
    session_id = request.path_params["session_id"]

    async with get_db_session() as db:
        session = await db.get(Session, session_id)
        if not session:
            return JSONResponse({"error": "Session not found"}, status_code=404)

        await db.delete(session)

    return JSONResponse({"status": "ok"})


# =============================================================================
# Task Endpoints
# =============================================================================


async def start_research_task(request: Request) -> JSONResponse:
    """
    Start a background research task.

    POST /api/tasks
    {
        "session_id": "...",
        "prompt": "Research topic...",
        "mode": "background" | "live"  # Optional, default: "background"
    }

    Returns: { "task_id": "...", "status": "pending" }
    """
    body = await request.json()
    session_id = body.get("session_id")
    prompt = body.get("prompt")
    mode = body.get("mode", "background")

    if not session_id or not prompt:
        return JSONResponse(
            {"error": "session_id and prompt are required"},
            status_code=400,
        )

    task = await TaskManager.create_task(session_id, prompt)

    if mode == "background":
        # Fire and forget
        await TaskManager.start_task(task.id)
        return JSONResponse({
            "task_id": task.id,
            "status": task.status,
            "message": "Task started in background",
        })
    else:
        # Return task ID, client will connect to SSE stream
        return JSONResponse({
            "task_id": task.id,
            "status": task.status,
            "stream_url": f"/api/tasks/{task.id}/stream",
        })


async def get_task_status(request: Request) -> JSONResponse:
    """
    Get task status and progress.

    GET /api/tasks/{task_id}
    """
    task_id = request.path_params["task_id"]
    task = await TaskManager.get_task(task_id)

    if not task:
        return JSONResponse({"error": "Task not found"}, status_code=404)

    return JSONResponse({
        "id": task.id,
        "status": task.status,
        "progress": task.progress,
        "progress_message": task.progress_message,
        "prompt": task.prompt,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "error_message": task.error_message,
        "total_cost_usd": task.total_cost_usd,
    })


async def stream_task_updates(request: Request) -> EventSourceResponse:
    """
    SSE endpoint to stream task progress and content.

    GET /api/tasks/{task_id}/stream

    Events:
    - progress: { progress: 0.5, message: "..." }
    - token: { text: "..." }
    - done: { status: "completed" }
    - error: { message: "..." }
    """
    task_id = request.path_params["task_id"]
    task = await TaskManager.get_task(task_id)

    if not task:
        async def error_gen():
            yield {"event": "error", "data": json.dumps({"message": "Task not found"})}
        return EventSourceResponse(error_gen())

    # If task is already done, send final state
    if task.status in (TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value):
        async def done_gen():
            if task.last_streamed_content:
                yield {"event": "content", "data": json.dumps({"text": task.last_streamed_content})}
            yield {"event": "done", "data": json.dumps({
                "status": task.status,
                "error": task.error_message,
            })}
        return EventSourceResponse(done_gen())

    # If pending, start the task
    if task.status == TaskStatus.PENDING.value:
        await TaskManager.start_task(task_id)

    # Subscribe to live updates
    queue = await TaskManager.subscribe_to_task(task_id)

    async def stream_gen():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {"event": event["type"], "data": json.dumps(event)}

                    if event["type"] in ("done", "error"):
                        break
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield {"event": "ping", "data": "{}"}
        finally:
            TaskManager.cleanup_stream(task_id)

    return EventSourceResponse(stream_gen())


async def cancel_task(request: Request) -> JSONResponse:
    """
    Cancel a running task.

    POST /api/tasks/{task_id}/cancel
    """
    task_id = request.path_params["task_id"]
    success = await TaskManager.cancel_task(task_id)

    if success:
        return JSONResponse({"status": "cancelled"})
    return JSONResponse({"error": "Task not running"}, status_code=400)


async def list_session_tasks(request: Request) -> JSONResponse:
    """
    List all tasks for a session.

    GET /api/sessions/{session_id}/tasks
    """
    session_id = request.path_params["session_id"]
    tasks = await TaskManager.get_session_tasks(session_id)

    return JSONResponse({
        "tasks": [
            {
                "id": t.id,
                "prompt": t.prompt[:100] + "..." if len(t.prompt) > 100 else t.prompt,
                "status": t.status,
                "progress": t.progress,
                "progress_message": t.progress_message,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tasks
        ]
    })


# =============================================================================
# Output File Endpoints
# =============================================================================


async def list_output_files(request: Request) -> JSONResponse:
    """
    List all output files, optionally filtered by session.

    GET /api/outputs
    GET /api/outputs?session_id=...
    """
    session_id = request.query_params.get("session_id")

    async with get_db_session() as db:
        query = select(OutputFile).order_by(OutputFile.created_at.desc())
        if session_id:
            query = query.where(OutputFile.session_id == session_id)

        result = await db.execute(query)
        files = result.scalars().all()

    return JSONResponse({
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "filepath": f.filepath,
                "file_type": f.file_type,
                "file_size": f.file_size,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in files
        ]
    })


async def get_output_file_content(request: Request) -> JSONResponse:
    """
    Get file content for preview (text files only).

    GET /api/outputs/{file_id}/content
    """
    file_id = request.path_params["file_id"]

    async with get_db_session() as db:
        file = await db.get(OutputFile, file_id)

    if not file:
        return JSONResponse({"error": "File not found"}, status_code=404)

    full_path = Path(CONFIG["output_dir"]) / file.filepath
    if not full_path.exists():
        return JSONResponse({"error": "File missing from disk"}, status_code=404)

    # Read content for text-based files
    if file.file_type in ("markdown", "json", "csv", "text", "html"):
        try:
            content = full_path.read_text(encoding="utf-8")
        except Exception as e:
            return JSONResponse({"error": f"Could not read file: {e}"}, status_code=500)
    else:
        content = None

    return JSONResponse({
        "id": file.id,
        "filename": file.filename,
        "content": content,
        "file_type": file.file_type,
    })


async def get_output_file_download(request: Request) -> FileResponse:
    """
    Download a specific output file.

    GET /api/outputs/{file_id}/download
    """
    file_id = request.path_params["file_id"]

    async with get_db_session() as db:
        file = await db.get(OutputFile, file_id)

    if not file:
        return JSONResponse({"error": "File not found"}, status_code=404)

    full_path = Path(CONFIG["output_dir"]) / file.filepath
    if not full_path.exists():
        return JSONResponse({"error": "File missing from disk"}, status_code=404)

    # Determine media type
    media_types = {
        "markdown": "text/markdown",
        "json": "application/json",
        "csv": "text/csv",
        "text": "text/plain",
        "html": "text/html",
        "pdf": "application/pdf",
    }
    media_type = media_types.get(file.file_type, "application/octet-stream")

    return FileResponse(
        path=full_path,
        filename=file.filename,
        media_type=media_type,
    )
