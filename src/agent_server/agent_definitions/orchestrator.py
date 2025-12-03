"""Orchestration agent that coordinates research tasks."""

from agents import Agent

from agent_server.agent_definitions.research import research_agent
from agent_server.agent_definitions.filesystem import filesystem_agent


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
