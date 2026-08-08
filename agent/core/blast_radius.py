from dataclasses import dataclass
from typing import Optional
from agent.core.trigger import InvestigationContext


@dataclass
class BlastRadiusResult:
    score: float
    level: str
    downstream_count: int
    ownerless_count: int
    rationale: str


async def compute_blast_radius(context: InvestigationContext) -> BlastRadiusResult:
    downstream_count = len(context.downstream)
    ownerless_count = sum(1 for node in context.downstream if not node.get("owners"))

    score = min(100, downstream_count * 5 + ownerless_count * 10)

    if score >= 75:
        level = "critical"
    elif score >= 50:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    rationale = (
        f"{downstream_count} downstream assets affected, "
        f"{ownerless_count} without clear ownership. "
        f"Severity: {context.severity}."
    )

    context.blast_radius = {
        "score": score,
        "level": level,
        "downstreamCount": downstream_count,
        "ownerlessCount": ownerless_count,
        "rationale": rationale,
    }

    return BlastRadiusResult(
        score=score,
        level=level,
        downstream_count=downstream_count,
        ownerless_count=ownerless_count,
        rationale=rationale,
    )