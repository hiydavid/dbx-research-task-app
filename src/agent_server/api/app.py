"""Starlette ASGI application serving API and static files."""

import os
from pathlib import Path

from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

from agent_server.db import init_db, close_db
from .routes import (
    chat_stream,
    sessions_list,
    sessions_get,
    sessions_delete,
    health,
    # Task endpoints
    start_research_task,
    get_task_status,
    stream_task_updates,
    cancel_task,
    list_session_tasks,
    # Output file endpoints
    list_output_files,
    get_output_file_content,
    get_output_file_download,
)

# Development mode: enable CORS for Vite dev server
DEV_MODE = os.getenv("DEV_MODE", "").lower() in ("1", "true", "yes")

# Static files directory (built React app)
STATIC_DIR = Path(__file__).parent.parent.parent.parent / "static"


async def serve_spa(request):
    """Serve the SPA index.html for client-side routing."""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return FileResponse(STATIC_DIR / "index.html")


def create_app() -> Starlette:
    """Create the Starlette application."""

    routes = [
        # Health check
        Route("/api/health", health, methods=["GET"]),
        # Chat endpoints
        Route("/api/chat", chat_stream, methods=["POST"]),
        # Session management
        Route("/api/sessions", sessions_list, methods=["GET"]),
        Route("/api/sessions/{session_id}", sessions_get, methods=["GET"]),
        Route("/api/sessions/{session_id}", sessions_delete, methods=["DELETE"]),
        Route("/api/sessions/{session_id}/tasks", list_session_tasks, methods=["GET"]),
        # Task management
        Route("/api/tasks", start_research_task, methods=["POST"]),
        Route("/api/tasks/{task_id}", get_task_status, methods=["GET"]),
        Route("/api/tasks/{task_id}/stream", stream_task_updates, methods=["GET"]),
        Route("/api/tasks/{task_id}/cancel", cancel_task, methods=["POST"]),
        # Output files
        Route("/api/outputs", list_output_files, methods=["GET"]),
        Route("/api/outputs/{file_id}/content", get_output_file_content, methods=["GET"]),
        Route("/api/outputs/{file_id}/download", get_output_file_download, methods=["GET"]),
    ]

    # Add static file serving if the directory exists
    if STATIC_DIR.exists():
        routes.append(
            Mount("/", app=StaticFiles(directory=str(STATIC_DIR), html=True))
        )

    # CORS only needed in development mode (Vite dev server on different port)
    # In production (Databricks Apps), frontend/backend share same origin
    middleware = []
    if DEV_MODE:
        middleware.append(
            Middleware(
                CORSMiddleware,
                allow_origins=["http://localhost:5173"],
                allow_methods=["*"],
                allow_headers=["*"],
            )
        )

    return Starlette(
        routes=routes,
        middleware=middleware,
        on_startup=[init_db],
        on_shutdown=[close_db],
    )


app = create_app()


def dev():
    """Run the development server."""
    import uvicorn

    os.environ.setdefault("DEV_MODE", "true")
    uvicorn.run(
        "agent_server.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
