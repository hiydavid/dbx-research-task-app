"""Configuration and path settings."""

import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

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

# Model configuration per agent
# Environment variables override defaults: ORCHESTRATOR_MODEL, RESEARCH_MODEL, FILESYSTEM_MODEL
MODELS = {
    "orchestrator": {
        "model": os.getenv("ORCHESTRATOR_MODEL", "gpt-5.1-2025-11-13"),
        "temperature": 0.7,
    },
    "research": {
        "model": os.getenv("RESEARCH_MODEL", "gpt-5-mini-2025-08-07"),
        "temperature": 0.3,
    },
    "filesystem": {
        "model": os.getenv("FILESYSTEM_MODEL", "gpt-5-mini-2025-08-07"),
        "temperature": 0.0,
    },
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
