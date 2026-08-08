# Blast Radius Scoring — How Lineage Marshal Ranks Downstream Impact

## Overview

When an incident triggers on a data asset (schema change, freshness SLA breach, job failure), Lineage Marshal doesn't just dump a flat list of downstream tables. It **scores and ranks** every downstream asset by how much real-world damage the incident causes — so notifications go to the right people about the right things, not noise.

## What feeds the score

Three signals are combined into a single **impact score** (0 to 1, higher = more impacted):

### 1. Usage intensity (weight: 50%)

**Source:** `get_usage_stats(urn)` via DataHub MCP — counts SQL queries referencing the asset.

**Why it matters:** A table queried 50 times a day by analysts and dashboards is far more impactful than a staging table nobody touches. Usage is the strongest signal for "does anyone actually care if this breaks?"

**Normalization:** `usage_score = min(query_count / 10, 1.0)` — saturates at 10 queries. In the demo dataset, most assets have 0–5 queries, so this gives good spread. Production deployments would tune the saturation point based on their query volume.

**When unavailable:** If DataHub has no query stats for an asset (common for newly created or internal-only tables), the usage score defaults to **0.5** (middle of range — we don't assume zero impact) and the asset gets flagged as `"unknown"` impact so humans know to investigate.

### 2. Proximity / hop distance (weight: 30%)

**Source:** Lineage traversal depth from the trigger asset.

**Why it matters:** A direct child (hop 1) of a broken source is almost certainly broken too. An asset 5 hops away might be buffered by intermediate caching or snapshotting. Closer = more directly impacted.

**Formula:** `proximity_score = 1.0 / hop_distance` — hop 1 = 1.0, hop 2 = 0.5, hop 3 = 0.33, etc. The inverse gives a natural decay curve that doesn't require arbitrary cutoffs.

### 3. Ownership gap penalty (weight: 20%)

**Source:** `get_ownership(urn)` via DataHub MCP.

**Why it matters:** If a downstream asset has no owner, the incident is **more dangerous** — there's nobody to notify, nobody to fix it, and the damage accumulates silently. Ownerless assets get a risk bonus that pushes them up the severity ranking.

**Formula:** `ownership_penalty = 0.0` if the asset has an owner, `1.0` if it doesn't.

## Composite formula

```
impact_score = (0.50 × usage_score) + (0.30 × proximity_score) + (0.20 × ownership_penalty)
```

The score is clamped to [0, 1].

## Impact labels

The composite score maps to a human-readable label:

| Score range | Label | Meaning |
|---|---|---|
| ≥ 0.70 | **CRITICAL** | High usage, close proximity, possibly ownerless — immediate attention |
| ≥ 0.50 | **HIGH** | Significant impact — should be in the notification |
| ≥ 0.30 | **MEDIUM** | Moderate impact — include in investigation context |
| < 0.30 | **LOW** | Minimal direct impact — note for completeness |
| N/A (no usage data) | **UNKNOWN** | Impact cannot be determined — flag for human review |

The `UNKNOWN` label overrides any numeric threshold — if we can't measure usage, we don't pretend to know the severity.

## Edge cases

| Scenario | Behavior |
|---|---|
| Asset has zero downstream dependents | Returns clean "No downstream impact detected" — not an error |
| Downstream asset has no usage stats | Scores at 0.5 usage (midpoint), labeled `UNKNOWN` |
| Downstream asset has no owner | Gets +0.20 ownership penalty, flagged in output |
| Wide fan-out (hundreds of assets) | Full list computed, but formatted output caps at **top 20** by score + count of rest |
| Lineage cycle or excessive depth | Capped at 10 hops max by the MCP wrapper (`get_lineage` guard) |

## Display cap

Formatted output (CLI, notifications) shows the **top 20 downstream assets** ranked by impact score. This keeps demo output and Slack/email notifications scannable. The full list is always available programmatically on the `BlastRadiusResult.downstream_assets` field for downstream consumers (e.g., the context document write-back in Phase 3).

## Why this scoring works for the hackathon demo

The showcase-ecommerce dataset has 70 datasets with rich lineage, ownership, and a few planted issues. The scoring algorithm surfaces meaningful differences:

- A well-owned, heavily-queried dashboard table scores **critical** when its upstream breaks
- An orphaned ML model output with no queries scores **unknown** — the agent flags it for human review instead of silently ignoring it
- A leaf-node test table with zero downstream gets a clean "no impact" result, not noise

This is the core differentiator from a naive `get_lineage → dump all edges` approach: Lineage Marshal tells you **who actually gets hurt**, not just what's connected.
