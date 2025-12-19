"""Core agent logic shared between CLI and API."""

from typing import AsyncGenerator

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import StreamEvent, AssistantMessage, SystemMessage, ResultMessage

from agent_server.config import CONFIG, get_model, logger

# System prompt for the research assistant
SYSTEM_PROMPT = """You are a research planning and orchestration assistant.
Your role is to plan the research, find existing research already done and update it.

You have access to powerful tools:
- Use WebSearch to find research sources on the web
- Use Read/Write/Edit to manage research files in the output directory
- Use the Task tool to delegate complex research subtasks to specialized subagents
- Use Bash for any shell operations needed

When conducting research:
1. First search for relevant sources using WebSearch
2. Analyze and synthesize the information found
3. Write structured research reports to files
4. Update existing research when new information is found

Always cite your sources and provide URLs when available.
"""


def get_agent_options(session_id: str | None = None) -> ClaudeAgentOptions:
    """Create Claude Agent options with MCP servers and tools."""
    options = ClaudeAgentOptions(
        model=get_model(),
        system_prompt=SYSTEM_PROMPT,
        allowed_tools=[
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Glob",
            "Grep",
            "WebSearch",
            "WebFetch",
            "Task",
        ],
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
) -> AsyncGenerator[dict, None]:
    """
    Stream agent responses as structured events.

    Yields events with structure:
    - {"type": "token", "data": {"text": "..."}}
    - {"type": "tool_use", "data": {"name": "...", "id": "..."}}
    - {"type": "system", "data": {"session_id": "..."}}
    - {"type": "done", "data": {"usage": {...}}}
    - {"type": "error", "data": {"message": "..."}}
    """
    options = get_agent_options(session_id)
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
