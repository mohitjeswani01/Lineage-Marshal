"""FastAPI routes matching frontend contract (contract.ts).

Endpoints:
  GET  /api/health        → HealthResponse
  GET  /api/assets        → AssetsResponse
  POST /api/trigger       → TriggerResponse (async, returns triggerId)
  GET  /api/trigger/{id}  → TriggerResponse (completed with full data)
  GET  /api/trigger/{id}/progress → PipelineProgress (for polling)
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from agent.core.blast_radius import BlastRadiusResult, compute_blast_radius
from agent.core.ownership import resolve_glossary_context, resolve_ownership
from agent.core.report import (
    InvestigationReport,
    generate_investigation_report,
    render_report,
)
from agent.core.trigger import TriggerEvent, TriggerType as InternalTriggerType, fire_trigger
from agent.core.writeback import WriteResult, write_context_document
from agent.integrations.notifications import NotificationResult, send_investigation_notification
from agent.mcp.client import DataHubMCPClient
from agent.mcp.tools import NoData, read_context_document

router = APIRouter()

logger = logging.getLogger(__name__)


# ─── Contract Models (matching frontend/contract.ts) ───

class TriggerType(str, Enum):
    freshness_sla = "freshness_sla"
    schema_change = "schema_change"
    pipeline_failure = "pipeline_failure"
    manual = "manual"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class PipelineStep(str, Enum):
    detect = "detect"
    investigate = "investigate"
    resolve_owner = "resolve_owner"
    notify = "notify"
    write_back = "write_back"


class StepStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class HealthResponse(BaseModel):
    status: str
    datahub: dict[str, Any] | None = None
    version: str | None = None


class Asset(BaseModel):
    urn: str
    name: str
    platform: str
    env: str
    type: str | None = None
    description: str | None = None
    owners: list[str] = []
    lastModified: int | None = None
    issue: str | None = None


class AssetsResponse(BaseModel):
    assets: list[Asset]


class TriggerRequest(BaseModel):
    urn: str
    triggerType: TriggerType
    severity: Severity
    note: str | None = None


class LineageNode(BaseModel):
    urn: str
    name: str | None = None
    depth: int | None = None
    exists: bool | None = None
    owners: list[str] = []


class BlastRadius(BaseModel):
    score: float | None = None
    level: str | None = None
    downstreamCount: int | None = None
    ownerlessCount: int | None = None
    rationale: str | None = None


class TriggerResponse(BaseModel):
    triggerId: str
    status: str  # "accepted" | "completed" | "failed"
    receivedAt: str | None = None
    durationMs: int | None = None
    asset: Asset | None = None
    upstream: list[LineageNode] = []
    downstream: list[LineageNode] = []
    owners: list[str] = []
    blastRadius: BlastRadius | None = None
    brief: str | None = None
    warnings: list[str] = []
    # Allow extra fields for forward compatibility
    class Config:
        extra = "allow"


class StepDetail(BaseModel):
    downstreamCount: int | None = None
    ownerlessCount: int | None = None
    rationale: str | None = None


class TriggerResponse(BaseModel):
    triggerId: str
    status: str  # "accepted" | "completed" | "failed"
    receivedAt: str | None = None
    durationMs: int | None = None
    asset: Asset | None = None
    upstream: list[LineageNode] = []
    downstream: list[LineageNode] = []
    owners: list[str] = []
    blastRadius: BlastRadius | None = None
    brief: str | None = None
    warnings: list[str] = []
    # Allow extra fields for forward compatibility
    class Config:
        extra = "allow"


class StepDetail(BaseModel):
    status: StepStatus
    startedAt: str | None = None
    completedAt: str | None = None
    error: str | None = None
    metadata: dict[str, Any] = {}


class PipelineProgress(BaseModel):
    triggerId: str
    currentStep: PipelineStep
    completedSteps: list[PipelineStep] = []
    failedStep: PipelineStep | None = None
    error: str | None = None
    status: str  # "running" | "completed" | "failed"
    updatedAt: str
    stepDetails: dict[PipelineStep, StepDetail] = {}


# ─── In-memory investigation store ───

investigations: dict[str, dict[str, Any]] = {}


# ─── Helpers ───

def _map_trigger_type(contract_type: str) -> InternalTriggerType:
    """Map contract trigger types to internal TriggerType enum."""
    mapping = {
        "freshness_sla": InternalTriggerType.FRESHNESS_SLA_BREACH,
        "schema_change": InternalTriggerType.SCHEMA_CHANGE,
        "pipeline_failure": InternalTriggerType.JOB_FAILURE,
        "manual": InternalTriggerType.JOB_FAILURE,  # default
    }
    return mapping.get(contract_type, InternalTriggerType.JOB_FAILURE)


def _extract_short_name(urn: str) -> str:
    """Extract readable name from URN."""
    try:
        inner = urn.split("(")[1].rstrip(")")
        parts = inner.split(",")
        return parts[1] if len(parts) >= 2 else urn
    except (IndexError, AttributeError):
        return urn


def _build_asset(urn: str, ownership_res=None, glossary_res=None, blast_asset=None) -> Asset:
    """Build Asset model from URN and optional resolution data."""
    name = _extract_short_name(urn)
    platform = "hive"
    env = "PROD"
    try:
        inner = urn.split("(")[1].rstrip(")")
        parts = inner.split(",")
        if len(parts) >= 3:
            platform = parts[0].replace("urn:li:dataPlatform:", "")
            env = parts[2]
    except Exception:
        pass

    owners = []
    if ownership_res and ownership_res.all_owners:
        owners = [o.owner_urn for o in ownership_res.all_owners]

    return Asset(
        urn=urn,
        name=name,
        platform=platform,
        env=env,
        type="DATASET",
        owners=owners,
    )


def _build_lineage_node(urn: str, depth: int, ownership_res=None) -> LineageNode:
    name = _extract_short_name(urn)
    owners = []
    if ownership_res and ownership_res.all_owners:
        owners = [o.owner_urn for o in ownership_res.all_owners]
    return LineageNode(
        urn=urn,
        name=name,
        depth=depth,
        exists=True,
        owners=owners,
    )


async def _run_full_pipeline(trigger_id: str, request: TriggerRequest) -> None:
    """Run the complete investigation pipeline in background."""
    start_time = time.time()
    investigation = investigations[trigger_id]
    investigation["status"] = "running"

    try:
        # Initialize progress tracking
        steps = [step.value for step in PipelineStep]
        investigation["progress"] = PipelineProgress(
            triggerId=trigger_id,
            currentStep=steps[0],
            completedSteps=[],
            status="running",
            updatedAt=datetime.now(timezone.utc).isoformat(),
            stepDetails={step: StepDetail(status=StepStatus.pending) for step in steps},
        )

        # Step 1: Detect (trigger validation)
        progress = investigation["progress"]
        progress.currentStep = "detect"
        progress.stepDetails["detect"].status = StepStatus.running
        progress.stepDetails["detect"].startedAt = datetime.now(timezone.utc).isoformat()

        trigger_type = _map_trigger_type(request.triggerType)
        event = TriggerEvent(
            asset_urn=request.urn,
            trigger_type=trigger_type,
            raw_context={"note": request.note} if request.note else {},
            source="api",
        )

        with DataHubMCPClient() as client:
            trigger_result = fire_trigger(client, event)

            if not trigger_result.accepted:
                raise ValueError(f"Trigger rejected: {trigger_result.error}")

            progress.stepDetails["detect"].status = StepStatus.completed
            progress.stepDetails["detect"].completedAt = datetime.now(timezone.utc).isoformat()
            progress.stepDetails["detect"].metadata = {"asset": request.urn}
            progress.completedSteps.append("detect")
            progress.updatedAt = datetime.now(timezone.utc).isoformat()

            # Step 2: Investigate (blast radius)
            progress.currentStep = "investigate"
            progress.stepDetails["investigate"].status = StepStatus.running
            progress.stepDetails["investigate"].startedAt = datetime.now(timezone.utc).isoformat()

            blast = compute_blast_radius(client, request.urn, max_hops=3)

            progress.stepDetails["investigate"].status = StepStatus.completed
            progress.stepDetails["investigate"].completedAt = datetime.now(timezone.utc).isoformat()
            progress.stepDetails["investigate"].metadata = {
                "upstream_count": 0,
                "downstream_count": blast.total_downstream_count,
            }
            progress.completedSteps.append("investigate")
            progress.updatedAt = datetime.now(timezone.utc).isoformat()

            # Step 3: Resolve owners
            progress.currentStep = "resolve_owner"
            progress.stepDetails["resolve_owner"].status = StepStatus.running
            progress.stepDetails["resolve_owner"].startedAt = datetime.now(timezone.utc).isoformat()

            ownership_map = {}
            for asset in blast.downstream_assets:
                ownership_map[asset.urn] = resolve_ownership(client, asset.urn)
            ownership_map[request.urn] = resolve_ownership(client, request.urn)

            progress.stepDetails["resolve_owner"].status = StepStatus.completed
            progress.stepDetails["resolve_owner"].completedAt = datetime.now(timezone.utc).isoformat()
            all_owners = []
            for res in ownership_map.values():
                all_owners.extend([o.owner_urn for o in res.all_owners])
            progress.stepDetails["resolve_owner"].metadata = {"owners": list(set(all_owners))}
            progress.completedSteps.append("resolve_owner")
            progress.updatedAt = datetime.now(timezone.utc).isoformat()

            # Step 4: Resolve glossary
            glossary_map = {}
            for asset in blast.downstream_assets:
                glossary_map[asset.urn] = resolve_glossary_context(client, asset.urn)
            glossary_map[request.urn] = resolve_glossary_context(client, request.urn)

            # Step 5: Read prior context
            prior_context_docs = {}
            for asset in blast.downstream_assets:
                prior_context_docs[asset.urn] = read_context_document(asset.urn)
            prior_context_docs[request.urn] = read_context_document(request.urn)

            # Step 6: Generate report
            report = generate_investigation_report(
                trigger_event=event,
                blast_radius=blast,
                ownership_map=ownership_map,
                glossary_map=glossary_map,
                prior_context_docs=prior_context_docs,
            )

            # Step 7: Write back (stub)
            progress.currentStep = "write_back"
            progress.stepDetails["write_back"].status = StepStatus.running
            progress.stepDetails["write_back"].startedAt = datetime.now(timezone.utc).isoformat()

            report_markdown = render_report(report)
            write_result = await write_context_document(request.urn, report_markdown)

            progress.stepDetails["write_back"].status = StepStatus.completed
            progress.stepDetails["write_back"].completedAt = datetime.now(timezone.utc).isoformat()
            progress.stepDetails["write_back"].metadata = {
                "written": write_result.success,
                "elements": write_result.elements_count,
            }
            progress.completedSteps.append("write_back")
            progress.updatedAt = datetime.now(timezone.utc).isoformat()

            # Step 8: Notify
            progress.currentStep = "notify"
            progress.stepDetails["notify"].status = StepStatus.running
            progress.stepDetails["notify"].startedAt = datetime.now(timezone.utc).isoformat()

            notification_result = await send_investigation_notification(report, ownership_map)

            progress.stepDetails["notify"].status = StepStatus.completed
            progress.stepDetails["notify"].completedAt = datetime.now(timezone.utc).isoformat()
            progress.stepDetails["notify"].metadata = {
                "channel": notification_result.channel,
                "recipients": notification_result.recipients,
            }
            progress.completedSteps.append("notify")
            progress.updatedAt = datetime.now(timezone.utc).isoformat()

            # Build final response
            duration_ms = int((time.time() - start_time) * 1000)

            # Build upstream/downstream nodes
            upstream_nodes = []
            downstream_nodes = []
            for asset in blast.downstream_assets:
                downstream_nodes.append(
                    _build_lineage_node(asset.urn, asset.hop_distance, ownership_map.get(asset.urn))
                )

            # Get owners for trigger asset
            trigger_ownership = ownership_map.get(request.urn)
            trigger_owners = []
            if trigger_ownership and trigger_ownership.all_owners:
                trigger_owners = [o.owner_urn for o in trigger_ownership.all_owners]

            # Build blast radius summary
            blast_radius = BlastRadius(
                score=blast.downstream_assets[0].impact_score if blast.downstream_assets else 0.0,
                level=blast.downstream_assets[0].impact_label if blast.downstream_assets else "low",
                downstreamCount=blast.total_downstream_count,
                ownerlessCount=sum(1 for a in blast.downstream_assets if not a.has_owner),
                rationale=blast.summary,
            )

            # Build warnings from report unknowns
            warnings = report.unknowns

            # Build brief
            brief = f"Investigation completed for {request.urn}: {blast.summary}"

            # Store final result
            investigation["result"] = TriggerResponse(
                triggerId=trigger_id,
                status="completed",
                receivedAt=datetime.now(timezone.utc).isoformat(),
                durationMs=duration_ms,
                asset=_build_asset(request.urn, trigger_ownership),
                upstream=upstream_nodes,
                downstream=downstream_nodes,
                owners=trigger_owners,
                blastRadius=blast_radius,
                brief=brief,
                warnings=warnings,
            )

            investigation["status"] = "completed"
            progress.status = "completed"
            progress.currentStep = "notify"
            progress.updatedAt = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        investigation["status"] = "failed"
        investigation["error"] = str(e)
        if "progress" in investigation:
            investigation["progress"].status = "failed"
            investigation["progress"].error = str(e)
            investigation["progress"].failedStep = investigation["progress"].currentStep
            investigation["progress"].updatedAt = datetime.now(timezone.utc).isoformat()
        logger.exception(f"Pipeline failed for {trigger_id}: {e}")


# ─── Routes ───

@router.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        datahub={"reachable": True, "gmsUrl": "http://localhost:8080"},
        version="0.1.0",
    )


@router.get("/api/assets", response_model=AssetsResponse)
async def list_assets():
    """List known demo assets from our seeded data."""
    demo_urns = [
        "urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,legacy_audit_export,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,monthly_reconciliation_report,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,marketing_campaign_target_list,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,revenue_analytics_dashboard,PROD)",
        "urn:li:dataset:(urn:li:dataPlatform:hive,executive_finance_summary,PROD)",
    ]

    assets = []
    with DataHubMCPClient() as client:
        for urn in demo_urns:
            ownership = resolve_ownership(client, urn)
            owners = [o.owner_urn for o in ownership.all_owners] if ownership.has_owner else []
            assets.append(Asset(
                urn=urn,
                name=_extract_short_name(urn),
                platform="hive",
                env="PROD",
                type="DATASET",
                owners=owners,
            ))

    return AssetsResponse(assets=assets)


@router.post("/api/trigger", response_model=TriggerResponse)
async def trigger(request: TriggerRequest, background_tasks: BackgroundTasks):
    """Fire a trigger and start async investigation pipeline."""
    trigger_id = str(uuid.uuid4())[:8]
    received_at = datetime.now(timezone.utc).isoformat()

    investigations[trigger_id] = {
        "status": "accepted",
        "receivedAt": received_at,
        "request": request.model_dump(),
    }

    background_tasks.add_task(_run_full_pipeline, trigger_id, request)

    return TriggerResponse(
        triggerId=trigger_id,
        status="accepted",
        receivedAt=received_at,
    )


@router.get("/api/trigger/{trigger_id}", response_model=TriggerResponse)
async def get_trigger_result(trigger_id: str):
    """Get completed investigation result (poll this after progress shows completed)."""
    if trigger_id not in investigations:
        raise HTTPException(status_code=404, detail="Trigger not found")

    inv = investigations[trigger_id]
    if inv["status"] != "completed":
        raise HTTPException(status_code=202, detail="Investigation still running")

    if "result" not in inv:
        raise HTTPException(status_code=500, detail="Investigation completed but no result")

    return inv["result"]


@router.get("/api/trigger/{trigger_id}/progress", response_model=PipelineProgress)
async def get_progress(trigger_id: str):
    """Poll investigation progress."""
    if trigger_id not in investigations:
        raise HTTPException(status_code=404, detail="Trigger not found")

    inv = investigations[trigger_id]
    if "progress" not in inv:
        raise HTTPException(status_code=404, detail="Progress not available yet")

    return inv["progress"]