"""Research agent for web search capabilities."""

from typing import List

from agents import Agent, Runner, function_tool
from pydantic import BaseModel

from agent_server.config import MODELS
from agent_server.servers import tavily_server


class ResearchSourcesModel(BaseModel):
    """Model for research agent output."""
    research_sources: List[str]
    """A list of research sources to use for research."""


@function_tool
async def research_agent(instructions: str) -> ResearchSourcesModel:
    """
    Use the research agent to find research sources using web search.
    """
    agent = Agent(
        name="Research Agent",
        model=MODELS["research"]["model"],
        instructions="""
You are a research assistant with real-time web search capabilities.
Your role is to find research sources by searching the web using Tavily.

Search Guidelines:
- Use the 'tavily-search' tool with max_results parameter (default: 5, max: 10)
- Use search_depth 'basic' for quick searches (default)
- Use search_depth 'advanced' only when you need comprehensive results
- Limit yourself to 1-3 searches per task to conserve API usage

Never make up or invent any research sources.
Always provide URLs and citations from your search results.
""",
        output_type=ResearchSourcesModel,
        mcp_servers=[tavily_server],
    )
    async with tavily_server:
        result = await Runner.run(agent, instructions)
        return result.final_output
