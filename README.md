# Research Task Manager App

A research assistant powered by the Claude Agent SDK with real-time streaming, web search, and file management capabilities.

## Project Structure

```text
dbx-research-task-app/
├── run_server.py            # Web server entry point
├── pyproject.toml
├── .env                     # API keys (ANTHROPIC_API_KEY)
├── output/                  # Agent-generated research files
├── .sessions/               # Saved conversation sessions
├── .logs/                   # Application logs
├── static/                  # Built React app (generated)
├── src/
│   ├── agent_server/        # Python backend
│   │   ├── api/             # Web API layer (Starlette + SSE)
│   │   └── core/            # Agent logic
│   └── web/                 # React frontend source
│       ├── src/components/  # React components
│       └── src/hooks/       # Custom React hooks
```

## Architecture

```text
User Request
     │
     ▼
┌─────────────────────────────────────────┐
│         Claude Agent SDK                │
│         query() with streaming          │
│                                         │
│  Built-in Tools:                        │
│  • WebSearch, WebFetch                  │
│  • Read, Write, Edit                    │
│  • Bash, Glob, Grep                     │
│  • Task (delegate to subagents)         │
└─────────────────────────────────────────┘
     │
     ▼
  output/  (research files)
```

## Module Details

### Configuration (`config.py`)

- Environment loading via `python-dotenv`
- Model selection via `CLAUDE_MODEL` env var
- Logging setup (daily log files in `.logs/`)
- Global config state

### Session Management (`session.py`)

- Save/load conversation history as JSON
- Sessions stored in `.sessions/` directory
- Auto-timestamped session names

## Usage

### Quick Start

```bash
# Build the React frontend (first time only)
cd src/web && npm install && npm run build && cd ../..

# Start the web server
python run_server.py
```

Then open <http://localhost:8000> in your browser.

### Development

```bash
# Terminal 1: Start Python API server
python run_server.py

# Terminal 2: Start Vite dev server with HMR
cd src/web && npm run dev
```

Then open <http://localhost:5173> for development with hot reload.

### Databricks Apps Deployment

This app can be deployed to [Databricks Apps](https://docs.databricks.com/en/dev-tools/databricks-apps/index.html).

**Prerequisites:**

1. Build the frontend:

   ```bash
   cd src/web && npm install && npm run build && cd ../..
   ```

2. Create a Databricks secret for the API key:

   ```bash
   databricks secrets create-scope research-app
   databricks secrets put-secret research-app anthropic-api-key
   ```

3. Commit all files including `/static/` directory

4. Deploy via Databricks CLI or workspace UI

**Configuration files:**

- `app.yaml` - Databricks Apps runtime configuration
- `requirements.txt` - pip dependencies (Databricks uses pip, not UV)

**Note:** Databricks Apps storage is ephemeral. Sessions and output files reset on compute restart.

## Environment Variables

Create a `.env` file:

```bash
# Anthropic API Key (required)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Model selection (optional, defaults to sonnet)
# Options: opus, sonnet, haiku, or full model ID
CLAUDE_MODEL=sonnet
```

## Technology Stack

- **Agent Framework**: Claude Agent SDK (`claude-agent-sdk>=0.1.11`)
- **Data Validation**: Pydantic (`pydantic>=2.12.5`)
- **Environment**: Python 3.10+
- **Package Manager**: UV

## Available Tools

The agent has access to these built-in tools:

| Tool | Description |
|------|-------------|
| `WebSearch` | Search the web for information |
| `WebFetch` | Fetch and parse web page content |
| `Read` | Read file contents |
| `Write` | Write content to files |
| `Edit` | Edit existing files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `Task` | Delegate to specialized subagents |
