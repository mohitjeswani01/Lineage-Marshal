"""Notification delivery layer for Issue 13.

Delivers investigation briefs to resolved owners via webhook.
Falls back to logging when no owners are resolved.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

from agent.core.ownership import OwnershipResolution, OwnerContact
from agent.core.report import InvestigationReport

logger = logging.getLogger(__name__)


@dataclass
class NotificationResult:
    success: bool
    channel: str
    recipients: list[str]
    error: str | None = None


# Configurable webhook URL (set via env for demo)
WEBHOOK_URL = os.environ.get("NOTIFICATION_WEBHOOK_URL", "").strip()


async def _send_webhook(payload: dict[str, Any]) -> bool:
    """Send notification to configured webhook URL."""
    if not WEBHOOK_URL:
        logger.warning("NOTIFICATION_WEBHOOK_URL not set — skipping webhook delivery")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(WEBHOOK_URL, json=payload)
            response.raise_for_status()
            logger.info(f"Webhook delivered successfully to {WEBHOOK_URL} (status: {response.status_code})")
            return True
    except Exception as e:
        logger.error(f"Webhook delivery failed: {e}")
        return False


def _build_notification_payload(
    report: InvestigationReport,
    ownership_map: dict[str, OwnershipResolution],
) -> dict[str, Any]:
    """Build the notification payload with all relevant context."""
    trigger_asset = report.trigger["asset_urn"]
    ownership = ownership_map.get(trigger_asset)

    recipients: list[str] = []
    if ownership and ownership.all_owners:
        for owner in ownership.all_owners:
            if owner.email:
                recipients.append(owner.email)
            else:
                recipients.append(owner.owner_urn)

    # Fallback if no owners
    if not recipients:
        recipients = ["fallback@lineage-marshal.local"]

    return {
        "event": "investigation_completed",
        "trigger": {
            "asset_urn": trigger_asset,
            "trigger_type": report.trigger["trigger_type"],
            "timestamp": report.trigger["timestamp"],
        },
        "summary": report.blast_radius_summary,
        "brief": report.trigger.get("context", {}).get("note", "Investigation completed"),
        "recipients": recipients,
        "impacted_assets": [
            {
                "urn": asset.urn,
                "impact_label": asset.impact_label,
                "impact_score": asset.impact_score,
                "has_owner": asset.ownership["has_owner"],
                "owners": [
                    {"urn": o["owner_urn"], "email": o["email"], "name": o["display_name"]}
                    for o in asset.ownership["all_owners"]
                ],
            }
            for asset in report.impacted_assets
        ],
        "unknowns": report.unknowns,
        "prior_incidents_count": len(report.prior_incidents),
    }


async def send_investigation_notification(
    report: InvestigationReport,
    ownership_map: dict[str, OwnershipResolution],
) -> NotificationResult:
    """Send investigation notification via webhook (primary) and log (fallback)."""
    payload = _build_notification_payload(report, ownership_map)
    recipients = payload["recipients"]

    # Always log for demo visibility
    logger.info(
        f"NOTIFICATION: Investigation completed for {report.trigger['asset_urn']} "
        f"— {len(payload['impacted_assets'])} impacted, "
        f"notifying: {', '.join(recipients)}"
    )

    # Try webhook
    webhook_success = await _send_webhook(payload)

    if webhook_success:
        return NotificationResult(
            success=True,
            channel="webhook",
            recipients=recipients,
        )

    # Fallback: just log
    logger.info(f"Fallback notification logged for {recipients}")
    return NotificationResult(
        success=True,
        channel="log",
        recipients=recipients,
    )