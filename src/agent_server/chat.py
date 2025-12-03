"""Interactive chat loop for the research assistant."""

import traceback

from agents import Runner
from agents.stream_events import RawResponsesStreamEvent, RunItemStreamEvent
from openai.types.responses import ResponseTextDeltaEvent

from agent_server.config import CONFIG, logger
from agent_server.session import save_session, load_session, list_sessions
from agent_server.cli import print_help, print_status
from agent_server.servers import thinking_server
from agent_server.agent_definitions import orchestration_agent


async def interactive_chat(resume_session: str = None) -> None:
    """
    Run an interactive chat loop with the orchestration agent.
    Type 'exit', 'quit', or press Ctrl+C to end the session.
    """
    print("=" * 60)
    print("Research Assistant - Interactive Mode")
    print("=" * 60)
    print("Type /help for available commands")
    print("Type 'exit', 'quit', or press Ctrl+C to end the session.")
    print("=" * 60)
    print()

    # Initialize or resume conversation history
    if resume_session:
        conversation_history = load_session(resume_session)
        CONFIG["session_file"] = resume_session
    else:
        conversation_history = []

    async with thinking_server:
        orchestration_agent.mcp_servers = [thinking_server]

        while True:
            try:
                # Get user input
                user_input = input(" > ").strip()

                # Check for exit commands
                if user_input.lower() in {"exit", "quit", "q"}:
                    # Offer to save session
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

                # Add user message to conversation
                conversation_history.append({"role": "user", "content": user_input})

                # Run the agent with streaming
                print()  # Newline before response
                result = Runner.run_streamed(
                    orchestration_agent,
                    input=conversation_history,
                    max_turns=25,
                )

                # Process stream events
                await process_stream_events(result)

                print("\n")  # Newlines after response

                # Update conversation history with the full result
                conversation_history = result.to_input_list()

            except KeyboardInterrupt:
                # Offer to save on interrupt
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
                # Log full error to file, show friendly message to user
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
            for s in sessions[:10]:  # Show last 10
                print(f"  - {s.stem}")
            print()
        else:
            print("No saved sessions found.\n")
    elif cmd == "save":
        save_session(conversation_history, cmd_arg)
    else:
        print(f"Unknown command: /{cmd}. Type /help for available commands.\n")


async def process_stream_events(result) -> None:
    """Process streaming events from the agent."""
    async for event in result.stream_events():
        if isinstance(event, RawResponsesStreamEvent):
            if isinstance(event.data, ResponseTextDeltaEvent):
                # Stream text output in real-time
                print(event.data.delta, end="", flush=True)
        elif isinstance(event, RunItemStreamEvent):
            # Show progress for tool calls
            if event.item.type == "tool_call_item":
                tool_name = getattr(event.item.raw_item, 'name', 'unknown')
                print(f"\n[Calling: {tool_name}...]", flush=True)
            elif event.item.type == "tool_call_output_item":
                print("[Done]", flush=True)
