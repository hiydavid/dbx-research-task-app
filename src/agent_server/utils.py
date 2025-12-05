"""Databricks client utilities for FMAPI integration."""

from typing import Generator

import httpx
from databricks.sdk import WorkspaceClient
from openai import AsyncOpenAI


def get_databricks_host() -> str:
    """Get Databricks host from WorkspaceClient config."""
    return WorkspaceClient().config.host


def _get_async_http_client(workspace_client: WorkspaceClient) -> httpx.AsyncClient:
    """Create async HTTP client with Databricks bearer auth."""

    class BearerAuth(httpx.Auth):
        def __init__(self, get_headers_func):
            self.get_headers_func = get_headers_func

        def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, None, None]:
            auth_headers = self.get_headers_func()
            request.headers["Authorization"] = auth_headers["Authorization"]
            yield request

    return httpx.AsyncClient(
        auth=BearerAuth(workspace_client.config.authenticate),
        timeout=httpx.Timeout(300.0),
        http2=False,  # Avoid HTTP/2 connection issues across async contexts
    )


def get_async_openai_client(workspace_client: WorkspaceClient) -> AsyncOpenAI:
    """Create AsyncOpenAI client pointing to Databricks serving endpoints."""
    return AsyncOpenAI(
        base_url=f"{get_databricks_host()}/serving-endpoints",
        api_key="no-token",  # Auth handled by http_client
        http_client=_get_async_http_client(workspace_client),
    )
