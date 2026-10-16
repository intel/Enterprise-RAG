#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright (C) 2024-2026 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

import asyncio
import json
import logging
import os
import threading
import time
from typing import Any

import httpx
from mcp import ClientSession
from mcp.client.sse import sse_client

from tests.e2e.helpers.keycloak_helper import DEFAULT_CREDENTIALS_PATH
from tests.e2e.validation.buildcfg import cfg, keycloak_base_url
from tests.e2e.validation.constants import VITE_KEYCLOAK_REALM

logger = logging.getLogger(__name__)

TOOL_CALL_TIMEOUT = 120


def _describe(error: BaseException) -> str:
    """Flatten an exception, including the ExceptionGroup the SSE task group raises.

    Duck-typed on `.exceptions` so it covers both the 3.11 builtin group and the anyio
    backport without pinning a ruff target version.
    """
    nested = getattr(error, "exceptions", None)
    if nested:
        return f"{type(error).__name__}({'; '.join(_describe(exc) for exc in nested)})"
    text = str(error)
    return f"{type(error).__name__}: {text}" if text else type(error).__name__
# Refresh this many seconds before expiry so a call never starts with a token about to die.
TOKEN_REFRESH_MARGIN = 30


class McpTokenProvider:
    """Obtains and refreshes the agent's own Keycloak access token.

    This is what an agent integration has to do: the MCP gateway is an OAuth resource
    server, so the caller runs client_credentials against its own Keycloak client and
    presents the resulting token as a Bearer token. Tokens are short-lived (900s for MCP
    agent clients by default), so they are refreshed on demand rather than fetched once.
    """

    def __init__(self, token_url: str, client_id: str, client_secret: str):
        self.token_url = token_url
        self.client_id = client_id
        self.client_secret = client_secret
        self._token = None
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def token(self) -> str:
        with self._lock:
            if self._token and time.monotonic() < self._expires_at - TOKEN_REFRESH_MARGIN:
                return self._token
            with httpx.Client(verify=False, timeout=15) as client:
                r = client.post(
                    self.token_url,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                )
            r.raise_for_status()
            payload = r.json()
            self._token = payload["access_token"]
            self._expires_at = time.monotonic() + int(payload.get("expires_in", 300))
            return self._token


class _BearerAuth(httpx.Auth):
    """Attaches a fresh bearer token to every request, including each SSE POST."""

    def __init__(self, token_provider):
        self._token_provider = token_provider

    def auth_flow(self, request):
        request.headers["Authorization"] = f"Bearer {self._token_provider()}"
        yield request


