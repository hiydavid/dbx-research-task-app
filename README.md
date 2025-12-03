# (WIP) Research Task Manager App

A multi-agent research assistant that orchestrates web searches, sequential thinking, and filesystem operations to conduct and document research tasks.

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

### Component Details

#### Orchestration Agent
- **Role**: Top-level coordinator and planner
- **Tools**: `research_agent`, `filesystem_agent`
- **MCP Servers**: Sequential Thinking
- **Responsibilities**:
  - Receives user research goals
  - Plans research strategy using sequential thinking
  - Delegates to specialized agents
  - Synthesizes results
  - Manages output to filesystem

#### Research Agent
- **Role**: Web search specialist
- **Output Type**: `ResearchSourcesModel` (list of sources)
- **MCP Servers**: Tavily Search
- **Capabilities**:
  - Real-time web search via Tavily API
  - Configurable result count (max 10)
  - Basic or advanced search depth
  - Returns verified URLs and citations

#### Filesystem Agent
- **Role**: File I/O operations
- **Output Type**: String
- **MCP Servers**: Filesystem
- **Capabilities**:
  - Read existing research files
  - Write research plans and results
  - Update existing documentation
  - Scoped to sandbox directory for security

#### MCP Servers
- **Sequential Thinking**: NPX-based server for structured reasoning
- **Filesystem**: NPX-based server with sandboxed file access
- **Tavily Search**: NPX-based server requiring API key

### Data Flow

1. User provides research goal
2. Orchestration Agent uses Sequential Thinking to create plan
3. Orchestration Agent calls Research Agent for web sources
4. Research Agent uses Tavily to search and returns sources
5. Orchestration Agent uses Sequential Thinking to analyze sources
6. Orchestration Agent calls Filesystem Agent to check existing research
7. Filesystem Agent reads/writes local files
8. Orchestration Agent synthesizes final research output
9. Filesystem Agent writes final results to text file

### Technology Stack

- **Agent Framework**: OpenAI Agents SDK (`openai-agents>=0.6.1`)
- **MCP Protocol**: Model Context Protocol (`mcp>=1.23.1`)
- **Data Validation**: Pydantic (`pydantic>=2.12.5`)
- **Environment**: Python 3.13+
- **Package Manager**: UV

