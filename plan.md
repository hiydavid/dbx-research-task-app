# Research Task Manager - Implementation Plan

## Overview

Build a research task manager agent that supports:
1. Quick Q&A mode (interactive responses)
2. Deep Research mode (async Lakeflow jobs with progress tracking)
3. Enhanced tools (web search, vector search via MCP)
4. Per-user long-term memory

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Model Serving Endpoint                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Interactive Agent (agent_server/agent.py)                     │  │
│  │  - Quick Q&A responses                                        │  │
│  │  - Research scope definition                                  │  │
│  │  - Triggers Lakeflow jobs                                     │  │
│  │  - MCP: system.ai, web_search, vector_search                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ triggers
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Lakeflow Serverless Job                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Research Agent (agent_server/research_job.py)                 │  │
│  │  - Same agent code, batch execution context                   │  │
│  │  - Writes progress to PostgreSQL                              │  │
│  │  - Outputs markdown to UC Volume                              │  │
│  │  - Checks cancellation flag periodically                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Unity Catalog Volume                              │
│  /Volumes/users/david_huang/research_outputs/{task_id}.md           │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Research Job Infrastructure

**1.1 Lakeflow Job Entry Point**

File: `agent_server/research_job.py` (created)

- Receives task_id and scope as parameters
- Loads agent with research-specific instructions
- Executes research loop with progress updates to PostgreSQL
- Writes final markdown to UC Volume
- Updates task status on completion/failure

**1.2 Job Trigger Tool**

File: `agent_server/agent.py` - `trigger_deep_research` function tool

```python
@function_tool
def trigger_deep_research(task_id, topic, questions, depth, additional_context):
    """Trigger an async deep research job"""
    w = WorkspaceClient()
    run = w.jobs.run_now(
        job_id=RESEARCH_JOB_ID,
        python_params=["--task-id", task_id, "--scope", json.dumps(scope)]
    )
```

---

### Phase 2: Enhanced Agent Tools

- Add web search MCP (you.com via Databricks)
- Add vector search MCP (when index is ready)
- Update agent instructions for tool usage

---

### Phase 3: Memory Integration

- Add UserMemory storage (PostgreSQL or separate service)
- Memory extraction from completed research
- Memory retrieval tool for agent
- Inject relevant memories into agent context

---

## Environment Variables

```bash
# Agent Server (.env.local)
DATABRICKS_CONFIG_PROFILE=your-profile
MLFLOW_EXPERIMENT_ID=your-experiment-id
RESEARCH_JOB_ID=             # Pre-deployed Lakeflow job ID
UC_VOLUME_PATH=/Volumes/users/david_huang/research_outputs
LAKEBASE_INSTANCE_NAME=      # Lakebase instance for progress updates
```

---

## Lakebase Authentication from Lakeflow Job

The research job running on serverless compute needs to write progress updates to Lakebase (PostgreSQL).

**Pattern**: Use Databricks SDK to generate OAuth tokens dynamically.

```python
from databricks.sdk import WorkspaceClient
import psycopg2
import uuid

w = WorkspaceClient()  # Uses job's run-as identity automatically
instance_name = "<LAKEBASE_INSTANCE>"
instance = w.database.get_database_instance(name=instance_name)
cred = w.database.generate_database_credential(
    request_id=str(uuid.uuid4()),
    instance_names=[instance_name]
)

conn = psycopg2.connect(
    host=instance.read_write_dns,
    dbname="databricks_postgres",
    user="<SERVICE_PRINCIPAL_CLIENT_ID>",
    password=cred.token,
    sslmode="require"
)
```

**Setup required:**
1. Create Postgres role matching the SP's `client_id` in Lakebase
2. Grant that role permissions on `ai_chatbot` schema
3. Configure the Lakeflow job to "Run as" the service principal

---

## Deployment Steps

1. Create UC Volume: `/Volumes/users/david_huang/research_outputs`
2. Set up Lakebase instance and permissions for job's service principal
3. Create Lakeflow job (serverless) from `research-job` entry point
4. Update `.env.local` with RESEARCH_JOB_ID and UC_VOLUME_PATH
5. Deploy agent_server to Databricks Apps