class McpHelper:
    """Helper for E2E testing the MCP gateway.

    MCP protocol uses SSE (Server-Sent Events) which requires holding an open
    HTTP connection to receive responses while sending requests via POST.
    This inherently needs async I/O or threading.

    This helper hides that complexity from synchronous test code by running a
    single persistent MCP session in a background thread. Tests call simple
    synchronous methods (list_tools, call_tool) which internally schedule work
    on the background event loop and block until the result arrives.

    Why a persistent session: the MCP routes are rate-limited per calling client, and the
    gateway caps concurrent sessions per client. Opening a new session per test (19+
    connects in ~60s) runs into both. One session for the whole suite avoids that.

    Lifecycle:
        1. __init__  → background thread opens SSE connection + MCP handshake
        2. tests     → call list_tools() / call_tool() synchronously
        3. close()   → cancels background task, closes SSE connection
    """

    def __init__(self, credentials_file):
        fqdn = cfg.get("base_domain_name")
        auth_domain = keycloak_base_url()

        self.origin = f"https://{fqdn}"
        self.mcp_base_url = f"{self.origin}/api/v1/mcp"
        self.mcp_sse_url = f"{self.mcp_base_url}/sse"
        self.mcp_health_url = f"{self.mcp_base_url}/health"
        self.mcp_metadata_url = f"{self.mcp_base_url}/.well-known/oauth-protected-resource"
        self.token_url = f"{auth_domain}/realms/{VITE_KEYCLOAK_REALM}/protocol/openid-connect/token"

        self._credentials = self._load_mcp_credentials(credentials_file)
        self._token_provider = McpTokenProvider(
            self.token_url, self._credentials["client_id"], self._credentials["client_secret"]
        )
        self._loop = None
        self._thread = None
        self._session = None
        self._error = None
        self._ready = threading.Event()
        self._start_session()

    def _load_mcp_credentials(self, credentials_file) -> dict[str, str]:
        """Parse MCP_CLIENT_ID and MCP_CLIENT_SECRET from the credentials file."""
        file_path = credentials_file if credentials_file and os.path.exists(credentials_file) else DEFAULT_CREDENTIALS_PATH
        credentials = {}
        with open(file_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    credentials[key.strip()] = value.strip().strip('"')
        return {
            "client_id": credentials.get("MCP_CLIENT_ID", ""),
            "client_secret": credentials.get("MCP_CLIENT_SECRET", ""),
        }

    @property
    def client_id(self) -> str:
        return self._credentials["client_id"]

    def access_token(self) -> str:
        """The agent's current access token - fetched on first use, refreshed on expiry."""
        return self._token_provider.token()

    def _httpx_client_factory(
        self,
        headers: dict | None = None,
        timeout: httpx.Timeout | None = None,
        auth: httpx.Auth | None = None,
    ) -> httpx.AsyncClient:
        """Factory passed to sse_client - creates an httpx client that carries the token.

        Auth is applied per request rather than as a fixed header so that a long-lived SSE
        session keeps working after the original token has expired: every tool-call POST
        picks up a freshly minted token.
        """
        return httpx.AsyncClient(
            verify=False,
            headers=headers or {},
            timeout=timeout or httpx.Timeout(TOOL_CALL_TIMEOUT),
            auth=_BearerAuth(self._token_provider.token),
        )

    def _start_session(self):
        """Spin up background thread with an asyncio event loop running the MCP session.

        Blocks until the session is fully initialized (SSE connected + MCP handshake
        complete). Whatever went wrong in the background thread is re-raised here, since a
        bare timeout says nothing about which of token, transport or handshake failed.
        """
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_session, daemon=True)
        self._thread.start()
        if not self._ready.wait(timeout=30):
            raise RuntimeError(
                f"MCP session did not initialize within 30s (no error reported). "
                f"Check that {self.mcp_sse_url} is reachable and not going through a proxy."
            )
        if self._error is not None:
            raise RuntimeError(f"MCP session failed to initialize: {_describe(self._error)}") from self._error
        if self._session is None:
            raise RuntimeError("MCP session failed to initialize: no session was established")

    def _run_session(self):
        """Entry point for the background thread - runs the event loop, records failures."""
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._session_lifecycle())
        except BaseException as exc:  # noqa: BLE001 - re-raised from _start_session
            if not self._ready.is_set():
                self._error = exc
        finally:
            # Unblock _start_session even on failure so it can report the real cause.
            self._ready.set()

    async def _session_lifecycle(self):
        """The actual MCP session — opens SSE, handshakes, then sleeps forever.

        Steps:
          1. sse_client opens GET /sse → receives the POST endpoint URL
          2. ClientSession sends 'initialize' JSON-RPC → server confirms capabilities
          3. self._ready.set() signals the main thread that it can start using the session
          4. Infinite sleep keeps the SSE connection alive
          5. On CancelledError (from close()) the context managers clean up
        """
        async with sse_client(self.mcp_sse_url, httpx_client_factory=self._httpx_client_factory) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                self._session = session
                self._ready.set()
                try:
                    while True:
                        await asyncio.sleep(1)
                except asyncio.CancelledError:
                    pass

    def _run_in_session(self, coro_func):
        """Bridge between sync test code and the async session.

        Schedules the given async function on the background event loop, then
        blocks the calling (main) thread until the result is ready. This is how
        synchronous tests can use the async MCP SDK without themselves being async.
        """
        future = asyncio.run_coroutine_threadsafe(coro_func(), self._loop)
        return future.result(timeout=TOOL_CALL_TIMEOUT)

    def close(self):
        """Tear down the background session. Called by the pytest fixture on teardown."""
        if self._loop and self._loop.is_running():
            for task in asyncio.all_tasks(self._loop):
                self._loop.call_soon_threadsafe(task.cancel)
        if self._thread:
            self._thread.join(timeout=5)

    def check_health(self) -> int:
        """Simple GET to /health — does not use the MCP session and needs no token."""
        with httpx.Client(verify=False, timeout=10) as client:
            r = client.get(self.mcp_health_url)
            return r.status_code

    def get_protected_resource_metadata(self) -> tuple[int, dict]:
        """Fetch the RFC 9728 metadata document that tells clients where to get a token."""
        with httpx.Client(verify=False, timeout=10) as client:
            r = client.get(self.mcp_metadata_url)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            return r.status_code, body

    def list_tools(self) -> list[str]:
        """Ask the MCP server what tools are available. Returns list of tool name strings."""
        async def _coro():
            tools_response = await self._session.list_tools()
            return [t.name for t in tools_response.tools]
        return self._run_in_session(_coro)

    def call_tool(self, tool_name: str, arguments: dict) -> tuple[bool, Any]:
        """Invoke an MCP tool and return (success, parsed_result).

        MCP SDK 1.27.2+ returns results with structuredContent field (parsed JSON)
        alongside legacy text content. Prefer structuredContent when available.

        Returns:
            (True, parsed_data) on success
            (False, raw_error_content) when the server reports isError=True
        """
        async def _coro():
            result = await self._session.call_tool(tool_name, arguments)
            if result.isError:
                return False, result.content

            # MCP SDK 1.27.2+ includes structuredContent with pre-parsed result
            if hasattr(result, "structuredContent") and result.structuredContent:
                structured = result.structuredContent
                # Gateway wraps all tool responses in {"result": [...]}
                if isinstance(structured, dict) and "result" in structured:
                    unwrapped = structured["result"]
                    # retrieve_context returns list with single retrieval object, unwrap for test compatibility
                    # Other tools (check_ingestion_status, list_buckets) return variable-length lists - keep as-is
                    if tool_name == "retrieve_context" and isinstance(unwrapped, list) and len(unwrapped) == 1:
                        return True, unwrapped[0]
                    return True, unwrapped
                return True, structured

            # Fallback: parse from text content (legacy behavior for older SDKs)
            content = result.content
            if not content:
                return True, None
            if len(content) == 1 and hasattr(content[0], "text"):
                text = content[0].text
                try:
                    parsed = json.loads(text)
                    # Gateway wraps in {"result": [...]}, unwrap it
                    if isinstance(parsed, dict) and "result" in parsed:
                        return True, parsed["result"]
                    return True, parsed
                except (json.JSONDecodeError, TypeError):
                    return True, text
            if all(hasattr(c, "text") for c in content):
                texts = [c.text for c in content]
                parsed = []
                for t in texts:
                    try:
                        parsed.append(json.loads(t))
                    except (json.JSONDecodeError, TypeError):
                        parsed.append(t)
                return True, parsed
            return True, content
        return self._run_in_session(_coro)

    def connect_status(self, token: str | None) -> int:
        """Open GET /sse with the given token (or none) and return the HTTP status.

        Used by the negative auth tests. Opens a separate connection rather than reusing
        the persistent session.
        """
        async def _coro():
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            async with httpx.AsyncClient(verify=False, timeout=15) as client:
                async with client.stream("GET", self.mcp_sse_url, headers=headers) as response:
                    return response.status_code
        return asyncio.run(_coro())

    def probe_session_binding(self, foreign_token: str | None = None) -> dict:
        """Check that a session UUID on its own is not enough to invoke tools.

        Opens a raw SSE stream with a valid token, takes the message endpoint the gateway
        advertises, then replays a tool call against that session with no token, with a
        bogus token, and optionally with a token belonging to a different identity. The
        session UUID travels in the URL and therefore through access logs, so each of those
        must be refused while the owning caller is still accepted.

        Returns {"endpoint": <advertised path>, <case>: <http status>, ...}.
        """
        async def _coro():
            tool_call = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": "list_buckets", "arguments": {}},
            }
            results = {}
            async with httpx.AsyncClient(verify=False, timeout=30) as client:
                headers = {"Authorization": f"Bearer {self.access_token()}", "Accept": "text/event-stream"}
                async with client.stream("GET", self.mcp_sse_url, headers=headers) as response:
                    response.raise_for_status()
                    advertised = asyncio.get_running_loop().create_future()

                    async def _drain():
                        # Keep consuming for the whole probe. Abandoning the iterator lets
                        # httpx finalize it and close the stream, at which point the gateway
                        # drops the session and every later POST is legitimately a 404.
                        async for line in response.aiter_lines():
                            if not advertised.done() and line.startswith("data:") and "session_id=" in line:
                                advertised.set_result(line.split("data:", 1)[1].strip())

                    reader = asyncio.create_task(_drain())
                    try:
                        endpoint = await asyncio.wait_for(advertised, timeout=15)
                        results["endpoint"] = endpoint.split("?")[0]
                        post_url = f"{self.origin}{endpoint}"

                        cases = {
                            "no_token": {},
                            "invalid_token": {"Authorization": "Bearer not-a-real-token"},
                        }
                        if foreign_token:
                            cases["foreign_token"] = {"Authorization": f"Bearer {foreign_token}"}
                        for case, case_headers in cases.items():
                            r = await client.post(post_url, json=tool_call, headers=case_headers)
                            results[case] = r.status_code

                        # Control: the owning caller must still be able to use the session.
                        r = await client.post(
                            post_url,
                            json=tool_call,
                            headers={"Authorization": f"Bearer {self.access_token()}"},
                        )
                        results["owner"] = r.status_code
                    finally:
                        reader.cancel()
            return results
        return asyncio.run(_coro())
