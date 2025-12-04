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

Requires Python 3.13+ and UV package manager. Create a `.env` file (see `.env.example`):
```
TAVILY_API_KEY=your_tavily_api_key
OPENAI_API_KEY=your_openai_api_key

# Databricks authentication (profile-based)
DATABRICKS_CONFIG_PROFILE=e2-fe
DATABRICKS_HOST="https://e2-demo-field-eng.cloud.databricks.com"

# MLflow configuration
MLFLOW_EXPERIMENT_ID=567797472280417
MLFLOW_TRACKING_URI="databricks"
MLFLOW_REGISTRY_URI="databricks-uc"

# Optional: Override models per agent (defaults shown)
ORCHESTRATOR_MODEL=gpt-4.1
RESEARCH_MODEL=gpt-4.1-mini
FILESYSTEM_MODEL=gpt-4.1-mini
```

Install dependencies: `uv sync`

Model configuration is centralized in `config.py` via the `MODELS` dict. Note: `gpt-4.1` models do not support temperature settings.

## MLflow Tracing

Agent traces are automatically captured and sent to Databricks MLflow:

- **Auto-tracing**: `mlflow.openai.autolog()` captures all LLM calls and tool invocations
- **Top-level span**: `mlflow.start_span()` in `chat.py` wraps each conversation turn with request/response
- **Configuration**: Set via `MLFLOW_TRACKING_URI` and `MLFLOW_EXPERIMENT_ID` environment variables

Traces show hierarchical view of orchestrator → sub-agent calls in the Databricks MLflow UI.

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
