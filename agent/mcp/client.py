"""Raw MCP client for DataHub using stdio subprocess transport.

Implements JSON-RPC 2.0 over stdio to interact with mcp-server-datahub.
"""

import json
import logging
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional

from agent.config import DATAHUB_GMS_TOKEN, DATAHUB_GMS_URL, MCP_SERVER_BIN, get_mcp_env

logger = logging.getLogger(__name__)


class MCPClientError(Exception):
    """Exception raised for MCP client errors."""

    pass


class DataHubMCPClient:
    """Client for DataHub MCP server running as a stdio subprocess."""

    def __init__(
        self,
        gms_url: Optional[str] = None,
        gms_token: Optional[str] = None,
        mcp_bin: Optional[str] = None,
    ):
        self.gms_url = gms_url or DATAHUB_GMS_URL
        self.gms_token = gms_token or DATAHUB_GMS_TOKEN
        self.mcp_bin = mcp_bin or MCP_SERVER_BIN
        self.process: Optional[subprocess.Popen] = None
        self._request_id = 0

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    def start(self) -> None:
        """Start the mcp-server-datahub subprocess and initialize the protocol."""
        if self.process is not None:
            return

        env = get_mcp_env()
        if self.gms_url:
            env["DATAHUB_GMS_URL"] = self.gms_url
        if self.gms_token:
            env["DATAHUB_GMS_TOKEN"] = self.gms_token

        cmd_bin = self.mcp_bin
        if not os.path.exists(cmd_bin):
            cmd_bin = "mcp-server-datahub"

        try:
            self.process = subprocess.Popen(
                [cmd_bin],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=sys.stderr,
                env=env,
                text=True,
                bufsize=1,
            )
        except Exception as e:
            raise MCPClientError(f"Failed to launch MCP server executable '{cmd_bin}': {e}") from e

        # Step 1: initialize request
        init_response = self._send_request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "lineage-marshal-agent", "version": "0.1.0"},
            },
        )

        if "error" in init_response:
            self.close()
            raise MCPClientError(f"MCP initialize failed: {init_response['error']}")

        # Step 2: initialized notification
        self._send_notification("notifications/initialized", {})

    def close(self) -> None:
        """Terminate the MCP server subprocess cleanly."""
        if self.process is not None:
            try:
                if self.process.stdin:
                    self.process.stdin.close()
            except Exception:
                pass
            try:
                self.process.terminate()
                self.process.wait(timeout=3)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None

    def __enter__(self) -> "DataHubMCPClient":
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def _send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if self.process is None or self.process.stdin is None or self.process.stdout is None:
            raise MCPClientError("MCP server is not running")

        req_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params or {},
        }

        try:
            self.process.stdin.write(json.dumps(payload) + "\n")
            self.process.stdin.flush()
        except Exception as e:
            raise MCPClientError(f"Failed to write to MCP server stdin: {e}") from e

        line = self.process.stdout.readline()
        if not line:
            raise MCPClientError("MCP server process closed stream unexpectedly")

        try:
            response = json.loads(line)
        except json.JSONDecodeError as e:
            raise MCPClientError(f"Invalid JSON received from MCP server: {line.strip()}") from e

        return response

    def _send_notification(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        if self.process is None or self.process.stdin is None:
            raise MCPClientError("MCP server is not running")

        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }
        try:
            self.process.stdin.write(json.dumps(payload) + "\n")
            self.process.stdin.flush()
        except Exception as e:
            raise MCPClientError(f"Failed to send notification to MCP server: {e}") from e

    def list_tools(self) -> List[Dict[str, Any]]:
        """Perform tools/list discovery call and return available tools."""
        response = self._send_request("tools/list", {})
        if "error" in response:
            raise MCPClientError(f"tools/list call failed: {response['error']}")
        result = response.get("result", {})
        return result.get("tools", [])

    def call_tool(self, tool_name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Invoke a tool via tools/call and return the response payload."""
        response = self._send_request(
            "tools/call",
            {
                "name": tool_name,
                "arguments": arguments or {},
            },
        )
        if "error" in response:
            raise MCPClientError(f"Tool execution for '{tool_name}' failed: {response['error']}")

        result = response.get("result", {})
        return result
