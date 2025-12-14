# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

```bash
# Run via UV (recommended)
python run.py

# With custom output directory
python run.py --output-dir ./my-research

# Resume a previous session
python run.py --resume <session_name>
```

Or press the play button in VSCode on `run.py`.

## Environment Setup

Requires Python 3.10+ and UV package manager. Create a `.env` file:
```
# Anthropic API key (required)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Model selection (optional, defaults to sonnet)
# Options: opus, sonnet, haiku, or full model ID
CLAUDE_MODEL=sonnet
```

Install dependencies: `uv sync`

## Architecture Overview

Research assistant powered by the **Claude Agent SDK** (`claude-agent-sdk`).

**Core Design:**
- Uses the `query()` function from Claude Agent SDK for streaming conversations
- Token-level streaming enabled via `include_partial_messages=True`
- Built-in tools: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `Task`
- The `Task` tool enables delegation to specialized subagents for complex research tasks

**Key Pattern:** Single agent with tool delegation via the SDK's built-in `Task` tool:
```python
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import StreamEvent

options = ClaudeAgentOptions(
    system_prompt="...",
    allowed_tools=["Read", "Write", "WebSearch", "Task"],
    permission_mode="acceptEdits",
    include_partial_messages=True,
)

async for message in query(prompt=user_input, options=options):
    if isinstance(message, StreamEvent):
        # Handle streaming tokens via content_block_delta events
        event = message.event
        if event.get("type") == "content_block_delta":
            text = event.get("delta", {}).get("text", "")
            print(text, end="", flush=True)
```

## Key Directories

- `output/` - Agent-generated research files (filesystem sandbox)
- `.sessions/` - Saved conversation history (JSON)
- `.logs/` - Daily application logs

## Key Files

- `src/agent_server/chat.py` - Main chat loop with Claude Agent SDK integration and streaming
- `src/agent_server/config.py` - Configuration, model selection, and logging setup
- `src/agent_server/cli.py` - CLI commands and argument parsing
- `src/agent_server/session.py` - Session persistence (save/load/list)
- `src/agent_server/main.py` - Entry point

## Model Configuration

Models can be specified via the `CLAUDE_MODEL` environment variable:

- `opus` → claude-opus-4-5-20250514
- `sonnet` → claude-sonnet-4-5-20250514 (default)
- `haiku` → claude-haiku-4-5-20250514
- Or use a full model ID directly
