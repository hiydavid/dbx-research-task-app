"""Request/Response schemas for API."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    message: str
    session_id: str | None = None
    conversation_history: list[dict] | None = None


class SessionInfo(BaseModel):
    """Session metadata."""

    id: str
    modified: float


class SessionListResponse(BaseModel):
    """Response for listing sessions."""

    sessions: list[SessionInfo]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
