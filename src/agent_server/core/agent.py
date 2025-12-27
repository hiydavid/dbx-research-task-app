"""Core agent logic shared between CLI and API."""

from enum import Enum
from typing import AsyncGenerator

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import StreamEvent, AssistantMessage, SystemMessage, ResultMessage

from agent_server.config import CONFIG, get_model, logger


class AgentRole(str, Enum):
    """Role determines which agent persona and tools to use."""
    PLANNER = "planner"
    RESEARCHER = "researcher"


# Planner Agent: Conversational, helps scope research, triggers background tasks
PLANNER_PROMPT = """You are a research planning assistant. Your role is to:
1. Help users clarify and scope their research questions
2. Break complex topics into manageable research tasks
3. Propose research plans and WAIT for user confirmation before launching
4. Track progress of ongoing research and report status to users
5. Summarize completed research findings

IMPORTANT: Always propose a research scope and wait for user to confirm before
starting any research task. Never auto-launch research without explicit approval.

When a user wants to research something:
- Ask clarifying questions to understand scope, depth, and format needed
- Propose a clear research brief with topic, scope, and expected output
- Wait for user confirmation ("yes", "go ahead", "start", etc.)
- Only then output the research task trigger (see format below)

When the user confirms a research task, output EXACTLY this format:
```
:::research_task
{"topic": "The research topic", "scope": "Detailed scope description", "output": "markdown"}
:::
```

The system will automatically detect this and start the research in the background.
After outputting the trigger, confirm to the user that research has started.

You have access to:
- WebSearch: For quick lookups to help scope research (NOT for deep research)
- Read: To check existing output files and summarize findings for users
- Glob: To list available research outputs in the output directory

You can see the status of all research tasks in this session at the start of each message.
When users ask about progress, refer to the task status information provided.
When research completes, use Read to access the output files and summarize findings.
"""


# Researcher Agent: Execution-focused, runs in background, writes reports
RESEARCHER_PROMPT = """You are a research specialist executing a specific research task.

Your job is to:
1. Thoroughly research the given topic using all available tools
2. Find credible sources and cite them with URLs
3. Write a comprehensive markdown report to the output directory
4. Structure findings clearly with headings, bullet points, and summaries

Research Process:
1. Use WebSearch to find relevant sources on the topic
2. Use WebFetch to analyze key pages in depth
3. Synthesize findings into a coherent, well-structured report
4. Use Write to save the final report as a markdown file

File naming: Use descriptive kebab-case names based on the topic.
Examples: "ai-agent-trends-2024.md", "react-state-management-comparison.md"

Report structure:
- Title and date
- Executive summary (2-3 paragraphs)
- Detailed findings with sections
- Key takeaways / recommendations
- Sources with URLs

Always cite sources with URLs. Be thorough but focused on the specific research request.
Do not engage in conversation - focus entirely on executing the research task.
"""


def get_agent_options(
    session_id: str | None = None,
    role: AgentRole = AgentRole.PLANNER,
) -> ClaudeAgentOptions:
    """Create Claude Agent options with MCP servers and tools."""
    # Select prompt and tools based on role
    if role == AgentRole.PLANNER:
        system_prompt = PLANNER_PROMPT
        allowed_tools = [
            "WebSearch",  # Quick lookups for scoping
            "Read",       # Read output files to summarize
            "Glob",       # List available outputs
        ]
    else:  # RESEARCHER
        system_prompt = RESEARCHER_PROMPT
        allowed_tools = [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Glob",
            "Grep",
            "WebSearch",
            "WebFetch",
            "Task",  # Can delegate subtasks
        ]

    options = ClaudeAgentOptions(
        model=get_model(),
        system_prompt=system_prompt,
        allowed_tools=allowed_tools,
        permission_mode="acceptEdits",
        cwd=CONFIG["output_dir"],
        include_partial_messages=True,
    )

    if session_id:
        options = ClaudeAgentOptions(**{**options.__dict__, "resume": session_id})

    return options


async def stream_agent_response(
    message: str,
    session_id: str | None = None,
    conversation_history: list[dict] | None = None,
    role: AgentRole = AgentRole.PLANNER,
) -> AsyncGenerator[dict, None]:
    """
    Stream agent responses as structured events.

    Args:
        message: The user message to send to the agent
        session_id: Optional session ID for resuming conversations
        conversation_history: Optional conversation history (unused, for future use)
        role: Which agent role to use (PLANNER for chat, RESEARCHER for tasks)

    Yields events with structure:
    - {"type": "token", "data": {"text": "..."}}
    - {"type": "tool_use", "data": {"name": "...", "id": "..."}}
    - {"type": "system", "data": {"session_id": "..."}}
    - {"type": "done", "data": {"usage": {...}}}
    - {"type": "error", "data": {"message": "..."}}
    """
    options = get_agent_options(session_id, role=role)
    current_session_id = session_id

    try:
        async for msg in query(prompt=message, options=options):
            if isinstance(msg, StreamEvent):
                event = msg.event
                event_type = event.get("type", "")

                if event_type == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        yield {"type": "token", "data": {"text": delta.get("text", "")}}

            elif isinstance(msg, SystemMessage):
                if msg.subtype == "init" and hasattr(msg, "data"):
                    current_session_id = msg.data.get("session_id")
                    yield {"type": "system", "data": {"session_id": current_session_id}}

            elif isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if hasattr(block, "name"):
                        yield {
                            "type": "tool_use",
                            "data": {
                                "name": block.name,
                                "id": getattr(block, "id", None),
                            },
                        }

            elif isinstance(msg, ResultMessage):
                yield {
                    "type": "done",
                    "data": {
                        "session_id": current_session_id,
                        "usage": getattr(msg, "usage", None),
                        "cost_usd": getattr(msg, "total_cost_usd", None),
                    },
                }

    except Exception as e:
        logger.error(f"Agent error: {e}")
        yield {"type": "error", "data": {"message": str(e)}}
