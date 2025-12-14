# Research Task Manager App

A research assistant powered by the Claude Agent SDK with real-time streaming, web search, and file management capabilities.

## Project Structure

```text
dbx-research-task-app/
├── run.py                   # Entry point (run with VSCode play button)
├── pyproject.toml
├── .env                     # API keys (ANTHROPIC_API_KEY)
├── output/                  # Agent-generated research files
├── .sessions/               # Saved conversation sessions
├── .logs/                   # Application logs
└── src/agent_server/
    ├── __init__.py
    ├── main.py              # Main async entry point
    ├── chat.py              # Interactive chat loop with streaming
    ├── cli.py               # CLI argument parsing and commands
    ├── config.py            # Configuration and logging
    └── session.py           # Session persistence
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

### Entry Point (`main.py`)

- Parses CLI arguments
- Initializes configuration
- Launches interactive chat loop

### Chat Loop (`chat.py`)

- Interactive REPL with real-time token streaming
- Handles `StreamEvent` messages for live output
- Manages conversation history
- Displays tool use notifications

### CLI (`cli.py`)

- `--output-dir, -o`: Directory for research output files
- `--resume, -r`: Resume a previous session by name
- Slash commands: `/help`, `/clear`, `/status`, `/sessions`, `/save [name]`

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

```bash
# Run the research assistant
python run.py

# With custom output directory
python run.py --output-dir ./my-research

# Resume a previous session
python run.py --resume 20241201_143022
```

Or press the play button in VSCode on `run.py`.

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
