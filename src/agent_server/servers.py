"""MCP Server definitions."""

import os

from agents.mcp import MCPServerStdio

from .config import DEFAULT_SANDBOX

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
            "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY")
        }
    },
)
