from dataclasses import dataclass
from typing import Optional
from agent.mcp.client import MCPClient


mcp_client = MCPClient()


@dataclass
class InvestigationContext:
    urn: str
    trigger_type: str
    severity: str
    note: Optional[str] = None
    upstream: list = None
    downstream: list = None
    owners: list = None
    blast_radius: dict = None
    brief: str = None

    def __post_init__(self):
        if self.upstream is None:
            self.upstream = []
        if self.downstream is None:
            self.downstream = []
        if self.owners is None:
            self.owners = []
        if self.blast_radius is None:
            self.blast_radius = {}
        if self.brief is None:
            self.brief = ""


async def run_investigation(context: InvestigationContext) -> tuple[list, list]:
    upstream = await mcp_client.get_upstream(context.urn)
    downstream = await mcp_client.get_downstream(context.urn)
    context.upstream = upstream
    context.downstream = downstream
    return upstream, downstream