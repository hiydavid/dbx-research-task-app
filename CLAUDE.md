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

Requires Python 3.13+ and UV package manager. Create a `.env` file with:
```
TAVILY_API_KEY=your_tavily_api_key
OPENAI_API_KEY=your_openai_api_key

# Optional: Override models per agent (defaults shown)
ORCHESTRATOR_MODEL=gpt-4.1
RESEARCH_MODEL=gpt-4.1-mini
FILESYSTEM_MODEL=gpt-4.1-mini
```

Install dependencies: `uv sync`

Model configuration is centralized in `config.py` via the `MODELS` dict.

## Architecture Overview

Multi-agent system using the OpenAI Agents SDK with MCP (Model Context Protocol) servers.

**Agent Hierarchy:**
- **Orchestration Agent** (`orchestrator.py`): Top-level coordinator that plans research and delegates to sub-agents
  - Has `research_agent` and `filesystem_agent` as tools (sub-agents)
  - Sequential Thinking MCP server is attached at runtime in `chat.py` (not in the agent definition)
- **Research Agent** (`research.py`): Web search via Tavily MCP, returns `ResearchSourcesModel` (list of URLs)
- **Filesystem Agent** (`filesystem.py`): File I/O via Filesystem MCP, sandboxed to `output/` directory

**MCP Servers** (defined in `servers.py`):
- Sequential Thinking: `@modelcontextprotocol/server-sequential-thinking`
- Filesystem: `@modelcontextprotocol/server-filesystem` (scoped to `output/`)
- Tavily: `tavily-mcp@latest`

**Key Pattern:** Sub-agents use async context managers to manage MCP server lifecycles:
```python
async with tavily_server:
    result = await Runner.run(agent, instructions)
```

## Key Directories

- `output/` - Agent-generated research files (filesystem sandbox)
- `.sessions/` - Saved conversation history (JSON)
- `.logs/` - Daily application logs
