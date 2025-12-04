"""Filesystem agent for file I/O operations."""

from agents import Agent, Runner, function_tool

from agent_server.config import MODELS
from agent_server.servers import filesystem_server


@function_tool
async def filesystem_agent(instructions: str) -> str:
    """
    Use the filesystem agent to read or write files.
    """
    agent = Agent(
        name="Filesystem Agent",
        model=MODELS["filesystem"]["model"],
        instructions="""
You are a filesystem assistant.
Your role is to read and write files.
Never make up or invent any output.
""",
        mcp_servers=[filesystem_server],
    )
    async with filesystem_server:
        result = await Runner.run(agent, instructions)
        return result.final_output
