import uuid
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, field, asdict
from enum import Enum

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent.core.trigger import run_investigation, InvestigationContext
from agent.core.blast_radius import compute_blast_radius
from agent.core.ownership import resolve_owners
from agent.core.writeback import write_findings
from agent.core.report import generate_brief
from agent.integrations.notifications import notify_owners
from agent.mcp.client import MCPClient


app = FastAPI(title="Lineage Marshal Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mcp_client = MCPClient()


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


class TriggerRequest(BaseModel):
    urn: str
    triggerType: TriggerType
    severity: Severity
    note: Optional[str] = None


class TriggerResponse(BaseModel):
    triggerId: str
    status: str
    receivedAt: str


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


class StepDetail(BaseModel):
    status: StepStatus
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    error: Optional[str] = None
    metadata: dict = {}


class PipelineProgress(BaseModel):
    triggerId: str
    currentStep: PipelineStep
    completedSteps: list[PipelineStep] = []
    failedStep: Optional[PipelineStep] = None
    error: Optional[str] = None
    status: str
    updatedAt: str
    stepDetails: dict[PipelineStep, StepDetail] = {}


investigations: dict[str, PipelineProgress] = {}


def create_initial_progress(trigger_id: str) -> PipelineProgress:
    now = datetime.now(timezone.utc).isoformat()
    steps = list(PipelineStep)
    return PipelineProgress(
        triggerId=trigger_id,
        currentStep=steps[0],
        completedSteps=[],
        status="running",
        updatedAt=now,
        stepDetails={
            step: StepDetail(status=StepStatus.pending)
            for step in steps
        },
    )


def update_step(
    progress: PipelineProgress,
    step: PipelineStep,
    status: StepStatus,
    error: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    detail = progress.stepDetails.get(step, StepDetail(status=StepStatus.pending))
    detail.status = status
    if status == StepStatus.running:
        detail.startedAt = now
    elif status in (StepStatus.completed, StepStatus.failed):
        detail.completedAt = now
    if error:
        detail.error = error
    if metadata:
        detail.metadata = metadata
    progress.stepDetails[step] = detail
    progress.updatedAt = now


async def run_pipeline(trigger_id: str, context: InvestigationContext) -> None:
    progress = investigations[trigger_id]
    steps = list(PipelineStep)

    try:
        for i, step in enumerate(steps):
            progress.currentStep = step
            update_step(progress, step, StepStatus.running)

            if step == PipelineStep.detect:
                await asyncio.sleep(0.5)
                update_step(progress, step, StepStatus.completed, metadata={"asset": context.urn})

            elif step == PipelineStep.investigate:
                await asyncio.sleep(1.0)
                upstream, downstream = await run_investigation(context)
                update_step(
                    progress,
                    step,
                    StepStatus.completed,
                    metadata={"upstream_count": len(upstream), "downstream_count": len(downstream)},
                )

            elif step == PipelineStep.resolve_owner:
                await asyncio.sleep(0.5)
                owners = await resolve_owners(context)
                update_step(progress, step, StepStatus.completed, metadata={"owners": owners})

            elif step == PipelineStep.notify:
                await asyncio.sleep(0.5)
                if context.owners:
                    await notify_owners(context.owners, context)
                    update_step(progress, step, StepStatus.completed, metadata={"notified": context.owners})
                else:
                    update_step(progress, step, StepStatus.completed, metadata={"notified": [], "skipped": "no owners"})

            elif step == PipelineStep.write_back:
                await asyncio.sleep(0.5)
                await write_findings(context)
                update_step(progress, step, StepStatus.completed, metadata={"written": True})

            progress.completedSteps.append(step)

        progress.status = "completed"
        progress.currentStep = steps[-1]
        progress.updatedAt = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        progress.status = "failed"
        progress.failedStep = progress.currentStep
        progress.error = str(e)
        update_step(progress, progress.currentStep, StepStatus.failed, error=str(e))
        progress.updatedAt = datetime.now(timezone.utc).isoformat()


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "datahub": {"reachable": True, "gmsUrl": "http://localhost:8080"},
        "version": "0.1.0",
    }


@app.get("/api/assets")
async def list_assets():
    assets = await mcp_client.list_assets()
    return {"assets": assets}


@app.post("/api/trigger", response_model=TriggerResponse)
async def trigger(request: TriggerRequest, background_tasks: BackgroundTasks):
    trigger_id = str(uuid.uuid4())[:8]
    context = InvestigationContext(
        urn=request.urn,
        trigger_type=request.triggerType.value,
        severity=request.severity.value,
        note=request.note,
    )

    progress = create_initial_progress(trigger_id)
    investigations[trigger_id] = progress

    background_tasks.add_task(run_pipeline, trigger_id, context)

    return TriggerResponse(
        triggerId=trigger_id,
        status="accepted",
        receivedAt=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/trigger/{trigger_id}/progress", response_model=PipelineProgress)
async def get_progress(trigger_id: str):
    if trigger_id not in investigations:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return investigations[trigger_id]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)