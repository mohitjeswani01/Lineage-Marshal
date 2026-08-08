"""CLI entry point for Lineage Marshal — manual trigger and blast-radius commands.

Usage:
    python -m agent.cli trigger --urn <URN> --type <TYPE> [--context '{"key": "val"}']
    python -m agent.cli blast-radius --urn <URN> [--max-hops N]

Examples:
    python -m agent.cli trigger \
        --urn "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)" \
        --type FRESHNESS_SLA_BREACH \
        --context '{"sla_hours": 24, "expected_cadence": "daily"}'

    python -m agent.cli blast-radius \
        --urn "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)" \
        --max-hops 3
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone

from agent.core.blast_radius import BlastRadiusResult, ImpactedAsset, compute_blast_radius
from agent.core.trigger import TriggerEvent, TriggerResult, TriggerType, fire_trigger
from agent.mcp.client import DataHubMCPClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pretty-printing helpers
# ---------------------------------------------------------------------------

def _label_color(label: str) -> str:
    """ANSI color code for impact labels (degrade gracefully if terminal doesn't support)."""
    colors = {
        "critical": "\033[91m",  # bright red
        "high": "\033[93m",      # yellow
        "medium": "\033[96m",    # cyan
        "low": "\033[92m",       # green
        "unknown": "\033[95m",   # magenta
    }
    return colors.get(label, "")

RESET = "\033[0m"


def _print_trigger_result(result: TriggerResult) -> None:
    """Pretty-print a trigger result to stdout."""
    event = result.event
    print()
    print("=" * 72)
    print("  TRIGGER RESULT")
    print("=" * 72)
    print(f"  Asset URN     : {event.asset_urn}")
    print(f"  Trigger Type  : {event.trigger_type.value}")
    print(f"  Source         : {event.source}")
    print(f"  Timestamp      : {event.timestamp.isoformat()}")
    if event.raw_context:
        print(f"  Context        : {json.dumps(event.raw_context, indent=2)}")
    print(f"  ─────────────────────────────────────────")
    if result.accepted:
        print(f"  Status         : ✅ ACCEPTED")
    elif result.deduplicated:
        print(f"  Status         : ⏳ DEDUPLICATED (rejected)")
        print(f"  Reason         : {result.error}")
    else:
        print(f"  Status         : ❌ REJECTED")
        print(f"  Reason         : {result.error}")
    print(f"  Asset exists   : {result.asset_exists}")
    print("=" * 72)
    print()


def _print_blast_radius(result: BlastRadiusResult) -> None:
    """Pretty-print blast radius results as a ranked table."""
    print()
    print("=" * 72)
    print("  BLAST RADIUS ANALYSIS")
    print("=" * 72)
    print(f"  Trigger asset  : {result.trigger_urn}")
    print(f"  Total downstream: {result.total_downstream_count}")
    print(f"  Summary        : {result.summary}")
    print("=" * 72)

    if not result.downstream_assets:
        print("  (no downstream assets)")
        print()
        return

    # Header
    print()
    print(f"  {'#':<4} {'Impact':<10} {'Score':<7} {'Hops':<5} {'Owner':<7} {'Usage':<7} {'URN'}")
    print(f"  {'─'*4} {'─'*10} {'─'*7} {'─'*5} {'─'*7} {'─'*7} {'─'*50}")

    # Show up to display_cap assets
    display = result.downstream_assets[:result.display_cap]
    for i, asset in enumerate(display, 1):
        color = _label_color(asset.impact_label)
        label = f"{color}{asset.impact_label.upper():<10}{RESET}"
        owner = "✅" if asset.has_owner else "❌"
        usage = f"{asset.usage_score:.2f}" if asset.usage_data_available else "N/A"
        # Extract short name from URN for readability
        short_urn = asset.urn
        if len(short_urn) > 50:
            # Show platform,name,env part
            try:
                inner = short_urn.split("(")[1].rstrip(")")
                parts = inner.split(",")
                short_urn = parts[1] if len(parts) >= 2 else short_urn
            except (IndexError, AttributeError):
                pass

        print(f"  {i:<4} {label} {asset.impact_score:<7.3f} {asset.hop_distance:<5} {owner:<7} {usage:<7} {asset.urn}")

    remaining = result.total_downstream_count - len(display)
    if remaining > 0:
        print(f"\n  ... and {remaining} more downstream asset(s) (not shown)")

    # Ownership gap summary
    ownerless = [a for a in result.downstream_assets if not a.has_owner]
    if ownerless:
        print(f"\n  ⚠️  {len(ownerless)} downstream asset(s) have NO OWNER — cannot be notified:")
        for a in ownerless[:5]:
            print(f"      • {a.urn}")
        if len(ownerless) > 5:
            print(f"      ... and {len(ownerless) - 5} more")

    print()


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

def _cmd_trigger(args: argparse.Namespace) -> None:
    """Execute the trigger command: validate + dedupe + blast radius."""
    # Parse raw_context JSON
    raw_context = {}
    if args.context:
        try:
            raw_context = json.loads(args.context)
        except json.JSONDecodeError as e:
            print(f"Error: --context is not valid JSON: {e}", file=sys.stderr)
            sys.exit(1)

    # Parse trigger type
    try:
        trigger_type = TriggerType(args.type.upper())
    except ValueError:
        valid = ", ".join(t.value for t in TriggerType)
        print(f"Error: invalid --type '{args.type}'. Valid types: {valid}", file=sys.stderr)
        sys.exit(1)

    event = TriggerEvent(
        asset_urn=args.urn,
        trigger_type=trigger_type,
        raw_context=raw_context,
        source="manual",
    )

    with DataHubMCPClient() as client:
        # Step 1: Fire trigger
        result = fire_trigger(client, event)
        _print_trigger_result(result)

        if not result.accepted:
            sys.exit(1 if not result.deduplicated else 2)

        # Step 2: Compute blast radius
        print("Computing blast radius...")
        blast = compute_blast_radius(client, event.asset_urn, max_hops=args.max_hops)
        _print_blast_radius(blast)


def _cmd_blast_radius(args: argparse.Namespace) -> None:
    """Execute standalone blast-radius command (skip trigger validation)."""
    with DataHubMCPClient() as client:
        result = compute_blast_radius(client, args.urn, max_hops=args.max_hops)
        _print_blast_radius(result)


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lineage-marshal",
        description="Lineage Marshal — incident investigation agent for data pipelines",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # --- trigger ---
    trigger_parser = subparsers.add_parser(
        "trigger",
        help="Fire a simulated incident trigger and compute blast radius",
    )
    trigger_parser.add_argument(
        "--urn", required=True,
        help="DataHub URN of the affected asset",
    )
    trigger_parser.add_argument(
        "--type", required=True,
        help="Trigger type: SCHEMA_CHANGE, FRESHNESS_SLA_BREACH, or JOB_FAILURE",
    )
    trigger_parser.add_argument(
        "--context", default=None,
        help='Raw context as JSON string, e.g. \'{"sla_hours": 24}\'',
    )
    trigger_parser.add_argument(
        "--max-hops", type=int, default=5,
        help="Maximum lineage traversal depth (default: 5)",
    )
    trigger_parser.set_defaults(func=_cmd_trigger)

    # --- blast-radius ---
    br_parser = subparsers.add_parser(
        "blast-radius",
        help="Compute blast radius for an asset (skip trigger validation)",
    )
    br_parser.add_argument(
        "--urn", required=True,
        help="DataHub URN of the asset to analyze",
    )
    br_parser.add_argument(
        "--max-hops", type=int, default=5,
        help="Maximum lineage traversal depth (default: 5)",
    )
    br_parser.set_defaults(func=_cmd_blast_radius)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
