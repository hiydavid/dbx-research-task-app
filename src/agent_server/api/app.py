"""Starlette ASGI application serving API and static files."""

import os
from pathlib import Path

from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

from .routes import chat_stream, sessions_list, sessions_get, sessions_delete, health

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

    return Starlette(routes=routes, middleware=middleware)


app = create_app()
