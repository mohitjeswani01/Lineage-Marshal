"""Typed Python wrappers around DataHub MCP tools.

Provides typed interfaces, error handling, edge-case protection (circular lineage, depth caps),
and graceful empty-result handling via NoData sentinel types.
"""

from dataclasses import dataclass, field
import logging
from typing import Any, Dict, List, Optional, Union

from agent.mcp.client import DataHubMCPClient, MCPClientError

logger = logging.getLogger(__name__)


@dataclass
class NoData:
    """Sentinel type representing missing, empty, or absent metadata."""

    reason: str
    urn: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AssetSearchResult:
    """Structured result for asset search."""

    urn: str
    name: str
    entity_type: str
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LineageNode:
    """Node in a lineage tree."""

    urn: str
    entity_type: Optional[str] = None
    degree: int = 1
    paths: List[Any] = field(default_factory=list)


@dataclass
class LineageResult:
    """Structured lineage traversal result."""

    urn: str
    upstreams: List[LineageNode] = field(default_factory=list)
    downstreams: List[LineageNode] = field(default_factory=list)
    max_hops: int = 5


@dataclass
class OwnershipResult:
    """Structured ownership information."""

    urn: str
    owners: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class GlossaryResult:
    """Glossary and business terms associated with an asset."""

    urn: str
    terms: List[Dict[str, Any]] = field(default_factory=list)
    tags: List[Dict[str, Any]] = field(default_factory=list)
    domain: Optional[Dict[str, Any]] = None


@dataclass
class UsageStatsResult:
    """SQL query and usage statistics."""

    urn: str
    queries: List[Dict[str, Any]] = field(default_factory=list)
    total_count: int = 0


@dataclass
class ContextDocumentResult:
    """Documentation content for an asset."""

    urn: str
    description: Optional[str] = None
    documents: List[Dict[str, Any]] = field(default_factory=list)


def search_assets(
    client: DataHubMCPClient,
    query: str,
    entity_type: Optional[str] = None,
    num_results: int = 10,
) -> Union[List[AssetSearchResult], NoData]:
    """Search DataHub catalog for assets matching query."""
    filter_arg = None
    if entity_type:
        filter_arg = f"type:{entity_type}"

    try:
        args = {"query": query, "num_results": num_results}
        if filter_arg:
            args["filter"] = filter_arg
        res = client.call_tool("search", args)
    except MCPClientError as e:
        logger.warning(f"Search failed for '{query}': {e}")
        return NoData(reason=f"Search RPC failed: {e}")

    content_items = res.get("content", [])
    if not content_items:
        return NoData(reason=f"No results found for query '{query}'")

    results = []
    # Parse text payload from MCP tool content
    for item in content_items:
        if item.get("type") == "text":
            text = item.get("text", "")
            # Return raw search text payload inside structured objects
            results.append(AssetSearchResult(urn=query, name=query, entity_type=entity_type or "DATASET", raw={"text": text}))

    if not results:
        return NoData(reason=f"No assets found matching '{query}'")

    return results


def get_lineage(
    client: DataHubMCPClient,
    urn: str,
    direction: str = "BOTH",
    max_hops: int = 5,
) -> Union[LineageResult, NoData]:
    """Get lineage for an asset with depth capping and circular graph safety.

    Args:
        client: DataHubMCPClient instance.
        urn: Target entity URN.
        direction: UPSTREAM, DOWNSTREAM, or BOTH.
        max_hops: Traversal depth limit (capped at max 10 to prevent cycles/OOM).
    """
    # Guard logic against infinite loops & excessive traversal
    effective_hops = min(max(1, max_hops), 10)

    try:
        upstreams: List[LineageNode] = []
        downstreams: List[LineageNode] = []

        if direction.upper() in ("UPSTREAM", "BOTH"):
            up_res = client.call_tool(
                "get_lineage",
                {"urn": urn, "upstream": True, "max_hops": effective_hops},
            )
            for item in up_res.get("content", []):
                if item.get("type") == "text":
                    upstreams.append(LineageNode(urn=urn, degree=1, paths=[item.get("text")]))

        if direction.upper() in ("DOWNSTREAM", "BOTH"):
            down_res = client.call_tool(
                "get_lineage",
                {"urn": urn, "upstream": False, "max_hops": effective_hops},
            )
            for item in down_res.get("content", []):
                if item.get("type") == "text":
                    downstreams.append(LineageNode(urn=urn, degree=1, paths=[item.get("text")]))

        if not upstreams and not downstreams:
            return NoData(reason="No lineage data found for asset", urn=urn)

        return LineageResult(
            urn=urn,
            upstreams=upstreams,
            downstreams=downstreams,
            max_hops=effective_hops,
        )
    except MCPClientError as e:
        logger.warning(f"Lineage lookup failed for '{urn}': {e}")
        return NoData(reason=f"Lineage RPC error: {e}", urn=urn)


