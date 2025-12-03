#!/usr/bin/env python
"""Run the Research Assistant Agent directly."""

import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    project_root = Path(__file__).parent
    result = subprocess.run(
        ["uv", "run", "python", "-c",
         f"import sys; sys.path.insert(0, '{project_root / 'src'}'); from agent_server.main import run; run()"],
        cwd=project_root
    )
    sys.exit(result.returncode)
