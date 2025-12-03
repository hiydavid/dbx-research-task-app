"""Configuration and path settings."""

import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Default paths
DEFAULT_SANDBOX = os.path.dirname(os.path.abspath(__file__))
SESSIONS_DIR = Path(__file__).parent / ".sessions"
LOGS_DIR = Path(__file__).parent / ".logs"

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
        ]
    )
    return logging.getLogger(__name__)


logger = setup_logging()
