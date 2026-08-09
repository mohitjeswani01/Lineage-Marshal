"""Investigation report generator for Lineage Marshal.

Combines trigger, blast radius, ownership, glossary context, and prior incidents
into a structured investigation report (JSON + human-readable markdown).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from agent.core.blast_radius import BlastRadiusResult, ImpactedAsset
from agent.core.ownership import GlossaryResolution, OwnershipResolution, OwnerContact
from agent.core.trigger import TriggerEvent
from agent.mcp.tools import ContextDocumentResult, NoData


@dataclass
class ImpactedAssetReport:
    """Report entry for a single impacted downstream asset."""

    urn: str
    hop_distance: int
    impact_label: str
    impact_score: float
    usage_data_available: bool
    ownership: Dict[str, Any]
    glossary: Dict[str, Any]


@dataclass
class InvestigationReport:
    """Complete investigation report combining all analysis outputs."""

    trigger: Dict[str, Any]
    blast_radius_summary: str
    impacted_assets: List[ImpactedAssetReport] = field(default_factory=list)
    unknowns: List[str] = field(default_factory=list)
    prior_incidents: List[Dict[str, Any]] = field(default_factory=list)
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_json(self, indent: int = 2) -> str:
        """Serialize report to JSON string."""
        return json.dumps(asdict(self), indent=indent, default=str)


def _ownership_to_dict(res: OwnershipResolution) -> Dict[str, Any]:
    """Convert OwnershipResolution to serializable dict."""
    return {
        "has_owner": res.has_owner,
        "primary_owner": res.primary_owner,
        "all_owners": [
            {
                "owner_urn": o.owner_urn,
                "owner_type": o.owner_type,
                "email": o.email,
                "display_name": o.display_name,
            }
            for o in res.all_owners
        ],
        "notification_priority": res.notification_priority,
        "no_owner_finding": res.no_owner_finding,
    }


def _glossary_to_dict(res: GlossaryResolution) -> Dict[str, Any]:
    """Convert GlossaryResolution to serializable dict."""
    return {
        "terms": [
            {"term_urn": t.term_urn, "name": t.name, "definition": t.definition}
            for t in res.terms
        ],
        "tags": res.tags,
        "domain": res.domain,
    }


def _context_doc_to_dict(res: ContextDocumentResult) -> Dict[str, Any]:
    """Convert ContextDocumentResult to serializable dict."""
    return {
        "urn": res.urn,
        "description": res.description,
        "documents": res.documents,
    }


def generate_investigation_report(
    trigger_event: TriggerEvent,
    blast_radius: BlastRadiusResult,
    ownership_map: Dict[str, OwnershipResolution],
    glossary_map: Dict[str, GlossaryResolution],
    prior_context_docs: Dict[str, Union[ContextDocumentResult, NoData]],
) -> InvestigationReport:
    """Generate a complete investigation report from all analysis components."""
    unknowns: List[str] = []

    impacted_assets: List[ImpactedAssetReport] = []
    for asset in blast_radius.downstream_assets:
        ownership_res = ownership_map.get(asset.urn)
        glossary_res = glossary_map.get(asset.urn)

        if ownership_res is None:
            ownership_res = OwnershipResolution(
                has_owner=False,
                no_owner_finding=f"Ownership not resolved for {asset.urn}",
            )
            unknowns.append(f"Ownership resolution missing for {asset.urn}")

        if glossary_res is None:
            glossary_res = GlossaryResolution()

        if not asset.has_owner:
            unknowns.append(f"No owner assigned for {asset.urn} — cannot notify")

        if not asset.usage_data_available:
            unknowns.append(f"No usage data for {asset.urn} — impact severity unknown")

        if not glossary_res.terms:
            unknowns.append(f"No business glossary terms found for {asset.urn}")

        impacted_assets.append(
            ImpactedAssetReport(
                urn=asset.urn,
                hop_distance=asset.hop_distance,
                impact_label=asset.impact_label,
                impact_score=asset.impact_score,
                usage_data_available=asset.usage_data_available,
                ownership=_ownership_to_dict(ownership_res),
                glossary=_glossary_to_dict(glossary_res),
            )
        )

    prior_incidents: List[Dict[str, Any]] = []
    for urn, doc_result in prior_context_docs.items():
        if isinstance(doc_result, NoData):
            continue
        # Filter out fake context docs that are just entity metadata (starts with [{)
        desc = doc_result.description or ""
        if desc.strip().startswith("[{") or desc.strip().startswith("{\"urn\""):
            continue
        prior_incidents.append(_context_doc_to_dict(doc_result))

    if not prior_incidents:
        unknowns.append("First occurrence — no prior investigation context found on any impacted asset")

    trigger_dict = {
        "asset_urn": trigger_event.asset_urn,
        "trigger_type": trigger_event.trigger_type.value,
        "timestamp": trigger_event.timestamp.isoformat(),
        "context": trigger_event.raw_context,
        "source": trigger_event.source,
    }

    return InvestigationReport(
        trigger=trigger_dict,
        blast_radius_summary=blast_radius.summary,
        impacted_assets=impacted_assets,
        unknowns=unknowns,
        prior_incidents=prior_incidents,
    )


def render_report(report: InvestigationReport) -> str:
    """Render investigation report as human-readable markdown."""
    lines = [
        "# Lineage Marshal — Investigation Report",
        "",
        f"**Generated:** {report.generated_at}",
        "",
        "## Trigger",
        "",
        f"- **Asset:** `{report.trigger['asset_urn']}`",
        f"- **Type:** {report.trigger['trigger_type']}",
        f"- **Time:** {report.trigger['timestamp']}",
        f"- **Source:** {report.trigger['source']}",
        f"- **Context:** {json.dumps(report.trigger['context'], indent=2)}",
        "",
        "## Blast Radius Summary",
        "",
        f"{report.blast_radius_summary}",
        "",
        "## Impacted Assets",
        "",
    ]

    if not report.impacted_assets:
        lines.append("(no downstream assets impacted)")
    else:
        for i, asset in enumerate(report.impacted_assets, 1):
            ownership = asset.ownership
            glossary = asset.glossary

            lines.extend([
                f"### {i}. `{asset.urn}`",
                "",
                f"- **Hop Distance:** {asset.hop_distance}",
                f"- **Impact Label:** {asset.impact_label.upper()}",
                f"- **Impact Score:** {asset.impact_score:.3f}",
                f"- **Usage Data Available:** {'Yes' if asset.usage_data_available else 'No'}",
                "",
                "**Ownership:**",
            ])

            if ownership["has_owner"]:
                for owner in ownership["all_owners"]:
                    name = owner["display_name"] or owner["owner_urn"]
                    email = f" ({owner['email']})" if owner["email"] else ""
                    lines.append(f"- {name}{email} [{owner['owner_type']}]")
                lines.append(f"- **Notification Priority:** {ownership['notification_priority']}")
            else:
                lines.append(f"- ❌ {ownership['no_owner_finding']}")

            lines.append("")
            lines.append("**Business Context:**")

            if glossary["terms"]:
                for term in glossary["terms"]:
                    defn = f" — {term['definition']}" if term["definition"] else ""
                    lines.append(f"- **{term['name']}**{defn}")
            else:
                lines.append("- No glossary terms associated")

            if glossary["tags"]:
                lines.append(f"- **Tags:** {', '.join(glossary['tags'])}")
            if glossary["domain"]:
                lines.append(f"- **Domain:** {glossary['domain']}")

            lines.append("")

    if report.unknowns:
        lines.extend([
            "## ⚠️ Unknowns & Gaps",
            "",
        ])
        for u in report.unknowns:
            lines.append(f"- {u}")
        lines.append("")

    if report.prior_incidents:
        lines.extend([
            "## Prior Incidents (Context Documents)",
            "",
        ])
        for inc in report.prior_incidents:
            lines.append(f"- **{inc['urn']}**")
            if inc.get("description"):
                lines.append(f"  - Description: {inc['description'][:200]}...")
            lines.append("")
    else:
        lines.extend([
            "## Prior Incidents",
            "",
            "No prior investigation context found on any impacted asset.",
            "",
        ])

    return "\n".join(lines)