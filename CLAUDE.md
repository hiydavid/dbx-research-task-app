# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

### Quick Start

```bash
# Build frontend (first time)
cd src/web && npm install && npm run build && cd ../..

# Start server
python run_server.py
```

### Development

```bash
# Terminal 1: Python API
python run_server.py

# Terminal 2: Vite dev server
cd src/web && npm run dev
```

### Databricks Apps Deployment

```bash
# Build frontend (required before deployment)
cd src/web && npm install && npm run build && cd ../..

# Create secret for API key
databricks secrets create-scope research-app
databricks secrets put-secret research-app anthropic-api-key
```

Configuration: `app.yaml` (runtime) and `requirements.txt` (pip deps)

## Environment Setup

Requires Python 3.10+ and UV package manager. Create a `.env` file:

```text
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
- `static/` - Built React app (served by Python)
- `src/web/` - React frontend source

## Key Files

### Deployment

- `app.yaml` - Databricks Apps runtime configuration
- `requirements.txt` - pip dependencies for Databricks Apps

### Backend (Python)

- `src/agent_server/core/agent.py` - Agent logic with streaming
- `src/agent_server/api/app.py` - Starlette ASGI app
- `src/agent_server/api/routes.py` - API endpoints with SSE streaming
- `src/agent_server/config.py` - Configuration and logging
- `src/agent_server/session.py` - Session persistence

### Frontend (React)

- `src/web/src/App.tsx` - Main app component
- `src/web/src/hooks/useChat.ts` - SSE streaming hook
- `src/web/src/components/chat/` - Chat UI components
- `src/web/src/components/research/` - Research sidebar (placeholders)

## Model Configuration

Models can be specified via the `CLAUDE_MODEL` environment variable:

- `opus` → claude-opus-4-5-20250514
- `sonnet` → claude-sonnet-4-5-20250514 (default)
- `haiku` → claude-haiku-4-5-20250514
- Or use a full model ID directly
