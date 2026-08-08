"""Blast radius calculation for Lineage Marshal.

Given a triggering asset, traverses downstream lineage and cross-references
with usage stats + ownership to produce a ranked list of impacted assets —
not just a flat list of downstream tables, but which ones are high-usage /
business-critical vs effectively dead.

Scoring algorithm documented in docs/blast-radius-scoring.md.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from agent.mcp.client import DataHubMCPClient, MCPClientError
from agent.mcp.tools import (
    LineageResult,
    NoData,
    OwnershipResult,
    UsageStatsResult,
    get_lineage,
    get_ownership,
    get_usage_stats,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scoring constants — tunable, documented in docs/blast-radius-scoring.md
# ---------------------------------------------------------------------------

USAGE_WEIGHT: float = 0.50
PROXIMITY_WEIGHT: float = 0.30
OWNERSHIP_WEIGHT: float = 0.20

# Usage score saturates (hits 1.0) at this many queries.
USAGE_SATURATION: int = 10

# Maximum downstream assets shown in formatted output.
DISPLAY_CAP: int = 20

# Impact label thresholds (applied to composite score 0–1).
LABEL_CRITICAL: float = 0.70
LABEL_HIGH: float = 0.50
LABEL_MEDIUM: float = 0.30
# Below LABEL_MEDIUM → "low"
# usage_data_available == False → "unknown" (overrides numeric labels)


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------

@dataclass
class ImpactedAsset:
    """A single downstream asset with its computed impact score.

    Attributes:
        urn: DataHub URN of the downstream asset.
        hop_distance: Lineage hops from the trigger asset (1 = direct child).
        usage_score: Normalized 0–1 usage intensity, or 0.5 when unknown.
        has_owner: Whether the asset has at least one owner assigned.
        owner_contacts: List of owner URNs / email strings.
        impact_score: Composite 0–1 score (higher = more impacted).
        impact_label: Human-readable severity: critical/high/medium/low/unknown.
        usage_data_available: False when usage stats could not be retrieved.
    """
    urn: str
    hop_distance: int
    usage_score: float
    has_owner: bool
    owner_contacts: List[str] = field(default_factory=list)
    impact_score: float = 0.0
    impact_label: str = "low"
    usage_data_available: bool = True


@dataclass
class BlastRadiusResult:
    """Aggregated blast-radius output for a trigger asset.

    Attributes:
        trigger_urn: The asset that triggered the investigation.
        downstream_assets: All impacted assets, sorted by impact_score desc.
        total_downstream_count: Total number of downstream assets found.
        display_cap: Max assets shown in formatted output (default 20).
        summary: Human-readable one-liner for notifications / reports.
    """
    trigger_urn: str
    downstream_assets: List[ImpactedAsset] = field(default_factory=list)
    total_downstream_count: int = 0
    display_cap: int = DISPLAY_CAP
    summary: str = ""


# ---------------------------------------------------------------------------
# Lineage parsing
# ---------------------------------------------------------------------------

def _parse_downstream_urns(lineage_result: LineageResult) -> Dict[str, int]:
    """Extract unique downstream URNs and their hop distances from lineage nodes and text.

    Returns:
        dict mapping URN → minimum hop distance
    """
    urn_hops: Dict[str, int] = {}
    urn_pattern = re.compile(r"urn:li:dataset:\([^)]+\)")

    for node in lineage_result.downstreams:
        # Check node.urn directly
        if node.urn and node.urn != lineage_result.urn and node.urn.startswith("urn:li:"):
            hop = node.degree if node.degree > 0 else 1
            if node.urn not in urn_hops or hop < urn_hops[node.urn]:
                urn_hops[node.urn] = hop

        # Parse text paths as fallback
        for path_text in node.paths:
            text = str(path_text)
            found_urns = urn_pattern.findall(text)
            for urn in found_urns:
                if urn == lineage_result.urn:
                    continue
                hop = node.degree if node.degree > 0 else 1
                if urn not in urn_hops or hop < urn_hops[urn]:
                    urn_hops[urn] = hop

    return urn_hops


# ---------------------------------------------------------------------------
# Per-asset scoring
# ---------------------------------------------------------------------------

def _compute_usage_score(
    client: DataHubMCPClient, urn: str
) -> Tuple[float, bool]:
    """Fetch usage stats and compute normalized usage score.

    Returns:
        (usage_score, usage_data_available)
        - usage_score is 0–1 (normalized), 0.5 when unavailable.
        - usage_data_available is False when data couldn't be retrieved.
    """
    stats = get_usage_stats(client, urn)
    if isinstance(stats, NoData):
        # Data unavailable — score at midpoint, flag as unknown.
        return 0.5, False

    count = stats.total_count
    score = min(count / USAGE_SATURATION, 1.0)
    return score, True


def _compute_ownership(
    client: DataHubMCPClient, urn: str
) -> Tuple[bool, List[str]]:
    """Fetch ownership and return (has_owner, owner_contacts)."""
    ownership = get_ownership(client, urn)
    if isinstance(ownership, NoData):
        return False, []

    has_owners = len(ownership.owners) > 0
    contacts: List[str] = []
    for owner in ownership.owners:
        if isinstance(owner, dict):
            raw = owner.get("raw", "")
            user_match = re.search(r"urn:li:corpuser:[^\s,\"']+", str(raw))
            if user_match:
                contacts.append(user_match.group(0))
            elif raw:
                contacts.append(str(raw)[:100])

    return has_owners, contacts


def _impact_label(score: float, usage_data_available: bool) -> str:
    """Map composite score to human-readable impact label."""
    if not usage_data_available:
        return "unknown"
    if score >= LABEL_CRITICAL:
        return "critical"
    if score >= LABEL_HIGH:
        return "high"
    if score >= LABEL_MEDIUM:
        return "medium"
    return "low"


def _score_asset(
    client: DataHubMCPClient, urn: str, hop_distance: int
) -> ImpactedAsset:
    """Compute full impact assessment for a single downstream asset."""
    usage_score, usage_available = _compute_usage_score(client, urn)
    has_owner, contacts = _compute_ownership(client, urn)

    # Composite score
    proximity_score = 1.0 / hop_distance
    ownership_penalty = 0.0 if has_owner else 1.0

    impact = (
        USAGE_WEIGHT * usage_score
        + PROXIMITY_WEIGHT * proximity_score
        + OWNERSHIP_WEIGHT * ownership_penalty
    )
    # Clamp to 0-1
    impact = max(0.0, min(1.0, impact))

    label = _impact_label(impact, usage_available)

    return ImpactedAsset(
        urn=urn,
        hop_distance=hop_distance,
        usage_score=usage_score,
        has_owner=has_owner,
        owner_contacts=contacts,
        impact_score=round(impact, 3),
        impact_label=label,
        usage_data_available=usage_available,
    )


# ---------------------------------------------------------------------------
# Format summary
# ---------------------------------------------------------------------------

def _format_summary(result: BlastRadiusResult) -> str:
    """Generate a human-readable summary for the blast radius result."""
    total = result.total_downstream_count
    if total == 0:
        return f"No downstream impact detected for {result.trigger_urn}."

    critical = sum(1 for a in result.downstream_assets if a.impact_label == "critical")
    high = sum(1 for a in result.downstream_assets if a.impact_label == "high")
    unknown = sum(1 for a in result.downstream_assets if a.impact_label == "unknown")
    ownerless = sum(1 for a in result.downstream_assets if not a.has_owner)

    parts = [f"{total} downstream asset(s) affected"]
    if critical:
        parts.append(f"{critical} critical")
    if high:
        parts.append(f"{high} high")
    if unknown:
        parts.append(f"{unknown} unknown-impact")
    if ownerless:
        parts.append(f"{ownerless} with no owner")

    return "; ".join(parts) + "."


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def compute_blast_radius(
    client: DataHubMCPClient,
    trigger_urn: str,
    *,
    max_hops: int = 5,
) -> BlastRadiusResult:
    """Compute ranked blast radius for a triggered asset.

    Traverses downstream lineage, fetches usage stats and ownership for each
    downstream asset, and produces a scored + sorted list of impacted assets.

    Args:
        client: Live DataHubMCPClient (must be started).
        trigger_urn: URN of the asset that triggered the investigation.
        max_hops: Maximum lineage traversal depth (default 5, capped at 10 by wrapper).

    Returns:
        BlastRadiusResult with scored downstream assets sorted by impact_score desc.
    """
    logger.info("Computing blast radius for %s (max_hops=%d)", trigger_urn, max_hops)

    # Step 1: Get downstream lineage
    lineage = get_lineage(client, trigger_urn, direction="DOWNSTREAM", max_hops=max_hops)

    if isinstance(lineage, NoData):
        logger.info("No lineage data for %s — no downstream impact.", trigger_urn)
        return BlastRadiusResult(
            trigger_urn=trigger_urn,
            total_downstream_count=0,
            summary=f"No downstream impact detected for {trigger_urn}.",
        )

    # Step 2: Parse downstream URNs
    downstream_urns = _parse_downstream_urns(lineage)

    if not downstream_urns:
        logger.info("No downstream URNs parsed for %s.", trigger_urn)
        return BlastRadiusResult(
            trigger_urn=trigger_urn,
            total_downstream_count=0,
            summary=f"No downstream impact detected for {trigger_urn}.",
        )

    logger.info("Found %d downstream asset(s) for %s", len(downstream_urns), trigger_urn)

    # Step 3: Score each downstream asset
    impacted: List[ImpactedAsset] = []
    for urn, hop in downstream_urns.items():
        try:
            asset = _score_asset(client, urn, hop)
            impacted.append(asset)
        except Exception as exc:
            logger.warning("Failed to score downstream asset %s: %s", urn, exc)
            impacted.append(ImpactedAsset(
                urn=urn,
                hop_distance=hop,
                usage_score=0.5,
                has_owner=False,
                impact_score=0.5,
                impact_label="unknown",
                usage_data_available=False,
            ))

    # Step 4: Sort by impact score descending
    impacted.sort(key=lambda a: a.impact_score, reverse=True)

    result = BlastRadiusResult(
        trigger_urn=trigger_urn,
        downstream_assets=impacted,
        total_downstream_count=len(impacted),
    )
    result.summary = _format_summary(result)

    logger.info("Blast radius summary: %s", result.summary)
    return result
