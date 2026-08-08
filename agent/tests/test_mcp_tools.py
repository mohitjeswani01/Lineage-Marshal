"""Live integration tests for DataHub MCP client and tool wrappers.

Tests hit the real running DataHub instance (http://localhost:8080) and assert on live data.
"""

import pytest
from agent.mcp.client import DataHubMCPClient
from agent.mcp.tools import (
    ContextDocumentResult,
    GlossaryResult,
    LineageResult,
    NoData,
    OwnershipResult,
    UsageStatsResult,
    get_glossary_context,
    get_lineage,
    get_ownership,
    get_usage_stats,
    read_context_document,
    search_assets,
    write_context_document,
)

BROKEN_LINEAGE_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)"
NO_OWNER_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)"
STALE_FRESHNESS_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)"
NONEXISTENT_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,non_existent_fake_asset_12345,PROD)"


@pytest.fixture(scope="module")
def mcp_client():
    """Module-level fixture to manage DataHubMCPClient lifecycle."""
    client = DataHubMCPClient()
    client.start()
    yield client
    client.close()


def test_tools_list_round_trip(mcp_client):
    """AC Issue 4: Raw MCP client successfully lists available tools over stdio."""
    tools = mcp_client.list_tools()
    assert isinstance(tools, list)
    assert len(tools) >= 5

    tool_names = [t["name"] for t in tools]
    assert "search" in tool_names
    assert "get_lineage" in tool_names
    assert "get_entities" in tool_names


def test_search_known_asset(mcp_client):
    """Test asset search wrapper against planted demo asset."""
    results = search_assets(mcp_client, query="orders_revenue_summary")
    assert not isinstance(results, NoData)
    assert len(results) >= 1


def test_lineage_broken(mcp_client):
    """Test lineage wrapper against asset with broken upstream lineage."""
    lineage = get_lineage(mcp_client, urn=BROKEN_LINEAGE_URN, direction="UPSTREAM", max_hops=3)
    assert not isinstance(lineage, NoData)
    assert lineage.urn == BROKEN_LINEAGE_URN
    assert lineage.max_hops == 3


def test_lineage_depth_cap(mcp_client):
    """Test edge case guard: max_hops is capped at 10 to prevent infinite loops/OOM."""
    lineage = get_lineage(mcp_client, urn=BROKEN_LINEAGE_URN, direction="UPSTREAM", max_hops=20)
    assert not isinstance(lineage, NoData)
    assert lineage.max_hops == 10


def test_ownership_empty(mcp_client):
    """Test ownership wrapper against user_churn_predictions (owners: []).

    Verifies empty ownership is handled gracefully without throwing.
    """
    ownership = get_ownership(mcp_client, urn=NO_OWNER_URN)
    assert not isinstance(ownership, NoData)
    assert ownership.urn == NO_OWNER_URN
    assert isinstance(ownership.owners, list)


def test_glossary_context(mcp_client):
    """Test glossary and business context lookup wrapper."""
    context = get_glossary_context(mcp_client, urn=STALE_FRESHNESS_URN)
    assert not isinstance(context, NoData)
    assert context.urn == STALE_FRESHNESS_URN


def test_usage_stats(mcp_client):
    """Test usage stats wrapper handles query lookup gracefully."""
    stats = get_usage_stats(mcp_client, urn=BROKEN_LINEAGE_URN)
    assert isinstance(stats, (UsageStatsResult, NoData))


def test_read_context_document(mcp_client):
    """Test reading context documentation for an asset."""
    doc = read_context_document(mcp_client, urn=BROKEN_LINEAGE_URN)
    assert not isinstance(doc, NoData)
    assert doc.urn == BROKEN_LINEAGE_URN


def test_write_context_document_provisional(mcp_client):
    """Test writing context document onto an asset."""
    success = write_context_document(
        mcp_client,
        urn=NO_OWNER_URN,
        markdown_content="### Incident Investigation Context\nTested by Lineage Marshal Agent Phase 1",
    )
    assert success is True


def test_nonexistent_urn_graceful(mcp_client):
    """Edge case test: nonexistent asset URN returns NoData without throwing exception."""
    res = get_ownership(mcp_client, urn=NONEXISTENT_URN)
    # Must either return NoData sentinel or an empty OwnershipResult, not crash
    assert isinstance(res, (NoData, OwnershipResult))
