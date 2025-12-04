# (WIP) Research Task Manager App

A multi-agent research assistant that orchestrates web searches, sequential thinking, and filesystem operations to conduct and document research tasks.

## Project Structure

```
dbx-research-task-app/
├── run.py                   # Entry point (run with VSCode play button)
├── pyproject.toml
├── .env                     # API keys (TAVILY_API_KEY, OPENAI_API_KEY)
├── output/                  # Agent-generated research files
├── .sessions/               # Saved conversation sessions
├── .logs/                   # Application logs
└── src/agent_server/
    ├── __init__.py
    ├── main.py              # Main async entry point
    ├── cli.py               # CLI argument parsing and commands
    ├── chat.py              # Interactive chat loop
    ├── config.py            # Configuration and logging
    ├── servers.py           # MCP server definitions
    ├── session.py           # Session persistence
    └── agent_definitions/
        ├── __init__.py      # Exports orchestration_agent
        ├── orchestrator.py  # Top-level coordination agent
        ├── research.py      # Web search agent (Tavily)
        └── filesystem.py    # File I/O agent
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Request                            │
│                    (Research Goal/Task)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestration Agent                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Plans research strategy                                 │  │
│  │ • Coordinates sub-agents                                  │  │
│  │ • Manages workflow                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────┬───────────────────────────────┘
                │                 │
        ┌───────┴────────┐        └─────────────┐
        │                │                      │
        ▼                ▼                      ▼
┌──────────────┐  ┌──────────────┐     ┌──────────────────┐
│   Research   │  │  Filesystem  │     │   Sequential     │
│    Agent     │  │    Agent     │     │  Thinking MCP    │
├──────────────┤  ├──────────────┤     ├──────────────────┤
│ • Web search │  │ • Read files │     │ • Structured     │
│ • Find       │  │ • Write files│     │   reasoning      │
│   sources    │  │ • Update     │     │ • Step-by-step   │
│ • Returns    │  │   research   │     │   planning       │
│   URLs       │  │              │     │                  │
└──────┬───────┘  └──────┬───────┘     └───────┬──────────┘
       │                 │                     │
       ▼                 ▼                     ▼
┌──────────────┐  ┌──────────────┐     ┌──────────────────┐
│  Tavily MCP  │  │Filesystem MCP│     │  Sequential      │
│   Server     │  │   Server     │     │  Thinking MCP    │
├──────────────┤  ├──────────────┤     │    Server        │
│ • Real-time  │  │ • Local file │     ├──────────────────┤
│   web search │  │   operations │     │ • NPX-based      │
│ • Max 10     │  │ • Scoped to  │     │ • Provides       │
│   results    │  │   sandbox    │     │   thinking tools │
│ • Basic/Adv  │  │   directory  │     │                  │
│   depth      │  │              │     │                  │
└──────────────┘  └──────────────┘     └──────────────────┘
```

## Module Details

### Entry Point (`main.py`)

- Parses CLI arguments
- Initializes configuration
- Launches interactive chat loop

### CLI (`cli.py`)

- `--output-dir, -o`: Directory for research output files
- `--resume, -r`: Resume a previous session by name
- Slash commands: `/help`, `/clear`, `/status`, `/sessions`, `/save [name]`

### Chat Loop (`chat.py`)

- Interactive REPL with streaming output
- Manages conversation history
- Handles tool call progress display

### Configuration (`config.py`)

- Environment loading via `python-dotenv`
- Logging setup (daily log files in `.logs/`)
- Global config state
- Per-agent model configuration
- MLflow tracing setup (`mlflow.openai.autolog()`)

### Session Management (`session.py`)

- Save/load conversation history as JSON
- Sessions stored in `.sessions/` directory
- Auto-timestamped session names

### MCP Servers (`servers.py`)

- **Sequential Thinking**: `@modelcontextprotocol/server-sequential-thinking`
- **Filesystem**: `@modelcontextprotocol/server-filesystem` (sandboxed to `output/`)
- **Tavily Search**: `tavily-mcp@latest` (requires `TAVILY_API_KEY`)

### Agents (`agent_definitions/`)

#### Orchestration Agent (`orchestrator.py`)

- Top-level coordinator and planner
- Tools: `research_agent`, `filesystem_agent`
- MCP Servers: Sequential Thinking (attached at runtime)

#### Research Agent (`research.py`)

- Web search specialist via Tavily
- Output: `ResearchSourcesModel` (list of URLs)
- Search guidelines: max 10 results, basic/advanced depth

#### Filesystem Agent (`filesystem.py`)

- File I/O operations
- Output: String
- Scoped to `output/` directory

## Data Flow

1. User provides research goal via interactive prompt
2. Orchestration Agent uses Sequential Thinking to create plan
3. Orchestration Agent calls Research Agent for web sources
4. Research Agent uses Tavily to search and returns sources
5. Orchestration Agent uses Sequential Thinking to analyze sources
6. Orchestration Agent calls Filesystem Agent to check existing research
7. Filesystem Agent reads/writes local files
8. Orchestration Agent synthesizes final research output
9. Filesystem Agent writes final results to text file

## Technology Stack

- **Agent Framework**: OpenAI Agents SDK (`openai-agents>=0.6.1`)
- **MCP Protocol**: Model Context Protocol (`mcp>=1.23.1`)
- **Tracing**: MLflow (`mlflow>=3.6`) with Databricks integration
- **Data Validation**: Pydantic (`pydantic>=2.12.5`)
- **Environment**: Python 3.13+
- **Package Manager**: UV

## MLflow Tracing

Agent execution is automatically traced and sent to Databricks MLflow:

- `mlflow.openai.autolog()` captures all LLM calls and `@function_tool` invocations
- `mlflow.start_span()` wraps each conversation turn to capture request/response
- Traces show hierarchical spans: `orchestrator_turn` → `research_agent` / `filesystem_agent`

View traces in the Databricks MLflow Experiments UI.

## Usage

```bash
# Run the research assistant (or press play button in VSCode on run.py)
python run.py

# With custom output directory
python run.py --output-dir ./my-research

# Resume a previous session
python run.py --resume 20241201_143022
```

## Environment Variables

Create a `.env` file:

```bash
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key

# Tavily API Key (for web search)
TAVILY_API_KEY=your_tavily_api_key

# Databricks authentication (profile-based)
DATABRICKS_CONFIG_PROFILE=DEFAULT
DATABRICKS_TOKEN=your_databricks_api_key
DATABRICKS_HOST="https://your-workspace.cloud.databricks.com"

# MLflow configuration
MLFLOW_EXPERIMENT_ID=your_experiment_id
MLFLOW_TRACKING_URI="databricks"
MLFLOW_REGISTRY_URI="databricks-uc"

# Optional: Override models per agent (defaults shown)
ORCHESTRATOR_MODEL=gpt-4.1
RESEARCH_MODEL=gpt-4.1-mini
FILESYSTEM_MODEL=gpt-4.1-mini

```

Note: `gpt-4.1` models do not support temperature settings.

