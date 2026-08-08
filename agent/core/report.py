from agent.core.trigger import InvestigationContext


async def generate_brief(context: InvestigationContext) -> str:
    trigger_labels = {
        "freshness_sla": "missed freshness SLA",
        "schema_change": "breaking schema change",
        "pipeline_failure": "pipeline failure",
        "manual": "manual investigation",
    }
    trigger_desc = trigger_labels.get(context.trigger_type, context.trigger_type)

    parts = [
        f"Asset {context.urn} triggered by {trigger_desc} ({context.severity} severity).",
    ]

    if context.upstream:
        parts.append(f"Found {len(context.upstream)} upstream dependencies.")
    if context.downstream:
        parts.append(f"Identified {len(context.downstream)} downstream consumers.")

    if context.owners:
        parts.append(f"Resolved {len(context.owners)} owner(s): {', '.join(context.owners)}.")
    else:
        parts.append("No owners found for any affected assets.")

    if context.note:
        parts.append(f"Context: {context.note}")

    brief = " ".join(parts)
    context.brief = brief
    return brief