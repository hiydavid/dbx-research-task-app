"""Session management for conversation persistence."""

import json
from datetime import datetime
from pathlib import Path

from .config import SESSIONS_DIR


def save_session(conversation_history: list, session_name: str = None) -> Path:
    """Save conversation history to a JSON file."""
    SESSIONS_DIR.mkdir(exist_ok=True)
    if session_name is None:
        session_name = datetime.now().strftime("%Y%m%d_%H%M%S")

    session_file = SESSIONS_DIR / f"{session_name}.json"
    with open(session_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "conversation": conversation_history
        }, f, indent=2, default=str)

    print(f"Session saved to: {session_file.name}")
    return session_file


def load_session(session_name: str) -> list:
    """Load conversation history from a JSON file."""
    session_file = SESSIONS_DIR / f"{session_name}.json"
    if not session_file.exists():
        # Try without extension
        session_file = SESSIONS_DIR / session_name
        if not session_file.exists():
            print(f"Session not found: {session_name}")
            return []

    with open(session_file, "r") as f:
        data = json.load(f)

    print(f"Resumed session from: {session_file.name}")
    return data.get("conversation", [])


def list_sessions() -> list[Path]:
    """List all saved sessions, sorted by most recent first."""
    if not SESSIONS_DIR.exists():
        return []
    return sorted(
        SESSIONS_DIR.glob("*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
