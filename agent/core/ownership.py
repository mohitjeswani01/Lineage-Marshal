from typing import Optional
from agent.core.trigger import InvestigationContext
from agent.mcp.client import MCPClient


mcp_client = MCPClient()


async def resolve_owners(context: InvestigationContext) -> list[str]:
    all_urns = [context.urn] + [n["urn"] for n in context.upstream] + [n["urn"] for n in context.downstream]
    owners_set = set()

    for urn in all_urns:
        asset_owners = await mcp_client.get_owners(urn)
        owners_set.update(asset_owners)

    context.owners = list(owners_set)
    return context.owners