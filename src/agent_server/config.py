"""Configuration and path settings for Claude Agent SDK."""

import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Model shorthand mapping to full model IDs
MODEL_MAP = {
    "opus": "claude-opus-4-5-20250514",
    "sonnet": "claude-sonnet-4-5-20250514",
    "haiku": "claude-haiku-4-5-20250514",
}


def get_model() -> str:
    """Get model from CLAUDE_MODEL env var, default to sonnet."""
    model_name = os.getenv("CLAUDE_MODEL", "sonnet").lower()
    return MODEL_MAP.get(model_name, model_name)  # Allow full ID as fallback


# Project root (3 levels up from config.py: agent_server -> src -> project root)
PROJECT_ROOT = Path(__file__).parent.parent.parent

# Default paths
DEFAULT_SANDBOX = str(PROJECT_ROOT / "output")
SESSIONS_DIR = PROJECT_ROOT / ".sessions"
LOGS_DIR = PROJECT_ROOT / ".logs"

# Ensure output directory exists
Path(DEFAULT_SANDBOX).mkdir(exist_ok=True)

# Global config (set by parse_args)
CONFIG = {
    "output_dir": DEFAULT_SANDBOX,
    "session_file": None,
}


def setup_logging() -> logging.Logger:
    """Configure error logging to file."""
    LOGS_DIR.mkdir(exist_ok=True)
    log_file = LOGS_DIR / f"agent_{datetime.now().strftime('%Y%m%d')}.log"
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file),
        ],
    )
    return logging.getLogger(__name__)


logger = setup_logging()
