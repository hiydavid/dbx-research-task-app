"""Interactive chat loop for the research assistant using Claude Agent SDK."""

import traceback

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage, StreamEvent, SystemMessage

from agent_server.config import CONFIG, get_model, logger
from agent_server.session import save_session, load_session, list_sessions
from agent_server.cli import print_help, print_status

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


def get_agent_options() -> ClaudeAgentOptions:
    """Create Claude Agent options with MCP servers and tools."""
    return ClaudeAgentOptions(
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
        include_partial_messages=True,  # Enable token-level streaming
    )


async def interactive_chat(resume_session: str = None) -> None:
    """
    Run an interactive chat loop with the Claude Agent SDK.
    Type 'exit', 'quit', or press Ctrl+C to end the session.
    """
    print("=" * 60)
    print("Research Assistant - Interactive Mode (Claude Agent SDK)")
    print("=" * 60)
    print("Type /help for available commands")
    print("Type 'exit', 'quit', or press Ctrl+C to end the session.")
    print("=" * 60)
    print()

    # Initialize or resume conversation history
    conversation_history = []
    session_id = None

    if resume_session:
        conversation_history = load_session(resume_session)
        CONFIG["session_file"] = resume_session

    while True:
        try:
            # Get user input
            user_input = input(" > ").strip()

            # Check for exit commands
            if user_input.lower() in {"exit", "quit", "q"}:
                if conversation_history:
                    save_choice = input("Save session before exiting? (y/n): ").strip().lower()
                    if save_choice == "y":
                        save_session(conversation_history)
                print("\n" + "=" * 60)
                print("Ending session. Goodbye!")
                print("=" * 60)
                break

            # Skip empty inputs
            if not user_input:
                continue

            # Handle commands
            if user_input.startswith("/"):
                handle_command(user_input, conversation_history)
                continue

            # Add user message to conversation history
            conversation_history.append({"role": "user", "content": user_input})

            # Get agent options
            options = get_agent_options()

            # If we have a session_id from previous turn, use it to resume
            if session_id:
                options = ClaudeAgentOptions(
                    **{**options.__dict__, "resume": session_id}
                )

            # Run the agent with streaming
            print()  # Newline before response
            assistant_response = ""

            async for message in query(prompt=user_input, options=options):
                # Handle StreamEvent (token-level streaming)
                if isinstance(message, StreamEvent):
                    event = message.event
                    event_type = event.get("type", "")

                    if event_type == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            print(text, end="", flush=True)
                            assistant_response += text

                # Handle SystemMessage (init, etc.)
                elif isinstance(message, SystemMessage):
                    if message.subtype == "init" and hasattr(message, "data"):
                        session_id = message.data.get("session_id")

                # Handle complete AssistantMessage (for tool use notifications)
                elif isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, "name"):
                            # Tool use block - show notification
                            print(f"\n[Using tool: {block.name}...]", flush=True)

                # Handle ResultMessage (completion)
                elif isinstance(message, ResultMessage):
                    pass  # Response already streamed via StreamEvent

            print("\n")  # Newlines after response

            # Add assistant response to history
            if assistant_response:
                conversation_history.append({"role": "assistant", "content": assistant_response})

        except KeyboardInterrupt:
            print("\n")
            if conversation_history:
                save_choice = input("Save session before exiting? (y/n): ").strip().lower()
                if save_choice == "y":
                    save_session(conversation_history)
            print("\n" + "=" * 60)
            print("Session interrupted. Goodbye!")
            print("=" * 60)
            break

        except EOFError:
            print("\n\n" + "=" * 60)
            print("Session ended. Goodbye!")
            print("=" * 60)
            break

        except Exception as e:
            logger.error(f"Error during agent execution: {e}")
            logger.error(traceback.format_exc())
            print(f"\nError: {e}")
            print("(Full details logged to .logs/ directory)")
            print("You can continue with a new query or type 'exit' to quit.\n")


def handle_command(user_input: str, conversation_history: list) -> None:
    """Handle slash commands."""
    cmd_parts = user_input[1:].split(maxsplit=1)
    cmd = cmd_parts[0].lower()
    cmd_arg = cmd_parts[1] if len(cmd_parts) > 1 else None

    if cmd == "help":
        print_help()
    elif cmd == "clear":
        conversation_history.clear()
        print("Conversation history cleared.\n")
    elif cmd == "status":
        print_status()
    elif cmd == "sessions":
        sessions = list_sessions()
        if sessions:
            print("\nSaved sessions:")
            for s in sessions[:10]:
                print(f"  - {s.stem}")
            print()
        else:
            print("No saved sessions found.\n")
    elif cmd == "save":
        save_session(conversation_history, cmd_arg)
    else:
        print(f"Unknown command: /{cmd}. Type /help for available commands.\n")
