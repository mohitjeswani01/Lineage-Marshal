#!/usr/bin/env python3
"""
scripts/seed_demo_issues.py

Plants 3 deliberate issues in DataHub's demo catalog for Lineage Marshal's demo narrative.
All operations are IDEMPOTENT — re-running the script is safe and will skip assets that
already exist (check-if-exists-then-upsert pattern via DataHubGraph).

Issues planted:
  1. BROKEN LINEAGE  — dataset 'orders_revenue_summary' whose upstream lineage points to a
                       fully synthetic URN that was never ingested into the catalog.
  2. NO OWNER       — dataset 'user_churn_predictions' emitted with an empty owners list.
  3. STALE FRESHNESS — dataset 'daily_revenue_report' with lastModified set 30 days in the past.

All 3 datasets are on platform=hive, env=PROD to blend with the showcase-ecommerce pack.

Usage:
    python3 scripts/seed_demo_issues.py [--gms-url http://localhost:8080] [--token YOUR_PAT]

Environment variables (override CLI flags):
    DATAHUB_GMS_URL   — defaults to http://localhost:8080
    DATAHUB_GMS_TOKEN — optional PAT; omit for open/no-auth instances
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone

from datahub.emitter.mcp import MetadataChangeProposalWrapper
from datahub.emitter.rest_emitter import DatahubRestEmitter
from datahub.ingestion.graph.client import DataHubGraph, DataHubGraphConfig
from datahub.metadata.schema_classes import (
    AuditStampClass,
    DatasetPropertiesClass,
    DatasetSnapshotClass,
    MetadataChangeEventClass,
    OwnerClass,
    OwnershipClass,
    OwnershipTypeClass,
    SchemaFieldClass,
    SchemaFieldDataTypeClass,
    SchemaMetadataClass,
    StringTypeClass,
    UpstreamClass,
    UpstreamLineageClass,
    ChangeTypeClass,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("seed_demo_issues")

# ---------------------------------------------------------------------------
# Constants — URNs
# ---------------------------------------------------------------------------
PLATFORM_HIVE = "urn:li:dataPlatform:hive"
ENV = "PROD"
ACTOR = "urn:li:corpuser:datahub"

# Issue 1 — broken lineage
BROKEN_LINEAGE_DATASET_URN = (
    f"urn:li:dataset:({PLATFORM_HIVE},orders_revenue_summary,{ENV})"
)
# Synthetic dangling upstream — this URN was NEVER ingested; the catalog has no record of it.
DANGLING_UPSTREAM_URN = (
    f"urn:li:dataset:({PLATFORM_HIVE},orders_source_legacy,{ENV})"
)

# Issue 2 — no owner
NO_OWNER_DATASET_URN = (
    f"urn:li:dataset:({PLATFORM_HIVE},user_churn_predictions,{ENV})"
)

# Issue 3 — stale freshness (lastModified 30 days ago)
STALE_DATASET_URN = (
    f"urn:li:dataset:({PLATFORM_HIVE},daily_revenue_report,{ENV})"
)
STALE_DAYS = 30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def days_ago_ms(days: int) -> int:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return int(dt.timestamp() * 1000)


def audit_stamp(ts_ms: int | None = None) -> AuditStampClass:
    return AuditStampClass(
        time=ts_ms if ts_ms is not None else now_ms(),
        actor=ACTOR,
    )


def make_minimal_schema() -> SchemaMetadataClass:
    """Return a trivial single-column schema so the dataset is well-formed."""
    return SchemaMetadataClass(
        schemaName="default",
        platform=PLATFORM_HIVE,
        version=0,
        hash="",
        platformSchema={"com.linkedin.schema.OtherSchema": {"rawSchema": ""}},
        fields=[
            SchemaFieldClass(
                fieldPath="id",
                type=SchemaFieldDataTypeClass(type=StringTypeClass()),
                nativeDataType="string",
                recursive=False,
            )
        ],
    )


def dataset_exists(graph: DataHubGraph, urn: str) -> bool:
    """Return True if the dataset URN is already present in DataHub."""
    try:
        props = graph.get_aspect(urn, DatasetPropertiesClass)
        return props is not None
    except Exception:
        return False


def emit_mcp(emitter: DatahubRestEmitter, urn: str, aspect) -> None:
    mcp = MetadataChangeProposalWrapper(entityUrn=urn, aspect=aspect)
    emitter.emit_mcp(mcp)


# ---------------------------------------------------------------------------
# Issue 1 — Broken lineage edge
# ---------------------------------------------------------------------------

def seed_broken_lineage(graph: DataHubGraph, emitter: DatahubRestEmitter) -> bool:
    """
    Create 'orders_revenue_summary' and give it an UpstreamLineage that points
    to 'orders_source_legacy' — a URN that does NOT exist in the catalog.

    If the dataset already exists this is a no-op (idempotent).
    Returns True if seeded (or already present), False on error.
    """
    urn = BROKEN_LINEAGE_DATASET_URN
    if dataset_exists(graph, urn):
        log.info("[Issue 1] orders_revenue_summary already exists — skipping create, re-emitting lineage")
    else:
        log.info("[Issue 1] Creating orders_revenue_summary …")

    ts = now_ms()

    # Dataset properties (always upsert so re-runs refresh description)
    emit_mcp(emitter, urn, DatasetPropertiesClass(
        name="orders_revenue_summary",
        description=(
            "Daily revenue roll-up aggregated from the orders source pipeline. "
            "[DEMO] Lineage intentionally references a decommissioned upstream table."
        ),
        customProperties={"demo_issue": "broken_lineage"},
        created=audit_stamp(ts),
        lastModified=audit_stamp(ts),
    ))

    # Minimal schema
    emit_mcp(emitter, urn, make_minimal_schema())

    # Upstream lineage pointing at the dangling (never-ingested) URN
    emit_mcp(emitter, urn, UpstreamLineageClass(
        upstreams=[
            UpstreamClass(
                dataset=DANGLING_UPSTREAM_URN,
                type="TRANSFORMED",
                auditStamp=audit_stamp(ts),
            )
        ]
    ))

    log.info(
        "[Issue 1] ✓ Broken lineage planted.\n"
        f"          Asset  : {urn}\n"
        f"          Dangling upstream: {DANGLING_UPSTREAM_URN}"
    )
    return True


# ---------------------------------------------------------------------------
# Issue 2 — No owner
# ---------------------------------------------------------------------------

def seed_no_owner(graph: DataHubGraph, emitter: DatahubRestEmitter) -> bool:
    """
    Create 'user_churn_predictions' with an explicitly empty owners list.
    Idempotent — safe to re-run.
    """
    urn = NO_OWNER_DATASET_URN
    if dataset_exists(graph, urn):
        log.info("[Issue 2] user_churn_predictions already exists — re-emitting ownership (empty)")
    else:
        log.info("[Issue 2] Creating user_churn_predictions …")

    ts = now_ms()

    emit_mcp(emitter, urn, DatasetPropertiesClass(
        name="user_churn_predictions",
        description=(
            "ML model output: probability scores for user churn over next 30 days. "
            "[DEMO] No owner assigned — orphaned after team reorg."
        ),
        customProperties={"demo_issue": "no_owner"},
        created=audit_stamp(ts),
        lastModified=audit_stamp(ts),
    ))

    emit_mcp(emitter, urn, make_minimal_schema())

    # Explicitly emit empty ownership — this is the planted issue
    emit_mcp(emitter, urn, OwnershipClass(
        owners=[],
        lastModified=audit_stamp(ts),
    ))

    log.info(
        "[Issue 2] ✓ No-owner condition planted.\n"
        f"          Asset: {urn}\n"
        "          Owners: [] (empty)"
    )
    return True


# ---------------------------------------------------------------------------
# Issue 3 — Stale freshness
# ---------------------------------------------------------------------------

def seed_stale_freshness(graph: DataHubGraph, emitter: DatahubRestEmitter) -> bool:
    """
    Create 'daily_revenue_report' with lastModified set 30 days in the past.
    Idempotent — safe to re-run.
    """
    urn = STALE_DATASET_URN
    stale_ts = days_ago_ms(STALE_DAYS)
    stale_dt = datetime.fromtimestamp(stale_ts / 1000, tz=timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    if dataset_exists(graph, urn):
        log.info(f"[Issue 3] daily_revenue_report already exists — re-emitting stale timestamp ({stale_dt})")
    else:
        log.info(f"[Issue 3] Creating daily_revenue_report with lastModified={stale_dt} …")

    # Properties: lastModified 30 days ago, created also 30 days ago
    emit_mcp(emitter, urn, DatasetPropertiesClass(
        name="daily_revenue_report",
        description=(
            "Daily revenue report consumed by the finance dashboard. "
            f"[DEMO] Freshness signal stale — last modified {STALE_DAYS} days ago, "
            "pipeline has not run since."
        ),
        customProperties={
            "demo_issue": "stale_freshness",
            "last_pipeline_run": stale_dt,
            "expected_update_cadence": "daily",
        },
        created=audit_stamp(stale_ts),
        lastModified=audit_stamp(stale_ts),
    ))

    emit_mcp(emitter, urn, make_minimal_schema())

    # Give it a real owner so it's not confused with Issue 2
    emit_mcp(emitter, urn, OwnershipClass(
        owners=[
            OwnerClass(
                owner="urn:li:corpuser:datahub",
                type=OwnershipTypeClass.DATAOWNER,
            )
        ],
        lastModified=audit_stamp(stale_ts),
    ))

    log.info(
        f"[Issue 3] ✓ Stale freshness planted.\n"
        f"          Asset      : {urn}\n"
        f"          lastModified: {stale_dt} ({STALE_DAYS} days ago)"
    )
    return True


# ---------------------------------------------------------------------------
# Verification helpers — query DataHub back to confirm each issue is detectable
# ---------------------------------------------------------------------------

def verify_broken_lineage(graph: DataHubGraph) -> None:
    urn = BROKEN_LINEAGE_DATASET_URN
    log.info("[Verify 1] Querying lineage for orders_revenue_summary …")
    try:
        lineage = graph.get_aspect(urn, UpstreamLineageClass)
        if lineage and lineage.upstreams:
            for up in lineage.upstreams:
                exists = dataset_exists(graph, up.dataset)
                log.info(
                    f"           upstream URN : {up.dataset}\n"
                    f"           exists in catalog: {exists}  ← should be False"
                )
        else:
            log.warning("           No upstreams found — lineage aspect may not have been stored yet")
    except Exception as e:
        log.error(f"           Verification query failed: {e}")


def verify_no_owner(graph: DataHubGraph) -> None:
    urn = NO_OWNER_DATASET_URN
    log.info("[Verify 2] Querying ownership for user_churn_predictions …")
    try:
        ownership = graph.get_aspect(urn, OwnershipClass)
        if ownership is not None:
            log.info(f"           owners: {[o.owner for o in ownership.owners]}  ← should be []")
        else:
            log.info("           ownership aspect is None (no owners set)  ← expected")
    except Exception as e:
        log.error(f"           Verification query failed: {e}")


def verify_stale_freshness(graph: DataHubGraph) -> None:
    urn = STALE_DATASET_URN
    log.info("[Verify 3] Querying properties for daily_revenue_report …")
    try:
        props = graph.get_aspect(urn, DatasetPropertiesClass)
        if props and props.lastModified:
            lm_ms = props.lastModified.time
            lm_dt = datetime.fromtimestamp(lm_ms / 1000, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
            age_days = (datetime.now(timezone.utc) - datetime.fromtimestamp(lm_ms / 1000, tz=timezone.utc)).days
            log.info(
                f"           lastModified : {lm_dt}\n"
                f"           age (days)   : {age_days}  ← should be ~{STALE_DAYS}"
            )
        else:
            log.warning("           lastModified not found in properties aspect")
    except Exception as e:
        log.error(f"           Verification query failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Seed Lineage Marshal demo issues into DataHub")
    parser.add_argument(
        "--gms-url",
        default=os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080"),
        help="DataHub GMS URL (default: http://localhost:8080)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("DATAHUB_GMS_TOKEN", ""),
        help="DataHub PAT (optional for open instances)",
    )
    args = parser.parse_args()

    gms_url = args.gms_url.rstrip("/")
    token = args.token or None

    log.info("=" * 60)
    log.info(f"Lineage Marshal — Demo Issue Seeder")
    log.info(f"GMS URL : {gms_url}")
    log.info(f"Auth    : {'PAT provided' if token else 'no auth (open instance)'}")
    log.info("=" * 60)

    # Build graph client (for reads / existence checks)
    graph_config = DataHubGraphConfig(server=gms_url, token=token)
    graph = DataHubGraph(graph_config)

    # Build emitter (for writes)
    emitter_kwargs = {"gms_server": gms_url}
    if token:
        emitter_kwargs["token"] = token
    emitter = DatahubRestEmitter(**emitter_kwargs)

    # Connectivity check
    log.info("Checking GMS connectivity …")
    try:
        server_config = graph.get_config()
        log.info(f"Connected to DataHub GMS. Auth enabled: {server_config.get('authenticationEnabled', 'unknown')}")
    except Exception as e:
        log.error(f"Cannot reach GMS at {gms_url}: {e}")
        log.error("Is DataHub running? Try: datahub docker quickstart")
        sys.exit(1)

    # ---- Seed all three issues ----
    log.info("")
    log.info("─── Planting demo issues ───")
    seed_broken_lineage(graph, emitter)
    log.info("")
    seed_no_owner(graph, emitter)
    log.info("")
    seed_stale_freshness(graph, emitter)

    # Brief wait for GMS to index the MCPs before verifying
    log.info("")
    log.info("Waiting 3s for GMS to index MCPs …")
    time.sleep(3)

    # ---- Verify all three issues are detectable ----
    log.info("")
    log.info("─── Live verification (reading back from DataHub) ───")
    verify_broken_lineage(graph)
    log.info("")
    verify_no_owner(graph)
    log.info("")
    verify_stale_freshness(graph)

    log.info("")
    log.info("=" * 60)
    log.info("Seed complete. Check DataHub UI at http://localhost:9002")
    log.info("Search for: orders_revenue_summary, user_churn_predictions, daily_revenue_report")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
