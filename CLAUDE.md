# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a research task application that combines a Python-based AI agent backend with a TypeScript/React chat frontend. The two components work together but are deployed separately to Databricks.

## Architecture

```
dbx-research-task-app/
├── agent_server/           # Python agent (deployed as Model Serving endpoint)
│   ├── agent.py           # Agent definition using OpenAI Agents SDK
│   ├── start_server.py    # MLflow AgentServer entry point
│   └── utils.py           # Databricks/OpenAI client utilities
├── e2e-chatbot-app-next/  # TypeScript chat app (deployed as Databricks App)
│   ├── client/            # React + Vite frontend
│   ├── server/            # Express backend
│   └── packages/          # Shared libraries (core, auth, db, ai-sdk-providers)
├── scripts/               # Setup and deployment scripts
└── app.yaml              # MLflow agent server deployment config
```

### How Components Connect

1. `agent_server/` gets deployed as a Databricks Model Serving endpoint
2. `e2e-chatbot-app-next/` connects to that endpoint via `DATABRICKS_SERVING_ENDPOINT` env var
3. The `API_PROXY` in `app.yaml` routes the chat app's requests to the local agent server

The agent uses `databricks-claude-3-7-sonnet` with MCP tools from Unity Catalog (`system.ai` functions).

## Commands

### Agent Server (Python)

```bash
# Quick start (sets up auth, MLflow experiment, starts both servers)
./scripts/quickstart.sh

# Start both agent server and chat app
./scripts/start-app.sh

# Start agent server only
uv run start-server
uv run start-server --reload    # with hot-reload
uv run start-server --port 8001 # custom port

# Run agent evaluation
uv run agent-evaluate

# Add Python dependencies
uv add <package-name>
```

### Chat App (TypeScript)

```bash
cd e2e-chatbot-app-next

# Development
npm run dev              # Start client (3000) + server (3001)
npm run dev:server       # Server only
npm run dev:client       # Client only

# Build
npm run build            # Full build with migrations

# Database
npm run db:generate      # Generate migrations from schema changes
npm run db:migrate       # Apply migrations (production-safe)
npm run db:studio        # Visual DB editor

# Testing
npm test                 # All Playwright tests
npm run test:with-db     # Tests with database
npm run test:ephemeral   # Tests without database

# Linting (uses Biome, not ESLint)
npm run lint
```

### Deployment

```bash
# Agent server to Databricks Apps
databricks apps create agent-prototype
databricks sync . "/Users/$USER/agent-prototype"
databricks apps deploy agent-prototype --source-code-path /Workspace/Users/$USER/agent-prototype

# Chat app via Databricks Asset Bundle
cd e2e-chatbot-app-next
databricks bundle validate
databricks bundle deploy
databricks bundle run databricks_chatbot
```

## Key Files

- `agent_server/agent.py:46` - Model selection (`databricks-claude-3-7-sonnet`)
- `app.yaml` - MLflow experiment ID and API proxy config
- `e2e-chatbot-app-next/databricks.yml` - DAB config for chat app deployment
- `e2e-chatbot-app-next/packages/db/src/schema.ts` - Database schema (uses `ai_chatbot` schema)
- `e2e-chatbot-app-next/packages/ai-sdk-providers/src/providers-server.ts` - Model routing logic

## Environment Variables

### Agent Server (.env.local at root)
```bash
DATABRICKS_CONFIG_PROFILE=your-profile  # or DATABRICKS_HOST + DATABRICKS_TOKEN
MLFLOW_EXPERIMENT_ID=your-experiment-id
```

### Chat App (.env.local in e2e-chatbot-app-next/)
```bash
DATABRICKS_CONFIG_PROFILE=your-profile
DATABRICKS_SERVING_ENDPOINT=your-endpoint-name
# Optional for persistent chat history:
PGUSER=...
PGHOST=...
PGDATABASE=databricks_postgres
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

- The chat app has its own detailed CLAUDE.md in `e2e-chatbot-app-next/CLAUDE.md`
- Database is optional; app runs in ephemeral mode without it
- Chat app uses Biome for linting/formatting, not ESLint/Prettier
- Agent uses MLflow tracing; traces appear in the linked MLflow experiment
