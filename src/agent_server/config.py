"""Configuration and path settings for Claude Agent SDK."""

import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv()  # Also load .env as fallback

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
DATA_DIR = PROJECT_ROOT / ".data"
LOGS_DIR = PROJECT_ROOT / ".logs"

# Ensure directories exist
Path(DEFAULT_SANDBOX).mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)


def get_database_url() -> str:
    """Get database URL from env or default to SQLite."""
    return os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/research.db")


# Global config
CONFIG = {
    "output_dir": DEFAULT_SANDBOX,
    "data_dir": str(DATA_DIR),
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
