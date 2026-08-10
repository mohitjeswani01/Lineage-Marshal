"""Configuration module for Lineage Marshal agent.

Loads environment variables from .env and provides validated settings.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env"

if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
else:
    load_dotenv()

DATAHUB_GMS_URL = os.getenv("DATAHUB_GMS_URL", "http://localhost:8080").rstrip("/")
DATAHUB_GMS_TOKEN = os.getenv("DATAHUB_GMS_TOKEN", "")
TOOLS_IS_MUTATION_ENABLED = os.getenv("TOOLS_IS_MUTATION_ENABLED", "true").lower() in ("true", "1", "yes")

MCP_SERVER_BIN = os.getenv("MCP_SERVER_BIN", os.path.expanduser("~/.local/bin/mcp-server-datahub"))


def get_mcp_env() -> dict[str, str]:
    """Return environment variables for subprocess execution of mcp-server-datahub."""
    env = os.environ.copy()
    env["DATAHUB_GMS_URL"] = DATAHUB_GMS_URL
    if DATAHUB_GMS_TOKEN:
        env["DATAHUB_GMS_TOKEN"] = DATAHUB_GMS_TOKEN
    env["TOOLS_IS_MUTATION_ENABLED"] = "true" if TOOLS_IS_MUTATION_ENABLED else "false"
    return env
