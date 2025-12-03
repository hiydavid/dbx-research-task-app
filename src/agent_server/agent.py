"""
Legacy entry point - redirects to main.py

This file is kept for backwards compatibility.
Use `python -m agent_server.main` or the new modular imports instead.
"""

from .main import run

if __name__ == "__main__":
    run()
