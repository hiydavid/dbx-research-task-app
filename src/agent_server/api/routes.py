"""API route handlers."""

import json

from starlette.requests import Request
from starlette.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from agent_server.session import list_sessions, load_session
from agent_server.core.agent import stream_agent_response
from .schemas import ChatRequest


async def health(request: Request) -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse({"status": "ok"})


async def chat_stream(request: Request) -> EventSourceResponse:
    """
    SSE endpoint for streaming chat responses.

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

    async def event_generator():
        async for event in stream_agent_response(
            message=chat_request.message,
            session_id=chat_request.session_id,
            conversation_history=chat_request.conversation_history or [],
        ):
            yield {"event": event["type"], "data": json.dumps(event["data"])}

    return EventSourceResponse(event_generator())


async def sessions_list(request: Request) -> JSONResponse:
    """List all saved sessions."""
    sessions = list_sessions()
    return JSONResponse(
        {
            "sessions": [
                {"id": s.stem, "modified": s.stat().st_mtime} for s in sessions[:20]
            ]
        }
    )


async def sessions_get(request: Request) -> JSONResponse:
    """Get a specific session."""
    session_id = request.path_params["session_id"]
    conversation = load_session(session_id)
    return JSONResponse({"conversation": conversation})


async def sessions_delete(request: Request) -> JSONResponse:
    """Delete a session (placeholder for future)."""
    # TODO: Implement session deletion
    return JSONResponse({"status": "ok"})
