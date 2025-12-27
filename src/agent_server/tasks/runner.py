"""Background task execution for research tasks."""

import asyncio
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

from agent_server.db import get_db_session, ResearchTask, OutputFile, TaskStatus
from agent_server.core.agent import stream_agent_response, AgentRole
from agent_server.config import CONFIG, logger
from .manager import TaskManager


async def run_research_task(task_id: str) -> None:
    """
    Execute a research task in the background.

    This function:
    1. Runs the Claude agent with the task prompt
    2. Tracks progress via tool use events
    3. Saves any output files to the database
    4. Updates task status on completion/failure
    """
    # Get task details
    async with get_db_session() as db:
        task = await db.get(ResearchTask, task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return

        session_id = task.session_id
        prompt = task.prompt

        task.status = TaskStatus.RUNNING.value
        task.started_at = datetime.utcnow()
        task.progress = 0.0
        task.progress_message = "Starting research..."

    logger.info(f"Starting research task {task_id}")

    accumulated_content = ""
    tool_count = 0

    try:
        # Use RESEARCHER role for background research tasks
        async for event in stream_agent_response(
            message=prompt,
            session_id=session_id,
            role=AgentRole.RESEARCHER,
        ):
            event_type = event.get("type")

            if event_type == "token":
                # Accumulate response text
                text = event.get("data", {}).get("text", "")
                accumulated_content += text

                # Update stored content periodically
                if len(accumulated_content) % 1000 < len(text):
                    await TaskManager.update_task_content(task_id, accumulated_content)

            elif event_type == "tool_use":
                tool_name = event.get("data", {}).get("name", "")
                tool_count += 1

                # Estimate progress based on tool use (cap at 90%)
                progress = min(0.9, tool_count * 0.1)
                message = f"Using {tool_name}..."

                await TaskManager.update_task_progress(task_id, progress, message)
                logger.debug(f"Task {task_id}: {message}")

            elif event_type == "done":
                usage = event.get("data", {}).get("usage")
                cost = event.get("data", {}).get("cost_usd")

                # Scan for output files
                await _scan_output_files(task_id, session_id)

                # Mark complete
                await TaskManager.complete_task(
                    task_id,
                    content=accumulated_content,
                    usage=usage,
                    cost_usd=cost,
                )
                logger.info(f"Task {task_id} completed successfully")

            elif event_type == "error":
                error_msg = event.get("data", {}).get("message", "Unknown error")
                await TaskManager.fail_task(task_id, error_msg)
                logger.error(f"Task {task_id} failed: {error_msg}")

    except asyncio.CancelledError:
        logger.info(f"Task {task_id} was cancelled")
        raise
    except Exception as e:
        logger.error(f"Task {task_id} failed with exception: {e}")
        await TaskManager.fail_task(task_id, str(e))


async def _scan_output_files(task_id: str, session_id: str) -> None:
    """Scan output directory for new files and register them."""
    output_dir = Path(CONFIG["output_dir"])

    if not output_dir.exists():
        return

    async with get_db_session() as db:
        # Get existing tracked files for this session
        result = await db.execute(
            select(OutputFile.filepath).where(OutputFile.session_id == session_id)
        )
        existing_paths = {row[0] for row in result.fetchall()}

        # Scan for new files
        new_files = []
        for filepath in output_dir.rglob("*"):
            if filepath.is_file():
                rel_path = str(filepath.relative_to(output_dir))
                if rel_path not in existing_paths:
                    file_type = _get_file_type(filepath)
                    new_file = OutputFile(
                        id=str(uuid4()),
                        session_id=session_id,
                        task_id=task_id,
                        filename=filepath.name,
                        filepath=rel_path,
                        file_type=file_type,
                        file_size=filepath.stat().st_size,
                    )
                    db.add(new_file)
                    new_files.append(filepath.name)

        if new_files:
            logger.info(f"Task {task_id}: registered {len(new_files)} output files")


def _get_file_type(filepath: Path) -> str:
    """Determine file type from extension."""
    suffix = filepath.suffix.lower()
    return {
        ".md": "markdown",
        ".json": "json",
        ".csv": "csv",
        ".txt": "text",
        ".html": "html",
        ".pdf": "pdf",
    }.get(suffix, "other")
