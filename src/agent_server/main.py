"""Entry point for the Research Assistant Agent."""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for direct execution
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_server.config import CONFIG
from agent_server.cli import parse_args
from agent_server.chat import interactive_chat


async def main() -> None:
    """Main entry point."""
    # Parse command line arguments
    args = parse_args()

    # Update global config
    CONFIG["output_dir"] = args.output_dir

    # Run interactive chat
    await interactive_chat(resume_session=args.resume)


def run() -> None:
    """Run the agent (convenience function for entry point)."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
