"""Configuration and path settings."""

import logging
import os
from datetime import datetime
from pathlib import Path

import mlflow
from agents import set_default_openai_api, set_default_openai_client
from agents.tracing import set_trace_processors
from databricks.sdk import WorkspaceClient
from dotenv import load_dotenv

from agent_server.utils import get_async_openai_client

load_dotenv()

# Initialize Databricks FMAPI client
workspace_client = WorkspaceClient()
databricks_openai_client = get_async_openai_client(workspace_client)
set_default_openai_client(databricks_openai_client)
set_default_openai_api("chat_completions")

# Configure MLflow for Databricks
mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "databricks"))
if experiment_id := os.getenv("MLFLOW_EXPERIMENT_ID"):
    mlflow.set_experiment(experiment_id=experiment_id)

# Disable OpenAI native tracing, use MLflow instead
set_trace_processors([])
mlflow.openai.autolog()

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
# Uses Databricks FMAPI model names (e.g., databricks-claude-sonnet-4-5)
MODELS = {
    "orchestrator": {
        "model": os.getenv("ORCHESTRATOR_MODEL", "databricks-claude-sonnet-4-5"),
    },
    "research": {
        "model": os.getenv("RESEARCH_MODEL", "databricks-claude-sonnet-4-5"),
    },
    "filesystem": {
        "model": os.getenv("FILESYSTEM_MODEL", "databricks-claude-sonnet-4-5"),
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
