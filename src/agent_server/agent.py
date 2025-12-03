from dotenv import load_dotenv

import asyncio
import os
from pathlib import Path
from typing import List

from agents import Agent, Runner, function_tool
from agents.mcp import MCPServerStdio
from agents.repl import run_demo_loop
from pydantic import BaseModel

load_dotenv()

SANDBOX = os.path.dirname(os.path.abspath(__file__))
SCRIPT = Path(__file__).with_name("mcp_servers.py").resolve()

thinking_srv = MCPServerStdio(
    name="sequential-thinking",
    params={
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    },
)
fs_srv = MCPServerStdio(
    name="filesystem",
    params={
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", SANDBOX],
    },
)
tavily_srv = MCPServerStdio(
    name="Tavily Search",
    params={
        "command": "npx",
        "args": ["-y", "tavily-mcp@latest"],
        "env": {
            "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY")
        }
    },
)


class ResearchSourcesModel(BaseModel):
    research_sources: List[str]
    """A list of research sources to use for research."""


@function_tool
async def research_agent(instructions: str) -> ResearchSourcesModel:
    """
    Use the research agent to find research sources using web search.
    """
    agent = Agent(
        name="Research Agent",
        instructions="""
You are a research assistant with real-time web search capabilities.
Your role is to find research sources by searching the web using Tavily.

Search Guidelines:
- Use the 'search' tool with max_results parameter (default: 5, max: 10)
- Use search_depth 'basic' for quick searches (default)
- Use search_depth 'advanced' only when you need comprehensive results
- Limit yourself to 1-3 searches per task to conserve API usage

Never make up or invent any research sources.
Always provide URLs and citations from your search results.
""",
        output_type=ResearchSourcesModel,
        mcp_servers=[tavily_srv],
    )
    async with tavily_srv:
        result = await Runner.run(agent, instructions)
        return result.final_output


@function_tool
async def filesystem_agent(instructions: str) -> str:
    """
    Use the filesystem agent to read or write files.
    """
    agent = Agent(
        name="Filesystem Agent",
        instructions="""
You are a filesystem assistant.
Your role is to read and write files.
Never make up or invent any ouput.
""",
        mcp_servers=[fs_srv],
    )
    async with fs_srv:
        result = await Runner.run(agent, instructions)
        return result.final_output


orchestration_agent = Agent(
    name="Orchestration Agent",
    instructions="""
You are a research planning and orchestration assistant.
Your role is to plan the research, find existing research already done and update it.
Use the research agent to find research sources.
Use the sequentialThinking tool to create a research plan based on the sources.
Use the filesystem agent to help find existing research and update it.
Use the filesystem agent to write the output as a text file.
""",
    tools=[research_agent, filesystem_agent],
)


async def interactive_chat():
    """
    Run an interactive chat loop with the orchestration agent.
    Type 'exit' or 'quit' to end the session.
    """
    print("=" * 60)
    print("Research Assistant - Interactive Mode")
    print("=" * 60)
    print("Ask me to research any topic. I can:")
    print("  • Search the web for sources")
    print("  • Create research plans")
    print("  • Read and update existing research files")
    print("  • Generate research reports")
    print("\nType 'exit' or 'quit' to end the session.")
    print("=" * 60)

    async with thinking_srv:
        orchestration_agent.mcp_servers = [thinking_srv]
        await run_demo_loop(orchestration_agent, stream=True)


async def main():
    import sys

    # Check if user wants interactive mode
    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        await interactive_chat()
    else:
        # Original single-shot mode
        async with thinking_srv:
            goal = """
Produce a short research report of Nvidia's GPU vs. Google's TPU.
Output your research plan as a .txt file first, before you conduct your research.
After you're done with the research, output your research result as a .txt file.
"""
            orchestration_agent.mcp_servers = [thinking_srv]
            print("Running...", goal)
            result = await Runner.run(
                orchestration_agent,
                goal,
                max_turns=25,
            )
            print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main())
    