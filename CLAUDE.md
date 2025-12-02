# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a research task agent backend built with Python and the OpenAI Agents SDK. It deploys to Databricks as a Model Serving endpoint via MLflow.

## Architecture

```
dbx-research-task-app/
├── agent_server/           # Python agent (deployed as Model Serving endpoint)
│   ├── agent.py           # Agent definition using OpenAI Agents SDK
│   ├── research_job.py    # Lakeflow job entry point for deep research
│   ├── start_server.py    # MLflow AgentServer entry point
│   └── utils.py           # Databricks/OpenAI client utilities
├── scripts/               # Setup and deployment scripts
├── app.yaml              # MLflow agent server deployment config
└── plan.md               # Implementation plan for research features
```

The agent uses `databricks-claude-3-7-sonnet` with MCP tools from Unity Catalog (`system.ai` functions).

## Commands

### Agent Server (Python)

```bash
# Start agent server
uv run start-server
uv run start-server --reload    # with hot-reload
uv run start-server --port 8001 # custom port

# Run agent evaluation
uv run agent-evaluate

# Add Python dependencies
uv add <package-name>
```

### Deployment

```bash
# Deploy to Databricks Apps
databricks apps create agent-prototype
databricks sync . "/Users/$USER/agent-prototype"
databricks apps deploy agent-prototype --source-code-path /Workspace/Users/$USER/agent-prototype
```

## Key Files

- [agent_server/agent.py](agent_server/agent.py) - Agent definition and tools
- [agent_server/research_job.py](agent_server/research_job.py) - Lakeflow job for deep research
- [app.yaml](app.yaml) - MLflow experiment ID and API proxy config

## Environment Variables

### Agent Server (.env.local at root)
```bash
DATABRICKS_CONFIG_PROFILE=your-profile  # or DATABRICKS_HOST + DATABRICKS_TOKEN
MLFLOW_EXPERIMENT_ID=your-experiment-id
RESEARCH_JOB_ID=                         # Lakeflow job ID for deep research
UC_VOLUME_PATH=/Volumes/users/david_huang/research_outputs
```

## Testing Locally

Query the agent directly:
```bash
# Streaming
curl -X POST http://localhost:8000/invocations \
  -H "Content-Type: application/json" \
  -d '{"input": [{"role": "user", "content": "hi"}], "stream": true}'

# Non-streaming
curl -X POST http://localhost:8000/invocations \
  -H "Content-Type: application/json" \
  -d '{"input": [{"role": "user", "content": "hi"}]}'
```

## Notes

- Agent uses MLflow tracing; traces appear in the linked MLflow experiment
- Deep research triggers async Lakeflow jobs that write results to UC Volume
- See [plan.md](plan.md) for implementation roadmap
