import json
import os
from typing import AsyncGenerator

import mlflow
from agents import Agent, Runner, set_default_openai_api, set_default_openai_client, function_tool
from agents.mcp import MCPServerStdio, MCPServerStreamableHttp, MCPServerStreamableHttpParams
from agents.tracing import set_trace_processors
from databricks.sdk import WorkspaceClient
from mlflow.genai.agent_server import invoke, stream
from mlflow.types.responses import (
    ResponsesAgentRequest,
    ResponsesAgentResponse,
    ResponsesAgentStreamEvent,
)

from agent_server.utils import (
    get_async_openai_client,
    get_databricks_host_from_env,
    get_user_workspace_client,
    process_agent_stream_events,
)

sp_workspace_client = WorkspaceClient()
# NOTE: this will work for all databricks models OTHER than GPT-OSS, which uses a slightly different API
databricks_openai_client = get_async_openai_client(sp_workspace_client)
set_default_openai_client(databricks_openai_client)
set_default_openai_api("chat_completions")
set_trace_processors([])  # use mlflow for trace processing
mlflow.openai.autolog()

# Configuration
RESEARCH_JOB_ID = os.environ.get("RESEARCH_JOB_ID")

# Agent instructions
AGENT_INSTRUCTIONS = """You are a research assistant that can help users with:

1. **Quick Q&A**: Answer questions directly using your knowledge and available tools.

2. **Deep Research**: For complex topics requiring extensive research:
   - Help the user define the research scope (topic, specific questions, depth level)
   - When the scope is confirmed by the user, trigger an async research job
   - The job will run in the background and produce a detailed markdown report

## Available Tools

- **python_exec**: Execute Python code for data analysis and calculations
- **trigger_deep_research**: Start an async deep research task (for complex, multi-faceted topics)

## When to Use Deep Research

Offer deep research when the user asks about:
- Complex topics requiring multiple sources
- In-depth analysis that would take significant time
- Topics where a comprehensive report would be valuable
- Research that needs to be saved and referenced later

## Deep Research Workflow

1. When a user indicates they want deep research, ask clarifying questions:
   - What is the main topic?
   - What specific questions should be answered?
   - What depth level? (quick, standard, or deep)

2. Summarize the research scope and ask for confirmation:
   "I'll research [topic] focusing on [questions]. This will run in the background and may take several minutes. Ready to start?"

3. On user confirmation, call trigger_deep_research with the defined scope.

4. Let the user know they can check progress via the Research Tasks panel in the UI.
"""


@function_tool
def trigger_deep_research(
    task_id: str,
    topic: str,
    questions: list[str],
    depth: str = "standard",
    additional_context: str = "",
) -> str:
    """
    Trigger an async deep research job.

    Args:
        task_id: Unique identifier for this research task (UUID)
        topic: The main research topic
        questions: List of specific questions to investigate
        depth: Research depth - 'quick', 'standard', or 'deep'
        additional_context: Any additional context or constraints

    Returns:
        A message indicating the job was triggered or an error message
    """
    if not RESEARCH_JOB_ID:
        return "Error: Research jobs are not configured. RESEARCH_JOB_ID environment variable is not set."

    # Build scope object
    scope = {
        "topic": topic,
        "questions": questions,
        "depth": depth,
        "additionalContext": additional_context,
    }

    try:
        w = WorkspaceClient()
        run = w.jobs.run_now(
            job_id=int(RESEARCH_JOB_ID),
            python_params=["--task-id", task_id, "--scope", json.dumps(scope)]
        )

        return f"""Research job started successfully!

**Run ID:** {run.run_id}
**Task ID:** {task_id}

The research will run in the background. You can:
- Check progress in the Research Tasks panel
- Continue chatting while the research runs
- View the full report when complete

I'll let you know the research is underway. It may take several minutes depending on the depth level ({depth})."""

    except Exception as e:
        return f"Error triggering research job: {str(e)}"


async def init_mcp_server():
    return MCPServerStreamableHttp(
        params=MCPServerStreamableHttpParams(
            url=f"{get_databricks_host_from_env()}/api/2.0/mcp/functions/system/ai",
            headers=sp_workspace_client.config.authenticate(),
        ),
        client_session_timeout_seconds=20,
        name="system.ai uc function mcp server",
    )


def create_research_agent(mcp_server: MCPServerStdio) -> Agent:
    """Create the research agent with MCP tools and custom function tools."""
    tools = [trigger_deep_research]

    return Agent(
        name="research assistant",
        instructions=AGENT_INSTRUCTIONS,
        model="databricks-claude-3-7-sonnet",
        mcp_servers=[mcp_server],
        tools=tools,
    )


@invoke()
async def invoke(request: ResponsesAgentRequest) -> ResponsesAgentResponse:
    # user_workspace_client = get_user_workspace_client()
    async with await init_mcp_server() as mcp_server:
        agent = create_research_agent(mcp_server)
        messages = [i.model_dump() for i in request.input]
        result = await Runner.run(agent, messages)
        return ResponsesAgentResponse(output=[item.to_input_item() for item in result.new_items])


@stream()
async def stream(request: dict) -> AsyncGenerator[ResponsesAgentStreamEvent, None]:
    # user_workspace_client = get_user_workspace_client()
    async with await init_mcp_server() as mcp_server:
        agent = create_research_agent(mcp_server)
        messages = [i.model_dump() for i in request.input]
        result = Runner.run_streamed(agent, input=messages)

        async for event in process_agent_stream_events(result.stream_events()):
            yield event
