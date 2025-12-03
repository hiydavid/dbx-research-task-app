"""CLI commands, argument parsing, and help display."""

import argparse

from .config import CONFIG, DEFAULT_SANDBOX, LOGS_DIR


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Research Assistant Agent")
    parser.add_argument(
        "--output-dir", "-o",
        type=str,
        default=DEFAULT_SANDBOX,
        help="Directory for research output files"
    )
    parser.add_argument(
        "--resume", "-r",
        type=str,
        default=None,
        help="Resume a previous session by name"
    )
    return parser.parse_args()


def print_help() -> None:
    """Display help information."""
    print("\n" + "=" * 60)
    print("Available Commands:")
    print("=" * 60)
    print("  /help     - Show this help message")
    print("  /clear    - Clear conversation history")
    print("  /status   - Show current configuration")
    print("  /sessions - List saved sessions")
    print("  /save [name] - Save current session")
    print("  exit, quit, q - End the session")
    print()
    print("Research Capabilities:")
    print("  - Search the web for sources (Tavily)")
    print("  - Create structured research plans")
    print("  - Read and update existing research files")
    print("  - Generate research reports")
    print("=" * 60 + "\n")


def print_status() -> None:
    """Display current configuration."""
    print("\n" + "-" * 40)
    print("Current Configuration:")
    print("-" * 40)
    print(f"  Output directory: {CONFIG['output_dir']}")
    print(f"  Session file: {CONFIG['session_file'] or 'None (new session)'}")
    print(f"  Logs directory: {LOGS_DIR}")
    print("-" * 40 + "\n")
