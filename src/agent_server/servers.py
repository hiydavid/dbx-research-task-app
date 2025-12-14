"""MCP Server definitions."""

import os

from dotenv import load_dotenv
from agents.mcp import MCPServerStdio

from agent_server.config import DEFAULT_SANDBOX

# Load environment variables
load_dotenv()

# Sequential Thinking MCP Server
thinking_server = MCPServerStdio(
    name="sequential-thinking",
    params={
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    },
)

# Filesystem MCP Server
filesystem_server = MCPServerStdio(
    name="filesystem",
    params={
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", DEFAULT_SANDBOX],
    },
)

# Tavily Search MCP Server
tavily_server = MCPServerStdio(
    name="Tavily Search",
    params={
        "command": "npx",
        "args": ["-y", "tavily-mcp@latest"],
        "env": {
            **os.environ,  # Inherit full environment for npx/node
            "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY", ""),
        }
    },
)
