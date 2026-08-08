"""Live integration tests for the blast radius engine.

Tests hit the real running DataHub instance (http://localhost:8080) and assert
on live lineage, usage stats, and ownership data.
"""

import pytest

from agent.core.blast_radius import (
    DISPLAY_CAP,
    BlastRadiusResult,
    ImpactedAsset,
    compute_blast_radius,
)
from agent.mcp.client import DataHubMCPClient

# ---------------------------------------------------------------------------
# Known test URNs from demo dataset
# ---------------------------------------------------------------------------

BROKEN_LINEAGE_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)"
NO_OWNER_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)"
STALE_FRESHNESS_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)"
NONEXISTENT_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,totally_fake_asset_xyz_999,PROD)"

# Showcase-ecommerce asset with known rich lineage (Hive source table).
SHOWCASE_HIVE_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,SampleHiveDataset,PROD)"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def mcp_client():
    """Module-level fixture to manage DataHubMCPClient lifecycle."""
    client = DataHubMCPClient()
    client.start()
    yield client
    client.close()


# ---------------------------------------------------------------------------
# Tests — Blast Radius Computation
# ---------------------------------------------------------------------------

def test_blast_radius_returns_result(mcp_client):
    """AC: Given a real asset, output is a BlastRadiusResult with scored downstream list."""
    result = compute_blast_radius(mcp_client, STALE_FRESHNESS_URN, max_hops=3)
    assert isinstance(result, BlastRadiusResult)
    assert result.trigger_urn == STALE_FRESHNESS_URN
    assert result.summary  # non-empty summary string


def test_blast_radius_scored_and_sorted(mcp_client):
    """AC: Output is a ranked list with computed severity/impact score."""
    result = compute_blast_radius(mcp_client, SHOWCASE_HIVE_URN, max_hops=3)
    assert isinstance(result, BlastRadiusResult)

    if result.downstream_assets:
        # Verify sorted by impact_score descending
        scores = [a.impact_score for a in result.downstream_assets]
        assert scores == sorted(scores, reverse=True), "Assets should be sorted by impact_score desc"

        # Verify each asset has required fields
        for asset in result.downstream_assets:
            assert isinstance(asset, ImpactedAsset)
            assert asset.urn  # non-empty
            assert asset.hop_distance >= 1
            assert 0.0 <= asset.usage_score <= 1.0
            assert 0.0 <= asset.impact_score <= 1.0
            assert asset.impact_label in ("critical", "high", "medium", "low", "unknown")
            assert isinstance(asset.has_owner, bool)
            assert isinstance(asset.usage_data_available, bool)


def test_blast_radius_zero_downstream(mcp_client):
    """Edge case: asset with zero downstream dependents — clean 'no impact' result."""
    # user_churn_predictions is a planted leaf-node (ML output with no downstream consumers)
    result = compute_blast_radius(mcp_client, NO_OWNER_URN, max_hops=3)
    assert isinstance(result, BlastRadiusResult)
    assert result.trigger_urn == NO_OWNER_URN
    # If no downstream, should have a clean summary — not an error
    if result.total_downstream_count == 0:
        assert "no downstream impact" in result.summary.lower()
    # If there ARE downstream assets (unexpected), they should still be valid
    for asset in result.downstream_assets:
        assert isinstance(asset, ImpactedAsset)


def test_blast_radius_no_usage_stats_flagged(mcp_client):
    """Edge case: downstream assets with no usage stats must not be silently excluded;
    they should be flagged as 'impact unknown'."""
    result = compute_blast_radius(mcp_client, SHOWCASE_HIVE_URN, max_hops=3)

    if result.downstream_assets:
        # Check that assets without usage data are flagged, not excluded
        unknown_assets = [a for a in result.downstream_assets if not a.usage_data_available]
        for asset in unknown_assets:
            assert asset.usage_score == 0.5, "Unknown usage should score at 0.5 (midpoint)"
            assert asset.impact_label == "unknown", "Unknown usage should have 'unknown' label"


def test_blast_radius_display_cap(mcp_client):
    """Edge case: verify display_cap is set on result for wide fan-out."""
    result = compute_blast_radius(mcp_client, SHOWCASE_HIVE_URN, max_hops=5)
    assert result.display_cap == DISPLAY_CAP


def test_blast_radius_impact_labels_correct(mcp_client):
    """Verify impact labels follow the documented thresholds."""
    result = compute_blast_radius(mcp_client, SHOWCASE_HIVE_URN, max_hops=3)

    for asset in result.downstream_assets:
        if not asset.usage_data_available:
            assert asset.impact_label == "unknown"
        elif asset.impact_score >= 0.70:
            assert asset.impact_label == "critical"
        elif asset.impact_score >= 0.50:
            assert asset.impact_label == "high"
        elif asset.impact_score >= 0.30:
            assert asset.impact_label == "medium"
        else:
            assert asset.impact_label == "low"


def test_blast_radius_broken_lineage_asset(mcp_client):
    """Test blast radius on asset with broken upstream — should still handle downstream."""
    result = compute_blast_radius(mcp_client, BROKEN_LINEAGE_URN, max_hops=3)
    assert isinstance(result, BlastRadiusResult)
    assert result.trigger_urn == BROKEN_LINEAGE_URN
    # Should produce valid result (possibly zero downstream — it's the downstream end of a broken chain)
    assert result.summary