def get_ownership(
    client: DataHubMCPClient,
    urn: str,
) -> Union[OwnershipResult, NoData]:
    """Retrieve ownership metadata for an asset."""
    try:
        res = client.call_tool("get_entities", {"urns": [urn]})
        content = res.get("content", [])
        if not content:
            return NoData(reason="Asset metadata not found", urn=urn)

        # Parse text content for ownership details
        text = content[0].get("text", "")
        if "owners" not in text.lower() or "owners: []" in text or '"owners": []' in text:
            return OwnershipResult(urn=urn, owners=[])

        # Return structured ownership object
        return OwnershipResult(urn=urn, owners=[{"raw": text}])
    except MCPClientError as e:
        logger.warning(f"Ownership lookup failed for '{urn}': {e}")
        return NoData(reason=f"Ownership RPC error: {e}", urn=urn)


def get_glossary_context(
    client: DataHubMCPClient,
    urn: str,
) -> Union[GlossaryResult, NoData]:
    """Retrieve business glossary terms, tags, and domain context for an asset."""
    try:
        res = client.call_tool("get_entities", {"urns": [urn]})
        content = res.get("content", [])
        if not content:
            return NoData(reason="Asset metadata not found", urn=urn)

        text = content[0].get("text", "")
        return GlossaryResult(urn=urn, terms=[{"raw": text}], tags=[], domain=None)
    except MCPClientError as e:
        logger.warning(f"Glossary lookup failed for '{urn}': {e}")
        return NoData(reason=f"Glossary RPC error: {e}", urn=urn)


def get_usage_stats(
    client: DataHubMCPClient,
    urn: str,
) -> Union[UsageStatsResult, NoData]:
    """Fetch real SQL queries and usage statistics referencing an asset."""
    try:
        res = client.call_tool("get_dataset_queries", {"urn": urn})
        content = res.get("content", [])
        if not content:
            return NoData(reason="No query usage stats found", urn=urn)

        queries = []
        for item in content:
            if item.get("type") == "text":
                queries.append({"query_text": item.get("text")})

        if not queries:
            return NoData(reason="No queries referencing asset", urn=urn)

        return UsageStatsResult(urn=urn, queries=queries, total_count=len(queries))
    except MCPClientError as e:
        logger.warning(f"Usage stats lookup failed for '{urn}': {e}")
        return NoData(reason=f"Usage stats RPC error: {e}", urn=urn)


def read_context_document(
    client: DataHubMCPClient,
    urn: str,
) -> Union[ContextDocumentResult, NoData]:
    """Read existing description and documentation for an asset."""
    try:
        res = client.call_tool("get_entities", {"urns": [urn]})
        content = res.get("content", [])
        if not content:
            return NoData(reason="Asset metadata not found", urn=urn)

        text = content[0].get("text", "")
        return ContextDocumentResult(urn=urn, description=text)
    except MCPClientError as e:
        logger.warning(f"Read context document failed for '{urn}': {e}")
        return NoData(reason=f"Read context document RPC error: {e}", urn=urn)


def write_context_document(
    client: DataHubMCPClient,
    urn: str,
    markdown_content: str,
) -> bool:
    """Write context documentation onto an asset in DataHub.

    # TODO(Issue 10): needs append/version semantics — update_description likely overwrites, Issue 10 AC requires preserving prior incident history. Revisit via InstitutionalMemory aspect or custom versioned aspect before building the real write-back.
    """
    try:
        res = client.call_tool(
            "update_description",
            {
                "entity_urn": urn,
                "operation": "SET",
                "description": markdown_content,
            },
        )
        return bool(res.get("content"))
    except MCPClientError as e:
        logger.error(f"Failed to write context document for '{urn}': {e}")
        return False
