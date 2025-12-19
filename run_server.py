#!/usr/bin/env python
"""Run the Research Assistant web server."""

import os
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    project_root = Path(__file__).parent
    src_dir = project_root / "src"

    # Set PYTHONPATH to include src directory
    env = os.environ.copy()
    env["PYTHONPATH"] = str(src_dir)
    # Enable CORS for Vite dev server
    env["DEV_MODE"] = "true"

    result = subprocess.run(
        [
            "uv",
            "run",
            "uvicorn",
            "agent_server.api.app:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--reload",
        ],
        cwd=project_root,
        env=env,
    )
    sys.exit(result.returncode)
