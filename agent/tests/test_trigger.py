"""Live integration tests for the trigger/detection layer.

Tests hit the real running DataHub instance (http://localhost:8080) and assert
on live data from the seeded demo issues.
"""

import time
from pathlib import Path

import pytest

from agent.core.trigger import (
    DEDUP_WINDOW_SECONDS,
    TriggerDeduplicator,
    TriggerEvent,
    TriggerResult,
    TriggerType,
    fire_trigger,
)
from agent.mcp.client import DataHubMCPClient

# ---------------------------------------------------------------------------
# Known test URNs from demo dataset
# ---------------------------------------------------------------------------

BROKEN_LINEAGE_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)"
NO_OWNER_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)"
STALE_FRESHNESS_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)"
NONEXISTENT_URN = "urn:li:dataset:(urn:li:dataPlatform:hive,totally_fake_asset_xyz_999,PROD)"


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


@pytest.fixture()
def tmp_dedup(tmp_path):
    """Per-test deduplicator with isolated cache file."""
    cache_path = tmp_path / ".trigger_cache_test.json"
    return TriggerDeduplicator(cache_path=cache_path, window_seconds=5)


# ---------------------------------------------------------------------------
# Tests — Trigger Event Schema
# ---------------------------------------------------------------------------

def test_trigger_event_schema():
    """AC: A trigger event schema (asset URN, trigger type, timestamp, raw context) is defined."""
    event = TriggerEvent(
        asset_urn=STALE_FRESHNESS_URN,
        trigger_type=TriggerType.FRESHNESS_SLA_BREACH,
        raw_context={"sla_hours": 24, "expected_cadence": "daily"},
    )
    assert event.asset_urn == STALE_FRESHNESS_URN
    assert event.trigger_type == TriggerType.FRESHNESS_SLA_BREACH
    assert event.timestamp is not None
    assert event.raw_context["sla_hours"] == 24
    assert event.source == "manual"


def test_trigger_types_enum():
    """All three trigger types are defined and accessible."""
    assert TriggerType.SCHEMA_CHANGE.value == "SCHEMA_CHANGE"
    assert TriggerType.FRESHNESS_SLA_BREACH.value == "FRESHNESS_SLA_BREACH"
    assert TriggerType.JOB_FAILURE.value == "JOB_FAILURE"


# ---------------------------------------------------------------------------
# Tests — Trigger Validation (live DataHub)
# ---------------------------------------------------------------------------

def test_trigger_accepted_real_asset(mcp_client):
    """AC: CLI/API call can fire a trigger against a real asset URN — accepted."""
    event = TriggerEvent(
        asset_urn=STALE_FRESHNESS_URN,
        trigger_type=TriggerType.FRESHNESS_SLA_BREACH,
    )
    result = fire_trigger(mcp_client, event, skip_dedup=True)
    assert result.accepted is True
    assert result.error is None
    assert result.asset_exists is True


def test_trigger_rejected_nonexistent_urn(mcp_client):
    """Edge case: trigger references a URN that doesn't exist — must fail gracefully."""
    event = TriggerEvent(
        asset_urn=NONEXISTENT_URN,
        trigger_type=TriggerType.SCHEMA_CHANGE,
    )
    result = fire_trigger(mcp_client, event, skip_dedup=True)
    assert result.accepted is False
    assert result.asset_exists is False
    assert result.error is not None
    assert "not found" in result.error.lower() or "not found" in result.error


def test_trigger_accepted_broken_lineage_asset(mcp_client):
    """Trigger fires against the broken-lineage demo asset — it exists, so accepted."""
    event = TriggerEvent(
        asset_urn=BROKEN_LINEAGE_URN,
        trigger_type=TriggerType.SCHEMA_CHANGE,
    )
    result = fire_trigger(mcp_client, event, skip_dedup=True)
    assert result.accepted is True


def test_trigger_accepted_no_owner_asset(mcp_client):
    """Trigger fires against the no-owner demo asset — it exists, so accepted."""
    event = TriggerEvent(
        asset_urn=NO_OWNER_URN,
        trigger_type=TriggerType.JOB_FAILURE,
    )
    result = fire_trigger(mcp_client, event, skip_dedup=True)
    assert result.accepted is True


# ---------------------------------------------------------------------------
# Tests — Deduplication
# ---------------------------------------------------------------------------

def test_dedup_same_trigger_rejected(mcp_client, tmp_dedup):
    """Edge case: duplicate trigger for same asset within window — deduplicated."""
    event = TriggerEvent(
        asset_urn=STALE_FRESHNESS_URN,
        trigger_type=TriggerType.FRESHNESS_SLA_BREACH,
    )

    # First fire — should be accepted
    result1 = fire_trigger(mcp_client, event, deduplicator=tmp_dedup)
    assert result1.accepted is True

    # Second fire — same (urn, type) within window — should be deduplicated
    result2 = fire_trigger(mcp_client, event, deduplicator=tmp_dedup)
    assert result2.accepted is False
    assert result2.deduplicated is True


def test_dedup_different_type_accepted(mcp_client, tmp_dedup):
    """Different trigger types on the same asset should both be accepted."""
    event1 = TriggerEvent(
        asset_urn=STALE_FRESHNESS_URN,
        trigger_type=TriggerType.FRESHNESS_SLA_BREACH,
    )
    event2 = TriggerEvent(
        asset_urn=STALE_FRESHNESS_URN,
        trigger_type=TriggerType.SCHEMA_CHANGE,
    )

    result1 = fire_trigger(mcp_client, event1, deduplicator=tmp_dedup)
    assert result1.accepted is True

    result2 = fire_trigger(mcp_client, event2, deduplicator=tmp_dedup)
    assert result2.accepted is True


def test_dedup_file_persistence(tmp_path):
    """Dedup cache persists to disk and survives across TriggerDeduplicator instances."""
    cache_path = tmp_path / ".trigger_cache_persist.json"

    # Instance 1 records a trigger
    dedup1 = TriggerDeduplicator(cache_path=cache_path, window_seconds=60)
    event = TriggerEvent(
        asset_urn="urn:li:dataset:(urn:li:dataPlatform:hive,test_persist,PROD)",
        trigger_type=TriggerType.JOB_FAILURE,
    )
    assert dedup1.is_duplicate(event) is False  # first time

    # Instance 2 (simulating new CLI process) reads same file
    dedup2 = TriggerDeduplicator(cache_path=cache_path, window_seconds=60)
    assert dedup2.is_duplicate(event) is True  # should be duplicate

    # Cleanup
    dedup2.clear()
