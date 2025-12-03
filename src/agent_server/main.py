"""Entry point for the Research Assistant Agent."""

import asyncio

from .config import CONFIG
from .cli import parse_args
from .chat import interactive_chat


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
