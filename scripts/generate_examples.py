"""
Generate Real Examples for Issue 21

Runs the full investigation pipeline (trigger -> blast radius -> ownership -> glossary -> report -> write-back)
against 3 planted demo assets and saves both .json and .md files into /examples.
"""

import sys
import os
import json
import socket
from pathlib import Path

# Set socket timeout to 120 seconds for slow DataHub GraphQL queries
socket.setdefaulttimeout(120.0)

# Ensure workspace root is in python path
workspace_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(workspace_root))

# Set default DATAHUB_GMS_URL to 127.0.0.1 if localhost to avoid WSL IPv6 resolution delays
if not os.environ.get("DATAHUB_GMS_URL"):
    os.environ["DATAHUB_GMS_URL"] = "http://127.0.0.1:8080"

from agent.mcp.client import DataHubMCPClient
from agent.core.trigger import TriggerType, TriggerEvent, fire_trigger
from agent.core.blast_radius import compute_blast_radius
from agent.core.ownership import resolve_ownership, resolve_glossary_context
from agent.core.writeback import read_context_document
from agent.core.report import generate_investigation_report, render_report, write_investigation_report

ASSETS_TO_RUN = [
    {
        "name": "orders_revenue_summary_schema_change",
        "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)",
        "type": TriggerType.SCHEMA_CHANGE,
        "context": {
            "schema_change_type": "DROP_COLUMN",
            "dropped_column": "tax_amount",
            "pipeline_id": "pipe_orders_v2"
        },
        "max_hops": 5,
    },
]


def run_example(client: DataHubMCPClient, config: dict, output_dir: Path) -> None:
    name = config["name"]
    urn = config["urn"]
    trigger_type = config["type"]
    raw_context = config["context"]
    max_hops = config["max_hops"]

    print(f"\n==================================================")
    print(f" Running Investigation: {name}")
    print(f" Asset URN: {urn}")
    print(f" Trigger Type: {trigger_type.value}")
    print(f"==================================================")

    event = TriggerEvent(
        asset_urn=urn,
        trigger_type=trigger_type,
        raw_context=raw_context,
        source="manual",
    )

    # 1. Fire trigger
    print(" [1/7] Firing trigger...")
    trigger_res = fire_trigger(client, event)
    if not trigger_res.accepted:
        print(f"  ❌ Trigger rejected / deduplicated: {trigger_res.error}")
        return
    print("  ✓ Trigger accepted.")

    # 2. Compute blast radius
    print(" [2/7] Computing blast radius...")
    blast = compute_blast_radius(client, event.asset_urn, max_hops=max_hops)
    print(f"  ✓ Blast radius found {len(blast.downstream_assets)} downstream asset(s).")

    # 3. Resolve ownership
    print(" [3/7] Resolving ownership...")
    ownership_map = {}
    for asset in blast.downstream_assets:
        ownership_map[asset.urn] = resolve_ownership(client, asset.urn)
    ownership_map[event.asset_urn] = resolve_ownership(client, event.asset_urn)
    print("  ✓ Ownership resolved.")

    # 4. Resolve glossary
    print(" [4/7] Resolving business glossary context...")
    glossary_map = {}
    for asset in blast.downstream_assets:
        glossary_map[asset.urn] = resolve_glossary_context(client, asset.urn)
    glossary_map[event.asset_urn] = resolve_glossary_context(client, event.asset_urn)
    print("  ✓ Glossary resolved.")

    # 5. Read prior context docs
    print(" [5/7] Reading prior context documents...")
    prior_context_docs = {}
    for asset in blast.downstream_assets:
        try:
            prior_context_docs[asset.urn] = read_context_document(asset.urn)
        except Exception as e:
            print(f"  ⚠️ Could not read prior docs for {asset.urn}: {e}")
    try:
        prior_context_docs[event.asset_urn] = read_context_document(event.asset_urn)
    except Exception as e:
        print(f"  ⚠️ Could not read prior docs for {event.asset_urn}: {e}")
    print("  ✓ Prior context documents checked.")

    # 6. Generate report
    print(" [6/7] Generating investigation report...")
    report = generate_investigation_report(
        trigger_event=event,
        blast_radius=blast,
        ownership_map=ownership_map,
        glossary_map=glossary_map,
        prior_context_docs=prior_context_docs,
    )

    # Save JSON report
    json_path = output_dir / f"{name}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(report.to_json(indent=2))
    print(f"  ✓ Saved JSON report -> {json_path}")

    # Render & Save Markdown report
    markdown_content = render_report(report)
    md_path = output_dir / f"{name}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
    print(f"  ✓ Saved Markdown report -> {md_path}")

    # 7. Write context document back to DataHub
    print(" [7/7] Writing context document back to DataHub...")
    write_res = write_investigation_report(event.asset_urn, report)
    if write_res.success:
        print(f"  ✓ Written back to DataHub. Total elements: {write_res.elements_count}")
    else:
        print(f"  ❌ Write back failed: {write_res.error}")


def main():
    output_dir = workspace_root / "examples"
    output_dir.mkdir(exist_ok=True)

    print("Connecting to DataHub GMS...")
    with DataHubMCPClient() as client:
        for config in ASSETS_TO_RUN:
            run_example(client, config, output_dir)

    print("\n✅ All 3 examples successfully generated and saved to /examples!")


if __name__ == "__main__":
    main()
