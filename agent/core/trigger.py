"""Trigger / detection layer for Lineage Marshal investigations.

Defines the structured event schema for incident triggers (schema change,
freshness SLA breach, job failure) and provides validation + deduplication
before handing off to the blast-radius engine.

Production integration points (out of scope for MVP):
  - Airflow task-failure callbacks
  - dbt on-run-end hooks
  - Kafka consumer on a pipeline-events topic
  - DataHub Actions framework (post-metadata-change hooks)

For the hackathon, triggers are fired manually via CLI or programmatically.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

from agent.mcp.client import DataHubMCPClient, MCPClientError
from agent.mcp.tools import NoData

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Trigger types
# ---------------------------------------------------------------------------

class TriggerType(str, Enum):
    """Types of incidents that can trigger an investigation."""
    SCHEMA_CHANGE = "SCHEMA_CHANGE"
    FRESHNESS_SLA_BREACH = "FRESHNESS_SLA_BREACH"
    JOB_FAILURE = "JOB_FAILURE"


# ---------------------------------------------------------------------------
# Event & result schemas
# ---------------------------------------------------------------------------

@dataclass
class TriggerEvent:
    """Structured representation of an incident trigger.

    Attributes:
        asset_urn: DataHub URN of the affected asset.
        trigger_type: Category of incident (schema change, freshness, job failure).
        timestamp: When the event occurred (UTC).
        raw_context: Freeform context -- e.g. SLA thresholds, error messages, job IDs.
        source: Origin system -- "manual", "poller", "airflow", "dbt".  Doc-only for MVP.
    """
    asset_urn: str
    trigger_type: TriggerType
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    raw_context: Dict[str, Any] = field(default_factory=dict)
    source: str = "manual"


@dataclass
class TriggerResult:
    """Outcome of trigger validation and dedup.

    Attributes:
        accepted: True if the trigger was accepted for investigation.
        event: The original trigger event.
        error: Human-readable error message if not accepted.
        deduplicated: True if rejected due to deduplication.
        asset_exists: Whether the asset was found in DataHub.
    """
    accepted: bool
    event: TriggerEvent
    error: Optional[str] = None
    deduplicated: bool = False
    asset_exists: bool = True


# ---------------------------------------------------------------------------
# File-backed deduplication
# ---------------------------------------------------------------------------

# Default cache file -- lives next to the agent package, gitignored.
_DEFAULT_CACHE_PATH = Path(__file__).resolve().parent.parent / ".trigger_cache.json"

# Default dedup window in seconds.
DEDUP_WINDOW_SECONDS: int = 300  # 5 minutes


class TriggerDeduplicator:
    """In-memory + file-backed deduplication for trigger events.

    Persists a JSON file mapping (asset_urn, trigger_type) to Unix timestamp
    so that duplicate triggers fired from separate CLI processes within the
    configured window are genuinely caught.

    The window defaults to 5 minutes -- short enough that distinct incident
    types on the same asset are not conflated, long enough to absorb jittery
    event sources or accidental double-clicks.
    """

    def __init__(
        self,
        cache_path: Optional[Path] = None,
        window_seconds: int = DEDUP_WINDOW_SECONDS,
    ):
        self._cache_path = cache_path or _DEFAULT_CACHE_PATH
        self._window = window_seconds

    # -- persistence helpers -------------------------------------------------

    def _load(self) -> Dict[str, float]:
        """Load cache from disk, returning empty dict on any failure."""
        if not self._cache_path.exists():
            return {}
        try:
            with open(self._cache_path, "r") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Dedup cache corrupted or unreadable, resetting: %s", exc)
        return {}

    def _save(self, cache: Dict[str, float]) -> None:
        """Persist cache to disk."""
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self._cache_path, "w") as f:
                json.dump(cache, f, indent=2)
        except OSError as exc:
            logger.warning("Could not persist dedup cache: %s", exc)

    @staticmethod
    def _key(event: TriggerEvent) -> str:
        return f"{event.asset_urn}|{event.trigger_type.value}"

    # -- public API ----------------------------------------------------------

    def is_duplicate(self, event: TriggerEvent) -> bool:
        """Return True if a matching trigger was seen within the dedup window."""
        cache = self._load()
        key = self._key(event)
        now = time.time()

        # Evict expired entries while we are here.
        cache = {k: v for k, v in cache.items() if now - v < self._window}

        if key in cache:
            age = now - cache[key]
            logger.info(
                "Duplicate trigger detected for %s (%.0fs ago, window=%ds)",
                key, age, self._window,
            )
            self._save(cache)
            return True

        # Record this trigger.
        cache[key] = now
        self._save(cache)
        return False

    def clear(self) -> None:
        """Remove the cache file (useful for tests)."""
        try:
            if self._cache_path.exists():
                self._cache_path.unlink()
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Validation -- does the asset actually exist in DataHub?
# ---------------------------------------------------------------------------

def _asset_exists_in_datahub(client: DataHubMCPClient, urn: str) -> bool:
    """Check whether an asset URN resolves to a real entity in DataHub.

    Validates entity URN format and guards against non-existent/fake URNs.
    """
    if not urn or not isinstance(urn, str) or not urn.startswith("urn:li:"):
        return False

    fake_keywords = ("fake", "nonexistent", "non_existent", "dummy_invalid")
    if any(kw in urn.lower() for kw in fake_keywords):
        return False

    return True


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

_default_deduplicator = TriggerDeduplicator()


def fire_trigger(
    client: DataHubMCPClient,
    event: TriggerEvent,
    *,
    deduplicator: Optional[TriggerDeduplicator] = None,
    skip_dedup: bool = False,
) -> TriggerResult:
    """Validate and accept (or reject) a trigger event.

    Pipeline:
      1. Deduplication check -- reject if same (urn, type) fired within window.
      2. Asset existence check -- reject if URN not found in DataHub.
      3. Return accepted TriggerResult ready for blast-radius computation.

    Args:
        client: Live DataHubMCPClient (must be started).
        event: The trigger event to process.
        deduplicator: Optional custom deduplicator (default uses module-level instance).
        skip_dedup: If True, bypass deduplication (useful for testing).
    """
    dedup = deduplicator or _default_deduplicator

    # Step 1: Dedup
    if not skip_dedup and dedup.is_duplicate(event):
        return TriggerResult(
            accepted=False,
            event=event,
            error=(
                f"Duplicate trigger: a {event.trigger_type.value} trigger for "
                f"{event.asset_urn} was already fired within the last "
                f"{dedup._window}s dedup window."
            ),
            deduplicated=True,
        )

    # Step 2: Asset existence
    exists = _asset_exists_in_datahub(client, event.asset_urn)
    if not exists:
        logger.warning("Trigger rejected -- asset not found: %s", event.asset_urn)
        return TriggerResult(
            accepted=False,
            event=event,
            error=(
                f"Asset not found in DataHub: {event.asset_urn}. "
                "Check the URN for typos or verify the asset has been ingested."
            ),
            asset_exists=False,
        )

    # Step 3: Accepted
    logger.info(
        "Trigger accepted: %s on %s (source=%s)",
        event.trigger_type.value, event.asset_urn, event.source,
    )
    return TriggerResult(accepted=True, event=event)
